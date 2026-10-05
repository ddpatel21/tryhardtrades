import { db, TradeItem, TradingAccount } from '@/lib/db';

/**
 * Replicates a newly saved leader trade across distinct follower accounts in the same group.
 * Deduplicates by account name so duplicate records in the accounts table do not spawn duplicate trades.
 */
export async function copyLeaderTradeToGroup(leaderTrade: TradeItem) {
  if (!leaderTrade.account || !leaderTrade.accountGroup || !leaderTrade.id) return;

  const allGroupAccounts = await db.accounts.where('groupName').equals(leaderTrade.accountGroup).toArray();

  // Deduplicate follower accounts by unique name and exclude the leader itself
  const seenAccountNames = new Set<string>();
  const followerAccounts: TradingAccount[] = [];

  for (const acc of allGroupAccounts) {
    if (acc.name !== leaderTrade.account && !seenAccountNames.has(acc.name)) {
      seenAccountNames.add(acc.name);
      followerAccounts.push(acc);
    }
  }

  if (followerAccounts.length === 0) return;

  const { supabase } = await import('@/lib/supabase');

  for (const follower of followerAccounts) {
    // Guard against re-inserting if a clone already exists for this follower
    try {
      const existing = await db.trades
        .where('leaderTradeId')
        .equals(leaderTrade.id)
        .and(t => t.account === follower.name)
        .first();

      if (existing) continue;
    } catch (err) {}

    const followerTradePayload = {
      symbol: leaderTrade.symbol,
      open_date: leaderTrade.openDate,
      side: leaderTrade.side,
      contracts_traded: leaderTrade.contractsTraded,
      entry_price: leaderTrade.entryPrice,
      exit_price: leaderTrade.exitPrice,
      net_pnl: leaderTrade.netPnL,
      gross_pnl: leaderTrade.grossPnL,
      commissions: leaderTrade.commissions,
      points: leaderTrade.points,
      ticks: leaderTrade.ticks,
      ticks_per_contract: leaderTrade.ticksPerContract,
      strategy: leaderTrade.strategy || null,
      setup_tag: leaderTrade.setupTag || null,
      mistake_tag: leaderTrade.mistakeTag || null,
      entry_time: leaderTrade.entryTime || null,
      exit_time: leaderTrade.exitTime || null,
      status: leaderTrade.status,
      account: follower.name,
      account_group: follower.groupName,
      leader_trade_id: leaderTrade.id,
      notes: leaderTrade.notes || null,
    };

    let followerDbId: number = Date.now() + Math.floor(Math.random() * 100000);

    try {
      const { data } = await supabase
        .from('trades')
        .insert(followerTradePayload)
        .select('id')
        .single();
      if (data && data.id) followerDbId = data.id;
    } catch (err) {
      console.warn('Supabase follower insert error:', err);
    }

    try {
      await db.trades.put({
        ...leaderTrade,
        id: followerDbId,
        account: follower.name,
        accountGroup: follower.groupName,
        leaderTradeId: leaderTrade.id,
      });
    } catch (err) {
      console.warn('Dexie follower insert error:', err);
    }
  }
}

/**
 * Syncs modifications from a leader trade to all its follower copies.
 */
export async function syncLeaderTradeUpdates(leaderTradeId: number, updates: Partial<TradeItem>) {
  const { supabase } = await import('@/lib/supabase');

  const supabasePayload: Record<string, any> = {};
  if (updates.strategy !== undefined) supabasePayload.strategy = updates.strategy;
  if (updates.setupTag !== undefined) supabasePayload.setup_tag = updates.setupTag;
  if (updates.mistakeTag !== undefined) supabasePayload.mistake_tag = updates.mistakeTag;
  if (updates.notes !== undefined) supabasePayload.notes = updates.notes;
  if (updates.status !== undefined) supabasePayload.status = updates.status;
  if (updates.netPnL !== undefined) supabasePayload.net_pnl = updates.netPnL;

  try {
    await supabase.from('trades').update(supabasePayload).eq('leader_trade_id', leaderTradeId);
  } catch (err) {}

  try {
    const followerTrades = await db.trades.where('leaderTradeId').equals(leaderTradeId).toArray();
    for (const follower of followerTrades) {
      if (follower.id) {
        await db.trades.update(follower.id, updates);
      }
    }
  } catch (err) {}
}

/**
 * Deletes all follower copies if the leader trade is deleted.
 */
export async function deleteLeaderTradeCopies(leaderTradeId: number) {
  const { supabase } = await import('@/lib/supabase');

  try {
    await supabase.from('trades').delete().eq('leader_trade_id', leaderTradeId);
  } catch (err) {}

  try {
    await db.trades.where('leaderTradeId').equals(leaderTradeId).delete();
  } catch (err) {}
}