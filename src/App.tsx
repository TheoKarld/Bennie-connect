/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  Sprout, 
  LayoutDashboard, 
  Wallet, 
  PiggyBank, 
  TrendingUp, 
  ShieldAlert, 
  Users,
  Clock,
  Menu,
  X,
  CreditCard,
  Building,
  Compass,
  Wrench,
  ShoppingBag,
  Briefcase
} from "lucide-react";

import { 
  FarmerAppState, 
  MembershipTierStr, 
  PaymentGatewayType, 
  TargetSavingGoal, 
  FixedSaveLock, 
  HarvestSavePlan, 
  AgriBooking,
  ServiceBooking,
  Product,
  CartItem,
  ProductOrder,
  RegisteredFarmer,
  CommissionReward,
  AgentLevel
} from "./types";
import { INITIAL_APP_STATE, MEMBERSHIP_TIERS } from "./data";
import { 
  DEFAULT_SERVICE_CATEGORIES, 
  DEFAULT_SERVICE_BOOKINGS, 
  DEFAULT_PRODUCTS, 
  DEFAULT_ORDERS 
} from "./default_marketplace_data";

import DashboardView from "./components/DashboardView";
import MembershipView from "./components/MembershipView";
import DigitalWalletView from "./components/DigitalWalletView";
import SavingsProductsView from "./components/SavingsProductsView";
import CooperativeSharesView from "./components/CooperativeSharesView";
import AdasheView from "./components/AdasheView";
import EquipmentBookingView from "./components/EquipmentBookingView";
import AgriculturalServicesView from "./components/AgriculturalServicesView";
import AgriculturalMarketplaceView from "./components/AgriculturalMarketplaceView";
import AgentDashboardView from "./components/AgentDashboardView";

const LOCAL_STORAGE_KEY = "KM_FARMER_PORTAL_STATE_REAL";

export default function App() {
  // Navigation: "dashboard" | "membership" | "wallet" | "savings" | "shares"
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Initialize State from LocalStorage or Fallback
  const [state, setState] = useState<FarmerAppState>(() => {
    let baseState = INITIAL_APP_STATE;
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        baseState = JSON.parse(stored);
      }
    } catch (e) {
      console.warn("Could not read state from local storage. Fallback used.", e);
    }

    // Inject default values for newly added modules to support backward compatibility
    if (!baseState.serviceCategories || baseState.serviceCategories.length === 0) {
      baseState.serviceCategories = DEFAULT_SERVICE_CATEGORIES;
    }
    if (!baseState.serviceBookings || baseState.serviceBookings.length === 0) {
      baseState.serviceBookings = DEFAULT_SERVICE_BOOKINGS;
    }
    if (!baseState.products || baseState.products.length === 0) {
      baseState.products = DEFAULT_PRODUCTS;
    }
    if (!baseState.orders || baseState.orders.length === 0) {
      baseState.orders = DEFAULT_ORDERS;
    }
    if (!baseState.cart) {
      baseState.cart = [];
    }
    return baseState;
  });

  // Sync state to local storage
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error("Could not write state to local storage", e);
    }
  }, [state]);

  // UTILITY: Append Wallet Transaction and notification helpers
  const appendTx = (
    type: "deposit" | "withdraw" | "transfer" | "savings_transfer" | "share_purchase" | "share_sale" | "dividend_payment" | "membership_fee",
    amount: number,
    description: string,
    gateway?: PaymentGatewayType
  ) => {
    const newTx = {
      id: "tx_" + Math.random().toString(36).substring(2, 6),
      date: new Date().toISOString(),
      type,
      amount,
      description,
      gateway,
      status: "success" as const
    };
    return newTx;
  };

  const appendNotification = (
    title: string,
    message: string,
    type: "info" | "success" | "warning" | "alert"
  ) => {
    const newNotif = {
      id: "notif_" + Math.random().toString(36).substring(2, 6),
      date: new Date().toISOString(),
      title,
      message,
      type,
      isRead: false
    };
    return newNotif;
  };

  // ACTIONS Dispatchers

  // 1. Dashboard actions
  const handleJoinContributionCircle = (groupId: string) => {
    setState((prev) => {
      const updatedGroups = prev.contributionGroups.map((g) => {
        if (g.id === groupId) {
          const userRankStr = `Slot #${g.memberCount + 1}`;
          const currentMembers = g.members || [];
          const currentChats = g.chatHistory || [];
          const currentVotes = g.votes || [];
          const currentAttendance = g.attendance || [];
          
          const sysChat = {
            id: "sys_" + Math.random().toString(36).substring(2,6),
            sender: "System Bot",
            avatar: "🤖",
            message: `Verify Event: Aliyu (You) has successfully filled ${userRankStr} in the rotation sequence.`,
            time: "Just now",
            system: true
          };

          return {
            ...g,
            memberCount: g.memberCount + 1,
            hasJoined: true,
            userRank: userRankStr,
            members: [...currentMembers, `Aliyu (You - ${userRankStr})`],
            chatHistory: [...currentChats, sysChat],
            votes: currentVotes,
            attendance: currentAttendance
          };
        }
        return g;
      });

      const joinedGroup = prev.contributionGroups.find(g => g.id === groupId);
      const notif = appendNotification(
        "Ajo Circle Joined 🤝",
        `You successfully joined the rotating savings group: ${joinedGroup?.name || "Circle"}. Contribution cycle is set to active.`,
        "success"
      );

      return {
        ...prev,
        contributionGroups: updatedGroups,
        notifications: [notif, ...prev.notifications]
      };
    });
  };

  const handleCancelBooking = (bookingId: string) => {
    setState((prev) => {
      const bkToCancel = prev.bookings.find(b => b.id === bookingId);
      if (!bkToCancel) return prev;

      const refundAmt = bkToCancel.cost;
      const updatedBookings = prev.bookings.map((b) => {
        if (b.id === bookingId) {
          return { ...b, status: "cancelled" as const };
        }
        return b;
      });

      const walletTx = appendTx(
        "deposit",
        refundAmt,
        `Refund for cancelled booking: ${bkToCancel.serviceName}`
      );

      const notif = appendNotification(
        "Booking Cancelled ❌",
        `Your reservation for machinery booking has been canceled. The amount of ₦${refundAmt.toLocaleString()} has been fully refunded.`,
        "info"
      );

      return {
        ...prev,
        walletBalance: prev.walletBalance + refundAmt,
        bookings: updatedBookings,
        walletTransactions: [walletTx, ...prev.walletTransactions],
        notifications: [notif, ...prev.notifications]
      };
    });
  };

  const handleReadNotification = (notifId: string) => {
    setState((prev) => ({
      ...prev,
      notifications: prev.notifications.map((n) => 
        n.id === notifId ? { ...n, isRead: true } : n
      )
    }));
  };

  const handleClearNotifications = () => {
    setState((prev) => ({
      ...prev,
      notifications: []
    }));
  };

  // 2. Membership actions
  const handleUpgradeTier = (tier: MembershipTierStr, cost: number) => {
    setState((prev) => {
      const newCard = "COOP-FARM-" + Math.floor(1000 + Math.random() * 9000);
      const isBronze = tier === "Bronze";

      const walletTx = !isBronze ? appendTx(
        "membership_fee",
        cost,
        `Upgraded Member Level to ${tier} Tier`
      ) : null;

      const historyItem = {
        id: "mh_" + Math.random().toString(36).substring(2, 6),
        date: new Date().toISOString().split("T")[0],
        action: `Upgraded to ${tier} Membership`,
        amount: cost
      };

      const notif = appendNotification(
        `Tier Upgraded: ${tier} ⭐`,
        `Congratulations! You have updated your cooperative membership to ${tier} Tier. Perks are immediately unlocked.`,
        "success"
      );

      return {
        ...prev,
        walletBalance: prev.walletBalance - cost,
        membership: {
          tier,
          cardNumber: isBronze ? prev.membership.cardNumber : newCard,
          joinDate: prev.membership.joinDate,
          expiryDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split("T")[0],
          cost,
          benefits: MEMBERSHIP_TIERS[tier].benefits
        },
        membershipHistory: [historyItem, ...prev.membershipHistory],
        walletTransactions: walletTx ? [walletTx, ...prev.walletTransactions] : prev.walletTransactions,
        notifications: [notif, ...prev.notifications]
      };
    });
  };

  const handleRenewSubscription = () => {
    setState((prev) => {
      const cost = prev.membership.cost;
      const walletTx = appendTx(
        "membership_fee",
        cost,
        `Renewed Annual subscription for ${prev.membership.tier} Tier`
      );

      const historyItem = {
        id: "mh_" + Math.random().toString(36).substring(2, 6),
        date: new Date().toISOString().split("T")[0],
        action: `Renewed ${prev.membership.tier} Tier`,
        amount: cost
      };

      const notif = appendNotification(
        "Subscription Renewed 🔄",
        `Annual cooperative contribution renewed successfully for ${prev.membership.tier} level. Next review: ${new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toLocaleDateString()}.`,
        "success"
      );

      return {
        ...prev,
        walletBalance: prev.walletBalance - cost,
        membershipHistory: [historyItem, ...prev.membershipHistory],
        walletTransactions: [walletTx, ...prev.walletTransactions],
        notifications: [notif, ...prev.notifications]
      };
    });
  };

  // 3. Digital Wallet actions
  const handleDeposit = (amount: number, gateway: PaymentGatewayType) => {
    setState((prev) => {
      const walletTx = appendTx(
        "deposit",
        amount,
        `Wallet Funding via ${gateway} checkout Gateway`,
        gateway
      );

      const notif = appendNotification(
        "Wallet Funded 💰",
        `Successfully received ₦${amount.toLocaleString()} into Cooperative Liquid balance using ${gateway} gateway.`,
        "success"
      );

      return {
        ...prev,
        walletBalance: prev.walletBalance + amount,
        walletTransactions: [walletTx, ...prev.walletTransactions],
        notifications: [notif, ...prev.notifications]
      };
    });
  };

  const handleWithdrawToBank = (amount: number, bank: string, accNum: string) => {
    setState((prev) => {
      const walletTx = appendTx(
        "withdraw",
        amount,
        `NUBAN Transfer Payout to ${bank} - ****${accNum.slice(-4)}`
      );

      const notif = appendNotification(
        "Direct Bank Withdrawal 🏦",
        `Initiated cash payout transfer of ₦${amount.toLocaleString()} directly to account ${accNum} at ${bank}.`,
        "info"
      );

      return {
        ...prev,
        walletBalance: prev.walletBalance - amount,
        walletTransactions: [walletTx, ...prev.walletTransactions],
        notifications: [notif, ...prev.notifications]
      };
    });
  };

  const handleTransferToMember = (amount: number, recipientId: string, recipientName: string) => {
    setState((prev) => {
      const walletTx = appendTx(
        "transfer",
        amount,
        `Member transfer to: ${recipientName} (#${recipientId})`
      );

      const notif = appendNotification(
        "Peer Wallet Transfer 🤝",
        `Sent ₦${amount.toLocaleString()} instantly to Farmer Comrade ${recipientName} card index.`,
        "success"
      );

      return {
        ...prev,
        walletBalance: prev.walletBalance - amount,
        walletTransactions: [walletTx, ...prev.walletTransactions],
        notifications: [notif, ...prev.notifications]
      };
    });
  };

  // 4. Savings actions
  const handleFlexDeposit = (amount: number) => {
    setState((prev) => {
      const walletTx = appendTx(
        "savings_transfer",
        amount,
        "Transferred liquid cash in Flex Save"
      );

      const notif = appendNotification(
        "Flex Savings Fund Added 🌸",
        `Transferred ₦${amount.toLocaleString()} from liquid wallet directly into daily yielding Flex Save balance.`,
        "success"
      );

      return {
        ...prev,
        walletBalance: prev.walletBalance - amount,
        flexSaveBalance: prev.flexSaveBalance + amount,
        walletTransactions: [walletTx, ...prev.walletTransactions],
        notifications: [notif, ...prev.notifications]
      };
    });
  };

  const handleFlexWithdraw = (amount: number) => {
    setState((prev) => {
      const walletTx = appendTx(
        "deposit",
        amount,
        "Flex Save withdrawal cash payout"
      );

      const notif = appendNotification(
        "Flex Save Redeemed 🔓",
        `Pulled ₦${amount.toLocaleString()} from Flex Save back into primary Digital Wallet balance.`,
        "info"
      );

      return {
        ...prev,
        walletBalance: prev.walletBalance + amount,
        flexSaveBalance: prev.flexSaveBalance - amount,
        walletTransactions: [walletTx, ...prev.walletTransactions],
        notifications: [notif, ...prev.notifications]
      };
    });
  };

  const handleAddTargetGoal = (goal: Omit<TargetSavingGoal, "id" | "currentAmount" | "status">) => {
    setState((prev) => {
      const newGoal: TargetSavingGoal = {
        ...goal,
        id: "tg_" + Math.random().toString(36).substring(2, 6),
        currentAmount: 0,
        status: "ongoing"
      };

      const notif = appendNotification(
        "Savings Target Begun 🎯",
        `Started goal saving program: \"${goal.title}\". Target goal: ₦${goal.targetAmount.toLocaleString()}.`,
        "success"
      );

      return {
        ...prev,
        targetGoals: [...prev.targetGoals, newGoal],
        notifications: [notif, ...prev.notifications]
      };
    });
  };

  const handleAddFundsToTarget = (goalId: string, amount: number) => {
    setState((prev) => {
      const walletTx = appendTx(
        "savings_transfer",
        amount,
        `Added top-up to target goal: ${prev.targetGoals.find(g => g.id === goalId)?.title}`
      );

      const updatedGoals = prev.targetGoals.map((g) => {
        if (g.id === goalId) {
          const newCurrent = g.currentAmount + amount;
          const completed = newCurrent >= g.targetAmount;
          return {
            ...g,
            currentAmount: newCurrent,
            status: completed ? ("completed" as const) : g.status
          };
        }
        return g;
      });

      const notif = appendNotification(
        "Goal Savings Top Up",
        `Deposited ₦${amount.toLocaleString()} to goal milestone.`,
        "info"
      );

      return {
        ...prev,
        walletBalance: prev.walletBalance - amount,
        targetGoals: updatedGoals,
        walletTransactions: [walletTx, ...prev.walletTransactions],
        notifications: [notif, ...prev.notifications]
      };
    });
  };

  const handleWithdrawTargetGoal = (goalId: string) => {
    setState((prev) => {
      const target = prev.targetGoals.find(g => g.id === goalId);
      if (!target) return prev;

      const payoutAmt = target.currentAmount;
      const walletTx = appendTx(
        "deposit",
        payoutAmt,
        `Retrieved savings from goal milestone: ${target.title}`
      );

      const updatedGoals = prev.targetGoals.map((g) => {
        if (g.id === goalId) {
          return { ...g, status: "withdrawn" as const };
        }
        return g;
      });

      const notif = appendNotification(
        "Milestone Target Redeemed 🏆",
        `Withdrew sum payout of ₦${payoutAmt.toLocaleString()} from ${target.title} directly back to wallet assets.`,
        "success"
      );

      return {
        ...prev,
        walletBalance: prev.walletBalance + payoutAmt,
        targetGoals: updatedGoals,
        walletTransactions: [walletTx, ...prev.walletTransactions],
        notifications: [notif, ...prev.notifications]
      };
    });
  };

  const handleAddFixedLock = (lock: Omit<FixedSaveLock, "id" | "status" | "accumulatedInterest">) => {
    setState((prev) => {
      const newLock: FixedSaveLock = {
        ...lock,
        id: "fl_" + Math.random().toString(36).substring(2, 6),
        status: "locked",
        accumulatedInterest: Math.round(lock.amount * (lock.interestRate / 100) * 0.05) // Simulated starting portion
      };

      const walletTx = appendTx(
        "savings_transfer",
        lock.amount,
        `Created high-yield Fixed saving Lock position`
      );

      const notif = appendNotification(
        "Fixed Lock Created 🔒",
        `Secured ₦${lock.amount.toLocaleString()} locked position until ${lock.lockedUntil} at ${lock.interestRate}% interest.`,
        "success"
      );

      return {
        ...prev,
        walletBalance: prev.walletBalance - lock.amount,
        fixedLocks: [...prev.fixedLocks, newLock],
        walletTransactions: [walletTx, ...prev.walletTransactions],
        notifications: [notif, ...prev.notifications]
      };
    });
  };

  const handleWithdrawFixedLock = (lockId: string) => {
    setState((prev) => {
      const lock = prev.fixedLocks.find(l => l.id === lockId);
      if (!lock) return prev;

      const payoutAmt = lock.amount + lock.accumulatedInterest;
      const walletTx = appendTx(
        "deposit",
        payoutAmt,
        `Redeemed principal/yield from Fixed Lock package`
      );

      const updatedLocks = prev.fixedLocks.map((l) => {
        if (l.id === lockId) {
          return { ...l, status: "withdrawn" as const };
        }
        return l;
      });

      const notif = appendNotification(
        "Fixed Lock Cash-Out",
        `Retrieved principal/capital sum of ₦${payoutAmt.toLocaleString()} from fixed savings.`,
        "success"
      );

      return {
        ...prev,
        walletBalance: prev.walletBalance + payoutAmt,
        fixedLocks: updatedLocks,
        walletTransactions: [walletTx, ...prev.walletTransactions],
        notifications: [notif, ...prev.notifications]
      };
    });
  };

  const handleAddHarvestPlan = (plan: Omit<HarvestSavePlan, "id" | "amountSaved" | "status">, initialDeposit: number) => {
    setState((prev) => {
      const newPlan: HarvestSavePlan = {
        ...plan,
        id: "hp_" + Math.random().toString(36).substring(2, 6),
        amountSaved: initialDeposit,
        status: "active"
      };

      const walletTx = appendTx(
        "savings_transfer",
        initialDeposit,
        `Opened Harvest Crop plan: ${plan.title}`
      );

      const notif = appendNotification(
        "Harvest Save Plan Active 🌾",
        `Started seasonal savings program for ${plan.cropType}. Initial crop capital allocated: ₦${initialDeposit.toLocaleString()}.`,
        "success"
      );

      return {
        ...prev,
        walletBalance: prev.walletBalance - initialDeposit,
        harvestPlans: [...prev.harvestPlans, newPlan],
        walletTransactions: [walletTx, ...prev.walletTransactions],
        notifications: [notif, ...prev.notifications]
      };
    });
  };

  // 5. Share Trading actions
  const handleBuyShares = (sharesCount: number, pricePerShare: number) => {
    setState((prev) => {
      const totalCost = sharesCount * pricePerShare;
      
      const shareTx = {
        id: "st_" + Math.random().toString(36).substring(2, 6),
        date: new Date().toISOString(),
        type: "buy" as const,
        sharesCount,
        pricePerShare,
        totalAmount: totalCost
      };

      const walletTx = appendTx(
        "share_purchase",
        totalCost,
        `Purchased ${sharesCount} Cooperative Shares`
      );

      const notif = appendNotification(
        "Shares Purchased 📈",
        `Successfully acquired ${sharesCount} Kilimovest cooperative equity units at ₦${pricePerShare}/unit.`,
        "success"
      );

      return {
        ...prev,
        walletBalance: prev.walletBalance - totalCost,
        shares: {
          ...prev.shares,
          sharesOwned: prev.shares.sharesOwned + sharesCount,
          bookValue: prev.shares.bookValue + totalCost,
          history: [shareTx, ...prev.shares.history]
        },
        walletTransactions: [walletTx, ...prev.walletTransactions],
        notifications: [notif, ...prev.notifications]
      };
    });
  };

  const handleSellShares = (sharesCount: number, pricePerShare: number) => {
    setState((prev) => {
      const totalProceeds = sharesCount * pricePerShare;
      
      // Calculate adjusted cost basis
      const originalCostRelation = (sharesCount / prev.shares.sharesOwned) * prev.shares.bookValue;

      const shareTx = {
        id: "st_" + Math.random().toString(36).substring(2, 6),
        date: new Date().toISOString(),
        type: "sell" as const,
        sharesCount,
        pricePerShare,
        totalAmount: totalProceeds
      };

      const walletTx = appendTx(
        "share_sale",
        totalProceeds,
        `Liquidated ${sharesCount} Cooperative Shares`
      );

      const notif = appendNotification(
        "Shares Liquidated 📉",
        `Sold holding of ${sharesCount} cooperative unit shares for direct cash payout of ₦${totalProceeds.toLocaleString()}.`,
        "info"
      );

      return {
        ...prev,
        walletBalance: prev.walletBalance + totalProceeds,
        shares: {
          ...prev.shares,
          sharesOwned: prev.shares.sharesOwned - sharesCount,
          bookValue: Math.max(0, prev.shares.bookValue - originalCostRelation),
          history: [shareTx, ...prev.shares.history]
        },
        walletTransactions: [walletTx, ...prev.walletTransactions],
        notifications: [notif, ...prev.notifications]
      };
    });
  };

  const handleClaimDividends = () => {
    setState((prev) => {
      const amt = prev.shares.totalDividendsEarned;
      const walletTx = appendTx(
        "dividend_payment",
        amt,
        "Claimed quarterly share dividend holding"
      );

      const notif = appendNotification(
        "Dividends Redeemed 🌟",
        `Outstanding share dividend of ₦${amt.toLocaleString()} claimed safely into Liquid Balance assets.`,
        "success"
      );

      return {
        ...prev,
        walletBalance: prev.walletBalance + amt,
        shares: {
          ...prev.shares,
          totalDividendsEarned: 0
        },
        walletTransactions: [walletTx, ...prev.walletTransactions],
        notifications: [notif, ...prev.notifications]
      };
    });
  };

  // 6. Adashe Savings handlers
  const handlePayAdasheContribution = (groupId: string, amount: number) => {
    setState((prev) => {
      const updatedGroups = prev.contributionGroups.map((g) => {
        if (g.id === groupId) {
          const currentH = g.savingHistory || [];
          const newSave = {
            date: new Date().toISOString().split("T")[0],
            amount,
            memberName: "Aliyu (You)"
          };
          const systemMsg = {
            id: "sys_" + Math.random().toString(36).substring(2, 6),
            sender: "System Bot",
            avatar: "🤖",
            message: `Verify Event: Aliyu (You) successfully completed dues contribution of ₦${amount.toLocaleString()}.`,
            time: "Just now",
            system: true
          };
          return {
            ...g,
            currentPool: g.currentPool + amount,
            savingHistory: [newSave, ...currentH],
            chatHistory: [...(g.chatHistory || []), systemMsg]
          };
        }
        return g;
      });

      const matchedGroup = prev.contributionGroups.find(g => g.id === groupId);
      const tx = appendTx(
        "savings_transfer",
        amount,
        `Adashe due portion to: ${matchedGroup?.name || "Circle"}`
      );
      const notif = appendNotification(
        "Adashe Portion Paid 👍",
        `Your savings contribution of ₦${amount.toLocaleString()} was successfully paid to ${matchedGroup?.name || "Circle"}.`,
        "success"
      );

      return {
        ...prev,
        walletBalance: prev.walletBalance - amount,
        contributionGroups: updatedGroups,
        walletTransactions: [tx, ...prev.walletTransactions],
        notifications: [notif, ...prev.notifications]
      };
    });
  };

  const handleClaimAdashePayout = (groupId: string, amount: number) => {
    setState((prev) => {
      const gToClear = prev.contributionGroups.find(g => g.id === groupId);
      const updatedGroups = prev.contributionGroups.map((g) => {
        if (g.id === groupId) {
          const nextSlot = (g.activePayoutSlot || 1) >= (g.maxSlots || 10) ? 1 : (g.activePayoutSlot || 1) + 1;
          const sysChat = {
            id: "sys_" + Math.random().toString(36).substring(2, 6),
            sender: "System Bot",
            avatar: "🤖",
            message: `Congratulations! Payout of ₦${amount.toLocaleString()} was safely disbursed to Slot #5 Aliyu! Rotating sequence shifted to Slot #${nextSlot}.`,
            time: "Just now",
            system: true
          };
          return {
            ...g,
            currentPool: 0, // Reset for next rotation cycle dues
            activePayoutSlot: nextSlot,
            chatHistory: [...(g.chatHistory || []), sysChat]
          };
        }
        return g;
      });

      const tx = appendTx(
        "deposit",
        amount,
        `Retrieved Adashe Rotational Payout: ${gToClear?.name}`
      );
      const notif = appendNotification(
        "Adashe Rotational Claimed 🎉",
        `Congratulations! Your payout of ₦${amount.toLocaleString()} was fully disbursed into your Cooperative Wallet.`,
        "success"
      );

      return {
        ...prev,
        walletBalance: prev.walletBalance + amount,
        contributionGroups: updatedGroups,
        walletTransactions: [tx, ...prev.walletTransactions],
        notifications: [notif, ...prev.notifications]
      };
    });
  };

  const handleSendAdasheMessage = (groupId: string, sender: string, message: string) => {
    setState((prev) => {
      const updatedGroups = prev.contributionGroups.map((g) => {
        if (g.id === groupId) {
          const newMsg = {
            id: "ch_" + Math.random().toString(36).substring(2, 6),
            sender,
            avatar: sender === "Aliyu (You)" ? "AY" : sender.slice(0, 2).toUpperCase(),
            message,
            time: "Just now",
            isUser: sender === "Aliyu (You)"
          };
          return {
            ...g,
            chatHistory: [...(g.chatHistory || []), newMsg]
          };
        }
        return g;
      });
      return {
        ...prev,
        contributionGroups: updatedGroups
      };
    });
  };

  const handleVoteOnAdasheProposal = (groupId: string, proposalId: string, vote: "yes" | "no") => {
    setState((prev) => {
      const updatedGroups = prev.contributionGroups.map((g) => {
        if (g.id === groupId) {
          const updatedVotes = g.votes?.map((prop) => {
            if (prop.id === proposalId) {
              return {
                ...prop,
                yesVotes: vote === "yes" ? prop.yesVotes + 1 : prop.yesVotes,
                noVotes: vote === "no" ? prop.noVotes + 1 : prop.noVotes,
                userVoted: vote
              };
            }
            return prop;
          });
          return { ...g, votes: updatedVotes };
        }
        return g;
      });
      return {
        ...prev,
        contributionGroups: updatedGroups
      };
    });
  };

  const handleCreateAdasheProposal = (groupId: string, proposalText: string) => {
    setState((prev) => {
      const selected = prev.contributionGroups.find(g => g.id === groupId);
      const newProp = {
        id: "v_" + Math.random().toString(36).substring(2, 6),
        proposal: proposalText,
        yesVotes: 1, // Aliyu votes yes
        noVotes: 0,
        totalSlots: selected?.maxSlots || 10,
        userVoted: "yes" as const,
        status: "active" as const
      };

      const updatedGroups = prev.contributionGroups.map((g) => {
        if (g.id === groupId) {
          return {
            ...g,
            votes: [newProp, ...(g.votes || [])]
          };
        }
        return g;
      });

      return {
        ...prev,
        contributionGroups: updatedGroups
      };
    });
  };

  const handleAdasheAttendanceCheckIn = (groupId: string, date: string) => {
    setState((prev) => {
      const updatedGroups = prev.contributionGroups.map((g) => {
        if (g.id === groupId) {
          const updatedAtt = g.attendance?.map((att) => {
            if (att.date === date) {
              return {
                ...att,
                presentCount: att.presentCount + 1,
                userStatus: "present" as const
              };
            }
            return att;
          });
          const sysChat = {
            id: "sys_" + Math.random().toString(36).substring(2, 6),
            sender: "System Bot",
            avatar: "🤖",
            message: "Verify Complete: Aliyu checked in successfully via cooperative cellular geolocation triangulation.",
            time: "Just now",
            system: true
          };
          return {
            ...g,
            attendance: updatedAtt,
            chatHistory: [...(g.chatHistory || []), sysChat]
          };
        }
        return g;
      });

      const notif = appendNotification(
        "Presence Validated 🛰",
        "Your attendance has been registered successfully via cellular triangulation check-in.",
        "success"
      );

      return {
        ...prev,
        contributionGroups: updatedGroups,
        notifications: [notif, ...prev.notifications]
      };
    });
  };

  const handleCreateAdasheGroup = (groupDetails: any) => {
    setState((prev) => {
      const newGroupId = "cg_" + Math.random().toString(36).substring(2, 6);
      const newGroupObj = {
        id: newGroupId,
        name: groupDetails.name,
        description: groupDetails.description,
        memberCount: 1,
        cycleAmount: groupDetails.cycleAmount,
        currentPool: groupDetails.cycleAmount, // User immediately contributes first portion
        totalPayoutPool: groupDetails.cycleAmount * groupDetails.maxSlots,
        nextPayoutDate: "Awaiting members",
        userRank: "Slot #1",
        hasJoined: true,
        frequency: groupDetails.frequency,
        activePayoutSlot: 1,
        maxSlots: groupDetails.maxSlots,
        repaymentConsistency: 100,
        members: ["Aliyu (You - Slot #1)"],
        chatHistory: [
          { id: "ch_welcome", sender: "System Bot", avatar: "🤖", message: `Welcome to ${groupDetails.name}! Rotating index is initialized to Slot #1. Cycle awaits additional cooperative members.`, time: "Just now", system: true }
        ],
        votes: [],
        attendance: [
          { date: new Date().toISOString().split("T")[0], title: `${groupDetails.name} Inaugural Setup & Briefing`, presentCount: 1, userStatus: "present" as const }
        ],
        savingHistory: [
          { date: new Date().toISOString().split("T")[0], amount: groupDetails.cycleAmount, memberName: "Aliyu (You)" }
        ]
      };

      const tx = appendTx(
        "savings_transfer",
        groupDetails.cycleAmount,
        `Established Adashe with initial portion: ${groupDetails.name}`
      );
      const notif = appendNotification(
        "Adashe Published 🌐",
        `Rotating savings group "${groupDetails.name}" published successfully. First portion paid.`,
        "success"
      );

      return {
        ...prev,
        walletBalance: prev.walletBalance - groupDetails.cycleAmount,
        contributionGroups: [newGroupObj, ...prev.contributionGroups],
        walletTransactions: [tx, ...prev.walletTransactions],
        notifications: [notif, ...prev.notifications]
      };
    });
  };

  // 7. Equipment Booking System Handlers (Hello Tractor inspired)
  const handleAddBooking = (details: Omit<AgriBooking, "id">) => {
    setState((prev) => {
      const newBookingId = "bk_" + Math.random().toString(36).substring(2, 6);
      const newBookingObj: AgriBooking = {
        ...details,
        id: newBookingId
      };

      const tx = appendTx(
        "withdraw",
        details.depositPaid,
        `25% Secure Deposit: Booking ${details.serviceName}`
      );

      const notif = appendNotification(
        "Secure Deposit Paid 🔒",
        `₦${details.depositPaid.toLocaleString()} paid as security deposit for ${details.serviceName}. Operator is being dispatched.`,
        "success"
      );

      return {
        ...prev,
        walletBalance: prev.walletBalance - details.depositPaid,
        bookings: [newBookingObj, ...prev.bookings],
        walletTransactions: [tx, ...prev.walletTransactions],
        notifications: [notif, ...prev.notifications]
      };
    });
  };

  const handleUpdateBookingStatus = (bookingId: string, status: AgriBooking["status"], evidence?: AgriBooking["completionEvidence"]) => {
    setState((prev) => {
      const targetB = prev.bookings.find(b => b.id === bookingId);
      if (!targetB) return prev;

      let updatedBalance = prev.walletBalance;
      let extraTxs = [...prev.walletTransactions];
      let extraNotifs = [...prev.notifications];

      if (status === "completed" && targetB.status !== "completed") {
        const remainingAmount = targetB.cost - (targetB.depositPaid || 0);
        updatedBalance = prev.walletBalance - remainingAmount;

        const finalTx = appendTx(
          "withdraw",
          remainingAmount,
          `Final Settle: ${targetB.serviceName} Execution Finished`
        );
        extraTxs = [finalTx, ...extraTxs];

        const notif = appendNotification(
          "Work Finished & Settled 🚜",
          `Operator marked job ${targetB.id} finished. Remaining balance of ₦${remainingAmount.toLocaleString()} has been processed from your cooperative wallet.`,
          "success"
        );
        extraNotifs = [notif, ...extraNotifs];
      } else {
        const updatedNotifTitle = status === "assigned" ? "Operator Dispatched 🧑‍✈️" : "Job In Progress ⚡";
        const updatedNotifMsg = status === "assigned" 
          ? `Operator "${targetB.operatorName}" has accepted dispatch on plates "${targetB.equipmentPlate}". Check tracking.`
          : `Tractor tillage initialized on-field. Real-time telemetry monitoring map activated.`;
          
        const statusNotif = appendNotification(
          updatedNotifTitle,
          updatedNotifMsg,
          "info"
        );
        extraNotifs = [statusNotif, ...extraNotifs];
      }

      const updatedBookings = prev.bookings.map((b) => {
        if (b.id === bookingId) {
          return {
            ...b,
            status,
            completionEvidence: evidence || b.completionEvidence
          };
        }
        return b;
      });

      return {
        ...prev,
        walletBalance: updatedBalance,
        bookings: updatedBookings,
        walletTransactions: extraTxs,
        notifications: extraNotifs
      };
    });
  };

  const handleRateBooking = (bookingId: string, rating: number, comment?: string) => {
    setState((prev) => {
      const updatedBookings = prev.bookings.map((b) => {
        if (b.id === bookingId) {
          return {
            ...b,
            farmerRating: rating,
            farmerRatingComment: comment
          };
        }
        return b;
      });

      const ratingNotif = appendNotification(
        "Rating Authenticated ⭐",
        `Operator performance evaluation successfully appended to dispatch ledger. Thank you!`,
        "success"
      );

      return {
        ...prev,
        bookings: updatedBookings,
        notifications: [ratingNotif, ...prev.notifications]
      };
    });
  };

  // ==========================================
  // MODULE 4: AGRICULTURAL SERVICES ACTIONS
  // ==========================================
  const handleBookService = (booking: Omit<ServiceBooking, "id" | "createdAt">) => {
    setState((prev) => {
      const newId = "sb_" + Math.floor(1000 + Math.random() * 9000);
      const newBooking: ServiceBooking = {
        ...booking,
        id: newId,
        createdAt: new Date().toISOString()
      };

      let newBalance = prev.walletBalance;
      const txs = [...prev.walletTransactions];
      const notifs = [...prev.notifications];

      if (booking.paymentStatus === "paid") {
        newBalance -= booking.totalCost;
        const tx = appendTx(
          "withdraw",
          booking.totalCost,
          `Paid for agricultural service: ${booking.serviceName}`
        );
        txs.unshift(tx);
        notifs.unshift(appendNotification(
          "Service Paid Instantly 💳",
          `₦${booking.totalCost.toLocaleString()} was successfully paid from your digital wallet for ${booking.serviceName}.`,
          "success"
        ));
      } else {
        notifs.unshift(appendNotification(
          "Service Booked 🗓️",
          `Your booking for ${booking.serviceName} has been initialized. Payment of ₦${booking.totalCost.toLocaleString()} is pending.`,
          "info"
        ));
      }

      return {
        ...prev,
        walletBalance: newBalance,
        serviceBookings: [newBooking, ...(prev.serviceBookings || [])],
        walletTransactions: txs,
        notifications: notifs
      };
    });
  };

  const handlePayBooking = (bookingId: string) => {
    setState((prev) => {
      const bookingsList = prev.serviceBookings || [];
      const booking = bookingsList.find(b => b.id === bookingId);
      if (!booking || booking.paymentStatus === "paid") return prev;

      if (prev.walletBalance < booking.totalCost) {
        alert("Insufficient wallet balance.");
        return prev;
      }

      const tx = appendTx(
        "withdraw",
        booking.totalCost,
        `Cleared unpaid balance for service: ${booking.serviceName}`
      );

      const updatedBookings = bookingsList.map((b) => 
        b.id === bookingId ? { ...b, paymentStatus: "paid" as const } : b
      );

      return {
        ...prev,
        walletBalance: prev.walletBalance - booking.totalCost,
        serviceBookings: updatedBookings,
        walletTransactions: [tx, ...prev.walletTransactions],
        notifications: [appendNotification(
          "Remaining Balance Cleared 💰",
          `Unpaid commitment of ₦${booking.totalCost.toLocaleString()} on ${booking.serviceName} was successfully paid with your wallet.`,
          "success"
        ), ...prev.notifications]
      };
    });
  };

  const handleCancelServiceBooking = (bookingId: string) => {
    setState((prev) => {
      const bookingsList = prev.serviceBookings || [];
      const booking = bookingsList.find(b => b.id === bookingId);
      if (!booking || booking.status === "cancelled" || booking.status === "completed") return prev;

      let refundAmt = 0;
      let txs = [...prev.walletTransactions];
      let newBalance = prev.walletBalance;

      if (booking.paymentStatus === "paid") {
        refundAmt = booking.totalCost;
        newBalance += refundAmt;
        const tx = appendTx(
          "deposit",
          refundAmt,
          `Cancelled service refund: ${booking.serviceName}`
        );
        txs = [tx, ...txs];
      }

      const updatedBookings = bookingsList.map((b) => 
        b.id === bookingId ? { ...b, status: "cancelled" as const } : b
      );

      return {
        ...prev,
        walletBalance: newBalance,
        serviceBookings: updatedBookings,
        walletTransactions: txs,
        notifications: [appendNotification(
          "Service Cancelled ❌",
          `Booking ${bookingId} cancelled. Refund of ₦${refundAmt.toLocaleString()} has been added back to your liquid balance.`,
          "info"
        ), ...prev.notifications]
      };
    });
  };

  const handleSimulateStatus = (bookingId: string) => {
    setState((prev) => {
      const bookingsList = prev.serviceBookings || [];
      const booking = bookingsList.find(b => b.id === bookingId);
      if (!booking) return prev;

      let nextStatus: ServiceBooking["status"] = "pending";
      let notifTitle = "";
      let notifMsg = "";

      if (booking.status === "pending") {
        nextStatus = "confirmed";
        notifTitle = "Service Dispatched 🧑‍✈️";
        notifMsg = `Certified agent is dispatched for ${booking.serviceName}. Date matched: ${booking.bookingDate}.`;
      } else if (booking.status === "confirmed") {
        nextStatus = "completed";
        notifTitle = "Job Declared Finished ✅";
        notifMsg = `Cooperative expert checked off task ${bookingId} as fully completed. You can leave a review.`;
      }

      const updatedBookings = bookingsList.map((b) => 
        b.id === bookingId ? { ...b, status: nextStatus } : b
      );

      return {
        ...prev,
        serviceBookings: updatedBookings,
        notifications: [appendNotification(notifTitle, notifMsg, "success"), ...prev.notifications]
      };
    });
  };

  const handleReviewBooking = (bookingId: string, rating: number, comment: string) => {
    setState((prev) => {
      const bookingsList = prev.serviceBookings || [];
      const updatedBookings = bookingsList.map((b) => 
        b.id === bookingId ? { ...b, rating, reviewComment: comment } : b
      );

      // Append review to target service category list as well to update average rating!
      const targetB = bookingsList.find(b => b.id === bookingId);
      let updatedCategories = prev.serviceCategories || [];

      if (targetB) {
        updatedCategories = (prev.serviceCategories || []).map((cat) => {
          if (cat.name === targetB.serviceName) {
            const newRev = {
              id: "rev_" + Math.random().toString(36).substring(2,6),
              farmerName: "Aliyu (You)",
              rating,
              comment,
              date: new Date().toISOString().split("T")[0]
            };
            const reviews = [...cat.reviews, newRev];
            const avgRating = parseFloat((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1));
            return {
              ...cat,
              reviews,
              rating: avgRating
            };
          }
          return cat;
        });
      }

      return {
        ...prev,
        serviceBookings: updatedBookings,
        serviceCategories: updatedCategories,
        notifications: [appendNotification(
          "Review Submitted ✍️",
          `Thank you! Your assessment has been recorded. It helps other farmers select certified operators.`,
          "success"
        ), ...prev.notifications]
      };
    });
  };

  // ==========================================
  // MODULE 5: AGRICULTURAL MARKETPLACE ACTIONS
  // ==========================================
  const handleAddToCart = (productId: string) => {
    setState((prev) => {
      const cartList = prev.cart || [];
      const existingItem = cartList.find(item => item.productId === productId);
      const targetP = (prev.products || []).find(p => p.id === productId);

      if (!targetP || targetP.stock <= 0) {
        alert("Sorry, this item is out of stock.");
        return prev;
      }

      let updatedCart: CartItem[] = [];
      if (existingItem) {
        if (existingItem.quantity >= targetP.stock) {
          alert(`Cannot add more. Retailer only has ${targetP.stock} items in stock.`);
          return prev;
        }
        updatedCart = cartList.map(item => 
          item.productId === productId ? { ...item, quantity: item.quantity + 1 } : item
        );
      } else {
        updatedCart = [...cartList, { id: "ci_" + Math.random().toString(36).substring(2,6), productId, quantity: 1 }];
      }

      return {
        ...prev,
        cart: updatedCart
      };
    });
  };

  const handleUpdateCartQty = (cartItemId: string, qty: number) => {
    setState((prev) => {
      const cartList = prev.cart || [];
      const item = cartList.find(i => i.id === cartItemId);
      if (!item) return prev;

      const targetP = (prev.products || []).find(p => p.id === item.productId);
      if (!targetP) return prev;

      if (qty > targetP.stock) {
        alert(`Insufficient merchant stock! Selected quantity matches caps of ${targetP.stock}.`);
        return prev;
      }

      const updatedCart = cartList.map(i => 
        i.id === cartItemId ? { ...i, quantity: qty } : i
      );

      return {
        ...prev,
        cart: updatedCart
      };
    });
  };

  const handleRemoveFromCart = (cartItemId: string) => {
    setState((prev) => ({
      ...prev,
      cart: (prev.cart || []).filter(i => i.id !== cartItemId)
    }));
  };

  const handleCheckoutMarketplace = (deliveryAddress: string) => {
    setState((prev) => {
      const cartList = prev.cart || [];
      if (cartList.length === 0) return prev;

      const productsList = prev.products || [];
      
      // Calculate total
      let totalAmount = 0;
      const orderItems = [];

      for (const item of cartList) {
        const prod = productsList.find(p => p.id === item.productId);
        if (!prod || prod.stock < item.quantity) {
          alert(`Mismatched inventory: ${prod?.name || "Product"} is out of stock.`);
          return prev;
        }
        totalAmount += prod.price * item.quantity;
        orderItems.push({
          productId: item.productId,
          productName: prod.name,
          quantity: item.quantity,
          priceAtPurchase: prod.price
        });
      }

      if (prev.walletBalance < totalAmount) {
        alert("Insufficient wallet balance.");
        return prev;
      }

      // Deduct stock levels mapping
      const updatedProducts = productsList.map((p) => {
        const cItem = cartList.find(it => it.productId === p.id);
        if (cItem) {
          return { ...p, stock: Math.max(0, p.stock - cItem.quantity) };
        }
        return p;
      });

      // Assemble Order
      const newOrderId = "ord_" + Math.floor(100000 + Math.random() * 900000);
      const newOrder: ProductOrder = {
        id: newOrderId,
        farmerId: "aliyu_coop",
        farmerName: "Aliyu (You)",
        deliveryAddress,
        items: orderItems,
        totalAmount,
        orderDate: new Date().toISOString(),
        status: "pending"
      };

      const ledgerTx = appendTx(
        "withdraw",
        totalAmount,
        `Marketplace Purchase checkout: Order #${newOrderId}`
      );

      return {
        ...prev,
        walletBalance: prev.walletBalance - totalAmount,
        products: updatedProducts,
        orders: [newOrder, ...(prev.orders || [])],
        cart: [], // Clear Cart
        walletTransactions: [ledgerTx, ...prev.walletTransactions],
        notifications: [appendNotification(
          "Marketplace Checkout Placed 🛒",
          `Order #${newOrderId} totaling ₦${totalAmount.toLocaleString()} has been safely booked with digital wallet.`,
          "success"
        ), ...prev.notifications]
      };
    });
  };

  const handleMerchantAddProduct = (product: Omit<Product, "id" | "merchantId" | "merchantName">) => {
    setState((prev) => {
      const newPId = "p_mer_" + Math.random().toString(36).substring(2,6);
      const newProduct: Product = {
        ...product,
        id: newPId,
        merchantId: "merch_current_user",
        merchantName: "Aliyu Comrade Traders"
      };

      return {
        ...prev,
        products: [newProduct, ...(prev.products || [])]
      };
    });
  };

  const handleMerchantUpdateStock = (productId: string, newStock: number) => {
    setState((prev) => {
      const updatedProducts = (prev.products || []).map((p) => 
        p.id === productId ? { ...p, stock: newStock } : p
      );
      return {
        ...prev,
        products: updatedProducts
      };
    });
  };

  const handleMerchantUpdateOrderStatus = (orderId: string, status: ProductOrder["status"]) => {
    setState((prev) => {
      const ordersList = prev.orders || [];
      const updatedOrders = ordersList.map((o) => 
        o.id === orderId ? { ...o, status } : o
      );

      const targetOrder = ordersList.find(o => o.id === orderId);
      const updatedNotifs = [...prev.notifications];

      if (targetOrder) {
        let statusText = "";
        if (status === "processing") statusText = "is packed and placed on shipping queue";
        if (status === "shipped") statusText = "is dispatched in transit";
        if (status === "delivered") statusText = "arrived safely under cooperative checkoff";
        if (status === "cancelled") statusText = "was cancelled by merchant node";

        updatedNotifs.unshift(appendNotification(
          `Order Update: #${orderId} 📦`,
          `Your active purchase of inputs ${statusText}.`,
          status === "delivered" ? "success" : "info"
        ));
      }

      return {
        ...prev,
        orders: updatedOrders,
        notifications: updatedNotifs
      };
    });
  };

  const handleRegisterFarmer = (farmer: Omit<RegisteredFarmer, "id" | "dateRegistered" | "kycStatus">) => {
    setState((prev) => {
      const farmersList = prev.registeredFarmers || [];
      const rewardsList = prev.commissionRewards || [];
      const currentLevelStr = prev.agentLevel || "Bronze Agent";
      
      const newFarmerId = "f_" + Math.floor(1000 + Math.random() * 9000);
      const newFarmer: RegisteredFarmer = {
        ...farmer,
        id: newFarmerId,
        kycStatus: "Pending",
        dateRegistered: new Date().toISOString()
      };

      const multipliers: Record<AgentLevel, number> = {
        "Bronze Agent": 1.0,
        "Silver Agent": 1.1,
        "Gold Agent": 1.25,
        "Platinum Agent": 1.5
      };
      const mult = multipliers[currentLevelStr] || 1.0;
      const baseEarned = 2500;
      const amountEarned = Math.round(baseEarned * mult);

      const newRewardId = "cr_" + Math.floor(10000 + Math.random() * 90000);
      const newReward: CommissionReward = {
        id: newRewardId,
        date: new Date().toISOString(),
        farmerName: farmer.name,
        activityType: "Farmer Registration",
        activityDetails: `Registered and onboarded new cooperative farmer: ${farmer.name}`,
        amountEarned
      };

      const ledgerTx = appendTx(
        "deposit",
        amountEarned,
        `Agent Reward: Onboarded ${farmer.name}`
      );

      return {
        ...prev,
        walletBalance: prev.walletBalance + amountEarned,
        registeredFarmers: [newFarmer, ...farmersList],
        commissionRewards: [newReward, ...rewardsList],
        walletTransactions: [ledgerTx, ...prev.walletTransactions],
        notifications: [appendNotification(
          "Farmer Onboarded! 🤝",
          `Farmer ${farmer.name} has been enrolled successfully. Earning ₦${amountEarned.toLocaleString()} credited to your agent wallet registry.`,
          "success"
        ), ...prev.notifications]
      };
    });
  };

  const handleVerifyFarmerKYC = (farmerId: string) => {
    setState((prev) => {
      const farmersList = prev.registeredFarmers || [];
      const target = farmersList.find(f => f.id === farmerId);
      if (!target) return prev;

      const updatedFarmers = farmersList.map((f) => 
        f.id === farmerId ? { ...f, kycStatus: "Verified" as const } : f
      );

      return {
        ...prev,
        registeredFarmers: updatedFarmers,
        notifications: [appendNotification(
          "Identity Verified! 🛡️",
          `National government registry has verified identity documents for ${target.name}.`,
          "success"
        ), ...prev.notifications]
      };
    });
  };

  const handleSimulateAgentActivity = (farmerId: string, activityType: string, amount: number) => {
    setState((prev) => {
      const farmersList = prev.registeredFarmers || [];
      const rewardsList = prev.commissionRewards || [];
      
      const target = farmersList.find(f => f.id === farmerId);
      if (!target) return prev;

      const newRewardId = "cr_" + Math.floor(10000 + Math.random() * 90000);
      const newReward: CommissionReward = {
        id: newRewardId,
        date: new Date().toISOString(),
        farmerName: target.name,
        activityType: activityType as any,
        activityDetails: `Simulated event referral: ${activityType} action completed by ${target.name}`,
        amountEarned: amount
      };

      const ledgerTx = appendTx(
        "deposit",
        amount,
        `Agent Commission: Referrer activity on ${target.name}`
      );

      return {
        ...prev,
        walletBalance: prev.walletBalance + amount,
        commissionRewards: [newReward, ...rewardsList],
        walletTransactions: [ledgerTx, ...prev.walletTransactions],
        notifications: [appendNotification(
          "Commission Disbursed! 💰",
          `Referral reward of ₦${amount.toLocaleString()} received for activity: ${activityType} by ${target.name}.`,
          "success"
        ), ...prev.notifications]
      };
    });
  };

  const handlePromoteAgent = (newLevel: AgentLevel) => {
    setState((prev) => ({
      ...prev,
      agentLevel: newLevel,
      agentRanking: Math.max(1, (prev.agentRanking || 8) - 2),
      notifications: [appendNotification(
        "Agent Tier Promoted! 🏆",
        `Congratulations! You have been certified as a ${newLevel}. Your higher multipliers are now fully active.`,
        "success"
      ), ...prev.notifications]
    }));
  };


  const handleNavigate = (tab: string) => {
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#1A2421] flex flex-col justify-between selection:bg-[#135D39]/10 selection:text-[#135D39] border-t-4 border-[#135D39] relative overflow-hidden">
      
      {/* Background radial ambient glowing effects */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#135D39]/3 blur-[120px] rounded-full pointer-events-none -mr-64 -mt-64"></div>
      <div className="absolute bottom-40 left-0 w-[400px] h-[450px] bg-[#E7A13C]/3 blur-[100px] rounded-full pointer-events-none -ml-48"></div>

      <div className="flex flex-col lg:flex-row flex-grow w-full max-w-7xl mx-auto relative z-20">
        
        {/* DESKTOP SIDEBAR */}
        <aside className="hidden lg:flex w-64 shrink-0 flex-col justify-between p-6 border-r border-[#E6E5DF] h-screen sticky top-0 bg-[#FAF8F5]/30">
          <div className="space-y-8">
            {/* Brand Logo */}
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => handleNavigate("dashboard")}>
              <div className="w-10 h-10 rounded-full bg-[#135D39] flex items-center justify-center shadow-lg shadow-[#135D39]/10">
                <Sprout className="w-5.5 h-5.5 text-white" />
              </div>
              <div>
                <span className="font-display font-medium text-[#1A2421] text-base tracking-tight block">Bennie Agro</span>
                <span className="text-[10px] text-[#135D39] font-bold uppercase tracking-wider block -mt-1 leading-none">Cooperative Society</span>
              </div>
            </div>

            {/* Sidebar Navigation */}
            <nav className="flex flex-col space-y-1 text-sm pt-4">
              <button 
                onClick={() => handleNavigate("dashboard")}
                className={`w-full text-left px-4 py-2.5 rounded-full font-semibold flex items-center gap-3 transition ${
                  activeTab === "dashboard" 
                    ? "bg-[#135D39] text-white shadow-md shadow-[#135D39]/15" 
                    : "text-[#5C6460] hover:text-[#1A2421] hover:bg-[#135D39]/5"
                }`}
              >
                <LayoutDashboard className="w-4.5 h-4.5" /> Overview
              </button>
              
              <button 
                onClick={() => handleNavigate("wallet")}
                className={`w-full text-left px-4 py-2.5 rounded-full font-semibold flex items-center gap-3 transition ${
                  activeTab === "wallet" 
                    ? "bg-[#135D39] text-white shadow-md shadow-[#135D39]/15" 
                    : "text-[#5C6460] hover:text-[#1A2421] hover:bg-[#135D39]/5"
                }`}
              >
                <Wallet className="w-4.5 h-4.5" /> Wallet
              </button>

              <button 
                onClick={() => handleNavigate("savings")}
                className={`w-full text-left px-4 py-2.5 rounded-full font-semibold flex items-center gap-3 transition ${
                  activeTab === "savings" 
                    ? "bg-[#135D39] text-white shadow-md shadow-[#135D39]/15" 
                    : "text-[#5C6460] hover:text-[#1A2421] hover:bg-[#135D39]/5"
                }`}
              >
                <PiggyBank className="w-4.5 h-4.5" /> Savings
              </button>

              <button 
                onClick={() => handleNavigate("adashe")}
                className={`w-full text-left px-4 py-2.5 rounded-full font-semibold flex items-center gap-3 transition ${
                  activeTab === "adashe" 
                    ? "bg-[#135D39] text-white shadow-md shadow-[#135D39]/15" 
                    : "text-[#5C6460] hover:text-[#1A2421] hover:bg-[#135D39]/5"
                }`}
              >
                <Users className="w-4.5 h-4.5" /> Adashe Groups
              </button>

              <button 
                onClick={() => handleNavigate("equipment")}
                className={`w-full text-left px-4 py-2.5 rounded-full font-semibold flex items-center gap-3 transition ${
                  activeTab === "equipment" 
                    ? "bg-[#135D39] text-white shadow-md shadow-[#135D39]/15" 
                    : "text-[#5C6460] hover:text-[#1A2421] hover:bg-[#135D39]/5"
                }`}
              >
                <Compass className="w-4.5 h-4.5" /> Equipment Booking
              </button>

              <button 
                onClick={() => handleNavigate("services")}
                className={`w-full text-left px-4 py-2.5 rounded-full font-semibold flex items-center gap-3 transition ${
                  activeTab === "services" 
                    ? "bg-[#135D39] text-white shadow-md shadow-[#135D39]/15" 
                    : "text-[#5C6460] hover:text-[#1A2421] hover:bg-[#135D39]/5"
                }`}
              >
                <Wrench className="w-4.5 h-4.5" /> Agro Services
              </button>

              <button 
                onClick={() => handleNavigate("marketplace")}
                className={`w-full text-left px-4 py-2.5 rounded-full font-semibold flex items-center gap-3 transition ${
                  activeTab === "marketplace" 
                    ? "bg-[#135D39] text-white shadow-md shadow-[#135D39]/15" 
                    : "text-[#5C6460] hover:text-[#1A2421] hover:bg-[#135D39]/5"
                }`}
              >
                <ShoppingBag className="w-4.5 h-4.5" /> Inputs Marketplace
              </button>

              <button 
                onClick={() => handleNavigate("shares")}
                className={`w-full text-left px-4 py-2.5 rounded-full font-semibold flex items-center gap-3 transition ${
                  activeTab === "shares" 
                    ? "bg-[#135D39] text-white shadow-md shadow-[#135D39]/15" 
                    : "text-[#5C6460] hover:text-[#1A2421] hover:bg-[#135D39]/5"
                }`}
              >
                <TrendingUp className="w-4.5 h-4.5" /> Shares
              </button>

              <button 
                onClick={() => handleNavigate("membership")}
                className={`w-full text-left px-4 py-2.5 rounded-full font-semibold flex items-center gap-3 transition ${
                  activeTab === "membership" 
                    ? "bg-[#135D39] text-white shadow-md shadow-[#135D39]/15" 
                    : "text-[#5C6460] hover:text-[#1A2421] hover:bg-[#135D39]/5"
                }`}
              >
                <CreditCard className="w-4.5 h-4.5" /> Membership
              </button>

              <button 
                onClick={() => handleNavigate("agentsystem")}
                className={`w-full text-left px-4 py-2.5 rounded-full font-semibold flex items-center gap-3 transition ${
                  activeTab === "agentsystem" 
                    ? "bg-[#135D39] text-white shadow-md shadow-[#135D39]/15" 
                    : "text-[#5C6460] hover:text-[#1A2421] hover:bg-[#135D39]/5"
                }`}
              >
                <Briefcase className="w-4.5 h-4.5" /> Agent Terminal
              </button>
            </nav>
          </div>

          <div className="bg-[#135D39]/5 border border-[#135D39]/10 p-4 rounded-3xl mt-auto">
            <span className="text-[10px] font-bold text-[#135D39] uppercase tracking-wider block">Coop Card ID</span>
            <span className="font-mono text-sm font-bold text-[#1A2421] block mt-1">{state.membership.cardNumber}</span>
            <p className="text-[10px] text-[#5C6460] mt-1 leading-normal font-medium">Verified Active registry ticket</p>
          </div>
        </aside>

        {/* MAIN BODY AREA ON THE RIGHT (includes Top Navbar & Views Content) */}
        <div className="flex-grow flex flex-col min-h-screen lg:max-w-[calc(100%-16rem)]">
          <header className="sticky top-0 z-40 bg-[#FAF8F5]/80 backdrop-blur-md border-b border-[#E6E5DF] h-16 flex items-center justify-between px-4 sm:px-6 lg:px-8 w-full">
            {/* Hamburger Trigger for Mobile */}
            <div className="flex items-center gap-2 lg:hidden">
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="text-[#1A2421] hover:bg-[#135D39]/5 focus:outline-none p-2 rounded-xl transition"
              >
                {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
              <div className="flex items-center gap-2 cursor-pointer" onClick={() => handleNavigate("dashboard")}>
                <div className="w-8 h-8 rounded-full bg-[#135D39] flex items-center justify-center">
                  <Sprout className="w-4 h-4 text-white" />
                </div>
                <span className="font-display font-bold text-[#1A2421] text-sm tracking-tight">Bennie Agro</span>
              </div>
            </div>

            <div className="hidden lg:block">
              <span className="text-xs uppercase text-[#5C6460] font-bold tracking-wider">
                Farmer Portal / {activeTab === "dashboard" ? "Overview" : activeTab === "wallet" ? "Wallet" : activeTab === "savings" ? "Savings Portfolio" : activeTab === "shares" ? "Equity Shares" : activeTab === "agentsystem" ? "Agent Operations Suite" : "Membership System"}
              </span>
            </div>

            {/* Right side tools */}
            <div className="flex items-center gap-4">
              <div className="relative cursor-pointer hover:scale-105 transition p-2 rounded-xl bg-[#135D39]/5 text-[#135D39]" onClick={() => handleNavigate("dashboard")}>
                {state.notifications.filter(n => !n.isRead).length > 0 && (
                  <span className="w-2.5 h-2.5 rounded-full bg-[#E7A13C] absolute top-1.5 right-1.5 animate-pulse" />
                )}
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.1} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>

              {/* User badge AY */}
              <div className="w-9 h-9 rounded-full bg-[#135D39] text-white flex items-center justify-center font-bold text-xs ring-2 ring-[#135D39]/10">
                AY
              </div>
            </div>
          </header>

        {/* MOBILE SIDEBAR DROPDOWN (ONLY SHOWN WHEN IS OPENED) */}
        {isMobileMenuOpen && (
          <div className="lg:hidden fixed inset-0 z-50 bg-[#FAF8F5]/98 backdrop-blur-md shadow-2xl animate-fade-in flex flex-col justify-between p-6">
            <div className="space-y-6">
              <div className="flex justify-between items-center pb-4 border-b border-[#E6E5DF]">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-[#135D39] flex items-center justify-center">
                    <Sprout className="w-4 h-4 text-white" />
                  </div>
                  <span className="font-display font-semibold text-[#1A2421] text-base">Bennie Agro</span>
                </div>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="text-[#1A2421] p-1 h-8 w-8 hover:bg-slate-100 rounded-lg transition flex items-center justify-center"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <nav className="flex flex-col space-y-2">
                <button
                  onClick={() => { handleNavigate("dashboard"); setIsMobileMenuOpen(false); }}
                  className={`w-full text-left px-4 py-3 rounded-full font-semibold flex items-center gap-3 transition ${
                    activeTab === "dashboard" ? "bg-[#135D39] text-white" : "text-[#5C6460] hover:text-[#1A2421]"
                  }`}
                >
                  <LayoutDashboard className="w-5 h-5" /> Overview
                </button>



              <button
                onClick={() => { handleNavigate("wallet"); setIsMobileMenuOpen(false); }}
                className={`w-full text-[#1A2421] text-left px-4 py-3 rounded-full font-semibold flex items-center gap-3 transition ${
                  activeTab === "wallet" ? "bg-[#135D39] text-white" : "text-[#5C6460] hover:text-[#1A2421]"
                }`}
              >
                <Wallet className="w-5 h-5" /> Wallet
              </button>
              
              <button
                onClick={() => { handleNavigate("savings"); setIsMobileMenuOpen(false); }}
                className={`w-full text-[#1A2421] text-left px-4 py-3 rounded-full font-semibold flex items-center gap-3 transition ${
                  activeTab === "savings" ? "bg-[#135D39] text-white" : "text-[#5C6460] hover:text-[#1A2421]"
                }`}
              >
                <PiggyBank className="w-5 h-5" /> Savings
              </button>
              
              <button
                onClick={() => { handleNavigate("adashe"); setIsMobileMenuOpen(false); }}
                className={`w-full text-[#1A2421] text-left px-4 py-3 rounded-full font-semibold flex items-center gap-3 transition ${
                  activeTab === "adashe" ? "bg-[#135D39] text-white" : "text-[#5C6460] hover:text-[#1A2421]"
                }`}
              >
                <Users className="w-5 h-5" /> Adashe Groups
              </button>

              <button
                onClick={() => { handleNavigate("equipment"); setIsMobileMenuOpen(false); }}
                className={`w-full text-[#1A2421] text-left px-4 py-3 rounded-full font-semibold flex items-center gap-3 transition ${
                  activeTab === "equipment" ? "bg-[#135D39] text-white" : "text-[#5C6460] hover:text-[#1A2421]"
                }`}
              >
                <Compass className="w-5 h-5" /> Equipment Booking
              </button>

              <button
                onClick={() => { handleNavigate("services"); setIsMobileMenuOpen(false); }}
                className={`w-full text-[#1A2421] text-left px-4 py-3 rounded-full font-semibold flex items-center gap-3 transition ${
                  activeTab === "services" ? "bg-[#135D39] text-white" : "text-[#5C6460] hover:text-[#1A2421]"
                }`}
              >
                <Wrench className="w-5 h-5" /> Agro Services
              </button>

              <button
                onClick={() => { handleNavigate("marketplace"); setIsMobileMenuOpen(false); }}
                className={`w-full text-[#1A2421] text-left px-4 py-3 rounded-full font-semibold flex items-center gap-3 transition ${
                  activeTab === "marketplace" ? "bg-[#135D39] text-white" : "text-[#5C6460] hover:text-[#1A2421]"
                }`}
              >
                <ShoppingBag className="w-5 h-5" /> Inputs Marketplace
              </button>
              
              <button
                onClick={() => { handleNavigate("shares"); setIsMobileMenuOpen(false); }}
                className={`w-full text-left px-4 py-3 rounded-full font-semibold flex items-center gap-3 transition ${
                  activeTab === "shares" ? "bg-[#135D39] text-white" : "text-[#5C6460] hover:text-[#1A2421]"
                }`}
              >
                <TrendingUp className="w-5 h-5" /> Shares
              </button>
              
              <button
                onClick={() => { handleNavigate("membership"); setIsMobileMenuOpen(false); }}
                className={`w-full text-[#1A2421] text-left px-4 py-3 rounded-full font-semibold flex items-center gap-3 transition ${
                  activeTab === "membership" ? "bg-[#135D39] text-white" : "text-[#5C6460] hover:text-[#1A2421]"
                }`}
              >
                <CreditCard className="w-5 h-5" /> Membership
              </button>

              <button
                onClick={() => { handleNavigate("agentsystem"); setIsMobileMenuOpen(false); }}
                className={`w-full text-[#1A2421] text-left px-4 py-3 rounded-full font-semibold flex items-center gap-3 transition ${
                  activeTab === "agentsystem" ? "bg-[#135D39] text-white" : "text-[#5C6460] hover:text-[#1A2421]"
                }`}
              >
                <Briefcase className="w-5 h-5" /> Agent Terminal
              </button>
            </nav>

            <div className="bg-[#135D39]/5 border border-[#135D39]/10 p-4 rounded-3xl mt-auto">
              <span className="text-[10px] font-bold text-[#135D39] uppercase tracking-wider block">Coop Card ID</span>
              <span className="font-mono text-sm font-bold text-[#1A2421] block mt-1">{state.membership.cardNumber}</span>
              <p className="text-[10px] text-[#5C6460] mt-1 leading-normal font-medium">Verified Active registry ticket</p>
            </div>
          </div>
        </div>
      )}



      {/* Main Page Content Body */}
      <main className="flex-grow w-full py-8 md:py-10">
        {activeTab === "dashboard" && (
          <DashboardView 
            state={state}
            onNavigate={handleNavigate}
            onJoinGroup={handleJoinContributionCircle}
            onCancelBooking={handleCancelBooking}
            onReadNotification={handleReadNotification}
            onClearNotifications={handleClearNotifications}
          />
        )}

        {activeTab === "membership" && (
          <MembershipView 
            state={state}
            onUpgradeTier={handleUpgradeTier}
            onRenewSubscription={handleRenewSubscription}
          />
        )}

        {activeTab === "wallet" && (
          <DigitalWalletView 
            state={state}
            onDeposit={handleDeposit}
            onWithdraw={handleWithdrawToBank}
            onTransfer={handleTransferToMember}
          />
        )}

        {activeTab === "savings" && (
          <SavingsProductsView 
            state={state}
            onFlexDeposit={handleFlexDeposit}
            onFlexWithdraw={handleFlexWithdraw}
            onAddTargetGoal={handleAddTargetGoal}
            onAddFundsToTarget={handleAddFundsToTarget}
            onWithdrawTargetGoal={handleWithdrawTargetGoal}
            onAddFixedLock={handleAddFixedLock}
            onWithdrawFixedLock={handleWithdrawFixedLock}
            onAddHarvestPlan={handleAddHarvestPlan}
          />
        )}

        {activeTab === "shares" && (
          <CooperativeSharesView 
            state={state}
            onBuyShares={handleBuyShares}
            onSellShares={handleSellShares}
            onClaimDividends={handleClaimDividends}
          />
        )}

        {activeTab === "adashe" && (
          <AdasheView 
            state={state}
            onNavigate={handleNavigate}
            onJoinGroup={handleJoinContributionCircle}
            onPayContribution={handlePayAdasheContribution}
            onClaimPayout={handleClaimAdashePayout}
            onSendMessage={handleSendAdasheMessage}
            onVoteProposal={handleVoteOnAdasheProposal}
            onCreateProposal={handleCreateAdasheProposal}
            onCheckInAttendance={handleAdasheAttendanceCheckIn}
            onCreateAdasheGroup={handleCreateAdasheGroup}
          />
        )}

        {activeTab === "equipment" && (
          <EquipmentBookingView 
            state={state}
            onNavigate={handleNavigate}
            onAddBooking={handleAddBooking}
            onUpdateBookingStatus={handleUpdateBookingStatus}
            onRateBooking={handleRateBooking}
          />
        )}

        {activeTab === "services" && (
          <AgriculturalServicesView 
            state={state}
            onBookService={handleBookService}
            onPayBooking={handlePayBooking}
            onReviewBooking={handleReviewBooking}
            onCancelBooking={handleCancelServiceBooking}
            onSimulateStatus={handleSimulateStatus}
          />
        )}

        {activeTab === "marketplace" && (
          <AgriculturalMarketplaceView 
            state={state}
            onAddToCart={handleAddToCart}
            onUpdateCartQty={handleUpdateCartQty}
            onRemoveFromCart={handleRemoveFromCart}
            onCheckout={handleCheckoutMarketplace}
            onAddProduct={handleMerchantAddProduct}
            onUpdateProductStock={handleMerchantUpdateStock}
            onUpdateOrderStatus={handleMerchantUpdateOrderStatus}
          />
        )}

        {activeTab === "agentsystem" && (
          <AgentDashboardView 
            state={state}
            onRegisterFarmer={handleRegisterFarmer}
            onVerifyFarmerKYC={handleVerifyFarmerKYC}
            onSimulateActivity={handleSimulateAgentActivity}
            onPromoteAgent={handlePromoteAgent}
          />
        )}
      </main>

        </div>
      </div>

      {/* Foot banner */}
      <footer className="bg-[#FAF8F5] text-[#5C6460] py-12 border-t border-[#E6E5DF] mt-16 text-xs relative z-10 w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-[#135D39] flex items-center justify-center">
                <Sprout className="w-4 h-4 text-white" />
              </div>
              <span className="font-display font-medium text-[#1A2421] tracking-widest uppercase">Bennie Agro</span>
            </div>
            <p className="max-w-md text-[#5C6460] leading-relaxed text-[11px]">
              Bennie Agro Coop Society is formatted under agricultural bylaws to build mutual micro-capital, targeted tractor reserves, and verified shares safely.
            </p>
          </div>


          <div className="flex gap-16 flex-wrap">
            <div className="space-y-2">
              <h4 className="text-[#1A2421] font-semibold uppercase text-[10px] tracking-wider">Savings Engines</h4>
              <ul className="space-y-1.5 text-[#5C6460]">
                <li><button onClick={() => handleNavigate("savings")} className="hover:text-[#135D39] transition cursor-pointer text-left font-medium">Flex Save (8.5% APY)</button></li>
                <li><button onClick={() => handleNavigate("savings")} className="hover:text-[#135D39] transition cursor-pointer text-left font-medium">Target Goal Save (11.5% APY)</button></li>
                <li><button onClick={() => handleNavigate("savings")} className="hover:text-[#135D39] transition cursor-pointer text-left font-medium">Fixedlocked Save (14.5% APY)</button></li>
                <li><button onClick={() => handleNavigate("savings")} className="hover:text-[#135D39] transition cursor-pointer text-left font-medium">Seasonal Harvest Save (12.5% APY)</button></li>
              </ul>
            </div>

            <div className="space-y-2">
              <h4 className="text-[#1A2421] font-semibold uppercase text-[10px] tracking-wider">Memberships</h4>
              <ul className="space-y-1.5 text-[#5C6460]">
                <li><button onClick={() => handleNavigate("membership")} className="hover:text-[#135D39] transition cursor-pointer text-left font-medium">Bronze Starter Tier</button></li>
                <li><button onClick={() => handleNavigate("membership")} className="hover:text-[#135D39] transition cursor-pointer text-left font-medium">Silver Discounted Tier</button></li>
                <li><button onClick={() => handleNavigate("membership")} className="hover:text-[#135D39] transition cursor-pointer text-left font-medium">Gold Standard tier</button></li>
                <li><button onClick={() => handleNavigate("membership")} className="hover:text-[#135D39] transition cursor-pointer text-left font-medium">Platinum maximum tier</button></li>
              </ul>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 mt-8 border-t border-[#E6E5DF] text-[#5C6460] flex justify-between items-center text-[10px]">
          <span>© 1999 - 2026 Bennie Agro Cooperative. All rights reserved.</span>
          <span className="flex items-center gap-1 font-mono">
            Secure SHA-256 Ledger • Standard Paystack / Flutterwave Interfacing Active
          </span>
        </div>
      </footer>

    </div>
  );
}
