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
  LogOut
} from 'lucide-react';
import { cloudDb } from '@/lib/cloudDb';
import { TradingAccount } from '@/lib/db';
import AccountModal from '@/components/AccountModal';
import AddTradeModal from '@/components/AddTradeModal';

interface SidebarLayoutProps {
  children?: React.ReactNode;
  onOpenAddTrade?: () => void;
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

  // Balance Modification State inside Account Manager per account card
  const [modifyingAccountId, setModifyingAccountId] = useState<number | string | null>(null);
  const [modAmount, setModAmount] = useState('');
  const [modType, setModType] = useState<'deposit' | 'withdrawal'>('deposit');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isAccountManagerOpen) {
        setIsAccountManagerOpen(false);
        setEditingAccount(null);
        setModifyingAccountId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAccountManagerOpen]);

  const handleDeleteAccount = async (id?: number | string) => {
    if (!id) return;
    if (confirm('Are you sure you want to delete this account?')) {
      const { supabase } = await import('@/lib/supabase');
      await supabase.from('accounts').delete().eq('id', id);
      const data = await cloudDb.getAccounts();
      setAccounts(data);
    }
  };

  const handleUpdateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAccount || !editingAccount.id) return;

    const { supabase } = await import('@/lib/supabase');
    await supabase.from('accounts').update({
      name: editingAccount.name,
      group_name: editingAccount.groupName,
      type: editingAccount.type,
      firm: editingAccount.firm,
      balance: editingAccount.balance,
      input_type: editingAccount.inputType || 'Tradovate',
    }).eq('id', editingAccount.id);

    setEditingAccount(null);
    const data = await cloudDb.getAccounts();
    setAccounts(data);
  };

  const handleModifyBalance = async (e: React.FormEvent, acc: TradingAccount) => {
    e.preventDefault();
    const val = parseFloat(modAmount);
    if (isNaN(val) || val <= 0 || !acc.id) return;

    const adjustment = modType === 'deposit' ? val : -val;
    const newBalance = acc.balance + adjustment;

    const { supabase } = await import('@/lib/supabase');
    await supabase.from('accounts').update({
      balance: newBalance
    }).eq('id', acc.id);

    setModifyingAccountId(null);
    setModAmount('');
    const data = await cloudDb.getAccounts();
    setAccounts(data);
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
                className="w-full bg-slate-50 border border-slate-200 hover:bg-slate-100/80 p-2.5 rounded-xl flex items-center justify-between text-xs font-bold text-slate-700 transition cursor-pointer"
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
                      selectedAccount === 'All Accounts' ? 'text-[#ec3044] bg-[#ec3044]/5 font-bold' : 'text-slate-600'
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
                              className="text-[9px] font-bold text-slate-500 hover:text-[#ec3044] px-2 py-0.5 rounded bg-white border border-slate-200 transition cursor-pointer"
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
                                      selectedAccount === acc.name ? 'text-[#ec3044] font-bold' : 'text-slate-600'
                                    }`}
                                  >
                                    <div className="truncate">{acc.name}</div>
                                    <div className="text-[9px] text-slate-400">{acc.firm} • <span className="font-mono">${acc.balance.toLocaleString()}</span></div>
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
                      className="w-full text-center py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer"
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
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
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
            className={`w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition cursor-pointer ${
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

      {/* ACCOUNT MANAGER DRAWER SIDEBAR */}
      {isAccountManagerOpen && (
        <div 
          onClick={() => {
            setIsAccountManagerOpen(false);
            setEditingAccount(null);
            setModifyingAccountId(null);
          }}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex justify-end"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white h-full shadow-2xl p-6 flex flex-col justify-between animate-in slide-in-from-right duration-200"
          >
            
            <div className="space-y-6 overflow-y-auto flex-1 pr-1">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Account Manager</h2>
                  <p className="text-xs text-slate-400">Manage, edit, balance track, and delete accounts & groups</p>
                </div>
                <button 
                  onClick={() => {
                    setIsAccountManagerOpen(false);
                    setEditingAccount(null);
                    setModifyingAccountId(null);
                  }}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {editingAccount ? (
                <form onSubmit={handleUpdateAccount} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                  <h3 className="text-xs font-bold text-slate-900 uppercase">Edit Account</h3>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Account Name</label>
                    <input 
                      type="text" 
                      value={editingAccount.name} 
                      onChange={e => setEditingAccount({ ...editingAccount, name: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-semibold"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Account Group Name</label>
                    <input 
                      type="text" 
                      value={editingAccount.groupName} 
                      onChange={e => setEditingAccount({ ...editingAccount, groupName: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-semibold"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Type</label>
                      <select 
                        value={editingAccount.type} 
                        onChange={e => setEditingAccount({ ...editingAccount, type: e.target.value as any })}
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-semibold"
                      >
                        <option value="Live">Live</option>
                        <option value="Eval">Eval</option>
                        <option value="Funded">Funded</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Broker / Firm</label>
                      <input 
                        type="text" 
                        value={editingAccount.firm} 
                        onChange={e => setEditingAccount({ ...editingAccount, firm: e.target.value })}
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-semibold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Data Input Type (Statement Format)</label>
                    <select 
                      value={editingAccount.inputType || 'Tradovate'} 
                      onChange={e => setEditingAccount({ ...editingAccount, inputType: e.target.value as any })}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-semibold"
                      required
                    >
                      <option value="Tradovate">Tradovate</option>
                      <option value="AMP">AMP</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Account Size / Balance ($)</label>
                    <input 
                      type="number" 
                      value={editingAccount.balance} 
                      onChange={e => setEditingAccount({ ...editingAccount, balance: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-semibold"
                      required
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button 
                      type="button" 
                      onClick={() => setEditingAccount(null)}
                      className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-200 rounded-lg"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit" 
                      className="px-4 py-1.5 text-xs font-bold bg-[#ec3044] text-white rounded-lg shadow-sm"
                    >
                      Save Changes
                    </button>
                  </div>
                </form>
              ) : (
                <button 
                  onClick={() => window.dispatchEvent(new CustomEvent('open-add-account'))}
                  className="w-full py-3 bg-[#ec3044]/15 hover:bg-[#ec3044]/25 text-[#ec3044] font-bold rounded-xl text-xs transition flex items-center justify-center gap-2 cursor-pointer border border-[#ec3044]/25 shadow-sm"
                >
                  <UserPlus className="w-4 h-4" /> + Create New Account
                </button>
              )}

              <div className="space-y-6 pt-2">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Existing Accounts</h3>
                
                {Object.keys(groupedAccounts).length === 0 ? (
                  <p className="text-xs text-slate-400 italic text-center py-6">No accounts created yet.</p>
                ) : (
                  Object.entries(groupedAccounts).map(([groupName, groupAccs], groupIdx) => (
                    <div key={groupName} className="space-y-3">
                      {groupIdx > 0 && <hr className="border-t-2 border-[#ec3044] my-4" />}
                      
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-[#ec3044]"></span>
                          {groupName}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                          {groupAccs.length} account{groupAccs.length === 1 ? '' : 's'}
                        </span>
                      </div>

                      <div className="space-y-2">
                        {groupAccs.map(acc => {
                          const isModifying = modifyingAccountId === acc.id;

                          return (
                            <div key={acc.id} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3 shadow-xs">
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
                                  <div className="text-[10px] text-slate-500 mt-0.5">
                                    {acc.firm ? `${acc.firm} • ` : ''}<span className="font-bold text-[#ec3044]">{acc.inputType || 'Tradovate'}</span> • <span className="font-mono font-bold text-slate-900">${acc.balance.toLocaleString()}</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1">
                                  <button 
                                    onClick={() => setModifyingAccountId(isModifying ? null : acc.id)}
                                    className="px-2 py-1 bg-slate-200/80 hover:bg-slate-300 text-slate-700 font-bold rounded-lg text-[10px] transition cursor-pointer"
                                    title="Deposit or Withdrawal"
                                  >
                                    {isModifying ? 'Cancel' : '± Balance'}
                                  </button>
                                  <button 
                                    onClick={() => {
                                      setEditingAccount(acc);
                                      setModifyingAccountId(null);
                                    }}
                                    className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition cursor-pointer"
                                    title="Edit Account Details"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button 
                                    onClick={() => handleDeleteAccount(acc.id)}
                                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                    title="Delete Account"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>

                              {/* Inline Balance Modification Form (Deposit / Withdrawal) */}
                              {isModifying && (
                                <form onSubmit={(e) => handleModifyBalance(e, acc)} className="p-3 bg-white border border-slate-200 rounded-xl space-y-2">
                                  <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 uppercase">
                                    <span>Modify Balance</span>
                                    <div className="flex gap-1">
                                      <button
                                        type="button"
                                        onClick={() => setModType('deposit')}
                                        className={`px-2 py-0.5 rounded cursor-pointer ${modType === 'deposit' ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-600'}`}
                                      >
                                        Deposit (+)
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setModType('withdrawal')}
                                        className={`px-2 py-0.5 rounded cursor-pointer ${modType === 'withdrawal' ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-600'}`}
                                      >
                                        Withdrawal (-)
                                      </button>
                                    </div>
                                  </div>
                                  <div className="flex gap-2">
                                    <input 
                                      type="number" 
                                      step="any"
                                      value={modAmount} 
                                      onChange={e => setModAmount(e.target.value)}
                                      placeholder="Enter amount ($)"
                                      className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-900"
                                      required
                                      autoFocus
                                    />
                                    <button 
                                      type="submit"
                                      className="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-xs cursor-pointer"
                                    >
                                      Apply
                                    </button>
                                  </div>
                                </form>
                              )}
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
                  setModifyingAccountId(null);
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