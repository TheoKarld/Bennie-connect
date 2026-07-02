# PRD — Public Landing Page

**Module:** Marketing / Public site
**Route:** `/`
**Status:** 📄 Documents the *as-built* implementation (`src/pages/landing/`).
**Owner:** user-prd-enricher (docs) · user-dev (code)

> ⚠️ **Launch blocker — illustrative content.** Every quantitative figure on this
> page (trust-strip stats, social-proof stats, testimonials, APY headline, wallet
> mock amounts, dividend chip, share price) is a **hardcoded placeholder**, not
> real platform data. All such values MUST be replaced with legally-defensible,
> substantiated figures (or removed) before public launch. See
> [§9 Placeholder Register](#9-placeholder-register-must-fix-before-launch).

---

## 1. Purpose & Audience

- **Purpose:** Marketing / conversion surface. Communicate the cooperative value
  proposition and drive prospects to **sign up** (`/signup`) or **sign in**
  (`/login`); route already-authenticated visitors straight into the app (`/app`).
- **Primary audience:** Nigerian smallholder farmers and cooperative members
  (prospective and returning).
- **Secondary audience:** Field agents (dedicated "Agents" nav anchor and an
  agent testimonial).
- **Nature:** Single-page, logic-free / presentational. Composed of sectioned
  child components under `src/pages/landing/sections/`. Root component:
  `src/pages/landing/LandingPage.tsx`.

**Brand identity (current):** wordmark is **"Bennie Connect"** with the eyebrow
sub-label **"Cooperative Portal"** (rendered in `LandingNav` and `LandingFooter`).
Product is referred to elsewhere as the *Cooperative Farming Portal*.

---

## 2. Page Composition

`LandingPage.tsx` renders, in order:

1. `LandingNav` (sticky/fixed header)
2. `<main>`
   - `HeroSection`
   - `FeaturesSection`
   - `HowItWorksSection`
   - `TiersSection`
   - `SocialProofSection`
   - `CtaSection`
3. `LandingFooter`

Page wrapper: `min-h-screen scroll-smooth bg-[#FAF8F5] text-[#1A2421]`.

---

## 3. Section-by-Section Spec

### 3.1 Sticky navigation — `LandingNav`

- **Fixed** header (`fixed inset-x-0 top-0 z-50`). Transitions from transparent
  to a frosted state (`bg-[#FAF8F5]/80 backdrop-blur-xl`, bottom border, subtle
  shadow) once `window.scrollY > 12` (scroll listener, `passive: true`).
- **Wordmark:** Sprout icon in a rounded green tile + "Bennie Connect" /
  "Cooperative Portal". Anchors to `#top`.
- **In-page anchor links (desktop only):** Features → `#features`,
  Savings → `#how`, Cooperative → `#tiers`, Agents → `#proof`.
- **CTAs (auth-aware):** reads `useAuthStore().status`.
  - Authenticated (`status === "authenticated"`): single **"Go to dashboard"**
    button → `/app`.
  - Unauthenticated: **"Sign in"** → `/login` and **"Get started"** → `/signup`.
- **Mobile:** hamburger toggle opens a drawer with the same anchor links + the
  same auth-aware CTAs; `aria-expanded` / `aria-label` maintained on the button.

**Acceptance:**
- ✅ Header becomes frosted after minimal scroll and reverts at top.
- ✅ CTA set switches correctly on auth status without reload.
- ✅ Drawer closes (`setOpen(false)`) on any link/CTA tap.

### 3.2 Hero — `HeroSection`

- **Layout:** two-column on `lg` (`[1.05fr_0.95fr]`); stacked/centered on mobile.
- **Ambient background:** `.lp-mesh-bg` + `.lp-mesh` animated gradient and
  `.lp-grid` dotted texture, both `pointer-events-none`, `-z-10`, `aria-hidden`.
- **Copy column** (Framer Motion staggered entrance, `staggerChildren: 0.09`):
  - Eyebrow badge: "Cooperative finance for Nigerian farmers".
  - Headline: *"Grow farm wealth **together**, the cooperative way."* ("together"
    uses `.lp-text-gradient`).
  - Sub-copy enumerating the 8 modules.
  - **Primary CTA (auth-aware):** "Get started free" → `/signup`, or
    "Go to dashboard" → `/app` when authenticated.
  - **Secondary CTA:** "Explore features" → `#features` anchor.
  - **Trust strip:** three stats + an explicit "Figures illustrative." disclaimer.
- **Product mock column** (pure div/SVG, no real data):
  - Main frosted "Digital Wallet" card (`.lp-float`) showing balance
    `₦184,500.00`, a Flex Save tile (`₦420,000`), and an SVG **Target ring**
    (`SavingsRing`, 60%).
  - Floating "Coop Shares" card (`.lp-float-slow`) with an inline SVG
    **`Sparkline`** and `₦500 / share`, `+18.2%`.
  - Floating "Dividend paid" chip (`.lp-float`) `₦18,400`.

**Trust-strip values (PLACEHOLDER):** Members saved `₦2.4B+`, Dividends paid
`₦180M`, Cooperatives `60+`.

**Acceptance:**
- ✅ Reduced-motion users get static, fully-visible content (no stagger/float).
- ✅ Primary CTA target respects auth status.
- ✅ Every mock figure is visually clearly *illustrative* (disclaimer present).

### 3.3 Feature grid — `FeaturesSection`

- Section `id="features"`. Heading "The full cooperative toolkit"; sub-copy names
  **eight connected modules** sharing one wallet + one membership.
- **8-tile responsive grid** (1 / 2 / 4 cols). Each tile = Lucide icon + title +
  one-line description, with hover lift.

| # | Title | One-liner (as shipped) |
|---|-------|------------------------|
| 1 | Digital Wallet | Fund/withdraw/transfer in Naira on **SeerBit**-backed rails |
| 2 | High-yield Savings | Flex/Target/Fixed-lock/Harvest earning **up to 14.5% APY** ⚠️ |
| 3 | Shares & Dividends | Verified cooperative equity + semi-annual dividends |
| 4 | Adashe / Esusu Thrift | Rotating circles with voting, chat, attendance, payouts |
| 5 | Equipment Booking | Tractors/harvesters/drones with live GPS operator tracking |
| 6 | Agric Services | Ploughing, threshing, processing, agronomy on demand |
| 7 | Input Marketplace | Fertilizer/seeds/tools at member prices, farm-delivered |
| 8 | Agent Commissions | Field agents register farmers & earn per-activity rewards |

> ⚠️ The "**up to 14.5% APY**" copy is a marketing headline and does **not** match
> the dashboard's `COOP_RATES` (`src/lib/constants.ts`: max = 12.5% Harvest Save).
> Reconcile: pick one canonical top-line APY and use it in both surfaces.

### 3.4 How it works — `HowItWorksSection`

- Section `id="how"`. Heading "From sign-up to harvest, in four steps".
- **4 numbered steps** on a connective gradient line (desktop): Sign up → Fund
  your wallet (SeerBit) → Save, invest & book → Grow together.

### 3.5 Membership tiers — `TiersSection`

- Section `id="tiers"`. **Reads real seed data** — `MEMBERSHIP_TIERS` from
  `src/data.ts` (typed `MembershipTierStr = "Bronze" | "Silver" | "Gold" | "Platinum"`).
- Renders tiers in fixed order `["Bronze","Silver","Gold","Platinum"]`; **Gold** is
  the highlighted "Most popular" card.
- Per card: tier name, price (`cost === 0` → "Free", else `₦{cost}/year`), first
  **4** benefits (`benefits.slice(0, 4)`), and a CTA → `/signup` ("Start free" for
  the free tier, else "Choose {name}").
- Current seed costs: Bronze `₦0`, Silver `₦15,000/yr`, Gold `₦35,000/yr`,
  Platinum `₦75,000/yr`.

> Note: benefit copy and pricing come straight from `MEMBERSHIP_TIERS`. This is
> the one section driven by real (seed) data rather than inline literals — keep it
> in sync with PRD 03 (Membership) and the backend membership catalogue.

### 3.6 Social proof — `SocialProofSection`

- Section `id="proof"` (also the "Agents" nav target).
- **Stats band:** 4 stats + explicit "Figures illustrative of platform scale."
  disclaimer. **(PLACEHOLDER)** — Farmers onboarded `12,000+`, Cooperatives `60+`,
  Member savings `₦2.4B+`, Adashe repayment `98%`.
- **Two testimonials** (5-star), attributed to "Ibrahim Kabiru · Maize farmer ·
  Kano" and "Aliyu Mohammed · Bronze Agent · Zaria". **(PLACEHOLDER — fictional.)**

### 3.7 CTA band — `CtaSection`

- Full-width green (`#135D39`) rounded band with decorative radial gradient wash.
- Heading "Your harvest, your wealth, your community." + dual CTAs:
  "Get started free" → `/signup`, "Sign in" → `/login`.

### 3.8 Footer — `LandingFooter`

- Brand block (repeat wordmark + tagline) + 3 link columns: **Product** (in-page
  anchors), **Modules** (anchors to `#features`), **Account** (`/login`, `/signup`;
  rendered as router `<Link>` because hrefs start with `/`).
- Bottom bar: `© 1999 – 2026 Bennie Connect Cooperative. All rights reserved.`
  and a "Secure SHA-256 Ledger · SeerBit Active" trust line.

> ⚠️ Copyright start year "1999" and "SHA-256 Ledger" are cosmetic claims — verify
> or correct before launch.

---

## 4. Design System

- **Brand tokens (Tailwind arbitrary values):**
  - Primary green `#135D39` (hover `#0f4c2f`); deep/lime gradient stops
    `#125D39 → #2F8537 → #71B53B`.
  - Accent gold `#E7A13C` (variants `#a6701c`, `#d59124`).
  - Ink `#1A2421`; muted `#5C6460`; canvas `#FAF8F5`; hairline `#E6E5DF`.
- **Typography:** `font-display` (**Space Grotesk**), `font-sans` (**Inter**),
  `font-mono` (**JetBrains Mono**, used for numeric/financial figures).
- **Motion:** `motion` (Framer Motion) for hero stagger + scroll reveals; CSS
  keyframes namespaced `lp-*` in `src/index.css`:
  - `lp-float` / `lp-float-slow` — floating mock cards.
  - `lp-mesh` + `.lp-mesh-bg` — drifting ambient gradient.
  - `.lp-grid` — dotted grid texture.
  - `.lp-text-gradient` — gradient headline clip.
  - `lp-shimmer` — defined for CTA/badge sweeps.
- **Reveal component** (`sections/Reveal.tsx`): reusable scroll-in wrapper
  (fade + slide, `viewport once`, polymorphic `as`). Hero uses its own inline
  `motion` variants.

---

## 5. Responsiveness

- Mobile-first; grids collapse 4→2→1. Nav collapses to a hamburger drawer below
  `md`. Hero collapses to a single centered column below `lg`.
- Max content width `max-w-7xl` with `px-4 sm:px-6 lg:px-8` gutters.

---

## 6. Accessibility

- Decorative layers marked `aria-hidden` (mesh, grid, icons, connective line).
- Nav toggle exposes `aria-expanded` + descriptive `aria-label`.
- Star rating group labelled `aria-label="5 out of 5 stars"`.
- **`prefers-reduced-motion`:** honoured two ways — CSS media query disables all
  `lp-*` animations, and `useReducedMotion()` short-circuits Framer entrances to
  static/visible in `Reveal` and the hero.

**Gaps to address:** no visible skip-link; anchor-nav relies on `scroll-smooth`
only (no focus management after jump); verify colour-contrast of muted text
`#5C6460` on `#FAF8F5` meets WCAG AA.

---

## 7. Data Sources

| Surface | Source | Real vs. placeholder |
|---------|--------|----------------------|
| Membership tiers | `MEMBERSHIP_TIERS` (`src/data.ts`) | **Real seed data** |
| Auth-aware CTAs | `useAuthStore().status` | **Live** (auth is the implemented backend) |
| Everything else (stats, testimonials, mock card figures, APY headline) | inline literals | **Placeholder** |

---

## 8. Acceptance Criteria (page-level)

- ✅ Route `/` renders all seven sections in order.
- ✅ All CTAs resolve to `/login`, `/signup`, or `/app` per auth status.
- ✅ Tiers reflect live `MEMBERSHIP_TIERS` (order, pricing, first 4 benefits, Gold highlight).
- ✅ Reduced-motion users get a static, readable page.
- ✅ No console errors; sticky nav + smooth anchor scrolling work.
- ⬜ (Pre-launch) all placeholders in §9 replaced or removed.

---

## 9. Placeholder Register (must-fix before launch)

| Location | Value(s) | Action |
|----------|----------|--------|
| Hero trust strip | ₦2.4B+ saved, ₦180M dividends, 60+ coops | Replace with substantiated figures or remove |
| Hero product mock | ₦184,500 balance, ₦420,000 Flex, 60% target, ₦500/share, +18.2%, ₦18,400 dividend | Keep clearly illustrative; not real |
| Features grid | "up to **14.5% APY**" | Reconcile with `COOP_RATES` (max 12.5%) — single source of truth |
| Social-proof stats | 12,000+, 60+, ₦2.4B+, 98% | Substantiate or remove |
| Testimonials | Ibrahim Kabiru, Aliyu Mohammed | Replace with real, consented testimonials |
| Footer | "© 1999", "SHA-256 Ledger", "SeerBit Active" | Verify claims |

---

## 10. Open Reconciliation Questions

1. **Canonical top-line APY.** Hero/features say "up to 14.5%"; dashboard
   `COOP_RATES` tops out at 12.5% (Harvest Save). Which is correct?
2. **Brand name.** Landing wordmark = "Bennie Connect / Cooperative Portal";
   `CLAUDE.md` also uses "Cooperative Farming Portal" / "Farmer Cooperative
   Portal". Confirm the single public-facing brand name for launch.
3. **Regulatory claims.** Advertised savings/dividend figures and "guaranteed"
   language may trigger Nigerian financial-advertising / SEC / NDPR review.
   Confirm legal sign-off before publishing any stat.

---

## 11. Relevant Files

- `src/pages/landing/LandingPage.tsx`
- `src/pages/landing/sections/{LandingNav,HeroSection,FeaturesSection,HowItWorksSection,TiersSection,SocialProofSection,CtaSection,LandingFooter,Reveal}.tsx`
- `src/index.css` (`lp-*` utilities, `@keyframes`, reduced-motion block)
- `src/data.ts` (`MEMBERSHIP_TIERS`)
- `src/store/authStore.ts` (auth-aware CTAs)
- `src/App.tsx` (route `/` → `LandingPage`)
