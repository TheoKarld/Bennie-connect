/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";

import DigitalWalletView from "./DigitalWalletView";

/**
 * The wallet feature is fully LIVE against the backend. The view reads/writes
 * `useWalletStore` directly, so this page is just a mount point (no mock props).
 */
export default function DigitalWalletPage() {
  return <DigitalWalletView />;
}
