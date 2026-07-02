/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import { useAuth } from "./hooks/useAuth";

import LandingPage from "./pages/landing/LandingPage";
import AuthLayout from "./components/layout/AuthLayout";
import LoginPage from "./pages/auth/LoginPage";
import SignupPage from "./pages/auth/SignupPage";
import ForgotPasswordPage from "./pages/auth/ForgotPasswordPage";
import ResetPasswordPage from "./pages/auth/ResetPasswordPage";

import ProtectedRoute from "./routes/ProtectedRoute";
import AppShell from "./components/layout/AppShell";

import DashboardPage from "./pages/users/DashboardPage";
import DigitalWalletPage from "./pages/users/DigitalWalletPage";
import SavingsProductsPage from "./pages/users/SavingsProductsPage";
import EquipmentBookingPage from "./pages/users/EquipmentBookingPage";
import AgriculturalServicesPage from "./pages/users/AgriculturalServicesPage";
import AgriculturalMarketplacePage from "./pages/users/AgriculturalMarketplacePage";

import MembershipPage from "./pages/cooperative/MembershipPage";
import CooperativeSharesPage from "./pages/cooperative/CooperativeSharesPage";
import AdashePage from "./pages/cooperative/AdashePage";
import AgentDashboardPage from "./pages/cooperative/AgentDashboardPage";

import AdminHome from "./pages/admin/AdminHome";

// --- Admin console (/bennie/*) ------------------------------------------------
import AdminProtectedRoute from "./routes/AdminProtectedRoute";
import AdminLayout from "./components/admin/AdminLayout";
import AdminLoginPage from "./pages/admin/AdminLoginPage";
import AdminChangePasswordPage from "./pages/admin/AdminChangePasswordPage";
import AdminDashboard from "./pages/admin/AdminDashboard";
import {
  AdminUsersSection,
  AdminAdminsSection,
  AdminCooperativeSection,
  AdminSavingsSection,
  AdminMarketplaceSection,
  AdminMembershipTiersSection,
  AdminEquipmentSection,
  AdminAdasheSection,
  AdminCommissionSection,
  AdminSettingsSection,
} from "./pages/admin/sections";

/** Redirects already-authenticated users away from the auth pages. */
function AuthGate() {
  const { status } = useAuth();
  if (status === "authenticated") {
    return <Navigate to="/app" replace />;
  }
  return <AuthLayout />;
}

export default function App() {
  return (
    <Routes>
      {/* Public landing */}
      <Route path="/" element={<LandingPage />} />

      {/* Auth pages (redirect to /app when already signed in) */}
      <Route element={<AuthGate />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
      </Route>

      {/* Authenticated app */}
      <Route element={<ProtectedRoute />}>
        <Route path="/app" element={<AppShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="wallet" element={<DigitalWalletPage />} />
          <Route path="savings" element={<SavingsProductsPage />} />
          <Route path="equipment" element={<EquipmentBookingPage />} />
          <Route path="services" element={<AgriculturalServicesPage />} />
          <Route path="marketplace" element={<AgriculturalMarketplacePage />} />
          <Route path="membership" element={<MembershipPage />} />
          <Route path="shares" element={<CooperativeSharesPage />} />
          <Route path="adashe" element={<AdashePage />} />
          <Route path="agent" element={<AgentDashboardPage />} />
          <Route path="admin" element={<AdminHome />} />
        </Route>
      </Route>

      {/* ── Admin console (/bennie/*) — independent admin session ── */}
      <Route path="/bennie/auth" element={<AdminLoginPage />} />
      <Route
        path="/bennie/change-password"
        element={<AdminChangePasswordPage />}
      />
      <Route element={<AdminProtectedRoute />}>
        <Route path="/bennie" element={<AdminLayout />}>
          <Route index element={<Navigate to="/bennie/dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="users" element={<AdminUsersSection />} />
          <Route path="admin" element={<AdminAdminsSection />} />
          <Route path="cooperative" element={<AdminCooperativeSection />} />
          <Route path="savings-plans" element={<AdminSavingsSection />} />
          <Route path="market-place" element={<AdminMarketplaceSection />} />
          <Route
            path="membership-tiers"
            element={<AdminMembershipTiersSection />}
          />
          <Route
            path="equipment-booking"
            element={<AdminEquipmentSection />}
          />
          <Route
            path="adashesu-contributions"
            element={<AdminAdasheSection />}
          />
          <Route
            path="agent-commission"
            element={<AdminCommissionSection />}
          />
          <Route path="settings" element={<AdminSettingsSection />} />
          <Route
            path="*"
            element={<Navigate to="/bennie/dashboard" replace />}
          />
        </Route>
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
