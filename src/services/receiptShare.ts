import Dexie from 'dexie';
import { localDb } from '../db/localDb';
import { nowIso } from '../lib/id';
import { buildReceiptDoc } from '../lib/receiptDoc';
import { receiptPng } from '../lib/receiptImage';
import type { Id, ReceiptShareRow } from '../types';
import { ApiError, accountApi, authOptions } from './account';
import { getBinding } from './sync';

/**
 * Shared receipts (ADR-028). The link token is made on the device; the copy and its PNG reach the server
 * in the background after the cashier shares (never on the sell path). Emails wait here until online.
 */

const MAX_EMAIL_ATTEMPTS = 5;
const EMAIL_OPTION_KEY = 'kk.receiptEmail';

/** 16 random bytes as 22 base64url characters. */
export function newReceiptToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export const receiptUrl = (token: string, origin = typeof location === 'undefined' ? '' : location.origin) => `${origin}/r/${token}`;

/** The link this device can offer: only when the store is signed in and syncing (the server holds the copy). */
export async function linkableStore(): Promise<boolean> {
  return (await getBinding()) !== null;
}

export async function existingShare(orderId: Id): Promise<ReceiptShareRow | undefined> {
  return localDb.receiptShares.get(orderId);
}

/** Keeps the token the cashier is about to send (first share wins) and starts the upload. */
export async function markShared(orderId: Id, token: string, cashierName: string): Promise<string> {
  const kept = await localDb.transaction('rw', localDb.receiptShares, async () => {
    const old = await localDb.receiptShares.get(orderId);
    if (old) return old.token;
    await localDb.receiptShares.add({ orderId, token, cashierName, createdAt: nowIso() });
    return token;
  });
  void flushReceipts();
  return kept;
}

/** Queues an email of this receipt; it is sent once the copy is on the server. */
export async function queueReceiptEmail(orderId: Id, to: string, token: string, cashierName: string): Promise<void> {
  await markShared(orderId, token, cashierName);
  await localDb.receiptEmails.add({ orderId, to, queuedAt: nowIso(), attempts: 0 });
  void flushReceipts();
}

export async function pendingReceiptEmails(orderId: Id): Promise<number> {
  return localDb.receiptEmails.where('orderId').equals(orderId).filter((e) => e.attempts < MAX_EMAIL_ATTEMPTS).count();
}

const toBase64 = async (blob: Blob) => {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};

/** Uploads a shared receipt when the server's copy differs from the current one (new, voided, refunded). */
async function uploadShare(row: ReceiptShareRow): Promise<boolean> {
  const order = await localDb.orders.get(row.orderId);
  const store = order ? await localDb.stores.get(order.storeId) : undefined;
  if (!order || !store) return false;
  const refunds = await localDb.refunds.where('orderId').equals(order.id).sortBy('createdAt');
  const doc = buildReceiptDoc(order, store, row.cashierName, refunds);
  const json = JSON.stringify(doc);
  if (row.uploadedDoc === json) return true;
  const png = await toBase64(await receiptPng(doc));
  await accountApi('POST', '/api/receipts/share', { token: row.token, orderId: order.id, doc, png }, true);
  await localDb.receiptShares.update(row.orderId, { uploadedDoc: json, uploadedAt: nowIso(), lastError: undefined });
  return true;
}

async function sendEmails(): Promise<void> {
  const queued = await localDb.receiptEmails.orderBy('seq').filter((e) => e.attempts < MAX_EMAIL_ATTEMPTS).toArray();
  for (const e of queued) {
    const share = await localDb.receiptShares.get(e.orderId);
    if (!share?.uploadedAt) continue;
    try {
      await accountApi('POST', '/api/receipts/email', { token: share.token, to: e.to }, true);
      await localDb.receiptEmails.delete(e.seq!);
    } catch (error) {
      if (error instanceof ApiError && error.status === 0) throw error; // offline: try again later
      const final = error instanceof ApiError && [400, 404, 503].includes(error.status);
      await localDb.receiptEmails.update(e.seq!, { attempts: final ? MAX_EMAIL_ATTEMPTS : e.attempts + 1, lastError: error instanceof Error ? error.message : 'error' });
    }
  }
}

let running: Promise<void> | null = null;

/** Uploads shared receipts, then sends queued emails. One run at a time; never throws. Called after each share and each sync. */
export function flushReceipts(): Promise<void> {
  running ??= Dexie.ignoreTransaction(async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
      if (!(await getBinding())) return;
      const rows = await localDb.receiptShares.toArray();
      for (const row of rows) {
        try {
          await uploadShare(row);
        } catch (error) {
          if (error instanceof ApiError && (error.status === 0 || error.status === 401)) return;
          await localDb.receiptShares.update(row.orderId, { lastError: error instanceof Error ? error.message : 'error' });
        }
      }
      await sendEmails();
    } catch {
      /* offline or signed out: the next sync tries again */
    }
  }).finally(() => {
    running = null;
  });
  return running;
}

/** Whether the server can send receipt email (Resend set up). Remembered for offline use; unknown = yes. */
export async function receiptEmailAvailable(): Promise<boolean> {
  try {
    const ok = (await authOptions()).receiptEmail !== false;
    localStorage.setItem(EMAIL_OPTION_KEY, ok ? '1' : '0');
    return ok;
  } catch {
    try {
      return localStorage.getItem(EMAIL_OPTION_KEY) !== '0';
    } catch {
      return true;
    }
  }
}
