import readExcelFile from 'read-excel-file/node';
import { describe, expect, it } from 'vitest';
import { buildProfit } from '../profit';
import type { Expense, Order, Refund } from '../../types';
import { buildReport, type ReportInput } from '../reports';
import type { ExportContext } from './columns';
import { csvCell, datasetCsv } from './csv';
import { buildExport, exportFileName } from './index';

const order = (id: string, name: string, paidAt: string, total: number): Order => ({
  id, storeId: 's', createdAt: '', updatedAt: '', receiptNo: `INV-20261118-A1000${id}`, status: 'paid',
  salesModeId: 'dine', salesModeNameSnapshot: 'Dine In', customerId: null, label: 'Meja, "5"', orderDiscount: null,
  items: [{ id: `${id}-l`, productId: name, nameSnapshot: name, unitPrice: total, qty: 1, options: [], discount: null, note: '' }],
  payments: [{ id: 'p', paymentMethodId: 'cash', methodNameSnapshot: 'Tunai', methodType: 'cash', amount: total }],
  totals: { subtotal: total, itemDiscountTotal: 0, orderDiscountTotal: 0, serviceTotal: 0, taxTotal: 0, grandTotal: total },
  cashierId: 'owner', businessDate: '2026-11-18', openedAt: paidAt, paidAt,
});

const sales = [order('1', 'Bakso Urat', '2026-11-18T04:00:00Z', 15_000), order('2', '=HYPERLINK("http://evil")', '2026-11-18T05:00:00Z', 5_000)];
const refunds: Refund[] = [{
  id: 'r1', storeId: 's', createdAt: '2026-11-18T06:00:00Z', updatedAt: '', orderId: '1', businessDate: '2026-11-18', kind: 'refund',
  amount: 15_000, items: [{ orderItemId: '1-l', qty: 1, amount: 15_000 }], reasonCode: 'customer_cancel', reasonNote: '', actorId: 'owner', approvedById: null,
}];
const input: ReportInput = {
  store: { timezone: 'Asia/Jakarta' },
  range: { from: '2026-11-18', to: '2026-11-18' },
  sales,
  refunds,
  ordersById: new Map(sales.map((o) => [o.id, o])),
  memberName: new Map([['owner', 'Pemilik']]),
};
const ctx: ExportContext = { input, timeZone: 'Asia/Jakarta' };
const report = buildReport(input);

describe('csv', () => {
  it('quotes, escapes and neutralises formula injection', () => {
    expect(csvCell('Meja, "5"')).toBe('"Meja, ""5"""');
    expect(csvCell('=HYPERLINK("x")')).toBe('"\'=HYPERLINK(""x"")"');
    expect(csvCell('-5')).toBe("'-5");
    expect(csvCell(-5000)).toBe('-5000'); // numbers stay numeric
  });

  it('writes BOM, header and one row per transaction in chronological order with local time', () => {
    const csv = datasetCsv('transactions', ctx);
    const lines = csv.replace('﻿', '').trim().split('\r\n');
    expect(csv.startsWith('﻿')).toBe(true);
    expect(lines[0]).toMatch(/^Tanggal,Jam,No\. Struk,Status/);
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain('2026-11-18,11:00,INV-20261118-A10001,Lunas');
    expect(lines[1]?.endsWith(',15000')).toBe(true);
  });

  it('writes refund and item datasets', () => {
    expect(datasetCsv('refunds', ctx)).toContain('2026-11-18,Refund,INV-20261118-A10001,2026-11-18,Tunai,1,15000,Pelanggan batal');
    expect(datasetCsv('items', ctx).trim().split('\r\n')).toHaveLength(3);
  });
});

describe('xlsx', () => {
  it('produces 5 sheets with numeric amounts and sanitized text', async () => {
    const blob = await buildExport({ format: 'xlsx', dataset: 'transactions', storeName: 'Bakso Pak Budi', report, ctx });
    const sheets = await readExcelFile(Buffer.from(await blob.arrayBuffer()));
    expect(sheets.map((s) => s.sheet)).toEqual(['Ringkasan', 'Transaksi', 'Item', 'Refund', 'Per Produk']);

    const summary = sheets[0]?.data ?? [];
    expect(summary.find((row) => row[0] === 'Penjualan bersih')?.[1]).toBe(5_000);
    const transactions = sheets[1]?.data ?? [];
    expect(transactions[1]?.at(-1)).toBe(15_000);
    expect(transactions[2]?.[2]).toBe('INV-20261118-A10002');
    const items = sheets[2]?.data ?? [];
    expect(items[2]?.[3]).toBe('\'=HYPERLINK("http://evil")');
  });
});

describe('xlsx with profit and expenses (ADR-007)', () => {
  it('adds the profit statement to the summary and an expenses sheet with sanitized notes', async () => {
    const expenses = [
      { id: 'e1', businessDate: '2026-11-18', createdAt: '2026-11-18T03:00:00Z', category: 'wages', amount: 2_000, note: '=SUM(A1)', isFromDrawer: false, actorId: 'none' },
    ] as unknown as Expense[];
    const profit = buildProfit({ sales: ctx.input.sales, summary: report.summary, expenses });
    const blob = await buildExport({ format: 'xlsx', dataset: 'transactions', storeName: 'Bakso Pak Budi', report, ctx: { ...ctx, profit, expenses } });
    const sheets = await readExcelFile(Buffer.from(await blob.arrayBuffer()));
    expect(sheets.map((s) => s.sheet)).toEqual(['Ringkasan', 'Transaksi', 'Item', 'Refund', 'Per Produk', 'Pengeluaran']);

    const summary = sheets[0]?.data ?? [];
    expect(summary.find((row) => row[0] === 'Sisa setelah pengeluaran')?.[1]).toBe(report.summary.netSales - report.summary.taxTotal - 2_000);
    expect(sheets[5]?.data[1]).toEqual(['2026-11-18', 'Gaji & upah', "'=SUM(A1)", 'Tidak', 2_000, null]);
  });
});

describe('pdf', () => {
  it('produces a PDF document', async () => {
    const blob = await buildExport({ format: 'pdf', dataset: 'transactions', storeName: 'Bakso Pak Budi', report, ctx });
    const head = new TextDecoder().decode((await blob.arrayBuffer()).slice(0, 5));
    expect(head).toBe('%PDF-');
    expect(blob.size).toBeGreaterThan(2_000);
  });
});

describe('exportFileName', () => {
  it('slugs the store and includes range + dataset', () => {
    expect(exportFileName({ format: 'csv', dataset: 'items', storeName: 'Bakso Pak Budi!', report })).toBe('pikul-bakso-pak-budi-2026-11-18_2026-11-18-item.csv');
    expect(exportFileName({ format: 'xlsx', dataset: 'items', storeName: 'Bakso Pak Budi', report })).toBe('pikul-bakso-pak-budi-2026-11-18_2026-11-18.xlsx');
  });
});
