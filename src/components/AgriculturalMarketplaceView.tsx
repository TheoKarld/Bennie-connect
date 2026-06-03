import React, { useState } from "react";
import { 
  ShoppingCart, 
  Plus, 
  Search, 
  Filter, 
  Trash2, 
  Store, 
  ShoppingBag, 
  Package, 
  List, 
  Check, 
  Truck, 
  User, 
  MapPin, 
  Sparkles, 
  X, 
  PlusCircle, 
  Layers, 
  CheckCircle2, 
  AlertCircle 
} from "lucide-react";
import { FarmerAppState, Product, CartItem, ProductOrder, ProductCategoryName } from "../types";

interface AgriculturalMarketplaceViewProps {
  state: FarmerAppState;
  onAddToCart: (productId: string) => void;
  onUpdateCartQty: (cartItemId: string, qty: number) => void;
  onRemoveFromCart: (cartItemId: string) => void;
  onCheckout: (deliveryAddress: string) => void;
  // Merchant actions
  onAddProduct: (product: Omit<Product, "id" | "merchantId" | "merchantName">) => void;
  onUpdateProductStock: (productId: string, newStock: number) => void;
  onUpdateOrderStatus: (orderId: string, status: ProductOrder["status"]) => void;
}

const CATEGORIES: ProductCategoryName[] = [
  "Seeds",
  "Fertilizers",
  "Agrochemicals",
  "Farm Equipment",
  "Livestock Inputs",
  "Irrigation Equipment",
  "Greenhouse Materials",
  "Farm Produce"
];

export default function AgriculturalMarketplaceView({
  state,
  onAddToCart,
  onUpdateCartQty,
  onRemoveFromCart,
  onCheckout,
  onAddProduct,
  onUpdateProductStock,
  onUpdateOrderStatus
}: AgriculturalMarketplaceViewProps) {
  // Navigation for tab: "buy" | "track" | "merchant"
  const [activeSegment, setActiveSegment] = useState<"buy" | "track" | "merchant">("buy");
  const [selectedCategory, setSelectedCategory] = useState<ProductCategoryName | "All">("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState("Kano State Maize Hub, Sector A3");

  // Merchant Panel tabs: "list-product" | "inventory" | "orders-manage"
  const [merchantSubTab, setMerchantSubTab] = useState<"list-product" | "inventory" | "orders-manage">("inventory");

  // Add Product Form
  const [prodName, setProdName] = useState("");
  const [prodCategory, setProdCategory] = useState<ProductCategoryName>("Seeds");
  const [prodPrice, setProdPrice] = useState(5000);
  const [prodUnit, setProdUnit] = useState("50kg Bag");
  const [prodStock, setProdStock] = useState(50);
  const [prodDesc, setProdDesc] = useState("");

  const products = state.products || [];
  const orders = state.orders || [];
  const cart = state.cart || [];

  // Filter products by search and category
  const filteredProducts = products.filter(p => {
    const matchCat = selectedCategory === "All" || p.category === selectedCategory;
    const matchSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                        p.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchSearch;
  });

  // Calculate cart summaries
  const cartSummaryItems = cart.map(item => {
    const pDetails = products.find(prod => prod.id === item.productId);
    return {
      item,
      product: pDetails,
      cost: pDetails ? pDetails.price * item.quantity : 0
    };
  }).filter(c => c.product !== undefined);

  const cartTotalCost = cartSummaryItems.reduce((acc, curr) => acc + curr.cost, 0);

  const handleAddProductSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodName || !prodUnit) {
      alert("Please fill in the product name and unit.");
      return;
    }
    onAddProduct({
      name: prodName,
      category: prodCategory,
      price: prodPrice,
      unit: prodUnit,
      stock: prodStock,
      description: prodDesc
    });
    // Reset
    setProdName("");
    setProdDesc("");
    setProdStock(50);
    setProdPrice(5000);
    alert("Product listed successfully in Cooperative Marketplace catalogs!");
    setMerchantSubTab("inventory");
  };

  const handleProcessCheckout = (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) {
      alert("Your cart is empty.");
      return;
    }
    if (state.walletBalance < cartTotalCost) {
      alert(`Insufficient funds. You need ₦${cartTotalCost.toLocaleString()} but have ₦${state.walletBalance.toLocaleString()} in your Cooperative Wallet.`);
      return;
    }
    onCheckout(deliveryAddress);
    setIsCartOpen(false);
    alert("Purchase process finalized successfully. Order booked & funds escrowed.");
    setActiveSegment("track");
  };

  return (
    <div id="marketplace-container" className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-8 relative">
      {/* HEADER PORTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#E6E5DF] pb-5">
        <div>
          <span className="text-xs uppercase text-[#135D39] font-bold tracking-wider mb-1 block">Module 5 Platform</span>
          <h1 className="text-3xl font-display font-medium text-[#1A2421]">Agricultural Inputs & Produce Marketplace</h1>
          <p className="text-sm text-[#5C6460] mt-1">Buy seed bundles, premium NPK fertilizers, gravity drip components or register as a merchant trader.</p>
        </div>

        {/* Master Selector tabs */}
        <div className="flex gap-2 bg-[#FAF8F5] border border-[#E6E5DF] p-1 rounded-full shrink-0 w-fit">
          <button
            onClick={() => setActiveSegment("buy")}
            className={`px-4 py-2 rounded-full font-semibold text-xs transition-all ${
              activeSegment === "buy"
                ? "bg-[#135D39] text-white shadow-md shadow-[#135D39]/10"
                : "text-[#5C6460] hover:text-[#1A2421]"
            }`}
          >
            Farmer Shopping
          </button>
          <button
            onClick={() => setActiveSegment("track")}
            className={`px-4 py-2 rounded-full font-semibold text-xs transition-all ${
              activeSegment === "track"
                ? "bg-[#135D39] text-white shadow-md shadow-[#135D39]/10"
                : "text-[#5C6460] hover:text-[#1A2421]"
            }`}
          >
            Track My Orders ({orders.filter(o => o.farmerId === "aliyu_coop").length})
          </button>
          <button
            onClick={() => setActiveSegment("merchant")}
            className={`px-4 py-2 rounded-full font-semibold text-xs transition-all flex items-center gap-1.5 ${
              activeSegment === "merchant"
                ? "bg-amber-600 text-white shadow-md shadow-amber-600/10"
                : "text-amber-700 hover:bg-amber-50"
            }`}
          >
            <Store className="w-3.5 h-3.5" /> Merchant Portal
          </button>
        </div>
      </div>

      {/* FARMER SHOPPING SEGMENT */}
      {activeSegment === "buy" && (
        <div className="space-y-6">
          {/* CART FLOATER BAR */}
          {cart.length > 0 && (
            <div className="bg-[#FAF8F5] border-2 border-[#135D39] p-4 rounded-3xl flex items-center justify-between shadow-xl animate-fade-in">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#135D39] text-white flex items-center justify-center font-bold">
                  {cart.reduce((s, c) => s + c.quantity, 0)}
                </div>
                <div>
                  <h4 className="font-semibold text-xs text-[#1A2421]">Shopping Basket Items Pending</h4>
                  <p className="text-[11px] text-[#5C6460]">Accumulated amount: <span className="font-mono font-bold text-[#135D39]">₦{cartTotalCost.toLocaleString()}</span></p>
                </div>
              </div>
              <button
                onClick={() => setIsCartOpen(true)}
                className="bg-[#135D39] hover:bg-[#0B3921] text-white font-bold text-xs px-5 py-2.5 rounded-full flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
              >
                <ShoppingCart className="w-4.5 h-4.5" /> Open Checkout Panel
              </button>
            </div>
          )}

          {/* SEARCH & FILTERS CONTAINER */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-start">
            {/* Sidebar category selector */}
            <div className="bg-white border border-[#E6E5DF] rounded-3xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b pb-3 border-[#FAF8F5]">
                <h3 className="font-semibold text-xs uppercase tracking-wider text-[#1A2421]">Marketplace Categories</h3>
                <Filter className="w-4 h-4 text-[#5C6460]" />
              </div>

              <div className="flex flex-col space-y-1">
                <button
                  onClick={() => setSelectedCategory("All")}
                  className={`w-full text-left px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
                    selectedCategory === "All"
                      ? "bg-[#135D39] text-white"
                      : "text-[#5C6460] hover:text-[#1A2421] hover:bg-[#FAF8F5]"
                  }`}
                >
                  All Products ({products.length})
                </button>
                {CATEGORIES.map(cat => {
                  const count = products.filter(p => p.category === cat).length;
                  return (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`w-full text-left px-3.5 py-2 rounded-xl text-xs font-semibold transition flex justify-between items-center ${
                        selectedCategory === cat
                          ? "bg-[#135D39] text-white"
                          : "text-[#5C6460] hover:text-[#1A2421] hover:bg-[#FAF8F5]"
                      }`}
                    >
                      <span>{cat}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${selectedCategory === cat ? "bg-white/20 text-white" : "bg-[#FAF8F5] border text-[#5C6460]"}`}>{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Main search and grid */}
            <div className="md:col-span-3 space-y-6">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-[#5C6460]" />
                <input
                  type="text"
                  placeholder="Search brand seeds, fertilizer types, equipment sizes, livestock feed..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white border border-[#E6E5DF] rounded-2xl py-3 pl-11 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#135D39]/20"
                />
              </div>

              {/* PRODUCTS DISPLAY GRID */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredProducts.map(prod => {
                  const itemsInCartCount = cart.find(item => item.productId === prod.id)?.quantity || 0;
                  return (
                    <div key={prod.id} className="bg-white border border-[#E6E5DF] rounded-3xl p-5 flex flex-col justify-between hover:shadow-xl hover:border-[#135D39]/20 transition-all duration-300 relative group">
                      <div className="space-y-4">
                        {/* Image Placeholder with category tag */}
                        <div className="w-full h-36 bg-gradient-to-br from-[#135D39]/5 to-amber-500/5 rounded-2xl flex flex-col justify-between p-3 relative overflow-hidden">
                          <span className="text-[10px] font-bold uppercase tracking-wider bg-[#135D39] text-white px-2.5 py-1 rounded-full w-fit">
                            {prod.category}
                          </span>
                          {itemsInCartCount > 0 && (
                            <span className="absolute top-3 right-3 bg-amber-600 text-white w-7 h-7 rounded-full flex items-center justify-center font-mono font-bold text-xs shadow-md">
                              {itemsInCartCount}
                            </span>
                          )}
                          <div className="flex justify-between items-center text-[10px] text-[#5C6460] font-semibold">
                            <span>By {prod.merchantName}</span>
                            <span className={prod.stock > 0 ? "text-[#135D39] font-bold" : "text-rose-600 font-bold"}>
                              {prod.stock > 0 ? `${prod.stock} left` : "Out of stock"}
                            </span>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <h3 className="font-semibold text-sm text-[#1A2421] group-hover:text-[#135D39] transition-colors leading-tight line-clamp-2">
                            {prod.name}
                          </h3>
                          <p className="text-xs text-[#5C6460] line-clamp-2 leading-relaxed">
                            {prod.description}
                          </p>
                        </div>
                      </div>

                      <div className="mt-5 pt-4 border-t border-[#FAF8F5] flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-[#5C6460] block font-semibold uppercase">Price</span>
                          <span className="font-mono font-bold text-base text-[#135D39]">
                            ₦{prod.price.toLocaleString()}
                          </span>
                          <span className="text-[11px] text-[#5C6460] font-medium block">/{prod.unit}</span>
                        </div>

                        <button
                          onClick={() => onAddToCart(prod.id)}
                          disabled={prod.stock <= 0}
                          className={`px-4.5 py-2.5 rounded-full text-xs font-bold shadow-md transition-all flex items-center gap-1.5 cursor-pointer ${
                            prod.stock > 0 
                              ? "bg-[#135D39] hover:bg-[#0B3921] text-white shadow-[#135D39]/10" 
                              : "bg-slate-100 text-slate-400 border border-slate-200 shadow-none cursor-not-allowed"
                          }`}
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Add
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {filteredProducts.length === 0 && (
                <div className="text-center py-16 bg-white border border-[#E6E5DF] rounded-3xl space-y-3">
                  <ShoppingBag className="w-12 h-12 text-[#135D39]/40 mx-auto" />
                  <h3 className="font-display font-medium text-lg">No products found inside catalog</h3>
                  <p className="text-xs text-[#5C6460]">Select other categorised filters on your left or refine search query.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TRACK MY ORDERS SEGMENT */}
      {activeSegment === "track" && (
        <div id="track-orders-farmer" className="space-y-6">
          <h2 className="font-display font-semibold text-lg text-[#1A2421]">Individual Purchase Tracker</h2>

          {orders.filter(o => o.farmerId === "aliyu_coop").map(ord => {
            const statusLabels: Record<ProductOrder["status"], string> = {
              "pending": "Pending Verification",
              "processing": "Packed & Prepared",
              "shipped": "Dispatched Package (In Transit)",
              "delivered": "Arrived - Disbursed Safely",
              "cancelled": "Invalid / Canceled"
            };

            const statusSteps: ProductOrder["status"][] = ["pending", "processing", "shipped", "delivered"];
            const currentStepIdx = statusSteps.indexOf(ord.status);

            return (
              <div key={ord.id} className="bg-white border border-[#E6E5DF] rounded-3xl p-6 space-y-6 shadow-sm hover:shadow-md transition-all">
                {/* ID Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[#FAF8F5] pb-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold bg-[#FAF8F5] border text-[#5C6460] px-2.5 py-0.5 rounded-md">
                        {ord.id}
                      </span>
                      <span className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full ${
                        ord.status === "delivered" ? "bg-emerald-100 text-emerald-800" :
                        ord.status === "cancelled" ? "bg-rose-100 text-rose-800" :
                        "bg-amber-100 text-amber-800"
                      }`}>
                        {statusLabels[ord.status]}
                      </span>
                    </div>
                    <p className="text-xs text-[#5C6460]">Placed on: <span className="font-mono font-semibold">{new Date(ord.orderDate).toLocaleString()}</span></p>
                  </div>

                  <div className="text-left md:text-right">
                    <span className="text-[10px] font-semibold text-[#5C6460] block uppercase">Settled amount</span>
                    <span className="font-mono font-bold text-lg text-[#135D39]">
                      ₦{ord.totalAmount.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Tracking Progress Timeline */}
                {ord.status !== "cancelled" && (
                  <div className="relative py-4">
                    <div className="absolute left-2 sm:left-4 md:left-[12.5%] right-[12.5%] top-1/2 -translate-y-1/2 h-1 bg-[#E6E5DF] -z-10 rounded-full hidden md:block"></div>
                    <div 
                      className="absolute left-2 sm:left-4 md:left-[12.5%] top-1/2 -translate-y-1/2 h-1 bg-emerald-600 -z-10 rounded-full hidden md:block transition-all duration-500"
                      style={{ width: `${(currentStepIdx / (statusSteps.length - 1)) * 75}%` }}
                    ></div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-0 relative z-10">
                      {statusSteps.map((step, idx) => {
                        const isDone = idx <= currentStepIdx;
                        const isActive = idx === currentStepIdx;
                        return (
                          <div key={step} className="flex flex-col items-center text-center space-y-2">
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                              isDone ? "bg-emerald-600 border-emerald-600 text-white" : "bg-white border-[#E6E5DF] text-[#5C6460]"
                            } ${isActive ? "ring-4 ring-emerald-600/10 scale-110" : ""}`}>
                              {isDone ? <Check className="w-4 h-4" /> : <span className="font-mono text-xs font-semibold">{idx+1}</span>}
                            </div>
                            <div className="text-center">
                              <span className={`text-[11px] block font-semibold ${isDone ? "text-[#1A2421]" : "text-[#5C6460]"}`}>
                                {step === "pending" ? "Order Confirmed" : step === "processing" ? "Order Prepared" : step === "shipped" ? "Dispatched" : "Arrived"}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Ordered products detail list */}
                <div className="border border-[#FAF8F5] bg-[#FAF8F5]/50 p-4 rounded-2xl space-y-3">
                  <span className="text-[10px] uppercase font-bold text-[#5C6460] tracking-wider block">Logistics Package Details</span>
                  <div className="divide-y divide-[#E6E5DF]/50 space-y-2.5">
                    {ord.items.map((it, idx) => (
                      <div key={idx} className="flex justify-between items-center text-xs pt-2 first:pt-0">
                        <div>
                          <span className="font-semibold text-[#1A2421]">{it.productName}</span>
                          <span className="text-xs text-[#5C6460] block font-mono">Quantity: {it.quantity} x ₦{it.priceAtPurchase.toLocaleString()}</span>
                        </div>
                        <span className="font-mono font-bold text-[#5C6460]">₦{(it.quantity * it.priceAtPurchase).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Delivery location address */}
                <div className="flex items-center gap-2 text-xs text-[#5C6460]">
                  <MapPin className="w-4 h-4 text-[#135D39]" />
                  <span>Shipment destination node: <strong className="text-[#1A2421]">{ord.deliveryAddress}</strong></span>
                </div>
              </div>
            );
          })}

          {orders.filter(o => o.farmerId === "aliyu_coop").length === 0 && (
            <div className="text-center py-16 bg-white border border-[#E6E5DF] rounded-3xl space-y-2">
              <Truck className="w-12 h-12 text-[#135D39]/40 mx-auto animate-bounce" />
              <h3 className="font-display font-medium text-base">No orders ordered recently</h3>
              <p className="text-xs text-[#5C6460]">Go through the category aisles and add essential seeds, feed or tools to your cart.</p>
              <button
                onClick={() => setSelectedCategory("All")}
                className="mt-2 text-xs font-bold text-[#135D39] hover:underline"
              >
                Start Shopping Now &rarr;
              </button>
            </div>
          )}
        </div>
      )}

      {/* MERCHANT PORTAL VIEWS */}
      {activeSegment === "merchant" && (
        <div id="merchant-control-view" className="space-y-6">
          <div className="p-6 bg-gradient-to-r from-amber-600 to-amber-700 text-white rounded-3xl flex flex-col md:flex-row justify-between gap-6 shadow-xl relative overflow-hidden">
            <div className="absolute right-0 bottom-0 translate-y-12 translate-x-12 w-64 h-64 bg-white/5 rounded-full blur-2xl"></div>
            <div className="space-y-1 relative z-10">
              <span className="text-[10px] uppercase font-bold tracking-widest text-amber-200">Bennie Agro Merchant Hub</span>
              <h2 className="text-2xl font-display font-medium">Independent Agri-Merchant Panel</h2>
              <p className="text-xs text-amber-100 max-w-md">Instantly publish items, adjust physical stocks, monitor incoming farmer orders or edit shipping delivery status.</p>
            </div>

            <div className="flex gap-1.5 bg-white/10 p-1 rounded-full border border-white/10 shrink-0 h-fit self-end">
              <button
                onClick={() => setMerchantSubTab("inventory")}
                className={`px-3.5 py-2 rounded-full font-semibold text-[10px] uppercase tracking-wider transition ${
                  merchantSubTab === "inventory" ? "bg-white text-amber-900" : "text-white hover:bg-white/10"
                }`}
              >
                Inventory Stock
              </button>
              <button
                onClick={() => setMerchantSubTab("list-product")}
                className={`px-3.5 py-2 rounded-full font-semibold text-[10px] uppercase tracking-wider transition ${
                  merchantSubTab === "list-product" ? "bg-white text-amber-900" : "text-white hover:bg-white/10"
                }`}
              >
                List New Item
              </button>
              <button
                onClick={() => setMerchantSubTab("orders-manage")}
                className={`px-3.5 py-2 rounded-full font-semibold text-[10px] uppercase tracking-wider transition ${
                  merchantSubTab === "orders-manage" ? "bg-white text-amber-900" : "text-white hover:bg-white/10"
                }`}
              >
                Manage Orders ({orders.length})
              </button>
            </div>
          </div>

          {/* SCRIPT SUBVIEWS */}
          {merchantSubTab === "inventory" && (
            <div className="bg-white border border-[#E6E5DF] rounded-3xl p-6 space-y-4">
              <h3 className="font-display font-semibold text-base text-[#1A2421]">Merchant Inventory Control</h3>
              <p className="text-xs text-[#5C6460]">Instantly modify physical stocks inside active cooperative depots. Changes synchronize directly for farmers.</p>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left divide-y divide-[#E6E5DF]">
                  <thead>
                    <tr className="text-xs text-[#5C6460] uppercase">
                      <th className="py-3 px-4">Product Name</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">Unit Rate</th>
                      <th className="py-3 px-4">Current Stock</th>
                      <th className="py-3 text-right px-4">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#FAF8F5]">
                    {products.map(prod => (
                      <tr key={prod.id} className="hover:bg-[#FAF8F5]/40 text-[#1A2421]">
                        <td className="py-4 px-4 font-semibold">{prod.name}</td>
                        <td className="py-4 px-4 font-mono">{prod.category}</td>
                        <td className="py-4 px-4 font-mono">₦{prod.price.toLocaleString()} / {prod.unit}</td>
                        <td className="py-4 px-4 font-bold text-[#135D39]">
                          <span className={prod.stock === 0 ? "text-rose-600" : ""}>
                            {prod.stock} unit{prod.stock !== 1 ? "s" : ""}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => onUpdateProductStock(prod.id, Math.max(0, prod.stock - 5))}
                              className="bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold px-2 py-1 rounded cursor-pointer"
                              title="Deduct Stock 5"
                            >
                              -5
                            </button>
                            <button
                              onClick={() => onUpdateProductStock(prod.id, prod.stock + 5)}
                              className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-2 py-1 rounded cursor-pointer"
                              title="Add Stock 5"
                            >
                              +5
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {merchantSubTab === "list-product" && (
            <div className="bg-white border border-[#E6E5DF] rounded-3xl p-6 md:p-8 max-w-2xl mx-auto space-y-6">
              <h3 className="font-display font-medium text-lg text-[#1A2421]">Register New Item on Cooperative Marketplace</h3>
              
              <form onSubmit={handleAddProductSubmit} className="space-y-4 text-xs font-semibold">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[#1A2421]">Aisle Product Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Premium White Maize Seed Bundle"
                      value={prodName}
                      onChange={(e) => setProdName(e.target.value)}
                      className="w-full p-2.5 bg-white border border-[#E6E5DF] rounded-xl focus:outline-none"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[#1A2421]">Category Class</label>
                    <select
                      value={prodCategory}
                      onChange={(e) => setProdCategory(e.target.value as ProductCategoryName)}
                      className="w-full p-2.5 bg-white border border-[#E6E5DF] rounded-xl focus:outline-none"
                    >
                      {CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-[#1A2421]">Unit Retail Price (₦)</label>
                    <input
                      type="number"
                      value={prodPrice}
                      onChange={(e) => setProdPrice(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full p-2.5 bg-white border border-[#E6E5DF] rounded-xl focus:outline-none"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[#1A2421]">Shipment Unit Weight</label>
                    <input
                      type="text"
                      placeholder="e.g. 50kg bag, 1L bottle"
                      value={prodUnit}
                      onChange={(e) => setProdUnit(e.target.value)}
                      className="w-full p-2.5 bg-white border border-[#E6E5DF] rounded-xl focus:outline-none"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[#1A2421]">Initial Stock Position</label>
                    <input
                      type="number"
                      value={prodStock}
                      onChange={(e) => setProdStock(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full p-2.5 bg-white border border-[#E6E5DF] rounded-xl focus:outline-none"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[#1A2421]">General Description / Usage Guidelines</label>
                  <textarea
                    rows={3}
                    placeholder="Provide depth on agronomy instructions, chemical concentration levels or storage conditions..."
                    value={prodDesc}
                    onChange={(e) => setProdDesc(e.target.value)}
                    className="w-full p-3 border border-[#E6E5DF] rounded-xl focus:outline-none"
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 rounded-xl transition shadow-md shadow-amber-600/10 cursor-pointer"
                >
                  Publish Item Live
                </button>
              </form>
            </div>
          )}

          {merchantSubTab === "orders-manage" && (
            <div className="bg-white border border-[#E6E5DF] rounded-3xl p-6 space-y-4">
              <h3 className="font-display font-semibold text-base text-[#1A2421]">Merchant Shipping & Order Manager</h3>
              <p className="text-xs text-[#5C6460]">Update delivery tracking tags for cooperative customers. Each update triggers notification reports on farmer dashboards instantly.</p>

              <div className="space-y-4 pt-2">
                {orders.map(order => (
                  <div key={order.id} className="border border-[#E6E5DF] rounded-2xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:bg-[#FAF8F5]/30">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-[#5C6460] bg-[#FAF8F5] border px-2 py-0.5 rounded">
                          {order.id}
                        </span>
                        <span className="font-bold text-xs text-[#1A2421]">
                          Farmer: {order.farmerName}
                        </span>
                      </div>
                      <p className="text-xs text-[#5C6460] mt-1">
                        Amount: <strong className="text-amber-700 font-mono">₦{order.totalAmount.toLocaleString()}</strong> • Items: {order.items.map(it => `${it.productName} (x${it.quantity})`).join(", ")}
                      </p>
                      <p className="text-[11px] text-[#5C6460] mt-0.5">Address: {order.deliveryAddress}</p>
                    </div>

                    <div className="flex items-center gap-1.5 bg-[#FAF8F5] border border-[#E6E5DF] p-1.5 rounded-xl">
                      <span className="text-[10px] uppercase font-bold text-[#5C6460] px-2">Status:</span>
                      <select
                        value={order.status}
                        onChange={(e) => onUpdateOrderStatus(order.id, e.target.value as ProductOrder["status"])}
                        className="p-1 px-2.5 bg-white border rounded text-xs select focus:outline-none"
                      >
                        <option value="pending">Pending</option>
                        <option value="processing">Processing</option>
                        <option value="shipped">Shipped</option>
                        <option value="delivered">Delivered</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </div>
                  </div>
                ))}

                {orders.length === 0 && (
                  <div className="text-center py-12 text-[#5C6460] italic text-xs">
                    No active farmer orders placed yet.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* SHOPPING CART BOTTOM SLIDE-OUT SHEET */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 bg-[#1A2421]/60 backdrop-blur-sm flex justify-end animate-fade-in">
          <div className="bg-white w-full max-w-md h-full flex flex-col justify-between shadow-2xl animate-slide-in relative border-l border-[#E6E5DF]">
            
            {/* Header */}
            <div className="p-6 border-b border-[#E6E5DF] flex justify-between items-center bg-[#135D39]/5">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-[#135D39]" />
                <h3 className="font-display font-medium text-lg text-[#1A2421]">Cooperative Checkout</h3>
              </div>
              <button
                onClick={() => setIsCartOpen(false)}
                className="p-1.5 hover:bg-slate-100 rounded-lg transition text-[#5C6460] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Cart list content */}
            <div className="flex-grow overflow-y-auto p-6 space-y-4 divide-y divide-[#E6E5DF]/65">
              {cartSummaryItems.map(({ item, product, cost }) => (
                <div key={item.id} className="pt-4 first:pt-0 flex justify-between gap-3 text-xs">
                  <div className="space-y-1 flex-grow">
                    <h5 className="font-semibold text-[#1A2421] leading-snug">{product?.name}</h5>
                    <p className="text-[11px] text-[#5C6460]">₦{product?.price.toLocaleString()} / {product?.unit}</p>
                    
                    <div className="flex items-center gap-2 mt-1.5">
                      <button
                        onClick={() => onUpdateCartQty(item.id, Math.max(1, item.quantity - 1))}
                        className="bg-[#FAF8F5] hover:bg-[#E6E5DF]/50 border border-[#E6E5DF] text-[#1A2421] font-bold w-6 h-6 rounded flex items-center justify-center cursor-pointer"
                      >
                        -
                      </button>
                      <span className="font-mono font-bold px-1.5">{item.quantity}</span>
                      <button
                        onClick={() => onUpdateCartQty(item.id, item.quantity + 1)}
                        className="bg-[#FAF8F5] hover:bg-[#E6E5DF]/50 border border-[#E6E5DF] text-[#1A2421] font-bold w-6 h-6 rounded flex items-center justify-center cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="text-right flex flex-col justify-between shrink-0">
                    <button
                      onClick={() => onRemoveFromCart(item.id)}
                      className="text-rose-600 hover:text-rose-800 self-end p-1 transition cursor-pointer"
                      title="Remove product"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <span className="font-mono font-bold text-[#135D39] block mt-1">₦{cost.toLocaleString()}</span>
                  </div>
                </div>
              ))}

              {cart.length === 0 && (
                <div className="text-center py-16 text-[#5C6460] italic space-y-2">
                  <ShoppingCart className="w-10 h-10 mx-auto text-[#135D39]/30" />
                  <p>Your basket is currently empty.</p>
                </div>
              )}
            </div>

            {/* Form & checkout bottom button */}
            <div className="p-6 border-t border-[#E6E5DF] bg-[#FAF8F5]/50 space-y-5">
              <form onSubmit={handleProcessCheckout} className="space-y-4">
                <div className="space-y-1 text-xs">
                  <label className="font-bold text-[#1A2421] block">Delivery Location Node</label>
                  <input
                    type="text"
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    className="w-full p-2.5 bg-white border border-[#E6E5DF] rounded-xl focus:outline-none"
                    required
                  />
                </div>

                <div className="border-t border-[#E6E5DF] pt-4 space-y-2 text-xs">
                  <div className="flex justify-between items-center font-display font-medium text-sm">
                    <span className="text-[#5C6460]">Total Order Price:</span>
                    <span className="font-mono font-bold text-lg text-[#135D39]">₦{cartTotalCost.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-[#5C6460]">
                    <span>Cooperative Wallet Balance:</span>
                    <strong className="text-[#1A2421]">₦{state.walletBalance.toLocaleString()}</strong>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={cart.length === 0}
                  className={`w-full font-bold py-3 rounded-xl transition text-center text-xs flex items-center justify-center gap-1.5 shadow-md cursor-pointer ${
                    cart.length > 0 
                      ? "bg-[#135D39] hover:bg-[#0B3921] text-white shadow-[#135D39]/15" 
                      : "bg-slate-100 text-slate-400 border shadow-none cursor-not-allowed"
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" /> Place Order & checkout
                </button>
              </form>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
