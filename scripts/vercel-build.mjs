// Writes the Vercel Build Output API v3 folder (ADR-022) after `vite build`:
//   .vercel/output/static            ← dist/ (landing, /app/ PWA, /admin/)
//   .vercel/output/functions/api.func ← server/vercel.ts bundled into one Node 22 file
//   .vercel/output/config.json       ← routes: security headers, /api/* → function, SPA fallbacks
// Vercel uses this folder as-is when the build command creates it. Usage: npm run build:vercel
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const out = path.join(root, '.vercel', 'output');
const dist = path.join(root, 'dist');
if (!fs.existsSync(path.join(dist, 'app', 'index.html'))) throw new Error('dist/ is missing: run `npm run build` first');

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
fs.cpSync(dist, path.join(out, 'static'), { recursive: true });
for (const f of ['_headers', '_redirects']) fs.rmSync(path.join(out, 'static', f), { force: true }); // Cloudflare-only files

const fn = path.join(out, 'functions', 'api.func');
fs.mkdirSync(fn, { recursive: true });
await build({
  entryPoints: [path.join(root, 'server', 'vercel.ts')],
  outfile: path.join(fn, 'index.js'),
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  minify: false,
  legalComments: 'none',
  logLevel: 'warning',
  // The launcher calls the module itself or its default export with (req, res).
  footer: { js: 'module.exports = Object.assign(module.exports.default, module.exports);' },
});
fs.writeFileSync(path.join(fn, 'package.json'), JSON.stringify({ type: 'commonjs' }) + '\n');
fs.writeFileSync(
  path.join(fn, '.vc-config.json'),
  JSON.stringify({ runtime: 'nodejs22.x', handler: 'index.js', launcherType: 'Nodejs', shouldAddHelpers: false, maxDuration: 30, regions: ['sin1'] }, null, 2) + '\n',
);

const security = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(self), geolocation=()',
  'X-Frame-Options': 'DENY',
};
const adminCsp =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'";

const config = {
  version: 3,
  routes: [
    { src: '^/(.*)$', headers: security, continue: true },
    { src: '^/sw\\.js$', headers: { 'Cache-Control': 'no-cache' }, continue: true },
    { src: '^/assets/(.*)$', headers: { 'Cache-Control': 'public, max-age=31536000, immutable' }, continue: true },
    { src: '^/app(?:/[^.]*)?$', headers: { 'Cache-Control': 'no-cache' }, continue: true },
    { src: '^/admin(?:/.*)?$', headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow', 'Content-Security-Policy': adminCsp }, continue: true },
    { src: '^/r/(.*)$', headers: { 'X-Robots-Tag': 'noindex, nofollow', 'Referrer-Policy': 'no-referrer' }, continue: true },
    { src: '^/api(?:/.*)?$', dest: '/api' },
    { src: '^/r/[A-Za-z0-9_-]{22}(?:\\.png)?$', dest: '/api' },
    { handle: 'filesystem' },
    { src: '^/app(?:/.*)?$', dest: '/app/index.html' },
    { src: '^/admin(?:/.*)?$', dest: '/admin/index.html' },
  ],
};
fs.writeFileSync(path.join(out, 'config.json'), JSON.stringify(config, null, 2) + '\n');

const size = fs.statSync(path.join(fn, 'index.js')).size;
console.log(`Vercel output ready: .vercel/output (function ${(size / 1024).toFixed(0)} KB)`);
