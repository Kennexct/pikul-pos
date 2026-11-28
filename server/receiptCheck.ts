import { sniffImage } from './images';
import { RECEIPT_LINE_KINDS, type ReceiptDoc, type ReceiptLine } from './receiptTypes';

export const RECEIPT_TTL_MS = 90 * 86_400_000;
export const MAX_RECEIPT_PNG = 300_000;
export const MAX_RECEIPT_DOC_CHARS = 64_000;
export const RECEIPT_BODY_LIMIT = Math.ceil((MAX_RECEIPT_PNG * 4) / 3) + MAX_RECEIPT_DOC_CHARS + 1_024;
const MAX_LINES = 400;

export const isReceiptToken = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_-]{22}$/.test(v);

const CONTROL = /[\u0000-\u0008\u000b-\u001f\u007f]/;
const text = (v: unknown, max: number, allowEmpty = true): string | null => {
  if (typeof v !== 'string' || v.length > max || CONTROL.test(v)) return null;
  if (!allowEmpty && v.trim() === '') return null;
  return v;
};

function line(v: unknown): ReceiptLine | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  if (!(RECEIPT_LINE_KINDS as readonly unknown[]).includes(o.k)) return null;
  const l = text(o.l, 200);
  if (l === null) return null;
  if (o.r === undefined) return { k: o.k as ReceiptLine['k'], l };
  const r = text(o.r, 120);
  return r === null ? null : { k: o.k as ReceiptLine['k'], l, r };
}

/** The receipt copy a device sends; refuses anything that is not plain short text in the known shape. */
export function checkReceiptDoc(v: unknown): ReceiptDoc | null {
  if (!v || typeof v !== 'object' || JSON.stringify(v).length > MAX_RECEIPT_DOC_CHARS) return null;
  const o = v as Record<string, unknown>;
  const s = (o.shop ?? {}) as Record<string, unknown>;
  const shop = { name: text(s.name, 120, false), address: text(s.address, 240), phone: text(s.phone, 40), header: text(s.header, 240) };
  const receiptNo = text(o.receiptNo, 40, false);
  const footer = text(o.footer, 500);
  const total = text(o.total, 40, false);
  const banner = text(o.banner, 120);
  if (o.v !== 1 || receiptNo === null || footer === null || total === null || banner === null) return null;
  if (shop.name === null || shop.address === null || shop.phone === null || shop.header === null) return null;
  if (o.lang !== 'id' && o.lang !== 'en') return null;
  if (!Array.isArray(o.lines) || o.lines.length > MAX_LINES) return null;
  const lines: ReceiptLine[] = [];
  for (const raw of o.lines) {
    const l = line(raw);
    if (!l) return null;
    lines.push(l);
  }
  return { v: 1, receiptNo, shop: { name: shop.name, address: shop.address, phone: shop.phone, header: shop.header }, lines, footer, total, banner, lang: o.lang };
}

/** Base64 PNG from the device, at most MAX_RECEIPT_PNG bytes. */
export function checkReceiptPng(v: unknown): Uint8Array | null {
  if (typeof v !== 'string' || v.length > Math.ceil((MAX_RECEIPT_PNG * 4) / 3) + 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(v)) return null;
  let bytes: Uint8Array;
  try {
    bytes = Uint8Array.from(atob(v), (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
  return bytes.length <= MAX_RECEIPT_PNG && sniffImage(bytes) === 'image/png' ? bytes : null;
}

/** A single plain address (no name part, no list). */
export function checkEmailAddress(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const e = v.trim().toLowerCase();
  return e.length <= 254 && /^[^\s@<>,;"'()]+@[^\s@<>,;"'()]+\.[a-z]{2,}$/.test(e) ? e : null;
}
