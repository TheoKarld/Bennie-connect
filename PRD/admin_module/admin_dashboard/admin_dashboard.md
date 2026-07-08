# Admin Module — Dashboard (`/bennie/dashboard`)

> Part of the [Admin Module](../README.md). The `adminUsers` / `adminRoles` / `adminAuditLog` schemas, the permission taxonomy, the effective-permission formula, and the JWT scope model are defined in the master README and are authoritative here. The shell that frames this page is [admin_layout/admin_layout.md](../admin_layout/admin_layout.md).

## Overview

The **Admin Dashboard** is the landing page rendered at `/bennie/dashboard` immediately after an admin signs in (and after any forced password change clears). It is the operational overwatch summary: a permission-filtered grid of **KPI cards**, a **recent-activity feed** sourced from the audit trail, a **pending-approvals** summary, **quick links** into the sections the admin can enter, and **charts** where real data exists.

Design principle for this pass: **show REAL numbers where the data is live today, and honest placeholders everywhere else.** The user identity plane (`users`), the admin identity plane (`adminUsers` / `adminRoles` / `adminAuditLog`), **and the Adashe/Esusu contribution domain** (`ContributionGroup`, `GroupMember`, `payoutRequests`, `GroupProposal`) are the domains with live data; the remaining financial and marketplace domains are 📄 planned and MUST render as clearly-labeled **"module not yet live"** placeholder cards rather than fabricated figures.

> **Adashe is now LIVE (owner-confirmed).** The Adashe block flips from placeholder to `available: true`, surfacing **active groups**, **total pool balance** (tracked), **payout requests due** (count of `payoutRequests` in `REQUESTED`), and **pending slot-shift requests** (count of `GroupProposal(kind: SLOT_SHIFT)` in `AWAITING_ADMIN`). The manual-payout and slot-shift models are specified in [adas_hesu_contributions.md](../adas_hesu_contributions/adas_hesu_contributions.md); the two counts are real **approval queues** (see [Pending-approvals](#sections-page-layout)).

Status: 📄 **planned** (no admin frontend or `/dashboard` endpoint exists yet).

---

## Purpose & Access

- **First authenticated screen.** After `POST /auth/login` succeeds and `mustChangePassword` is cleared, the SPA routes to `/bennie/dashboard`. It is the default child of the admin shell (see [admin_layout](../admin_layout/admin_layout.md#route-placement)).
- **Access gating.** Reachable only behind the admin `AdminProtectedRoute` (valid admin-scoped session). The dashboard **data endpoint** is guarded by `dashboard:view`; the seeded starter roles (Operations Manager, Finance Officer, Support Agent, Content Manager) all include `dashboard:view`, so the landing page is broadly available. The **Dashboard nav item / page** may be treated as always-visible for any authenticated admin (rendering a minimal card set) even if `dashboard:view` is absent — confirm with owner (see Open Questions); the default assumption here is **`dashboard:view` required** for the aggregated payload.
- **Permission-filtered content.** Individual KPI cards, quick links, and the pending-approvals summary render only for the permissions the admin holds — a Support Agent sees user-oriented cards; finance cards appear only with the relevant `view` permissions.

---

## KPIs — live-where-possible

Cards are grouped by data-readiness. **Live** cards pull real aggregates from collections that exist (or are the immediate next to exist); **placeholder** cards render a tasteful "module not yet live" card with a muted icon, the metric name, and a small badge — never a fake number.

### Live-capable KPIs (real data)

**Users (`users` collection — ✅ exists on disk):** requires `users:view` to render the card.

| KPI | Definition |
|-----|------------|
| Total users | `count(users where isDeleted != true)` |
| Active users | `count(users where isActive == true && isSuspended != true && isBanned != true)` — optionally "active in last 30d" via `lastLoginAt` (label the definition used) |
| New signups (7d / 30d) | `count(users where createdAt >= now-7d)` and `>= now-30d` |
| Verified vs unverified | `count(isEmailVerified == true)` vs `false`; and, once KYC ships, `kyc.status` breakdown (Pending/Verified/Rejected) |
| Suspended / banned | `count(isSuspended)` / `count(isBanned)` — surfaces as a small risk stat |

**Admin plane (`adminUsers` / `adminRoles` / `adminAuditLog` — 📄, but the domain nearest to live and owned by this module):** requires `admins:view` / `roles:view` / `audit-logs:view` respectively.

| KPI | Definition |
|-----|------------|
| Total admins | `count(adminUsers where isActive == true)` |
| Admins by role | grouped count over `adminRoles` (e.g. 1 Super Admin, 2 Finance, …) |
| Recent admin activity (24h) | `count(adminAuditLog where createdAt >= now-24h)` |
| Locked-out / must-change-password | operational hygiene counts from `adminUsers` |

**Adashe / Esusu (`ContributionGroup` / `GroupMember` / `payoutRequests` / `GroupProposal` — ✅ live):** requires `adashe-groups:view` (group/rotation KPIs) and `adashe-contributions:view` (pool/payout KPIs) to render the respective cards.

| KPI | Definition | Permission |
|-----|------------|-----------|
| Active groups | `count(ContributionGroup where status == 'ACTIVE')` | `adashe-groups:view` |
| Total pool balance | Σ tracked pool across active groups (informational; funds are wired off-platform, not held) | `adashe-contributions:view` |
| Payout requests due | `count(payoutRequests where status == 'REQUESTED')` — the manual-payout queue awaiting **mark-sent** | `adashe-contributions:view` |
| Pending slot-shift requests | `count(GroupProposal where kind == 'SLOT_SHIFT' && status == 'AWAITING_ADMIN')` — fully-voted swaps awaiting admin decision | `adashe-groups:view` |
| Payouts awaiting confirmation | `count(payoutRequests where status == 'MARKED_SENT')` — marked sent, recipient not yet confirmed (risk/hygiene) | `adashe-contributions:view` |

### Placeholder KPIs (module not yet live — 📄)

Render as labeled placeholder cards, **no fabricated numbers**. Each shows the metric name, a muted icon, and a **"Module not yet live"** badge; hovering/tooltip explains it will populate when the domain ships.

| Domain | Placeholder cards |
|--------|-------------------|
| Wallet & transactions (PRD 02) | Total wallet balance, deposits/withdrawals (7/30d), pending withdrawals |
| Savings (PRD 04) | Total savings AUM, active plans, interest accrued |
| Shares & dividends (PRD 05) | Shares outstanding, share price, dividends distributed |
| Equipment (PRD 06) | Bookings today, utilization, active GPS units |
| Services (PRD 07) | Bookings, escrow held, disputes open |
| Marketplace (PRD 08) | Orders (7/30d), GMV, refunds pending, products awaiting moderation |
| Agents (PRD 10) | Active agents, referrals (30d), commission pending |

> **Adashe (PRD 09) moved to [Live-capable KPIs](#live-capable-kpis-real-data).** It is no longer a placeholder — its cards (active groups, tracked pool, payout requests due, pending slot-shift requests) render real values via `available: true`.

> As each domain's collections come online, its placeholder cards become live cards driven by the same `/dashboard/overview` aggregation — no layout change required, only the backend `available: true` flag flips.

---

## Sections (page layout)

1. **KPI card grid.** Responsive grid (1-col mobile → 2 → 3/4 desktop). Each card: label, value (or placeholder), a small delta/trend chip where a comparison window exists (e.g. signups vs prior 7d), and an icon. Cards are permission-filtered and readiness-grouped (live first, placeholders after, or interleaved with a subtle "coming soon" treatment).
2. **Recent-activity feed.** A reverse-chronological list from `adminAuditLog` (latest ~10–20): actor (name/email), human action label (e.g. "banned user Amina Bello", "changed withdrawal fee"), target, relative timestamp, and source IP on hover. Gated by `audit-logs:view`; when absent, the feed shows a "you don't have access to the activity feed" empty-state instead of the list. Links each entry into the relevant section where a target route exists.
3. **Pending-approvals summary.** A compact panel counting items awaiting admin sign-off across queues — KYC submissions, withdrawals/settlements, membership applications, product moderation, dividend/commission payouts, disputes, **Adashe payout requests**, **Adashe slot-shift decisions**. The **two Adashe queues are LIVE now**: **Payout requests due** (`payoutRequests` in `REQUESTED`, deep-links to a group's Payout Requests tab, gated by `adashe-contributions:view`; the **mark-sent** action itself is Super-Admin-only) and **Slot-shift decisions** (`GroupProposal(kind: SLOT_SHIFT)` in `AWAITING_ADMIN`, deep-links to a group's Slot-Shift Decisions tab, gated by `adashe-groups:view`). The remaining queues render as placeholder ("Approval queues activate as modules go live") until their modules exist; KYC lights up next once `users.kyc` ships. Each row deep-links to its queue and respects the relevant permission.
4. **Quick links.** Permission-filtered shortcut tiles to sections the admin can enter (Users, Admins & Roles, Cooperative, Settings, …) — mirrors the sidebar gating but as large actionable tiles for the most common first actions.
5. **Charts (real data only).** A **signups trend** line/area chart (new `users` per day over 30d, from `createdAt` buckets) — the one chart with genuine live data at this stage. Optionally an **admin-activity sparkline** from `adminAuditLog` counts. Placeholder domains show a muted "chart activates when the module is live" tile rather than an empty axis. All charts have accessible table fallbacks.

---

## Backend

The dashboard is driven by a single aggregation endpoint (📄 **to be implemented by `backend-dev`**):

### GET /api/v1/admin/dashboard/overview 📄
**Required permission:** `dashboard:view`
**Description:** Server-side aggregation returning the live counts the dashboard can render today, plus explicit readiness flags for not-yet-live domains so the frontend renders placeholders deterministically (no client-side guessing).
**Guards:** `AdminJwtGuard` + `PermissionsGuard('dashboard:view')`; subject to the `mustChangePassword` gate (blocked with `403 ADMIN_AUTH_007` until cleared).
**Query (optional):** `range` (`7d` | `30d`, default `30d`) for windowed counts.
**Response:** 200 OK
```json
{
  "success": true,
  "data": {
    "users": {
      "available": true,
      "total": 1284,
      "active": 1102,
      "suspended": 14,
      "banned": 3,
      "emailVerified": 998,
      "emailUnverified": 286,
      "newLast7d": 41,
      "newLast30d": 173,
      "signupTrend": [ { "date": "2026-06-02", "count": 6 } ]
    },
    "admins": {
      "available": true,
      "totalActive": 5,
      "byRole": [ { "role": "Super Admin", "count": 1 }, { "role": "Finance Officer", "count": 2 } ],
      "recentActivity24h": 37,
      "mustChangePassword": 1,
      "lockedOut": 0
    },
    "adashe": {
      "available": true,
      "activeGroups": 23,
      "totalPoolBalance": 4185000,
      "payoutRequestsDue": 4,
      "payoutsAwaitingConfirmation": 2,
      "pendingSlotShiftRequests": 3
    },
    "recentActivity": [
      {
        "actorEmail": "superadmin@bennieconnect.com",
        "action": "user.ban",
        "resource": "users",
        "targetId": "USR_1730000000000_XYZ",
        "createdAt": "2026-07-01T09:14:22Z"
      }
    ],
    "pendingApprovals": {
      "kyc": { "available": false, "count": 0 },
      "withdrawals": { "available": false, "count": 0 },
      "membershipApplications": { "available": false, "count": 0 },
      "productModeration": { "available": false, "count": 0 },
      "adashePayoutRequests": { "available": true, "count": 4, "link": "/bennie/adashesu-contributions?hasPendingPayout=true" },
      "adasheSlotShiftDecisions": { "available": true, "count": 3, "link": "/bennie/adashesu-contributions?hasPendingSlotShift=true" }
    },
    "modules": {
      "wallet": { "available": false }, "savings": { "available": false },
      "shares": { "available": false }, "equipment": { "available": false },
      "services": { "available": false }, "marketplace": { "available": false },
      "adashe": { "available": true }, "agents": { "available": false }
    }
  }
}
```
**Behaviour notes:**
- Every domain block carries an **`available` boolean**. `true` ⇒ render real values; `false` ⇒ render the "module not yet live" placeholder. This keeps the frontend honest and decouples it from which collections happen to exist.
- **Adashe block (`adashe`) is `available: true`** and aggregates the live contribution domain: `activeGroups` (`ContributionGroup.status == 'ACTIVE'`), `totalPoolBalance` (tracked Σ), `payoutRequestsDue` (`payoutRequests` `REQUESTED`), `payoutsAwaitingConfirmation` (`MARKED_SENT`), `pendingSlotShiftRequests` (`GroupProposal(kind: SLOT_SHIFT)` `AWAITING_ADMIN`). The `pendingApprovals.adashePayoutRequests` / `adasheSlotShiftDecisions` counts are the same figures surfaced as approval queues.
- The endpoint **omits** (or returns `available:false` for) blocks the caller's permissions don't allow, so a Support Agent's payload never leaks finance aggregates. Adashe pool/payout figures require `adashe-contributions:view`; group/slot-shift figures require `adashe-groups:view` — the block trims to whichever the caller holds.
- Counts respect soft-delete (`users.isDeleted != true`) and exclude system/seed noise where appropriate.
- **Caching:** aggregates may be cached briefly (e.g. 30–60s) to protect the DB; `recentActivity` should be fresh (or short TTL). Cache key includes the caller's effective-permission scope.
**Audit:** reads only — a low-noise `dashboard.view` audit entry is **optional** (the master README treats reads as generally un-audited except PII/financial exports). Do **not** audit every dashboard poll.
**Errors:** `403 ADMIN_AUTH_006` (missing `dashboard:view`), `403 ADMIN_AUTH_007` (`mustChangePassword`), standard envelope.

> **Flagged 📄 for `backend-dev`.** This endpoint does not exist yet. It aggregates over the live `users` collection, the admin-plane collections, **and the live Adashe collections** (`ContributionGroup`, `payoutRequests`, `GroupProposal`); as further domains ship, extend the aggregation and flip each `available` flag to `true`. The frontend requires no change when a flag flips.

---

## Design & Accessibility

**Premium, responsive, motion-rich — not a basic UI.** Consistent with the shell's brand tokens.

- **Brand:** primary `#135D39`, accent `#E7A13C`; **Space Grotesk** headings, **Inter** body, **JetBrains Mono** for numeric KPI values and ids. Cards use soft elevation, clear hierarchy, and accent sparingly (accent reserved for the primary KPI / positive delta).
- **Motion (`motion`):** KPI values count-up on first load; cards stagger-in; chart draws on mount; respects `prefers-reduced-motion`.
- **Responsive:** KPI grid reflows 1→2→3/4 columns across mobile/tablet/desktop; activity feed and charts stack under the grid on mobile.
- **States (all required):**
  - **Loading / skeleton:** every card, the feed, and charts show shimmer skeletons matching their final shape while `/dashboard/overview` resolves.
  - **Empty:** a domain with zero real data (e.g. no signups yet) shows a friendly zero-state, distinct from the **placeholder** ("module not yet live") state — the two must be visually distinguishable.
  - **Placeholder:** muted card + "Module not yet live" badge; no numbers.
  - **Error:** a retriable error card if the overview call fails (no blank dashboard).
  - **Permission-limited:** cards/feed the admin can't see are simply absent (not greyed), except placeholder-domain cards which are informational.
- **Accessibility:** cards are landmarked/labeled; KPI values have accessible text; charts ship an accessible data-table fallback; the activity feed is a semantic list; full keyboard nav and visible focus; contrast ≥ WCAG AA.

---

## Implementation Checklist

**Backend (`backend-dev`)**
- [ ] 📄 `GET /api/v1/admin/dashboard/overview` guarded by `dashboard:view` + `mustChangePassword` gate.
- [ ] 📄 Live aggregations over `users` (totals, active, verified, signup buckets), admin-plane (`adminUsers`/`adminRoles`/`adminAuditLog`), **and Adashe** (`ContributionGroup` active count + tracked pool Σ, `payoutRequests` REQUESTED/MARKED_SENT counts, `GroupProposal` AWAITING_ADMIN count).
- [ ] 📄 `available` readiness flags per domain (Adashe → `true`); permission-scoped payload trimming (`adashe-groups:view` / `adashe-contributions:view`).
- [ ] 📄 Short-TTL caching keyed by permission scope; fresh `recentActivity`.

**Frontend (`admin-dev`)**
- [ ] 📄 KPI grid with live vs placeholder card variants driven by `available` flags.
- [ ] 📄 Recent-activity feed from `recentActivity` (gated by `audit-logs:view`).
- [ ] 📄 Pending-approvals summary — **Adashe payout requests + slot-shift decisions live now** (deep-link to the group tabs); remaining queues placeholder until their modules exist (KYC next).
- [ ] 📄 Permission-filtered quick links (reuse shell nav gating).
- [ ] 📄 Signups-trend chart from `users.signupTrend` with accessible fallback; placeholder chart tiles for not-yet-live domains.
- [ ] 📄 Loading/skeleton, empty, placeholder, error, and permission-limited states.
- [ ] 📄 Brand tokens, fonts, `motion` (count-up/stagger), reduced-motion, WCAG AA.

---

## Dependencies

- **[admin_layout/admin_layout.md](../admin_layout/admin_layout.md)** — the shell; the dashboard is its default child; reuses the permission-filtered nav gating for quick links.
- **[auth/admin_auth.md](../auth/admin_auth.md)** — `GET /auth/me` (`effectivePermissions`, `mustChangePassword`), `dashboard:view` semantics, `ADMIN_AUTH_006/007`.
- **[users/users.md](../users/users.md)** — source domain for the user KPIs and the KYC approval queue that lights up first.
- **[admins/admins.md](../admins/admins.md)** — `adminAuditLog` shape (feed) and admin-plane counts.
- **[adas_hesu_contributions/adas_hesu_contributions.md](../adas_hesu_contributions/adas_hesu_contributions.md)** — the live Adashe domain: `ContributionGroup`/`payoutRequests`/`GroupProposal` sourcing the Adashe KPIs and the two live approval queues; the cross-group queues `GET /admin/payout-requests` (`REQUESTED`) and `GET /admin/proposals` (`AWAITING_ADMIN`) the dashboard deep-links into.
- **[data_structure.md §2.1 `users`, §7.1–§7.3 admin plane, §5–§6 dual-session](../../data_structure.md#7-admin-module--identity-rbac-config)** — schema cross-reference and the `adminApi` client the dashboard calls.

---

## Open Questions for the Owner

1. **`dashboard:view` requirement vs. always-visible landing.** Should `/bennie/dashboard` always render a minimal card set for *any* authenticated admin (so nobody lands on a 403), or strictly require `dashboard:view` for the aggregated payload? Default assumption: require `dashboard:view` for `/dashboard/overview`, but let the page shell render with an empty/limited state if absent.
2. **"Active user" definition.** Confirm whether "active users" means *not suspended/banned* (status-based) or *logged in within 30 days* (`lastLoginAt`-based). The KPI card should state whichever definition is chosen.
3. **Read-auditing the dashboard.** Confirm the dashboard overview read is **not** audited (avoid audit-log noise from polling); PII/financial **exports** remain audited per the master README.
