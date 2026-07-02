# PRD — User Dashboard (Home)

**Module:** Users / App home
**Route:** `/app` (index route of the authenticated shell)
**Gating:** `ProtectedRoute` (`src/routes/ProtectedRoute.tsx`)
**Status:** 📄 Documents the *as-built* implementation
(`src/pages/users/DashboardView.tsx` + `DashboardPage.tsx`).
**Owner:** user-prd-enricher (docs) · user-dev (code)

> **Scope reality.** Only the **Users / Auth** backend is live. On this screen the
> **identity/greeting is the live part** (first name from `useAuth()`; tier is
> read from client state). Every **financial widget** (wallet, savings, shares,
> bookings, Adashe, notifications, rates) runs on **per-user client `appStore`
> state that is seeded**, not a real API — until the wallet/savings/shares/
> equipment/contributions backend modules ship. See
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
| Adashe circle | `state.contributionGroups[]` | see §4 |
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

## 4. Adashe Circle Card (live from real `contributionGroups`)

Derived from `state.contributionGroups` (typed `ContributionGroup`, `src/types.ts`):

- **Group selection:** prefer the group the user has joined
  (`groups.find(g => g.hasJoined)`), else the first group (`groups[0]`), else
  `null`.
- **Progress:** `min(100, round(currentPool / totalPayoutPool * 100))`; returns
  `0` when there is no group or `totalPayoutPool <= 0` (guards divide-by-zero).
- **Card content (when a group exists):** `name`; "Next payout {nextPayoutDate} ·
  {userRank}"; `{memberCount} members` chip; animated progress bar
  (`formatNaira(currentPool) / formatNaira(totalPayoutPool) met` + `%`); footer
  "{cycleAmount} / {frequency ?? "cycle"} contribution" + an **"Open"** button →
  `onNavigate("adashe")`.
- **Empty state (no groups):** "Join an Adashe circle" prompt with explainer copy
  and an **"Explore Adashe circles"** button → `onNavigate("adashe")`.

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
- ✅ Adashe card prefers a joined group, guards divide-by-zero, and shows the
     empty state when no groups exist.
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
- **Adashe circle** (`contributionGroups`) → Contributions/Adashe — PRD 09.
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
