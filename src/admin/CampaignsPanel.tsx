import { ImageIcon, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { EmptyState } from '../components/ui/EmptyState';
import { badgeBrand, badgeNeutral, badgeWarn, btnIcon, btnPrimary, card } from '../components/ui/styles';
import { formatRupiah } from '../lib/money';
import { DATE_LOCALE, t } from '../i18n';
import { archiveCampaign, toggleCampaign, type CampaignRow, type CampaignState, type Catalog } from './api';
import { CampaignForm } from './CampaignForm';
import { errorText, isAuthError } from './errors';

const STATE: Record<CampaignState, { label: string; cls: string }> = {
  live: { label: t('Tayang sekarang'), cls: badgeBrand },
  scheduled: { label: t('Terjadwal'), cls: badgeWarn },
  ended: { label: t('Selesai'), cls: badgeNeutral },
  off: { label: t('Mati'), cls: badgeNeutral },
};
export const fmtWhen = (ms: number) => new Date(ms).toLocaleString(DATE_LOCALE, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

interface Props {
  catalog: Catalog;
  onChanged: () => Promise<void>;
  onError: (e: unknown) => Promise<void>;
}

/** Campaigns (ADR-014): scheduled pop-up banners for the landing page and/or the merchant app. */
export function CampaignsPanel({ catalog, onChanged, onError }: Props) {
  const [editing, setEditing] = useState<CampaignRow | 'new' | null>(null);

  const run = async (work: () => Promise<unknown>, done: string) => {
    try {
      await work();
      toast.success(done);
      await onChanged();
    } catch (e) {
      if (isAuthError(e)) await onError(e);
      else toast.error(errorText(e));
    }
  };
  const remove = (c: CampaignRow) => {
    if (window.confirm(t('Hapus kampanye "{0}"? Pop-up langsung berhenti tampil.', c.name))) void run(() => archiveCampaign(c.id), t('Kampanye dihapus.'));
  };

  return (
    <section aria-labelledby="campaigns-title">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="campaigns-title" className="text-[17px] font-bold text-ink">
            {t('Kampanye promo')}
          </h2>
          <p className="text-[14px] text-muted">{t('Pop-up banner terjadwal di halaman depan dan/atau aplikasi merchant.')}</p>
        </div>
        <button type="button" className={btnPrimary} onClick={() => setEditing('new')}>
          <Plus aria-hidden size={18} />
          {t('Kampanye baru')}
        </button>
      </div>

      {catalog.campaigns.length === 0 ? (
        <EmptyState icon={ImageIcon} title={t('Belum ada kampanye')} description={t('Buat pop-up promo dan atur kapan tampil.')} />
      ) : (
        <ul className="grid gap-3">
          {catalog.campaigns.map((c) => {
            const plan = catalog.plans.find((p) => p.id === c.planId);
            return (
              <li key={c.id} className={`${card} flex flex-wrap items-center gap-4 p-4`}>
                <div className="flex h-16 w-24 shrink-0 items-center justify-center overflow-hidden rounded-md border border-line bg-subtle">
                  {c.imageUrl ? <img src={c.imageUrl} alt="" className="h-full w-full object-cover" /> : <ImageIcon aria-hidden size={20} className="text-faint" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-[15px] font-semibold text-ink">{c.name}</span>
                    <span className={STATE[c.state].cls}>{STATE[c.state].label}</span>
                  </p>
                  <p className="num text-[13px] text-muted">
                    {fmtWhen(c.startsAt)} – {fmtWhen(c.endsAt)}
                  </p>
                  <p className="text-[13px] text-muted">
                    {[c.showOnLanding && t('Halaman depan'), c.showInApp && t('Aplikasi merchant'), plan && c.promoAmount !== null && t('Promo {0}: {1}', plan.name, formatRupiah(c.promoAmount))]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-[14px] font-medium text-ink-soft">
                  <input
                    type="checkbox"
                    role="switch"
                    className="h-5 w-5 accent-brand-600"
                    checked={c.enabled}
                    onChange={(e) => void run(() => toggleCampaign(c.id, e.target.checked), e.target.checked ? t('Kampanye dinyalakan.') : t('Kampanye dimatikan.'))}
                  />
                  {c.enabled ? t('Nyala') : t('Mati')}
                </label>
                <button type="button" className={btnIcon} aria-label={t('Ubah {0}', c.name)} onClick={() => setEditing(c)}>
                  <Pencil aria-hidden size={18} />
                </button>
                <button type="button" className={btnIcon} aria-label={t('Hapus {0}', c.name)} onClick={() => remove(c)}>
                  <Trash2 aria-hidden size={18} />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {editing && (
        <CampaignForm
          campaign={editing === 'new' ? null : editing}
          plans={catalog.plans}
          now={catalog.now}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await onChanged();
          }}
          onError={onError}
        />
      )}
    </section>
  );
}
