/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useAppStore } from "../store/appStore";

/**
 * Thin selector hook over the application store. Returns the whole store
 * (FarmerAppState + every handler action), matching how the old App.tsx passed
 * `state` and its handlers down to the presentational views.
 */
export function useAppState() {
  return useAppStore();
}

export default useAppState;
