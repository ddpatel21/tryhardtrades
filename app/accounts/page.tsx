'use client';

import React, { useState, useEffect } from 'react';
import { cloudDb } from '@/lib/cloudDb';
import { db, TradingAccount, TradeItem } from '@/lib/db';
import { copyLeaderTradeToGroup } from '@/lib/copier';
import { 
  Users, 
  UploadCloud, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Layers, 
  Wallet, 
  ArrowRight,
  RefreshCw,
  Plus
} from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function AccountsImportPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dragOverAccountId, setDragOverAccountId] = useState<string | number | null>(null);
  const [uploadStatus, setUploadStatus] = useState<{
    accountId: string | number;
    status: 'idle' | 'parsing' | 'success' | 'error';
    message?: string;
  } | null>(null);

  const loadAccounts = async () => {
    setIsLoading(true);
    const data = await cloudDb.getAccounts();
    setAccounts(data);
    setIsLoading(false);
  };

  useEffect(() => {
    loadAccounts();
    const handleRefresh = () => loadAccounts();
    window.addEventListener('account-filter-changed', handleRefresh);
    return () => window.removeEventListener('account-filter-changed', handleRefresh);
  }, []);

  // Standard Tradovate Orders / Fills / Positions CSV Parser
  const parseTradovateCSV = (csvText: string): Partial<TradeItem>[] => {
    const lines = csvText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.replace(/['"]+/g, '').trim().toLowerCase());
    const parsedRows: Partial<TradeItem>[] = [];

    // Common column indices for Tradovate execution exports
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
      message: `Reading Tradovate statement for ${account.name}...`
    });

    try {
      const text = await file.text();
      const parsedTrades = parseTradovateCSV(text);

      if (parsedTrades.length === 0) {
        setUploadStatus({
          accountId: account.id,
          status: 'error',
          message: 'Could not extract trades. Please ensure this is a valid Tradovate statement export.'
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
          const { data, error } = await supabase.from('trades').insert(tradePayload).select('id').single();
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

        // Group replication: Replicate across all follower accounts in the same group
        if (account.groupName) {
          await copyLeaderTradeToGroup(localTrade);
        }

        savedCount++;
      }

      setUploadStatus({
        accountId: account.id,
        status: 'success',
        message: `Imported ${savedCount} trades into ${account.name}${account.groupName ? ` and synced to group '${account.groupName}'` : ''}!`
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

  const handleDrop = (e: React.DragEvent, account: TradingAccount) => {
    e.preventDefault();
    setDragOverAccountId(null);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0], account);
    }
  };

  const handleDragOver = (e: React.DragEvent, accountId: string | number) => {
    e.preventDefault();
    if (dragOverAccountId !== accountId) {
      setDragOverAccountId(accountId);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverAccountId(null);
  };

  // Group accounts by group name
  const groupedAccounts: Record<string, TradingAccount[]> = {};
  accounts.forEach(acc => {
    const g = acc.groupName || 'Unassigned';
    if (!groupedAccounts[g]) groupedAccounts[g] = [];
    groupedAccounts[g].push(acc);
  });

  return (
    <div className="p-8 bg-[#F8F9FD] min-h-screen text-slate-800 font-sans space-y-8 w-full max-w-[1700px] mx-auto">
      
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-[#ec3044]" /> Accounts & Statement Import
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Drop your Tradovate trade exports directly below any account. Files imported into a leader account automatically replicate to the rest of the group.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={loadAccounts}
            className="flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold px-3.5 py-2 rounded-xl text-xs shadow-xs transition cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
          <button 
            onClick={() => window.dispatchEvent(new CustomEvent('open-add-account'))}
            className="flex items-center gap-2 bg-[#ec3044] hover:bg-[#d4283b] text-white font-bold px-4 py-2 rounded-xl text-xs shadow-md transition cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Add Account
          </button>
        </div>
      </div>

      {/* Global Status Banner */}
      {uploadStatus && (
        <div className={`p-4 rounded-2xl border text-xs font-bold flex items-center justify-between shadow-xs animate-in fade-in duration-200 ${
          uploadStatus.status === 'success' 
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
            : uploadStatus.status === 'error'
            ? 'bg-rose-50 text-rose-800 border-rose-200'
            : 'bg-blue-50 text-blue-800 border-blue-200'
        }`}>
          <div className="flex items-center gap-2.5">
            {uploadStatus.status === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
            {uploadStatus.status === 'error' && <AlertCircle className="w-4 h-4 text-rose-600" />}
            {uploadStatus.status === 'parsing' && <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />}
            <span>{uploadStatus.message}</span>
          </div>
          <button 
            onClick={() => setUploadStatus(null)}
            className="text-slate-400 hover:text-slate-600 px-2 py-0.5 cursor-pointer font-black"
          >
            ✕
          </button>
        </div>
      )}

      {/* Accounts List Grouped */}
      {isLoading ? (
        <div className="py-20 text-center text-slate-400 text-xs font-semibold">Loading accounts...</div>
      ) : accounts.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center space-y-3">
          <p className="text-sm font-bold text-slate-700">No accounts configured yet.</p>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">Create your first trading account to enable direct drag-and-drop trade parsing and copy-trading.</p>
          <button 
            onClick={() => window.dispatchEvent(new CustomEvent('open-add-account'))}
            className="mt-2 bg-[#ec3044] text-white font-bold px-4 py-2 rounded-xl text-xs shadow-md cursor-pointer"
          >
            + Create Account
          </button>
        </div>
      ) : (
        Object.entries(groupedAccounts).map(([groupName, groupAccs]) => (
          <div key={groupName} className="space-y-4">
            
            {/* Group Header */}
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#ec3044]" />
                <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">{groupName}</h2>
                <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                  {groupAccs.length} {groupAccs.length === 1 ? 'account' : 'accounts'}
                </span>
              </div>
              <span className="text-[10px] text-slate-400 font-semibold">
                Auto-Copies across this group on upload
              </span>
            </div>

            {/* Account Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {groupAccs.map((account) => {
                const isDragTarget = dragOverAccountId === account.id;

                return (
                  <div 
                    key={account.id}
                    className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-xs flex flex-col justify-between space-y-4 hover:border-slate-300 transition"
                  >
                    {/* Top Account Specs */}
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-black text-slate-900">{account.name}</h3>
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                            account.type === 'Live' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' :
                            account.type === 'Funded' ? 'bg-blue-50 text-blue-600 border border-blue-200' :
                            'bg-amber-50 text-amber-600 border border-amber-200'
                          }`}>
                            {account.type}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 font-semibold mt-0.5">
                          {account.firm || 'Lucid'} • Format: <span className="text-[#ec3044] font-bold">Tradovate</span>
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">Balance</span>
                        <span className="font-mono font-bold text-sm text-slate-900">
                          ${Number(account.balance || 0).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {/* Dedicated Drag and Drop Zone */}
                    <div
                      onDragOver={(e) => handleDragOver(e, account.id!)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, account)}
                      className={`relative border-2 border-dashed rounded-2xl p-5 text-center transition flex flex-col items-center justify-center space-y-2 cursor-pointer ${
                        isDragTarget 
                          ? 'border-[#ec3044] bg-[#ec3044]/5 ring-2 ring-[#ec3044]/20' 
                          : 'border-slate-200 hover:border-[#ec3044]/40 hover:bg-slate-50/60'
                      }`}
                    >
                      <input 
                        type="file" 
                        accept=".csv"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            handleFileUpload(e.target.files[0], account);
                          }
                        }}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      />

                      <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-600">
                        <UploadCloud className="w-5 h-5 text-[#ec3044]" />
                      </div>

                      <div>
                        <p className="text-xs font-bold text-slate-900">
                          Drop <span className="text-[#ec3044]">Tradovate CSV</span> here
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5">or click to browse from device</p>
                      </div>
                    </div>

                    {/* Bottom Quick-View Link */}
                    <div className="flex justify-between items-center pt-2 border-t border-slate-100 text-[11px] font-bold text-slate-500">
                      <span>Group: {account.groupName}</span>
                      <button 
                        onClick={() => {
                          window.dispatchEvent(new CustomEvent('account-filter-changed', { detail: { type: 'account', name: account.name } }));
                          router.push('/trade-view');
                        }}
                        className="text-[#ec3044] hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        View Trades <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>

                  </div>
                );
              })}
            </div>

          </div>
        ))
      )}

    </div>
  );
}