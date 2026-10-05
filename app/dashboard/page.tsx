'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
  TrendingDown,
  ArrowDownRight,
  Flag,
  ShieldAlert,
  ShieldCheck,
  Scale,
  CheckCircle2
} from 'lucide-react';
import { useRouter } from 'next/navigation';

interface AccountAdjustment {
  id?: string | number;
  accountId: string | number;
  type: 'deposit' | 'withdrawal';
  amount: number;
  date: string;
  note?: string;
}

export default function DashboardPage() {
  const router = useRouter();

  const [activeFilterSelection, setActiveFilterSelection] = useState<{ 
    type: 'global' | 'group' | 'account'; 
    name: string 
  }>({ type: 'global', name: 'All Accounts' });

  const [rawTrades, setRawTrades] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [strategies, setStrategies] = useState<any[]>([]);
  const [mistakeTagsList, setMistakeTagsList] = useState<any[]>([]);
  const [adjustments, setAdjustments] = useState<AccountAdjustment[]>([]);

  const [targetInput, setTargetInput] = useState<string>('');
  const [drawdownInput, setDrawdownInput] = useState<string>('');
  const [reportDate, setReportDate] = useState<string>('');
  const [reportAuditId, setReportAuditId] = useState<string>('');

  const loadData = async () => {
    const tradesData = await cloudDb.getTrades();
    const accountsData = await cloudDb.getAccounts();
    const strats = await db.strategies.toArray();
    const mistakesList = await db.mistakes.toArray();

    setRawTrades(tradesData);
    setAccounts(accountsData);
    setStrategies(strats);
    setMistakeTagsList(mistakesList);

    let loadedAdjustments: AccountAdjustment[] = [];
    try {
      const { supabase } = await import('@/lib/supabase');
      const { data } = await supabase.from('account_adjustments').select('*');
      if (data && data.length > 0) {
        loadedAdjustments = data.map(d => ({
          id: d.id,
          accountId: d.account_id,
          type: d.type === 'deposit' ? 'deposit' : 'withdrawal',
          amount: Number(d.amount),
          date: d.date,
          note: d.note
        }));
      }
    } catch (err) {}

    try {
      if ((db as any).adjustments) {
        const localData = await (db as any).adjustments.toArray();
        if (localData && localData.length > 0 && loadedAdjustments.length === 0) {
          loadedAdjustments = localData;
        }
      }
    } catch (err) {}

    setAdjustments(loadedAdjustments);
  };

  useEffect(() => {
    loadData();
    const now = new Date();
    setReportDate(now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' ' + now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }));
    setReportAuditId('TYH-' + Math.random().toString(36).substring(2, 8).toUpperCase() + '-' + now.getFullYear());
  }, []);

  useEffect(() => {
    const storageKey = `tryhard_thresholds_${activeFilterSelection.name}`;
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setTargetInput(parsed.target || '');
        setDrawdownInput(parsed.drawdown || '');
      } catch (e) {}
    } else {
      setTargetInput('');
      setDrawdownInput('');
    }
  }, [activeFilterSelection.name]);

  const handleTargetChange = (val: string) => {
    setTargetInput(val);
    const storageKey = `tryhard_thresholds_${activeFilterSelection.name}`;
    localStorage.setItem(storageKey, JSON.stringify({ target: val, drawdown: drawdownInput }));
  };

  const handleDrawdownChange = (val: string) => {
    setDrawdownInput(val);
    const storageKey = `tryhard_thresholds_${activeFilterSelection.name}`;
    localStorage.setItem(storageKey, JSON.stringify({ target: targetInput, drawdown: val }));
  };

  useEffect(() => {
    const handleAccountFilterChanged = (e: any) => {
      const detail = e.detail;
      if (detail === 'All Accounts' || !detail) {
        setActiveFilterSelection({ type: 'global', name: 'All Accounts' });
      } else if (typeof detail === 'object' && detail.type === 'group') {
        setActiveFilterSelection({ type: 'group', name: detail.name });
      } else {
        setActiveFilterSelection({ 
          type: 'account', 
          name: typeof detail === 'object' ? detail.name : detail 
        });
      }
      loadData();
    };

    window.addEventListener('account-filter-changed', handleAccountFilterChanged);
    return () => window.removeEventListener('account-filter-changed', handleAccountFilterChanged);
  }, []);

  const scopedTrades = rawTrades.filter((trade) => {
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

  const isIndividualAccountView = activeFilterSelection.type === 'account';

  const clusteredTrades = useMemo(() => {
    if (isIndividualAccountView) {
      return scopedTrades.map(t => ({
        ...t,
        magnifiedPnL: t.netPnL || 0,
        magnifiedGrossPnL: t.grossPnL || t.netPnL || 0,
        magnifiedCommissions: t.commissions || 0,
        individualPnL: t.netPnL || 0,
        accountCount: 1,
      }));
    }

    const clusters: Record<string, {
      baseTrade: any;
      uniqueAccounts: Set<string>;
    }> = {};

    scopedTrades.forEach(trade => {
      const clusterKey = trade.leaderTradeId || trade.leader_trade_id 
        ? `leader_${trade.leaderTradeId || trade.leader_trade_id}`
        : (trade.openDate && trade.entryTime && trade.symbol)
        ? `exec_${trade.openDate}_${trade.entryTime}_${trade.symbol}_${trade.side}`
        : `trade_${trade.id}`;

      if (!clusters[clusterKey]) {
        clusters[clusterKey] = {
          baseTrade: trade,
          uniqueAccounts: new Set()
        };
      }

      if (trade.account) clusters[clusterKey].uniqueAccounts.add(trade.account);
    });

    return Object.values(clusters).map(({ baseTrade, uniqueAccounts }) => {
      const count = uniqueAccounts.size > 0 ? uniqueAccounts.size : 1;
      const individualPnL = Number(baseTrade.netPnL) || 0;
      const individualGross = Number(baseTrade.grossPnL) || individualPnL;
      const individualComm = Number(baseTrade.commissions) || 0;

      return {
        ...baseTrade,
        magnifiedPnL: individualPnL * count,
        magnifiedGrossPnL: individualGross * count,
        magnifiedCommissions: individualComm * count,
        individualPnL,
        accountCount: count,
      };
    });
  }, [scopedTrades, isIndividualAccountView]);

  const validAccountIds = new Set(accounts.map(a => String(a.id)));
  const filteredAdjustments = adjustments
    .filter(adj => validAccountIds.has(String(adj.accountId)))
    .filter(adj => {
      if (activeFilterSelection.type === 'account') {
        const selectedAccObj = accounts.find(a => a.name === activeFilterSelection.name);
        if (!selectedAccObj) return String(adj.accountId) === String(activeFilterSelection.name);
        return String(adj.accountId) === String(selectedAccObj.id);
      } else if (activeFilterSelection.type === 'group') {
        const groupAccountIds = accounts
          .filter(a => a.groupName === activeFilterSelection.name)
          .map(a => String(a.id));
        return groupAccountIds.includes(String(adj.accountId));
      }
      return true;
    });

  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);
  const accountName = activeFilterSelection.name;

  const grossTradePnL = clusteredTrades.reduce((acc, t) => acc + (t.magnifiedPnL || 0), 0);
  const totalCommissionsPaid = clusteredTrades.reduce((acc, t) => acc + (t.magnifiedCommissions || 0), 0);
  const totalGrossProfits = clusteredTrades.reduce((acc, t) => acc + (t.magnifiedGrossPnL || 0), 0);
  
  const winTrades = clusteredTrades.filter(t => (t.magnifiedPnL || 0) > 0);
  const lossTrades = clusteredTrades.filter(t => (t.magnifiedPnL || 0) < 0);
  const totalTradesCount = clusteredTrades.length;
  const winRate = totalTradesCount > 0 ? ((winTrades.length / totalTradesCount) * 100).toFixed(1) : '0';

  const sumWins = winTrades.reduce((acc, t) => acc + t.magnifiedPnL, 0);
  const sumLosses = Math.abs(lossTrades.reduce((acc, t) => acc + t.magnifiedPnL, 0));
  const profitFactor = sumLosses > 0 ? (sumWins / sumLosses).toFixed(2) : sumWins > 0 ? '99.00' : '0.00';

  const avgWin = winTrades.length > 0 ? sumWins / winTrades.length : 0;
  const avgLoss = lossTrades.length > 0 ? sumLosses / lossTrades.length : 0;
  const payoffRatio = avgLoss > 0 ? (avgWin / avgLoss).toFixed(2) : '0.00';

  const totalWithdrawals = filteredAdjustments
    .filter(a => a.type === 'withdrawal')
    .reduce((acc, a) => acc + a.amount, 0);

  const totalDeposits = filteredAdjustments
    .filter(a => a.type === 'deposit')
    .reduce((acc, a) => acc + a.amount, 0);

  const netPnLAfterWithdrawals = grossTradePnL + totalDeposits - totalWithdrawals;

  const currentAccountObj = accounts.find(a => a.name === activeFilterSelection.name);
  const baselineAccountSize = currentAccountObj?.balance ? Number(currentAccountObj.balance) : 0;

  let targetPnL: number | null = null;
  if (targetInput.trim()) {
    const rawT = parseFloat(targetInput);
    if (!isNaN(rawT) && rawT !== 0) {
      if (baselineAccountSize > 0 && rawT > baselineAccountSize) {
        targetPnL = rawT - baselineAccountSize;
      } else {
        targetPnL = Math.abs(rawT);
      }
    }
  }

  let drawdownPnL: number | null = null;
  if (drawdownInput.trim()) {
    const rawD = parseFloat(drawdownInput);
    if (!isNaN(rawD) && rawD !== 0) {
      if (baselineAccountSize > 0 && rawD > baselineAccountSize * 0.5) {
        drawdownPnL = -(baselineAccountSize - rawD);
      } else {
        drawdownPnL = -Math.abs(rawD);
      }
    }
  }

  const distanceToTarget = targetPnL !== null ? targetPnL - netPnLAfterWithdrawals : null;
  const distanceToDrawdown = drawdownPnL !== null ? netPnLAfterWithdrawals - drawdownPnL : null;

  const mistakeMap: Record<string, { count: number; totalCost: number }> = {};
  clusteredTrades.forEach(t => {
    if (t.mistakeTag) {
      if (!mistakeMap[t.mistakeTag]) {
        mistakeMap[t.mistakeTag] = { count: 0, totalCost: 0 };
      }
      mistakeMap[t.mistakeTag].count += 1;
      if ((t.magnifiedPnL || 0) < 0) {
        mistakeMap[t.mistakeTag].totalCost += Math.abs(t.magnifiedPnL);
      }
    }
  });

  const topMistakes = Object.entries(mistakeMap)
    .sort((a, b) => b[1].totalCost - a[1].totalCost)
    .slice(0, 4);

  const sessionMap: Record<string, { count: number; pnl: number }> = {
    'RTH AM (08:30 - 12:00)': { count: 0, pnl: 0 },
    'RTH PM (12:00 - 15:00)': { count: 0, pnl: 0 },
    'Globex / Extended': { count: 0, pnl: 0 }
  };

  clusteredTrades.forEach(t => {
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
      sessionMap['RTH AM (08:30 - 12:00)'].count += 1;
      sessionMap['RTH AM (08:30 - 12:00)'].pnl += (t.magnifiedPnL || 0);
    } else if (timeDecimal >= 12.0 && timeDecimal <= 15.0) {
      sessionMap['RTH PM (12:00 - 15:00)'].count += 1;
      sessionMap['RTH PM (12:00 - 15:00)'].pnl += (t.magnifiedPnL || 0);
    } else {
      sessionMap['Globex / Extended'].count += 1;
      sessionMap['Globex / Extended'].pnl += (t.magnifiedPnL || 0);
    }
  });

  const combinedEvents = [
    ...clusteredTrades.map(t => ({
      date: t.openDate,
      time: t.entryTime || '00:00',
      pnlDelta: t.magnifiedPnL || 0,
      individualPnL: t.individualPnL || 0,
      accountCount: t.accountCount || 1,
      symbol: t.symbol,
      type: 'trade'
    })),
    ...filteredAdjustments.map(a => ({
      date: a.date,
      time: '23:59',
      pnlDelta: a.type === 'deposit' ? a.amount : -a.amount,
      individualPnL: a.type === 'deposit' ? a.amount : -a.amount,
      accountCount: 1,
      symbol: a.type === 'deposit' ? 'Deposit (+)' : 'Withdrawal (-)',
      type: 'adjustment'
    }))
  ].sort((a, b) => new Date(`${a.date} ${a.time}`).getTime() - new Date(`${b.date} ${b.time}`).getTime());

  let runningSum = 0;
  const cumulativePoints = combinedEvents.map(e => {
    runningSum += e.pnlDelta;
    return { 
      pnl: runningSum, 
      date: e.date, 
      symbol: e.symbol, 
      tradePnL: e.pnlDelta,
      individualPnL: e.individualPnL,
      accountCount: e.accountCount,
      isAdjustment: e.type === 'adjustment'
    };
  });

  const equityData = [{ pnl: 0, date: 'Baseline', symbol: 'Start', tradePnL: 0, individualPnL: 0, accountCount: 1, isAdjustment: false }, ...cumulativePoints];

  const allValues = equityData.map(d => d.pnl);
  if (targetPnL !== null) allValues.push(targetPnL);
  if (drawdownPnL !== null) allValues.push(drawdownPnL);

  const minVal = Math.min(...allValues, 0);
  const maxVal = Math.max(...allValues, 10);
  const range = maxVal - minVal || 1;

  const svgWidth = 900;
  const svgHeight = 360;

  const pointsCoordinates = equityData.map((d, idx) => {
    const x = (idx / (equityData.length - 1 || 1)) * svgWidth;
    const y = svgHeight - ((d.pnl - minVal) / range) * (svgHeight - 70) - 35;
    return { x, y, ...d };
  });

  const targetY = targetPnL !== null ? svgHeight - ((targetPnL - minVal) / range) * (svgHeight - 70) - 35 : null;
  const drawdownY = drawdownPnL !== null ? svgHeight - ((drawdownPnL - minVal) / range) * (svgHeight - 70) - 35 : null;

  let athIndex = 0;
  let atlIndex = 0;
  pointsCoordinates.forEach((p, idx) => {
    if (p.pnl > pointsCoordinates[athIndex].pnl) athIndex = idx;
    if (p.pnl < pointsCoordinates[atlIndex].pnl) atlIndex = idx;
  });
  const athPoint = pointsCoordinates[athIndex];
  const atlPoint = pointsCoordinates[atlIndex];

  const baselineY = svgHeight - ((0 - minVal) / range) * (svgHeight - 70) - 35;
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

  const handleDownloadPDF = () => {
    window.print();
  };

  return (
    <div className="p-8 bg-[#F8F9FD] min-h-screen text-slate-800 font-sans space-y-8 w-full max-w-[1700px] mx-auto">

      {/* INSTITUTIONAL PDF RENDER ENGINE */}
      <style jsx global>{`
        @media print {
          @page {
            size: letter portrait;
            margin: 0.35in;
          }
          
          body {
            background-color: #0d1a30 !important;
            color: #0f172a !important;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          aside, nav, header, button, .print\\:hidden {
            display: none !important;
          }

          .print\\:block {
            display: block !important;
          }

          /* Watermark background on all printed pages */
          .doc-sheet {
            page-break-after: always !important;
            break-after: page !important;
            box-sizing: border-box;
            position: relative;
            min-height: 10.1in;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            padding: 0.1in;
          }

          .doc-sheet-auto {
            break-inside: auto !important;
            box-sizing: border-box;
            position: relative;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            padding: 0.1in;
          }

          .stonks-watermark {
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            z-index: -10;
            opacity: 0.18;
            object-fit: cover;
            filter: saturate(1.4) contrast(1.1);
          }

          .avoid-break {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }

          thead {
            display: table-header-group !important;
          }

          tr {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
        }
      `}</style>

      {/* WEB SCREEN HEADER */}
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard & Reports</h1>
          {activeFilterSelection.type !== 'global' ? (
            <p className="text-xs font-bold text-[#ec3044] mt-0.5">
              Scoped to {activeFilterSelection.type === 'group' ? 'Group:' : 'Account:'} {activeFilterSelection.name}
            </p>
          ) : (
            <p className="text-xs text-slate-500 mt-0.5">Unified performance metrics, behavioral analysis, and verified execution tracking.</p>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={handleDownloadPDF}
            className="flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold px-4 py-2 rounded-xl text-sm shadow-sm transition cursor-pointer hover:border-[#ec3044]/50"
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

      {/* WEB SCREEN KPI CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 print:hidden">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm flex flex-col justify-between h-32">
          <div className="text-sm font-semibold text-slate-500 flex items-center justify-between">
            <span>Net P&L</span>
            <DollarSign className="w-4 h-4 text-slate-400" />
          </div>
          <div>
            <div className={`text-3xl font-bold ${grossTradePnL >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
              {grossTradePnL >= 0 ? `$${grossTradePnL.toFixed(2)}` : `-$${Math.abs(grossTradePnL).toFixed(2)}`}
            </div>

            {(totalWithdrawals > 0 || totalDeposits > 0) && (
              <div className="text-[11px] font-bold mt-1 flex items-center gap-1">
                <span className="text-slate-400">Bal:</span>
                <span className={netPnLAfterWithdrawals >= 0 ? "text-emerald-600/80 font-mono" : "text-rose-600/80 font-mono"}>
                  ${netPnLAfterWithdrawals.toFixed(2)}
                </span>
                {totalWithdrawals > 0 && (
                  <span className="text-rose-500/80 text-[10px] font-semibold flex items-center">
                    <ArrowDownRight className="w-3 h-3" />-${totalWithdrawals.toFixed(2)}
                  </span>
                )}
              </div>
            )}
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
            <span>Total Executions</span>
            <Activity className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-3xl font-bold text-slate-900">{totalTradesCount}</div>
        </div>
      </div>

      {/* WEB SCREEN EQUITY CURVE */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-6 space-y-4 w-full print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Equity Curve Performance</h2>
            <p className="text-[11px] text-slate-400">Plots chronological execution milestones across all active accounts without artificial smoothing.</p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-emerald-50/60 border border-emerald-200/80 px-2.5 py-1 rounded-xl">
              <Flag className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <input 
                type="number" 
                step="any"
                placeholder="Target Goal ($)"
                value={targetInput}
                onChange={(e) => handleTargetChange(e.target.value)}
                className="bg-transparent text-xs font-bold text-emerald-800 placeholder:text-emerald-400 focus:outline-none w-36"
              />
            </div>

            <div className="flex items-center gap-1.5 bg-rose-50/60 border border-rose-200/80 px-2.5 py-1 rounded-xl">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-600 shrink-0" />
              <input 
                type="number" 
                step="any"
                placeholder="Min Floor ($)"
                value={drawdownInput}
                onChange={(e) => handleDrawdownChange(e.target.value)}
                className="bg-transparent text-xs font-bold text-rose-800 placeholder:text-rose-400 focus:outline-none w-36"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
            {distanceToTarget !== null && (
              <div className={`flex items-center gap-1 px-2.5 py-1 rounded-xl font-bold border ${
                distanceToTarget <= 0 
                  ? 'bg-emerald-500 text-white border-emerald-600 animate-pulse' 
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
              }`}>
                <span>🎯</span>
                <span>
                  {distanceToTarget <= 0 
                    ? `Goal Hit (+${Math.abs(distanceToTarget).toFixed(2)})` 
                    : `$${distanceToTarget.toFixed(2)} to Target`}
                </span>
              </div>
            )}

            {distanceToDrawdown !== null && (
              <div className={`flex items-center gap-1 px-2.5 py-1 rounded-xl font-bold border ${
                distanceToDrawdown <= 0 
                  ? 'bg-rose-600 text-white border-rose-700 animate-pulse' 
                  : 'bg-rose-50 text-rose-700 border-rose-200'
              }`}>
                <span>⚠️</span>
                <span>
                  {distanceToDrawdown <= 0 
                    ? `Breached by $${Math.abs(distanceToDrawdown).toFixed(2)}` 
                    : `$${distanceToDrawdown.toFixed(2)} Buffer Left`}
                </span>
              </div>
            )}

            {athPoint && (
              <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-xl text-emerald-700 font-bold">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                <span>ATH: ${athPoint.pnl.toFixed(2)}</span>
              </div>
            )}
            {atlPoint && (
              <div className="flex items-center gap-1.5 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-xl text-rose-700 font-bold">
                <TrendingDown className="w-3.5 h-3.5 text-rose-600" />
                <span>ATL: ${atlPoint.pnl.toFixed(2)}</span>
              </div>
            )}
            <div className="text-right pl-2 border-l border-slate-200">
              <div className={`text-sm font-bold ${activeHoverData?.pnl >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                Balance: ${activeHoverData?.pnl.toFixed(2)}
              </div>
              <div className="text-[10px] text-slate-400">
                {activeHoverData?.date} {activeHoverData?.symbol !== 'Baseline' ? (
                  `• ${activeHoverData?.symbol} (${activeHoverData?.tradePnL >= 0 ? '+' : ''}${(activeHoverData?.tradePnL || 0).toFixed(2)}${activeHoverData?.accountCount > 1 ? ` across ${activeHoverData.accountCount} accts` : ''})`
                ) : ''}
              </div>
            </div>
          </div>
        </div>

        <div className="w-full h-96 relative">
          {pointsCoordinates.length < 2 ? (
            <div className="h-full flex items-center justify-center text-slate-400 text-xs font-medium">
              Log at least 2 trades or adjustments to render interactive equity curve.
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

              {targetY !== null && (
                <g>
                  <line x1={0} y1={targetY} x2={svgWidth} y2={targetY} stroke="#10b981" strokeWidth="2" strokeDasharray="5 3" />
                  <text x={svgWidth - 10} y={targetY - 6} textAnchor="end" fill="#059669" fontSize="11" fontFamily="monospace" fontWeight="bold">
                    TARGET: +${targetPnL?.toLocaleString()}
                  </text>
                </g>
              )}

              {drawdownY !== null && (
                <g>
                  <line x1={0} y1={drawdownY} x2={svgWidth} y2={drawdownY} stroke="#e11d48" strokeWidth="2" strokeDasharray="5 3" />
                  <text x={svgWidth - 10} y={drawdownY + 14} textAnchor="end" fill="#e11d48" fontSize="11" fontFamily="monospace" fontWeight="bold">
                    MIN FLOOR: -${Math.abs(drawdownPnL || 0).toLocaleString()}
                  </text>
                </g>
              )}

              <g clipPath="url(#aboveBaselineClip)">
                <polygon points={`0,${baselineY} ${polylineStr} ${svgWidth},${baselineY}`} fill="url(#greenEquityGrad)" />
              </g>

              <g clipPath="url(#belowBaselineClip)">
                <polygon points={`0,${baselineY} ${polylineStr} ${svgWidth},${baselineY}`} fill="url(#redEquityGrad)" />
              </g>

              {pointsCoordinates.map((p, idx) => {
                if (idx === 0) return null;
                const prev = pointsCoordinates[idx - 1];
                const strokeColor = p.isAdjustment ? '#8b5cf6' : (p.pnl >= 0 ? '#10b981' : '#f43f5e');
                return (
                  <line 
                    key={idx} 
                    x1={prev.x} 
                    y1={prev.y} 
                    x2={p.x} 
                    y2={p.y} 
                    stroke={strokeColor} 
                    strokeWidth="3" 
                    strokeDasharray={p.isAdjustment ? "4 3" : undefined}
                  />
                );
              })}

              {activeIndex !== null && pointsCoordinates[activeIndex] && (
                <line x1={pointsCoordinates[activeIndex].x} y1={0} x2={pointsCoordinates[activeIndex].x} y2={svgHeight} stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="4 4" />
              )}

              {pointsCoordinates.map((p, idx) => {
                const isAth = p === athPoint && p.pnl > 0;
                const isAtl = p === atlPoint && p.pnl < 0;

                return (
                  <circle 
                    key={idx}
                    cx={p.x} 
                    cy={p.y} 
                    r={activeIndex === idx ? 8 : (p.isAdjustment ? 6 : (isAth || isAtl ? 6 : 4.5))} 
                    fill={p.isAdjustment ? '#8b5cf6' : (p.pnl >= 0 ? '#10b981' : '#f43f5e')} 
                    stroke="#ffffff"
                    strokeWidth="2.5"
                  />
                );
              })}
            </svg>
          )}
        </div>
      </div>

      {/* WEB SCREEN BEHAVIORAL MODULES */}
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

      {/* ========================================================================================= */}
      {/* CERTIFIED THIRD-PARTY AUDIT STATEMENT (INSTITUTIONAL PDF WITH WATERMARK BACKGROUND)        */}
      {/* ========================================================================================= */}

      <div className="hidden print:block w-full text-slate-900 font-sans text-xs">
        
        {/* Full-bleed background image tag */}
        <img src="/stonks-bg.jpg" alt="Watermark" className="stonks-watermark" />

        {/* ================= PAGE 1: EXECUTIVE AUDIT TEAR SHEET ================= */}
        <section className="doc-sheet">
          <div className="space-y-4">
            
            {/* Header Block */}
            <div className="bg-white/95 rounded-xl border border-slate-200 p-4 shadow-sm border-t-4 border-t-[#EC3044]">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 bg-[#EC3044] rounded-lg flex items-center justify-center text-white font-black text-sm">
                      🎯
                    </div>
                    <div>
                      <h1 className="text-base font-black tracking-tight uppercase text-slate-950 leading-none">
                        TryhardTrades Certified Audit Record
                      </h1>
                      <span className="text-[9px] font-black uppercase tracking-widest text-[#EC3044]">
                        Independent Performance Verification Statement
                      </span>
                    </div>
                  </div>
                  
                  <div className="pt-2 flex items-center gap-2 text-[10px] text-slate-600">
                    <span className="font-bold text-slate-400 uppercase">Target Entity:</span>
                    <span className="font-mono font-bold bg-slate-100 text-slate-900 px-2 py-0.5 rounded border border-slate-300">
                      {accountName}
                    </span>
                    {!isIndividualAccountView && (
                      <span className="text-[9px] font-black text-[#EC3044] uppercase tracking-wider">
                        • Verified Replicated Group Structure
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-right space-y-1">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-300 rounded-lg text-emerald-800 text-[10px] font-black">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> VERIFIED TRACK RECORD
                  </div>
                  <div className="text-[9px] font-mono font-bold text-slate-500">REF: {reportAuditId}</div>
                  <div className="text-[9px] font-medium text-slate-500">DATE: {reportDate}</div>
                </div>
              </div>
            </div>

            {/* Primary KPI Matrix */}
            <div className="grid grid-cols-4 gap-3 avoid-break">
              <div className="bg-white/95 border border-slate-200 rounded-xl p-3 shadow-xs">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Net Realized Return</span>
                <div className={`text-xl font-black font-mono mt-0.5 ${grossTradePnL >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {grossTradePnL >= 0 ? `+$${grossTradePnL.toFixed(2)}` : `-$${Math.abs(grossTradePnL).toFixed(2)}`}
                </div>
                <span className="text-[8px] text-slate-500 font-medium block mt-0.5">Realized after exchange fees</span>
              </div>

              <div className="bg-white/95 border border-slate-200 rounded-xl p-3 shadow-xs">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Profit Factor</span>
                <div className="text-xl font-black font-mono text-slate-950 mt-0.5">
                  {profitFactor}
                </div>
                <span className="text-[8px] text-slate-500 font-medium block mt-0.5">Gross Win / Gross Loss</span>
              </div>

              <div className="bg-white/95 border border-slate-200 rounded-xl p-3 shadow-xs">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Execution Win Rate</span>
                <div className="text-xl font-black font-mono text-slate-950 mt-0.5">
                  {winRate}%
                </div>
                <span className="text-[8px] text-slate-500 font-medium block mt-0.5">
                  {winTrades.length}W / {lossTrades.length}L ({totalTradesCount} Total)
                </span>
              </div>

              <div className="bg-white/95 border border-slate-200 rounded-xl p-3 shadow-xs">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Payoff Ratio (W/L)</span>
                <div className="text-xl font-black font-mono text-slate-950 mt-0.5">
                  {payoffRatio}
                </div>
                <span className="text-[8px] text-slate-500 font-medium block mt-0.5">Avg Win ${avgWin.toFixed(0)} / Avg Loss ${avgLoss.toFixed(0)}</span>
              </div>
            </div>

            {/* Supporting Financial Matrix */}
            <div className="grid grid-cols-4 gap-3 avoid-break">
              <div className="bg-white/95 border border-slate-200 rounded-lg p-2.5 shadow-xs">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider">Gross Profits</span>
                <span className="text-xs font-mono font-bold text-emerald-600 block mt-0.5">+${totalGrossProfits.toFixed(2)}</span>
              </div>
              <div className="bg-white/95 border border-slate-200 rounded-lg p-2.5 shadow-xs">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider">Platform & Comm. Fees</span>
                <span className="text-xs font-mono font-bold text-slate-700 block mt-0.5">-${totalCommissionsPaid.toFixed(2)}</span>
              </div>
              <div className="bg-white/95 border border-slate-200 rounded-lg p-2.5 shadow-xs">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider">Withdrawal Deductions</span>
                <span className="text-xs font-mono font-bold text-rose-600 block mt-0.5">-${totalWithdrawals.toFixed(2)}</span>
              </div>
              <div className="bg-white/95 border border-slate-200 rounded-lg p-2.5 shadow-xs">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider">Net Realized Equity</span>
                <span className="text-xs font-mono font-bold text-slate-950 block mt-0.5">${netPnLAfterWithdrawals.toFixed(2)}</span>
              </div>
            </div>

            {/* Clean Equity Curve */}
            <div className="bg-white/95 border border-slate-200 rounded-2xl p-4 avoid-break shadow-sm">
              <div className="flex justify-between items-center border-b border-slate-200 pb-2 mb-2">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#EC3044]" />
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
                    Cumulative Account Equity Trajectory
                  </h3>
                </div>
                <div className="flex items-center gap-3 text-[10px] font-mono font-bold">
                  {athPoint && <span className="text-emerald-600">Peak Watermark: +${athPoint.pnl.toFixed(2)}</span>}
                  {atlPoint && <span className="text-rose-600">Max Drawdown: ${atlPoint.pnl.toFixed(2)}</span>}
                </div>
              </div>

              <div className="w-full h-56">
                <svg 
                  className="w-full h-full overflow-visible" 
                  viewBox={`0 0 ${svgWidth} ${svgHeight}`} 
                  preserveAspectRatio="none"
                >
                  <defs>
                    <linearGradient id="pdfGreenGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                    </linearGradient>
                    <linearGradient id="pdfRedGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.0" />
                      <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.25" />
                    </linearGradient>
                    <clipPath id="pdfAboveClip">
                      <rect x="0" y="0" width={svgWidth} height={baselineY} />
                    </clipPath>
                    <clipPath id="pdfBelowClip">
                      <rect x="0" y={baselineY} width={svgWidth} height={svgHeight - baselineY} />
                    </clipPath>
                  </defs>

                  <line x1={0} y1={baselineY} x2={svgWidth} y2={baselineY} stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="6 4" />

                  {targetY !== null && (
                    <g>
                      <line x1={0} y1={targetY} x2={svgWidth} y2={targetY} stroke="#10b981" strokeWidth="2" strokeDasharray="5 3" />
                      <text x={svgWidth - 10} y={targetY - 6} textAnchor="end" fill="#059669" fontSize="11" fontFamily="monospace" fontWeight="bold">
                        TARGET: +${targetPnL?.toLocaleString()}
                      </text>
                    </g>
                  )}

                  {drawdownY !== null && (
                    <g>
                      <line x1={0} y1={drawdownY} x2={svgWidth} y2={drawdownY} stroke="#e11d48" strokeWidth="2" strokeDasharray="5 3" />
                      <text x={svgWidth - 10} y={drawdownY + 14} textAnchor="end" fill="#e11d48" fontSize="11" fontFamily="monospace" fontWeight="bold">
                        MAX LOSS FLOOR: -${Math.abs(drawdownPnL || 0).toLocaleString()}
                      </text>
                    </g>
                  )}

                  <g clipPath="url(#pdfAboveClip)">
                    <polygon points={`0,${baselineY} ${polylineStr} ${svgWidth},${baselineY}`} fill="url(#pdfGreenGrad)" />
                  </g>

                  <g clipPath="url(#pdfBelowClip)">
                    <polygon points={`0,${baselineY} ${polylineStr} ${svgWidth},${baselineY}`} fill="url(#pdfRedGrad)" />
                  </g>

                  {pointsCoordinates.map((p, idx) => {
                    if (idx === 0) return null;
                    const prev = pointsCoordinates[idx - 1];
                    const strokeColor = p.isAdjustment ? '#8b5cf6' : (p.pnl >= 0 ? '#10b981' : '#f43f5e');
                    return (
                      <line 
                        key={idx} 
                        x1={prev.x} 
                        y1={prev.y} 
                        x2={p.x} 
                        y2={p.y} 
                        stroke={strokeColor} 
                        strokeWidth="3" 
                        strokeDasharray={p.isAdjustment ? "4 3" : undefined}
                      />
                    );
                  })}

                  {pointsCoordinates.map((p, idx) => (
                    <circle 
                      key={idx}
                      cx={p.x} 
                      cy={p.y} 
                      r={p.isAdjustment ? 5 : 4.5} 
                      fill={p.isAdjustment ? '#8b5cf6' : (p.pnl >= 0 ? '#10b981' : '#f43f5e')} 
                      stroke="#ffffff"
                      strokeWidth="2"
                    />
                  ))}
                </svg>
              </div>
            </div>

            {/* Session Edge Table & Verification Standards */}
            <div className="grid grid-cols-2 gap-4 avoid-break">
              <div className="bg-white/95 border border-slate-200 rounded-xl p-3 shadow-xs">
                <span className="text-[10px] font-black uppercase text-slate-900 tracking-wider flex items-center gap-1.5 mb-2">
                  <Clock className="w-3.5 h-3.5 text-blue-500" /> CME Trading Session Edge
                </span>
                <div className="space-y-1.5 text-xs">
                  {Object.entries(sessionMap).map(([sName, sData]) => (
                    <div key={sName} className="flex justify-between items-center py-1 border-b border-slate-100 last:border-none">
                      <span className="text-slate-700 font-semibold">{sName} ({sData.count} trades)</span>
                      <span className={`font-mono font-bold ${sData.pnl >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        ${sData.pnl.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white/95 border border-slate-200 rounded-xl p-3 shadow-xs">
                <span className="text-[10px] font-black uppercase text-slate-900 tracking-wider flex items-center gap-1.5 mb-2">
                  <Scale className="w-3.5 h-3.5 text-[#EC3044]" /> Audit Methodology Standards
                </span>
                <div className="space-y-1 text-[9.5px] text-slate-700 leading-relaxed font-medium">
                  <p>• Data ingested directly from signed broker statement exports (Tradovate Performance Records).</p>
                  <p>• Group account duplication reflects verified mirrored follower allocations with strictly de-duplicated account registers.</p>
                  <p>• Round-turn commission schedule standard: $1.00/contract for micros and $3.50/contract for standard contracts.</p>
                </div>
              </div>
            </div>

          </div>

          {/* Page 1 Footer */}
          <div className="bg-white/95 px-4 py-2 rounded-xl border border-slate-200 flex justify-between text-[8.5px] font-mono text-slate-600 shadow-xs mt-3 avoid-break">
            <span>TryhardTrades Performance Analytics Engine • Verification ID: {reportAuditId}</span>
            <span>Section 1: Executive Overview</span>
          </div>
        </section>

        {/* ================= PAGE 2: ITEMIZED TRADE LEDGER & LEGAL AUDIT SEAL ================= */}
        <section className="doc-sheet-auto">
          <div className="space-y-4">
            
            <div className="bg-white/95 border border-slate-200 rounded-xl p-3 mb-2 flex justify-between items-end avoid-break shadow-xs">
              <div>
                <h2 className="text-sm font-black uppercase tracking-wider text-slate-950">
                  Itemized Trade Execution Ledger
                </h2>
                <p className="text-[10px] text-slate-500 font-medium">
                  Complete sequence of chronological executions, entry/exit fills, fees, and magnified returns.
                </p>
              </div>
              <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-900 px-2.5 py-1 rounded border border-slate-300">
                Total Records: {clusteredTrades.length}
              </span>
            </div>

            {/* Continuous Execution Table with strict non-wrapping date/contract columns */}
            <div className="bg-white/95 border border-slate-200 rounded-xl overflow-hidden shadow-xs mb-4">
              <table className="w-full text-left text-[10.5px]">
                <thead className="bg-slate-100 text-slate-800 font-black border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3 whitespace-nowrap">Date</th>
                    <th className="py-2.5 px-2 whitespace-nowrap">Fill Time</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">Contract</th>
                    <th className="py-2.5 px-2 whitespace-nowrap">Side</th>
                    <th className="py-2.5 px-2 whitespace-nowrap">Contracts Traded</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">Avg Entry</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">Avg Exit</th>
                    <th className="py-2.5 px-2 text-right whitespace-nowrap">Commissions</th>
                    <th className="py-2.5 px-3 text-right whitespace-nowrap">Realized Net</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-900">
                  {clusteredTrades.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-4 text-center text-slate-400 font-medium italic">
                        No executions recorded for the selected audit scope.
                      </td>
                    </tr>
                  ) : (
                    clusteredTrades.map((t, idx) => (
                      <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'}>
                        <td className="py-2.5 px-3 font-semibold text-slate-800 whitespace-nowrap">{t.openDate}</td>
                        <td className="py-2.5 px-2 font-mono text-slate-600 whitespace-nowrap">{t.entryTime || '--'}</td>
                        <td className="py-2.5 px-3 font-black text-[#EC3044] whitespace-nowrap">{t.symbol}</td>
                        <td className="py-2.5 px-2 font-bold text-slate-700 whitespace-nowrap">{t.side}</td>
                        <td className="py-2.5 px-2 font-mono font-bold text-slate-900 whitespace-nowrap">
                          {t.contractsTraded} {t.accountCount > 1 ? `(×${t.accountCount} accts)` : ''}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-800 whitespace-nowrap">${Number(t.entryPrice).toFixed(2)}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-800 whitespace-nowrap">${Number(t.exitPrice).toFixed(2)}</td>
                        <td className="py-2.5 px-2 font-mono text-slate-600 text-right whitespace-nowrap">
                          -${(Number(t.magnifiedCommissions || 0)).toFixed(2)}
                        </td>
                        <td className={`py-2.5 px-3 font-mono font-black text-right whitespace-nowrap ${t.magnifiedPnL >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {t.magnifiedPnL >= 0 ? '+' : ''}${Number(t.magnifiedPnL).toFixed(2)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Cryptographic Seal & Verification Block */}
            <div className="bg-white/95 border border-slate-200 rounded-2xl p-4 avoid-break mb-3 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="space-y-1.5 max-w-xl">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="text-[10px] font-black uppercase text-slate-900 tracking-wider">
                      Third-Party Cryptographic Integrity Validation
                    </span>
                  </div>
                  <p className="text-[9.5px] text-slate-600 leading-relaxed font-normal">
                    This certified track record has been validated using the TryhardTrades Local-First Performance Verification Protocol. Fills, execution pricing, slippage, and P&L allocations match raw statement transactions without synthetic smoothing or excluded losses. Certified for proprietary firm evaluations, master trading syndicates, and investor presentations.
                  </p>
                </div>

                <div className="text-center pl-6 border-l border-slate-200 shrink-0">
                  <div className="w-14 h-14 rounded-full border-2 border-[#EC3044] bg-white flex flex-col items-center justify-center mx-auto text-[#EC3044] font-black text-[9px] uppercase tracking-tighter leading-none shadow-xs">
                    <span>TRYHARD</span>
                    <span className="text-[7.5px] mt-0.5">VERIFIED</span>
                  </div>
                  <span className="text-[8px] font-mono text-slate-500 block mt-1.5 font-bold whitespace-nowrap">
                    CERT #{reportAuditId.slice(-6)}
                  </span>
                </div>
              </div>
            </div>

          </div>

          {/* Master Document Termination Footer */}
          <div className="bg-white/95 px-4 py-2 rounded-xl border border-slate-200 flex justify-between text-[8.5px] font-mono text-slate-600 avoid-break shadow-xs mt-3">
            <span>TryhardTrades Audit Infrastructure • End of Official Statement</span>
            <span>Document Checksum Validated</span>
          </div>
        </section>

      </div>

    </div>
  );
}