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
  TrendingDown,
  ArrowDownRight,
  ArrowUpRight,
  Flag,
  ShieldAlert
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

  // Filter scoped trades
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

  // Cluster trades to eliminate multiple counts for cloned trades
  const clusteredTrades = React.useMemo(() => {
    if (isIndividualAccountView) {
      return scopedTrades.map(t => ({
        ...t,
        magnifiedPnL: t.netPnL || 0,
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
      const magnifiedPnL = individualPnL * count;

      return {
        ...baseTrade,
        magnifiedPnL,
        individualPnL,
        accountCount: count,
      };
    });
  }, [scopedTrades, isIndividualAccountView]);

  // Adjustments filter
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

  // KPI calculations based on consolidated executions
  const grossTradePnL = clusteredTrades.reduce((acc, t) => acc + (t.magnifiedPnL || 0), 0);
  const winTrades = clusteredTrades.filter(t => (t.magnifiedPnL || 0) > 0);
  const lossTrades = clusteredTrades.filter(t => (t.magnifiedPnL || 0) < 0);
  const totalTradesCount = clusteredTrades.length;
  const winRate = totalTradesCount > 0 ? ((winTrades.length / totalTradesCount) * 100).toFixed(1) : '0';

  const grossWins = winTrades.reduce((acc, t) => acc + t.magnifiedPnL, 0);
  const grossLosses = Math.abs(lossTrades.reduce((acc, t) => acc + t.magnifiedPnL, 0));
  const profitFactor = grossLosses > 0 ? (grossWins / grossLosses).toFixed(2) : grossWins > 0 ? '99.00' : '0.00';

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

  // Mistake Impact
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

  // CME Session Edge
  const sessionMap: Record<string, { count: number; pnl: number }> = {
    'RTH AM': { count: 0, pnl: 0 },
    'RTH PM': { count: 0, pnl: 0 },
    'Globex': { count: 0, pnl: 0 }
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
      sessionMap['RTH AM'].count += 1;
      sessionMap['RTH AM'].pnl += (t.magnifiedPnL || 0);
    } else if (timeDecimal >= 12.0 && timeDecimal <= 15.0) {
      sessionMap['RTH PM'].count += 1;
      sessionMap['RTH PM'].pnl += (t.magnifiedPnL || 0);
    } else {
      sessionMap['Globex'].count += 1;
      sessionMap['Globex'].pnl += (t.magnifiedPnL || 0);
    }
  });

  // Consolidated Events for True Chronological Equity Curve
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

  const equityData = [{ pnl: 0, date: 'Start', symbol: 'Baseline', tradePnL: 0, individualPnL: 0, accountCount: 1, isAdjustment: false }, ...cumulativePoints];

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

  return (
    <div className="p-8 bg-[#F8F9FD] min-h-screen text-slate-800 font-sans space-y-8 w-full max-w-[1700px] mx-auto">

      {/* Header */}
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
            onClick={() => window.print()}
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

      {/* KPI Cards */}
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

      {/* True Stepped Equity Curve */}
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
                    strokeWidth={p.isAdjustment ? "2.5" : "3"} 
                    strokeDasharray={p.isAdjustment ? "4 3" : undefined}
                    strokeLinecap="round" 
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

      {/* Analytics Modules */}
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

    </div>
  );
}