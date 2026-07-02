/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";

import DigitalWalletView from "./DigitalWalletView";
import { useAppState } from "../../hooks/useAppState";

export default function DigitalWalletPage() {
  const store = useAppState();

  return (
    <DigitalWalletView
      state={store}
      onDeposit={store.handleDeposit}
      onWithdraw={store.handleWithdrawToBank}
      onTransfer={store.handleTransferToMember}
    />
  );
}
