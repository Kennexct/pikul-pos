import { ShieldCheck, TriangleAlert } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Toaster } from 'react-hot-toast';
import { LoadingScreen } from '../components/ui/LoadingScreen';
import { btnSecondary } from '../components/ui/styles';
import { Tabs } from '../components/ui/Tabs';
import { t } from '../i18n';
import { loadCatalog, openConsole, type Catalog, type Mode } from './api';
import { CampaignsPanel } from './CampaignsPanel';
import { errorText } from './errors';
import { PlansPanel } from './PlansPanel';

type Tab = 'plans' | 'campaigns';

const PREVIEW_NOTE: Record<Exclude<Mode, 'server'>, string> = {
  no_server: t('Mode pratinjau: server admin belum aktif di situs ini. Perubahan hanya tersimpan di browser ini dan belum tampil di halaman depan atau aplikasi.'),
  locked: t('Mode pratinjau: server admin masih meminta login. Set ADMIN_OPEN=1 di server agar perubahan tersimpan.'),
};

/** /admin (ADR-014, ADR-019): Kenny's console for plans and promo campaigns. Sign-in removed for now. Not part of the POS PWA. */
export function AdminApp() {
  const [mode, setMode] = useState<Mode | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [tab, setTab] = useState<Tab>('plans');

  const fail = useCallback(async (e: unknown) => {
    setNotice(errorText(e));
  }, []);

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
      setCatalog(r.catalog);
    } catch (e) {
      await fail(e);
    }
  }, [fail]);

  useEffect(() => {
    void open();
  }, [open]);

  const toaster = <Toaster position="top-center" toastOptions={{ className: '!rounded-lg !border !border-line !bg-surface !text-[14px] !text-ink' }} />;
  if (!mode)
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

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 pt-4 md:px-8">
          <ShieldCheck aria-hidden size={22} className="text-brand-600" />
          <h1 className="flex-1 text-[20px] font-bold tracking-[-0.02em] text-ink">{t('Konsol admin Pikul')}</h1>
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
        {mode !== 'server' && (
          <p role="status" className="mb-4 flex gap-2 rounded-lg border border-warn-200 bg-warn-50 px-3 py-2.5 text-[14px] text-warn-700">
            <TriangleAlert aria-hidden size={18} className="mt-0.5 shrink-0" />
            <span>{PREVIEW_NOTE[mode]}</span>
          </p>
        )}
        {notice && (
          <p role="alert" className="mb-4 text-[14px] text-danger-700">
            {notice}
          </p>
        )}
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
