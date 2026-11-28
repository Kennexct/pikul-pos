import { useEffect, useState } from 'react';
import { existingShare, linkableStore, newReceiptToken, receiptEmailAvailable } from '../../services/receiptShare';
import type { Id } from '../../types';

export interface ReceiptShareState {
  /** The store is signed in and syncing, so a web link and email are possible. */
  isLinkable: boolean;
  /** The token already sent for this receipt, or a fresh one kept only when the cashier shares. */
  token: string;
  isEmailAvailable: boolean;
}

/** Link state for one receipt (ADR-028). Reads only IndexedDB, plus one cached options call. */
export function useReceiptShare(orderId: Id): ReceiptShareState {
  const [state, setState] = useState<ReceiptShareState>(() => ({ isLinkable: false, token: newReceiptToken(), isEmailAvailable: false }));
  useEffect(() => {
    let isLive = true;
    void (async () => {
      const [isLinkable, share] = await Promise.all([linkableStore(), existingShare(orderId)]);
      if (!isLive) return;
      setState((s) => ({ ...s, isLinkable, token: share?.token ?? s.token }));
      if (!isLinkable) return;
      const isEmailAvailable = await receiptEmailAvailable();
      if (isLive) setState((s) => ({ ...s, isEmailAvailable }));
    })();
    return () => {
      isLive = false;
    };
  }, [orderId]);
  return state;
}
