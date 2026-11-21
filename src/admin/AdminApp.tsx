import { LogOut, ShieldCheck, TriangleAlert } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Toaster } from 'react-hot-toast';
import { LoadingScreen } from '../components/ui/LoadingScreen';
import { btnGhost, btnSecondary } from '../components/ui/styles';
import { Tabs } from '../components/ui/Tabs';
import { t } from '../i18n';
import { loadCatalog, logout, openConsole, SIGNED_OUT_EVENT, type Catalog, type Gate, type Mode } from './api';
import { CampaignsPanel } from './CampaignsPanel';
import { ContentPanel } from './ContentPanel';
import { errorText } from './errors';
import { LoginScreen } from './LoginScreen';
import { MerchantsPanel } from './MerchantsPanel';
import { OverviewPanel } from './OverviewPanel';
import { PaymentsPanel } from './PaymentsPanel';
import { PlansPanel } from './PlansPanel';
import { ReportPanel } from './ReportPanel';

type Tab = 'overview' | 'merchants' | 'payments' | 'report' | 'plans' | 'campaigns' | 'content';
const TABS: readonly Tab[] = ['overview', 'merchants', 'payments', 'report', 'plans', 'campaigns', 'content'];
const TAB_KEY = 'pikul.admin.tab';
const readTab = (): Tab => {
  try {
    const v = sessionStorage.getItem(TAB_KEY);
    return TABS.includes(v as Tab) ? (v as Tab) : 'overview';
  } catch {
    return 'overview';
  }
};

/** /admin (ADR-014, ADR-020): Kenny's console to run Pikul — merchants, payments, reports, plans, campaigns, landing text. */
export function AdminApp() {
  const [mode, setMode] = useState<Mode | null>(null);
  const [gate, setGate] = useState<Gate | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [tab, setTabState] = useState<Tab>(readTab);
  const [openMerchant, setOpenMerchant] = useState<string | null>(null);

  const setTab = (v: Tab) => {
    setTabState(v);
    try {
      sessionStorage.setItem(TAB_KEY, v);
    } catch {
      /* remembered for this page only */
    }
  };
  const fail = useCallback(async (e: unknown) => setNotice(errorText(e)), []);
  const reload = useCallback(async () => {
    try {
      setCatalog(await loadCatalog());
    } catch (e) {
      await fail(e);
    }
  }, [fail]);

  const open = useCallback(async () => {
    setNotice(null);
    try {
      const r = await openConsole();
      setMode(r.mode);
      setGate(r.gate);
      if (r.gate === 'ready') setCatalog(await loadCatalog());
    } catch (e) {
      await fail(e);
    }
  }, [fail]);

  useEffect(() => {
    void open();
    const out = () => {
      setGate('login');
      setCatalog(null);
    };
    window.addEventListener(SIGNED_OUT_EVENT, out);
    return () => window.removeEventListener(SIGNED_OUT_EVENT, out);
  }, [open]);

  const toaster = <Toaster position="top-center" toastOptions={{ className: '!rounded-lg !border !border-line !bg-surface !text-[14px] !text-ink' }} />;
  if (!mode || !gate)
    return notice ? (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-canvas p-4 text-center">
        <p role="alert" className="text-[15px] text-danger-700">
          {notice}
        </p>
        <button type="button" className={btnSecondary} onClick={() => void open()}>
          {t('Coba lagi')}
        </button>
      </main>
    ) : (
      <LoadingScreen message={t('Memuat…')} />
    );
  if (gate !== 'ready')
    return (
      <>
        <LoginScreen disabled={gate === 'disabled'} onSignedIn={() => void open()} />
        {toaster}
      </>
    );

  const showMerchant = (id: string) => {
    setOpenMerchant(id);
    setTab('merchants');
  };
  const signOut = async () => {
    await logout();
    setGate('login');
  };

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 pt-3 md:px-8">
          <ShieldCheck aria-hidden size={22} className="text-brand-600" />
          <h1 className="flex-1 text-[19px] font-bold tracking-[-0.02em] text-ink">{t('Konsol admin Pikul')}</h1>
          {mode === 'server' && (
            <button type="button" className={btnGhost} onClick={() => void signOut()} aria-label={t('Keluar')}>
              <LogOut aria-hidden size={18} />
              <span className="hidden sm:inline">{t('Keluar')}</span>
            </button>
          )}
        </div>
        <div className="mx-auto max-w-6xl px-2 pt-1 md:px-6">
          <Tabs
            label={t('Bagian konsol')}
            value={tab}
            onChange={setTab}
            items={[
              { value: 'overview', label: t('Ringkasan') },
              { value: 'merchants', label: t('Merchant') },
              { value: 'payments', label: t('Pembayaran') },
              { value: 'report', label: t('Laporan') },
              { value: 'plans', label: t('Paket harga'), count: catalog?.plans.length },
              { value: 'campaigns', label: t('Kampanye'), count: catalog?.campaigns.length },
              { value: 'content', label: t('Konten landing') },
            ]}
          />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-5 md:px-8 md:py-6">
        {mode === 'preview' && (
          <p role="status" className="mb-4 flex gap-2 rounded-lg border border-warn-200 bg-warn-50 px-3 py-2.5 text-[14px] text-warn-700">
            <TriangleAlert aria-hidden size={18} className="mt-0.5 shrink-0" />
            <span>{t('Mode pratinjau: server admin belum aktif di situs ini. Data di bawah adalah contoh, perubahan hanya ada di tab ini dan hilang saat ditutup.')}</span>
          </p>
        )}
        {notice && (
          <p role="alert" className="mb-4 text-[14px] text-danger-700">
            {notice}
          </p>
        )}
        {tab === 'overview' && <OverviewPanel onOpenMerchant={showMerchant} onError={fail} />}
        {tab === 'merchants' && <MerchantsPanel openId={openMerchant} onOpenChange={setOpenMerchant} onError={fail} />}
        {tab === 'payments' && <PaymentsPanel onOpenMerchant={showMerchant} onError={fail} />}
        {tab === 'report' && <ReportPanel onOpenMerchant={showMerchant} onError={fail} />}
        {tab === 'content' && <ContentPanel onError={fail} />}
        {(tab === 'plans' || tab === 'campaigns') &&
          (!catalog ? (
            <LoadingScreen message={t('Memuat…')} />
          ) : tab === 'plans' ? (
            <PlansPanel plans={catalog.plans} onChanged={reload} onError={fail} />
          ) : (
            <CampaignsPanel catalog={catalog} onChanged={reload} onError={fail} />
          ))}
      </main>
      {toaster}
    </div>
  );
}
