import { create } from 'zustand';
import { ACTIVE_MEMBER_STORAGE_KEY, OWNER_UNLOCK_MS } from '../constants';
import type { Id, Role } from '../types';

export interface ActiveCashier {
  memberId: Id;
  displayName: string;
  role: Role;
}

/**
 * ADR-004: two independent things live here.
 *  - `cashier`: who is selling. Only the member id is persisted; name/role are re-read from the DB at boot.
 *  - `ownerUnlockedUntil`: owner powers, in memory only — a reload always locks.
 */
interface SessionState {
  storeId: Id | null;
  cashier: ActiveCashier | null;
  ownerId: Id | null;
  hasOwnerPin: boolean;
  ownerUnlockedUntil: number | null;
  isOnline: boolean;
  pendingSyncCount: number;
  /** Result of the last background sync run (ADR-024). */
  syncStatus: SyncStatus;
  setStore: (storeId: Id | null) => void;
  setOwnerInfo: (ownerId: Id, hasOwnerPin: boolean) => void;
  /** Switching seller always ends owner mode. */
  signInCashier: (cashier: ActiveCashier) => void;
  signOutCashier: () => void;
  unlockOwner: (now?: number) => void;
  /** Slides the time box while the owner keeps using an owner screen. */
  touchOwner: (now?: number) => void;
  lockOwner: () => void;
  setOnline: (isOnline: boolean) => void;
  setPendingSyncCount: (count: number) => void;
  setSyncStatus: (status: SyncStatus) => void;
}

export type SyncStatus = 'idle' | 'synced' | 'offline' | 'signedOut' | 'mismatch' | 'error' | 'unbound';

function rememberMember(memberId: Id | null): void {
  try {
    if (memberId) localStorage.setItem(ACTIVE_MEMBER_STORAGE_KEY, memberId);
    else localStorage.removeItem(ACTIVE_MEMBER_STORAGE_KEY);
  } catch {
    // Storage unavailable (private mode): the seller simply has to sign in again after a reload.
  }
}

export function rememberedMemberId(): Id | null {
  try {
    return localStorage.getItem(ACTIVE_MEMBER_STORAGE_KEY);
  } catch {
    return null;
  }
}

export const useSessionStore = create<SessionState>()((set, get) => ({
  storeId: null,
  cashier: null,
  ownerId: null,
  hasOwnerPin: false,
  ownerUnlockedUntil: null,
  isOnline: typeof navigator === 'undefined' ? true : navigator.onLine,
  pendingSyncCount: 0,
  syncStatus: 'idle',
  setStore: (storeId) => set({ storeId }),
  setOwnerInfo: (ownerId, hasOwnerPin) => set({ ownerId, hasOwnerPin }),
  signInCashier: (cashier) => {
    rememberMember(cashier.memberId);
    set({ cashier, ownerUnlockedUntil: null });
  },
  signOutCashier: () => {
    rememberMember(null);
    set({ cashier: null, ownerUnlockedUntil: null });
  },
  unlockOwner: (now = Date.now()) => set({ ownerUnlockedUntil: now + OWNER_UNLOCK_MS }),
  touchOwner: (now = Date.now()) => {
    if (get().ownerUnlockedUntil !== null) set({ ownerUnlockedUntil: now + OWNER_UNLOCK_MS });
  },
  lockOwner: () => set({ ownerUnlockedUntil: null }),
  setOnline: (isOnline) => set({ isOnline }),
  setPendingSyncCount: (pendingSyncCount) => set({ pendingSyncCount }),
  setSyncStatus: (syncStatus) => set({ syncStatus }),
}));
