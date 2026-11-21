import { emptyPay, type DailyRow } from '../../server/adminTypes';
import { jakartaDate } from '../../server/ledger';
import { memoryRepo } from '../../server/memoryRepo';
import { route } from '../../server/router';
import { DAY_MS, type Deps } from '../../server/types';

/**
 * Preview mode (ADR-020): when no admin server answers (static deploy), the console runs the real server code in this
 * tab against an in-memory database with example merchants. Nothing is sent anywhere; closing the tab resets it.
 * Emails are fake (contoh…@pikul.id).
 */
const PASSWORD = 'pratinjau-pikul-lokal';
let deps: Deps | null = null;

/** Deterministic pseudo-random numbers so the example looks the same on every open. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1_664_525 + 1_013_904_223) >>> 0;
    return s / 2 ** 32;
  };
}

const MODES = ['Dine In', 'Takeaway', 'Ojol'];

function dailyRow(date: string, scale: number, r: () => number, now: number): DailyRow {
  const tx = Math.max(0, Math.round(scale * (0.6 + r() * 0.8)));
  const ticket = 12_000 + Math.round(r() * 20) * 1_000;
  const gross = tx * ticket;
  const refunds = r() < 0.15 ? ticket : 0;
  const pay = emptyPay();
  const qris = Math.round(tx * (0.2 + r() * 0.3));
  pay.cash = { transactions: tx - qris, gross: (tx - qris) * ticket, refunds };
  pay.qris = { transactions: qris, gross: qris * ticket, refunds: 0 };
  const hours = Array.from({ length: 24 }, () => ({ transactions: 0, gross: 0 }));
  for (let i = 0; i < tx; i++) {
    const h = [7, 8, 11, 12, 12, 13, 17, 18, 19, 19, 20][Math.floor(r() * 11)] ?? 12;
    const slot = hours[h];
    if (slot) {
      slot.transactions++;
      slot.gross += ticket;
    }
  }
  const dineIn = Math.round(tx * 0.6);
  const modes = [
    { name: MODES[0] ?? 'Dine In', transactions: dineIn, gross: dineIn * ticket, refunds: 0 },
    { name: MODES[1] ?? 'Takeaway', transactions: tx - dineIn, gross: (tx - dineIn) * ticket, refunds },
  ];
  return { businessDate: date, transactions: tx, gross, discounts: 0, refunds, net: gross - refunds, voidCount: r() < 0.1 ? 1 : 0, voidAmount: 0, itemsSold: tx * 2, pay, modes, hours, appVersion: '0.17.0', computedAt: now };
}

async function seed(repo: ReturnType<typeof memoryRepo>, now: number) {
  const r = rng(17);
  const kinds = ['transfer', 'qris', 'ewallet'] as const;
  for (let i = 0; i < 24; i++) {
    const ageDays = Math.floor(r() * 90) + 1;
    const createdAt = now - ageDays * DAY_MS;
    const id = crypto.randomUUID();
    repo.accounts.set(id, { id, email: `contoh${String(i + 1).padStart(2, '0')}@pikul.id`, googleSub: null, createdAt, trialEndsAt: createdAt + 14 * DAY_MS, paidUntil: null });
    await repo.touchLastSeen(id, now - Math.floor(r() * (i % 5 === 0 ? 12 : 3)) * DAY_MS);
    const pays = ageDays > 12 && r() < 0.6;
    if (pays) {
      const yearly = r() < 0.25;
      const a = repo.accounts.get(id);
      if (a) {
        const startsAt = a.trialEndsAt;
        const days = yearly ? 365 : 30;
        const paidAt = Math.min(now, startsAt - DAY_MS);
        await repo.recordPayment(
          {
            id: crypto.randomUUID(),
            accountId: id,
            planId: yearly ? 'yearly' : 'monthly',
            amount: yearly ? 490_000 : 49_000,
            days,
            method: kinds[i % 3] ?? 'transfer',
            reference: `TRX-${1000 + i}`,
            paidOn: jakartaDate(paidAt),
            note: '',
            startsAt,
            endsAt: startsAt + days * DAY_MS,
            prevPaidUntil: null,
            recordedAt: paidAt,
            recordedBy: 'contoh',
            cancelledAt: null,
            cancelReason: null,
          },
          null,
        );
      }
    }
    const scale = [0, 4, 12, 30, 70][Math.floor(r() * 5)] ?? 10;
    const rows: DailyRow[] = [];
    for (let d = 0; d < Math.min(ageDays, 60); d++) if (r() < 0.85) rows.push(dailyRow(jakartaDate(now - d * DAY_MS), scale, r, now));
    for (let k = 0; k < rows.length; k += 35) await repo.upsertDaily(id, rows.slice(k, k + 35), now);
  }
}

async function ensure(): Promise<Deps> {
  if (deps) return deps;
  const repo = memoryRepo();
  const now = Date.now();
  await seed(repo, now);
  deps = {
    repo,
    mailer: { sendLoginCode: async () => undefined },
    signer: { sign: async () => 'preview' },
    google: null,
    now: Date.now,
    appOrigin: window.location.origin,
    adminPassword: PASSWORD,
  };
  return deps;
}

let token = '';

export async function previewSignIn(): Promise<string> {
  const d = await ensure();
  const res = await route(d, 'POST', '/api/admin/login', null, JSON.stringify({ password: PASSWORD }), { ip: 'preview', query: new URLSearchParams() });
  token = (res.body as { token: string }).token;
  return token;
}

export async function previewRoute(method: 'GET' | 'POST', path: string, body?: unknown) {
  const d = await ensure();
  const url = new URL(path, 'http://preview.local');
  const res = await route(d, method, url.pathname, `Bearer ${token}`, body === undefined ? '' : JSON.stringify(body), { ip: 'preview', query: url.searchParams });
  return { status: res.status, body: res.body, text: res.text ? { content: res.text.content, filename: res.text.filename } : undefined };
}
