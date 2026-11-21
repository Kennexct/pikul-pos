// Serves .vercel/output locally the way Vercel routes it (ADR-022): /api/* → the bundled function, files, SPA fallbacks.
// For smoke tests and e2e only. Env comes from the shell, e.g.:
//   DEV_MODE=1 PASS_PRIVATE_JWK='…' APP_ORIGIN=http://localhost:4173 ADMIN_PASSWORD=… node scripts/vercel-local.mjs 4173
import fs from 'node:fs';
import http from 'node:http';
import { createRequire } from 'node:module';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..', '.vercel', 'output');
const port = Number(process.argv[2] ?? 4173);
const handler = createRequire(import.meta.url)(path.join(root, 'functions', 'api.func', 'index.js'));
const config = JSON.parse(fs.readFileSync(path.join(root, 'config.json'), 'utf8'));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };

const fileFor = (p) => {
  const f = path.join(root, 'static', decodeURIComponent(p));
  if (!f.startsWith(path.join(root, 'static'))) return null;
  if (fs.existsSync(f) && fs.statSync(f).isFile()) return f;
  const idx = path.join(f, 'index.html');
  return fs.existsSync(idx) ? idx : null;
};

http
  .createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    let dest = null;
    let afterFs = false;
    for (const r of config.routes) {
      if (r.handle === 'filesystem') {
        const f = fileFor(url.pathname);
        if (f) {
          dest = f;
          break;
        }
        afterFs = true;
        continue;
      }
      if (!new RegExp(r.src).test(url.pathname)) continue;
      if (r.headers && !afterFs) for (const [k, v] of Object.entries(r.headers)) res.setHeader(k, v);
      if (r.dest === '/api') return void handler(req, res);
      if (r.dest) {
        dest = fileFor(r.dest);
        break;
      }
    }
    if (!dest) {
      res.statusCode = 404;
      return void res.end('Not found');
    }
    res.setHeader('Content-Type', TYPES[path.extname(dest)] ?? 'application/octet-stream');
    fs.createReadStream(dest).pipe(res);
  })
  .listen(port, () => console.log(`Pikul (Vercel output) on http://localhost:${port}`));
