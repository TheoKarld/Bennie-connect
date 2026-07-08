import React, { useState } from "react";
import { 
  Sprout, 
  Map, 
  Cpu, 
  Plane, 
  GraduationCap, 
  Wrench, 
  FileCheck2, 
  ShieldCheck, 
  TrendingUp, 
  Layers, 
  Droplet, 
  Clock, 
  Wallet, 
  Star, 
  Sparkles, 
  Filter, 
  Search, 
  CheckCircle2, 
  AlertCircle, 
  MapPin,
  Calendar,
  MessageSquare,
  Plus
} from "lucide-react";
import { FarmerAppState, ServiceCategory, ServiceBooking, ServiceCategoryName } from "../../types";

interface AgriculturalServicesViewProps {
  state: FarmerAppState;
  onBookService: (booking: Omit<ServiceBooking, "id" | "createdAt">) => void;
  onPayBooking: (bookingId: string) => void;
  onReviewBooking: (bookingId: string, rating: number, comment: string) => void;
  onCancelBooking: (bookingId: string) => void;
  onSimulateStatus: (bookingId: string) => void;
}

// Icon mapper for service categories
const CATEGORY_ICONS: Record<ServiceCategoryName, React.ComponentType<any>> = {
  "Soil Testing": Droplet,
  "Farm Mapping": Map,
  "Precision Agriculture (IOT sensors)": Cpu,
  "Drone Services": Plane,
  "Farm Consultancy": Sprout,
  "Equipment Repairs": Wrench,
  "Greenhouse Design": Layers,
  "Greenhouse Construction": Layers,
  "Irrigation Installation": Droplet,
  "Data Analytics": TrendingUp,
  "Farm Auditing": FileCheck2,
  "Farm Insurance": ShieldCheck,
  "Agricultural Training": GraduationCap,
};

export default function AgriculturalServicesView({
  state,
  onBookService,
  onPayBooking,
  onReviewBooking,
  onCancelBooking,
  onSimulateStatus
}: AgriculturalServicesViewProps) {
  const [selectedService, setSelectedService] = useState<ServiceCategory | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<"catalog" | "my-bookings">("catalog");

  // Booking Form Fields
  const [bookingDate, setBookingDate] = useState("");
  const [unitsNeeded, setUnitsNeeded] = useState(1);
  const [location, setLocation] = useState("Kano State Maize Hub, Sector A3");
  const [notes, setNotes] = useState("");
  const [payInstantly, setPayInstantly] = useState(true);

  // Review Form Fields
  const [reviewingBookingId, setReviewingBookingId] = useState<string | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");

  const categories = state.serviceCategories || [];
  const bookings = state.serviceBookings || [];

  const filteredCategories = categories.filter(cat => 
    cat.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    cat.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleOpenBooking = (service: ServiceCategory) => {
    setSelectedService(service);
    setIsBookingModalOpen(true);
    setUnitsNeeded(1);
    setNotes("");
  };

  const handleCloseBooking = () => {
    setIsBookingModalOpen(false);
    setSelectedService(null);
  };

  const handleCreateBooking = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedService) return;

    if (!bookingDate) {
      alert("Please select a valid date.");
      return;
    }

    const cost = selectedService.pricePerUnit * unitsNeeded;
    
    // Check wallet if pay instantly
    if (payInstantly && state.walletBalance < cost) {
      alert(`Insufficient wallet balance. You need ₦${cost.toLocaleString()} but have ₦${state.walletBalance.toLocaleString()}. Please choose unpaid or fund your wallet.`);
      return;
    }

    onBookService({
      serviceName: selectedService.name,
      bookingDate,
      farmerName: "Aliyu (You)",
      farmerLocation: location,
      status: "pending",
      totalCost: cost,
      notes,
      paymentStatus: payInstantly ? "paid" : "unpaid"
    });

    setIsBookingModalOpen(false);
    setSelectedService(null);
    setActiveSubTab("my-bookings");
  };

  const handleSubmitReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewingBookingId) return;

    onReviewBooking(reviewingBookingId, reviewRating, reviewComment);
    setReviewingBookingId(null);
    setReviewComment("");
    setReviewRating(5);
  };

  return (
    <div id="service-marketplace-container" className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-8">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <span className="text-xs uppercase text-primary font-bold tracking-wider mb-1 block">Module 4 Platform</span>
          <h1 className="text-3xl font-display font-medium text-ink">Agricultural Services Marketplace</h1>
          <p className="text-sm text-muted mt-1">Book certified drone operators, soil analysis experts, precision irrigation engineers, and training modules.</p>
        </div>

        {/* Tab switchers */}
        <div className="flex gap-2 bg-canvas border border-border p-1 rounded-full shrink-0 w-fit">
          <button
            onClick={() => setActiveSubTab("catalog")}
            className={`px-4 py-2 rounded-full font-semibold text-xs transition-all ${
              activeSubTab === "catalog"
                ? "bg-primary text-white shadow-md shadow-primary/10"
                : "text-muted hover:text-ink"
            }`}
          >
            Service Catalog ({filteredCategories.length})
          </button>
          <button
            onClick={() => setActiveSubTab("my-bookings")}
            className={`px-4 py-2 rounded-full font-semibold text-xs transition-all ${
              activeSubTab === "my-bookings"
                ? "bg-primary text-white shadow-md shadow-primary/10"
                : "text-muted hover:text-ink"
            }`}
          >
            My Bookings ({bookings.length})
          </button>
        </div>
      </div>

      {activeSubTab === "catalog" && (
        <div className="space-y-6">
          {/* SEARCH BAR */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-grow">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-muted" />
              <input
                type="text"
                placeholder="Search services (e.g. soil testing, mapping, repair)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-surface border border-border rounded-2xl py-3 pl-11 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="flex items-center gap-2 px-4 py-2 border border-border bg-surface rounded-2xl text-xs font-semibold text-muted">
              <Filter className="w-4 h-4" /> Filtered list of agro services
            </div>
          </div>

          {/* GRID OF SERVICES */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCategories.map((service) => {
              const IconComp = CATEGORY_ICONS[service.name] || Sprout;
              return (
                <div key={service.id} className="bg-surface border border-border rounded-3xl p-6 flex flex-col justify-between hover:shadow-xl hover:border-primary/20 transition-all group duration-300">
                  <div className="space-y-4">
                    {/* Icon and Rating */}
                    <div className="flex justify-between items-start">
                      <div className="w-12 h-12 rounded-2xl bg-primary/5 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all duration-300">
                        <IconComp className="w-6 h-6" />
                      </div>
                      <div className="flex items-center gap-1 bg-accent/10 text-amber-700 dark:text-amber-300 px-2.5 py-1 rounded-full text-[11px] font-bold">
                        <Star className="w-3.5 h-3.5 fill-accent text-accent" />
                        <span>{service.rating}</span>
                        <span className="text-muted font-normal">({service.reviews.length})</span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <h3 className="font-display font-medium text-lg text-ink">{service.name}</h3>
                      <p className="text-xs text-muted leading-relaxed line-clamp-3">{service.description}</p>
                    </div>
                  </div>

                  <div className="mt-6 pt-5 border-t border-border flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-muted block font-semibold uppercase tracking-wider">Estimated Cost</span>
                      <span className="font-display font-semibold text-lg text-primary">
                        ₦{service.pricePerUnit.toLocaleString()}
                      </span>
                      <span className="text-xs text-muted font-medium ml-1">/{service.unit}</span>
                    </div>

                    <button
                      onClick={() => handleOpenBooking(service)}
                      className="bg-primary hover:bg-[#0B3921] text-white px-4 py-2.5 rounded-full text-xs font-bold shadow-md shadow-primary/10 hover:shadow-lg transition-all"
                    >
                      Book Service
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredCategories.length === 0 && (
            <div className="text-center py-16 bg-surface border border-border rounded-3xl space-y-3">
              <Sprout className="w-12 h-12 text-primary/40 mx-auto" />
              <h3 className="font-display font-medium text-lg">No services found matching your query</h3>
              <p className="text-xs text-muted">Try searching for other general terms or keywords.</p>
            </div>
          )}
        </div>
      )}

      {activeSubTab === "my-bookings" && (
        <div className="space-y-6">
          {/* USER BOOKINGS HEADER & BALANCE */}
          <div className="p-6 bg-gradient-to-r from-[#135D39] to-[#0D4026] text-white rounded-3xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-xl relative overflow-hidden">
            <div className="absolute right-0 bottom-0 translate-y-12 translate-x-12 w-64 h-64 bg-white/5 rounded-full blur-2xl"></div>
            <div className="space-y-1 relative z-10">
              <span className="text-[10px] uppercase font-bold tracking-widest text-emerald-300">Consolidated Accounts</span>
              <h2 className="text-2xl font-display font-medium">Digital Cooperative Wallet Assets</h2>
              <p className="text-xs text-emerald-100/90 max-w-md">Payments for accepted bookings are safely escrowed from your balance and released upon job checkoff.</p>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10 text-right min-w-[200px] relative z-10">
              <span className="text-[10px] font-bold uppercase tracking-wider block text-emerald-200">Balance Available</span>
              <span className="text-2xl font-mono font-bold block mt-1">₦{state.walletBalance.toLocaleString()}</span>
              <span className="text-[9px] block text-emerald-100 mt-1 leading-none">Instant dispatch security active</span>
            </div>
          </div>

          {/* ACTIVE DISPATCH LIST */}
          <div className="space-y-4">
            <h3 className="font-display font-medium text-lg text-ink">Operational Booking Log</h3>

            {bookings.map((bk) => {
              const statusColor =
                bk.status === "completed" ? "bg-emerald-100 dark:bg-emerald-500/15 border-emerald-300 dark:border-emerald-500/20 text-emerald-800 dark:text-emerald-300" :
                bk.status === "confirmed" ? "bg-cyan-100 dark:bg-cyan-500/15 border-cyan-300 dark:border-cyan-500/20 text-cyan-800 dark:text-cyan-300" :
                bk.status === "cancelled" ? "bg-rose-100 dark:bg-rose-500/15 border-rose-300 dark:border-rose-500/20 text-rose-800 dark:text-rose-300" :
                "bg-amber-100 dark:bg-amber-500/15 border-amber-300 dark:border-amber-500/20 text-amber-800 dark:text-amber-300";

              return (
                <div key={bk.id} className="bg-surface border border-border rounded-3xl p-6 space-y-6 shadow-sm hover:shadow-md transition-all">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border pb-4">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[11px] font-mono font-bold text-muted bg-surface-2 border border-border px-2.5 py-0.5 rounded-md">
                          {bk.id}
                        </span>
                        <span className={`text-[10px] font-bold uppercase tracking-wider border-l border-r px-2 py-0.5 rounded-full ${statusColor}`}>
                          {bk.status}
                        </span>
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                          bk.paymentStatus === "paid" ? "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300" : "bg-amber-100 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300"
                        }`}>
                          {bk.paymentStatus === "paid" ? "Paid" : "Unpaid"}
                        </span>
                      </div>
                      <h4 className="font-display font-semibold text-lg text-ink mt-1">{bk.serviceName}</h4>
                    </div>

                    <div className="text-left md:text-right">
                      <span className="text-[10px] text-muted block font-semibold uppercase">Total Commitment</span>
                      <span className="font-mono font-bold text-lg text-primary">
                        ₦{bk.totalCost.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-muted">
                        <Calendar className="w-4 h-4 text-primary" />
                        <span className="font-semibold text-ink">Execution Target</span>
                      </div>
                      <p className="text-muted pl-6 font-mono font-medium">{bk.bookingDate}</p>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-muted">
                        <MapPin className="w-4 h-4 text-primary" />
                        <span className="font-semibold text-ink">Acreage Target Coordinates</span>
                      </div>
                      <p className="text-muted pl-6 line-clamp-1">{bk.farmerLocation}</p>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-muted">
                        <MessageSquare className="w-4 h-4 text-primary" />
                        <span className="font-semibold text-ink">Instruction Details</span>
                      </div>
                      <p className="text-muted pl-6 italic line-clamp-1">{bk.notes || "None supplied"}</p>
                    </div>
                  </div>

                  {/* SUB ACTION BUTTONS & SIMULATION PANEL */}
                  <div className="bg-surface-2 border border-border/50 p-4 rounded-2xl flex flex-wrap gap-3 justify-between items-center">
                    <div className="space-y-0.5">
                      <span className="text-[10px] uppercase font-bold text-primary block">Simulate Dispatch Flow</span>
                      <p className="text-[10px] text-muted">Simulate operator execution to trigger payments or rating reviews.</p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {bk.status !== "completed" && bk.status !== "cancelled" && (
                        <button
                          onClick={() => onSimulateStatus(bk.id)}
                          className="bg-primary hover:bg-[#0B3921] text-white px-3.5 py-1.5 rounded-xl text-[11px] font-bold transition flex items-center gap-1.5 cursor-pointer"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          {bk.status === "pending" ? "Confirm Booking & Dispatch" : "Mark Job Finished"}
                        </button>
                      )}

                      {bk.paymentStatus === "unpaid" && bk.status !== "cancelled" && (
                        <button
                          onClick={() => onPayBooking(bk.id)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 rounded-xl text-[11px] font-bold transition flex items-center gap-1.5 cursor-pointer"
                        >
                          <Wallet className="w-3.5 h-3.5" /> Pay Now
                        </button>
                      )}

                      {bk.status === "completed" && !bk.rating && (
                        <button
                          onClick={() => {
                            setReviewingBookingId(bk.id);
                            setReviewRating(5);
                            setReviewComment("");
                          }}
                          className="bg-accent hover:bg-[#C17C14] text-white px-3.5 py-1.5 rounded-xl text-[11px] font-bold transition flex items-center gap-1.5 cursor-pointer"
                        >
                          <Star className="w-3.5 h-3.5 fill-white" /> Leave Rating & Review
                        </button>
                      )}

                      {bk.status === "pending" && (
                        <button
                          onClick={() => onCancelBooking(bk.id)}
                          className="bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/15 text-rose-700 dark:text-rose-300 hover:text-rose-800 dark:hover:text-rose-300 px-3.5 py-1.5 rounded-xl text-[11px] font-bold transition border border-rose-200 dark:border-rose-500/20 cursor-pointer"
                        >
                          Cancel Booking (Refund)
                        </button>
                      )}
                    </div>
                  </div>

                  {/* DISPLAY ATTACHED REVIEW IF GIVEN */}
                  {bk.rating && (
                    <div className="bg-surface-2 border border-emerald-100 dark:border-emerald-500/20 p-4 rounded-2xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-ink">Farmer Completed Assessment</span>
                        <div className="flex items-center gap-0.5 text-accent">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={`w-3.5 h-3.5 ${
                                i < (bk.rating || 0) ? "fill-accent text-accent" : "text-border"
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                      <p className="text-xs text-muted italic">"{bk.reviewComment}"</p>
                    </div>
                  )}

                  {/* COLLAPSED REVIEW EDITOR AREA */}
                  {reviewingBookingId === bk.id && (
                    <form onSubmit={handleSubmitReview} className="bg-surface border-2 border-accent/40 p-5 rounded-2xl space-y-4 animate-fade-in">
                      <div className="flex justify-between items-center">
                        <h5 className="text-sm font-semibold text-ink">Submit Agronomy Quality Review</h5>
                        <button
                          type="button"
                          onClick={() => setReviewingBookingId(null)}
                          className="text-xs text-muted font-medium"
                        >
                          Cancel
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted font-medium">Rating:</span>
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              type="button"
                              key={star}
                              onClick={() => setReviewRating(star)}
                              className="p-1 cursor-pointer focus:outline-none"
                            >
                              <Star
                                className={`w-6 h-6 transition-transform ${
                                  star <= reviewRating ? "fill-accent text-accent scale-110" : "text-border"
                                }`}
                              />
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs text-ink font-semibold block">Comments & Observations</label>
                        <textarea
                          rows={3}
                          placeholder="Provide details about the response rate, testing precision, drone height coverage, etc."
                          value={reviewComment}
                          onChange={(e) => setReviewComment(e.target.value)}
                          className="w-full text-xs p-3 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
                          required
                        />
                      </div>

                      <button
                        type="submit"
                        className="bg-accent hover:bg-[#C17C14] text-white text-xs font-bold px-4 py-2 rounded-lg transition"
                      >
                        Publish Review to Ledger
                      </button>
                    </form>
                  )}
                </div>
              );
            })}

            {bookings.length === 0 && (
              <div className="text-center py-16 bg-surface border border-border rounded-3xl space-y-2">
                <Clock className="w-12 h-12 text-primary/40 mx-auto" />
                <h3 className="font-display font-medium text-base">No active bookings registered</h3>
                <p className="text-xs text-muted">Head over to the Service Catalog to secure dry season solutions, drone mappings, or repairs.</p>
                <button
                  onClick={() => setActiveSubTab("catalog")}
                  className="mt-2 text-xs font-bold text-primary hover:underline"
                >
                  Browse Service Catalog &rarr;
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* BOOKING FLOW MODAL SHEET */}
      {isBookingModalOpen && selectedService && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl relative overflow-hidden animate-scale-up space-y-6">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] text-primary font-bold uppercase tracking-wider">Certified Secure Booking</span>
                <h3 className="font-display font-medium text-xl text-ink mt-1">Book: {selectedService.name}</h3>
              </div>
              <button
                onClick={handleCloseBooking}
                className="p-1 h-8 w-8 hover:bg-surface-2 rounded-lg transition text-muted"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateBooking} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-bold text-ink">Cost Rate</label>
                  <p className="font-mono text-primary font-bold p-2.5 bg-primary/5 border border-primary/10 rounded-xl">
                    ₦{selectedService.pricePerUnit.toLocaleString()} / {selectedService.unit}
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-ink">Select Date</label>
                  <input
                    type="date"
                    value={bookingDate}
                    onChange={(e) => setBookingDate(e.target.value)}
                    className="w-full p-2 bg-surface border border-border rounded-xl focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-bold text-ink">Quantity ({selectedService.unit})</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={unitsNeeded}
                    onChange={(e) => setUnitsNeeded(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full p-2 bg-surface border border-border rounded-xl focus:outline-none text-center"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-ink">Farm Coordinates Address</label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full p-2 bg-surface border border-border rounded-xl focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-ink">Special Instructions / Agronomist Notes</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Clay-heavy soil, 5 years cash-crop tillage history, pest coordinates..."
                  className="w-full p-3 border border-border rounded-xl focus:outline-none"
                />
              </div>

              {/* Instant payment option */}
              <div className="bg-surface-2 border border-border p-4 rounded-2xl flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="font-bold text-ink block">Instant Settlement with Digital Wallet</span>
                  <p className="text-[10px] text-muted">Settle checkout amount immediately from cooperative liquid funds.</p>
                </div>
                <input
                  type="checkbox"
                  checked={payInstantly}
                  onChange={(e) => setPayInstantly(e.target.checked)}
                  className="w-4.5 h-4.5 text-primary focus:ring-primary rounded cursor-pointer"
                />
              </div>

              {/* Summary and pay constraint */}
              <div className="border-t border-border pt-4 space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted font-semibold">Total Commitment:</span>
                  <span className="font-mono font-bold text-base text-primary">
                    ₦{(selectedService.pricePerUnit * unitsNeeded).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center text-[10px] text-muted">
                  <span>Available Cooperative Wallet Balance:</span>
                  <span className="font-semibold text-ink">₦{state.walletBalance.toLocaleString()}</span>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleCloseBooking}
                  className="w-1/2 border border-border hover:bg-surface-2 py-2.5 rounded-xl font-bold transition"
                >
                  Go Back
                </button>
                <button
                  type="submit"
                  className="w-1/2 bg-primary hover:bg-[#0B3921] text-white py-2.5 rounded-xl font-bold shadow-md shadow-primary/15 transition"
                >
                  Publish Booking
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
