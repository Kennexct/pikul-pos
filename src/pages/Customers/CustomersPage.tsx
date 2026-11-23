import { ChevronRight, Plus, UserRoundSearch, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { PageHeader } from '../../components/Layout/PageHeader';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingScreen } from '../../components/ui/LoadingScreen';
import { SearchInput } from '../../components/ui/SearchInput';
import { Sheet } from '../../components/ui/Sheet';
import { badgeWarn, btnDangerSolid, btnPrimary, btnSecondary, card } from '../../components/ui/styles';
import { Tabs } from '../../components/ui/Tabs';
import { useStore } from '../../hooks/useCatalog';
import { useCustomers, useCustomerStats } from '../../hooks/useCustomers';
import { useOwnerAccess } from '../../hooks/useOwnerAccess';
import { formatPhone, NO_STATS, searchCustomers } from '../../lib/customers';
import { formatRupiah } from '../../lib/money';
import { deleteCustomer } from '../../services/customers';
import { requestOwnerApproval } from '../../store/usePinPromptStore';
import { useSessionStore } from '../../store/useSessionStore';
import type { Customer, Id } from '../../types';
import { CustomerDetailSheet, formatVisit } from './CustomerDetailSheet';
import { CustomerFormSheet } from './CustomerFormSheet';
import { DebtList } from './DebtList';
import { t } from '../../i18n';

const MAX_ROWS = 100;
const COLUMNS = '@4xl/page:grid-cols-[1fr_170px_90px_140px_130px_20px]';
type View = 'all' | 'debt';
type Dialog = { kind: 'form'; customer: Customer | null } | { kind: 'detail' | 'delete'; customerId: Id } | null;

/** M7: customer list, search, add / edit / delete, per-customer stats, and who still owes ("Belum bayar"). */
export function CustomersPage() {
  const storeId = useSessionStore((s) => s.storeId);
  const access = useOwnerAccess();
  const customers = useCustomers(storeId);
  const stats = useCustomerStats(storeId);
  const store = useStore(storeId);
  const [query, setQuery] = useState('');
  const [view, setView] = useState<View>('all');
  const [dialog, setDialog] = useState<Dialog>(null);

  const matches = useMemo(() => searchCustomers(customers ?? [], query), [customers, query]);
  const debtCount = useMemo(() => (customers ?? []).filter((c) => (stats?.get(c.id)?.openOrders ?? 0) > 0).length, [customers, stats]);
  /** Longest-waiting first: ISO timestamps sort as text. */
  const debtors = useMemo(
    () =>
      matches
        .map((customer) => ({ customer, stats: stats?.get(customer.id) ?? NO_STATS }))
        .filter((d) => d.stats.openOrders > 0)
        .sort((a, b) => (a.stats.oldestOpenAt ?? '').localeCompare(b.stats.oldestOpenAt ?? '')),
    [matches, stats],
  );
  if (!storeId || !store || !customers) return <LoadingScreen />;

  const visible = matches.slice(0, MAX_ROWS);
  const current = dialog && dialog.kind !== 'form' ? customers.find((c) => c.id === dialog.customerId) : undefined;
  const statsOf = (id: Id) => stats?.get(id) ?? NO_STATS;

  /** Deleting erases contact data, so it needs the owner PIN while owner mode is locked (ADR-005). */
  const confirmDelete = async (customer: Customer) => {
    if (access.kind === 'locked' && !(await requestOwnerApproval(t('Hapus pelanggan {0}', customer.name)))) return;
    try {
      await deleteCustomer(customer.id);
      toast.success(t('{0} dihapus', customer.name));
      setDialog(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('Gagal menghapus pelanggan.'));
    }
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title={t('Pelanggan')}
        helpTopic="pelanggan"
        description={t('{0} pelanggan tersimpan', customers.length)}
        actions={
          <button type="button" aria-label={t('Tambah pelanggan')} onClick={() => setDialog({ kind: 'form', customer: null })} className={`${btnPrimary} h-11`}>
            <Plus aria-hidden size={18} /> <span className="hidden sm:inline">{t('Pelanggan')}</span>
          </button>
        }
      >
        <Tabs
          label={t('Tampilan pelanggan')}
          value={view}
          onChange={setView}
          items={[
            { value: 'all', label: t('Semua') },
            { value: 'debt', label: t('Belum bayar'), count: debtCount },
          ]}
        />
      </PageHeader>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 md:px-8 md:py-6">
        {customers.length === 0 ? (
          <EmptyState icon={Users} title={t('Belum ada pelanggan')} description={t('Tambahkan pelanggan di sini, atau langsung dari keranjang saat berjualan.')} />
        ) : (
          <>
            <div className="mb-3 max-w-md">
              <SearchInput value={query} onChange={setQuery} placeholder={t('Cari nama atau nomor HP…')} label={t('Cari pelanggan')} />
            </div>
            {view === 'debt' && <DebtList debtors={debtors} hasQuery={query.trim() !== ''} onOpen={(customerId) => setDialog({ kind: 'detail', customerId })} />}
            {view === 'all' && (
            <>
            <div className={`${card} overflow-hidden`}>
              <div className={`hidden items-center gap-4 border-b border-line bg-subtle px-4 py-2.5 text-[12px] font-semibold uppercase tracking-[0.05em] text-muted @4xl/page:grid ${COLUMNS}`}>
                <span>{t('Nama')}</span>
                <span>{t('No. HP')}</span>
                <span className="text-right">{t('Kunjungan')}</span>
                <span className="text-right">{t('Total belanja')}</span>
                <span>{t('Terakhir')}</span>
                <span />
              </div>
              <ul className="divide-y divide-line">
                {visible.map((customer) => {
                  const s = statsOf(customer.id);
                  return (
                    <li key={customer.id}>
                      <button type="button" onClick={() => setDialog({ kind: 'detail', customerId: customer.id })} className={`grid w-full grid-cols-[1fr_auto] items-center gap-x-3 px-4 py-3 text-left hover:bg-subtle @4xl/page:gap-4 ${COLUMNS}`}>
                        <span className="min-w-0">
                          <span className="flex items-center gap-2">
                            <span className="truncate text-[15px] font-semibold">{customer.name}</span>
                            {s.openOrders > 0 && <span className={`${badgeWarn} shrink-0`}>{t('Belum bayar')}</span>}
                          </span>
                          <span className="num block truncate text-[13px] text-muted @4xl/page:hidden">
                            {customer.phone ? formatPhone(customer.phone) : t('Tanpa nomor HP')} · {t('{0} kunjungan', s.visits)}
                          </span>
                          {customer.note && <span className="hidden truncate text-[13px] text-muted @4xl/page:block">{customer.note}</span>}
                        </span>
                        <span className="num hidden text-[14px] text-ink-soft @4xl/page:block">{customer.phone ? formatPhone(customer.phone) : '—'}</span>
                        <span className="num hidden text-right text-[14px] text-ink-soft @4xl/page:block">{s.visits}</span>
                        <span className="num text-right text-[15px] font-semibold">{formatRupiah(s.totalSpend)}</span>
                        <span className="hidden text-[14px] text-ink-soft @4xl/page:block">{formatVisit(s.lastVisitAt)}</span>
                        <ChevronRight aria-hidden size={18} className="hidden text-faint @4xl/page:block" />
                      </button>
                    </li>
                  );
                })}
              </ul>
              {matches.length === 0 && <EmptyState icon={UserRoundSearch} title={t('Tidak ditemukan')} description={t('Coba nama atau nomor lain.')} />}
            </div>
            {matches.length > MAX_ROWS && (
              <p className="mt-3 text-center text-[13px] text-muted">
                {t('Menampilkan')} {MAX_ROWS} {t('dari')} {matches.length} {t('pelanggan. Persempit pencarian untuk melihat yang lain.')}
              </p>
            )}
            </>
            )}
          </>
        )}
      </div>

      {dialog?.kind === 'form' && <CustomerFormSheet storeId={storeId} customer={dialog.customer} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'detail' && current && (
        <CustomerDetailSheet
          customer={current}
          stats={statsOf(current.id)}
          storeName={store.name}
          timeZone={store.timezone}
          onEdit={() => setDialog({ kind: 'form', customer: current })}
          onDelete={() => setDialog({ kind: 'delete', customerId: current.id })}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'delete' && current && (
        <Sheet
          title={t('Hapus {0}?', current.name)}
          isOpen
          onClose={() => setDialog(null)}
          footer={
            <div className="flex gap-2">
              <button type="button" onClick={() => setDialog(null)} className={btnSecondary}>{t('Batal')}</button>
              <button type="button" onClick={() => void confirmDelete(current)} className={`${btnDangerSolid} flex-1`}>{t('Hapus pelanggan')}</button>
            </div>
          }
        >
          <p className="text-[14px] text-ink-soft">
            {t('Nomor HP dan catatan pelanggan ini dihapus dari aplikasi. Namanya tetap tercetak di struk transaksi yang sudah ada.')}
          </p>
        </Sheet>
      )}
    </section>
  );
}
