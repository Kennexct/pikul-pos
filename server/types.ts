import type { AdminRepo } from './adminTypes';
import type { ReceiptRepo } from './receiptTypes';
import type { SyncRepo } from './syncTypes';

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
  showOnRegister: boolean; // first register opening of each business day (ADR-020)
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
  /** Sign-up profile (ADR-023). Empty on accounts made before v0.18. */
  ownerName?: string;
  storeName?: string;
  phone?: string; // digits, starts with 62
  city?: string;
}

/** What the merchant types on the sign-up page (ADR-023). */
export interface MerchantProfile {
  ownerName: string;
  storeName: string;
  phone: string;
  city: string;
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

export interface Repo extends AdminRepo, SyncRepo, ReceiptRepo {
  findAccountByEmail(email: string): Promise<Account | null>;
  findAccountById(id: string): Promise<Account | null>;
  /** Inserts; returns false when the email is taken. */
  createAccount(a: Account, passwordHash?: string | null): Promise<boolean>;
  getPasswordHash(id: string): Promise<string | null>;
  setPasswordHash(id: string, hash: string, at: number): Promise<void>;
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

/** A receipt email to a customer (ADR-028). */
export interface ReceiptMail {
  to: string;
  /** Shown as "<fromName> via Pikul". */
  fromName: string;
  replyTo: string | null;
  subject: string;
  html: string;
  text: string;
  png: Uint8Array;
  fileName: string;
}

export interface Mailer {
  sendLoginCode(email: string, code: string): Promise<void>;
  /** Absent on mailers that cannot send receipts (tests). */
  sendReceipt?(m: ReceiptMail): Promise<void>;
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
  /** False when no mail provider is configured: forgot-password by email is hidden (ADR-023). */
  emailEnabled: boolean;
  /** ADMIN_PASSWORD (ADR-020). Null or shorter than 12 characters = console closed. */
  adminPassword: string | null;
}

/** Per-request facts the router needs besides the body. */
export interface RequestCtx {
  ip: string;
  query: URLSearchParams;
}

export interface ApiResponse {
  status: number;
  body: unknown;
  /** Edge-cacheable for this many seconds (public GETs only). */
  cacheSeconds?: number;
  /** Set on admin writes so the wrapper can drop the cached public landing data. */
  purgePublic?: boolean;
  /** Text body such as CSV; `body` is ignored when set. */
  text?: { contentType: string; content: string; filename?: string };
  /** Binary body (images); `body` is ignored when set. */
  raw?: { contentType: string; bytes: Uint8Array };
}
