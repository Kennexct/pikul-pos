import { CheckCircle2, Clock, LogOut } from 'lucide-react';
import { useEffect, useState } from 'react';
import { badgeBrand, btnSecondary, card } from '../../components/ui/styles';
import { daysLeft } from '../../lib/accessPass';
import { formatRupiah } from '../../lib/money';
import { ApiError, billingOverview, type BillingOverview, type PlanOffer } from '../../services/account';
import { useAccessStore } from '../../store/useAccessStore';
import { DATE_LOCALE, t } from '../../i18n';
import { ChangePassword } from './ChangePassword';
import { SettingsSection } from './SettingsSection';

const fmtDate = (ms: number) => new Date(ms).toLocaleDateString(DATE_LOCALE, { day: 'numeric', month: 'long', year: 'numeric' });

/** Settings → Langganan (ADR-013, ADR-015): status, the plans from the admin console, sign out. Online payment is not connected yet. */
export function SubscriptionSettings() {
  const access = useAccessStore((s) => s.access);
  const claims = useAccessStore((s) => s.claims);
  const refresh = useAccessStore((s) => s.refresh);
  const signOut = useAccessStore((s) => s.signOut);
  const [data, setData] = useState<BillingOverview | null>(null);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    // Sequential: refresh rotates the token that the overview call authenticates with.
    void (async () => {
      await refresh();
      try {
        setData(await billingOverview());
        setOffline(false);
      } catch (e) {
        if (e instanceof ApiError && e.code === 'offline') setOffline(true);
      }
    })();
  }, [refresh]);

  const status = !access
    ? ''
    : access.kind === 'active'
      ? access.plan === 'trial'
        ? t('Coba gratis, sisa {0} hari (sampai {1}).', daysLeft(access.msLeft), fmtDate(access.until))
        : t('Aktif sampai {0}.', fmtDate(access.until))
      : access.kind === 'grace'
        ? t('Berakhir {0}. Masa tenggang offline sampai {1}.', fmtDate(access.until), fmtDate(access.graceEnds))
        : t('Berakhir {0}. Penjualan baru dinonaktifkan.', fmtDate(access.until));

  return (
    <>
      <SettingsSection title={t('Status langganan')} description={claims?.email}>
        <p className="flex items-center gap-2 text-[15px] font-semibold">
          {access?.kind === 'active' ? <CheckCircle2 aria-hidden size={18} className="text-brand-600" /> : <Clock aria-hidden size={18} className="text-warn-700" />}
          {status}
        </p>
      </SettingsSection>

      <SettingsSection title={t('Paket')} description={t('Pembayaran online segera hadir.')}>
        {data ? (
          <ul className="grid gap-3 sm:grid-cols-2">
            {data.plans.map((p) => (
              <PlanCard key={p.id} plan={p} />
            ))}
          </ul>
        ) : (
          !offline && <p className="text-[14px] text-muted">{t('Memuat paket…')}</p>
        )}
        {offline && <p className="mt-3 text-[13px] text-warn-700">{t('Tidak ada internet. Daftar paket butuh koneksi.')}</p>}
      </SettingsSection>

      <SettingsSection title={t('Akun')} description={t('Keluar tidak menghapus data toko di perangkat ini.')}>
        <div className="flex flex-col items-start gap-3">
          <ChangePassword />
          <button type="button" className={btnSecondary} onClick={() => void signOut()}>
            <LogOut aria-hidden size={18} />
            {t('Keluar dari akun')}
          </button>
        </div>
      </SettingsSection>
    </>
  );
}

/** One plan as set in the admin console; a live promo shows the normal price struck through (ADR-014). */
function PlanCard({ plan }: { plan: PlanOffer }) {
  const promo = plan.amount < plan.regularAmount;
  return (
    <li className={`${card} flex flex-col gap-1 p-4`}>
      <p className="flex items-center gap-2 text-[15px] font-semibold text-ink">
        {plan.name}
        {plan.badge && <span className={badgeBrand}>{plan.badge}</span>}
      </p>
      <p className="num text-[14px] text-ink-soft">
        {promo && <s className="mr-1.5 text-muted">{formatRupiah(plan.regularAmount)}</s>}
        <span className="font-semibold text-ink">{t('{0} / {1} hari', formatRupiah(plan.amount), plan.days)}</span>
      </p>
      {promo && plan.promoEndsAt !== null && <p className="text-[12px] font-semibold text-brand-700">{t('Promo sampai {0}', fmtDate(plan.promoEndsAt))}</p>}
      {plan.note && <p className="text-[13px] text-muted">{plan.note}</p>}
    </li>
  );
}
