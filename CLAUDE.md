# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Bennie-connect** (aka the *Cooperative Farming Portal* / *Farmer Cooperative Portal*) is a cooperative financial + agri-services platform for Nigerian farmers. It has two independently-versioned halves that live in one repo:

- **Frontend** (repo root) — a React 19 + TypeScript + Vite 6 + Tailwind CSS 4 single-page app, originally exported from Google AI Studio. Currently a **mock-data prototype**: all state lives client-side in `localStorage` and is seeded from hardcoded files. No real API calls yet.
- **Backend** (`backend/`) — an enterprise NestJS 10 + MongoDB (Mongoose) + JWT API, intended to replace the mock data. **Early scaffold**: only the Users module is partially implemented; most modules are empty directories or documented-but-unwritten.

The two halves are **not yet wired together**. The transformation roadmap from prototype → production is in `ENTERPRISE_DEVELOPMENT_PROMPTS.md`, and per-module specs are in `PRD/user_module/`.

## Commands

### Frontend (run from repo root)
```bash
npm install          # NOTE: currently fails on a peer-dep conflict — see "Dependency Notes"
npm run dev          # Vite dev server on port 3000, host 0.0.0.0
npm run build        # Production build (vite build)
npm run preview      # Preview built assets
npm run lint         # Type-check only: tsc --noEmit  (there is no ESLint config here)
```
There is **no frontend test runner configured** — `package.json` has no `test` script and no Vitest/Jest setup.

### Backend (run from `backend/`)
```bash
npm install
npm run start:dev    # Nest watch mode
npm run build        # nest build -> dist/
npm run start:prod   # node dist/main
npm run lint         # eslint --fix over src/apps/libs/test
npm run test         # Jest unit tests (*.spec.ts under src/)
npm run test:e2e     # Jest e2e (test/jest-e2e.json)
npm run test:cov     # Coverage
npx jest path/to/file.spec.ts        # Run a single test file
npx jest -t "test name substring"    # Run tests matching a name
```
Backend expects `.env` (copy from `backend/.env.example`) and a MongoDB instance. Default API prefix is `api/v1`, default port `3000` (collides with the frontend dev port — change one when running both).

## Frontend Architecture

The whole app is driven by a **single monolithic `App.tsx`** (~part of ~11k LOC across `src/`). Understand these three things and the rest follows:

1. **One giant state object.** `App.tsx` holds the entire application in one `FarmerAppState` (defined in `src/types.ts`) via `useState`, and mirrors it to `localStorage` under the key `KM_FARMER_PORTAL_STATE_REAL` on every change. There is **no Redux, no Context, no router** — navigation is a `useState<string>` (`activeTab`) that switches which `*View` component renders.
2. **Views are presentational, logic lives in `App.tsx`.** Each of the 10 feature modules is a `*View` component in `src/components/` (e.g. `DigitalWalletView`, `SavingsProductsView`, `AgentDashboardView`). They receive state slices and mutation callbacks as props. Money/transaction mutations funnel through helpers in `App.tsx` such as `appendTx(...)`, which append a `WalletTransaction` and keep balances consistent. When adding behavior, wire the handler in `App.tsx` and pass it down — don't introduce independent local persistence in a view.
3. **Seed data is separate from types.** `src/data.ts` (`INITIAL_APP_STATE`, `MEMBERSHIP_TIERS`) and `src/default_marketplace_data.ts` (services, products, orders) provide the initial mock state. `App.tsx`'s initializer **back-fills newly-added slices** onto state loaded from an older localStorage shape — when you add a new module/slice, add the same back-fill guard so returning users don't crash on missing fields.

All domain types are centralized in `src/types.ts` (membership tiers, wallet/transactions, savings products, shares, bookings, Adashe groups, marketplace, agent commissions). The `@/*` path alias maps to the repo root (see `vite.config.ts` / `tsconfig.json`).

Note: `vite.config.ts` gates HMR/file-watching on the `DISABLE_HMR` env var (an AI Studio concession). Money values are NGN; there is a Gemini API integration point (`@google/genai`, `GEMINI_API_KEY`, `metadata.json` capability) inherited from the AI Studio origin.

## Backend Architecture

Standard NestJS module-per-domain layout under `backend/src/`, one module per PRD:

`auth/`, `users/` (PRD 1), `wallet/` (PRD 2, SeerBit), `membership/` (3), `savings/` (4), `shares/` (5), `equipment/` (6), `services/` (7), `marketplace/` (8), `contributions/` Adashe (9), `agents/` (10), plus `common/` (guards/filters/interceptors/pipes), `config/`, `database/`.

**Current reality vs. the README:** `backend/README.md` documents the *intended* full structure with inline code samples, but most of it is **not yet written**. What actually exists on disk:
- `config/configuration.ts` — central typed config via `registerAs('configuration', ...)`. Everything (db, jwt, bcrypt, **seerbit**, smtp, rateLimit, cors) is read through `configService.get('configuration.<path>')`.
- `database/mongodb.providers.ts` — Mongo connection wiring.
- `users/` — `users.service.ts` (full CRUD + auth-support methods: suspend, verifyEmail, failed-login lockout, password reset), `schemas/user.schema.ts`, and DTOs.
- **Missing / TODO:** `main.ts`, `app.module.ts`, the entire `auth/` module, `users.module.ts`, `users.controller.ts`, and every other domain module. The backend does not currently bootstrap.

**Watch for schema drift between the two halves and the PRD.** The implemented `user.schema.ts` uses `userId`, `phoneNumber`, and roles `['farmer','agent','admin','super_admin']`. PRD 01 instead specifies `phone` and roles `SUPER_ADMIN|ADMIN|COOP_MANAGER|MEMBER|AGENT`. Reconcile against the actual schema when writing new backend code, and confirm the intended role taxonomy before relying on either.

Payment gateway: backend config is built for **SeerBit** (`seerbit.*`), while the frontend prototype models **Paystack/Flutterwave/Monnify** (`PaymentGatewayType`). Treat SeerBit as the backend source of truth unless told otherwise.

## PRD & Specs

- `PRD/user_module/01..10-*.md` — detailed per-module specs (schemas, endpoints, business logic, error codes). These are the contract when implementing a module; read the relevant one before building its API.
- `ENTERPRISE_DEVELOPMENT_PROMPTS.md` — the phased 18-week roadmap (foundation → APIs → marketplace → agent/admin → frontend integration → testing → devops → docs). Useful for sequencing and for the canonical list of intended entities.
- The **admin module** PRDs are now authored under `PRD/admin_module/` — a master `README.md` (RBAC/permission taxonomy, `adminUsers`/`adminRoles`/`adminAuditLog`, `/bennie/*` frontend ↔ `/api/v1/admin/*` backend route map, super-admin seeding) plus per-section specs (`auth`, `admins`, `users`, `cooperative`, `savings_plans`, `membership_tiers`, `agent_commission`, `marketplace`, `equipment_booking`, `adas_hesu_contributions`, `settings`). These are the **live blueprint**; the admin backend/frontend are **not yet implemented**. Admin identity lives in a dedicated `adminUsers` collection independent of `users`; financial-reversal/destructive permissions are Super-Admin-only.

## Subagents

Five project subagents live in `.claude/agents/` and split the work by **layer** (backend vs frontend) and **discipline** (code vs PRD docs). Delegate to them via the Agent tool. Sequencing rule from the project owner: **resolve all user-side work before building the admin module.**

| Subagent | File | Owns | Boundaries |
|----------|------|------|------------|
| **backend-dev** | `.claude/agents/backend-dev.md` | Codes the **entire** NestJS backend — all of `backend/src/`, user-facing modules **and** the admin module (`backend/src/admin/`, `/api/v1/admin/*`, `adminUsers`/`adminRoles`/`adminAuditLog` RBAC, super-admin seeding, audit logging). | **Sole owner of the backend** — never run a second backend writer at the same time. No frontend; no PRD edits. |
| **user-dev** | `.claude/agents/user-dev.md` | Codes the **end-user frontend** — the React/Vite app in `src/` (landing, auth screens, dashboard, user + cooperative feature pages, shared `components/ui`, zustand `store/`, `hooks/`, routing). | Frontend only; backend → `backend-dev`; no admin `/bennie` UI; coordinate on shared `src/` files. No PRD edits. |
| **admin-dev** | `.claude/agents/admin-dev.md` | Codes the **admin frontend** — the `/bennie/*` admin portal UI in `src/` (sign-in, dashboard, and the per-section admin screens). | Frontend only; backend → `backend-dev`; starts after user work is resolved; coordinate on shared `src/` files. No PRD edits. |
| **user-prd-enricher** | `.claude/agents/user-prd-enricher.md` | Authors/enriches **user PRDs** in `PRD/user_module/`. | Docs only; writes no application code. |
| **admin-prd-enricher** | `.claude/agents/admin-prd-enricher.md` | Creates & enriches **admin PRDs** in `PRD/admin_module/` (now authored — README + auth + per-section specs; enrich/reconcile going forward). | Docs only; writes no application code. |

Division of labor: `backend-dev` owns the whole NestJS backend; `user-dev` and `admin-dev` own the frontend (end-user app vs the `/bennie` admin app); the `-prd-enricher` agents write specs and flag (not silently reconcile) drift between PRD wording and the implemented schemas.

**Orchestration rule — avoid write conflicts.** Never run two agents that write the same code area concurrently (it causes `modified since read` rejections, overwritten edits, and broken builds). The backend has a single owner (`backend-dev`) — do **not** spawn a second backend writer in parallel. `user-dev` and `admin-dev` share `src/` (`App.tsx` routing, `components/ui`, `store/`), so sequence them whenever they touch shared frontend files. Default order within a task that spans both: **backend-dev → verify build → frontend agent(s)**. Docs agents (`-prd-enricher`) touch only `PRD/` and can safely run in parallel with code agents.

## Dependency Notes

The declared dependency versions **do** resolve cleanly (`vite@^6.2.3` satisfies the peer ranges of both `@vitejs/plugin-react@5` and `@tailwindcss/vite@4`). The `ERESOLVE` / "Found: vite@undefined" error some contributors hit comes from a **stale or partially-installed `node_modules`**, not from a genuine version conflict. Fix without `--legacy-peer-deps` (which would mask real conflicts): `rm -rf node_modules package-lock.json && npm install`. A committed `package-lock.json` keeps resolution deterministic — regenerate it the same way if it drifts.
