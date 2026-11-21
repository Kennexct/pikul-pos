import { neon } from '@neondatabase/serverless';
import { neonAdminRepo } from './neonAdminRepo';
import type { Account, Campaign, StoredImage, LoginCode, PlanDef, RefreshToken, Repo } from './types';

type Row = Record<string, unknown>;
const ms = (v: unknown) => (v === null || v === undefined ? null : new Date(v as string).getTime());
const iso = (v: number | null) => (v === null ? null : new Date(v).toISOString());

const account = (r: Row): Account => ({
  id: r.id as string,
  email: r.email as string,
  googleSub: (r.google_sub as string | null) ?? null,
  createdAt: ms(r.created_at)!,
  trialEndsAt: ms(r.trial_ends_at)!,
  paidUntil: ms(r.paid_until),
  ownerName: (r.owner_name as string | undefined) ?? '',
  storeName: (r.store_name as string | undefined) ?? '',
  phone: (r.phone as string | undefined) ?? '',
  city: (r.city as string | undefined) ?? '',
});
const b64 = (bytes: Uint8Array) => {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};

const plan = (r: Row): PlanDef => ({
  id: r.id as string,
  name: r.name as string,
  amount: Number(r.amount),
  days: Number(r.days),
  note: r.note as string,
  badge: r.badge as string,
  features: (r.features as string[] | null) ?? [],
  active: r.active as boolean,
  sort: Number(r.sort),
  updatedAt: ms(r.updated_at)!,
});
const campaign = (r: Row): Campaign => ({
  id: r.id as string,
  name: r.name as string,
  title: r.title as string,
  body: r.body as string,
  imageUrl: (r.image_url as string | null) ?? null,
  linkUrl: (r.link_url as string | null) ?? null,
  ctaLabel: r.cta_label as string,
  showOnLanding: r.show_on_landing as boolean,
  showInApp: r.show_in_app as boolean,
  showOnRegister: (r.show_on_register as boolean | undefined) ?? false,
  startsAt: ms(r.starts_at)!,
  endsAt: ms(r.ends_at)!,
  enabled: r.enabled as boolean,
  archived: r.archived as boolean,
  planId: (r.plan_id as string | null) ?? null,
  promoAmount: r.promo_amount === null || r.promo_amount === undefined ? null : Number(r.promo_amount),
  createdAt: ms(r.created_at)!,
  updatedAt: ms(r.updated_at)!,
});

export function neonRepo(databaseUrl: string): Repo {
  const sql = neon(databaseUrl);
  const one = async <T>(rows: Promise<Row[]>, map: (r: Row) => T) => {
    const [r] = await rows;
    return r ? map(r) : null;
  };
  return {
    ...neonAdminRepo(sql),
    findAccountByEmail: (email) => one(sql`select * from accounts where email = ${email}` as Promise<Row[]>, account),
    findAccountById: (id) => one(sql`select * from accounts where id = ${id}` as Promise<Row[]>, account),
    async createAccount(a, passwordHash = null) {
      const r = (await sql`insert into accounts (id, email, google_sub, created_at, trial_ends_at, paid_until, password_hash, password_changed_at, owner_name, store_name, phone, city)
        values (${a.id}, ${a.email}, ${a.googleSub}, ${iso(a.createdAt)}, ${iso(a.trialEndsAt)}, ${iso(a.paidUntil)}, ${passwordHash}, ${passwordHash ? iso(a.createdAt) : null},
          ${a.ownerName ?? ''}, ${a.storeName ?? ''}, ${a.phone ?? ''}, ${a.city ?? ''})
        on conflict (email) do nothing returning id`) as Row[];
      return r.length > 0;
    },
    async getPasswordHash(id) {
      const [r] = (await sql`select password_hash from accounts where id = ${id}`) as Row[];
      return (r?.password_hash as string | null | undefined) ?? null;
    },
    async setPasswordHash(id, hash, at) {
      await sql`update accounts set password_hash = ${hash}, password_changed_at = ${iso(at)} where id = ${id}`;
    },
    async setGoogleSub(id, sub) {
      await sql`update accounts set google_sub = ${sub} where id = ${id} and google_sub is null`;
    },
    async setPaidUntil(id, until) {
      await sql`update accounts set paid_until = ${iso(until)} where id = ${id}`;
    },
    getLoginCode: (email) =>
      one(sql`select * from login_codes where email = ${email}` as Promise<Row[]>, (r): LoginCode => ({
        email: r.email as string,
        codeHash: r.code_hash as string,
        expiresAt: ms(r.expires_at)!,
        attempts: Number(r.attempts),
        sentAt: ms(r.sent_at)!,
      })),
    async putLoginCode(c) {
      await sql`insert into login_codes (email, code_hash, expires_at, attempts, sent_at)
        values (${c.email}, ${c.codeHash}, ${iso(c.expiresAt)}, 0, ${iso(c.sentAt)})
        on conflict (email) do update set code_hash = excluded.code_hash, expires_at = excluded.expires_at, attempts = 0, sent_at = excluded.sent_at`;
    },
    async bumpLoginAttempts(email) {
      await sql`update login_codes set attempts = attempts + 1 where email = ${email}`;
    },
    async deleteLoginCode(email) {
      await sql`delete from login_codes where email = ${email}`;
    },
    async putRefreshToken(t) {
      await sql`insert into refresh_tokens (token_hash, account_id, expires_at) values (${t.tokenHash}, ${t.accountId}, ${iso(t.expiresAt)})`;
    },
    findRefreshToken: (h) =>
      one(sql`select * from refresh_tokens where token_hash = ${h}` as Promise<Row[]>, (r): RefreshToken => ({ tokenHash: r.token_hash as string, accountId: r.account_id as string, expiresAt: ms(r.expires_at)! })),
    takeRefreshToken: (h) =>
      one(sql`delete from refresh_tokens where token_hash = ${h} returning *` as Promise<Row[]>, (r): RefreshToken => ({ tokenHash: r.token_hash as string, accountId: r.account_id as string, expiresAt: ms(r.expires_at)! })),
    async deleteRefreshTokens(accountId) {
      await sql`delete from refresh_tokens where account_id = ${accountId}`;
    },
    async listPlans() {
      return ((await sql`select * from plans`) as Row[]).map(plan);
    },
    async putPlan(p) {
      await sql`insert into plans (id, name, amount, days, note, badge, features, active, sort, updated_at)
        values (${p.id}, ${p.name}, ${p.amount}, ${p.days}, ${p.note}, ${p.badge}, ${JSON.stringify(p.features)}::jsonb, ${p.active}, ${p.sort}, ${iso(p.updatedAt)})
        on conflict (id) do update set name = excluded.name, amount = excluded.amount, days = excluded.days, note = excluded.note,
          badge = excluded.badge, features = excluded.features, active = excluded.active, sort = excluded.sort, updated_at = excluded.updated_at`;
    },
    async listCampaigns() {
      return ((await sql`select * from campaigns where not archived order by starts_at desc limit 200`) as Row[]).map(campaign);
    },
    findCampaign: (id) => one(sql`select * from campaigns where id = ${id}` as Promise<Row[]>, campaign),
    async putCampaign(c) {
      await sql`insert into campaigns (id, name, title, body, image_url, link_url, cta_label, show_on_landing, show_in_app, show_on_register, starts_at, ends_at, enabled, archived, plan_id, promo_amount, created_at, updated_at)
        values (${c.id}, ${c.name}, ${c.title}, ${c.body}, ${c.imageUrl}, ${c.linkUrl}, ${c.ctaLabel}, ${c.showOnLanding}, ${c.showInApp}, ${c.showOnRegister}, ${iso(c.startsAt)}, ${iso(c.endsAt)}, ${c.enabled}, ${c.archived},
          ${c.planId}, ${c.promoAmount}, ${iso(c.createdAt)}, ${iso(c.updatedAt)})
        on conflict (id) do update set name = excluded.name, title = excluded.title, body = excluded.body, image_url = excluded.image_url,
          link_url = excluded.link_url, cta_label = excluded.cta_label, show_on_landing = excluded.show_on_landing, show_in_app = excluded.show_in_app, show_on_register = excluded.show_on_register, starts_at = excluded.starts_at, ends_at = excluded.ends_at, enabled = excluded.enabled,
          archived = excluded.archived, plan_id = excluded.plan_id, promo_amount = excluded.promo_amount, updated_at = excluded.updated_at`;
    },
    async putImage(i) {
      await sql`insert into images (id, mime, data_b64, created_at) values (${i.id}, ${i.mime}, ${b64(i.data)}, ${iso(i.createdAt)})`;
    },
    getImage: (id) =>
      one(sql`select * from images where id = ${id}` as Promise<Row[]>, (r): StoredImage => ({
        id: r.id as string,
        mime: r.mime as StoredImage['mime'],
        data: Uint8Array.from(atob(r.data_b64 as string), (ch) => ch.charCodeAt(0)),
        createdAt: ms(r.created_at)!,
      })),
    async addAudit(e) {
      await sql`insert into admin_audit (at, email, action, target, detail) values (${iso(e.at)}, ${e.email}, ${e.action}, ${e.target}, ${JSON.stringify(e.detail ?? null)}::jsonb)`;
    },
  };
}
