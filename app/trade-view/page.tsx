'use client';

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/db';
import { cloudDb } from '@/lib/cloudDb';
import { syncLeaderTradeUpdates, deleteLeaderTradeCopies } from '@/lib/copier';
import { 
  Filter, 
  Calendar, 
  Settings, 
  ChevronDown, 
  Info, 
  Trash2, 
  Tag, 
  AlertTriangle, 
  Target, 
  Plus, 
  X, 
  RotateCcw, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  ExternalLink, 
  GripHorizontal, 
  Wallet, 
  ArrowDownRight, 
  Layers, 
  Sparkles 
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import AddTradeModal from '@/components/AddTradeModal';

type SortField = 'openDate' | 'netPnL' | null;
type SortDirection = 'asc' | 'desc';

interface ColumnConfig {
  id: string;
  label: string;
  sortable?: boolean;
}

interface AccountAdjustment {
  id?: string | number;
  accountId: string | number;
  type: 'deposit' | 'withdrawal';
  amount: number;
  date: string;
  note?: string;
}

const INITIAL_COLUMNS: ColumnConfig[] = [
  { id: 'openDate', label: 'Date', sortable: true },
  { id: 'symbol', label: 'Symbol' },
  { id: 'account', label: 'Scope' },
  { id: 'status', label: 'Status' },
  { id: 'side', label: 'Side' },
  { id: 'contractsTraded', label: 'Qty' },
  { id: 'entryPrice', label: 'Entry' },
  { id: 'exitPrice', label: 'Exit' },
  { id: 'commissions', label: 'Fees' },
  { id: 'netPnL', label: 'Net P&L', sortable: true },
  { id: 'setupTag', label: 'Setup' },
  { id: 'strategy', label: 'Strategy' },
  { id: 'mistakeTag', label: 'Mistake' },
  { id: 'closeTime', label: 'Time' },
];

export default function TradeViewPage() {
  const router = useRouter();

  const [rawTrades, setRawTrades] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [savedStrategies, setSavedStrategies] = useState<any[]>([]);
  const [savedSetups, setSavedSetups] = useState<any[]>([]);
  const [savedMistakes, setSavedMistakes] = useState<any[]>([]);
  const [adjustments, setAdjustments] = useState<AccountAdjustment[]>([]);

  const fetchCloudData = async () => {
    const trades = await cloudDb.getTrades();
    const accs = await cloudDb.getAccounts();
    const strats = await db.strategies.toArray();
    const setupsList = await db.setups.toArray();
    const mistakesList = await db.mistakes.toArray();

    setRawTrades(trades);
    setAccounts(accs);
    setSavedStrategies(strats);
    setSavedSetups(setupsList);
    setSavedMistakes(mistakesList);

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
    fetchCloudData();
  }, []);

  const [selectedTrades, setSelectedTrades] = useState<any[]>([]);
  const [showBulkMenu, setShowBulkMenu] = useState(false);
  const [isAddTradeOpen, setIsAddTradeOpen] = useState(false);

  const [activeFilterSelection, setActiveFilterSelection] = useState<{ 
    type: 'global' | 'group' | 'account'; 
    name: string 
  }>({ type: 'global', name: 'All Accounts' });

  const [columns, setColumns] = useState<ColumnConfig[]>(INITIAL_COLUMNS);
  const [draggedColumnId, setDraggedColumnId] = useState<string | null>(null);
  const [dropTargetColumnId, setDropTargetColumnId] = useState<string | null>(null);

  const [sortField, setSortField] = useState<SortField>('openDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [filterSymbol, setFilterSymbol] = useState('');
  const [filterSide, setFilterSide] = useState<'ALL' | 'LONG' | 'SHORT'>('ALL');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'WIN' | 'LOSS'>('ALL');

  const [showDateMenu, setShowDateMenu] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [tagModalType, setTagModalType] = useState<'setup' | 'mistake' | 'strategy' | null>(null);
  const [tagInputVal, setTagInputVal] = useState('');

  const [editingCellTradeId, setEditingCellTradeId] = useState<any | null>(null);
  const [editingCellType, setEditingCellType] = useState<'strategy' | 'setup' | 'mistake' | 'account' | null>(null);

  const [activeNewModalType, setActiveNewModalType] = useState<'strategy' | 'setup' | 'mistake' | null>(null);
  const [newModalInputVal, setNewModalInputVal] = useState('');
  const [targetTradeIdForNewTag, setTargetTradeIdForNewTag] = useState<any | null>(null);

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; tradeId: any } | null>(null);
  const [contextSubAction, setContextSubAction] = useState<'strategy' | 'setup' | 'mistake' | 'account' | null>(null);

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
      fetchCloudData();
    };

    window.addEventListener('account-filter-changed', handleAccountFilterChanged);
    return () => window.removeEventListener('account-filter-changed', handleAccountFilterChanged);
  }, []);

  useEffect(() => {
    const handleGlobalClick = () => {
      setContextMenu(null);
      setContextSubAction(null);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveNewModalType(null);
        setNewModalInputVal('');
        setTargetTradeIdForNewTag(null);
        setContextMenu(null);
        setContextSubAction(null);
      }
    };
    window.addEventListener('click', handleGlobalClick);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('click', handleGlobalClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
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

    if (filterSymbol.trim() && !trade.symbol.toLowerCase().includes(filterSymbol.toLowerCase().trim())) {
      return false;
    }
    if (filterSide !== 'ALL' && trade.side !== filterSide) {
      return false;
    }
    if (filterStatus !== 'ALL' && trade.status !== filterStatus) {
      return false;
    }
    if (startDate && trade.openDate < startDate) {
      return false;
    }
    if (endDate && trade.openDate > endDate) {
      return false;
    }
    return true;
  });

  const isIndividualAccountView = activeFilterSelection.type === 'account';

  const magnifiedTrades = React.useMemo(() => {
    if (isIndividualAccountView) {
      return scopedTrades.map(t => ({
        ...t,
        magnifiedPnL: t.netPnL || 0,
        individualPnL: t.netPnL || 0,
        magnifiedCommissions: t.commissions || 0,
        accountCount: 1,
        allIds: [t.id]
      }));
    }

    const clusters: Record<string, {
      baseTrade: any;
      allIds: any[];
      uniqueAccountNames: Set<string>;
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
          allIds: [],
          uniqueAccountNames: new Set()
        };
      }

      clusters[clusterKey].allIds.push(trade.id);
      if (trade.account) {
        clusters[clusterKey].uniqueAccountNames.add(trade.account);
      }
    });

    return Object.values(clusters).map(({ baseTrade, allIds, uniqueAccountNames }) => {
      const count = uniqueAccountNames.size > 0 ? uniqueAccountNames.size : 1;
      const individualPnL = Number(baseTrade.netPnL) || 0;
      const magnifiedPnL = individualPnL * count;
      const magnifiedCommissions = Number(baseTrade.commissions || 0) * count;

      return {
        ...baseTrade,
        magnifiedPnL,
        individualPnL,
        magnifiedCommissions,
        accountCount: count,
        allIds
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

  const trades = [...magnifiedTrades].sort((a, b) => {
    if (!sortField) return 0;

    if (sortField === 'openDate') {
      const dateA = new Date(`${a.openDate} ${a.entryTime || '00:00'}`).getTime();
      const dateB = new Date(`${b.openDate} ${b.entryTime || '00:00'}`).getTime();
      return sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
    }

    if (sortField === 'netPnL') {
      const pnlA = a.magnifiedPnL || 0;
      const pnlB = b.magnifiedPnL || 0;
      return sortDirection === 'asc' ? pnlA - pnlB : pnlB - pnlA;
    }

    return 0;
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const toggleSelectAll = () => {
    if (selectedTrades.length === trades.length) setSelectedTrades([]);
    else setSelectedTrades(trades.map(t => t.id!).filter(Boolean));
  };

  const toggleSelect = (id: any, e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedTrades.includes(id)) setSelectedTrades(selectedTrades.filter(item => item !== id));
    else setSelectedTrades([...selectedTrades, id]);
  };

  const handleMassDelete = async () => {
    if (selectedTrades.length === 0) return;
    if (confirm(`Delete ${selectedTrades.length} execution(s)? Follower copies will also be removed.`)) {
      const { supabase } = await import('@/lib/supabase');
      for (const id of selectedTrades) {
        const match = trades.find(t => t.id === id);
        const idsToDelete = match?.allIds || [id];

        for (const targetId of idsToDelete) {
          await supabase.from('trades').delete().eq('id', targetId);
          await deleteLeaderTradeCopies(targetId);
          await db.trades.delete(targetId);
        }
      }

      setSelectedTrades([]);
      setShowBulkMenu(false);
      fetchCloudData();
    }
  };

  const handleApplyMassTag = async () => {
    if (!tagModalType || !tagInputVal.trim() || selectedTrades.length === 0) return;
    const val = tagInputVal.trim();
    const { supabase } = await import('@/lib/supabase');

    for (const id of selectedTrades) {
      const match = trades.find(t => t.id === id);
      const idsToUpdate = match?.allIds || [id];

      const fieldKey = tagModalType === 'setup' ? 'setup_tag' : tagModalType === 'mistake' ? 'mistake_tag' : 'strategy';
      const localFieldKey = tagModalType === 'setup' ? 'setupTag' : tagModalType === 'mistake' ? 'mistakeTag' : 'strategy';

      for (const targetId of idsToUpdate) {
        await supabase.from('trades').update({ [fieldKey]: val }).eq('id', targetId);
        await syncLeaderTradeUpdates(targetId, { [localFieldKey]: val });
        await db.trades.update(targetId, { [localFieldKey]: val });
      }
    }

    setTagModalType(null);
    setTagInputVal('');
    setSelectedTrades([]);
    fetchCloudData();
  };

  const handleInlineCellChange = async (tradeId: any, field: 'strategy' | 'setupTag' | 'mistakeTag' | 'account', val: string) => {
    if (val === '__NEW__') {
      setEditingCellTradeId(null);
      setEditingCellType(null);
      setTargetTradeIdForNewTag(tradeId);
      setActiveNewModalType(field === 'mistakeTag' ? 'mistake' : field === 'strategy' ? 'strategy' : 'setup');
      return;
    }

    const finalVal = val === '__EMPTY__' ? '' : val;
    const { supabase } = await import('@/lib/supabase');

    const match = trades.find(t => t.id === tradeId);
    const idsToUpdate = match?.allIds || [tradeId];

    if (field === 'account') {
      const matchedAcc = accounts.find(a => a.name === finalVal);
      for (const targetId of idsToUpdate) {
        await supabase.from('trades').update({ 
          account: finalVal || null,
          account_group: matchedAcc ? matchedAcc.groupName : null
        }).eq('id', targetId);
        await db.trades.update(targetId, { 
          account: finalVal || undefined,
          accountGroup: matchedAcc ? matchedAcc.groupName : undefined
        });
      }
    } else {
      const dbField = field === 'setupTag' ? 'setup_tag' : field === 'mistakeTag' ? 'mistake_tag' : 'strategy';
      for (const targetId of idsToUpdate) {
        await supabase.from('trades').update({ [dbField]: finalVal || null }).eq('id', targetId);
        await syncLeaderTradeUpdates(targetId, { [field]: finalVal });
        await db.trades.update(targetId, { [field]: finalVal });
      }
    }

    setEditingCellTradeId(null);
    setEditingCellType(null);
    fetchCloudData();
  };

  const handleCreateNewTagPopup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newModalInputVal.trim() || !activeNewModalType || !targetTradeIdForNewTag) return;
    const name = newModalInputVal.trim();
    const { supabase } = await import('@/lib/supabase');

    const match = trades.find(t => t.id === targetTradeIdForNewTag);
    const idsToUpdate = match?.allIds || [targetTradeIdForNewTag];

    if (activeNewModalType === 'strategy') {
      const exists = await db.strategies.where('name').equals(name).first();
      if (!exists) await db.strategies.put({ name });
      for (const targetId of idsToUpdate) {
        await supabase.from('trades').update({ strategy: name }).eq('id', targetId);
        await syncLeaderTradeUpdates(targetId, { strategy: name });
        await db.trades.update(targetId, { strategy: name });
      }
    } else if (activeNewModalType === 'setup') {
      const exists = await db.setups.where('name').equals(name).first();
      if (!exists) await db.setups.put({ name });
      for (const targetId of idsToUpdate) {
        await supabase.from('trades').update({ setup_tag: name }).eq('id', targetId);
        await syncLeaderTradeUpdates(targetId, { setupTag: name });
        await db.trades.update(targetId, { setupTag: name });
      }
    } else if (activeNewModalType === 'mistake') {
      const exists = await db.mistakes.where('name').equals(name).first();
      if (!exists) await db.mistakes.put({ name });
      for (const targetId of idsToUpdate) {
        await supabase.from('trades').update({ mistake_tag: name }).eq('id', targetId);
        await syncLeaderTradeUpdates(targetId, { mistakeTag: name });
        await db.trades.update(targetId, { mistakeTag: name });
      }
    }

    setActiveNewModalType(null);
    setNewModalInputVal('');
    setTargetTradeIdForNewTag(null);
    fetchCloudData();
  };

  const resetFilters = () => {
    setFilterSymbol('');
    setFilterSide('ALL');
    setFilterStatus('ALL');
    setStartDate('');
    setEndDate('');
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedColumnId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dropTargetColumnId !== id) {
      setDropTargetColumnId(id);
    }
  };

  const handleDragLeave = () => {
    setDropTargetColumnId(null);
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedColumnId || draggedColumnId === targetId) {
      setDraggedColumnId(null);
      setDropTargetColumnId(null);
      return;
    }

    const draggedIndex = columns.findIndex(c => c.id === draggedColumnId);
    const targetIndex = columns.findIndex(c => c.id === targetId);

    if (draggedIndex < 0 || targetIndex < 0) return;

    const newColumns = [...columns];
    const [removed] = newColumns.splice(draggedIndex, 1);
    newColumns.splice(targetIndex, 0, removed);

    setColumns(newColumns);
    setDraggedColumnId(null);
    setDropTargetColumnId(null);
  };

  const handleDragEnd = () => {
    setDraggedColumnId(null);
    setDropTargetColumnId(null);
  };

  const totalPnL = trades.reduce((acc, t) => acc + (t.magnifiedPnL || 0), 0);
  const winTrades = trades.filter(t => (t.magnifiedPnL || 0) > 0);
  const lossTrades = trades.filter(t => (t.magnifiedPnL || 0) < 0);
  
  const winCount = winTrades.length;
  const lossCount = lossTrades.length;
  const winRate = trades.length > 0 ? ((winCount / trades.length) * 100).toFixed(1) : '0';

  const grossWins = winTrades.reduce((acc, t) => acc + t.magnifiedPnL, 0);
  const grossLosses = Math.abs(lossTrades.reduce((acc, t) => acc + t.magnifiedPnL, 0));
  const profitFactor = grossLosses > 0 ? (grossWins / grossLosses).toFixed(2) : grossWins > 0 ? '99.00' : '0.00';

  const avgWin = winCount > 0 ? grossWins / winCount : 0;
  const avgLoss = lossCount > 0 ? grossLosses / lossCount : 0;
  const avgWinLossRatio = avgLoss > 0 ? (avgWin / avgLoss).toFixed(2) : '0.00';

  const totalWithdrawals = filteredAdjustments
    .filter(a => a.type === 'withdrawal')
    .reduce((sum, a) => sum + Number(a.amount), 0);

  const totalDeposits = filteredAdjustments
    .filter(a => a.type === 'deposit')
    .reduce((sum, a) => sum + Number(a.amount), 0);

  const netBalanceAfterAdjustments = totalPnL + totalDeposits - totalWithdrawals;
  const hasActiveFilters = filterSymbol || filterSide !== 'ALL' || filterStatus !== 'ALL' || startDate || endDate;

  return (
    <div className="p-6 bg-[#F8F9FD] min-h-screen text-slate-800 font-sans w-full max-w-full overflow-hidden">
      
      {/* Top Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <span>Trade View</span>
            {!isIndividualAccountView && (
              <span className="text-[10px] bg-[#ec3044]/10 text-[#ec3044] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 border border-[#ec3044]/20">
                <Sparkles className="w-3 h-3" /> Magnified View
              </span>
            )}
          </h1>
          {activeFilterSelection.type !== 'global' ? (
            <p className="text-xs font-bold text-[#ec3044] mt-0.5">
              Scoped to {activeFilterSelection.type === 'group' ? 'Group:' : 'Account:'} {activeFilterSelection.name}
            </p>
          ) : (
            <p className="text-xs text-slate-400 mt-0.5">Unified executions with aggregate group magnification.</p>
          )}
        </div>
        
        <div className="flex items-center gap-2 relative">
          <button 
            onClick={() => setIsAddTradeOpen(true)} 
            className="flex items-center gap-1.5 bg-[#ec3044] hover:bg-[#d4283b] text-white font-bold px-3 py-1.5 rounded-lg text-xs shadow-sm transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Add Trade
          </button>

          <div className="relative">
            <button 
              onClick={() => { setShowFilterMenu(!showFilterMenu); setShowDateMenu(false); }}
              className={`flex items-center gap-1.5 bg-white border px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition ${
                filterSymbol || filterSide !== 'ALL' || filterStatus !== 'ALL'
                  ? 'border-[#ec3044] text-[#ec3044] bg-[#ec3044]/5 font-bold'
                  : 'border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Filter className="w-3.5 h-3.5 text-[#ec3044]" /> Filters <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {showFilterMenu && (
              <div className="absolute right-0 top-full mt-2 w-60 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-3 space-y-2.5 text-xs">
                <div className="flex justify-between items-center border-b border-slate-100 pb-1.5">
                  <span className="font-bold text-slate-900">Filter Trades</span>
                  <button onClick={() => setShowFilterMenu(false)} className="text-slate-400 hover:text-slate-600"><X className="w-3.5 h-3.5"/></button>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">Symbol</label>
                  <input 
                    type="text" 
                    value={filterSymbol} 
                    onChange={e => setFilterSymbol(e.target.value)} 
                    placeholder="E.g. NQ" 
                    className="w-full border border-slate-200 rounded-lg p-1.5 font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#ec3044]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">Side</label>
                    <select 
                      value={filterSide} 
                      onChange={e => setFilterSide(e.target.value as any)} 
                      className="w-full border border-slate-200 rounded-lg p-1.5 font-bold text-slate-800 focus:outline-none"
                    >
                      <option value="ALL">All Sides</option>
                      <option value="LONG">LONG</option>
                      <option value="SHORT">SHORT</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">Outcome</label>
                    <select 
                      value={filterStatus} 
                      onChange={e => setFilterStatus(e.target.value as any)} 
                      className="w-full border border-slate-200 rounded-lg p-1.5 font-bold text-slate-800 focus:outline-none"
                    >
                      <option value="ALL">All</option>
                      <option value="WIN">WIN</option>
                      <option value="LOSS">LOSS</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-between pt-2 border-t border-slate-100">
                  <button onClick={resetFilters} className="text-slate-400 hover:text-slate-600 flex items-center gap-1 text-[10px] font-bold cursor-pointer">
                    <RotateCcw className="w-3 h-3" /> Reset
                  </button>
                  <button onClick={() => setShowFilterMenu(false)} className="px-2.5 py-1 bg-[#ec3044] text-white font-bold rounded-md text-[11px] cursor-pointer">
                    Apply
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="relative">
            <button 
              onClick={() => { setShowDateMenu(!showDateMenu); setShowFilterMenu(false); }}
              className={`flex items-center gap-1.5 bg-white border px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition ${
                startDate || endDate
                  ? 'border-[#ec3044] text-[#ec3044] bg-[#ec3044]/5 font-bold'
                  : 'border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Calendar className="w-3.5 h-3.5 text-[#ec3044]" /> Dates <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {showDateMenu && (
              <div className="absolute right-0 top-full mt-2 w-60 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-3 space-y-2.5 text-xs">
                <div className="flex justify-between items-center border-b border-slate-100 pb-1.5">
                  <span className="font-bold text-slate-900">Date Range</span>
                  <button onClick={() => setShowDateMenu(false)} className="text-slate-400 hover:text-slate-600"><X className="w-3.5 h-3.5"/></button>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">Start</label>
                  <input 
                    type="date" 
                    value={startDate} 
                    onChange={e => setStartDate(e.target.value)} 
                    className="w-full border border-slate-200 rounded-lg p-1.5 font-bold text-slate-800 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">End</label>
                  <input 
                    type="date" 
                    value={endDate} 
                    onChange={e => setEndDate(e.target.value)} 
                    className="w-full border border-slate-200 rounded-lg p-1.5 font-bold text-slate-800 focus:outline-none"
                  />
                </div>

                <div className="flex justify-between pt-2 border-t border-slate-100">
                  <button onClick={() => { setStartDate(''); setEndDate(''); }} className="text-slate-400 hover:text-slate-600 text-[10px] font-bold cursor-pointer">
                    Clear
                  </button>
                  <button onClick={() => setShowDateMenu(false)} className="px-2.5 py-1 bg-[#ec3044] text-white font-bold rounded-md text-[11px] cursor-pointer">
                    Apply
                  </button>
                </div>
              </div>
            )}
          </div>

          {hasActiveFilters && (
            <button 
              onClick={resetFilters} 
              className="text-[11px] font-bold text-[#ec3044] hover:underline flex items-center gap-1 cursor-pointer bg-[#ec3044]/10 px-2 py-1 rounded-lg border border-[#ec3044]/20"
            >
              <RotateCcw className="w-3 h-3" /> Reset
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mb-6">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex flex-col justify-between h-28">
          <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-500">
            <span>Net cumulative P&L</span>
            <span className="bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded text-[9px] font-bold">
              {trades.length}
            </span>
          </div>
          <div>
            <div className={`text-2xl font-black ${totalPnL >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
              {totalPnL >= 0 ? `$${totalPnL.toFixed(2)}` : `-$${Math.abs(totalPnL).toFixed(2)}`}
            </div>

            {(totalWithdrawals > 0 || totalDeposits > 0) && (
              <div className="text-[10px] font-bold mt-0.5 flex items-center gap-1">
                <span className="text-slate-400">Bal:</span>
                <span className={netBalanceAfterAdjustments >= 0 ? "text-emerald-600 font-mono" : "text-rose-600 font-mono"}>
                  ${netBalanceAfterAdjustments.toFixed(2)}
                </span>
                {totalWithdrawals > 0 && (
                  <span className="text-rose-500 text-[9px] font-semibold flex items-center">
                    <ArrowDownRight className="w-2.5 h-2.5" />-${totalWithdrawals.toFixed(2)}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex flex-col justify-between h-28">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500">
            <span>Profit factor</span>
            <Info className="w-3 h-3 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-slate-900">{profitFactor}</div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex flex-col justify-between h-28">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500">
            <span>Trade win %</span>
            <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1 rounded">
              {winCount}W / {lossCount}L
            </span>
          </div>
          <div className="text-2xl font-black text-slate-900">{winRate}%</div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex flex-col justify-between h-28">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500">
            <span>Avg win/loss trade</span>
          </div>
          <div className={`text-2xl font-black ${Number(avgWinLossRatio) >= 1 ? 'text-emerald-500' : 'text-slate-900'}`}>
            {avgWinLossRatio}
          </div>
        </div>
      </div>

      {/* Responsive Contained Trades Table */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden w-full">
        <div className="p-3.5 flex justify-between items-center border-b border-slate-100 bg-slate-50/50">
          <div className="text-xs font-bold text-slate-600">
            {selectedTrades.length > 0 ? (
              <span className="text-[#ec3044] bg-[#ec3044]/10 px-2 py-0.5 rounded font-bold">
                {selectedTrades.length} execution(s) selected
              </span>
            ) : (
              <span>Showing {trades.length} execution{trades.length === 1 ? '' : 's'}</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button 
              disabled={selectedTrades.length === 0}
              onClick={() => setShowBulkMenu(!showBulkMenu)}
              className={`px-3 py-1 font-bold text-xs rounded-lg border flex items-center gap-1.5 transition ${
                selectedTrades.length > 0 
                  ? 'bg-[#ec3044] text-white border-transparent cursor-pointer hover:bg-[#d4283b]' 
                  : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60'
              }`}
            >
              Bulk actions <ChevronDown className="w-3 h-3" />
            </button>

            {showBulkMenu && selectedTrades.length > 0 && (
              <div className="absolute right-6 top-52 w-48 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-1 text-xs font-semibold text-slate-700 space-y-0.5">
                <button onClick={() => { setTagModalType('setup'); setShowBulkMenu(false); }} className="flex items-center gap-2 w-full p-1.5 hover:bg-slate-50 rounded text-left">
                  <Tag className="w-3 h-3 text-[#ec3044]" /> Setup Tag
                </button>
                <button onClick={() => { setTagModalType('mistake'); setShowBulkMenu(false); }} className="flex items-center gap-2 w-full p-1.5 hover:bg-slate-50 rounded text-left">
                  <AlertTriangle className="w-3 h-3 text-amber-500" /> Mistake Tag
                </button>
                <button onClick={() => { setTagModalType('strategy'); setShowBulkMenu(false); }} className="flex items-center gap-2 w-full p-1.5 hover:bg-slate-50 rounded text-left">
                  <Target className="w-3 h-3 text-blue-500" /> Strategy
                </button>
                <div className="border-t border-slate-100 my-0.5" />
                <button onClick={handleMassDelete} className="flex items-center gap-2 w-full p-1.5 hover:bg-rose-50 text-rose-600 rounded text-left font-bold">
                  <Trash2 className="w-3 h-3" /> Mass Delete ({selectedTrades.length})
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Fit-to-screen table layout */}
        <div className="w-full overflow-x-hidden">
          <table className="w-full text-left text-xs table-fixed">
            <thead className="bg-[#F8F9FD] text-slate-500 text-[11px] font-semibold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-2 w-8 text-center">
                  <input 
                    type="checkbox" 
                    onChange={toggleSelectAll} 
                    checked={selectedTrades.length === trades.length && trades.length > 0} 
                    className="rounded border-slate-300 text-[#ec3044]"
                  />
                </th>

                {columns.map((col) => {
                  const isDragging = draggedColumnId === col.id;
                  const isDropTarget = dropTargetColumnId === col.id;

                  return (
                    <th
                      key={col.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, col.id)}
                      onDragOver={(e) => handleDragOver(e, col.id)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, col.id)}
                      onDragEnd={handleDragEnd}
                      onClick={() => col.sortable && handleSort(col.id as SortField)}
                      className={`py-2.5 px-2 font-semibold text-slate-700 truncate select-none cursor-grab active:cursor-grabbing transition ${
                        col.sortable ? 'cursor-pointer hover:text-[#ec3044]' : ''
                      } ${isDragging ? 'opacity-40 bg-slate-200/50' : 'hover:bg-slate-100/60'} ${
                        isDropTarget ? 'border-l-2 border-l-[#ec3044] bg-[#ec3044]/5' : ''
                      }`}
                    >
                      <div className="flex items-center gap-1">
                        <span className="truncate">{col.label}</span>
                        {col.sortable && sortField === col.id && (
                          sortDirection === 'desc' ? <ArrowDown className="w-3 h-3 text-[#ec3044] shrink-0" /> : <ArrowUp className="w-3 h-3 text-[#ec3044] shrink-0" />
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 text-xs">
              {trades.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + 1} className="py-12 text-center text-slate-400">
                    No executions recorded. Click{' '}
                    <button onClick={() => setIsAddTradeOpen(true)} className="font-bold text-[#ec3044] hover:underline">
                      + Add Trade
                    </button>
                  </td>
                </tr>
              ) : (
                trades.map((trade) => {
                  const isSelected = selectedTrades.includes(trade.id!);

                  return (
                    <tr 
                      key={trade.id} 
                      onClick={() => router.push(`/trade-view/${trade.id}`)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setContextMenu({ x: e.clientX, y: e.clientY, tradeId: trade.id! });
                        setContextSubAction(null);
                      }}
                      className={`hover:bg-[#ec3044]/5 cursor-pointer transition ${isSelected ? 'bg-[#ec3044]/10' : ''}`}
                    >
                      <td className="py-2.5 px-2 text-center" onClick={(e) => e.stopPropagation()}>
                        <input 
                          type="checkbox" 
                          checked={isSelected} 
                          onChange={(e) => toggleSelect(trade.id!, e as any)} 
                          className="rounded border-slate-300 text-[#ec3044] cursor-pointer"
                        />
                      </td>

                      {columns.map((col) => {
                        switch (col.id) {
                          case 'openDate':
                            return <td key={col.id} className="py-2.5 px-2 font-medium text-slate-600 truncate">{trade.openDate}</td>;
                          case 'symbol':
                            return (
                              <td key={col.id} className="py-2.5 px-2 font-bold text-[#ec3044] truncate hover:underline">
                                {trade.symbol}
                              </td>
                            );
                          case 'account':
                            return (
                              <td key={col.id} className="py-2.5 px-2 font-medium truncate" onClick={(e) => e.stopPropagation()}>
                                {trade.accountCount > 1 ? (
                                  <div className="flex items-center gap-1 truncate">
                                    <span className="font-bold text-slate-800 truncate">{trade.accountGroup || 'Group'}</span>
                                    <span className="text-[9px] bg-slate-100 text-slate-600 font-extrabold px-1 rounded border border-slate-200 shrink-0">
                                      ×{trade.accountCount}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-slate-800 font-semibold truncate block">
                                    {trade.account || <span className="text-slate-400 italic">Unassigned</span>}
                                  </span>
                                )}
                              </td>
                            );
                          case 'status':
                            return (
                              <td key={col.id} className="py-2.5 px-2 truncate">
                                {trade.magnifiedPnL > 0 ? (
                                  <span className="px-1.5 py-0.2 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded text-[9px] font-bold">WIN</span>
                                ) : trade.magnifiedPnL < 0 ? (
                                  <span className="px-1.5 py-0.2 bg-rose-50 text-rose-500 border border-rose-200 rounded text-[9px] font-bold">LOSS</span>
                                ) : (
                                  <span className="px-1.5 py-0.2 bg-slate-50 text-slate-500 border border-slate-200 rounded text-[9px] font-bold">BE</span>
                                )}
                              </td>
                            );
                          case 'side':
                            return <td key={col.id} className="py-2.5 px-2 font-semibold text-slate-500 truncate">{trade.side || 'LONG'}</td>;
                          case 'contractsTraded':
                            return <td key={col.id} className="py-2.5 px-2 font-mono font-semibold text-slate-700 truncate">{trade.contractsTraded || 1}</td>;
                          case 'entryPrice':
                            return <td key={col.id} className="py-2.5 px-2 font-mono text-slate-700 truncate">${Number(trade.entryPrice).toFixed(2)}</td>;
                          case 'exitPrice':
                            return <td key={col.id} className="py-2.5 px-2 font-mono text-slate-700 truncate">${Number(trade.exitPrice).toFixed(2)}</td>;
                          case 'commissions':
                            return (
                              <td key={col.id} className="py-2.5 px-2 font-mono text-slate-400 font-semibold truncate">
                                ${(Number(trade.commissions || 0) * (trade.accountCount || 1)).toFixed(2)}
                              </td>
                            );
                          case 'netPnL':
                            return (
                              <td key={col.id} className="py-2.5 px-2 font-mono truncate">
                                <div className={`font-black ${trade.magnifiedPnL >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                  {trade.magnifiedPnL >= 0 ? '+' : '-'}${Math.abs(Number(trade.magnifiedPnL)).toFixed(2)}
                                </div>
                                {trade.accountCount > 1 && (
                                  <div className="text-[9px] text-slate-400 font-semibold truncate">
                                    ${Number(trade.individualPnL).toFixed(2)}/acct
                                  </div>
                                )}
                              </td>
                            );
                          case 'setupTag':
                            return (
                              <td key={col.id} className="py-2.5 px-2 text-slate-600 truncate" onClick={(e) => e.stopPropagation()}>
                                <span onClick={() => { setEditingCellTradeId(trade.id!); setEditingCellType('setup'); }} className="truncate block hover:underline">
                                  {trade.setupTag || '--'}
                                </span>
                              </td>
                            );
                          case 'strategy':
                            return (
                              <td key={col.id} className="py-2.5 px-2 text-[#ec3044] font-semibold truncate" onClick={(e) => e.stopPropagation()}>
                                <span onClick={() => { setEditingCellTradeId(trade.id!); setEditingCellType('strategy'); }} className="truncate block hover:underline">
                                  {trade.strategy || '--'}
                                </span>
                              </td>
                            );
                          case 'mistakeTag':
                            return (
                              <td key={col.id} className="py-2.5 px-2 text-amber-600 font-semibold truncate" onClick={(e) => e.stopPropagation()}>
                                <span onClick={() => { setEditingCellTradeId(trade.id!); setEditingCellType('mistake'); }} className="truncate block hover:underline">
                                  {trade.mistakeTag || '--'}
                                </span>
                              </td>
                            );
                          case 'closeTime':
                            return <td key={col.id} className="py-2.5 px-2 text-slate-400 truncate">{trade.exitTime || '--'}</td>;
                          default:
                            return <td key={col.id} className="py-2.5 px-2 truncate">--</td>;
                        }
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* RIGHT-CLICK CONTEXT MENU MODAL */}
      {contextMenu && (
        <div 
          onClick={(e) => e.stopPropagation()}
          style={{ top: `${Math.min(contextMenu.y, window.innerHeight - 250)}px`, left: `${Math.min(contextMenu.x, window.innerWidth - 220)}px` }}
          className="absolute bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 w-52 p-1.5 text-xs font-semibold text-slate-700 space-y-1"
        >
          <div className="px-3 py-1.5 border-b border-slate-100 font-bold text-slate-400 text-[10px] uppercase">
            Quick Actions
          </div>

          <button 
            onClick={() => { router.push(`/trade-view/${contextMenu.tradeId}`); setContextMenu(null); }}
            className="flex items-center gap-2.5 w-full p-2 hover:bg-slate-50 rounded-lg text-left cursor-pointer text-slate-800"
          >
            <ExternalLink className="w-3.5 h-3.5 text-slate-400" /> View Full Trade
          </button>

          <button 
            onClick={() => setContextSubAction(contextSubAction === 'account' ? null : 'account')}
            className="flex items-center gap-2.5 w-full p-2 hover:bg-slate-50 rounded-lg text-left cursor-pointer text-[#ec3044]"
          >
            <Wallet className="w-3.5 h-3.5" /> Assign Account
          </button>
          {contextSubAction === 'account' && (
            <div className="pl-4 pr-1 py-1 space-y-1 bg-slate-50 rounded-lg">
              {accounts.map(a => (
                <div 
                  key={a.id || a.name} 
                  onClick={async () => { 
                    const match = trades.find(t => t.id === contextMenu.tradeId);
                    const idsToUpdate = match?.allIds || [contextMenu.tradeId];
                    const { supabase } = await import('@/lib/supabase');
                    for (const targetId of idsToUpdate) {
                      await supabase.from('trades').update({ account: a.name, account_group: a.groupName }).eq('id', targetId);
                      await db.trades.update(targetId, { account: a.name, accountGroup: a.groupName });
                    }
                    setContextMenu(null);
                    fetchCloudData();
                  }}
                  className="p-1.5 hover:bg-slate-200/60 rounded cursor-pointer font-bold text-slate-700 truncate"
                >
                  {a.name} ({a.groupName})
                </div>
              ))}
            </div>
          )}

          <div className="border-t border-slate-100 my-1" />

          <button 
            onClick={async () => {
              if (confirm('Are you sure you want to delete this execution across all copied accounts?')) {
                const match = trades.find(t => t.id === contextMenu.tradeId);
                const idsToDelete = match?.allIds || [contextMenu.tradeId];
                const { supabase } = await import('@/lib/supabase');
                for (const targetId of idsToDelete) {
                  await supabase.from('trades').delete().eq('id', targetId);
                  await deleteLeaderTradeCopies(targetId);
                  await db.trades.delete(targetId);
                }
                setContextMenu(null);
                fetchCloudData();
              }
            }}
            className="flex items-center gap-2.5 w-full p-2 hover:bg-rose-50 text-rose-600 rounded-lg text-left font-bold cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete Across All Accounts
          </button>
        </div>
      )}

      {/* Mass Tag Modal */}
      {tagModalType && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-sm p-5 shadow-xl">
            <h3 className="text-sm font-bold text-slate-900 mb-2 capitalize">
              Apply {tagModalType} to {selectedTrades.length} selected execution(s)
            </h3>
            <input 
              type="text" 
              value={tagInputVal} 
              onChange={e => setTagInputVal(e.target.value)} 
              placeholder={`Enter ${tagModalType} value...`} 
              className="w-full border border-[#ec3044]/40 rounded-lg p-2.5 text-xs text-[#ec3044] font-semibold mb-4 focus:outline-none focus:ring-2 focus:ring-[#ec3044]"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setTagModalType(null)} className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-semibold cursor-pointer">
                Cancel
              </button>
              <button 
                onClick={handleApplyMassTag} 
                className="px-4 py-1.5 bg-[#ec3044] hover:bg-[#d4283b] text-white rounded-lg text-xs font-bold shadow-md cursor-pointer"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tag Creation Modal */}
      {activeNewModalType && (
        <div 
          onClick={() => { setActiveNewModalType(null); setNewModalInputVal(''); setTargetTradeIdForNewTag(null); }}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <div 
            onClick={e => e.stopPropagation()}
            className="bg-white border border-slate-200 rounded-2xl w-full max-w-sm p-5 shadow-2xl"
          >
            <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 capitalize">
                Create New {activeNewModalType} Tag
              </h3>
              <button 
                onClick={() => { setActiveNewModalType(null); setNewModalInputVal(''); setTargetTradeIdForNewTag(null); }} 
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateNewTagPopup} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1 capitalize">{activeNewModalType} Name</label>
                <input 
                  type="text" 
                  autoFocus
                  value={newModalInputVal} 
                  onChange={e => setNewModalInputVal(e.target.value)} 
                  placeholder={`Enter ${activeNewModalType} tag name...`} 
                  className="w-full border border-[#ec3044]/40 bg-[#ec3044]/5 rounded-xl p-2.5 text-xs text-[#ec3044] font-bold focus:outline-none focus:ring-2 focus:ring-[#ec3044]"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => { setActiveNewModalType(null); setNewModalInputVal(''); setTargetTradeIdForNewTag(null); }} 
                  className="px-3.5 py-1.5 bg-slate-100 text-slate-600 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-4 py-1.5 bg-[#ec3044] hover:bg-[#d4283b] text-white rounded-xl text-xs font-bold shadow-md cursor-pointer"
                >
                  Create & Select
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Global Add Trade Modal */}
      <AddTradeModal isOpen={isAddTradeOpen} onClose={() => { setIsAddTradeOpen(false); fetchCloudData(); }} />

    </div>
  );
}