#!/usr/bin/env node
/**
 * Rebuilds the design system map from the code (no dependencies).
 *   node scripts/ds-map.mjs          write the data into design-system/structure.html and MEMORY.md
 *   node scripts/ds-map.mjs --check  exit 1 when either file is out of date
 * Reads: src/index.css (tokens), src/components/ui/styles.ts (classes), shared components,
 * every .ts/.tsx under src (who imports what), landing/index.dc.html (hand-copied colours).
 */
import { execSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const SRC = join(ROOT, 'src');
const HTML = join(ROOT, 'design-system/structure.html');
const MEMORY = join(ROOT, 'design-system/MEMORY.md');
const REPO = 'https://github.com/Kennexct/pikul-pos/blob';

const read = (p) => readFileSync(p, 'utf8');
const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return name === 'node_modules' ? [] : walk(p);
    return /\.(tsx?|css)$/.test(name) && !/\.test\.ts$/.test(name) ? [p] : [];
  });
const rel = (p) => relative(ROOT, p);
const lineOf = (text, index) => text.slice(0, index).split('\n').length;

/** Screen areas in menu order; anything else under src/components counts as "Shared pop-ups". */
const AREAS = [
  ['pages/POS', 'Kasir'], ['pages/History', 'Riwayat'], ['pages/Cash', 'Kas'], ['pages/OpenOrders', 'Pesanan'],
  ['pages/Products', 'Produk'], ['pages/Customers', 'Pelanggan'], ['pages/Reports', 'Laporan'], ['pages/Settings', 'Pengaturan'],
  ['pages/Auth', 'Masuk'], ['pages/Onboarding', 'Onboarding'], ['pages/Help', 'Bantuan'], ['pages/More', 'Akun'],
  ['components', 'Shared pop-ups'], ['admin', 'Admin'],
];
const areaOf = (file) => {
  const parts = relative(SRC, file).split('/');
  if (parts[0] === 'pages') return `pages/${parts[1]}`;
  if (parts[0] === 'components' && !['ui', 'Layout', 'Brand'].includes(parts[1])) return 'components';
  if (parts[0] === 'admin') return 'admin';
  return null;
};

// 1. Tokens
const css = read(join(SRC, 'index.css'));
const tokens = [...css.matchAll(/--color-([\w-]+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => ({ name: m[1], value: m[2].toLowerCase() }));
const tokenByHex = new Map(tokens.map((t) => [t.value, t.name]));

// 2. Shared pieces and the row group each belongs to
const GROUPS = {
  Buttons: ['btnPrimary', 'btnSecondary', 'btnGhost', 'btnDanger', 'btnDangerSolid', 'btnIcon'],
  'Inputs and choices': ['inputBase', 'labelBase', 'helperText', 'option', 'fieldGrid', 'RupiahInput', 'NumberInput', 'SearchInput', 'Select', 'Switch', 'SegmentedControl', 'DateRangeControl'],
  'Pages, cards and pop-ups': ['Sheet', 'card', 'sectionTitle', 'PageHeader', 'Tabs', 'EmptyState', 'LoadingScreen', 'SidePanel', 'SettingsSection'],
  'Status and money': ['badgeNeutral', 'badgeWarn', 'badgeBrand', 'StatusBadge', 'StatTile', 'receiptRule', 'ProductThumb'],
  Brand: ['Logo', 'LogoMark'],
};
/** Colour token families as Tailwind uses them: bg-brand-600, text-muted, border-line-strong ... */
const FAMILIES = ['brand', 'ink', 'muted', 'faint', 'line', 'surface', 'canvas', 'subtle', 'danger', 'warn'];
const familyRe = (fam) => new RegExp(`\\b(?:bg|text|border|ring|fill|stroke|from|to|divide|outline|accent)-${fam}(?:-[\\w-]+)?\\b`);
const stylesText = read(join(SRC, 'components/ui/styles.ts'));
const classNames = new Set([...stylesText.matchAll(/export const (\w+)/g)].map((m) => m[1]));
const files = walk(SRC);
const texts = new Map(files.map((f) => [f, read(f)]));
const homeOf = (name) =>
  classNames.has(name) ? 'src/components/ui/styles.ts'
    : rel(files.find((f) => new RegExp(`export (default )?function ${name}\\b`).test(texts.get(f))) ?? '');

const pieces = Object.entries(GROUPS).flatMap(([group, names]) =>
  names.map((name) => {
    const isClass = classNames.has(name);
    const home = homeOf(name);
    const use = isClass ? new RegExp(`\\b${name}\\b`) : new RegExp(`<${name}\\b`);
    const areas = new Set();
    for (const [f, t] of texts) {
      const area = areaOf(f);
      if (!area || rel(f) === home) continue;
      if (isClass && !t.includes('ui/styles')) continue;
      if (use.test(t)) areas.add(area);
    }
    const source = isClass
      ? (stylesText.split(/(?=export const )/).find((s) => s.startsWith(`export const ${name} `)) ?? '')
      : (texts.get(join(ROOT, home)) ?? '');
    const usesTokens = FAMILIES.filter((fam) => familyRe(fam).test(source));
    return { name: isClass && name === 'option' ? 'option()' : name, kind: isClass ? 'class' : 'component', group, file: home, tokens: usesTokens, areas: AREAS.map(([id]) => id).filter((id) => areas.has(id)) };
  }),
);

// 3. Which areas use each colour token family (bg-brand-600, text-muted, border-line ...)
const tokenUse = FAMILIES.map((fam) => {
  const re = familyRe(fam);
  const areas = AREAS.map(([id]) => id).filter((id) => [...texts].some(([f, t]) => areaOf(f) === id && re.test(t)));
  return { family: fam, areas };
});

// 4. Drift: hex colours written outside index.css, and the Transaksi order in MASTER.md
const driftFiles = [...files.filter((f) => !f.endsWith('index.css')), join(ROOT, 'landing/index.dc.html')];
const drift = [];
for (const f of driftFiles) {
  const t = read(f);
  const hits = new Map();
  for (const m of t.matchAll(/#[0-9a-fA-F]{6}\b|\[(\d{1,3}), (\d{1,3}), (\d{1,3})\]/g)) {
    // RGB triples only count on colour lines (jsPDF), so number lists like [100, 250, 500] are skipped
    const lineText = t.split('\n')[lineOf(t, m.index) - 1];
    if (m[1] && !/colou?r|ink|muted|brand|fill|grid/i.test(lineText)) continue;
    const hex = m[1] ? `#${[m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, '0')).join('')}` : m[0].toLowerCase();
    if (!hits.has(hex)) hits.set(hex, lineOf(t, m.index));
  }
  if (!hits.size) continue;
  const values = [...hits].map(([hex, line]) => ({ hex, line, token: tokenByHex.get(hex) ?? null }));
  const off = values.filter((v) => !v.token);
  drift.push({
    kind: off.length ? 'Wrong colours' : 'Copied by hand',
    file: rel(f),
    line: values[0].line,
    values,
    note: off.length
      ? `${off.length} of ${values.length} colours match no token`
      : `${values.length} colours match tokens but are typed in, so they will not follow a token change`,
  });
}
const sales = read(join(SRC, 'components/Layout/navItems.ts')).match(/id: 'sales'[^\n]*items: \[([^\]]+)\]/);
const navOrder = sales ? [...sales[1].matchAll(/NAV_ITEMS\.(\w+)/g)].map((m) => ({ history: 'Riwayat', cash: 'Kas', openOrders: 'Pesanan' })[m[1]] ?? m[1]) : [];
const master = read(join(ROOT, 'design-system/MASTER.md'));
const masterMatch = master.match(/Transaksi \(([^)]+)\)/);
if (masterMatch && masterMatch[1].replace(/\s/g, '') !== navOrder.join(',')) {
  drift.push({ kind: 'Docs out of date', file: 'design-system/MASTER.md', line: lineOf(master, masterMatch.index), values: [], note: `MASTER.md says Transaksi (${masterMatch[1]}); the menu is ${navOrder.join(' · ')}` });
}
drift.sort((a, b) => ['Wrong colours', 'Copied by hand', 'Docs out of date'].indexOf(a.kind) - ['Wrong colours', 'Copied by hand', 'Docs out of date'].indexOf(b.kind));

// 5. Write
const git = (cmd) => { try { return execSync(`git ${cmd}`, { cwd: ROOT }).toString().trim(); } catch { return ''; } };
const version = JSON.parse(read(join(ROOT, 'package.json'))).version;
const data = { version, commit: git('rev-parse --short HEAD'), repo: REPO, date: new Date().toISOString().slice(0, 10), areas: AREAS.map(([id, label]) => ({ id, label })), tokens, tokenUse, pieces, drift };
const stable = (d) => JSON.stringify({ ...d, commit: '', date: '' });

const isCheck = process.argv.includes('--check');
const html = read(HTML);
const dataRe = /(<script id="ds-data" type="application\/json">)[\s\S]*?(<\/script>)/;
const oldRaw = html.match(dataRe)?.[0].replace(/^<script[^>]*>|<\/script>$/g, '') ?? '';
let oldData = {};
try { oldData = JSON.parse(oldRaw || '{}'); } catch { oldData = {}; }

const usageRows = Object.keys(GROUPS).map((g) => {
  const list = pieces.filter((p) => p.group === g).sort((a, b) => b.areas.length - a.areas.length);
  return `| ${g} | ${list.map((p) => `\`${p.name}\` ${p.areas.length}`).join(', ')} |`;
});
const usage = ['| Group | Piece and number of areas using it |', '| --- | --- |', ...usageRows].join('\n');
const driftMd = drift.map((d) => `- **${d.kind}:** \`${d.file}\` (from L${d.line}). ${d.note}.`).join('\n');
const block = (md, name, body) => md.replace(new RegExp(`(<!-- ds-map:${name} -->)[\\s\\S]*?(<!-- /ds-map:${name} -->)`), `$1\n${body}\n$2`);
const memory = read(MEMORY);
const newMemory = block(block(memory, 'usage', usage), 'drift', driftMd);

const stale = stable(oldData) !== stable(data) || newMemory !== memory;
if (isCheck) {
  console.log(stale ? 'Design system map is out of date: run `node scripts/ds-map.mjs`.' : 'Design system map is up to date.');
  process.exit(stale ? 1 : 0);
}
writeFileSync(HTML, html.replace(dataRe, `$1${JSON.stringify(data)}$2`));
writeFileSync(MEMORY, newMemory);
console.log(`Map rebuilt: ${tokens.length} colour tokens, ${pieces.length} shared pieces, ${drift.length} drift items (v${version}, ${data.commit}).`);
