'use client';

import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
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
  Wallet
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

const INITIAL_COLUMNS: ColumnConfig[] = [
  { id: 'openDate', label: 'Open date', sortable: true },
  { id: 'symbol', label: 'Symbol' },
  { id: 'account', label: 'Account' },
  { id: 'status', label: 'Status' },
  { id: 'side', label: 'Side' },
  { id: 'entryPrice', label: 'Entry price' },
  { id: 'exitPrice', label: 'Exit price' },
  { id: 'netPnL', label: 'Net P&L', sortable: true },
  { id: 'setupTag', label: 'Setup Tag' },
  { id: 'strategy', label: 'Strategy' },
  { id: 'mistakeTag', label: 'Mistake Tag' },
  { id: 'closeTime', label: 'Close time' },
];

export default function TradeViewPage() {
  const router = useRouter();

  const [selectedTrades, setSelectedTrades] = useState<number[]>([]);
  const [showBulkMenu, setShowBulkMenu] = useState(false);
  const [isAddTradeOpen, setIsAddTradeOpen] = useState(false);

  // Active Sidebar Account / Group Filter Selection State
  const [activeFilterSelection, setActiveFilterSelection] = useState<{ 
    type: 'global' | 'group' | 'account'; 
    name: string 
  }>({ type: 'global', name: 'All Accounts' });

  // Column Drag and Drop State
  const [columns, setColumns] = useState<ColumnConfig[]>(INITIAL_COLUMNS);
  const [draggedColumnId, setDraggedColumnId] = useState<string | null>(null);
  const [dropTargetColumnId, setDropTargetColumnId] = useState<string | null>(null);

  // Sorting States
  const [sortField, setSortField] = useState<SortField>('openDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Filter Popover States
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [filterSymbol, setFilterSymbol] = useState('');
  const [filterSide, setFilterSide] = useState<'ALL' | 'LONG' | 'SHORT'>('ALL');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'WIN' | 'LOSS'>('ALL');

  // Date Range Popover States
  const [showDateMenu, setShowDateMenu] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Mass Tag Modal State
  const [tagModalType, setTagModalType] = useState<'setup' | 'mistake' | 'strategy' | null>(null);
  const [tagInputVal, setTagInputVal] = useState('');

  // Interactive inline cell editing
  const [editingCellTradeId, setEditingCellTradeId] = useState<number | null>(null);
  const [editingCellType, setEditingCellType] = useState<'strategy' | 'setup' | 'mistake' | 'account' | null>(null);

  // Popup Modal State for creating new tag from table inline edit
  const [activeNewModalType, setActiveNewModalType] = useState<'strategy' | 'setup' | 'mistake' | null>(null);
  const [newModalInputVal, setNewModalInputVal] = useState('');
  const [targetTradeIdForNewTag, setTargetTradeIdForNewTag] = useState<number | null>(null);

  // Right-Click Context Menu State
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; tradeId: number } | null>(null);
  const [contextSubAction, setContextSubAction] = useState<'strategy' | 'setup' | 'mistake' | 'account' | null>(null);

  const rawTrades = useLiveQuery(() => db.trades.toArray()) || [];
  const accounts = useLiveQuery(() => db.accounts.toArray()) || [];
  
  // Strict master table queries for dropdown options
  const savedStrategies = useLiveQuery(() => db.strategies.toArray()) || [];
  const savedSetups = useLiveQuery(() => db.setups.toArray()) || [];
  const savedMistakes = useLiveQuery(() => db.mistakes.toArray()) || [];

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

  // Handle ESC and clicks to close context/modals
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

  // 1. Filter Logic (Sidebar Account/Group Scope + Search & Attributes)
  const filteredTrades = rawTrades.filter((trade) => {
    // Sidebar Account / Group Scope Filter
    if (activeFilterSelection.type === 'account') {
      if (trade.account !== activeFilterSelection.name) return false;
    } else if (activeFilterSelection.type === 'group') {
      const groupAccounts = accounts
        .filter(a => a.groupName === activeFilterSelection.name)
        .map(a => a.name);
      if (!trade.account || !groupAccounts.includes(trade.account)) return false;
    }

    // Standard Filters
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

  // 2. Sorting Logic
  const trades = [...filteredTrades].sort((a, b) => {
    if (!sortField) return 0;

    if (sortField === 'openDate') {
      const dateA = new Date(`${a.openDate} ${a.entryTime || '00:00'}`).getTime();
      const dateB = new Date(`${b.openDate} ${b.entryTime || '00:00'}`).getTime();
      return sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
    }

    if (sortField === 'netPnL') {
      const pnlA = a.netPnL || 0;
      const pnlB = b.netPnL || 0;
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

  const toggleSelect = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedTrades.includes(id)) setSelectedTrades(selectedTrades.filter(item => item !== id));
    else setSelectedTrades([...selectedTrades, id]);
  };

  const handleMassDelete = async () => {
    if (selectedTrades.length === 0) return;
    if (confirm(`Are you sure you want to delete ${selectedTrades.length} trade(s)?`)) {
      await db.trades.bulkDelete(selectedTrades);
      setSelectedTrades([]);
      setShowBulkMenu(false);
    }
  };

  const handleInlineCellChange = async (tradeId: number, field: 'strategy' | 'setupTag' | 'mistakeTag' | 'account', val: string) => {
    if (val === '__NEW__') {
      setEditingCellTradeId(null);
      setEditingCellType(null);
      setTargetTradeIdForNewTag(tradeId);
      setActiveNewModalType(field === 'mistakeTag' ? 'mistake' : field === 'strategy' ? 'strategy' : 'setup');
      return;
    }

    const finalVal = val === '__EMPTY__' ? '' : val;

    if (field === 'account') {
      const matchedAcc = accounts.find(a => a.name === finalVal);
      await db.trades.update(tradeId, { 
        account: finalVal || undefined,
        accountGroup: matchedAcc ? matchedAcc.groupName : undefined
      });
    } else {
      await db.trades.update(tradeId, { [field]: finalVal });
    }

    setEditingCellTradeId(null);
    setEditingCellType(null);
  };

  const handleCreateNewTagPopup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newModalInputVal.trim() || !activeNewModalType || !targetTradeIdForNewTag) return;
    const name = newModalInputVal.trim();

    if (activeNewModalType === 'strategy') {
      const exists = await db.strategies.where('name').equals(name).first();
      if (!exists) await db.strategies.put({ name });
      await db.trades.update(targetTradeIdForNewTag, { strategy: name });
    } else if (activeNewModalType === 'setup') {
      const exists = await db.setups.where('name').equals(name).first();
      if (!exists) await db.setups.put({ name });
      await db.trades.update(targetTradeIdForNewTag, { setupTag: name });
    } else if (activeNewModalType === 'mistake') {
      const exists = await db.mistakes.where('name').equals(name).first();
      if (!exists) await db.mistakes.put({ name });
      await db.trades.update(targetTradeIdForNewTag, { mistakeTag: name });
    }

    setActiveNewModalType(null);
    setNewModalInputVal('');
    setTargetTradeIdForNewTag(null);
  };

  const resetFilters = () => {
    setFilterSymbol('');
    setFilterSide('ALL');
    setFilterStatus('ALL');
    setStartDate('');
    setEndDate('');
  };

  // Drag and Drop Column Handlers with Boundary Indicator
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

  // KPI calculations
  const totalPnL = trades.reduce((acc, t) => acc + (t.netPnL || 0), 0);
  const winTrades = trades.filter(t => (t.netPnL || 0) > 0);
  const lossTrades = trades.filter(t => (t.netPnL || 0) < 0);
  
  const winCount = winTrades.length;
  const lossCount = lossTrades.length;
  const winRate = trades.length > 0 ? ((winCount / trades.length) * 100).toFixed(1) : '0';

  const grossWins = winTrades.reduce((acc, t) => acc + t.netPnL, 0);
  const grossLosses = Math.abs(lossTrades.reduce((acc, t) => acc + t.netPnL, 0));
  const profitFactor = grossLosses > 0 ? (grossWins / grossLosses).toFixed(2) : grossWins > 0 ? '99.00' : '0.00';

  const avgWin = winCount > 0 ? grossWins / winCount : 0;
  const avgLoss = lossCount > 0 ? grossLosses / lossCount : 0;
  const avgWinLossRatio = avgLoss > 0 ? (avgWin / avgLoss).toFixed(2) : '0.00';

  const hasActiveFilters = filterSymbol || filterSide !== 'ALL' || filterStatus !== 'ALL' || startDate || endDate;

  return (
    <div className="p-8 bg-[#F8F9FD] min-h-screen text-slate-800 font-sans">
      
      {/* Top Filter Bar */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Trade View</h1>
          {activeFilterSelection.type !== 'global' && (
            <p className="text-xs font-bold text-[#ec3044] mt-0.5">
              Scoped to {activeFilterSelection.type === 'group' ? 'Group:' : 'Account:'} {activeFilterSelection.name}
            </p>
          )}
        </div>
        
        <div className="flex items-center gap-3 relative">
          
          <button 
            onClick={() => setIsAddTradeOpen(true)} 
            className="flex items-center gap-2 bg-[#ec3044] hover:bg-[#d4283b] text-white font-bold px-4 py-1.5 rounded-lg text-sm shadow-md transition cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Add Trade
          </button>

          {/* FILTERS BUTTON & POPOVER */}
          <div className="relative">
            <button 
              onClick={() => { setShowFilterMenu(!showFilterMenu); setShowDateMenu(false); }}
              className={`flex items-center gap-2 bg-white border px-3.5 py-1.5 rounded-lg text-sm font-medium cursor-pointer transition ${
                filterSymbol || filterSide !== 'ALL' || filterStatus !== 'ALL'
                  ? 'border-[#ec3044] text-[#ec3044] bg-[#ec3044]/5 font-bold'
                  : 'border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Filter className="w-4 h-4 text-[#ec3044]" /> Filters <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {showFilterMenu && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 p-4 space-y-3 text-xs">
                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <span className="font-bold text-slate-900">Filter Trades</span>
                  <button onClick={() => setShowFilterMenu(false)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4"/></button>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">Symbol Search</label>
                  <input 
                    type="text" 
                    value={filterSymbol} 
                    onChange={e => setFilterSymbol(e.target.value)} 
                    placeholder="E.g. MES" 
                    className="w-full border border-slate-200 rounded-lg p-2 font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#ec3044]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">Side</label>
                    <select 
                      value={filterSide} 
                      onChange={e => setFilterSide(e.target.value as any)} 
                      className="w-full border border-slate-200 rounded-lg p-2 font-bold text-slate-800 focus:outline-none"
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
                      className="w-full border border-slate-200 rounded-lg p-2 font-bold text-slate-800 focus:outline-none"
                    >
                      <option value="ALL">All</option>
                      <option value="WIN">WIN</option>
                      <option value="LOSS">LOSS</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-between pt-2 border-t border-slate-100">
                  <button onClick={resetFilters} className="text-slate-400 hover:text-slate-600 flex items-center gap-1 text-[11px] font-bold cursor-pointer">
                    <RotateCcw className="w-3 h-3" /> Reset
                  </button>
                  <button onClick={() => setShowFilterMenu(false)} className="px-3 py-1 bg-[#ec3044] text-white font-bold rounded-lg text-xs cursor-pointer">
                    Apply
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* DATE RANGE BUTTON & POPOVER */}
          <div className="relative">
            <button 
              onClick={() => { setShowDateMenu(!showDateMenu); setShowFilterMenu(false); }}
              className={`flex items-center gap-2 bg-white border px-3.5 py-1.5 rounded-lg text-sm font-medium cursor-pointer transition ${
                startDate || endDate
                  ? 'border-[#ec3044] text-[#ec3044] bg-[#ec3044]/5 font-bold'
                  : 'border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Calendar className="w-4 h-4 text-[#ec3044]" /> Date range <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {showDateMenu && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 p-4 space-y-3 text-xs">
                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <span className="font-bold text-slate-900">Custom Date Filter</span>
                  <button onClick={() => setShowDateMenu(false)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4"/></button>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">Start Date</label>
                  <input 
                    type="date" 
                    value={startDate} 
                    onChange={e => setStartDate(e.target.value)} 
                    className="w-full border border-slate-200 rounded-lg p-2 font-bold text-slate-800 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">End Date</label>
                  <input 
                    type="date" 
                    value={endDate} 
                    onChange={e => setEndDate(e.target.value)} 
                    className="w-full border border-slate-200 rounded-lg p-2 font-bold text-slate-800 focus:outline-none"
                  />
                </div>

                <div className="flex justify-between pt-2 border-t border-slate-100">
                  <button onClick={() => { setStartDate(''); setEndDate(''); }} className="text-slate-400 hover:text-slate-600 flex items-center gap-1 text-[11px] font-bold cursor-pointer">
                    Clear
                  </button>
                  <button onClick={() => setShowDateMenu(false)} className="px-3 py-1 bg-[#ec3044] text-white font-bold rounded-lg text-xs cursor-pointer">
                    Apply
                  </button>
                </div>
              </div>
            )}
          </div>

          {hasActiveFilters && (
            <button 
              onClick={resetFilters} 
              className="text-xs font-bold text-[#ec3044] hover:underline flex items-center gap-1 cursor-pointer bg-[#ec3044]/10 px-2.5 py-1.5 rounded-lg border border-[#ec3044]/20"
            >
              <RotateCcw className="w-3 h-3" /> Reset Filters
            </button>
          )}

        </div>
      </div>

      {/* UNIFORMLY ALIGNED KPI CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        
        {/* CARD 1: Net cumulative P&L */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex flex-col justify-between h-36">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <span>Net cumulative P&L</span>
            <div className="relative group cursor-pointer inline-flex">
              <span className="bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded text-[10px] font-bold hover:bg-slate-200 transition">
                {trades.length}
              </span>
              <div className="absolute left-0 top-full mt-1.5 hidden group-hover:block bg-slate-900 text-white text-[10px] font-semibold py-1 px-2.5 rounded-md shadow-xl whitespace-nowrap z-50">
                Across {trades.length} trade{trades.length === 1 ? '' : 's'}
              </div>
            </div>
          </div>
          <div className={`text-3xl font-black ${totalPnL >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
            {totalPnL >= 0 ? `$${totalPnL.toFixed(2)}` : `-$${Math.abs(totalPnL).toFixed(2)}`}
          </div>
          <div className="text-[10px] text-transparent select-none">spacer</div>
        </div>

        {/* CARD 2: Profit factor */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex flex-col justify-between h-36">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Profit factor</span>
            <div className="relative group cursor-pointer">
              <Info className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600 transition" />
              <div className="absolute right-0 top-full mt-1.5 hidden group-hover:block bg-slate-900 text-white text-[10px] font-medium p-2 rounded-lg shadow-xl w-48 text-center z-50 leading-tight">
                Gross Profits / Gross Losses. Measures total dollar returns relative to total dollar risk.
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="text-3xl font-black text-slate-900">{profitFactor}</div>
            <div className="relative w-12 h-12 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                <path className="text-slate-100" strokeWidth="4" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                <path className="text-emerald-500" strokeDasharray={`${Math.min(Number(profitFactor) * 50, 100)}, 100`} strokeWidth="4" strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
              </svg>
            </div>
          </div>
          <div className="text-[10px] text-transparent select-none">spacer</div>
        </div>

        {/* CARD 3: Trade win % */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex flex-col justify-between h-36">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Trade win %</span>
            <div className="relative group cursor-pointer">
              <Info className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600 transition" />
              <div className="absolute right-0 top-full mt-1.5 hidden group-hover:block bg-slate-900 text-white text-[10px] font-medium p-2 rounded-lg shadow-xl w-48 text-center z-50 leading-tight">
                Percentage of winning trades out of total trades executed.
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="text-3xl font-black text-slate-900">{winRate}%</div>
            <div className="flex gap-1.5 text-[10px] font-bold">
              <span className="text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                {winCount} {winCount === 1 ? 'Win' : 'Wins'}
              </span>
              <span className="text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                {lossCount} {lossCount === 1 ? 'Loss' : 'Losses'}
              </span>
            </div>
          </div>
          <div className="text-[10px] text-transparent select-none">spacer</div>
        </div>

        {/* CARD 4: Avg win/loss trade */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex flex-col justify-between h-36">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Avg win/loss trade</span>
            <div className="relative group cursor-pointer">
              <Info className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600 transition" />
              <div className="absolute right-0 top-full mt-1.5 hidden group-hover:block bg-slate-900 text-white text-[10px] font-medium p-2 rounded-lg shadow-xl w-48 text-center z-50 leading-tight">
                Average Win ($) / Average Loss ($). Measures payoff ratio per trade.
              </div>
            </div>
          </div>
          <div className={`text-3xl font-black ${Number(avgWinLossRatio) >= 1 ? 'text-emerald-500' : 'text-slate-900'}`}>
            {avgWinLossRatio}
          </div>
          <div className="space-y-1">
            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden flex">
              <div style={{ width: `${Math.min(Math.max((avgWin / (avgWin + avgLoss || 1)) * 100, 15), 85)}%` }} className="bg-emerald-500 h-full" />
              <div className="bg-rose-500 h-full flex-1" />
            </div>
            <div className="flex justify-between text-[10px] font-mono font-bold">
              <span className="text-emerald-600">${avgWin.toFixed(1)}</span>
              <span className="text-rose-600">-${avgLoss.toFixed(1)}</span>
            </div>
          </div>
        </div>

      </div>

      {/* Trades Table Container */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm relative">
        <div className="p-4 flex justify-between items-center border-b border-slate-100 bg-slate-50/50 rounded-t-2xl">
          <div className="text-xs font-bold text-slate-600">
            {selectedTrades.length > 0 ? (
              <span className="text-[#ec3044] bg-[#ec3044]/10 px-2.5 py-1 rounded-lg border border-[#ec3044]/20 font-bold">
                {selectedTrades.length} trade(s) selected
              </span>
            ) : (
              'All Trades'
            )}
          </div>

          <div className="flex items-center gap-3 relative">
            <button className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 cursor-pointer">
              <Settings className="w-4 h-4" />
            </button>

            <div className="relative">
              <button 
                disabled={selectedTrades.length === 0}
                onClick={() => setShowBulkMenu(!showBulkMenu)}
                className={`px-4 py-1.5 font-bold text-xs rounded-xl border flex items-center gap-2 transition ${
                  selectedTrades.length > 0 
                    ? 'bg-[#ec3044] text-white border-transparent shadow-md cursor-pointer hover:bg-[#d4283b]' 
                    : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60'
                }`}
              >
                Bulk actions <ChevronDown className="w-3.5 h-3.5" />
              </button>

              {showBulkMenu && selectedTrades.length > 0 && (
                <div className="absolute right-0 top-full mt-2 w-52 bg-white border border-slate-200 rounded-xl shadow-2xl z-50 p-1.5 text-xs font-semibold text-slate-700 space-y-1">
                  <button onClick={() => { setTagModalType('setup'); setShowBulkMenu(false); }} className="flex items-center gap-2 w-full p-2 hover:bg-slate-50 rounded-lg text-left cursor-pointer">
                    <Tag className="w-3.5 h-3.5 text-[#ec3044]" /> Apply Setup Tag
                  </button>
                  <button onClick={() => { setTagModalType('mistake'); setShowBulkMenu(false); }} className="flex items-center gap-2 w-full p-2 hover:bg-slate-50 rounded-lg text-left cursor-pointer">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> Apply Mistake Tag
                  </button>
                  <button onClick={() => { setTagModalType('strategy'); setShowBulkMenu(false); }} className="flex items-center gap-2 w-full p-2 hover:bg-slate-50 rounded-lg text-left cursor-pointer">
                    <Target className="w-3.5 h-3.5 text-blue-500" /> Assign Strategy
                  </button>
                  <div className="border-t border-slate-100 my-1" />
                  <button onClick={handleMassDelete} className="flex items-center gap-2 w-full p-2 hover:bg-rose-50 text-rose-600 rounded-lg text-left font-bold cursor-pointer">
                    <Trash2 className="w-3.5 h-3.5" /> Mass Delete ({selectedTrades.length})
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Data Table with Draggable Columns and Drop Boundary Indicator */}
        <div className="overflow-x-auto rounded-b-2xl">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#F8F9FD] text-slate-500 text-xs font-semibold border-b border-slate-200/80">
              <tr>
                <th className="py-3 px-4 w-10 text-center">
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
                      onClick={() => {
                        if (col.sortable) {
                          handleSort(col.id as SortField);
                        }
                      }}
                      className={`py-3 px-4 font-semibold text-slate-700 select-none cursor-grab active:cursor-grabbing transition relative ${
                        col.sortable ? 'cursor-pointer hover:text-[#ec3044]' : ''
                      } ${isDragging ? 'opacity-40 bg-slate-200/50' : 'hover:bg-slate-100/60'} ${
                        isDropTarget ? 'border-l-4 border-l-[#ec3044] bg-[#ec3044]/5' : ''
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <GripHorizontal className="w-3 h-3 text-slate-300 opacity-60" />
                        <span>{col.label}</span>
                        {col.sortable && sortField === col.id && (
                          sortDirection === 'desc' ? (
                            <ArrowDown className="w-3.5 h-3.5 text-[#ec3044]" />
                          ) : (
                            <ArrowUp className="w-3.5 h-3.5 text-[#ec3044]" />
                          )
                        )}
                        {col.sortable && sortField !== col.id && (
                          <ArrowUpDown className="w-3.5 h-3.5 text-slate-300" />
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
                    {hasActiveFilters ? (
                      <div>
                        No trades match your active filters.{' '}
                        <button onClick={resetFilters} className="font-bold text-[#ec3044] hover:underline cursor-pointer">
                          Reset filters
                        </button>
                      </div>
                    ) : (
                      <div>
                        No trades logged yet. Click{' '}
                        <button 
                          onClick={() => setIsAddTradeOpen(true)} 
                          className="font-bold text-[#ec3044] hover:underline cursor-pointer"
                        >
                          + Add Trade
                        </button>{' '}
                        to log your first trade!
                      </div>
                    )}
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
                      <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
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
                            return <td key={col.id} className="py-3.5 px-4 font-medium text-slate-600">{trade.openDate}</td>;
                          case 'symbol':
                            return (
                              <td key={col.id} className="py-3.5 px-4 font-bold text-[#ec3044] hover:underline">
                                {trade.symbol}
                              </td>
                            );
                          case 'account':
                            return (
                              <td key={col.id} className="py-3.5 px-4 font-medium" onClick={(e) => e.stopPropagation()}>
                                {editingCellTradeId === trade.id && editingCellType === 'account' ? (
                                  <select 
                                    autoFocus
                                    value={trade.account || ''} 
                                    onChange={(e) => handleInlineCellChange(trade.id!, 'account', e.target.value)}
                                    onBlur={() => { setEditingCellTradeId(null); setEditingCellType(null); }}
                                    className="border border-[#ec3044] bg-white rounded p-1 text-xs text-[#ec3044] font-bold"
                                  >
                                    <option value="__EMPTY__">-- Unassigned --</option>
                                    {accounts.map(a => <option key={a.id} value={a.name}>{a.name} ({a.groupName})</option>)}
                                  </select>
                                ) : (
                                  <span 
                                    onClick={() => { setEditingCellTradeId(trade.id!); setEditingCellType('account'); }}
                                    className="hover:bg-slate-100 px-2 py-1 rounded cursor-pointer transition font-semibold text-slate-800 flex items-center gap-1"
                                  >
                                    <Wallet className="w-3 h-3 text-[#ec3044]" />
                                    {trade.account || <span className="text-slate-400 italic">Unassigned</span>}
                                  </span>
                                )}
                              </td>
                            );
                          case 'status':
                            return (
                              <td key={col.id} className="py-3.5 px-4">
                                {trade.status === 'WIN' ? (
                                  <span className="px-2.5 py-1 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded text-[10px] font-bold">WIN</span>
                                ) : (
                                  <span className="px-2.5 py-1 bg-rose-50 text-rose-500 border border-rose-200 rounded text-[10px] font-bold">LOSS</span>
                                )}
                              </td>
                            );
                          case 'side':
                            return <td key={col.id} className="py-3.5 px-4 font-semibold text-slate-500">{trade.side || 'LONG'}</td>;
                          case 'entryPrice':
                            return <td key={col.id} className="py-3.5 px-4 font-mono">${Number(trade.entryPrice).toFixed(2)}</td>;
                          case 'exitPrice':
                            return <td key={col.id} className="py-3.5 px-4 font-mono">${Number(trade.exitPrice).toFixed(2)}</td>;
                          case 'netPnL':
                            return (
                              <td key={col.id} className={`py-3.5 px-4 font-bold font-mono ${trade.netPnL >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                ${Number(trade.netPnL).toFixed(2)}
                              </td>
                            );
                          case 'setupTag':
                            return (
                              <td key={col.id} className="py-3.5 px-4 font-medium text-slate-600" onClick={(e) => e.stopPropagation()}>
                                {editingCellTradeId === trade.id && editingCellType === 'setup' ? (
                                  <select 
                                    autoFocus
                                    value={trade.setupTag || ''} 
                                    onChange={(e) => handleInlineCellChange(trade.id!, 'setupTag', e.target.value)}
                                    onBlur={() => { setEditingCellTradeId(null); setEditingCellType(null); }}
                                    className="border border-[#ec3044] bg-white rounded p-1 text-xs text-[#ec3044] font-bold"
                                  >
                                    <option value="__EMPTY__">-- (Unspecified)</option>
                                    {savedSetups.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                                    <option value="__NEW__" className="text-[#ec3044] font-bold">+ Add New Setup Tag...</option>
                                  </select>
                                ) : (
                                  <span 
                                    onClick={() => { setEditingCellTradeId(trade.id!); setEditingCellType('setup'); }}
                                    className="hover:bg-slate-100 px-2 py-1 rounded cursor-pointer transition font-semibold"
                                  >
                                    {trade.setupTag || '--'}
                                  </span>
                                )}
                              </td>
                            );
                          case 'strategy':
                            return (
                              <td key={col.id} className="py-3.5 px-4 font-medium" onClick={(e) => e.stopPropagation()}>
                                {editingCellTradeId === trade.id && editingCellType === 'strategy' ? (
                                  <select 
                                    autoFocus
                                    value={trade.strategy || ''} 
                                    onChange={(e) => handleInlineCellChange(trade.id!, 'strategy', e.target.value)}
                                    onBlur={() => { setEditingCellTradeId(null); setEditingCellType(null); }}
                                    className="border border-[#ec3044] bg-white rounded p-1 text-xs text-[#ec3044] font-bold"
                                  >
                                    <option value="__EMPTY__">-- (Unspecified)</option>
                                    {savedStrategies.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                                    <option value="__NEW__" className="text-[#ec3044] font-bold">+ Add New Strategy...</option>
                                  </select>
                                ) : (
                                  <span 
                                    onClick={() => { setEditingCellTradeId(trade.id!); setEditingCellType('strategy'); }}
                                    className="hover:bg-slate-100 px-2 py-1 rounded cursor-pointer transition font-semibold text-[#ec3044]"
                                  >
                                    {trade.strategy || '--'}
                                  </span>
                                )}
                              </td>
                            );
                          case 'mistakeTag':
                            return (
                              <td key={col.id} className="py-3.5 px-4 font-medium" onClick={(e) => e.stopPropagation()}>
                                {editingCellTradeId === trade.id && editingCellType === 'mistake' ? (
                                  <select 
                                    autoFocus
                                    value={trade.mistakeTag || ''} 
                                    onChange={(e) => handleInlineCellChange(trade.id!, 'mistakeTag', e.target.value)}
                                    onBlur={() => { setEditingCellTradeId(null); setEditingCellType(null); }}
                                    className="border border-[#ec3044] bg-white rounded p-1 text-xs text-[#ec3044] font-bold"
                                  >
                                    <option value="__EMPTY__">-- (Unspecified)</option>
                                    {savedMistakes.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                                    <option value="__NEW__" className="text-[#ec3044] font-bold">+ Add New Mistake Tag...</option>
                                  </select>
                                ) : (
                                  <span 
                                    onClick={() => { setEditingCellTradeId(trade.id!); setEditingCellType('mistake'); }}
                                    className="hover:bg-slate-100 px-2 py-1 rounded cursor-pointer transition font-semibold text-amber-600"
                                  >
                                    {trade.mistakeTag || '--'}
                                  </span>
                                )}
                              </td>
                            );
                          case 'closeTime':
                            return <td key={col.id} className="py-3.5 px-4 text-slate-500">{trade.exitTime || '--'}</td>;
                          default:
                            return <td key={col.id} className="py-3.5 px-4">--</td>;
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
                  key={a.id} 
                  onClick={async () => { 
                    await db.trades.update(contextMenu.tradeId, { account: a.name, accountGroup: a.groupName }); 
                    setContextMenu(null); 
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
              if (confirm('Are you sure you want to delete this trade?')) {
                await db.trades.delete(contextMenu.tradeId);
                setContextMenu(null);
              }
            }}
            className="flex items-center gap-2.5 w-full p-2 hover:bg-rose-50 text-rose-600 rounded-lg text-left font-bold cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" /> Quick Delete Trade
          </button>
        </div>
      )}

      {/* Mass Tag Modal */}
      {tagModalType && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-sm p-5 shadow-xl">
            <h3 className="text-sm font-bold text-slate-900 mb-2 capitalize">
              Apply {tagModalType} to {selectedTrades.length} selected trade(s)
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

      {/* DEDICATED POPUP MODAL FOR CREATING NEW TAG/STRATEGY */}
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
      <AddTradeModal isOpen={isAddTradeOpen} onClose={() => setIsAddTradeOpen(false)} />

    </div>
  );
}