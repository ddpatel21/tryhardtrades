'use client';

import React, { useState, useEffect } from 'react';
import { cloudDb } from '@/lib/cloudDb';
import { db } from '@/lib/db';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Edit3, 
  Check, 
  Plus,
  ArrowRight,
  SlidersHorizontal,
  ChevronDown
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import AddTradeModal from '@/components/AddTradeModal';

export default function DayViewPage() {
  const router = useRouter();

  // Active Sidebar Account / Group Filter Selection State
  const [activeFilterSelection, setActiveFilterSelection] = useState<{ 
    type: 'global' | 'group' | 'account'; 
    name: string 
  }>({ type: 'global', name: 'All Accounts' });

  // Navigation State for Calendar Month/Year defaulting to current date (August 2026)
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDateStr, setSelectedDateStr] = useState<string>(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  });

  const [isAddTradeOpen, setIsAddTradeOpen] = useState(false);

  // Cloud state variables
  const [rawTrades, setRawTrades] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [savedJournal, setSavedJournal] = useState<any | null>(null);

  const fetchCloudData = async () => {
    const trades = await cloudDb.getTrades();
    const accs = await cloudDb.getAccounts();
    setRawTrades(trades);
    setAccounts(accs);
  };

  useEffect(() => {
    fetchCloudData();
  }, []);

  // Fetch journal note from Dexie when selectedDateStr changes
  useEffect(() => {
    async function fetchJournal() {
      const entry = await db.dailyJournals.where('date').equals(selectedDateStr).first();
      setSavedJournal(entry || null);
    }
    fetchJournal();
  }, [selectedDateStr]);

  // Calendar Customization States
  const [showWeekends, setShowWeekends] = useState(false); // Default weekdays only

  // Calendar Day Display Checkboxes (Checkable Metrics)
  const [calendarDisplayMetrics, setCalendarDisplayMetrics] = useState({
    $: true,
    Points: false,
    Ticks: false,
    R: false,
    '%': false,
  });
  const [showCalendarMetricMenu, setShowCalendarMetricMenu] = useState(false);

  // Weekly Summary Column Display Checkboxes
  const [weeklyDisplayMetrics, setWeeklyDisplayMetrics] = useState({
    $: true,
    Points: true,
    Ticks: false,
    R: false,
    '%': false,
  });
  const [showWeeklyMetricMenu, setShowWeeklyMetricMenu] = useState(false);

  // Journal Note Editing State
  const [isEditingJournal, setIsEditingJournal] = useState(false);
  const [journalNoteInput, setJournalNoteInput] = useState('');

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
  const allTrades = rawTrades.filter((trade) => {
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

  useEffect(() => {
    setJournalNoteInput(savedJournal?.note || '');
    setIsEditingJournal(false);
  }, [selectedDateStr, savedJournal]);

  const handleSaveJournalNote = async () => {
    const existing = await db.dailyJournals.where('date').equals(selectedDateStr).first();
    
    if (existing && existing.id) {
      await db.dailyJournals.update(existing.id, { note: journalNoteInput });
    } else {
      await db.dailyJournals.put({
        date: selectedDateStr,
        note: journalNoteInput,
      });
    }

    const entry = await db.dailyJournals.where('date').equals(selectedDateStr).first();
    setSavedJournal(entry || null);
    setIsEditingJournal(false);
  };

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };
  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  const formatDateStr = (year: number, month: number, day: number) => {
    const m = String(month + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    return `${year}-${m}-${d}`;
  };

  const formatFriendlyDate = (dateStr: string) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    return dateObj.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  // Map trades by date string
  const tradesByDate: Record<string, typeof allTrades> = {};
  allTrades.forEach((t) => {
    if (!t.openDate) return;
    if (!tradesByDate[t.openDate]) tradesByDate[t.openDate] = [];
    tradesByDate[t.openDate].push(t);
  });

  // Calculate Monthly Metrics
  const monthPrefix = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
  const monthlyTrades = allTrades.filter(t => t.openDate && t.openDate.startsWith(monthPrefix));
  const monthlyNetPnL = monthlyTrades.reduce((acc, t) => acc + (t.netPnL || 0), 0);
  const monthlyWins = monthlyTrades.filter(t => t.status === 'WIN').length;
  const monthlyWinRate = monthlyTrades.length > 0 ? ((monthlyWins / monthlyTrades.length) * 100).toFixed(1) : '0';

  const dailyPnLs: Record<string, number> = {};
  monthlyTrades.forEach(t => {
    dailyPnLs[t.openDate] = (dailyPnLs[t.openDate] || 0) + (t.netPnL || 0);
  });

  const greenDaysCount = Object.values(dailyPnLs).filter(pnl => pnl > 0).length;
  const bestDayPnL = Object.values(dailyPnLs).length > 0 ? Math.max(...Object.values(dailyPnLs)) : 0;

  // Selected Day Details
  const selectedDayTrades = tradesByDate[selectedDateStr] || [];
  const selectedDayNetPnL = selectedDayTrades.reduce((acc, t) => acc + (t.netPnL || 0), 0);
  const selectedDayWins = selectedDayTrades.filter(t => t.status === 'WIN').length;
  const selectedDayWinRate = selectedDayTrades.length > 0 ? ((selectedDayWins / selectedDayTrades.length) * 100).toFixed(0) : '0';

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const activeJournalNote = journalNoteInput || savedJournal?.note || '';

  // Build Calendar Matrix (Weeks)
  const rawDaysInMonth = Array.from({ length: daysInMonth }, (_, i) => {
    const dayNum = i + 1;
    const dateStr = formatDateStr(currentYear, currentMonth, dayNum);
    const dateObj = new Date(currentYear, currentMonth, dayNum);
    const dayOfWeek = dateObj.getDay(); // 0 (Sun) to 6 (Sat)
    return { dayNum, dateStr, dayOfWeek };
  });

  const activeDaysInMonth = showWeekends 
    ? rawDaysInMonth 
    : rawDaysInMonth.filter(d => d.dayOfWeek !== 0 && d.dayOfWeek !== 6);

  const weeksList: Array<Array<typeof activeDaysInMonth[0] | null>> = [];
  let currentWeek: Array<typeof activeDaysInMonth[0] | null> = [];

  if (activeDaysInMonth.length > 0) {
    const firstDay = activeDaysInMonth[0];
    const startIndex = showWeekends ? firstDay.dayOfWeek : (firstDay.dayOfWeek - 1);
    for (let i = 0; i < startIndex; i++) {
      currentWeek.push(null);
    }
  }

  activeDaysInMonth.forEach((day) => {
    currentWeek.push(day);
    if (currentWeek.length === (showWeekends ? 7 : 5)) {
      weeksList.push(currentWeek);
      currentWeek = [];
    }
  });

  if (currentWeek.length > 0) {
    while (currentWeek.length < (showWeekends ? 7 : 5)) {
      currentWeek.push(null);
    }
    weeksList.push(currentWeek);
  }

  const gridColsClass = showWeekends ? 'grid-cols-8' : 'grid-cols-6';

  return (
    <div className="p-8 bg-[#F8F9FD] min-h-screen text-slate-800 font-sans">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <CalendarIcon className="w-6 h-6 text-[#ec3044]" /> Day View & Daily Journal
          </h1>
          {activeFilterSelection.type !== 'global' ? (
            <p className="text-xs font-bold text-[#ec3044] mt-0.5">
              Scoped to {activeFilterSelection.type === 'group' ? 'Group:' : 'Account:'} {activeFilterSelection.name}
            </p>
          ) : (
            <p className="text-xs text-slate-400 mt-0.5">Analyze day-by-day P&L performance and track execution consistency</p>
          )}
        </div>

        <button 
          onClick={() => setIsAddTradeOpen(true)}
          className="flex items-center gap-2 bg-[#ec3044] hover:bg-[#d4283b] text-white font-bold px-4 py-2 rounded-xl text-xs shadow-md transition cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Add Trade
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
          <p className="text-xs font-semibold text-slate-400 mb-1">{monthNames[currentMonth]} Net P&L</p>
          <p className={`text-2xl font-black ${monthlyNetPnL >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
            ${monthlyNetPnL.toFixed(2)}
          </p>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
          <p className="text-xs font-semibold text-slate-400 mb-1">Win Rate</p>
          <p className="text-2xl font-black text-slate-900">{monthlyWinRate}%</p>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
          <p className="text-xs font-semibold text-slate-400 mb-1">Best Trading Day</p>
          <p className="text-2xl font-black text-emerald-500">${bestDayPnL.toFixed(2)}</p>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
          <p className="text-xs font-semibold text-slate-400 mb-1">Green Days</p>
          <p className="text-2xl font-black text-emerald-500">{greenDaysCount}</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-12 gap-6 items-start">

        {/* LEFT CALENDAR & WEEKLY COLUMN (8 cols) */}
        <div className="col-span-12 lg:col-span-8 bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-6">
          
          {/* Calendar Header Controls */}
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <h2 className="text-lg font-extrabold text-slate-900">
              {monthNames[currentMonth]} {currentYear}
            </h2>

            <div className="flex items-center gap-3">
              
              {/* Checkable Metric Selector Dropdown */}
              <div className="relative">
                <button 
                  onClick={() => { setShowCalendarMetricMenu(!showCalendarMetricMenu); setShowWeeklyMetricMenu(false); }}
                  className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  <span className="text-slate-400 font-medium">Metric:</span>
                  <span className="text-[#ec3044] font-black">
                    {Object.entries(calendarDisplayMetrics).filter(([_, v]) => v).map(([k]) => k === '$' ? '$ (Dollars)' : k === 'Points' ? 'Points' : k === 'Ticks' ? 'Ticks' : k === 'R' ? 'R-Multiple' : 'Win %').join(', ') || 'Select'}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </button>

                {showCalendarMetricMenu && (
                  <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 p-3.5 space-y-2.5 text-xs">
                    <p className="font-bold text-slate-800 text-[10px] uppercase border-b border-slate-100 pb-1">Display Metrics</p>
                    {(['$', 'Points', 'Ticks', 'R', '%'] as const).map((m) => (
                      <label key={m} className="flex items-center gap-2.5 text-slate-700 cursor-pointer font-medium">
                        <input 
                          type="checkbox" 
                          checked={calendarDisplayMetrics[m]}
                          onChange={(e) => setCalendarDisplayMetrics({ ...calendarDisplayMetrics, [m]: e.target.checked })}
                          className="rounded border-slate-300 text-[#ec3044]"
                        />
                        <span>{m === '$' ? 'Dollars ($)' : m === 'Points' ? 'Points' : m === 'Ticks' ? 'Ticks' : m === 'R' ? 'R-Multiple' : 'Win %'}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Weekdays Only / All Days Toggle */}
              <div className="bg-slate-100 p-1 rounded-xl flex text-xs font-bold">
                <button
                  onClick={() => setShowWeekends(false)}
                  className={`px-3 py-1 rounded-lg transition cursor-pointer ${!showWeekends ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  Weekdays
                </button>
                <button
                  onClick={() => setShowWeekends(true)}
                  className={`px-3 py-1 rounded-lg transition cursor-pointer ${showWeekends ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  All Days
                </button>
              </div>

              {/* Month Navigation */}
              <div className="flex items-center gap-1.5">
                <button onClick={prevMonth} className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 cursor-pointer">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button onClick={() => setCurrentDate(new Date())} className="px-3 py-1.5 border border-slate-200 rounded-xl hover:bg-slate-50 text-xs font-bold text-slate-700 cursor-pointer">
                  Today
                </button>
                <button onClick={nextMonth} className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 cursor-pointer">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

            </div>
          </div>

          {/* UNIFIED GRID FOR DAYS + WEEKLY P&L COLUMN */}
          <div>
            
            {/* Days & Weekly Header Row */}
            <div className={`grid ${gridColsClass} gap-2 text-center text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 items-center`}>
              {showWeekends && <div>Sun</div>}
              <div>Mon</div>
              <div>Tue</div>
              <div>Wed</div>
              <div>Thu</div>
              <div>Fri</div>
              {showWeekends && <div>Sat</div>}
              
              <div className="flex items-center justify-center gap-1 pl-3">
                <span>Week P&L</span>
                <div className="relative">
                  <button 
                    onClick={() => { setShowWeeklyMetricMenu(!showWeeklyMetricMenu); setShowCalendarMetricMenu(false); }}
                    className="p-0.5 text-slate-400 hover:text-slate-700 rounded cursor-pointer"
                    title="Customize Weekly Display"
                  >
                    <SlidersHorizontal className="w-3 h-3" />
                  </button>

                  {showWeeklyMetricMenu && (
                    <div className="absolute right-0 top-full mt-1.5 w-48 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-3.5 space-y-2.5 text-xs text-left">
                      <p className="font-bold text-slate-800 text-[10px] uppercase border-b border-slate-100 pb-1">Display Metrics</p>
                      {(['$', 'Points', 'Ticks', 'R', '%'] as const).map((m) => (
                        <label key={m} className="flex items-center gap-2.5 text-slate-700 cursor-pointer font-medium">
                          <input 
                            type="checkbox" 
                            checked={weeklyDisplayMetrics[m]}
                            onChange={(e) => setWeeklyDisplayMetrics({ ...weeklyDisplayMetrics, [m]: e.target.checked })}
                            className="rounded border-slate-300 text-[#ec3044]"
                          />
                          <span>{m === '$' ? 'Dollars ($)' : m === 'Points' ? 'Points' : m === 'Ticks' ? 'Ticks' : m === 'R' ? 'R-Multiple' : 'Win %'}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Weeks Rows Grid */}
            <div className="space-y-2">
              {weeksList.map((week, weekIdx) => {
                const weekDays = week.filter(Boolean) as typeof activeDaysInMonth;
                const weekTradeList: typeof allTrades = [];
                weekDays.forEach(d => {
                  if (tradesByDate[d.dateStr]) {
                    weekTradeList.push(...tradesByDate[d.dateStr]);
                  }
                });

                const weekPnL = weekTradeList.reduce((acc, t) => acc + (t.netPnL || 0), 0);
                const weekPts = weekTradeList.reduce((acc, t) => acc + (t.points || 0), 0);
                const weekTicks = weekTradeList.reduce((acc, t) => acc + (t.ticks || 0), 0);
                const weekR = weekTradeList.reduce((acc, t) => acc + (t.realizedRMultiple || 0), 0);
                const weekWins = weekTradeList.filter(t => t.status === 'WIN').length;
                const weekWinPct = weekTradeList.length > 0 ? (weekWins / weekTradeList.length) * 100 : 0;

                return (
                  <div key={`week-row-${weekIdx}`} className={`grid ${gridColsClass} gap-2 items-stretch`}>
                    {week.map((day, dayIdx) => {
                      if (!day) {
                        return <div key={`empty-${weekIdx}-${dayIdx}`} className="h-24 bg-slate-50/40 rounded-2xl border border-dashed border-slate-100" />;
                      }

                      const dayTrades = tradesByDate[day.dateStr] || [];
                      const dayPnL = dayTrades.reduce((acc, t) => acc + (t.netPnL || 0), 0);
                      const dayPts = dayTrades.reduce((acc, t) => acc + (t.points || 0), 0);
                      const dayTicks = dayTrades.reduce((acc, t) => acc + (t.ticks || 0), 0);
                      const dayR = dayTrades.reduce((acc, t) => acc + (t.realizedRMultiple || 0), 0);
                      const dayWins = dayTrades.filter(t => t.status === 'WIN').length;
                      const dayWinPct = dayTrades.length > 0 ? (dayWins / dayTrades.length) * 100 : 0;

                      const isSelected = selectedDateStr === day.dateStr;

                      return (
                        <div
                          key={day.dateStr}
                          onClick={() => setSelectedDateStr(day.dateStr)}
                          className={`h-24 p-2.5 rounded-2xl border transition cursor-pointer flex flex-col justify-between ${
                            isSelected 
                              ? 'border-[#ec3044] ring-2 ring-[#ec3044]/20 bg-[#ec3044]/5' 
                              : 'border-slate-200/80 bg-white hover:border-[#ec3044]/40 hover:bg-slate-50/50'
                          }`}
                        >
                          <div className="flex justify-between items-center">
                            <span className={`text-xs font-bold ${isSelected ? 'text-[#ec3044]' : 'text-slate-700'}`}>
                              {day.dayNum}
                            </span>
                            {dayTrades.length > 0 && (
                              <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                                {dayTrades.length}
                              </span>
                            )}
                          </div>

                          {dayTrades.length > 0 ? (
                            <div className="space-y-0.5 font-mono text-[11px]">
                              {calendarDisplayMetrics['$'] && (
                                <div className={`font-extrabold truncate ${dayPnL >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                  ${dayPnL.toFixed(2)}
                                </div>
                              )}
                              {calendarDisplayMetrics['Points'] && (
                                <div className="text-slate-600 font-bold text-[10px] truncate">
                                  {dayPts >= 0 ? '+' : ''}{dayPts.toFixed(2)} pts
                                </div>
                              )}
                              {calendarDisplayMetrics['Ticks'] && (
                                <div className="text-slate-600 font-bold text-[10px] truncate">
                                  {dayTicks >= 0 ? '+' : ''}{dayTicks.toFixed(1)} tks
                                </div>
                              )}
                              {calendarDisplayMetrics['R'] && (
                                <div className="text-slate-600 font-bold text-[10px] truncate">
                                  {dayR >= 0 ? '+' : ''}{dayR.toFixed(2)}R
                                </div>
                              )}
                              {calendarDisplayMetrics['%'] && (
                                <div className="text-slate-600 font-bold text-[10px] truncate">
                                  {dayWinPct.toFixed(0)}% Win
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-300 font-medium">No Trades</span>
                          )}
                        </div>
                      );
                    })}

                    {/* WEEK P&L CELL */}
                    <div className="h-24 p-2.5 ml-3 bg-slate-50 border border-slate-200/80 rounded-2xl shadow-xs flex flex-col justify-between">
                      <span className="text-[10px] font-bold text-slate-400 block">Wk {weekIdx + 1}</span>
                      
                      {weekTradeList.length === 0 ? (
                        <span className="text-[10px] text-slate-300 italic block">No Trades</span>
                      ) : (
                        <div className="space-y-0.5 font-mono text-[11px]">
                          {weeklyDisplayMetrics['$'] && (
                            <div className={`font-extrabold truncate ${weekPnL >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                              ${weekPnL.toFixed(2)}
                            </div>
                          )}
                          {weeklyDisplayMetrics['Points'] && (
                            <div className="text-slate-600 font-bold text-[10px] truncate">
                              {weekPts >= 0 ? '+' : ''}{weekPts.toFixed(2)} pts
                            </div>
                          )}
                          {weeklyDisplayMetrics['Ticks'] && (
                            <div className="text-slate-600 font-bold text-[10px] truncate">
                              {weekTicks >= 0 ? '+' : ''}{weekTicks.toFixed(1)} tks
                            </div>
                          )}
                          {weeklyDisplayMetrics['R'] && (
                            <div className="text-slate-600 font-bold text-[10px] truncate">
                              {weekR >= 0 ? '+' : ''}{weekR.toFixed(2)}R
                            </div>
                          )}
                          {weeklyDisplayMetrics['%'] && (
                            <div className="text-slate-600 font-bold text-[10px] truncate">
                              {weekWinPct.toFixed(0)}% Win
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                  </div>
                );
              })}
            </div>

          </div>

        </div>

        {/* RIGHT: SELECTED DAY BREAKDOWN (4 cols) */}
        <div className="col-span-12 lg:col-span-4 bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-5">
          
          <div className="border-b border-slate-100 pb-4 flex justify-between items-start">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Selected Day</span>
              <h3 className="text-base font-black text-slate-900 mt-0.5">{formatFriendlyDate(selectedDateStr)}</h3>
            </div>
            <div className={`text-right text-lg font-black ${selectedDayNetPnL >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
              ${selectedDayNetPnL.toFixed(2)}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
            <div>
              <span className="text-slate-400 font-medium block">Total Trades</span>
              <span className="text-slate-900 font-bold text-sm">{selectedDayTrades.length}</span>
            </div>
            <div>
              <span className="text-slate-400 font-medium block">Daily Win Rate</span>
              <span className="text-slate-900 font-bold text-sm">{selectedDayWinRate}%</span>
            </div>
          </div>

          {/* Executed Trades */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Trades Executed</h4>
            
            {selectedDayTrades.length === 0 ? (
              <div className="p-6 bg-slate-50 rounded-2xl text-center border border-slate-100">
                <p className="text-xs text-slate-400">No trades logged on this date.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {selectedDayTrades.map((trade) => (
                  <div
                    key={trade.id}
                    onClick={() => router.push(`/trade-view/${trade.id}`)}
                    className="p-3 bg-slate-50 hover:bg-[#ec3044]/5 border border-slate-200/80 hover:border-[#ec3044]/30 rounded-xl flex justify-between items-center transition cursor-pointer"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-xs text-slate-900">{trade.symbol}</span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${trade.status === 'WIN' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                          {trade.status}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5 font-mono">{trade.entryTime || '--'}</p>
                    </div>

                    <div className="text-right">
                      <p className={`font-mono text-xs font-bold ${trade.netPnL >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        ${trade.netPnL.toFixed(2)}
                      </p>
                      <span className="text-[10px] text-[#ec3044] font-bold flex items-center gap-0.5 justify-end mt-0.5">
                        View <ArrowRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* PERSISTED DAILY JOURNAL NOTE */}
          <div className="space-y-3 pt-3 border-t border-slate-100">
            <div className="flex justify-between items-center">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Daily Journal Note</h4>
              <button 
                onClick={() => setIsEditingJournal(!isEditingJournal)} 
                className="text-xs font-bold text-[#ec3044] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Edit3 className="w-3 h-3" /> {isEditingJournal ? 'Cancel' : 'Edit'}
              </button>
            </div>

            {isEditingJournal ? (
              <div className="space-y-2">
                <textarea
                  rows={4}
                  value={journalNoteInput}
                  onChange={e => setJournalNoteInput(e.target.value)}
                  placeholder="Record market context, psychological state, and discipline notes for today..."
                  className="w-full border border-[#ec3044]/40 bg-white rounded-xl p-3 text-xs text-[#ec3044] font-medium focus:outline-none focus:ring-2 focus:ring-[#ec3044]"
                />
                <button 
                  onClick={handleSaveJournalNote} 
                  className="w-full py-2 bg-[#ec3044] hover:bg-[#d4283b] text-white font-bold rounded-xl text-xs shadow-md transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" /> Save Journal Note
                </button>
              </div>
            ) : (
              <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs text-slate-600 leading-relaxed min-h-[90px]">
                {activeJournalNote.trim() !== '' ? (
                  <p className="whitespace-pre-wrap text-slate-800 font-medium">{activeJournalNote}</p>
                ) : (
                  <p className="text-slate-400 italic">No daily journal written for this date. Click Edit to record rule adherence.</p>
                )}
              </div>
            )}
          </div>

        </div>

      </div>

      {/* Global Add Trade Modal */}
      <AddTradeModal isOpen={isAddTradeOpen} onClose={() => { setIsAddTradeOpen(false); fetchCloudData(); }} />

    </div>
  );
}