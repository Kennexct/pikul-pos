import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { RupiahInput } from '../components/ui/RupiahInput';
import { Sheet } from '../components/ui/Sheet';
import { btnGhost, btnIcon, btnPrimary, btnSecondary, helperText, inputBase, labelBase, option } from '../components/ui/styles';
import { Switch } from '../components/ui/Switch';
import { formatRupiah } from '../lib/money';
import { t } from '../i18n';
import { DAY_CHOICES, FEATURE_MAX, MAX_AMOUNT, MAX_DAYS, MAX_FEATURES, MIN_AMOUNT, planDays, planProblems, slugify, type PlanDraft, type PlanProblem } from './editing';
import { PlanFace } from './PlanCard';

const PROBLEM: Record<PlanProblem, () => string> = {
  id_format: () => t('Kode 2–24 huruf kecil, angka atau tanda minus.'),
  id_taken: () => t('Kode ini sudah dipakai paket lain.'),
  name_required: () => t('Nama paket wajib diisi.'),
  amount_range: () => t('Harga antara {0} dan {1}.', formatRupiah(MIN_AMOUNT), formatRupiah(MAX_AMOUNT)),
  days_range: () => t('Masa aktif 1 sampai {0} hari.', MAX_DAYS),
  features_max: () => t('Maksimal {0} fitur.', MAX_FEATURES),
};

interface Props {
  isOpen: boolean;
  isNew: boolean;
  start: PlanDraft;
  otherIds: readonly string[];
  busy: boolean;
  onClose: () => void;
  onSave: (d: PlanDraft) => void;
}

/** Plan editor in a sheet (ADR-024): constrained fields, reasons under fields, live card preview. */
export function PlanSheet({ isOpen, isNew, start, otherIds, busy, onClose, onSave }: Props) {
  const [d, setD] = useState(start);
  const [isCodeManual, setIsCodeManual] = useState(false);
  const [touched, setTouched] = useState(false);
  const set = <K extends keyof PlanDraft>(k: K, v: PlanDraft[K]) => setD((x) => ({ ...x, [k]: v }));
  const setName = (name: string) => setD((x) => ({ ...x, name, id: isNew && !isCodeManual ? slugify(name) : x.id }));
  const problems = planProblems(d, otherIds, isNew);
  const isValid = Object.keys(problems).length === 0;
  const dirty = JSON.stringify(d) !== JSON.stringify(start);
  const err = (k: keyof typeof problems) => {
    const p = problems[k];
    return touched && p ? (
      <p className="mt-1.5 text-[13px] font-semibold text-danger-700" role="alert">
        {PROBLEM[p]()}
      </p>
    ) : null;
  };
  const setFeature = (i: number, v: string) => set('features', d.features.map((x, k) => (k === i ? v : x)));
  const submit = () => {
    setTouched(true);
    if (isValid && (dirty || isNew)) onSave(d);
  };

  return (
    <Sheet
      title={isNew ? t('Paket baru') : t('Ubah paket')}
      subtitle={isNew ? t('Tersimpan = langsung tampil jika "Dijual" aktif.') : d.name}
      isOpen={isOpen}
      onClose={onClose}
      isWide
      footer={
        <div className="flex gap-2">
          <button type="button" className={btnSecondary} onClick={onClose}>
            {t('Batal')}
          </button>
          <button type="button" className={`${btnPrimary} flex-1`} disabled={busy || (!dirty && !isNew) || (touched && !isValid)} onClick={submit}>
            {isNew ? t('Buat paket') : t('Simpan')}
          </button>
        </div>
      }
    >
      <form
        className="grid gap-5 md:grid-cols-[minmax(0,1fr)_230px]"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="min-w-0 space-y-4">
          <div>
            <label htmlFor="plan-name" className={labelBase}>
              {t('Nama paket')}
            </label>
            <input id="plan-name" className={inputBase} value={d.name} maxLength={40} placeholder={t('Contoh: Tahunan')} onChange={(e) => setName(e.target.value)} />
            {err('name')}
            {isNew && !isCodeManual && (
              <p className={helperText}>
                {t('Kode paket: {0}', d.id || '—')}{' '}
                <button type="button" className="font-semibold text-brand-700 underline" onClick={() => setIsCodeManual(true)}>
                  {t('Ubah kode')}
                </button>
              </p>
            )}
            {!isNew && <p className={helperText}>{t('Kode paket: {0} (tidak bisa diubah)', d.id)}</p>}
          </div>
          {isNew && isCodeManual && (
            <div>
              <label htmlFor="plan-id" className={labelBase}>
                {t('Kode paket')}
              </label>
              <input id="plan-id" className={`${inputBase} num`} value={d.id} maxLength={24} onChange={(e) => set('id', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} />
              <p className={helperText}>{t('Dipakai di sistem dan tidak bisa diubah setelah dibuat.')}</p>
            </div>
          )}
          {err('id')}
          <div>
            <label htmlFor="plan-amount" className={labelBase}>
              {t('Harga')}
            </label>
            <RupiahInput id="plan-amount" value={d.amount} onChange={(v) => set('amount', v)} />
            {err('amount')}
          </div>
          <fieldset>
            <legend className={labelBase}>{t('Masa aktif')}</legend>
            <div className="flex flex-wrap gap-2">
              {DAY_CHOICES.map((n) => (
                <button key={n} type="button" className={option(d.dayChoice === n)} aria-pressed={d.dayChoice === n} onClick={() => set('dayChoice', n)}>
                  {t('{0} hari', n)}
                </button>
              ))}
              <button type="button" className={option(d.dayChoice === 'other')} aria-pressed={d.dayChoice === 'other'} onClick={() => set('dayChoice', 'other')}>
                {t('Lainnya')}
              </button>
            </div>
            {d.dayChoice === 'other' && (
              <div className="mt-2 flex items-center gap-2">
                <input aria-label={t('Jumlah hari')} inputMode="numeric" className={`${inputBase} num w-28`} maxLength={4} value={d.customDays} onChange={(e) => set('customDays', e.target.value.replace(/\D/g, ''))} />
                <span className="text-[14px] text-muted">{t('hari')}</span>
              </div>
            )}
            {err('days')}
          </fieldset>
          <div>
            <label htmlFor="plan-badge" className={labelBase}>
              {t('Label kecil (opsional)')}
            </label>
            <input id="plan-badge" className={inputBase} value={d.badge} maxLength={24} placeholder={t('Hemat 2 bulan')} onChange={(e) => set('badge', e.target.value)} />
          </div>
          <div>
            <label htmlFor="plan-note" className={labelBase}>
              {t('Keterangan (opsional)')}
            </label>
            <input id="plan-note" className={inputBase} value={d.note} maxLength={200} onChange={(e) => set('note', e.target.value)} />
          </div>
          <fieldset>
            <legend className={labelBase}>{t('Fitur ({0}/{1})', d.features.filter((f) => f.trim()).length, MAX_FEATURES)}</legend>
            <ol className="space-y-2">
              {d.features.map((f, i) => (
                <li key={i} className="flex gap-2">
                  <input aria-label={t('Fitur {0}', i + 1)} className={inputBase} maxLength={FEATURE_MAX} value={f} onChange={(e) => setFeature(i, e.target.value)} />
                  <button type="button" className={btnIcon} aria-label={t('Hapus fitur {0}', i + 1)} onClick={() => set('features', d.features.filter((_, k) => k !== i))}>
                    <Trash2 aria-hidden size={18} />
                  </button>
                </li>
              ))}
            </ol>
            {d.features.length < MAX_FEATURES && (
              <button type="button" className={`${btnGhost} mt-1`} onClick={() => set('features', [...d.features, ''])}>
                <Plus aria-hidden size={18} />
                {t('Tambah fitur')}
              </button>
            )}
            {err('features')}
          </fieldset>
          <Switch checked={d.active} onChange={(v) => set('active', v)} label={t('Dijual')} description={t('Tampil di halaman depan dan aplikasi.')} />
        </div>
        <aside className="min-w-0 md:sticky md:top-0 md:self-start" aria-label={t('Contoh di halaman depan')}>
          <p className="mb-2 text-[12px] font-semibold text-muted">{t('Contoh di halaman depan')}</p>
          <div className="rounded-xl border border-line bg-surface p-4 shadow-xs">
            <PlanFace plan={{ ...d, amount: d.amount ?? 0, days: planDays(d) }} isCompact />
          </div>
          {!d.active && <p className={helperText}>{t('Belum dijual: paket ini tidak tampil.')}</p>}
        </aside>
      </form>
    </Sheet>
  );
}
