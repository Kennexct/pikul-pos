import { Plus } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { RupiahInput } from '../components/ui/RupiahInput';
import { badgeBrand, badgeNeutral, btnPrimary, btnSecondary, card, helperText, inputBase, labelBase } from '../components/ui/styles';
import { Switch } from '../components/ui/Switch';
import { formatRupiah } from '../lib/money';
import { t } from '../i18n';
import { savePlan, type PlanDef } from './api';
import { errorText, isAuthError } from './errors';

type Draft = Omit<PlanDef, 'updatedAt' | 'amount' | 'days' | 'features'> & { amount: number | null; days: string; features: string };
const toDraft = (p: PlanDef): Draft => ({ ...p, days: String(p.days), features: p.features.join('\n') });
const blank = (sort: number): Draft => ({ id: '', name: '', amount: null, days: '30', note: '', badge: '', features: '', active: false, sort });

interface Props {
  plans: PlanDef[];
  onChanged: () => Promise<void>;
  onError: (e: unknown) => Promise<void>;
}

/** Plans (ADR-014): what the landing page, the app and Midtrans checkout use. */
export function PlansPanel({ plans, onChanged, onError }: Props) {
  const [adding, setAdding] = useState(false);
  const nextSort = (plans.reduce((m, p) => Math.max(m, p.sort), 0) || 0) + 10;
  return (
    <section aria-labelledby="plans-title">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="plans-title" className="text-[17px] font-bold text-ink">
            {t('Paket harga')}
          </h2>
          <p className="text-[14px] text-muted">{t('Tersimpan = langsung dipakai di halaman depan (±1 menit), aplikasi, dan pembayaran Midtrans.')}</p>
        </div>
        {!adding && (
          <button type="button" className={btnSecondary} onClick={() => setAdding(true)}>
            <Plus aria-hidden size={18} />
            {t('Tambah paket')}
          </button>
        )}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {adding && <PlanEditor draft={blank(nextSort)} isNew onDone={() => setAdding(false)} onChanged={onChanged} onError={onError} />}
        {plans.map((p) => (
          <PlanEditor key={`${p.id}-${p.updatedAt}`} draft={toDraft(p)} isNew={false} onChanged={onChanged} onError={onError} />
        ))}
      </div>
      <p className={`${helperText} mt-4`}>{t('Paket tidak bisa dihapus karena dipakai riwayat pembayaran. Matikan "Dijual" untuk menyembunyikannya. Semua paket membuka semua fitur; baris fitur hanya untuk tampilan.')}</p>
    </section>
  );
}

function PlanEditor({ draft, isNew, onDone, onChanged, onError }: { draft: Draft; isNew: boolean; onDone?: () => void } & Omit<Props, 'plans'>) {
  const [d, setD] = useState(draft);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const id = isNew ? 'new' : d.id;
  const dirty = JSON.stringify(d) !== JSON.stringify(draft);

  const save = async () => {
    setBusy(true);
    try {
      await savePlan({ ...d, amount: d.amount ?? 0, days: Number(d.days), features: d.features.split('\n'), isNew });
      toast.success(t('Paket "{0}" tersimpan.', d.name));
      onDone?.();
      await onChanged();
    } catch (e) {
      if (isAuthError(e)) await onError(e);
      else toast.error(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className={`${card} flex flex-col gap-3 p-4 md:p-5`}
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="truncate text-[16px] font-bold text-ink">{isNew ? t('Paket baru') : `${d.name} · ${formatRupiah(draft.amount ?? 0)}`}</h3>
        {!isNew && <span className={d.active ? badgeBrand : badgeNeutral}>{d.active ? t('Dijual') : t('Disembunyikan')}</span>}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`${id}-id`} className={labelBase}>
            {t('Kode paket')}
          </label>
          <input id={`${id}-id`} className={`${inputBase} disabled:bg-subtle`} value={d.id} disabled={!isNew} placeholder="quarterly" onChange={(e) => set('id', e.target.value.toLowerCase())} />
        </div>
        <div>
          <label htmlFor={`${id}-name`} className={labelBase}>
            {t('Nama paket')}
          </label>
          <input id={`${id}-name`} className={inputBase} value={d.name} maxLength={40} onChange={(e) => set('name', e.target.value)} />
        </div>
        <div>
          <label htmlFor={`${id}-amount`} className={labelBase}>
            {t('Harga')}
          </label>
          <RupiahInput id={`${id}-amount`} value={d.amount} onChange={(v) => set('amount', v)} />
        </div>
        <div>
          <label htmlFor={`${id}-days`} className={labelBase}>
            {t('Masa aktif (hari)')}
          </label>
          <input id={`${id}-days`} inputMode="numeric" className={`${inputBase} num`} value={d.days} onChange={(e) => set('days', e.target.value.replace(/\D/g, ''))} />
        </div>
        <div>
          <label htmlFor={`${id}-badge`} className={labelBase}>
            {t('Label kecil (opsional)')}
          </label>
          <input id={`${id}-badge`} className={inputBase} value={d.badge} maxLength={24} placeholder={t('Hemat 2 bulan')} onChange={(e) => set('badge', e.target.value)} />
        </div>
        <div>
          <label htmlFor={`${id}-sort`} className={labelBase}>
            {t('Urutan')}
          </label>
          <input id={`${id}-sort`} inputMode="numeric" className={`${inputBase} num`} value={d.sort} onChange={(e) => set('sort', Number(e.target.value.replace(/\D/g, '')) || 0)} />
        </div>
      </div>
      <div>
        <label htmlFor={`${id}-note`} className={labelBase}>
          {t('Keterangan')}
        </label>
        <input id={`${id}-note`} className={inputBase} value={d.note} maxLength={200} onChange={(e) => set('note', e.target.value)} />
      </div>
      <div>
        <label htmlFor={`${id}-features`} className={labelBase}>
          {t('Fitur (satu per baris, maks. 8)')}
        </label>
        <textarea id={`${id}-features`} rows={4} className={`${inputBase} h-auto py-2.5`} value={d.features} onChange={(e) => set('features', e.target.value)} />
      </div>
      <Switch checked={d.active} onChange={(v) => set('active', v)} label={t('Dijual')} description={t('Tampil di halaman depan dan aplikasi, dan bisa dibayar.')} />
      <div className="flex gap-2">
        <button type="submit" className={`${btnPrimary} flex-1`} disabled={busy || (!dirty && !isNew)}>
          {isNew ? t('Buat paket') : t('Simpan')}
        </button>
        {(isNew || dirty) && (
          <button type="button" className={btnSecondary} onClick={() => (isNew ? onDone?.() : setD(draft))}>
            {t('Batal')}
          </button>
        )}
      </div>
    </form>
  );
}
