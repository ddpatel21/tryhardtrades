'use client';

import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { Layers, ChevronDown, Check } from 'lucide-react';

export default function AccountFilterDropdown() {
  const accounts = useLiveQuery(() => db.accounts.toArray()) || [];
  const [isOpen, setIsOpen] = useState(false);

  // Group accounts by groupName
  const groupMap: Record<string, typeof accounts> = {};
  accounts.forEach(acc => {
    const g = acc.groupName || 'Default Group';
    if (!groupMap[g]) groupMap[g] = [];
    groupMap[g].push(acc);
  });

  const groupNames = Object.keys(groupMap);

  // Selected filter states
  const [selectedAccountNames, setSelectedAccountNames] = useState<string[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);

  // Initialize all accounts selected by default if none selected yet
  useEffect(() => {
    if (accounts.length > 0 && selectedAccountNames.length === 0 && selectedGroups.length === 0) {
      setSelectedAccountNames(accounts.map(a => a.name));
      setSelectedGroups(groupNames);
    }
  }, [accounts]);

  const handleToggleGroup = (groupName: string) => {
    const groupAccounts = groupMap[groupName] || [];
    const groupAccountNames = groupAccounts.map(a => a.name);

    if (selectedGroups.includes(groupName)) {
      // Uncheck group and its accounts
      const nextGroups = selectedGroups.filter(g => g !== groupName);
      const nextAccounts = selectedAccountNames.filter(name => !groupAccountNames.includes(name));
      setSelectedGroups(nextGroups);
      setSelectedAccountNames(nextAccounts);
      dispatchFilterUpdate(nextAccounts);
    } else {
      // Check group and check off all its accounts
      const nextGroups = [...selectedGroups, groupName];
      const nextAccounts = Array.from(new Set([...selectedAccountNames, ...groupAccountNames]));
      setSelectedGroups(nextGroups);
      setSelectedAccountNames(nextAccounts);
      dispatchFilterUpdate(nextAccounts);
    }
  };

  const handleToggleAccount = (accName: string, groupName: string) => {
    let nextAccounts = [...selectedAccountNames];
    if (nextAccounts.includes(accName)) {
      nextAccounts = nextAccounts.filter(n => n !== accName);
    } else {
      nextAccounts.push(accName);
    }
    setSelectedAccountNames(nextAccounts);

    // Check if all accounts in group are now checked/unchecked to update group checkbox state
    const groupAccounts = groupMap[groupName] || [];
    const allChecked = groupAccounts.every(a => nextAccounts.includes(a.name));
    if (allChecked && !selectedGroups.includes(groupName)) {
      setSelectedGroups([...selectedGroups, groupName]);
    } else if (!allChecked && selectedGroups.includes(groupName)) {
      setSelectedGroups(selectedGroups.filter(g => g !== groupName));
    }

    dispatchFilterUpdate(nextAccounts);
  };

  const dispatchFilterUpdate = (accountList: string[]) => {
    window.dispatchEvent(new CustomEvent('account-filter-updated', { detail: accountList }));
  };

  const labelText = selectedAccountNames.length === accounts.length || accounts.length === 0 
    ? 'All Accounts' 
    : `${selectedAccountNames.length} Account(s) Selected`;

  return (
    <div className="relative inline-block text-left">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="bg-white border border-slate-200 hover:bg-slate-50 px-3.5 py-2 rounded-xl flex items-center gap-2 text-xs font-bold text-slate-700 shadow-sm transition cursor-pointer"
      >
        <Layers className="w-4 h-4 text-[#ec3044]" />
        <span>{labelText}</span>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-white border border-slate-200 rounded-2xl shadow-xl py-2 z-50 space-y-3">
          <div className="px-4 py-1.5 border-b border-slate-100 flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Filter Accounts & Groups</span>
            <button 
              onClick={() => {
                const allNames = accounts.map(a => a.name);
                setSelectedAccountNames(allNames);
                setSelectedGroups(groupNames);
                dispatchFilterUpdate(allNames);
              }}
              className="text-[10px] text-[#ec3044] font-bold hover:underline cursor-pointer"
            >
              Select All
            </button>
          </div>

          <div className="max-h-64 overflow-y-auto px-2 space-y-3">
            {groupNames.length === 0 ? (
              <div className="py-4 text-center text-xs text-slate-400 italic">No accounts or groups created.</div>
            ) : (
              groupNames.map(groupName => {
                const isGroupChecked = selectedGroups.includes(groupName);
                const groupAccs = groupMap[groupName] || [];

                return (
                  <div key={groupName} className="space-y-1 bg-slate-50/60 p-2 rounded-xl border border-slate-100">
                    {/* Group Checkbox Header */}
                    <label className="flex items-center gap-2.5 text-xs font-bold text-slate-800 cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        checked={isGroupChecked}
                        onChange={() => handleToggleGroup(groupName)}
                        className="rounded border-slate-300 text-[#ec3044] focus:ring-[#ec3044] w-4 h-4"
                      />
                      <span>{groupName}</span>
                    </label>

                    {/* Nested Individual Account Checkboxes */}
                    <div className="pl-6 space-y-1 pt-1">
                      {groupAccs.map(acc => {
                        const isAccChecked = selectedAccountNames.includes(acc.name);
                        return (
                          <label key={acc.id} className="flex items-center gap-2 text-xs font-medium text-slate-600 cursor-pointer select-none">
                            <input 
                              type="checkbox" 
                              checked={isAccChecked}
                              onChange={() => handleToggleAccount(acc.name, groupName)}
                              className="rounded border-slate-300 text-[#ec3044] focus:ring-[#ec3044] w-3.5 h-3.5"
                            />
                            <span className="truncate">{acc.name} <span className="text-[10px] text-slate-400">({acc.type})</span></span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="border-t border-slate-100 pt-2 px-3 flex justify-end">
            <button 
              onClick={() => setIsOpen(false)}
              className="px-3 py-1.5 bg-[#ec3044] text-white rounded-lg text-xs font-bold shadow-sm cursor-pointer"
            >
              Apply Filter
            </button>
          </div>
        </div>
      )}
    </div>
  );
}