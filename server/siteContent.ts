import defaults from '../landing/content.json';
import { isResponse, requireAdmin } from './adminAuth';
import type { ContentFaq, ContentFeature, SiteContent } from './adminTypes';
import type { Checked } from './catalog';
import type { ApiResponse, Deps } from './types';

/** Landing page text edited in the console (ADR-020). Plain text only; the landing script renders it with textContent. */

export const FEATURE_ICONS = ['receipt', 'layers', 'tag', 'qr', 'scale', 'rotate', 'chart', 'users', 'wallet', 'lock', 'save', 'globe', 'check'] as const;
export const LIMITS = { heroTitle: 80, heroSubtitle: 220, featureTitle: 40, featureText: 160, features: 16, faqQ: 120, faqA: 600, faqs: 20, contact: 160 } as const;

export const DEFAULT_CONTENT: Omit<SiteContent, 'updatedAt'> = defaults as Omit<SiteContent, 'updatedAt'>;

const fail = <T>(error: string): Checked<T> => ({ ok: false, error });
const CTRL = /[\u0000-\u0009\u000b-\u001f\u007f]/; // newline allowed only where noted
function str(v: unknown, max: number, { required = true, multiline = false } = {}): string | null {
  if (typeof v !== 'string') return null;
  const s = v.replace(/\r\n?/g, '\n').trim();
  if (s.length > max || (required && !s)) return null;
  if (CTRL.test(s) || (!multiline && s.includes('\n'))) return null;
  return s;
}

export function checkContent(body: unknown): Checked<Omit<SiteContent, 'updatedAt'>> {
  const f = (body ?? {}) as Record<string, unknown>;
  const heroTitle = str(f.heroTitle, LIMITS.heroTitle);
  const heroSubtitle = str(f.heroSubtitle, LIMITS.heroSubtitle);
  if (heroTitle === null || heroSubtitle === null) return fail('invalid_hero');
  const contact = str(f.contact ?? '', LIMITS.contact, { required: false });
  if (contact === null) return fail('invalid_contact');
  if (!Array.isArray(f.features) || f.features.length > LIMITS.features) return fail('invalid_content_features');
  const features: ContentFeature[] = [];
  for (const x of f.features as Record<string, unknown>[]) {
    const title = str(x?.title, LIMITS.featureTitle);
    const text = str(x?.text, LIMITS.featureText);
    const icon = typeof x?.icon === 'string' && (FEATURE_ICONS as readonly string[]).includes(x.icon) ? x.icon : 'check';
    if (title === null || text === null || typeof x.hidden !== 'boolean') return fail('invalid_content_features');
    features.push({ icon, title, text, hidden: x.hidden } as ContentFeature);
  }
  if (!Array.isArray(f.faqs) || f.faqs.length > LIMITS.faqs) return fail('invalid_faqs');
  const faqs: ContentFaq[] = [];
  for (const x of f.faqs as Record<string, unknown>[]) {
    const q = str(x?.q, LIMITS.faqQ);
    const a = str(x?.a, LIMITS.faqA, { multiline: true });
    if (q === null || a === null || typeof x.hidden !== 'boolean') return fail('invalid_faqs');
    faqs.push({ q, a, hidden: x.hidden });
  }
  return { ok: true, value: { heroTitle, heroSubtitle, features, faqs, contact } };
}

export async function adminContent(deps: Deps, auth: string | null): Promise<ApiResponse> {
  const a = await requireAdmin(deps, auth);
  if (isResponse(a)) return a;
  const saved = await deps.repo.getContent();
  return { status: 200, body: { content: saved ?? { ...DEFAULT_CONTENT, updatedAt: 0 }, isDefault: !saved } };
}

export async function adminSaveContent(deps: Deps, auth: string | null, body: unknown, reset = false): Promise<ApiResponse> {
  const a = await requireAdmin(deps, auth);
  if (isResponse(a)) return a;
  const checked = reset ? ({ ok: true, value: structuredClone(DEFAULT_CONTENT) } as const) : checkContent(body);
  if (!checked.ok) return { status: 400, body: { error: checked.error } };
  const now = deps.now();
  const content: SiteContent = { ...checked.value, updatedAt: now };
  await deps.repo.putContent(content);
  await deps.repo.addAudit({ at: now, email: a.actor, action: reset ? 'content.reset' : 'content.save', target: 'landing', detail: content });
  return { status: 200, body: { content }, purgePublic: true };
}
