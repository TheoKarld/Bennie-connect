/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

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
  AgentLevel,
} from "../types";
import { INITIAL_APP_STATE, MEMBERSHIP_TIERS } from "../data";
import {
  DEFAULT_SERVICE_CATEGORIES,
  DEFAULT_SERVICE_BOOKINGS,
  DEFAULT_PRODUCTS,
  DEFAULT_ORDERS,
} from "../default_marketplace_data";

/**
 * Global application store (zustand + persist).
 *
 * Ported VERBATIM from the previous monolithic App.tsx: the entire
 * FarmerAppState plus every mutation handler. Persisted under the same
 * localStorage key ("KM_FARMER_PORTAL_STATE_REAL") the prototype used, so
 * returning users keep their existing state. The init back-fill defaults for
 * newly-added slices (serviceCategories / serviceBookings / products / orders /
 * cart, agent fallbacks) are preserved from App.tsx's useState initializer.
 */

const LOCAL_STORAGE_KEY = "KM_FARMER_PORTAL_STATE_REAL";

// --- Local tx / notification helpers (ported verbatim from App.tsx) ----------

const appendTx = (
  type:
    | "deposit"
    | "withdraw"
    | "transfer"
    | "savings_transfer"
    | "share_purchase"
    | "share_sale"
    | "dividend_payment"
    | "membership_fee",
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
    status: "success" as const,
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
    isRead: false,
  };
  return newNotif;
};

// --- Store actions interface -------------------------------------------------

interface AppActions {
  appendTx: typeof appendTx;
  appendNotification: typeof appendNotification;

  // Dashboard
  handleJoinContributionCircle: (groupId: string) => void;
  handleCancelBooking: (bookingId: string) => void;
  handleReadNotification: (notifId: string) => void;
  handleClearNotifications: () => void;

  // Membership
  handleUpgradeTier: (tier: MembershipTierStr, cost: number) => void;
  handleRenewSubscription: () => void;

  // Wallet
  handleDeposit: (amount: number, gateway: PaymentGatewayType) => void;
  handleWithdrawToBank: (amount: number, bank: string, accNum: string) => void;
  handleTransferToMember: (
    amount: number,
    recipientId: string,
    recipientName: string
  ) => void;

  // Savings
  handleFlexDeposit: (amount: number) => void;
  handleFlexWithdraw: (amount: number) => void;
  handleAddTargetGoal: (
    goal: Omit<TargetSavingGoal, "id" | "currentAmount" | "status">
  ) => void;
  handleAddFundsToTarget: (goalId: string, amount: number) => void;
  handleWithdrawTargetGoal: (goalId: string) => void;
  handleAddFixedLock: (
    lock: Omit<FixedSaveLock, "id" | "status" | "accumulatedInterest">
  ) => void;
  handleWithdrawFixedLock: (lockId: string) => void;
  handleAddHarvestPlan: (
    plan: Omit<HarvestSavePlan, "id" | "amountSaved" | "status">,
    initialDeposit: number
  ) => void;

  // Shares
  handleBuyShares: (sharesCount: number, pricePerShare: number) => void;
  handleSellShares: (sharesCount: number, pricePerShare: number) => void;
  handleClaimDividends: () => void;

  // Adashe
  handlePayAdasheContribution: (groupId: string, amount: number) => void;
  handleClaimAdashePayout: (groupId: string, amount: number) => void;
  handleSendAdasheMessage: (
    groupId: string,
    sender: string,
    message: string
  ) => void;
  handleVoteOnAdasheProposal: (
    groupId: string,
    proposalId: string,
    vote: "yes" | "no"
  ) => void;
  handleCreateAdasheProposal: (groupId: string, proposalText: string) => void;
  handleAdasheAttendanceCheckIn: (groupId: string, date: string) => void;
  handleCreateAdasheGroup: (groupDetails: any) => void;

  // Equipment
  handleAddBooking: (details: Omit<AgriBooking, "id">) => void;
  handleUpdateBookingStatus: (
    bookingId: string,
    status: AgriBooking["status"],
    evidence?: AgriBooking["completionEvidence"]
  ) => void;
  handleRateBooking: (
    bookingId: string,
    rating: number,
    comment?: string
  ) => void;

  // Services
  handleBookService: (booking: Omit<ServiceBooking, "id" | "createdAt">) => void;
  handlePayBooking: (bookingId: string) => void;
  handleCancelServiceBooking: (bookingId: string) => void;
  handleSimulateStatus: (bookingId: string) => void;
  handleReviewBooking: (
    bookingId: string,
    rating: number,
    comment: string
  ) => void;

  // Marketplace
  handleAddToCart: (productId: string) => void;
  handleUpdateCartQty: (cartItemId: string, qty: number) => void;
  handleRemoveFromCart: (cartItemId: string) => void;
  handleCheckoutMarketplace: (deliveryAddress: string) => void;
  handleMerchantAddProduct: (
    product: Omit<Product, "id" | "merchantId" | "merchantName">
  ) => void;
  handleMerchantUpdateStock: (productId: string, newStock: number) => void;
  handleMerchantUpdateOrderStatus: (
    orderId: string,
    status: ProductOrder["status"]
  ) => void;

  // Agent
  handleRegisterFarmer: (
    farmer: Omit<RegisteredFarmer, "id" | "dateRegistered" | "kycStatus">
  ) => void;
  handleVerifyFarmerKYC: (farmerId: string) => void;
  handleSimulateAgentActivity: (
    farmerId: string,
    activityType: string,
    amount: number
  ) => void;
  handlePromoteAgent: (newLevel: AgentLevel) => void;
}

export type AppStore = FarmerAppState & AppActions;

// --- Initial state with back-fill defaults (ported from App.tsx initializer) -

function buildInitialState(): FarmerAppState {
  const baseState: FarmerAppState = { ...INITIAL_APP_STATE };

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
}

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      ...buildInitialState(),

      appendTx,
      appendNotification,

      // 1. Dashboard actions
      handleJoinContributionCircle: (groupId) => {
        set((prev) => {
          const updatedGroups = prev.contributionGroups.map((g) => {
            if (g.id === groupId) {
              const userRankStr = `Slot #${g.memberCount + 1}`;
              const currentMembers = g.members || [];
              const currentChats = g.chatHistory || [];
              const currentVotes = g.votes || [];
              const currentAttendance = g.attendance || [];

              const sysChat = {
                id: "sys_" + Math.random().toString(36).substring(2, 6),
                sender: "System Bot",
                avatar: "🤖",
                message: `Verify Event: Aliyu (You) has successfully filled ${userRankStr} in the rotation sequence.`,
                time: "Just now",
                system: true,
              };

              return {
                ...g,
                memberCount: g.memberCount + 1,
                hasJoined: true,
                userRank: userRankStr,
                members: [...currentMembers, `Aliyu (You - ${userRankStr})`],
                chatHistory: [...currentChats, sysChat],
                votes: currentVotes,
                attendance: currentAttendance,
              };
            }
            return g;
          });

          const joinedGroup = prev.contributionGroups.find((g) => g.id === groupId);
          const notif = appendNotification(
            "Ajo Circle Joined 🤝",
            `You successfully joined the rotating savings group: ${joinedGroup?.name || "Circle"}. Contribution cycle is set to active.`,
            "success"
          );

          return {
            ...prev,
            contributionGroups: updatedGroups,
            notifications: [notif, ...prev.notifications],
          };
        });
      },

      handleCancelBooking: (bookingId) => {
        set((prev) => {
          const bkToCancel = prev.bookings.find((b) => b.id === bookingId);
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
            notifications: [notif, ...prev.notifications],
          };
        });
      },

      handleReadNotification: (notifId) => {
        set((prev) => ({
          ...prev,
          notifications: prev.notifications.map((n) =>
            n.id === notifId ? { ...n, isRead: true } : n
          ),
        }));
      },

      handleClearNotifications: () => {
        set((prev) => ({
          ...prev,
          notifications: [],
        }));
      },

      // 2. Membership actions
      handleUpgradeTier: (tier, cost) => {
        set((prev) => {
          const newCard = "COOP-FARM-" + Math.floor(1000 + Math.random() * 9000);
          const isBronze = tier === "Bronze";

          const walletTx = !isBronze
            ? appendTx("membership_fee", cost, `Upgraded Member Level to ${tier} Tier`)
            : null;

          const historyItem = {
            id: "mh_" + Math.random().toString(36).substring(2, 6),
            date: new Date().toISOString().split("T")[0],
            action: `Upgraded to ${tier} Membership`,
            amount: cost,
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
              expiryDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1))
                .toISOString()
                .split("T")[0],
              cost,
              benefits: MEMBERSHIP_TIERS[tier].benefits,
            },
            membershipHistory: [historyItem, ...prev.membershipHistory],
            walletTransactions: walletTx
              ? [walletTx, ...prev.walletTransactions]
              : prev.walletTransactions,
            notifications: [notif, ...prev.notifications],
          };
        });
      },

      handleRenewSubscription: () => {
        set((prev) => {
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
            amount: cost,
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
            notifications: [notif, ...prev.notifications],
          };
        });
      },

      // 3. Digital Wallet actions
      handleDeposit: (amount, gateway) => {
        set((prev) => {
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
            notifications: [notif, ...prev.notifications],
          };
        });
      },

      handleWithdrawToBank: (amount, bank, accNum) => {
        set((prev) => {
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
            notifications: [notif, ...prev.notifications],
          };
        });
      },

      handleTransferToMember: (amount, recipientId, recipientName) => {
        set((prev) => {
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
            notifications: [notif, ...prev.notifications],
          };
        });
      },

      // 4. Savings actions
      handleFlexDeposit: (amount) => {
        set((prev) => {
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
            notifications: [notif, ...prev.notifications],
          };
        });
      },

      handleFlexWithdraw: (amount) => {
        set((prev) => {
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
            notifications: [notif, ...prev.notifications],
          };
        });
      },

      handleAddTargetGoal: (goal) => {
        set((prev) => {
          const newGoal: TargetSavingGoal = {
            ...goal,
            id: "tg_" + Math.random().toString(36).substring(2, 6),
            currentAmount: 0,
            status: "ongoing",
          };

          const notif = appendNotification(
            "Savings Target Begun 🎯",
            `Started goal saving program: \"${goal.title}\". Target goal: ₦${goal.targetAmount.toLocaleString()}.`,
            "success"
          );

          return {
            ...prev,
            targetGoals: [...prev.targetGoals, newGoal],
            notifications: [notif, ...prev.notifications],
          };
        });
      },

      handleAddFundsToTarget: (goalId, amount) => {
        set((prev) => {
          const walletTx = appendTx(
            "savings_transfer",
            amount,
            `Added top-up to target goal: ${prev.targetGoals.find((g) => g.id === goalId)?.title}`
          );

          const updatedGoals = prev.targetGoals.map((g) => {
            if (g.id === goalId) {
              const newCurrent = g.currentAmount + amount;
              const completed = newCurrent >= g.targetAmount;
              return {
                ...g,
                currentAmount: newCurrent,
                status: completed ? ("completed" as const) : g.status,
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
            notifications: [notif, ...prev.notifications],
          };
        });
      },

      handleWithdrawTargetGoal: (goalId) => {
        set((prev) => {
          const target = prev.targetGoals.find((g) => g.id === goalId);
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
            notifications: [notif, ...prev.notifications],
          };
        });
      },

      handleAddFixedLock: (lock) => {
        set((prev) => {
          const newLock: FixedSaveLock = {
            ...lock,
            id: "fl_" + Math.random().toString(36).substring(2, 6),
            status: "locked",
            accumulatedInterest: Math.round(
              lock.amount * (lock.interestRate / 100) * 0.05
            ), // Simulated starting portion
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
            notifications: [notif, ...prev.notifications],
          };
        });
      },

      handleWithdrawFixedLock: (lockId) => {
        set((prev) => {
          const lock = prev.fixedLocks.find((l) => l.id === lockId);
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
            notifications: [notif, ...prev.notifications],
          };
        });
      },

      handleAddHarvestPlan: (plan, initialDeposit) => {
        set((prev) => {
          const newPlan: HarvestSavePlan = {
            ...plan,
            id: "hp_" + Math.random().toString(36).substring(2, 6),
            amountSaved: initialDeposit,
            status: "active",
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
            notifications: [notif, ...prev.notifications],
          };
        });
      },

      // 5. Share Trading actions
      handleBuyShares: (sharesCount, pricePerShare) => {
        set((prev) => {
          const totalCost = sharesCount * pricePerShare;

          const shareTx = {
            id: "st_" + Math.random().toString(36).substring(2, 6),
            date: new Date().toISOString(),
            type: "buy" as const,
            sharesCount,
            pricePerShare,
            totalAmount: totalCost,
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
              history: [shareTx, ...prev.shares.history],
            },
            walletTransactions: [walletTx, ...prev.walletTransactions],
            notifications: [notif, ...prev.notifications],
          };
        });
      },

      handleSellShares: (sharesCount, pricePerShare) => {
        set((prev) => {
          const totalProceeds = sharesCount * pricePerShare;

          // Calculate adjusted cost basis
          const originalCostRelation =
            (sharesCount / prev.shares.sharesOwned) * prev.shares.bookValue;

          const shareTx = {
            id: "st_" + Math.random().toString(36).substring(2, 6),
            date: new Date().toISOString(),
            type: "sell" as const,
            sharesCount,
            pricePerShare,
            totalAmount: totalProceeds,
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
              history: [shareTx, ...prev.shares.history],
            },
            walletTransactions: [walletTx, ...prev.walletTransactions],
            notifications: [notif, ...prev.notifications],
          };
        });
      },

      handleClaimDividends: () => {
        set((prev) => {
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
              totalDividendsEarned: 0,
            },
            walletTransactions: [walletTx, ...prev.walletTransactions],
            notifications: [notif, ...prev.notifications],
          };
        });
      },

      // 6. Adashe Savings handlers
      handlePayAdasheContribution: (groupId, amount) => {
        set((prev) => {
          const updatedGroups = prev.contributionGroups.map((g) => {
            if (g.id === groupId) {
              const currentH = g.savingHistory || [];
              const newSave = {
                date: new Date().toISOString().split("T")[0],
                amount,
                memberName: "Aliyu (You)",
              };
              const systemMsg = {
                id: "sys_" + Math.random().toString(36).substring(2, 6),
                sender: "System Bot",
                avatar: "🤖",
                message: `Verify Event: Aliyu (You) successfully completed dues contribution of ₦${amount.toLocaleString()}.`,
                time: "Just now",
                system: true,
              };
              return {
                ...g,
                currentPool: g.currentPool + amount,
                savingHistory: [newSave, ...currentH],
                chatHistory: [...(g.chatHistory || []), systemMsg],
              };
            }
            return g;
          });

          const matchedGroup = prev.contributionGroups.find((g) => g.id === groupId);
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
            notifications: [notif, ...prev.notifications],
          };
        });
      },

      handleClaimAdashePayout: (groupId, amount) => {
        set((prev) => {
          const gToClear = prev.contributionGroups.find((g) => g.id === groupId);
          const updatedGroups = prev.contributionGroups.map((g) => {
            if (g.id === groupId) {
              const nextSlot =
                (g.activePayoutSlot || 1) >= (g.maxSlots || 10)
                  ? 1
                  : (g.activePayoutSlot || 1) + 1;
              const sysChat = {
                id: "sys_" + Math.random().toString(36).substring(2, 6),
                sender: "System Bot",
                avatar: "🤖",
                message: `Congratulations! Payout of ₦${amount.toLocaleString()} was safely disbursed to Slot #5 Aliyu! Rotating sequence shifted to Slot #${nextSlot}.`,
                time: "Just now",
                system: true,
              };
              return {
                ...g,
                currentPool: 0, // Reset for next rotation cycle dues
                activePayoutSlot: nextSlot,
                chatHistory: [...(g.chatHistory || []), sysChat],
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
            notifications: [notif, ...prev.notifications],
          };
        });
      },

      handleSendAdasheMessage: (groupId, sender, message) => {
        set((prev) => {
          const updatedGroups = prev.contributionGroups.map((g) => {
            if (g.id === groupId) {
              const newMsg = {
                id: "ch_" + Math.random().toString(36).substring(2, 6),
                sender,
                avatar:
                  sender === "Aliyu (You)"
                    ? "AY"
                    : sender.slice(0, 2).toUpperCase(),
                message,
                time: "Just now",
                isUser: sender === "Aliyu (You)",
              };
              return {
                ...g,
                chatHistory: [...(g.chatHistory || []), newMsg],
              };
            }
            return g;
          });
          return {
            ...prev,
            contributionGroups: updatedGroups,
          };
        });
      },

      handleVoteOnAdasheProposal: (groupId, proposalId, vote) => {
        set((prev) => {
          const updatedGroups = prev.contributionGroups.map((g) => {
            if (g.id === groupId) {
              const updatedVotes = g.votes?.map((prop) => {
                if (prop.id === proposalId) {
                  return {
                    ...prop,
                    yesVotes: vote === "yes" ? prop.yesVotes + 1 : prop.yesVotes,
                    noVotes: vote === "no" ? prop.noVotes + 1 : prop.noVotes,
                    userVoted: vote,
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
            contributionGroups: updatedGroups,
          };
        });
      },

      handleCreateAdasheProposal: (groupId, proposalText) => {
        set((prev) => {
          const selected = prev.contributionGroups.find((g) => g.id === groupId);
          const newProp = {
            id: "v_" + Math.random().toString(36).substring(2, 6),
            proposal: proposalText,
            yesVotes: 1, // Aliyu votes yes
            noVotes: 0,
            totalSlots: selected?.maxSlots || 10,
            userVoted: "yes" as const,
            status: "active" as const,
          };

          const updatedGroups = prev.contributionGroups.map((g) => {
            if (g.id === groupId) {
              return {
                ...g,
                votes: [newProp, ...(g.votes || [])],
              };
            }
            return g;
          });

          return {
            ...prev,
            contributionGroups: updatedGroups,
          };
        });
      },

      handleAdasheAttendanceCheckIn: (groupId, date) => {
        set((prev) => {
          const updatedGroups = prev.contributionGroups.map((g) => {
            if (g.id === groupId) {
              const updatedAtt = g.attendance?.map((att) => {
                if (att.date === date) {
                  return {
                    ...att,
                    presentCount: att.presentCount + 1,
                    userStatus: "present" as const,
                  };
                }
                return att;
              });
              const sysChat = {
                id: "sys_" + Math.random().toString(36).substring(2, 6),
                sender: "System Bot",
                avatar: "🤖",
                message:
                  "Verify Complete: Aliyu checked in successfully via cooperative cellular geolocation triangulation.",
                time: "Just now",
                system: true,
              };
              return {
                ...g,
                attendance: updatedAtt,
                chatHistory: [...(g.chatHistory || []), sysChat],
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
            notifications: [notif, ...prev.notifications],
          };
        });
      },

      handleCreateAdasheGroup: (groupDetails) => {
        set((prev) => {
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
              {
                id: "ch_welcome",
                sender: "System Bot",
                avatar: "🤖",
                message: `Welcome to ${groupDetails.name}! Rotating index is initialized to Slot #1. Cycle awaits additional cooperative members.`,
                time: "Just now",
                system: true,
              },
            ],
            votes: [],
            attendance: [
              {
                date: new Date().toISOString().split("T")[0],
                title: `${groupDetails.name} Inaugural Setup & Briefing`,
                presentCount: 1,
                userStatus: "present" as const,
              },
            ],
            savingHistory: [
              {
                date: new Date().toISOString().split("T")[0],
                amount: groupDetails.cycleAmount,
                memberName: "Aliyu (You)",
              },
            ],
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
            notifications: [notif, ...prev.notifications],
          };
        });
      },

      // 7. Equipment Booking System Handlers (Hello Tractor inspired)
      handleAddBooking: (details) => {
        set((prev) => {
          const newBookingId = "bk_" + Math.random().toString(36).substring(2, 6);
          const newBookingObj: AgriBooking = {
            ...details,
            id: newBookingId,
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
            notifications: [notif, ...prev.notifications],
          };
        });
      },

      handleUpdateBookingStatus: (bookingId, status, evidence) => {
        set((prev) => {
          const targetB = prev.bookings.find((b) => b.id === bookingId);
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
            const updatedNotifTitle =
              status === "assigned" ? "Operator Dispatched 🧑‍✈️" : "Job In Progress ⚡";
            const updatedNotifMsg =
              status === "assigned"
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
                completionEvidence: evidence || b.completionEvidence,
              };
            }
            return b;
          });

          return {
            ...prev,
            walletBalance: updatedBalance,
            bookings: updatedBookings,
            walletTransactions: extraTxs,
            notifications: extraNotifs,
          };
        });
      },

      handleRateBooking: (bookingId, rating, comment) => {
        set((prev) => {
          const updatedBookings = prev.bookings.map((b) => {
            if (b.id === bookingId) {
              return {
                ...b,
                farmerRating: rating,
                farmerRatingComment: comment,
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
            notifications: [ratingNotif, ...prev.notifications],
          };
        });
      },

      // MODULE 4: AGRICULTURAL SERVICES ACTIONS
      handleBookService: (booking) => {
        set((prev) => {
          const newId = "sb_" + Math.floor(1000 + Math.random() * 9000);
          const newBooking: ServiceBooking = {
            ...booking,
            id: newId,
            createdAt: new Date().toISOString(),
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
            notifs.unshift(
              appendNotification(
                "Service Paid Instantly 💳",
                `₦${booking.totalCost.toLocaleString()} was successfully paid from your digital wallet for ${booking.serviceName}.`,
                "success"
              )
            );
          } else {
            notifs.unshift(
              appendNotification(
                "Service Booked 🗓️",
                `Your booking for ${booking.serviceName} has been initialized. Payment of ₦${booking.totalCost.toLocaleString()} is pending.`,
                "info"
              )
            );
          }

          return {
            ...prev,
            walletBalance: newBalance,
            serviceBookings: [newBooking, ...(prev.serviceBookings || [])],
            walletTransactions: txs,
            notifications: notifs,
          };
        });
      },

      handlePayBooking: (bookingId) => {
        set((prev) => {
          const bookingsList = prev.serviceBookings || [];
          const booking = bookingsList.find((b) => b.id === bookingId);
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
            notifications: [
              appendNotification(
                "Remaining Balance Cleared 💰",
                `Unpaid commitment of ₦${booking.totalCost.toLocaleString()} on ${booking.serviceName} was successfully paid with your wallet.`,
                "success"
              ),
              ...prev.notifications,
            ],
          };
        });
      },

      handleCancelServiceBooking: (bookingId) => {
        set((prev) => {
          const bookingsList = prev.serviceBookings || [];
          const booking = bookingsList.find((b) => b.id === bookingId);
          if (
            !booking ||
            booking.status === "cancelled" ||
            booking.status === "completed"
          )
            return prev;

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
            notifications: [
              appendNotification(
                "Service Cancelled ❌",
                `Booking ${bookingId} cancelled. Refund of ₦${refundAmt.toLocaleString()} has been added back to your liquid balance.`,
                "info"
              ),
              ...prev.notifications,
            ],
          };
        });
      },

      handleSimulateStatus: (bookingId) => {
        set((prev) => {
          const bookingsList = prev.serviceBookings || [];
          const booking = bookingsList.find((b) => b.id === bookingId);
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
            notifications: [
              appendNotification(notifTitle, notifMsg, "success"),
              ...prev.notifications,
            ],
          };
        });
      },

      handleReviewBooking: (bookingId, rating, comment) => {
        set((prev) => {
          const bookingsList = prev.serviceBookings || [];
          const updatedBookings = bookingsList.map((b) =>
            b.id === bookingId ? { ...b, rating, reviewComment: comment } : b
          );

          // Append review to target service category list as well to update average rating!
          const targetB = bookingsList.find((b) => b.id === bookingId);
          let updatedCategories = prev.serviceCategories || [];

          if (targetB) {
            updatedCategories = (prev.serviceCategories || []).map((cat) => {
              if (cat.name === targetB.serviceName) {
                const newRev = {
                  id: "rev_" + Math.random().toString(36).substring(2, 6),
                  farmerName: "Aliyu (You)",
                  rating,
                  comment,
                  date: new Date().toISOString().split("T")[0],
                };
                const reviews = [...cat.reviews, newRev];
                const avgRating = parseFloat(
                  (
                    reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
                  ).toFixed(1)
                );
                return {
                  ...cat,
                  reviews,
                  rating: avgRating,
                };
              }
              return cat;
            });
          }

          return {
            ...prev,
            serviceBookings: updatedBookings,
            serviceCategories: updatedCategories,
            notifications: [
              appendNotification(
                "Review Submitted ✍️",
                `Thank you! Your assessment has been recorded. It helps other farmers select certified operators.`,
                "success"
              ),
              ...prev.notifications,
            ],
          };
        });
      },

      // MODULE 5: AGRICULTURAL MARKETPLACE ACTIONS
      handleAddToCart: (productId) => {
        set((prev) => {
          const cartList = prev.cart || [];
          const existingItem = cartList.find((item) => item.productId === productId);
          const targetP = (prev.products || []).find((p) => p.id === productId);

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
            updatedCart = cartList.map((item) =>
              item.productId === productId
                ? { ...item, quantity: item.quantity + 1 }
                : item
            );
          } else {
            updatedCart = [
              ...cartList,
              {
                id: "ci_" + Math.random().toString(36).substring(2, 6),
                productId,
                quantity: 1,
              },
            ];
          }

          return {
            ...prev,
            cart: updatedCart,
          };
        });
      },

      handleUpdateCartQty: (cartItemId, qty) => {
        set((prev) => {
          const cartList = prev.cart || [];
          const item = cartList.find((i) => i.id === cartItemId);
          if (!item) return prev;

          const targetP = (prev.products || []).find((p) => p.id === item.productId);
          if (!targetP) return prev;

          if (qty > targetP.stock) {
            alert(
              `Insufficient merchant stock! Selected quantity matches caps of ${targetP.stock}.`
            );
            return prev;
          }

          const updatedCart = cartList.map((i) =>
            i.id === cartItemId ? { ...i, quantity: qty } : i
          );

          return {
            ...prev,
            cart: updatedCart,
          };
        });
      },

      handleRemoveFromCart: (cartItemId) => {
        set((prev) => ({
          ...prev,
          cart: (prev.cart || []).filter((i) => i.id !== cartItemId),
        }));
      },

      handleCheckoutMarketplace: (deliveryAddress) => {
        set((prev) => {
          const cartList = prev.cart || [];
          if (cartList.length === 0) return prev;

          const productsList = prev.products || [];

          // Calculate total
          let totalAmount = 0;
          const orderItems = [];

          for (const item of cartList) {
            const prod = productsList.find((p) => p.id === item.productId);
            if (!prod || prod.stock < item.quantity) {
              alert(`Mismatched inventory: ${prod?.name || "Product"} is out of stock.`);
              return prev;
            }
            totalAmount += prod.price * item.quantity;
            orderItems.push({
              productId: item.productId,
              productName: prod.name,
              quantity: item.quantity,
              priceAtPurchase: prod.price,
            });
          }

          if (prev.walletBalance < totalAmount) {
            alert("Insufficient wallet balance.");
            return prev;
          }

          // Deduct stock levels mapping
          const updatedProducts = productsList.map((p) => {
            const cItem = cartList.find((it) => it.productId === p.id);
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
            status: "pending",
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
            notifications: [
              appendNotification(
                "Marketplace Checkout Placed 🛒",
                `Order #${newOrderId} totaling ₦${totalAmount.toLocaleString()} has been safely booked with digital wallet.`,
                "success"
              ),
              ...prev.notifications,
            ],
          };
        });
      },

      handleMerchantAddProduct: (product) => {
        set((prev) => {
          const newPId = "p_mer_" + Math.random().toString(36).substring(2, 6);
          const newProduct: Product = {
            ...product,
            id: newPId,
            merchantId: "merch_current_user",
            merchantName: "Aliyu Comrade Traders",
          };

          return {
            ...prev,
            products: [newProduct, ...(prev.products || [])],
          };
        });
      },

      handleMerchantUpdateStock: (productId, newStock) => {
        set((prev) => {
          const updatedProducts = (prev.products || []).map((p) =>
            p.id === productId ? { ...p, stock: newStock } : p
          );
          return {
            ...prev,
            products: updatedProducts,
          };
        });
      },

      handleMerchantUpdateOrderStatus: (orderId, status) => {
        set((prev) => {
          const ordersList = prev.orders || [];
          const updatedOrders = ordersList.map((o) =>
            o.id === orderId ? { ...o, status } : o
          );

          const targetOrder = ordersList.find((o) => o.id === orderId);
          const updatedNotifs = [...prev.notifications];

          if (targetOrder) {
            let statusText = "";
            if (status === "processing")
              statusText = "is packed and placed on shipping queue";
            if (status === "shipped") statusText = "is dispatched in transit";
            if (status === "delivered")
              statusText = "arrived safely under cooperative checkoff";
            if (status === "cancelled") statusText = "was cancelled by merchant node";

            updatedNotifs.unshift(
              appendNotification(
                `Order Update: #${orderId} 📦`,
                `Your active purchase of inputs ${statusText}.`,
                status === "delivered" ? "success" : "info"
              )
            );
          }

          return {
            ...prev,
            orders: updatedOrders,
            notifications: updatedNotifs,
          };
        });
      },

      // MODULE 7: AGENT SYSTEM ACTIONS
      handleRegisterFarmer: (farmer) => {
        set((prev) => {
          const farmersList = prev.registeredFarmers || [];
          const rewardsList = prev.commissionRewards || [];
          const currentLevelStr = prev.agentLevel || "Bronze Agent";

          const newFarmerId = "f_" + Math.floor(1000 + Math.random() * 9000);
          const newFarmer: RegisteredFarmer = {
            ...farmer,
            id: newFarmerId,
            kycStatus: "Pending",
            dateRegistered: new Date().toISOString(),
          };

          const multipliers: Record<AgentLevel, number> = {
            "Bronze Agent": 1.0,
            "Silver Agent": 1.1,
            "Gold Agent": 1.25,
            "Platinum Agent": 1.5,
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
            amountEarned,
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
            notifications: [
              appendNotification(
                "Farmer Onboarded! 🤝",
                `Farmer ${farmer.name} has been enrolled successfully. Earning ₦${amountEarned.toLocaleString()} credited to your agent wallet registry.`,
                "success"
              ),
              ...prev.notifications,
            ],
          };
        });
      },

      handleVerifyFarmerKYC: (farmerId) => {
        set((prev) => {
          const farmersList = prev.registeredFarmers || [];
          const target = farmersList.find((f) => f.id === farmerId);
          if (!target) return prev;

          const updatedFarmers = farmersList.map((f) =>
            f.id === farmerId ? { ...f, kycStatus: "Verified" as const } : f
          );

          return {
            ...prev,
            registeredFarmers: updatedFarmers,
            notifications: [
              appendNotification(
                "Identity Verified! 🛡️",
                `National government registry has verified identity documents for ${target.name}.`,
                "success"
              ),
              ...prev.notifications,
            ],
          };
        });
      },

      handleSimulateAgentActivity: (farmerId, activityType, amount) => {
        set((prev) => {
          const farmersList = prev.registeredFarmers || [];
          const rewardsList = prev.commissionRewards || [];

          const target = farmersList.find((f) => f.id === farmerId);
          if (!target) return prev;

          const newRewardId = "cr_" + Math.floor(10000 + Math.random() * 90000);
          const newReward: CommissionReward = {
            id: newRewardId,
            date: new Date().toISOString(),
            farmerName: target.name,
            activityType: activityType as any,
            activityDetails: `Simulated event referral: ${activityType} action completed by ${target.name}`,
            amountEarned: amount,
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
            notifications: [
              appendNotification(
                "Commission Disbursed! 💰",
                `Referral reward of ₦${amount.toLocaleString()} received for activity: ${activityType} by ${target.name}.`,
                "success"
              ),
              ...prev.notifications,
            ],
          };
        });
      },

      handlePromoteAgent: (newLevel) => {
        set((prev) => ({
          ...prev,
          agentLevel: newLevel,
          agentRanking: Math.max(1, (prev.agentRanking || 8) - 2),
          notifications: [
            appendNotification(
              "Agent Tier Promoted! 🏆",
              `Congratulations! You have been certified as a ${newLevel}. Your higher multipliers are now fully active.`,
              "success"
            ),
            ...prev.notifications,
          ],
        }));
      },
    }),
    {
      name: LOCAL_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      // Persist only the domain state slices, not the action functions.
      partialize: (s): FarmerAppState => ({
        walletBalance: s.walletBalance,
        walletTransactions: s.walletTransactions,
        membership: s.membership,
        membershipHistory: s.membershipHistory,
        flexSaveBalance: s.flexSaveBalance,
        flexSaveAccruedInterest: s.flexSaveAccruedInterest,
        targetGoals: s.targetGoals,
        fixedLocks: s.fixedLocks,
        harvestPlans: s.harvestPlans,
        shares: s.shares,
        bookings: s.bookings,
        contributionGroups: s.contributionGroups,
        notifications: s.notifications,
        serviceCategories: s.serviceCategories,
        serviceBookings: s.serviceBookings,
        products: s.products,
        orders: s.orders,
        cart: s.cart,
        agentLevel: s.agentLevel,
        registeredFarmers: s.registeredFarmers,
        commissionRewards: s.commissionRewards,
        agentRanking: s.agentRanking,
      }),
      // On rehydrate, back-fill any newly-added slices missing from an older
      // persisted shape (mirrors App.tsx's old useState initializer guards).
      merge: (persisted, current) => {
        const p = (persisted || {}) as Partial<FarmerAppState>;
        const merged = { ...current, ...p } as AppStore;
        if (!merged.serviceCategories || merged.serviceCategories.length === 0) {
          merged.serviceCategories = DEFAULT_SERVICE_CATEGORIES;
        }
        if (!merged.serviceBookings || merged.serviceBookings.length === 0) {
          merged.serviceBookings = DEFAULT_SERVICE_BOOKINGS;
        }
        if (!merged.products || merged.products.length === 0) {
          merged.products = DEFAULT_PRODUCTS;
        }
        if (!merged.orders || merged.orders.length === 0) {
          merged.orders = DEFAULT_ORDERS;
        }
        if (!merged.cart) {
          merged.cart = [];
        }
        return merged;
      },
    }
  )
);
