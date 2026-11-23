import { CreditCard, HardDriveDownload, QrCode, RefreshCw, Store, Tags, Users } from 'lucide-react';
import { useState } from 'react';
import { SidePanel, sideItem, useSubNavCollapsed } from '../../components/Layout/SidePanel';
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
import { WeightSaleSetting } from './WeightSaleSetting';
import { t } from '../../i18n';

const ALL_TABS = [
  { value: 'subscription', label: t('Langganan'), help: undefined, icon: CreditCard },
  { value: 'store', label: t('Toko & Struk'), help: 'struk', icon: Store },
  { value: 'payments', label: t('Pembayaran::tab'), help: 'qris', icon: QrCode },
  { value: 'modes', label: t('Mode Penjualan'), help: 'varian', icon: Tags },
  { value: 'staff', label: t('Staf & PIN'), help: 'staf', icon: Users },
  { value: 'sync', label: t('Sinkronisasi'), help: undefined, icon: RefreshCw },
  { value: 'backup', label: t('Cadangan'), help: 'cadangan', icon: HardDriveDownload },
] as const;
type TabId = (typeof ALL_TABS)[number]['value'];
// ADR-013, ADR-025: subscription and sync exist only in builds with the Pikul server.
const TABS = ALL_TABS.filter((tab) => BILLING_ENABLED || (tab.value !== 'subscription' && tab.value !== 'sync'));

export function SettingsPage() {
  const { store, catalog } = useAppData();
  const [params] = useSearchParams();
  const requested = TABS.find((t) => t.value === params.get('tab'))?.value;
  const [tab, setTab] = useState<TabId>(requested ?? 'store');
  const [isCollapsed, setIsCollapsed] = useSubNavCollapsed();

  if (!store || !catalog) return <LoadingScreen />;

  return (
    <section className="flex min-h-0 flex-1">
      <SidePanel title={t('Pengaturan')} as="tablist" isCollapsed={isCollapsed} onCollapsedChange={setIsCollapsed}>
        {TABS.map((item) => {
          const isActive = item.value === tab;
          return (
            <button
              key={item.value}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-label={isCollapsed ? item.label : undefined}
              title={isCollapsed ? item.label : undefined}
              onClick={() => setTab(item.value)}
              className={sideItem(isActive, isCollapsed)}
            >
              <item.icon aria-hidden size={18} />
              {!isCollapsed && <span className="min-w-0 flex-1 truncate">{item.label}</span>}
            </button>
          );
        })}
      </SidePanel>
      <div className="flex min-w-0 flex-1 flex-col">
      <PageHeader title={t('Pengaturan')} description={t('Profil toko, struk, pembayaran, mode penjualan, staf, sinkronisasi, dan cadangan.')} helpTopic={TABS.find((t) => t.value === tab)?.help}>
        {/* Phone: tabs under the title. Tablet: the sections are a list on the left, like the other sub-menus. */}
        <div className="md:hidden">
          <Tabs label={t('Bagian pengaturan')} items={TABS} value={tab} onChange={setTab} />
        </div>
      </PageHeader>
      <div className="@container/settings min-h-0 flex-1 overflow-y-auto p-4 md:px-8 md:py-6">
        {/* One column of full-width cards; inside a card, fields share one grid (fieldGrid) so every
            field has the same width on every Settings page (Kenny, round 5). */}
        <div className="w-full">
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
          {tab === 'modes' && (
            <>
              <SalesModeSettings storeId={store.id} modes={catalog.salesModes} />
              <div className="mt-6">
                <WeightSaleSetting store={store} />
              </div>
            </>
          )}
          {tab === 'staff' && <StaffSettings store={store} />}
          {tab === 'sync' && <SyncSettings />}
          {tab === 'backup' && <BackupSettings />}
        </div>
      </div>
      </div>
    </section>
  );
}
