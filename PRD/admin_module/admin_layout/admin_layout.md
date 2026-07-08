# Admin Module — Application Layout / Shell

> Part of the [Admin Module](../README.md). The `adminUsers` / `adminRoles` / `adminAuditLog` schemas, the permission taxonomy, the effective-permission formula, the JWT scope model, and the `mustChangePassword` gate are defined in the master README and in [auth/admin_auth.md](../auth/admin_auth.md) and are authoritative here.

## Overview

The **Admin Layout** is the persistent, responsive **application shell** that wraps every authenticated `/bennie/*` route. It is not itself a feature section — it is the chrome (navbar, sidebar, mobile bottom-nav, mobile drawer, content outlet) rendered around whichever section is active, plus the client-side guards that decide *whether* the shell renders at all.

It has three jobs:
1. **Frame** every admin page consistently (top navbar + left sidebar on desktop; top navbar + bottom nav + slide-in drawer on mobile), with a single content `<Outlet/>` area.
2. **Gate** access — it is only reachable behind the admin `ProtectedRoute`; it enforces the `mustChangePassword` lock; and it handles session-expiry by routing back to `/bennie/auth`.
3. **Filter** navigation by the signed-in admin's **effective permissions** — a nav destination renders only if the admin may enter that section, so a Support Agent never sees Super-Admin-only destinations.

This is a **frontend-only** concern (`admin-dev` owns it in `src/` under the admin SPA). It calls **no** dedicated backend endpoint of its own; it consumes `GET /api/v1/admin/auth/me` (see [auth/admin_auth.md](../auth/admin_auth.md)) to obtain `effectivePermissions`, `mustChangePassword`, role, and identity, and drives navigation from that payload.

Status: 📄 **planned** (no admin frontend surfaces exist yet).

---

## Route Placement

The shell sits **inside** the authenticated route tree and **outside** the pre-auth screens:

```
/bennie
 ├── /auth                     ← NO shell (bare split-panel sign-in; see auth/admin_auth.md)
 └── <AdminProtectedRoute>     ← requires a valid admin-scoped session (§ Guards)
      └── <AdminLayout>        ← THIS document: navbar + sidebar + bottom-nav + <Outlet/>
           ├── /dashboard      ← default landing (see admin_dashboard/admin_dashboard.md)
           ├── /users
           ├── /admin
           ├── /cooperative
           ├── /savings-plans
           ├── /market-place
           ├── /membership-tiers
           ├── /equipment-booking
           ├── /adashesu-contributions
           ├── /agent-commission
           └── /settings
```

- Unauthenticated access to any `<AdminLayout>` child redirects to `/bennie/auth`, preserving the intended destination for post-login return.
- `/bennie` with a valid session redirects to `/bennie/dashboard`.
- The route map (frontend `/bennie/*` ↔ backend `/api/v1/admin/*`) is the canonical one in the [master README](../README.md#route-map--frontend-bennie--backend-apiv1admin).

---

## Structure

### 1. Top navbar (all breakpoints, sticky)

A sticky (`position: sticky; top: 0`) header spanning the content column:

| Zone | Contents |
|------|----------|
| **Left** | On mobile/tablet: **hamburger** toggling the sidebar drawer. On desktop: sidebar collapse/pin toggle. Brand lockup (Bennie logo mark + wordmark; wordmark hides < `sm`). |
| **Center / left-of-content** | **Page title + breadcrumb** for the active route (e.g. `Users › User 360 › Amina Bello`). Breadcrumb segments are links where a parent route exists. Truncates with ellipsis on small screens. |
| **Right** | **Notifications** bell (badge count; opens a panel — placeholder feed until notification sourcing is defined, see Open Questions). **ThemeToggle** (light / dark / system — see [Theming](#theming)). **Admin identity menu**: avatar/initials button opening a dropdown showing full name, email, **role name**, and a **role chip**; menu items: *My profile / Change password* (routes to the change-password flow), **theme options** (the segmented `ThemeToggle` surfaced inline — see [Theming](#theming)), **Logout**. |

- The identity menu's role chip uses brand accent `#E7A13C` for Super Admin, neutral for others.
- Logout calls `POST /api/v1/admin/auth/logout` then clears the admin session and routes to `/bennie/auth`.

### 2. Left sidebar (desktop primary nav; mobile drawer)

Primary navigation to every section. Each item = icon + label + (optional) count badge. **Permission-aware** (§ Permission-aware navigation).

| # | Label | Route | Icon (suggested) | Gating permission (any-of) |
|---|-------|-------|------------------|-----------------------------|
| 1 | Dashboard | `/bennie/dashboard` | `LayoutDashboard` | `dashboard:view` (or always-visible; see dashboard PRD) |
| 2 | Users | `/bennie/users` | `Users` | `users:view` |
| 3 | Admins & Roles | `/bennie/admin` | `ShieldCheck` | `admins:view` OR `roles:view` |
| 4 | Cooperative | `/bennie/cooperative` | `Building2` | `cooperatives:view` OR `shares:view` OR `dividends:view` |
| 5 | Savings Plans | `/bennie/savings-plans` | `PiggyBank` | `savings-plans:view` |
| 6 | Marketplace | `/bennie/market-place` | `ShoppingCart` | `marketplace:view` OR `orders:view` |
| 7 | Membership Tiers | `/bennie/membership-tiers` | `BadgeCheck` | `membership-tiers:view` OR `memberships:view` |
| 8 | Equipment Booking | `/bennie/equipment-booking` | `Tractor` | `equipment:view` |
| 9 | Adashe | `/bennie/adashesu-contributions` | `Users2` | `adashe-groups:view` |
| 10 | Agent Commission | `/bennie/agent-commission` | `Percent` | `agent-commission:view` |
| 11 | Settings | `/bennie/settings` | `Settings` | `settings:view` |

- **Grouping (optional):** a light section split — *Operations* (Dashboard, Users, Cooperative, Savings, Marketplace, Membership, Equipment, Adashe, Agent) and *Administration* (Admins & Roles, Settings) — to visually separate day-to-day ops from platform administration.
- **Audit trail** is a cross-cutting viewer (permission `audit-logs:view`) surfaced within *Admins & Roles* rather than as its own top-level item (matches the master README route map). A secondary nav link inside `/bennie/admin` is acceptable.
- **Footer of sidebar:** condensed identity (name + role), app version string, and a collapse control on desktop.

### 3. Mobile bottom navbar (< `md`)

A fixed bottom bar (`position: fixed; bottom: 0`) exposing the **key** sections for thumb reach — max 5 items to avoid crowding:

`Dashboard · Users · Cooperative · Marketplace · More`

- **More** opens the full slide-in **drawer** (same content as the desktop sidebar) so every section — including the ones not on the bottom bar — stays reachable on mobile. (Owner requirement: the sidebar must remain reachable on mobile in addition to the bottom nav.)
- Bottom-nav items are themselves permission-filtered; if the admin lacks a key section, the slot collapses and the next permitted section fills it (never render a dead item).
- The bottom bar is hidden at `md` and up (desktop uses the sidebar).

### 4. Mobile sidebar drawer (< `md`)

- The **hamburger** in the navbar (and the bottom-nav **More**) opens a **slide-in overlay drawer** from the left containing the full permission-filtered primary nav.
- Behaviour: focus-trapped while open; a dimmed backdrop overlay; closes on backdrop click, `Esc`, route change, or swipe-left. Animated with `motion` (slide + fade, ~200ms, spring-ish easing).
- The drawer and the desktop sidebar render the **same** nav component and permission logic — one source of truth, two presentations.

### 5. Content area

- A single `<Outlet/>` region rendering the active section, offset for the sticky navbar (and for the bottom nav on mobile via bottom padding so content isn't obscured).
- Own scroll container; the navbar/sidebar do not scroll with content.
- Standard slots each section can use: page header (title + primary action), toolbar/filters, body, and a right-hand detail drawer pattern (used by e.g. User 360).

---

## Guards & Lock States

The shell renders only after these checks pass, in order:

1. **`AdminProtectedRoute` (session guard).** Requires a valid **admin-scoped** session — an `adminToken` present and accepted by `GET /auth/me` (which asserts `scope === "admin"`). No token / rejected token / refresh failure → redirect to `/bennie/auth` (preserving intended destination). The admin session is **independent** of any user session in the same browser (see [data_structure.md §5 dual-session model](../../data_structure.md#5-frontend-auth-client-session)); the shell reads only the admin session (`adminToken` / `adminData`).
2. **`mustChangePassword` lock.** If `me().mustChangePassword === true`, the **entire shell is inaccessible** — the app redirects to the forced change-password screen (a modal-locked flow; see [auth/admin_auth.md](../auth/admin_auth.md)). Navbar/sidebar/bottom-nav do not render (or render disabled) until the flag clears. This mirrors the backend gate that returns `403 ADMIN_AUTH_007` on every non-exempt endpoint while the flag is set.
3. **Permission-filtered nav** (below) — decides which destinations appear once the shell is up.

### Session-expired handling

- Admin access tokens are short-lived (15 min). The admin api client silently attempts a refresh via the httpOnly `bennie_admin_rt` cookie (`POST /api/v1/admin/auth/refresh`, `withCredentials`) on `401`.
- On **refresh failure** (`ADMIN_AUTH_010`), the shell surfaces a graceful **"Session expired"** toast, clears `adminToken`/`adminData`, and routes to `/bennie/auth` preserving the current path for post-login return. In-flight unsaved edits prompt a confirm before discard where feasible.
- A refresh that succeeds is invisible to the user (no flicker, no route change).

---

## Permission-aware Navigation

The shell must **never render a nav destination the admin cannot enter**. This is a UX affordance, **not** a security boundary — the security boundary is the backend `PermissionsGuard` on each endpoint. The two must agree.

- The admin's **effective permissions** come from `GET /api/v1/admin/auth/me` → `data.admin.effectivePermissions` (already resolved server-side as `(role.permissions ∪ overrides.granted) \ overrides.revoked`).
- A nav item renders iff the effective set **satisfies** its gating permission (from the sidebar table above) via **exact / `resource:*` / `*`** match — the same matching the backend guard uses. Super Admin (`*`) satisfies every item.
- **Super-Admin-only destinations** (any section whose only meaningful actions are in the [Super-Admin-only set](../README.md#super-admin-only-permission-set-finalized--not-delegable)) are hidden from sub-admins. In practice a sub-admin may still *see* a section (e.g. Cooperative) for its `view` capability while the destructive/financial-reversal controls *inside* it stay disabled — per-action gating is each section PRD's responsibility; the shell only gates section-level visibility.
- **Deep-link protection:** typing a URL for a section the admin lacks permission for lands on an in-shell **403 / "You don't have access to this section"** state (not a redirect loop), with a link back to the dashboard.
- **Empty-nav edge case:** an admin with no `*:view` permissions still sees at least Dashboard (or a minimal "no sections available — contact a Super Admin" state) rather than an empty shell.

> The permission strings, wildcard semantics, and the Super-Admin-only reservation are defined once in the [master README](../README.md#role--access-control-model-rbac). The shell imports that permission-check helper; it does not re-implement matching logic.

---

## Behaviour

| Behaviour | Spec |
|-----------|------|
| **Active-route highlighting** | The nav item matching the current route (and its parent group) is visually active (accent bar + tinted background + bold label). Nested routes highlight their top-level parent. |
| **Collapsible / pinned sidebar (desktop)** | A collapse toggle shrinks the sidebar to an icon rail (labels → tooltips on hover). Pinned vs collapsed preference persists in `localStorage` (e.g. `bennie_admin_sidebar`) per browser. |
| **Sticky header** | Navbar stays fixed on scroll; content scrolls beneath it. Breadcrumb updates on navigation. |
| **Content `<Outlet/>`** | Single outlet; sections mount/unmount here. Route transitions may use a subtle `motion` fade to avoid jarring swaps. |
| **`mustChangePassword` lock** | Shell not accessible until the flag clears (see Guards). |
| **Session-expired** | Graceful toast + redirect (see Guards). |
| **Scroll restoration** | Restore scroll on back-nav to list views; reset to top on forward-nav to detail views. |
| **Loading** | Shell chrome renders immediately; section body shows skeletons while its data loads (each section PRD defines its own skeletons). |
| **Notifications badge** | Bell shows an unread count; opens a panel. Sourcing is 📄 (see Open Questions). |

---

## Design & Accessibility

**Premium, on-brand, not a basic UI.** The shell sets the tone for the whole admin app.

### Brand tokens
- **Colours:** primary green `#135D39`, accent gold `#E7A13C`. Neutral grays for surfaces; success/warn/error from a consistent semantic palette. Support light and (optionally) dark themes; both must meet contrast.
- **Type:** **Space Grotesk** (display/headings, brand voice), **Inter** (body/UI), **JetBrains Mono** (ids, amounts, code-like values such as `adminId`, references, NGN figures in tables).
- **Motion:** use the `motion` library for the drawer slide, sidebar collapse, route-transition fades, and menu/panel entrances — tasteful, ~150–250ms, respecting `prefers-reduced-motion` (disable/reduce when set).
- **Surfaces:** soft elevation, generous spacing, rounded corners consistent with the user app's premium feel; brand gradient reserved for auth/hero moments, not the working chrome.

### Responsive breakpoints
| Range | Layout |
|-------|--------|
| **Mobile** (< `md`, ~< 768px) | Top navbar (hamburger) + **bottom navbar** + slide-in **drawer** for full nav. No persistent sidebar. |
| **Tablet** (`md`–`lg`, ~768–1024px) | Top navbar + **collapsed icon-rail sidebar** (expandable); no bottom nav. |
| **Desktop** (≥ `lg`, ~≥ 1024px) | Top navbar + **full pinned sidebar** + content. Collapse optional. |

### Accessibility
- **Keyboard:** every nav item, menu, and control is reachable and operable by keyboard; a visible **focus ring** everywhere; logical tab order; the drawer **focus-traps** while open and returns focus to the trigger on close.
- **ARIA:** `nav` landmarks with `aria-label` ("Primary", "Mobile"); `aria-current="page"` on the active item; the drawer is a `dialog` with `aria-modal`; the identity/notification menus use proper `menu`/`menuitem` roles and `aria-expanded`.
- **Screen readers:** icon-only controls (hamburger, collapse, bell) carry accessible names; badge counts are announced (e.g. `aria-label="3 unread notifications"`).
- **Skip link:** a "Skip to content" link jumps focus to the `<Outlet/>` region.
- **Reduced motion & contrast:** honour `prefers-reduced-motion`; all text/interactive contrast ≥ WCAG AA.

---

## States (must all be designed)

- **Loading:** chrome-first render + section skeletons.
- **Empty nav:** admin with minimal permissions → Dashboard-only or a "no sections available" message.
- **403 (deep link):** in-shell "no access to this section" panel with a dashboard link.
- **Session expired:** toast + redirect preserving destination.
- **`mustChangePassword`:** shell locked, forced change-password flow.
- **Offline / API error on `me()`:** a retriable error state (the shell cannot render its nav without `effectivePermissions`) rather than a blank screen.

---

## Implementation Checklist (frontend — `admin-dev`)

- [ ] 📄 `AdminProtectedRoute` reading the **admin** session only (`adminToken`/`adminData`), independent of any user session.
- [ ] 📄 `AdminLayout` with sticky navbar, desktop sidebar, mobile bottom-nav, and slide-in drawer sharing one permission-filtered nav config.
- [ ] 📄 Nav config as data (label, route, icon, gating permissions) — single source consumed by sidebar, drawer, and bottom-nav.
- [ ] 📄 Permission-check helper reused from the shared RBAC util (exact / `resource:*` / `*`); no bespoke matching.
- [ ] 📄 `mustChangePassword` lock wired to `me()`; shell inaccessible until cleared.
- [ ] 📄 Session-expired handling via the admin api client's refresh-then-redirect flow.
- [ ] 📄 Active-route highlighting, collapsible/pinned sidebar with persisted preference, breadcrumb generation.
- [ ] 📄 Identity menu (logout → `POST /auth/logout`) and notifications panel (placeholder feed).
- [ ] 📄 Accessibility: focus trap, ARIA landmarks/roles, skip link, keyboard nav, reduced-motion.
- [ ] 📄 Brand tokens + fonts + `motion` transitions per Design.

---

## Dependencies

- **[auth/admin_auth.md](../auth/admin_auth.md)** — `GET /auth/me` (identity + `effectivePermissions` + `mustChangePassword`), `POST /auth/logout`, `POST /auth/refresh`, error codes (`ADMIN_AUTH_007`, `ADMIN_AUTH_010`).
- **[master README](../README.md)** — route map, permission taxonomy, Super-Admin-only reservation.
- **[data_structure.md §5–§6](../../data_structure.md#5-frontend-auth-client-session)** — dual-session token storage (`adminToken`/`adminData`, httpOnly `bennie_admin_rt`), the `adminApi` client (`/api/v1/admin`, `withCredentials`).
- Every section PRD (`users.md`, `admins.md`, `cooperative.md`, …) — the shell frames them; per-action permission gating lives in each section, not here.

---

## Theming

The app-wide theming system is a **client-only** presentation layer, shared verbatim by the admin and user shells. It has no backend representation; the preference is a single `localStorage` key. This section is the mirror of [user_layout.md → Theming](../../user_module/user_layout/user_layout.md#theming); both shells surface the same controls and share one `useTheme` store.

### Semantic tokens

`src/index.css` defines a set of **semantic CSS variables** on `:root` (light) and overridden under `.dark` (dark). Only neutrals flip; **brand `--primary` / `--accent` stay constant** across themes:

| Token | Light | Dark | Meaning |
|-------|-------|------|---------|
| `--canvas` | `#FAF8F5` | `#0F1513` | page background |
| `--surface` | `#FFFFFF` | `#17211C` | cards / raised surfaces |
| `--surface-2` | `#F4F1EC` | `#1E2924` | inset / secondary surfaces |
| `--ink` | `#1A2421` | `#E7ECE9` | primary text |
| `--muted` | `#5C6460` | `#93A29B` | secondary text |
| `--border` | `#E6E5DF` | `#28332D` | hairlines / dividers |
| `--primary` | `#135D39` | `#135D39` | brand green (constant) |
| `--accent` | `#E7A13C` | `#E7A13C` | brand gold (constant) |
| `--success` | `#137a45` | `#2fa564` | success |
| `--warning` | `#E7A13C` | `#E7A13C` | warning |
| `--danger` | `#c0402f` | `#e06552` | error / destructive |

These are registered in the Tailwind v4 `@theme` block as `--color-*` so they surface as utilities: `bg-canvas`, `bg-surface`, `bg-surface-2`, `text-ink`, `text-muted`, `border-border`, `text-primary`, `bg-primary`, `text-accent`, etc. **The whole app has been converted to these tokens** — pages no longer hardcode raw hex for neutrals, so they respond to the theme automatically. Admin screens should use the same tokens.

### Dark mode via `.dark` on `<html>`

- Tailwind v4 `@custom-variant dark (&:where(.dark, .dark *))` keys the `dark:` variant on a **`.dark` class on `<html>`** (class strategy, not media strategy), so `dark:` utilities work alongside the token flip.
- `html.dark { color-scheme: dark; }` sets the native form/scrollbar scheme.

### Modes: light / dark / system

- **Preference** is one of `'light' | 'dark' | 'system'`, **default `system`**. `system` resolves live against `prefers-color-scheme`.
- Managed by **`src/hooks/useTheme.ts`** (a zustand store): exposes `theme` (preference), `resolvedTheme` (`'light' | 'dark'`, what actually renders), and `setTheme(t)`. It toggles `.dark` on `<html>`, sets `color-scheme`, persists the preference, and — while in `system` mode — subscribes to OS scheme changes via a `matchMedia` listener.
- **Persistence:** the preference is stored in `localStorage` under **`bennie_theme`** (`'light' | 'dark' | 'system'`).

### No-flash init

An inline `<script>` in **`index.html`** runs **before first paint**: it reads `localStorage.bennie_theme` (falling back to `system` / the OS media query), and adds/removes `.dark` + sets `color-scheme` on `<html>` synchronously. This prevents a light-then-dark flash on load. `useTheme` initialises to match this script so there is never a class/state mismatch after hydration.

### Controls

- **`src/components/ui/ThemeToggle.tsx`** exports `<ThemeToggle />` (3-option segmented control — Sun = light, Moon = dark, Monitor = system — with a sliding active pill, `role="radiogroup"`) and `<ThemeToggleButton />` (compact single icon that cycles light → dark → system).
- Both read/write the shared `useTheme` store, so they stay in sync wherever mounted. They use the semantic tokens, are keyboard-accessible, and respect reduced motion.
- **Surfaced in both planes:** the toggle appears in the **admin** navbar right zone + identity menu (this document) **and** in the **user** navbar + identity dropdown ([user_layout.md](../../user_module/user_layout/user_layout.md#theming)). Both planes share the same `useTheme` store and `bennie_theme` key — a single OS-level preference per browser (independent of which plane, or both, you are signed into).

### Scope & storage summary

- **Client-only:** no theme field on any backend collection or `adminUsers` doc; nothing is sent to the API.
- **Keys:** `localStorage.bennie_theme` (theme preference) is distinct from the admin sidebar-collapse key `localStorage.bennie_admin_sidebar`. See [data_structure.md §5](../../data_structure.md#5-frontend-auth-client-session).

---

## Open Questions for the Owner

1. **Notifications sourcing.** The navbar bell is modeled, but there is no admin-notification collection/endpoint yet. Confirm whether admin notifications derive from `adminAuditLog` (e.g. mentions/assignments), from pending-approval queues, or a dedicated feed — until then the panel is a labeled placeholder.
2. ~~**Dark theme at launch.**~~ ✅ **Resolved — dark ships now.** The app runs a full **light / dark / system** theming system at launch (default `system`), driven by `useTheme` + `ThemeToggle`, keyed on `.dark` on `<html>`, with a no-flash `index.html` init script and the preference in `localStorage.bennie_theme`. See the [Theming](#theming) section below.
3. **Sidebar grouping/labels.** Confirm the Operations/Administration grouping and the exact bottom-nav 5 (Dashboard · Users · Cooperative · Marketplace · More) match the intended IA, or reorder to preference.
