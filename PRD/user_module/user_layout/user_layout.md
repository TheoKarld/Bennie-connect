# User Module — Application Layout / Shell

> Part of the [User Module](../). The client auth session (`userToken` / `userData`), the dual-session token model, and the `useAuthStore` are defined in [data_structure.md §5–§6](../../data_structure.md#5-frontend-auth-client-session) and are authoritative here. This document covers only the **end-user** shell at `/app/*`; the admin console shell is the mirror-image spec in [admin_module/admin_layout/admin_layout.md](../../admin_module/admin_layout/admin_layout.md).

## Overview

The **User Layout** (`AppShell`) is the persistent, responsive **application shell** that wraps every authenticated `/app/*` route. It is not itself a feature section — it is the chrome (top navbar, left sidebar, mobile bottom-nav, mobile drawer, content outlet, notification runtime) rendered around whichever feature page is active, plus the client-side guard that decides *whether* the shell renders at all.

It has three jobs:
1. **Frame** every user page consistently (top navbar + left sidebar on desktop; top navbar + bottom nav + slide-in drawer on mobile), with a single content `<Outlet/>` area.
2. **Gate** access — it is only reachable behind the user `ProtectedRoute`; unauthenticated access redirects to `/login`, and session-expiry routes back there gracefully.
3. **Orient** the user — active-route highlighting, a breadcrumb/page title from the nav config, identity + tier context, notifications, and the theme control.

**Key difference from the admin shell: there is *no permission-filtering*.** Every authenticated farmer sees the **same, complete** navigation — all sections in `USER_NAV` are always visible. There is no RBAC nav gate, no effective-permissions payload, no per-section deep-link 403. (The admin shell filters nav by `effectivePermissions`; the user shell does not.)

This is a **frontend-only** concern (`user-dev` owns it in `src/`). It calls **no** dedicated backend endpoint of its own; identity comes from the persisted user session (`userData` / `useAuthStore`), and the notification bell sources its feed from the notification runtime (see [Notifications](#notifications)).

Status: 🔧 **being rebuilt** — the shell is migrating from the legacy `AppShell.tsx` (flat sidebar, dropdown mobile menu) to mirror `AdminLayout.tsx`: sticky navbar with breadcrumb, collapsible desktop sidebar driven by `USER_NAV` (`src/components/layout/userNav.ts`), mobile bottom-nav + slide-in drawer, identity dropdown, and the shared `ThemeToggle`. This document specifies the **target** state.

---

## Route Placement

The shell sits **inside** the authenticated route tree and **outside** the pre-auth screens (`src/App.tsx`):

```
/                              ← NO shell (public landing page)
/login /signup                 ← NO shell (auth screens under AuthGate; redirect to /app when authed)
/forgot-password /reset-password

<ProtectedRoute>               ← requires a valid user-scoped session (§ Guards)
 └── <AppShell>                ← THIS document: navbar + sidebar + bottom-nav + <Outlet/>
      ├── /app                 ← index → Overview / Dashboard (see dashboard/user_dashboard.md)
      ├── /app/wallet
      ├── /app/savings
      ├── /app/adashe
      │    └── /app/adashe/:groupId   ← nested workspace (highlights the Adashe parent)
      ├── /app/equipment
      ├── /app/services
      ├── /app/marketplace
      ├── /app/shares
      ├── /app/membership
      └── /app/agent
```

- Unauthenticated access to any `<AppShell>` child redirects to `/login`.
- `AuthGate` redirects an **already-authenticated** user away from `/login` `/signup` to `/app`.
- The route tree is defined in `src/App.tsx`; the nav data is `src/components/layout/userNav.ts` (`USER_NAV`, `USER_BOTTOM_NAV_ROUTES`, `USER_ROUTE_TITLES`).

---

## Structure

### 1. Top navbar (all breakpoints, sticky)

A sticky (`position: sticky; top: 0`, `z-40`, backdrop-blur) header spanning the content column:

| Zone | Contents |
|------|----------|
| **Left** | On mobile/tablet (< `lg`): **hamburger** opening the sidebar **drawer**. On desktop (≥ `lg`): sidebar **collapse toggle** (chevron). Brand lockup (Bennie logo mark + "Bennie Connect" wordmark + "Cooperative Portal" eyebrow) — shown on mobile; on desktop the brand lives in the sidebar header, and the navbar left shows the **breadcrumb** instead. |
| **Center / left-of-content** | **Breadcrumb / page title** for the active route, derived from `USER_ROUTE_TITLES` keyed on the first path segment after `/app` (e.g. `Portal › Wallet`). The `/app` index maps to "Overview". Truncates with ellipsis on small screens. |
| **Right** | **NotificationBell** (unread badge; opens the notification panel — see [Notifications](#notifications)). **ThemeToggle** (light / dark / system — see [Theming](#theming)). **Avatar identity dropdown**: initials button opening a menu (see below). |

**Identity dropdown menu** (opened from the avatar button):
- Header: full name, email (`font-mono`, truncated), and a **membership tier chip** (Bronze / Silver / Gold / Platinum, coloured per `MEMBERSHIP_TIERS`) sourced from the user's membership state.
- Body:
  - **Theme options** — the segmented `ThemeToggle` (light / dark / system) surfaced inline so the preference is reachable from the menu as well as the navbar.
  - *My profile* — routes to the profile/settings surface (when present).
  - **Logout** — calls `useAuth().logout()` then routes to `/login` (`{ replace: true }`).
- The menu is click-away-dismissable, `Esc`-closable, closes on route change, and uses `menu` / `menuitem` roles with `aria-expanded` on the trigger.

> The ThemeToggle appears **twice** by design: as a standalone control in the navbar right zone (fast access) and inside the identity dropdown (discoverability). Both write the same `useTheme` store, so they stay in sync.

### 2. Left sidebar (desktop primary nav; mobile drawer)

Primary navigation to every section. Each item = icon + label, driven **entirely** by `USER_NAV` — **no permission gating** (every item always renders):

| # | Label | Route | Icon (`lucide-react`) |
|---|-------|-------|-----------------------|
| 1 | Overview | `/app` (`end`) | `LayoutDashboard` |
| 2 | Wallet | `/app/wallet` | `Wallet` |
| 3 | Savings | `/app/savings` | `PiggyBank` |
| 4 | Adashe | `/app/adashe` | `Users` |
| 5 | Equipment | `/app/equipment` | `Compass` |
| 6 | Agro Services | `/app/services` | `Wrench` |
| 7 | Marketplace | `/app/marketplace` | `ShoppingBag` |
| 8 | Shares | `/app/shares` | `TrendingUp` |
| 9 | Membership | `/app/membership` | `CreditCard` |
| 10 | Agent | `/app/agent` | `Briefcase` |

- **Collapsible (desktop):** a collapse toggle shrinks the sidebar to an icon rail (labels → tooltips on hover). The collapse preference persists in `localStorage` under **`bennie_user_sidebar`** (`"collapsed"` | `"pinned"`), mirroring the admin `bennie_admin_sidebar` key.
- **Sidebar header:** brand lockup (logo + "Bennie Connect" + "Cooperative Portal" eyebrow); hidden labels when collapsed.
- **Sidebar footer:** condensed identity (avatar initials + name + tier), the **Coop Card ID** chip (`membership.cardNumber`, `font-mono`), an app version string, and the collapse control.
- The sidebar and the mobile drawer render the **same** nav config — one source of truth (`USER_NAV`), two presentations.

### 3. Mobile bottom navbar (< `lg`)

A fixed bottom bar (`position: fixed; bottom: 0`, `z-40`) exposing the **key** sections for thumb reach — 5 slots from `USER_BOTTOM_NAV_ROUTES` + a **More** slot:

`Overview · Wallet · Savings · Adashe · More`

- **More** opens the full slide-in **drawer** (same content as the desktop sidebar) so every section — including the ones not on the bottom bar (Equipment, Services, Marketplace, Shares, Membership, Agent) — stays reachable on mobile.
- Because the user shell has **no permission filtering**, bottom-nav slots are static (never collapse/refill like the admin shell's do).
- The bottom bar is hidden at `lg` and up (desktop uses the sidebar). Content gets bottom padding so it is never obscured by the bar.

### 4. Mobile sidebar drawer (< `lg`)

- The **hamburger** in the navbar (and the bottom-nav **More**) opens a **slide-in overlay drawer** from the left containing the full `USER_NAV`.
- Behaviour: focus-trapped while open; a dimmed, blurred backdrop; closes on backdrop click, `Esc`, route change, or navigation. Animated with `motion` (slide + fade, ~200ms, spring-ish easing), respecting `prefers-reduced-motion`.
- The drawer footer carries the identity block, the Coop Card ID chip, a Logout action, and the app version — matching the desktop sidebar footer.
- The drawer and the desktop sidebar render the **same** nav component — one source of truth, two presentations.

### 5. Content area

- A single `<Outlet/>` region rendering the active section, offset for the sticky navbar (top) and for the bottom nav on mobile (bottom padding).
- Own scroll container; the navbar/sidebar do not scroll with content.
- Content is width-capped (e.g. `max-w-7xl mx-auto`) for readable line-lengths on wide screens.
- Standard slots each section can use: page header (title + primary action), toolbar/filters, body, and (where used) a right-hand detail drawer pattern.

---

## Guards & Session States

The shell renders only after this check passes:

1. **`ProtectedRoute` (session guard).** Requires a valid **user-scoped** session — a `userToken` present and an `authenticated` status in `useAuthStore`. No token / `unauthenticated` status → redirect to `/login`. `idle` / `loading` render a splash while `hydrate()` resolves. The user session is **independent** of any admin session in the same browser (see [data_structure.md §5.1 dual-session model](../../data_structure.md#51-frontend-token-storage--dual-session-hybrid-)); the shell reads only the user session (`userToken` / `userData`).

> Unlike the admin shell, the user shell has **no `mustChangePassword` lock** and **no permission-filtered nav** — once authenticated, the full shell renders with all sections visible.

### Session-expired handling

- User access tokens are short-lived (~15 min). The `userApi` client silently attempts a refresh via the httpOnly `bennie_user_rt` cookie (`POST /api/v1/auth/refresh`, `withCredentials`) on `401`.
- On **refresh failure**, the shell surfaces a graceful **"Session expired"** toast, clears `userToken` / `userData`, and routes to `/login` (preserving the current path for post-login return where feasible). In-flight unsaved edits should prompt a confirm before discard.
- A refresh that succeeds is invisible to the user (no flicker, no route change).

---

## Notifications

The navbar bell (`NotificationBell`) surfaces the user's notification feed:

- **Unread badge** on the bell; opens a panel listing newest-first notifications with per-severity tone icons (`info` / `success` / `warning` / `alert`), relative timestamps, read/unread state, "Mark all read", and (where offered) an "Enable push notifications" affordance.
- Sourcing: the notification **runtime** (`NotificationProvider`, mounted once in the shell) hydrates the feed, opens the realtime socket, and wires FCM web-push. The feed + unread count come from the notification store, replacing the legacy client-only `FarmerNotification` mock (see [data_structure.md §1.7](../../data_structure.md#17-notifications) and the notification engine PRD).
- Clicking a notification with a `link` navigates to the deep-linked `/app/...` route and marks it read.

---

## Behaviour

| Behaviour | Spec |
|-----------|------|
| **Active-route highlighting** | The nav item matching the current route is visually active (filled pill / accent + bold label). Nested routes (`/app/adashe/:groupId`) highlight their top-level parent (`Adashe`). `NavLink` `end` is set on the `/app` index item so it isn't active on every child. |
| **Collapsible sidebar (desktop)** | A collapse toggle shrinks the sidebar to an icon rail (labels → tooltips). Preference persists in `localStorage.bennie_user_sidebar` (`"collapsed"` \| `"pinned"`) per browser. |
| **Sticky header** | Navbar stays fixed on scroll; content scrolls beneath it. Breadcrumb/title updates on navigation. |
| **Content `<Outlet/>`** | Single outlet; sections mount/unmount here. Route transitions may use a subtle `motion` fade. |
| **Session-expired** | Graceful toast + redirect to `/login` (see Guards). |
| **Theme** | Light / dark / system via `useTheme`; toggle in navbar + identity menu; no flash on load (see [Theming](#theming)). |
| **Notifications badge** | Bell shows an unread count; opens a panel (see Notifications). |
| **Menus close on navigation** | Identity dropdown, notification panel, and mobile drawer all close on route change. |

---

## Design & Accessibility

**Premium, on-brand, not a basic UI.** The shell sets the tone for the whole user app and matches the admin shell's visual language.

### Brand tokens

The shell (and every page) renders through the **semantic theme tokens** (`--canvas`, `--surface`, `--surface-2`, `--ink`, `--muted`, `--border`, `--primary`, `--accent`, `--success`, `--warning`, `--danger`) defined in `src/index.css`, exposed as Tailwind utilities (`bg-canvas`, `bg-surface`, `text-ink`, `text-muted`, `border-border`, `text-primary`, etc.). See [Theming](#theming).

- **Colours:** brand primary green `#135D39` and accent gold `#E7A13C` are **constant across themes**; only the neutrals (canvas/surface/ink/muted/border) flip between light and dark.
- **Type:** **Space Grotesk** (display/headings), **Inter** (body/UI), **JetBrains Mono** (ids, amounts, references such as `cardNumber`, NGN figures) — loaded in `src/index.css`.
- **Motion:** use the `motion` library for the drawer slide, sidebar collapse, menu/panel entrances, and route-transition fades — tasteful, ~150–250ms, respecting `prefers-reduced-motion`.
- **Surfaces:** soft elevation, generous spacing, rounded corners; brand gradient reserved for hero/landing moments, not the working chrome.

### Responsive breakpoints

| Range | Layout |
|-------|--------|
| **Mobile** (< `md`, ~< 768px) | Top navbar (hamburger) + **bottom navbar** + slide-in **drawer** for full nav. No persistent sidebar. |
| **Tablet** (`md`–`lg`, ~768–1024px) | Top navbar + **bottom navbar** + drawer (or a collapsed icon-rail sidebar, at the implementer's discretion). |
| **Desktop** (≥ `lg`, ~≥ 1024px) | Top navbar + **full sidebar** (collapsible to icon rail) + content. No bottom nav. |

### Accessibility

- **Keyboard:** every nav item, menu, and control is reachable and operable by keyboard; a visible **focus ring** everywhere; logical tab order; the drawer **focus-traps** while open and returns focus to the trigger (hamburger) on close.
- **ARIA:** `nav` landmarks with `aria-label` ("Primary", "Mobile"); `aria-current="page"` on the active item; the drawer is a `dialog` with `aria-modal`; identity/notification menus use `menu` / `menuitem` roles and `aria-expanded`.
- **Screen readers:** icon-only controls (hamburger, collapse, bell, theme toggle) carry accessible names; badge counts are announced (e.g. `aria-label="3 unread notifications"`).
- **Skip link:** a "Skip to content" link jumps focus to the `<Outlet/>` region.
- **Reduced motion & contrast:** honour `prefers-reduced-motion` (disable/reduce animations); all text/interactive contrast ≥ WCAG AA in **both** light and dark themes.

---

## States (must all be designed)

- **Loading:** chrome-first render + section skeletons (each section PRD defines its own skeletons); splash while `hydrate()` resolves the session.
- **Session expired:** toast + redirect to `/login` preserving destination.
- **Offline / API error:** retriable error states within sections; the shell chrome itself stays rendered.
- **Empty notifications:** "You're all caught up" empty state in the bell panel.
- **Theme:** correct rendering in light, dark, and system (following OS) with no flash on load.

---

## Theming

The app-wide theming system is a **client-only** presentation layer. It has no backend representation; the preference is a single `localStorage` key. Documented here (and mirrored in [admin_layout.md](../../admin_module/admin_layout/admin_layout.md#theming)) because both shells surface the same controls.

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

These are registered in the Tailwind v4 `@theme` block as `--color-*` so they surface as utilities: `bg-canvas`, `bg-surface`, `bg-surface-2`, `text-ink`, `text-muted`, `border-border`, `text-primary`, `bg-primary`, `text-accent`, `text-success`, `text-warning`, `text-danger`, etc. **The whole app has been converted to these tokens** — pages no longer hardcode raw hex for neutrals, so they respond to the theme automatically.

### Dark mode via `.dark` on `<html>`

- Tailwind v4 `@custom-variant dark (&:where(.dark, .dark *))` keys the `dark:` variant on a **`.dark` class on `<html>`** (class strategy, not media strategy), so `dark:` utilities work in tandem with the token flip.
- `html.dark { color-scheme: dark; }` sets the native form/scrollbar scheme.

### Modes: light / dark / system

- **Preference** is one of `'light' | 'dark' | 'system'`, **default `system`**. `system` resolves live against `prefers-color-scheme`.
- Managed by **`src/hooks/useTheme.ts`** (a zustand store): exposes `theme` (preference), `resolvedTheme` (`'light' | 'dark'`, what actually renders), and `setTheme(t)`. It toggles `.dark` on `<html>`, sets `color-scheme`, persists the preference, and — while in `system` mode — subscribes to OS scheme changes via a `matchMedia` listener.
- **Persistence:** the preference is stored in `localStorage` under **`bennie_theme`** (`'light' | 'dark' | 'system'`).

### No-flash init

An inline `<script>` in **`index.html`** runs **before first paint**: it reads `localStorage.bennie_theme` (falling back to `system` / the OS media query), and adds/removes `.dark` + sets `color-scheme` on `<html>` synchronously. This prevents a light-then-dark flash on load. `useTheme` initialises to match this script so there is never a class/state mismatch after hydration.

### Controls

- **`src/components/ui/ThemeToggle.tsx`** exports:
  - `<ThemeToggle />` — a 3-option segmented control (Sun = light, Moon = dark, Monitor = system) with a sliding active pill (`motion`, reduced-motion aware), `role="radiogroup"` / `role="radio"`.
  - `<ThemeToggleButton />` — a compact single icon that cycles light → dark → system, for tight spots.
- Both read/write the shared `useTheme` store, so they stay in sync wherever mounted. Both use the semantic tokens (so they render correctly in either theme), are keyboard-accessible, and respect reduced motion.
- **Surfaced in both planes:** the toggle appears in the **user** navbar right zone + identity dropdown (this document) **and** in the **admin** navbar identity menu ([admin_layout.md](../../admin_module/admin_layout/admin_layout.md#theming)). Both planes share the same `useTheme` store and `bennie_theme` key — a single OS-level preference for the browser.

### Scope & storage summary

- **Client-only:** no theme field on any backend collection; nothing is sent to the API.
- **One key:** `localStorage.bennie_theme` (see [data_structure.md §5](../../data_structure.md#5-frontend-auth-client-session)). The sidebar-collapse preference is a **separate** key, `localStorage.bennie_user_sidebar`.

---

## Implementation Checklist (frontend — `user-dev`)

- [ ] 🔧 `ProtectedRoute` reading the **user** session only (`userToken` / `userData`), independent of any admin session.
- [ ] 🔧 `AppShell` rebuilt to mirror `AdminLayout`: sticky navbar with breadcrumb, collapsible desktop sidebar, mobile bottom-nav, and slide-in drawer sharing one nav config (`USER_NAV`).
- [ ] ✅ Nav config as data (`userNav.ts`: `USER_NAV`, `USER_BOTTOM_NAV_ROUTES`, `USER_ROUTE_TITLES`) — single source consumed by sidebar, drawer, and bottom-nav. **No permission gating.**
- [ ] 🔧 Collapsible sidebar with persisted preference (`bennie_user_sidebar`); active-route highlighting; breadcrumb generation from `USER_ROUTE_TITLES`.
- [ ] 🔧 Identity dropdown (name / email / tier chip / theme options / logout → `/login`).
- [ ] ✅ ThemeToggle wired in navbar + identity menu (`useTheme` + `ThemeToggle`).
- [ ] ✅ Notification runtime + bell (`NotificationProvider`, `NotificationBell`).
- [ ] 🔧 Accessibility: focus trap, ARIA landmarks/roles, skip link, keyboard nav, reduced-motion.
- [ ] ✅ Semantic theme tokens + fonts + `motion` transitions per Design/Theming.

---

## Dependencies

- **`src/components/layout/userNav.ts`** — `USER_NAV`, `USER_BOTTOM_NAV_ROUTES`, `USER_ROUTE_TITLES` (nav single source of truth).
- **`src/hooks/useTheme.ts`** + **`src/components/ui/ThemeToggle.tsx`** — theming store + controls.
- **`src/components/layout/NotificationBell.tsx`** + **`src/providers/NotificationProvider.tsx`** — notification feed + runtime.
- **[data_structure.md §5–§6](../../data_structure.md#5-frontend-auth-client-session)** — user session (`userToken` / `userData`), dual-session model, `useAuthStore`, `localStorage` keys (`bennie_theme`, `bennie_user_sidebar`).
- **[admin_module/admin_layout/admin_layout.md](../../admin_module/admin_layout/admin_layout.md)** — the mirror-image admin shell; shares the Theming system.
- Every section PRD (`wallet`, `savings`, `adashesu-contributions`, …) — the shell frames them; page content lives in each section, not here.

---

## Open Questions for the Owner

1. **Profile surface.** The identity menu lists a "My profile" item; confirm whether a dedicated `/app/profile` (or settings) route exists / is planned, or whether the menu should omit it until then.
2. **Tier chip source.** The identity chip reads the current membership tier from client state today (`membership.tier`). Confirm this should switch to the server membership once PRD 03 lands.
3. **Tablet layout.** Confirm whether tablets (`md`–`lg`) should use the bottom-nav + drawer (as mobile) or a collapsed icon-rail sidebar — the admin shell uses the icon rail at that range.
