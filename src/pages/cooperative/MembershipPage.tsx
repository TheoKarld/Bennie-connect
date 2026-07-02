/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";

import MembershipView from "./MembershipView";
import { useAppState } from "../../hooks/useAppState";

export default function MembershipPage() {
  const store = useAppState();

  return (
    <MembershipView
      state={store}
      onUpgradeTier={store.handleUpgradeTier}
      onRenewSubscription={store.handleRenewSubscription}
    />
  );
}
