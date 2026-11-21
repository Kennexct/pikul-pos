import { exportJWK, generateKeyPair } from 'jose';
import { EventEmitter } from 'node:events';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { describe, expect, it } from 'vitest';
import { clientIp, depsFromEnv, handle } from './vercel';

function fakeReq(method: string, url: string, headers: Record<string, string>, body = ''): IncomingMessage {
  const req = Object.assign(new EventEmitter(), { method, url, headers }) as unknown as IncomingMessage;
  (req as unknown as { [Symbol.asyncIterator]: () => AsyncGenerator<Buffer> })[Symbol.asyncIterator] = async function* () {
    if (body) yield Buffer.from(body);
  };
  return req;
}
function fakeRes() {
  const out = { status: 0, headers: {} as Record<string, string>, body: '' };
  const res = {
    set statusCode(v: number) {
      out.status = v;
    },
    setHeader: (k: string, v: string) => void (out.headers[k.toLowerCase()] = v),
    end: (b: string | Uint8Array) => void (out.body = typeof b === 'string' ? b : Buffer.from(b).toString()),
  } as unknown as ServerResponse;
  return { res, out };
}

const env = async () => ({ DEV_MODE: '1', APP_ORIGIN: 'https://pikul.test/', PASS_PRIVATE_JWK: JSON.stringify({ ...(await exportJWK((await generateKeyPair('ES256', { extractable: true })).privateKey)), kid: 't' }), ADMIN_PASSWORD: 'admin-kata-sandi-panjang' });

describe('Vercel adapter (ADR-022)', () => {
  it('routes /api requests to the server code and caches public data at the CDN for a minute', async () => {
    const e = await env();
    const signup = fakeRes();
    await handle(fakeReq('POST', '/api/auth/signup', { 'x-real-ip': '203.0.113.9' }, JSON.stringify({ email: 'a@b.id', password: 'rahasia-123', ownerName: 'Ani', storeName: 'Toko Ani', phone: '081234567890', city: 'Solo' })), signup.res, e);
    expect(signup.out.status).toBe(200);
    expect(JSON.parse(signup.out.body)).toHaveProperty('refreshToken');
    const landing = fakeRes();
    await handle(fakeReq('GET', '/api/public/landing', {}), landing.res, e);
    expect(landing.out.headers['cache-control']).toBe('public, max-age=60, s-maxage=60');
    const missing = fakeRes();
    await handle(fakeReq('GET', '/api/nope?x=1', {}), missing.res, e);
    expect(missing.out.status).toBe(404);
  });

  it('refuses to run without a database in production, even with DEV_MODE', async () => {
    const e = await env();
    await expect(depsFromEnv({ ...e, VERCEL_ENV: 'production' })).rejects.toThrow('DATABASE_URL');
    await expect(depsFromEnv({ ...e, PASS_PRIVATE_JWK: undefined })).rejects.toThrow('PASS_PRIVATE_JWK');
    const r = fakeRes();
    await handle(fakeReq('GET', '/api/auth/options', {}), r.res, { ...e, VERCEL_ENV: 'production' });
    expect(r.out.status).toBe(500);
    expect(JSON.parse(r.out.body)).toEqual({ error: 'server_error' });
  });

  it('takes the client IP from x-real-ip, then x-forwarded-for', () => {
    expect(clientIp(fakeReq('GET', '/', { 'x-real-ip': '1.1.1.1', 'x-forwarded-for': '2.2.2.2' }))).toBe('1.1.1.1');
    expect(clientIp(fakeReq('GET', '/', { 'x-forwarded-for': '2.2.2.2, 10.0.0.1' }))).toBe('2.2.2.2');
  });
});
