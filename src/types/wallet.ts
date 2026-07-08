/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Server-authoritative wallet types (mirrors PRD 02 "As-Built (v2)" + the REST
 * contract). These describe the LIVE backend shapes returned under the
 * `{ success, data }` envelope by /api/v1/wallet* — distinct from the legacy
 * mock `WalletTransaction` / `walletBalance` in `src/types.ts`.
 */

// --- Enums (server) ----------------------------------------------------------

export type WalletTxKind = "CREDIT" | "DEBIT";

export type WalletTxCategory =
  | "DEPOSIT"
  | "WITHDRAWAL"
  | "TRANSFER_IN"
  | "TRANSFER_OUT"
  | "PAYMENT"
  | "REFUND"
  | "FEE"
  | "INTEREST"
  | "DIVIDEND"
  | "SAVINGS_LOCK"
  | "SAVINGS_UNLOCK"
  | "CONTRIBUTION"
  | "COMMISSION";

export type WalletTxStatus =
  | "PENDING"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  | "REVERSED";

export type WalletStatus = "ACTIVE" | "SUSPENDED" | "CLOSED";
export type WalletKycStatus = "PENDING" | "VERIFIED" | "REJECTED";

export type WithdrawalStatus =
  | "PENDING"
  | "APPROVED"
  | "PROCESSING"
  | "COMPLETED"
  | "REJECTED"
  | "FAILED";

// --- Wallet balance view (GET /wallet) ---------------------------------------

export interface WalletBalance {
  available: number;
  pending: number;
  locked: number;
}

export interface WalletDailyLimit {
  used: number;
  remaining: number;
  total: number;
}

export interface WalletView {
  walletNumber: string;
  balance: WalletBalance;
  currency: string; // "NGN"
  status: WalletStatus;
  kycStatus: WalletKycStatus;
  dailyLimit?: WalletDailyLimit;
}

// --- Transaction (GET /wallet/transactions[/:id]) ----------------------------

export interface WalletTxCounterparty {
  walletId?: string;
  userId?: string;
  name?: string;
  accountNumber?: string;
  bankName?: string;
}

export interface ServerTransaction {
  _id: string;
  type: WalletTxKind;
  category: WalletTxCategory;
  amount: number;
  balanceBefore?: number;
  balanceAfter?: number;
  status: WalletTxStatus;
  reference: string;
  externalReference?: string;
  description: string;
  narration?: string;
  counterparty?: WalletTxCounterparty;
  createdAt: string;
  updatedAt?: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

// --- Deposit -----------------------------------------------------------------

export interface DepositInitiateResult {
  reference: string;
  amount: number;
  currency: string;
  email: string;
  fullName?: string;
  publicKey?: string;
}

export interface DepositVerifyResult {
  alreadyCredited: boolean;
  wallet: WalletView;
  transaction?: ServerTransaction;
}

// --- Banks / resolve ---------------------------------------------------------

export interface Bank {
  name: string;
  code: string;
}

export interface BankResolveResult {
  accountNumber: string;
  accountName: string; // "" this phase (no live name-enquiry)
  bankName: string;
  bankCode: string;
  verified?: boolean;
}

// --- Internal transfer -------------------------------------------------------

export interface TransferResolveResult {
  name: string;
  email?: string;
}

export interface TransferInternalResult {
  wallet: WalletView;
  reference: string;
  recipient: string;
  amount: number;
}

// --- Withdrawal --------------------------------------------------------------

export interface WithdrawResult {
  reference: string;
  amount: number;
  fee: number;
  totalAmount: number;
  status: "APPROVED" | "PENDING";
  bankName: string;
  livePayoutsExecuted?: boolean;
  note?: string;
  wallet: WalletView;
}

export interface WithdrawalRecord {
  _id: string;
  reference: string;
  amount: number;
  fee: number;
  totalAmount: number;
  status: WithdrawalStatus;
  narration?: string;
  bankName?: string;
  accountNumber?: string;
  createdAt: string;
  approvedAt?: string;
  processedAt?: string;
}

// --- Transaction list filters (mapped to query params) -----------------------

export interface TxFilters {
  page?: number;
  limit?: number;
  type?: WalletTxKind;
  category?: WalletTxCategory;
  status?: WalletTxStatus;
  startDate?: string;
  endDate?: string;
}
