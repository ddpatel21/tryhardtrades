import { supabase } from './supabase';
import { TradeItem, TradingAccount } from './db';

export const cloudDb = {
  async getTrades(): Promise<TradeItem[]> {
    const { data, error } = await supabase.from('trades').select('*').order('open_date', { ascending: false });
    if (error) {
      console.error('Error fetching trades:', error);
      return [];
    }
    // Map snake_case database columns back to your camelCase TradeItem interface
    return (data || []).map((t: any) => ({
      id: t.id,
      symbol: t.symbol,
      openDate: t.open_date,
      side: t.side,
      contractsTraded: t.contracts_traded,
      entryPrice: t.entry_price,
      exitPrice: t.exit_price,
      netPnL: t.net_pnl,
      grossPnL: t.gross_pnl,
      commissions: t.commissions,
      points: t.points,
      ticks: t.ticks,
      ticksPerContract: t.ticks_per_contract,
      strategy: t.strategy,
      zellaScale: t.zella_scale,
      priceMaeMfe: t.price_mae_mfe,
      tradeRating: t.trade_rating,
      profitTargetTicks: t.profit_target_ticks,
      stopLossTicks: t.stop_loss_ticks,
      initialTargetDollars: t.initial_target_dollars,
      tradeRiskDollars: t.trade_risk_dollars,
      plannedRMultiple: t.planned_r_multiple,
      realizedRMultiple: t.realized_r_multiple,
      entryTime: t.entry_time,
      exitTime: t.exit_time,
      bestExitPrice: t.best_exit_price,
      bestExitTime: t.best_exit_time,
      setupTag: t.setup_tag,
      mistakeTag: t.mistake_tag,
      notes: t.notes,
      status: t.status,
      account: t.account,
      accountGroup: t.account_group,
    }));
  },

  async addTrade(trade: TradeItem) {
    const dbPayload = {
      symbol: trade.symbol,
      open_date: trade.openDate,
      side: trade.side,
      contracts_traded: trade.contractsTraded,
      entry_price: trade.entryPrice,
      exit_price: trade.exitPrice,
      net_pnl: trade.netPnL,
      gross_pnl: trade.grossPnL,
      commissions: trade.commissions,
      points: trade.points,
      ticks: trade.ticks,
      ticks_per_contract: trade.ticksPerContract,
      strategy: trade.strategy,
      zella_scale: trade.zellaScale,
      price_mae_mfe: trade.priceMaeMfe,
      trade_rating: trade.tradeRating,
      profit_target_ticks: trade.profitTargetTicks,
      stop_loss_ticks: trade.stopLossTicks,
      initial_target_dollars: trade.initialTargetDollars,
      trade_risk_dollars: trade.tradeRiskDollars,
      planned_r_multiple: trade.plannedRMultiple,
      realized_r_multiple: trade.realizedRMultiple,
      entry_time: trade.entryTime,
      exit_time: trade.exitTime,
      best_exit_price: trade.bestExitPrice,
      best_exit_time: trade.bestExitTime,
      setup_tag: trade.setupTag,
      mistake_tag: trade.mistakeTag,
      notes: trade.notes,
      status: trade.status,
      account: trade.account,
      account_group: trade.accountGroup,
    };
    const { error } = await supabase.from('trades').insert([dbPayload]);
    if (error) console.error('Error adding trade to cloud:', error);
  },

  async getAccounts(): Promise<TradingAccount[]> {
    const { data, error } = await supabase.from('accounts').select('*');
    if (error) {
      console.error('Error fetching accounts:', error);
      return [];
    }
    return (data || []).map((acc: any) => ({
      id: acc.id,
      name: acc.name,
      groupName: acc.group_name,
      type: acc.type,
      firm: acc.firm,
      balance: acc.balance,
      inputType: acc.input_type,
    }));
  },

  async addAccount(account: TradingAccount) {
    const payload = {
      name: account.name,
      group_name: account.groupName,
      type: account.type,
      firm: account.firm,
      balance: account.balance,
      input_type: account.inputType,
    };
    const { error } = await supabase.from('accounts').insert([payload]);
    if (error) console.error('Error adding account to cloud:', error);
  }
};