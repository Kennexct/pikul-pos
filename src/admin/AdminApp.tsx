import { LogOut, Menu } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Toaster } from 'react-hot-toast';
import { LoadingScreen } from '../components/ui/LoadingScreen';
import { btnSecondary } from '../components/ui/styles';
import { t } from '../i18n';
import { loadCatalog, logout, openConsole, SIGNED_OUT_EVENT, type Catalog, type Gate } from './api';
import { CampaignsPanel } from './CampaignsPanel';
import { ContentPanel } from './ContentPanel';
import { errorText } from './errors';
import { LoginScreen } from './LoginScreen';
import { MerchantsPanel } from './MerchantsPanel';
import { SECTIONS, sectionLabel, type Section } from './nav';
import { NavDrawer } from './NavDrawer';
import { OverviewPanel } from './OverviewPanel';
import { PaymentsPanel } from './PaymentsPanel';
import { PlansPanel } from './PlansPanel';
import { ReportPanel } from './ReportPanel';
import { Sidebar } from './Sidebar';

type Tab = Section;
const TABS = SECTIONS;
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
  const [gate, setGate] = useState<Gate | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [tab, setTabState] = useState<Tab>(readTab);
  const [openMerchant, setOpenMerchant] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setIsMenuOpen(false), []);

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
  if (!gate)
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
        <LoginScreen state={gate} onSignedIn={() => void open()} />
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

  const pick = (v: Tab) => {
    setTab(v);
    setIsMenuOpen(false);
  };
  const sidebar = (
    <Sidebar
      value={tab}
      onSelect={pick}
      counts={{ plans: catalog?.plans.length, campaigns: catalog?.campaigns.length }}
      onSignOut={() => void signOut()}
    />
  );

  return (
    <div className="min-h-dvh bg-canvas md:pl-[240px]">
      <aside className="fixed inset-y-0 left-0 hidden w-[240px] border-r border-line md:block">{sidebar}</aside>
      <NavDrawer isOpen={isMenuOpen} onClose={closeMenu}>
        {sidebar}
      </NavDrawer>
      <header className="sticky top-0 z-30 flex h-14 items-center gap-1 border-b border-line bg-surface px-2 md:hidden">
        <button
          type="button"
          aria-label={t('Buka menu')}
          aria-expanded={isMenuOpen}
          onClick={() => setIsMenuOpen(true)}
          className="flex h-11 w-11 items-center justify-center rounded-lg text-ink-soft transition-colors hover:bg-subtle"
        >
          <Menu aria-hidden size={22} />
        </button>
        <p className="min-w-0 flex-1 truncate text-[17px] font-semibold tracking-[-0.01em] text-ink">{sectionLabel(tab)}</p>
        <button
          type="button"
          aria-label={t('Keluar')}
          onClick={() => void signOut()}
          className="flex h-11 w-11 items-center justify-center rounded-lg text-muted transition-colors hover:bg-subtle"
        >
          <LogOut aria-hidden size={20} />
        </button>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-5 md:px-8 md:py-6">
        <h1 className="sr-only">{sectionLabel(tab)}</h1>
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
