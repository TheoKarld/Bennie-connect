import { ServiceCategory, Product, ServiceBooking, ProductOrder } from "./types";

export const DEFAULT_SERVICE_CATEGORIES: ServiceCategory[] = [
  {
    id: "sc_soil",
    name: "Soil Testing",
    description: "Complete soil chemistry, structure, and nutrient analysis (NPK, pH, organic matter) with custom fertilizer recommendations.",
    pricePerUnit: 12000,
    unit: "per sample",
    rating: 4.8,
    reviews: [
      { id: "rev_s1", farmerName: "Kamilu Isa", rating: 5, comment: "Incredible soil diagnostic. Saved me thousands on fertilizer by identifying high nitrogen soils.", date: "2026-05-12" },
      { id: "rev_s2", farmerName: "Grace Adeoye", rating: 4.5, comment: "Clear and straightforward breakdown. Ready in 3 days.", date: "2026-05-18" }
    ]
  },
  {
    id: "sc_mapping",
    name: "Farm Mapping",
    description: "Centimeter-accurate GIS farm boundary mapping and terrain elevation analysis for crop planning.",
    pricePerUnit: 8000,
    unit: "per hectare",
    rating: 4.7,
    reviews: [
      { id: "rev_m1", farmerName: "Ibrahim Shehu", rating: 5, comment: "High quality map. Extremely helpful to confirm actual size or drainage patterns.", date: "2026-05-20" }
    ]
  },
  {
    id: "sc_precision",
    name: "Precision Agriculture (IOT sensors)",
    description: "Deployment of wireless cellular-linked soil moisture, salinity, and temperature sensors for optimized crop health.",
    pricePerUnit: 25000,
    unit: "per node",
    rating: 4.9,
    reviews: [
      { id: "rev_p1", farmerName: "Musa Haruna", rating: 5, comment: "The IoT sensors help me regulate my drip system over the web. Pure magic.", date: "2026-05-14" }
    ]
  },
  {
    id: "sc_drone",
    name: "Drone Services",
    description: "Multispectral crop health drone scans, weed mapping, and precision aerial spray applications.",
    pricePerUnit: 15000,
    unit: "per hectare",
    rating: 4.6,
    reviews: [
      { id: "rev_d1", farmerName: "Tunde Alabi", rating: 4, comment: "Fast drone spray. Excellent coverage over my rice farm.", date: "2026-05-22" }
    ]
  },
  {
    id: "sc_consultancy",
    name: "Farm Consultancy",
    description: "One-on-one professional agronomy consultations on crop selection, disease outbreaks, or productivity diagnostics.",
    pricePerUnit: 10000,
    unit: "per hour",
    rating: 4.8,
    reviews: [
      { id: "rev_c1", farmerName: "Zainab Umar", rating: 5, comment: "Wonderful Agronomist session. Helped identify root rot causing issues early.", date: "2026-05-25" }
    ]
  },
  {
    id: "sc_repairs",
    name: "Equipment Repairs",
    description: "On-site mechanical diagnostics and repair services for tractors, implements, tillers, and processing machinery.",
    pricePerUnit: 15000,
    unit: "per callout",
    rating: 4.5,
    reviews: [
      { id: "rev_r1", farmerName: "Sani Kalla", rating: 4, comment: "Fixed my tractor pump within 2 hours. Very professional.", date: "2026-05-29" }
    ]
  },
  {
    id: "sc_greenhouse_design",
    name: "Greenhouse Design",
    description: "Professional structural engineered blueprint layouts for modern shade-house or micro-climate greenhouses.",
    pricePerUnit: 40000,
    unit: "per plan",
    rating: 4.7,
    reviews: []
  },
  {
    id: "sc_greenhouse_construction",
    name: "Greenhouse Construction",
    description: "Complete physical setup of metal or wood arch greenhouse structures with high-quality netting and sheet fittings.",
    pricePerUnit: 350000,
    unit: "per structure",
    rating: 4.9,
    reviews: [
      { id: "rev_gc1", farmerName: "Yusuf Kazaure", rating: 5, comment: "Top quality greenhouse. Highly recommended structure.", date: "2026-05-15" }
    ]
  },
  {
    id: "sc_irrigation",
    name: "Irrigation Installation",
    description: "Laying custom gravity or solar pump drip irrigation lines with master sand-filters and branch manifolds.",
    pricePerUnit: 120000,
    unit: "per setup",
    rating: 4.8,
    reviews: []
  },
  {
    id: "sc_analytics",
    name: "Data Analytics",
    description: "Advanced seasonal yield modeling, predictive market risk analysis, and chemical application charts.",
    pricePerUnit: 25000,
    unit: "per crop analysis",
    rating: 4.4,
    reviews: []
  },
  {
    id: "sc_auditing",
    name: "Farm Auditing",
    description: "Formal sustainability and financial audits for compliance tracking, global farm certifications (GAP), and loan applications.",
    pricePerUnit: 50000,
    unit: "per audit",
    rating: 4.7,
    reviews: []
  },
  {
    id: "sc_insurance",
    name: "Farm Insurance",
    description: "Cooperative-backed agricultural index insurance package covering dry droughts, excessive rain, or pest infestations.",
    pricePerUnit: 18000,
    unit: "per season hectare",
    rating: 4.6,
    reviews: []
  },
  {
    id: "sc_training",
    name: "Agricultural Training",
    description: "Intense hand-on training sessions regarding modern organic composting, pest control, and business bookkeeping.",
    pricePerUnit: 5000,
    unit: "per module",
    rating: 4.9,
    reviews: [
      { id: "rev_t1", farmerName: "Amina Bello", rating: 5, comment: "Extremely insightful organic fertilizer preparation process.", date: "2026-05-10" }
    ]
  }
];

export const DEFAULT_PRODUCTS: Product[] = [
  {
    id: "p_seeds_1",
    name: "Hybrid Disease-Resistant Maize Seeds (Zea mays)",
    category: "Seeds",
    price: 18500,
    unit: "10kg Bag",
    stock: 45,
    merchantId: "merch_bennie",
    merchantName: "Bennie Agro Seeds",
    description: "High-yielding (up to 7 tons per hectare) drought-tolerant hybrid seeds certified for high germination rate."
  },
  {
    id: "p_seeds_gf",
    name: "Premium Rice Paddy Seeds (Faro 44)",
    category: "Seeds",
    price: 12000,
    unit: "25kg Bag",
    stock: 30,
    merchantId: "merch_coop",
    merchantName: "Coop Input Reserve",
    description: "Ideal for wetland alluvial soil. Rapid tillering and robust blast-disease resistance."
  },
  {
    id: "p_fert_1",
    name: "Granular Fertilizer NPK 15:15:15",
    category: "Fertilizers",
    price: 32000,
    unit: "50kg Bag",
    stock: 80,
    merchantId: "merch_coop",
    merchantName: "Coop Input Reserve",
    description: "Standard balanced nitrogen, phosphorus, and potassium fertilizer ideal for cereal crops, tubers, and vegetables."
  },
  {
    id: "p_chem_1",
    name: "Broad-Spectrum Glyphosate Herbicide",
    category: "Agrochemicals",
    price: 4500,
    unit: "1L Bottle",
    stock: 120,
    merchantId: "merch_biochem",
    merchantName: "BioChem Distributors",
    description: "Post-emergence herbicide for non-selective annual and perennial weed control in fields."
  },
  {
    id: "p_eq_1",
    name: "Manual Direct-Push Single Row Seed Planter",
    category: "Farm Equipment",
    price: 38000,
    unit: "Unit",
    stock: 15,
    merchantId: "merch_bennie",
    merchantName: "Bennie Agro Engineering",
    description: "A simple mechanical row planter with seed plates for maize, beans, groundnuts, or cowpea."
  },
  {
    id: "p_livestock_1",
    name: "High Pro Concentrate Layer Poultry Feed",
    category: "Livestock Inputs",
    price: 14500,
    unit: "25kg Bag",
    stock: 60,
    merchantId: "merch_coop",
    merchantName: "Coop Input Reserve",
    description: "Premium feed formulation for high body retention and continuous bright yellow egg production."
  },
  {
    id: "p_irrig_1",
    name: "Gravity Drip Irrigation Starter Kit (0.5 Acre)",
    category: "Irrigation Equipment",
    price: 75000,
    unit: "Set",
    stock: 10,
    merchantId: "merch_bennie",
    merchantName: "Bennie Agro Engineering",
    description: "Includes header filter, lateral 16mm tubes, drip connectors, and end valves. Ready to install."
  },
  {
    id: "p_greenhouse_1",
    name: "UV-Stabilized Polyethylene Greenhouse Film (200 Micron)",
    category: "Greenhouse Materials",
    price: 95000,
    unit: "Roll (10m x 4m)",
    stock: 8,
    merchantId: "merch_vanguard",
    merchantName: "Vanguard Sheets Ltd",
    description: "High light-transmission, anti-drip, and dust-resistant sheet for greenhouse protection."
  },
  {
    id: "p_produce_1",
    name: "Fresh Hand-Picked Yellow Habanero Peppers",
    category: "Farm Produce",
    price: 15000,
    unit: "30kg Basket",
    stock: 12,
    merchantId: "merch_shola_farms",
    merchantName: "Shola Organic Farms",
    description: "Freshly harvested under cooperative sorting standards. High spice heat content."
  }
];

export const DEFAULT_SERVICE_BOOKINGS: ServiceBooking[] = [
  {
    id: "sb_1001",
    serviceName: "Soil Testing",
    bookingDate: "2026-06-15",
    farmerName: "Aliyu (You)",
    farmerLocation: "Kano State Maize Hub, Sector A3",
    status: "confirmed",
    totalCost: 12000,
    paymentStatus: "paid",
    createdAt: "2026-06-01T12:00:00Z"
  }
];

export const DEFAULT_ORDERS: ProductOrder[] = [
  {
    id: "ord_2001",
    farmerId: "aliyu_coop",
    farmerName: "Aliyu (You)",
    deliveryAddress: "Kano State Maize Hub, Sector A3",
    items: [
      {
        productId: "p_seeds_1",
        productName: "Hybrid Disease-Resistant Maize Seeds (Zea mays)",
        quantity: 2,
        priceAtPurchase: 18500
      },
      {
        productId: "p_fert_1",
        productName: "Granular Fertilizer NPK 15:15:15",
        quantity: 1,
        priceAtPurchase: 32000
      }
    ],
    totalAmount: 69000,
    orderDate: "2026-06-01T14:00:00Z",
    status: "processing"
  }
];
