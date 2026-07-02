/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";

import SavingsProductsView from "./SavingsProductsView";
import { useAppState } from "../../hooks/useAppState";

export default function SavingsProductsPage() {
  const store = useAppState();

  return (
    <SavingsProductsView
      state={store}
      onFlexDeposit={store.handleFlexDeposit}
      onFlexWithdraw={store.handleFlexWithdraw}
      onAddTargetGoal={store.handleAddTargetGoal}
      onAddFundsToTarget={store.handleAddFundsToTarget}
      onWithdrawTargetGoal={store.handleWithdrawTargetGoal}
      onAddFixedLock={store.handleAddFixedLock}
      onWithdrawFixedLock={store.handleWithdrawFixedLock}
      onAddHarvestPlan={store.handleAddHarvestPlan}
    />
  );
}
