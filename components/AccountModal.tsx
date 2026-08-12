'use client';

import React, { useState, useEffect } from 'react';
import { UserPlus, History, Trash2, Settings, Edit2 } from 'lucide-react';
import { cloudDb } from '@/lib/cloudDb';
import { db, TradingAccount } from '@/lib/db';

interface AccountAdjustment {
  id?: string | number;
  accountId: string | number;
  type: 'deposit' | 'withdrawal';
  amount: number;
  date: string;
  note?: string;
}

export default function AccountModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [editingAccount, setEditingAccount] = useState<TradingAccount | null>(null);

  // Form State for New or Editing Account
  const [name, setName] = useState('');
  const [groupName, setGroupName] = useState('Default Group');
  const [type, setType] = useState<'Live' | 'Eval' | 'Funded'>('Eval');
  const [firm, setFirm] = useState('');
  const [balance, setBalance] = useState('');
  const [inputType, setInputType] = useState<'Tradovate' | 'AMP'>('Tradovate');

  // Adjustments State
  const [adjustments, setAdjustments] = useState<AccountAdjustment[]>([]);
  const [adjType, setAdjType] = useState<'deposit' | 'withdrawal'>('withdrawal');
  const [adjAmount, setAdjAmount] = useState('');
  const [adjDate, setAdjDate] = useState(new Date().toISOString().split('T')[0]);

  const loadAccounts = async () => {
    const data = await cloudDb.getAccounts();
    setAccounts(data);
  };

  useEffect(() => {
    const handleOpen = () => {
      loadAccounts();
      setIsOpen(true);
      setEditingAccount(null);
      resetForm();
    };

    window.addEventListener('open-add-account', handleOpen);
    return () => window.removeEventListener('open-add-account', handleOpen);
  }, []);

  useEffect(() => {
    if (editingAccount) {
      setName(editingAccount.name || '');
      setGroupName(editingAccount.groupName || 'Default Group');
      setType(editingAccount.type || 'Eval');
      setFirm(editingAccount.firm || '');
      setBalance(editingAccount.balance ? String(editingAccount.balance) : '');
      setInputType(editingAccount.inputType || 'Tradovate');
      loadAdjustments(editingAccount.id);
    } else {
      setAdjustments([]);
    }
  }, [editingAccount]);

  const resetForm = () => {
    setName('');
    setGroupName('Default Group');
    setType('Eval');
    setFirm('');
    setBalance('');
    setInputType('Tradovate');
    setAdjAmount('');
  };

  const loadAdjustments = async (accId?: number | string) => {
    if (!accId) return;
    let loaded: AccountAdjustment[] = [];

    try {
      const { supabase } = await import('@/lib/supabase');
      const { data } = await supabase
        .from('account_adjustments')
        .select('*')
        .eq('account_id', accId)
        .order('date', { ascending: false });

      if (data && data.length > 0) {
        loaded = data.map(d => ({
          id: d.id,
          accountId: d.account_id,
          type: d.type === 'deposit' ? 'deposit' : 'withdrawal',
          amount: Number(d.amount),
          date: d.date,
        }));
      }
    } catch (err) {}

    if (loaded.length === 0) {
      try {
        if ((db as any).adjustments) {
          const local = await (db as any).adjustments
            .where('accountId')
            .equals(Number(accId))
            .toArray();
          if (local && local.length > 0) loaded = local;
        }
      } catch (err) {}
    }

    setAdjustments(loaded);
  };

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    const numericBalance = parseFloat(balance) || 0;

    if (editingAccount && editingAccount.id) {
      // UPDATE EXISTING ACCOUNT
      const updatedAcc = {
        ...editingAccount,
        id: Number(editingAccount.id),
        name,
        groupName,
        type,
        firm,
        balance: numericBalance,
        inputType
      };

      try {
        if (db.accounts) await db.accounts.put(updatedAcc);
      } catch (err) {}

      try {
        const { supabase } = await import('@/lib/supabase');
        await supabase.from('accounts').update({
          name,
          group_name: groupName,
          type,
          firm,
          balance: numericBalance,
          input_type: inputType
        }).eq('id', editingAccount.id);
      } catch (err) {}

    } else {
      // CREATE NEW ACCOUNT
      const newAcc = {
        id: Date.now(),
        name,
        groupName,
        type,
        firm,
        balance: numericBalance,
        inputType
      };

      try {
        if (db.accounts) await db.accounts.add(newAcc as any);
      } catch (err) {}

      try {
        const { supabase } = await import('@/lib/supabase');
        await supabase.from('accounts').insert({
          name,
          group_name: groupName,
          type,
          firm,
          balance: numericBalance,
          input_type: inputType
        });
      } catch (err) {}
    }

    await loadAccounts();
    window.dispatchEvent(new CustomEvent('account-filter-changed'));
    setEditingAccount(null);
    resetForm();
  };

  const handleAddAdjustment = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const parsedAmount = parseFloat(adjAmount);
    if (!editingAccount?.id || isNaN(parsedAmount) || parsedAmount <= 0) return;

    const newAdj: AccountAdjustment = {
      id: Date.now(),
      accountId: Number(editingAccount.id),
      type: adjType,
      amount: parsedAmount,
      date: adjDate
    };

    setAdjustments(prev => [newAdj, ...prev]);
    setAdjAmount('');

    try {
      if ((db as any).adjustments) {
        await (db as any).adjustments.put({
          id: newAdj.id,
          accountId: newAdj.accountId,
          type: newAdj.type,
          amount: newAdj.amount,
          date: newAdj.date
        });
      }
    } catch (err) {}

    try {
      const { supabase } = await import('@/lib/supabase');
      await supabase.from('account_adjustments').insert({
        account_id: editingAccount.id,
        type: adjType,
        amount: parsedAmount,
        date: adjDate
      });
    } catch (err) {}

    window.dispatchEvent(new CustomEvent('account-filter-changed'));
  };

  const handleDeleteAdjustment = async (adjId?: number | string) => {
    if (!adjId) return;

    setAdjustments(prev => prev.filter(a => a.id !== adjId));

    try {
      if ((db as any).adjustments) await (db as any).adjustments.delete(Number(adjId));
    } catch (err) {}

    try {
      const { supabase } = await import('@/lib/supabase');
      await supabase.from('account_adjustments').delete().eq('id', adjId);
    } catch (err) {}

    window.dispatchEvent(new CustomEvent('account-filter-changed'));
  };

  const handleDeleteAccount = async (id?: number | string) => {
    if (!id || !confirm('Are you sure you want to delete this account?')) return;

    try {
      if (db.accounts) await db.accounts.delete(Number(id));
    } catch (err) {}

    try {
      const { supabase } = await import('@/lib/supabase');
      await supabase.from('accounts').delete().eq('id', id);
    } catch (err) {}

    await loadAccounts();
    if (editingAccount?.id === id) {
      setEditingAccount(null);
      resetForm();
    }
    window.dispatchEvent(new CustomEvent('account-filter-changed'));
  };

  if (!isOpen) return null;

  const existingGroups = Array.from(new Set(accounts.map(a => a.groupName).filter(Boolean)));
  const existingFirms = Array.from(new Set(accounts.map(a => a.firm).filter(Boolean)));

  return (
    <div 
      onClick={() => setIsOpen(false)}
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
              <p className="text-xs text-slate-500 font-medium">Manage accounts, update balances, and log payouts/deposits</p>
            </div>
            <button 
              onClick={() => setIsOpen(false)}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
            >
              ✕
            </button>
          </div>

          {/* EDIT OR CREATE FORM */}
          <form onSubmit={handleSaveAccount} className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                {editingAccount ? 'Edit Account Details' : 'Create New Account'}
              </h3>
              {editingAccount && <span className="text-[10px] font-bold text-slate-400 font-mono">ID: {editingAccount.id}</span>}
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-700 uppercase tracking-wider mb-1">Account Name</label>
              <input 
                type="text" 
                value={name} 
                onChange={e => setName(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#ec3044]"
                placeholder="e.g. 001"
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-700 uppercase tracking-wider mb-1">Account Group Name</label>
              <input 
                type="text" 
                list="modal-group-list"
                value={groupName} 
                onChange={e => setGroupName(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#ec3044]"
                placeholder="Select or enter group (e.g. Lucid)"
                required
              />
              <datalist id="modal-group-list">
                {existingGroups.map(g => <option key={g} value={g} />)}
              </datalist>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-black text-slate-700 uppercase tracking-wider mb-1">Type</label>
                <select 
                  value={type} 
                  onChange={e => setType(e.target.value as any)}
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
                  list="modal-firm-list"
                  value={firm} 
                  onChange={e => setFirm(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#ec3044]"
                  placeholder="Select or enter firm (e.g. Lucid Trading)"
                />
                <datalist id="modal-firm-list">
                  {existingFirms.map(f => <option key={f} value={f} />)}
                </datalist>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-700 uppercase tracking-wider mb-1">Data Input Type</label>
              <select 
                value={inputType} 
                onChange={e => setInputType(e.target.value as any)}
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
                value={balance} 
                onChange={e => setBalance(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#ec3044]"
                placeholder="100000"
                required
              />
            </div>

            {/* LOG ADJUSTMENTS SECTION (WHEN EDITING) */}
            {editingAccount && (
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

                <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                  {adjustments.length === 0 ? (
                    <p className="text-[10px] text-slate-400 italic text-center py-2">No adjustments logged yet.</p>
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
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              {editingAccount && (
                <button 
                  type="button" 
                  onClick={() => {
                    setEditingAccount(null);
                    resetForm();
                  }}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl cursor-pointer"
                >
                  Cancel Edit
                </button>
              )}
              <button 
                type="submit" 
                className="px-5 py-2 text-xs font-bold bg-[#ec3044] hover:bg-[#d4283b] text-white rounded-xl shadow-sm cursor-pointer"
              >
                Save Changes
              </button>
            </div>
          </form>

          {/* EXISTING ACCOUNTS LIST */}
          <div className="space-y-4 pt-2">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider">Existing Accounts</h3>
            {accounts.length === 0 ? (
              <p className="text-xs text-slate-400 italic text-center py-4">No accounts created yet.</p>
            ) : (
              accounts.map(acc => (
                <div key={acc.id} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between shadow-xs">
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
                      {acc.groupName} • {acc.firm ? `${acc.firm} • ` : ''}<span className="font-bold text-[#ec3044]">{acc.inputType || 'Tradovate'}</span> • <span className="font-mono font-bold text-slate-900">${acc.balance.toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => setEditingAccount(acc)}
                      className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 rounded-lg transition cursor-pointer"
                      title="Edit Account Details & Log Adjustments"
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
              ))
            )}
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100">
          <button 
            onClick={() => setIsOpen(false)}
            className="w-full py-2.5 bg-slate-900 text-white font-bold rounded-xl text-xs shadow-sm cursor-pointer"
          >
            Close Manager
          </button>
        </div>
      </div>
    </div>
  );
}