'use client';

import React, { useState, useEffect } from 'react';
import { cloudDb } from '@/lib/cloudDb';
import { db } from '@/lib/db';
import { 
  DollarSign, 
  Percent, 
  Award, 
  Activity, 
  Plus, 
  AlertTriangle,
  Clock,
  Download,
  TrendingUp,
  TrendingDown 
} from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const router = useRouter();

  // Active Sidebar Account / Group Filter Selection State
  const [activeFilterSelection, setActiveFilterSelection] = useState<{ 
    type: 'global' | 'group' | 'account'; 
    name: string 
  }>({ type: 'global', name: 'All Accounts' });

  const [rawTrades, setRawTrades] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [strategies, setStrategies] = useState<any[]>([]);
  const [mistakeTagsList, setMistakeTagsList] = useState<any[]>([]);

  useEffect(() => {
    async function loadData() {
      const tradesData = await cloudDb.getTrades();
      const accountsData = await cloudDb.getAccounts();
      const strats = await db.strategies.toArray();
      const mistakesList = await db.mistakes.toArray();

      setRawTrades(tradesData);
      setAccounts(accountsData);
      setStrategies(strats);
      setMistakeTagsList(mistakesList);
    }
    loadData();
  }, []);

  // Listen to sidebar account filter changes
  useEffect(() => {
    const handleAccountFilterChanged = (e: any) => {
      const detail = e.detail;
      if (detail === 'All Accounts') {
        setActiveFilterSelection({ type: 'global', name: 'All Accounts' });
      } else if (typeof detail === 'object' && detail.type === 'group') {
        setActiveFilterSelection({ type: 'group', name: detail.name });
      } else {
        setActiveFilterSelection({ 
          type: 'account', 
          name: typeof detail === 'object' ? detail.name : detail 
        });
      }
    };

    window.addEventListener('account-filter-changed', handleAccountFilterChanged);
    return () => window.removeEventListener('account-filter-changed', handleAccountFilterChanged);
  }, []);

  // Filter trades based on active sidebar account/group selection
  const trades = rawTrades.filter((trade) => {
    if (activeFilterSelection.type === 'account') {
      if (trade.account !== activeFilterSelection.name) return false;
    } else if (activeFilterSelection.type === 'group') {
      const groupAccounts = accounts
        .filter(a => a.groupName === activeFilterSelection.name)
        .map(a => a.name);
      if (!trade.account || !groupAccounts.includes(trade.account)) return false;
    }
    return true;
  });

  // Active validation sets
  const activeStrategies = new Set(strategies.map(s => s.name));
  const activeMistakes = new Set(mistakeTagsList.map(m => m.name));

  // Hover state for interactive equity curve
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);
  const accountName = activeFilterSelection.name;

  // Calculations
  const totalPnL = trades.reduce((acc, t) => acc + (t.netPnL || 0), 0);
  const winTrades = trades.filter(t => (t.netPnL || 0) > 0);
  const lossTrades = trades.filter(t => (t.netPnL || 0) < 0);
  const winRate = trades.length > 0 ? ((winTrades.length / trades.length) * 100).toFixed(1) : '0';

  const grossWins = winTrades.reduce((acc, t) => acc + t.netPnL, 0);
  const grossLosses = Math.abs(lossTrades.reduce((acc, t) => acc + t.netPnL, 0));
  const profitFactor = grossLosses > 0 ? (grossWins / grossLosses).toFixed(2) : grossWins > 0 ? '99.00' : '0.00';

  // Mistake Impact Analytics
  const mistakeMap: Record<string, { count: number; totalCost: number }> = {};
  trades.forEach(t => {
    if (t.mistakeTag) {
      if (!mistakeMap[t.mistakeTag]) {
        mistakeMap[t.mistakeTag] = { count: 0, totalCost: 0 };
      }
      mistakeMap[t.mistakeTag].count += 1;
      if ((t.netPnL || 0) < 0) {
        mistakeMap[t.mistakeTag].totalCost += Math.abs(t.netPnL);
      }
    }
  });

  const topMistakes = Object.entries(mistakeMap)
    .sort((a, b) => b[1].totalCost - a[1].totalCost)
    .slice(0, 4);

  // Strategy Performance Map for Report
  const strategyMap: Record<string, { count: number; pnl: number }> = {};
  trades.forEach(t => {
    if (t.strategy) {
      if (!strategyMap[t.strategy]) strategyMap[t.strategy] = { count: 0, pnl: 0 };
      strategyMap[t.strategy].count += 1;
      strategyMap[t.strategy].pnl += (t.netPnL || 0);
    }
  });

  // Last 5 trades for the printable report summary
  const reportTrades = [...trades]
    .sort((a, b) => new Date(`${b.openDate} ${b.entryTime || '00:00'}`).getTime() - new Date(`${a.openDate} ${a.entryTime || '00:00'}`).getTime())
    .slice(0, 5);

  // Market Session Breakdown (Central Time - CME RTH: 8:30 AM to 3:00 PM CT)
  const sessionMap: Record<string, { count: number; pnl: number }> = {
    'RTH AM': { count: 0, pnl: 0 },
    'RTH PM': { count: 0, pnl: 0 },
    'Globex': { count: 0, pnl: 0 }
  };

  trades.forEach(t => {
    const timeStr = (t.entryTime || t.entry_time || '08:30').toString().replace(/\u202f/g, ' ').trim();
    let timeDecimal = 8.5;

    if (timeStr.includes('AM') || timeStr.includes('PM')) {
      const [timePart, modifier] = timeStr.split(' ');
      const [hStr, mStr] = timePart.split(':');
      let h = parseInt(hStr || '8', 10);
      const m = parseInt(mStr || '30', 10);
      if (modifier === 'PM' && h < 12) h += 12;
      if (modifier === 'AM' && h === 12) h = 0;
      timeDecimal = h + m / 60;
    } else {
      const [hStr, mStr] = timeStr.split(':');
      const h = parseInt(hStr || '8', 10);
      const m = parseInt(mStr || '30', 10);
      timeDecimal = h + m / 60;
    }

    if (timeDecimal >= 8.5 && timeDecimal < 12.0) {
      sessionMap['RTH AM'].count += 1;
      sessionMap['RTH AM'].pnl += (t.netPnL || 0);
    } else if (timeDecimal >= 12.0 && timeDecimal <= 15.0) {
      sessionMap['RTH PM'].count += 1;
      sessionMap['RTH PM'].pnl += (t.netPnL || 0);
    } else {
      sessionMap['Globex'].count += 1;
      sessionMap['Globex'].pnl += (t.netPnL || 0);
    }
  });

  // Build Chronological Cumulative P&L History for Interactive Equity Curve SVG
  const chronologicalTrades = [...trades].sort((a, b) => {
    const dateA = new Date(`${a.openDate} ${a.entryTime || '00:00'}`).getTime();
    const dateB = new Date(`${b.openDate} ${b.entryTime || '00:00'}`).getTime();
    return dateA - dateB;
  });

  let runningSum = 0;
  const cumulativePoints = chronologicalTrades.map(t => {
    runningSum += (t.netPnL || 0);
    return { pnl: runningSum, date: t.openDate, symbol: t.symbol, tradePnL: t.netPnL };
  });

  const equityData = [{ pnl: 0, date: 'Start', symbol: 'Baseline', tradePnL: 0 }, ...cumulativePoints];
  const minVal = Math.min(...equityData.map(d => d.pnl), 0);
  const maxVal = Math.max(...equityData.map(d => d.pnl), 10);
  const range = maxVal - minVal || 1;

  // SVG viewBox dimensions
  const svgWidth = 900;
  const svgHeight = 360;

  const pointsCoordinates = equityData.map((d, idx) => {
    const x = (idx / (equityData.length - 1 || 1)) * svgWidth;
    const y = svgHeight - ((d.pnl - minVal) / range) * (svgHeight - 60) - 30;
    return { x, y, ...d };
  });

  // Calculate Peak & Trough indices
  let peakIndex = 0;
  let troughIndex = 0;
  pointsCoordinates.forEach((p, idx) => {
    if (p.pnl > pointsCoordinates[peakIndex].pnl) peakIndex = idx;
    if (p.pnl < pointsCoordinates[troughIndex].pnl) troughIndex = idx;
  });
  const peakPoint = pointsCoordinates[peakIndex];
  const troughPoint = pointsCoordinates[troughIndex];

  const baselineY = svgHeight - ((0 - minVal) / range) * (svgHeight - 60) - 30;
  const polylineStr = pointsCoordinates.map(p => `${p.x},${p.y}`).join(' ');

  const activeIndex = hoveredPointIndex !== null ? hoveredPointIndex : pointsCoordinates.length - 1;
  const activeHoverData = pointsCoordinates[activeIndex] || pointsCoordinates[0];

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * svgWidth;

    let nearestIndex = 0;
    let minDistance = Infinity;

    pointsCoordinates.forEach((p, idx) => {
      const dist = Math.abs(p.x - mouseX);
      if (dist < minDistance) {
        minDistance = dist;
        nearestIndex = idx;
      }
    });

    setHoveredPointIndex(nearestIndex);
  };

  const handleDownloadReport = () => {
    window.print();
  };

  return (
    <div className="p-8 bg-[#F8F9FD] min-h-screen text-slate-800 font-sans space-y-8 w-full max-w-[1700px] mx-auto">
      
      {/* Header (Hidden in Print) */}
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard & Reports</h1>
          {activeFilterSelection.type !== 'global' ? (
            <p className="text-xs font-bold text-[#ec3044] mt-0.5">
              Scoped to {activeFilterSelection.type === 'group' ? 'Group:' : 'Account:'} {activeFilterSelection.name}
            </p>
          ) : (
            <p className="text-xs text-slate-500 mt-0.5">Real-time performance analytics, behavioral evaluation, and certified broker reporting.</p>
          )}
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={handleDownloadReport}
            className="flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold px-4 py-2 rounded-xl text-sm shadow-sm transition cursor-pointer"
          >
            <Download className="w-4 h-4 text-[#ec3044]" /> Download Certified Report
          </button>
          
          <button 
            onClick={() => router.push('/trade-view')}
            className="flex items-center gap-2 bg-[#ec3044] hover:bg-[#d4283b] text-white font-bold px-4 py-2 rounded-xl text-sm shadow-sm transition cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Go to Trade View
          </button>
        </div>
      </div>

      {/* KPI Cards (Hidden in Print) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 print:hidden">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm flex flex-col justify-between h-32">
          <div className="text-sm font-semibold text-slate-500 flex items-center justify-between">
            <span>Net P&L</span>
            <DollarSign className="w-4 h-4 text-slate-400" />
          </div>
          <div className={`text-3xl font-bold ${totalPnL >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
            {totalPnL >= 0 ? `$${totalPnL.toFixed(2)}` : `-$${Math.abs(totalPnL).toFixed(2)}`}
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm flex flex-col justify-between h-32">
          <div className="text-sm font-semibold text-slate-500 flex items-center justify-between">
            <span>Win Rate</span>
            <Percent className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-3xl font-bold text-slate-900">{winRate}%</div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm flex flex-col justify-between h-32">
          <div className="text-sm font-semibold text-slate-500 flex items-center justify-between">
            <span>Profit Factor</span>
            <Award className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-3xl font-bold text-slate-900">{profitFactor}</div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm flex flex-col justify-between h-32">
          <div className="text-sm font-semibold text-slate-500 flex items-center justify-between">
            <span>Total Trades</span>
            <Activity className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-3xl font-bold text-slate-900">{trades.length}</div>
        </div>
      </div>

      {/* EQUITY CURVE WITH PEAK & TROUGH WATERMARKS */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-6 space-y-4 w-full print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Equity Curve Performance</h2>
            <p className="text-[11px] text-slate-400">Hover across the chart to inspect chronological balance milestones</p>
          </div>
          
          {/* Peak & Trough Water Marks Badges */}
          <div className="flex items-center gap-4 text-xs font-mono">
            {peakPoint && (
              <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-xl text-emerald-700 font-bold">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                <span>Peak: ${peakPoint.pnl.toFixed(2)}</span>
              </div>
            )}
            {troughPoint && (
              <div className="flex items-center gap-1.5 bg-rose-50 border border-rose-200 px-3 py-1 rounded-xl text-rose-700 font-bold">
                <TrendingDown className="w-3.5 h-3.5 text-rose-600" />
                <span>Trough: ${troughPoint.pnl.toFixed(2)}</span>
              </div>
            )}
            <div className="text-right pl-2 border-l border-slate-200">
              <div className={`text-sm font-bold ${activeHoverData?.pnl >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                Balance: ${activeHoverData?.pnl.toFixed(2)}
              </div>
              <div className="text-[10px] text-slate-400">
                {activeHoverData?.date} {activeHoverData?.symbol !== 'Baseline' ? `• ${activeHoverData?.symbol} (${activeHoverData?.tradePnL >= 0 ? '+' : ''}${(activeHoverData?.tradePnL || 0).toFixed(2)})` : ''}
              </div>
            </div>
          </div>
        </div>

        <div className="w-full h-96 relative">
          {pointsCoordinates.length < 2 ? (
            <div className="h-full flex items-center justify-center text-slate-400 text-xs font-medium">
              Log at least 2 trades to render interactive equity curve.
            </div>
          ) : (
            <svg 
              className="w-full h-full overflow-visible cursor-crosshair" 
              viewBox={`0 0 ${svgWidth} ${svgHeight}`} 
              preserveAspectRatio="none"
              onMouseMove={handleMouseMove}
              onMouseLeave={() => setHoveredPointIndex(null)}
            >
              <defs>
                <linearGradient id="greenEquityGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                </linearGradient>

                <linearGradient id="redEquityGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.0" />
                  <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.35" />
                </linearGradient>

                <clipPath id="aboveBaselineClip">
                  <rect x="0" y="0" width={svgWidth} height={baselineY} />
                </clipPath>

                <clipPath id="belowBaselineClip">
                  <rect x="0" y={baselineY} width={svgWidth} height={svgHeight - baselineY} />
                </clipPath>
              </defs>

              <line x1={0} y1={baselineY} x2={svgWidth} y2={baselineY} stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="6 4" />

              <g clipPath="url(#aboveBaselineClip)">
                <polygon points={`0,${baselineY} ${polylineStr} ${svgWidth},${baselineY}`} fill="url(#greenEquityGrad)" />
              </g>

              <g clipPath="url(#belowBaselineClip)">
                <polygon points={`0,${baselineY} ${polylineStr} ${svgWidth},${baselineY}`} fill="url(#redEquityGrad)" />
              </g>

              {pointsCoordinates.map((p, idx) => {
                if (idx === 0) return null;
                const prev = pointsCoordinates[idx - 1];
                const strokeColor = p.pnl >= 0 ? '#10b981' : '#f43f5e';
                return <line key={idx} x1={prev.x} y1={prev.y} x2={p.x} y2={p.y} stroke={strokeColor} strokeWidth="3" strokeLinecap="round" />;
              })}

              {activeIndex !== null && pointsCoordinates[activeIndex] && (
                <line x1={pointsCoordinates[activeIndex].x} y1={0} x2={pointsCoordinates[activeIndex].x} y2={svgHeight} stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="4 4" />
              )}

              {pointsCoordinates.map((p, idx) => {
                const isPeak = p === peakPoint && p.pnl > 0;
                const isTrough = p === troughPoint && p.pnl < 0;

                return (
                  <circle 
                    key={idx}
                    cx={p.x} 
                    cy={p.y} 
                    r={activeIndex === idx ? 8 : (isPeak || isTrough ? 6 : 4.5)} 
                    fill={p.pnl >= 0 ? '#10b981' : '#f43f5e'} 
                    stroke="#ffffff"
                    strokeWidth="2.5"
                  />
                );
              })}
            </svg>
          )}
        </div>
      </div>

      {/* DASHBOARD MODULES (Hidden in Print) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:hidden">
        <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" /> Mistake Impact Analysis
            </h2>
            <span className="text-[10px] font-bold bg-amber-50 text-amber-600 px-2 py-0.5 rounded border border-amber-200">Behavioral Leakage</span>
          </div>

          <div className="space-y-3">
            {topMistakes.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs font-medium">No mistake tags logged yet.</div>
            ) : (
              topMistakes.map(([mistakeName, data]) => (
                <div key={mistakeName} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl text-xs">
                  <span className="font-bold text-slate-900">{mistakeName} ({data.count})</span>
                  <span className="font-mono font-bold text-rose-500">-${data.totalCost.toFixed(2)}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-500" /> Session Performance Breakdown
            </h2>
            <span className="text-[10px] font-bold bg-blue-50 text-blue-600 px-2 py-0.5 rounded border border-blue-200">Timing Edge</span>
          </div>

          <div className="space-y-3">
            {Object.entries(sessionMap).map(([sessionName, data]) => (
              <div key={sessionName} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl text-xs">
                <span className="font-bold text-slate-900">{sessionName} ({data.count} {data.count === 1 ? 'trade' : 'trades'})</span>
                <span className={`font-mono font-bold ${data.pnl >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>${data.pnl.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* --- STRICTLY ONE-PAGE PRINTED PDF REPORT LAYOUT --- */}
      <style jsx global>{`
        @media print {
          body {
            background: white !important;
          }
          aside, nav, header, button {
            display: none !important;
          }
          .print\\:block {
            display: block !important;
          }
          @page {
            size: letter portrait;
            margin: 0.5in;
          }
        }
      `}</style>

      <div className="hidden print:block bg-white text-slate-900 p-2 space-y-4 w-full text-xs">
        
        {/* Compact Printable Header */}
        <div className="flex justify-between items-start border-b border-slate-200 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-[#ec3044] rounded-lg flex items-center justify-center text-white font-bold text-xs">🎯</div>
              <h2 className="text-lg font-black text-slate-900 tracking-tight">TryhardTrades Verified Audit Statement</h2>
            </div>
            <p className="text-[10px] text-slate-500 mt-0.5 font-semibold">Account Scope: <span className="text-slate-900">{accountName}</span></p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-slate-400">Generated on {new Date().toLocaleDateString()}</p>
          </div>
        </div>

        {/* Compact KPI Grid */}
        <div className="grid grid-cols-4 gap-3">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5">
            <span className="text-[9px] font-bold text-slate-400 uppercase">Net P&L</span>
            <div className={`text-lg font-black ${totalPnL >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {totalPnL >= 0 ? `$${totalPnL.toFixed(2)}` : `-$${Math.abs(totalPnL).toFixed(2)}`}
            </div>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5">
            <span className="text-[9px] font-bold text-slate-400 uppercase">Win Rate</span>
            <div className="text-lg font-black text-slate-900">{winRate}%</div>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5">
            <span className="text-[9px] font-bold text-slate-400 uppercase">Profit Factor</span>
            <div className="text-lg font-black text-slate-900">{profitFactor}</div>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5">
            <span className="text-[9px] font-bold text-slate-400 uppercase">Executions</span>
            <div className="text-lg font-black text-slate-900">{trades.length}</div>
          </div>
        </div>

        {/* Strategy Performance Breakdown */}
        <div className="space-y-1.5">
          <h3 className="text-[10px] font-bold text-slate-900 uppercase tracking-wider">Strategy Performance Breakdown</h3>
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-left text-[11px]">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-1.5 px-2.5">Strategy</th>
                  <th className="py-1.5 px-2.5">Trades</th>
                  <th className="py-1.5 px-2.5 text-right">P&L</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {Object.entries(strategyMap).length === 0 ? (
                  <tr><td colSpan={3} className="py-2 text-center text-slate-400">No active strategy records</td></tr>
                ) : (
                  Object.entries(strategyMap).map(([strat, data]) => (
                    <tr key={strat}>
                      <td className="py-1.5 px-2.5 font-bold text-slate-900">{strat}</td>
                      <td className="py-1.5 px-2.5 text-slate-500">{data.count}</td>
                      <td className={`py-1.5 px-2.5 font-mono font-bold text-right ${data.pnl >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>${data.pnl.toFixed(2)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Executed Trades Summary Table (Last 5 or fewer) */}
        <div className="space-y-1.5">
          <h3 className="text-[10px] font-bold text-slate-900 uppercase tracking-wider">Executed Trades Summary ({reportTrades.length} Recent)</h3>
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-left text-[11px]">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2 px-2.5">Date</th>
                  <th className="py-2 px-2.5">Symbol</th>
                  <th className="py-2 px-2.5">Side</th>
                  <th className="py-2 px-2.5">Strategy</th>
                  <th className="py-2 px-2.5">Outcome</th>
                  <th className="py-2 px-2.5 text-right">Net P&L</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {reportTrades.length === 0 ? (
                  <tr><td colSpan={6} className="py-3 text-center text-slate-400">No trades recorded yet.</td></tr>
                ) : (
                  reportTrades.map((t) => (
                    <tr key={t.id}>
                      <td className="py-2 px-2.5">{t.openDate}</td>
                      <td className="py-2 px-2.5 font-bold text-slate-900">{t.symbol}</td>
                      <td className="py-2 px-2.5 text-slate-500">{t.side || 'LONG'}</td>
                      <td className="py-2 px-2.5 text-slate-700">{t.strategy || '--'}</td>
                      <td className="py-2 px-2.5 font-bold">{t.status}</td>
                      <td className={`py-2 px-2.5 font-mono font-bold text-right ${t.netPnL >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>${Number(t.netPnL).toFixed(2)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-200 flex justify-between items-center text-[9px] text-slate-400">
          <span>TryhardTradesJournal Professional Audit System</span>
          <span>Page 1 of 1</span>
        </div>

      </div>

    </div>
  );
}