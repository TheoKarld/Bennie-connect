/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * LIVE digital-wallet store (zustand) — the source of truth for the Wallet page,
 * Dashboard summary, and top-nav balance. Talks to the backend via
 * `src/services/wallet.service.ts` (which uses the token-attaching `api`).
 *
 * This SUPERSEDES the mock `appStore.walletBalance` / `walletTransactions` +
 * `handleDeposit` / `handleWithdrawToBank` / `handleTransferToMember` for the
 * wallet feature. Legacy modules (savings/shares/adashe/marketplace) still run
 * on `appStore` and are not rewired here.
 *
 * Degrades gracefully: with no backend/wallet the store keeps `wallet: null`,
 * sets a friendly `error`, and the UI shows a loading/error state (no crash,
 * no console spew).
 */

import { create } from "zustand";
import type { AxiosError } from "axios";

import walletService from "../services/wallet.service";
import type {
  Bank,
  DepositInitiateResult,
  DepositVerifyResult,
  ServerTransaction,
  TransferInternalResult,
  TransferResolveResult,
  TxFilters,
  WalletView,
  WithdrawalRecord,
  WithdrawResult,
} from "../types/wallet";

// --- Error shaping -----------------------------------------------------------

interface WalletApiError {
  code?: string;
  message?: string;
  details?: Record<string, unknown>;
}

/** Pull a friendly message (and WALLET_* code) out of an axios/API error. */
export function extractWalletError(err: unknown, fallback: string): string {
  const ax = err as AxiosError<{
    error?: WalletApiError;
    message?: string | string[];
  }>;
  const payload = ax?.response?.data;
  const apiErr = payload?.error;
  if (apiErr?.message) {
    return apiErr.code ? `${apiErr.message}` : apiErr.message;
  }
  const msg = payload?.message;
  if (Array.isArray(msg)) return msg.join(", ");
  if (typeof msg === "string") return msg;
  if ((err as Error)?.message) return (err as Error).message;
  return fallback;
}

// --- State -------------------------------------------------------------------

type Status = "idle" | "loading" | "ready" | "error";

interface WalletState {
  wallet: WalletView | null;
  transactions: ServerTransaction[];
  txTotal: number;
  txPage: number;
  txLimit: number;
  banks: Bank[];
  withdrawals: WithdrawalRecord[];
  status: Status;
  loading: boolean;
  txLoading: boolean;
  error: string | null;
}

interface WalletActions {
  fetchWallet: (opts?: { silent?: boolean }) => Promise<void>;
  fetchTransactions: (filters?: TxFilters) => Promise<void>;
  initiateDeposit: (
    amount: number,
    method?: string
  ) => Promise<DepositInitiateResult>;
  verifyDeposit: (reference: string) => Promise<DepositVerifyResult>;
  fetchBanks: () => Promise<void>;
  resolveRecipient: (email: string) => Promise<TransferResolveResult>;
  transferInternal: (payload: {
    recipientEmail: string;
    amount: number;
    narration?: string;
  }) => Promise<TransferInternalResult>;
  withdraw: (payload: {
    amount: number;
    bankCode: string;
    accountNumber: string;
    accountName?: string;
    narration?: string;
  }) => Promise<WithdrawResult>;
  fetchWithdrawals: (filters?: {
    page?: number;
    limit?: number;
    status?: string;
  }) => Promise<void>;
  clearError: () => void;
  reset: () => void;
}

export type WalletStore = WalletState & WalletActions;

const INITIAL: WalletState = {
  wallet: null,
  transactions: [],
  txTotal: 0,
  txPage: 1,
  txLimit: 20,
  banks: [],
  withdrawals: [],
  status: "idle",
  loading: false,
  txLoading: false,
  error: null,
};

// --- Store -------------------------------------------------------------------

export const useWalletStore = create<WalletStore>()((set, get) => ({
  ...INITIAL,

  fetchWallet: async (opts) => {
    if (!opts?.silent) set({ loading: true });
    set({ error: null });
    try {
      const wallet = await walletService.getWallet();
      set({ wallet, status: "ready", loading: false });
    } catch (err) {
      set({
        loading: false,
        status: "error",
        error: extractWalletError(err, "Unable to load your wallet right now."),
      });
    }
  },

  fetchTransactions: async (filters = {}) => {
    set({ txLoading: true, error: null });
    try {
      const page = filters.page ?? get().txPage ?? 1;
      const limit = filters.limit ?? get().txLimit ?? 20;
      const res = await walletService.getTransactions({
        ...filters,
        page,
        limit,
      });
      set({
        transactions: res.items ?? [],
        txTotal: res.total ?? 0,
        txPage: res.page ?? page,
        txLimit: res.limit ?? limit,
        txLoading: false,
      });
    } catch (err) {
      set({
        txLoading: false,
        error: extractWalletError(
          err,
          "Unable to load your transactions right now."
        ),
      });
    }
  },

  initiateDeposit: async (amount, method) => {
    set({ error: null });
    try {
      return await walletService.initiateDeposit(amount, method);
    } catch (err) {
      const message = extractWalletError(err, "Could not start the deposit.");
      set({ error: message });
      throw new Error(message);
    }
  },

  verifyDeposit: async (reference) => {
    set({ error: null });
    try {
      const result = await walletService.verifyDeposit(reference);
      // Verify returns the fresh wallet — adopt it immediately.
      if (result?.wallet) set({ wallet: result.wallet, status: "ready" });
      return result;
    } catch (err) {
      const message = extractWalletError(
        err,
        "We could not confirm this deposit yet."
      );
      set({ error: message });
      throw new Error(message);
    }
  },

  fetchBanks: async () => {
    if (get().banks.length > 0) return;
    try {
      const banks = await walletService.getBanks();
      set({ banks });
    } catch {
      // Non-fatal: withdraw tab will show an empty dropdown + hint.
      set({ banks: [] });
    }
  },

  resolveRecipient: async (email) => {
    return walletService.resolveRecipient(email);
  },

  transferInternal: async (payload) => {
    set({ error: null });
    try {
      const result = await walletService.transferInternal(payload);
      if (result?.wallet) set({ wallet: result.wallet, status: "ready" });
      return result;
    } catch (err) {
      const message = extractWalletError(err, "Transfer failed.");
      set({ error: message });
      throw new Error(message);
    }
  },

  withdraw: async (payload) => {
    set({ error: null });
    try {
      const result = await walletService.withdraw(payload);
      if (result?.wallet) set({ wallet: result.wallet, status: "ready" });
      return result;
    } catch (err) {
      const message = extractWalletError(err, "Withdrawal request failed.");
      set({ error: message });
      throw new Error(message);
    }
  },

  fetchWithdrawals: async (filters = {}) => {
    try {
      const res = await walletService.getWithdrawals(filters);
      set({ withdrawals: res.items ?? [] });
    } catch {
      set({ withdrawals: [] });
    }
  },

  clearError: () => set({ error: null }),

  reset: () => set({ ...INITIAL }),
}));

export default useWalletStore;
