'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { useParams, useRouter } from 'next/navigation';
import { 
  CheckCircle2, 
  ArrowLeft,
  Calendar,
  Clock,
  Edit3,
  Check,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  Save,
  X,
  Wallet
} from 'lucide-react';

const SYMBOL_OPTIONS = [
  { value: 'MES', label: 'MES ($5/pt)', tickSize: 0.25, tickValue: 1.25, multiplier: 5 },
  { value: 'ES', label: 'ES ($50/pt)', tickSize: 0.25, tickValue: 12.50, multiplier: 50 },
  { value: 'MNQ', label: 'MNQ ($2/pt)', tickSize: 0.25, tickValue: 0.50, multiplier: 2 },
  { value: 'NQ', label: 'NQ ($20/pt)', tickSize: 0.25, tickValue: 5.00, multiplier: 20 },
];

const getContractSpecs = (symbolStr: string = '') => {
  const sym = symbolStr.toUpperCase();
  const matched = SYMBOL_OPTIONS.find(opt => sym.includes(opt.value));
  if (matched) return matched;
  return { value: 'MES', label: 'MES ($5/pt)', tickSize: 0.25, tickValue: 1.25, multiplier: 5 };
};

const getTradingViewSymbol = (symbolStr: string = '') => {
  const sym = symbolStr.toUpperCase();
  if (sym.includes('MES') || sym.includes('ES')) return 'CAPITALCOM:US500';
  if (sym.includes('MNQ') || sym.includes('NQ')) return 'CAPITALCOM:US100';
  if (sym.includes('MYM') || sym.includes('YM')) return 'CAPITALCOM:US300';
  if (sym.includes('MCL') || sym.includes('CL')) return 'TVC:USOIL';
  if (sym.includes('MGC') || sym.includes('GC')) return 'TVC:GOLD';
  return 'AMEX:SPY';
};

const calculateDuration = (startTime: string, endTime: string) => {
  if (!startTime || !endTime) return '--';
  
  const parseSeconds = (t: string) => {
    const clean = t.replace(/\u202f/g, ' ').trim();
    const [time, modifier] = clean.split(' ');
    if (!time) return 0;
    let [h, m, s] = time.split(':').map(Number);
    if (modifier === 'PM' && h < 12) h += 12;
    if (modifier === 'AM' && h === 12) h = 0;
    return (h || 0) * 3600 + (m || 0) * 60 + (s || 0);
  };

  const diffSec = parseSeconds(endTime) - parseSeconds(startTime);
  if (diffSec <= 0) return 'Instant';

  const mins = Math.floor(diffSec / 60);
  const secs = diffSec % 60;
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
};

// TradingView Widget Component
function TradeZellaLightChart({ symbol }: { symbol: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tvSymbol = getTradingViewSymbol(symbol);

  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.innerHTML = '';

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/tv.js';
    script.type = 'text/javascript';
    script.async = true;
    script.onload = () => {
      if (typeof (window as any).TradingView !== 'undefined') {
        new (window as any).TradingView.widget({
          autosize: true,
          symbol: tvSymbol,
          interval: '1',
          timezone: 'America/New_York',
          theme: 'light',
          style: '1',
          locale: 'en',
          toolbar_bg: '#ffffff',
          enable_publishing: false,
          allow_symbol_change: true,
          save_image: false,
          container_id: containerRef.current?.id,
        });
      }
    };
    containerRef.current.appendChild(script);
  }, [symbol, tvSymbol]);

  return (
    <div className="w-full h-[520px] bg-white rounded-b-2xl overflow-hidden border-t border-slate-100">
      <div id={`tv_chart_light_${symbol}`} ref={containerRef} className="w-full h-full" />
    </div>
  );
}

export default function SingleTradeDetail() {
  const params = useParams();
  const router = useRouter();
  const tradeId = parseInt(params.id as string);

  const trade = useLiveQuery(() => db.trades.get(tradeId), [tradeId]);
  const accounts = useLiveQuery(() => db.accounts.toArray()) || [];
  const savedStrategies = useLiveQuery(() => db.strategies.toArray()) || [];
  const savedSetups = useLiveQuery(() => db.setups.toArray()) || [];
  const savedMistakes = useLiveQuery(() => db.mistakes.toArray()) || [];

  const [leftTab, setLeftTab] = useState<'Stats' | 'Strategy' | 'Executions'>('Stats');
  const [rightTab, setRightTab] = useState<'Chart' | 'Notes'>('Chart');

  // Trade Details Edit States
  const [isEditingTradeDetails, setIsEditingTradeDetails] = useState(false);
  const [editSymbol, setEditSymbol] = useState('');
  const [editOpenDate, setEditOpenDate] = useState('');
  const [editSide, setEditSide] = useState<'LONG' | 'SHORT'>('SHORT');
  const [editContracts, setEditContracts] = useState('1');
  const [editEntryPrice, setEditEntryPrice] = useState('');
  const [editExitPrice, setEditExitPrice] = useState('');
  const [editEntryTime, setEditEntryTime] = useState('');
  const [editExitTime, setEditExitTime] = useState('');
  const [editCommissions, setEditCommissions] = useState('2.50');
  const [editAccount, setEditAccount] = useState('');

  // Notes & Tags Editing States
  const [isEditingTags, setIsEditingTags] = useState(false);
  const [selectedStrat, setSelectedStrat] = useState('');
  const [selectedSetup, setSelectedSetup] = useState('');
  const [selectedMistake, setSelectedMistake] = useState('');

  // Popup Modal State for Creating New Strategy / Setup / Mistake
  const [activeNewModalType, setActiveNewModalType] = useState<'strategy' | 'setup' | 'mistake' | null>(null);
  const [newModalInputVal, setNewModalInputVal] = useState('');

  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [editedNotes, setEditedNotes] = useState('');

  useEffect(() => {
    if (trade) {
      if (trade.notes) setEditedNotes(trade.notes);
      setSelectedStrat(trade.strategy || '');
      setSelectedSetup(trade.setupTag || '');
      setSelectedMistake(trade.mistakeTag || '');

      setEditSymbol(trade.symbol || 'MES');
      setEditOpenDate(trade.openDate || '');
      setEditSide(trade.side || 'SHORT');
      setEditContracts(String(trade.contractsTraded || 1));
      setEditEntryPrice(String(trade.entryPrice || ''));
      setEditExitPrice(String(trade.exitPrice || ''));
      setEditEntryTime(trade.entryTime || '');
      setEditExitTime(trade.exitTime || '');
      setEditCommissions(String(trade.commissions || 2.50));
      setEditAccount(trade.account || '');
    }
  }, [trade]);

  // Handle ESC key to cancel/close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveNewModalType(null);
        setNewModalInputVal('');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!trade) {
    return (
      <div className="p-8 bg-[#F8F9FD] min-h-screen text-slate-800 flex flex-col items-center justify-center">
        <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center shadow-sm">
          <h2 className="text-lg font-bold text-slate-900 mb-2">Trade Not Found</h2>
          <p className="text-xs text-slate-500 mb-4">This trade ID does not exist in your local database.</p>
          <button onClick={() => router.push('/trade-view')} className="px-4 py-2 bg-[#ec3044] hover:bg-[#d4283b] text-white text-xs font-bold rounded-xl cursor-pointer">
            Back to Trade View
          </button>
        </div>
      </div>
    );
  }

  const isWin = trade.status === 'WIN' || trade.netPnL >= 0;
  const durationStr = calculateDuration(trade.entryTime, trade.exitTime);

  const handleQuickAssignAccount = async (accountName: string) => {
    const matchedAcc = accounts.find(a => a.name === accountName);
    await db.trades.update(tradeId, {
      account: accountName || undefined,
      accountGroup: matchedAcc ? matchedAcc.groupName : undefined
    });
  };

  const handleSaveTradeDetails = async () => {
    const entP = parseFloat(editEntryPrice) || 0;
    const extP = parseFloat(editExitPrice) || 0;
    const qty = parseFloat(editContracts) || 1;
    const comms = parseFloat(editCommissions) || 0;
    const specs = getContractSpecs(editSymbol);

    const points = editSide === 'LONG' ? extP - entP : entP - extP;
    const totalTicks = specs.tickSize > 0 ? points / specs.tickSize : 0;
    const grossPnL = points * qty * specs.multiplier;
    const netPnL = grossPnL - comms;

    const tradeStatus: 'WIN' | 'LOSS' | 'BE' = netPnL > 0 ? 'WIN' : netPnL < 0 ? 'LOSS' : 'BE';
    const matchedAcc = accounts.find(a => a.name === editAccount);

    await db.trades.update(tradeId, {
      symbol: editSymbol,
      openDate: editOpenDate,
      side: editSide,
      contractsTraded: qty,
      entryPrice: entP,
      exitPrice: extP,
      entryTime: editEntryTime,
      exitTime: editExitTime,
      commissions: comms,
      grossPnL,
      netPnL,
      points,
      ticks: totalTicks,
      ticksPerContract: qty > 0 ? totalTicks / qty : 0,
      status: tradeStatus,
      account: editAccount || undefined,
      accountGroup: matchedAcc ? matchedAcc.groupName : undefined
    });

    setIsEditingTradeDetails(false);
  };

  const handleSaveNotes = async () => {
    await db.trades.update(tradeId, { notes: editedNotes });
    setIsEditingNotes(false);
  };

  const handleSaveTags = async () => {
    await db.trades.update(tradeId, {
      strategy: selectedStrat,
      setupTag: selectedSetup,
      mistakeTag: selectedMistake,
    });
    setIsEditingTags(false);
  };

  // Create New Tag via Popup Modal
  const handleCreateNewTagPopup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newModalInputVal.trim() || !activeNewModalType) return;
    const name = newModalInputVal.trim();

    if (activeNewModalType === 'strategy') {
      await db.strategies.put({ name });
      setSelectedStrat(name);
    } else if (activeNewModalType === 'setup') {
      await db.setups.put({ name });
      setSelectedSetup(name);
    } else if (activeNewModalType === 'mistake') {
      await db.mistakes.put({ name });
      setSelectedMistake(name);
    }

    setNewModalInputVal('');
    setActiveNewModalType(null);
  };

  const userInputStyle = "w-full border border-[#ec3044]/40 bg-[#ec3044]/5 rounded-lg p-1.5 text-[#ec3044] font-bold text-xs focus:outline-none focus:ring-2 focus:ring-[#ec3044]";

  return (
    <div className="p-6 bg-[#F8F9FD] min-h-screen text-slate-800 font-sans">
      
      {/* Top Navigation Bar */}
      <div className="flex items-center justify-between mb-4">
        <button 
          onClick={() => router.push('/trade-view')}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-[#ec3044] bg-white border border-slate-200 px-3.5 py-1.5 rounded-xl shadow-sm transition cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Trades
        </button>
        
        <div className="bg-[#FFF8EC] border border-[#FCE8CD] text-[#A6690B] px-4 py-1.5 rounded-xl text-xs font-medium flex items-center gap-2">
          <span>⚠️</span> Local Data Engine Active. All execution parameters saved locally.
        </div>
      </div>

      {/* Main 3-Column Grid */}
      <div className="grid grid-cols-12 gap-5 items-start">

        {/* COLUMN 1: LEFT SUMMARY CARD (3 cols) */}
        <div className="col-span-3 bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm space-y-4">
          <div className="pb-3 border-b border-slate-100 flex justify-between items-start">
            <div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${isWin ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-rose-50 text-rose-500 border-rose-200'}`}>
                {trade.side} • {trade.status}
              </span>
              <h2 className="text-xl font-black text-slate-900 mt-1">{trade.symbol}</h2>
              <p className="text-[11px] text-slate-400 font-medium flex items-center gap-1 mt-0.5">
                <Calendar className="w-3 h-3" /> {trade.openDate}
              </p>
            </div>
            <div className={`text-right text-lg font-extrabold ${isWin ? 'text-emerald-500' : 'text-rose-500'}`}>
              ${Number(trade.netPnL || 0).toFixed(2)}
            </div>
          </div>

          {/* Quick Assign Account Widget on Left Card */}
          <div className="bg-slate-50 border border-slate-200/80 p-3 rounded-xl space-y-1.5">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Wallet className="w-3 h-3 text-[#ec3044]" /> Assigned Account
            </label>
            <select
              value={trade.account || ''}
              onChange={(e) => handleQuickAssignAccount(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-[#ec3044] cursor-pointer"
            >
              <option value="">-- Select Account --</option>
              {accounts.map(a => (
                <option key={a.id} value={a.name}>
                  {a.name} ({a.groupName})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs border-b border-slate-100 pb-3">
            <div>
              <p className="text-slate-400 font-medium">Contracts</p>
              <p className="text-slate-900 font-bold">{trade.contractsTraded}</p>
            </div>
            <div>
              <p className="text-slate-400 font-medium">Trade Score</p>
              <p className="text-[#ec3044] font-bold">{trade.zellaScale} / 100</p>
            </div>
            <div>
              <p className="text-slate-400 font-medium">Planned R</p>
              <p className="text-slate-900 font-bold">{trade.plannedRMultiple ? `${trade.plannedRMultiple.toFixed(2)}R` : '--'}</p>
            </div>
            <div>
              <p className="text-slate-400 font-medium">Realized R</p>
              <p className={`font-bold ${trade.realizedRMultiple >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                {trade.realizedRMultiple ? `${trade.realizedRMultiple.toFixed(2)}R` : '--'}
              </p>
            </div>
          </div>

          {/* Interactive Tag Section */}
          <div className="space-y-3 text-xs">
            <div className="flex justify-between items-center text-slate-500 font-medium">
              <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-slate-400" /> Duration</span>
              <span className="font-mono font-bold text-slate-900">{durationStr}</span>
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 pt-2">
              <span className="font-bold text-slate-700">Tags & Strategy</span>
              <button onClick={() => setIsEditingTags(!isEditingTags)} className="text-[11px] font-bold text-[#ec3044] hover:underline flex items-center gap-1 cursor-pointer">
                <Edit3 className="w-3 h-3" /> {isEditingTags ? 'Done' : 'Edit Tags'}
              </button>
            </div>

            {isEditingTags ? (
              <div className="space-y-2 bg-[#ec3044]/5 p-2.5 rounded-xl border border-[#ec3044]/20">
                
                {/* Strategy Selector */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[10px] font-bold text-slate-600">Strategy</label>
                    <button onClick={() => setActiveNewModalType('strategy')} className="text-[10px] text-[#ec3044] font-bold flex items-center gap-0.5 cursor-pointer">
                      <Plus className="w-3 h-3"/> New
                    </button>
                  </div>
                  <select value={selectedStrat} onChange={e => setSelectedStrat(e.target.value)} className={userInputStyle}>
                    <option value="">Select Strategy...</option>
                    {savedStrategies.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                  </select>
                </div>

                {/* Setup Selector */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[10px] font-bold text-slate-600">Setup Tag</label>
                    <button onClick={() => setActiveNewModalType('setup')} className="text-[10px] text-[#ec3044] font-bold flex items-center gap-0.5 cursor-pointer">
                      <Plus className="w-3 h-3"/> New
                    </button>
                  </div>
                  <select value={selectedSetup} onChange={e => setSelectedSetup(e.target.value)} className={userInputStyle}>
                    <option value="">Select Setup...</option>
                    {savedSetups.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                  </select>
                </div>

                {/* Mistake Selector */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[10px] font-bold text-slate-600">Mistake Tag</label>
                    <button onClick={() => setActiveNewModalType('mistake')} className="text-[10px] text-[#ec3044] font-bold flex items-center gap-0.5 cursor-pointer">
                      <Plus className="w-3 h-3"/> New
                    </button>
                  </div>
                  <select value={selectedMistake} onChange={e => setSelectedMistake(e.target.value)} className={userInputStyle}>
                    <option value="">Select Mistake...</option>
                    {savedMistakes.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                  </select>
                </div>

                <button onClick={handleSaveTags} className="w-full py-1.5 bg-[#ec3044] hover:bg-[#d4283b] text-white font-bold rounded-lg text-xs mt-2 shadow-sm cursor-pointer">
                  Save Tag Changes
                </button>
              </div>
            ) : (
              <>
                <div className="flex justify-between items-center text-slate-500 font-medium">
                  <span>Strategy</span>
                  <span className="font-bold text-[#ec3044] bg-[#ec3044]/10 px-2 py-0.5 rounded border border-[#ec3044]/20">{trade.strategy || 'Unspecified'}</span>
                </div>
                <div className="flex justify-between items-center text-slate-500 font-medium">
                  <span>Setup Tag</span>
                  <span className="font-bold text-slate-900">{trade.setupTag || '--'}</span>
                </div>
                <div className="flex justify-between items-center text-slate-500 font-medium">
                  <span>Mistake Tag</span>
                  <span className="font-bold text-amber-600">{trade.mistakeTag || '--'}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* COLUMN 2: MIDDLE EXECUTION STATS & EDITABLE DETAILS (4 cols) */}
        <div className="col-span-4 bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-3.5 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 text-sm">{trade.symbol} Execution Detail</span>
            </div>
            
            <button 
              onClick={() => setIsEditingTradeDetails(!isEditingTradeDetails)} 
              className="text-xs font-bold text-[#ec3044] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" /> {isEditingTradeDetails ? 'Cancel' : 'Edit Details'}
            </button>
          </div>

          <div className="flex border-b border-slate-100 bg-[#F8F9FD] p-1 text-xs font-medium text-slate-500">
            {(['Stats', 'Strategy', 'Executions'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setLeftTab(tab)}
                className={`flex-1 py-1.5 text-center rounded-md transition cursor-pointer ${leftTab === tab ? 'bg-white text-[#ec3044] font-bold shadow-sm' : 'hover:text-slate-900'}`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* EDIT TRADE DETAILS FORM MODE */}
          {isEditingTradeDetails ? (
            <div className="p-4 space-y-3 max-h-[650px] overflow-y-auto text-xs">
              <div className="p-2 bg-[#ec3044]/5 border border-[#ec3044]/20 rounded-xl mb-2 text-[#ec3044] font-semibold text-[11px]">
                ✏️ Edit imported trade parameters below. P&L and metrics will recalculate upon saving.
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Assigned Account</label>
                <select value={editAccount} onChange={e => setEditAccount(e.target.value)} className={userInputStyle}>
                  <option value="">-- Unassigned --</option>
                  {accounts.map(a => <option key={a.id} value={a.name}>{a.name} ({a.groupName})</option>)}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Symbol</label>
                <select value={editSymbol} onChange={e => setEditSymbol(e.target.value)} className={userInputStyle}>
                  {SYMBOL_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Side</label>
                  <select value={editSide} onChange={e => setEditSide(e.target.value as any)} className={userInputStyle}>
                    <option value="LONG">LONG</option>
                    <option value="SHORT">SHORT</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Contracts</label>
                  <input type="number" value={editContracts} onChange={e => setEditContracts(e.target.value)} className={userInputStyle} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Avg Entry Price</label>
                  <input type="number" step="any" value={editEntryPrice} onChange={e => setEditEntryPrice(e.target.value)} className={userInputStyle} />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Avg Exit Price</label>
                  <input type="number" step="any" value={editExitPrice} onChange={e => setEditExitPrice(e.target.value)} className={userInputStyle} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Entry Time</label>
                  <input type="text" value={editEntryTime} onChange={e => setEditEntryTime(e.target.value)} placeholder="10:36:37 AM" className={userInputStyle} />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Exit Time</label>
                  <input type="text" value={editExitTime} onChange={e => setEditExitTime(e.target.value)} placeholder="10:39:51 AM" className={userInputStyle} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Trade Date</label>
                  <input type="date" value={editOpenDate} onChange={e => setEditOpenDate(e.target.value)} className={userInputStyle} />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Commissions ($)</label>
                  <input type="number" step="any" value={editCommissions} onChange={e => setEditCommissions(e.target.value)} className={userInputStyle} />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button onClick={() => setIsEditingTradeDetails(false)} className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-semibold cursor-pointer">
                  Cancel
                </button>
                <button onClick={handleSaveTradeDetails} className="px-4 py-1.5 bg-[#ec3044] hover:bg-[#d4283b] text-white rounded-lg text-xs font-bold shadow-md cursor-pointer flex items-center gap-1">
                  <Save className="w-3.5 h-3.5" /> Save Changes
                </button>
              </div>
            </div>
          ) : (
            <>
              {leftTab === 'Stats' && (
                <div className="p-4 space-y-3 max-h-[650px] overflow-y-auto text-xs divide-y divide-slate-100">
                  <div className="pt-1 flex justify-between items-center">
                    <span className="text-slate-400">Account</span>
                    <select
                      value={trade.account || ''}
                      onChange={(e) => handleQuickAssignAccount(e.target.value)}
                      className="bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs font-bold text-[#ec3044] focus:outline-none cursor-pointer"
                    >
                      <option value="">-- Unassigned --</option>
                      {accounts.map(a => <option key={a.id} value={a.name}>{a.name} ({a.groupName})</option>)}
                    </select>
                  </div>
                  <div className="pt-2 flex justify-between"><span className="text-slate-400">Avg Entry Price</span><span className="font-mono font-bold text-slate-900">${Number(trade.entryPrice).toFixed(2)}</span></div>
                  <div className="pt-2 flex justify-between"><span className="text-slate-400">Avg Exit Price</span><span className="font-mono font-bold text-slate-900">${Number(trade.exitPrice).toFixed(2)}</span></div>
                  
                  <div className="pt-2 flex justify-between">
                    <span className="text-slate-400">Points Gained/Lost</span>
                    <span className={`font-mono font-bold ${isWin ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {isWin ? '+' : ''}{trade.points?.toFixed(2)} pts
                    </span>
                  </div>

                  <div className="pt-2 flex justify-between">
                    <span className="text-slate-400">Ticks Gained/Lost</span>
                    <span className={`font-mono font-bold ${isWin ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {isWin ? '+' : ''}{trade.ticks?.toFixed(1)} ticks
                    </span>
                  </div>

                  <div className="pt-2 flex justify-between"><span className="text-slate-400">Ticks Per Contract</span><span className="font-mono font-bold text-slate-900">{trade.ticksPerContract?.toFixed(1)}</span></div>
                  <div className="pt-2 flex justify-between"><span className="text-slate-400">Entry Time</span><span className="font-mono text-slate-900">{trade.entryTime || '--'}</span></div>
                  <div className="pt-2 flex justify-between"><span className="text-slate-400">Exit Time</span><span className="font-mono text-slate-900">{trade.exitTime || '--'}</span></div>
                  <div className="pt-2 flex justify-between"><span className="text-slate-400">Initial Target ($)</span><span className="font-mono text-emerald-600 font-bold">${Number(trade.initialTargetDollars || 0).toFixed(2)}</span></div>
                  <div className="pt-2 flex justify-between"><span className="text-slate-400">Trade Risk ($)</span><span className="font-mono text-rose-500 font-bold">${Number(trade.tradeRiskDollars || 0).toFixed(2)}</span></div>
                  <div className="pt-2 flex justify-between"><span className="text-slate-400">Commissions & Fees</span><span className="font-mono text-slate-900">${Number(trade.commissions || 0).toFixed(2)}</span></div>
                </div>
              )}

              {leftTab === 'Strategy' && (
                <div className="p-5 space-y-3 text-xs text-slate-700">
                  <div className="bg-[#ec3044]/5 p-3 rounded-xl border border-[#ec3044]/20">
                    <p className="font-bold text-[#ec3044] mb-1">Active Playbook Strategy</p>
                    <p className="text-slate-600">{trade.strategy || 'No strategy assigned.'}</p>
                  </div>
                  <div>
                    <p className="font-bold text-slate-800 mb-1">Setup Confluence Tag</p>
                    <p className="text-slate-500">{trade.setupTag || 'None'}</p>
                  </div>
                </div>
              )}

              {leftTab === 'Executions' && (
                <div className="p-4 space-y-3 text-xs">
                  <p className="font-bold text-slate-700 text-[11px] uppercase tracking-wider">Statement Order Fills</p>
                  
                  <div className="bg-slate-50 rounded-xl border border-slate-200 p-3 space-y-2 font-mono">
                    <div className="flex justify-between items-center text-slate-600 border-b border-slate-200 pb-1.5">
                      <span className="font-bold text-rose-600 flex items-center gap-1">
                        <ArrowDownRight className="w-3.5 h-3.5" /> {trade.side === 'SHORT' ? 'SELL (ENTRY)' : 'BUY (ENTRY)'}
                      </span>
                      <span>{trade.entryTime}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Price / Qty:</span>
                      <span className="font-bold text-slate-900">${Number(trade.entryPrice).toFixed(2)} ({trade.contractsTraded} contr)</span>
                    </div>
                  </div>

                  <div className="bg-slate-50 rounded-xl border border-slate-200 p-3 space-y-2 font-mono">
                    <div className="flex justify-between items-center text-slate-600 border-b border-slate-200 pb-1.5">
                      <span className="font-bold text-emerald-600 flex items-center gap-1">
                        <ArrowUpRight className="w-3.5 h-3.5" /> {trade.side === 'SHORT' ? 'BUY (COVER)' : 'SELL (EXIT)'}
                      </span>
                      <span>{trade.exitTime}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Price / Qty:</span>
                      <span className="font-bold text-slate-900">${Number(trade.exitPrice).toFixed(2)} ({trade.contractsTraded} contr)</span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* COLUMN 3: RIGHT CHART / NOTES */}
        <div className="col-span-5 bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
          <div className="flex border-b border-slate-100 bg-[#F8F9FD] p-1 text-xs font-medium text-slate-500">
            {(['Chart', 'Notes'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setRightTab(tab)}
                className={`flex-1 py-1.5 text-center rounded-md transition cursor-pointer ${rightTab === tab ? 'bg-white text-[#ec3044] font-bold shadow-sm' : 'hover:text-slate-900'}`}
              >
                {tab}
              </button>
            ))}
          </div>

          {rightTab === 'Chart' && (
            <div>
              <div className="bg-slate-50 p-2.5 border-b border-slate-200 text-[11px] font-mono flex justify-between items-center">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#ec3044]" /> {trade.symbol} 1m
                </span>
                <div className="flex items-center gap-2">
                  <span className="bg-rose-50 text-rose-600 border border-rose-200 px-2 py-0.5 rounded font-bold">
                    🔴 Entry @ ${Number(trade.entryPrice).toFixed(2)}
                  </span>
                  <span className="text-slate-400">→</span>
                  <span className="bg-emerald-50 text-emerald-600 border border-emerald-200 px-2 py-0.5 rounded font-bold">
                    🟢 Exit @ ${Number(trade.exitPrice).toFixed(2)}
                  </span>
                </div>
              </div>
              
              <TradeZellaLightChart symbol={trade.symbol} />
            </div>
          )}

          {rightTab === 'Notes' && (
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <span className="text-xs font-bold text-slate-700">Journal Note</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-[#ec3044]">Rating: {'⭐'.repeat(trade.tradeRating || 5)}</span>
                  <button 
                    onClick={() => setIsEditingNotes(!isEditingNotes)} 
                    className="text-xs font-bold text-[#ec3044] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Edit3 className="w-3 h-3" /> {isEditingNotes ? 'Cancel' : 'Edit'}
                  </button>
                </div>
              </div>

              {isEditingNotes ? (
                <div className="space-y-3">
                  <textarea
                    rows={8}
                    value={editedNotes}
                    onChange={(e) => setEditedNotes(e.target.value)}
                    className="w-full border border-[#ec3044]/40 rounded-xl p-3 text-xs text-[#ec3044] font-semibold focus:outline-none focus:ring-2 focus:ring-[#ec3044]"
                    placeholder="Write execution thoughts, market context, and confluences..."
                  />
                  <div className="flex justify-end">
                    <button 
                      onClick={handleSaveNotes}
                      className="px-4 py-1.5 bg-[#ec3044] hover:bg-[#d4283b] text-white font-bold rounded-xl text-xs flex items-center gap-1 cursor-pointer shadow-md"
                    >
                      <Check className="w-3.5 h-3.5" /> Save Note
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-slate-700 leading-relaxed min-h-[220px] bg-slate-50 p-4 rounded-xl border border-slate-200/80">
                  {trade.notes ? (
                    <p className="whitespace-pre-wrap">{trade.notes}</p>
                  ) : (
                    <p className="text-slate-400 italic">No text notes written for this trade execution. Click Edit to add confluences.</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

      </div>

      {/* DEDICATED POPUP MODAL FOR CREATING NEW TAG/STRATEGY (Close on Esc or Backdrop Click) */}
      {activeNewModalType && (
        <div 
          onClick={() => { setActiveNewModalType(null); setNewModalInputVal(''); }}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <div 
            onClick={e => e.stopPropagation()}
            className="bg-white border border-slate-200 rounded-2xl w-full max-w-sm p-5 shadow-2xl"
          >
            <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 capitalize">
                Create New {activeNewModalType}
              </h3>
              <button 
                onClick={() => { setActiveNewModalType(null); setNewModalInputVal(''); }} 
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
                  placeholder={`Enter ${activeNewModalType} name...`} 
                  className="w-full border border-[#ec3044]/40 bg-[#ec3044]/5 rounded-xl p-2.5 text-xs text-[#ec3044] font-bold focus:outline-none focus:ring-2 focus:ring-[#ec3044]"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => { setActiveNewModalType(null); setNewModalInputVal(''); }} 
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

    </div>
  );
}