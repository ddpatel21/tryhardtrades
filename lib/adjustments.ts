import { db } from '@/lib/db';

export interface AccountAdjustment {
  id?: string | number;
  accountId: string | number;
  type: 'deposit' | 'withdrawal';
  amount: number;
  date: string;
  note?: string;
}

export async function getAdjustmentsForScope(activeFilterSelection: { type: string; name: string }): Promise<AccountAdjustment[]> {
  let adjustmentsList: AccountAdjustment[] = [];

  // Load from Supabase
  try {
    const { supabase } = await import('@/lib/supabase');
    const { data } = await supabase.from('account_adjustments').select('*');
    if (data) {
      adjustmentsList = data.map(d => ({
        id: d.id,
        accountId: d.account_id,
        type: d.type,
        amount: Number(d.amount),
        date: d.date,
        note: d.note
      }));
    }
  } catch (err) {
    console.warn("Supabase adjustments fetch error:", err);
  }

  // Fallback / local check from Dexie
  try {
    if ((db as any).adjustments) {
      const localData = await (db as any).adjustments.toArray();
      if (localData && localData.length > 0 && adjustmentsList.length === 0) {
        adjustmentsList = localData;
      }
    }
  } catch (err) {}

  // Filter based on active sidebar scope
  if (activeFilterSelection.type === 'account') {
    return adjustmentsList.filter(a => String(a.accountId) === String(activeFilterSelection.name));
  } else if (activeFilterSelection.type === 'group') {
    const { cloudDb } = await import('@/lib/cloudDb');
    const accounts = await cloudDb.getAccounts();
    const groupAccountIds = accounts
      .filter(a => a.groupName === activeFilterSelection.name)
      .map(a => String(a.id));
    return adjustmentsList.filter(a => groupAccountIds.includes(String(a.accountId)));
  }

  return adjustmentsList;
}