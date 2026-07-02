import React, { useState, useEffect, useRef } from "react";
import { 
  Users, 
  Plus, 
  Send, 
  Vote, 
  CheckCircle, 
  Calendar, 
  TrendingUp, 
  MessageSquare,
  ArrowLeft,
  Coins,
  ShieldCheck,
  User,
  AlertCircle,
  Clock,
  PiggyBank,
  ThumbsUp,
  Award,
  ChevronRight,
  Activity
} from "lucide-react";
import { FarmerAppState, ContributionGroup, WalletTransaction } from "../../types";

interface AdasheViewProps {
  state: FarmerAppState;
  onNavigate: (tab: string) => void;
  onJoinGroup: (groupId: string) => void;
  onPayContribution: (groupId: string, amount: number) => void;
  onClaimPayout: (groupId: string, amount: number) => void;
  onSendMessage: (groupId: string, sender: string, message: string) => void;
  onVoteProposal: (groupId: string, proposalId: string, vote: "yes" | "no") => void;
  onCreateProposal: (groupId: string, proposalText: string) => void;
  onCheckInAttendance: (groupId: string, date: string) => void;
  onCreateAdasheGroup: (group: Omit<ContributionGroup, "id" | "currentPool" | "totalPayoutPool" | "nextPayoutDate" | "hasJoined">) => void;
}

export default function AdasheView({
  state,
  onNavigate,
  onJoinGroup,
  onPayContribution,
  onClaimPayout,
  onSendMessage,
  onVoteProposal,
  onCreateProposal,
  onCheckInAttendance,
  onCreateAdasheGroup
}: AdasheViewProps) {
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<"overview" | "chat" | "voting" | "attendance" | "performance">("overview");
  
  // Create Group Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDesc, setNewGroupDesc] = useState("");
  const [newGroupAmount, setNewGroupAmount] = useState<number>(20000);
  const [newGroupFreq, setNewGroupFreq] = useState<"weekly" | "monthly">("monthly");
  const [newGroupSlots, setNewGroupSlots] = useState<number>(10);

  // Proposal form state
  const [isProposalFormOpen, setIsProposalFormOpen] = useState(false);
  const [newProposalText, setNewProposalText] = useState("");

  // Input chat state
  const [chatInput, setChatInput] = useState("");
  const chatBottomRef = useRef<HTMLDivElement | null>(null);

  const selectedGroup = state.contributionGroups.find(g => g.id === selectedGroupId);

  // Scroll to bottom of chat when clicking Chat tab or receiving messages
  useEffect(() => {
    if (activeSubTab === "chat" && chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [activeSubTab, selectedGroup?.chatHistory]);

  const formatCurrency = (val: number) => {
    return "₦" + Math.round(val).toLocaleString();
  };

  const handleCreateGroupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim() || !newGroupDesc.trim()) {
      alert("Please fill out all group details.");
      return;
    }

    onCreateAdasheGroup({
      name: newGroupName,
      description: newGroupDesc,
      cycleAmount: newGroupAmount,
      memberCount: 1, // User is first member
      userRank: "Slot #1",
      frequency: newGroupFreq,
      maxSlots: newGroupSlots,
      repaymentConsistency: 100
    });

    setIsCreateModalOpen(false);
    setNewGroupName("");
    setNewGroupDesc("");
    setNewGroupAmount(20000);
    setNewGroupFreq("monthly");
    setNewGroupSlots(10);
  };

  const handleSendChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !selectedGroupId) return;

    onSendMessage(selectedGroupId, "Aliyu (You)", chatInput);
    setChatInput("");

    // Simulate other farmers replying after 1.5 seconds to make the app incredibly interactive
    setTimeout(() => {
      const responses = [
        "That sounds highly recommended for our cassava plot cycle, comrade!",
        "Double-checked my transaction sheet, direct payout looks extremely swift.",
        "Yes, we should bring this up in our upcoming verification check-in.",
        "Comrades, let's keep saving! Unity makes us strong.",
        "Outstanding! Bennie Agro continues to support our rotating pools."
      ];
      const randomMsg = responses[Math.floor(Math.random() * responses.length)];
      const names = ["Amina Bello", "Sani Kalla", "Zainab Umar", "Musa Haruna"];
      const randomName = names[Math.floor(Math.random() * names.length)];
      
      onSendMessage(selectedGroupId, randomName, randomMsg);
    }, 1500);
  };

  const handleCreateProposalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProposalText.trim() || !selectedGroupId) return;
    onCreateProposal(selectedGroupId, newProposalText);
    setNewProposalText("");
    setIsProposalFormOpen(false);
  };

  // Quick statistics for current user status
  const totalContributedMoney = state.contributionGroups
    .filter(g => g.hasJoined)
    .reduce((acc, curr) => acc + (curr.savingHistory?.reduce((sAcc, sCurr) => sAcc + sCurr.amount, 0) || 0), 0);

  const activeRotationsCount = state.contributionGroups.filter(g => g.hasJoined).length;

  return (
    <div className="space-y-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      
      {/* Overview/Header section */}
      {!selectedGroupId ? (
        <>
          <div className="bg-gradient-to-r from-[#125D39] via-[#1a6e43] to-[#2F8537] rounded-[28px] p-6 md:p-8 text-white shadow-lg border border-[#135D39]/10 relative overflow-hidden">
            <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/5 blur-3xl pointer-events-none" />
            <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-white/90 text-sm font-semibold uppercase tracking-wider">
                  <span className="text-emerald-300">👥</span> Traditional Thrift Savings
                </div>
                <h1 className="text-3xl font-display font-medium tracking-tight">
                  Adashe Ajo Circles
                </h1>
                <p className="max-w-2xl text-xs sm:text-sm text-emerald-100/90 leading-relaxed">
                  Join rotating savings groups with certified cooperative crop growers. Secure zero-interest capital rotations, build digital social trust, and access group-voted hardware.
                </p>
              </div>

              <button 
                onClick={() => setIsCreateModalOpen(true)}
                className="bg-[#E9A42F] hover:bg-[#d59124] text-stone-900 font-bold px-6 py-3 text-xs sm:text-sm rounded-full shadow-md transition-all flex items-center gap-2 duration-200 shrink-0 cursor-pointer"
              >
                <Plus className="w-4 h-4 text-stone-900 font-bold" />
                Create New Circle
              </button>
            </div>

            {/* Micro Dashboard Widget */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-8 pt-6 border-t border-white/15">
              <div>
                <span className="text-[10px] uppercase font-bold text-white/70 tracking-wider">Total Adashe Contributed</span>
                <h2 className="text-xl md:text-2xl font-mono font-bold mt-1 text-white">
                  {formatCurrency(totalContributedMoney)}
                </h2>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-white/70 tracking-wider">Active Circles Joined</span>
                <h2 className="text-xl md:text-2xl font-mono font-bold mt-1 text-white">
                  {activeRotationsCount} Circles
                </h2>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-white/70 tracking-wider">Cooperative Wallet Liquid</span>
                <h2 className="text-xl md:text-2xl font-mono font-bold mt-1 text-[#E9A42F]">
                  {formatCurrency(state.walletBalance)}
                </h2>
              </div>
            </div>
          </div>

          {/* Group Circle Tabs List */}
          <div className="space-y-6">
            <h2 className="font-display font-semibold text-xl text-[#1A2421]">Available Contribution Circles</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {state.contributionGroups.map((grp) => {
                const totalTargetGoal = grp.cycleAmount * (grp.maxSlots || grp.memberCount);
                const progressPercentage = grp.hasJoined ? Math.round((grp.currentPool / totalTargetGoal) * 100) : 0;
                
                return (
                  <div 
                    key={grp.id} 
                    className="bg-white border border-[#E6E5DF] rounded-3xl p-6 shadow-sm flex flex-col justify-between hover:border-[#135D39]/30 hover:shadow-md transition-all duration-350"
                  >
                    <div>
                      <div className="flex justify-between items-start gap-4">
                        <div className="space-y-1.5">
                          <h3 className="font-display font-semibold text-[#1A2421] text-lg hover:text-[#135D39] transition-colors cursor-pointer" onClick={() => {
                            if (grp.hasJoined) setSelectedGroupId(grp.id);
                          }}>
                            {grp.name}
                          </h3>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[10px] bg-sky-50 text-sky-800 border border-sky-100 font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
                              {grp.frequency || "monthly"}
                            </span>
                            <span className="text-[10px] bg-stone-50 border border-stone-200 text-stone-600 font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
                              N{grp.cycleAmount.toLocaleString()} / cycle
                            </span>
                          </div>
                        </div>

                        {grp.hasJoined ? (
                          <span className="bg-[#135D39]/15 text-[#135D39] border border-[#135D39]/20 font-bold px-3 py-1 rounded-full text-[10.5px] uppercase tracking-wider">
                            Member
                          </span>
                        ) : (
                          <span className="bg-stone-50 text-stone-500 border border-stone-200 font-medium px-3 py-1 rounded-full text-[10.5px] uppercase">
                            Open
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-[#5C6460] mt-3 leading-relaxed">
                        {grp.description}
                      </p>

                      <div className="grid grid-cols-2 gap-4 mt-5 bg-[#FAF8F5] p-3 rounded-2xl border border-[#E6E5DF] text-xs">
                        <div>
                          <span className="text-stone-400 font-medium text-[10.5px] block">Rotational Slots</span>
                          <span className="font-bold text-[#1A2421] mt-0.5 block">{grp.memberCount} / {grp.maxSlots || 10} Filled</span>
                        </div>
                        <div>
                          <span className="text-stone-400 font-medium text-[10.5px] block">Yield Repayment Consistency</span>
                          <span className="font-bold text-emerald-700 mt-0.5 block">⚡ {grp.repaymentConsistency || 100}%</span>
                        </div>
                        <div>
                          <span className="text-stone-400 font-medium text-[10.5px] block">Cycle Total Pot</span>
                          <span className="font-mono font-bold text-[#135D39] mt-0.5 block">{formatCurrency(grp.cycleAmount * (grp.maxSlots || 10))}</span>
                        </div>
                        <div>
                          <span className="text-stone-400 font-medium text-[10.5px] block">Your Rank Sequence</span>
                          <span className="font-semibold text-stone-800 mt-0.5 block">{grp.hasJoined ? grp.userRank : "N/A"}</span>
                        </div>
                      </div>

                      {/* Visual progress bar if joined */}
                      {grp.hasJoined && (
                        <div className="space-y-1.5 mt-5">
                          <div className="flex justify-between items-center text-[11px] font-medium text-stone-600">
                            <span>Round Pool Progress</span>
                            <span>{formatCurrency(grp.currentPool)} Saved ({progressPercentage}%)</span>
                          </div>
                          <div className="w-full bg-stone-200 h-2.5 rounded-full overflow-hidden">
                            <div 
                              className="bg-[#135D39] h-full rounded-full transition-all duration-300"
                              style={{ width: `${Math.min(100, progressPercentage)}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="pt-5 border-t border-[#E6E5DF]/50 mt-5 flex justify-between items-center gap-4">
                      {grp.hasJoined ? (
                        <>
                          <span className="text-[11px] text-[#135D39] font-semibold flex items-center gap-1">
                            <CheckCircle className="w-3.5 h-3.5 text-[#135D39]" /> Next payout: {grp.nextPayoutDate}
                          </span>
                          <button 
                            onClick={() => {
                              setSelectedGroupId(grp.id);
                              setActiveSubTab("overview");
                            }}
                            className="bg-[#135D39] hover:bg-[#0f4a2d] text-white font-bold text-xs px-4 py-2 rounded-xl transition duration-200 cursor-pointer flex items-center justify-center gap-1 shadow-sm"
                          >
                            Enter Workspace <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="text-[11px] text-stone-500">
                            Required contribution: <b className="font-bold text-stone-800">{formatCurrency(grp.cycleAmount)}</b>
                          </span>
                          <button 
                            onClick={() => onJoinGroup(grp.id)}
                            className="bg-[#135D39] hover:bg-[#0f4a2d] text-white font-bold text-xs px-4 py-2 rounded-xl transition duration-200 cursor-pointer"
                          >
                            Join Group Thread
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      ) : (
        /* Detailed selected group workspace viewport */
        <div className="space-y-6">
          
          {/* Detailed workspace header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white border border-[#E6E5DF] p-4 sm:p-6 rounded-[24px] shadow-xs">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setSelectedGroupId(null)}
                className="p-2 sm:p-3 hover:bg-stone-100 rounded-xl transition border border-[#E6E5DF] text-[#1A2421] cursor-pointer"
                title="Back to Circles"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              
              <div>
                <span className="text-[10px] text-[#135D39] uppercase font-bold tracking-wider block">Cooperative Thrift Channel</span>
                <h1 className="text-xl sm:text-2xl font-display font-semibold text-stone-900">{selectedGroup?.name}</h1>
                <p className="text-xs text-[#5C6460] mt-0.5 max-w-xl">{selectedGroup?.description}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <span className="text-xs uppercase bg-emerald-50 text-emerald-800 border border-emerald-150 font-bold px-3 py-1.5 rounded-full">
                👑 Rank: {selectedGroup?.userRank}
              </span>
            </div>
          </div>

          {/* Sub Navigation Bar Tab strip */}
          <div className="flex overflow-x-auto gap-2 border-b border-[#E6E5DF] pb-1.5 scrollbar-thin scrollbar-thumb-stone-200">
            <button
              onClick={() => setActiveSubTab("overview")}
              className={`px-4 py-2 text-xs font-bold transition-all whitespace-nowrap rounded-lg flex items-center gap-2 cursor-pointer ${
                activeSubTab === "overview" 
                  ? "bg-[#135D39] text-white shadow-xs" 
                  : "text-[#5C6460] hover:text-stone-900 hover:bg-stone-100"
              }`}
            >
              <Coins className="w-4 h-4" /> Rotations & Payouts
            </button>
            
            <button
              onClick={() => setActiveSubTab("chat")}
              className={`px-4 py-2 text-xs font-bold transition-all whitespace-nowrap rounded-lg flex items-center gap-2 cursor-pointer ${
                activeSubTab === "chat" 
                  ? "bg-[#135D39] text-white shadow-xs" 
                  : "text-[#5C6460] hover:text-stone-900 hover:bg-stone-100"
              }`}
            >
              <MessageSquare className="w-4 h-4" /> Group Chat
              {selectedGroup?.chatHistory && (
                <span className="bg-amber-400 text-stone-950 text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                  {selectedGroup.chatHistory.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveSubTab("voting")}
              className={`px-4 py-2 text-xs font-bold transition-all whitespace-nowrap rounded-lg flex items-center gap-2 cursor-pointer ${
                activeSubTab === "voting" 
                  ? "bg-[#135D39] text-white shadow-xs" 
                  : "text-[#5C6460] hover:text-stone-900 hover:bg-stone-100"
              }`}
            >
              <Vote className="w-4 h-4" /> Proposals & Voting
            </button>

            <button
              onClick={() => setActiveSubTab("attendance")}
              className={`px-4 py-2 text-xs font-bold transition-all whitespace-nowrap rounded-lg flex items-center gap-2 cursor-pointer ${
                activeSubTab === "attendance" 
                  ? "bg-[#135D39] text-white shadow-xs" 
                  : "text-[#5C6460] hover:text-stone-900 hover:bg-stone-100"
              }`}
            >
              <Calendar className="w-4 h-4" /> Attendance Logs
            </button>

            <button
              onClick={() => setActiveSubTab("performance")}
              className={`px-4 py-2 text-xs font-bold transition-all whitespace-nowrap rounded-lg flex items-center gap-2 cursor-pointer ${
                activeSubTab === "performance" 
                  ? "bg-[#135D39] text-white shadow-xs" 
                  : "text-[#5C6460] hover:text-stone-900 hover:bg-stone-100"
              }`}
            >
              <TrendingUp className="w-4 h-4" /> Performance Metrics
            </button>
          </div>

          {/* VIEW: SUBSCRIPTION TAB: OVERVIEW AND ROTATIONS */}
          {activeSubTab === "overview" && selectedGroup && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Left Side: Payout Sequence Rotations Grid */}
              <div className="lg:col-span-8 bg-white border border-[#E6E5DF] p-6 rounded-[24px] shadow-xs space-y-6">
                <div>
                  <h3 className="font-display font-semibold text-stone-900 text-lg">Adashe Rotational Cycle</h3>
                  <p className="text-xs text-[#5C6460] mt-0.5">Rotating payout dispatch order. All funds are secured and locked by cooperative bylaws.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Generated virtual members based on max slots */}
                  {Array.from({ length: selectedGroup.maxSlots || 10 }).map((_, idx) => {
                    const slotNum = idx + 1;
                    const isUserSlot = slotNum === 5; // Aliyu is Slot 5
                    
                    // Assign name from members list or virtual name
                    let memberName = selectedGroup.members?.[idx] || `Farmer Comrade #${slotNum}`;
                    if (isUserSlot) memberName = "Aliyu (You - Slot #5)";

                    // Determine payment status
                    const isPaid = slotNum < (selectedGroup.activePayoutSlot || 1);
                    const isActive = slotNum === selectedGroup.activePayoutSlot;
                    const isMaturedNotPaid = slotNum === 5 && selectedGroup.currentPool >= (selectedGroup.cycleAmount * (selectedGroup.maxSlots || 10)); // simulated condition where user completed and pool is filled but payout not claimed
                    
                    return (
                      <div 
                        key={slotNum}
                        className={`p-4 rounded-2xl border transition flex justify-between items-center ${
                          isActive 
                            ? "bg-amber-50/70 border-amber-300 ring-1 ring-amber-200" 
                            : isPaid 
                            ? "bg-stone-50 border-stone-150 opacity-70"
                            : isUserSlot
                            ? "border-[#135D39] bg-emerald-50/50"
                            : "border-stone-150 bg-white"
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono text-[10px] uppercase font-bold text-stone-500">
                              Slot {slotNum.toString().padStart(2, "0")}
                            </span>
                            {isActive && (
                              <span className="bg-amber-100 text-amber-900 text-[8.5px] uppercase font-extrabold px-1.5 py-0.5 rounded-full tracking-wider border border-amber-200 animate-pulse">
                                Active Payout
                              </span>
                            )}
                            {isPaid && (
                              <span className="bg-stone-200 text-stone-700 text-[8.5px] uppercase font-semibold px-1.5 py-0.5 rounded-full">
                                Dispersed
                              </span>
                            )}
                            {!isPaid && !isActive && (
                              <span className="bg-blue-105 text-blue-700 text-[8.5px] uppercase font-semibold px-1.5 py-0.5 rounded">
                                Queue
                              </span>
                            )}
                          </div>
                          
                          <h4 className={`font-bold text-sm ${isUserSlot ? "text-[#135D39] underline font-extrabold" : "text-stone-800"}`}>
                            {memberName}
                          </h4>
                          
                          <p className="text-[11px] text-[#5C6460]">
                            Payout target: <b className="font-bold text-stone-900">{formatCurrency(selectedGroup.cycleAmount * (selectedGroup.maxSlots || 10))}</b>
                          </p>
                        </div>

                        {/* Status Checkmark indicator */}
                        <div className="shrink-0">
                          {isPaid ? (
                            <div className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center text-stone-400">
                              ✔
                            </div>
                          ) : isActive ? (
                            <Clock className="w-6 h-6 text-amber-600 animate-spin" />
                          ) : isUserSlot ? (
                            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-[#135D39] font-bold text-xs ring-4 ring-emerald-50">
                              ⭐
                            </div>
                          ) : (
                            <div className="w-4 h-4 rounded-full border-2 border-stone-200" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Side: Quick Action and Pool status */}
              <div className="lg:col-span-4 space-y-6">
                
                {/* Micro Action Box: Top Up Contribution */}
                <div className="bg-white border border-[#E6E5DF] p-6 rounded-[24px] shadow-xs space-y-4">
                  <div className="space-y-1">
                    <span className="text-[9.5px] uppercase font-bold text-[#5C6460] tracking-wider block">Monthly Dues Invoice</span>
                    <h3 className="font-display font-semibold text-[#1A2421] text-base">Contribute your portion</h3>
                    <p className="text-xs text-[#5C6460]">Your recurring contribution of <b>{formatCurrency(selectedGroup.cycleAmount)}</b> is due soon for this round.</p>
                  </div>

                  <div className="bg-[#FAF8F5] border border-[#E6E5DF] p-3 rounded-2xl flex justify-between items-center">
                    <span className="text-xs text-stone-500 font-medium">Group contribution APY:</span>
                    <span className="bg-[#135D39]/10 text-[#135D39] text-xs font-bold px-2 py-0.5 rounded">0.0% interest (Rotating)</span>
                  </div>

                  <button 
                    onClick={() => {
                      if (state.walletBalance < selectedGroup.cycleAmount) {
                        alert(`Dues payment failed! Your Cooperative wallet contains ${formatCurrency(state.walletBalance)}, which is insufficient to cover N${selectedGroup.cycleAmount.toLocaleString()}. Please fund your digital wallet first from the Wallet screen.`);
                        return;
                      }
                      
                      const confirmed = window.confirm(`Confirm payment of ${formatCurrency(selectedGroup.cycleAmount)} from your wallet to: ${selectedGroup.name}?`);
                      if (confirmed) {
                        onPayContribution(selectedGroup.id, selectedGroup.cycleAmount);
                      }
                    }}
                    className="w-full bg-[#135D39] hover:bg-[#0f4a2d] text-white font-bold text-xs sm:text-sm py-3 rounded-xl transition duration-200 cursor-pointer shadow-xs flex items-center justify-center gap-1.5"
                  >
                    <Coins className="w-4 h-4" />
                    Pay portion ({formatCurrency(selectedGroup.cycleAmount)})
                  </button>

                  <p className="text-[10px] text-center text-stone-400">
                    Paid portions immediately clear your Slot {selectedGroup.userRank} validation index.
                  </p>
                </div>

                {/* Micro Action Box: Rotational Claim Payout */}
                <div className="bg-amber-50/50 border border-amber-200 p-6 rounded-[24px] shadow-xs space-y-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-amber-800 text-[10px] font-bold uppercase tracking-wider">
                      <Award className="w-3.5 h-3.5" /> Special Milestone Reward
                    </div>
                    <h3 className="font-display font-semibold text-amber-950 text-base">Claim Payout Cycle</h3>
                    <p className="text-xs text-amber-900/80">When the active rotation slot index shifts to <b className="font-bold underline text-[#135D39]">Slot #5 (Aliyu)</b>, you will claim the absolute rotational payout of <b>{formatCurrency(selectedGroup.cycleAmount * (selectedGroup.members?.length || selectedGroup.maxSlots || 10))}</b> back directly to your wallet!</p>
                  </div>

                  {/* Simulated condition checking */}
                  {selectedGroup.activePayoutSlot === 5 ? (
                    <button 
                      onClick={() => {
                        const targetPayoutAmt = selectedGroup.cycleAmount * (selectedGroup.members?.length || selectedGroup.maxSlots || 10);
                        onClaimPayout(selectedGroup.id, targetPayoutAmt);
                      }}
                      className="w-full bg-amber-500 hover:bg-amber-600 text-stone-900 font-bold text-xs sm:text-sm py-3 rounded-xl transition duration-200 cursor-pointer shadow-md flex items-center justify-center gap-1.5 border border-amber-300"
                    >
                      🎉 Claim Rotational Payout ({formatCurrency(selectedGroup.cycleAmount * (selectedGroup.members?.length || selectedGroup.maxSlots || 10))})
                    </button>
                  ) : (
                    <div className="p-3 bg-amber-100/50 rounded-xl border border-amber-250 text-center text-[11px] text-amber-900 font-medium">
                      🔒 Claim locked. Active payout is currently on Slot #{selectedGroup.activePayoutSlot} (Ibrahim Kabiru). Payout rotates to you next cycle in 3 weeks!
                    </div>
                  )}

                  {/* Added utility to trigger simulation payout rotation */}
                  <div className="pt-3 border-t border-amber-200/50 flex justify-between items-center text-[11px] text-amber-900/80">
                    <span>Admin Sandbox Controls</span>
                    <button 
                      onClick={() => {
                        // Quick simulation mode helper to simulate progress
                        if (selectedGroup.activePayoutSlot === 4) {
                          alert("Simulating round compilation... Ibrahim Kabiru's cycle is marked completed. Rotational sequence index shifted to Slot #5 (Aliyu)! You are now active to claim the pool.");
                          // Trigger update
                          onSendMessage(selectedGroup.id, "Admin Bot", "SYSTEM INFO: Rotational cycle is shifted. Aliyu (Slot 5) is now authorized to claim the active pool.");
                        } else {
                          alert(`Current active slot shifted successfully back to Slot #4.`);
                        }
                      }}
                      className="text-amber-805 hover:underline font-bold text-[10px] bg-amber-200/50 px-2 py-0.5 rounded border border-amber-250 cursor-pointer"
                    >
                      Admin Force Shift Slot ⚡
                    </button>
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* VIEW: GROUP CHAT TAB */}
          {activeSubTab === "chat" && selectedGroup && (
            <div className="bg-white border border-[#E6E5DF] rounded-[24px] shadow-sm overflow-hidden flex flex-col h-[550px]">
              
              {/* Chat Title bar */}
              <div className="bg-[#FAF8F5] border-b border-[#E6E5DF] px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#135D39]/10 text-[#135D39] flex items-center justify-center border border-[#135D39]/15">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-[#1A2421] text-sm">{selectedGroup.name} Discussion Board</h3>
                    <p className="text-[11px] text-[#5C6460]">Active conversation • {selectedGroup.members?.length} cooperative members verified</p>
                  </div>
                </div>

                <div className="text-right hidden sm:block">
                  <span className="text-[10px] text-emerald-800 bg-[#135D39]/10 px-2.5 py-0.5 rounded-full font-bold border border-[#135D39]/20">
                    ● Encrypted peer channel
                  </span>
                </div>
              </div>

              {/* Chat messages viewport */}
              <div className="flex-grow p-6 overflow-y-auto space-y-4 bg-stone-50/50">
                {selectedGroup.chatHistory?.map((msg) => {
                  if (msg.system) {
                    return (
                      <div key={msg.id} className="flex justify-center my-3">
                        <div className="bg-amber-50 text-amber-900 border border-amber-100 rounded-2xl px-4 py-2 text-[11px] text-center max-w-lg shadow-2xs font-semibold leading-relaxed flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                          <span>{msg.message}</span>
                        </div>
                      </div>
                    );
                  }

                  const isMe = msg.sender === "Aliyu (You)" || msg.isUser;
                  return (
                    <div 
                      key={msg.id} 
                      className={`flex gap-3 max-w-xl ${isMe ? "ml-auto flex-row-reverse" : ""}`}
                    >
                      {/* Avatar */}
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                        isMe ? "bg-[#135D39] text-white" : "bg-stone-200 text-stone-700"
                      }`}>
                        {msg.avatar || msg.sender.slice(0, 2)}
                      </div>

                      {/* Content block */}
                      <div className="space-y-1">
                        <div className={`flex items-center gap-2 ${isMe ? "justify-end" : ""}`}>
                          <span className="text-xs font-bold text-stone-800">{msg.sender}</span>
                          <span className="text-[9.5px] text-stone-400 font-mono">{msg.time}</span>
                        </div>
                        
                        <div className={`p-3.5 rounded-2xl text-xs leading-relaxed ${
                          isMe 
                            ? "bg-[#135D39] text-white rounded-tr-none shadow-3xs" 
                            : "bg-white border border-[#E6E5DF] text-stone-900 rounded-tl-none shadow-3xs"
                        }`}>
                          {msg.message}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={chatBottomRef} />
              </div>

              {/* Chat Send Form */}
              <form 
                onSubmit={handleSendChatSubmit}
                className="bg-[#FAF8F5] border-t border-[#E6E5DF] p-4 flex gap-3 items-center"
              >
                <input 
                  type="text" 
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Ask a question about layout payout or share tractor rental updates..."
                  className="flex-grow bg-white border border-[#E6E5DF] rounded-2xl px-4 py-3 text-xs sm:text-sm text-stone-900 placeholder-stone-400 focus:outline-[#135D39] transition-all"
                />
                
                <button 
                  type="submit"
                  disabled={!chatInput.trim()}
                  className="bg-[#135D39] hover:bg-[#0f4a2d] disabled:opacity-50 disabled:cursor-not-allowed text-white p-3 rounded-2xl transition cursor-pointer flex items-center justify-center shrink-0"
                >
                  <Send className="w-4.5 h-4.5" />
                </button>
              </form>

            </div>
          )}

          {/* VIEW: DEMOCRATIC VOTING TAB */}
          {activeSubTab === "voting" && selectedGroup && (
            <div className="space-y-6">
              
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white border border-[#E6E5DF] p-6 rounded-[24px] shadow-xs">
                <div>
                  <h3 className="font-display font-semibold text-stone-900 text-lg">Group Decisions & Voting</h3>
                  <p className="text-xs text-[#5C6460] mt-0.5">Farmers maintain absolute control via cooperative voting structures. Proposals require a absolute majority to pass.</p>
                </div>

                <button 
                  onClick={() => setIsProposalFormOpen(!isProposalFormOpen)}
                  className="bg-[#135D39] hover:bg-[#0f4a2d] text-white font-bold px-4 py-2 text-xs rounded-xl transition duration-200 cursor-pointer flex items-center gap-1 shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" /> Post Proposal
                </button>
              </div>

              {/* Collapsible Proposal Post Proposal Form */}
              {isProposalFormOpen && (
                <div className="bg-white border border-[#E6E5DF] p-6 rounded-[24px] shadow-sm animate-fade-in space-y-4">
                  <h4 className="font-semibold text-stone-850 text-sm">Post New Democratic Proposal</h4>
                  <p className="text-xs text-[#5C6460]">Proposals will be visible to all verified cooperative slots. Active quorum requires 10 votes.</p>
                  
                  <form onSubmit={handleCreateProposalSubmit} className="space-y-4">
                    <textarea
                      value={newProposalText}
                      onChange={(e) => setNewProposalText(e.target.value)}
                      placeholder="e.g., Increase our monthly dues contribution by ₦5,000 next cycle to enable procurement of a joint crop de-husking thresher machine."
                      rows={3}
                      className="w-full bg-[#FAF8F5] border border-[#E6E5DF] rounded-2xl p-4 text-xs sm:text-sm text-stone-900 placeholder-stone-400 focus:outline-[#135D39] transition"
                    />

                    <div className="flex justify-end gap-2.5">
                      <button 
                        type="button" 
                        onClick={() => setIsProposalFormOpen(false)}
                        className="bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold px-4 py-2 rounded-xl text-xs transition cursor-pointer"
                      >
                        Cancel
                      </button>
                      
                      <button 
                        type="submit" 
                        disabled={!newProposalText.trim()}
                        className="bg-[#135D39] hover:bg-[#0f4a2d] disabled:opacity-50 text-white font-bold px-4 py-2 rounded-xl text-xs transition cursor-pointer shadow-sm"
                      >
                        Submit Proposal
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Proposal Lists displaying */}
              <div className="space-y-4">
                {selectedGroup.votes?.map((prop) => {
                  const totalVoted = prop.yesVotes + prop.noVotes;
                  const pctYes = totalVoted > 0 ? Math.round((prop.yesVotes / totalVoted) * 100) : 0;
                  const pctNo = totalVoted > 0 ? Math.round((prop.noVotes / totalVoted) * 100) : 0;
                  
                  return (
                    <div 
                      key={prop.id} 
                      className="bg-white border border-[#E6E5DF] rounded-[24px] p-6 shadow-sm space-y-4"
                    >
                      <div className="flex justify-between items-start gap-4">
                        <div className="space-y-1">
                          <span className={`text-[9.5px] uppercase font-extrabold px-2 py-0.5 rounded ${
                            prop.status === "active" ? "bg-emerald-50 text-emerald-800 border-emerald-100 border" :
                            prop.status === "passed" ? "bg-blue-50 text-blue-800 border-blue-100 border" : "bg-stone-100 text-stone-600 border border-stone-250"
                          }`}>
                            {prop.status} proposal
                          </span>
                          <h4 className="font-bold text-[#1A2421] text-sm mt-1.5 leading-relaxed">
                            {prop.proposal}
                          </h4>
                        </div>

                        {prop.userVoted && (
                          <div className="bg-emerald-50 text-emerald-700 border border-emerald-150 rounded-full px-3 py-1 text-[10.5px] font-bold tracking-tight">
                            ✔ You Voted: <span className="uppercase text-md">{prop.userVoted}</span>
                          </div>
                        )}
                      </div>

                      {/* Vote statistics bars */}
                      <div className="space-y-2 mt-4 bg-[#FAF8F5] p-4 rounded-2xl border border-[#E6E5DF]">
                        <div className="flex justify-between text-xs font-semibold text-stone-700">
                          <span className="flex items-center gap-1.5"><ThumbsUp className="w-3.5 h-3.5 text-emerald-600" /> Yes ({prop.yesVotes} votes)</span>
                          <span>{pctYes}%</span>
                        </div>
                        <div className="w-full bg-stone-200 h-2 rounded-full overflow-hidden">
                          <div 
                            className="bg-emerald-600 h-full rounded-full transition-all duration-300" 
                            style={{ width: `${pctYes}%` }}
                          />
                        </div>

                        <div className="flex justify-between text-xs font-semibold text-stone-700 pt-2">
                          <span className="flex items-center gap-1.5">No ({prop.noVotes} votes)</span>
                          <span>{pctNo}%</span>
                        </div>
                        <div className="w-full bg-stone-200 h-2 rounded-full overflow-hidden">
                          <div 
                            className="bg-stone-400 h-full rounded-full transition-all duration-300" 
                            style={{ width: `${pctNo}%` }}
                          />
                        </div>
                      </div>

                      {/* Action buttons to vote if Active */}
                      {prop.status === "active" && !prop.userVoted && (
                        <div className="flex items-center gap-2.5 pt-2">
                          <button 
                            onClick={() => onVoteProposal(selectedGroup.id, prop.id, "yes")}
                            className="bg-emerald-50 hover:bg-emerald-100/80 text-emerald-800 border border-emerald-250 font-bold px-4 py-2 rounded-xl text-xs transition cursor-pointer"
                          >
                            👍 Cast YES
                          </button>
                          
                          <button 
                            onClick={() => onVoteProposal(selectedGroup.id, prop.id, "no")}
                            className="bg-stone-50 hover:bg-stone-100 text-stone-800 border border-stone-300 font-bold px-4 py-2 rounded-xl text-xs transition cursor-pointer"
                          >
                            👎 Cast NO
                          </button>
                          
                          <span className="text-[11px] text-stone-400 ml-auto select-none">
                            Quorum progress: {totalVoted} / {prop.totalSlots} slots casted
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

            </div>
          )}

          {/* VIEW: ATTENDANCE TRACKING TAB */}
          {activeSubTab === "attendance" && selectedGroup && (
            <div className="bg-white border border-[#E6E5DF] rounded-[24px] p-6 shadow-sm space-y-6">
              <div className="space-y-1 pb-4 border-b border-[#E6E5DF]">
                <h3 className="font-display font-semibold text-stone-900 text-lg">Weekly & Monthly Attendance Logs</h3>
                <p className="text-xs text-[#5C6460]">Regular verification meetings ensure transparent bookkeeping. Maintain 80%+ presence to secure active cooperative loan quotas.</p>
              </div>

              {/* Check-In interactive simulator */}
              {selectedGroup.attendance?.some(att => att.userStatus === "pending") && (
                <div className="bg-emerald-50/50 border-2 border-dashed border-[#135D39]/30 rounded-2xl p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="space-y-1">
                    <span className="bg-[#135D39] text-white text-[9px] font-extrabold uppercase px-2 py-0.5 rounded select-none tracking-widest animate-pulse">
                      Live verification open
                    </span>
                    <h4 className="font-bold text-[#1A2421] text-sm mt-1">Pending general check-in session detects!</h4>
                    <p className="text-xs text-[#5C6460]">Verify your physical cell tower presence safely to authorize active payout sequence cycles.</p>
                  </div>

                  <button 
                    onClick={() => {
                      const meeting = selectedGroup.attendance?.find(a => a.userStatus === "pending");
                      if (meeting) {
                        onCheckInAttendance(selectedGroup.id, meeting.date);
                      }
                    }}
                    className="bg-[#135D39] hover:bg-[#0f4a2d] text-white font-bold text-xs sm:text-sm px-5 py-3 rounded-xl transition duration-200 cursor-pointer shadow-xs flex items-center gap-1.5"
                  >
                    <ShieldCheck className="w-4.5 h-4.5" /> Check-in Present
                  </button>
                </div>
              )}

              {/* Attendance list display table */}
              <div className="overflow-hidden border border-stone-150 rounded-2xl">
                <table className="min-w-full divide-y divide-stone-150 text-left text-xs">
                  <thead className="bg-[#FAF8F5] text-stone-500 uppercase text-[9.5px] font-bold tracking-wider">
                    <tr>
                      <th className="px-6 py-3.5">Meeting Agenda Date</th>
                      <th className="px-6 py-3.5">General Session Topic</th>
                      <th className="px-6 py-3.5">Comrades Attended</th>
                      <th className="px-6 py-3.5">My Verification Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-150 font-medium text-stone-900">
                    {selectedGroup.attendance?.map((att, idx) => (
                      <tr key={idx} className="hover:bg-stone-50/50 transition">
                        <td className="px-6 py-4 font-mono font-bold text-[#135D39]">
                          {att.date}
                        </td>
                        <td className="px-6 py-4">
                          {att.title}
                        </td>
                        <td className="px-6 py-4">
                          <span className="bg-stone-100 text-stone-800 font-bold px-2 py-0.5 rounded">
                            {att.presentCount} / {selectedGroup.members?.length || 12} Present
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {att.userStatus === "present" ? (
                            <span className="text-emerald-700 font-bold flex items-center gap-1">
                              ✔ Present & Validated
                            </span>
                          ) : att.userStatus === "pending" ? (
                            <span className="text-amber-600 font-bold flex items-center gap-1 animate-pulse">
                              ⏳ Geo Check-in Pending
                            </span>
                          ) : (
                            <span className="text-red-650 font-bold">
                              ✖ Absent / Excused
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

            </div>
          )}

          {/* VIEW: GROUP PERFORMANCE DASHBOARD */}
          {activeSubTab === "performance" && selectedGroup && (
            <div className="space-y-6">
              
              {/* Three Metric highlights */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div className="bg-white border border-[#E6E5DF] p-6 rounded-[24px] shadow-xs space-y-2">
                  <span className="text-[10px] uppercase font-bold text-[#5C6460] tracking-wider">Group Repay Score</span>
                  <div className="flex items-baseline gap-2">
                    <h3 className="text-2xl sm:text-3xl font-bold font-sans text-emerald-800">{selectedGroup.repaymentConsistency}%</h3>
                    <span className="text-xs text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded">Perfect</span>
                  </div>
                  <p className="text-[11px] text-[#5C6460] leading-snug">Average cycle payment response timing among the {selectedGroup.members?.length} members.</p>
                </div>

                <div className="bg-white border border-[#E6E5DF] p-6 rounded-[24px] shadow-xs space-y-2">
                  <span className="text-[10px] uppercase font-bold text-[#5C6460] tracking-wider">Total Saving Cycles</span>
                  <div className="flex items-baseline gap-2">
                    <h3 className="text-2xl sm:text-3xl font-mono font-bold text-stone-900">{selectedGroup.savingHistory?.length || 0} Cycles</h3>
                    <span className="text-xs text-stone-500 font-mono">Completed</span>
                  </div>
                  <p className="text-[11px] text-[#5C6460] leading-snug">Number of times you successfully completed dues in this Rotating pool.</p>
                </div>

                <div className="bg-white border border-[#E6E5DF] p-6 rounded-[24px] shadow-xs space-y-2">
                  <span className="text-[10px] uppercase font-bold text-[#5C6460] tracking-wider">Accumulated Funds</span>
                  <div className="flex items-baseline gap-2">
                    <h3 className="text-2xl sm:text-3xl font-mono font-bold text-[#135D39]">{formatCurrency(selectedGroup.currentPool)}</h3>
                    <span className="text-xs text-emerald-700 font-mono">This round</span>
                  </div>
                  <p className="text-[11px] text-[#5C6460] leading-snug">The current absolute savings asset in custody of this rotating group pool.</p>
                </div>
              </div>

              {/* Dynamic visual charts layout */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Visual bar chart simulator */}
                <div className="lg:col-span-7 bg-white border border-[#E6E5DF] p-6 rounded-[24px] shadow-xs space-y-4">
                  <div>
                    <h4 className="font-display font-semibold text-stone-900">Your savings growth progress</h4>
                    <p className="text-xs text-[#5C6460]">Historical review of completed contributions against group quotas.</p>
                  </div>

                  <div className="h-48 flex items-end gap-3 pt-6 px-4">
                    {/* Visual Bars represent historical saves */}
                    <div className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                      <div className="w-full bg-[#135D39] rounded-t-lg transition hover:bg-emerald-700" style={{ height: "40%" }} />
                      <span className="text-[10px] font-mono text-stone-400">Oct 2025</span>
                    </div>
                    <div className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                      <div className="w-full bg-[#135D39] rounded-t-lg transition hover:bg-emerald-700" style={{ height: "55%" }} />
                      <span className="text-[10px] font-mono text-stone-400">Dec 2025</span>
                    </div>
                    <div className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                      <div className="w-full bg-[#135D39] rounded-t-lg transition hover:bg-emerald-700" style={{ height: "70%" }} />
                      <span className="text-[10px] font-mono text-stone-400">Feb 2026</span>
                    </div>
                    <div className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                      <div className="w-full bg-[#135D39] rounded-t-lg transition hover:bg-emerald-700" style={{ height: "90%" }} />
                      <span className="text-[10px] font-mono text-stone-400">Apr 2026</span>
                    </div>
                    <div className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                      <div className="w-full bg-[#135D39] rounded-t-lg transition hover:bg-emerald-700 h-full border border-emerald-300 shadow-inner" style={{ height: "100%" }} />
                      <span className="text-[10px] font-mono font-bold text-[#135D39]">Jun 2026</span>
                    </div>
                  </div>
                </div>

                {/* Contribution History Ledger */}
                <div className="lg:col-span-5 bg-white border border-[#E6E5DF] p-6 rounded-[24px] shadow-xs space-y-4">
                  <div>
                    <h4 className="font-display font-semibold text-stone-900">Your Personal Ledger</h4>
                    <p className="text-xs text-[#5C6460]">Detailed micro-savings ledger outputs representing paid dues.</p>
                  </div>

                  <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
                    {selectedGroup.savingHistory && selectedGroup.savingHistory.length > 0 ? (
                      selectedGroup.savingHistory.map((s, index) => (
                        <div 
                          key={index} 
                          className="p-3 bg-[#FAF8F5] border border-stone-150 rounded-xl flex justify-between items-center text-xs"
                        >
                          <div className="space-y-0.5">
                            <h5 className="font-bold text-stone-800">Dues Contribution</h5>
                            <span className="text-[10px] text-stone-400 font-mono font-bold">{s.date}</span>
                          </div>
                          <span className="font-mono font-extrabold text-[#135D39]">
                            +{formatCurrency(s.amount)}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="py-8 text-center text-xs text-stone-400">
                        No transactions registered yet. Complete your first dues portion to populate ledger assets!
                      </div>
                    )}
                  </div>
                </div>

              </div>

            </div>
          )}

        </div>
      )}

      {/* CREATE CIRCLE MODAL POPUP */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-[#1A2421]/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-[28px] border border-[#E6E5DF] shadow-2xl p-6 md:p-8 max-w-xl w-full space-y-6 max-h-[90vh] overflow-y-auto animate-fade-in">
            <div className="space-y-1.5 pb-4 border-b border-[#E6E5DF]">
              <h3 className="font-display font-semibold text-[#1A2421] text-xl">Create Traditional Adashe Ajo Circle</h3>
              <p className="text-xs text-[#5C6460]">Establish a rotating thrift program. Cooperative members can discover and join your slot group.</p>
            </div>

            <form onSubmit={handleCreateGroupSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-700 uppercase">Circle / Group Name</label>
                <input 
                  type="text"
                  required
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="e.g., Oyo Cocoa Harvesters Esusu Wheel"
                  className="w-full bg-[#FAF8F5] border border-[#E6E5DF] rounded-xl px-4 py-3 text-xs sm:text-sm text-stone-904 focuses:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-700 uppercase">Purpose & Rules Description</label>
                <textarea
                  required
                  value={newGroupDesc}
                  onChange={(e) => setNewGroupDesc(e.target.value)}
                  placeholder="Describe rotating guidelines, target hardware purchases, or seasonal seedlings requirements..."
                  rows={3}
                  className="w-full bg-[#FAF8F5] border border-[#E6E5DF] rounded-xl p-4 text-xs sm:text-sm text-stone-904 focuses:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-700 uppercase">Cycle Dues Amount (₦)</label>
                  <input 
                    type="number"
                    min={5000}
                    step={1000}
                    required
                    value={newGroupAmount}
                    onChange={(e) => setNewGroupAmount(Number(e.target.value))}
                    className="w-full bg-[#FAF8F5] border border-[#E6E5DF] rounded-xl px-4 py-3 text-xs sm:text-sm text-stone-904 focus:outline-none font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-700 uppercase">Dues Cycle Frequency</label>
                  <select
                    value={newGroupFreq}
                    onChange={(e) => setNewGroupFreq(e.target.value as "weekly" | "monthly")}
                    className="w-full bg-[#FAF8F5] border border-[#E6E5DF] rounded-xl px-4 py-3 text-xs sm:text-sm text-stone-905 focus:outline-none"
                  >
                    <option value="weekly">Weekly Contributions</option>
                    <option value="monthly">Monthly Contributions</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-700 uppercase">Rotational sequence slots (Max Members)</label>
                <input 
                  type="number"
                  min={5}
                  max={24}
                  required
                  value={newGroupSlots}
                  onChange={(e) => setNewGroupSlots(Number(e.target.value))}
                  className="w-full bg-[#FAF8F5] border border-[#E6E5DF] rounded-xl px-4 py-3 text-xs sm:text-sm text-stone-904 focus:outline-none"
                />
                <span className="text-[10px] text-stone-400 block pt-0.5">
                  Quorum requirement. Payout totals to <b>{formatCurrency(newGroupAmount * newGroupSlots)}</b> per complete cycle rotation.
                </span>
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-[#E6E5DF]/50">
                <button 
                  type="button" 
                  onClick={() => setIsCreateModalOpen(false)}
                  className="bg-stone-100 hover:bg-stone-200 text-stone-705 font-bold px-5 py-3 rounded-xl text-xs transition cursor-pointer"
                >
                  Cancel
                </button>
                
                <button 
                  type="submit" 
                  className="bg-[#135D39] hover:bg-[#0f4a2d] text-white font-bold px-5 py-3 rounded-xl text-xs transition cursor-pointer shadow-md"
                >
                  Confirm & Publish Group
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
