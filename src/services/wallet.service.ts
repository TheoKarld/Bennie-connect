/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Thin wrappers over the LIVE wallet REST surface (base /api/v1/wallet).
 *
 * All endpoints require the user JWT (attached by `src/lib/api.ts`) and return
 * the `{ success, data }` envelope. Each helper unwraps `.data`. Errors bubble
 * up as axios errors so the store can surface `WALLET_*` codes/messages from
 * `{ success:false, error:{ code, message, details } }`.
 */

import api from "../lib/api";
import type {
  Bank,
  BankResolveResult,
  DepositInitiateResult,
  DepositVerifyResult,
  Paginated,
  ServerTransaction,
  TransferInternalResult,
  TransferResolveResult,
  TxFilters,
  WalletView,
  WithdrawalRecord,
  WithdrawResult,
} from "../types/wallet";

/** Unwrap `{ success, data }`; tolerate a bare payload defensively. */
function unwrap<T>(payload: unknown): T {
  const body = payload as { data?: T } | T;
  if (body && typeof body === "object" && "data" in (body as object)) {
    return (body as { data: T }).data;
  }
  return body as T;
}

export const walletService = {
  async getWallet(): Promise<WalletView> {
    const res = await api.get("/wallet");
    return unwrap<WalletView>(res.data);
  },

  async getTransactions(
    filters: TxFilters = {}
  ): Promise<Paginated<ServerTransaction>> {
    const params: Record<string, string | number> = {};
    if (filters.page) params.page = filters.page;
    if (filters.limit) params.limit = filters.limit;
    if (filters.type) params.type = filters.type;
    if (filters.category) params.category = filters.category;
    if (filters.status) params.status = filters.status;
    if (filters.startDate) params.startDate = filters.startDate;
    if (filters.endDate) params.endDate = filters.endDate;

    const res = await api.get("/wallet/transactions", { params });
    return unwrap<Paginated<ServerTransaction>>(res.data);
  },

  async getTransaction(id: string): Promise<ServerTransaction> {
    const res = await api.get(`/wallet/transactions/${id}`);
    return unwrap<ServerTransaction>(res.data);
  },

  async initiateDeposit(
    amount: number,
    method?: string
  ): Promise<DepositInitiateResult> {
    const res = await api.post("/wallet/deposit/initiate", { amount, method });
    return unwrap<DepositInitiateResult>(res.data);
  },

  async verifyDeposit(reference: string): Promise<DepositVerifyResult> {
    const res = await api.post("/wallet/deposit/verify", { reference });
    return unwrap<DepositVerifyResult>(res.data);
  },

  async getBanks(): Promise<Bank[]> {
    const res = await api.get("/wallet/banks");
    const data = unwrap<Bank[] | { banks?: Bank[] }>(res.data);
    if (Array.isArray(data)) return data;
    return data?.banks ?? [];
  },

  async resolveBank(
    accountNumber: string,
    bankCode: string
  ): Promise<BankResolveResult> {
    const res = await api.get("/wallet/banks/resolve", {
      params: { accountNumber, bankCode },
    });
    return unwrap<BankResolveResult>(res.data);
  },

  async resolveRecipient(email: string): Promise<TransferResolveResult> {
    const res = await api.get("/wallet/transfer/resolve", {
      params: { email },
    });
    return unwrap<TransferResolveResult>(res.data);
  },

  async transferInternal(payload: {
    recipientEmail: string;
    amount: number;
    narration?: string;
  }): Promise<TransferInternalResult> {
    const res = await api.post("/wallet/transfer/internal", payload);
    return unwrap<TransferInternalResult>(res.data);
  },

  async withdraw(payload: {
    amount: number;
    bankCode: string;
    accountNumber: string;
    accountName?: string;
    narration?: string;
  }): Promise<WithdrawResult> {
    const res = await api.post("/wallet/withdraw", payload);
    return unwrap<WithdrawResult>(res.data);
  },

  async getWithdrawals(
    filters: { page?: number; limit?: number; status?: string } = {}
  ): Promise<Paginated<WithdrawalRecord>> {
    const res = await api.get("/wallet/withdrawals", { params: filters });
    return unwrap<Paginated<WithdrawalRecord>>(res.data);
  },
};

export default walletService;
