import { useLiveQuery } from 'dexie-react-hooks';
import { LAST_BACKUP_KEY } from '../constants';
import { localDb } from '../db/localDb';
import { buildChecklist, checklistProgress, type ChecklistItem } from '../lib/checklist';
import { isCountedSale } from '../lib/reports';
import { ONBOARDED_AT_KEY } from '../services/bootstrap';
import type { Id } from '../types';

export const CHECKLIST_DISMISSED_KEY = 'checklistDismissed';

export interface ChecklistState {
  items: ChecklistItem[];
  done: number;
  total: number;
  isComplete: boolean;
  /** The slim banner on the cashier screen: new installs only, until complete or dismissed. */
  shouldShowBanner: boolean;
}

/** Live "Langkah awal" state, derived from what is in the database (ADR-009). */
export function useChecklist(storeId: Id | null): ChecklistState | undefined {
  return useLiveQuery(async () => {
    if (!storeId) return undefined;
    const onboardedAt = (await localDb.meta.get(ONBOARDED_AT_KEY))?.value;
    const products = await localDb.products.where('storeId').equals(storeId).toArray();
    const methods = await localDb.paymentMethods.where('storeId').equals(storeId).filter((m) => !m.deletedAt && m.isActive).toArray();
    const qris = methods.filter((m) => m.type === 'qris');
    const owner = await localDb.storeMembers.where('storeId').equals(storeId).filter((m) => m.role === 'owner' && !m.deletedAt).first();

    const items = buildChecklist({
      hasMenu: products.some((p) => !p.deletedAt),
      hasSale: (await localDb.orders.where('storeId').equals(storeId).filter(isCountedSale).first()) !== undefined,
      hasOwnerPin: (owner?.pinHash ?? '') !== '',
      usesQris: qris.length > 0,
      hasQrisImage: qris.some((m) => Boolean(m.qrisImageUrl)),
      hasClosing: (await localDb.dayClosings.where('storeId').equals(storeId).first()) !== undefined,
      hasBackup: (await localDb.meta.get(LAST_BACKUP_KEY)) !== undefined,
    });
    const progress = checklistProgress(items);
    const isDismissed = (await localDb.meta.get(CHECKLIST_DISMISSED_KEY)) !== undefined;
    return { items, ...progress, shouldShowBanner: Boolean(onboardedAt) && !isDismissed && !progress.isComplete };
  }, [storeId]);
}

export async function dismissChecklistBanner(): Promise<void> {
  await localDb.meta.put({ key: CHECKLIST_DISMISSED_KEY, value: new Date().toISOString() });
}
