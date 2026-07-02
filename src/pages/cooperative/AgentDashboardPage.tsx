/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";

import AgentDashboardView from "./AgentDashboardView";
import { useAppState } from "../../hooks/useAppState";

export default function AgentDashboardPage() {
  const store = useAppState();

  return (
    <AgentDashboardView
      state={store}
      onRegisterFarmer={store.handleRegisterFarmer}
      onVerifyFarmerKYC={store.handleVerifyFarmerKYC}
      onSimulateActivity={store.handleSimulateAgentActivity}
      onPromoteAgent={store.handlePromoteAgent}
    />
  );
}
