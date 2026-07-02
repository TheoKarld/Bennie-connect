/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";

import CooperativeSharesView from "./CooperativeSharesView";
import { useAppState } from "../../hooks/useAppState";

export default function CooperativeSharesPage() {
  const store = useAppState();

  return (
    <CooperativeSharesView
      state={store}
      onBuyShares={store.handleBuyShares}
      onSellShares={store.handleSellShares}
      onClaimDividends={store.handleClaimDividends}
    />
  );
}
