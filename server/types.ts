/** A plan Kenny sets in the admin console (ADR-014). `id` is a fixed slug; payments point at it. */
export interface PlanDef {
  id: string;
  name: string;
  amount: number; // integer Rupiah
  days: number;
  note: string;
  badge: string;
  features: string[];
  active: boolean; // shown on the landing page and in the app, and sellable
  sort: number;
  updatedAt: number;
}

/** A scheduled pop-up banner for the landing page and/or the merchant app, optionally with a promo price (ADR-014). */
export interface Campaign {
  id: string;
  name: string; // internal
  title: string; // heading, and the banner's alt text
  body: string;
  imageUrl: string | null; // uploaded (/api/public/images/<id>) or https
  linkUrl: string | null; // the whole banner opens this when set
  ctaLabel: string; // button under the banner; shown only with a link
  showOnLanding: boolean;
  showInApp: boolean; // once per merchant account, after sign-in / next app open
  startsAt: number;
  endsAt: number;
  enabled: boolean;
  archived: boolean;
  planId: string | null;
  promoAmount: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface StoredImage {
  id: string;
  mime: 'image/png' | 'image/jpeg' | 'image/webp';
  data: Uint8Array;
  createdAt: number;
}

export interface AdminAuditEntry {
  at: number;
  email: string;
  action: string;
  target: string;
  detail: unknown;
}

export const TRIAL_DAYS = 14;
export const DAY_MS = 86_400_000;

export interface Account {
  id: string;
  email: string;
  googleSub: string | null;
  createdAt: number;
  trialEndsAt: number;
  paidUntil: number | null; // entitlement beyond the trial; no payment provider sets it yet
}

export interface LoginCode {
  email: string;
  codeHash: string;
  expiresAt: number;
  attempts: number;
  sentAt: number;
}

export interface RefreshToken {
  tokenHash: string;
  accountId: string;
  expiresAt: number;
}

export interface Repo {
  findAccountByEmail(email: string): Promise<Account | null>;
  findAccountById(id: string): Promise<Account | null>;
  createAccount(a: Account): Promise<void>;
  setGoogleSub(id: string, sub: string): Promise<void>;
  setPaidUntil(id: string, paidUntil: number): Promise<void>;

  getLoginCode(email: string): Promise<LoginCode | null>;
  putLoginCode(c: LoginCode): Promise<void>;
  bumpLoginAttempts(email: string): Promise<void>;
  deleteLoginCode(email: string): Promise<void>;

  putRefreshToken(t: RefreshToken): Promise<void>;
  findRefreshToken(tokenHash: string): Promise<RefreshToken | null>;
  takeRefreshToken(tokenHash: string): Promise<RefreshToken | null>; // read and delete (rotation)
  deleteRefreshTokens(accountId: string): Promise<void>;

  listPlans(): Promise<PlanDef[]>;
  putPlan(p: PlanDef): Promise<void>;
  listCampaigns(): Promise<Campaign[]>; // not archived
  findCampaign(id: string): Promise<Campaign | null>;
  putCampaign(c: Campaign): Promise<void>;
  putImage(i: StoredImage): Promise<void>;
  getImage(id: string): Promise<StoredImage | null>;
  addAudit(e: AdminAuditEntry): Promise<void>;
}

export interface Mailer {
  sendLoginCode(email: string, code: string): Promise<void>;
}

export interface PassSigner {
  sign(claims: { sub: string; email: string; plan: 'trial' | 'paid'; until: number }): Promise<string>;
}

export interface GoogleVerifier {
  verify(idToken: string): Promise<{ sub: string; email: string } | null>;
}

export interface Deps {
  repo: Repo;
  mailer: Mailer;
  signer: PassSigner;
  google: GoogleVerifier | null;
  now: () => number;
  appOrigin: string;
  /** Lower-cased emails allowed into /admin (ADMIN_EMAILS). Empty = console closed. */
  adminEmails: readonly string[];
  /** ADMIN_OPEN=1: /admin without sign-in (temporary, ADR-019). Anyone with the link can edit plans and promos. */
  adminOpen?: boolean;
}

export interface ApiResponse {
  status: number;
  body: unknown;
  /** Edge-cacheable for this many seconds (public GETs only). */
  cacheSeconds?: number;
  /** Set on admin writes so the wrapper can drop the cached public landing data. */
  purgePublic?: boolean;
  /** Binary body (images); `body` is ignored when set. */
  raw?: { contentType: string; bytes: Uint8Array };
}
