/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Admin-plane types. Fully independent of the user plane (`src/types.ts`).
 * These mirror the admin API contract documented in
 * `PRD/admin_module/auth/admin_auth.md`, `admin_layout.md`, `admin_dashboard.md`.
 */

export type AdminAuthStatus =
  | "idle"
  | "loading"
  | "authenticated"
  | "unauthenticated";

/** Role summary as returned inline on the admin identity payloads. */
export interface AdminRoleSummary {
  name: string;
  isSystem?: boolean;
  permissions?: string[];
}

/**
 * The signed-in admin. Note the two identity payload shapes:
 * - `/auth/login` returns `role.permissions`
 * - `/auth/me` returns `effectivePermissions` (resolved server-side)
 * We normalise both into `effectivePermissions` in the store.
 */
export interface AdminUser {
  adminId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: AdminRoleSummary;
  effectivePermissions?: string[];
  mustChangePassword: boolean;
  twoFactorEnabled?: boolean;
  phoneNumber?: string;
}

/** Envelope payload from POST /auth/login. */
export interface AdminLoginResponseData {
  admin: AdminUser;
  accessToken: string;
  expiresIn: number;
}

/** Envelope payload from GET /auth/me. */
export interface AdminMeResponseData {
  admin: AdminUser;
}

export interface AdminLoginPayload {
  email: string;
  password: string;
  twoFactorCode?: string;
}

export interface AdminChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

// --- Dashboard overview (GET /dashboard/overview) ---------------------------

export interface SignupTrendPoint {
  date: string;
  count: number;
}

export interface DashboardUsersBlock {
  available: boolean;
  total?: number;
  active?: number;
  suspended?: number;
  banned?: number;
  emailVerified?: number;
  emailUnverified?: number;
  verified?: number;
  unverified?: number;
  newLast7d?: number;
  newLast30d?: number;
  signupTrend?: SignupTrendPoint[];
}

export interface DashboardRoleCount {
  role?: string;
  name?: string;
  count: number;
}

export interface DashboardAdminsBlock {
  available: boolean;
  total?: number;
  totalActive?: number;
  byRole?: DashboardRoleCount[];
  roles?: DashboardRoleCount[];
  recentActivity24h?: number;
  mustChangePassword?: number;
  lockedOut?: number;
}

/** Live Adashe/Esusu aggregates on the dashboard overview. */
export interface DashboardAdasheBlock {
  available: boolean;
  activeGroups?: number;
  totalGroups?: number;
  totalPoolBalance?: number;
  poolBalance?: number;
  payoutRequestsDue?: number;
  payoutsAwaitingConfirmation?: number;
  pendingSlotShiftRequests?: number;
  slotShiftsAwaiting?: number;
}

export interface DashboardActivityItem {
  actorEmail: string;
  action: string;
  resource: string;
  targetId?: string;
  createdAt: string;
  ipAddress?: string;
}

export interface DashboardModuleFlag {
  available: boolean;
  count?: number;
  link?: string;
}

export interface DashboardOverview {
  users?: DashboardUsersBlock;
  admins?: DashboardAdminsBlock;
  adashe?: DashboardAdasheBlock;
  recentActivity?: DashboardActivityItem[];
  pendingApprovals?: Record<string, DashboardModuleFlag>;
  modules?: Record<string, DashboardModuleFlag>;
  signupsTrend?: SignupTrendPoint[];
}
