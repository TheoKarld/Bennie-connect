# Graph Report - .  (2026-07-02)

## Corpus Check
- 176 files · ~142,592 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 884 nodes · 1562 edges · 48 communities (38 shown, 10 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 17 edges (avg confidence: 0.8)
- Token cost: 392,922 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Admin RBAC & Audit Services|Admin RBAC & Audit Services]]
- [[_COMMUNITY_Backend Modules & Config Wiring|Backend Modules & Config Wiring]]
- [[_COMMUNITY_Cooperative Feature Views|Cooperative Feature Views]]
- [[_COMMUNITY_Auth Controllers (User + Admin)|Auth Controllers (User + Admin)]]
- [[_COMMUNITY_Admin Section Pages|Admin Section Pages]]
- [[_COMMUNITY_Backend Dev Dependencies|Backend Dev Dependencies]]
- [[_COMMUNITY_Admin Module PRDs & RBAC|Admin Module PRDs & RBAC]]
- [[_COMMUNITY_Admin Dashboard UI|Admin Dashboard UI]]
- [[_COMMUNITY_Frontend Dependencies|Frontend Dependencies]]
- [[_COMMUNITY_TypeScript Config|TypeScript Config]]
- [[_COMMUNITY_Landing Hero & Auth Service|Landing Hero & Auth Service]]
- [[_COMMUNITY_Landing Page Sections|Landing Page Sections]]
- [[_COMMUNITY_Backend Runtime Dependencies|Backend Runtime Dependencies]]
- [[_COMMUNITY_Backend Module Architecture PRD|Backend Module Architecture PRD]]
- [[_COMMUNITY_Mail  OneSignal Service|Mail / OneSignal Service]]
- [[_COMMUNITY_Auth Pages & Guards|Auth Pages & Guards]]
- [[_COMMUNITY_Password Reset & Strength UI|Password Reset & Strength UI]]
- [[_COMMUNITY_Admin Auth Shell & Guards|Admin Auth Shell & Guards]]
- [[_COMMUNITY_Super-Admin Financial Permissions|Super-Admin Financial Permissions]]
- [[_COMMUNITY_Admin Layout & Navigation|Admin Layout & Navigation]]
- [[_COMMUNITY_Backend NPM Scripts|Backend NPM Scripts]]
- [[_COMMUNITY_Savings Plans & Interest|Savings Plans & Interest]]
- [[_COMMUNITY_Settings SSOT & Fees|Settings SSOT & Fees]]
- [[_COMMUNITY_Jest Test Config|Jest Test Config]]
- [[_COMMUNITY_Auth Tokens & Email Integration|Auth Tokens & Email Integration]]
- [[_COMMUNITY_Nest CLI Config|Nest CLI Config]]
- [[_COMMUNITY_Section Placeholder & Badge UI|Section Placeholder & Badge UI]]
- [[_COMMUNITY_Frontend Package Metadata|Frontend Package Metadata]]
- [[_COMMUNITY_Shares, Dividends & Membership PRD|Shares, Dividends & Membership PRD]]
- [[_COMMUNITY_Dashboard & Data-Structure PRD|Dashboard & Data-Structure PRD]]
- [[_COMMUNITY_User Management & KYC PRD|User Management & KYC PRD]]
- [[_COMMUNITY_Membership Tiers & Compliance|Membership Tiers & Compliance]]
- [[_COMMUNITY_Bennie Connect Brand Identity|Bennie Connect Brand Identity]]
- [[_COMMUNITY_Wallet & Contribution Collections|Wallet & Contribution Collections]]
- [[_COMMUNITY_Equipment & Services Booking|Equipment & Services Booking]]
- [[_COMMUNITY_Button UI Component|Button UI Component]]
- [[_COMMUNITY_Agent Commission Collections|Agent Commission Collections]]
- [[_COMMUNITY_Vite Env Types|Vite Env Types]]
- [[_COMMUNITY_Card UI Component|Card UI Component]]
- [[_COMMUNITY_Field UI Component|Field UI Component]]
- [[_COMMUNITY_Google Auth Button|Google Auth Button]]
- [[_COMMUNITY_Modal UI Component|Modal UI Component]]
- [[_COMMUNITY_Vite Config|Vite Config]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]

## God Nodes (most connected - your core abstractions)
1. `UsersService` - 35 edges
2. `UserDocument` - 28 edges
3. `AdminUserDocument` - 24 edges
4. `useAppState()` - 24 edges
5. `FarmerAppState` - 23 edges
6. `compilerOptions` - 19 edges
7. `AuthService` - 19 edges
8. `AdminAuthService` - 16 edges
9. `MailService` - 16 edges
10. `useAdminAuth()` - 16 edges

## Surprising Connections (you probably didn't know these)
- `Users Module (PRD 1)` --references--> `UsersService`  [INFERRED]
  backend/README.md → backend/src/users/users.service.ts
- `UsersService` --references--> `UsersService`  [INFERRED]
  backend/README.md → backend/src/users/users.service.ts
- `AdminDashboard()` --calls--> `hasPermission()`  [INFERRED]
  src/pages/admin/AdminDashboard.tsx → backend/src/admin/permissions.util.ts
- `User MongoDB Schema` --references--> `User`  [INFERRED]
  backend/README.md → backend/src/users/schemas/user.schema.ts
- `admin-dev Subagent (Admin Frontend Developer)` --implements--> `Admin Layout / Shell PRD`  [INFERRED]
  .claude/agents/admin-dev.md → PRD/admin_module/admin_layout/admin_layout.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Subagent division of labor (layer x discipline)** — backend_dev_agent, user_dev_agent, admin_dev_agent, user_prd_enricher_agent, admin_prd_enricher_agent [EXTRACTED 1.00]
- **Admin RBAC three-collection model** — admin_module_readme_admin_users, admin_module_readme_admin_roles, admin_module_readme_admin_audit_log, admin_module_readme_permission_taxonomy [EXTRACTED 1.00]
- **Super-Admin-only financial-reversal permissions** — admin_module_readme_super_admin_only_set, adas_hesu_contributions_process_payout, agent_commission_pay_batch, equipment_booking_settle_deposit, marketplace_orders_refund [EXTRACTED 1.00]
- **Admin Configuration Single-Source-of-Truth split** — settings_settings_collection, membership_tiers_membershiptiers_collection, savings_plans_savingsplan, settings_platform_fees_ssot [EXTRACTED 0.85]
- **Dual-plane (user/admin) auth session storage** — data_structure_dual_session_hybrid, authentication_refreshtoken_collection, data_structure_adminusers_collection, data_structure_zustand_stores [EXTRACTED 0.85]
- **Savings interest accrual flow** — savings_plans_interest_accrual_job, savings_plans_interestaccrualrun, savings_products_usersavings, savings_products_savingstransaction [EXTRACTED 0.85]

## Communities (48 total, 10 thin omitted)

### Community 0 - "Admin RBAC & Audit Services"
Cohesion: 0.06
Nodes (35): AdminAuditService, AuditEntry, isSuperAdminOnlyPermission(), MUST_CHANGE_PASSWORD_EXEMPT_PATHS, SUPER_ADMIN_ONLY_ACTIONS, SUPER_ADMIN_ONLY_PERMISSIONS, AdminPermissionsService, AdminSeederService (+27 more)

### Community 1 - "Backend Modules & Config Wiring"
Cohesion: 0.05
Nodes (21): AdminModule, AuthModule, User MongoDB Schema, createMongooseOptions(), MongooseConfigFactory, Roles(), CreateUserDto, UpdateProfileDto (+13 more)

### Community 2 - "Cooperative Feature Views"
Cohesion: 0.06
Nodes (55): AdasheViewProps, AgentDashboardViewProps, LEVEL_DETAILS, CooperativeSharesView(), CooperativeSharesViewProps, MembershipViewProps, CROP_TYPES, GOAL_CATEGORIES (+47 more)

### Community 3 - "Auth Controllers (User + Admin)"
Cohesion: 0.07
Nodes (13): AdminAuthController, AuthController, AuthResult, AuthService, GoogleProfile, RequestMeta, clearRefreshCookie(), RefreshCookieOptions (+5 more)

### Community 4 - "Admin Section Pages"
Cohesion: 0.09
Nodes (29): AdminHome(), AdminAdasheSection(), AdminAdminsSection(), AdminCommissionSection(), AdminCooperativeSection(), AdminEquipmentSection(), AdminMarketplaceSection(), AdminMembershipTiersSection() (+21 more)

### Community 5 - "Backend Dev Dependencies"
Cohesion: 0.05
Nodes (40): devDependencies, eslint, eslint-config-prettier, eslint-plugin-prettier, jest, @nestjs/cli, @nestjs/testing, prettier (+32 more)

### Community 6 - "Admin Module PRDs & RBAC"
Cohesion: 0.07
Nodes (40): Adashe/Esusu Contribution Groups Admin PRD, Admin Dashboard PRD, Per-domain 'available' readiness flags, GET /api/v1/admin/dashboard/overview, admin-dev Subagent (Admin Frontend Developer), Admin Layout / Shell PRD, Permission-aware Navigation (effectivePermissions), AdminProtectedRoute + AdminLayout shell (+32 more)

### Community 7 - "Admin Dashboard UI"
Cohesion: 0.08
Nodes (27): AdminDashboard(), fmtNum(), Kpi, LoadState, MODULE_META, SignupsChart(), adminAuthService, Envelope (+19 more)

### Community 8 - "Frontend Dependencies"
Cohesion: 0.06
Nodes (30): dependencies, axios, @google/genai, lucide-react, motion, react, react-dom, @react-oauth/google (+22 more)

### Community 9 - "TypeScript Config"
Cohesion: 0.07
Nodes (27): compilerOptions, allowSyntheticDefaultImports, baseUrl, declaration, emitDecoratorMetadata, experimentalDecorators, forceConsistentCasingInFileNames, incremental (+19 more)

### Community 10 - "Landing Hero & Auth Service"
Cohesion: 0.11
Nodes (15): HeroSection(), TRUST, LandingNav(), NAV_LINKS, Envelope, LoginPayload, RegisterPayload, SimpleResult (+7 more)

### Community 11 - "Landing Page Sections"
Cohesion: 0.11
Nodes (11): LandingPage(), FEATURES, HowItWorksSection(), STEPS, COLUMNS, Reveal(), RevealProps, STATS (+3 more)

### Community 12 - "Backend Runtime Dependencies"
Cohesion: 0.08
Nodes (24): dependencies, axios, bcrypt, class-transformer, class-validator, cookie-parser, google-auth-library, helmet (+16 more)

### Community 13 - "Backend Module Architecture PRD"
Cohesion: 0.10
Nodes (24): Agent Dashboard Module (PRD 10), AppModule (Root Module), AuthController, Authentication API Endpoints, Auth Module (PRD 1 Authentication), AuthService, Cooperative Farming Portal NestJS Backend, Application Configuration (+16 more)

### Community 14 - "Mail / OneSignal Service"
Cohesion: 0.15
Nodes (10): MailService, MailUser, SendEmailParams, baseLayout(), BRAND, ctaButton(), passwordChangedTemplate(), passwordResetTemplate() (+2 more)

### Community 15 - "Auth Pages & Guards"
Cohesion: 0.18
Nodes (10): LoginPage(), SignupPage(), useAuth(), ProtectedRoute(), AuthGate(), GoogleAuthButton(), Input, SpinnerProps (+2 more)

### Community 16 - "Password Reset & Strength UI"
Cohesion: 0.15
Nodes (9): ResetPasswordPage(), authService, InputProps, isPasswordValid(), LEVELS, PasswordChecks, PasswordStrengthProps, RULE_LABELS (+1 more)

### Community 17 - "Admin Auth Shell & Guards"
Cohesion: 0.23
Nodes (9): OPS_PROPS, AdminChangePasswordPage(), AdminLoginPage(), LocationState, PermissionGate(), useAdminAuth(), AdminProtectedRoute(), useAdminAuthStore (+1 more)

### Community 18 - "Super-Admin Financial Permissions"
Cohesion: 0.15
Nodes (15): payoutRun ledger + rotation logic, adashe-contributions:process-payout (Super-Admin-only), Adopted domain schema extensions, Permission Taxonomy (resource:action), Super-Admin-only permission set (non-delegable), Permission Catalog endpoint, Self-escalation & last-Super-Admin guards, commissionRateConfig (tiered schedule) (+7 more)

### Community 19 - "Admin Layout & Navigation"
Cohesion: 0.24
Nodes (9): AdminLayout(), ADMIN_BOTTOM_NAV_ROUTES, ADMIN_NAV, ADMIN_ROUTE_TITLES, AdminNavItem, NavGroup, AdminSidebarNav(), GROUP_ORDER (+1 more)

### Community 20 - "Backend NPM Scripts"
Cohesion: 0.15
Nodes (13): scripts, build, format, lint, start, start:debug, start:dev, start:prod (+5 more)

### Community 21 - "Savings Plans & Interest"
Cohesion: 0.24
Nodes (10): COOP_RATES (rates index), Tier Privileges (feature-gating flags), savings-plans:configure (Super-Admin-only), Interest Accrual Batch Job, interestAccrualRun (job history), Admin Savings Plans & Interest PRD, SavingsPlan (product catalog), PRD 04: Savings Products (+2 more)

### Community 22 - "Settings SSOT & Fees"
Cohesion: 0.22
Nodes (10): Backend configuration object, PRD 08: E-commerce Marketplace, Order Collection, Product Collection, settings:configure (sensitive groups), platformFees SSOT (settings owns fees), Secret encryption at rest (masked on read), settings Collection (grouped DB config) (+2 more)

### Community 23 - "Jest Test Config"
Cohesion: 0.22
Nodes (9): jest, collectCoverageFrom, coverageDirectory, moduleFileExtensions, rootDir, testEnvironment, testRegex, transform (+1 more)

### Community 24 - "Auth Tokens & Email Integration"
Cohesion: 0.29
Nodes (8): Account Lockout & Token Management, PRD 01: Authentication & User Management, Google Sign-In (ID-token flow), Password Reset (Option A hashed token), RefreshToken Collection, Dual-session hybrid token storage, MailService / MailModule, OneSignal Email Integration PRD

### Community 25 - "Nest CLI Config"
Cohesion: 0.25
Nodes (7): collection, compilerOptions, deleteOutDir, tsConfigPath, webpack, $schema, sourceRoot

### Community 26 - "Section Placeholder & Badge UI"
Cohesion: 0.29
Nodes (4): Badge(), BadgeProps, Tone, TONES

### Community 27 - "Frontend Package Metadata"
Cohesion: 0.29
Nodes (6): author, description, license, name, private, version

### Community 28 - "Shares, Dividends & Membership PRD"
Cohesion: 0.38
Nodes (7): PRD 05: Cooperative Shares & Dividends, DividendDeclaration Collection, Share Collection, Cooperative Collection, Membership Collection, PRD 03: Membership Management, Tier vs Membership.type — two axes

### Community 29 - "Dashboard & Data-Structure PRD"
Cohesion: 0.33
Nodes (7): PRD: User Dashboard (Home), Data Structures Reference, Frontend/backend divergences, FarmerAppState (frontend localStorage), zustand stores (useAuthStore/useAppStore), Public Landing Page PRD, Placeholder Register (must-fix before launch)

### Community 30 - "User Management & KYC PRD"
Cohesion: 0.33
Nodes (7): adminUsers Collection (admin identity plane), users Collection (backend schema), isBanned / soft-delete (adopted design), Admin Impersonation (support token), User KYC sub-document (adopted), User 360 (cross-module aggregate), Admin Platform-User Management PRD

### Community 31 - "Membership Tiers & Compliance"
Cohesion: 0.29
Nodes (7): TiersSection (reads MEMBERSHIP_TIERS), Configuration SSOT (tiers own pricing+privileges), Admin Membership Tiers PRD, membershipTiers Collection, NDPA / GAID / PCI-DSS Compliance, settingChangeLog (per-key history), Admin Global System Settings PRD

### Community 32 - "Bennie Connect Brand Identity"
Cohesion: 0.38
Nodes (7): Agriculture / Farming Brand Theme, Bennie Connect Platform (Farmer Cooperative Portal), Bennie Connect Logo (Cooperative Portal Brand Identity), Green Color Palette (dark green background, white text), Sprout / Seedling Leaf Icon, Tagline: COOPERATIVE PORTAL, Bennie Connect Wordmark

### Community 33 - "Wallet & Contribution Collections"
Cohesion: 0.47
Nodes (6): PRD 09: Adashe/Esusu Contribution Groups, ContributionGroup Collection, GroupMember Collection, PRD 02: Digital Wallet with SeerBit, Transaction Collection (wallet ledger), Wallet Collection

### Community 34 - "Equipment & Services Booking"
Cohesion: 0.47
Nodes (6): PRD 07: Agricultural Services Marketplace, ServiceBooking (escrow flow), ServiceProvider Collection, Equipment Collection, PRD 06: Equipment Booking with GPS, EquipmentBooking Collection (GPS tracking)

### Community 35 - "Button UI Component"
Cohesion: 0.33
Nodes (5): ButtonProps, Size, SIZES, Variant, VARIANTS

### Community 36 - "Agent Commission Collections"
Cohesion: 0.83
Nodes (4): PRD 10: Agent Dashboard & Commission, AgentProfile Collection, CommissionPayment Collection, Referral Collection

## Knowledge Gaps
- **262 isolated node(s):** `$schema`, `collection`, `sourceRoot`, `deleteOutDir`, `webpack` (+257 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `AdminDashboard()` connect `Admin Dashboard UI` to `Admin RBAC & Audit Services`, `Admin Auth Shell & Guards`?**
  _High betweenness centrality (0.213) - this node is a cross-community bridge._
- **Why does `hasPermission()` connect `Admin RBAC & Audit Services` to `Admin Dashboard UI`?**
  _High betweenness centrality (0.213) - this node is a cross-community bridge._
- **Why does `UsersService` connect `Backend Modules & Config Wiring` to `Admin RBAC & Audit Services`, `Auth Controllers (User + Admin)`, `Backend Module Architecture PRD`?**
  _High betweenness centrality (0.072) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `UsersService` (e.g. with `Users Module (PRD 1)` and `UsersService`) actually correct?**
  _`UsersService` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `$schema`, `collection`, `sourceRoot` to the rest of the system?**
  _274 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Admin RBAC & Audit Services` be split into smaller, more focused modules?**
  _Cohesion score 0.05554035567715458 - nodes in this community are weakly interconnected._
- **Should `Backend Modules & Config Wiring` be split into smaller, more focused modules?**
  _Cohesion score 0.05063291139240506 - nodes in this community are weakly interconnected._