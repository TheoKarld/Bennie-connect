/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { 
  ShieldCheck, 
  Award, 
  Calendar, 
  CreditCard, 
  CheckCircle, 
  Info, 
  History,
  TrendingUp,
  AlertTriangle,
  ArrowRight
} from "lucide-react";
import { FarmerAppState, MembershipTierStr } from "../../types";
import { MEMBERSHIP_TIERS } from "../../data";

interface MembershipViewProps {
  state: FarmerAppState;
  onUpgradeTier: (tier: MembershipTierStr, cost: number) => void;
  onRenewSubscription: () => void;
}

export default function MembershipView({
  state,
  onUpgradeTier,
  onRenewSubscription
}: MembershipViewProps) {
  const [selectedTier, setSelectedTier] = useState<MembershipTierStr>(state.membership.tier);
  const [isRenewModalOpen, setIsRenewModalOpen] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState("");

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const currentTierInfo = MEMBERSHIP_TIERS[state.membership.tier];
  const selectedTierInfo = MEMBERSHIP_TIERS[selectedTier];

  const handleUpgradeAction = () => {
    const cost = selectedTierInfo.cost;
    if (state.walletBalance < cost) {
      setFeedbackMsg(`Insufficient funds in wallet! Standard cost is ${formatCurrency(cost)}. Please deposit funds first.`);
      return;
    }
    
    onUpgradeTier(selectedTier, cost);
    setIsUpgradeModalOpen(false);
    setFeedbackMsg("");
    alert(`Congratulations! You have updated your membership tier to ${selectedTier}.`);
  };

  const handleRenewAction = () => {
    const cost = currentTierInfo.cost;
    if (state.walletBalance < cost) {
      setFeedbackMsg(`Insufficient funds in wallet to renew! Renewal costs ${formatCurrency(cost)}.`);
      return;
    }
    onRenewSubscription();
    setIsRenewModalOpen(false);
    setFeedbackMsg("");
    alert(`Success! Your ${state.membership.tier} tier subscription has been renewed for 12 months.`);
  };

  // Keep a gorgeous premium look for the card itself, but matching a clean off-white shell
  const cardGradients: Record<MembershipTierStr, string> = {
    Bronze: "from-amber-700 via-yellow-850 to-amber-900 border-amber-600/35",
    Silver: "from-stone-500 via-stone-600 to-stone-700 border-stone-400/35",
    Gold: "from-amber-500 via-amber-600 to-amber-750 border-amber-400/35",
    Platinum: "from-emerald-700 via-emerald-800 to-emerald-950 border-emerald-600/35"
  };

  return (
    <div className="space-y-8 animate-fade-in px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      
      {/* Top Section */}
      <div>
        <h1 className="text-2xl md:text-3xl font-display font-medium text-ink tracking-tight">
          Member Tier Management
        </h1>
        <p className="text-sm text-muted mt-1">
          Review premium benefits, upgrade tiers, or renew cooperative memberships.
        </p>
      </div>

      {/* Main Core Grid: Digital Card & Tier Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Interactive Panel (Membership card) */}
        <div className="lg:col-span-5 space-y-6">
          <h3 className="text-sm text-muted font-bold uppercase tracking-wider">Digital Membership Identity</h3>
          
          {/* Digital Credit-like Card */}
          <div className={`w-full aspect-[1.586/1] rounded-3xl p-6 md:p-8 bg-gradient-to-br ${cardGradients[state.membership.tier]} text-white shadow-md flex flex-col justify-between relative overflow-hidden ring-4 ring-primary/5`}>
            {/* Ambient pattern decorations */}
            <div className="absolute top-0 right-0 w-44 h-44 bg-white/5 rounded-full blur-2xl -mr-10 -mt-10" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-black/15 rounded-full blur-xl -ml-10 -mb-10" />

            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-amber-200 font-bold">BENNIE AGRO COOP</p>
                <p className="text-xs font-medium text-white/90 mt-0.5">Agricultural Cooperative Union</p>
              </div>
              <div className="bg-white/10 backdrop-blur-md px-3 py-1 rounded-2xl border border-white/20 text-[10px] uppercase font-bold tracking-wider flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-amber-300" />
                {state.membership.tier}
              </div>
            </div>

            {/* Microchip and NFC icon */}
            <div className="flex items-center gap-2 my-auto">
              <div className="w-9 h-7 bg-gradient-to-br from-amber-200 to-amber-400 rounded-md border border-amber-300/30 flex flex-col justify-between p-1">
                <div className="h-0.5 w-full bg-slate-800/10" />
                <div className="h-0.5 w-4 bg-slate-800/10" />
                <div className="h-0.5 w-full bg-slate-800/10" />
              </div>
              <div className="text-white/40 flex space-x-0.5 items-center">
                <span className="block w-0.5 h-2 bg-current rounded-full" />
                <span className="block w-0.5 h-3.5 bg-current rounded-full" />
                <span className="block w-0.5 h-5 bg-current rounded-full" />
              </div>
            </div>

            <div className="flex justify-between items-end">
              <div>
                <p className="text-white/60 uppercase tracking-widest text-[9px]">Cardholder ID</p>
                <p className="font-mono text-sm md:text-base font-semibold tracking-wider mt-0.5 text-white">
                  {state.membership.cardNumber}
                </p>
                <p className="text-[10px] text-white/50 mt-1 font-mono">
                  Joined {new Date(state.membership.joinDate).toLocaleDateString()}
                </p>
              </div>
              <div className="text-right">
                <p className="text-white/60 uppercase tracking-widest text-[9px]">Status Expiry</p>
                <p className="font-mono text-xs font-semibold mt-0.5">
                  {new Date(state.membership.expiryDate).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>

          {/* Quick Active Tier Summary */}
          <div className="bg-surface border border-border rounded-3xl p-6 shadow-sm">
            <h4 className="font-semibold text-ink text-sm">Active Tier Subscription Overview</h4>
            
            <div className="mt-4 space-y-4">
              <div className="flex justify-between py-2 border-b border-border text-xs">
                <span className="text-muted">Current Level</span>
                <span className="font-bold text-ink">{state.membership.tier} Tier</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border text-xs">
                <span className="text-muted">Annual Contribution Fee</span>
                <span className="font-mono font-bold text-ink">
                  {state.membership.tier === "Bronze" ? "Free" : `${formatCurrency(currentTierInfo.cost)} / Year`}
                </span>
              </div>
              <div className="flex justify-between py-2 text-xs">
                <span className="text-muted">Status</span>
                <span className="font-bold text-primary flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-primary inline-block animate-pulse" /> Active Verified
                </span>
              </div>
            </div>

            {state.membership.tier !== "Bronze" && (
              <button 
                onClick={() => {
                  setFeedbackMsg("");
                  setIsRenewModalOpen(true);
                }}
                className="w-full mt-6 bg-primary hover:bg-[#0f4a2d] text-white font-bold py-3 px-4 rounded-xl text-xs transition capitalize cursor-pointer shadow-sm border border-primary/10"
              >
                Renew {state.membership.tier} Annual Subscription
              </button>
            )}
          </div>
        </div>

        {/* Right Tab Panel (Explorer & comparison Matrix) */}
        <div className="lg:col-span-7 space-y-6">
          <h3 className="text-sm text-muted font-bold uppercase tracking-wider">Explore Membership Benefits</h3>

          {/* Benefits matrix selectors */}
          <div className="bg-surface border border-border rounded-3xl p-6 shadow-sm">
            <div className="flex space-x-1 bg-surface-2 p-1.5 rounded-2xl border border-border">
              {(["Bronze", "Silver", "Gold", "Platinum"] as MembershipTierStr[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setSelectedTier(t)}
                  className={`flex-1 text-center py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                    selectedTier === t 
                      ? "bg-primary text-white shadow-sm" 
                      : "text-muted hover:text-ink hover:bg-primary/5"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Selected Tier Perks Card */}
            <div className="mt-6 p-6 rounded-2xl border border-border bg-surface-2 space-y-4">
              <div className="flex justify-between items-start gap-4 flex-wrap">
                <div>
                  <h4 className="font-display font-medium text-ink text-lg flex items-center gap-2">
                    <Award className="w-5 h-5 text-accent" />
                    {selectedTierInfo.name} Tier Benefits
                  </h4>
                  <p className="text-xs text-muted mt-1">
                    {selectedTier === state.membership.tier 
                      ? "Your current active tier level" 
                      : `Upgrade fee rate: ${formatCurrency(selectedTierInfo.cost)} per year`
                    }
                  </p>
                </div>
                <span className="font-mono text-primary font-bold text-xs bg-primary/10 px-3 py-1 rounded-full border border-primary/15">
                  {selectedTierInfo.cost === 0 ? "Free Access" : formatCurrency(selectedTierInfo.cost)}
                </span>
              </div>

              {/* Perks list */}
              <div className="space-y-3 pt-3 border-t border-border">
                {selectedTierInfo.benefits.map((b, idx) => (
                  <div key={idx} className="flex gap-2.5 items-start text-xs text-muted">
                    <CheckCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{b}</span>
                  </div>
                ))}
              </div>

              {selectedTier !== state.membership.tier && (
                <div className="pt-4 border-t border-border flex justify-end">
                  <button 
                    onClick={() => {
                      setFeedbackMsg("");
                      setIsUpgradeModalOpen(true);
                    }}
                    className="flex items-center gap-2 bg-primary hover:bg-[#0f4a2d] text-white font-bold py-2.5 px-5 rounded-xl text-xs transition cursor-pointer shadow-sm border border-primary/20"
                  >
                    Set Active Level to {selectedTier} Portfolio <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Subscription History Logs */}
          <div className="bg-surface border border-border rounded-3xl p-6 shadow-sm">
            <h4 className="font-semibold text-ink text-sm flex items-center gap-2 mb-4">
              <History className="w-4 h-4 text-muted" />
              Membership History Logs
            </h4>

            {state.membershipHistory.length === 0 ? (
              <p className="text-xs text-muted py-4 text-center font-medium">No previous tier historical records found</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse font-sans">
                  <thead>
                    <tr className="border-b border-border text-muted font-medium">
                      <th className="py-2.5 font-semibold">Date</th>
                      <th className="py-2.5 font-semibold">Action</th>
                      <th className="py-2.5 font-semibold text-right">Fee Charge</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-muted">
                    {state.membershipHistory.map((item) => (
                      <tr key={item.id} className="text-ink hover:bg-surface-2 transition-all">
                        <td className="py-2.5 font-mono text-muted">{item.date}</td>
                        <td className="py-2.5 font-medium">{item.action}</td>
                        <td className="py-2.5 text-right font-mono font-bold text-ink">
                          {item.amount === 0 ? "₦0" : formatCurrency(item.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>

      </div>

      {/* Renew Subscription Modal */}
      {isRenewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/45 backdrop-blur-xs">
          <div className="bg-surface rounded-3xl p-6 max-w-sm w-full shadow-lg border border-border max-h-screen overflow-y-auto">
            <h4 className="font-display font-semibold text-ink text-base flex items-center gap-2">
              <Calendar className="w-5 h-5 text-accent" /> Confirm Renewal
            </h4>
            <p className="text-xs text-muted mt-2 leading-relaxed">
              Renew subscription for your active <span className="font-bold text-ink">{state.membership.tier} Tier</span>. 
              The annual renewal fee is <span className="font-bold font-mono text-primary">{formatCurrency(currentTierInfo.cost)}</span>.
            </p>

            <div className="mt-4 bg-surface-2 p-3 rounded-xl text-[11px] space-y-1.5 border border-border">
              <div className="flex justify-between">
                <span className="text-muted">Your Wallet Balance:</span>
                <span className="font-mono font-bold text-ink">{formatCurrency(state.walletBalance)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Renewal Outflow:</span>
                <span className="font-mono font-bold text-rose-700 dark:text-rose-300">-{formatCurrency(currentTierInfo.cost)}</span>
              </div>
            </div>

            {feedbackMsg && (
              <p className="text-[11px] text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-500/10 p-2.5 rounded-lg border border-rose-250 dark:border-rose-500/25 mt-3 font-semibold">
                {feedbackMsg}
              </p>
            )}

            <div className="mt-6 flex gap-3">
              <button 
                onClick={() => setIsRenewModalOpen(false)}
                className="flex-1 bg-surface-2 hover:bg-surface text-ink border border-border py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer"
              >
                Cancel
              </button>
              <button 
                onClick={handleRenewAction}
                className="flex-1 bg-primary hover:bg-[#0f4a2d] text-white py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer shadow-sm"
              >
                Renew Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upgrade Subscription Modal */}
      {isUpgradeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/45 backdrop-blur-xs">
          <div className="bg-surface rounded-3xl p-6 max-w-sm w-full shadow-lg border border-border max-h-screen overflow-y-auto">
            <h4 className="font-display font-semibold text-ink text-base flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" /> Confirm Tier Upgrade
            </h4>
            <p className="text-xs text-muted mt-2 leading-relaxed">
              You are switching your cooperative tier level to <span className="font-bold text-ink">{selectedTier}</span>. 
              The annual fee matches <span className="font-bold font-mono text-primary">{formatCurrency(selectedTierInfo.cost)}</span>.
            </p>

            <div className="mt-4 bg-surface-2 p-3 rounded-xl text-[11px] space-y-1.5 border border-border">
              <div className="flex justify-between">
                <span className="text-muted">Available Wallet Balance:</span>
                <span className="font-mono font-bold text-ink">{formatCurrency(state.walletBalance)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Total Charged Cost:</span>
                <span className="font-mono font-bold text-primary">{formatCurrency(selectedTierInfo.cost)}</span>
              </div>
            </div>

            {feedbackMsg && (
              <p className="text-[11px] text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-500/10 p-2.5 rounded-lg border border-rose-250 dark:border-rose-500/25 mt-3 font-semibold">
                {feedbackMsg}
              </p>
            )}

            <div className="mt-6 flex gap-3">
              <button 
                onClick={() => setIsUpgradeModalOpen(false)}
                className="flex-1 bg-surface-2 hover:bg-surface text-ink border border-border py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer"
              >
                Go Back
              </button>
              <button 
                onClick={handleUpgradeAction}
                className="flex-1 bg-primary hover:bg-[#0f4a2d] text-white py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer shadow-sm"
              >
                Approve Upgrade
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
