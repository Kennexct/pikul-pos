import { exportJWK, generateKeyPair } from 'jose';
import { beforeEach, describe, expect, it } from 'vitest';
import { memoryRepo } from './memoryRepo';
import { passSigner } from './pass';
import { hashPassword, temporaryPassword, verifyPassword } from './password';
import { route } from './router';
import { MAX_LOGIN_FAILS_PER_EMAIL, MAX_SIGNUPS_PER_IP, normalizePhone } from './signup';
import type { Deps } from './types';

const T0 = Date.UTC(2026, 10, 21, 3);
const PASSWORD = 'admin-kata-sandi-panjang';
let now = T0;
let mail: { email: string; code: string }[];
let repo: ReturnType<typeof memoryRepo>;
let deps: Deps;

beforeEach(async () => {
  now = T0;
  mail = [];
  repo = memoryRepo();
  const kp = await generateKeyPair('ES256', { extractable: true });
  deps = {
    repo,
    mailer: { sendLoginCode: async (email, code) => void mail.push({ email, code }) },
    signer: await passSigner({ ...(await exportJWK(kp.privateKey)), kid: 't1' }),
    google: null,
    now: () => now,
    appOrigin: 'https://pikul.test',
    adminPassword: PASSWORD,
    emailEnabled: true,
  };
});

const call = (method: string, path: string, body?: unknown, auth?: string, ip = '10.0.0.1') =>
  route(deps, method, path, auth ? `Bearer ${auth}` : null, body === undefined ? '' : JSON.stringify(body), { ip, query: new URLSearchParams() });
const form = (over: Record<string, unknown> = {}) => ({ email: 'Siti@Warung.id', password: 'rahasia-123', ownerName: ' Siti  Aminah ', storeName: 'Warung Siti', phone: '0812-3456-7890', city: 'Bandung', ...over });
const session = (r: { body: unknown }) => r.body as { refreshToken: string; account: { email: string; plan: string } };

describe('password hashing', () => {
  it('verifies the right password only, and rejects malformed hashes', async () => {
    const h = await hashPassword('rahasia-123', 1_000);
    expect(h.startsWith('pbkdf2$1000$')).toBe(true);
    expect(await verifyPassword('rahasia-123', h)).toBe(true);
    expect(await verifyPassword('rahasia-124', h)).toBe(false);
    expect(await verifyPassword('x', null)).toBe(false);
    expect(await verifyPassword('x', 'pbkdf2$abc$$')).toBe(false);
  });
  it('makes 12-character temporary passwords without look-alike characters', () => {
    const p = temporaryPassword();
    expect(p).toMatch(/^[a-km-np-zA-HJ-NP-Z2-9]{12}$/);
  });
});

describe('phone numbers', () => {
  it('normalises Indonesian mobile numbers to 62…', () => {
    expect(normalizePhone('0812 3456 7890')).toBe('6281234567890');
    expect(normalizePhone('+62 812-3456-7890')).toBe('6281234567890');
    expect(normalizePhone('81234567890')).toBe('6281234567890');
    expect(normalizePhone('021 555 1234')).toBeNull();
    expect(normalizePhone('0812abc')).toBeNull();
  });
});

describe('sign-up', () => {
  it('creates the account with the profile, a 14-day trial and a session; the admin sees every field', async () => {
    const r = await call('POST', '/api/auth/signup', form());
    expect(r.status).toBe(200);
    expect(session(r).account).toMatchObject({ email: 'siti@warung.id', plan: 'trial' });
    const a = [...repo.accounts.values()][0];
    expect(a).toMatchObject({ ownerName: 'Siti Aminah', storeName: 'Warung Siti', phone: '6281234567890', city: 'Bandung', trialEndsAt: T0 + 14 * 86_400_000 });
    expect(JSON.stringify(a)).not.toContain('pbkdf2');

    const admin = ((await call('POST', '/api/admin/login', { password: PASSWORD })).body as { token: string }).token;
    const list = (await call('GET', '/api/admin/merchants', undefined, admin)).body as { rows: Record<string, unknown>[] };
    expect(list.rows[0]).toMatchObject({ email: 'siti@warung.id', ownerName: 'Siti Aminah', storeName: 'Warung Siti', phone: '6281234567890', city: 'Bandung' });
    expect(JSON.stringify(list)).not.toContain('pbkdf2');
    const byPhone = await route(deps, 'GET', '/api/admin/merchants', `Bearer ${admin}`, '', { ip: '', query: new URLSearchParams('q=0812345') });
    expect((byPhone.body as { total: number }).total).toBe(1);
    const csv = await route(deps, 'GET', '/api/admin/merchants', `Bearer ${admin}`, '', { ip: '', query: new URLSearchParams('format=csv') });
    expect(csv.text?.content).toContain('Warung Siti,Siti Aminah,siti@warung.id,6281234567890,Bandung');
  });

  it('refuses a taken email, weak passwords and missing fields', async () => {
    await call('POST', '/api/auth/signup', form());
    expect((await call('POST', '/api/auth/signup', form({ email: 'SITI@warung.id' }))).body).toEqual({ error: 'email_taken' });
    expect((await call('POST', '/api/auth/signup', form({ email: 'b@c.id', password: 'short' }))).body).toEqual({ error: 'weak_password' });
    expect((await call('POST', '/api/auth/signup', form({ email: 'b@c.id', ownerName: 'A' }))).body).toEqual({ error: 'invalid_owner_name' });
    expect((await call('POST', '/api/auth/signup', form({ email: 'b@c.id', storeName: '' }))).body).toEqual({ error: 'invalid_store_name' });
    expect((await call('POST', '/api/auth/signup', form({ email: 'b@c.id', phone: '12' }))).body).toEqual({ error: 'invalid_phone' });
    expect((await call('POST', '/api/auth/signup', form({ email: 'b@c.id', city: 'x' }))).body).toEqual({ error: 'invalid_city' });
    expect((await call('POST', '/api/auth/signup', form({ email: 'nope' }))).body).toEqual({ error: 'invalid_email' });
    expect(repo.accounts.size).toBe(1);
  });

  it('limits sign-ups per network', async () => {
    for (let i = 0; i < MAX_SIGNUPS_PER_IP; i++) expect((await call('POST', '/api/auth/signup', form({ email: `m${i}@w.id` }))).status).toBe(200);
    expect((await call('POST', '/api/auth/signup', form({ email: 'late@w.id' }))).status).toBe(429);
    now += 61 * 60_000;
    expect((await call('POST', '/api/auth/signup', form({ email: 'late@w.id' }))).status).toBe(200);
  });
});

describe('password sign-in', () => {
  beforeEach(async () => void (await call('POST', '/api/auth/signup', form())));

  it('signs in with the right password; same answer for wrong password and unknown email', async () => {
    expect((await call('POST', '/api/auth/login', { email: 'siti@warung.id', password: 'rahasia-123' })).status).toBe(200);
    expect((await call('POST', '/api/auth/login', { email: 'siti@warung.id', password: 'salah-sekali' })).body).toEqual({ error: 'wrong_credentials' });
    expect((await call('POST', '/api/auth/login', { email: 'ghost@warung.id', password: 'rahasia-123' })).body).toEqual({ error: 'wrong_credentials' });
  });

  it('locks an email after 5 wrong passwords for 15 minutes', async () => {
    for (let i = 0; i < MAX_LOGIN_FAILS_PER_EMAIL; i++) await call('POST', '/api/auth/login', { email: 'siti@warung.id', password: 'salah' }, undefined, `10.0.1.${i}`);
    expect((await call('POST', '/api/auth/login', { email: 'siti@warung.id', password: 'rahasia-123' })).body).toEqual({ error: 'locked' });
    now += 16 * 60_000;
    expect((await call('POST', '/api/auth/login', { email: 'siti@warung.id', password: 'rahasia-123' })).status).toBe(200);
  });
});

describe('forgot, change and temporary passwords', () => {
  let token = '';
  beforeEach(async () => {
    token = session(await call('POST', '/api/auth/signup', form())).refreshToken;
  });

  it('resets with an emailed code and signs other devices out', async () => {
    expect((await call('GET', '/api/auth/options')).body).toEqual({ emailReset: true, google: false });
    await call('POST', '/api/auth/code', { email: 'siti@warung.id' });
    const code = mail[0]!.code;
    expect((await call('POST', '/api/auth/reset', { email: 'siti@warung.id', code, password: 'baru-sekali-1' })).status).toBe(200);
    expect((await call('POST', '/api/auth/refresh', { refreshToken: token })).status).toBe(401);
    expect((await call('POST', '/api/auth/login', { email: 'siti@warung.id', password: 'baru-sekali-1' })).status).toBe(200);
  });

  it('has no email reset without a mail provider', async () => {
    deps = { ...deps, emailEnabled: false };
    expect((await call('GET', '/api/auth/options')).body).toEqual({ emailReset: false, google: false });
    expect((await call('POST', '/api/auth/code', { email: 'siti@warung.id' })).status).toBe(404);
    expect((await call('POST', '/api/auth/reset', { email: 'siti@warung.id', code: '123456', password: 'baru-sekali-1' })).status).toBe(404);
  });

  it('changes the password with the current one', async () => {
    expect((await call('POST', '/api/auth/password', { current: 'salah', password: 'baru-sekali-1' }, token)).body).toEqual({ error: 'wrong_password' });
    const r = await call('POST', '/api/auth/password', { current: 'rahasia-123', password: 'baru-sekali-1' }, token);
    expect(r.status).toBe(200);
    expect((await call('POST', '/api/auth/refresh', { refreshToken: token })).status).toBe(401);
    expect((await call('POST', '/api/auth/refresh', { refreshToken: session(r).refreshToken })).status).toBe(200);
  });

  it('admin creates a one-time temporary password, audited; merchants cannot', async () => {
    const id = [...repo.accounts.keys()][0]!;
    expect((await call('POST', `/api/admin/merchants/${id}/temp-password`, {}, token)).status).toBe(401);
    const admin = ((await call('POST', '/api/admin/login', { password: PASSWORD })).body as { token: string }).token;
    const r = await call('POST', `/api/admin/merchants/${id}/temp-password`, {}, admin);
    const { password } = r.body as { password: string };
    expect(password).toHaveLength(12);
    expect((await call('POST', '/api/auth/refresh', { refreshToken: token })).status).toBe(401);
    expect((await call('POST', '/api/auth/login', { email: 'siti@warung.id', password })).status).toBe(200);
    expect(repo.audit.at(-1)).toMatchObject({ action: 'merchant.temp_password', target: id, detail: null });
  });
});
