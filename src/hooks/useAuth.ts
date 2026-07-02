/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useAuthStore } from "../store/authStore";

/** Thin selector hook over the auth store. */
export function useAuth() {
  return useAuthStore();
}

export default useAuth;
