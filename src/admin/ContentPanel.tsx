import { ExternalLink, Pencil, RotateCcw, Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { LoadingScreen } from '../components/ui/LoadingScreen';
import { btnDanger, btnPrimary, btnSecondary, card } from '../components/ui/styles';
import { Tabs } from '../components/ui/Tabs';
import { t } from '../i18n';
import { LIMITS } from '../../server/siteContent';
import { loadContent, resetContent, saveContent, type SiteContent } from './api';
import { ContentRows, pick, RowEditor, type Field, type Values } from './ContentRows';
import { moveItem } from './editing';
import { errorText, isAuthError } from './errors';
import { fmtDateTime } from './format';
import { LandingPreview, type ContentSection } from './LandingPreview';
import { LoadError, PanelHead } from './ui';
import { useLoad } from './useLoad';

type Draft = Omit<SiteContent, 'updatedAt'>;
const strip = ({ updatedAt: _u, ...rest }: SiteContent): Draft => rest;
type ListKey = 'features' | 'faqs';
/** The one open row: its section, index (0 for hero/contact), the values being typed, and whether it was just added. */
interface Edit {
  section: ContentSection;
  index: number;
  values: Values;
  start: Values;
  isNew: boolean;
}

const FIELDS: Record<ContentSection, readonly Field[]> = {
  hero: [
    { key: 'heroTitle', label: t('Judul utama'), max: LIMITS.heroTitle },
    { key: 'heroSubtitle', label: t('Subjudul'), max: LIMITS.heroSubtitle, isLong: true },
  ],
  features: [
    { key: 'title', label: t('Judul'), max: LIMITS.featureTitle },
    { key: 'text', label: t('Teks'), max: LIMITS.featureText, isLong: true },
  ],
  faqs: [
    { key: 'q', label: t('Pertanyaan'), max: LIMITS.faqQ },
    { key: 'a', label: t('Jawaban'), max: LIMITS.faqA, isLong: true, isMultiline: true },
  ],
  contact: [{ key: 'contact', label: t('Kontak di bagian bawah'), max: LIMITS.contact, isOptional: true, placeholder: t('Contoh: WhatsApp 0812-xxxx-xxxx · halo@pikul.id') }],
};
const HINT: Record<ContentSection, string> = {
  hero: t('Judul besar dan kalimat pembuka di paling atas halaman.'),
  features: t('Daftar "Semua fitur". Yang disembunyikan tidak tampil.'),
  faqs: t('Urutan di sini sama dengan urutan di halaman.'),
  contact: t('Satu baris di bagian paling bawah halaman.'),
};

/** Apply the open row's values to the draft (preview while typing, and Selesai). */
function applyEdit(d: Draft, e: Edit | null): Draft {
  if (!e) return d;
  if (e.section === 'hero' || e.section === 'contact') return { ...d, ...e.values };
  const list = d[e.section] as Array<Draft[ListKey][number]>;
  return { ...d, [e.section]: list.map((x, i) => (i === e.index ? { ...x, ...e.values } : x)) };
}
const same = (a: Values, b: Values) => JSON.stringify(a) === JSON.stringify(b);

/** Landing page text (ADR-020, ADR-024): sub-sections, read-only rows opened one at a time, preview, one Simpan. */
export function ContentPanel({ onError }: { onError: (e: unknown) => Promise<void> }) {
  const { data, error, reload } = useLoad(loadContent, [], onError);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [section, setSection] = useState<ContentSection>('hero');
  const [edit, setEdit] = useState<Edit | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  useEffect(() => {
    if (data) setDraft(strip(data.content));
  }, [data]);

  const run = async (fn: () => Promise<unknown>, done: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(done);
      setConfirmReset(false);
      setEdit(null);
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
  const dirty = JSON.stringify(strip(data.content)) !== JSON.stringify(draft);

  /** Any switch away from a changed open row is refused until Selesai or Batal. */
  const canLeave = () => {
    if (!edit || (!edit.isNew && same(edit.values, edit.start))) return true;
    setNotice(t('Tekan Selesai atau Batal dulu.'));
    return false;
  };
  const open = (s: ContentSection, index: number, isNew = false, base: Draft = draft) => {
    if (edit && !canLeave()) return;
    const row = s === 'hero' || s === 'contact' ? base : base[s][index];
    if (!row) return;
    const values = pick(row, FIELDS[s]);
    setNotice(null);
    setEdit({ section: s, index, values, start: values, isNew });
  };
  const cancel = () => {
    if (edit?.isNew && (edit.section === 'features' || edit.section === 'faqs')) {
      const key = edit.section;
      setDraft({ ...draft, [key]: draft[key].filter((_, i) => i !== edit.index) });
    }
    setEdit(null);
    setNotice(null);
  };
  const done = () => {
    setDraft(applyEdit(draft, edit));
    setEdit(null);
    setNotice(null);
  };
  const changeSection = (s: ContentSection) => {
    if (edit && !canLeave()) return;
    if (edit) cancel();
    setSection(s);
  };
  const setList = <K extends ListKey>(k: K, v: Draft[K]) => setDraft({ ...draft, [k]: v });
  const add = (k: ListKey) => {
    const row = k === 'features' ? { icon: 'check', title: '', text: '', hidden: false } : { q: '', a: '', hidden: false };
    const next = { ...draft, [k]: [...draft[k], row] } as Draft;
    setDraft(next);
    const values = pick(row, FIELDS[k]);
    setNotice(null);
    setEdit({ section: k, index: next[k].length - 1, values, start: values, isNew: true });
  };

  const editor = (s: ContentSection) =>
    edit && edit.section === s ? (
      <RowEditor idPrefix={`c-${s}-${edit.index}`} fields={FIELDS[s]} values={edit.values} notice={notice} onChange={(v) => setEdit({ ...edit, values: v })} onDone={done} onCancel={cancel} />
    ) : null;

  const listProps = (k: ListKey) => ({
    items: draft[k],
    fields: FIELDS[k],
    openIndex: edit?.section === k ? edit.index : null,
    isLocked: edit !== null,
    editor: () => editor(k),
    onOpen: (i: number) => open(k, i),
    onAdd: () => add(k),
    onMove: (i: number, by: -1 | 1) => setList(k, moveItem<{ hidden: boolean }>(draft[k], i, by) as Draft[typeof k]),
    onToggle: (i: number) => setList(k, draft[k].map((x, j) => (j === i ? { ...x, hidden: !x.hidden } : x)) as Draft[typeof k]),
    onDelete: (i: number) => setList(k, draft[k].filter((_, j) => j !== i) as Draft[typeof k]),
  });

  const single = (s: 'hero' | 'contact') =>
    edit?.section === s ? (
      editor(s)
    ) : (
      <button
        type="button"
        onClick={() => open(s, 0)}
        disabled={edit !== null}
        aria-label={t('Ubah {0}', s === 'hero' ? t('Bagian atas') : t('Kontak'))}
        className="flex w-full items-start gap-3 rounded-lg border border-line p-3 text-left transition-colors hover:bg-subtle disabled:cursor-not-allowed"
      >
        <dl className="min-w-0 flex-1 space-y-2">
          {FIELDS[s].map((f) => (
            <div key={f.key}>
              <dt className="text-[12px] font-semibold text-muted">{f.label}</dt>
              <dd className="text-[15px] break-words text-ink">{(draft as unknown as Values)[f.key] || <span className="text-muted">{t('(kosong)')}</span>}</dd>
            </div>
          ))}
        </dl>
        <span className="inline-flex shrink-0 items-center gap-1 text-[14px] font-semibold text-brand-700">
          <Pencil aria-hidden size={16} />
          {t('Ubah')}
        </span>
      </button>
    );

  const preview = applyEdit(draft, edit);
  const focus = edit && edit.section === section ? edit.index : null;
  const counts = { features: draft.features.length, faqs: draft.faqs.length };

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
      <div className="border-b border-line">
        <Tabs<ContentSection>
          label={t('Bagian halaman')}
          value={section}
          onChange={changeSection}
          items={[
            { value: 'hero', label: t('Bagian atas') },
            { value: 'features', label: t('Keunggulan'), count: counts.features },
            { value: 'faqs', label: t('Tanya jawab'), count: counts.faqs },
            { value: 'contact', label: t('Kontak') },
          ]}
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_400px]">
        <section className={`${card} min-w-0 p-4 md:p-5`} aria-label={t('Ubah isi')}>
          <p className="mb-3 text-[13px] text-muted">{HINT[section]} {t('Ketuk baris untuk mengubah.')}</p>
          {section === 'hero' && single('hero')}
          {section === 'features' && <ContentRows name={t('keunggulan')} max={LIMITS.features} addLabel={t('Tambah keunggulan')} {...listProps('features')} />}
          {section === 'faqs' && <ContentRows name={t('pertanyaan')} max={LIMITS.faqs} addLabel={t('Tambah pertanyaan')} {...listProps('faqs')} />}
          {section === 'contact' && single('contact')}
        </section>
        <div className="min-w-0 lg:sticky lg:top-6 lg:self-start">
          <LandingPreview draft={preview} section={section} focus={focus} />
        </div>
      </div>
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
          <button type="button" className={btnSecondary} onClick={() => setConfirmReset(true)} disabled={data.isDefault || edit !== null}>
            <RotateCcw aria-hidden size={18} />
            {t('Pulihkan bawaan')}
          </button>
        )}
      </section>
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur md:left-[240px]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-end gap-x-3 gap-y-2 md:px-4">
          <span className="text-[13px] text-muted">
            {edit ? t('Selesaikan baris yang sedang diubah dulu.') : dirty ? t('Ada perubahan belum disimpan.') : t('Semua tersimpan.')}
          </span>
          <div className="flex gap-2">
            <button type="button" className={btnSecondary} disabled={!dirty || busy} onClick={() => (setEdit(null), setDraft(strip(data.content)))}>
              {t('Batalkan')}
            </button>
            <button type="button" className={btnPrimary} disabled={!dirty || busy || edit !== null} onClick={() => void run(() => saveContent(draft), t('Konten disimpan. Halaman depan langsung berubah.'))}>
              <Save aria-hidden size={18} />
              {t('Simpan')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
