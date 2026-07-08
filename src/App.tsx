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
import EquipmentListPage from "./pages/users/equipment/EquipmentListPage";
import MyBookingsPage from "./pages/users/equipment/MyBookingsPage";
import BookingTrackingPage from "./pages/users/equipment/BookingTrackingPage";
import AgriculturalServicesPage from "./pages/users/AgriculturalServicesPage";
import MarketplaceLayout from "./pages/users/marketplace/MarketplaceLayout";
import MarketplacePage from "./pages/users/marketplace/MarketplacePage";
import ProductDetailPage from "./pages/users/marketplace/ProductDetailPage";
import CheckoutPage from "./pages/users/marketplace/CheckoutPage";
import MyOrdersPage from "./pages/users/marketplace/MyOrdersPage";
import OrderDetailPage from "./pages/users/marketplace/OrderDetailPage";
import MerchantHubPage from "./pages/users/merchant/MerchantHubPage";

import MembershipPage from "./pages/cooperative/MembershipPage";
import CooperativeSharesPage from "./pages/cooperative/CooperativeSharesPage";
import AdasheListPage from "./pages/cooperative/adashe/AdasheListPage";
import AdasheWorkspacePage from "./pages/cooperative/adashe/AdasheWorkspacePage";
import AgentDashboardPage from "./pages/cooperative/AgentDashboardPage";

import AdminHome from "./pages/admin/AdminHome";

// --- Admin console (/bennie/*) ------------------------------------------------
import AdminProtectedRoute from "./routes/AdminProtectedRoute";
import AdminLayout from "./components/admin/AdminLayout";
import AdminLoginPage from "./pages/admin/AdminLoginPage";
import AdminChangePasswordPage from "./pages/admin/AdminChangePasswordPage";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminAdasheGroupsPage from "./pages/admin/adashe/AdminAdasheGroupsPage";
import AdminAdasheGroupDetailPage from "./pages/admin/adashe/AdminAdasheGroupDetailPage";
import AdminEquipmentPage from "./pages/admin/equipment/AdminEquipmentPage";
import AdminEquipmentDetailPage from "./pages/admin/equipment/AdminEquipmentDetailPage";
import AdminMarketplacePage from "./pages/admin/marketplace/AdminMarketplacePage";
import AdminProductDetailPage from "./pages/admin/marketplace/AdminProductDetailPage";
import AdminOrdersPage from "./pages/admin/orders/AdminOrdersPage";
import AdminOrderDetailPage from "./pages/admin/orders/AdminOrderDetailPage";
import AdminMerchantsPage from "./pages/admin/merchants/AdminMerchantsPage";
import AdminMerchantDetailPage from "./pages/admin/merchants/AdminMerchantDetailPage";
import {
  AdminUsersSection,
  AdminAdminsSection,
  AdminCooperativeSection,
  AdminSavingsSection,
  AdminMembershipTiersSection,
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
          <Route path="equipment" element={<EquipmentListPage />} />
          <Route
            path="equipment/bookings"
            element={<MyBookingsPage />}
          />
          <Route
            path="equipment/bookings/:id/track"
            element={<BookingTrackingPage />}
          />
          <Route path="services" element={<AgriculturalServicesPage />} />
          <Route path="marketplace" element={<MarketplaceLayout />}>
            <Route index element={<MarketplacePage />} />
            <Route path="products/:id" element={<ProductDetailPage />} />
            <Route path="checkout" element={<CheckoutPage />} />
            <Route path="orders" element={<MyOrdersPage />} />
            <Route path="orders/:id" element={<OrderDetailPage />} />
          </Route>
          <Route path="merchant" element={<MerchantHubPage />} />
          <Route path="membership" element={<MembershipPage />} />
          <Route path="shares" element={<CooperativeSharesPage />} />
          <Route path="adashe" element={<AdasheListPage />} />
          <Route path="adashe/:groupId" element={<AdasheWorkspacePage />} />
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
          <Route path="market-place" element={<AdminMarketplacePage />} />
          <Route
            path="market-place/products/:id"
            element={<AdminProductDetailPage />}
          />
          <Route path="orders" element={<AdminOrdersPage />} />
          <Route path="orders/:id" element={<AdminOrderDetailPage />} />
          <Route path="merchants" element={<AdminMerchantsPage />} />
          <Route path="merchants/:id" element={<AdminMerchantDetailPage />} />
          <Route
            path="membership-tiers"
            element={<AdminMembershipTiersSection />}
          />
          <Route
            path="equipment-booking"
            element={<AdminEquipmentPage />}
          />
          <Route
            path="equipment-booking/:id"
            element={<AdminEquipmentDetailPage />}
          />
          <Route
            path="adashesu-contributions"
            element={<AdminAdasheGroupsPage />}
          />
          <Route
            path="adashesu-contributions/:groupId"
            element={<AdminAdasheGroupDetailPage />}
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
