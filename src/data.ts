/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  FarmerAppState, 
  MembershipTierStr,
  ServiceCategory,
  Product,
  ServiceBooking,
  ProductOrder,
  CartItem
} from "./types";

export const MEMBERSHIP_TIERS: Record<MembershipTierStr, { name: string; cost: number; benefits: string[]; color: string; badgeBg: string }> = {
  Bronze: {
    name: "Bronze",
    cost: 0,
    benefits: [
      "Access to Flex Save (Withdraw anytime)",
      "General crop pricing updates via portal",
      "Standard cooperative newsletters",
      "Access to basic booking tools"
    ],
    color: "text-amber-700 border-amber-600 bg-amber-50",
    badgeBg: "bg-amber-100 text-amber-900"
  },
  Silver: {
    name: "Silver",
    cost: 15000, // NGN per year
    benefits: [
      "Everything in Bronze",
      "5% discounts on tractor & processing service bookings",
      "Access to Target Save & Seasonal Harvest Save",
      "Purchase up to 2,000 Cooperative Shares",
      "Ajo/Esusu Contribution Group access"
    ],
    color: "text-slate-500 border-slate-400 bg-slate-50",
    badgeBg: "bg-slate-100 text-slate-800"
  },
  Gold: {
    name: "Gold",
    cost: 35000,
    benefits: [
      "Everything in Silver",
      "10% discounts on all input items & equipment rentals",
      "Unrestricted Cooperative Share capacity (Buy/Sell)",
      "Priority equipment booking slots",
      "Free seasonal agronomy report & soil check guide",
      "Semi-annual dividend priority payouts"
    ],
    color: "text-amber-500 border-amber-400 bg-amber-50",
    badgeBg: "bg-gradient-to-r from-amber-400 to-yellow-500 text-white"
  },
  Platinum: {
    name: "Platinum",
    cost: 75000,
    benefits: [
      "Everything in Gold",
      "Maximum priority access to machinery (immediate dispatch)",
      "20% off storage silo & processing services",
      "Dedicated Cooperative Account Relationship Manager",
      "Zero-fee transfers within the wallet system",
      "Special invitations to annual farm investments & stakeholder meetings"
    ],
    color: "text-violet-600 border-violet-500 bg-violet-50",
    badgeBg: "bg-gradient-to-r from-violet-600 to-indigo-600 text-white"
  }
};

export const INITIAL_APP_STATE: FarmerAppState = {
  walletBalance: 184500, // ₦184,500.00
  walletTransactions: [
    {
      id: "tx_0a12",
      date: "2026-05-30T10:30:00Z",
      type: "deposit",
      amount: 50000,
      description: "Wallet Funding via Flutterwave WebPay",
      gateway: "Flutterwave",
      status: "success"
    },
    {
      id: "tx_0b34",
      date: "2026-05-28T14:22:00Z",
      type: "transfer",
      amount: 15000,
      description: "Transfer to member: Adebayo Farms (ID: #4051)",
      status: "success"
    },
    {
      id: "tx_0c56",
      date: "2026-05-25T08:00:00Z",
      type: "membership_fee",
      amount: 35000,
      description: "Gold Annual Tier Subscription Renewal",
      status: "success"
    },
    {
      id: "tx_0d78",
      date: "2026-05-20T17:45:00Z",
      type: "dividend_payment",
      amount: 18400,
      description: "Cooperative Q1 Share Dividend Distribution",
      status: "success"
    },
    {
      id: "tx_0e90",
      date: "2026-05-15T11:12:00Z",
      type: "withdraw",
      amount: 20000,
      description: "Bank Payout to Access Bank - ****8291",
      gateway: "Monnify",
      status: "success"
    }
  ],
  membership: {
    tier: "Silver",
    cardNumber: "COOP-FARM-9062",
    joinDate: "2025-01-14",
    expiryDate: "2027-01-14",
    cost: 15000,
    benefits: MEMBERSHIP_TIERS.Silver.benefits
  },
  membershipHistory: [
    {
      id: "mh_1",
      date: "2026-01-14",
      action: "Renewed Silver Membership Tier",
      amount: 15000
    },
    {
      id: "mh_3",
      date: "2025-01-14",
      action: "Initial Registration - Bronze Tier",
      amount: 0
    }
  ],
  flexSaveBalance: 420000, // ₦420,000.00 (Matches screenshot savings)
  flexSaveAccruedInterest: 3820,
  targetGoals: [
    {
      id: "tg_1",
      title: "Self-Propelled Tractor Rental",
      targetAmount: 300000,
      currentAmount: 180000,
      startDate: "2026-02-01",
      endDate: "2026-07-30",
      category: "Tractor",
      interestRate: 11.5,
      status: "ongoing"
    },
    {
      id: "tg_2",
      title: "NPK Premium Fertilizer Batch Q3",
      targetAmount: 85000,
      currentAmount: 85000,
      startDate: "2026-04-10",
      endDate: "2026-05-25",
      category: "Fertilizer",
      interestRate: 10.0,
      status: "completed"
    }
  ],
  fixedLocks: [],
  harvestPlans: [],
  shares: {
    sharesOwned: 120, // Matches screenshot 120 shares
    currentSharePrice: 500, // 120 * 500 = 60000
    bookValue: 60000, // Cost basis
    totalDividendsEarned: 35600,
    annualReturnsRate: 18.2,
    history: [
      {
        id: "st_1",
        date: "2026-04-12T09:00:00Z",
        type: "buy",
        sharesCount: 120,
        pricePerShare: 500,
        totalAmount: 60000
      }
    ],
    priceTrend: [
      { date: "Oct 2025", price: 410 },
      { date: "Dec 2025", price: 435 },
      { date: "Feb 2026", price: 450 },
      { date: "Apr 2026", price: 485 },
      { date: "Jun 2026", price: 500 }
    ]
  },
  bookings: [
    {
      id: "bk_1",
      serviceName: "Massey Ferguson 385 Tractor",
      bookingDate: "2026-06-01",
      timeSlot: "Morning (8:00 AM - 12:00 PM)",
      status: "in_progress",
      cost: 45000,
      depositPaid: 15000,
      description: "Primary Ploughing Service",
      equipmentType: "Tractors",
      location: "Kano State Maize Hub, Sector A3",
      acreage: 2.5,
      operatorName: "Musa Danjuma",
      operatorPhone: "+234 803 123 4567",
      equipmentPlate: "KNF-948-TA",
      distanceInKm: 3.2,
      providerAccepted: true,
      currentGpsPos: { lat: 12.025, lng: 8.512 },
      gpsTrack: [
        { lat: 12.021, lng: 8.510 },
        { lat: 12.023, lng: 8.511 },
        { lat: 12.025, lng: 8.512 }
      ]
    },
    {
      id: "bk_2",
      serviceName: "John Deere W330 Harvester",
      bookingDate: "2026-06-02",
      timeSlot: "All Day Session",
      status: "assigned",
      cost: 85000,
      depositPaid: 25000,
      description: "Wheat Harvesting & Header Service",
      equipmentType: "Harvesters",
      location: "Gombe Valley Farms, Plot 14",
      acreage: 5.0,
      operatorName: "Ibrahim Shehu",
      operatorPhone: "+234 812 765 4321",
      equipmentPlate: "GMB-330-HV",
      distanceInKm: 6.8,
      providerAccepted: true,
      currentGpsPos: { lat: 10.284, lng: 11.168 },
      gpsTrack: [
        { lat: 10.281, lng: 11.166 },
        { lat: 10.284, lng: 11.168 }
      ]
    },
    {
      id: "bk_3",
      serviceName: "Bennie Agro Crop Thresher",
      bookingDate: "2026-06-05",
      timeSlot: "Afternoon Run",
      status: "pending",
      cost: 25000,
      depositPaid: 5000,
      description: "Mobile Maize & Sorghum Threshing",
      equipmentType: "Threshers",
      location: "Zaria Cooperatives Outpost, Sector B",
      acreage: 1.8
    }
  ],
  contributionGroups: [
    {
      id: "cg_1",
      name: "Adashe — Kano Rice Circle",
      description: "Next payout to you in 3 weeks",
      memberCount: 12,
      cycleAmount: 30000,
      currentPool: 360000,
      totalPayoutPool: 360000, // Total pooled per round
      nextPayoutDate: "In 3 weeks",
      userRank: "Slot #5",
      hasJoined: true,
      frequency: "monthly",
      activePayoutSlot: 4,
      maxSlots: 12,
      repaymentConsistency: 98,
      members: [
        "Musa Haruna",
        "Amina Bello",
        "Ibrahim Kabiru (Paid Slot #4)",
        "Sani Kalla",
        "Aliyu (You - Slot #5)",
        "Zainab Umar",
        "Fatima Abubakar",
        "Yusuf Kazaure",
        "Balarabe Isa",
        "Kabir Yahaya",
        "Rabi'u Gwarzo",
        "Hassana Wada"
      ],
      chatHistory: [
        { id: "ch_1", sender: "Musa Haruna", avatar: "MH", message: "Salam comrades, has everyone paid their contribution for this monthly round? Sani and Zainab?", time: "5 hours ago" },
        { id: "ch_2", sender: "Zainab Umar", avatar: "ZU", message: "Yes, I just completed my ₦30,000 transfer from my Coop wallet. Verification is instant!", time: "4 hours ago" },
        { id: "ch_3", sender: "System Bot", avatar: "🤖", message: "Adashe Report: Slot #4 (Ibrahim Kabiru) payout of ₦360,000 has been successfully dispersed from pool assets to his wallet.", time: "Today, 8:00 AM", system: true },
        { id: "ch_4", sender: "Ibrahim Kabiru", avatar: "IK", message: "Received! Thank you so much, my crop brothers and sisters! I can now purchase our shared tractor disc plopping gear without any bank loans.", time: "Today, 9:20 AM" }
      ],
      votes: [
        { id: "v_1", proposal: "Should we increase monthly contributions from ₦30,000 to ₦35,000 next season for an increased rotation payout?", yesVotes: 8, noVotes: 3, totalSlots: 12, userVoted: undefined, status: "active" },
        { id: "v_2", proposal: "Approve Sani Kalla's Slot #6 swap with Rabi'u Gwarzo's Slot #11 due to urgent dry locust treatment needs on Sani's maize farm.", yesVotes: 11, noVotes: 0, totalSlots: 12, userVoted: "yes", status: "passed" }
      ],
      attendance: [
        { date: "2026-05-15", title: "May Agricultural Savings Check-In", presentCount: 11, userStatus: "present" },
        { date: "2026-04-15", title: "April Seed & Machinery Verification", presentCount: 12, userStatus: "present" },
        { date: "2026-06-15", title: "Upcoming June General Adashe Review", presentCount: 0, userStatus: "pending" }
      ],
      savingHistory: [
        { date: "2026-05-15", amount: 30000, memberName: "Aliyu (You)" },
        { date: "2026-04-15", amount: 30000, memberName: "Aliyu (You)" }
      ]
    },
    {
      id: "cg_2",
      name: "Cassava Processing Esusu Fund",
      description: "Cooperative-backed group saving for localized starch processing equipment. Max 15 members.",
      memberCount: 8,
      cycleAmount: 15000,
      currentPool: 120000,
      totalPayoutPool: 225000,
      nextPayoutDate: "2026-06-25",
      userRank: "Slot #11",
      hasJoined: false,
      frequency: "weekly",
      activePayoutSlot: 1,
      maxSlots: 15,
      repaymentConsistency: 100,
      members: [
        "Musa Haruna",
        "Zainab Umar",
        "Fatima Abubakar",
        "Yusuf Kazaure",
        "Balarabe Isa",
        "Kabir Yahaya",
        "Rabi'u Gwarzo",
        "Hassana Wada"
      ],
      chatHistory: [
        { id: "ch_2_1", sender: "Zainab Umar", avatar: "ZU", message: "Comrades, we need 7 more farmers to join so we can kickoff the weekly rotating wheel. Any suggestions?", time: "3 days ago" },
        { id: "ch_2_2", sender: "Hassana Wada", avatar: "HW", message: "I talked to my cocoa neighbor, Sadiya. She says she wants to register tomorrow morning.", time: "2 days ago" }
      ],
      votes: [
        { id: "v_2_1", proposal: "Approve starch machinery hardware acquisition from Bennie Agro Engineering rather than importing standard Chinese options.", yesVotes: 8, noVotes: 0, totalSlots: 15, userVoted: undefined, status: "active" }
      ],
      attendance: [
        { date: "2026-05-28", title: "Cassava Hub Kickoff & Machine Setup", presentCount: 8, userStatus: "present" }
      ],
      savingHistory: []
    }
  ],
  notifications: [
    {
      id: "notif_1",
      date: "2026-06-01T08:00:00Z",
      title: "Dividend Paid Out!",
      message: "Congratulations! Your cooperative share dividend of ₦18,400.00 has been paid directly to your Digital Wallet.",
      type: "success",
      isRead: false
    },
    {
      id: "notif_3",
      date: "2026-05-20T10:00:00Z",
      title: "Upcoming Tractor Booking Reminder",
      message: "Friendly reminder that your Tractor Harrowing booking is confirmed for June 12, 2026.",
      type: "info",
      isRead: true
    }
  ],
  serviceCategories: [],
  serviceBookings: [],
  products: [],
  orders: [],
  cart: [],
  // Module 7 Fallbacks
  agentLevel: "Bronze Agent",
  registeredFarmers: [
    {
      id: "f_1092",
      name: "Alhaji Ibrahim",
      phone: "+234 803 122 1199",
      location: "Kano State Maiduguri Road",
      identityType: "NIN",
      identityNumber: "NIN-291039-11",
      kycDocUrl: "https://example.com/kyc1.jpg",
      kycStatus: "Verified",
      dateRegistered: "2026-05-10",
      membershipStatus: "Gold"
    },
    {
      id: "f_4301",
      name: "Binta Umar",
      phone: "+234 812 233 4455",
      location: "Zaria Outpost Area C",
      identityType: "BVN",
      identityNumber: "BVN-90218-12",
      kycDocUrl: "https://example.com/kyc2.jpg",
      kycStatus: "Pending",
      dateRegistered: "2026-05-24",
      membershipStatus: "Silver"
    },
    {
      id: "f_8819",
      name: "Suleiman Yusuf",
      phone: "+234 907 766 5544",
      location: "Gombe Valley Block 4",
      identityType: "Voters Card",
      identityNumber: "VT-1092-A2",
      kycDocUrl: "https://example.com/kyc3.jpg",
      kycStatus: "Verified",
      dateRegistered: "2026-05-28",
      membershipStatus: "Bronze"
    }
  ],
  commissionRewards: [
    {
      id: "cr_1",
      date: "2026-05-10T12:00:00Z",
      farmerName: "Alhaji Ibrahim",
      activityType: "Farmer Registration",
      activityDetails: "Successfully verified NIN and registered farmer Alhaji Ibrahim",
      amountEarned: 2500
    },
    {
      id: "cr_2",
      date: "2026-05-12T14:30:00Z",
      farmerName: "Alhaji Ibrahim",
      activityType: "Membership Upgrade",
      activityDetails: "Earned 10% commission on Alhaji Ibrahim Gold subscription upgrade fee (₦35,000)",
      amountEarned: 3500
    },
    {
      id: "cr_3",
      date: "2026-05-15T09:15:00Z",
      farmerName: "Alhaji Ibrahim",
      activityType: "Savings Deposit",
      activityDetails: "Earned reward for Alhaji Ibrahim initiating target goal of ₦300,000",
      amountEarned: 1500
    },
    {
      id: "cr_4",
      date: "2026-05-18T16:00:00Z",
      farmerName: "Alhaji Ibrahim",
      activityType: "Equipment Booking",
      activityDetails: "Earned commission on tractor booking BK-2101",
      amountEarned: 2200
    },
    {
      id: "cr_5",
      date: "2026-05-20T11:45:00Z",
      farmerName: "Binta Umar",
      activityType: "Marketplace Purchase",
      activityDetails: "Earned 2.5% commission on premium NPK fertilizer order input purchase",
      amountEarned: 1200
    }
  ],
  agentRanking: 8
};

export const CROP_TYPES = [
  { value: "Maize", label: "Maize (Corn)" },
  { value: "Cocoa", label: "Cocoa Pods" },
  { value: "Cassava", label: "Cassava Roots" },
  { value: "Yam", label: "Yam Tubers" },
  { value: "Rice", label: "Rice Paddy" },
  { value: "Cashew", label: "Cashew Nuts" },
  { value: "Tomato", label: "Tomatoes" }
];

export const GOAL_CATEGORIES = [
  { value: "Tractor", label: "Tractor & Heavy Machinery Rental" },
  { value: "Fertilizer", label: "Fertilizers and Soil Improvers" },
  { value: "Seedlings", label: "Hybrid Seeds & Crop Seedlings" },
  { value: "Solar Irrigation", label: "Solar Water Pump & Drip Irrigation" },
  { value: "Land Buy", label: "Farmland Development & Expansion" },
  { value: "Storage Silos", label: "Storage Silos / Drying Shelves" }
];
