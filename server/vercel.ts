import type { IncomingMessage, ServerResponse } from 'node:http';
import { consoleMailer, resendMailer } from './mailer';
import { memoryRepo } from './memoryRepo';
import { neonRepo } from './neonRepo';
import { googleVerifier, passSigner } from './pass';
import { route } from './router';
import type { Deps, PassSigner } from './types';

/**
 * Vercel Function entry (ADR-022). Bundled by scripts/vercel-build.mjs into .vercel/output/functions/api.func.
 * Node `(req, res)` → the framework-free router. Every /api/* path is routed here by .vercel/output/config.json.
 */
type Env = Record<string, string | undefined>;

let devRepo: ReturnType<typeof memoryRepo> | null = null;
let signerCache: { jwk: string; signer: PassSigner } | null = null;

export async function depsFromEnv(env: Env): Promise<Deps> {
  const dev = env.DEV_MODE === '1' && env.VERCEL_ENV !== 'production';
  if (!env.PASS_PRIVATE_JWK || !env.APP_ORIGIN) throw new Error('missing_config: PASS_PRIVATE_JWK and APP_ORIGIN are required');
  if (!dev && !env.DATABASE_URL) throw new Error('missing_config: DATABASE_URL is required');
  if (signerCache?.jwk !== env.PASS_PRIVATE_JWK) signerCache = { jwk: env.PASS_PRIVATE_JWK, signer: await passSigner(JSON.parse(env.PASS_PRIVATE_JWK)) };
  const emailEnabled = Boolean(env.RESEND_API_KEY && env.MAIL_FROM);
  return {
    repo: env.DATABASE_URL ? neonRepo(env.DATABASE_URL) : (devRepo ??= memoryRepo()),
    mailer: emailEnabled ? resendMailer(env.RESEND_API_KEY!, env.MAIL_FROM!) : consoleMailer,
    signer: signerCache.signer,
    google: env.GOOGLE_CLIENT_ID ? googleVerifier(env.GOOGLE_CLIENT_ID) : null,
    now: Date.now,
    appOrigin: env.APP_ORIGIN.replace(/\/$/, ''),
    adminPassword: env.ADMIN_PASSWORD ?? null,
    emailEnabled,
  };
}

const header = (req: IncomingMessage, name: string) => {
  const v = req.headers[name];
  return (Array.isArray(v) ? v[0] : v) ?? null;
};

/** Vercel sets x-real-ip to the client address; x-forwarded-for is the fallback. */
export const clientIp = (req: IncomingMessage) => header(req, 'x-real-ip') ?? header(req, 'x-forwarded-for')?.split(',')[0]?.trim() ?? '';

const MAX_READ = 4_100_000; // above the largest route limit (sync push, ADR-024); the router answers 413 below this

async function readBody(req: IncomingMessage): Promise<string | null> {
  if (req.method === 'GET' || req.method === 'HEAD') return '';
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const b = chunk as Buffer;
    size += b.length;
    if (size > MAX_READ) return null;
    chunks.push(b);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function send(res: ServerResponse, status: number, headers: Record<string, string>, body: string | Uint8Array) {
  res.statusCode = status;
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.end(body);
}

export async function handle(req: IncomingMessage, res: ServerResponse, env: Env = process.env): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const headers: Record<string, string> = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
  try {
    const raw = await readBody(req);
    if (raw === null) return send(res, 413, headers, JSON.stringify({ error: 'too_large' }));
    const method = req.method ?? 'GET';
    const out = await route(await depsFromEnv(env), method, url.pathname, header(req, 'authorization'), raw, { ip: clientIp(req), query: url.searchParams });
    // Public landing/app data: cached at Vercel's CDN for a minute (no purge; admin edits show within 60 s).
    if (out.cacheSeconds && out.status === 200) headers['Cache-Control'] = `public, max-age=${out.cacheSeconds}, s-maxage=${out.cacheSeconds}`;
    if (out.text) {
      const h: Record<string, string> = { ...headers, 'Content-Type': out.text.contentType };
      if (out.text.filename) h['Content-Disposition'] = `attachment; filename="${out.text.filename}"`;
      return send(res, out.status, h, out.text.content);
    }
    if (out.raw) return send(res, out.status, { ...headers, 'Content-Type': out.raw.contentType }, out.raw.bytes);
    return send(res, out.status, headers, JSON.stringify(out.body));
  } catch (err) {
    console.error('api_error', url.pathname, err instanceof Error ? err.message : err);
    return send(res, 500, headers, JSON.stringify({ error: 'server_error' }));
  }
}

export default handle;
