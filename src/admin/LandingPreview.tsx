import {
  BarChart3,
  Check,
  ChevronDown,
  Globe,
  Layers,
  Lock,
  QrCode,
  Receipt,
  RotateCcw,
  Save,
  Scale,
  Tag,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useRef } from 'react';
import { t } from '../i18n';
import type { SiteContent } from './api';

export type ContentSection = 'hero' | 'features' | 'faqs' | 'contact';
type Draft = Omit<SiteContent, 'updatedAt'>;

const ICONS: Record<string, LucideIcon> = {
  receipt: Receipt,
  layers: Layers,
  tag: Tag,
  qr: QrCode,
  scale: Scale,
  rotate: RotateCcw,
  chart: BarChart3,
  users: Users,
  wallet: Wallet,
  lock: Lock,
  save: Save,
  globe: Globe,
  check: Check,
};

/** Fixed copy of the landing page itself (scripts/landing/build.py). The page is Indonesian only, so the preview is too. */
const LP = {
  cta: 'Coba gratis 14 hari',
  ctaAlt: 'Lihat fitur',
  featEyebrow: 'Semua fitur',
  featTitle: 'Semua yang dibutuhkan satu toko, dalam satu aplikasi.',
  tagline: 'Jualan ringan. Catatan beres.',
  faqEyebrow: 'Pertanyaan umum',
  faqTitle: 'Yang sering ditanyakan',
} as const;

const ring = (on: boolean) => (on ? 'rounded-md bg-brand-50 ring-2 ring-brand-600 ring-offset-2 ring-offset-surface' : '');

interface Props {
  draft: Draft;
  section: ContentSection;
  /** Index of the row being edited in the section (features/faqs), or 0 for hero/contact while editing. */
  focus: number | null;
}

/**
 * Example of how the landing page section will look (ADR-024). Styled after scripts/landing/build.py, rendered with
 * React text nodes only. Hidden rows are left out, as on the real page; the row being edited is outlined.
 */
export function LandingPreview({ draft, section, focus }: Props) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = box.current?.querySelector<HTMLElement>('[data-focus="true"]');
    if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [focus, section]);

  return (
    <figure className="overflow-hidden rounded-lg border border-line bg-surface shadow-xs" aria-label={t('Contoh tampilan')}>
      <figcaption className="flex items-center gap-2 border-b border-line bg-subtle px-3 py-2">
        <span aria-hidden className="flex gap-1">
          <span className="h-2 w-2 rounded-full bg-line-strong" />
          <span className="h-2 w-2 rounded-full bg-line-strong" />
          <span className="h-2 w-2 rounded-full bg-line-strong" />
        </span>
        <span className="text-[12px] font-semibold uppercase tracking-[0.06em] text-muted">{t('Contoh tampilan')}</span>
      </figcaption>
      <div ref={box} className="max-h-[70vh] overflow-y-auto p-5">
        {section === 'hero' && (
          <div data-focus={focus !== null} className={`space-y-3 p-1 ${ring(focus !== null)}`}>
            <p className="text-[30px] font-extrabold leading-[1.08] tracking-[-0.035em] break-words text-ink">{draft.heroTitle || t('(Judul kosong)')}</p>
            <p className="text-[15px] leading-relaxed break-words text-ink-soft">{draft.heroSubtitle || t('(Subjudul kosong)')}</p>
            <div className="flex flex-wrap gap-2 pt-1" aria-hidden>
              <span className="inline-flex h-10 items-center rounded-lg bg-brand-600 px-4 text-[14px] font-bold text-white">{LP.cta}</span>
              <span className="inline-flex h-10 items-center rounded-lg border border-line-strong px-4 text-[14px] font-bold text-ink">{LP.ctaAlt}</span>
            </div>
          </div>
        )}
        {section === 'features' && (
          <div>
            <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-brand-700">{LP.featEyebrow}</p>
            <p className="mt-1 text-[20px] font-extrabold leading-tight tracking-[-0.02em] text-ink">{LP.featTitle}</p>
            <ul className="mt-3">
              {draft.features.map((f, i) => {
                if (f.hidden && focus !== i) return null;
                const Icon = ICONS[f.icon] ?? Check;
                return (
                  <li key={i} data-focus={focus === i} className={`flex items-start gap-3 border-b border-line py-3 ${ring(focus === i)} ${f.hidden ? 'opacity-50' : ''}`}>
                    <Icon aria-hidden size={18} className="mt-0.5 shrink-0 text-brand-600" />
                    <div className="min-w-0">
                      <p className="text-[15px] font-bold break-words text-ink">{f.title || t('(Judul kosong)')}</p>
                      <p className="mt-0.5 text-[13px] leading-snug break-words text-muted">{f.text || t('(Teks kosong)')}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        {section === 'faqs' && (
          <div>
            <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-brand-700">{LP.faqEyebrow}</p>
            <p className="mt-1 text-[20px] font-extrabold leading-tight tracking-[-0.02em] text-ink">{LP.faqTitle}</p>
            <ul className="mt-2 border-t border-line">
              {draft.faqs.map((f, i) => {
                if (f.hidden && focus !== i) return null;
                const isOpen = focus === i;
                return (
                  <li key={i} data-focus={isOpen} className={`border-b border-line py-3 ${ring(isOpen)} ${f.hidden ? 'opacity-50' : ''}`}>
                    <p className="flex items-start justify-between gap-3 text-[15px] font-bold break-words text-ink">
                      <span className="min-w-0">{f.q || t('(Pertanyaan kosong)')}</span>
                      <ChevronDown aria-hidden size={18} className={`mt-0.5 shrink-0 text-muted ${isOpen ? 'rotate-180' : ''}`} />
                    </p>
                    {isOpen && <p className="mt-2 whitespace-pre-line text-[14px] leading-relaxed break-words text-ink-soft">{f.a || t('(Jawaban kosong)')}</p>}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        {section === 'contact' && (
          <div className="border-t border-line pt-4">
            <p data-focus={focus !== null} className={`p-1 text-[13px] break-words text-muted ${ring(focus !== null)}`}>
              <strong className="text-ink">{LP.tagline}</strong> {draft.contact}
            </p>
          </div>
        )}
      </div>
    </figure>
  );
}
