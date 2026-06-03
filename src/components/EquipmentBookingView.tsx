import React, { useState, useEffect } from "react";
import { 
  Compass, 
  MapPin, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  User, 
  Phone, 
  Navigation, 
  Truck, 
  CheckCircle, 
  Star, 
  DollarSign, 
  Activity, 
  Layers, 
  AlertCircle, 
  Plus, 
  ChevronRight, 
  Info,
  ShieldCheck,
  Award,
  Video,
  X,
  Map,
  Eye,
  Camera,
  Play,
  RotateCcw
} from "lucide-react";
import { FarmerAppState, AgriBooking } from "../types";

interface EquipmentBookingViewProps {
  state: FarmerAppState;
  onNavigate: (tab: string) => void;
  onAddBooking: (booking: Omit<AgriBooking, "id">) => void;
  onUpdateBookingStatus: (bookingId: string, status: AgriBooking["status"], evidence?: AgriBooking["completionEvidence"]) => void;
  onRateBooking: (bookingId: string, rating: number, comment?: string) => void;
}

// Pre-configured machinery options inspired by Hello Tractor
interface EquipmentSpec {
  type: AgriBooking["equipmentType"];
  name: string;
  manufacturer: string;
  ratePerAcre: number;
  flatRate: boolean;
  operatorNames: string[];
  operatorPhone: string;
  plateNumber: string;
  specs: string[];
  description: string;
  imageUrl: string;
}

const MACHINERY_CATALOGUE: EquipmentSpec[] = [
  {
    type: "Tractors",
    name: "Massey Ferguson 385 (85HP)",
    manufacturer: "AGCO Corporation",
    ratePerAcre: 18000,
    flatRate: false,
    operatorNames: ["Musa Danjuma", "Alhassan Lawal"],
    operatorPhone: "+234 803 123 4567",
    plateNumber: "KNF-948-TA",
    specs: ["85 Horsepower Engine", "Heavy duty disc plough attached", "Live fuel tracking enabled"],
    description: "Perfect for deep harrowing, soil preparation, and planting cycles. Rugged structure built for sub-Saharan soils.",
    imageUrl: "🚜"
  },
  {
    type: "Harvesters",
    name: "John Deere W330",
    manufacturer: "John Deere",
    ratePerAcre: 25000,
    flatRate: false,
    operatorNames: ["Ibrahim Shehu", "Bala Kabir"],
    operatorPhone: "+234 812 765 4321",
    plateNumber: "GMB-330-HV",
    specs: ["Grain loss monitoring", "5-style shake-walker separation", "Moisture sensor"],
    description: "High performance grain harvester with a clean cut header. Accelerates grain retrieval speed while reducing grain damage.",
    imageUrl: "🌾"
  },
  {
    type: "Planters",
    name: "Tillage Seed Planter 1200",
    manufacturer: "Bennie Agro Innovations",
    ratePerAcre: 12000,
    flatRate: false,
    operatorNames: ["Garba Mustapha", "Abba Idris"],
    operatorPhone: "+234 805 112 2334",
    plateNumber: "ZAR-1200-PL",
    specs: ["Pneumatic seed delivery", "Adjustable spacing", "Starter fertilizer dual-injection"],
    description: "Ensures uniform seeding depth and balanced seed-to-soil contact for maize, sorghum, and cowpea crops.",
    imageUrl: "🌱"
  },
  {
    type: "Threshers",
    name: "Ajo Mobile Crop Thresher",
    manufacturer: "Kano Engineering Coop",
    ratePerAcre: 10000,
    flatRate: false,
    operatorNames: ["Usman Jinjiri", "Salisu Bello"],
    operatorPhone: "+234 813 998 8776",
    plateNumber: "KN-THR-300",
    specs: ["Multi-grain configuration", "Self-powered generator", "Integrated packaging funnel"],
    description: "Mobile thresher unit that drives straight to your field outpost, separating grain from dry residue on the spot.",
    imageUrl: "🌾"
  },
  {
    type: "Irrigation Systems",
    name: "Solar Water Pump Station Deluxe",
    manufacturer: "SunKing Irrigation Ltd",
    ratePerAcre: 15000,
    flatRate: true,
    operatorNames: ["Nuhu Gombe", "Samson Okon"],
    operatorPhone: "+234 902 445 1122",
    plateNumber: "SOL-IRR-88A",
    specs: ["3.5kW Monocrystalline Array", "Submersible stainless steel pump", "200-meter distribution line"],
    description: "Complete off-grid pressurized water supply that eliminates diesel costs. 24-hour setup and water distribution check.",
    imageUrl: "💧"
  },
  {
    type: "Drone Sprayers",
    name: "DJI Agras T40 Crop Sprayer",
    manufacturer: "DJI Agriculture",
    ratePerAcre: 8000,
    flatRate: false,
    operatorNames: ["Yusuf Aliyu", "Kamal Sani"],
    operatorPhone: "+234 703 115 5990",
    plateNumber: "DRN-AGR-T40",
    specs: ["40-liter liquid tank", "Magnetic centrifugal atomization", "Obstacle radar navigation"],
    description: "Ultra-fast precision aerial spraying of organic pesticides, liquid fertilizer, or crop nutrients in minutes.",
    imageUrl: "🛸"
  },
  {
    type: "Fertigation Drones",
    name: "AeroSpray Smart Fertility Injector",
    manufacturer: "AeroSprayers Nigeria",
    ratePerAcre: 9500,
    flatRate: false,
    operatorNames: ["Fatima Umar", "Shehu Shagari"],
    operatorPhone: "+234 816 555 4433",
    plateNumber: "DRN-FRT-99X",
    specs: ["Multispectral crop scanner", "Differential variable spray rate", "Automated RTK landing system"],
    description: "Drones that analyze plant health dynamically, injecting localized micro-nutrients on nitrogen-deficient areas.",
    imageUrl: "🚁"
  },
  {
    type: "Transport Trucks",
    name: "Foton Ollin Cargo Carrier",
    manufacturer: "Foton Motors",
    ratePerAcre: 22000,
    flatRate: true,
    operatorNames: ["Sunday Joshua", "Mika'il Jamiu"],
    operatorPhone: "+234 809 334 1109",
    plateNumber: "ABJ-382-TR",
    specs: ["5-ton carrying capacity", "Reinforced flatbed gates", "GPS tracking enabled"],
    description: "Sturdy flatbed freight truck to lift harvested bags directly to regional processing centers or urban markets.",
    imageUrl: "🚛"
  }
];

export default function EquipmentBookingView({
  state,
  onNavigate,
  onAddBooking,
  onUpdateBookingStatus,
  onRateBooking
}: EquipmentBookingViewProps) {
  const [activeTab, setActiveTabState] = useState<"book" | "my_bookings" | "operator_portal">("book");
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);

  // Selector / Wizard Form States
  const [selectedType, setSelectedType] = useState<AgriBooking["equipmentType"]>("Tractors");
  const [farmLocation, setFarmLocation] = useState("");
  const [acreage, setAcreage] = useState<number>(2.0);
  const [bookingDate, setBookingDate] = useState("");
  const [timeSlot, setTimeSlot] = useState("Morning (8:00 AM - 12:00 PM)");

  // Acreage helper wizard
  const [isAcreageWizardOpen, setIsAcreageWizardOpen] = useState(false);
  const [calculatorWay, setCalculatorWay] = useState<"draw" | "paces" | "units">("draw");
  const [points, setPoints] = useState<{ x: number; y: number }[]>([]);
  const [paceLength, setPaceLength] = useState<number>(100);
  const [paceWidth, setPaceWidth] = useState<number>(80);
  const [numPlotUnit, setNumPlotUnit] = useState<number>(12);

  // Operator simulator portal
  const [simulatedComment, setSimulatedComment] = useState("");
  const [simulatedPhoto, setSimulatedPhoto] = useState("https://images.unsplash.com/photo-1594913785162-e678574d6ee1?w=400&auto=format&fit=crop&q=60");

  // GPS Map dynamic track simulation
  const [gpsTick, setGpsTick] = useState(0);

  const selectedSpec = MACHINERY_CATALOGUE.find(m => m.type === selectedType) || MACHINERY_CATALOGUE[0];
  const selectedBooking = state.bookings.find(b => b.id === selectedBookingId);

  // Simulating tractor icon position animation for active GPS tracking
  useEffect(() => {
    const timer = setInterval(() => {
      setGpsTick((prev) => (prev + 1) % 100);
    }, 1500);
    return () => clearInterval(timer);
  }, []);

  const formatCurrency = (val: number) => {
    return "₦" + Math.round(val).toLocaleString();
  };

  const calculateTotalCost = (spec: EquipmentSpec, acresStr: number) => {
    if (spec.flatRate) {
      return spec.ratePerAcre;
    }
    return spec.ratePerAcre * acresStr;
  };

  const handleBookingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!farmLocation.trim()) {
      alert("Please enter your farm location address or cooperative waypoint PIN.");
      return;
    }
    if (!bookingDate) {
      alert("Please select a valid scheduled service date.");
      return;
    }
    if (acreage <= 0) {
      alert("Please specify a valid acreage (cannot be zero or negative).");
      return;
    }

    const cost = calculateTotalCost(selectedSpec, acreage);
    const deposit = cost * 0.2; // 20% deposit

    if (state.walletBalance < deposit) {
      alert(`Insufficient funds in wallet! Your booking requires a 20% deposit of ${formatCurrency(deposit)}. Current balance is ${formatCurrency(state.walletBalance)}.`);
      return;
    }

    const randomOperatorIndex = Math.floor(Math.random() * selectedSpec.operatorNames.length);

    onAddBooking({
      serviceName: selectedSpec.name,
      bookingDate: bookingDate,
      timeSlot: timeSlot,
      status: "pending",
      cost: cost,
      depositPaid: deposit,
      description: selectedSpec.type,
      equipmentType: selectedSpec.type,
      location: farmLocation,
      acreage: acreage,
      operatorName: selectedSpec.operatorNames[randomOperatorIndex],
      operatorPhone: selectedSpec.operatorPhone,
      equipmentPlate: selectedSpec.plateNumber,
      distanceInKm: parseFloat((2.0 + Math.random() * 8.0).toFixed(1)),
      providerAccepted: false
    });

    // Reset Form
    setFarmLocation("");
    setBookingDate("");
    alert(`🎉 Booking Requested! A 20% deposit of ${formatCurrency(deposit)} has been secured from your digital cooperative wallet. Tractor nodes are calculating allocation indices!`);
    
    // Switch to active lists
    setActiveTabState("my_bookings");
    setSelectedBookingId(null);
  };

  // Automated estimates
  const applyDrawnAcreage = () => {
    let calcAcres = 2.4;
    if (points.length < 3) {
      alert("Please draw at least 3 corner points of your crop boundary on the satellite map grid.");
      return;
    }
    if (points.length === 3) calcAcres = 1.6;
    if (points.length === 4) calcAcres = 2.8;
    if (points.length > 4) calcAcres = 4.2;

    setAcreage(calcAcres);
    setIsAcreageWizardOpen(false);
  };

  const applyPaceAcreage = () => {
    // 1 step is approx 0.75m. Area in sqm = length steps * width steps * 0.56.
    // 1 acre = 4047 sqm.
    const sqm = paceLength * paceWidth * 0.56;
    const calcAcres = parseFloat((sqm / 4047).toFixed(2));
    if (calcAcres <= 0) {
      alert("Please set realistic stride counts.");
      return;
    }
    setAcreage(calcAcres);
    setIsAcreageWizardOpen(false);
  };

  const applyUnitPlots = () => {
    // 1 standard plot = 0.16 Acres (6 plots = ~1 Acre)
    const calcAcres = parseFloat((numPlotUnit * 0.16).toFixed(2));
    if (calcAcres <= 0) {
      alert("Plots count must be greater than 0");
      return;
    }
    setAcreage(calcAcres);
    setIsAcreageWizardOpen(false);
  };

  const clearDrawPoints = () => {
    setPoints([]);
  };

  const handleMapClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setPoints([...points, { x, y }]);
  };

  const triggerAutofillEstimate = () => {
    setFarmLocation("Kano North Agricultural Sector 5X");
    setAcreage(3.5);
    setBookingDate("2026-06-15");
  };

  // Helper rating
  const [ratingVal, setRatingVal] = useState(5);
  const [ratingComment, setRatingComment] = useState("");

  const handleRatingSubmit = (bId: string) => {
    onRateBooking(bId, ratingVal, ratingComment);
    setRatingComment("");
    alert("Thank you! Your verified operational rating has been posted to the operator index.");
  };

  return (
    <div className="space-y-6">
      
      {/* Upper branding section with inspired Hello Tractor layout */}
      <div className="bg-[#135D39] rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 bottom-0 translate-x-12 translate-y-12 opacity-10 font-sans pointer-events-none text-[150px] leading-none">🚜</div>
        <div className="absolute -top-16 -left-16 w-44 h-44 rounded-full bg-[#ECCE2A]/10 blur-xl"></div>
        
        <div className="relative flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 bg-[#ECCE2A] text-[#1A2421] px-3.5 py-1 rounded-full text-[11px] font-bold tracking-wider leading-none uppercase">
              <Compass className="w-3 h-3 animate-spin" /> Connected Hello Tractor IoT Nodes active
            </div>
            <h1 className="font-display font-bold text-2xl sm:text-3xl tracking-tight">Cooperative Machinery Booking</h1>
            <p className="text-gray-100/90 text-xs sm:text-sm max-w-xl leading-relaxed">
              Order heavy duty operators, precision smart agriculture drone fleets, and harvest machinery. Shared assets tracked dynamically on-chain with automatic operator assignment.
            </p>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={() => onNavigate("dashboard")}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition duration-200"
            >
              Back to Desk
            </button>
            <button
              onClick={triggerAutofillEstimate}
              className="px-4 py-2 bg-[#ECCE2A] hover:bg-[#d8bd1c] text-[#1A2421] rounded-xl text-xs font-bold transition duration-200"
            >
              Demo Autofill
            </button>
          </div>
        </div>

        {/* Dynamic Telemetry Stats bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-white/10">
          <div className="space-y-0.5">
            <span className="text-[10px] text-white/60 font-medium uppercase font-mono tracking-wider">Tractors Active</span>
            <div className="font-mono text-base font-bold flex items-center gap-2">
              <span className="p-1 rounded-full bg-[#ECCE2A] inline-block w-2 h-2 animate-ping"></span>
              24 Operators Online
            </div>
          </div>
          <div className="space-y-0.5">
            <span className="text-[10px] text-white/60 font-medium uppercase font-mono tracking-wider">Service Disbursed</span>
            <div className="font-mono text-base font-bold text-[#ECCE2A]">₦4,240,000</div>
          </div>
          <div className="space-y-0.5">
            <span className="text-[10px] text-white/60 font-medium uppercase font-mono tracking-wider">My Active Bookings</span>
            <div className="font-mono text-base font-bold text-white">{state.bookings.filter(b => b.status !== "completed" && b.status !== "cancelled").length} Requested</div>
          </div>
          <div className="space-y-0.5">
            <span className="text-[10px] text-white/60 font-medium uppercase font-mono tracking-wider">Coop Fuel Pool</span>
            <div className="font-mono text-base font-bold text-green-300">12,400 Liters</div>
          </div>
        </div>
      </div>

      {/* Main Panel Mode Toggles */}
      <div className="flex bg-[#E6E5DF]/60 p-1.5 rounded-2xl border border-[#E6E5DF] justify-between max-w-xl">
        <button
          onClick={() => { setActiveTabState("book"); setSelectedBookingId(null); }}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition flex items-center gap-2 cursor-pointer grow justify-center ${
            activeTab === "book" ? "bg-[#135D39] text-white shadow" : "text-[#5C6460] hover:text-[#1A2421]"
          }`}
        >
          <Plus className="w-4 h-4" /> Schedule Booking & Estimate
        </button>
        <button
          onClick={() => setActiveTabState("my_bookings")}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition flex items-center gap-2 cursor-pointer grow justify-center ${
            activeTab === "my_bookings" ? "bg-[#135D39] text-white shadow" : "text-[#5C6460] hover:text-[#1A2421]"
          }`}
        >
          <Activity className="w-4 h-4" /> Live Tracking ({state.bookings.length})
        </button>
        <button
          onClick={() => setActiveTabState("operator_portal")}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition flex items-center gap-2 cursor-pointer grow justify-center ${
            activeTab === "operator_portal" ? "bg-amber-500 text-stone-950 shadow" : "text-[#5C6460] hover:text-[#1A2421]"
          }`}
        >
          <User className="w-4 h-4" /> Operator Simulator
        </button>
      </div>

      {/* VIEW 1: BOOKING & ESTIMATION FORM */}
      {activeTab === "book" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left Column: Machinery Selection Catalog (Grid of 8 types) (lg:col-span-4) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white rounded-3xl p-5 border border-[#E6E5DF] shadow-sm">
              <h2 className="font-display font-semibold text-[#1A2421] text-lg mb-1">Select Machinery Type</h2>
              <p className="text-[#5C6460] text-xs mb-4">Choose from the pre-verified Hello Tractor fleet.</p>
              
              <div className="grid grid-cols-1 gap-2.5 max-h-[460px] overflow-y-auto pr-1">
                {MACHINERY_CATALOGUE.map((spec) => (
                  <button
                    key={spec.type}
                    type="button"
                    onClick={() => setSelectedType(spec.type)}
                    className={`p-3.5 rounded-2xl text-left border transition relative flex items-center gap-3 cursor-pointer ${
                      selectedType === spec.type 
                        ? "border-[#135D39] bg-[#135D39]/5 shadow-sm" 
                        : "border-[#E6E5DF] hover:border-[#1A2421] bg-stone-50/50"
                    }`}
                  >
                    <span className="text-3xl p-2 bg-white rounded-xl shadow-sm border border-stone-100">{spec.imageUrl}</span>
                    <div className="space-y-0.5 grow pr-4">
                      <div className="flex justify-between items-baseline gap-2">
                        <h4 className="font-bold text-[#1A2421] text-[13.5px] line-clamp-1">{spec.name}</h4>
                      </div>
                      <p className="text-[11px] text-[#5C6460] font-medium">{spec.type}</p>
                      <p className="text-xs font-mono font-bold text-[#135D39]">
                        {formatCurrency(spec.ratePerAcre)} {spec.flatRate ? "flat" : "per Acre"}
                      </p>
                    </div>
                    {selectedType === spec.type && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-[#135D39]"></span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Spec breakdown */}
            <div className="bg-[#135D39]/5 rounded-3xl p-5 border border-[#135D39]/10 space-y-3">
              <h3 className="font-bold text-[#1A2421] text-sm flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-[#135D39]" /> Verified Specifications
              </h3>
              <p className="text-xs text-[#5C6460] leading-relaxed">{selectedSpec.description}</p>
              <ul className="space-y-1 text-xs text-[#1A2421] font-medium">
                {selectedSpec.specs.map((sp, idx) => (
                  <li key={idx} className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#135D39]"></span>
                    {sp}
                  </li>
                ))}
              </ul>
              <div className="pt-2 border-t border-[#135D39]/10 flex items-center justify-between text-[11px] text-[#5C6460]">
                <span>Default Assigned Operator: <b>{selectedSpec.operatorNames[0]}</b></span>
                <span className="bg-[#135D39]/10 text-[#135D39] font-mono px-2 py-0.5 rounded-md font-bold">{selectedSpec.plateNumber}</span>
              </div>
            </div>
          </div>

          {/* Right Column: Detailed Form + Acreage size calculator (lg:col-span-8) */}
          <div className="lg:col-span-7 space-y-6">
            <form onSubmit={handleBookingSubmit} className="bg-white rounded-3xl p-6 border border-[#E6E5DF] shadow-sm space-y-5">
              <div className="flex justify-between items-center border-b border-stone-100 pb-3">
                <h3 className="font-display font-semibold text-[#1A2421] text-lg">Service Parameters</h3>
                <span className="text-[11px] font-bold text-[#135D39] bg-[#ECCE2A]/20 px-3 py-1 rounded-full">{selectedSpec.type}</span>
              </div>

              {/* Enter Farm Location */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-[#5C6460] uppercase tracking-wider block">Farm Location & Landmark</label>
                <div className="relative">
                  <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                  <input
                    type="text"
                    required
                    placeholder="Enter village name, LGA, Cooperative field block or GPS coordinate (e.g. Kano Outer, Block 12)"
                    value={farmLocation}
                    onChange={(e) => setFarmLocation(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-[#E6E5DF] focus:outline-none focus:ring-2 focus:ring-[#135D39] text-xs font-semibold text-stone-850"
                  />
                </div>
              </div>

              {/* Acreage entry with size calculator trigger */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5 relative">
                  <div className="flex justify-between items-center">
                    <label className="text-[11px] font-bold text-[#5C6460] uppercase tracking-wider block">Farm Acreage (Estimated)</label>
                    <button
                      type="button"
                      onClick={() => setIsAcreageWizardOpen(true)}
                      className="text-[#135D39] text-[11px] font-extrabold hover:underline cursor-pointer flex items-center gap-0.5"
                    >
                      📏 Need Help Estimating?
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.05"
                      min="0.1"
                      required
                      placeholder="e.g. 2.4 Acres"
                      value={acreage}
                      onChange={(e) => setAcreage(parseFloat(e.target.value) || 0)}
                      className="w-full px-4 py-3 rounded-xl border border-[#E6E5DF] focus:outline-none focus:ring-2 focus:ring-[#135D39] text-xs font-semibold text-stone-850"
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-stone-400 font-mono">Acres</span>
                  </div>
                </div>

                {/* Date select */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-[#5C6460] uppercase tracking-wider block">Service Execution Date</label>
                  <div className="relative">
                    <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
                    <input
                      type="date"
                      required
                      value={bookingDate}
                      onChange={(e) => setBookingDate(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-[#E6E5DF] focus:outline-none focus:ring-2 focus:ring-[#135D39] text-xs font-semibold text-stone-850"
                    />
                  </div>
                </div>
              </div>

              {/* Time slot Choice */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-[#5C6460] uppercase tracking-wider block">Preferred Daily Timeframe</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {[
                    "Morning (8:00 AM - 12:00 PM)",
                    "Afternoon (12:00 PM - 4:00 PM)",
                    "Evening Dust (4:00 PM - 8:00 PM)",
                    "All-Day Session"
                  ].map((slot) => (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => setTimeSlot(slot)}
                      className={`px-3 py-2.5 rounded-xl text-[11px] font-bold border transition text-center leading-tight cursor-pointer ${
                        timeSlot === slot 
                          ? "bg-[#135D39] text-white border-[#135D39]" 
                          : "bg-white text-[#5C6460] border-stone-200 hover:border-stone-400"
                      }`}
                    >
                      {slot.split(" ")[0]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cost Summary & Deposit Calculation */}
              <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/60 mt-2 space-y-3">
                <h4 className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Pricing Cost Summary (NGN)</h4>
                
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-stone-600 font-medium">
                    <span>Base rate:</span>
                    <span>{formatCurrency(selectedSpec.ratePerAcre)} / Acre</span>
                  </div>
                  <div className="flex justify-between text-xs text-stone-600 font-medium">
                    <span>Farm acreage multiplier:</span>
                    <span>× {acreage} {acreage === 1 ? "Acre" : "Acres"}</span>
                  </div>
                  
                  {state.membership.tier !== "Bronze" && (
                    <div className="flex justify-between text-xs text-[#135D39] font-semibold">
                      <span>Cooperative membership discount (10%):</span>
                      <span>- {formatCurrency(selectedSpec.ratePerAcre * acreage * 0.1)}</span>
                    </div>
                  )}

                  <div className="h-px bg-stone-200 my-2"></div>
                  
                  <div className="flex justify-between text-sm text-[#1A2421] font-bold">
                    <span>Calculated Total Cost:</span>
                    <span className="font-mono text-[#1A2421]">
                      {formatCurrency(
                        calculateTotalCost(selectedSpec, acreage) * (state.membership.tier !== "Bronze" ? 0.9 : 1.0)
                      )}
                    </span>
                  </div>

                  <div className="p-2.5 bg-[#135D39]/5 rounded-xl border border-[#135D39]/10 flex justify-between items-center mt-2.5">
                    <div className="space-y-0.5">
                      <span className="text-[10px] uppercase font-mono font-bold text-[#135D39] block">20% Immediate Security Deposit Required</span>
                      <p className="text-[11px] text-[#5C6460] leading-normal font-sans">Deducted from cooperative wallet. Remaining 80% settled post-harvest verification.</p>
                    </div>
                    <span className="text-sm font-mono font-black text-[#135D39]">
                      {formatCurrency(
                        calculateTotalCost(selectedSpec, acreage) * (state.membership.tier !== "Bronze" ? 0.9 : 1.0) * 0.2
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* Submit action */}
              <button
                type="submit"
                className="w-full py-4.5 bg-[#135D39] hover:bg-[#0f4a2d] text-white shadow-lg shadow-[#135D39]/15 font-bold rounded-xl text-xs sm:text-sm transition duration-200 flex items-center justify-center gap-2 cursor-pointer"
              >
                <DollarSign className="w-4.5 h-4.5 text-[#ECCE2A]" /> Pay Deposit & Procure Operator Dispatch
              </button>
            </form>
          </div>
        </div>
      )}

      {/* VIEW 2: VERIFIED BOOKINGS STATUS TRACKING & LIVE GPS MAP */}
      {activeTab === "my_bookings" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Active / Past Booking side list (lg:col-span-4) */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white rounded-3xl p-5 border border-[#E6E5DF] shadow-sm">
              <h3 className="font-display font-semibold text-[#1A2421] text-base mb-1">Service Reservations</h3>
              <p className="text-stone-500 text-[11px] mb-3">Click on any request to view active GPS traces & telematics.</p>
              
              <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
                {state.bookings.map((bk) => {
                  const isSelected = selectedBookingId === bk.id;
                  
                  let statusBg = "bg-amber-100 text-amber-800 border-amber-200";
                  if (bk.status === "assigned") statusBg = "bg-blue-100 text-blue-800 border-blue-200";
                  if (bk.status === "in_progress") statusBg = "bg-[#135D39]/10 text-[#135D39] border-[#135D39]/20";
                  if (bk.status === "completed") statusBg = "bg-stone-100 text-stone-700 border-stone-200";
                  if (bk.status === "cancelled") statusBg = "bg-red-100 text-red-800 border-red-200";

                  return (
                    <button
                      key={bk.id}
                      onClick={() => setSelectedBookingId(bk.id)}
                      className={`w-full p-4.5 rounded-2xl text-left border transition relative flex flex-col gap-2.5 cursor-pointer ${
                        isSelected 
                          ? "border-[#135D39] bg-[#135D39]/5 shadow" 
                          : "border-[#E6E5DF] hover:border-[#1A2421] bg-white"
                      }`}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <h4 className="font-bold text-[#1A2421] text-xs sm:text-sm line-clamp-1">{bk.serviceName}</h4>
                          <span className="text-[10px] text-stone-500 font-medium">ID: {bk.id} • {bk.location}</span>
                        </div>
                        <span className={`text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded-full border ${statusBg}`}>
                          {bk.status.replace("_", " ")}
                        </span>
                      </div>

                      <div className="flex justify-between items-center text-xs text-[#5C6460]">
                        <span>📅 {bk.bookingDate}</span>
                        <span>📏 <b>{bk.acreage} Acres</b></span>
                      </div>

                      <div className="h-px bg-stone-100 my-0.5"></div>

                      <div className="flex justify-between items-center text-[11px]">
                        <span className="font-bold text-[#1A2421]">Total Cost: {formatCurrency(bk.cost)}</span>
                        <span className="text-[#135D39] font-medium">Secured Dep: {formatCurrency(bk.depositPaid || 0)}</span>
                      </div>
                    </button>
                  );
                })}

                {state.bookings.length === 0 && (
                  <div className="text-center py-10 bg-stone-50 rounded-2xl border border-dashed border-stone-300">
                    <p className="text-stone-400 text-xs font-semibold">No equipment bookings on record.</p>
                    <button 
                      onClick={() => setActiveTabState("book")}
                      className="mt-2 text-xs font-bold text-[#135D39] hover:underline"
                    >
                      Schedule your first service 🚜
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Detailed Tracking Panel with interactive map (lg:col-span-8) */}
          <div className="lg:col-span-8">
            {selectedBooking ? (
              <div className="space-y-6">
                
                {/* Visual Map and tracking status */}
                <div className="bg-white rounded-3xl p-6 border border-[#E6E5DF] shadow-sm space-y-5">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-stone-100 pb-3">
                    <div className="space-y-0.5">
                      <span className="text-[10px] text-stone-500 font-mono tracking-wider uppercase">Hello Tractor Live IoT Tracking and Dispatch Terminal</span>
                      <h3 className="font-display font-semibold text-[#1A2421] text-lg flex items-center gap-2">
                        {selectedBooking.serviceName} <span className="text-xs px-2.5 py-0.5 bg-stone-100 text-stone-700 rounded border">Active Telematics</span>
                      </h3>
                    </div>
                    
                    {/* Status badge */}
                    <div className="text-right">
                      <span className="text-xs font-mono font-bold text-stone-500 block">Status:</span>
                      <span className="text-sm font-black text-[#135D39] uppercase tracking-wider">{selectedBooking.status.replace("_", " ")}</span>
                    </div>
                  </div>

                  {/* Operational Timeline Progress inspired by Hello Tractor workflow */}
                  <div className="grid grid-cols-4 gap-2 text-center text-xs">
                    <div className="space-y-1">
                      <div className="h-1.5 rounded-full bg-[#135D39]"></div>
                      <span className="font-semibold text-stone-800">1. Pending</span>
                      <p className="text-[9px] text-[#5C6460]">Paid Sec. Deposit</p>
                    </div>
                    <div className="space-y-1">
                      <div className={`h-1.5 rounded-full ${["assigned", "in_progress", "completed"].includes(selectedBooking.status) ? "bg-[#135D39]" : "bg-stone-200"}`}></div>
                      <span className={`font-semibold ${["assigned", "in_progress", "completed"].includes(selectedBooking.status) ? "text-stone-800" : "text-stone-400"}`}>2. Assigned</span>
                      <p className="text-[9px] text-[#5C6460]">{selectedBooking.operatorName ? "Operator ready" : "Scanning..."}</p>
                    </div>
                    <div className="space-y-1">
                      <div className={`h-1.5 rounded-full ${["in_progress", "completed"].includes(selectedBooking.status) ? "bg-[#135D39]" : "bg-stone-200"}`}></div>
                      <span className={`font-semibold ${["in_progress", "completed"].includes(selectedBooking.status) ? "text-stone-800" : "text-stone-400"}`}>3. In Progress</span>
                      <p className="text-[9px] text-[#5C6460]">Plowing field</p>
                    </div>
                    <div className="space-y-1">
                      <div className={`h-1.5 rounded-full ${selectedBooking.status === "completed" ? "bg-amber-500" : "bg-stone-200"}`}></div>
                      <span className={`font-bold ${selectedBooking.status === "completed" ? "text-amber-600" : "text-stone-400"}`}>4. Completed</span>
                      <p className="text-[9px] text-[#5C6460]">Rating available</p>
                    </div>
                  </div>

                  {/* Satellite Map Visual Tracker Component */}
                  <div className="relative h-[250px] sm:h-[300px] bg-[#1A2421] rounded-2xl overflow-hidden border border-[#E6E5DF] flex flex-col justify-between">
                    
                    {/* Simulated Satellite Image & Boundary Grid Overlay (using CSS styled background and SVGs) */}
                    <div className="absolute inset-0 opacity-40 bg-[radial-gradient(rgba(19,93,57,0.3)_1px,transparent_1px)] [background-size:16px_16px]"></div>
                    <div className="absolute top-0 left-0 w-full h-full bg-[#1A2421]/90">
                      
                      {/* SVG Grid containing field boundaries and live tracking paths */}
                      <svg width="100%" height="100%" className="absolute inset-0">
                        {/* Farm Boundary / Plotted Field */}
                        <polygon
                          points="100,50 250,50 300,180 180,220 80,150"
                          fill="rgba(19, 93, 57, 0.15)"
                          stroke="rgba(19ECE, 42, 42, 0.4)"
                          strokeWidth="2.5"
                          strokeDasharray="4 2"
                        />
                        <text x="120" y="120" fill="rgba(255,255,255,0.4)" fontSize="11" fontWeight="bold">
                          🚜 Crop Field Lot ({selectedBooking.acreage} ac)
                        </text>

                        {/* Road Network */}
                        <path
                          d="M10,240 Q150,220 280,120 T500,40"
                          fill="none"
                          stroke="rgba(255, 255, 255, 0.1)"
                          strokeWidth="6"
                        />

                        {/* Tracker path trail line */}
                        {selectedBooking.status === "in_progress" && (
                          <polyline
                            points={`100,50 ${100 + gpsTick * 1.5},${50 + gpsTick * 1.3}`}
                            fill="none"
                            stroke="#ECCE2A"
                            strokeWidth="3.5"
                            strokeLinecap="round"
                          />
                        )}

                        {/* Tractor Animated Pulsing Dot Icon */}
                        {selectedBooking.status === "in_progress" && (
                          <g transform={`translate(${100 + gpsTick * 1.5 - 10}, ${50 + gpsTick * 1.3 - 10})`}>
                            <circle cx="10" cy="10" r="10" fill="rgba(236,206,42,0.3)" className="animate-ping" />
                            <circle cx="10" cy="10" r="6" fill="#ECCE2A" />
                            <text x="-4" y="-5" fill="#ECCE2A" fontSize="9" fontWeight="black" fontFamily="mono">Moving Node</text>
                          </g>
                        )}

                        {/* Stationary Tractor Icon if assigned */}
                        {selectedBooking.status === "assigned" && (
                          <g transform="translate(100, 50)">
                            <circle cx="10" cy="10" r="8" fill="#3b82f6" className="animate-pulse" />
                            <text x="-2" y="-5" fill="#3b82f6" fontSize="9" fontWeight="bold">TRACTOR PARKED</text>
                          </g>
                        )}
                      </svg>
                    </div>

                    {/* GPS HUD Info overlays */}
                    <div className="relative p-3 flex justify-between items-start pointer-events-none">
                      <span className="text-[10px] bg-black/70 text-[#ECCE2A] font-mono px-2.5 py-1 rounded-md backdrop-blur-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span> GPS Telematics Live Stream
                      </span>
                      
                      <div className="text-right font-mono text-[9.5px] text-white/80 space-y-0.5 bg-black/60 p-2 rounded-lg backdrop-blur-xs">
                        <div>LAT: 12.025{gpsTick}1° N</div>
                        <div>LNG: 8.51268{gpsTick}° E</div>
                        <div>SPEED: {selectedBooking.status === "in_progress" ? "6.8 km/h • ACTIVE" : "0.0 km/h • IDLE"}</div>
                      </div>
                    </div>

                    <div className="relative p-3 bg-black/50 border-t border-white/10 backdrop-blur-xs flex justify-between items-center">
                      <div className="flex items-center gap-2 text-white">
                        <Compass className="w-4.5 h-4.5 text-[#ECCE2A] animate-spin" />
                        <div>
                          <p className="text-xs font-bold leading-none">Dispatcher Operator Node</p>
                          <p className="text-[10px] text-white/70">Cooperative ID: {selectedBooking.equipmentPlate || "N/A"}</p>
                        </div>
                      </div>
                      <span className="text-[10px] text-white/55 font-mono">Distance to farm: <b>{selectedBooking.distanceInKm || "3.5"} Km</b></span>
                    </div>
                  </div>

                  {/* Dispatch Operator & Vehicle details container */}
                  <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200/80 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <h4 className="text-[10px] font-black text-stone-500 uppercase tracking-wider">Operator Profile</h4>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#135D39] text-[#ECCE2A] flex items-center justify-center font-bold font-display shadow-sm">
                          {selectedBooking.operatorName ? selectedBooking.operatorName.split(" ").map(w => w[0]).join("") : "OP"}
                        </div>
                        <div>
                          <div className="font-bold text-[#1A2421] text-xs sm:text-sm">{selectedBooking.operatorName || "Scanning operators..."}</div>
                          <div className="text-[11px] text-[#5C6460] flex items-center gap-1">
                            <Phone className="w-3 h-3 text-[#135D39]" /> {selectedBooking.operatorPhone || "+234 Coop Hub"}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <h4 className="text-[10px] font-black text-stone-500 uppercase tracking-wider">Asset Logistics Specs</h4>
                      <div className="text-xs text-stone-800 space-y-1 font-medium">
                        <p>🚜 Plate Number: <span className="font-mono bg-stone-200/60 px-1.5 py-0.5 rounded text-[11px] text-[#135D39] font-bold">{selectedBooking.equipmentPlate || "Awaiting alloc."}</span></p>
                        <p>📍 Destination Landmark: <span className="text-stone-600 italic">{selectedBooking.location}</span></p>
                        <p>🌾 Secured Duty Acreage: <span className="font-bold text-[#1A2421]">{selectedBooking.acreage} Acres</span></p>
                      </div>
                    </div>
                  </div>

                  {/* Farmer Rate / Feedbacks block (If completed) */}
                  {selectedBooking.status === "completed" && (
                    <div className="p-5 rounded-2xl border border-amber-300 bg-amber-500/5 space-y-3">
                      <div className="flex items-center gap-2">
                        <Award className="w-5 h-5 text-[#135D39]" />
                        <div>
                          <h4 className="font-display font-medium text-amber-950 text-sm">Job Finished & Operator Evidence Uploaded</h4>
                          <p className="text-xs text-amber-900/80">Rate customer service satisfaction to finalize operational report verification.</p>
                        </div>
                      </div>

                      {selectedBooking.completionEvidence && (
                        <div className="p-3 bg-white rounded-xl border border-stone-200 text-xs text-stone-700 space-y-2">
                          <p className="font-bold text-stone-800">Operator Comment & Evidence Details:</p>
                          <blockquote className="italic text-stone-600/90 font-serif">"{selectedBooking.completionEvidence.comment}"</blockquote>
                          <p className="text-[10px] text-stone-500">Completed on: {selectedBooking.completionEvidence.completedAt}</p>
                        </div>
                      )}

                      {/* Rating input form if user hasn't rated yet */}
                      {selectedBooking.farmerRating === undefined ? (
                        <div className="bg-white p-4 rounded-xl border border-amber-100/60 space-y-3.5 shadow-xs">
                          <div className="flex items-center gap-2.5">
                            <span className="text-xs font-bold text-stone-700">Satisfied? Select Score:</span>
                            <div className="flex gap-1">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                  key={star}
                                  type="button"
                                  onClick={() => setRatingVal(star)}
                                  className="p-1 cursor-pointer transition transform hover:scale-110"
                                >
                                  <Star className={`w-5.5 h-5.5 ${star <= ratingVal ? "fill-amber-400 text-amber-400" : "text-stone-300"}`} />
                                </button>
                              ))}
                            </div>
                            <span className="text-xs font-mono font-bold text-amber-600 bg-amber-50 px-2.5 py-0.5 rounded-lg border border-amber-100">{ratingVal} / 5 Stars</span>
                          </div>

                          <div className="space-y-1.5">
                            <input
                              type="text"
                              value={ratingComment}
                              onChange={(e) => setRatingComment(e.target.value)}
                              placeholder="Write a quick comment about the operator's speed, friendliness, or work quality..."
                              className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-xs focus:ring-1 focus:ring-[#135D39] focus:outline-none placeholder-stone-400 font-semibold"
                            />
                          </div>

                          <button
                            onClick={() => handleRatingSubmit(selectedBooking.id)}
                            className="w-full py-2 bg-[#135D39] hover:bg-[#0f4a2d] text-white text-xs font-bold rounded-lg transition"
                          >
                            Submit Verified Rating & Release Final 80% Payment
                          </button>
                        </div>
                      ) : (
                        <div className="bg-[#135D39]/5 p-3.5 rounded-xl border border-[#135D39]/15 flex items-center gap-3">
                          <CheckCircle2 className="w-5 h-5 text-[#135D39]" />
                          <div className="space-y-0.5 text-xs">
                            <div className="font-bold text-stone-800">You rated this operator <b>{selectedBooking.farmerRating} Stars</b></div>
                            {selectedBooking.farmerRatingComment && <p className="italic text-stone-600">"{selectedBooking.farmerRatingComment}"</p>}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Actions for cancellation */}
                  {selectedBooking.status === "pending" && (
                    <div className="flex justify-start text-[11px] text-stone-500 italic">
                      ℹ️ Scheduling has been dispatched. You can cancel this booking to get a 100% immediate deposit refund prior to Operator accepting.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-3xl p-10 border border-[#E6E5DF] text-center text-stone-500 shadow-sm">
                <Compass className="w-12 h-12 mx-auto text-stone-300 mb-2 animate-bounce" />
                <h3 className="font-display font-semibold text-stone-800 text-base">No Reservation Selected</h3>
                <p className="text-xs mb-4">Please select any scheduled mechanical booking from the side-list to begin telemetry tracking.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW 3: COOPERATIVE OPERATOR SIMULATOR PORTAL */}
      {activeTab === "operator_portal" && (
        <div className="bg-white rounded-3xl p-6 border border-[#E6E5DF] shadow-sm space-y-6">
          <div className="border-b border-stone-100 pb-3 flex justify-between items-center">
            <div className="space-y-0.5">
              <span className="text-[10px] bg-amber-500/20 text-amber-900 border border-amber-300 px-3 py-1 rounded-full uppercase font-mono font-bold">Simulator Role: Agriculture Operator / Tractor Provider</span>
              <h2 className="font-display font-semibold text-[#1A2421] text-lg mt-2">Operator Job Dispatch Terminal</h2>
            </div>
            <span className="p-1 bg-amber-100 text-amber-800 font-mono text-[10px] font-bold px-2 rounded">SANDBOX MODE</span>
          </div>

          <p className="text-[#5C6460] text-xs leading-relaxed max-w-2xl">
            Simulate how the operator/provider interacts with the Hello Tractor IoT dispatch cloud. Experience the job confirmation checklist, real-time plowing execution toggles, and uploading completion receipts.
          </p>

          <div className="space-y-4">
            <h3 className="font-bold text-stone-850 text-sm uppercase tracking-wider">Current Pending Dispatch Queue</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {state.bookings.map((bk) => {
                const canAccept = bk.status === "pending";
                const canComplete = bk.status === "assigned" || bk.status === "in_progress";
                
                return (
                  <div key={bk.id} className="p-5 rounded-2xl border border-stone-200 bg-stone-50/50 space-y-4 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start gap-2 mb-2">
                        <div>
                          <span className="text-[10px] bg-[#135D39]/10 text-[#135D39] font-mono px-2 py-0.5 rounded hover:bg-opacity-80 transition">{bk.id}</span>
                          <h4 className="font-bold text-[#1A2421] text-sm mt-1">{bk.serviceName}</h4>
                          <span className="text-[10px] text-stone-500">Landmark location: {bk.location}</span>
                        </div>
                        <span className="text-[9.5px] font-mono uppercase bg-stone-200 px-2 py-0.5 rounded font-black">{bk.status}</span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 py-2 border-t border-b border-stone-100 my-1 text-center text-xs">
                        <div>
                          <span className="text-[9px] text-stone-400 font-mono block">AREA</span>
                          <span className="font-bold text-[#1A2421]">{bk.acreage} ac</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-stone-400 font-mono block">DUE CHARGE</span>
                          <span className="font-bold text-[#1A2421]">{formatCurrency(bk.cost)}</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-stone-400 font-mono block">DATE</span>
                          <span className="font-bold text-[#1A2421]">{bk.bookingDate}</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 pt-2">
                      {/* Accept job button */}
                      {canAccept && (
                        <button
                          type="button"
                          onClick={() => {
                            onUpdateBookingStatus(bk.id, "assigned");
                            alert(`Operator dispatched successfully! GPS track is initialized.`);
                          }}
                          className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition cursor-pointer shadow-sm flex items-center justify-center gap-1.5"
                        >
                          <CheckCircle className="w-4 h-4" /> Accept Job Request & Assign Unit
                        </button>
                      )}

                      {/* Start operational sweep button */}
                      {bk.status === "assigned" && (
                        <button
                          type="button"
                          onClick={() => {
                            onUpdateBookingStatus(bk.id, "in_progress");
                            alert(`Began fieldwork sweep! Drone mapping/Harrowing telemetry broadcast initialized.`);
                          }}
                          className="w-full py-2.5 bg-[#135D39] hover:bg-[#0f4a2d] text-white font-bold text-xs rounded-xl transition cursor-pointer shadow-sm flex items-center justify-center gap-1.5"
                        >
                          <Play className="w-4 h-4" /> Start Fieldwork Sweep (Plowing)
                        </button>
                      )}

                      {/* Complete job button and text comment */}
                      {bk.status === "in_progress" && (
                        <div className="space-y-3 p-3 bg-white rounded-xl border border-stone-200 shadow-inner">
                          <span className="text-[10px] text-stone-500 font-bold block">🚨 Finalize Job Report & Proof of Evidence Upload</span>
                          
                          <div className="space-y-1">
                            <label className="text-[9.5px] font-bold text-stone-400 uppercase font-mono block">Completion comment</label>
                            <input 
                              type="text"
                              value={simulatedComment}
                              onChange={(e) => setSimulatedComment(e.target.value)}
                              placeholder="e.g. Field plowed perfectly. Consistent 30cm depth."
                              className="w-full px-2.5 py-2 border rounded-lg text-xs font-semibold focus:outline-none"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[9.5px] font-bold text-stone-400 uppercase font-mono block">Visual Proof (Static Image URL/Comment)</label>
                            <div className="flex gap-1">
                              <input 
                                type="text"
                                value={simulatedPhoto}
                                onChange={(e) => setSimulatedPhoto(e.target.value)}
                                className="grow px-2.5 py-1.5 border rounded-lg text-[9px] font-mono text-stone-500"
                              />
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              if (!simulatedComment.trim()) {
                                alert("Please leave an operational completion comment.");
                                return;
                              }
                              onUpdateBookingStatus(bk.id, "completed", {
                                comment: simulatedComment,
                                imageUrl: simulatedPhoto,
                                completedAt: new Date().toLocaleDateString() + " " + new Date().toLocaleTimeString()
                              });
                              setSimulatedComment("");
                              alert("Job complete verified! Farmer has been billed the remaining 80%.");
                            }}
                            className="w-full py-2 bg-amber-500 hover:bg-amber-650 text-stone-900 font-bold text-xs rounded-xl transition cursor-pointer"
                          >
                            🚀 Finish Job & Broadcast Completion Evidence
                          </button>
                        </div>
                      )}

                      {bk.status === "completed" && (
                        <div className="p-2.5 bg-stone-100 rounded-xl border text-center text-xs text-stone-500 font-bold">
                          🎉 Job completed successfully. Verified by cooperative.
                        </div>
                      )}

                      {bk.status === "cancelled" && (
                        <div className="p-2.5 bg-red-100 rounded-xl text-center text-xs text-red-800 font-bold">
                          ❌ Job cancelled by farmer. Refund cleared.
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {state.bookings.length === 0 && (
                <div className="text-center py-6 text-stone-400 col-span-2 text-xs">
                  No active operational jobs dispatched in cooperative queue yet.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SATELLITE FIELD BOUNDARY DRAW WIZARD / PACES ESTIMATOR */}
      {isAcreageWizardOpen && (
        <div className="fixed inset-0 bg-stone-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl w-full max-w-2xl border border-stone-200 overflow-hidden shadow-2xl relative">
            
            <button
              onClick={() => setIsAcreageWizardOpen(false)}
              className="absolute right-4 top-4 p-2 rounded-full hover:bg-stone-100 text-stone-500 border border-stone-200 z-10 cursor-pointer bg-white"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="p-6 border-b border-stone-100 space-y-1.5 bg-[#135D39] text-white">
              <h3 className="font-display font-semibold text-lg flex items-center gap-2">
                📏 Farm Boundary Area Estimate Wizard
              </h3>
              <p className="text-white/80 text-xs">Easily calculate the precise crop lot size to dispatch corresponding tractors and avoid overpaying.</p>
            </div>

            {/* Sub-tabs for Calculator Type */}
            <div className="p-4 bg-stone-50 border-b border-stone-200/60 flex gap-2">
              <button
                type="button"
                onClick={() => setCalculatorWay("draw")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  calculatorWay === "draw" ? "bg-[#135D39] text-white" : "text-stone-500 hover:text-stone-850"
                }`}
              >
                <Layers className="w-3.5 h-3.5" /> Satellite Field Plotter
              </button>
              <button
                type="button"
                onClick={() => setCalculatorWay("paces")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  calculatorWay === "paces" ? "bg-[#135D39] text-white" : "text-stone-500 hover:text-[#1A2421]"
                }`}
              >
                <Compass className="w-3.5 h-3.5" /> Pacing Out Steps Math
              </button>
              <button
                type="button"
                onClick={() => setCalculatorWay("units")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  calculatorWay === "units" ? "bg-[#135D39] text-white" : "text-stone-500 hover:text-[#1A2421]"
                }`}
              >
                <Plus className="w-3.5 h-3.5" /> Unit Plots Tally
              </button>
            </div>

            <div className="p-6">
              
              {/* WAY 1: SATELLITE PLOTTER GRID */}
              {calculatorWay === "draw" && (
                <div className="space-y-4">
                  <div className="text-xs text-stone-600 font-medium">
                    📍 <b>Click on the satellite imagery</b> representing the corners of your farm crop block to trace its exact border path.
                  </div>

                  {/* Satellite Drawing Board */}
                  <div className="relative h-[220px] bg-stone-900 border border-stone-300 rounded-2xl overflow-hidden cursor-crosshair">
                    
                    {/* Simulated Satellite Image Backdrop */}
                    <div className="absolute inset-0 opacity-40 bg-[radial-gradient(rgba(19,93,57,0.3)_1px,transparent_1px)] [background-size:20px_20px] bg-[#112415]"></div>
                    <div className="absolute inset-0 bg-green-950/20"></div>
                    
                    {/* Simulated visual objects on satellite map */}
                    <div className="absolute top-12 left-24 w-12 h-10 bg-green-900/40 rounded-full border border-[#135D39]/30"></div>
                    <div className="absolute top-28 left-48 w-16 h-14 bg-brown-800/20 rounded-lg border border-yellow-800/10"></div>
                    
                    <svg width="100%" height="100%" className="absolute inset-0" onClick={handleMapClick}>
                      {/* Lines connecting corners */}
                      {points.length > 1 && (
                        <polyline
                          points={points.map(p => `${p.x},${p.y}`).join(" ")}
                          fill="none"
                          stroke="#ECCE2A"
                          strokeWidth="2.5"
                        />
                      )}
                      {points.length > 2 && (
                        <line
                          x1={points[points.length - 1].x}
                          y1={points[points.length - 1].y}
                          x2={points[0].x}
                          y2={points[0].y}
                          stroke="#ECCE2A"
                          strokeWidth="2.5"
                          strokeDasharray="4 2"
                        />
                      )}

                      {/* Corner nodes */}
                      {points.map((p, idx) => (
                        <g key={idx} transform={`translate(${p.x - 4}, ${p.y - 4})`}>
                          <circle cx="4" cy="4" r="5.5" fill="#135D39" stroke="#ECCE2A" strokeWidth="1.5" />
                          <text x="7" y="12" fill="#ECCE2A" fontSize="9" fontWeight="bold">W{idx + 1}</text>
                        </g>
                      ))}

                      {/* Map info instructions */}
                      {points.length === 0 && (
                        <g transform="translate(180, 100)">
                          <text fill="white" fontSize="12" fontWeight="bold" textAnchor="middle">CLICK REPEATEDLY ON FIELDS TO PLOT CORNERS</text>
                        </g>
                      )}
                    </svg>
                  </div>

                  <div className="flex justify-between items-center bg-stone-100 p-3.5 rounded-xl border">
                    <span className="text-xs text-stone-600 font-bold">
                      Plotted Anchors: <b className="font-mono text-[#135D39] text-sm">{points.length} corners</b>
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={clearDrawPoints}
                        className="p-1 px-3 border border-stone-300 rounded-lg text-xs font-semibold text-stone-600 bg-white cursor-pointer hover:bg-stone-50 flex items-center gap-1"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> Reset
                      </button>
                      <button
                        type="button"
                        onClick={applyDrawnAcreage}
                        className="p-1 px-3 bg-[#135D39] text-white rounded-lg text-xs font-bold cursor-pointer hover:bg-opacity-90 transition"
                      >
                        Apply Drawn Polygon
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* WAY 2: PACES STEPS WRITER */}
              {calculatorWay === "paces" && (
                <div className="space-y-4">
                  <div className="text-xs text-stone-600 leading-normal">
                    🚶 <b>Steps Dimensioning</b>: Standard adult stride length is approx 0.75 meters. Walk along the longitudinal border of your farm, counting your steps, then repeat for the width.
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-bold text-stone-500 block">Length in Steps / Paces</label>
                      <input
                        type="number"
                        className="w-full p-3 border rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#135D39]"
                        value={paceLength}
                        onChange={(e) => setPaceLength(parseInt(e.target.value) || 0)}
                      />
                      <span className="text-[10px] text-stone-400 block font-mono">≈ {Math.round(paceLength * 0.75)} Meters long</span>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-bold text-stone-500 block">Width in Steps / Paces</label>
                      <input
                        type="number"
                        className="w-full p-3 border rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#135D39]"
                        value={paceWidth}
                        onChange={(e) => setPaceWidth(parseInt(e.target.value) || 0)}
                      />
                      <span className="text-[10px] text-stone-400 block font-mono">≈ {Math.round(paceWidth * 0.75)} Meters wide</span>
                    </div>
                  </div>

                  <div className="p-4 bg-stone-50 rounded-xl border mt-2 space-y-1 flex justify-between items-center">
                    <div>
                      <span className="text-[10px] uppercase text-stone-500 font-bold block">Est. Square Footage Area</span>
                      <p className="text-xs font-semibold text-stone-700">{(paceLength * paceWidth * 0.56).toFixed(1)} sqm (Square Meters)</p>
                    </div>
                    <button
                      type="button"
                      onClick={applyPaceAcreage}
                      className="px-4 py-2 bg-[#135D39] text-white text-xs font-bold rounded-xl hover:bg-opacity-90 transition cursor-pointer"
                    >
                      Calculate & Apply to Form
                    </button>
                  </div>
                </div>
              )}

              {/* WAY 3: PLOT UNIT SELECTORS */}
              {calculatorWay === "units" && (
                <div className="space-y-4">
                  <div className="text-xs text-stone-600 italic">
                    📦 <b>Cooperative Plot-Index</b>: In Nigeria, farmland is often bought/tallied in standard "plots" (typically 120ft × 60ft or approx 648 square meters). This estimate helps you register total acreage straight from plot units.
                  </div>

                  <div className="space-y-1.5 max-w-sm">
                    <label className="text-[10px] uppercase font-bold text-stone-500 block font-mono">Count of Farmland Plots</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        className="p-3 border rounded-xl font-semibold text-xs grow focus:outline-none focus:ring-1 focus:ring-[#135D39]"
                        value={numPlotUnit}
                        onChange={(e) => setNumPlotUnit(parseInt(e.target.value) || 0)}
                      />
                      <span className="p-3 bg-stone-100 border text-stone-700 rounded-xl text-xs font-bold select-none font-mono">plots</span>
                    </div>
                    <span className="text-[10px] text-stone-400 font-medium block">Each plot counts as exactly 0.16 Acres (6 plots ≈ 1 Acre).</span>
                  </div>

                  <div className="p-3.5 bg-stone-50 rounded-xl border flex justify-between items-center">
                    <div>
                      <span className="text-[10px] uppercase text-stone-500 font-bold block">Total Converted Acreage</span>
                      <p className="text-sm font-black text-[#135D39]">{(numPlotUnit * 0.16).toFixed(2)} Acres</p>
                    </div>
                    <button
                      type="button"
                      onClick={applyUnitPlots}
                      className="px-4 py-2 bg-[#135D39] text-white text-xs font-bold rounded-xl transition cursor-pointer hover:bg-opacity-90"
                    >
                      Save & Apply Plots
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 bg-stone-50 border-t flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsAcreageWizardOpen(false)}
                className="px-4 py-2 text-xs font-bold text-stone-500 hover:text-stone-850 cursor-pointer border rounded-lg bg-white"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
