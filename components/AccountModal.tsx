'use client';

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { X, Wallet, Trash2 } from 'lucide-react';

export default function AccountModal() {
  const [isOpen, setIsOpen] = useState(false);
  const accounts = useLiveQuery(() => db.accounts.toArray()) || [];

  const existingGroups = Array.from(new Set(accounts.map(a => a.groupName).filter(Boolean)));

  const [name, setName] = useState('');
  const [groupName, setGroupName] = useState('');
  const [isCreatingNewGroup, setIsCreatingNewGroup] = useState(false);
  const [newGroupNameInput, setNewGroupNameInput] = useState('');
  
  const [type, setType] = useState<'' | 'Eval' | 'Funded' | 'Live'>('');
  const [firm, setFirm] = useState('');
  const [balance, setBalance] = useState('');
  const [inputType, setInputType] = useState<'Tradovate' | 'AMP'>('Tradovate');

  useEffect(() => {
    const handleOpen = () => {
      setIsOpen(true);
      setName('');
      setGroupName(existingGroups[0] || '');
      setIsCreatingNewGroup(false);
      setNewGroupNameInput('');
      setType('');
      setFirm('');
      setBalance('');
      setInputType('Tradovate');
    };
    window.addEventListener('open-add-account', handleOpen);
    return () => window.removeEventListener('open-add-account', handleOpen);
  }, [accounts]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetGroup = isCreatingNewGroup ? newGroupNameInput.trim() : groupName;
    if (!name.trim() || !targetGroup || !type) return;

    await db.accounts.add({
      name: name.trim(),
      groupName: targetGroup,
      type,
      firm: firm.trim(),
      balance: parseFloat(balance) || 0,
      inputType
    });

    setIsOpen(false);
    window.dispatchEvent(new CustomEvent('account-list-updated'));
  };

  const handleDeleteGroup = async (groupToDelete: string) => {
    if (confirm(`Are you sure you want to delete group "${groupToDelete}" and all its accounts?`)) {
      const accountsToDelete = accounts.filter(a => a.groupName === groupToDelete);
      for (const acc of accountsToDelete) {
        if (acc.id) await db.accounts.delete(acc.id);
      }
      if (groupName === groupToDelete) {
        setGroupName('');
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-[#ec3044]/10 rounded-lg flex items-center justify-center text-[#ec3044]">
              <Wallet className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-slate-900">Create New Account</h2>
          </div>
          <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          
          {/* Account Name */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Account Name</label>
            <input 
              type="text" 
              value={name} 
              onChange={e => setName(e.target.value)} 
              placeholder=""
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#ec3044]"
              required
            />
          </div>

          {/* Account Group */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-xs font-bold text-slate-700 uppercase">Account Group</label>
              <button 
                type="button" 
                onClick={() => setIsCreatingNewGroup(!isCreatingNewGroup)}
                className="text-[10px] font-bold text-[#ec3044] hover:underline cursor-pointer"
              >
                {isCreatingNewGroup ? 'Select Existing Group' : '+ Create New Group'}
              </button>
            </div>

            {isCreatingNewGroup ? (
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={newGroupNameInput} 
                  onChange={e => setNewGroupNameInput(e.target.value)} 
                  placeholder=""
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#ec3044]"
                  required
                />
              </div>
            ) : (
              <div className="flex gap-2 items-center">
                <select 
                  value={groupName} 
                  onChange={e => setGroupName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#ec3044]"
                  required
                >
                  <option value="">Select...</option>
                  {existingGroups.map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>

                {groupName && (
                  <button 
                    type="button" 
                    onClick={() => handleDeleteGroup(groupName)}
                    className="p-2 text-slate-400 hover:text-rose-600 bg-slate-50 border border-slate-200 rounded-xl transition cursor-pointer"
                    title="Delete Group"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Account Type & Broker / Firm */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Account Type</label>
              <select 
                value={type} 
                onChange={e => setType(e.target.value as any)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#ec3044]"
                required
              >
                <option value="">Select</option>
                <option value="Eval">Eval</option>
                <option value="Funded">Funded</option>
                <option value="Live">Live</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Broker / Firm</label>
              <input 
                type="text" 
                value={firm} 
                onChange={e => setFirm(e.target.value)} 
                placeholder=""
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#ec3044]"
              />
            </div>
          </div>

          {/* Account Data Input Type Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Data Input Type (Statement Format)</label>
            <select 
              value={inputType} 
              onChange={e => setInputType(e.target.value as any)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#ec3044]"
              required
            >
              <option value="Tradovate">Tradovate</option>
              <option value="AMP">AMP</option>
            </select>
            <p className="text-[10px] text-slate-400 mt-1">Tradovate accounts only accept Tradovate CSVs. AMP accounts only accept AMP statement files.</p>
          </div>

          {/* Account Size / Balance */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Account Size / Balance ($)</label>
            <input 
              type="number" 
              value={balance} 
              onChange={e => setBalance(e.target.value)} 
              placeholder=""
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#ec3044]"
              required
            />
          </div>

          {/* Form Actions */}
          <div className="pt-2 flex justify-end gap-3">
            <button 
              type="button" 
              onClick={() => setIsOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 cursor-pointer"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="bg-[#ec3044] hover:bg-[#d4283b] text-white font-bold px-6 py-2 rounded-xl text-xs shadow-sm transition cursor-pointer"
            >
              Create Account
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}