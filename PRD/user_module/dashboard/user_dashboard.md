# PRD — User Dashboard (Home)

**Module:** Users / App home
**Route:** `/app` (index route of the authenticated shell)
**Gating:** `ProtectedRoute` (`src/routes/ProtectedRoute.tsx`)
**Status:** 📄 Documents the *as-built* implementation
(`src/pages/users/DashboardView.tsx` + `DashboardPage.tsx`).
**Owner:** user-prd-enricher (docs) · user-dev (code)

> **Scope reality.** Only the **Users / Auth** backend is live today; the
> **identity/greeting is the live part** (first name from `useAuth()`; tier is
> read from client state). The remaining **financial widgets** (wallet, savings,
> shares, bookings, notifications, rates) still run on **seeded per-user client
> `appStore` state**, not a real API — until those backend modules ship. The
> **Adashe widget (§4 / §4.1) is specified as the LIVE, server-backed target**
> (PRD 09, `/api/v1/contribution-groups/*`); the mock `state.contributionGroups`
> path is **superseded** and kept only as an offline fallback. See
> [§8 Future: live backend wiring](#8-future-live-backend-wiring).

---

## 1. Purpose & Audience

- **Purpose:** The member's landing screen after login — an at-a-glance summary of
  their money (wallet, cooperative savings, shares), active equipment bookings,
  their Adashe (thrift) circle, cooperative bulletins/notifications, and the
  current savings-rate index, with quick actions into every module.
- **Audience:** Authenticated members (any tier). Agents also land here; the
  agent surface lives at `/app/agent`.

---

## 2. Routing & Composition

- Registered in `src/App.tsx` as the **index** child of `/app`:
  `<Route path="/app" element={<AppShell />}><Route index element={<DashboardPage />} /> …`
  behind `<Route element={<ProtectedRoute />}>`.
- **`DashboardPage`** (container): pulls the whole store via `useAppState()`
  (the zustand `appStore`) and passes a `state` slice + callbacks down to the
  presentational **`DashboardView`**. It also exports the `tabToPath()` /
  `TAB_PATHS` map used to translate legacy `activeTab` keys into `/app/*` routes.
- **`DashboardView`** (presentational): renders the UI and calls the injected
  callbacks; it reads the user's first name directly via `useAuth()`.

**Callbacks wired in `DashboardPage`:**

| Prop | Source (`appStore`) |
|------|---------------------|
| `onNavigate(tab)` | `navigate(tabToPath(tab))` |
| `onJoinGroup` | `handleJoinContributionCircle` |
| `onCancelBooking` | `handleCancelBooking` |
| `onReadNotification` | `handleReadNotification` |
| `onClearNotifications` | `handleClearNotifications` |

> Note: `onJoinGroup` and `onCancelBooking` are passed but **not currently used**
> by `DashboardView` (join/cancel happen on their dedicated module screens). They
> are retained for forward compatibility.

`tabToPath` map: `dashboard→/app`, `wallet→/app/wallet`, `savings→/app/savings`,
`adashe→/app/adashe`, `equipment→/app/equipment`, `services→/app/services`,
`marketplace→/app/marketplace`, `shares→/app/shares`, `membership→/app/membership`,
`agentsystem→/app/agent`.

---

## 3. Data Sources & Derivations

Read from `FarmerAppState` in `appStore` (`src/types.ts`), except the greeting
name which comes from `useAuth()`.

| Widget | Field(s) | Derivation |
|--------|----------|-----------|
| Greeting first name | `useAuth().user.firstName` | falls back to `"Farmer"` |
| Tier badge | `state.membership.tier` | e.g. "GOLD Member" |
| Wallet balance | `state.walletBalance` | `formatNaira()` |
| Cooperative savings (total) | `flexSaveBalance` + Σ ongoing `targetGoals.currentAmount` + Σ locked `fixedLocks.amount` + Σ active `harvestPlans.amountSaved` | computed in `DashboardView` |
| Shares owned | `state.shares.sharesOwned` | `formatNumber()` + " Units" |
| Active bookings | `state.bookings[]` | list or empty state |
| Adashe circle(s) | LIVE: `/api/v1/contribution-groups/my-groups` (mock: `state.contributionGroups[]`) | see §4 |
| Pending slot-shift requests | LIVE: proposals awaiting my vote + slot-shifts awaiting admin | see §4.1 |
| Bulletins / notifications | `state.notifications[]` | unread = `filter(!isRead)` |
| Rates index | `COOP_RATES` (`src/lib/constants.ts`) | 3 rows |
| Booking discount copy | `MEMBER_BOOKING_DISCOUNT` | tier-scoped callout |

**Savings total formula (exact):**
```
totalSavings =
  flexSaveBalance
  + Σ targetGoals[status === "ongoing"].currentAmount
  + Σ fixedLocks[status === "locked"].amount
  + Σ harvestPlans[status === "active"].amountSaved
```

**Rates index (from `COOP_RATES`):** Flex Save (Normal) `8.5% APY`, Target Goal
Save `11.5% APY`, Seasonal Harvest Save `12.5% APY` (accented). Callout: the
member's tier gets `MEMBER_BOOKING_DISCOUNT` (10%) off equipment/milling bookings.

---

## 4. Adashe Circle Card (LIVE from the server)

> **As-built target.** The dashboard now shows **LIVE Adashe** sourced from the
> server-backed module (PRD 09,
> [`adashesu-contributions.md`](../adashesu-contributions/adashesu-contributions.md)),
> **not** the client `appStore`. The mock `state.contributionGroups` path
> (`ContributionGroup`, `src/types.ts` §1.6 of `data_structure.md`) is
> **superseded** and kept only as an offline/seed fallback until wiring completes.

Data source: `GET /api/v1/contribution-groups/my-groups` (the member's circles) via
`adashe.service.ts` / `adasheStore`. Each summary carries `name`, `type`, `status`,
`currentCycle/maxSlots`, `poolBalance`, `myPosition`, `myStatus`, `isMyTurn`, and
`pendingActionCount`.

- **Group selection:** prefer the circle where it is the member's turn (`isMyTurn`),
  else the most-recently-active `ACTIVE` circle, else the first, else `null`.
- **Progress:** `min(100, round(poolBalance / (contributionAmount * maxSlots) * 100))`;
  returns `0` when there is no group or the denominator is `<= 0` (guards
  divide-by-zero).
- **Card content (when a circle exists):** `name`; `type` + `status` chips; "Cycle
  {currentCycle} of {maxSlots}"; a "You are Slot #{myPosition}" chip; animated pool
  progress bar (`formatNaira(poolBalance)` met + `%`); footer "{contributionAmount} /
  {frequency} contribution". Contextual CTA:
  - if `isMyTurn` and no open payout request → **"Claim my payout"** → `/app/adashe/{id}`
    (Rotations tab);
  - if a payout request is `MARKED_SENT` for me → **"Confirm received"** → workspace;
  - else **"Open"** → `onNavigate("adashe")` / `/app/adashe/{id}`.
- **Empty state (no circles):** "Join an Adashe circle" prompt + **"Explore Adashe
  circles"** button → `onNavigate("adashe")` (`/app/adashe`). If the member has
  **pending invitations**, show an **"You have {n} invitation(s)"** chip linking to
  `/app/adashe` to accept/decline.

### 4.1 Pending slot-shift requests widget (LIVE)

A dedicated widget surfaces Adashe items **needing the member's attention**, derived
from the LIVE proposals across all the member's `ACTIVE` circles:

- **Proposals awaiting my vote** — `groupProposals` with `status: "ACTIVE"` where the
  caller has **not** yet cast a vote (both `GENERAL` and `SLOT_SHIFT`). Each row shows
  the circle name, proposal `title`/kind, running `tally`, and **"Vote"** →
  `/app/adashe/{groupId}` (Proposals & Voting tab).
- **Slot-shifts awaiting admin decision** — `SLOT_SHIFT` proposals in
  `AWAITING_ADMIN` that involve the member (as requester or target), shown read-only
  with an **"Awaiting admin"** status pill so the member knows the swap is pending
  approval.
- Data source: `my-groups` summaries expose `pendingActionCount`; the widget expands
  via the per-group proposals endpoint
  (`GET /api/v1/contribution-groups/:id/proposals`) filtered client-side to the two
  buckets above.
- **Empty state:** hidden (or a subtle "No pending circle actions") when there is
  nothing to vote on or awaiting admin.

---

## 5. Layout & Interactions

Container: `space-y-8`, `max-w-7xl mx-auto`, responsive gutters.

1. **Gradient hero banner** — greeting (`☀️ Good morning, {firstName}`), tier
   badge, "Welcome back to your cooperative", then a **3-metric row** (Wallet
   Balance · Cooperative Savings · Shares Owned). Buttons:
   - **"+ Add money"** → `onNavigate("wallet")`.
   - **"Book tractor"** → smooth-scrolls to `#active-bookings-hub`.
2. **4 quick-action tiles** (Wallet, Save, Adashe, Equipment):
   - Wallet → `onNavigate("wallet")`; Save → `onNavigate("savings")`.
   - Adashe → smooth-scroll to `#adashe-circle-hub`.
   - Equipment → smooth-scroll to `#active-bookings-hub`.
3. **Two-column row:**
   - **Active bookings** (`#active-bookings-hub`) — "View all" + "Schedule New
     Booking" both → `onNavigate("equipment")`. Empty state when
     `bookings.length === 0`; else rows of `serviceName`, `timeSlot · bookingDate`,
     and a `description` status pill.
   - **Adashe circle** (`#adashe-circle-hub`) — see §4.
4. **Auxiliary row (12-col grid):**
   - **Cooperative Bulletins** (span 8) — unread count badge; per-notification
     card with a **"Mark read"** action → `onReadNotification(id)` (shown only
     when unread); date + `type` tag; a **"Clear All Notifications"** button →
     `onClearNotifications()`. Empty state = "You're all caught up".
   - **Cooperative Rates Index** (span 4) — the three `COOP_RATES` rows + the
     tier discount callout.

**Interaction summary:**

| Action | Handler / behaviour |
|--------|---------------------|
| Add money / Wallet tile / Save tile | `onNavigate(...)` → route change |
| Book tractor / Equipment tile / Schedule / View all | scroll to hub or `onNavigate("equipment")` |
| Adashe tile / Open / Explore | scroll to hub or `onNavigate("adashe")` |
| Mark read (per notification) | `onReadNotification(id)` |
| Clear All Notifications | `onClearNotifications()` |

---

## 6. Motion & Aesthetic Treatment

- **Local `Reveal` wrapper** (defined inside `DashboardView`, distinct from the
  landing-page `Reveal`): fade + slide-up entrance; **respects
  `useReducedMotion()`** (renders static when reduced).
- Adashe progress bar animates width `0 → {progress}%` with an ease-out curve
  (`[0.22, 1, 0.36, 1]`).
- Design tokens match the house system: green `#135D39`, gradient hero
  `#125D39 → #2F8537 → #71B53B`, gold accent `#E7A13C`, canvas `#FAF8F5`, ink
  `#1A2421`, muted `#5C6460`, hairline `#E6E5DF`; `font-display` (Space Grotesk),
  `font-mono` (JetBrains Mono) for money/figures. Cards use large radii
  (`rounded-3xl`), soft shadows, hover lift.

---

## 7. Acceptance Criteria

- ✅ `/app` index renders only for authenticated users (via `ProtectedRoute`).
- ✅ Greeting shows the live auth first name (fallback "Farmer"); tier badge from state.
- ✅ Hero 3-metric row shows wallet balance, computed savings total, and shares units.
- ✅ Savings total matches the §3 formula (only ongoing/locked/active buckets count).
- ✅ Adashe card sources LIVE circles from `/contribution-groups/my-groups`, prefers
     the member's turn, guards divide-by-zero, shows the contextual CTA
     (Claim/Confirm/Open), and shows the empty state (with an invitations chip when
     pending) when no circles exist.
- ✅ The pending slot-shift widget lists proposals awaiting the member's vote and
     slot-shifts awaiting admin decision, and hides when there is nothing pending.
- ✅ Bookings and Notifications each render a correct empty state.
- ✅ "Mark read" appears only for unread items and clears the unread badge count.
- ✅ "Clear All Notifications" empties the list.
- ✅ Quick actions navigate or smooth-scroll to the correct hub anchors.
- ✅ Reduced-motion users get static content and no width-animated progress bar.

---

## 8. Future: live backend wiring

Widgets currently reading seeded client `appStore` state that will move to real
APIs as their modules ship:

- **Wallet balance** → Wallet module (SeerBit-backed) — PRD 02.
- **Cooperative savings total** (Flex/Target/Fixed/Harvest) → Savings — PRD 04.
- **Shares owned / value** → Shares & Dividends — PRD 05.
- **Active bookings** → Equipment (and Services) — PRD 06 / 07.
- **Adashe circle(s) + pending slot-shift widget** → LIVE Contributions/Adashe —
  PRD 09 (`/contribution-groups/my-groups` + per-group proposals). The mock
  `state.contributionGroups`/`appStore` path is **superseded**.
- **Cooperative bulletins** (notifications, mark-read, clear) → notifications API.
- **Rates index** (`COOP_RATES`) → cooperative rates/config service (so APY is
  server-driven, not a client constant).
- **Tier** (`membership.tier`) → Membership — PRD 03 (already partially live via
  Users, but tier currently reads from client state, not the auth profile).

**Live today:** identity/greeting first name and auth gating (Users/Auth backend).

---

## 9. Open Reconciliation Questions

1. **Tier source.** Greeting name is live (`useAuth()`), but the tier badge reads
   `state.membership.tier` from client state. Should the tier come from the
   authenticated user profile instead?
2. **Rate consistency with landing.** Dashboard `COOP_RATES` max is **12.5%**
   (Harvest); the landing page advertises "up to **14.5% APY**". Reconcile to one
   canonical figure (see `PRD/landing_page.md` §10).
3. **Unused callbacks.** `onJoinGroup` / `onCancelBooking` are injected but not
   consumed by `DashboardView` — keep for future inline actions or drop?

---

## 10. Relevant Files

- `src/pages/users/DashboardView.tsx`
- `src/pages/users/DashboardPage.tsx` (container, `tabToPath` / `TAB_PATHS`)
- `src/lib/constants.ts` (`COOP_RATES`, `MEMBER_BOOKING_DISCOUNT`)
- `src/types.ts` (`FarmerAppState`, `ContributionGroup`, `FarmerNotification`)
- `src/hooks/useAuth.ts` (greeting first name)
- `src/hooks/useAppState.ts` (zustand `appStore` accessor)
- `src/routes/ProtectedRoute.tsx` (gating)
- `src/App.tsx` (route wiring)
- LIVE Adashe (PRD 09): `src/store/adasheStore.ts` + `src/services/adashe.service.ts`
  (`/contribution-groups/my-groups` + per-group proposals feeding §4 / §4.1)
