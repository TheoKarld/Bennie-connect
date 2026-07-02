/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useAdminAuthStore } from "../store/adminAuthStore";

/** Thin selector hook over the admin auth store. */
export function useAdminAuth() {
  return useAdminAuthStore();
}

export default useAdminAuth;
