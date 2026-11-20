import { jsPDF } from 'jspdf';
import { autoTable, type RowInput } from 'jspdf-autotable';
import { formatRange } from '../dateRange';
import { formatRupiah } from '../money';
import { profitLines, type Profit } from '../profit';
import type { BreakdownRow, Report } from '../reports';
import { DATE_LOCALE, t } from '../../i18n';
import { formatQuantity } from '../quantity';

/** A4 summary report (ADR-001). Loaded with `import()` only when exporting. Standard Helvetica (WinAnsi). */
const BRAND: [number, number, number] = [11, 122, 90];
const INK: [number, number, number] = [20, 32, 27];
const MUTED: [number, number, number] = [94, 106, 101];
const MARGIN = 14;
const TOP_PRODUCTS = 10;

type DocWithTable = jsPDF & { lastAutoTable?: { finalY: number } };

function nextY(doc: DocWithTable, fallback: number): number {
  return (doc.lastAutoTable?.finalY ?? fallback) + 9;
}

function section(doc: DocWithTable, title: string, y: number, head: string[], body: RowInput[], moneyCols: number[]): number {
  doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(...INK).text(title, MARGIN, y);
  autoTable(doc, {
    startY: y + 2,
    head: [head],
    body: body.length > 0 ? body : [[{ content: t('Tidak ada data'), colSpan: head.length, styles: { textColor: MUTED } }]],
    margin: { left: MARGIN, right: MARGIN },
    theme: 'plain',
    styles: { font: 'helvetica', fontSize: 9, cellPadding: { top: 1.6, bottom: 1.6, left: 2, right: 2 }, textColor: INK, lineColor: [226, 231, 228], lineWidth: { bottom: 0.2 } },
    headStyles: { fontStyle: 'bold', textColor: MUTED, fillColor: [242, 245, 243] },
    columnStyles: Object.fromEntries(moneyCols.map((i) => [i, { halign: 'right' as const }])),
    didParseCell: (data) => {
      if (data.section === 'head' && moneyCols.includes(data.column.index)) data.cell.styles.halign = 'right';
    },
  });
  return nextY(doc, y);
}

const breakdownBody = (rows: readonly BreakdownRow[]) =>
  rows.map((r) => [r.label, String(r.transactions), formatRupiah(r.gross), formatRupiah(r.refunds), formatRupiah(r.net)]);

/** Helvetica (WinAnsi) has no U+2212, so negatives use a plain hyphen. */
const signedRupiah = (amount: number) => (amount < 0 ? `-${formatRupiah(-amount)}` : formatRupiah(amount));

export function buildPdf(storeName: string, report: Report, generatedAt: Date, profit?: Profit): Blob {
  const doc: DocWithTable = new jsPDF({ unit: 'mm', format: 'a4' });
  const s = report.summary;

  doc.setFillColor(...BRAND).rect(0, 0, 210, 4, 'F');
  doc.setFont('helvetica', 'bold').setFontSize(18).setTextColor(...INK).text(t('Laporan Penjualan'), MARGIN, 18);
  doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(...MUTED);
  doc.text(`${storeName} - ${formatRange(report.range)}`, MARGIN, 25);
  doc.text(t('Refund dihitung pada tanggal refund dilakukan (basis kas).'), MARGIN, 30);

  const kpis: Array<[string, string]> = [
    [t('Penjualan bersih'), formatRupiah(s.netSales)],
    [t('Penjualan kotor'), formatRupiah(s.grossSales)],
    [t('Transaksi'), String(s.transactions)],
    [t('Rata-rata'), formatRupiah(s.averageTicket)],
    [t('Diskon'), formatRupiah(s.discounts)],
    [t('Refund'), formatRupiah(s.refunds)],
    [t('Void'), `${s.voidCount} (${formatRupiah(s.voidAmount)})`],
    [t('Item terjual'), String(s.itemsSold)],
  ];
  autoTable(doc, {
    startY: 36,
    body: [kpis.slice(0, 4).map(([l, v]) => `${l}\n${v}`), kpis.slice(4).map(([l, v]) => `${l}\n${v}`)],
    margin: { left: MARGIN, right: MARGIN },
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 10, cellPadding: 3, textColor: INK, lineColor: [226, 231, 228], lineWidth: 0.2 },
    didParseCell: (data) => {
      if (data.row.index === 0 && data.column.index === 0) {
        data.cell.styles.fillColor = [235, 247, 242];
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });

  let y = nextY(doc, 60);
  if (profit && profit.mode !== 'none') {
    const title = profit.mode === 'cost' ? t('Laba (perkiraan)') : t('Penjualan dan pengeluaran');
    y = section(doc, title, y, [t('Keterangan'), t('Jumlah')], profitLines(profit).map((line) => [line.label, signedRupiah(line.amount)]), [1]);
  }
  const head = [t('Nama'), t('Transaksi'), t('Penjualan'), t('Refund'), t('Bersih')];
  y = section(doc, t('Per metode pembayaran'), y, head, breakdownBody(report.byPaymentMethod), [1, 2, 3, 4]);
  y = section(doc, t('Per mode penjualan'), y, head, breakdownBody(report.bySalesMode), [1, 2, 3, 4]);
  y = section(
    doc,
    t('Produk terlaris (top {0})', TOP_PRODUCTS),
    y,
    ['#', t('Produk'), t('Qty'), t('Pendapatan')],
    report.products.slice(0, TOP_PRODUCTS).map((p, i) => [String(i + 1), p.name, formatQuantity(p.qty, p.unit), formatRupiah(p.revenue)]),
    [2, 3],
  );
  section(doc, t('Per kasir'), y, head, breakdownBody(report.byCashier), [1, 2, 3, 4]);

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page).setFont('helvetica', 'normal').setFontSize(8).setTextColor(...MUTED);
    doc.text(t('Dibuat {0} - Pikul', generatedAt.toLocaleString(DATE_LOCALE)), MARGIN, 290);
    doc.text(`${page}/${pages}`, 196, 290, { align: 'right' });
  }
  return doc.output('blob');
}
