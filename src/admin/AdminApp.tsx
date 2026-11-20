import { LogOut, ShieldCheck } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Toaster } from 'react-hot-toast';
import { LoadingScreen } from '../components/ui/LoadingScreen';
import { btnGhost } from '../components/ui/styles';
import { Tabs } from '../components/ui/Tabs';
import { t } from '../i18n';
import { hasSession, loadCatalog, me, signOut, type Catalog } from './api';
import { AdminSignIn } from './AdminSignIn';
import { CampaignsPanel } from './CampaignsPanel';
import { errorText, isAuthError } from './errors';
import { PlansPanel } from './PlansPanel';

type Tab = 'plans' | 'campaigns';

/** /admin (ADR-014): Kenny's console for plans and promo campaigns. Not part of the POS PWA. */
export function AdminApp() {
  const [email, setEmail] = useState<string | null>(null);
  const [checking, setChecking] = useState(hasSession());
  const [notice, setNotice] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [tab, setTab] = useState<Tab>('plans');

  const fail = useCallback(async (e: unknown) => {
    if (isAuthError(e)) {
      await signOut();
      setEmail(null);
      setCatalog(null);
    }
    setNotice(errorText(e));
  }, []);

  const reload = useCallback(async () => {
    try {
      setCatalog(await loadCatalog());
    } catch (e) {
      await fail(e);
    }
  }, [fail]);

  const enter = useCallback(async () => {
    setChecking(true);
    try {
      setEmail((await me()).email);
      setNotice(null);
      await reload();
    } catch (e) {
      await fail(e);
    } finally {
      setChecking(false);
    }
  }, [fail, reload]);

  useEffect(() => {
    if (hasSession()) void enter();
  }, [enter]);

  const toaster = <Toaster position="top-center" toastOptions={{ className: '!rounded-lg !border !border-line !bg-surface !text-[14px] !text-ink' }} />;
  if (checking) return <LoadingScreen message={t('Memeriksa akun…')} />;
  if (!email)
    return (
      <>
        <AdminSignIn onSignedIn={() => void enter()} notice={notice} />
        {toaster}
      </>
    );

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 pt-4 md:px-8">
          <ShieldCheck aria-hidden size={22} className="text-brand-600" />
          <h1 className="flex-1 text-[20px] font-bold tracking-[-0.02em] text-ink">{t('Konsol admin KasirKu')}</h1>
          <span className="hidden truncate text-[13px] text-muted sm:inline">{email}</span>
          <button
            type="button"
            className={btnGhost}
            onClick={() => {
              void signOut();
              setEmail(null);
            }}
          >
            <LogOut aria-hidden size={18} />
            {t('Keluar')}
          </button>
        </div>
        <div className="mx-auto max-w-5xl px-4 pt-2 md:px-8">
          <Tabs
            label={t('Bagian konsol')}
            value={tab}
            onChange={setTab}
            items={[
              { value: 'plans', label: t('Paket harga'), count: catalog?.plans.length },
              { value: 'campaigns', label: t('Kampanye promo'), count: catalog?.campaigns.length },
            ]}
          />
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6 md:px-8">
        {!catalog ? (
          <LoadingScreen message={t('Memuat…')} />
        ) : tab === 'plans' ? (
          <PlansPanel plans={catalog.plans} onChanged={reload} onError={fail} />
        ) : (
          <CampaignsPanel catalog={catalog} onChanged={reload} onError={fail} />
        )}
      </main>
      {toaster}
    </div>
  );
}
