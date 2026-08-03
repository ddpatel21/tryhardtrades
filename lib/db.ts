import Dexie, { Table } from 'dexie';

export interface TradeItem {
  id?: number;
  symbol: string;
  openDate: string; // YYYY-MM-DD
  side: 'LONG' | 'SHORT';
  contractsTraded: number;
  entryPrice: number;
  exitPrice: number;
  netPnL: number;
  grossPnL: number;
  commissions: number;
  points: number;
  ticks: number;
  ticksPerContract: number;
  strategy?: string;
  zellaScale?: number;
  priceMaeMfe?: string;
  tradeRating?: number;
  profitTargetTicks?: number;
  stopLossTicks?: number;
  initialTargetDollars?: number;
  tradeRiskDollars?: number;
  plannedRMultiple?: number;
  realizedRMultiple?: number;
  entryTime?: string;
  exitTime?: string;
  bestExitPrice?: number;
  bestExitTime?: string;
  setupTag?: string;
  mistakeTag?: string;
  notes?: string;
  status: 'WIN' | 'LOSS' | 'BE';
  account?: string;       // Linked account name
  accountGroup?: string;  // Linked account group name
}

export interface TradingAccount {
  id?: number;
  name: string;           // e.g., "AMP Live Master"
  groupName: string;      // e.g., "Lives", "Props"
  type: 'Eval' | 'Funded' | 'Live';
  firm: string;
  balance: number;
  inputType: 'Tradovate' | 'AMP'; // Required data input type for statement uploads
}

export interface StrategyItem {
  id?: number;
  name: string;
  description?: string;
  color?: string;
}

export interface SetupTagItem {
  id?: number;
  name: string;
}

export interface MistakeTagItem {
  id?: number;
  name: string;
}

export interface DailyJournalItem {
  id?: number;
  date: string; // YYYY-MM-DD
  note: string;
  rating?: number;
}

export class TradeZellaDatabase extends Dexie {
  trades!: Table<TradeItem>;
  accounts!: Table<TradingAccount>;
  strategies!: Table<StrategyItem>;
  setups!: Table<SetupTagItem>;
  mistakes!: Table<MistakeTagItem>;
  dailyJournals!: Table<DailyJournalItem>;

  constructor() {
    super('TradeZellaDB');

    this.version(6).stores({
      trades: '++id, openDate, symbol, status, side, strategy, account, accountGroup',
      accounts: '++id, name, groupName, type, firm, inputType',
      strategies: '++id, &name',
      setups: '++id, &name',
      mistakes: '++id, &name',
      dailyJournals: '++id, &date',
    });
  }
}

export const db = new TradeZellaDatabase();

export async function syncTagToMasterTables(strategy?: string, setupTag?: string, mistakeTag?: string) {
  try {
    if (strategy && strategy.trim() !== '') {
      const exists = await db.strategies.where('name').equals(strategy.trim()).first();
      if (!exists) await db.strategies.put({ name: strategy.trim() });
    }
    if (setupTag && setupTag.trim() !== '') {
      const exists = await db.setups.where('name').equals(setupTag.trim()).first();
      if (!exists) await db.setups.put({ name: setupTag.trim() });
    }
    if (mistakeTag && mistakeTag.trim() !== '') {
      const exists = await db.mistakes.where('name').equals(mistakeTag.trim()).first();
      if (!exists) await db.mistakes.put({ name: mistakeTag.trim() });
    }
  } catch (err) {
    console.error('Error syncing master tags:', err);
  }
}