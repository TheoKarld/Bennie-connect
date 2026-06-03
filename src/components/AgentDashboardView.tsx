/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { 
  Users, 
  TrendingUp, 
  Award, 
  UserPlus, 
  CheckCircle, 
  Clock, 
  UploadCloud, 
  Search, 
  Sparkles, 
  ShieldCheck, 
  FileText,
  ArrowUpRight,
  Info,
  RefreshCw
} from "lucide-react";
import { FarmerAppState, RegisteredFarmer, CommissionReward, AgentLevel } from "../types";

export interface AgentDashboardViewProps {
  state: FarmerAppState;
  onRegisterFarmer: (farmer: Omit<RegisteredFarmer, "id" | "dateRegistered" | "kycStatus">) => void;
  onVerifyFarmerKYC: (farmerId: string) => void;
  onSimulateActivity: (farmerId: string, activityType: string, amount: number) => void;
  onPromoteAgent: (newLevel: AgentLevel) => void;
}

// Level configurations
const LEVEL_DETAILS: Record<AgentLevel, {
  name: string;
  multiplier: number;
  perk: string;
  requirement: string;
  color: string;
  bgHex: string;
  badgeHex: string;
  targetCount: number;
}> = {
  "Bronze Agent": {
    name: "Bronze Agent",
    multiplier: 1.0,
    perk: "Base commission rates on registrations & bookings",
    requirement: "Starter tier for all certified field representatives",
    color: "from-amber-700 to-amber-900 border-amber-600 bg-amber-50",
    bgHex: "#FAF8F5",
    badgeHex: "bg-amber-100 text-amber-900",
    targetCount: 3
  },
  "Silver Agent": {
    name: "Silver Agent",
    multiplier: 1.1,
    perk: "1.1x multiplier on all membership upgrade milestones",
    requirement: "Register 3 farmers with 100% verified KYC documentation",
    color: "from-slate-500 to-slate-700 border-slate-400 bg-slate-50",
    bgHex: "#F1F5F9",
    badgeHex: "bg-slate-100 text-slate-800",
    targetCount: 5
  },
  "Gold Agent": {
    name: "Gold Agent",
    multiplier: 1.25,
    perk: "1.25x high reward rate & access to advanced cashout channels",
    requirement: "Register 5 farmers + earn at least ₦15,000 in commissions",
    color: "from-amber-400 to-yellow-600 border-amber-300 bg-amber-50/50",
    bgHex: "#FFFBEB",
    badgeHex: "bg-gradient-to-r from-amber-400 to-yellow-500 text-white",
    targetCount: 8
  },
  "Platinum Agent": {
    name: "Platinum Agent",
    multiplier: 1.5,
    perk: "1.5x maximum commission on all cooperative market purchases",
    requirement: "Register 8 farmers + 100% identity verification consistency record",
    color: "from-violet-600 to-indigo-700 border-violet-500 bg-violet-50",
    bgHex: "#F5F3FF",
    badgeHex: "bg-gradient-to-r from-violet-600 to-indigo-600 text-white",
    targetCount: 15
  }
};

export default function AgentDashboardView({
  state,
  onRegisterFarmer,
  onVerifyFarmerKYC,
  onSimulateActivity,
  onPromoteAgent
}: AgentDashboardViewProps) {
  // Extract agent attributes from fallback local state
  const currentLevel: AgentLevel = state.agentLevel || "Bronze Agent";
  const farmers: RegisteredFarmer[] = state?.registeredFarmers || [];
  const rewards: CommissionReward[] = state?.commissionRewards || [];
  const ranking = state?.agentRanking || 8;

  // Search, filter & active UI states
  const [farmerSearch, setFarmerSearch] = useState("");
  const [rewardSearch, setRewardSearch] = useState("");
  const [rewardFilter, setRewardFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"dashboard" | "register" | "commissions" | "ranks">("dashboard");

  // Registration Form States
  const [newFarmerName, setNewFarmerName] = useState("");
  const [newFarmerPhone, setNewFarmerPhone] = useState("");
  const [newFarmerLocation, setNewFarmerLocation] = useState("");
  const [newFarmerTier, setNewFarmerTier] = useState<"Inactive" | "Bronze" | "Silver" | "Gold" | "Platinum">("Bronze");
  const [newFarmerIdType, setNewFarmerIdType] = useState<"NIN" | "BVN" | "Voters Card" | "National ID">("NIN");
  const [newFarmerIdNum, setNewFarmerIdNum] = useState("");

  // File Upload states (KYC)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Identity Verification States
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [verificationLogs, setVerificationLogs] = useState<string[]>([]);
  const [verificationDone, setVerificationDone] = useState(false);

  // Simulation Tool States
  const [selectedSimFarmer, setSelectedSimFarmer] = useState("");
  const [simActivityType, setSimActivityType] = useState<"Membership Upgrade" | "Savings Deposit" | "Equipment Booking" | "Marketplace Purchase">("Savings Deposit");
  const [simTxAmount, setSimTxAmount] = useState<number>(50000);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationSuccess, setSimulationSuccess] = useState<string | null>(null);

  // Stats calculation
  const totalEarnedCommissions = rewards.reduce((sum, r) => sum + r.amountEarned, 0);
  const monthlyEarnings = rewards
    .filter(r => r.date.startsWith("2026-05") || r.date.startsWith("2026-06"))
    .reduce((sum, r) => sum + r.amountEarned, 0);

  const verifiedFarmersCount = farmers.filter(f => f.kycStatus === "Verified").length;
  // Performance metric mapped as percent of farmer verifications
  const performanceScore = farmers.length > 0 
    ? Math.round((verifiedFarmersCount / farmers.length) * 100) 
    : 100;

  // Promotion checking logic
  const checkPromotionStatus = (curr: AgentLevel, count: number): AgentLevel | null => {
    if (curr === "Bronze Agent" && count >= 3) return "Silver Agent";
    if (curr === "Silver Agent" && count >= 5 && totalEarnedCommissions >= 15000) return "Gold Agent";
    if (curr === "Gold Agent" && count >= 8) return "Platinum Agent";
    return null;
  };

  const nextPromotion = checkPromotionStatus(currentLevel, verifiedFarmersCount);

  // Handle direct reward simulation trigger
  const triggerSimulation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSimFarmer) {
      alert("Please select a farmer to simulate transactions.");
      return;
    }
    const targetF = farmers.find(f => f.id === selectedSimFarmer);
    if (!targetF) return;

    if (targetF.kycStatus !== "Verified") {
      alert("Commissions will only clear once the farmer's identity verification status is fully approved.");
      return;
    }

    setIsSimulating(true);
    setSimulationSuccess(null);

    // Simulated short delay
    setTimeout(() => {
      // Direct activity mapping
      let rewardEarned = 0;
      let details = "";
      const baseAmt = simTxAmount;

      const multiplier = LEVEL_DETAILS[currentLevel].multiplier;

      switch(simActivityType) {
        case "Membership Upgrade":
          rewardEarned = Math.round(baseAmt * 0.10 * multiplier);
          details = `Earned ${Math.round(10 * multiplier)}% agent quota on upgrade to Premium Tier size: ₦${baseAmt.toLocaleString()}`;
          break;
        case "Savings Deposit":
          rewardEarned = Math.round(1500 * multiplier);
          details = `Disbursed standard Agent incentive for savings topup: ₦${baseAmt.toLocaleString()}`;
          break;
        case "Equipment Booking":
          rewardEarned = Math.round(baseAmt * 0.05 * multiplier);
          details = `Awarded 5% referred booking yield on tractor lease BK-1029: ₦${baseAmt.toLocaleString()}`;
          break;
        case "Marketplace Purchase":
          rewardEarned = Math.round(baseAmt * 0.025 * multiplier);
          details = `Agent incentive on inputs storefront checkout transaction: ₦${baseAmt.toLocaleString()}`;
          break;
      }

      onSimulateActivity(selectedSimFarmer, simActivityType, rewardEarned);
      setIsSimulating(false);
      setSimulationSuccess(`Successfully credited ₦${rewardEarned.toLocaleString()} commission directly to your Liquid Wallet!`);
      
      // Auto dismiss success banner
      setTimeout(() => {
        setSimulationSuccess(null);
      }, 5000);
    }, 1200);
  };

  // Farmer registration handle
  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFarmerName || !newFarmerPhone || !newFarmerLocation || !newFarmerIdNum) {
      alert("Please fully complete registration credentials.");
      return;
    }

    if (!uploadedFileName) {
      alert("Please attach or drag-and-drop a KYC Document for verification.");
      return;
    }

    onRegisterFarmer({
      name: newFarmerName,
      phone: newFarmerPhone,
      location: newFarmerLocation,
      identityType: newFarmerIdType,
      identityNumber: newFarmerIdNum,
      kycDocUrl: "/assets/docs/uploaded_" + uploadedFileName,
      membershipStatus: newFarmerTier
    });

    // Reset states
    setNewFarmerName("");
    setNewFarmerPhone("");
    setNewFarmerLocation("");
    setNewFarmerIdNum("");
    setUploadedFileName(null);
    setUploadProgress(null);
    
    // Switch tab back with alert
    setActiveTab("dashboard");
  };

  // Simulating real dynamic biometric and government API lookup logs
  const startKYCValidation = (farmerId: string) => {
    const target = farmers.find(f => f.id === farmerId);
    if (!target) return;

    setVerifyingId(farmerId);
    setVerificationDone(false);
    setVerificationLogs([]);

    const steps = [
      "Establishing link with NIMC National Identity Gateway...",
      `Checking document index: ${target.identityType} (${target.identityNumber})`,
      "Comparing photographic biometrics against database entry...",
      "Validating visual document validity and OCR signature patterns...",
      "Identity Cleared: 100% matched, No blacklists found."
    ];

    let currentStep = 0;
    
    const interval = setInterval(() => {
      if (currentStep < steps.length) {
        setVerificationLogs(prev => [...prev, steps[currentStep]]);
        currentStep++;
      } else {
        clearInterval(interval);
        setVerificationDone(true);
        // Dispatch completion
        onVerifyFarmerKYC(farmerId);
      }
    }, 900);
  };

  // Simulated drag-drop logic
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      simulateFileUpload(files[0].name);
    }
  };

  const handleFileBrowse = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      simulateFileUpload(files[0].name);
    }
  };

  const simulateFileUpload = (fileName: string) => {
    setUploadedFileName(null);
    setUploadProgress(0);
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.floor(Math.random() * 25 + 15);
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        setUploadedFileName(fileName);
        setUploadProgress(null);
      } else {
        setUploadProgress(progress);
      }
    }, 150);
  };

  // Filtered lists
  const filteredFarmers = farmers.filter(f => 
    f.name.toLowerCase().includes(farmerSearch.toLowerCase()) ||
    f.phone.includes(farmerSearch) ||
    f.id.toLowerCase().includes(farmerSearch.toLowerCase()) ||
    f.location.toLowerCase().includes(farmerSearch.toLowerCase())
  );

  const filteredRewards = rewards.filter(r => {
    const matchesSearch = r.farmerName.toLowerCase().includes(rewardSearch.toLowerCase()) || 
                          r.activityDetails.toLowerCase().includes(rewardSearch.toLowerCase());
    if (rewardFilter === "all") return matchesSearch;
    return matchesSearch && r.activityType === rewardFilter;
  });

  const levelInfo = LEVEL_DETAILS[currentLevel];
  const nextLevel = 
    currentLevel === "Bronze Agent" ? "Silver Agent" :
    currentLevel === "Silver Agent" ? "Gold Agent" :
    currentLevel === "Gold Agent" ? "Platinum Agent" : null;

  const nextLevelReq = nextLevel ? LEVEL_DETAILS[nextLevel] : null;

  return (
    <div className="space-y-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      
      {/* Interactive Top Ribbon displaying Tier Level Details & Upgrade alerts */}
      <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-r from-[#1E293B] via-[#0F172A] to-[#1E293B] p-6 md:p-8 text-white shadow-lg border border-[#334155]">
        
        {/* Subtle geometric grid backdrop */}
        <div className="absolute inset-0 opacity-10 bg-[linear-gradient(to_right,#808080_1px,transparent_1px),linear-gradient(to_bottom,#808080_1px,transparent_1px)] bg-[size:16px_16px]" />
        
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="p-1 px-2 text-[9.5px] uppercase font-bold bg-[#E9A42F] text-stone-900 rounded-full">
                Active Certified Agent
              </span>
              <span className="text-xs text-slate-300 font-mono">ID: AG-KANO-9902</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-display font-medium tracking-tight">
              Bennie Agro Operations Suite
            </h1>
            <p className="text-xs text-slate-300 max-w-xl leading-normal font-medium">
              Manage field registrations, verify farmer identity biometrics securely via NIMC channels, and earn commissions paid instantly to your digital ledger.
            </p>
          </div>

          <div className="bg-slate-800/40 backdrop-blur-md border border-slate-700/50 p-5 rounded-2xl flex flex-col items-center justify-center text-center shrink-0 w-full md:w-56">
            <div className={`p-1 px-2.5 rounded-full text-[10px] font-bold uppercase mb-1.5 ${levelInfo.badgeHex}`}>
              {currentLevel}
            </div>
            <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold block">Commission Yield</span>
            <span className="text-2xl font-mono font-bold text-[#E9A42F] block mt-0.5">
              {levelInfo.multiplier.toFixed(2)}x
            </span>
            <span className="text-[9.5px] text-slate-400 font-medium mt-1 leading-none text-center">
              {levelInfo.perk}
            </span>
          </div>
        </div>

        {/* Level Promotion Prompt if conditions met */}
        {nextPromotion && (
          <div className="mt-6 p-4 rounded-xl bg-[#135D39]/25 border border-[#135D39] flex flex-col sm:flex-row justify-between items-center gap-4 animate-pulse">
            <div className="flex items-center gap-3">
              <Sparkles className="w-6 h-6 text-[#E9A42F] shrink-0" />
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">Level Upgrade Qualified!</h4>
                <p className="text-[11px] text-slate-200 mt-0.5 leading-normal">
                  Outstanding performance! You completed the milestones to progress to <strong>{nextPromotion}</strong>.
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                onPromoteAgent(nextPromotion);
                // Trigger notification in parent
                alert(`Congratulations! You are now certified as a ${nextPromotion}! Your higher commission multiplier is active.`);
              }}
              className="bg-[#E9A42F] hover:bg-[#d59124] text-stone-900 font-bold px-4 py-2 rounded-xl text-[10.5px] uppercase tracking-wider shrink-0 transition"
            >
              Exclaim Upgrade
            </button>
          </div>
        )}
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex border-b border-[#E6E5DF] pb-px overflow-x-auto gap-4 scrollbar-none">
        <button
          onClick={() => setActiveTab("dashboard")}
          className={`pb-3 text-xs uppercase tracking-wider font-bold border-b-2 transition shrink-0 cursor-pointer ${
            activeTab === "dashboard" 
              ? "border-[#135D39] text-[#135D39]" 
              : "border-transparent text-[#5C6460] hover:text-[#1A2421]"
          }`}
        >
          Overview & CRM
        </button>
        <button
          onClick={() => setActiveTab("register")}
          className={`pb-3 text-xs uppercase tracking-wider font-bold border-b-2 transition shrink-0 cursor-pointer ${
            activeTab === "register" 
              ? "border-[#135D39] text-[#135D39]" 
              : "border-transparent text-[#5C6460] hover:text-[#1A2421]"
          }`}
        >
          Farmer Registration
        </button>
        <button
          onClick={() => setActiveTab("commissions")}
          className={`pb-3 text-xs uppercase tracking-wider font-bold border-b-2 transition shrink-0 cursor-pointer ${
            activeTab === "commissions" 
              ? "border-[#135D39] text-[#135D39]" 
              : "border-transparent text-[#5C6460] hover:text-[#1A2421]"
          }`}
        >
          Commission Engine
        </button>
        <button
          onClick={() => setActiveTab("ranks")}
          className={`pb-3 text-xs uppercase tracking-wider font-bold border-b-2 transition shrink-0 cursor-pointer ${
            activeTab === "ranks" 
              ? "border-[#135D39] text-[#135D39]" 
              : "border-transparent text-[#5C6460] hover:text-[#1A2421]"
          }`}
        >
          Agent Levels
        </button>
      </div>

      {/* Tab Content 1: Dashboard overview and CRM */}
      {activeTab === "dashboard" && (
        <div className="space-y-8 animate-fade-in">
          
          {/* Main counts section */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            <div className="bg-white border border-[#E6E5DF] rounded-2xl p-5 shadow-sm">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-[#5C6460] tracking-wider block">Farmers Onboarded</span>
                  <div className="font-mono text-2xl font-bold text-[#1A2421]">{farmers.length}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-[#135D39]/5 border border-[#135D39]/10 text-[#135D39]">
                  <Users className="w-5 h-5" />
                </div>
              </div>
              <div className="text-[10px] text-[#135D39] font-medium mt-3 flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5 inline text-emerald-600" /> {verifiedFarmersCount} fully verified KYC entries
              </div>
            </div>

            <div className="bg-white border border-[#E6E5DF] rounded-2xl p-5 shadow-sm">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-[#5C6460] tracking-wider block">Monthly Commissions</span>
                  <div className="font-mono text-2xl font-bold text-[#1A2421]">₦{monthlyEarnings.toLocaleString()}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-orange-50 border border-orange-100 text-orange-700">
                  <TrendingUp className="w-5 h-5" />
                </div>
              </div>
              <div className="text-[10px] text-slate-500 mt-3">
                Total earnings overall: <strong className="text-[#1A2421] font-bold">₦{totalEarnedCommissions.toLocaleString()}</strong>
              </div>
            </div>

            <div className="bg-white border border-[#E6E5DF] rounded-2xl p-5 shadow-sm">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-[#5C6460] tracking-wider block">KYC Consistency</span>
                  <div className="font-mono text-2xl font-bold text-[#1A2421]">{performanceScore}%</div>
                </div>
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-700">
                  <ShieldCheck className="w-5 h-5" />
                </div>
              </div>
              <div className="text-[10px] text-slate-500 mt-3">
                Success rate on identity document clearing
              </div>
            </div>

            <div className="bg-white border border-[#E6E5DF] rounded-2xl p-5 shadow-sm">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-[#5C6460] tracking-wider block">Agent Board Rank</span>
                  <div className="font-mono text-2xl font-bold text-[#1A2421]">#{ranking}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-purple-50 border border-purple-100 text-purple-700">
                  <Award className="w-5 h-5" />
                </div>
              </div>
              <div className="text-[10px] text-slate-500 mt-3">
                Out of 45 active regional cooperative agents
              </div>
            </div>

          </div>

          {/* Verification modal block overlay inside local component */}
          {verifyingId && (
            <div className="border border-[#E6E5DF] rounded-2xl bg-white p-6 shadow-md max-w-xl mx-auto space-y-4 animate-fade-in">
              <div className="flex justify-between items-center border-b border-[#E6E5DF] pb-3">
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-[#E7A13C] animate-spin" />
                  <span className="text-xs font-bold uppercase tracking-wider text-[#1A2421]">Identity Registry lookup</span>
                </div>
                <button 
                  onClick={() => setVerifyingId(null)}
                  className="text-stone-400 hover:text-stone-900 transition text-xs font-bold"
                >
                  Close Console
                </button>
              </div>

              <div className="bg-stone-900 text-emerald-400 font-mono text-[11px] p-4 rounded-xl leading-relaxed space-y-1 shadow-inner h-32 overflow-y-auto">
                {verificationLogs.map((log, index) => (
                  <p key={index}>&gt; {log}</p>
                ))}
                {!verificationDone && <span className="inline-block w-2 h-3 bg-emerald-400 animate-pulse" />}
              </div>

              {verificationDone ? (
                <div className="p-3 bg-emerald-50 text-[#135D39] text-xs font-medium rounded-xl border border-emerald-100 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  ID Authenticated with government portal. Agent KYC approval score updated successfully.
                </div>
              ) : (
                <p className="text-[10.5px] text-[#5C6460] text-center italic">
                  Running automated secure clearance against the National Identity Database (NIMC).
                </p>
              )}
            </div>
          )}

          {/* CRM Roster of Registered Farmers */}
          <div className="bg-white border border-[#E6E5DF] rounded-3xl p-6 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#E6E5DF] pb-4">
              <div>
                <h3 className="font-display font-semibold text-[#1A2421] text-base">Your Active Farmer CRM Portfolio</h3>
                <p className="text-[11px] text-[#5C6460] mt-0.5 font-medium">Verify documents, upgrade profiles, and leverage earnings from onbording.</p>
              </div>

              <div className="flex gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-[#5C6460]" />
                  <input 
                    type="text" 
                    placeholder="Search name, phone, base region..."
                    value={farmerSearch}
                    onChange={(e) => setFarmerSearch(e.target.value)}
                    className="w-full bg-[#FAF8F5]/60 hover:bg-[#FAF8F5] focus:bg-white border border-[#E6E5DF] focus:border-[#135D39] focus:ring-2 focus:ring-[#135D39]/10 outline-none p-2 pl-10 rounded-xl text-xs text-[#1A2421] transition-all duration-200"
                  />
                </div>
                <button
                  onClick={() => setActiveTab("register")}
                  className="bg-[#135D39] hover:bg-[#0f4a2d] text-white font-bold p-2 px-3.5 rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" /> Register New
                </button>
              </div>
            </div>

            {/* Farmers CRM Grid list */}
            {filteredFarmers.length === 0 ? (
              <div className="text-center py-10 text-[#5C6460]/80">
                <Users className="w-10 h-10 mx-auto opacity-30 mb-2" />
                <p className="text-xs font-semibold">No registered farmers match your filter.</p>
              </div>
            ) : (
              <div className="overflow-x-auto select-none rounded-xl border border-[#E6E5DF]">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#FAF8F5] text-[#5C6460] font-bold border-b border-[#E6E5DF]">
                      <th className="p-3.5">Farmer Info</th>
                      <th className="p-3.5">Assigned Location</th>
                      <th className="p-3.5 width-32">Document ID & State</th>
                      <th className="p-3.5 text-center">Membership Level</th>
                      <th className="p-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E6E5DF]">
                    {filteredFarmers.map((f) => (
                      <tr key={f.id} className="hover:bg-[#FAF8F5]/50 transition-colors">
                        <td className="p-4 leading-normal">
                          <div className="font-bold text-[#1A2421]">{f.name}</div>
                          <div className="text-[10px] text-stone-500 font-mono mt-0.5">{f.phone} | {f.id}</div>
                        </td>
                        <td className="p-4 text-[#5C6460] font-medium">
                          {f.location}
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <span className="p-1 px-1.5 rounded-md font-mono text-[10px] bg-slate-100 text-slate-800 uppercase font-black border border-slate-200">
                              {f.identityType}
                            </span>
                            <span className="text-[10.5px] font-mono text-[#1A2421] font-semibold">{f.identityNumber}</span>
                          </div>
                          
                          {/* kyc badge */}
                          <div className="mt-1.5 flex items-center gap-1.5">
                            {f.kycStatus === "Verified" ? (
                              <span className="text-[9px] bg-emerald-50 text-emerald-700 font-bold p-0.5 px-2 rounded-full border border-emerald-100 inline-flex items-center gap-0.5">
                                <CheckCircle className="w-2.5 h-2.5 inline" /> Govt-Cleared
                              </span>
                            ) : (
                              <span className="text-[9px] bg-amber-50 text-amber-700 font-bold p-0.5 px-2 rounded-full border border-amber-100 inline-flex items-center gap-0.5 animate-pulse">
                                <Clock className="w-2.5 h-2.5 inline" /> Pending Registry Clear
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-4 text-center">
                          {f.membershipStatus === "Inactive" ? (
                            <span className="text-[10px] text-stone-400 font-semibold bg-stone-100 p-1 px-2.5 rounded-full">Inactive</span>
                          ) : (
                            <span className="text-[10px] text-[#135D39] font-bold bg-[#135D39]/5 border border-[#135D39]/10 p-1 px-2.5 rounded-full inline-block">
                              {f.membershipStatus} Tier
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-right">
                          {f.kycStatus === "Pending" ? (
                            <button
                              onClick={() => startKYCValidation(f.id)}
                              className="bg-[#E9A42F] hover:bg-[#d59124] text-stone-900 font-bold p-1 px-2.5 rounded-lg text-[10px] uppercase tracking-wider transition cursor-pointer"
                            >
                              Verify ID
                            </button>
                          ) : (
                            <span className="text-[10px] text-emerald-600 font-bold inline-flex items-center gap-1">
                              <ShieldCheck className="w-3.5 h-3.5 inline text-emerald-600" /> Active Roster
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab Content 2: Farmer Registration Terminal */}
      {activeTab === "register" && (
        <div className="max-w-3xl mx-auto animate-fade-in space-y-6">
          <div className="bg-white border border-[#E6E5DF] p-6 sm:p-8 rounded-[28px] shadow-sm space-y-6">
            <div className="border-b border-[#E6E5DF] pb-4">
              <h3 className="font-display font-semibold text-[#1A2421] text-lg">Onboard Cooperative Farmer Partner</h3>
              <p className="text-[11px] text-[#5C6460] mt-0.5">Initialize a profile, attach verified identity documentation files, and set their starter membership.</p>
            </div>

            <form onSubmit={handleRegisterSubmit} className="space-y-6">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                <div className="space-y-2">
                  <label className="text-xs text-[#5C6460] uppercase tracking-wider font-bold">Farmer's Full Name</label>
                  <input 
                    type="text" 
                    required
                    placeholder="e.g. Alhaji Ibrahim Babangida"
                    value={newFarmerName}
                    onChange={(e) => setNewFarmerName(e.target.value)}
                    className="w-full bg-[#FAF8F5]/60 hover:bg-[#FAF8F5] focus:bg-white border border-[#E6E5DF] focus:border-[#135D39] focus:ring-2 focus:ring-[#135D39]/10 p-3 rounded-xl text-xs font-semibold text-[#1A2421] outline-none transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs text-[#5C6460] uppercase tracking-wider font-bold">Mobile Phone (MTN/Airtel)</label>
                  <input 
                    type="text" 
                    required
                    placeholder="e.g. +234 803 122 1199"
                    value={newFarmerPhone}
                    onChange={(e) => setNewFarmerPhone(e.target.value)}
                    className="w-full bg-[#FAF8F5]/60 hover:bg-[#FAF8F5] focus:bg-white border border-[#E6E5DF] focus:border-[#135D39] focus:ring-2 focus:ring-[#135D39]/10 p-3 rounded-xl text-xs font-mono font-bold text-[#1A2421] outline-none transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs text-[#5C6460] uppercase tracking-wider font-bold">Base Location / Farming Region</label>
                  <input 
                    type="text" 
                    required
                    placeholder="e.g. Kano State Maiduguri Road Outpost"
                    value={newFarmerLocation}
                    onChange={(e) => setNewFarmerLocation(e.target.value)}
                    className="w-full bg-[#FAF8F5]/60 hover:bg-[#FAF8F5] focus:bg-white border border-[#E6E5DF] focus:border-[#135D39] focus:ring-2 focus:ring-[#135D39]/10 p-3 rounded-xl text-xs font-semibold text-[#1A2421] outline-none transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs text-[#5C6460] uppercase tracking-wider font-bold block">Assigned Starter Membership</label>
                  <select
                    value={newFarmerTier}
                    onChange={(e: any) => setNewFarmerTier(e.target.value)}
                    className="w-full bg-[#FAF8F5]/60 hover:bg-[#FAF8F5] focus:bg-white border border-[#E6E5DF] focus:border-[#135D39] focus:ring-2 focus:ring-[#135D39]/10 p-3 rounded-xl text-xs font-bold text-[#1A2421] cursor-pointer outline-none transition-all"
                  >
                    <option value="Bronze">Bronze (Standard)</option>
                    <option value="Silver">Silver (₦15,000 upgrade)</option>
                    <option value="Gold">Gold (₦35,000 upgrade)</option>
                    <option value="Platinum">Platinum (₦75,000 upgrade)</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs text-[#5C6460] uppercase tracking-wider font-bold block">Verification Document Type</label>
                  <select
                    value={newFarmerIdType}
                    onChange={(eInput: any) => setNewFarmerIdType(eInput.target.value)}
                    className="w-full bg-[#FAF8F5]/60 hover:bg-[#FAF8F5] focus:bg-white border border-[#E6E5DF] focus:border-[#135D39] focus:ring-2 focus:ring-[#135D39]/10 p-3 rounded-xl text-xs font-bold text-[#1A2421] cursor-pointer outline-none transition-all"
                  >
                    <option value="NIN">National Identification Number (NIN)</option>
                    <option value="BVN">Bank Verification Number (BVN)</option>
                    <option value="Voters Card">INEC Voters Identity Card </option>
                    <option value="National ID">Govt Premium National ID Card</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs text-[#5C6460] uppercase tracking-wider font-bold">Document Signature ID Number</label>
                  <input 
                    type="text" 
                    required
                    placeholder="e.g. NIN-2019-9061-AX"
                    value={newFarmerIdNum}
                    onChange={(e) => setNewFarmerIdNum(e.target.value)}
                    className="w-full bg-[#FAF8F5]/60 hover:bg-[#FAF8F5] focus:bg-white border border-[#E6E5DF] focus:border-[#135D39] focus:ring-2 focus:ring-[#135D39]/10 p-3 rounded-xl text-xs font-mono font-bold text-[#1A2421] outline-none transition-all"
                  />
                </div>

              </div>

              {/* Upload Certificate KYC Area */}
              <div className="space-y-3 pt-2">
                <label className="text-xs text-[#5C6460] uppercase tracking-wider font-bold block">
                  Upload Farmer KYC Document & Photographic ID Proof
                </label>
                
                <div 
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-2xl p-6 transition-all text-center flex flex-col items-center justify-center gap-2 cursor-pointer ${
                    isDragOver 
                      ? "border-[#135D39] bg-[#135D39]/5" 
                      : uploadedFileName 
                        ? "border-emerald-500 bg-emerald-50/20" 
                        : "border-[#E6E5DF] hover:border-[#135D39]/30"
                  }`}
                >
                  <UploadCloud className={`w-10 h-10 ${uploadedFileName ? "text-emerald-500 animate-bounce" : "text-[#5C6460]"}`} />
                  
                  {uploadProgress !== null ? (
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-[#1A2421] animate-pulse">Uploading file attachment ({uploadProgress}%)</p>
                      <div className="w-48 h-1 bg-stone-100 rounded-full overflow-hidden mx-auto">
                        <div className="h-full bg-[#135D39]" style={{ width: `${uploadProgress}%` }} />
                      </div>
                    </div>
                  ) : uploadedFileName ? (
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-emerald-700">File attached successfully!</p>
                      <p className="text-[10px] text-stone-500 font-mono italic">{uploadedFileName}</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-[#1A2421]">Drag & drop KYC image/document here, or click to browse</p>
                      <p className="text-[10px] text-[#5C6460] font-medium">Supports JPG, PNG, PDF up to 4MB sizes</p>
                    </div>
                  )}

                  <input 
                    type="file" 
                    id="kyc-file-picker"
                    className="hidden" 
                    onChange={handleFileBrowse}
                    accept="image/*,application/pdf"
                  />
                  <button 
                    type="button"
                    onClick={() => {
                      const picker = document.getElementById("kyc-file-picker");
                      if (picker) picker.click();
                    }}
                    className="mt-2 bg-white hover:bg-[#FAF8F5] text-stone-700 font-bold py-1.5 px-3 rounded-lg text-[10px] transition border border-[#E6E5DF] cursor-pointer"
                  >
                    Select File
                  </button>
                </div>
              </div>

              {/* Submit Registration button */}
              <button
                type="submit"
                className="w-full bg-[#135D39] hover:bg-[#0f4a2d] text-white font-bold py-3.5 rounded-xl text-xs uppercase tracking-wider transition shadow-md shadow-[#135D39]/10 hover:shadow-lg border border-[#135D39]/15 cursor-pointer"
              >
                Register Farmer & Disburse Onboarding ID
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Tab Content 3: Commission Engine ledger and transaction simulator! */}
      {activeTab === "commissions" && (
        <div className="space-y-8 animate-fade-in">
          
          {/* SECURE HIGH FIDELITY ACTION DECK SIMULATOR */}
          <div className="bg-[#1E293B] text-white border border-slate-700 rounded-[28px] p-6 shadow-md relative overflow-hidden">
            <div className="absolute right-0 top-0 w-32 h-32 bg-[#E9A42F]/5 blur-3xl rounded-full pointer-events-none" />
            
            <div className="space-y-2 border-b border-slate-700/60 pb-4">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-5 h-5 text-[#E9A42F]" />
                <h3 className="font-display font-semibold text-white text-base">Certified Agent Incentive Simulator</h3>
              </div>
              <p className="text-[11px] text-slate-350 leading-normal font-medium">
                Test the commission engine in real time! Choose an onboarded farmer, select a transaction they are executing, and trigger a live disbursal directly into your agent wallet.
              </p>
            </div>

            <form onSubmit={triggerSimulation} className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4 leading-normal">
              
              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">1. Select Comrade Farmer</label>
                <select
                  required
                  value={selectedSimFarmer}
                  onChange={(e) => setSelectedSimFarmer(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 focus:border-[#E9A42F] p-2.5 rounded-xl text-slate-200 text-xs font-bold font-sans cursor-pointer outline-none transition"
                >
                  <option value="">-- Choose Roster --</option>
                  {farmers.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} ({f.kycStatus === "Verified" ? " govt checked" : " pending Verification "})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">2. Customer Action Activity</label>
                <select
                  value={simActivityType}
                  onChange={(e: any) => setSimActivityType(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 focus:border-[#E9A42F] p-2.5 rounded-xl text-slate-200 text-xs font-bold font-sans cursor-pointer outline-none transition"
                >
                  <option value="Savings Deposit">Savings Deposit (Flex/Goal)</option>
                  <option value="Membership Upgrade">Membership Tier Upgrade Plan</option>
                  <option value="Equipment Booking">Rent Booking Referral</option>
                  <option value="Marketplace Purchase">Inputs Storefront Order</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                  {simActivityType === "Savings Deposit" && "Topup Capital (₦)"}
                  {simActivityType === "Membership Upgrade" && "Choice Tier Upgrade fee"}
                  {simActivityType === "Equipment Booking" && "Equipment Booking Value"}
                  {simActivityType === "Marketplace Purchase" && "Inputs Checkout Sum"}
                </label>
                {simActivityType === "Membership Upgrade" ? (
                  <select
                    value={simTxAmount}
                    onChange={(e) => setSimTxAmount(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 focus:border-[#E9A42F] p-2.5 rounded-xl text-slate-200 text-xs font-bold font-mono cursor-pointer outline-none transition"
                  >
                    <option value={15000}>₦15,000 Up to Silver</option>
                    <option value={35000}>₦35,000 Up to Gold</option>
                    <option value={75000}>₦75,000 Up to Platinum</option>
                  </select>
                ) : (
                  <input 
                    type="number"
                    step="5000"
                    min="5000"
                    max="1000000"
                    value={simTxAmount}
                    onChange={(e) => setSimTxAmount(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 focus:border-[#E9A42F] p-2 rounded-xl text-slate-200 font-mono text-xs font-bold outline-none transition"
                  />
                )}
              </div>

              <div className="pt-5">
                <button
                  type="submit"
                  disabled={isSimulating || !selectedSimFarmer}
                  className="w-full h-[40px] bg-[#E9A42F] hover:bg-[#d59124] disabled:opacity-40 disabled:cursor-not-allowed text-stone-900 font-bold rounded-xl text-[10.5px] uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                >
                  {isSimulating ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Calculating...
                    </>
                  ) : (
                    <>
                      <ArrowUpRight className="w-4 h-4" /> Disbburse Yield
                    </>
                  )}
                </button>
              </div>

            </form>

            {/* Simulated Live Success Banner */}
            {simulationSuccess && (
              <div className="mt-4 p-3 bg-emerald-500/20 border border-emerald-500/50 rounded-xl flex items-center gap-2 animate-fade-in text-xs text-emerald-300 font-medium">
                <CheckCircle className="w-4.5 h-4.5 text-emerald-400 shrink-0" />
                {simulationSuccess}
              </div>
            )}
          </div>

          {/* Ledger of Rewards overall */}
          <div className="bg-white border border-[#E6E5DF] rounded-3xl p-6 shadow-sm space-y-6">
            
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#E6E5DF] pb-4">
              <div>
                <h3 className="font-display font-semibold text-[#1A2421] text-base">Agent Commission Ledger</h3>
                <p className="text-[11px] text-[#5C6460] mt-0.5 font-medium">Breakdown of all earnings from citizen farmer referrals and activations.</p>
              </div>

              <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-56 text-[#5C6460] hover:text-[#1A2421]">
                  <Search className="absolute left-3 w-4 h-4 top-2.5" />
                  <input 
                    type="text" 
                    placeholder="Search farmer or details..."
                    value={rewardSearch}
                    onChange={(e) => setRewardSearch(e.target.value)}
                    className="w-full bg-[#FAF8F5]/60 hover:bg-[#FAF8F5] border border-[#E6E5DF] focus:border-[#135D39] outline-none p-2 pl-9 rounded-xl text-xs transition"
                  />
                </div>

                <select
                  value={rewardFilter}
                  onChange={(e) => setRewardFilter(e.target.value)}
                  className="bg-[#FAF8F5]/60 hover:bg-[#FAF8F5] border border-[#E6E5DF] focus:border-[#135D39] p-2 rounded-xl text-xs text-[#1A2421] outline-none font-medium cursor-pointer"
                >
                  <option value="all">All Incentive categories</option>
                  <option value="Farmer Registration">Onboarding Registrations</option>
                  <option value="Membership Upgrade">Coop upgrades</option>
                  <option value="Savings Deposit">Savings Deposits</option>
                  <option value="Equipment Booking">Rent Bookings</option>
                  <option value="Marketplace Purchase">Inputs store Purchases</option>
                </select>
              </div>
            </div>

            {/* List of commission reward items */}
            {filteredRewards.length === 0 ? (
              <div className="text-center py-10 text-[#5C6460]/80">
                <FileText className="w-10 h-10 mx-auto opacity-30 mb-2" />
                <p className="text-xs font-semibold">No commission entries found.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredRewards.map((reward) => (
                  <div key={reward.id} className="flex justify-between items-center bg-[#FAF8F5]/40 hover:bg-[#FAF8F5] border border-[#E6E5DF] hover:border-[#135D39]/25 p-4 rounded-2xl w-full transition duration-200">
                    <div className="flex items-center gap-4">
                      
                      <div className={`p-2 rounded-xl text-xs font-mono font-bold shrink-0 ${
                        reward.activityType === "Farmer Registration" ? "bg-blue-50 text-blue-800" :
                        reward.activityType === "Membership Upgrade" ? "bg-amber-50 text-amber-800" :
                        reward.activityType === "Savings Deposit" ? "bg-emerald-50 text-emerald-800" :
                        reward.activityType === "Equipment Booking" ? "bg-orange-50 text-orange-850" :
                        "bg-purple-50 text-purple-800"
                      }`}>
                        {reward.activityType.slice(0, 4).toUpperCase()}
                      </div>

                      <div className="leading-snug">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-[#1A2421] block">
                            {reward.activityType}
                          </span>
                          <span className="text-[10px] text-stone-500 font-medium">
                            • for {reward.farmerName}
                          </span>
                        </div>
                        <p className="text-[10.5px] text-[#5C6460] mt-0.5 font-medium leading-normal">
                          {reward.activityDetails}
                        </p>
                        <span className="text-[9px] text-[#5C6460]/70 font-mono mt-1 block">
                          {new Date(reward.date).toLocaleString()} | ID: #{reward.id}
                        </span>
                      </div>

                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-emerald-600 block uppercase font-black tracking-wider">disbursed</span>
                      <span className="font-mono text-base font-bold text-[#135D39]">
                        +₦{reward.amountEarned.toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab Content 4: Agent Levels progress and benefits */}
      {activeTab === "ranks" && (
        <div className="animate-fade-in space-y-8">
          
          {/* Progress to next level bar */}
          {nextLevelReq && (
            <div className="bg-white border border-[#E6E5DF] p-6 sm:p-8 rounded-[28px] shadow-sm space-y-4">
              <div className="flex justify-between items-center flex-wrap gap-2">
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold block">Certification Progression</span>
                  <p className="text-sm font-semibold text-[#1A2421]">
                    Unlock <strong className="text-[#135D39] font-black">{nextLevel}</strong> status
                  </p>
                </div>
                <div className="font-mono text-xs font-bold text-[#5C6460]">
                  {verifiedFarmersCount} / {nextLevelReq.targetCount} Verified Farmers registered
                </div>
              </div>

              {/* Progress Bar container */}
              <div className="w-full bg-[#FAF8F5] h-3 rounded-full overflow-hidden border border-[#E6E5DF]">
                <div 
                  className="h-full bg-gradient-to-r from-[#135D39] to-[#E9A42F] transition-all duration-500"
                  style={{ width: `${Math.min(100, (verifiedFarmersCount / nextLevelReq.targetCount) * 100)}%` }}
                />
              </div>

              <div className="text-[11px] text-slate-500 leading-normal flex items-center gap-1.5 pt-1">
                <Info className="w-4 h-4 text-[#135D39] shrink-0" />
                <span>
                  Requirements: <strong className="text-[#1A2421] font-bold">{nextLevelReq.requirement}</strong>. Current level yields {levelInfo.multiplier.toFixed(2)}x rewards multiplier.
                </span>
              </div>
            </div>
          )}

          {/* Levels grid structure */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 leading-relaxed">
            
            {(Object.keys(LEVEL_DETAILS) as AgentLevel[]).map((lvlKey) => {
              const detail = LEVEL_DETAILS[lvlKey];
              const isCurrent = lvlKey === currentLevel;

              return (
                <div 
                  key={lvlKey}
                  className={`border p-6 rounded-3xl relative overflow-hidden transition duration-300 ${
                    isCurrent 
                      ? "border-[#135D39] bg-white ring-2 ring-[#135D39]/5 shadow-md scale-[1.01]" 
                      : "border-[#E6E5DF] bg-white opacity-85 hover:opacity-100"
                  }`}
                >
                  {isCurrent && (
                    <div className="absolute right-0 top-0 bg-[#135D39] text-white text-[10px] uppercase font-bold p-1 px-4 rounded-bl-xl shadow-xs">
                      your rank
                    </div>
                  )}

                  <span className="p-1 px-2 text-[9px] uppercase font-bold border rounded-full bg-slate-100 text-slate-800">
                    Level {detail.targetCount >= 15 ? "IV" : detail.targetCount >= 8 ? "III" : detail.targetCount >= 5 ? "II" : "I"} Rank
                  </span>

                  <h4 className="font-display font-bold text-lg text-[#1A2421] mt-2 flex items-center gap-1.5">
                    {detail.name} 
                    <span className="text-xs font-mono font-bold text-[#135D39] bg-[#135D39]/5 p-0.5 px-2 rounded-md">
                      {detail.multiplier.toFixed(2)}x yield
                    </span>
                  </h4>

                  <div className="mt-4 space-y-2.5 text-xs text-[#5C6460]">
                    <div className="flex items-start gap-2">
                      <span className="font-bold text-[#1A2421] tracking-wide shrink-0">Level Requirements:</span>
                      <span className="font-medium">{detail.requirement}</span>
                    </div>

                    <div className="flex items-start gap-2">
                      <span className="font-bold text-[#1A2421] tracking-wide shrink-0">Active Benefit Multiplier:</span>
                      <span className="font-medium text-[#135D39] font-semibold">{detail.perk}</span>
                    </div>
                  </div>

                  {/* Level indicators */}
                  <div className="mt-6 pt-4 border-t border-[#E6E5DF] flex justify-between items-center text-[10.5px] text-[#5C6460] font-medium">
                    <span>Registry Target count:</span>
                    <span className="font-bold font-mono text-[#1A2421]">{detail.targetCount} fully verified farmers</span>
                  </div>
                </div>
              );
            })}

          </div>

          {/* Simple Commission Multipliers Table */}
          <div className="bg-white border border-[#E6E5DF] rounded-3xl p-6 shadow-sm space-y-4">
            <h3 className="font-display font-semibold text-base text-[#1A2421]">Standard Cooperative Agent Commission Rate Sheet</h3>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left font-sans text-xs border-collapse">
                <thead>
                  <tr className="bg-[#FAF8F5] text-slate-500 font-bold border-b border-[#E6E5DF]">
                    <th className="p-3">Activity Trigger</th>
                    <th className="p-3 text-center">Bronze Base Incentive</th>
                    <th className="p-3 text-center">Silver (1.1x)</th>
                    <th className="p-3 text-center">Gold (1.25x)</th>
                    <th className="p-3 text-center">Platinum (1.5x)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E6E5DF] text-[#1A2421] font-medium">
                  <tr>
                    <td className="p-3 font-bold">New Farmer Onboarding KYC Success</td>
                    <td className="p-3 text-center text-slate-600">₦2,500 flat</td>
                    <td className="p-3 text-center text-slate-600">₦2,750</td>
                    <td className="p-3 text-center text-slate-600">₦3,125</td>
                    <td className="p-3 text-center text-[#135D39] font-bold">₦3,750</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-bold">Membership upgrade (Gold subscription)</td>
                    <td className="p-3 text-center text-slate-600">₦3,500 (10%)</td>
                    <td className="p-3 text-center text-slate-600">₦3,850</td>
                    <td className="p-3 text-center text-slate-600">₦4,375</td>
                    <td className="p-3 text-center text-[#135D39] font-bold">₦5,250</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-bold">Annual Premium membership tier upgrade</td>
                    <td className="p-3 text-center text-slate-600">₦7,500 (10%)</td>
                    <td className="p-3 text-center text-slate-600">₦8,250</td>
                    <td className="p-3 text-center text-slate-600">₦9,375</td>
                    <td className="p-3 text-center text-[#135D39] font-bold">₦11,250</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-bold">Savings deposit goals topup referral</td>
                    <td className="p-3 text-center text-slate-600">₦1,500 flat rate</td>
                    <td className="p-3 text-center text-slate-600">₦1,650</td>
                    <td className="p-3 text-center text-slate-600">₦1,875</td>
                    <td className="p-3 text-center text-[#135D39] font-bold">₦2,250</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-bold">Tractor / Harvester lease reservation (BK referral)</td>
                    <td className="p-3 text-center text-slate-600">5.0% commission</td>
                    <td className="p-3 text-center text-slate-600">5.5%</td>
                    <td className="p-3 text-center text-slate-600">6.25%</td>
                    <td className="p-3 text-center text-[#135D39] font-bold">7.5%</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-bold">Storefront Fertilizers & Agrochemicals checkout</td>
                    <td className="p-3 text-center text-slate-600">2.5% commission</td>
                    <td className="p-3 text-center text-slate-600">2.75%</td>
                    <td className="p-3 text-center text-slate-600">3.125%</td>
                    <td className="p-3 text-center text-[#135D39] font-bold">3.75%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
