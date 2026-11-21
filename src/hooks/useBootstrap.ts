import { useCallback, useEffect, useState } from 'react';
import { localDb } from '../db/localDb';
import { createLocalStore, findLocalStore, type BootstrapResult } from '../services/bootstrap';
import type { StoreSetup } from '../services/storeSetup';
import { removeLegacySampleMenu } from '../services/legacySampleMenu';
import { rememberedMemberId, useSessionStore } from '../store/useSessionStore';
import { t } from '../i18n';

type BootStatus = { status: 'loading' } | { status: 'onboarding' } | { status: 'ready' } | { status: 'error'; message: string };
export type BootState = BootStatus & {
  /** Finishes the first-time journey: creates the store from the merchant's choices and enters the app. */
  completeOnboarding: (setup?: StoreSetup) => Promise<void>;
};

/** Restores who is selling for a loaded store (ADR-004). */
async function startSession({ store, owner }: BootstrapResult): Promise<void> {
  const session = useSessionStore.getState();
  const hasOwnerPin = owner.pinHash !== '';
  const rememberedId = rememberedMemberId();
  const remembered = rememberedId ? await localDb.storeMembers.get(rememberedId) : undefined;
  const seller = remembered && !remembered.deletedAt && remembered.storeId === store.id ? remembered : hasOwnerPin ? null : owner;

  session.setStore(store.id);
  session.setOwnerInfo(owner.id, hasOwnerPin);
  if (seller) session.signInCashier({ memberId: seller.id, displayName: seller.displayName, role: seller.role });
  else session.signOutCashier();
}

/**
 * Loads the local store and restores who is selling (ADR-004):
 *  - no store on this device → the first-time journey (ADR-009)
 *  - remembered, still-active member → signed in again (name/role re-read from the DB, never from storage)
 *  - no owner PIN yet → the owner
 *  - otherwise nobody: the app shows the "Siapa yang berjualan?" screen.
 */
export function useBootstrap(): BootState {
  const [state, setState] = useState<BootStatus>({ status: 'loading' });

  useEffect(() => {
    let isActive = true;
    const boot = async () => {
      const found = await findLocalStore();
      if (found) {
        await removeLegacySampleMenu(found);
        await startSession(found);
      }
      if (isActive) setState({ status: found ? 'ready' : 'onboarding' });
    };
    boot().catch((error: unknown) => {
      if (!isActive) return;
      setState({ status: 'error', message: error instanceof Error ? error.message : t('Gagal memuat data toko.') });
    });
    return () => {
      isActive = false;
    };
  }, []);

  const completeOnboarding = useCallback(async (setup?: StoreSetup) => {
    await startSession(await createLocalStore(setup));
    setState({ status: 'ready' });
  }, []);

  return { ...state, completeOnboarding };
}
