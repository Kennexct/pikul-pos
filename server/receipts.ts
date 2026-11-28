import { accountFromBearer } from './auth';
import { checkEmailAddress, checkReceiptDoc, checkReceiptPng, isReceiptToken, RECEIPT_TTL_MS } from './receiptCheck';
import { missingReceiptPage, receiptEmailHtml, receiptEmailText, receiptPage } from './receiptHtml';
import { isUuid } from './syncCheck';
import type { ApiResponse, Deps } from './types';

/**
 * Shared receipts (ADR-028). The device uploads its formatted copy + PNG after the cashier shares a receipt
 * (never on the sell path); anyone with the unguessable link sees it for 90 days. Email goes through Resend.
 */

export const MAX_RECEIPT_EMAILS_PER_DAY = 100;
const DAY_MS = 86_400_000;
const bad = (error: string, status = 400): ApiResponse => ({ status, body: { error } });
const signedOut = bad('signed_out', 401);
const html = (status: number, content: string): ApiResponse => ({ status, body: null, text: { contentType: 'text/html; charset=utf-8', content } });

export const receiptLink = (deps: Deps, token: string) => `${deps.appOrigin}/r/${token}`;

/** POST /api/receipts/share {token, orderId, doc, png} — create or refresh a shared receipt of this account. */
export async function shareReceipt(deps: Deps, auth: string | null, body: unknown): Promise<ApiResponse> {
  const account = await accountFromBearer(deps, auth);
  if (!account) return signedOut;
  const b = (body ?? {}) as Record<string, unknown>;
  if (!isReceiptToken(b.token)) return bad('invalid_token');
  if (!isUuid(b.orderId)) return bad('invalid_order');
  const doc = checkReceiptDoc(b.doc);
  if (!doc) return bad('invalid_doc');
  const image = checkReceiptPng(b.png);
  if (!image) return bad('invalid_image');
  const now = deps.now();
  const old = await deps.repo.getReceiptShare(b.token);
  if (old && old.orderId !== b.orderId) return bad('token_taken', 409);
  const createdAt = old?.createdAt ?? now;
  const ok = await deps.repo.putReceiptShare({ token: b.token, accountId: account.id, orderId: b.orderId, doc, image, createdAt, updatedAt: now, expiresAt: createdAt + RECEIPT_TTL_MS });
  if (!ok) return bad('token_taken', 409);
  await deps.repo.deleteExpiredReceiptShares(now);
  return { status: 200, body: { ok: true, url: receiptLink(deps, b.token), expiresAt: createdAt + RECEIPT_TTL_MS } };
}

/** POST /api/receipts/email {token, to} — email an uploaded receipt (PNG attached) to one customer address. */
export async function emailReceipt(deps: Deps, auth: string | null, body: unknown): Promise<ApiResponse> {
  const account = await accountFromBearer(deps, auth);
  if (!account) return signedOut;
  const b = (body ?? {}) as Record<string, unknown>;
  if (!isReceiptToken(b.token)) return bad('invalid_token');
  const to = checkEmailAddress(b.to);
  if (!to) return bad('invalid_email');
  if (!deps.mailer.sendReceipt) return bad('email_disabled', 503);
  const now = deps.now();
  const share = await deps.repo.getReceiptShare(b.token);
  if (!share || share.accountId !== account.id || share.expiresAt < now) return bad('not_found', 404);
  const key = `receipt_mail:${account.id}`;
  if ((await deps.repo.countRate(key, now - DAY_MS)) >= MAX_RECEIPT_EMAILS_PER_DAY) return bad('too_many', 429);
  await deps.repo.addRate(key, now);
  const link = receiptLink(deps, share.token);
  const doc = share.doc;
  const word = doc.lang === 'en' ? 'Receipt' : 'Struk';
  await deps.mailer.sendReceipt({
    to,
    fromName: doc.shop.name,
    replyTo: account.email || null,
    subject: `${word} ${doc.receiptNo} · ${doc.shop.name}${doc.banner ? ` (${doc.banner})` : ''}`,
    html: receiptEmailHtml(doc, link),
    text: receiptEmailText(doc, link),
    png: share.image,
    fileName: `struk-${doc.receiptNo.replace(/[^A-Za-z0-9-]/g, '')}.png`,
  });
  return { status: 200, body: { ok: true } };
}

/** GET /r/<token> — the public receipt page (noindex). */
export async function receiptPageRoute(deps: Deps, token: string): Promise<ApiResponse> {
  const share = await deps.repo.getReceiptShare(token);
  if (!share || share.expiresAt < deps.now()) return html(404, missingReceiptPage());
  const v = share.updatedAt.toString(36);
  return html(200, receiptPage(share.doc, `${receiptLink(deps, token)}.png?v=${v}`, `/r/${token}.png?v=${v}`));
}

/** GET /r/<token>.png — the receipt image. */
export async function receiptImageRoute(deps: Deps, token: string): Promise<ApiResponse> {
  const share = await deps.repo.getReceiptShare(token);
  if (!share || share.expiresAt < deps.now()) return bad('not_found', 404);
  return { status: 200, body: null, raw: { contentType: 'image/png', bytes: share.image }, cacheSeconds: 300 };
}
