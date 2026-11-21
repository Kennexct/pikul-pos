import { useCallback, useEffect, useState } from 'react';
import { localDb } from '../db/localDb';
import { createLocalStore, findLocalStore, type BootstrapResult } from '../services/bootstrap';
import { getDeviceId } from '../services/device';
import { DEFAULT_SETUP, type StoreSetup } from '../services/storeSetup';
import { removeLegacySampleMenu } from '../services/legacySampleMenu';
import { backUpAndWipeLocal, downloadStore, StoreNotReadyError, adoptAccountStore, keepDeviceStore } from '../services/storeSwitch';
import { decideBoot, type StoreFacts } from '../services/syncBinding';
import { syncTick } from '../services/syncBinding';
import { rememberedMemberId, useSessionStore } from '../store/useSessionStore';
import { t } from '../i18n';

export type BootStatus =
  | { status: 'loading' }
  | { status: 'onboarding'; storeName: string }
  | { status: 'ready' }
  | { status: 'error'; message: string }
  | { status: 'downloading'; received: number }
  | { status: 'notReady'; message: string }
  | { status: 'needOnline' }
  | { status: 'choose'; local: StoreFacts; remote: StoreFacts; remoteStoreId: string; localStoreId: string }
  | { status: 'otherAccount'; local: StoreFacts };

export type BootState = BootStatus & {
  /** Finishes the first-time journey: creates the store from the merchant's choices and enters the app. */
  completeOnboarding: (setup?: StoreSetup) => Promise<void>;
  /** Choice screen: "Pakai toko dari akun". */
  chooseAccountStore: () => Promise<void>;
  /** Choice screen: "Pakai toko di perangkat ini" (password needed). */
  chooseDeviceStore: (password: string) => Promise<void>;
  /** Store tied to another account: back it up, remove it, continue with this account. */
  leaveOtherAccountStore: () => Promise<void>;
  /** Offline or not-ready screens: try again; or start a new empty store anyway. */
  retry: () => void;
  startNewStore: () => void;
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

const message = (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback);

/**
 * Loads the store for this device and account (ADR-009, ADR-024):
 *  - store here and tied to this account (or offline) → sell
 *  - no store here, the account has one → download it, then the PIN / cashier screen
 *  - no store anywhere → the first-time journey, store name from sign-up
 *  - a different store here → the merchant chooses which one to keep
 */
export function useBootstrap(): BootState {
  const [state, setState] = useState<BootStatus>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const mismatch = useSessionStore((s) => s.syncStatus === 'mismatch');

  const enter = useCallback(async () => {
    const found = await findLocalStore();
    if (!found) throw new Error(t('Gagal memuat data toko.'));
    await removeLegacySampleMenu(found);
    await startSession(found);
    setState({ status: 'ready' });
    void syncTick().then((outcome) => useSessionStore.getState().setSyncStatus(outcome));
  }, []);

  const download = useCallback(
    async (storeId: string) => {
      setState({ status: 'downloading', received: 0 });
      try {
        await downloadStore(storeId, (received) => setState({ status: 'downloading', received }));
        await enter();
      } catch (error) {
        if (error instanceof StoreNotReadyError) setState({ status: 'notReady', message: error.message });
        else setState({ status: 'error', message: message(error, t('Gagal mengunduh data toko.')) });
      }
    },
    [enter],
  );

  useEffect(() => {
    let isActive = true;
    const boot = async () => {
      await getDeviceId();
      const found = await findLocalStore();
      if (found) await removeLegacySampleMenu(found);
      const decision = await decideBoot(found);
      if (!isActive) return;
      if (decision.kind === 'ready' && found) {
        await startSession(found);
        if (isActive) setState({ status: 'ready' });
      } else if (decision.kind === 'setup') setState({ status: 'onboarding', storeName: decision.storeName });
      else if (decision.kind === 'download') await download(decision.storeId);
      else if (decision.kind === 'needOnline') setState({ status: 'needOnline' });
      else if (decision.kind === 'otherAccount') setState({ status: 'otherAccount', local: decision.local });
      else if (decision.kind === 'choose' && found) setState({ status: 'choose', local: decision.local, remote: decision.remote, remoteStoreId: decision.remoteStoreId, localStoreId: found.store.id });
      else setState({ status: 'onboarding', storeName: '' });
    };
    boot().catch((error: unknown) => {
      if (isActive) setState({ status: 'error', message: message(error, t('Gagal memuat data toko.')) });
    });
    return () => {
      isActive = false;
    };
  }, [attempt, download]);

  // Another device replaced the account's store: ask again which store this device keeps.
  useEffect(() => {
    if (mismatch && state.status === 'ready') setAttempt((n) => n + 1);
  }, [mismatch, state.status]);

  const completeOnboarding = useCallback(
    async (setup?: StoreSetup) => {
      const name = state.status === 'onboarding' ? state.storeName : '';
      await startSession(await createLocalStore(setup ?? { ...DEFAULT_SETUP, storeName: name || DEFAULT_SETUP.storeName }));
      setState({ status: 'ready' });
      void syncTick().then((outcome) => useSessionStore.getState().setSyncStatus(outcome));
    },
    [state],
  );

  const chooseAccountStore = useCallback(async () => {
    if (state.status !== 'choose') return;
    const { remoteStoreId } = state;
    setState({ status: 'downloading', received: 0 });
    try {
      await adoptAccountStore(remoteStoreId, (received) => setState({ status: 'downloading', received }));
      useSessionStore.getState().setSyncStatus('idle');
      await enter();
    } catch (error) {
      if (error instanceof StoreNotReadyError) setState({ status: 'notReady', message: error.message });
      else setState({ status: 'error', message: message(error, t('Gagal mengunduh data toko.')) });
    }
  }, [state, enter]);

  const chooseDeviceStore = useCallback(
    async (password: string) => {
      if (state.status !== 'choose') return;
      await keepDeviceStore(state.localStoreId, state.remoteStoreId, password);
      useSessionStore.getState().setSyncStatus('idle');
      await enter();
    },
    [state, enter],
  );

  const leaveOtherAccountStore = useCallback(async () => {
    await backUpAndWipeLocal();
    setAttempt((n) => n + 1);
  }, []);

  const retry = useCallback(() => {
    setState({ status: 'loading' });
    setAttempt((n) => n + 1);
  }, []);
  const startNewStore = useCallback(() => setState({ status: 'onboarding', storeName: '' }), []);

  return { ...state, completeOnboarding, chooseAccountStore, chooseDeviceStore, leaveOtherAccountStore, retry, startNewStore };
}
