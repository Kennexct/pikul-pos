import { lazy, Suspense } from 'react';
import { Toaster } from 'react-hot-toast';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { CampaignPopup } from './components/Access/CampaignPopup';
import { DailyTotals } from './components/Access/DailyTotals';
import { RegisterPopup } from './components/Access/RegisterPopup';
import { AppShell } from './components/Layout/AppShell';
import { OwnerGate } from './components/Layout/OwnerGate';
import { LockScreen } from './components/Pin/LockScreen';
import { OwnerPinHost } from './components/Pin/OwnerPinHost';
import { LoadingScreen } from './components/ui/LoadingScreen';
import { APP_BASE, ROUTES } from './constants';
import { useBootstrap } from './hooks/useBootstrap';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { CashPage } from './pages/Cash/CashPage';
import { CustomersPage } from './pages/Customers/CustomersPage';
import { HelpPage } from './pages/Help/HelpPage';
import { HistoryPage } from './pages/History/HistoryPage';
import { MorePage } from './pages/More/MorePage';
import { OnboardingPage } from './pages/Onboarding/OnboardingPage';
import { DownloadingScreen, NeedOnlineScreen, OtherAccountScreen, StoreChoiceScreen } from './pages/Onboarding/StoreSyncScreens';
import { OpenOrdersPage } from './pages/OpenOrders/OpenOrdersPage';
import { POSPage } from './pages/POS/POSPage';
import { ProductsPage } from './pages/Products/ProductsPage';
import { SettingsPage } from './pages/Settings/SettingsPage';
import { useSessionStore } from './store/useSessionStore';
import { useAccessRefresh } from './hooks/useAccessRefresh';
import { SignInPage } from './pages/Auth/SignInPage';
import { t } from './i18n';

// ADR-001: charts + export code load only when Reports is opened.
const ReportsPage = lazy(() => import('./pages/Reports/ReportsPage'));

const toasterFor = () => <Toaster position="top-center" />;

export default function App() {
  useOnlineStatus();
  const boot = useBootstrap();
  const hasSeller = useSessionStore((s) => s.cashier !== null);
  const accessStatus = useAccessRefresh();

  // ADR-013: an account comes first — before the store, the journey and the PIN screen.
  if (accessStatus === 'checking') return <LoadingScreen message={t('Memeriksa akun…')} />;
  if (accessStatus === 'signedOut') {
    return (
      <>
        <SignInPage />
        {toasterFor()}
      </>
    );
  }

  if (boot.status === 'loading') return <LoadingScreen message={t('Menyiapkan kasir…')} />;
  if (boot.status === 'error') {
    return (
      <div role="alert" className="p-6 text-center text-danger-700">
        {boot.message}
      </div>
    );
  }

  const toaster = (
    <Toaster
      position="top-center"
      toastOptions={{
        duration: 2500,
        className: '!rounded-lg !border !border-line !bg-surface !px-4 !py-3 !text-[14px] !font-medium !text-ink !shadow-pop',
        success: { iconTheme: { primary: '#0b7a5a', secondary: '#ffffff' } },
        error: { iconTheme: { primary: '#c2281d', secondary: '#ffffff' } },
      }}
    />
  );

  // ADR-024: the account's store is downloaded, or the merchant chooses which store this device keeps.
  const syncScreen =
    boot.status === 'downloading' ? <DownloadingScreen received={boot.received} />
    : boot.status === 'needOnline' ? <NeedOnlineScreen onRetry={boot.retry} onNewStore={boot.startNewStore} />
    : boot.status === 'notReady' ? <NeedOnlineScreen message={boot.message} onRetry={boot.retry} onNewStore={boot.startNewStore} />
    : boot.status === 'choose' ? <StoreChoiceScreen local={boot.local} remote={boot.remote} onAccount={boot.chooseAccountStore} onDevice={boot.chooseDeviceStore} />
    : boot.status === 'otherAccount' ? <OtherAccountScreen local={boot.local} onContinue={boot.leaveOtherAccountStore} />
    : null;
  if (syncScreen) {
    return (
      <>
        {syncScreen}
        {toaster}
      </>
    );
  }

  // ADR-009: no store on this device or account yet → the first-time journey, store name from sign-up.
  if (boot.status === 'onboarding') {
    return (
      <>
        <OnboardingPage onComplete={boot.completeOnboarding} defaultStoreName={boot.storeName} />
        {toaster}
      </>
    );
  }

  // ADR-004: a PIN exists and nobody is signed in on this device → choose the seller first.
  if (!hasSeller) {
    return (
      <>
        <LockScreen />
        {toaster}
      </>
    );
  }

  return (
    <BrowserRouter basename={APP_BASE}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path={ROUTES.pos} element={<POSPage />} />
          <Route path={ROUTES.openOrders} element={<OpenOrdersPage />} />
          <Route path={ROUTES.history} element={<HistoryPage />} />
          <Route
            path={ROUTES.reports}
            element={
              <OwnerGate>
                <Suspense fallback={<LoadingScreen message={t('Memuat laporan…')} />}>
                  <ReportsPage />
                </Suspense>
              </OwnerGate>
            }
          />
          <Route path={ROUTES.products} element={<OwnerGate><ProductsPage /></OwnerGate>} />
          <Route path={ROUTES.settings} element={<OwnerGate><SettingsPage /></OwnerGate>} />
          <Route path={ROUTES.customers} element={<CustomersPage />} />
          <Route path={ROUTES.cash} element={<CashPage />} />
          <Route path={ROUTES.help} element={<HelpPage />} />
          <Route path={ROUTES.more} element={<MorePage />} />
        </Route>
        <Route path="*" element={<Navigate to={ROUTES.pos} replace />} />
      </Routes>
      <OwnerPinHost />
      <CampaignPopup />
      <RegisterPopup />
      <DailyTotals />
      {toaster}
    </BrowserRouter>
  );
}
