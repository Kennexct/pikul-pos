import type { Report } from '../reports';
import type { Dataset, ExportContext } from './columns';
import { csvBlob } from './csv';
import { t } from '../../i18n';

export const EXPORT_FORMATS = ['xlsx', 'pdf', 'csv'] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export interface ExportRequest {
  format: ExportFormat;
  /** CSV only: which dataset to write (one file per dataset). */
  dataset: Dataset;
  storeName: string;
  report: Report;
  ctx: ExportContext;
}

function slug(value: string): string {
  return value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'toko';
}

export function exportFileName({ format, dataset, storeName, report }: Pick<ExportRequest, 'format' | 'dataset' | 'storeName' | 'report'>): string {
  const suffix = format === 'csv' ? `-${dataset === 'transactions' ? 'transaksi' : dataset === 'items' ? 'item' : 'refund'}` : '';
  return `pikul-${slug(storeName)}-${report.range.from}_${report.range.to}${suffix}.${format}`;
}

/**
 * Builds the file. XLSX and PDF modules (and their libraries) are fetched with `import()` so they never
 * land in the POS bundle (ADR-001). Throws a user-facing message when the chunk can't load (offline first use).
 */
export async function buildExport(request: ExportRequest): Promise<Blob> {
  const { format, dataset, storeName, report, ctx } = request;
  if (format === 'csv') return csvBlob(dataset, ctx);
  try {
    if (format === 'xlsx') {
      const { buildXlsx } = await import('./xlsx');
      return await buildXlsx(storeName, report, ctx);
    }
    const { buildPdf } = await import('./pdf');
    return buildPdf(storeName, report, new Date(), ctx.profit);
  } catch (error) {
    if (error instanceof TypeError && /dynamically imported module|Failed to fetch|Importing a module/i.test(error.message)) {
      throw new Error(t('Gagal memuat modul ekspor. Coba lagi saat online.'));
    }
    throw error;
  }
}
