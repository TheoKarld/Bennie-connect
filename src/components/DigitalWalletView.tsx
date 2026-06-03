/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  Wallet, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Send, 
  Search, 
  Filter, 
  Download, 
  CheckCircle, 
  RefreshCw, 
  Building, 
  Users, 
  AlertCircle,
  CreditCard
} from "lucide-react";
import { FarmerAppState, WalletTransaction, PaymentGatewayType, TransactionType } from "../types";

interface DigitalWalletViewProps {
  state: FarmerAppState;
  onDeposit: (amount: number, gateway: PaymentGatewayType) => void;
  onWithdraw: (amount: number, bank: string, accNum: string) => void;
  onTransfer: (amount: number, recipientId: string, recipientName: string) => void;
}

export default function DigitalWalletView({
  state,
  onDeposit,
  onWithdraw,
  onTransfer
}: DigitalWalletViewProps) {
  // Navigation Tabs within Wallet
  const [activeTab, setActiveTab] = useState<"history" | "deposit" | "withdraw" | "transfer">("history");
  
  // Transaction search & filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("all");

  // Form states - Deposit
  const [depositAmount, setDepositAmount] = useState<number | "">("");
  const [selectedGateway, setSelectedGateway] = useState<PaymentGatewayType>("Paystack");
  const [payState, setPayState] = useState<"idle" | "checkout" | "processing" | "success">("idle");
  const [mockCardNum, setMockCardNum] = useState("");
  const [mockExpiry, setMockExpiry] = useState("");
  const [mockPin, setMockPin] = useState("");

  // Form states - Withdraw
  const [withdrawAmount, setWithdrawAmount] = useState<number | " text-[#1A2421]">("");
  const [selectedBank, setSelectedBank] = useState("Guaranty Trust Bank (GTB)");
  const [withdrawAccNum, setWithdrawAccNum] = useState("");
  const [resolvedAccountName, setResolvedAccountName] = useState("");
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  // Form states - Transfer
  const [transferAmount, setTransferAmount] = useState<number | "">("");
  const [transferRecipId, setTransferRecipId] = useState("");
  const [resolvedRecipName, setResolvedRecipName] = useState("");
  const [isTransferring, setIsTransferring] = useState(false);

  const formatCurrency = (amt: number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      minimumFractionDigits: 2,
    }).format(amt);
  };

  // Mock recipient lookups for bank withdrawal
  useEffect(() => {
    if (withdrawAccNum.length === 10) {
      const names = [
        "Adegoke Babatunde Samuel",
        "Chukwuma Obiageli Martha",
        "Musa Danjuma Ibrahim",
        "Olarenwaju Rasheedat Taiwo",
        "Nwokolo Kingsley Onyeka"
      ];
      const digitSum = withdrawAccNum.split("").reduce((sum, d) => sum + parseInt(d || "0"), 0);
      setResolvedAccountName(names[digitSum % names.length]);
    } else {
      setResolvedAccountName("");
    }
  }, [withdrawAccNum]);

  // Mock recipient lookups for cooperative member transfer
  useEffect(() => {
    const formattedId = transferRecipId.toUpperCase().trim();
    if (formattedId.length >= 8) {
      if (formattedId.includes("FARM-") || formattedId.includes("COOP-")) {
        const coopNames = [
          "Adebayo Farms Ltd.",
          "Oyo Cassava Growers Syndicate",
          "Comrade Farmer Chidi K.",
          "Agro-Allied West Hub Cooperative",
          "Madam Florence Grains Circle"
        ];
        const sumAndHash = formattedId.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
        setResolvedRecipName(coopNames[sumAndHash % coopNames.length]);
      } else {
        setResolvedRecipName("Validated External Member Account");
      }
    } else {
      setResolvedRecipName("");
    }
  }, [transferRecipId]);

  // Handle Deposit Execution
  const triggerDepositFlow = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanAmt = Number(depositAmount);
    if (!cleanAmt || cleanAmt <= 0) {
      alert("Please specify a valid deposit amount.");
      return;
    }
    setPayState("checkout");
  };

  const executeSecureDeposit = () => {
    setPayState("processing");
    setTimeout(() => {
      onDeposit(Number(depositAmount), selectedGateway);
      setPayState("success");
      setTimeout(() => {
        setPayState("idle");
        setDepositAmount("");
        setMockCardNum("");
        setMockExpiry("");
        setMockPin("");
        setActiveTab("history");
      }, 1550);
    }, 2000);
  };

  // Handle Bank Withdrawal Execution
  const handleWithdrawalExec = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanAmt = Number(withdrawAmount);
    if (!cleanAmt || cleanAmt <= 0) {
      alert("Please enter a valid amount.");
      return;
    }
    if (cleanAmt > state.walletBalance) {
      alert("Insufficient wallet balance for this payout.");
      return;
    }
    if (withdrawAccNum.length !== 10) {
      alert("Please enter a valid 10-digit NUBAN account number.");
      return;
    }
    
    setIsWithdrawing(true);
    setTimeout(() => {
      onWithdraw(cleanAmt, selectedBank, withdrawAccNum);
      setIsWithdrawing(false);
      setWithdrawAmount("");
      setWithdrawAccNum("");
      setActiveTab("history");
      alert(`Payout of ${formatCurrency(cleanAmt)} successfully initiated to ${selectedBank} (${withdrawAccNum}).`);
    }, 1800);
  };

  // Handle Cooperative Transfer Execution
  const handleTransferExec = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanAmt = Number(transferAmount);
    if (!cleanAmt || cleanAmt <= 0) {
      alert("Please enter a valid transfer amount.");
      return;
    }
    if (cleanAmt > state.walletBalance) {
      alert("Insufficient wallet capital.");
      return;
    }
    if (!transferRecipId.trim()) {
      alert("Please enter a recipient Member ID.");
      return;
    }

    setIsTransferring(true);
    setTimeout(() => {
      onTransfer(cleanAmt, transferRecipId.trim(), resolvedRecipName || "Cooperative Partner");
      setIsTransferring(false);
      setTransferAmount("");
      setTransferRecipId("");
      setActiveTab("history");
      alert(`Transfer of ${formatCurrency(cleanAmt)} to member card ${transferRecipId.trim()} was successful.`);
    }, 1500);
  };

  // Filtered transactions computed list
  const filteredTransactions = state.walletTransactions.filter((tx) => {
    const matchesSearch = tx.description.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          tx.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (tx.gateway && tx.gateway.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesFilter = filterType === "all" || tx.type === filterType;
    return matchesSearch && matchesFilter;
  });

  const getTransactionIcon = (type: TransactionType) => {
    switch (type) {
      case "deposit":
        return <ArrowDownLeft className="w-4 h-4 text-emerald-600" />;
      case "withdraw":
        return <ArrowUpRight className="w-4 h-4 text-rose-650" />;
      case "transfer":
        return <Send className="w-4 h-4 text-[#135D39]" />;
      case "savings_transfer":
        return <Wallet className="w-4 h-4 text-[#E7A13C]" />;
      case "share_purchase":
        return <CreditCard className="w-4 h-4 text-emerald-800" />;
      case "share_sale":
        return <CreditCard className="w-4 h-4 text-[#135D39]" />;
      case "dividend_payment":
        return <CheckCircle className="w-4 h-4 text-[#E7A13C]" />;
      default:
        return <Wallet className="w-4 h-4 text-stone-500" />;
    }
  };

  const handleDownloadCSV = () => {
    const headers = "TransactionID,Date,Type,Amount(NGN),Description,Status\n";
    const csvContent = "data:text/csv;charset=utf-8," + headers + 
      state.walletTransactions.map(tx => `"${tx.id}","${tx.date}","${tx.type}",${tx.amount},"${tx.description}","${tx.status}"`).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `BENNIE_AGRO_STATEMENT_${state.membership.cardNumber}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8 animate-fade-in px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Page Title & Sub Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-display font-medium text-[#1A2421] tracking-tight">
          Digital Wallet & Payment Integrations
        </h1>
        <p className="text-sm text-[#5C6460] mt-1">
          Perform immediate deposits, secure withdrawals to commercial banks, or instant peer-to-peer member transfers.
        </p>
      </div>

      {/* Wallet Balance Display Strip */}
      <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-r from-[#125D39] via-[#2F8537] to-[#71B53B] p-6 md:p-8 text-white shadow-lg border border-[#135D39]/10">
        
        {/* Subtle top right light circle glow */}
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/5 blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-1.5">
            <span className="bg-white/15 text-white backdrop-blur-md text-[10.5px] font-bold px-3 py-1 rounded-full border border-white/20 uppercase tracking-wider select-none inline-block">
              Available Capital
            </span>
            <h2 className="text-3xl md:text-4xl font-mono font-bold mt-1 text-white select-all">
              {formatCurrency(state.walletBalance)}
            </h2>
            <div className="flex flex-wrap items-center gap-2.5 pt-0.5">
              <p className="text-xs text-white/80 font-medium leading-relaxed">
                Secure custody backed by Bennie Agro Farmer Cooperative System.
              </p>
              <span className="bg-[#E9A42F]/15 text-[#E9A42F] text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-[#E9A42F]/25 select-none uppercase tracking-wide inline-block">
                Card ID: {state.membership.cardNumber}
              </span>
            </div>
          </div>

          <div className="flex gap-2 w-full md:w-auto flex-wrap sm:flex-nowrap">
            <button 
              onClick={() => { setActiveTab("deposit"); setPayState("idle"); }}
              className={`flex-1 md:flex-initial py-2.5 px-5 rounded-full text-xs font-bold flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer shadow-md ${
                activeTab === "deposit" 
                  ? "bg-[#E9A42F] text-stone-900 border-none shadow-[#E9A42F]/15 hover:bg-[#d59124]" 
                  : "bg-white/10 hover:bg-white/20 text-white border border-white/25"
              }`}
            >
              <ArrowDownLeft className="w-4 h-4" /> Deposit
            </button>
            
            <button 
              onClick={() => setActiveTab("withdraw")}
              className={`flex-1 md:flex-initial py-2.5 px-5 rounded-full text-xs font-bold flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer shadow-md ${
                activeTab === "withdraw" 
                  ? "bg-[#E9A42F] text-stone-900 border-none shadow-[#E9A42F]/15 hover:bg-[#d59124]" 
                  : "bg-white/10 hover:bg-white/20 text-white border border-white/25"
              }`}
            >
              <ArrowUpRight className="w-4 h-4" /> Withdraw
            </button>

            <button 
              onClick={() => setActiveTab("transfer")}
              className={`flex-1 md:flex-initial py-2.5 px-5 rounded-full text-xs font-bold flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer shadow-md ${
                activeTab === "transfer" 
                  ? "bg-[#E9A42F] text-stone-900 border-none shadow-[#E9A42F]/15 hover:bg-[#d59124]" 
                  : "bg-white/10 hover:bg-white/20 text-white border border-white/25"
              }`}
            >
              <Send className="w-4 h-4" /> Transfer
            </button>
          </div>
        </div>
      </div>

      {/* Main Container Workspace */}
      <div className="bg-white border border-[#E6E5DF] rounded-3xl p-6 shadow-sm min-h-[460px]">
        
        {/* Workspace Tab Headers */}
        <div className="flex space-x-1 border-b border-[#E6E5DF] pb-4 mb-6 text-sm overflow-x-auto whitespace-nowrap scrollbar-hide">
          <button 
            onClick={() => setActiveTab("history")}
            className={`pb-4 px-2 font-semibold border-b-2 -mb-4.5 transition cursor-pointer ${
              activeTab === "history" 
                ? "border-[#135D39] text-[#135D39] font-bold" 
                : "border-transparent text-[#5C6460] hover:text-[#1A2421]"
            }`}
          >
            Statement & Transaction Ledger
          </button>
          <button 
            onClick={() => { setActiveTab("deposit"); setPayState("idle"); }}
            className={`pb-4 px-2 font-semibold border-b-2 -mb-4.5 transition cursor-pointer ${
              activeTab === "deposit" 
                ? "border-[#135D39] text-[#135D39] font-bold" 
                : "border-transparent text-[#5C6460] hover:text-[#1A2421]"
            }`}
          >
            Deposit Gateway Integration
          </button>
          <button 
            onClick={() => setActiveTab("withdraw")}
            className={`pb-4 px-2 font-semibold border-b-2 -mb-4.5 transition cursor-pointer ${
              activeTab === "withdraw" 
                ? "border-[#135D39] text-[#135D39] font-bold" 
                : "border-transparent text-[#5C6460] hover:text-[#1A2421]"
            }`}
          >
            Withdraw to Bank
          </button>
          <button 
            onClick={() => setActiveTab("transfer")}
            className={`pb-4 px-2 font-semibold border-b-2 -mb-4.5 transition cursor-pointer ${
              activeTab === "transfer" 
                ? "border-[#135D39] text-[#135D39] font-bold" 
                : "border-transparent text-[#5C6460] hover:text-[#1A2421]"
            }`}
          >
            Peer Member Transfer
          </button>
        </div>

        {/* Tab Content 1: Statement History */}
        {activeTab === "history" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <h3 className="font-display font-semibold text-[#1A2421] text-base">Account Activity Ledger</h3>
              
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                 {/* Search input */}
                <div className="relative flex-1 sm:w-64">
                  <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-[#5C6460]" />
                  <input 
                    type="text" 
                    placeholder="Search ledger entries..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-[#FAF8F5]/60 hover:bg-[#FAF8F5] focus:bg-white border border-[#E6E5DF] focus:border-[#135D39] focus:ring-2 focus:ring-[#135D39]/10 outline-none p-2 pl-10 rounded-xl text-xs text-[#1A2421] transition-all duration-200"
                  />
                </div>

                {/* Filter Selector */}
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="bg-[#FAF8F5]/60 hover:bg-[#FAF8F5] focus:bg-white border border-[#E6E5DF] focus:border-[#135D39] focus:ring-2 focus:ring-[#135D39]/10 outline-none p-2 rounded-xl text-xs text-[#1A2421] transition-all duration-200 cursor-pointer font-medium"
                >
                  <option value="all">All Transactions</option>
                  <option value="deposit">Deposits Only</option>
                  <option value="withdraw">Withdrawals Only</option>
                  <option value="transfer">Transfers Only</option>
                  <option value="savings_transfer">Savings Transfers</option>
                  <option value="share_purchase">Shares Purchased</option>
                  <option value="share_sale">Shares Sold</option>
                  <option value="dividend_payment">Dividends Claimed</option>
                </select>

                <button 
                  onClick={handleDownloadCSV}
                  className="flex items-center justify-center gap-1.5 border border-[#E6E5DF] hover:border-[#135D39]/40 bg-[#FAF8F5]/30 hover:bg-[#135D39]/5 text-[#1A2421] hover:text-[#135D39] text-xs font-semibold p-2 px-3 rounded-xl transition cursor-pointer"
                >
                  <Download className="w-4 h-4" /> Export CSV
                </button>
              </div>
            </div>

            {filteredTransactions.length === 0 ? (
              <div className="py-16 text-center">
                <Search className="w-10 h-10 text-stone-300 mx-auto stroke-1" />
                <p className="text-[#5C6460] text-sm mt-3 font-medium">No results matched your ledger query</p>
                <button onClick={() => { setSearchQuery(""); setFilterType("all"); }} className="text-[#135D39] hover:underline mt-1 text-xs font-bold cursor-pointer">Clear filters</button>
              </div>
            ) : (
              <div className="border border-[#E6E5DF] rounded-2xl overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#FAF8F5] border-b border-[#E6E5DF] text-[#5C6460] font-medium">
                      <th className="p-4 font-semibold">Ref ID</th>
                      <th className="p-4 font-semibold">Date</th>
                      <th className="p-4 font-semibold">Description</th>
                      <th className="p-4 font-semibold">Channel</th>
                      <th className="p-4 font-semibold text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E6E5DF] text-stone-700">
                    {filteredTransactions.map((tx) => {
                      const isAddition = ["deposit", "dividend_payment", "share_sale"].includes(tx.type);
                      return (
                        <tr key={tx.id} className="hover:bg-[#FAF8F5] transition-all">
                          <td className="p-4 font-mono font-semibold text-[#5C6460]">{tx.id}</td>
                          <td className="p-4 font-mono text-stone-500">{new Date(tx.date).toLocaleDateString() || "Recent"}</td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <span className="p-2 bg-[#FAF8F5] rounded-lg border border-[#E6E5DF]">
                                {getTransactionIcon(tx.type)}
                              </span>
                              <div>
                                <span className="font-semibold text-[#1A2421] text-xs block">{tx.description}</span>
                                <span className="text-[10px] text-stone-405 capitalize">Type: {tx.type.replace("_", " ")}</span>
                              </div>
                            </div>
                          </td>
                          <td className="p-4">
                            {tx.gateway ? (
                              <span className="bg-[#135D39]/10 text-[#135D39] text-[10px] uppercase font-bold px-2 py-0.5 rounded border border-[#135D39]/15">
                                {tx.gateway}
                              </span>
                            ) : (
                              <span className="text-stone-400 text-[10px] font-medium">Coop Ledger</span>
                            )}
                          </td>
                          <td className={`p-4 text-right font-mono font-bold text-sm ${
                            isAddition ? "text-emerald-700" : "text-rose-700"
                          }`}>
                            {isAddition ? "+" : "-"}{formatCurrency(tx.amount)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab Content 2: Deposit Gateway Integration (Interactive simulated payment checkouts) */}
        {activeTab === "deposit" && (
          <div className="max-w-2xl mx-auto space-y-6">
            <h3 className="font-display font-semibold text-[#1A2421] text-lg text-center">Interactive Deposit Payment Gateway</h3>
            <p className="text-xs text-[#5C6460] text-center max-w-md mx-auto leading-relaxed">
              Fully active simulated integrations with Paystack, Flutterwave, and Monnify checkout modals. Safe local trial flow.
            </p>

            {payState === "idle" && (
              <form onSubmit={triggerDepositFlow} className="space-y-6 border border-[#E6E5DF] p-6 md:p-8 rounded-[24px] bg-white hover:border-[#135D39]/30 transition-all duration-300 shadow-sm">
                {/* Gateway selection */}
                <div className="space-y-2">
                  <label className="text-xs text-[#5C6460] uppercase tracking-wider font-bold">Pick Payment Provider Gateway</label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {(["Paystack", "Flutterwave", "Monnify"] as PaymentGatewayType[]).map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setSelectedGateway(g)}
                        className={`p-4 rounded-xl border text-center transition flex flex-col items-center justify-center gap-1 cursor-pointer ${
                          selectedGateway === g 
                            ? "bg-[#135D39]/10 border-[#135D39] text-[#135D39] font-bold shadow-sm shadow-[#135D39]/5" 
                            : "bg-white border-[#E6E5DF] text-[#5C6460] hover:text-[#1A2421] hover:bg-[#FAF8F5]/50"
                        }`}
                      >
                        <span className="font-bold text-xs uppercase">{g}</span>
                        <span className="text-[9px] text-[#5C6460]/75 font-medium">Instant Clearance</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Amount inputs */}
                <div className="space-y-2">
                  <label className="text-xs text-[#5C6460] uppercase tracking-wider font-bold block">Enter Capital Amount (NGN / ₦)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-3 font-mono font-bold text-[#5C6460]/70 text-sm">₦</span>
                    <input 
                      type="number" 
                      required
                      placeholder="e.g. 50,000"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value === "" ? "" : Number(e.target.value))}
                      className="w-full bg-[#FAF8F5]/60 hover:bg-[#FAF8F5] focus:bg-white border border-[#E6E5DF] focus:border-[#135D39] focus:ring-2 focus:ring-[#135D39]/10 p-3 pl-8 rounded-xl font-mono text-base font-bold text-[#1A2421] outline-none transition-all duration-200"
                    />
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {[10000, 25000, 50000, 100000].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setDepositAmount(preset)}
                        className="bg-[#FAF8F5]/30 border border-[#E6E5DF] hover:border-[#135D39] hover:bg-[#135D39]/5 text-xs font-mono font-bold text-[#1A2421] px-3.5 py-1.5 rounded-xl transition cursor-pointer"
                      >
                        +₦{preset.toLocaleString()}
                      </button>
                    ))}
                  </div>
                </div>

                <button 
                  type="submit"
                  className="w-full bg-[#135D39] hover:bg-[#0f4a2d] text-white font-bold py-3.5 px-4 rounded-xl text-xs uppercase tracking-wider transition-all duration-200 cursor-pointer shadow-md shadow-[#135D39]/10 hover:shadow-lg hover:shadow-[#135D39]/15 border border-[#135D39]/15"
                >
                  Initiate Checkout with {selectedGateway} Partner
                </button>
              </form>
            )}

            {/* Simulated Checkout pop screens */}
            {payState === "checkout" && (
              <div className="border border-[#E6E5DF] rounded-3xl overflow-hidden shadow-lg max-w-md mx-auto bg-white text-stone-900 animate-fade-in relative">
                {/* Modal Header */}
                <div className="bg-[#135D39] px-6 py-4 flex justify-between items-center border-b border-[#135D39]/25 text-white">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#E9A42F] animate-pulse shrink-0" />
                    <span className="text-xs font-bold tracking-widest uppercase text-[#E9A42F]">{selectedGateway} Checkout Service</span>
                  </div>
                  <button 
                    onClick={() => setPayState("idle")}
                    className="text-white/70 hover:text-white transition text-xs font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>

                {/* Simulated credit card interface */}
                <div className="p-6 space-y-4">
                  <div className="bg-[#135D39]/5 p-4 rounded-xl border border-[#135D39]/15 flex justify-between items-center leading-normal">
                    <div>
                      <span className="text-[10px] text-[#5C6460] uppercase tracking-widest font-bold block">Cooperative Merchant</span>
                      <p className="text-xs font-bold mt-0.5 text-[#135D39]">BENNIE AGRO COOPERATIVE LTD</p>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-[#5C6460] uppercase tracking-widest font-bold block">Total deposit</span>
                      <p className="text-sm font-bold font-mono text-[#135D39] mt-0.5">{formatCurrency(Number(depositAmount))}</p>
                    </div>
                  </div>

                  <div className="space-y-3 pt-2">
                    <p className="text-[11px] text-[#5C6460] font-medium">Safe Sandbox Interactive Payment Gateway Integration:</p>
                    
                    <div className="space-y-1">
                      <label className="text-[10px] text-[#1A2421] uppercase tracking-wider font-semibold">Mock Card Number</label>
                      <input 
                        type="text" 
                        maxLength={19}
                        placeholder="5232 4015 8829 1012"
                        value={mockCardNum}
                        onChange={(e) => setMockCardNum(e.target.value)}
                        className="w-full bg-[#FAF8F5]/60 hover:bg-[#FAF8F5] focus:bg-white border border-[#E6E5DF] focus:border-[#135D39] focus:ring-2 focus:ring-[#135D39]/10 rounded-xl p-2.5 text-xs text-[#1A2421] outline-none transition-all duration-200 font-mono"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] text-[#1A2421] uppercase tracking-wider font-semibold">Expiry Date</label>
                        <input 
                          type="text" 
                          maxLength={5}
                          placeholder="MM/YY"
                          value={mockExpiry}
                          onChange={(e) => setMockExpiry(e.target.value)}
                          className="w-full bg-[#FAF8F5]/60 hover:bg-[#FAF8F5] focus:bg-white border border-[#E6E5DF] focus:border-[#135D39] focus:ring-2 focus:ring-[#135D39]/10 rounded-xl p-2.5 text-xs text-[#1A2421] outline-none transition-all duration-200 font-mono text-center"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-[#1A2421] uppercase tracking-wider font-semibold">Card Pin</label>
                        <input 
                          type="password" 
                          maxLength={4}
                          placeholder="● ● ● ●"
                          value={mockPin}
                          onChange={(e) => setMockPin(e.target.value)}
                          className="w-full bg-[#FAF8F5]/60 hover:bg-[#FAF8F5] focus:bg-white border border-[#E6E5DF] focus:border-[#135D39] focus:ring-2 focus:ring-[#135D39]/10 rounded-xl p-2.5 text-xs text-[#1A2421] outline-none transition-all duration-200 font-mono text-center"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-4">
                    <button 
                      onClick={() => setPayState("idle")}
                      className="flex-1 bg-[#FAF8F5] hover:bg-[#FAF8F5]/80 text-xs font-semibold py-2.5 rounded-xl transition text-[#1A2421] border border-[#E6E5DF] cursor-pointer"
                    >
                      Abort
                    </button>
                    <button 
                      onClick={executeSecureDeposit}
                      disabled={!mockCardNum}
                      className="flex-1 bg-[#135D39] hover:bg-[#0f4a2d] text-white font-bold py-2.5 rounded-xl transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer border border-[#135D39]/15 shadow-sm"
                    >
                      Pay {formatCurrency(Number(depositAmount))}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {payState === "processing" && (
              <div className="py-20 text-center animate-pulse">
                <RefreshCw className="w-10 h-10 text-[#135D39] animate-spin mx-auto scale-110" />
                <h4 className="font-semibold text-[#1A2421] text-sm mt-4">Securing bank authorization clearance...</h4>
                <p className="text-xs text-[#5C6460] mt-1">Calling core {selectedGateway} provider framework endpoints...</p>
              </div>
            )}

            {payState === "success" && (
              <div className="py-20 text-center">
                <div className="w-16 h-16 bg-emerald-550/10 text-[#135D39] rounded-full flex items-center justify-center mx-auto mb-4 border border-[#135D39]/15 shadow-sm">
                  <CheckCircle className="w-10 h-10" />
                </div>
                <h4 className="font-display font-bold text-[#1A2421] text-lg">Transaction Cleared Successfully!</h4>
                <p className="text-xs text-[#5C6460] mt-1">
                  We have credited <span className="font-bold text-[#135D39] font-mono">{formatCurrency(Number(depositAmount))}</span> to your available wallet capital using {selectedGateway}.
                </p>
              </div>
            )}

          </div>
        )}

        {/* Tab Content 3: Withdraw to Bank */}
        {activeTab === "withdraw" && (
          <div className="max-w-2xl mx-auto space-y-6">
            <h3 className="font-display font-semibold text-[#1A2421] text-lg text-center">NUBAN Direct Bank Clearance</h3>
            
            <form onSubmit={handleWithdrawalExec} className="space-y-6 border border-[#E6E5DF] p-6 md:p-8 rounded-[24px] bg-white hover:border-[#135D39]/30 transition-all duration-300 shadow-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Select Bank */}
                <div className="space-y-1.5">
                  <label className="text-xs text-[#5C6460] font-bold uppercase tracking-wider">Destination Bank</label>
                  <select
                    value={selectedBank}
                    onChange={(e) => setSelectedBank(e.target.value)}
                    className="w-full bg-[#FAF8F5]/60 hover:bg-[#FAF8F5] focus:bg-white border border-[#E6E5DF] focus:border-[#135D39] focus:ring-2 focus:ring-[#135D39]/10 p-3 rounded-xl text-xs text-[#1A2421] transition-all duration-200 outline-none font-medium cursor-pointer"
                  >
                    <option>Guaranty Trust Bank (GTB)</option>
                    <option>Access Bank Plc</option>
                    <option>Zenith Bank International</option>
                    <option>United Bank for Africa (UBA)</option>
                    <option>First Bank of Nigeria</option>
                    <option>Stanbic IBTC Bank</option>
                    <option>Kuda Microfinance Bank</option>
                  </select>
                </div>

                {/* Account Number */}
                <div className="space-y-1.5">
                  <label className="text-xs text-[#5C6460] font-bold uppercase tracking-wider">10-Digit Account Number</label>
                  <input 
                    type="text" 
                    maxLength={10} 
                    required
                    placeholder="e.g. 0123456789"
                    value={withdrawAccNum}
                    onChange={(e) => setWithdrawAccNum(e.target.value.replace(/\D/g, ""))}
                    className="w-full bg-[#FAF8F5]/60 hover:bg-[#FAF8F5] focus:bg-white border border-[#E6E5DF] focus:border-[#135D39] focus:ring-2 focus:ring-[#135D39]/10 p-3 rounded-xl font-mono text-sm font-bold text-[#1A2421] outline-none transition-all duration-200"
                  />
                </div>

              </div>

              {/* Resolved account holder name */}
              {withdrawAccNum.length > 0 && (
                <div className="p-4 rounded-xl border border-[#135D39]/15 flex items-center justify-between bg-[#135D39]/5 text-xs text-[#1A2421]">
                  <div className="flex items-center gap-2">
                    <Building className="w-4 h-4 text-[#135D39] shrink-0" />
                    <span className="font-medium text-[#5C6460]">Recipient Account Holder:</span>
                  </div>
                  {resolvedAccountName ? (
                    <span className="font-bold text-[#135D39] uppercase tracking-wide flex items-center gap-1">
                      <CheckCircle className="w-4 h-4 text-[#135D39] inline" /> {resolvedAccountName}
                    </span>
                  ) : (
                    <span className="text-[#E7A13C] font-semibold animate-pulse flex items-center gap-1">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#E7A13C] inline" /> Resolving NUBAN holder...
                    </span>
                  )}
                </div>
              )}

              {/* Withdrawal Amount */}
              <div className="space-y-1.5">
                <label className="text-xs text-[#5C6460] font-bold uppercase tracking-wider block">Withdrawal Capital Amount (₦)</label>
                <div className="relative">
                  <span className="absolute left-4 top-3 font-mono font-bold text-stone-400 text-sm">₦</span>
                  <input 
                    type="number" 
                    required
                    placeholder="Enter payout volume"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value === "" ? "" : Number(e.target.value))}
                    className="w-full bg-[#FAF8F5]/60 hover:bg-[#FAF8F5] focus:bg-white border border-[#E6E5DF] focus:border-[#135D39] focus:ring-2 focus:ring-[#135D39]/10 p-3 pl-8 rounded-xl font-mono text-base font-bold text-[#1A2421] outline-none transition-all duration-200"
                  />
                </div>
                <div className="flex justify-between items-center text-[10.5px] text-[#5C6460] px-1 pt-1.5 flex-wrap gap-2">
                  <span>Available Balance: <span className="font-mono text-[#1A2421] font-bold">{formatCurrency(state.walletBalance)}</span></span>
                  <span className="text-[#E7A13C] font-semibold flex items-center gap-0.5">
                    <AlertCircle className="w-3 h-3 text-[#E7A13C] inline" /> Flat clearance fee of ₦52 NGN
                  </span>
                </div>
              </div>

              <button
                type="submit"
                disabled={isWithdrawing || !resolvedAccountName}
                className="w-full bg-[#135D39] hover:bg-[#0f4a2d] disabled:opacity-30 disabled:cursor-not-allowed text-white font-bold py-3.5 px-4 rounded-xl text-xs uppercase tracking-wider transition-all duration-200 cursor-pointer shadow-md shadow-[#135D39]/10 hover:shadow-lg hover:shadow-[#135D39]/15 border border-[#135D39]/15"
              >
                {isWithdrawing ? "Executing Inter-Bank Dispatch Wire..." : "Initiate Direct Bank Cash-Out"}
              </button>
            </form>
          </div>
        )}

        {/* Tab Content 4: Peer Member Transfer */}
        {activeTab === "transfer" && (
          <div className="max-w-2xl mx-auto space-y-6">
            <h3 className="font-display font-semibold text-[#1A2421] text-lg text-center">Instant Cooperative Partner Cash Transfer</h3>
            
            <form onSubmit={handleTransferExec} className="space-y-6 border border-[#E6E5DF] p-6 md:p-8 rounded-[24px] bg-white hover:border-[#135D39]/30 transition-all duration-300 shadow-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Peer ID */}
                <div className="space-y-1.5">
                  <label className="text-xs text-[#5C6460] font-bold uppercase tracking-wider">Recipient Member Card ID</label>
                  <input 
                    type="text" 
                    required
                    placeholder="e.g. COOP-FARM-9062"
                    value={transferRecipId}
                    onChange={(e) => setTransferRecipId(e.target.value)}
                    className="w-full bg-[#FAF8F5]/60 hover:bg-[#FAF8F5] focus:bg-white border border-[#E6E5DF] focus:border-[#135D39] focus:ring-2 focus:ring-[#135D39]/10 p-3 rounded-xl font-mono text-sm font-bold uppercase text-[#1A2421] outline-none transition-all duration-200"
                  />
                </div>

                {/* Amount */}
                <div className="space-y-1.5">
                  <label className="text-xs text-[#5C6460] font-bold uppercase tracking-wider">Transfer Capital Amount (₦)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-3 font-mono font-bold text-[#5C6460]/75 text-sm">₦</span>
                    <input 
                      type="number" 
                      required
                      placeholder="e.g. 15,000"
                      value={transferAmount}
                      onChange={(e) => setTransferAmount(e.target.value === "" ? "" : Number(e.target.value))}
                      className="w-full bg-[#FAF8F5]/60 hover:bg-[#FAF8F5] focus:bg-white border border-[#E6E5DF] focus:border-[#135D39] focus:ring-2 focus:ring-[#135D39]/10 p-3 pl-8 rounded-xl font-mono text-sm font-bold text-[#1A2421] outline-none transition-all duration-200"
                    />
                  </div>
                </div>

              </div>

              {/* Resolved Member name and validation block */}
              {transferRecipId.length > 4 && (
                <div className="p-4 rounded-xl border border-[#135D39]/15 flex items-center justify-between bg-[#135D39]/5 text-xs text-[#1A2421]">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-[#135D39] shrink-0" />
                    <span className="font-medium text-[#5C6460]">Cooperative Recipient:</span>
                  </div>
                  {resolvedRecipName ? (
                    <span className="font-bold text-[#135D39] uppercase text-xs flex items-center gap-1 font-bold">
                      <CheckCircle className="w-4 h-4 text-[#135D39] inline" /> {resolvedRecipName}
                    </span>
                  ) : (
                    <span className="text-[#E7A13C] font-semibold animate-pulse flex items-center gap-1">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#E7A13C] inline" /> Checking co-op member roster...
                    </span>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={isTransferring}
                className="w-full bg-[#135D39] hover:bg-[#0f4a2d] disabled:opacity-30 disabled:cursor-not-allowed text-white font-bold py-3.5 px-4 rounded-xl text-xs uppercase tracking-wider transition-all duration-200 cursor-pointer shadow-md shadow-[#135D39]/10 hover:shadow-lg hover:shadow-[#135D39]/15 border border-[#135D39]/15"
              >
                {isTransferring ? "Executing Ledger Book Swap secure transfer..." : `Transfer to ${resolvedRecipName || "Co-op Partner"}`}
              </button>
            </form>
          </div>
        )}

      </div>
    </div>
  );
}
