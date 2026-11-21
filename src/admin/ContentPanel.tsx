import { ExternalLink, RotateCcw, Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { LoadingScreen } from '../components/ui/LoadingScreen';
import { btnDanger, btnPrimary, btnSecondary, card, inputBase, labelBase } from '../components/ui/styles';
import { t } from '../i18n';
import { LIMITS } from '../../server/siteContent';
import { loadContent, resetContent, saveContent, type SiteContent } from './api';
import { ContentList } from './ContentList';
import { errorText, isAuthError } from './errors';
import { fmtDateTime } from './format';
import { LoadError, PanelHead } from './ui';
import { useLoad } from './useLoad';

type Draft = Omit<SiteContent, 'updatedAt'>;
const strip = ({ updatedAt: _u, ...rest }: SiteContent): Draft => rest;

/** Landing page text (ADR-020): hero, features, FAQ, contact. Plain text only; prices come from Paket harga. */
export function ContentPanel({ onError }: { onError: (e: unknown) => Promise<void> }) {
  const { data, error, reload } = useLoad(loadContent, [], onError);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  useEffect(() => {
    if (data) setDraft(strip(data.content));
  }, [data]);
  const dirty = !!data && !!draft && JSON.stringify(strip(data.content)) !== JSON.stringify(draft);

  const run = async (fn: () => Promise<unknown>, done: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(done);
      setConfirmReset(false);
      await reload();
    } catch (e) {
      if (isAuthError(e)) await onError(e);
      toast.error(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  if (error && !data) return <LoadError error={error} onRetry={() => void reload()} />;
  if (!data || !draft) return <LoadingScreen message={t('Memuat…')} />;
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft({ ...draft, [k]: v });

  return (
    <div className="space-y-4 pb-24">
      <PanelHead
        title={t('Konten halaman depan')}
        hint={data.isDefault ? t('Masih memakai teks bawaan.') : t('Terakhir disimpan {0}.', fmtDateTime(data.content.updatedAt))}
        actions={
          <a className={btnSecondary} href="/" target="_blank" rel="noopener">
            <ExternalLink aria-hidden size={18} />
            {t('Lihat halaman')}
          </a>
        }
      />
      <section className={`${card} space-y-3 p-4 md:p-5`} aria-label={t('Bagian atas')}>
        <h3 className="text-[15px] font-bold text-ink">{t('Bagian atas')}</h3>
        <div>
          <label className={labelBase} htmlFor="c-hero-title">
            {t('Judul utama')} <span className="num font-normal text-muted">{t('{0}/{1}', draft.heroTitle.length, LIMITS.heroTitle)}</span>
          </label>
          <input id="c-hero-title" className={inputBase} maxLength={LIMITS.heroTitle} value={draft.heroTitle} onChange={(e) => set('heroTitle', e.target.value)} />
        </div>
        <div>
          <label className={labelBase} htmlFor="c-hero-sub">
            {t('Subjudul')} <span className="num font-normal text-muted">{t('{0}/{1}', draft.heroSubtitle.length, LIMITS.heroSubtitle)}</span>
          </label>
          <textarea id="c-hero-sub" rows={3} className={`${inputBase} h-auto min-h-24 py-2.5`} maxLength={LIMITS.heroSubtitle} value={draft.heroSubtitle} onChange={(e) => set('heroSubtitle', e.target.value.replace(/\n/g, ' '))} />
        </div>
      </section>
      <ContentList
        title={t('Keunggulan')}
        hint={t('Kartu fitur di halaman depan. Yang disembunyikan tidak tampil.')}
        items={draft.features}
        fields={[
          { key: 'title', label: t('Judul'), max: LIMITS.featureTitle },
          { key: 'text', label: t('Teks'), max: LIMITS.featureText, isLong: true },
        ]}
        max={LIMITS.features}
        addLabel={t('Tambah keunggulan')}
        blank={() => ({ icon: 'check', title: '', text: '', hidden: false })}
        onChange={(v) => set('features', v)}
      />
      <ContentList
        title={t('Tanya jawab (FAQ)')}
        hint={t('Urutan di sini sama dengan urutan di halaman.')}
        items={draft.faqs}
        fields={[
          { key: 'q', label: t('Pertanyaan'), max: LIMITS.faqQ },
          { key: 'a', label: t('Jawaban'), max: LIMITS.faqA, isLong: true },
        ]}
        max={LIMITS.faqs}
        addLabel={t('Tambah pertanyaan')}
        blank={() => ({ q: '', a: '', hidden: false })}
        onChange={(v) => set('faqs', v)}
      />
      <section className={`${card} p-4 md:p-5`} aria-label={t('Kontak')}>
        <label className={labelBase} htmlFor="c-contact">
          {t('Kontak di bagian bawah')} <span className="num font-normal text-muted">{t('{0}/{1}', draft.contact.length, LIMITS.contact)}</span>
        </label>
        <input id="c-contact" className={inputBase} maxLength={LIMITS.contact} value={draft.contact} onChange={(e) => set('contact', e.target.value)} placeholder={t('Contoh: WhatsApp 0812-xxxx-xxxx · halo@pikul.id')} />
      </section>
      <section className={`${card} flex flex-col gap-3 p-4 md:flex-row md:items-center md:p-5`}>
        <p className="flex-1 text-[14px] text-ink-soft">{t('Kembalikan semua teks ke bawaan aplikasi.')}</p>
        {confirmReset ? (
          <div className="flex gap-2">
            <button type="button" className={btnSecondary} onClick={() => setConfirmReset(false)}>
              {t('Batal')}
            </button>
            <button type="button" className={btnDanger} disabled={busy} onClick={() => void run(resetContent, t('Teks bawaan dipulihkan.'))}>
              {t('Ya, pulihkan')}
            </button>
          </div>
        ) : (
          <button type="button" className={btnSecondary} onClick={() => setConfirmReset(true)} disabled={data.isDefault}>
            <RotateCcw aria-hidden size={18} />
            {t('Pulihkan bawaan')}
          </button>
        )}
      </section>
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-end gap-3 md:px-4">
          <span className="text-[13px] text-muted">{dirty ? t('Ada perubahan belum disimpan.') : t('Semua tersimpan.')}</span>
          <button type="button" className={btnSecondary} disabled={!dirty || busy} onClick={() => setDraft(strip(data.content))}>
            {t('Batalkan')}
          </button>
          <button type="button" className={btnPrimary} disabled={!dirty || busy} onClick={() => void run(() => saveContent(draft), t('Konten disimpan. Halaman depan langsung berubah.'))}>
            <Save aria-hidden size={18} />
            {t('Simpan')}
          </button>
        </div>
      </div>
    </div>
  );
}
