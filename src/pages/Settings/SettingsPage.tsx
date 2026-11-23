import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { NARROW_COLUMN, PageHeader } from '../../components/Layout/PageHeader';
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
    <section className="flex min-h-0 flex-1 flex-col">
      <PageHeader title={t('Pengaturan')} description={t('Profil toko, struk, pembayaran, mode penjualan, staf, sinkronisasi, dan cadangan.')} helpTopic={TABS.find((t) => t.value === tab)?.help} isNarrow>
        <Tabs label={t('Bagian pengaturan')} items={TABS} value={tab} onChange={setTab} />
      </PageHeader>
      <div className="min-h-0 flex-1 overflow-y-auto p-4 md:px-8 md:py-6">
        <div className={NARROW_COLUMN}>
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
    </section>
  );
}
