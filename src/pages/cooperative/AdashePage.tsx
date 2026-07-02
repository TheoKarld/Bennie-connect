/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { useNavigate } from "react-router-dom";

import AdasheView from "./AdasheView";
import { useAppState } from "../../hooks/useAppState";
import { tabToPath } from "../users/DashboardPage";

export default function AdashePage() {
  const navigate = useNavigate();
  const store = useAppState();

  return (
    <AdasheView
      state={store}
      onNavigate={(tab) => navigate(tabToPath(tab))}
      onJoinGroup={store.handleJoinContributionCircle}
      onPayContribution={store.handlePayAdasheContribution}
      onClaimPayout={store.handleClaimAdashePayout}
      onSendMessage={store.handleSendAdasheMessage}
      onVoteProposal={store.handleVoteOnAdasheProposal}
      onCreateProposal={store.handleCreateAdasheProposal}
      onCheckInAttendance={store.handleAdasheAttendanceCheckIn}
      onCreateAdasheGroup={store.handleCreateAdasheGroup}
    />
  );
}
