// One-off codemod (ADR-010): wraps Indonesian interface strings in t('…').
// Usage: node scripts/i18n-wrap.mjs [--dry]   → writes files and src/i18n/keys.json
import ts from 'typescript';
import fs from 'node:fs';
import path from 'node:path';

const DRY = process.argv.includes('--dry');
// Optional second run: FORCE=path.json with { "src/file.ts": [line, …] } wraps every literal on those lines.
const FORCE = process.env.FORCE ? JSON.parse(fs.readFileSync(process.env.FORCE, 'utf8')) : null;
const SKIP = [/^src\/i18n\//, /^src\/content\//, /^src\/db\//, /^src\/types\//, /\.test\.tsx?$/, /^src\/services\/seedTemplate\.ts$/, /^src\/main\.tsx$/, /vite-env/, /^src\/components\/ui\/styles\.ts$/];
const ATTRS = new Set(['title', 'label', 'aria-label', 'description', 'placeholder', 'subtitle', 'hint', 'message', 'alt', 'summary', 'ariaLabel']);
const PROPS = new Set(['label', 'header', 'title', 'hint', 'error', 'description', 'placeholder', 'subtitle', 'reason', 'referenceLabel', 'sheet', 'content', 'detail']);
const LABEL_MAP = /(_LABELS?|_HELP|_TITLES?|_TEXT|_HINTS?)$/;
const TOAST = /^(toast|toast\.(success|error|loading))$/;
const ERRORS = /^(Error|BackupError)$/;

const files = [];
(function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (/\.tsx?$/.test(e.name)) files.push(p); } })('src');

const keys = new Set();
const hasWords = (s) => /[A-Za-zÀ-ÿ]{2,}/.test(s);
const IGNORE_TEXT = new Set(['Rp', 'Pikul']);
const quote = (s) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`;
const isT = (n) => ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 't';

function processFile(file) {
  let source = fs.readFileSync(file, 'utf8');
  let changed = false;
  for (let pass = 0; pass < 6; pass += 1) {
    const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const edits = [];
    const claimed = new Set();
    const text = (n) => source.slice(n.getStart(sf), n.getEnd());
    const add = (n, replacement) => { if (!claimed.has(n)) { claimed.add(n); edits.push([n.getStart(sf), n.getEnd(), replacement]); } };
    const key = (s) => { keys.add(s); return quote(s); };

    /** Wrap the string leaves of an expression that is known to be displayed text. `loose` also accepts single lowercase words. */
    const wrap = (n) => {
      if (!n) return;
      if (ts.isParenthesizedExpression(n)) return wrap(n.expression);
      if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) {
        if (hasWords(n.text) && !IGNORE_TEXT.has(n.text.trim())) add(n, `t(${key(n.text)})`);
        return;
      }
      if (ts.isTemplateExpression(n)) {
        const statics = [n.head.text, ...n.templateSpans.map((s) => s.literal.text)];
        if (!hasWords(statics.join(''))) return n.templateSpans.forEach((s) => wrap(s.expression));
        // Innermost first: if a span still contains wrappable text, leave this node for the next pass.
        if (n.templateSpans.some((s) => containsRawText(s.expression))) return n.templateSpans.forEach((s) => wrap(s.expression));
        let k = n.head.text;
        n.templateSpans.forEach((s, i) => { k += `{${i}}${s.literal.text}`; });
        add(n, `t(${key(k)}, ${n.templateSpans.map((s) => text(s.expression)).join(', ')})`);
        return;
      }
      if (ts.isConditionalExpression(n)) { wrap(n.whenTrue); wrap(n.whenFalse); return; }
      if (ts.isBinaryExpression(n)) {
        const op = n.operatorToken.kind;
        if (op === ts.SyntaxKind.BarBarToken || op === ts.SyntaxKind.QuestionQuestionToken || op === ts.SyntaxKind.PlusToken) { wrap(n.left); wrap(n.right); }
        else if (op === ts.SyntaxKind.AmpersandAmpersandToken) wrap(n.right);
        return;
      }
      if (ts.isArrayLiteralExpression(n)) return n.elements.forEach(wrap);
    };
    const containsRawText = (n) => {
      let found = false;
      (function look(x) {
        if (found || isT(x)) return;
        if ((ts.isStringLiteral(x) || ts.isNoSubstitutionTemplateLiteral(x)) && hasWords(x.text) && /[A-Z ]/.test(x.text) && !ts.isJsxAttribute(x.parent)) { found = true; return; }
        if (ts.isTemplateExpression(x) && hasWords(x.head.text + x.templateSpans.map((s) => s.literal.text).join(''))) { found = true; return; }
        ts.forEachChild(x, look);
      })(n);
      return found;
    };
    const wrapDeep = (n) => {
      if (ts.isObjectLiteralExpression(n)) n.properties.forEach((p) => ts.isPropertyAssignment(p) && wrapDeep(p.initializer));
      else if (ts.isArrayLiteralExpression(n)) n.elements.forEach(wrapDeep);
      else if (ts.isAsExpression(n) || ts.isSatisfiesExpression(n)) wrapDeep(n.expression);
      else wrap(n);
    };
    const sentenceLike = (s) => /^[A-ZÀ-Ý"“(]/.test(s.trim()) && /\s/.test(s.trim()) && hasWords(s);

    (function visit(n) {
      if (isT(n)) return; // already done
      if (FORCE) {
        const lines = FORCE[file];
        if (!lines) return;
        const isLiteral = ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateExpression(n);
        if (isLiteral && !ts.isJsxAttribute(n.parent) && lines.includes(sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1)) wrap(n);
        ts.forEachChild(n, visit);
        return;
      }
      if (ts.isImportDeclaration(n) || ts.isExportDeclaration(n) || ts.isTypeNode(n)) return;
      if (ts.isJsxText(n)) {
        const raw = n.getFullText(sf);
        if (hasWords(raw)) {
          const a = raw.search(/\S/); const b = raw.length - raw.split('').reverse().join('').search(/\S/);
          const core = raw.slice(a, b).replace(/\s*\n\s*/g, ' ').replace(/&amp;/g, '&');
          if (!IGNORE_TEXT.has(core)) edits.push([n.getFullStart() + a, n.getFullStart() + b, `{t(${key(core)})}`]);
        }
        return;
      }
      if (ts.isJsxAttribute(n)) {
        const name = n.name.getText(sf);
        if (!ATTRS.has(name) || !n.initializer) { if (n.initializer && ts.isJsxExpression(n.initializer) && name !== 'className') ts.forEachChild(n.initializer, visit); return; }
        if (ts.isStringLiteral(n.initializer)) { if (hasWords(n.initializer.text)) add(n.initializer, `{t(${key(n.initializer.text)})}`); }
        else if (ts.isJsxExpression(n.initializer) && n.initializer.expression) { wrap(n.initializer.expression); ts.forEachChild(n.initializer, visit); }
        return;
      }
      if (ts.isJsxExpression(n) && n.expression && (ts.isJsxElement(n.parent) || ts.isJsxFragment(n.parent))) wrap(n.expression);
      if (ts.isPropertyAssignment(n) && PROPS.has(n.name.getText(sf))) wrap(n.initializer);
      if (ts.isVariableDeclaration(n) && n.initializer && ts.isIdentifier(n.name) && LABEL_MAP.test(n.name.text)) wrapDeep(n.initializer);
      if (ts.isCallExpression(n) && TOAST.test(n.expression.getText(sf))) wrap(n.arguments[0]);
      if (ts.isNewExpression(n) && ERRORS.test(n.expression.getText(sf))) wrap(n.arguments?.[0]);
      // Any remaining sentence-like literal outside JSX attributes (returns, fallbacks, text builders).
      if ((ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) && !ts.isJsxAttribute(n.parent) && !ts.isPropertyAssignment(n.parent) && sentenceLike(n.text)) wrap(n);
      if (ts.isTemplateExpression(n) && !isClassContext(n) && sentenceLike(n.head.text + n.templateSpans.map((s) => s.literal.text).join(' x '))) wrap(n);
      ts.forEachChild(n, visit);
    })(sf);

    function isClassContext(n) {
      for (let p = n.parent; p; p = p.parent) if (ts.isJsxAttribute(p)) return p.name.getText(sf) === 'className';
      return false;
    }

    if (edits.length === 0) break;
    // Drop edits nested inside another edit; the next pass picks them up.
    edits.sort((x, y) => x[0] - y[0] || y[1] - x[1]);
    const flat = [];
    for (const e of edits) if (flat.length === 0 || e[0] >= flat[flat.length - 1][1]) flat.push(e);
    for (const [start, end, replacement] of flat.reverse()) source = source.slice(0, start) + replacement + source.slice(end);
    changed = true;
  }
  if (!changed) return false;
  if (!/import \{[^}]*\bt\b[^}]*\} from '[^']*i18n'/.test(source)) {
    let rel = path.relative(path.dirname(file), 'src/i18n').replace(/\\/g, '/');
    if (!rel.startsWith('.')) rel = `./${rel}`;
    const imports = [...source.matchAll(/^import [\s\S]*?;\n/gm)];
    const last = imports[imports.length - 1];
    const at = last ? last.index + last[0].length : 0;
    source = `${source.slice(0, at)}import { t } from '${rel}';\n${source.slice(at)}`;
  }
  if (!DRY) fs.writeFileSync(file, source);
  return true;
}

let count = 0;
for (const file of files) if ((FORCE ? FORCE[file] : !SKIP.some((re) => re.test(file))) && processFile(file)) count += 1;
fs.writeFileSync(DRY ? '/tmp/keys.json' : FORCE ? 'src/i18n/keys-extra.json' : 'src/i18n/keys.json', JSON.stringify([...keys].sort((a, b) => a.localeCompare(b)), null, 0));
console.log(`${count} files changed, ${keys.size} keys`);
