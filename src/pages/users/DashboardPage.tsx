/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { useNavigate } from "react-router-dom";

import DashboardView from "./DashboardView";
import { useAppState } from "../../hooks/useAppState";

/** Maps an old activeTab value to its /app/* route. */
const TAB_PATHS: Record<string, string> = {
  dashboard: "/app",
  wallet: "/app/wallet",
  savings: "/app/savings",
  adashe: "/app/adashe",
  equipment: "/app/equipment",
  services: "/app/services",
  marketplace: "/app/marketplace",
  shares: "/app/shares",
  membership: "/app/membership",
  agentsystem: "/app/agent",
};

export function tabToPath(tab: string): string {
  return TAB_PATHS[tab] || "/app";
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const store = useAppState();

  return (
    <DashboardView
      state={store}
      onNavigate={(tab) => navigate(tabToPath(tab))}
      onJoinGroup={store.handleJoinContributionCircle}
      onCancelBooking={store.handleCancelBooking}
      onReadNotification={store.handleReadNotification}
      onClearNotifications={store.handleClearNotifications}
    />
  );
}
