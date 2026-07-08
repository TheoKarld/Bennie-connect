import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import type { Bucket, Storage } from '@google-cloud/storage';

export type ObjectVisibility = 'public' | 'private';

export interface UploadedObject {
  /** Stored object name (== path). */
  name: string;
  /** Full object path within the bucket. */
  path: string;
  /** Public URL (canonical object URL — not readable without a signature for private objects). */
  url: string;
  /** Bucket name. */
  bucket: string;
}

/**
 * Wraps @google-cloud/storage. Mirrors MailService/FcmService: when GCP
 * credentials are not configured, the client is never built, every method that
 * needs it reports "not configured", and the app boots fine (no throw during
 * bootstrap).
 *
 * Two buckets:
 *  - public bucket (`configuration.gcp.bucket`) — UBLA + allUsers:objectViewer;
 *  - private bucket (`configuration.gcp.privateBucket`) — UBLA, NO allUsers
 *    binding; objects readable only via V4 signed URLs.
 */
@Injectable()
export class GcsService implements OnModuleInit {
  private readonly logger = new Logger(GcsService.name);
  private storage?: Storage;
  private bucket?: Bucket;
  private privateBucket?: Bucket;
  private configured = false;
  private privateConfigured = false;

  constructor(private readonly configService: ConfigService) {}

  private cfg<T = string>(key: string): T {
    return this.configService.get<T>(`configuration.gcp.${key}`) as T;
  }

  get bucketName(): string {
    return this.cfg<string>('bucket') || '';
  }

  get privateBucketName(): string {
    return this.cfg<string>('privateBucket') || '';
  }

  get signedUrlTtlSeconds(): number {
    const ttl = this.cfg<number>('signedUrlTtlSeconds');
    return ttl && ttl > 0 ? ttl : 600;
  }

  isConfigured(): boolean {
    return this.configured;
  }

  isPrivateConfigured(): boolean {
    return this.privateConfigured;
  }

  async onModuleInit(): Promise<void> {
    const projectId = this.cfg('projectId');
    const clientEmail = this.cfg('clientEmail');
    // FIREBASE_PRIVATE_KEY-style \n un-escaping is done in configuration.ts.
    const privateKey = this.cfg('privateKey');
    const bucketName = this.cfg('bucket');
    const privateBucketName = this.privateBucketName;
    const location = this.cfg('location') || 'US';

    if (!projectId || !clientEmail || !privateKey || !bucketName) {
      this.configured = false;
      this.privateConfigured = false;
      this.logger.warn(
        'GCP Cloud Storage not configured — file uploads disabled (no-op).',
      );
      return;
    }

    try {
      // Lazy require so the dependency is only touched when configured.
      /* eslint-disable-next-line @typescript-eslint/no-var-requires */
      const { Storage: StorageCtor } = require('@google-cloud/storage');
      this.storage = new StorageCtor({
        projectId,
        credentials: { client_email: clientEmail, private_key: privateKey },
      }) as Storage;

      this.bucket = this.storage.bucket(bucketName);
      await this.ensureBucket(bucketName, location, 'public');
      await this.ensurePublic();

      this.configured = true;
      this.logger.log(
        `GCP Cloud Storage initialized — bucket "${bucketName}" ready (public).`,
      );
    } catch (error: any) {
      this.configured = false;
      this.logger.error(
        `Failed to initialize GCP Cloud Storage: ${error?.message}`,
      );
      return;
    }

    // Private bucket — optional; its absence never blocks the public plane.
    if (!privateBucketName) {
      this.privateConfigured = false;
      this.logger.warn(
        'GCP private bucket not configured (GCP_PRIVATE_BUCKET empty) — private uploads disabled.',
      );
      return;
    }

    try {
      this.privateBucket = this.storage!.bucket(privateBucketName);
      await this.ensureBucket(privateBucketName, location, 'private');
      await this.ensureUniformAccess(this.privateBucket);
      this.privateConfigured = true;
      this.logger.log(
        `GCP private bucket "${privateBucketName}" ready (UBLA, no public access).`,
      );
    } catch (error: any) {
      this.privateConfigured = false;
      this.logger.error(
        `Failed to initialize GCP private bucket: ${error?.message}`,
      );
    }
  }

  /** Create the bucket in `location` if it does not exist. */
  private async ensureBucket(
    bucketName: string,
    location: string,
    kind: ObjectVisibility,
  ): Promise<void> {
    if (!this.storage) {
      return;
    }
    const target = kind === 'private' ? this.privateBucket : this.bucket;
    if (!target) {
      return;
    }
    const [exists] = await target.exists();
    if (!exists) {
      this.logger.log(
        `Creating ${kind} bucket "${bucketName}" in ${location}...`,
      );
      await this.storage.createBucket(bucketName, { location });
      if (kind === 'private') {
        this.privateBucket = this.storage.bucket(bucketName);
      } else {
        this.bucket = this.storage.bucket(bucketName);
      }
    }
  }

  /** Enable uniform bucket-level access on a bucket (no IAM binding changes). */
  private async ensureUniformAccess(bucket: Bucket): Promise<void> {
    await bucket.setMetadata({
      iamConfiguration: {
        uniformBucketLevelAccess: { enabled: true },
      },
    });
  }

  /**
   * Make the public bucket serve public objects: enable uniform bucket-level
   * access and add an idempotent allUsers -> roles/storage.objectViewer IAM
   * binding. (The private bucket NEVER receives this binding.)
   */
  private async ensurePublic(): Promise<void> {
    if (!this.bucket) {
      return;
    }
    // Uniform bucket-level access (required before allUsers IAM binding).
    await this.ensureUniformAccess(this.bucket);

    const ROLE = 'roles/storage.objectViewer';
    const MEMBER = 'allUsers';
    const [policy] = await this.bucket.iam.getPolicy({
      requestedPolicyVersion: 3,
    });
    policy.bindings = policy.bindings || [];
    let binding = policy.bindings.find(
      (b: { role: string; members: string[] }) => b.role === ROLE,
    );
    if (!binding) {
      binding = { role: ROLE, members: [] };
      policy.bindings.push(binding);
    }
    if (!binding.members.includes(MEMBER)) {
      binding.members.push(MEMBER);
      await this.bucket.iam.setPolicy(policy);
    }
  }

  private sanitize(name: string): string {
    // Keep the base name readable but strip anything path/URL-hostile.
    return (name || 'file')
      .replace(/[^a-zA-Z0-9._-]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 200)
      .toLowerCase();
  }

  /** Resolve a Bucket handle by its stored name (public or private). */
  private bucketByName(bucketName?: string): Bucket | undefined {
    if (!bucketName || bucketName === this.bucketName) {
      return this.bucket;
    }
    if (bucketName === this.privateBucketName && this.privateBucket) {
      return this.privateBucket;
    }
    // Fall back to a direct handle (e.g. renamed config) — best-effort.
    return this.storage?.bucket(bucketName);
  }

  /** Upload a buffer and return its stored identity + canonical URL. */
  async uploadBuffer(
    file: Express.Multer.File,
    folder?: string,
    visibility: ObjectVisibility = 'public',
  ): Promise<UploadedObject> {
    if (!this.configured || !this.bucket) {
      throw new Error('GCP Cloud Storage not configured');
    }
    if (
      visibility === 'private' &&
      (!this.privateConfigured || !this.privateBucket)
    ) {
      throw new Error('GCP private bucket not configured');
    }
    const target = visibility === 'private' ? this.privateBucket! : this.bucket;
    const bucketName =
      visibility === 'private' ? this.privateBucketName : this.bucketName;
    const prefix = folder ? `${folder.replace(/^\/+|\/+$/g, '')}/` : '';
    const objectName = `${prefix}${Date.now()}-${randomBytes(8).toString(
      'hex',
    )}-${this.sanitize(file.originalname)}`;

    const blob = target.file(objectName);
    await blob.save(file.buffer, {
      contentType: file.mimetype,
      resumable: false,
      metadata: { contentType: file.mimetype },
    });

    // Canonical object URL. For private objects this is NOT publicly readable —
    // clients must fetch a V4 signed URL to view it.
    const url = `https://storage.googleapis.com/${bucketName}/${objectName}`;
    return { name: objectName, path: objectName, url, bucket: bucketName };
  }

  /** Delete an object by its path/name (bucket-aware). Swallows not-found. */
  async deleteObject(path: string, bucketName?: string): Promise<void> {
    if (!this.configured || !this.bucket) {
      throw new Error('GCP Cloud Storage not configured');
    }
    const target = this.bucketByName(bucketName);
    if (!target) {
      throw new Error('GCP Cloud Storage bucket unavailable');
    }
    await target.file(path).delete({ ignoreNotFound: true });
  }

  /**
   * Mint a V4 read signed URL for an object (used for private-bucket files).
   * TTL from `configuration.gcp.signedUrlTtlSeconds` (default 600 s).
   */
  async getSignedUrl(
    path: string,
    bucketName?: string,
  ): Promise<{ url: string; expiresAt: Date }> {
    if (!this.configured || !this.storage) {
      throw new Error('GCP Cloud Storage not configured');
    }
    const target = this.bucketByName(bucketName);
    if (!target) {
      throw new Error('GCP Cloud Storage bucket unavailable');
    }
    const expiresAt = new Date(Date.now() + this.signedUrlTtlSeconds * 1000);
    const [url] = await target.file(path).getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: expiresAt,
    });
    return { url, expiresAt };
  }

  /** Raw list of object names in the public bucket (admin/debug). */
  async listObjects(): Promise<string[]> {
    if (!this.configured || !this.bucket) {
      throw new Error('GCP Cloud Storage not configured');
    }
    const [files] = await this.bucket.getFiles();
    return files.map((f) => f.name);
  }
}
