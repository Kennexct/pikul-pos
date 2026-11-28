/** Shared receipts (ADR-028): the device's formatted copy of one receipt, opened at /r/<token>. */

export const RECEIPT_LINE_KINDS = ['meta', 'item', 'sub', 'line', 'total', 'rule', 'alert', 'note'] as const;
export type ReceiptLineKind = (typeof RECEIPT_LINE_KINDS)[number];

/** One row of the receipt: label on the left, optional value on the right. Text is already formatted by the device. */
export interface ReceiptLine {
  k: ReceiptLineKind;
  l: string;
  r?: string;
}

/** Everything the page, the email and the image show. Never holds the customer's phone or email. */
export interface ReceiptDoc {
  v: 1;
  receiptNo: string;
  shop: { name: string; address: string; phone: string; header: string };
  lines: ReceiptLine[];
  footer: string;
  /** Formatted grand total ("Rp25.000"), for the link preview and the email subject. */
  total: string;
  /** Banner over the receipt ("Dibatalkan", "Dikembalikan Rp5.000"); '' when paid normally. */
  banner: string;
  lang: 'id' | 'en';
}

export interface ReceiptShare {
  token: string;
  accountId: string;
  orderId: string;
  doc: ReceiptDoc;
  image: Uint8Array;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
}

export interface ReceiptRepo {
  getReceiptShare(token: string): Promise<ReceiptShare | null>;
  /** Insert, or update doc + image of the same account's row. False when the token belongs to another account. */
  putReceiptShare(s: ReceiptShare): Promise<boolean>;
  deleteExpiredReceiptShares(now: number): Promise<number>;
}
