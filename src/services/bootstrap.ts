import { localDb } from '../db/localDb';
import type { Store, StoreMember, SyncTable } from '../types';
import { nowIso } from '../lib/id';
import { buildStoreBundle, DEFAULT_SETUP, type StoreSetup } from './storeSetup';
import { saveAndQueue } from './sync';
import { LEGACY_SAMPLE_REMOVED_KEY } from './legacySampleMenu';
import { t } from '../i18n';

export interface BootstrapResult {
  store: Store;
  owner: StoreMember;
}

export const ONBOARDED_AT_KEY = 'onboardedAt';
let inFlight: Promise<BootstrapResult> | null = null;

/** The store on this device, or null on a brand-new device (ADR-009: that is the cue for the first-time journey). */
export async function findLocalStore(): Promise<BootstrapResult | null> {
  const store = await localDb.stores.toCollection().first();
  if (!store) return null;
  const owner = await localDb.storeMembers
    .where('storeId')
    .equals(store.id)
    .filter((m) => m.role === 'owner' && !m.deletedAt)
    .first();
  if (!owner) throw new Error(t('Data pemilik toko tidak ditemukan di perangkat ini.'));
  return { store, owner };
}

/**
 * Creates an empty store from the merchant's choices (ADR-018: no example menu). Returns the existing store if there is one.
 * De-duplicated so a double tap or React StrictMode's double effect never creates two.
 */
export function createLocalStore(setup: StoreSetup = DEFAULT_SETUP): Promise<BootstrapResult> {
  inFlight ??= createOnce(setup).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

/** Loads the store, or creates the default (empty) one. Used by tests and by "Lewati" in the first-time journey. */
export const ensureLocalStore = (): Promise<BootstrapResult> => createLocalStore();

async function createOnce(setup: StoreSetup): Promise<BootstrapResult> {
  const existing = await findLocalStore();
  if (existing) return existing;

  const seed = buildStoreBundle(setup);
  const queued: Array<[SyncTable, Array<{ id: string }>]> = [
    ['storeMembers', [seed.owner]],
    ['salesModes', seed.salesModes],
    ['paymentMethods', seed.paymentMethods],
  ];
  // All or nothing: closing the app mid-setup must not leave half a store behind. The store row goes last —
  // its presence means "this device is fully set up".
  await localDb.transaction('rw', localDb.tables, async () => {
    for (const [table, records] of queued) {
      for (const record of records) await saveAndQueue(table, record);
    }
    await localDb.meta.put({ key: ONBOARDED_AT_KEY, value: nowIso() });
    await localDb.meta.put({ key: LEGACY_SAMPLE_REMOVED_KEY, value: nowIso() }); // nothing to clean up on a new store
    await saveAndQueue('stores', { ...seed.store, updatedAt: nowIso() });
  });
  return { store: seed.store, owner: seed.owner };
}

/** Saves store settings; queued so every device gets them (ADR-025). */
export async function updateStore(store: Store): Promise<void> {
  await saveAndQueue('stores', { ...store, updatedAt: nowIso() });
}
