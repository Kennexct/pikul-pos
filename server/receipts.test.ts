import { exportJWK, generateKeyPair } from 'jose';
import { beforeEach, describe, expect, it } from 'vitest';
import { receiptFrom } from './mailer';
import { memoryRepo } from './memoryRepo';
import { passSigner } from './pass';
import { checkEmailAddress, checkReceiptDoc, RECEIPT_TTL_MS } from './receiptCheck';
import { MAX_RECEIPT_EMAILS_PER_DAY } from './receipts';
import { route } from './router';
import { signUpOrIn } from './testSignup';
import type { Deps, ReceiptMail } from './types';

const T0 = Date.UTC(2026, 10, 28, 3);
const ORDER = '0193a000-0000-7000-8000-000000000201';
const OTHER_ORDER = '0193a000-0000-7000-8000-000000000202';
const TOKEN = 'AbCdEfGhIjKlMnOpQrStUv';
// 1×1 transparent PNG
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
let now = T0;
let deps: Deps;
let sent: ReceiptMail[];

const doc = (over: Record<string, unknown> = {}) => ({
  v: 1,
  receiptNo: 'INV-20261128-A001',
  shop: { name: 'Kopi <Sari>', address: 'Jl. Melati 1', phone: '0812', header: '' },
  lines: [
    { k: 'meta', l: 'No', r: 'INV-20261128-A001' },
    { k: 'meta', l: 'Pelanggan', r: 'Budi' },
    { k: 'rule', l: '' },
    { k: 'item', l: 'Es kopi' },
    { k: 'sub', l: '2 × Rp12.500', r: 'Rp25.000' },
    { k: 'total', l: 'TOTAL', r: 'Rp25.000' },
  ],
  footer: 'Terima kasih',
  total: 'Rp25.000',
  banner: '',
  lang: 'id',
  ...over,
});

beforeEach(async () => {
  now = T0;
  sent = [];
  const kp = await generateKeyPair('ES256', { extractable: true });
  deps = {
    repo: memoryRepo(),
    mailer: { sendLoginCode: async () => undefined, sendReceipt: async (m) => void sent.push(m) },
    signer: await passSigner({ ...(await exportJWK(kp.privateKey)), kid: 't1' }),
    google: null,
    now: () => now,
    appOrigin: 'https://pikul.test',
    adminPassword: null,
    emailEnabled: true,
  };
});

const call = (method: string, path: string, token: string | null, body?: unknown) =>
  route(deps, method, path, token ? `Bearer ${token}` : null, body === undefined ? '' : JSON.stringify(body), { ip: '10.0.0.1', query: new URLSearchParams() });
const tokenFor = async (email: string) => ((await signUpOrIn(deps, email)).body as { refreshToken: string }).refreshToken;
const share = (t: string | null, over: Record<string, unknown> = {}) => call('POST', '/api/receipts/share', t, { token: TOKEN, orderId: ORDER, doc: doc(), png: PNG, ...over });

describe('receipt share', () => {
  it('needs a signed-in account', async () => {
    expect((await share(null)).status).toBe(401);
  });

  it('stores the receipt and serves an escaped, unindexed page with a preview image', async () => {
    const t = await tokenFor('a@x.id');
    const res = await share(t);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ url: `https://pikul.test/r/${TOKEN}`, expiresAt: T0 + RECEIPT_TTL_MS });
    const page = await call('GET', `/r/${TOKEN}`, null);
    expect(page.status).toBe(200);
    const htmlText = page.text!.content;
    expect(page.text!.contentType).toContain('text/html');
    expect(htmlText).toContain('Kopi &lt;Sari&gt;');
    expect(htmlText).not.toContain('Kopi <Sari>');
    expect(htmlText).toContain('noindex');
    expect(htmlText).toContain(`og:image" content="https://pikul.test/r/${TOKEN}.png?v=`);
    const img = await call('GET', `/r/${TOKEN}.png`, null);
    expect(img.raw?.contentType).toBe('image/png');
    expect(img.raw?.bytes.length).toBeGreaterThan(20);
  });

  it('refuses bad input: token, doc shape, non-PNG image', async () => {
    const t = await tokenFor('a@x.id');
    expect((await share(t, { token: 'short' })).body).toEqual({ error: 'invalid_token' });
    expect((await share(t, { doc: doc({ lines: [{ k: 'script', l: 'x' }] }) })).body).toEqual({ error: 'invalid_doc' });
    expect((await share(t, { doc: doc({ footer: 'a\u0000b' }) })).body).toEqual({ error: 'invalid_doc' });
    expect((await share(t, { png: btoa('<svg onload=alert(1)>') })).body).toEqual({ error: 'invalid_image' });
  });

  it('updates the same receipt (void banner) but keeps its expiry; another account cannot take the token', async () => {
    const a = await tokenFor('a@x.id');
    await share(a);
    now = T0 + 86_400_000;
    expect((await share(a, { doc: doc({ banner: 'Dibatalkan' }) })).body).toMatchObject({ expiresAt: T0 + RECEIPT_TTL_MS });
    expect((await call('GET', `/r/${TOKEN}`, null)).text!.content).toContain('Dibatalkan');
    const b = await tokenFor('b@x.id');
    expect((await share(b)).status).toBe(409);
    expect((await share(a, { orderId: OTHER_ORDER })).status).toBe(409);
  });

  it('expires after 90 days and is deleted on a later share', async () => {
    const t = await tokenFor('a@x.id');
    await share(t);
    now = T0 + RECEIPT_TTL_MS + 1;
    const page = await call('GET', `/r/${TOKEN}`, null);
    expect(page.status).toBe(404);
    expect(page.text!.content).toContain('kedaluwarsa');
    expect((await call('GET', `/r/${TOKEN}.png`, null)).status).toBe(404);
    await share(t, { token: 'ZZZZZZZZZZZZZZZZZZZZZZ', orderId: OTHER_ORDER });
    expect(await deps.repo.getReceiptShare(TOKEN)).toBeNull();
  });
});

describe('receipt email', () => {
  it('sends the receipt with the PNG attached, from the shop via Pikul, reply-to the owner', async () => {
    const t = await tokenFor('owner@x.id');
    await share(t);
    const res = await call('POST', '/api/receipts/email', t, { token: TOKEN, to: ' Budi@Mail.com ' });
    expect(res.status).toBe(200);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ to: 'budi@mail.com', fromName: 'Kopi <Sari>', replyTo: 'owner@x.id', subject: 'Struk INV-20261128-A001 · Kopi <Sari>', fileName: 'struk-INV-20261128-A001.png' });
    expect(sent[0]!.html).toContain(`https://pikul.test/r/${TOKEN}`);
    expect(sent[0]!.text).toContain('Es kopi');
    expect(sent[0]!.png.length).toBeGreaterThan(20);
  });

  it('refuses another account, bad addresses, no mailer, and more than the daily cap', async () => {
    const a = await tokenFor('a@x.id');
    await share(a);
    const b = await tokenFor('b@x.id');
    expect((await call('POST', '/api/receipts/email', b, { token: TOKEN, to: 'c@x.id' })).status).toBe(404);
    expect((await call('POST', '/api/receipts/email', a, { token: TOKEN, to: 'a@x.id, b@x.id' })).body).toEqual({ error: 'invalid_email' });
    for (let i = 0; i < MAX_RECEIPT_EMAILS_PER_DAY; i++) await call('POST', '/api/receipts/email', a, { token: TOKEN, to: 'c@x.id' });
    expect((await call('POST', '/api/receipts/email', a, { token: TOKEN, to: 'c@x.id' })).status).toBe(429);
    deps.mailer = { sendLoginCode: async () => undefined };
    expect((await call('POST', '/api/receipts/email', a, { token: TOKEN, to: 'c@x.id' })).status).toBe(503);
    expect((await call('GET', '/api/auth/options', null)).body).toMatchObject({ receiptEmail: false });
  });
});

describe('receipt helpers', () => {
  it('builds the sender from MAIL_FROM and a cleaned shop name', () => {
    expect(receiptFrom('Pikul <noreply@pikul.id>', 'Kopi "Sari"\n<x>')).toBe('"Kopi Sarix via Pikul" <noreply@pikul.id>');
    expect(receiptFrom('noreply@pikul.id', '')).toBe('Pikul <noreply@pikul.id>');
  });
  it('accepts one plain address only', () => {
    expect(checkEmailAddress('a.b+c@toko.co.id')).toBe('a.b+c@toko.co.id');
    expect(checkEmailAddress('Budi <b@x.id>')).toBeNull();
    expect(checkEmailAddress('b@x')).toBeNull();
  });
  it('never accepts unknown fields into the stored copy', () => {
    const d = checkReceiptDoc({ ...doc(), phone: '0812', extra: 1 });
    expect(d && 'phone' in d).toBe(false);
  });
});
