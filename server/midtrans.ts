import { safeEqual, sha512 } from './crypto';
import type { Midtrans, MidtransStatus, SnapResult } from './types';

/** Midtrans notification signature: SHA-512(order_id + status_code + gross_amount + server_key). */
export async function validSignature(n: { order_id?: unknown; status_code?: unknown; gross_amount?: unknown; signature_key?: unknown }, serverKey: string) {
  if (typeof n.order_id !== 'string' || typeof n.status_code !== 'string' || typeof n.gross_amount !== 'string' || typeof n.signature_key !== 'string') return false;
  const expected = await sha512(n.order_id + n.status_code + n.gross_amount + serverKey);
  return safeEqual(expected, n.signature_key.toLowerCase());
}

/** settlement, or capture that passed fraud screening. */
export const isPaidStatus = (status: string, fraud: string | null) =>
  status === 'settlement' || (status === 'capture' && (fraud === null || fraud === 'accept'));
export const isFailedStatus = (status: string) => ['deny', 'cancel', 'failure'].includes(status);

export function midtransClient(serverKey: string, production: boolean, fetchFn: typeof fetch = fetch): Midtrans {
  const snapBase = production ? 'https://app.midtrans.com' : 'https://app.sandbox.midtrans.com';
  const apiBase = production ? 'https://api.midtrans.com' : 'https://api.sandbox.midtrans.com';
  const auth = 'Basic ' + btoa(serverKey + ':');
  const headers = { Authorization: auth, Accept: 'application/json', 'Content-Type': 'application/json' };
  return {
    serverKey,
    async createSnap({ orderId, amount, itemId, itemName, email, finishUrl }): Promise<SnapResult> {
      const res = await fetchFn(`${snapBase}/snap/v1/transactions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          transaction_details: { order_id: orderId, gross_amount: amount },
          item_details: [{ id: itemId, price: amount, quantity: 1, name: itemName }],
          customer_details: { email },
          callbacks: { finish: finishUrl },
          expiry: { unit: 'hours', duration: 24 },
        }),
      });
      if (!res.ok) throw new Error(`midtrans_snap_${res.status}`);
      const j = (await res.json()) as { token: string; redirect_url: string };
      return { token: j.token, redirectUrl: j.redirect_url };
    },
    async getStatus(orderId): Promise<MidtransStatus | null> {
      const res = await fetchFn(`${apiBase}/v2/${encodeURIComponent(orderId)}/status`, { headers });
      if (!res.ok) return null;
      const j = (await res.json()) as { status_code?: string; transaction_status?: string; fraud_status?: string; gross_amount?: string; payment_type?: string };
      if (j.status_code === '404' || !j.transaction_status) return null;
      return { transactionStatus: j.transaction_status, fraudStatus: j.fraud_status ?? null, grossAmount: Math.round(Number(j.gross_amount)), paymentType: j.payment_type ?? null };
    },
  };
}

/** Dev only (DEV_MODE=1 and a "dev-" key): Snap "redirects" straight back; payments arrive as hand-signed notifications. */
export function devMidtrans(serverKey: string, appOrigin: string): Midtrans {
  return {
    serverKey,
    createSnap: async ({ orderId }) => ({ token: 'dev', redirectUrl: `${appOrigin.replace(/\/$/, '')}/app/pengaturan?tab=subscription&bayar=${encodeURIComponent(orderId)}` }),
    getStatus: async () => null,
  };
}
