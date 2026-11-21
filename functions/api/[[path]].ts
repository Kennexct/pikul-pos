/// <reference types="@cloudflare/workers-types" />
import { consoleMailer, resendMailer } from '../../server/mailer';
import { memoryRepo } from '../../server/memoryRepo';
import { neonRepo } from '../../server/neonRepo';
import { googleVerifier, passSigner } from '../../server/pass';
import { route } from '../../server/router';
import type { Deps, PassSigner } from '../../server/types';

interface Env {
  DATABASE_URL?: string;
  RESEND_API_KEY?: string;
  MAIL_FROM?: string;
  PASS_PRIVATE_JWK: string;
  GOOGLE_CLIENT_ID?: string;
  APP_ORIGIN: string;
  ADMIN_PASSWORD?: string; // /admin sign-in (ADR-020); at least 12 characters, else the console is closed
  DEV_MODE?: string; // "1" only in `wrangler pages dev`: memory DB + console mail
}

let devRepo: ReturnType<typeof memoryRepo> | null = null;
let signerCache: { jwk: string; signer: PassSigner } | null = null;

async function deps(env: Env): Promise<Deps> {
  const dev = env.DEV_MODE === '1';
  if (!dev && (!env.DATABASE_URL || !env.RESEND_API_KEY || !env.MAIL_FROM)) throw new Error('missing_config');
  if (signerCache?.jwk !== env.PASS_PRIVATE_JWK) signerCache = { jwk: env.PASS_PRIVATE_JWK, signer: await passSigner(JSON.parse(env.PASS_PRIVATE_JWK)) };
  return {
    repo: env.DATABASE_URL ? neonRepo(env.DATABASE_URL) : (devRepo ??= memoryRepo()),
    mailer: env.RESEND_API_KEY && env.MAIL_FROM ? resendMailer(env.RESEND_API_KEY, env.MAIL_FROM) : consoleMailer,
    signer: signerCache.signer,
    google: env.GOOGLE_CLIENT_ID ? googleVerifier(env.GOOGLE_CLIENT_ID) : null,
    now: Date.now,
    appOrigin: env.APP_ORIGIN.replace(/\/$/, ''),
    adminPassword: env.ADMIN_PASSWORD ?? null,
  };
}

const LANDING_CACHE_KEYS = ['/api/public/landing', '/api/public/app'];

export const onRequest: PagesFunction<Env> = async ({ request, env, waitUntil }) => {
  const url = new URL(request.url);
  const headers: Record<string, string> = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
  const isPublicGet = request.method === 'GET' && url.pathname.startsWith('/api/public/');
  const cache = (caches as unknown as { default: Cache }).default;
  const cacheKey = new Request(url.origin + url.pathname);
  try {
    if (isPublicGet) {
      const hit = await cache.match(cacheKey);
      if (hit) return hit;
    }
    const raw = request.method === 'GET' ? '' : await request.text();
    const ctx = { ip: request.headers.get('CF-Connecting-IP') ?? '', query: url.searchParams };
    const res = await route(await deps(env), request.method, url.pathname, request.headers.get('Authorization'), raw, ctx);
    if (res.purgePublic) waitUntil(Promise.all(LANDING_CACHE_KEYS.map((k) => cache.delete(new Request(url.origin + k)))));
    if (res.cacheSeconds && res.status === 200) headers['Cache-Control'] = `public, max-age=${res.cacheSeconds}`;
    if (res.text) {
      const h: Record<string, string> = { ...headers, 'Content-Type': res.text.contentType };
      if (res.text.filename) h['Content-Disposition'] = `attachment; filename="${res.text.filename}"`;
      return new Response(res.text.content, { status: res.status, headers: h });
    }
    const out = res.raw
      ? new Response(res.raw.bytes.slice().buffer as ArrayBuffer, { status: res.status, headers: { ...headers, 'Content-Type': res.raw.contentType, 'X-Content-Type-Options': 'nosniff' } })
      : new Response(JSON.stringify(res.body), { status: res.status, headers });
    if (isPublicGet && res.cacheSeconds && res.status === 200) waitUntil(cache.put(cacheKey, out.clone()));
    return out;
  } catch (err) {
    console.error('api_error', url.pathname, err instanceof Error ? err.message : err);
    return new Response(JSON.stringify({ error: 'server_error' }), { status: 500, headers });
  }
};
