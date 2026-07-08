# PRD: GCP Cloud Storage File-Upload Service

## Overview

The **file-upload service** is Bennie-connect's single point of truth for storing and
serving user-uploaded binary assets — profile photos, KYC documents, equipment
completion evidence, marketplace product images, service attachments, and short
videos. It wraps **Google Cloud Storage (GCS)** behind a `StorageModule`
(`backend/src/storage/`) and exposes **upload**, **delete**, and a **media library**
listing on **two identity planes** over the same service: the **user** plane
(`/api/v1/upload`, `JwtAuthGuard`) and the **admin** plane (`/api/v1/admin/upload`,
`AdminJwtGuard` + `MustChangePasswordGuard`). Both planes share the same bucket and the
same `files` index — the media library is bucket-wide.

The physical store is a **split pair of GCS buckets** (owner-locked — resolves former
Open Question 1): a **public media bucket** (`GCP_STORAGE_BUCKET`, `allUsers:objectViewer`)
for product images/videos, equipment photos, banners, etc., and a **private documents
bucket** (`GCP_PRIVATE_BUCKET`, **no** `allUsers` binding) for sensitive documents —
first consumer: **merchant KYC documents** (see
[`PRD/admin_module/merchants/merchants.md`](admin_module/merchants/merchants.md)).
Callers choose per-upload via a `visibility: 'public' | 'private'` option (default
`public`); private objects are readable **only** through short-lived **V4 signed URLs**
(see [Private bucket & signed URLs](#private-bucket--signed-urls-owner-locked-extension)).
The queryable index is a MongoDB **`files`** collection that mirrors every object the
service put in either bucket (each row records its `visibility`). Every write goes
through the service, so the collection and the buckets stay in sync (uploads insert a
row, deletes remove both the object and the row).

**Status:** 📄 **To be built.** No `StorageModule`, `GcsService`, `UploadService`,
`files` collection, or `gcp` config group exist on disk today. This document is the
build contract.

Like `MailService` (see [`PRD/oneSignal.md`](oneSignal.md)) and the planned
`FcmService` (see [`PRD/notification.md`](notification.md)), the storage client is a
**graceful no-op when GCP credentials are absent** — the module logs a warning, sets
`configured = false`, and lets the API boot normally. Upload/delete calls made while
unconfigured fail with a clear error (`UPLOAD_001`) rather than crashing the process.

Source-of-truth references for this document:
- `backend/src/mail/mail.service.ts` — the no-op-without-creds pattern this service mirrors.
- `backend/src/config/configuration.ts` — the `registerAs('configuration', …)` config-group pattern to extend (`gcp`).
- `backend/src/auth/strategies/jwt.strategy.ts` — the user JWT (`scope: "user"`) enforced by `JwtAuthGuard`.
- [`PRD/admin_module/auth/admin_auth.md`](admin_module/auth/admin_auth.md) — the admin JWT (`scope: "admin"`), `AdminJwtGuard`, and `MustChangePasswordGuard` that gate the admin plane.
- [`PRD/data_structure.md`](data_structure.md) §10 — the `files` collection (`uploaderType` + generic `uploaderId`) + `FileMetadata` response shape.

> ⚠️ **Reconciliation note (drift flags).**
> 1. `configuration.ts` has **no `gcp` group yet** — it must be added (see the
>    env-var table). The GCP service-account credential is held as **three individual
>    env vars** (`GCP_PROJECT_ID`, `GCP_CLIENT_EMAIL`, `GCP_PRIVATE_KEY`), **not** a
>    JSON key file, matching the Firebase pattern already used for FCM.
> 2. `GCP_PRIVATE_KEY` contains PEM `\n` sequences and must be **un-escaped**
>    (`key.replace(/\\n/g, '\n')`) at load — identical to `FIREBASE_PRIVATE_KEY`
>    (§ `notification.md`).
> 3. The **media bucket** is **public-read** by design (`allUsers:objectViewer`) —
>    anyone with an object URL can read it. Sensitive documents do **not** go there:
>    the owner-locked split adds a **private** bucket (`GCP_PRIVATE_BUCKET`, no
>    `allUsers` binding) reached via `visibility: 'private'` + V4 signed URLs — see
>    [Private bucket & signed URLs](#private-bucket--signed-urls-owner-locked-extension).

---

## Architecture

Two providers under one module, split by responsibility:

| Provider | Responsibility |
|----------|----------------|
| **`GcsService`** | Raw GCS operations only — client init, bucket bootstrap (create + make public), stream a buffer to an object, delete an object, build the public URL. No DB access. |
| **`UploadService`** | Orchestration + persistence — validate (type/size), generate the collision-safe object name, call `GcsService` to upload, persist the `files` record, and back on delete remove both. Owns the `files` collection and the media-library query. |

```
POST /api/v1/upload         (multipart "file", JwtAuthGuard)        → uploader = { type:"user",  id: req.user.userId }
POST /api/v1/admin/upload   (multipart "file", AdminJwtGuard + MustChangePasswordGuard) → uploader = { type:"admin", id: req.admin.adminId }
        │
        ▼
(Admin|Upload)Controller.upload(file, uploader)
        │
        ▼
UploadService.upload(file, uploader, opts?)   // uploader = { type: 'user'|'admin', id }
  1. assertConfigured()            → UPLOAD_001 if GcsService.configured === false
  2. validateType(file.mimetype)   → UPLOAD_002 if not in the allowlist
  3. validateSize(file.size)       → UPLOAD_003 if > maxUploadBytes (200 MB)
  4. objectName = buildName(...)   → "{uuid}-{sanitized-original}" (+ optional folder/)
  5. GcsService.upload(buffer, objectName, mimetype)  → UPLOAD_005 on GCS failure
  6. files.insert({ ...metadata, uploaderType: uploader.type, uploaderId: uploader.id })
  7. return FileMetadata           → { success, data: <FileMetadata> }
```

### `StorageModule`

Registers **both** controllers — `UploadController` (user plane, `JwtAuthGuard`) and
`AdminUploadController` (admin plane, `AdminJwtGuard` + `MustChangePasswordGuard`) —
over the **single** `UploadService`. Exports `UploadService` (and `GcsService` for
internal reuse by other modules such as KYC/equipment that will upload on a user's
behalf later).

```typescript
@Module({
  imports: [MongooseModule.forFeature([{ name: FileEntity.name, schema: FileSchema }])],
  controllers: [UploadController, AdminUploadController],
  providers: [GcsService, UploadService],
  exports: [UploadService, GcsService],
})
export class StorageModule {}
```

Both controllers call the same `UploadService.upload/remove/list` methods; each passes
the authenticated principal so the service stamps `uploaderType` (`"user"` / `"admin"`)
and `uploaderId` on the `files` row.

### `GcsService` — bucket bootstrap on init (`onModuleInit`)

On module init `GcsService` initializes the `@google-cloud/storage` client from
config and **ensures the target bucket exists and is public**:

1. **Check creds.** If `projectId` **and** `clientEmail` **and** `privateKey` are not
   all present → log a warning, set `configured = false`, and **return** (no client,
   no bucket calls). The API still boots.
2. **Create the client** with the service-account credentials.
3. **Ensure the bucket exists.** `bucket.exists()`; if absent, `storage.createBucket(bucket, { location: GCP_STORAGE_LOCATION })`.
4. **Ensure the bucket is public.**
   - Enable **uniform bucket-level access** (UBLA) so access is IAM-driven (no
     per-object ACLs).
   - Grant `allUsers` the `roles/storage.objectViewer` role via the bucket IAM policy
     (the exact binding is below).
5. Set `configured = true` and log the ready bucket + location.

Bucket bootstrap failures (e.g. insufficient IAM to create/modify the bucket) are
**logged, non-fatal** — the service still marks itself best-effort configured if the
client initialized; the owner may pre-provision the bucket out of band (see Open
Questions). Uploads then surface any residual failure as `UPLOAD_005`.

**Public-access IAM binding (exact).** Applied to the bucket's IAM policy so every
object is world-readable over HTTP:

```jsonc
{
  "bindings": [
    {
      "role": "roles/storage.objectViewer",
      "members": ["allUsers"]
    }
  ]
}
```

With **uniform bucket-level access** enabled, this single bucket-level binding makes
all current and future objects readable at
`https://storage.googleapis.com/<bucket>/<path>` — no per-object ACL is set. (The
equivalent CLI is `gsutil iam ch allUsers:objectViewer gs://<bucket>` +
`gsutil uniformbucketlevelaccess set on gs://<bucket>`; reference:
<https://cloud.google.com/storage/docs/access-control/making-data-public>.)

> ⚠️ **A public bucket exposes *all* objects.** Because the grant is bucket-level,
> **anything** uploaded (including KYC documents, if routed here) is readable by
> anyone who knows or guesses the URL. Object names are UUID-prefixed to make
> guessing impractical, but this is **security-by-obscurity, not access control**.
> See Open Questions for the signed-URL alternative.

### Streaming vs. in-memory buffer (200 MB uploads)

`FileInterceptor` (multer) defaults to **in-memory** storage — the whole file lands
in `file.buffer` (RAM) before the handler runs. At the **200 MB** cap that is up to
200 MB of heap **per concurrent upload**, which is a memory-pressure / DoS risk under
load.

- **Baseline (this phase):** memory storage + `limits: { fileSize: maxUploadBytes }`
  on the interceptor so multer rejects oversize files **before** buffering the whole
  body. `UploadService` streams `file.buffer` into the GCS object write stream
  (`bucket.file(name).createWriteStream(...)`), so the GCS leg itself does not double
  the memory.
- **Recommended hardening (owner decision, Open Questions):** switch multer to
  **disk storage** (or a streaming/busboy pipe straight to GCS) so large videos never
  fully occupy heap. Given videos up to 200 MB are in scope, disk/stream storage is
  the safer production posture — flagged for the owner.

The interceptor's `limits.fileSize` is the **first line** of the size check;
`UploadService.validateSize` is the defensive second line that returns the clean
`UPLOAD_003` error envelope.

---

## Authentication & Limits (locked)

### Auth

The service is exposed on **two identity planes** over the **same `UploadService`**
and the **same shared `files` bucket index**:

| Plane | Route base | Guard(s) | Who | `files.uploaderType` |
|-------|-----------|----------|-----|----------------------|
| **User** | `/api/v1/upload` | `JwtAuthGuard` (`scope: "user"`) | any authenticated user | `"user"` |
| **Admin** | `/api/v1/admin/upload` | `AdminJwtGuard` (`scope: "admin"`) + `MustChangePasswordGuard` | **any authenticated admin — no special permission** | `"admin"` |

- **User plane** — `JwtAuthGuard` (`backend/src/auth/strategies/jwt.strategy.ts`).
  Any authenticated user may upload, delete, and list.
- **Admin plane** — `AdminJwtGuard` (`scope: "admin"`) plus `MustChangePasswordGuard`
  (an admin who still has `mustChangePassword = true` is blocked until they rotate
  their seeded password). **No RBAC permission is required** — this is not gated by an
  `AdminPermission` grant string; any active admin who has changed their password may
  upload/delete/list.
- **Shared media library.** There is **no per-role or per-user ownership scoping** on
  delete/list on either plane — both planes list the **whole** bucket index and either
  may delete any file. `uploaderType` + `uploaderId` are recorded for attribution/audit
  only, **not** enforced as an owner gate on `DELETE`/`GET` this phase (flagged in Open
  Questions).
- Missing/invalid/wrong-scope token → **401** on the respective plane (standard guard
  behaviour). A `scope: "user"` token is rejected by `AdminJwtGuard` and vice-versa —
  the planes cannot be crossed by replaying a token (see `data_structure.md` §5.1).

### Allowlist + size cap (env-tunable)

Uploads are validated against a **MIME allowlist** and a **max size**, both tunable
via env (`GCP_ALLOWED_MIME_TYPES`, `GCP_MAX_UPLOAD_BYTES`). Anything outside the
allowlist is rejected with `UPLOAD_002`; anything over the cap with `UPLOAD_003`.

**Max file size:** **200 MB** (`209715200` bytes) default.

**Default MIME allowlist:**

| Group | MIME types | Notes |
|-------|-----------|-------|
| Images | `image/jpeg`, `image/png`, `image/gif`, `image/webp`, `image/svg+xml` | `svg` is XML — note the stored-XSS caveat below |
| PDF | `application/pdf` | |
| Documents | `application/msword` (doc), `application/vnd.openxmlformats-officedocument.wordprocessingml.document` (docx), `application/vnd.ms-excel` (xls), `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` (xlsx), `application/vnd.ms-powerpoint` (ppt), `application/vnd.openxmlformats-officedocument.presentationml.presentation` (pptx), `text/csv` (csv), `text/plain` (txt) | |
| Videos | `video/mp4` (mp4), `video/webm` (webm), `video/quicktime` (mov/quicktime), `video/x-msvideo` (avi), `video/x-matroska` (mkv) | Large — drives the 200 MB cap and the streaming note |

- **Validation is MIME-based** on `file.mimetype` (multer's detected content type).
  ⚠️ multer trusts the client-declared type; magic-byte sniffing is a hardening
  option (Open Questions).
- **SVG caveat:** `image/svg+xml` can carry embedded `<script>` — because the bucket
  is public and served inline from `storage.googleapis.com`, a malicious SVG is a
  stored-XSS vector against anyone who opens the object URL directly. Consider
  dropping SVG from the allowlist or serving it with `Content-Disposition: attachment`
  (Open Questions).

---

## REST Endpoints

Two route trios over the same `UploadService`: a **user** plane under `/api/v1/upload`
(`JwtAuthGuard`) and an **admin** plane under `/api/v1/admin/upload` (`AdminJwtGuard` +
`MustChangePasswordGuard`). All responses use the standard success envelope
`{ success, message?, data }` ([`data_structure.md`](data_structure.md) §2.3), and both
planes share the same `FileMetadata` shape, allowlist, 200 MB cap, multer filter, and
`files` index — only the guard and the recorded `uploaderType` differ.

**User plane** (base `/api/v1`, `JwtAuthGuard`):

| Method | Path | Purpose | Body / Query |
|--------|------|---------|--------------|
| `POST` | `/upload` | Upload one file (multipart) | multipart form field **`file`** (via `FileInterceptor('file')`); optional `?folder=<prefix>` |
| `DELETE` | `/upload/:id` | Delete by the `files` record id (removes the GCS object **and** the DB row) | — |
| `GET` | `/upload` | Media library — list all files, paginated, newest first | `?page&limit` |

**Admin plane** (base `/api/v1/admin`, `AdminJwtGuard` + `MustChangePasswordGuard`):

| Method | Path | Purpose | Body / Query |
|--------|------|---------|--------------|
| `POST` | `/admin/upload` | Upload one file (multipart) — identical contract to the user route; records `uploaderType: "admin"` | multipart form field **`file`** (via `FileInterceptor('file')`); optional `?folder=<prefix>` |
| `DELETE` | `/admin/upload/:id` | Delete by the `files` record id (GCS object **and** DB row) | — |
| `GET` | `/admin/upload` | Media library — lists the **whole shared bucket index** (both planes), paginated, newest first | `?page&limit` |

### `POST /api/v1/upload`

**Request**
```http
POST /api/v1/upload
Authorization: Bearer <user access token>
Content-Type: multipart/form-data; boundary=…

--…
Content-Disposition: form-data; name="file"; filename="soil-report.pdf"
Content-Type: application/pdf

<binary>
--…--
```

**Response `201`**
```jsonc
{
  "success": true,
  "message": "File uploaded",
  "data": {
    "id": "665f1c2a9b3e4a0012ab34cd",
    "name": "9b1c7f2e-4d5a-4c6b-8e10-2f3a4b5c6d7e-soil-report.pdf",
    "originalName": "soil-report.pdf",
    "fileType": "application/pdf",
    "size": 184213,
    "url": "https://storage.googleapis.com/bennie-connect-media/9b1c7f2e-4d5a-4c6b-8e10-2f3a4b5c6d7e-soil-report.pdf",
    "bucket": "bennie-connect-media",
    "path": "9b1c7f2e-4d5a-4c6b-8e10-2f3a4b5c6d7e-soil-report.pdf",
    "uploaderType": "user",
    "uploaderId": "USR_1720001234_ab12cd",
    "createdAt": "2026-07-02T09:14:00.000Z"
  }
}
```

- With `?folder=kyc`, the object name is prefixed: `path = "kyc/<uuid>-soil-report.pdf"`
  and the URL embeds the folder segment.

### `DELETE /api/v1/upload/:id`

Deletes the `files` row identified by `:id` **and** the underlying GCS object.

**Response `200`**
```jsonc
{ "success": true, "message": "File deleted", "data": { "id": "665f1c2a9b3e4a0012ab34cd" } }
```

- Unknown `:id` → `UPLOAD_004` (404).
- If the DB row exists but the GCS object is already gone, the delete is treated as
  **idempotent** (the row is removed and success returned); a GCS error other than
  "not found" surfaces as `UPLOAD_005`.

### `GET /api/v1/upload`

Media-library listing, read from the **`files` collection** (the queryable index of
the bucket). Paginated, newest first.

**Response `200`**
```jsonc
{
  "success": true,
  "data": {
    "items": [ /* FileMetadata, newest first */ ],
    "total": 128,
    "page": 1,
    "limit": 20
  }
}
```

- **Pagination defaults:** `page = 1`, `limit = 20` (max `100`), sorted `createdAt: -1`.

### Admin plane — `POST/GET/DELETE /api/v1/admin/upload`

The admin routes are a **thin re-exposure** of the exact same handlers behind the
admin guards. `AdminUploadController` (or the shared controller with an admin route
group) reuses the injected `UploadService` — **no separate service, allowlist, cap,
multer filter, envelope, or `files` collection**. The only differences from the user
plane are:

1. **Guards** — `AdminJwtGuard` (`scope: "admin"`) **+ `MustChangePasswordGuard`**
   instead of `JwtAuthGuard`. Any authenticated admin who has changed their seeded
   password may call these; **no `AdminPermission` grant is required**.
2. **Attribution** — the persisted `files` row carries `uploaderType: "admin"` and
   `uploaderId` = the caller's `adminUsers.adminId` (from the admin JWT), rather than a
   user's `userId`.
3. **Shared media library** — `GET /api/v1/admin/upload` returns the **whole** bucket
   index (files uploaded by users **and** admins), identical pagination/order to the
   user route. The two planes see the same list.

**`POST /api/v1/admin/upload` — Request**
```http
POST /api/v1/admin/upload
Authorization: Bearer <admin access token>
Content-Type: multipart/form-data; boundary=…

--…
Content-Disposition: form-data; name="file"; filename="tier-banner.png"
Content-Type: image/png

<binary>
--…--
```

**Response `201`**
```jsonc
{
  "success": true,
  "message": "File uploaded",
  "data": {
    "id": "665f1c2a9b3e4a0012ab34ce",
    "name": "1c2d3e4f-5a6b-7c8d-9e0f-1a2b3c4d5e6f-tier-banner.png",
    "originalName": "tier-banner.png",
    "fileType": "image/png",
    "size": 40218,
    "url": "https://storage.googleapis.com/bennie-connect-media/1c2d3e4f-5a6b-7c8d-9e0f-1a2b3c4d5e6f-tier-banner.png",
    "bucket": "bennie-connect-media",
    "path": "1c2d3e4f-5a6b-7c8d-9e0f-1a2b3c4d5e6f-tier-banner.png",
    "uploaderType": "admin",
    "uploaderId": "ADM_1720001299_zz99yy",
    "createdAt": "2026-07-02T09:20:00.000Z"
  }
}
```

**`DELETE /api/v1/admin/upload/:id`** and **`GET /api/v1/admin/upload?page&limit`**
mirror their user-plane counterparts exactly (same responses, same `UPLOAD_004` on an
unknown id, same idempotent-delete behaviour, same pagination defaults `page=1`,
`limit=20`, max `100`, `createdAt: -1`).

- Missing/invalid/wrong-scope admin token → **401**; an admin with
  `mustChangePassword = true` is blocked by `MustChangePasswordGuard` (**403**, per the
  admin auth spec — see [`PRD/admin_module/auth/admin_auth.md`](admin_module/auth/admin_auth.md)).

### Error codes

Domain error codes are returned in the standard error envelope
`{ success: false, error: { code, message } }` with the mapped HTTP status.

| Code | HTTP | When | Message (example) |
|------|------|------|--------------------|
| `UPLOAD_001` | `503 Service Unavailable` | GCP not configured (`GcsService.configured === false`) — creds absent | `File storage is not configured.` |
| `UPLOAD_002` | `422 Unprocessable Entity` | File MIME type not in the allowlist | `File type "<mime>" is not allowed.` |
| `UPLOAD_003` | `413 Payload Too Large` | File exceeds `maxUploadBytes` (200 MB) | `File exceeds the 200 MB limit.` |
| `UPLOAD_004` | `404 Not Found` | `:id` has no matching `files` record | `File not found.` |
| `UPLOAD_005` | `502 Bad Gateway` | GCS operation failed (upload/delete transport error) | `Storage operation failed.` |
| — | `401 Unauthorized` | Missing/invalid/wrong-scope JWT (user route: `JwtAuthGuard`; admin route: `AdminJwtGuard`) | *(guard default)* |
| — | `403 Forbidden` | Admin route only — caller's admin still has `mustChangePassword = true` (`MustChangePasswordGuard`) | *(admin auth spec)* |
| — | `400 Bad Request` | No `file` field present in the multipart body | `No file provided.` |

---

## Private bucket & signed URLs (owner-locked extension)

> **Status: 📄 to build.** Owner-locked design for sensitive documents (first consumer:
> merchant KYC — [`merchants.md`](admin_module/merchants/merchants.md)). This section
> extends — does not replace — the public-bucket flow above.

### Second bucket

`GcsService` bootstraps a **second, private bucket** alongside the public one:

- **Env:** `GCP_PRIVATE_BUCKET` → `configuration.gcp.privateBucket`.
- On init: ensure it exists (same `location`), enable **uniform bucket-level access**
  (UBLA), and apply **NO `allUsers` binding** — only the service account can read/write.
  Objects in it are **not** fetchable at `storage.googleapis.com/<bucket>/<path>`
  without a signature.
- Same graceful degradation: if the private bucket is unconfigured, private uploads
  return `UPLOAD_001`; public uploads are unaffected.

### `visibility` upload option

`UploadService.upload(file, uploader, opts)` gains `visibility: 'public' | 'private'`
(default `'public'`), accepted on both planes as a multipart form field or query param
(`?visibility=private`, combinable with `?folder=`):

- `'public'` → public bucket, world-readable `url` (unchanged behaviour).
- `'private'` → private bucket; the persisted/returned `url` is the canonical object
  URL (`https://storage.googleapis.com/<private-bucket>/<path>`) which is **not
  publicly readable** — clients MUST obtain a signed URL to view it.
- The `files` row (and `FileMetadata`) records `visibility`. Existing rows without the
  field are treated as `'public'`.

### Signed-URL endpoints (V4, **10-minute TTL** — owner-locked)

| Plane | Endpoint | Guard | Scoping |
|-------|----------|-------|---------|
| **Admin** | `GET /api/v1/admin/upload/:id/signed-url` | `AdminJwtGuard` + `MustChangePasswordGuard` | any active admin (consumers like the KYC reviewer additionally sit behind their section permission, e.g. `merchants:view`; each KYC-doc access is audit-logged by the merchants module) |
| **User** | `GET /api/v1/upload/:id/signed-url` | `JwtAuthGuard` | **owner-scoped** — only when `files.uploaderType === 'user'` **and** `files.uploaderId === req.user.userId`; otherwise `UPLOAD_004` (no cross-owner leakage) |

**Response 200:**
```jsonc
{
  "success": true,
  "data": {
    "id": "665f1c2a9b3e4a0012ab34cd",
    "signed": true,                       // false + the public url for a public file
    "url": "https://storage.googleapis.com/bennie-connect-private/kyc/9b1c…-nin-front.jpg?X-Goog-Algorithm=GOOG4-RSA-SHA256&…",
    "expiresAt": "2026-07-03T12:10:00.000Z"   // now + 600s (V4 signed, TTL 10 min)
  }
}
```

- Signing uses the GCS Node client's **V4 `getSignedUrl({ action: 'read', expires })`**
  with `expires = now + configuration.gcp.signedUrlTtlSeconds` (default **600 s**).
- Requesting a signed URL for a **public** file returns the plain public `url` with
  `signed: false` (no error) — one endpoint serves both.
- Signing failures surface as `UPLOAD_005`; unknown/purged `:id` → `UPLOAD_004`.
- Signed URLs are never persisted — they are minted per request and expire.

### KYC purge-on-decision integration (owner-locked)

The merchants module is the canonical purge consumer
([`merchants.md`](admin_module/merchants/merchants.md) §5.2): on the admin's **final
KYC decision (approve OR reject)** it calls `UploadService.remove(id)` for every
`kycDocs[]` file — deleting the **private GCS object and the `files` row**. The
verified ID data lives on in Mongo (`merchants.idType`/`idNumber`/`premblyResult`);
the binaries do not (NDPR/GDPR data-minimisation). Rejected merchants **re-upload** on
resubmission. `remove()` needs no visibility-specific logic — the row's `bucket`
field tells it which bucket to delete from.

---

## `FileMetadata` (upload response + `files` collection)

The shape returned by every endpoint and persisted (1:1) in the `files` collection
(full collection spec: [`data_structure.md`](data_structure.md) §10).

```jsonc
// FileMetadata
{
  "id": "string",           // the files record id (Mongo _id as string)
  "name": "string",         // stored object name — "{uuid}-{sanitized-original}" (+ optional "folder/")
  "originalName": "string", // the client's original filename (as uploaded)
  "fileType": "string",     // MIME type, e.g. "application/pdf"
  "size": "number",         // bytes
  "url": "string",          // public GCS URL "https://storage.googleapis.com/<bucket>/<path>"
  "bucket": "string",       // GCS bucket name
  "path": "string",         // object path within the bucket (== name, incl. any folder prefix)
  "uploaderType": "string", // "user" | "admin" — which identity plane uploaded; selects uploaderId's referent
  "uploaderId": "string",   // uploading principal's id: users.userId ("USR_…") when uploaderType="user", adminUsers.adminId when "admin"; attribution/audit
  "visibility": "string",   // "public" | "private" — which bucket holds the object; private ⇒ url needs a signed URL to view (default "public")
  "createdAt": "string"     // ISO 8601
}
```

**Object-name generation (`buildName`).** `{uuid}-{sanitized-original}`:
- `uuid` — a v4 UUID (or timestamp fallback) for collision-safety and to make URLs
  unguessable.
- `sanitized-original` — the original filename lowercased, spaces → `-`, stripped of
  path separators and any character outside `[a-z0-9._-]` (prevents path traversal and
  odd object keys).
- With `?folder=<prefix>` the `path` becomes `<sanitized-folder>/<uuid>-<sanitized-original>`.
- `path` is **unique** in the collection (see §10 index); the UUID prefix guarantees it.

**Generalized ownership (`uploaderType` + `uploaderId`).** The `files` row records
**which identity plane** uploaded and **who**:
- `uploaderType` is `"user"` for a user-plane upload (`POST /api/v1/upload`) and
  `"admin"` for an admin-plane upload (`POST /api/v1/admin/upload`). The controller
  sets it from the guard that authenticated the request.
- `uploaderId` is a **generic principal id**, not a hard Mongoose ref: it holds the
  user's `users.userId` (`USR_…`) when `uploaderType = "user"`, and the admin's
  `adminUsers.adminId` when `uploaderType = "admin"`. It is recorded for
  attribution/audit and is **not** enforced as an owner gate on delete/list this phase
  (the media library is shared bucket-wide across both planes).

---

## Frontend Services (client wrappers)

Two thin, framework-light **service wrappers** consume the two planes from the SPA.
They are **pure API wrappers — scaffolding, no UI yet** (consumed by feature screens
later); each just marshals a `File`/params into the right axios instance and unwraps
the `{ success, data }` envelope. They **share one type module** so the user and admin
planes cannot drift.

**Status:** ✅ **`src/types/upload.ts`** and ✅ **`src/services/upload.service.ts`**
exist on disk (scaffolded); 📄 **`src/services/adminUpload.service.ts`** is to be built
against `adminApi` (the user service's doc-comment explicitly points the admin agent at
the shared types and this shape as the reference).

### Shared types — `src/types/upload.ts` (✅)

Framework-free (no axios, no store) so **both** services can import it. Mirrors the
backend `FileMetadata` (§`FileMetadata`) and the media-library envelope:

| Type | Shape |
|------|-------|
| `FileMetadata` | `{ id, name, originalName, fileType, size, url, bucket, path, uploaderId, uploaderType?, createdAt }` — 1:1 with the backend `files` row. `uploaderType?: string` (`"user"`/`"admin"`) is present so a shared list can show which plane uploaded each object. |
| `MediaLibraryPage` | `{ items: FileMetadata[], total, page, limit }` — one page of `GET …/upload`, newest first. |
| `ListMediaParams` | `{ page?, limit? }` — media-library query. |
| `UploadProgress` | `{ loaded, total?, percent }` — reported to `onProgress`; `percent` is an int 0–100, `0` when `total` is not computable. |

### `src/services/upload.service.ts` — USER plane (✅)

Imports the **user** axios instance (`src/lib/api.ts`), so every call carries the user
access token (`Authorization: Bearer <localStorage.userToken>`, `scope: "user"`) and
hits `/upload*` → `/api/v1/upload*`. `BASE = "/upload"`.

| Method | Calls | Notes |
|--------|-------|-------|
| `upload(file, { folder?, onProgress?, signal? })` | `POST /upload` (multipart `FormData`, field `file`; `folder` appended as a form field when set) | Progress via axios **`onUploadProgress`** → `onProgress({ loaded, total, percent })`; cancellable via `signal` (`AbortSignal`). Returns the unwrapped `FileMetadata`. |
| `mediaLibrary({ page?, limit? })` | `GET /upload?page&limit` | Returns `MediaLibraryPage`; tolerant of both the paginated envelope and a bare array. |
| `remove(id)` | `DELETE /upload/:id` | Resolves `void`. |

Also exports `extractUploadError(err, fallback)` — pulls the `UPLOAD_*` message out of
the `{ success:false, error:{ code, message } }` body for UI display. Errors otherwise
bubble as axios errors.

### `src/services/adminUpload.service.ts` — ADMIN plane (📄 to build)

Same three methods and the **same shared types**, but imports the **admin** axios
instance (`src/lib/adminApi.ts`) whose `baseURL` is `<VITE_API_URL>/admin` and which
attaches the admin access token (`Authorization: Bearer <localStorage.adminToken>`,
`scope: "admin"`) plus `withCredentials: true` (for the httpOnly `bennie_admin_rt`
refresh cookie). Because the base already includes `/admin`, the wrapper uses the same
relative `BASE = "/upload"`, which resolves to `/api/v1/admin/upload*`.

| Method | Resolves to | Notes |
|--------|-------------|-------|
| `upload(file, { folder?, onProgress?, signal? })` | `POST /api/v1/admin/upload` | Identical multipart/progress/cancel semantics to the user service (axios `onUploadProgress`). Row is stamped `uploaderType: "admin"` server-side. |
| `mediaLibrary({ page?, limit? })` | `GET /api/v1/admin/upload?page&limit` | Returns the **shared** bucket index (both planes). |
| `remove(id)` | `DELETE /api/v1/admin/upload/:id` | — |

> **Both are pure service wrappers — no UI.** Upload **progress** is wired via axios
> `onUploadProgress` in both; neither renders anything. The admin service is a
> `adminApi`-based mirror of the user service and reuses `src/types/upload.ts`
> verbatim (per the note in `upload.service.ts`). This section is docs-only — the
> frontend code is owned by the `user-dev` (user) and `admin-dev` (admin) agents.

---

## Configuration

### Config group to add (`configuration.ts`)

Add a **`gcp`** group to `registerAs('configuration', …)` (it does not exist today),
following the existing groups' shape:

```typescript
gcp: {
  projectId:   process.env.GCP_PROJECT_ID || '',
  clientEmail: process.env.GCP_CLIENT_EMAIL || '',
  // Un-escape literal "\n" so the PEM parses correctly (same as FIREBASE_PRIVATE_KEY).
  privateKey: (process.env.GCP_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  bucket:      process.env.GCP_STORAGE_BUCKET || '',
  privateBucket: process.env.GCP_PRIVATE_BUCKET || '',   // private documents bucket (no allUsers binding)
  signedUrlTtlSeconds: parseInt(process.env.GCP_SIGNED_URL_TTL_SECONDS || '600', 10), // V4 signed-URL TTL (10 min)
  location:    process.env.GCP_STORAGE_LOCATION || 'US',
  maxUploadBytes: parseInt(process.env.GCP_MAX_UPLOAD_BYTES || '209715200', 10), // 200 MB
  allowedMimeTypes: (process.env.GCP_ALLOWED_MIME_TYPES || '')
    .split(',').map((s) => s.trim()).filter(Boolean),
  // when GCP_ALLOWED_MIME_TYPES is empty, the service falls back to the built-in
  // default allowlist documented above.
},
```

### Environment variables

Values are **supplied by the owner** — the table documents names, defaults, and
handling.

| Env var | Required | Maps to | Notes |
|---------|----------|---------|-------|
| `GCP_PROJECT_ID` | Yes (to upload) | `configuration.gcp.projectId` | GCP project ID. |
| `GCP_CLIENT_EMAIL` | Yes (to upload) | `configuration.gcp.clientEmail` | Service-account email. |
| `GCP_PRIVATE_KEY` | Yes (to upload) | `configuration.gcp.privateKey` | Service-account PEM key; **`\n` must be un-escaped** at load (like `FIREBASE_PRIVATE_KEY`). Placeholder — owner supplies. |
| `GCP_STORAGE_BUCKET` | Yes (to upload) | `configuration.gcp.bucket` | **Public** media bucket name (globally unique). Created on init if missing. |
| `GCP_PRIVATE_BUCKET` | Yes (for `visibility: 'private'` uploads) | `configuration.gcp.privateBucket` | **Private** documents bucket (UBLA, **no** `allUsers` binding). Created on init if missing. First consumer: merchant KYC docs. |
| `GCP_SIGNED_URL_TTL_SECONDS` | No | `configuration.gcp.signedUrlTtlSeconds` | V4 signed-URL lifetime. Default `600` (10 minutes — owner-locked). |
| `GCP_STORAGE_LOCATION` | No | `configuration.gcp.location` | Bucket location for creation, e.g. `US`, `EU`, `europe-west2`. Default `US`. |
| `GCP_MAX_UPLOAD_BYTES` | No | `configuration.gcp.maxUploadBytes` | Max file size in bytes. Default `209715200` (200 MB). |
| `GCP_ALLOWED_MIME_TYPES` | No | `configuration.gcp.allowedMimeTypes` | Comma-separated MIME allowlist override. Empty ⇒ built-in default allowlist. |

The service-account needs `roles/storage.admin` (to create the bucket + set the
public IAM binding on first boot) or, if the bucket is pre-provisioned public,
`roles/storage.objectAdmin` (object read/write/delete only).

### Graceful degradation (no-op without credentials)

`GcsService` checks for `projectId` **and** `clientEmail` **and** `privateKey` before
initializing the client. If any is missing it **logs a warning and sets
`configured = false`** — it never throws on init. Therefore:

- The API **boots and runs** with no GCP config.
- `UploadService.upload`/`delete`/`list` behave as below when unconfigured.
- A missing-config init is observable in logs:
  `GCP Storage not configured — file uploads disabled`.

| Condition | Behaviour |
|-----------|-----------|
| GCP creds absent (`configured = false`) | API boots; `GcsService` logs a warning. On **both planes** `POST …/upload` and `DELETE …/upload/:id` return `UPLOAD_001` (503); `GET …/upload` still lists the `files` collection (DB-only, works). |
| Bucket bootstrap fails (create/IAM) on init | Logged, non-fatal; client stays usable if it initialized. Residual failures surface per-request as `UPLOAD_005`. |
| GCS transport error mid-upload/delete | `UPLOAD_005` (502); no partial `files` row is left (persist happens only after a successful GCS write). |
| File over the cap | Rejected by multer `limits.fileSize` and/or `validateSize` → `UPLOAD_003` (413). |
| Disallowed MIME type | `UPLOAD_002` (422); nothing written to GCS or the DB. |
| Delete of already-gone GCS object | Idempotent — DB row removed, success returned. |

> ⚠️ **Security notes for the owner.**
> - **Public bucket = anyone with the URL can read.** The `allUsers:objectViewer`
>   grant makes every object world-readable. Do not route sensitive documents (KYC
>   IDs, BVN evidence) here unless the exposure is acceptable; prefer signed URLs +
>   a private bucket for those (Open Questions).
> - **Keys in `.env` must be git-ignored and rotated.** `GCP_PRIVATE_KEY` is a
>   high-value secret (like `FIREBASE_PRIVATE_KEY` and the OneSignal keys flagged in
>   [`oneSignal.md`](oneSignal.md)) — keep it out of version control, move it to a
>   secrets manager before production, and rotate on exposure.
> - **SVG + public inline serving** is a stored-XSS vector (see the allowlist note).

---

## Dependencies

| Package | Purpose |
|---------|---------|
| `@google-cloud/storage` | GCS client — bucket bootstrap, object upload/delete, IAM. |
| `@types/multer` | Type definitions for the multipart `file` object handled by `FileInterceptor`. |

(`@nestjs/platform-express`'s `FileInterceptor`/multer are already available in the
NestJS stack; `uuid` — or the built-in `crypto.randomUUID()` — supplies the
object-name prefix.)

---

## Setup Guide

1. **Create a service account** in the GCP project with `roles/storage.admin` (so it
   can create the bucket and set the public IAM binding on first boot).
2. **Download the JSON key**, then extract `project_id`, `client_email`, and
   `private_key` into the three env vars (keep the JSON out of the repo).
3. **Add to `backend/.env`:**
   ```dotenv
   GCP_PROJECT_ID=<your-project-id>
   GCP_CLIENT_EMAIL=<sa-name>@<project>.iam.gserviceaccount.com
   GCP_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   GCP_STORAGE_BUCKET=bennie-connect-media
   GCP_STORAGE_LOCATION=US            # or europe-west2, EU, …
   GCP_MAX_UPLOAD_BYTES=209715200     # 200 MB (default; optional)
   # GCP_ALLOWED_MIME_TYPES=          # optional override; empty ⇒ built-in allowlist
   ```
   Note the `GCP_PRIVATE_KEY` is a single line with literal `\n`; the config loader
   un-escapes them.
4. **Restart** the API. On boot `GcsService` creates the bucket (if missing) in the
   configured location and makes it public (UBLA + `allUsers:objectViewer`). With
   creds missing, the app still runs and logs the disabled-uploads warning.
5. **Verify** with `POST /api/v1/upload` (multipart `file`) using a valid user token;
   the returned `url` should be publicly fetchable.

Reference: GCS Node.js client — <https://cloud.google.com/nodejs/docs/reference/storage/latest>;
making data public — <https://cloud.google.com/storage/docs/access-control/making-data-public>.

---

## Status Summary

| Capability | Status |
|------------|--------|
| `StorageModule` + `GcsService` + `UploadService` | 📄 To build |
| `files` collection (queryable index of the bucket) | 📄 To build |
| Bucket bootstrap on init (create + UBLA + `allUsers:objectViewer`) | 📄 To build |
| Graceful no-op when GCP creds absent | 📄 To build |
| User plane `POST/DELETE/GET /upload` (multipart, allowlist + 200 MB cap) | 📄 To build |
| Admin plane `POST/DELETE/GET /admin/upload` (`AdminJwtGuard` + `MustChangePasswordGuard`, same `UploadService`) | 📄 To build |
| `files.uploaderType` (`'user'`/`'admin'`) + generic `uploaderId` | 📄 To build |
| `gcp` config group + env vars | 📄 To add to `configuration.ts` |
| Shared upload types `src/types/upload.ts` | ✅ Scaffolded |
| User service `src/services/upload.service.ts` (`api.ts`) | ✅ Scaffolded (no UI yet) |
| Admin service `src/services/adminUpload.service.ts` (`adminApi.ts`) | 📄 To build (no UI yet) |
| Private documents bucket (`GCP_PRIVATE_BUCKET`, UBLA, no `allUsers`) | 📄 To build (**owner-locked**) |
| `visibility: 'public'|'private'` upload option + `files.visibility` | 📄 To build (**owner-locked**) |
| Signed-URL endpoints (V4, 10-min TTL) — admin plane + owner-scoped user plane | 📄 To build (**owner-locked**) |
| KYC purge-on-decision (merchants module → `UploadService.remove`) | 📄 To build (**owner-locked**) |
| Virus scanning | 📄 Owner decision (Open Questions) |
| Lifecycle / retention rules | 📄 Owner decision (Open Questions) |

---

## Open Questions for the Owner

1. **Signed URLs vs. public bucket — RESOLVED (owner-locked): split.** Option (c) —
   a **public media bucket** (`GCP_STORAGE_BUCKET`, `allUsers:objectViewer`) **plus a
   private documents bucket** (`GCP_PRIVATE_BUCKET`, UBLA, no `allUsers` binding).
   Callers pick per-upload via `visibility: 'public'|'private'`; private objects are
   viewed only through **V4 signed URLs with a 10-minute TTL** (admin plane
   `GET /api/v1/admin/upload/:id/signed-url` + an owner-scoped user-plane equivalent).
   First private consumer: merchant KYC documents, which are **purged on the admin's
   final KYC decision**. See
   [Private bucket & signed URLs](#private-bucket--signed-urls-owner-locked-extension).
2. **Per-user folders / ownership.** This phase, the media library is **shared across
   both planes** — any authenticated user **or admin** can delete/list any file
   (`uploaderType`/`uploaderId` are recorded but not enforced). Should uploads be
   foldered per principal (`users/<userId>/…`, `admins/<adminId>/…`) and delete/list be
   **scoped to the owner/plane** (non-owners get `UPLOAD_004`), or stay a single shared
   admin-visible library?
3. **Virus / malware scanning.** No AV scan is performed. Add scanning (e.g. a GCS →
   Cloud Function ClamAV pipeline, or quarantine-then-scan) before objects are served
   publicly? Especially relevant for docs/videos on a public bucket.
4. **Lifecycle / retention.** No object lifecycle or DB retention is defined. Set a
   GCS **lifecycle rule** (e.g. auto-delete orphaned/temp objects after N days) and/or
   a `files` TTL/archival policy? Also define orphan reconciliation (bucket objects
   with no `files` row, or rows whose object was deleted out of band).
5. **SVG handling.** Keep `image/svg+xml` in the allowlist (stored-XSS risk on a
   public inline-served bucket), drop it, or serve uploads with
   `Content-Disposition: attachment` / a sanitizer?
6. **Streaming for large videos.** Ship with multer **disk/streaming** storage rather
   than in-memory buffering, given 200 MB videos are in scope (see the streaming
   note)?
7. **MIME trust.** Validation is on the client-declared MIME type; add **magic-byte
   sniffing** (e.g. `file-type`) to reject spoofed content types?
