'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  CalendarDays, 
  TableProperties, 
  Tags, 
  Plus, 
  Target,
  Layers,
  ChevronDown,
  ChevronRight,
  UserPlus,
  Settings,
  Trash2,
  Edit2,
  ChevronLeft,
  Menu,
  LogOut,
  History,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { cloudDb } from '@/lib/cloudDb';
import { db, TradingAccount, TradeItem } from '@/lib/db';
import { copyLeaderTradeToGroup } from '@/lib/copier';
import AccountModal from '@/components/AccountModal';

interface SidebarLayoutProps {
  children?: React.ReactNode;
  onOpenAddTrade?: () => void;
}

interface AccountAdjustment {
  id?: string | number;
  accountId: string | number;
  type: 'deposit' | 'withdrawal';
  amount: number;
  date: string;
  note?: string;
}

export default function Sidebar({ children, onOpenAddTrade }: SidebarLayoutProps) {
  const pathname = usePathname();
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    async function loadAccounts() {
      const data = await cloudDb.getAccounts();
      setAccounts(data);
    }
    loadAccounts();

    const handleRefresh = () => loadAccounts();
    window.addEventListener('account-filter-changed', handleRefresh);
    window.addEventListener('open-add-account', handleRefresh);
    return () => {
      window.removeEventListener('account-filter-changed', handleRefresh);
      window.removeEventListener('open-add-account', handleRefresh);
    };
  }, []);

  const [selectedAccount, setSelectedAccount] = useState<string>('All Accounts');
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const [isAccountManagerOpen, setIsAccountManagerOpen] = useState<boolean>(false);

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [editingAccount, setEditingAccount] = useState<TradingAccount | null>(null);

  // Adjustments Log state
  const [adjustments, setAdjustments] = useState<AccountAdjustment[]>([]);
  const [adjType, setAdjType] = useState<'deposit' | 'withdrawal'>('withdrawal');
  const [adjAmount, setAdjAmount] = useState<string>('');
  const [adjDate, setAdjDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Dropzone upload state inside Account Manager
  const [dragOverAccountId, setDragOverAccountId] = useState<string | number | null>(null);
  const [uploadStatus, setUploadStatus] = useState<{
    accountId: string | number;
    status: 'parsing' | 'success' | 'error';
    message: string;
  } | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isAccountManagerOpen) {
        setIsAccountManagerOpen(false);
        setEditingAccount(null);
        setUploadStatus(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAccountManagerOpen]);

  // Load adjustments for selected account
  useEffect(() => {
    async function loadAdjustments() {
      if (!editingAccount?.id) {
        setAdjustments([]);
        return;
      }

      let loadedList: AccountAdjustment[] = [];

      try {
        if (db.adjustments) {
          const dexieData = await db.adjustments
            .where('accountId')
            .equals(Number(editingAccount.id))
            .toArray();
          if (dexieData && dexieData.length > 0) {
            loadedList = dexieData;
          }
        }
      } catch (err) {
        console.error("Dexie adjustments read error:", err);
      }

      if (loadedList.length === 0) {
        try {
          const { supabase } = await import('@/lib/supabase');
          const { data, error } = await supabase
            .from('account_adjustments')
            .select('*')
            .eq('account_id', editingAccount.id)
            .order('date', { ascending: false });

          if (error) console.error("Supabase select error:", error);

          if (data && data.length > 0) {
            loadedList = data.map(d => ({
              id: d.id,
              accountId: d.account_id,
              type: d.type === 'deposit' ? 'deposit' : 'withdrawal',
              amount: Number(d.amount),
              date: d.date,
            }));
          }
        } catch (err) {
          console.error("Supabase adjustments read error:", err);
        }
      }

      setAdjustments(loadedList);
    }

    loadAdjustments();
  }, [editingAccount?.id]);

  const existingGroupNames = Array.from(new Set(accounts.map(a => a.groupName).filter(Boolean)));
  const existingFirms = Array.from(new Set(accounts.map(a => a.firm).filter(Boolean)));

  // Parser: Tradovate CSV statements
  const parseTradovateCSV = (csvText: string): Partial<TradeItem>[] => {
    const lines = csvText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.replace(/['"]+/g, '').trim().toLowerCase());
    const parsedRows: Partial<TradeItem>[] = [];

    const symbolIdx = headers.findIndex(h => h.includes('contract') || h.includes('symbol') || h.includes('product'));
    const sideIdx = headers.findIndex(h => h === 'b/s' || h === 'side' || h.includes('action'));
    const qtyIdx = headers.findIndex(h => h.includes('qty') || h.includes('size') || h.includes('contracts') || h.includes('quantity'));
    const priceIdx = headers.findIndex(h => h.includes('price') || h.includes('fill price') || h.includes('avg price'));
    const pnlIdx = headers.findIndex(h => h.includes('pnl') || h.includes('p&l') || h.includes('profit') || h.includes('net'));
    const timeIdx = headers.findIndex(h => h.includes('time') || h.includes('date') || h.includes('timestamp'));

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',').map(p => p.replace(/['"]+/g, '').trim());
      if (parts.length < headers.length) continue;

      const symbol = symbolIdx >= 0 ? parts[symbolIdx] : 'NQ';
      const sideRaw = sideIdx >= 0 ? parts[sideIdx].toUpperCase() : 'BUY';
      const side = sideRaw.includes('B') ? 'LONG' : 'SHORT';
      const qty = qtyIdx >= 0 ? parseFloat(parts[qtyIdx]) || 1 : 1;
      const price = priceIdx >= 0 ? parseFloat(parts[priceIdx]) || 0 : 0;
      const netPnL = pnlIdx >= 0 ? parseFloat(parts[pnlIdx]) || 0 : 0;
      
      const rawTime = timeIdx >= 0 ? parts[timeIdx] : new Date().toISOString();
      let openDate = new Date().toISOString().split('T')[0];
      let entryTime = '09:30:00';

      if (rawTime.includes(' ') || rawTime.includes('T')) {
        const splitParts = rawTime.split(/[ T]/);
        if (splitParts[0]) openDate = splitParts[0];
        if (splitParts[1]) entryTime = splitParts[1];
      }

      parsedRows.push({
        symbol: symbol.toUpperCase(),
        openDate,
        entryTime,
        exitTime: entryTime,
        side,
        contractsTraded: qty,
        entryPrice: price,
        exitPrice: price,
        netPnL,
        grossPnL: netPnL,
        commissions: 0,
        points: 0,
        ticks: 0,
        ticksPerContract: 4,
        status: netPnL > 0 ? 'WIN' : netPnL < 0 ? 'LOSS' : 'BE'
      });
    }

    return parsedRows;
  };

  const handleFileUpload = async (file: File, account: TradingAccount) => {
    if (!account.id || !account.name) return;

    setUploadStatus({
      accountId: account.id,
      status: 'parsing',
      message: `Parsing Tradovate file for ${account.name}...`
    });

    try {
      const text = await file.text();
      const parsedTrades = parseTradovateCSV(text);

      if (parsedTrades.length === 0) {
        setUploadStatus({
          accountId: account.id,
          status: 'error',
          message: 'Unable to parse trades. Verify this is a valid Tradovate statement export.'
        });
        return;
      }

      const { supabase } = await import('@/lib/supabase');
      let savedCount = 0;

      for (const t of parsedTrades) {
        const tradePayload = {
          symbol: t.symbol || 'NQ',
          open_date: t.openDate || new Date().toISOString().split('T')[0],
          side: t.side || 'LONG',
          contracts_traded: t.contractsTraded || 1,
          entry_price: t.entryPrice || 0,
          exit_price: t.exitPrice || 0,
          net_pnl: t.netPnL || 0,
          gross_pnl: t.grossPnL || 0,
          commissions: t.commissions || 0,
          points: t.points || 0,
          ticks: t.ticks || 0,
          ticks_per_contract: 4,
          status: t.status || 'BE',
          entry_time: t.entryTime,
          exit_time: t.exitTime,
          account: account.name,
          account_group: account.groupName,
        };

        let insertedId: number = Date.now() + Math.floor(Math.random() * 1000);

        try {
          const { data } = await supabase.from('trades').insert(tradePayload).select('id').single();
          if (data && data.id) insertedId = data.id;
        } catch (err) {}

        const localTrade: TradeItem = {
          id: insertedId,
          symbol: tradePayload.symbol,
          openDate: tradePayload.open_date,
          side: tradePayload.side as any,
          contractsTraded: tradePayload.contracts_traded,
          entryPrice: tradePayload.entry_price,
          exitPrice: tradePayload.exit_price,
          netPnL: tradePayload.net_pnl,
          grossPnL: tradePayload.gross_pnl,
          commissions: tradePayload.commissions,
          points: tradePayload.points,
          ticks: tradePayload.ticks,
          ticksPerContract: 4,
          status: tradePayload.status as any,
          entryTime: tradePayload.entry_time,
          exitTime: tradePayload.exit_time,
          account: account.name,
          accountGroup: account.groupName
        };

        try {
          if (db.trades) {
            await db.trades.put(localTrade);
          }
        } catch (err) {}

        if (account.groupName) {
          await copyLeaderTradeToGroup(localTrade);
        }

        savedCount++;
      }

      setUploadStatus({
        accountId: account.id,
        status: 'success',
        message: `Imported ${savedCount} trades into ${account.name}${account.groupName ? ` (synced to group '${account.groupName}')` : ''}!`
      });

      window.dispatchEvent(new CustomEvent('account-filter-changed'));
    } catch (err: any) {
      setUploadStatus({
        accountId: account.id,
        status: 'error',
        message: err.message || 'Error parsing statement file.'
      });
    }
  };

  const handleDeleteAccount = async (id?: number | string) => {
    if (!id) return;
    if (confirm('Are you sure you want to delete this account? All associated adjustments and trades will also be cleaned up.')) {
      const numId = Number(id);

      try {
        const { supabase } = await import('@/lib/supabase');
        await supabase.from('account_adjustments').delete().eq('account_id', id);
        await supabase.from('accounts').delete().eq('id', id);
      } catch (e) {
        console.warn('Supabase cascade delete error:', e);
      }

      try {
        if (db.adjustments) {
          await db.adjustments.where('accountId').equals(numId).delete();
        }
        if (db.accounts) {
          await db.accounts.delete(numId);
        }
      } catch (e) {
        console.warn('Dexie cascade delete error:', e);
      }

      const data = await cloudDb.getAccounts();
      setAccounts(data);
      if (editingAccount?.id === id) {
        setEditingAccount(null);
      }
      window.dispatchEvent(new CustomEvent('account-filter-changed'));
    }
  };

  const handleUpdateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAccount || !editingAccount.id) return;

    const updatedAcc: TradingAccount = {
      ...editingAccount,
      id: Number(editingAccount.id),
      groupName: editingAccount.groupName,
      inputType: editingAccount.inputType || 'Tradovate',
      balance: Number(editingAccount.balance),
      profitTarget: Number(editingAccount.profitTarget) || 0,
      maxDrawdown: Number(editingAccount.maxDrawdown) || 0
    };

    try {
      if (db.accounts) {
        await db.accounts.put(updatedAcc);
      }
    } catch (err) {
      console.error("Dexie account update error:", err);
    }

    try {
      const { supabase } = await import('@/lib/supabase');
      await supabase.from('accounts').update({
        name: editingAccount.name,
        group_name: editingAccount.groupName,
        type: editingAccount.type,
        firm: editingAccount.firm,
        balance: Number(editingAccount.balance),
        profit_target: Number(editingAccount.profitTarget) || 0,
        max_drawdown: Number(editingAccount.maxDrawdown) || 0,
        input_type: editingAccount.inputType || 'Tradovate',
      }).eq('id', editingAccount.id);
    } catch (err) {
      console.error("Supabase account update error:", err);
    }

    setEditingAccount(null);
    const data = await cloudDb.getAccounts();
    setAccounts(data);
    window.dispatchEvent(new CustomEvent('account-filter-changed'));
  };

  const handleAddAdjustment = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const parsedAmount = parseFloat(adjAmount);
    if (!editingAccount?.id || isNaN(parsedAmount) || parsedAmount <= 0) return;

    const normalizedType: 'deposit' | 'withdrawal' = adjType === 'deposit' ? 'deposit' : 'withdrawal';

    const newAdjustment: AccountAdjustment = {
      id: Date.now(),
      accountId: Number(editingAccount.id),
      type: normalizedType,
      amount: parsedAmount,
      date: adjDate
    };

    setAdjustments(prev => [newAdjustment, ...prev]);
    setAdjAmount('');

    try {
      if (db.adjustments) {
        await db.adjustments.put({
          id: Number(newAdjustment.id),
          accountId: Number(newAdjustment.accountId),
          type: newAdjustment.type,
          amount: newAdjustment.amount,
          date: newAdjustment.date
        });
      }
    } catch (err) {
      console.error("Dexie adjustment write error:", err);
    }

    try {
      const { supabase } = await import('@/lib/supabase');
      const { error } = await supabase.from('account_adjustments').insert({
        account_id: editingAccount.id,
        type: normalizedType,
        amount: parsedAmount,
        date: adjDate
      });
      if (error) console.error("Supabase adjustment insert error:", error);
    } catch (err) {
      console.error("Supabase write exception:", err);
    }

    window.dispatchEvent(new CustomEvent('account-filter-changed'));
  };

  const handleDeleteAdjustment = async (adjId?: number | string) => {
    if (!adjId) return;

    setAdjustments(prev => prev.filter(a => a.id !== adjId));

    try {
      if (db.adjustments) {
        await db.adjustments.delete(Number(adjId));
      }
    } catch (err) {}

    try {
      const { supabase } = await import('@/lib/supabase');
      await supabase.from('account_adjustments').delete().eq('id', adjId);
    } catch (err) {}

    window.dispatchEvent(new CustomEvent('account-filter-changed'));
  };

  const handleLogout = () => {
    if (confirm('Are you sure you want to log out?')) {
      sessionStorage.removeItem('tryhard_auth');
      window.location.reload();
    }
  };

  const groupedAccounts: Record<string, typeof accounts> = {};
  accounts.forEach(acc => {
    const g = acc.groupName || 'Default Group';
    if (!groupedAccounts[g]) groupedAccounts[g] = [];
    groupedAccounts[g].push(acc);
  });

  const toggleGroupExpand = (groupName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedGroups(prev => ({
      ...prev,
      [groupName]: !prev[groupName]
    }));
  };

  // Nav Items preserved exactly as your original file
  const navItems = [
    { label: 'Dashboard & Reports', href: '/', icon: LayoutDashboard },
    { label: 'Day View', href: '/day-view', icon: CalendarDays },
    { label: 'Trade View', href: '/trade-view', icon: TableProperties },
    { label: 'Strategies & Tags', href: '/strategies', icon: Tags },
  ];

  return (
    <>
      {/* Mobile Top Header Toggle */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-slate-200 z-50 flex items-center justify-between px-4 print:hidden">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#ec3044] rounded-xl flex items-center justify-center text-white font-bold">🎯</div>
          <span className="font-black text-slate-900 text-sm">TryhardTrades</span>
        </div>
        <button 
          onClick={() => setIsMobileOpen(!isMobileOpen)}
          className="p-2 text-slate-700 bg-slate-100 rounded-xl cursor-pointer"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div 
          onClick={() => setIsMobileOpen(false)}
          className="lg:hidden fixed inset-0 bg-slate-900/50 z-40 backdrop-blur-xs"
        />
      )}

      {/* Sidebar Navigation */}
      <aside className={`bg-white border-r border-slate-200/80 flex flex-col justify-between p-6 fixed inset-y-0 left-0 z-50 transition-all duration-300 print:hidden ${
        isCollapsed ? 'w-20 px-3' : 'w-64'
      } ${
        isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}>
        
        <div className="space-y-6 overflow-y-auto overflow-x-hidden flex-1 pr-1">
          
          {/* Brand Logo & Name & Settings */}
          <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-between px-2'}`}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-[#ec3044] rounded-xl flex items-center justify-center text-white shadow-md shadow-[#ec3044]/30 shrink-0">
                <Target className="w-5 h-5" />
              </div>
              {!isCollapsed && (
                <div>
                  <h2 className="font-black text-slate-900 tracking-tight text-base leading-tight">TryhardTrades</h2>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Trading Journal</span>
                </div>
              )}
            </div>
            {!isCollapsed && (
              <button 
                onClick={() => setIsAccountManagerOpen(true)}
                className="p-2 text-slate-400 hover:text-[#ec3044] hover:bg-slate-50 rounded-xl transition cursor-pointer"
                title="Account Manager"
              >
                <Settings className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Account Group Selector */}
          {!isCollapsed && (
            <div className="relative">
              <button 
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="w-full bg-slate-50 border border-slate-200 hover:bg-slate-100/80 p-2.5 rounded-xl flex items-center justify-between text-xs font-bold text-slate-900 transition cursor-pointer"
              >
                <div className="flex items-center gap-2 truncate">
                  <Layers className="w-3.5 h-3.5 text-[#ec3044]" />
                  <span className="truncate">{selectedAccount}</span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              </button>

              {isDropdownOpen && (
                <div className="absolute top-full left-0 mt-1.5 w-full bg-white border border-slate-200 rounded-xl shadow-lg py-1.5 z-50 space-y-1 max-h-80 overflow-y-auto">
                  <button
                    onClick={() => {
                      setSelectedAccount('All Accounts');
                      setIsDropdownOpen(false);
                      window.dispatchEvent(new CustomEvent('account-filter-changed', { detail: 'All Accounts' }));
                    }}
                    className={`w-full text-left px-3 py-2 text-xs font-semibold flex items-center justify-between hover:bg-slate-50 transition ${
                      selectedAccount === 'All Accounts' ? 'text-[#ec3044] bg-[#ec3044]/5 font-bold' : 'text-slate-800'
                    }`}
                  >
                    <span>All Accounts</span>
                    <span className="text-[9px] font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">Global</span>
                  </button>

                  {accounts.length === 0 ? (
                    <div className="px-3 py-2 text-[11px] text-slate-400 text-center italic">No accounts created yet.</div>
                  ) : (
                    Object.entries(groupedAccounts).map(([groupName, groupAccs]) => {
                      const isExpanded = !!expandedGroups[groupName];

                      return (
                        <div key={groupName} className="py-1 border-t border-slate-100">
                          <div className={`flex items-center justify-between px-3 py-2 bg-slate-50 hover:bg-slate-100 transition ${
                            selectedAccount === `Group: ${groupName}` ? 'bg-[#ec3044]/10 text-[#ec3044]' : 'text-slate-800'
                          }`}>
                            <button
                              onClick={(e) => toggleGroupExpand(groupName, e)}
                              className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider flex-1 text-left cursor-pointer"
                            >
                              {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
                              <span className="w-1.5 h-1.5 rounded-full bg-[#ec3044]"></span>
                              {groupName} <span className="text-[9px] text-slate-400 font-normal">({groupAccs.length})</span>
                            </button>

                            <button
                              onClick={() => {
                                setSelectedAccount(`Group: ${groupName}`);
                                setIsDropdownOpen(false);
                                window.dispatchEvent(new CustomEvent('account-filter-changed', { detail: { type: 'group', name: groupName } }));
                              }}
                              className="text-[9px] font-bold text-slate-700 hover:text-[#ec3044] px-2 py-0.5 rounded bg-white border border-slate-200 transition cursor-pointer"
                            >
                              Select Group
                            </button>
                          </div>

                          {isExpanded && (
                            <div className="pl-4 pr-2 py-1 space-y-1 bg-white">
                              {groupAccs.map((acc) => (
                                <div key={acc.id} className="flex items-center justify-between px-2 py-1.5 hover:bg-slate-50 group rounded-lg">
                                  <button
                                    onClick={() => {
                                      setSelectedAccount(acc.name);
                                      setIsDropdownOpen(false);
                                      window.dispatchEvent(new CustomEvent('account-filter-changed', { detail: { type: 'account', name: acc.name } }));
                                    }}
                                    className={`text-left text-xs font-semibold flex-1 truncate pr-2 ${
                                      selectedAccount === acc.name ? 'text-[#ec3044] font-bold' : 'text-slate-800'
                                    }`}
                                  >
                                    <div className="truncate">{acc.name}</div>
                                    <div className="text-[9px] text-slate-500">{acc.firm} • <span className="font-mono font-bold">${acc.balance.toLocaleString()}</span></div>
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteAccount(acc.id);
                                    }}
                                    className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-500 p-1 transition cursor-pointer"
                                    title="Delete Account"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}

                  <div className="border-t border-slate-100 pt-1 mt-1 px-2 space-y-1">
                    <button
                      onClick={() => {
                        setIsDropdownOpen(false);
                        window.dispatchEvent(new CustomEvent('open-add-account'));
                      }}
                      className="w-full text-center py-2 text-xs font-bold text-[#ec3044] hover:bg-[#ec3044]/5 rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <UserPlus className="w-3.5 h-3.5" /> + Create New Account
                    </button>
                    <button
                      onClick={() => {
                        setIsDropdownOpen(false);
                        setIsAccountManagerOpen(true);
                      }}
                      className="w-full text-center py-2 text-xs font-bold text-slate-800 hover:bg-slate-100 rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Settings className="w-3.5 h-3.5" /> Open Account Manager
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Add Trade Button */}
          <button 
            onClick={onOpenAddTrade}
            className={`w-full bg-[#ec3044] hover:bg-[#d4283b] text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-sm transition cursor-pointer text-sm ${
              isCollapsed ? 'px-0' : 'px-4'
            }`}
            title="Add Trade"
          >
            <Plus className="w-4 h-4 shrink-0" />
            {!isCollapsed && <span>Add Trade</span>}
          </button>

          {/* Nav Links */}
          <nav className="space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={item.label}
                  className={`flex items-center gap-3 py-2.5 rounded-xl text-xs font-bold transition ${
                    isCollapsed ? 'justify-center px-0' : 'px-3.5'
                  } ${
                    isActive
                      ? 'bg-[#ec3044]/10 text-[#ec3044]'
                      : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#ec3044]' : 'text-slate-400'}`} />
                  {!isCollapsed && <span className="truncate">{item.label}</span>}
                </Link>
              );
            })}
          </nav>

        </div>

        {/* Footer: Logout & Collapse Buttons */}
        <div className="pt-4 border-t border-slate-100 space-y-2">
          <button
            onClick={handleLogout}
            className={`w-full py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition cursor-pointer ${
              isCollapsed ? 'px-0' : 'px-3'
            }`}
            title="Log Out"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {!isCollapsed && <span>Log Out</span>}
          </button>

          <button
            onClick={() => {
              const nextState = !isCollapsed;
              setIsCollapsed(nextState);
              window.dispatchEvent(new CustomEvent('sidebar-collapse-changed', { detail: nextState }));
            }}
            className={`w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition cursor-pointer ${
              isCollapsed ? 'px-0' : 'px-3'
            }`}
            title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4 shrink-0" />
            ) : (
              <>
                <ChevronLeft className="w-4 h-4 shrink-0" />
                <span>Collapse Sidebar</span>
              </>
            )}
          </button>
        </div>

      </aside>

      {/* ACCOUNT MANAGER DRAWER SIDEBAR WITH DIRECT TRADOVATE DROPZONES */}
      {isAccountManagerOpen && (
        <div 
          onClick={() => {
            setIsAccountManagerOpen(false);
            setEditingAccount(null);
            setUploadStatus(null);
          }}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex justify-end"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-white h-full shadow-2xl p-6 flex flex-col justify-between animate-in slide-in-from-right duration-200"
          >
            
            <div className="space-y-6 overflow-y-auto flex-1 pr-1">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-base font-black text-slate-900">Account Manager</h2>
                  <p className="text-xs text-slate-500 font-medium">Manage accounts, set targets, or drag & drop Tradovate statements directly below</p>
                </div>
                <button 
                  onClick={() => {
                    setIsAccountManagerOpen(false);
                    setEditingAccount(null);
                    setUploadStatus(null);
                  }}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Upload Notification Banner */}
              {uploadStatus && (
                <div className={`p-3.5 rounded-xl border text-xs font-bold flex items-center justify-between ${
                  uploadStatus.status === 'success' 
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                    : uploadStatus.status === 'error'
                    ? 'bg-rose-50 text-rose-800 border-rose-200'
                    : 'bg-blue-50 text-blue-800 border-blue-200'
                }`}>
                  <div className="flex items-center gap-2">
                    {uploadStatus.status === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                    {uploadStatus.status === 'error' && <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
                    {uploadStatus.status === 'parsing' && <RefreshCw className="w-4 h-4 text-blue-600 animate-spin shrink-0" />}
                    <span>{uploadStatus.message}</span>
                  </div>
                  <button onClick={() => setUploadStatus(null)} className="text-slate-400 hover:text-slate-600 font-black">✕</button>
                </div>
              )}

              {editingAccount ? (
                <form onSubmit={handleUpdateAccount} className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">Edit Account Details</h3>
                    <span className="text-[10px] font-bold text-slate-400 font-mono">ID: {editingAccount.id}</span>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-700 uppercase tracking-wider mb-1">Account Name</label>
                    <input 
                      type="text" 
                      value={editingAccount.name} 
                      onChange={e => setEditingAccount({ ...editingAccount, name: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#ec3044]"
                      placeholder="e.g. 001"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-700 uppercase tracking-wider mb-1">Account Group Name</label>
                    <input 
                      type="text" 
                      list="existing-group-list"
                      value={editingAccount.groupName} 
                      onChange={e => setEditingAccount({ ...editingAccount, groupName: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#ec3044]"
                      placeholder="Select or enter group name (e.g. Lucid)"
                      required
                    />
                    <datalist id="existing-group-list">
                      {existingGroupNames.map(g => (
                        <option key={g} value={g} />
                      ))}
                    </datalist>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-black text-slate-700 uppercase tracking-wider mb-1">Type</label>
                      <select 
                        value={editingAccount.type} 
                        onChange={e => setEditingAccount({ ...editingAccount, type: e.target.value as any })}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#ec3044]"
                      >
                        <option value="Live">Live</option>
                        <option value="Eval">Eval</option>
                        <option value="Funded">Funded</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-slate-700 uppercase tracking-wider mb-1">Broker / Firm</label>
                      <input 
                        type="text" 
                        list="existing-firm-list"
                        value={editingAccount.firm} 
                        onChange={e => setEditingAccount({ ...editingAccount, firm: e.target.value })}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#ec3044]"
                        placeholder="Select or enter firm (e.g. Lucid Trading)"
                      />
                      <datalist id="existing-firm-list">
                        {existingFirms.map(f => (
                          <option key={f} value={f} />
                        ))}
                      </datalist>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-700 uppercase tracking-wider mb-1">Data Input Type (Statement Format)</label>
                    <select 
                      value={editingAccount.inputType || 'Tradovate'} 
                      onChange={e => setEditingAccount({ ...editingAccount, inputType: e.target.value as any })}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#ec3044]"
                      required
                    >
                      <option value="Tradovate">Tradovate</option>
                      <option value="AMP">AMP</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-700 uppercase tracking-wider mb-1">Account Size / Balance ($)</label>
                    <input 
                      type="number" 
                      value={editingAccount.balance} 
                      onChange={e => setEditingAccount({ ...editingAccount, balance: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#ec3044]"
                      required
                    />
                  </div>

                  {/* Target & Drawdown Inputs */}
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-[10px] font-black text-emerald-700 uppercase tracking-wider mb-1">
                        Target Profit / Pass ($)
                      </label>
                      <input 
                        type="number" 
                        step="any"
                        placeholder="e.g. 3000"
                        value={editingAccount.profitTarget || ''} 
                        onChange={e => setEditingAccount({ ...editingAccount, profitTarget: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-white border border-emerald-300 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-rose-700 uppercase tracking-wider mb-1">
                        Drawdown Floor / Loss Limit ($)
                      </label>
                      <input 
                        type="number" 
                        step="any"
                        placeholder="e.g. 2500"
                        value={editingAccount.maxDrawdown || ''} 
                        onChange={e => setEditingAccount({ ...editingAccount, maxDrawdown: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-white border border-rose-300 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
                      />
                    </div>
                  </div>

                  {/* Adjustments (Payouts & Deposits) */}
                  <div className="pt-3 border-t border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                        <History className="w-3.5 h-3.5 text-[#ec3044]" /> Adjustments (Payouts & Deposits)
                      </label>
                      <span className="text-[9px] font-bold text-slate-400 uppercase">Audit Log</span>
                    </div>

                    <div className="grid grid-cols-12 gap-2 bg-white p-3 rounded-xl border border-slate-200">
                      <div className="col-span-3">
                        <select 
                          value={adjType} 
                          onChange={e => setAdjType(e.target.value as any)}
                          className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-900"
                        >
                          <option value="withdrawal">Withdrawal</option>
                          <option value="deposit">Deposit</option>
                        </select>
                      </div>

                      <div className="col-span-3">
                        <input 
                          type="number" 
                          step="any"
                          value={adjAmount}
                          onChange={e => setAdjAmount(e.target.value)}
                          placeholder="Amount $"
                          className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-900"
                        />
                      </div>

                      <div className="col-span-4">
                        <input 
                          type="date" 
                          value={adjDate}
                          onChange={e => setAdjDate(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-900"
                        />
                      </div>

                      <div className="col-span-2">
                        <button 
                          type="button"
                          onClick={handleAddAdjustment}
                          className="w-full h-full bg-[#ec3044] hover:bg-[#d4283b] text-white font-bold rounded-lg text-xs transition cursor-pointer"
                        >
                          + Log
                        </button>
                      </div>
                    </div>

                    <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                      {adjustments.length === 0 ? (
                        <p className="text-[10px] text-slate-400 italic text-center py-2">No adjustments logged yet for this account.</p>
                      ) : (
                        adjustments.map(adj => (
                          <div key={adj.id} className="flex items-center justify-between p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold shadow-xs">
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 rounded-md text-[9px] uppercase font-extrabold ${
                                adj.type === 'deposit' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                              }`}>
                                {adj.type}
                              </span>
                              <span className="font-mono text-slate-900 text-xs">
                                {adj.type === 'deposit' ? '+' : '-'}${Number(adj.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-semibold text-slate-400">{adj.date}</span>
                              <button 
                                type="button" 
                                onClick={() => handleDeleteAdjustment(adj.id)}
                                className="p-1 text-slate-300 hover:text-rose-500 transition cursor-pointer"
                                title="Delete Adjustment"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                    <button 
                      type="button" 
                      onClick={() => setEditingAccount(null)}
                      className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit" 
                      className="px-5 py-2 text-xs font-bold bg-[#ec3044] hover:bg-[#d4283b] text-white rounded-xl shadow-sm cursor-pointer"
                    >
                      Save Changes
                    </button>
                  </div>
                </form>
              ) : (
                <button 
                  onClick={() => window.dispatchEvent(new CustomEvent('open-add-account'))}
                  className="w-full py-3 bg-[#ec3044]/10 hover:bg-[#ec3044]/20 text-[#ec3044] font-bold rounded-xl text-xs transition flex items-center justify-center gap-2 cursor-pointer border border-[#ec3044]/25 shadow-xs"
                >
                  <UserPlus className="w-4 h-4" /> + Create New Account
                </button>
              )}

              {/* EXISTING ACCOUNTS LIST WITH DEDICATED DROPZONES */}
              <div className="space-y-6 pt-2">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider">Existing Accounts</h3>
                
                {Object.keys(groupedAccounts).length === 0 ? (
                  <p className="text-xs text-slate-400 italic text-center py-6">No accounts created yet.</p>
                ) : (
                  Object.entries(groupedAccounts).map(([groupName, groupAccs], groupIdx) => (
                    <div key={groupName} className="space-y-3">
                      {groupIdx > 0 && <hr className="border-t-2 border-[#ec3044] my-4" />}
                      
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-[#ec3044]"></span>
                          {groupName}
                        </span>
                        <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                          {groupAccs.length} account{groupAccs.length === 1 ? '' : 's'}
                        </span>
                      </div>

                      <div className="space-y-3">
                        {groupAccs.map(acc => {
                          const isDragTarget = dragOverAccountId === acc.id;

                          return (
                            <div key={acc.id} className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 shadow-xs">
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="font-bold text-slate-900 text-xs flex items-center gap-2">
                                    {acc.name}
                                    <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                                      acc.type === 'Live' ? 'bg-emerald-50 text-emerald-600' : acc.type === 'Funded' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'
                                    }`}>
                                      {acc.type}
                                    </span>
                                  </div>
                                  <div className="text-[10px] text-slate-600 font-semibold mt-0.5">
                                    {acc.firm ? `${acc.firm} • ` : ''}<span className="font-bold text-[#ec3044]">Tradovate</span> • <span className="font-mono font-bold text-slate-900">${acc.balance.toLocaleString()}</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1">
                                  <button 
                                    onClick={() => setEditingAccount(acc)}
                                    className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 rounded-lg transition cursor-pointer"
                                    title="Edit Account Details"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button 
                                    onClick={() => handleDeleteAccount(acc.id)}
                                    className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                    title="Delete Account"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>

                              {/* Target / Drawdown badges if configured */}
                              {(Boolean(acc.profitTarget) || Boolean(acc.maxDrawdown)) && (
                                <div className="flex gap-2 text-[10px] font-mono border-t border-slate-200/60 pt-1.5">
                                  {Boolean(acc.profitTarget) && (
                                    <span className="text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded font-bold">
                                      Target: +${Number(acc.profitTarget).toLocaleString()}
                                    </span>
                                  )}
                                  {Boolean(acc.maxDrawdown) && (
                                    <span className="text-rose-700 bg-rose-50 border border-rose-200/60 px-2 py-0.5 rounded font-bold">
                                      DD: -${Number(acc.maxDrawdown).toLocaleString()}
                                    </span>
                                  )}
                                </div>
                              )}

                              {/* DEDICATED TRADOVATE DRAG-AND-DROP ZONE */}
                              <div
                                onDragOver={(e) => { e.preventDefault(); setDragOverAccountId(acc.id!); }}
                                onDragLeave={() => setDragOverAccountId(null)}
                                onDrop={(e) => {
                                  e.preventDefault();
                                  setDragOverAccountId(null);
                                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                                    handleFileUpload(e.dataTransfer.files[0], acc);
                                  }
                                }}
                                className={`relative border-2 border-dashed rounded-xl p-3 text-center transition flex flex-col items-center justify-center cursor-pointer ${
                                  isDragTarget 
                                    ? 'border-[#ec3044] bg-[#ec3044]/10 ring-2 ring-[#ec3044]/20' 
                                    : 'border-slate-300 hover:border-[#ec3044]/60 bg-white hover:bg-slate-50/50'
                                }`}
                              >
                                <input 
                                  type="file" 
                                  accept=".csv"
                                  onChange={(e) => {
                                    if (e.target.files && e.target.files[0]) {
                                      handleFileUpload(e.target.files[0], acc);
                                    }
                                  }}
                                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                />
                                <div className="flex items-center gap-2 text-slate-700">
                                  <UploadCloud className="w-4 h-4 text-[#ec3044]" />
                                  <span className="text-xs font-bold">Drop <span className="text-[#ec3044]">Tradovate CSV</span> here</span>
                                </div>
                                <span className="text-[9px] text-slate-400 mt-0.5">Auto-replicates to all accounts in {groupName}</span>
                              </div>

                            </div>
                          );
                        })}
                      </div>

                    </div>
                  ))
                )}
              </div>

            </div>

            <div className="pt-4 border-t border-slate-100">
              <button 
                onClick={() => {
                  setIsAccountManagerOpen(false);
                  setEditingAccount(null);
                  setUploadStatus(null);
                }}
                className="w-full py-2.5 bg-slate-900 text-white font-bold rounded-xl text-xs shadow-sm cursor-pointer"
              >
                Close Manager
              </button>
            </div>

          </div>
        </div>
      )}

      <AccountModal />
    </>
  );
}