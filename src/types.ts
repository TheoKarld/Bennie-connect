/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type MembershipTierStr = "Bronze" | "Silver" | "Gold" | "Platinum";

export interface MembershipInfo {
  tier: MembershipTierStr;
  cardNumber: string;
  joinDate: string;
  expiryDate: string;
  benefits: string[];
  cost: number; // Annual subscription fee in NGN
}

export interface MembershipHistoryItem {
  id: string;
  date: string;
  action: string; // e.g., "Upgraded to Gold", "Renewed Subscription"
  amount: number;
}

export type PaymentGatewayType = "Paystack" | "Flutterwave" | "Monnify";

export type TransactionType = "deposit" | "withdraw" | "transfer" | "savings_transfer" | "share_purchase" | "share_sale" | "dividend_payment" | "membership_fee";

export interface WalletTransaction {
  id: string;
  date: string;
  type: TransactionType;
  amount: number;
  description: string;
  gateway?: PaymentGatewayType;
  status: "success" | "pending" | "failed";
}

// Savings Sub-structures
export interface TargetSavingGoal {
  id: string;
  title: string;
  targetAmount: number;
  currentAmount: number;
  startDate: string;
  endDate: string;
  category: string; // e.g. "Tractor", "Fertilizer", "Farmland Acquisition", "Solar Irrigation"
  interestRate: number; // e.g., 11.5% APY
  status: "ongoing" | "completed" | "withdrawn";
}

export interface FixedSaveLock {
  id: string;
  amount: number;
  startDate: string;
  lockedUntil: string;
  interestRate: number; // e.g., 14.0% APY
  status: "locked" | "matured" | "withdrawn";
  accumulatedInterest: number;
  autoRenew: boolean;
}

export interface HarvestSavePlan {
  id: string;
  title: string;
  cropType: string; // e.g. "Maize", "Cocoa", "Yam", "Cassava"
  targetSeason: string; // e.g. "Dry Season 2026", "Rainy Harvest Q4 2026"
  amountSaved: number;
  releaseDate: string;
  interestRate: number; // e.g., 12.5% APY
  status: "active" | "harvested";
}

// Cooperative Shares
export interface ShareTransaction {
  id: string;
  date: string;
  type: "buy" | "sell";
  sharesCount: number;
  pricePerShare: number;
  totalAmount: number;
}

export interface SharePortfolio {
  sharesOwned: number;
  currentSharePrice: number; // in NGN/Share
  bookValue: number; // Cost basis
  totalDividendsEarned: number;
  annualReturnsRate: number; // percentage
  history: ShareTransaction[];
  priceTrend: { date: string; price: number }[];
}

// Cooperatives Services & Bookings
export interface AgriBooking {
  id: string;
  serviceName: string;
  bookingDate: string;
  timeSlot: string;
  status: "pending" | "assigned" | "in_progress" | "completed" | "cancelled";
  cost: number;
  description: string;
  equipmentType: "Tractors" | "Harvesters" | "Planters" | "Threshers" | "Irrigation Systems" | "Drone Sprayers" | "Fertigation Drones" | "Transport Trucks";
  location: string;
  acreage: number;
  depositPaid: number;
  operatorName?: string;
  operatorPhone?: string;
  equipmentPlate?: string;
  distanceInKm?: number;
  providerAccepted?: boolean;
  completionEvidence?: {
    comment: string;
    imageUrl?: string;
    completedAt: string;
  };
  farmerRating?: number;
  farmerRatingComment?: string;
  gpsTrack?: { lat: number; lng: number }[];
  currentGpsPos?: { lat: number; lng: number };
}

// Contribution Groups (Esusu / Ajo style)
export interface ContributionGroup {
  id: string;
  name: string;
  description: string;
  memberCount: number;
  cycleAmount: number; // NGN per month/week
  currentPool: number;
  totalPayoutPool: number;
  nextPayoutDate: string;
  userRank: string; // e.g. "Slot 5 / 12"
  hasJoined: boolean;
  frequency?: "weekly" | "monthly";
  members?: string[];
  chatHistory?: { id: string; sender: string; avatar: string; message: string; time: string; isUser?: boolean; system?: boolean }[];
  votes?: { id: string; proposal: string; yesVotes: number; noVotes: number; totalSlots: number; userVoted?: "yes" | "no"; status: "active" | "passed" | "rejected" }[];
  attendance?: { date: string; title: string; presentCount: number; userStatus: "present" | "absent" | "excused" | "pending" }[];
  savingHistory?: { date: string; amount: number; memberName: string }[];
  activePayoutSlot?: number;
  maxSlots?: number;
  repaymentConsistency?: number; // percentage (e.g., 95%)
}

export interface FarmerNotification {
  id: string;
  date: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "alert";
  isRead: boolean;
}

// --- Agricultural Services Marketplace Types ---
export type ServiceCategoryName = 
  | "Soil Testing"
  | "Farm Mapping"
  | "Precision Agriculture (IOT sensors)"
  | "Drone Services"
  | "Farm Consultancy"
  | "Equipment Repairs"
  | "Greenhouse Design"
  | "Greenhouse Construction"
  | "Irrigation Installation"
  | "Data Analytics"
  | "Farm Auditing"
  | "Farm Insurance"
  | "Agricultural Training";

export interface ServiceReview {
  id: string;
  farmerName: string;
  rating: number;
  comment: string;
  date: string;
}

export interface ServiceCategory {
  id: string;
  name: ServiceCategoryName;
  description: string;
  pricePerUnit: number; // in NGN
  unit: string; // e.g. "per sample", "per hectare", "per node", "per flight", "per hour", "per plan", "per project", "per course"
  rating: number;
  reviews: ServiceReview[];
}

export interface ServiceBooking {
  id: string;
  serviceName: ServiceCategoryName;
  bookingDate: string;
  farmerName: string;
  farmerLocation: string;
  status: "pending" | "confirmed" | "completed" | "cancelled";
  totalCost: number;
  notes?: string;
  paymentStatus: "unpaid" | "paid";
  rating?: number;
  reviewComment?: string;
  createdAt: string;
}

// --- Agricultural Marketplace Types ---
export type ProductCategoryName =
  | "Seeds"
  | "Fertilizers"
  | "Agrochemicals"
  | "Farm Equipment"
  | "Livestock Inputs"
  | "Irrigation Equipment"
  | "Greenhouse Materials"
  | "Farm Produce";

export interface Product {
  id: string;
  name: string;
  category: ProductCategoryName;
  price: number; // in NGN
  unit: string; // e.g. "50kg Bag", "Litre Bottle", "Unit", "Packet"
  stock: number;
  merchantId: string;
  merchantName: string;
  description: string;
  imageUrl?: string;
}

export interface CartItem {
  id: string; // cart item entry id
  productId: string;
  quantity: number;
}

export interface ProductOrder {
  id: string;
  farmerId: string;
  farmerName: string;
  deliveryAddress: string;
  items: {
    productId: string;
    productName: string;
    quantity: number;
    priceAtPurchase: number;
  }[];
  totalAmount: number;
  orderDate: string;
  status: "pending" | "processing" | "shipped" | "delivered" | "cancelled";
  deliveryDate?: string;
}

export type AgentLevel = "Bronze Agent" | "Silver Agent" | "Gold Agent" | "Platinum Agent";

export interface RegisteredFarmer {
  id: string;
  name: string;
  phone: string;
  location: string;
  identityType: "NIN" | "BVN" | "Voters Card" | "National ID";
  identityNumber: string;
  kycDocUrl?: string;
  kycStatus: "Pending" | "Verified" | "Rejected";
  dateRegistered: string;
  membershipStatus: "Inactive" | "Bronze" | "Silver" | "Gold" | "Platinum";
}

export interface CommissionReward {
  id: string;
  date: string;
  farmerName: string;
  activityType: "Farmer Registration" | "Membership Upgrade" | "Savings Deposit" | "Equipment Booking" | "Marketplace Purchase";
  activityDetails: string;
  amountEarned: number;
}

export interface FarmerAppState {
  walletBalance: number;
  walletTransactions: WalletTransaction[];
  membership: MembershipInfo;
  membershipHistory: MembershipHistoryItem[];
  flexSaveBalance: number;
  flexSaveAccruedInterest: number;
  targetGoals: TargetSavingGoal[];
  fixedLocks: FixedSaveLock[];
  harvestPlans: HarvestSavePlan[];
  shares: SharePortfolio;
  bookings: AgriBooking[];
  contributionGroups: ContributionGroup[];
  notifications: FarmerNotification[];
  // Added for Modules 4 & 5
  serviceCategories?: ServiceCategory[];
  serviceBookings?: ServiceBooking[];
  products?: Product[];
  orders?: ProductOrder[];
  cart?: CartItem[];
  // Added for Module 7: Agent System
  agentLevel?: AgentLevel;
  registeredFarmers?: RegisteredFarmer[];
  commissionRewards?: CommissionReward[];
  agentRanking?: number;
}
