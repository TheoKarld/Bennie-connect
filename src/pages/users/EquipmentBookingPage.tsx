/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { useNavigate } from "react-router-dom";

import EquipmentBookingView from "./EquipmentBookingView";
import { useAppState } from "../../hooks/useAppState";
import { tabToPath } from "./DashboardPage";

export default function EquipmentBookingPage() {
  const navigate = useNavigate();
  const store = useAppState();

  return (
    <EquipmentBookingView
      state={store}
      onNavigate={(tab) => navigate(tabToPath(tab))}
      onAddBooking={store.handleAddBooking}
      onUpdateBookingStatus={store.handleUpdateBookingStatus}
      onRateBooking={store.handleRateBooking}
    />
  );
}
