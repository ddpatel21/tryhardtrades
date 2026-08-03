'use client';

import React, { useState, useEffect, useRef } from 'react';
import { db, syncTagToMasterTables } from '@/lib/db';
import { cloudDb } from '@/lib/cloudDb';
import { useLiveQuery } from 'dexie-react-hooks';
import { X, Upload, Plus, Sparkles, FileSpreadsheet, AlertCircle } from 'lucide-react';
import * as XLSX from 'xlsx';

interface AddTradeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SYMBOL_OPTIONS = [
  { value: 'MES', label: 'MES ($5/pt)', tickSize: 0.25, tickValue: 1.25, multiplier: 5 },
  { value: 'ES', label: 'ES ($50/pt)', tickSize: 0.25, tickValue: 12.50, multiplier: 50 },
  { value: 'MNQ', label: 'MNQ ($2/pt)', tickSize: 0.25, tickValue: 0.50, multiplier: 2 },
  { value: 'NQ', label: 'NQ ($20/pt)', tickSize: 0.25, tickValue: 5.00, multiplier: 20 },
];

const getContractSpecs = (symbolStr: string) => {
  const sym = symbolStr.toUpperCase();
  const matched = SYMBOL_OPTIONS.find(opt => sym.includes(opt.value));
  if (matched) return matched;
  return { value: 'MES', label: 'MES ($5/pt)', tickSize: 0.25, tickValue: 1.25, multiplier: 5 };
};

export default function AddTradeModal({ isOpen, onClose }: AddTradeModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form States
  const [symbol, setSymbol] = useState('MES');
  const [openDate, setOpenDate] = useState('');
  const [side, setSide] = useState<'LONG' | 'SHORT'>('LONG');
  const [contractsTraded, setContractsTraded] = useState('1');
  const [entryPrice, setEntryPrice] = useState('');
  const [exitPrice, setExitPrice] = useState('');
  const [entryTime, setEntryTime] = useState('');
  const [exitTime, setExitTime] = useState('');
  const [commissions, setCommissions] = useState('2.50');

  // Account Selection
  const [selectedAccountName, setSelectedAccountName] = useState('');
  const [accounts, setAccounts] = useState<any[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  // Targets & Tags
  const [profitTargetTicks, setProfitTargetTicks] = useState('');
  const [stopLossTicks, setStopLossTicks] = useState('');
  const [selectedStrategy, setSelectedStrategy] = useState('');
  const [selectedSetup, setSelectedSetup] = useState('');
  const [selectedMistake, setSelectedMistake] = useState('');
  const [tradeRating, setTradeRating] = useState(5);
  const [notes, setNotes] = useState('');

  // Quick Tag Creation
  const [newTagInput, setNewTagInput] = useState('');
  const [activeNewTagType, setActiveNewTagType] = useState<'strategy' | 'setup' | 'mistake' | null>(null);

  // Database Queries
  const strategies = useLiveQuery(() => db.strategies.toArray()) || [];
  const setups = useLiveQuery(() => db.setups.toArray()) || [];
  const mistakes = useLiveQuery(() => db.mistakes.toArray()) || [];

  // Fetch accounts from cloud on open
  useEffect(() => {
    async function fetchAccounts() {
      const accs = await cloudDb.getAccounts();
      setAccounts(accs);
      if (accs.length > 0 && !selectedAccountName) {
        setSelectedAccountName(accs[0].name);
      }
    }
    if (isOpen) {
      fetchAccounts();
    }
  }, [isOpen]);

  // Auto-select first account if available
  useEffect(() => {
    if (accounts.length > 0 && !selectedAccountName) {
      setSelectedAccountName(accounts[0].name);
    }
  }, [accounts]);

  // Reset All Form Fields
  const resetForm = () => {
    setSymbol('MES');
    setOpenDate('');
    setSide('LONG');
    setContractsTraded('1');
    setEntryPrice('');
    setExitPrice('');
    setEntryTime('');
    setExitTime('');
    setCommissions('2.50');
    setProfitTargetTicks('');
    setStopLossTicks('');
    setSelectedStrategy('');
    setSelectedSetup('');
    setSelectedMistake('');
    setTradeRating(5);
    setNotes('');
    setNewTagInput('');
    setActiveNewTagType(null);
    setUploadError(null);
    setUploadSuccess(null);
    if (accounts.length > 0) setSelectedAccountName(accounts[0].name);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  useEffect(() => {
    if (isOpen) {
      resetForm();
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const selectedAccount = accounts.find(a => a.name === selectedAccountName);

  // Validation: Check if prices are filled in
  const hasPrices = entryPrice.trim() !== '' && exitPrice.trim() !== '';

  const entP = parseFloat(entryPrice) || 0;
  const extP = parseFloat(exitPrice) || 0;
  const qty = parseFloat(contractsTraded) || 1;
  const specs = getContractSpecs(symbol);

  const points = hasPrices ? (side === 'LONG' ? extP - entP : entP - extP) : 0;
  const totalTicks = hasPrices && specs.tickSize > 0 ? points / specs.tickSize : 0;
  const calcGrossPnL = hasPrices ? points * qty * specs.multiplier : 0;
  const calcNetPnL = hasPrices ? calcGrossPnL - (parseFloat(commissions) || 0) : 0;

  const ptTicks = parseFloat(profitTargetTicks) || 0;
  const slTicks = parseFloat(stopLossTicks) || 0;

  const initialTargetDollars = ptTicks * specs.tickValue * qty;
  const tradeRiskDollars = slTicks * specs.tickValue * qty;

  const plannedR = tradeRiskDollars > 0 ? initialTargetDollars / tradeRiskDollars : 0;
  const realizedR = hasPrices && tradeRiskDollars > 0 ? calcGrossPnL / tradeRiskDollars : 0;

  const handleCreateNewTag = async (type: 'strategy' | 'setup' | 'mistake') => {
    if (!newTagInput.trim()) return;
    const name = newTagInput.trim();

    if (type === 'strategy') {
      await db.strategies.put({ name });
      setSelectedStrategy(name);
    } else if (type === 'setup') {
      await db.setups.put({ name });
      setSelectedSetup(name);
    } else if (type === 'mistake') {
      await db.mistakes.put({ name });
      setSelectedMistake(name);
    }

    setNewTagInput('');
    setActiveNewTagType(null);
  };

  // Automated Statement File Parser supporting Tradovate CSV & AMP Excel with Cloud Sync
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedAccount) return;

    setUploadError(null);
    setUploadSuccess(null);

    const fileName = file.name.toLowerCase();
    const isCsv = fileName.endsWith('.csv');
    const isXlsx = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');

    // Strict Input Type Enforcement
    if (selectedAccount.inputType === 'Tradovate' && !isCsv) {
      setUploadError(`Account "${selectedAccount.name}" is configured for Tradovate data input. Please upload a Tradovate CSV file.`);
      return;
    }
    if (selectedAccount.inputType === 'AMP' && !isXlsx && !isCsv) {
      setUploadError(`Account "${selectedAccount.name}" is configured for AMP data input. Please upload an AMP Excel (.xlsx) file.`);
      return;
    }

    try {
      const textContent = await file.text();

      if (selectedAccount.inputType === 'Tradovate') {
        const lines = textContent.split('\n').filter(l => l.trim() !== '');
        if (lines.length < 2) throw new Error('Tradovate CSV file is empty or formatted incorrectly.');

        const headers = lines[0].split(',').map(h => h.trim());
        let importedCount = 0;

        for (let i = 1; i < lines.length; i++) {
          const row = lines[i].split(',').map(v => v.trim());
          if (row.length < headers.length) continue;

          const rowObj: Record<string, string> = {};
          headers.forEach((h, idx) => { rowObj[h] = row[idx]; });

          const symbolStr = rowObj['symbol'] || 'MES';
          const qtyVal = parseFloat(rowObj['qty']) || 1;
          const buyPrice = parseFloat(rowObj['buyPrice']) || 0;
          const sellPrice = parseFloat(rowObj['sellPrice']) || 0;
          const rawPnL = rowObj['pnl'] ? rowObj['pnl'].replace('$', '').replace(',', '') : '0';
          const netPnL = parseFloat(rawPnL) || 0;

          const boughtTs = rowObj['boughtTimestamp'] || '';
          const soldTs = rowObj['soldTimestamp'] || '';

          let formattedDate = new Date().toISOString().split('T')[0];
          let entryTimeStr = '';
          let exitTimeStr = '';

          const sideVal = buyPrice < sellPrice ? 'LONG' : 'SHORT';

          if (boughtTs && soldTs) {
            const [bDate, bTime] = boughtTs.split(' ');
            const [sDate, sTime] = soldTs.split(' ');

            if (bDate && bDate.includes('/')) {
              const parts = bDate.split('/');
              if (parts.length === 3) {
                formattedDate = `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
              }
            }

            if (sideVal === 'LONG') {
              entryTimeStr = bTime || '';
              exitTimeStr = sTime || '';
            } else {
              entryTimeStr = sTime || '';
              exitTimeStr = bTime || '';
            }
          }

          const entryP = sideVal === 'LONG' ? buyPrice : sellPrice;
          const exitP = sideVal === 'LONG' ? sellPrice : buyPrice;
          const matchedOpt = SYMBOL_OPTIONS.find(opt => symbolStr.toUpperCase().includes(opt.value))?.value || 'MES';

          await cloudDb.addTrade({
            symbol: matchedOpt,
            openDate: formattedDate,
            side: sideVal,
            contractsTraded: qtyVal,
            entryPrice: entryP,
            exitPrice: exitP,
            entryTime: entryTimeStr,
            exitTime: exitTimeStr,
            netPnL,
            grossPnL: netPnL,
            commissions: 2.50,
            points: Math.abs(exitP - entryP),
            ticks: Math.abs(exitP - entryP) / 0.25,
            ticksPerContract: (Math.abs(exitP - entryP) / 0.25) / qtyVal,
            status: netPnL >= 0 ? 'WIN' : 'LOSS',
            account: selectedAccount.name,
            accountGroup: selectedAccount.groupName
          });

          importedCount++;
        }

        setUploadSuccess(`Successfully imported ${importedCount} Tradovate trade(s) to cloud for "${selectedAccount.name}".`);
      } 
      else if (selectedAccount.inputType === 'AMP') {
        const dataBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(dataBuffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });

        let headerRowIdx = -1;
        let headers: string[] = [];

        for (let r = 0; r < jsonData.length; r++) {
          const row = jsonData[r];
          if (row && row.some((cell: any) => String(cell).includes('Symbol')) && row.some((cell: any) => String(cell).includes('Avg Fill P'))) {
            headerRowIdx = r;
            headers = row.map((c: any) => String(c).trim());
            break;
          }
        }

        if (headerRowIdx === -1) {
          throw new Error('Could not detect AMP statement header row in uploaded file.');
        }

        const symIdx = headers.indexOf('Symbol');
        const priceIdx = headers.indexOf('Avg Fill P');
        const bsIdx = headers.indexOf('B/S');
        const qtyIdx = headers.indexOf('Qty');

        let importedCount = 0;
        for (let r = headerRowIdx + 1; r < jsonData.length; r += 2) {
          const row1 = jsonData[r];
          const row2 = jsonData[r + 1];
          if (!row1 || !row2 || !row1[symIdx]) break;

          const symbolStr = String(row1[symIdx] || 'MES');
          const p1 = parseFloat(String(row1[priceIdx])) || 0;
          const p2 = parseFloat(String(row2[priceIdx])) || 0;
          const qVal = parseFloat(String(row1[qtyIdx])) || 1;
          const sideVal = String(row1[bsIdx]) === 'BUY' ? 'LONG' : 'SHORT';

          const entryP = sideVal === 'LONG' ? Math.min(p1, p2) : Math.max(p1, p2);
          const exitP = sideVal === 'LONG' ? Math.max(p1, p2) : Math.min(p1, p2);
          const specsObj = getContractSpecs(symbolStr);
          const grossPnL = Math.abs(exitP - entryP) * qVal * specsObj.multiplier;
          const netPnL = grossPnL - 2.50;
          const todayDate = new Date().toISOString().split('T')[0];

          await cloudDb.addTrade({
            symbol: specsObj.value,
            openDate: todayDate,
            side: sideVal,
            contractsTraded: qVal,
            entryPrice: entryP,
            exitPrice: exitP,
            netPnL,
            grossPnL,
            commissions: 2.50,
            points: Math.abs(exitP - entryP),
            ticks: Math.abs(exitP - entryP) / specsObj.tickSize,
            ticksPerContract: (Math.abs(exitP - entryP) / specsObj.tickSize) / qVal,
            status: netPnL >= 0 ? 'WIN' : 'LOSS',
            account: selectedAccount.name,
            accountGroup: selectedAccount.groupName
          });

          importedCount++;
        }

        setUploadSuccess(`Successfully imported ${Math.max(importedCount, 1)} AMP trade(s) to cloud for "${selectedAccount.name}".`);
      }

      setTimeout(() => {
        onClose();
        window.location.href = '/';
      }, 1500);

    } catch (err: any) {
      console.error(err);
      setUploadError(err.message || 'Error parsing statement file.');
    }
  };

  const handleSaveTrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccount) {
      setUploadError('Please select a valid trading account.');
      return;
    }

    const tradeStatus: 'WIN' | 'LOSS' | 'BE' = calcNetPnL > 0 ? 'WIN' : calcNetPnL < 0 ? 'LOSS' : 'BE';

    await cloudDb.addTrade({
      symbol,
      openDate: openDate || new Date().toISOString().split('T')[0],
      side,
      contractsTraded: qty,
      entryPrice: entP,
      exitPrice: extP,
      netPnL: calcNetPnL,
      grossPnL: calcGrossPnL,
      commissions: parseFloat(commissions) || 0,
      points,
      ticks: totalTicks,
      ticksPerContract: qty > 0 ? totalTicks / qty : 0,
      strategy: selectedStrategy,
      zellaScale: 90,
      priceMaeMfe: '0.00 / 0.00',
      tradeRating,
      profitTargetTicks: ptTicks,
      stopLossTicks: slTicks,
      initialTargetDollars,
      tradeRiskDollars,
      plannedRMultiple: plannedR,
      realizedRMultiple: realizedR,
      entryTime,
      exitTime,
      bestExitPrice: extP,
      bestExitTime: exitTime,
      setupTag: selectedSetup,
      mistakeTag: selectedMistake,
      notes,
      status: tradeStatus,
      account: selectedAccount.name,
      accountGroup: selectedAccount.groupName
    });

    await syncTagToMasterTables(selectedStrategy, selectedSetup, selectedMistake);
    resetForm();
    onClose();
    window.location.href = '/';
  };

  const inputClass = "w-full border border-slate-200 bg-slate-50/50 rounded-xl p-2.5 text-xs text-[#ec3044] font-bold focus:outline-none focus:ring-2 focus:ring-[#ec3044] focus:bg-white transition";

  return (
    <div 
      onClick={onClose}
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto"
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="bg-white border border-slate-200 rounded-3xl w-full max-w-3xl p-7 shadow-2xl my-8 text-slate-800 font-sans"
      >
        
        {/* Header */}
        <div className="flex justify-between items-start mb-6 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Log Trade & Automated Parameters (Cloud Synced)</h2>
            <p className="text-xs text-slate-400">Computer handles metrics; user inputs Strategy, Rating, and Notes</p>
          </div>

          <div className="flex items-center gap-2">
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
              accept=".xlsx,.csv,.xls" 
              className="hidden" 
            />
            <button
              type="button"
              onClick={() => {
                if (!selectedAccount) {
                  setUploadError('Please select a trading account first before uploading statements.');
                  return;
                }
                fileInputRef.current?.click();
              }}
              className="flex items-center gap-2 bg-[#ec3044] hover:bg-[#d4283b] text-white font-bold px-4 py-2 rounded-xl text-xs shadow-md transition cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" /> Import Statement ({selectedAccount ? selectedAccount.inputType : 'Select Account'})
            </button>
            <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {uploadError && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-600 font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{uploadError}</span>
          </div>
        )}

        {uploadSuccess && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-600 font-bold flex items-center gap-2">
            <span>✅</span>
            <span>{uploadSuccess}</span>
          </div>
        )}

        <form onSubmit={handleSaveTrade} className="space-y-6 max-h-[75vh] overflow-y-auto pr-2">
          
          {/* SECTION 0: ACCOUNT SELECTOR */}
          <div className="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-4 space-y-2">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">Trading Account</label>
            <select 
              value={selectedAccountName} 
              onChange={e => { setSelectedAccountName(e.target.value); setUploadError(null); }}
              className={inputClass}
              required
            >
              {accounts.length === 0 ? (
                <option value="">-- Please create an account in the sidebar first --</option>
              ) : (
                accounts.map(acc => (
                  <option key={acc.id || acc.name} value={acc.name}>
                    {acc.name} ({acc.groupName} - {acc.type} | Format: {acc.inputType})
                  </option>
                ))
              )}
            </select>
            {selectedAccount && (
              <p className="text-[10px] text-slate-400 mt-1">
                ℹ️ This account expects <span className="font-bold text-[#ec3044]">{selectedAccount.inputType}</span> statement uploads.
              </p>
            )}
          </div>

          {/* SECTION 1: CALCULATED PARAMETERS */}
          <div className="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-4 space-y-3">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              Computer Calculated Parameters
            </h3>

            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Symbol</label>
                <select 
                  value={symbol} 
                  onChange={e => setSymbol(e.target.value)} 
                  className={inputClass}
                >
                  {SYMBOL_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Trade Date</label>
                <input type="date" value={openDate} onChange={e => setOpenDate(e.target.value)} className={inputClass} required />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Side</label>
                <select value={side} onChange={e => setSide(e.target.value as any)} className={inputClass}>
                  <option value="LONG">LONG</option>
                  <option value="SHORT">SHORT</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Contracts Traded</label>
                <input type="number" value={contractsTraded} onChange={e => setContractsTraded(e.target.value)} className={inputClass} required />
              </div>
            </div>

            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Avg Entry Price</label>
                <input type="number" step="any" value={entryPrice} onChange={e => setEntryPrice(e.target.value)} placeholder="0.00" className={inputClass} required />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Avg Exit Price</label>
                <input type="number" step="any" value={exitPrice} onChange={e => setExitPrice(e.target.value)} placeholder="0.00" className={inputClass} required />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Entry Time</label>
                <input type="text" value={entryTime} onChange={e => setEntryTime(e.target.value)} placeholder="10:36:37 AM" className={inputClass} />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Exit Time</label>
                <input type="text" value={exitTime} onChange={e => setExitTime(e.target.value)} placeholder="10:39:51 AM" className={inputClass} />
              </div>
            </div>

            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Gross P&L ($)</label>
                <input 
                  type="text" 
                  value={hasPrices ? `$${calcGrossPnL.toFixed(2)}` : '--'} 
                  readOnly 
                  className="w-full border border-slate-200 bg-slate-100 rounded-xl p-2.5 text-xs text-[#ec3044] font-black cursor-not-allowed" 
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Net P&L ($)</label>
                <input 
                  type="text" 
                  value={hasPrices ? `$${calcNetPnL.toFixed(2)}` : '--'} 
                  readOnly 
                  className={`w-full border border-slate-200 bg-slate-100 rounded-xl p-2.5 text-xs font-black cursor-not-allowed ${
                    hasPrices ? (calcNetPnL >= 0 ? 'text-emerald-600' : 'text-rose-600') : 'text-slate-400'
                  }`} 
                />
              </div>
            </div>
          </div>

          {/* SECTION 2: RISK PARAMETERS */}
          <div className="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-4 space-y-3">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Risk Parameters & Target/Stop Ticks
            </h3>

            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Profit Target (Ticks)</label>
                <input type="number" value={profitTargetTicks} onChange={e => setProfitTargetTicks(e.target.value)} placeholder="15" className={inputClass} />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Stop Loss (Ticks)</label>
                <input type="number" value={stopLossTicks} onChange={e => setStopLossTicks(e.target.value)} placeholder="10" className={inputClass} />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Initial Target ($)</label>
                <input type="text" value={ptTicks > 0 ? `$${initialTargetDollars.toFixed(2)}` : '$0.00'} readOnly className="w-full border border-slate-200 bg-slate-100 rounded-xl p-2.5 text-xs text-[#ec3044] font-bold cursor-not-allowed" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Trade Risk ($)</label>
                <input type="text" value={slTicks > 0 ? `$${tradeRiskDollars.toFixed(2)}` : '$0.00'} readOnly className="w-full border border-slate-200 bg-slate-100 rounded-xl p-2.5 text-xs text-[#ec3044] font-bold cursor-not-allowed" />
              </div>
            </div>

            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Points</label>
                <input type="text" value={hasPrices ? points.toFixed(2) : '0.00'} readOnly className="w-full border border-slate-200 bg-slate-100 rounded-xl p-2.5 text-xs text-[#ec3044] font-bold cursor-not-allowed" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Ticks</label>
                <input type="text" value={hasPrices ? totalTicks.toFixed(1) : '0.0'} readOnly className="w-full border border-slate-200 bg-slate-100 rounded-xl p-2.5 text-xs text-[#ec3044] font-bold cursor-not-allowed" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Planned R-Multiple</label>
                <input type="text" value={`${plannedR.toFixed(2)}R`} readOnly className="w-full border border-slate-200 bg-slate-100 rounded-xl p-2.5 text-xs text-[#ec3044] font-bold cursor-not-allowed" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Realized R-Multiple</label>
                <input type="text" value={hasPrices ? `${realizedR.toFixed(2)}R` : '0.00R'} readOnly className="w-full border border-slate-200 bg-slate-100 rounded-xl p-2.5 text-xs text-[#ec3044] font-bold cursor-not-allowed" />
              </div>
            </div>
          </div>

          {/* SECTION 3: STRATEGY & PLAYBOOK TAGS */}
          <div className="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-4 space-y-3">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Strategy & Playbook Tags
            </h3>

            <div className="grid grid-cols-3 gap-3">
              
              {/* Strategy Selector */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-[11px] font-bold text-slate-600">Strategy</label>
                  <button type="button" onClick={() => setActiveNewTagType('strategy')} className="text-[10px] text-[#ec3044] font-bold flex items-center gap-0.5 cursor-pointer"><Plus className="w-3 h-3"/> New</button>
                </div>
                {activeNewTagType === 'strategy' ? (
                  <div className="flex gap-1">
                    <input type="text" value={newTagInput} onChange={e => setNewTagInput(e.target.value)} placeholder="New Strat" className={inputClass} />
                    <button type="button" onClick={() => handleCreateNewTag('strategy')} className="px-2 bg-[#ec3044] text-white font-bold rounded-xl text-[10px] cursor-pointer">Add</button>
                  </div>
                ) : (
                  <select value={selectedStrategy} onChange={e => setSelectedStrategy(e.target.value)} className={inputClass}>
                    <option value="">Select strategy...</option>
                    {strategies.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                  </select>
                )}
              </div>

              {/* Setup Tag Selector */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-[11px] font-bold text-slate-600">Setup Tag</label>
                  <button type="button" onClick={() => setActiveNewTagType('setup')} className="text-[10px] text-[#ec3044] font-bold flex items-center gap-0.5 cursor-pointer"><Plus className="w-3 h-3"/> New</button>
                </div>
                {activeNewTagType === 'setup' ? (
                  <div className="flex gap-1">
                    <input type="text" value={newTagInput} onChange={e => setNewTagInput(e.target.value)} placeholder="New Setup" className={inputClass} />
                    <button type="button" onClick={() => handleCreateNewTag('setup')} className="px-2 bg-[#ec3044] text-white font-bold rounded-xl text-[10px] cursor-pointer">Add</button>
                  </div>
                ) : (
                  <select value={selectedSetup} onChange={e => setSelectedSetup(e.target.value)} className={inputClass}>
                    <option value="">Select setup tag...</option>
                    {setups.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                  </select>
                )}
              </div>

              {/* Mistake Tag Selector */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-[11px] font-bold text-slate-600">Mistake Tag</label>
                  <button type="button" onClick={() => setActiveNewTagType('mistake')} className="text-[10px] text-[#ec3044] font-bold flex items-center gap-0.5 cursor-pointer"><Plus className="w-3 h-3"/> New</button>
                </div>
                {activeNewTagType === 'mistake' ? (
                  <div className="flex gap-1">
                    <input type="text" value={newTagInput} onChange={e => setNewTagInput(e.target.value)} placeholder="New Mistake" className={inputClass} />
                    <button type="button" onClick={() => handleCreateNewTag('mistake')} className="px-2 bg-[#ec3044] text-white font-bold rounded-xl text-[10px] cursor-pointer">Add</button>
                  </div>
                ) : (
                  <select value={selectedMistake} onChange={e => setSelectedMistake(e.target.value)} className={inputClass}>
                    <option value="">Select mistake tag...</option>
                    {mistakes.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                  </select>
                )}
              </div>

            </div>
          </div>

          {/* SECTION 4: NOTES & RATING */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Journal Notes & Execution Thoughts</label>
            <textarea
              rows={3}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Write execution context, market behavior, or rule adherence..."
              className={inputClass}
            />
          </div>

          {/* Save Controls */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 text-xs transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 bg-[#ec3044] hover:bg-[#d4283b] text-white font-bold rounded-xl shadow-md text-xs transition flex items-center gap-2 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" /> Save Trade to Cloud
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}