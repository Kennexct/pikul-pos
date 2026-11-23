import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../components/Layout/PageHeader';
import { LoadingScreen } from '../../components/ui/LoadingScreen';
import { Tabs } from '../../components/ui/Tabs';
import { useAppData } from '../../hooks/useAppData';
import { LanguagePicker } from '../../components/LanguagePicker';
import { BackupSettings } from './BackupSettings';
import { SubscriptionSettings } from './SubscriptionSettings';
import { BILLING_ENABLED } from '../../services/account';
import { PaymentMethodSettings } from './PaymentMethodSettings';
import { SalesModeSettings } from './SalesModeSettings';
import { StaffSettings } from './StaffSettings';
import { SettingsSection } from './SettingsSection';
import { StoreSettings } from './StoreSettings';
import { SyncSettings } from './SyncSettings';
import { t } from '../../i18n';

const ALL_TABS = [
  { value: 'subscription', label: t('Langganan'), help: undefined },
  { value: 'store', label: t('Toko & Struk'), help: 'struk' },
  { value: 'payments', label: t('Pembayaran::tab'), help: 'qris' },
  { value: 'modes', label: t('Mode Penjualan'), help: 'varian' },
  { value: 'staff', label: t('Staf & PIN'), help: 'staf' },
  { value: 'sync', label: t('Sinkronisasi'), help: undefined },
  { value: 'backup', label: t('Cadangan'), help: 'cadangan' },
] as const;
type TabId = (typeof ALL_TABS)[number]['value'];
// ADR-013, ADR-025: subscription and sync exist only in builds with the Pikul server.
const TABS = ALL_TABS.filter((tab) => BILLING_ENABLED || (tab.value !== 'subscription' && tab.value !== 'sync'));

export function SettingsPage() {
  const { store, catalog } = useAppData();
  const [params] = useSearchParams();
  const requested = TABS.find((t) => t.value === params.get('tab'))?.value;
  const [tab, setTab] = useState<TabId>(requested ?? 'store');

  if (!store || !catalog) return <LoadingScreen />;

  return (
    <section className="flex min-h-0 flex-1">
      <div role="tablist" aria-label={t('Bagian pengaturan')} aria-orientation="vertical" className="hidden w-52 shrink-0 flex-col gap-1 overflow-y-auto border-r border-line bg-surface px-3 py-5 md:flex">
        <p aria-hidden className="mb-2 px-3 text-[12px] font-semibold uppercase tracking-[0.06em] text-muted">{t('Pengaturan')}</p>
          {TABS.map((item) => {
            const isActive = item.value === tab;
            return (
              <button
                key={item.value}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setTab(item.value)}
                className={`flex h-11 items-center rounded-lg px-3 text-left text-[14px] font-semibold transition-colors ${isActive ? 'bg-brand-50 text-brand-700' : 'text-ink-soft hover:bg-subtle hover:text-ink'}`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      <div className="flex min-w-0 flex-1 flex-col">
      <PageHeader title={t('Pengaturan')} description={t('Profil toko, struk, pembayaran, mode penjualan, staf, sinkronisasi, dan cadangan.')} helpTopic={TABS.find((t) => t.value === tab)?.help}>
        {/* Phone: tabs under the title. Tablet: the sections are a list on the left, like the other sub-menus. */}
        <div className="md:hidden">
          <Tabs label={t('Bagian pengaturan')} items={TABS} value={tab} onChange={setTab} />
        </div>
      </PageHeader>
      <div className="min-h-0 flex-1 overflow-y-auto p-4 md:px-8 md:py-6">
        <div className="w-full max-w-3xl">
          {tab === 'subscription' && <SubscriptionSettings />}
          {tab === 'store' && (
            <>
              <SettingsSection title={t('Bahasa')} description={t('Bahasa aplikasi di perangkat ini. Nama produk dan data toko tidak diterjemahkan. Aplikasi dimuat ulang saat bahasa diganti.')}>
                <LanguagePicker />
              </SettingsSection>
              <StoreSettings store={store} />
            </>
          )}
          {tab === 'payments' && <PaymentMethodSettings storeId={store.id} methods={catalog.paymentMethods} />}
          {tab === 'modes' && <SalesModeSettings storeId={store.id} modes={catalog.salesModes} />}
          {tab === 'staff' && <StaffSettings store={store} />}
          {tab === 'sync' && <SyncSettings />}
          {tab === 'backup' && <BackupSettings />}
        </div>
      </div>
      </div>
    </section>
  );
}
