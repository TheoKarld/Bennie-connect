/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";

import AgriculturalServicesView from "./AgriculturalServicesView";
import { useAppState } from "../../hooks/useAppState";

export default function AgriculturalServicesPage() {
  const store = useAppState();

  return (
    <AgriculturalServicesView
      state={store}
      onBookService={store.handleBookService}
      onPayBooking={store.handlePayBooking}
      onReviewBooking={store.handleReviewBooking}
      onCancelBooking={store.handleCancelServiceBooking}
      onSimulateStatus={store.handleSimulateStatus}
    />
  );
}
