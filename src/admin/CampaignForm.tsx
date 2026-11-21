import { Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { RupiahInput } from '../components/ui/RupiahInput';
import { Sheet } from '../components/ui/Sheet';
import { btnPrimary, btnSecondary, helperText, inputBase, labelBase, sectionTitle } from '../components/ui/styles';
import { Switch } from '../components/ui/Switch';
import { formatRupiah } from '../lib/money';
import { t } from '../i18n';
import { AdminError, saveCampaign, uploadImage, type CampaignInput, type CampaignRow, type PlanDef } from './api';
import { errorText, isAuthError } from './errors';

const HOUR = 3_600_000;
/** <input type="datetime-local"> works in the browser's time zone. */
const toLocal = (ms: number) => {
  const d = new Date(ms - new Date(ms).getTimezoneOffset() * 60_000);
  return d.toISOString().slice(0, 16);
};
const fromLocal = (v: string) => (v ? new Date(v).getTime() : NaN);

interface Props {
  campaign: CampaignRow | null;
  plans: PlanDef[];
  now: number;
  onClose: () => void;
  onSaved: () => Promise<void>;
  onError: (e: unknown) => Promise<void>;
}

export function CampaignForm({ campaign, plans, now, onClose, onSaved, onError }: Props) {
  const start = Math.ceil(now / HOUR) * HOUR;
  const [d, setD] = useState<CampaignInput>(
    campaign ?? { name: '', title: '', body: '', imageUrl: null, linkUrl: '/app/', ctaLabel: t('Coba gratis'), showOnLanding: true, showInApp: false, showOnRegister: false, startsAt: start, endsAt: start + 7 * 24 * HOUR, enabled: true, planId: null, promoAmount: null },
  );
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const set = <K extends keyof CampaignInput>(k: K, v: CampaignInput[K]) => setD((x) => ({ ...x, [k]: v }));
  const promoPlan = plans.find((p) => p.id === d.planId);

  const handle = async (work: () => Promise<void>) => {
    setBusy(true);
    try {
      await work();
    } catch (e) {
      if (isAuthError(e)) await onError(e);
      else toast.error(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const upload = (f: File | undefined) =>
    f &&
    void handle(async () => {
      if (f.size > 500_000) throw new AdminError('image_too_large', 413);
      set('imageUrl', await uploadImage(f));
    });
  const save = () =>
    void handle(async () => {
      await saveCampaign(campaign?.id ?? null, { ...d, imageUrl: d.imageUrl || null, linkUrl: d.linkUrl || null });
      toast.success(t('Kampanye "{0}" tersimpan.', d.name));
      await onSaved();
    });

  const field = (k: 'name' | 'title' | 'ctaLabel', label: string, max: number, help?: string) => (
    <div>
      <label htmlFor={`c-${k}`} className={labelBase}>
        {label}
      </label>
      <input id={`c-${k}`} className={inputBase} maxLength={max} value={d[k]} onChange={(e) => set(k, e.target.value)} />
      {help && <p className={helperText}>{help}</p>}
    </div>
  );

  return (
    <Sheet
      title={campaign ? t('Ubah kampanye') : t('Kampanye baru')}
      isOpen
      isWide
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          <button type="button" className={`${btnPrimary} flex-1`} disabled={busy} onClick={save}>
            {t('Simpan kampanye')}
          </button>
          <button type="button" className={btnSecondary} onClick={onClose}>
            {t('Batal')}
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-3">
          {field('name', t('Nama internal'), 60, t('Hanya terlihat di konsol.'))}
          <p className={sectionTitle}>{t('Banner')}</p>
          <div className="flex flex-wrap items-center gap-2">
            <input ref={file} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => upload(e.target.files?.[0])} />
            <button type="button" className={btnSecondary} disabled={busy} onClick={() => file.current?.click()}>
              <Upload aria-hidden size={18} />
              {d.imageUrl ? t('Ganti gambar') : t('Unggah gambar')}
            </button>
            {d.imageUrl && (
              <button type="button" className={btnSecondary} onClick={() => set('imageUrl', null)}>
                {t('Tanpa gambar')}
              </button>
            )}
          </div>
          <p className={helperText}>{t('PNG, JPG, atau WebP, maks. 500 KB. Saran 1200×800 px.')}</p>
          {field('title', t('Judul'), 80, t('Juga dipakai sebagai teks alternatif gambar.'))}
          <div>
            <label htmlFor="c-body" className={labelBase}>
              {t('Teks (opsional)')}
            </label>
            <textarea id="c-body" rows={3} maxLength={400} className={`${inputBase} h-auto py-2.5`} value={d.body} onChange={(e) => set('body', e.target.value)} />
          </div>
          <div>
            <label htmlFor="c-link" className={labelBase}>
              {t('Tautan di balik banner (opsional)')}
            </label>
            <input id="c-link" className={inputBase} placeholder="https://… atau /app/" value={d.linkUrl ?? ''} onChange={(e) => set('linkUrl', e.target.value)} />
            <p className={helperText}>{t('Klik banner atau tombol membuka tautan ini. Kosongkan jika hanya informasi.')}</p>
          </div>
          {d.linkUrl && field('ctaLabel', t('Teks tombol'), 30)}

          <p className={sectionTitle}>{t('Jadwal')}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="c-start" className={labelBase}>
                {t('Mulai tayang')}
              </label>
              <input id="c-start" type="datetime-local" className={inputBase} value={toLocal(d.startsAt)} onChange={(e) => set('startsAt', fromLocal(e.target.value))} />
            </div>
            <div>
              <label htmlFor="c-end" className={labelBase}>
                {t('Selesai')}
              </label>
              <input id="c-end" type="datetime-local" className={inputBase} value={toLocal(d.endsAt)} onChange={(e) => set('endsAt', fromLocal(e.target.value))} />
            </div>
          </div>
          <Switch checked={d.enabled} onChange={(v) => set('enabled', v)} label={t('Nyala')} description={t('Mati = tidak tampil walau sedang dalam jadwal.')} />

          <p className={sectionTitle}>{t('Tempat tampil')}</p>
          <Switch checked={d.showOnLanding} onChange={(v) => set('showOnLanding', v)} label={t('Halaman depan')} description={t('Pop-up untuk pengunjung, sekali per browser.')} />
          <Switch checked={d.showInApp} onChange={(v) => set('showInApp', v)} label={t('Aplikasi merchant')} description={t('Sekali per akun, setelah masuk atau saat aplikasi dibuka.')} />
          <Switch checked={d.showOnRegister} onChange={(v) => set('showOnRegister', v)} label={t('Saat buka kasir pertama hari itu')} description={t('Banner muncul sekali per hari saat merchant membuka kasir. Bisa diklik jika ada link.')} />

          <p className={sectionTitle}>{t('Harga promo (opsional)')}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="c-plan" className={labelBase}>
                {t('Paket')}
              </label>
              <select id="c-plan" className={inputBase} value={d.planId ?? ''} onChange={(e) => setD((x) => ({ ...x, planId: e.target.value || null, promoAmount: e.target.value ? x.promoAmount : null }))}>
                <option value="">{t('Tanpa harga promo')}</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {formatRupiah(p.amount)}
                  </option>
                ))}
              </select>
            </div>
            {promoPlan && (
              <div>
                <label htmlFor="c-promo" className={labelBase}>
                  {t('Harga selama kampanye')}
                </label>
                <RupiahInput id="c-promo" value={d.promoAmount} onChange={(v) => set('promoAmount', v)} />
              </div>
            )}
          </div>
          {promoPlan && <p className={helperText}>{t('Selama kampanye tayang, halaman depan dan aplikasi menampilkan harga ini untuk {0}.', promoPlan.name)}</p>}
        </div>

        <div>
          <p className={`${sectionTitle} mb-2`}>{t('Pratinjau')}</p>
          <div className="mx-auto max-w-[360px] overflow-hidden rounded-xl border border-line bg-surface shadow-pop">
            {d.imageUrl && <img src={d.imageUrl} alt={d.title} className="block h-auto w-full" />}
            <div className="p-4">
              <p className="text-[16px] font-bold text-ink">{d.title || t('Judul')}</p>
              {d.body && <p className="mt-1 whitespace-pre-line text-[14px] text-ink-soft">{d.body}</p>}
              {d.linkUrl && <span className={`${btnPrimary} mt-3 h-11 w-full`}>{d.ctaLabel || t('Lihat promo')}</span>}
            </div>
          </div>
        </div>
      </div>
    </Sheet>
  );
}
