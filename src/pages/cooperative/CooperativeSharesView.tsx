/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { 
  TrendingUp, 
  ArrowUpRight, 
  Award, 
  Percent, 
  PlusCircle, 
  MinusCircle, 
  AlertCircle, 
  Calendar, 
  History, 
  ChevronRight, 
  Sparkles
} from "lucide-react";
import { FarmerAppState } from "../../types";

interface CooperativeSharesViewProps {
  state: FarmerAppState;
  onBuyShares: (sharesCount: number, price: number) => void;
  onSellShares: (sharesCount: number, price: number) => void;
  onClaimDividends: () => void;
}

export default function CooperativeSharesView({
  state,
  onBuyShares,
  onSellShares,
  onClaimDividends
}: CooperativeSharesViewProps) {
  const [tradeType, setTradeType] = useState<"buy" | "sell">("buy");
  const [sharesVol, setSharesVol] = useState<number | "">("");

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const sharePrice = state.shares.currentSharePrice;
  const totalValuation = state.shares.sharesOwned * sharePrice;
  const paperProfit = Math.max(0, totalValuation - state.shares.bookValue);
  const profitPct = state.shares.bookValue > 0 ? ((paperProfit / state.shares.bookValue) * 100).toFixed(1) : "0.0";

  const totalCostBasisOrProceeds = Number(sharesVol) * sharePrice;

  // Handle buy or sell trigger
  const handleTradingActionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const count = Number(sharesVol);
    if (!count || count <= 0) {
      alert("Please enter a valid amount of shares.");
      return;
    }

    if (tradeType === "buy") {
      const neededFunds = count * sharePrice;
      if (state.walletBalance < neededFunds) {
        alert(`Insufficient funds in wallet! Total cost is ${formatCurrency(neededFunds)}. Please fund your wallet first.`);
        return;
      }
      onBuyShares(count, sharePrice);
      alert(`Success! Purchased ${count} Cooperative Shares at ₦${sharePrice}/Share.`);
    } else {
      if (state.shares.sharesOwned < count) {
        alert(`Insufficient shares! You only own ${state.shares.sharesOwned} shares.`);
        return;
      }
      onSellShares(count, sharePrice);
      alert(`Success! Liquidated ${count} Cooperative Shares at ₦${sharePrice}/Share. Funds transferred to wallet.`);
    }
    setSharesVol("");
  };

  const handleClaimImmediateDividends = () => {
    if (state.shares.totalDividendsEarned <= 0) {
      alert("No claimable cooperative dividends accumulated yet.");
      return;
    }
    const amountToClaim = state.shares.totalDividendsEarned;
    onClaimDividends();
    alert(`Success! Outstanding cooperative dividend of ${formatCurrency(amountToClaim)} was claimed to your Digital Wallet balance.`);
  };

  // Custom SVG path drawing calculations for Share Growth
  const priceHistory = state.shares.priceTrend;
  const chartHeight = 140;
  const chartWidth = 520;
  const padding = 25;
  
  const minPrice = Math.min(...priceHistory.map(t => t.price)) * 0.95;
  const maxPrice = Math.max(...priceHistory.map(t => t.price)) * 1.05;
  const priceRange = maxPrice - minPrice;

  const points = priceHistory.map((item, index) => {
    const x = padding + (index / (priceHistory.length - 1)) * (chartWidth - padding * 2);
    const y = chartHeight - padding - ((item.price - minPrice) / priceRange) * (chartHeight - padding * 1.8);
    return { x, y, ...item };
  });

  const pathD = points.length > 0 
    ? `M ${points[0].x} ${points[0].y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(" ")
    : "";

  const areaD = points.length > 0
    ? `${pathD} L ${points[points.length - 1].x} ${chartHeight - padding} L ${points[0].x} ${chartHeight - padding} Z`
    : "";

  return (
    <div className="space-y-8 animate-fade-in px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      
      {/* Title */}
      <div>
        <h1 className="text-2xl md:text-3xl font-display font-medium text-[#1A2421] tracking-tight">
          Cooperative Share Trading
        </h1>
        <p className="text-sm text-[#5C6460] mt-1">
          Invest directly in high-performance agro-cooperative initiatives. Trade shares and accumulate dividends.
        </p>
      </div>

      {/* Stats Matrix Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Share Price */}
        <div className="bg-white rounded-3xl p-5 border border-[#E6E5DF] shadow-sm">
          <span className="text-[10px] text-[#5C6460] uppercase tracking-widest font-bold">Standard Share Value</span>
          <h3 className="font-mono text-2xl font-bold text-[#1A2421] mt-1">
            ₦{sharePrice.toLocaleString()} <span className="text-xs text-[#5C6460]">/ unit</span>
          </h3>
          <p className="text-xs text-[#135D39] font-bold flex items-center gap-1 mt-1.5 font-sans">
            <ArrowUpRight className="w-3.5 h-3.5" /> +13.4% this cycle
          </p>
        </div>

        {/* Portfolio Valuation */}
        <div className="bg-white rounded-3xl p-5 border border-[#E6E5DF] shadow-sm">
          <span className="text-[10px] text-[#5C6460] uppercase tracking-widest font-bold">My Portfolio Value</span>
          <h3 className="font-mono text-2xl font-bold text-[#1A2421] mt-1">
            {formatCurrency(totalValuation)}
          </h3>
          <p className="text-xs text-[#5C6460] mt-1.5 font-semibold">
            Total units owned: <span className="font-bold text-[#1A2421]">{state.shares.sharesOwned.toLocaleString()}</span>
          </p>
        </div>

        {/* Capital Earnings / Paper Profit */}
        <div className="bg-white rounded-3xl p-5 border border-[#E6E5DF] shadow-sm">
          <span className="text-[10px] text-[#5C6460] uppercase tracking-widest font-bold">Capital Value Growth</span>
          <h3 className="font-mono text-2xl font-bold text-emerald-700 mt-1">
            +{formatCurrency(paperProfit)}
          </h3>
          <p className="text-xs text-[#135D39] font-bold flex items-center gap-1 mt-1.5 font-sans">
            <Percent className="w-3.5 h-3.5" /> +{profitPct}% Net Yield
          </p>
        </div>

        {/* Dividends Earned */}
        <div className="bg-white rounded-3xl p-5 border border-[#E6E5DF] shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-[10px] text-[#5C6460] uppercase tracking-widest font-bold">Cooperative Dividends</span>
            <h3 className="font-mono text-2xl font-bold text-[#1A2421] mt-1">
              {formatCurrency(state.shares.totalDividendsEarned)}
            </h3>
          </div>
          
          {state.shares.totalDividendsEarned > 0 && (
            <button 
              onClick={handleClaimImmediateDividends}
              className="mt-3 text-xs font-bold text-[#135D39] hover:text-[#0f4a2d] flex items-center gap-1.5 self-start bg-[#135D39]/10 px-3 py-1 rounded-xl border border-[#135D39]/15 cursor-pointer transition"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#E7A13C] animate-spin" /> Claim to Wallet
            </button>
          )}
        </div>

      </div>

      {/* Main Grid: Left = Growth Chart & Dividends, Right = Trading Desk */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Panel - Share Growth graph */}
        <div className="lg:col-span-8 space-y-8">
          
          {/* Share Growth chart component */}
          <div className="bg-white border border-[#E6E5DF] rounded-3xl p-6 shadow-sm">
            <div className="flex justify-between items-center border-b border-[#E6E5DF] pb-4 mb-4 flex-wrap gap-4">
              <div>
                <h3 className="font-display font-semibold text-[#1A2421] text-base">Cooperative Share Price Growth</h3>
                <p className="text-xs text-[#5C6460] mt-0.5 font-semibold">Historical price trend per cooperative share (Oct 2025 - Present)</p>
              </div>

              {/* Annualized Returns Metric */}
              <div className="bg-[#135D39]/10 text-[#135D39] px-3 py-1 rounded-full border border-[#135D39]/15 text-xs font-bold flex items-center gap-1">
                <Percent className="w-3.5 h-3.5" /> {state.shares.annualReturnsRate}% Annual Return (CAGR)
              </div>
            </div>

            {/* Custom SVG Line Chart */}
            <div className="w-full overflow-x-auto pt-3">
              <div className="min-w-[540px]">
                <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-auto">
                  <defs>
                    <linearGradient id="chartAreaGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#135D39" stopOpacity="0.12" />
                      <stop offset="100%" stopColor="#135D39" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal gridlines */}
                  {[0, 1, 2].map((gLine) => {
                    const yVal = padding + (gLine / 2) * (chartHeight - padding * 2);
                    return (
                      <line 
                        key={gLine}
                        x1={padding}
                        y1={yVal}
                        x2={chartWidth - padding}
                        y2={yVal}
                        stroke="#135D39"
                        strokeOpacity="0.1"
                        strokeWidth="0.5"
                        strokeDasharray="4 4"
                      />
                    );
                  })}

                  {/* Graph Area */}
                  <path d={areaD} fill="url(#chartAreaGradient)" />

                  {/* Price Line */}
                  <path 
                    d={pathD} 
                    fill="none" 
                    stroke="#135D39" 
                    strokeWidth="2.5" 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                  />

                  {/* Nodes */}
                  {points.map((p, idx) => (
                    <g key={idx} className="group cursor-pointer">
                      <circle 
                        cx={p.x} 
                        cy={p.y} 
                        r="4" 
                        fill="#135D39" 
                        stroke="#ffffff" 
                        strokeWidth="1.5" 
                      />
                      <text 
                        x={p.x} 
                        y={p.y - 10} 
                        textAnchor="middle" 
                        fontSize="9" 
                        fontWeight="bold" 
                        fill="#1A2421"
                        className="opacity-0 group-hover:opacity-100 transition-opacity font-mono"
                      >
                        ₦{p.price}
                      </text>
                      
                      <text 
                        x={p.x} 
                        y={chartHeight - 6} 
                        textAnchor="middle" 
                        fontSize="8" 
                        fontWeight="bold" 
                        fill="#5C6460"
                        className="font-sans"
                      >
                        {p.date}
                      </text>
                    </g>
                  ))}
                </svg>
              </div>
            </div>
          </div>

          {/* Share trading ledger records */}
          <div className="bg-white border border-[#E6E5DF] rounded-3xl p-6 shadow-sm">
            <h3 className="font-display font-semibold text-[#1A2421] text-base mb-4 flex items-center gap-2">
              <History className="w-5 h-5 text-[#5C6460]" /> Share Ledger Transactions
            </h3>

            {state.shares.history.length === 0 ? (
              <p className="text-xs text-[#5C6460] py-6 text-center font-medium">No share trading records found</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[#E6E5DF] text-[#5C6460] font-medium">
                      <th className="py-2.5 font-semibold">Trade ID</th>
                      <th className="py-2.5 font-semibold">Execution Date</th>
                      <th className="py-2.5 font-semibold">Type</th>
                      <th className="py-2.5 font-semibold">Share Count</th>
                      <th className="py-2.5 font-semibold">Share Price</th>
                      <th className="py-2.5 font-semibold text-right">Volume Fee</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E6E5DF] text-[#5C6460]">
                    {state.shares.history.map((tx) => (
                      <tr key={tx.id} className="hover:bg-[#FAF8F5] transition-all text-[#1A2421]">
                        <td className="py-2.5 font-mono text-[#5C6460] font-semibold">{tx.id}</td>
                        <td className="py-2.5 font-mono text-[#5C6460]">{new Date(tx.date).toLocaleDateString() || "Recent"}</td>
                        <td className="py-2.5">
                          <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${
                            tx.type === "buy" ? "bg-emerald-50 text-[#135D39] border border-emerald-150" : "bg-rose-50 text-rose-700 border border-thin border-rose-150"
                          }`}>
                            {tx.type}
                          </span>
                        </td>
                        <td className="py-2.5 font-bold font-mono">{tx.sharesCount.toLocaleString()} Shares</td>
                        <td className="py-2.5 font-mono text-[#5C6460]">₦{tx.pricePerShare}/unit</td>
                        <td className="py-2.5 text-right font-mono font-bold text-[#1A2421]">
                          {formatCurrency(tx.totalAmount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>

        {/* Right Panel - Trading Desk */}
        <div className="lg:col-span-4 space-y-6 flex flex-col justify-between">
          
          <div className="bg-white border border-[#E6E5DF] rounded-3xl p-6 shadow-sm">
            <h3 className="font-display font-semibold text-[#1A2421] text-base">Agro-Investment Desk</h3>
            <p className="text-xs text-[#5C6460] mt-1 pr-2">Purchase mutual shares to raise capital yields or liquidate holding assets.</p>

            <form onSubmit={handleTradingActionSubmit} className="mt-6 space-y-5">
              
              {/* Buy or Sell Switchers */}
              <div className="flex bg-[#FAF8F5] p-1.5 rounded-2xl border border-[#E6E5DF]">
                <button
                  type="button"
                  onClick={() => setTradeType("buy")}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition cursor-pointer ${
                    tradeType === "buy" 
                      ? "bg-[#135D39] text-white shadow-sm font-bold" 
                      : "text-[#5C6460] hover:text-[#1A2421]"
                  }`}
                >
                  <PlusCircle className="w-3.5 h-3.5" /> Buy Units
                </button>
                <button
                  type="button"
                  onClick={() => setTradeType("sell")}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition cursor-pointer ${
                    tradeType === "sell" 
                      ? "bg-rose-700 text-white shadow-sm font-bold" 
                      : "text-[#5C6460] hover:text-[#1A2421]"
                  }`}
                >
                  <MinusCircle className="w-3.5 h-3.5" /> Liquidate
                </button>
              </div>

              {/* Shares input details */}
              <div className="space-y-1.5">
                <label className="text-xs text-[#5C6460] font-bold uppercase tracking-wider block">Quantity of Share Units</label>
                <input 
                  type="number" 
                  required
                  placeholder="e.g. 100"
                  value={sharesVol}
                  onChange={(e) => setSharesVol(e.target.value === "" ? "" : Number(e.target.value))}
                  className="w-full bg-[#FAF8F5] border border-[#E6E5DF] focus:outline-[#135D39]/30 p-2.5 rounded-xl font-mono text-sm font-bold text-[#1A2421]"
                />
              </div>

              {/* Valuation details */}
              <div className="bg-[#FAF8F5] border border-[#E6E5DF] p-3.5 rounded-2xl space-y-2 text-xs text-[#5C6460]">
                <div className="flex justify-between">
                  <span>Current unit Valuation:</span>
                  <span className="font-mono text-[#1A2421] font-bold">₦{sharePrice}/unit</span>
                </div>
                <div className="flex justify-between pt-1.5 border-t border-[#E6E5DF]">
                  <span className="font-semibold text-[#1A2421]">{tradeType === "buy" ? "Total Cost Outflow" : "Total Cash Proceeds"}:</span>
                  <span className="font-mono font-bold text-[#135D39] text-sm">
                    {sharesVol ? formatCurrency(totalCostBasisOrProceeds) : "₦0.00"}
                  </span>
                </div>
              </div>

              {/* Portfolio stats */}
              <div className="text-[10.5px] text-[#5C6460] font-medium leading-relaxed">
                {tradeType === "buy" ? (
                  <span>Available digital wallet: <b className="font-mono text-[#1A2421]">{formatCurrency(state.walletBalance)}</b></span>
                ) : (
                  <span>Valued shares holding: <b className="font-mono text-[#1A2421]">{state.shares.sharesOwned} Shares ({formatCurrency(totalValuation)})</b></span>
                )}
              </div>

              <button
                type="submit"
                className={`w-full font-bold py-3 px-4 rounded-xl text-xs transition border border-transparent shadow-sm cursor-pointer ${
                  tradeType === "buy" 
                    ? "bg-[#135D39] text-white hover:bg-[#0f4a2d] border-[#135D39]/15" 
                    : "bg-rose-700 text-white hover:bg-rose-800"
                }`}
              >
                {tradeType === "buy" ? `Acquire shares units` : `Liquidate shares holding`}
              </button>

            </form>
          </div>

          {/* Investment disclaimer protection */}
          <div className="bg-[#FAF8F5] text-[#5C6460] rounded-3xl p-5 text-xs space-y-2 border border-[#E6E5DF] mt-4 shadow-sm">
            <h4 className="font-bold text-[#1A2421] flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-[#E7A13C] shrink-0" /> Co-Op Trust Compliance
            </h4>
            <p className="leading-relaxed text-[#5C6460] text-[11px] font-semibold">
              Cooperative shares fluctuate according to seasonal harvest outputs and global commodity indices. Dividends are declared quarterly by the executive steering committee.
            </p>
          </div>

        </div>

      </div>

    </div>
  );
}
