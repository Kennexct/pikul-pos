import { DEFAULT_PLANS } from './catalog';
import { memoryAdminRepo } from './memoryAdminRepo';
import { memorySyncRepo } from './memorySyncRepo';
import type { Account, AdminAuditEntry, Campaign, StoredImage, LoginCode, PlanDef, RefreshToken, Repo } from './types';

/** In-memory Repo for tests and local dev (`DEV_MODE=1`) without a database. Starts empty except the default plans. */
export function memoryRepo(): Repo & { accounts: Map<string, Account>; campaigns: Map<string, Campaign>; audit: AdminAuditEntry[]; admin: ReturnType<typeof memoryAdminRepo>; sync: ReturnType<typeof memorySyncRepo> } {
  const accounts = new Map<string, Account>();
  const codes = new Map<string, LoginCode>();
  const passwords = new Map<string, string>();
  const tokens = new Map<string, RefreshToken>();
  const plans = new Map<string, PlanDef>(DEFAULT_PLANS.map((p) => [p.id, structuredClone(p)]));
  const campaigns = new Map<string, Campaign>();
  const audit: AdminAuditEntry[] = [];
  const images = new Map<string, StoredImage>();
  const clone = <T>(v: T | undefined): T | null => (v ? structuredClone(v) : null);
  const admin = memoryAdminRepo(accounts);
  const sync = memorySyncRepo();
  return {
    ...admin.repo,
    ...sync,
    sync,
    admin,
    accounts,
    campaigns,
    audit,
    async findAccountByEmail(email) {
      return clone([...accounts.values()].find((a) => a.email === email));
    },
    async findAccountById(id) {
      return clone(accounts.get(id));
    },
    async createAccount(a, passwordHash = null) {
      if ([...accounts.values()].some((x) => x.email === a.email)) return false;
      accounts.set(a.id, structuredClone(a));
      if (passwordHash) passwords.set(a.id, passwordHash);
      return true;
    },
    async getPasswordHash(id) {
      return passwords.get(id) ?? null;
    },
    async setPasswordHash(id, hash) {
      passwords.set(id, hash);
    },
    async setGoogleSub(id, sub) {
      const a = accounts.get(id);
      if (a) a.googleSub = sub;
    },
    async setPaidUntil(id, paidUntil) {
      const a = accounts.get(id);
      if (a) a.paidUntil = paidUntil;
    },
    async getLoginCode(email) {
      return clone(codes.get(email));
    },
    async putLoginCode(c) {
      codes.set(c.email, structuredClone(c));
    },
    async bumpLoginAttempts(email) {
      const c = codes.get(email);
      if (c) c.attempts++;
    },
    async deleteLoginCode(email) {
      codes.delete(email);
    },
    async putRefreshToken(t) {
      tokens.set(t.tokenHash, structuredClone(t));
    },
    async findRefreshToken(h) {
      return clone(tokens.get(h));
    },
    async takeRefreshToken(h) {
      const t = tokens.get(h);
      tokens.delete(h);
      return clone(t);
    },
    async deleteRefreshTokens(accountId) {
      for (const [k, t] of tokens) if (t.accountId === accountId) tokens.delete(k);
    },
    async listPlans() {
      return [...plans.values()].map((p) => structuredClone(p));
    },
    async putPlan(p) {
      plans.set(p.id, structuredClone(p));
    },
    async listCampaigns() {
      return [...campaigns.values()].filter((c) => !c.archived).map((c) => structuredClone(c));
    },
    async findCampaign(id) {
      return clone(campaigns.get(id));
    },
    async putCampaign(c) {
      campaigns.set(c.id, structuredClone(c));
    },
    async putImage(i) {
      images.set(i.id, structuredClone(i));
    },
    async getImage(id) {
      return clone(images.get(id));
    },
    async addAudit(e) {
      audit.push(structuredClone(e));
    },
  };
}
