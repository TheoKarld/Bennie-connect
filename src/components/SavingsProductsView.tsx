/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { 
  PiggyBank, 
  Target, 
  Lock, 
  Sprout, 
  Plus, 
  ArrowRight, 
  TrendingUp, 
  Calendar, 
  ChevronRight, 
  ArrowLeft, 
  AlertTriangle, 
  CheckCircle,
  HelpCircle,
  Clock
} from "lucide-react";
import { FarmerAppState, TargetSavingGoal, FixedSaveLock, HarvestSavePlan } from "../types";
import { CROP_TYPES, GOAL_CATEGORIES } from "../data";

interface SavingsProductsViewProps {
  state: FarmerAppState;
  onFlexDeposit: (amount: number) => void;
  onFlexWithdraw: (amount: number) => void;
  onAddTargetGoal: (goal: Omit<TargetSavingGoal, "id" | "currentAmount" | "status">) => void;
  onAddFundsToTarget: (goalId: string, amount: number) => void;
  onWithdrawTargetGoal: (goalId: string) => void;
  onAddFixedLock: (lock: Omit<FixedSaveLock, "id" | "status" | "accumulatedInterest">) => void;
  onWithdrawFixedLock: (lockId: string) => void;
  onAddHarvestPlan: (plan: Omit<HarvestSavePlan, "id" | "amountSaved" | "status">, initialDeposit: number) => void;
}

export default function SavingsProductsView({
  state,
  onFlexDeposit,
  onFlexWithdraw,
  onAddTargetGoal,
  onAddFundsToTarget,
  onWithdrawTargetGoal,
  onAddFixedLock,
  onWithdrawFixedLock,
  onAddHarvestPlan
}: SavingsProductsViewProps) {
  // Navigation: "menu" | "flex" | "target" | "fixed" | "harvest"
  const [activeSubView, setActiveSubView] = useState<"menu" | "flex" | "target" | "fixed" | "harvest">("menu");

  // Flex form states
  const [flexAmt, setFlexAmt] = useState<number | " text-[#1A2421]">("");
  const [flexActionType, setFlexActionType] = useState<"deposit" | "withdraw">("deposit");

  // Target Goal form states
  const [isNewGoalModalOpen, setIsNewGoalModalOpen] = useState(false);
  const [newGoalTitle, setNewGoalTitle] = useState("");
  const [newGoalTarget, setNewGoalTarget] = useState<number | "">("");
  const [newGoalEndDate, setNewGoalEndDate] = useState("");
  const [newGoalCategory, setNewGoalCategory] = useState("Tractor");
  
  // Target Goal Top Up States
  const [selectedGoalForTopUp, setSelectedGoalForTopUp] = useState<string | null>(null);
  const [topUpAmount, setTopUpAmount] = useState<number | "">("");

  // Fixed Lock form states
  const [isNewLockModalOpen, setIsNewLockModalOpen] = useState(false);
  const [newLockAmt, setNewLockAmt] = useState<number | "">("");
  const [newLockPeriod, setNewLockPeriod] = useState<"3" | "6" | "12">("6"); // Months
  const [autoRenewLock, setAutoRenewLock] = useState(true);

  // Harvest Save state
  const [isNewHarvestModalOpen, setIsNewHarvestModalOpen] = useState(false);
  const [harvestTitle, setHarvestTitle] = useState("");
  const [selectedCrop, setSelectedCrop] = useState("Maize");
  const [harvestSeason, setHarvestSeason] = useState("Dry Season 2026/27");
  const [harvestReleaseDate, setHarvestReleaseDate] = useState("");
  const [harvestInitialAmt, setHarvestInitialAmt] = useState<number | "">("");

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Calculations
  const totalTargetOngoing = state.targetGoals.reduce((sum, g) => sum + (g.status === "ongoing" ? g.currentAmount : 0), 0);
  const totalFixedVal = state.fixedLocks.reduce((sum, d) => sum + (d.status === "locked" ? d.amount : 0), 0);
  const totalHarvestVal = state.harvestPlans.reduce((sum, p) => sum + (p.status === "active" ? p.amountSaved : 0), 0);
  const totalSavingsAgg = state.flexSaveBalance + totalTargetOngoing + totalFixedVal + totalHarvestVal;

  const handleFlexActionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = Number(flexAmt);
    if (!val || val <= 0) {
      alert("Invalid savings transaction volume.");
      return;
    }

    if (flexActionType === "deposit") {
      if (state.walletBalance < val) {
        alert("Insufficient Digital Wallet liquid balance to fund Flex Save.");
        return;
      }
      onFlexDeposit(val);
      alert(`Success! Standard deposit of ${formatCurrency(val)} moved into high-yield Flex Save account.`);
    } else {
      if (state.flexSaveBalance < val) {
        alert("Insufficient high-yield Flex Save funds available for this instant withdrawal.");
        return;
      }
      onFlexWithdraw(val);
      alert(`Success! Transferred ${formatCurrency(val)} instantly from Flex Save into your Digital Wallet.`);
    }
    setFlexAmt("");
  };

  // Handle building new Savings Goals
  const handleCreateTargetGoal = (e: React.FormEvent) => {
    e.preventDefault();
    const goalAmt = Number(newGoalTarget);
    if (!newGoalTitle.trim() || !goalAmt || goalAmt <= 0 || !newGoalEndDate) {
      alert("Fill in all target saving validation parameters.");
      return;
    }

    onAddTargetGoal({
      title: newGoalTitle.trim(),
      targetAmount: goalAmt,
      startDate: new Date().toISOString().split("T")[0],
      endDate: newGoalEndDate,
      category: newGoalCategory,
      interestRate: 11.5
    });

    setIsNewGoalModalOpen(false);
    setNewGoalTitle("");
    setNewGoalTarget("");
    setNewGoalEndDate("");
  };

  const handleAddFundsToGoalSubmit = (e: React.FormEvent, goalId: string) => {
    e.preventDefault();
    const addAmt = Number(topUpAmount);
    if (!addAmt || addAmt <= 0) {
      alert("Input a valid savings amount.");
      return;
    }
    if (state.walletBalance < addAmt) {
      alert("Insufficient digital wallet funds.");
      return;
    }
    onAddFundsToTarget(goalId, addAmt);
    setSelectedGoalForTopUp(null);
    setTopUpAmount("");
    alert(`Success! Top-up of ${formatCurrency(addAmt)} added directly to goal.`);
  };

  // Handle building Fixed Lock positions
  const handleCreateFixedLock = (e: React.FormEvent) => {
    e.preventDefault();
    const lAmt = Number(newLockAmt);
    if (!lAmt || lAmt <= 0) {
      alert("Please specify lock size.");
      return;
    }
    if (state.walletBalance < lAmt) {
      alert("Insufficient Digital Wallet liquid funds to build Fixed Lock.");
      return;
    }

    // Determine lock end date & corresponding APY
    const now = new Date();
    const months = parseInt(newLockPeriod);
    now.setMonth(now.getMonth() + months);
    
    let apyRate = 12.0; // 3 months
    if (months === 6) apyRate = 13.5;
    if (months === 12) apyRate = 14.5;

    onAddFixedLock({
      amount: lAmt,
      startDate: new Date().toISOString().split("T")[0],
      lockedUntil: now.toISOString().split("T")[0],
      interestRate: apyRate,
      autoRenew: autoRenewLock
    });

    setIsNewLockModalOpen(false);
    setNewLockAmt("");
  };

  // Handle creating crop Harvest plans
  const handleCreateHarvestPlan = (e: React.FormEvent) => {
    e.preventDefault();
    const initAmt = Number(harvestInitialAmt);
    if (!harvestTitle.trim() || !harvestReleaseDate || !initAmt || initAmt <= 0) {
      alert("Please specify crop name, release period, and initial crop-setup deposit.");
      return;
    }
    if (state.walletBalance < initAmt) {
      alert("Insufficient wallet funds to make initial harvest deposit.");
      return;
    }

    onAddHarvestPlan({
      title: harvestTitle.trim(),
      cropType: selectedCrop,
      targetSeason: harvestSeason,
      releaseDate: harvestReleaseDate,
      interestRate: 12.5,
    }, initAmt);

    setIsNewHarvestModalOpen(false);
    setHarvestTitle("");
    setHarvestReleaseDate("");
    setHarvestInitialAmt("");
  };

  return (
    <div className="space-y-8 animate-fade-in px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      
      {/* Title & Navigation row */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            {activeSubView !== "menu" && (
              <button 
                onClick={() => setActiveSubView("menu")}
                className="p-1.5 hover:bg-[#FAF8F5] rounded-xl transition text-[#5C6460] mr-1 border border-[#E6E5DF] bg-white cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4 text-[#1A2421]" />
              </button>
            )}
            <h1 className="text-2xl md:text-3xl font-display font-medium text-[#1A2421] tracking-tight">
              {activeSubView === "menu" && "Cooperative Savings Portfolio"}
              {activeSubView === "flex" && "Flex Save High-Yield Liquid Access"}
              {activeSubView === "target" && "Target Save: Goal-Based Accumulator"}
              {activeSubView === "fixed" && "Fixed Save: Premium locked Positions"}
              {activeSubView === "harvest" && "Harvest Save: Crop Seasonal Accruals"}
            </h1>
          </div>
          <p className="text-sm text-[#5C6460] mt-1 font-medium">
            {activeSubView === "menu" && "Multiply interest safely and easily using our segmented farm savings structures."}
            {activeSubView === "flex" && "Earn 8.5% annual interest. Withdraw/deposit anytime without hidden lockup penalizations."}
            {activeSubView === "target" && "Target-based savings built for specialized farm capital goals yielding 11.5% APY."}
            {activeSubView === "fixed" && "Secure higher locked returns of up to 14.5% APY. Completely safely and hassle-free."}
            {activeSubView === "harvest" && "Align financial liquid-reserves directly to seasonal harvesting cycles of essential crops."}
          </p>
        </div>

        {activeSubView === "menu" && (
          <div className="bg-[#135D39]/10 text-[#135D39] border border-[#135D39]/15 p-4 rounded-2xl text-right shadow-sm max-w-xs w-full sm:w-auto">
            <span className="text-[10px] text-[#135D39] block uppercase font-bold tracking-wider">AGGREGATE SAVINGS VOLUMES</span>
            <span className="font-mono text-xl md:text-2xl font-bold tracking-tight block mt-0.5">{formatCurrency(totalSavingsAgg)}</span>
          </div>
        )}
      </div>

      {/* SUBVIEW 1: Main Product Categories Menu */}
      {activeSubView === "menu" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* 1. Flex Save Card */}
          <div 
            onClick={() => setActiveSubView("flex")}
            className="bg-white border border-[#E6E5DF] rounded-3xl p-6 shadow-sm hover:border-[#135D39]/30 cursor-pointer transition-all duration-300 group flex flex-col justify-between"
          >
            <div>
              <div className="flex justify-between items-start">
                <div className="p-3.5 bg-[#135D39]/10 text-[#135D39] rounded-2xl border border-[#135D39]/10">
                  <PiggyBank className="w-6 h-6" />
                </div>
                <span className="text-[11px] font-bold text-[#135D39] bg-[#135D39]/10 border border-[#135D39]/15 px-3 py-1 rounded-full font-mono">
                  8.5% APY
                </span>
              </div>
              <h3 className="text-lg font-display font-semibold text-[#1A2421] mt-5">Flex Save</h3>
              <p className="text-xs text-[#5C6460] mt-1 leading-relaxed">
                Your everyday financial safety net. Complete liquidity. Deposit extra cash, or transfer out back to wallet anytime instantly.
              </p>
            </div>
            <div className="mt-8 pt-4 border-t border-[#E6E5DF] flex justify-between items-center text-xs">
              <span className="font-mono font-bold text-[#1A2421]">Balance: {formatCurrency(state.flexSaveBalance)}</span>
              <span className="text-[#135D39] group-hover:translate-x-1 transition flex items-center gap-1 font-bold">
                Enter account <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>

          {/* 2. Target Save Card */}
          <div 
            onClick={() => setActiveSubView("target")}
            className="bg-white border border-[#E6E5DF] rounded-3xl p-6 shadow-sm hover:border-[#135D39]/30 cursor-pointer transition-all duration-300 group flex flex-col justify-between"
          >
            <div>
              <div className="flex justify-between items-start">
                <div className="p-3.5 bg-[#E7A13C]/10 text-[#E7A13C] rounded-2xl border border-[#E7A13C]/10">
                  <Target className="w-6 h-6" />
                </div>
                <span className="text-[11px] font-bold text-[#E7A13C] bg-[#E7A13C]/10 border border-[#E7A13C]/15 px-3 py-1 rounded-full font-mono">
                  11.5% APY
                </span>
              </div>
              <h3 className="text-lg font-display font-semibold text-[#1A2421] mt-5">Target Save</h3>
              <p className="text-xs text-[#5C6460] mt-1 leading-relaxed">
                Plan specifically for tractor rental deposits, seed bundles, or fertilizer orders. Save individually or with partner farmers.
              </p>
            </div>
            <div className="mt-8 pt-4 border-t border-[#E6E5DF] flex justify-between items-center text-xs">
              <span className="font-mono font-bold text-[#1A2421]">Active Goals: {state.targetGoals.filter(g=>g.status === "ongoing").length} Ongoing</span>
              <span className="text-[#135D39] group-hover:translate-x-1 transition flex items-center gap-1 font-bold">
                View goals <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>

          {/* 3. Fixed Save Card */}
          <div 
            onClick={() => setActiveSubView("fixed")}
            className="bg-white border border-[#E6E5DF] rounded-3xl p-6 shadow-sm hover:border-[#135D39]/30 cursor-pointer transition-all duration-300 group flex flex-col justify-between"
          >
            <div>
              <div className="flex justify-between items-start">
                <div className="p-3.5 bg-sky-100 text-sky-850 rounded-2xl border border-sky-150">
                  <Lock className="w-6 h-6" />
                </div>
                <span className="text-[11px] font-bold text-sky-850 bg-sky-50 border border-sky-150 px-3 py-1 rounded-full font-mono">
                  Up to 14.5% APY
                </span>
              </div>
              <h3 className="text-lg font-display font-semibold text-[#1A2421] mt-5">Fixed Save</h3>
              <p className="text-xs text-[#5C6460] mt-1 leading-relaxed">
                Lock excess capital for 3, 6, or 12 months. Yield premium returns without market volatility risks.
              </p>
            </div>
            <div className="mt-8 pt-4 border-t border-[#E6E5DF] flex justify-between items-center text-xs">
              <span className="font-mono font-bold text-[#1A2421]">Total locked capital: {formatCurrency(totalFixedVal)}</span>
              <span className="text-[#135D39] group-hover:translate-x-1 transition flex items-center gap-1 font-bold">
                Lock funds <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>

          {/* 4. Harvest Save Card */}
          <div 
            onClick={() => setActiveSubView("harvest")}
            className="bg-white border border-[#E6E5DF] rounded-3xl p-6 shadow-sm hover:border-[#135D39]/30 cursor-pointer transition-all duration-300 group flex flex-col justify-between"
          >
            <div>
              <div className="flex justify-between items-start">
                <div className="p-3.5 bg-emerald-50 text-[#135D39] rounded-2xl border border-emerald-150">
                  <Sprout className="w-6 h-6" />
                </div>
                <span className="text-[11px] font-bold text-[#135D39] bg-emerald-100 border border-emerald-150 px-3 py-1 rounded-full font-mono">
                  12.5% APY
                </span>
              </div>
              <h3 className="text-lg font-display font-semibold text-[#1A2421] mt-5">Harvest Save</h3>
              <p className="text-xs text-[#5C6460] mt-1 leading-relaxed">
                Specialized seasonal crop-driven tracker savings. Release funds to purchase seedlings exactly when sowing season opens up.
              </p>
            </div>
            <div className="mt-8 pt-4 border-t border-[#E6E5DF] flex justify-between items-center text-xs">
              <span className="font-mono font-bold text-[#1A2421]">Seasonal Plans: {state.harvestPlans.length} Active</span>
              <span className="text-[#135D39] group-hover:translate-x-1 transition flex items-center gap-1 font-bold">
                Configure plan <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>

        </div>
      )}

      {/* SUBVIEW 2: Flex Save Details */}
      {activeSubView === "flex" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-[#FAF8F5] border border-[#E6E5DF] rounded-3xl p-6 space-y-4">
              <h4 className="font-semibold text-[#1A2421] text-sm">Flex Liquidity Summary</h4>
              
              <div className="space-y-3">
                <div className="flex justify-between text-xs py-1.5 border-b border-[#E6E5DF]">
                  <span className="text-[#5C6460]">Flex Savings Balance:</span>
                  <span className="font-mono font-bold text-[#1A2421]">{formatCurrency(state.flexSaveBalance)}</span>
                </div>
                <div className="flex justify-between text-xs py-1.5 border-b border-[#E6E5DF]">
                  <span className="text-[#5C6460]">Interest Accrued This Month:</span>
                  <span className="font-mono text-emerald-800 font-bold">+{formatCurrency(state.flexSaveAccruedInterest)}</span>
                </div>
                <div className="flex justify-between text-xs py-1.5">
                  <span className="text-[#5C6460]">Current Interest Rate:</span>
                  <span className="font-mono font-bold text-[#1A2421]">8.50% APY Rate</span>
                </div>
              </div>

              <div className="bg-white p-3 rounded-xl text-[10.5px] border border-[#E6E5DF] leading-relaxed text-[#5C6460] flex gap-2">
                <TrendingUp className="w-4 h-4 text-[#135D39] shrink-0" />
                Interest is accrued daily in the cooperative ledger, compounding automatically at the standard rate.
              </div>
            </div>
          </div>

          <div className="lg:col-span-7">
            <div className="bg-white border border-[#E6E5DF] rounded-3xl p-6 shadow-sm">
              <h4 className="font-semibold text-[#1A2421] text-sm">Direct Wallet ⇄ Flex Savings Swap</h4>
              
              <form onSubmit={handleFlexActionSubmit} className="mt-5 space-y-4">
                <div className="flex space-x-1 bg-[#FAF8F5] p-1 rounded-xl border border-[#E6E5DF]">
                  <button
                    type="button"
                    onClick={() => setFlexActionType("deposit")}
                    className={`flex-1 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
                      flexActionType === "deposit" ? "bg-white text-[#1A2421] shadow-sm border border-[#E6E5DF]" : "text-[#5C6460] hover:text-[#1A2421]"
                    }`}
                  >
                    Deposit Savings (Wallet → Flex Save)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFlexActionType("withdraw")}
                    className={`flex-1 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
                      flexActionType === "withdraw" ? "bg-white text-[#1A2421] shadow-sm border border-[#E6E5DF]" : "text-[#5C6460] hover:text-[#1A2421]"
                    }`}
                  >
                    Withdraw Funds (Flex Save → Wallet)
                  </button>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-[#5C6460] font-bold uppercase tracking-wider block">Swap Capital Amount (₦)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-3 font-mono font-bold text-stone-400 text-sm">₦</span>
                    <input 
                      type="number" 
                      required
                      placeholder="e.g. 20,000"
                      value={flexAmt}
                      onChange={(e) => setFlexAmt(e.target.value === "" ? "" : Number(e.target.value))}
                      className="w-full bg-white border border-[#E6E5DF] focus:outline-[#135D39]/30 p-3 pl-8 rounded-xl font-mono text-base font-bold text-[#1A2421]"
                    />
                  </div>
                  <div className="flex justify-between items-center pt-1.5 px-1 text-[10.5px] flex-wrap gap-2 text-[#5C6460]">
                    <span>Available Digital Wallet: <span className="font-mono text-[#1A2421] font-semibold">{formatCurrency(state.walletBalance)}</span></span>
                    <span>Available Flex Save: <span className="font-mono text-[#1A2421] font-semibold">{formatCurrency(state.flexSaveBalance)}</span></span>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-[#135D39] hover:bg-[#0f4a2d] text-white font-bold py-3 px-4 rounded-xl text-xs transition border border-[#135D39]/15 shadow-sm"
                >
                  {flexActionType === "deposit" ? "Transfer Capital Into Flex Save" : "Withdraw Back to Liquid Wallet"}
                </button>
              </form>
            </div>
          </div>

        </div>
      )}

      {/* SUBVIEW 3: Target Save Details */}
      {activeSubView === "target" && (
        <div className="space-y-6">
          <div className="flex justify-between items-center gap-4 flex-wrap">
            <h3 className="font-display font-semibold text-[#1A2421] text-base">My Goal-Based Savings Targets</h3>
            <button 
              onClick={() => setIsNewGoalModalOpen(true)}
              className="flex items-center gap-1.5 bg-[#135D39] hover:bg-[#0f4a2d] text-white font-bold py-2 px-3.5 rounded-xl text-xs transition cursor-pointer border border-[#135D39]/15"
            >
              <Plus className="w-4 h-4" /> Initialize Savings Target
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {state.targetGoals.map((g) => {
              const progressPct = Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100));
              return (
                <div key={g.id} className="bg-white border border-[#E6E5DF] rounded-3xl p-5 shadow-sm relative flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start gap-2">
                      <span className="bg-[#FAF8F5] text-[#5C6460] text-[10px] px-2 py-0.5 rounded font-mono font-bold uppercase border border-[#E6E5DF]">
                        {g.category}
                      </span>
                      <span className="text-[10px] font-bold text-[#E7A13C] bg-[#E7A13C]/10 px-2 py-0.5 rounded border border-[#E7A13C]/15">
                        {g.interestRate}% APY Rate
                      </span>
                    </div>

                    <h4 className="font-semibold text-[#1A2421] text-sm mt-3">{g.title}</h4>
                    
                    <div className="mt-4 space-y-1">
                      <div className="flex justify-between text-xs text-[#5C6460]">
                        <span>Paid: <span className="font-mono font-bold text-[#1A2421]">{formatCurrency(g.currentAmount)}</span></span>
                        <span>Goal: <span className="font-mono text-[#5C6460]">{formatCurrency(g.targetAmount)}</span></span>
                      </div>

                      {/* Custom Progress Gauge */}
                      <div className="w-full bg-[#FAF8F5] h-2.5 rounded-full overflow-hidden mt-1.5 border border-[#E6E5DF]">
                        <div 
                          className="bg-[#135D39] h-full rounded-full transition-all duration-300" 
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-[#5C6460] pt-1">
                        <span>Progress Metric</span>
                        <span className="font-mono font-bold text-[#135D39]">{progressPct}% Met</span>
                      </div>
                    </div>

                    <div className="mt-4 pt-3.5 border-t border-[#E6E5DF] grid grid-cols-2 gap-2 text-[10.5px] text-[#5C6460]">
                      <div>
                        <span className="text-stone-400 block">Release Target</span>
                        <span className="font-mono block text-[#1A2421] font-semibold mt-0.5">{g.endDate}</span>
                      </div>
                      <div>
                        <span className="text-stone-400 block">Goal Status</span>
                        <span className={`font-mono block font-bold capitalize mt-0.5 ${g.status === "completed" ? "text-emerald-700" : "text-[#E7A13C]"}`}>
                          ● {g.status}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Goal action inline panel */}
                  {g.status === "ongoing" ? (
                    <div className="mt-6 pt-4 border-t border-[#E6E5DF] flex gap-2">
                      {selectedGoalForTopUp === g.id ? (
                        <form onSubmit={(e) => handleAddFundsToGoalSubmit(e, g.id)} className="w-full flex gap-1 animate-fade-in text-stone-900">
                          <input 
                            type="number" 
                            required 
                            autoFocus
                            placeholder="₦ Amount"
                            value={topUpAmount}
                            onChange={(e) => setTopUpAmount(e.target.value === "" ? "" : Number(e.target.value))}
                            className="bg-white border border-[#E6E5DF] focus:outline-[#135D39]/30 px-2.5 py-1.5 rounded-lg text-xs font-mono font-semibold flex-1"
                          />
                          <button 
                            type="submit" 
                            className="bg-[#135D39] hover:bg-[#0f4a2d] text-white px-3 py-1.5 rounded-lg text-xs font-bold"
                          >
                            Add
                          </button>
                          <button 
                            type="button" 
                            onClick={() => { setSelectedGoalForTopUp(null); setTopUpAmount(""); }}
                            className="bg-[#FAF8F5] text-[#5C6460] px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-[#E6E5DF]"
                          >
                            Cancel
                          </button>
                        </form>
                      ) : (
                        <>
                          <button 
                            onClick={() => { setSelectedGoalForTopUp(g.id); setTopUpAmount(""); }}
                            className="flex-1 bg-[#135D39] hover:bg-[#0f4a2d] text-white text-center py-2 rounded-xl text-[11px] font-bold transition border border-[#135D39]/15"
                          >
                            Accrue Top-Up Funds
                          </button>
                          {progressPct >= 105 && (
                            <button 
                              onClick={() => {
                                onWithdrawTargetGoal(g.id);
                                alert(`Target savings goal broken! Total capital payout returned to wallet.`);
                              }}
                              className="bg-[#FAF8F5] text-stone-800 hover:bg-[#FAF8F5] px-3 py-2 rounded-xl text-[11px] font-semibold transition border border-[#E6E5DF]"
                            >
                              Cash-Out
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  ) : g.status === "completed" ? (
                    <div className="mt-6 pt-4 border-t border-[#E6E5DF]">
                      <button 
                        onClick={() => {
                          onWithdrawTargetGoal(g.id);
                          alert(`Success! Goal target cleared and payouts returned to Digital Wallet.`);
                        }}
                        className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-2 rounded-xl text-[11px] text-center transition block border border-emerald-800/20"
                      >
                        Break Goal Target and Withdraw (100% met!)
                      </button>
                    </div>
                  ) : (
                    <div className="mt-6 pt-4 border-t border-[#E6E5DF] text-center text-xs text-[#5C6460] italic font-medium">
                      Accrued payouts returned to Wallet balance.
                    </div>
                  )}

                </div>
              );
            })}
          </div>

          {/* New Savings Target Goal Modal */}
          {isNewGoalModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/45 backdrop-blur-xs">
              <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-lg border border-[#E6E5DF] absolute">
                <h4 className="font-display font-semibold text-[#1A2421] text-base flex items-center gap-2">
                  <Target className="w-5 h-5 text-[#135D39]" /> Start New Goal Target
                </h4>
                
                <form onSubmit={handleCreateTargetGoal} className="mt-4 space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10.5px] text-[#5C6460] font-bold uppercase tracking-wider">Goal Title / Milestone Name</label>
                    <input 
                      type="text" 
                      required
                      placeholder="e.g. Tractor Lease Allocation"
                      value={newGoalTitle}
                      onChange={(e) => setNewGoalTitle(e.target.value)}
                      className="w-full bg-[#FAF8F5] border border-[#E6E5DF] focus:outline-[#135D39]/30 p-2.5 rounded-xl text-xs text-[#1A2421] font-semibold"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10.5px] text-[#5C6460] font-bold uppercase tracking-wider">Target savings (₦)</label>
                      <input 
                        type="number" 
                        required
                        placeholder="e.g. 250,000"
                        value={newGoalTarget}
                        onChange={(e) => setNewGoalTarget(e.target.value === "" ? "" : Number(e.target.value))}
                        className="w-full bg-[#FAF8F5] border border-[#E6E5DF] focus:outline-[#135D39]/30 p-2.5 rounded-xl text-xs font-mono font-bold text-[#1A2421]"
                      />
                    </div>
                    
                    <div className="space-y-1">
                      <label className="text-[10.5px] text-[#5C6460] font-bold uppercase tracking-wider">Goal Category</label>
                      <select
                        value={newGoalCategory}
                        onChange={(e) => setNewGoalCategory(e.target.value)}
                        className="w-full bg-[#FAF8F5] border border-[#E6E5DF] focus:outline-[#135D39]/30 p-2.5 rounded-xl text-xs text-stone-700 font-medium"
                      >
                        {GOAL_CATEGORIES.map((cat) => (
                          <option key={cat.value} value={cat.value}>{cat.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10.5px] text-[#5C6460] font-bold uppercase tracking-wider">Release Target Date</label>
                    <input 
                      type="date" 
                      required
                      min={new Date().toISOString().split("T")[0]}
                      value={newGoalEndDate}
                      onChange={(e) => setNewGoalEndDate(e.target.value)}
                      className="w-full bg-[#FAF8F5] border border-[#E6E5DF] focus:outline-[#135D39]/30 p-2.5 rounded-xl text-xs font-mono text-stone-850"
                    />
                  </div>

                  <p className="text-[10px] text-[#5C6460] bg-emerald-50 border border-emerald-100 p-2.5 rounded-xl leading-relaxed">
                    🌟 <span className="font-bold text-[#135D39]">Earn 11.5% APY</span> on your targeted savings! Payout is fully completed immediately upon reaching the target maturity date.
                  </p>

                  <div className="flex gap-3 pt-2">
                    <button 
                      type="button" 
                      onClick={() => setIsNewGoalModalOpen(false)}
                      className="flex-1 bg-[#FAF8F5] hover:bg-stone-50 text-[#1A2421] border border-[#E6E5DF] py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer"
                    >
                      Back
                    </button>
                    <button 
                      type="submit" 
                      className="flex-1 bg-[#135D39] hover:bg-[#0f4a2d] text-white py-2.5 rounded-xl text-xs font-bold transition cursor-pointer"
                    >
                      Build Target
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

        </div>
      )}

      {/* SUBVIEW 4: Fixed Save Details */}
      {activeSubView === "fixed" && (
        <div className="space-y-6">
          <div className="flex justify-between items-center gap-4 flex-wrap">
            <h3 className="font-display font-semibold text-[#1A2421] text-base">My Fixed Lock Savings Positions</h3>
            <button 
              onClick={() => setIsNewLockModalOpen(true)}
              className="flex items-center gap-1.5 bg-[#135D39] hover:bg-[#0f4a2d] text-white font-bold py-2 px-3.5 rounded-xl text-xs transition cursor-pointer border border-[#135D39]/15"
            >
              <Plus className="w-4 h-4" /> Secure New Fixed Lock
            </button>
          </div>

          <div className="space-y-4">
            {state.fixedLocks.map((l) => {
              const isLocked = l.status === "locked";
              return (
                <div key={l.id} className="bg-white border border-[#E6E5DF] rounded-3xl p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden text-stone-900">
                  {/* Visual accent left line */}
                  <div className="absolute top-0 bottom-0 left-0 w-2.5 bg-[#135D39]" />

                  <div className="space-y-1.5 max-w-lg">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h4 className="font-mono text-lg font-bold text-[#1A2421]">{formatCurrency(l.amount)}</h4>
                      <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${
                        isLocked 
                          ? "bg-amber-50 text-amber-700 border-amber-200" 
                          : "bg-emerald-50 text-emerald-800 border-emerald-150"
                      }`}>
                        {l.status}
                      </span>
                      <span className="text-xs font-bold text-[#135D39] bg-[#135D39]/10 px-2.5 py-0.5 rounded border border-[#135D39]/15 font-mono">
                        {l.interestRate}% interest (APY Rate)
                      </span>
                    </div>
                    
                    <p className="text-xs text-[#5C6460] leading-relaxed font-semibold">
                      Locked on: <span className="font-mono text-[#1A2421]">{l.startDate}</span> • Matures & Unlocks: <span className="font-mono text-[#135D39] underline">{l.lockedUntil}</span>
                    </p>

                    <div className="flex items-center gap-4 text-xs font-bold pt-1">
                      <span className="text-[#5C6460]">Yield Accrued to Date:</span>
                      <span className="font-mono text-[#135D39] bg-[#135D39]/10 px-2 py-0.5 rounded">+{formatCurrency(l.accumulatedInterest)}</span>
                      {l.autoRenew && (
                        <span className="text-[#135D39] bg-[#135D39]/5 px-2 py-0.5 rounded text-[10px] font-mono flex items-center gap-0.5 border border-[#135D39]/10 animate-pulse">
                          🔄 Auto Rollover Enabled
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    {isLocked ? (
                      <button 
                        onClick={() => {
                          const conf = window.confirm("WARNING: Breaking an active lockup position before its maturity date results in up to 2.5% penalty of accrued yields. Continue?");
                          if (conf) {
                            onWithdrawFixedLock(l.id);
                            alert("Fixed Lock broken. Principal minus penalty returned to Digital Wallet balance.");
                          }
                        }}
                        className="text-xs bg-rose-50 text-rose-700 hover:bg-rose-100 px-4 py-2 rounded-xl transition border border-rose-200 font-bold"
                      >
                        Force Break Lock (Accrue Penalty)
                      </button>
                    ) : l.status === "matured" ? (
                      <button 
                        onClick={() => {
                          onWithdrawFixedLock(l.id);
                          alert(`Success! Matured Lock returned principal and accrued yields of ${formatCurrency(l.accumulatedInterest)} to Wallet.`);
                        }}
                        className="text-xs bg-[#135D39] hover:bg-[#0f4a2d] font-bold text-white px-5 py-2.5 rounded-xl transition"
                      >
                        Payout Matured lock & Payouts +
                      </button>
                    ) : (
                      <span className="text-xs text-[#5C6460] italic font-medium">Withdrawn to Wallet balance.</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* New Locked Deposit Modal */}
          {isNewLockModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/45 backdrop-blur-xs">
              <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-lg border border-[#E6E5DF] absolute">
                <h4 className="font-display font-semibold text-[#1A2421] text-base flex items-center gap-2">
                  <Lock className="w-5 h-5 text-[#135D39]" /> Start New Fixed Lock
                </h4>
                
                <form onSubmit={handleCreateFixedLock} className="mt-4 space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10.5px] text-[#5C6460] font-bold uppercase tracking-wider block">Lock Size Amount NGN (₦)</label>
                    <div className="relative">
                      <span className="absolute left-4 top-3 font-mono font-bold text-stone-400 text-sm">₦</span>
                      <input 
                        type="number" 
                        required
                        placeholder="e.g. 500,000"
                        value={newLockAmt}
                        onChange={(e) => setNewLockAmt(e.target.value === "" ? "" : Number(e.target.value))}
                        className="w-full bg-[#FAF8F5] border border-[#E6E5DF] focus:outline-[#135D39]/30 p-2.5 pl-8 rounded-xl font-mono text-base font-bold text-[#1A2421]"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10.5px] text-[#5C6460] font-bold uppercase tracking-wider block">Lock Duration / Scale APY</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { val: "3", l: "3 Months", a: "12% APY" },
                        { val: "6", l: "6 Months", a: "13.5% APY" },
                        { val: "12", l: "12 Months", a: "14.5% APY" }
                      ].map((item) => (
                        <button
                          key={item.val}
                          type="button"
                          onClick={() => setNewLockPeriod(item.val as any)}
                          className={`p-2.5 rounded-xl border text-center transition flex flex-col justify-center items-center cursor-pointer ${
                            newLockPeriod === item.val 
                              ? "bg-[#135D39] border-[#135D39] text-white shadow-xs font-bold" 
                              : "bg-[#FAF8F5] border-[#E6E5DF] text-[#5C6460] hover:bg-stone-50"
                          }`}
                        >
                          <span className="font-bold text-[11px] block">{item.l}</span>
                          <span className="text-[9px] font-mono opacity-80">{item.a}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Auto-renew checkbox */}
                  <div className="flex items-center gap-3 bg-[#FAF8F5] p-3 rounded-xl border border-[#E6E5DF]">
                    <input 
                      type="checkbox" 
                      id="autoRenewCheck" 
                      checked={autoRenewLock}
                      onChange={(e) => setAutoRenewLock(e.target.checked)}
                      className="w-4 h-4 rounded text-[#135D39] border-[#E6E5DF] focus:ring-[#135D39] shrink-0 cursor-pointer"
                    />
                    <label htmlFor="autoRenewCheck" className="text-xs text-[#5C6460] select-none cursor-pointer">
                      <span className="font-bold text-[#1A2421] block text-[11.5px]">Auto Roll-Over Maturity</span>
                      Re-lock principal automatically for the same duration on payout expiry date.
                    </label>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button 
                      type="button" 
                      onClick={() => setIsNewLockModalOpen(false)}
                      className="flex-1 bg-[#FAF8F5] hover:bg-stone-50 text-[#1A2421] border border-[#E6E5DF] py-2.5 rounded-xl text-xs font-semibold"
                    >
                      Close
                    </button>
                    <button 
                      type="submit" 
                      className="flex-1 bg-[#135D39] hover:bg-[#0f4a2d] text-white py-2.5 rounded-xl text-xs font-bold transition"
                    >
                      Lock Funds Now
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

        </div>
      )}

      {/* SUBVIEW 5: Harvest Save Details */}
      {activeSubView === "harvest" && (
        <div className="space-y-6">
          <div className="flex justify-between items-center gap-4 flex-wrap">
            <h3 className="font-display font-semibold text-[#1A2421] text-base">Seasonal Crop Harvest Save Indexes</h3>
            <button 
              onClick={() => setIsNewHarvestModalOpen(true)}
              className="flex items-center gap-1.5 bg-[#135D39] hover:bg-[#0f4a2d] text-white font-bold py-2 px-3.5 rounded-xl text-xs transition cursor-pointer border border-[#135D39]/15"
            >
              <Plus className="w-4 h-4" /> Start Seasonal Crop Savings
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {state.harvestPlans.map((p) => (
              <div key={p.id} className="bg-white border border-[#E6E5DF] rounded-3xl p-6 shadow-sm relative flex flex-col justify-between overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-[#FAF8F5] rounded-bl-full -z-10 flex items-center justify-center pt-2 pr-2 border-l border-b border-[#E6E5DF]">
                  <span className="text-2xl">🌱</span>
                </div>
                
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="bg-[#135D39]/10 text-[#135D39] text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border border-[#135D39]/15">
                      Crop: {p.cropType}
                    </span>
                    <span className="bg-[#E7A13C]/10 text-[#E7A13C] text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border border-[#E7A13C]/15">
                      Season: {p.targetSeason}
                    </span>
                  </div>

                  <h4 className="font-semibold text-[#1A2421] text-sm mt-3">{p.title}</h4>
                  <p className="text-xs text-[#5C6460] mt-1 pr-12 leading-relaxed font-semibold">
                    Align seed acquisitions, silo rents, or logistics payments with critical seasonal harvesting windows.
                  </p>

                  <div className="mt-4 bg-[#FAF8F5] p-3 rounded-xl border border-[#E6E5DF] grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-[#5C6460] block text-[10.5px] font-bold">Harvest Accumulator</span>
                      <span className="font-mono font-bold text-[#1A2421] text-sm mt-0.5">{formatCurrency(p.amountSaved)}</span>
                    </div>
                    <div>
                      <span className="text-[#5C6460] block text-[10.5px] font-bold">Estimated Yield APY</span>
                      <span className="font-mono font-bold text-[#135D39] text-sm mt-0.5">+{p.interestRate}% APY</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-[#E6E5DF] flex justify-between items-center text-xs text-[#5C6460] flex-wrap gap-2">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-[#5C6460]" /> Release Date: <span className="font-mono font-bold text-[#1A2421] underline">{p.releaseDate}</span>
                  </span>
                  
                  <span className="text-[10px] uppercase bg-emerald-50 text-emerald-800 font-bold px-2.5 py-1 rounded border border-emerald-150">
                    Active Growing
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* New Seasonal Harvest Save Modal */}
          {isNewHarvestModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/45 backdrop-blur-xs">
              <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-lg border border-[#E6E5DF] absolute">
                <h4 className="font-display font-semibold text-[#1A2421] text-base flex items-center gap-2">
                  <Sprout className="w-5 h-5 text-[#135D39]" /> Start Crop Harvest Plan
                </h4>
                
                <form onSubmit={handleCreateHarvestPlan} className="mt-4 space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10.5px] text-[#5C6460] font-bold uppercase tracking-wider block">Harvest Saving Goal Name</label>
                    <input 
                      type="text" 
                      required
                      placeholder="e.g. Q4 Maize Silo Storage Prep"
                      value={harvestTitle}
                      onChange={(e) => setHarvestTitle(e.target.value)}
                      className="w-full bg-[#FAF8F5] border border-[#E6E5DF] focus:outline-[#135D39]/30 p-2.5 rounded-xl text-xs text-[#1A2421] font-semibold"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10.5px] text-[#5C6460] font-bold uppercase tracking-wider block">Crop Type</label>
                      <select
                        value={selectedCrop}
                        onChange={(e) => setSelectedCrop(e.target.value)}
                        className="w-full bg-[#FAF8F5] border border-[#E6E5DF] focus:outline-[#135D39]/30 p-2.5 rounded-xl text-xs text-stone-700 font-semibold"
                      >
                        {CROP_TYPES.map((cr) => (
                          <option key={cr.value} value={cr.value}>{cr.label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10.5px] text-[#5C6460] font-bold uppercase tracking-wider block">Harvest Season</label>
                      <select
                        value={harvestSeason}
                        onChange={(e) => setHarvestSeason(e.target.value)}
                        className="w-full bg-[#FAF8F5] border border-[#E6E5DF] focus:outline-[#135D39]/30 p-2.5 rounded-xl text-xs text-stone-700 font-semibold"
                      >
                        <option>Rainy Season Q3-Q4 2026</option>
                        <option>Dry Season Q1-Q2 2027</option>
                        <option>Special Cocoa Cycle Q4 2026</option>
                        <option>Starch Processing Q2 2027</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10.5px] text-[#5C6460] font-bold uppercase tracking-wider block">Initial Capital (₦)</label>
                      <input 
                        type="number" 
                        required
                        placeholder="e.g. 50,000"
                        value={harvestInitialAmt}
                        onChange={(e) => setHarvestInitialAmt(e.target.value === "" ? "" : Number(e.target.value))}
                        className="w-full bg-[#FAF8F5] border border-[#E6E5DF] focus:outline-[#135D39]/30 p-2.5 rounded-xl text-xs font-mono font-bold text-[#1A2421]"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10.5px] text-[#5C6460] font-bold uppercase tracking-wider block">Release Target Date</label>
                      <input 
                        type="date" 
                        required
                        value={harvestReleaseDate}
                        onChange={(e) => setHarvestReleaseDate(e.target.value)}
                        className="w-full bg-[#FAF8F5] border border-[#E6E5DF] focus:outline-[#135D39]/30 p-2.5 rounded-xl text-xs font-mono text-stone-800"
                      />
                    </div>
                  </div>

                  <p className="text-[10.2px] text-[#5C6460] bg-emerald-50 border border-emerald-100 p-2.5 rounded-xl leading-relaxed">
                    🚜 <span className="font-bold text-[#135D39]">Earn 12.5% APY</span> on crop seasonal plans. Highly targeted structure aligned precisely to African farm harvest schedules.
                  </p>

                  <div className="flex gap-3 pt-2">
                    <button 
                      type="button" 
                      onClick={() => setIsNewHarvestModalOpen(false)}
                      className="flex-1 bg-[#FAF8F5] hover:bg-stone-50 text-[#1A2421] border border-[#E6E5DF] py-2.5 rounded-xl text-xs font-semibold"
                    >
                      Close
                    </button>
                    <button 
                      type="submit" 
                      className="flex-1 bg-[#135D39] hover:bg-[#0f4a2d] text-white py-2.5 rounded-xl text-xs font-bold transition"
                    >
                      Open Plan
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

        </div>
      )}

    </div>
  );
}
