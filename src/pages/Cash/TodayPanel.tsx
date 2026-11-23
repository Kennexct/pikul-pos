import { ClipboardList, LockOpen, MessageCircle, Pencil, RotateCcw, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { METHOD_ICON } from '../../components/ui/paymentIcon';
import { btnGhost, btnPrimary, btnSecondary, card, sectionTitle } from '../../components/ui/styles';
import { ROUTES } from '../../constants';
import { buildClosingText, isClosingStale, type Drawer } from '../../lib/cashDrawer';
import { formatRupiah } from '../../lib/money';
import { whatsAppShareUrl } from '../../lib/receiptText';
import type { DayClosing } from '../../types';
import { DifferenceBadge } from './DifferenceBadge';
import { DATE_LOCALE, t } from '../../i18n';

interface TodayPanelProps {
  storeName: string;
  timeZone: string;
  drawer: Drawer;
  closing: DayClosing | null;
  closedByName: string;
  /** False until the opening cash was counted today (ADR-017): the action reads "Buka kasir". */
  isOpened: boolean;
  onEditOpening: () => void;
  onClose: () => void;
  onReopen: () => void;
  onShowExpenses: () => void;
}

function Line({ label, value, action, isTotal = false }: { label: string; value: string; action?: ReactNode; isTotal?: boolean }) {
  return (
    <div className={`flex items-center gap-3 ${isTotal ? 'border-t border-line pt-3' : ''}`}>
      <dt className={`min-w-0 flex-1 ${isTotal ? 'text-[15px] font-semibold text-ink' : 'text-[14px] text-ink-soft'}`}>
        {label}
        {action}
      </dt>
      <dd className={`num ${isTotal ? 'text-[24px] font-extrabold leading-none tracking-[-0.02em]' : 'text-[15px] font-semibold'}`}>{value}</dd>
    </div>
  );
}

const minus = (amount: number) => (amount === 0 ? formatRupiah(0) : `− ${formatRupiah(amount)}`);

/** The day at a glance: the drawer statement (what should be in the drawer) and where the money came from. */
export function TodayPanel({ storeName, timeZone, drawer, closing, closedByName, isOpened, onEditOpening, onClose, onReopen, onShowExpenses }: TodayPanelProps) {
  // Once closed, show the figures as recorded; the live ones only decide whether the record is out of date.
  const shown = closing ?? drawer;
  const isStale = closing !== null && isClosingStale(closing, drawer);
  const closedAt = closing ? new Intl.DateTimeFormat(DATE_LOCALE, { hour: '2-digit', minute: '2-digit', timeZone }).format(new Date(closing.closedAt)) : '';

  return (
    <div className="grid gap-4 @4xl/page:grid-cols-2 @4xl/page:items-start">
      <section aria-label={t('Kas laci')} className={`${card} p-4 md:p-5`}>
        <h2 className={`${sectionTitle} mb-3`}>{t('Kas laci')}</h2>
        <dl className="flex flex-col gap-2.5">
          <Line
            label={t('Modal awal')}
            value={formatRupiah(shown.openingCash)}
            action={
              closing ? undefined : (
                <button type="button" onClick={onEditOpening} className="ml-2 inline-flex h-8 items-center gap-1 rounded-md px-2 text-[13px] font-semibold text-brand-700 hover:bg-brand-50">
                  {isOpened ? <Pencil aria-hidden size={13} /> : <LockOpen aria-hidden size={13} />} {isOpened ? t('Ubah') : t('Buka kasir')}
                </button>
              )
            }
          />
          <Line label={t('Penjualan tunai')} value={`+ ${formatRupiah(shown.cashSales)}`} />
          <Line label={t('Refund tunai')} value={minus(shown.cashRefunds)} />
          <Line label={t('Pengeluaran dari laci')} value={minus(shown.drawerExpenses)} />
          <Line label={t('Uang di laci seharusnya')} value={formatRupiah(shown.expectedCash)} isTotal />
        </dl>

        {closing ? (
          <div className="mt-4 border-t border-line pt-4">
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[14px] text-ink-soft">{t('Dihitung')}</p>
                <p className="num text-[18px] font-bold">{formatRupiah(closing.countedCash)}</p>
              </div>
              <DifferenceBadge difference={closing.difference} />
            </div>
            <p className="mt-2 text-[13px] text-muted">
              {t('Ditutup')} {closedAt} {t('oleh')} {closedByName}
              {closing.note ? ` · ${closing.note}` : ''}
            </p>
            {isStale && (
              <p className="mt-3 flex gap-2 rounded-lg border border-warn-200 bg-warn-50 px-3 py-2.5 text-[13px] text-warn-700">
                <TriangleAlert aria-hidden size={16} className="mt-0.5 shrink-0" />
                {t('Ada transaksi atau pengeluaran setelah kasir ditutup. Buka kembali, lalu tutup lagi agar angkanya cocok.')}
              </p>
            )}
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <a
                href={whatsAppShareUrl(buildClosingText({ storeName, closing, closedByName, timeZone }))}
                target="_blank"
                rel="noopener noreferrer"
                className={`${btnSecondary} h-11 text-[14px] sm:flex-1`}
              >
                <MessageCircle aria-hidden size={17} /> {t('Kirim ringkasan')}
              </a>
              <button type="button" onClick={onReopen} className={`${btnGhost} text-[14px]`}>
                <RotateCcw aria-hidden size={16} /> {t('Buka kembali')}
              </button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={onClose} className={`${btnPrimary} mt-4 w-full`}>{t('Tutup kasir')}</button>
        )}
      </section>

      <section aria-label={t('Ringkasan hari')} className={`${card} p-4 md:p-5`}>
        <h2 className={`${sectionTitle} mb-3`}>{t('Uang masuk & keluar')}</h2>
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[14px] text-ink-soft">{t('Penjualan bersih')}</p>
            <p className="num text-[13px] text-muted">{t('{0} transaksi', drawer.transactions)}</p>
          </div>
          <p className="num text-[20px] font-bold tracking-[-0.02em]">{formatRupiah(drawer.netSales)}</p>
        </div>
        {drawer.byMethod.length > 0 && (
          <ul className="mt-3 divide-y divide-line border-y border-line">
            {drawer.byMethod.map((method) => {
              const Icon = METHOD_ICON[method.type];
              return (
                <li key={`${method.type}-${method.name}`} className="flex items-center gap-3 py-2.5">
                  <Icon aria-hidden size={18} className="text-muted" />
                  <span className="min-w-0 flex-1 truncate text-[14px]">{method.name}</span>
                  <span className="num text-[14px] font-semibold">{formatRupiah(method.amount)}</span>
                </li>
              );
            })}
          </ul>
        )}
        <button type="button" onClick={onShowExpenses} className="mt-3 flex w-full items-center justify-between gap-3 rounded-md py-1 text-left hover:bg-subtle">
          <span className="text-[14px] text-ink-soft">{t('Pengeluaran')} <span className="font-semibold text-brand-700">{t('· lihat')}</span></span>
          <span className="num text-[15px] font-semibold">{minus(drawer.expensesTotal)}</span>
        </button>
        {drawer.openOrderCount > 0 && (
          <Link to={ROUTES.openOrders} className="mt-3 flex items-center gap-2.5 rounded-lg border border-warn-200 bg-warn-50 px-3 py-2.5 text-[13px] text-warn-700">
            <ClipboardList aria-hidden size={16} className="shrink-0" />
            <span className="flex-1">{drawer.openOrderCount} {t('pesanan belum dibayar')}</span>
            <span className="num font-semibold">{formatRupiah(drawer.openOrderAmount)}</span>
          </Link>
        )}
        <p className="mt-3 text-[12px] text-faint">{t('Hanya transaksi di perangkat ini.')}</p>
      </section>
    </div>
  );
}
