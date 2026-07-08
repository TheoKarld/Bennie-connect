/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from "react";
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  Send,
  Search,
  Download,
  CheckCircle,
  RefreshCw,
  Building,
  Users,
  AlertCircle,
  Lock,
  Clock,
  ShieldCheck,
  Info,
} from "lucide-react";

import { useWalletStore } from "../../store/walletStore";
import { useAuth } from "../../hooks/useAuth";
import { formatCurrency } from "../../lib/format";
import { openSeerbitPopup } from "../../lib/seerbit";
import { pushToast } from "../../components/ui";
import type {
  ServerTransaction,
  WalletTxCategory,
  WalletTxKind,
} from "../../types/wallet";

type WalletTab = "history" | "deposit" | "withdraw" | "transfer";
type DepositState = "idle" | "opening" | "verifying" | "pending" | "success";

const SEERBIT_PUBLIC_KEY =
  (import.meta.env.VITE_SEERBIT_PUBLIC_KEY as string | undefined) || "";

/** Category labels for the history filter (maps to server ?type/?category). */
const CATEGORY_LABELS: Record<WalletTxCategory, string> = {
  DEPOSIT: "Deposit",
  WITHDRAWAL: "Withdrawal",
  TRANSFER_IN: "Transfer In",
  TRANSFER_OUT: "Transfer Out",
  PAYMENT: "Payment",
  REFUND: "Refund",
  FEE: "Fee",
  INTEREST: "Interest",
  DIVIDEND: "Dividend",
  SAVINGS_LOCK: "Savings Lock",
  SAVINGS_UNLOCK: "Savings Unlock",
  CONTRIBUTION: "Contribution",
  COMMISSION: "Commission",
};

function txIcon(tx: ServerTransaction) {
  if (tx.type === "CREDIT")
    return <ArrowDownLeft className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
  return <ArrowUpRight className="w-4 h-4 text-rose-600 dark:text-rose-400" />;
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    COMPLETED: "bg-primary/10 text-primary border-primary/15",
    PENDING: "bg-accent/10 text-amber-700 dark:text-amber-300 border-accent/25",
    PROCESSING: "bg-accent/10 text-amber-700 dark:text-amber-300 border-accent/25",
    FAILED: "bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-500/20",
    REVERSED: "bg-surface-2 text-muted border-border",
  };
  return map[status] || "bg-surface-2 text-muted border-border";
}

export default function DigitalWalletView() {
  const { user } = useAuth();

  const wallet = useWalletStore((s) => s.wallet);
  const transactions = useWalletStore((s) => s.transactions);
  const txTotal = useWalletStore((s) => s.txTotal);
  const txPage = useWalletStore((s) => s.txPage);
  const txLimit = useWalletStore((s) => s.txLimit);
  const banks = useWalletStore((s) => s.banks);
  const loading = useWalletStore((s) => s.loading);
  const txLoading = useWalletStore((s) => s.txLoading);
  const error = useWalletStore((s) => s.error);

  const fetchWallet = useWalletStore((s) => s.fetchWallet);
  const fetchTransactions = useWalletStore((s) => s.fetchTransactions);
  const fetchBanks = useWalletStore((s) => s.fetchBanks);
  const initiateDeposit = useWalletStore((s) => s.initiateDeposit);
  const verifyDeposit = useWalletStore((s) => s.verifyDeposit);
  const resolveRecipient = useWalletStore((s) => s.resolveRecipient);
  const transferInternal = useWalletStore((s) => s.transferInternal);
  const withdraw = useWalletStore((s) => s.withdraw);

  const [activeTab, setActiveTab] = useState<WalletTab>("history");

  // History filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterKind, setFilterKind] = useState<"all" | WalletTxKind>("all");
  const [filterCategory, setFilterCategory] = useState<"all" | WalletTxCategory>(
    "all"
  );

  // Deposit form
  const [depositAmount, setDepositAmount] = useState<number | "">("");
  const [depositState, setDepositState] = useState<DepositState>("idle");
  const [depositRef, setDepositRef] = useState<string | null>(null);
  const [depositMsg, setDepositMsg] = useState<string | null>(null);
  const [creditedAmount, setCreditedAmount] = useState<number | null>(null);

  // Withdraw form
  const [withdrawAmount, setWithdrawAmount] = useState<number | "">("");
  const [selectedBankCode, setSelectedBankCode] = useState("");
  const [withdrawAccNum, setWithdrawAccNum] = useState("");
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [withdrawResult, setWithdrawResult] = useState<{
    reference: string;
    status: string;
    fee: number;
    totalAmount: number;
    bankName: string;
    note?: string;
  } | null>(null);

  // Transfer form
  const [transferAmount, setTransferAmount] = useState<number | "">("");
  const [transferEmail, setTransferEmail] = useState("");
  const [transferNarration, setTransferNarration] = useState("");
  const [resolvedRecipName, setResolvedRecipName] = useState("");
  const [resolveState, setResolveState] = useState<
    "idle" | "resolving" | "found" | "notfound"
  >("idle");
  const [isTransferring, setIsTransferring] = useState(false);

  const available = wallet?.balance.available ?? 0;
  const pending = wallet?.balance.pending ?? 0;
  const locked = wallet?.balance.locked ?? 0;

  // --- Initial hydration -----------------------------------------------------
  useEffect(() => {
    void fetchWallet();
    void fetchTransactions({ page: 1 });
    void fetchBanks();
  }, [fetchWallet, fetchTransactions, fetchBanks]);

  // Default the bank dropdown once banks load.
  useEffect(() => {
    if (banks.length > 0 && !selectedBankCode) {
      setSelectedBankCode(banks[0].code);
    }
  }, [banks, selectedBankCode]);

  // --- History: server-side filtering ----------------------------------------
  const applyFilters = (overrides?: {
    kind?: "all" | WalletTxKind;
    category?: "all" | WalletTxCategory;
    page?: number;
  }) => {
    const kind = overrides?.kind ?? filterKind;
    const category = overrides?.category ?? filterCategory;
    void fetchTransactions({
      page: overrides?.page ?? 1,
      type: kind === "all" ? undefined : kind,
      category: category === "all" ? undefined : category,
    });
  };

  // Client-side search over the already-fetched page (server has no text search).
  const visibleTransactions = useMemo(() => {
    if (!searchQuery.trim()) return transactions;
    const q = searchQuery.toLowerCase();
    return transactions.filter(
      (tx) =>
        tx.description?.toLowerCase().includes(q) ||
        tx.reference?.toLowerCase().includes(q) ||
        tx.category?.toLowerCase().includes(q) ||
        tx.counterparty?.name?.toLowerCase().includes(q)
    );
  }, [transactions, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(txTotal / (txLimit || 20)));

  // --- Deposit flow ----------------------------------------------------------
  const startDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(depositAmount);
    if (!amount || amount <= 0) {
      pushToast({ title: "Enter a valid amount", tone: "warning" });
      return;
    }
    if (!user?.email) {
      pushToast({
        title: "Session expired",
        message: "Please sign in again to make a deposit.",
        tone: "alert",
      });
      return;
    }

    setDepositState("opening");
    setDepositMsg(null);
    try {
      const init = await initiateDeposit(amount, "CARD");
      setDepositRef(init.reference);

      await openSeerbitPopup({
        config: {
          public_key: init.publicKey || SEERBIT_PUBLIC_KEY,
          amount: String(init.amount ?? amount),
          tranref: init.reference,
          currency: init.currency || "NGN",
          country: "NG",
          email: init.email || user.email,
          full_name:
            init.fullName ||
            `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim(),
          description: "Wallet top-up",
        },
        onSuccess: () => {
          void confirmDeposit(init.reference);
        },
        onClose: () => {
          // User closed the popup before finishing — treat as cancelled.
          setDepositState("idle");
          pushToast({
            title: "Deposit cancelled",
            message: "You closed the payment window.",
            tone: "info",
          });
        },
        onError: () => {
          setDepositState("idle");
          pushToast({
            title: "Payment window unavailable",
            message:
              "Could not open the SeerBit checkout. Check your connection and try again.",
            tone: "alert",
          });
        },
      });
    } catch (err) {
      setDepositState("idle");
      pushToast({
        title: "Could not start deposit",
        message: (err as Error)?.message,
        tone: "alert",
      });
    }
  };

  const confirmDeposit = async (reference: string) => {
    setDepositState("verifying");
    try {
      const result = await verifyDeposit(reference);
      const amt =
        result?.transaction?.amount ?? (Number(depositAmount) || 0);
      setCreditedAmount(amt);
      setDepositState("success");
      await fetchTransactions({ page: 1 });
      pushToast({
        title: result.alreadyCredited
          ? "Deposit already credited"
          : "Deposit successful",
        message: `${formatCurrency(amt)} added to your wallet.`,
        tone: "success",
      });
      setTimeout(() => {
        setDepositState("idle");
        setDepositAmount("");
        setDepositRef(null);
        setActiveTab("history");
      }, 2200);
    } catch (err) {
      // Verify pending: funds may confirm via webhook shortly.
      setDepositState("pending");
      setDepositMsg((err as Error)?.message ?? null);
    }
  };

  // --- Withdraw flow ---------------------------------------------------------
  const submitWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(withdrawAmount);
    if (!amount || amount <= 0) {
      pushToast({ title: "Enter a valid amount", tone: "warning" });
      return;
    }
    if (withdrawAccNum.length !== 10) {
      pushToast({
        title: "Invalid account number",
        message: "Enter a valid 10-digit NUBAN account number.",
        tone: "warning",
      });
      return;
    }
    if (!selectedBankCode) {
      pushToast({ title: "Select a destination bank", tone: "warning" });
      return;
    }
    if (amount > available) {
      pushToast({
        title: "Insufficient balance",
        message: `Available: ${formatCurrency(available)}`,
        tone: "warning",
      });
      return;
    }

    setIsWithdrawing(true);
    setWithdrawResult(null);
    try {
      const res = await withdraw({
        amount,
        bankCode: selectedBankCode,
        accountNumber: withdrawAccNum,
      });
      setWithdrawResult({
        reference: res.reference,
        status: res.status,
        fee: res.fee,
        totalAmount: res.totalAmount,
        bankName: res.bankName,
        note: res.note,
      });
      setWithdrawAmount("");
      setWithdrawAccNum("");
      await fetchTransactions({ page: 1 });
      pushToast({
        title:
          res.status === "APPROVED"
            ? "Withdrawal approved"
            : "Withdrawal submitted",
        message:
          res.status === "APPROVED"
            ? `${formatCurrency(amount)} is being settled to ${res.bankName}.`
            : `${formatCurrency(amount)} is pending admin approval.`,
        tone: res.status === "APPROVED" ? "success" : "info",
      });
    } catch (err) {
      pushToast({
        title: "Withdrawal failed",
        message: (err as Error)?.message,
        tone: "alert",
      });
    } finally {
      setIsWithdrawing(false);
    }
  };

  // --- Transfer flow ---------------------------------------------------------
  const handleResolveRecipient = async () => {
    const email = transferEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      setResolveState("idle");
      setResolvedRecipName("");
      return;
    }
    if (email === user?.email?.toLowerCase()) {
      setResolveState("notfound");
      setResolvedRecipName("");
      pushToast({
        title: "Cannot transfer to yourself",
        tone: "warning",
      });
      return;
    }
    setResolveState("resolving");
    try {
      const res = await resolveRecipient(email);
      setResolvedRecipName(res.name);
      setResolveState("found");
    } catch {
      setResolvedRecipName("");
      setResolveState("notfound");
    }
  };

  const submitTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(transferAmount);
    const email = transferEmail.trim().toLowerCase();
    if (!amount || amount <= 0) {
      pushToast({ title: "Enter a valid amount", tone: "warning" });
      return;
    }
    if (resolveState !== "found") {
      pushToast({
        title: "Confirm the recipient first",
        message: "Enter a registered member email and resolve it.",
        tone: "warning",
      });
      return;
    }
    if (amount > available) {
      pushToast({
        title: "Insufficient balance",
        message: `Available: ${formatCurrency(available)}`,
        tone: "warning",
      });
      return;
    }

    setIsTransferring(true);
    try {
      await transferInternal({
        recipientEmail: email,
        amount,
        narration: transferNarration.trim() || undefined,
      });
      setTransferAmount("");
      setTransferEmail("");
      setTransferNarration("");
      setResolvedRecipName("");
      setResolveState("idle");
      await fetchTransactions({ page: 1 });
      pushToast({
        title: "Transfer sent",
        message: `${formatCurrency(amount)} sent to ${resolvedRecipName}.`,
        tone: "success",
      });
      setActiveTab("history");
    } catch (err) {
      pushToast({
        title: "Transfer failed",
        message: (err as Error)?.message,
        tone: "alert",
      });
    } finally {
      setIsTransferring(false);
    }
  };

  // --- CSV export (current fetched page) -------------------------------------
  const handleDownloadCSV = () => {
    const headers =
      "Reference,Date,Type,Category,Amount(NGN),BalanceAfter,Status,Description\n";
    const rows = transactions
      .map((tx) =>
        [
          tx.reference,
          new Date(tx.createdAt).toISOString(),
          tx.type,
          tx.category,
          tx.amount,
          tx.balanceAfter ?? "",
          tx.status,
          (tx.description ?? "").replace(/"/g, "'"),
        ]
          .map((c) => `"${c}"`)
          .join(",")
      )
      .join("\n");
    const csv = "data:text/csv;charset=utf-8," + headers + rows;
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csv));
    link.setAttribute(
      "download",
      `BENNIE_WALLET_${wallet?.walletNumber ?? "STATEMENT"}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const tabButton = (tab: WalletTab, label: string) => (
    <button
      onClick={() => setActiveTab(tab)}
      className={`pb-4 px-2 font-semibold border-b-2 -mb-4.5 transition cursor-pointer ${
        activeTab === tab
          ? "border-primary text-primary font-bold"
          : "border-transparent text-muted hover:text-ink"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-8 animate-fade-in px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Page Title */}
      <div>
        <h1 className="text-2xl md:text-3xl font-display font-medium text-ink tracking-tight">
          Digital Wallet &amp; Payment Integrations
        </h1>
        <p className="text-sm text-muted mt-1">
          Fund your wallet securely via SeerBit, request bank withdrawals, or
          transfer instantly to another Bennie member.
        </p>
      </div>

      {/* Balance strip */}
      <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-r from-[#125D39] via-[#2F8537] to-[#71B53B] p-6 md:p-8 text-white shadow-lg border border-primary/10">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/5 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-1.5">
            <span className="bg-white/15 text-white backdrop-blur-md text-[10.5px] font-bold px-3 py-1 rounded-full border border-white/20 uppercase tracking-wider select-none inline-block">
              Available Capital
            </span>
            <h2 className="text-3xl md:text-4xl font-mono font-bold mt-1 text-white select-all">
              {loading && !wallet ? (
                <span className="inline-flex items-center gap-2 text-white/80">
                  <RefreshCw className="w-6 h-6 animate-spin" /> Loading…
                </span>
              ) : (
                formatCurrency(available)
              )}
            </h2>

            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              {(pending > 0 || locked > 0) && (
                <>
                  {pending > 0 && (
                    <span className="bg-white/10 text-white/90 text-[10px] font-semibold px-2.5 py-0.5 rounded-full border border-white/15 inline-flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Pending{" "}
                      {formatCurrency(pending)}
                    </span>
                  )}
                  {locked > 0 && (
                    <span className="bg-white/10 text-white/90 text-[10px] font-semibold px-2.5 py-0.5 rounded-full border border-white/15 inline-flex items-center gap-1">
                      <Lock className="w-3 h-3" /> Locked {formatCurrency(locked)}
                    </span>
                  )}
                </>
              )}
              {wallet?.walletNumber && (
                <span className="bg-accent/15 text-accent text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-accent/25 select-none uppercase tracking-wide inline-block">
                  {wallet.walletNumber}
                </span>
              )}
              {wallet?.status && wallet.status !== "ACTIVE" && (
                <span className="bg-rose-500/20 text-rose-100 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-rose-300/30 uppercase tracking-wide">
                  {wallet.status}
                </span>
              )}
            </div>
          </div>

          <div className="flex gap-2 w-full md:w-auto flex-wrap sm:flex-nowrap">
            {(
              [
                ["deposit", "Deposit", ArrowDownLeft],
                ["withdraw", "Withdraw", ArrowUpRight],
                ["transfer", "Transfer", Send],
              ] as const
            ).map(([tab, label, Icon]) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 md:flex-initial py-2.5 px-5 rounded-full text-xs font-bold flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer shadow-md ${
                  activeTab === tab
                    ? "bg-accent text-stone-900 border-none shadow-accent/15 hover:bg-[#d59124]"
                    : "bg-white/10 hover:bg-white/20 text-white border border-white/25"
                }`}
              >
                <Icon className="w-4 h-4" /> {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Error banner (non-blocking) */}
      {error && !wallet && (
        <div className="rounded-2xl border border-accent/30 bg-accent/5 p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-700 dark:text-amber-300 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-ink">
              Wallet unavailable
            </p>
            <p className="text-xs text-muted mt-0.5">{error}</p>
          </div>
          <button
            onClick={() => fetchWallet()}
            className="text-xs font-bold text-primary hover:underline cursor-pointer shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* Workspace */}
      <div className="bg-surface border border-border rounded-3xl p-6 shadow-sm min-h-[460px]">
        <div className="flex space-x-1 border-b border-border pb-4 mb-6 text-sm overflow-x-auto whitespace-nowrap scrollbar-hide">
          {tabButton("history", "Statement & Transaction Ledger")}
          {tabButton("deposit", "Deposit via SeerBit")}
          {tabButton("withdraw", "Withdraw to Bank")}
          {tabButton("transfer", "Member Transfer")}
        </div>

        {/* HISTORY ------------------------------------------------------------- */}
        {activeTab === "history" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <h3 className="font-display font-semibold text-ink text-base">
                Account Activity Ledger
              </h3>

              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-56">
                  <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-muted" />
                  <input
                    type="text"
                    placeholder="Search this page…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-surface-2/60 hover:bg-surface-2 focus:bg-surface border border-border focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none p-2 pl-10 rounded-xl text-xs text-ink transition-all duration-200"
                  />
                </div>

                <select
                  value={filterKind}
                  onChange={(e) => {
                    const kind = e.target.value as "all" | WalletTxKind;
                    setFilterKind(kind);
                    applyFilters({ kind });
                  }}
                  className="bg-surface-2/60 hover:bg-surface-2 focus:bg-surface border border-border focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none p-2 rounded-xl text-xs text-ink transition-all duration-200 cursor-pointer font-medium"
                >
                  <option value="all">All Types</option>
                  <option value="CREDIT">Credits</option>
                  <option value="DEBIT">Debits</option>
                </select>

                <select
                  value={filterCategory}
                  onChange={(e) => {
                    const category = e.target.value as
                      | "all"
                      | WalletTxCategory;
                    setFilterCategory(category);
                    applyFilters({ category });
                  }}
                  className="bg-surface-2/60 hover:bg-surface-2 focus:bg-surface border border-border focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none p-2 rounded-xl text-xs text-ink transition-all duration-200 cursor-pointer font-medium"
                >
                  <option value="all">All Categories</option>
                  {(Object.keys(CATEGORY_LABELS) as WalletTxCategory[]).map(
                    (c) => (
                      <option key={c} value={c}>
                        {CATEGORY_LABELS[c]}
                      </option>
                    )
                  )}
                </select>

                <button
                  onClick={handleDownloadCSV}
                  disabled={transactions.length === 0}
                  className="flex items-center justify-center gap-1.5 border border-border hover:border-primary/40 bg-surface-2/30 hover:bg-primary/5 text-ink hover:text-primary text-xs font-semibold p-2 px-3 rounded-xl transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Download className="w-4 h-4" /> Export CSV
                </button>
              </div>
            </div>

            {txLoading ? (
              <div className="py-16 text-center">
                <RefreshCw className="w-8 h-8 text-primary animate-spin mx-auto" />
                <p className="text-muted text-sm mt-3 font-medium">
                  Loading transactions…
                </p>
              </div>
            ) : visibleTransactions.length === 0 ? (
              <div className="py-16 text-center">
                <Wallet className="w-10 h-10 text-muted/70 mx-auto stroke-1" />
                <p className="text-muted text-sm mt-3 font-medium">
                  {searchQuery || filterKind !== "all" || filterCategory !== "all"
                    ? "No transactions match your filters"
                    : "No transactions yet"}
                </p>
                {(searchQuery ||
                  filterKind !== "all" ||
                  filterCategory !== "all") && (
                  <button
                    onClick={() => {
                      setSearchQuery("");
                      setFilterKind("all");
                      setFilterCategory("all");
                      applyFilters({ kind: "all", category: "all" });
                    }}
                    className="text-primary hover:underline mt-1 text-xs font-bold cursor-pointer"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="border border-border rounded-2xl overflow-hidden overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse min-w-[720px]">
                    <thead>
                      <tr className="bg-surface-2 border-b border-border text-muted font-medium">
                        <th className="p-4 font-semibold">Reference</th>
                        <th className="p-4 font-semibold">Date</th>
                        <th className="p-4 font-semibold">Description</th>
                        <th className="p-4 font-semibold">Status</th>
                        <th className="p-4 font-semibold text-right">Amount</th>
                        <th className="p-4 font-semibold text-right">Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border text-muted">
                      {visibleTransactions.map((tx) => {
                        const isCredit = tx.type === "CREDIT";
                        return (
                          <tr
                            key={tx._id}
                            className="hover:bg-surface-2 transition-all"
                          >
                            <td className="p-4 font-mono font-semibold text-muted">
                              {tx.reference}
                            </td>
                            <td className="p-4 font-mono text-muted whitespace-nowrap">
                              {new Date(tx.createdAt).toLocaleDateString()}
                            </td>
                            <td className="p-4">
                              <div className="flex items-center gap-2">
                                <span className="p-2 bg-surface-2 rounded-lg border border-border">
                                  {txIcon(tx)}
                                </span>
                                <div>
                                  <span className="font-semibold text-ink text-xs block">
                                    {tx.description ||
                                      CATEGORY_LABELS[tx.category]}
                                  </span>
                                  <span className="text-[10px] text-muted">
                                    {CATEGORY_LABELS[tx.category]}
                                    {tx.counterparty?.name
                                      ? ` · ${tx.counterparty.name}`
                                      : ""}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="p-4">
                              <span
                                className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${statusBadge(
                                  tx.status
                                )}`}
                              >
                                {tx.status}
                              </span>
                            </td>
                            <td
                              className={`p-4 text-right font-mono font-bold text-sm ${
                                isCredit ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"
                              }`}
                            >
                              {isCredit ? "+" : "-"}
                              {formatCurrency(tx.amount)}
                            </td>
                            <td className="p-4 text-right font-mono text-muted">
                              {typeof tx.balanceAfter === "number"
                                ? formatCurrency(tx.balanceAfter)
                                : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between text-xs text-muted">
                    <span>
                      Page {txPage} of {totalPages} · {txTotal} entries
                    </span>
                    <div className="flex gap-2">
                      <button
                        disabled={txPage <= 1 || txLoading}
                        onClick={() => applyFilters({ page: txPage - 1 })}
                        className="border border-border hover:border-primary/40 hover:text-primary px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Previous
                      </button>
                      <button
                        disabled={txPage >= totalPages || txLoading}
                        onClick={() => applyFilters({ page: txPage + 1 })}
                        className="border border-border hover:border-primary/40 hover:text-primary px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* DEPOSIT ------------------------------------------------------------- */}
        {activeTab === "deposit" && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="text-center space-y-1">
              <h3 className="font-display font-semibold text-ink text-lg">
                Fund your wallet
              </h3>
              <p className="text-xs text-muted max-w-md mx-auto leading-relaxed inline-flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                Secured by SeerBit. Payments are confirmed on our servers before
                crediting.
              </p>
            </div>

            {depositState === "idle" && (
              <form
                onSubmit={startDeposit}
                className="space-y-6 border border-border p-6 md:p-8 rounded-[24px] bg-surface hover:border-primary/30 transition-all duration-300 shadow-sm"
              >
                <div className="space-y-2">
                  <label className="text-xs text-muted uppercase tracking-wider font-bold block">
                    Enter Amount (NGN / ₦)
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-3 font-mono font-bold text-muted/70 text-sm">
                      ₦
                    </span>
                    <input
                      type="number"
                      required
                      min={1}
                      placeholder="e.g. 50,000"
                      value={depositAmount}
                      onChange={(e) =>
                        setDepositAmount(
                          e.target.value === "" ? "" : Number(e.target.value)
                        )
                      }
                      className="w-full bg-surface-2/60 hover:bg-surface-2 focus:bg-surface border border-border focus:border-primary focus:ring-2 focus:ring-primary/10 p-3 pl-8 rounded-xl font-mono text-base font-bold text-ink outline-none transition-all duration-200"
                    />
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {[10000, 25000, 50000, 100000].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setDepositAmount(preset)}
                        className="bg-surface-2/30 border border-border hover:border-primary hover:bg-primary/5 text-xs font-mono font-bold text-ink px-3.5 py-1.5 rounded-xl transition cursor-pointer"
                      >
                        +₦{preset.toLocaleString()}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-primary hover:bg-[#0f4a2d] text-white font-bold py-3.5 px-4 rounded-xl text-xs uppercase tracking-wider transition-all duration-200 cursor-pointer shadow-md shadow-primary/10 hover:shadow-lg hover:shadow-primary/15 border border-primary/15"
                >
                  Pay with SeerBit
                </button>
              </form>
            )}

            {depositState === "opening" && (
              <div className="py-20 text-center">
                <RefreshCw className="w-10 h-10 text-primary animate-spin mx-auto scale-110" />
                <h4 className="font-semibold text-ink text-sm mt-4">
                  Opening secure SeerBit checkout…
                </h4>
                <p className="text-xs text-muted mt-1">
                  Complete your payment in the popup window.
                </p>
              </div>
            )}

            {depositState === "verifying" && (
              <div className="py-20 text-center">
                <RefreshCw className="w-10 h-10 text-primary animate-spin mx-auto scale-110" />
                <h4 className="font-semibold text-ink text-sm mt-4">
                  Confirming your payment…
                </h4>
                <p className="text-xs text-muted mt-1">
                  Verifying with SeerBit on our servers.
                </p>
              </div>
            )}

            {depositState === "pending" && (
              <div className="py-16 text-center max-w-md mx-auto">
                <div className="w-16 h-16 bg-accent/10 text-amber-700 dark:text-amber-300 rounded-full flex items-center justify-center mx-auto mb-4 border border-accent/20">
                  <Clock className="w-9 h-9" />
                </div>
                <h4 className="font-display font-bold text-ink text-lg">
                  Payment confirmation pending
                </h4>
                <p className="text-xs text-muted mt-2 leading-relaxed">
                  {depositMsg ||
                    "We couldn't confirm the payment just yet."}{" "}
                  Funds usually settle within a moment — try checking again.
                </p>
                <div className="flex gap-2 justify-center mt-5">
                  <button
                    onClick={() => depositRef && confirmDeposit(depositRef)}
                    className="bg-primary hover:bg-[#0f4a2d] text-white font-bold py-2.5 px-5 rounded-xl text-xs uppercase tracking-wider transition cursor-pointer shadow-sm"
                  >
                    Check again
                  </button>
                  <button
                    onClick={() => {
                      setDepositState("idle");
                      setDepositRef(null);
                      setDepositMsg(null);
                    }}
                    className="bg-surface-2 hover:bg-surface-2/70 text-ink font-semibold py-2.5 px-5 rounded-xl text-xs border border-border transition cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}

            {depositState === "success" && (
              <div className="py-20 text-center">
                <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-4 border border-primary/15 shadow-sm">
                  <CheckCircle className="w-10 h-10" />
                </div>
                <h4 className="font-display font-bold text-ink text-lg">
                  Deposit successful!
                </h4>
                <p className="text-xs text-muted mt-1">
                  We credited{" "}
                  <span className="font-bold text-primary font-mono">
                    {formatCurrency(creditedAmount ?? 0)}
                  </span>{" "}
                  to your wallet.
                </p>
              </div>
            )}
          </div>
        )}

        {/* WITHDRAW ----------------------------------------------------------- */}
        {activeTab === "withdraw" && (
          <div className="max-w-2xl mx-auto space-y-6">
            <h3 className="font-display font-semibold text-ink text-lg text-center">
              Withdraw to Bank Account
            </h3>

            {withdrawResult ? (
              <div className="border border-border rounded-[24px] p-6 md:p-8 bg-surface shadow-sm text-center space-y-3">
                <div
                  className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto border ${
                    withdrawResult.status === "APPROVED"
                      ? "bg-primary/10 text-primary border-primary/15"
                      : "bg-accent/10 text-amber-700 dark:text-amber-300 border-accent/20"
                  }`}
                >
                  {withdrawResult.status === "APPROVED" ? (
                    <CheckCircle className="w-8 h-8" />
                  ) : (
                    <Clock className="w-8 h-8" />
                  )}
                </div>
                <h4 className="font-display font-bold text-ink text-base">
                  {withdrawResult.status === "APPROVED"
                    ? "Withdrawal approved"
                    : "Withdrawal pending approval"}
                </h4>
                <div className="text-xs text-muted space-y-1 font-mono">
                  <p>
                    Reference:{" "}
                    <span className="text-ink font-bold">
                      {withdrawResult.reference}
                    </span>
                  </p>
                  <p>
                    Bank:{" "}
                    <span className="text-ink font-bold">
                      {withdrawResult.bankName}
                    </span>
                  </p>
                  <p>
                    Fee: {formatCurrency(withdrawResult.fee)} · Total debited:{" "}
                    {formatCurrency(withdrawResult.totalAmount)}
                  </p>
                </div>
                {withdrawResult.note && (
                  <p className="text-[11px] text-muted bg-surface-2 border border-border rounded-xl p-3 leading-relaxed">
                    {withdrawResult.note}
                  </p>
                )}
                <button
                  onClick={() => setWithdrawResult(null)}
                  className="text-primary hover:underline text-xs font-bold cursor-pointer"
                >
                  Make another withdrawal
                </button>
              </div>
            ) : (
              <form
                onSubmit={submitWithdraw}
                className="space-y-6 border border-border p-6 md:p-8 rounded-[24px] bg-surface hover:border-primary/30 transition-all duration-300 shadow-sm"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted font-bold uppercase tracking-wider">
                      Destination Bank
                    </label>
                    <select
                      value={selectedBankCode}
                      onChange={(e) => setSelectedBankCode(e.target.value)}
                      disabled={banks.length === 0}
                      className="w-full bg-surface-2/60 hover:bg-surface-2 focus:bg-surface border border-border focus:border-primary focus:ring-2 focus:ring-primary/10 p-3 rounded-xl text-xs text-ink transition-all duration-200 outline-none font-medium cursor-pointer disabled:opacity-50"
                    >
                      {banks.length === 0 ? (
                        <option value="">Loading banks…</option>
                      ) : (
                        banks.map((b) => (
                          <option key={b.code} value={b.code}>
                            {b.name}
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs text-muted font-bold uppercase tracking-wider">
                      10-Digit Account Number
                    </label>
                    <input
                      type="text"
                      maxLength={10}
                      required
                      inputMode="numeric"
                      placeholder="e.g. 0123456789"
                      value={withdrawAccNum}
                      onChange={(e) =>
                        setWithdrawAccNum(e.target.value.replace(/\D/g, ""))
                      }
                      className="w-full bg-surface-2/60 hover:bg-surface-2 focus:bg-surface border border-border focus:border-primary focus:ring-2 focus:ring-primary/10 p-3 rounded-xl font-mono text-sm font-bold text-ink outline-none transition-all duration-200"
                    />
                  </div>
                </div>

                {/* Name-enquiry unavailable notice */}
                <div className="p-3.5 rounded-xl border border-accent/20 bg-accent/5 flex items-start gap-2 text-xs text-muted">
                  <Info className="w-4 h-4 text-amber-700 dark:text-amber-300 shrink-0 mt-0.5" />
                  <span>
                    Account-name confirmation is unavailable in test mode. Please
                    double-check the account number before submitting.
                  </span>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-muted font-bold uppercase tracking-wider block">
                    Withdrawal Amount (₦)
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-3 font-mono font-bold text-muted text-sm">
                      ₦
                    </span>
                    <input
                      type="number"
                      required
                      min={1}
                      placeholder="Enter amount"
                      value={withdrawAmount}
                      onChange={(e) =>
                        setWithdrawAmount(
                          e.target.value === "" ? "" : Number(e.target.value)
                        )
                      }
                      className="w-full bg-surface-2/60 hover:bg-surface-2 focus:bg-surface border border-border focus:border-primary focus:ring-2 focus:ring-primary/10 p-3 pl-8 rounded-xl font-mono text-base font-bold text-ink outline-none transition-all duration-200"
                    />
                  </div>
                  <div className="flex justify-between items-center text-[10.5px] text-muted px-1 pt-1.5 flex-wrap gap-2">
                    <span>
                      Available:{" "}
                      <span className="font-mono text-ink font-bold">
                        {formatCurrency(available)}
                      </span>
                    </span>
                    <span className="text-muted">
                      Withdrawals under ₦50,000 auto-approve; larger amounts need
                      admin review.
                    </span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isWithdrawing}
                  className="w-full bg-primary hover:bg-[#0f4a2d] disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3.5 px-4 rounded-xl text-xs uppercase tracking-wider transition-all duration-200 cursor-pointer shadow-md shadow-primary/10 hover:shadow-lg hover:shadow-primary/15 border border-primary/15"
                >
                  {isWithdrawing
                    ? "Submitting withdrawal…"
                    : "Request Withdrawal"}
                </button>
              </form>
            )}
          </div>
        )}

        {/* TRANSFER ----------------------------------------------------------- */}
        {activeTab === "transfer" && (
          <div className="max-w-2xl mx-auto space-y-6">
            <h3 className="font-display font-semibold text-ink text-lg text-center">
              Transfer to a Bennie Member
            </h3>

            <form
              onSubmit={submitTransfer}
              className="space-y-6 border border-border p-6 md:p-8 rounded-[24px] bg-surface hover:border-primary/30 transition-all duration-300 shadow-sm"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-xs text-muted font-bold uppercase tracking-wider">
                    Recipient Email
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="member@example.com"
                    value={transferEmail}
                    onChange={(e) => {
                      setTransferEmail(e.target.value);
                      setResolveState("idle");
                      setResolvedRecipName("");
                    }}
                    onBlur={handleResolveRecipient}
                    className="w-full bg-surface-2/60 hover:bg-surface-2 focus:bg-surface border border-border focus:border-primary focus:ring-2 focus:ring-primary/10 p-3 rounded-xl text-sm font-medium text-ink outline-none transition-all duration-200"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-muted font-bold uppercase tracking-wider">
                    Amount (₦)
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-3 font-mono font-bold text-muted/75 text-sm">
                      ₦
                    </span>
                    <input
                      type="number"
                      required
                      min={1}
                      placeholder="e.g. 15,000"
                      value={transferAmount}
                      onChange={(e) =>
                        setTransferAmount(
                          e.target.value === "" ? "" : Number(e.target.value)
                        )
                      }
                      className="w-full bg-surface-2/60 hover:bg-surface-2 focus:bg-surface border border-border focus:border-primary focus:ring-2 focus:ring-primary/10 p-3 pl-8 rounded-xl font-mono text-sm font-bold text-ink outline-none transition-all duration-200"
                    />
                  </div>
                </div>
              </div>

              {/* Recipient resolution block */}
              {transferEmail.includes("@") && (
                <div className="p-4 rounded-xl border border-primary/15 flex items-center justify-between bg-primary/5 text-xs text-ink gap-3">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary shrink-0" />
                    <span className="font-medium text-muted">
                      Recipient:
                    </span>
                  </div>
                  {resolveState === "resolving" && (
                    <span className="text-accent font-semibold flex items-center gap-1">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />{" "}
                      Checking member roster…
                    </span>
                  )}
                  {resolveState === "found" && (
                    <span className="font-bold text-primary flex items-center gap-1">
                      <CheckCircle className="w-4 h-4" /> {resolvedRecipName}
                    </span>
                  )}
                  {resolveState === "notfound" && (
                    <span className="text-rose-600 dark:text-rose-300 font-semibold flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" /> No member with that
                      email
                    </span>
                  )}
                  {resolveState === "idle" && (
                    <button
                      type="button"
                      onClick={handleResolveRecipient}
                      className="text-primary font-bold hover:underline cursor-pointer"
                    >
                      Confirm recipient
                    </button>
                  )}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs text-muted font-bold uppercase tracking-wider">
                  Narration (optional)
                </label>
                <input
                  type="text"
                  maxLength={120}
                  placeholder="e.g. Payment for cassava supply"
                  value={transferNarration}
                  onChange={(e) => setTransferNarration(e.target.value)}
                  className="w-full bg-surface-2/60 hover:bg-surface-2 focus:bg-surface border border-border focus:border-primary focus:ring-2 focus:ring-primary/10 p-3 rounded-xl text-xs text-ink outline-none transition-all duration-200"
                />
              </div>

              <div className="flex justify-between items-center text-[10.5px] text-muted px-1">
                <span>
                  Available:{" "}
                  <span className="font-mono text-ink font-bold">
                    {formatCurrency(available)}
                  </span>
                </span>
                <span className="text-primary font-semibold">
                  Member transfers are free
                </span>
              </div>

              <button
                type="submit"
                disabled={isTransferring || resolveState !== "found"}
                className="w-full bg-primary hover:bg-[#0f4a2d] disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3.5 px-4 rounded-xl text-xs uppercase tracking-wider transition-all duration-200 cursor-pointer shadow-md shadow-primary/10 hover:shadow-lg hover:shadow-primary/15 border border-primary/15"
              >
                {isTransferring
                  ? "Sending transfer…"
                  : resolveState === "found"
                  ? `Send to ${resolvedRecipName}`
                  : "Send Transfer"}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
