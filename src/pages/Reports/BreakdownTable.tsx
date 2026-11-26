import { card } from '../../components/ui/styles';
import { formatRupiah } from '../../lib/money';
import type { BreakdownRow } from '../../lib/reports';
import { t } from '../../i18n';

interface BreakdownTableProps {
  title: string;
  description?: string;
  rows: BreakdownRow[];
}

/** Gross / refund / net per dimension. Share bar = net share of the period (text carries the number). */
export function BreakdownTable({ title, description, rows }: BreakdownTableProps) {
  const totalNet = rows.reduce((s, r) => s + Math.max(0, r.net), 0);

  return (
    <section className={`${card} overflow-hidden`}>
      <header className="px-4 pb-2 pt-4 md:px-5">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em]">{title}</h2>
        {description && <p className="text-[13px] text-muted">{description}</p>}
      </header>
      {rows.length === 0 ? (
        <p className="px-5 pb-5 text-[14px] text-muted">{t('Belum ada data.')}</p>
      ) : (
        <table className="w-full text-[14px]">
          <thead>
            <tr className="border-y border-line bg-subtle text-[12px] font-semibold text-muted">
              <th scope="col" className="px-4 py-2 text-left md:px-5">{t('Nama')}</th>
              <th scope="col" className="hidden px-2 py-2 text-right sm:table-cell">{t('Trx')}</th>
              <th scope="col" className="hidden px-2 py-2 text-right sm:table-cell">{t('Refund')}</th>
              <th scope="col" className="px-4 py-2 text-right md:px-5">{t('Bersih')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((row) => {
              const share = totalNet > 0 ? Math.max(0, row.net) / totalNet : 0;
              return (
                <tr key={row.key}>
                  <th scope="row" className="px-4 py-2.5 text-left font-medium md:px-5">
                    <span className="block truncate">{row.label}</span>
                    <span aria-hidden className="mt-1.5 block h-1.5 w-full max-w-[160px] overflow-hidden rounded-full bg-subtle">
                      <span className="block h-full rounded-full bg-brand-600" style={{ width: `${Math.round(share * 100)}%` }} />
                    </span>
                  </th>
                  <td className="num hidden px-2 py-2.5 text-right text-ink-soft sm:table-cell">{row.transactions}</td>
                  <td className={`num hidden px-2 py-2.5 text-right sm:table-cell ${row.refunds > 0 ? 'text-warn-700' : 'text-muted'}`}>
                    {row.refunds > 0 ? `−${formatRupiah(row.refunds)}` : '—'}
                  </td>
                  <td className="num px-4 py-2.5 text-right font-semibold md:px-5">
                    {formatRupiah(row.net)}
                    <span className="block text-[12px] font-normal text-muted">{Math.round(share * 100)}%</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}
