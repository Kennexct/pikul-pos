import { ArrowLeft, CircleCheck, QrCode, SunMedium } from 'lucide-react';
import { useEffect } from 'react';
import { btnPrimary, btnSecondary, inputBase } from '../../../components/ui/styles';
import { formatRupiah } from '../../../lib/money';
import type { PaymentMethod } from '../../../types';
import { t } from '../../../i18n';

interface QrisDisplayProps {
  method: PaymentMethod;
  storeName: string;
  amount: number;
  reference: string;
  onReferenceChange: (value: string) => void;
  error: string | null;
  isSubmitting: boolean;
  onPaid: () => void;
  onClose: () => void;
}

/**
 * M5: full-screen static QRIS for the customer to scan.
 * Static QRIS has no payment callback, so the cashier confirms manually.
 */
export function QrisDisplay({ method, storeName, amount, reference, onReferenceChange, error, isSubmitting, onPaid, onClose }: QrisDisplayProps) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div role="dialog" aria-modal="true" aria-label={t('Pembayaran QRIS')} className="animate-rise fixed inset-0 z-50 flex flex-col bg-canvas">
      <header className="flex items-center gap-2 border-b border-line bg-surface px-3 py-2">
        <button type="button" aria-label={t('Kembali ke pembayaran')} onClick={onClose} className="flex h-11 w-11 items-center justify-center rounded-lg text-ink-soft hover:bg-subtle">
          <ArrowLeft aria-hidden size={20} />
        </button>
        <p className="flex-1 text-[15px] font-semibold">{t('Pembayaran QRIS')}</p>
      </header>

      <div className="flex flex-1 flex-col items-center overflow-y-auto px-4 py-5">
        <div className="w-full max-w-sm overflow-hidden rounded-xl border border-line bg-surface shadow-pop">
          <div className="flex items-center justify-between border-b border-line px-5 py-3">
            <span className="truncate text-[14px] font-semibold">{storeName}</span>
            <span className="rounded bg-ink px-1.5 py-0.5 text-[11px] font-extrabold tracking-[0.08em] text-white">{t('QRIS')}</span>
          </div>
          <div className="px-5 pt-4 text-center">
            <p className="text-[13px] font-medium text-muted">{t('Total yang harus dibayar')}</p>
            <p className="num text-[36px] font-extrabold leading-tight tracking-[-0.03em]">{formatRupiah(amount)}</p>
          </div>
          <div className="p-5 pt-3">
            {method.qrisImageUrl ? (
              <img src={method.qrisImageUrl} alt={t('Kode QRIS {0}', storeName)} className="mx-auto aspect-square w-full max-w-[300px] object-contain" />
            ) : (
              <div className="flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-line-strong bg-subtle p-6 text-center">
                <QrCode aria-hidden size={36} className="text-faint" />
                <p className="text-[14px] font-semibold">{t('Gambar QRIS belum diunggah')}</p>
                <p className="text-[13px] text-muted">{t('Minta pelanggan scan QRIS cetak Anda, atau unggah di Pengaturan → Metode Pembayaran.')}</p>
              </div>
            )}
          </div>
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-[13px] text-muted">
          <SunMedium aria-hidden size={15} /> {t('Naikkan kecerahan layar agar mudah dipindai')}
        </p>
      </div>

      <footer className="mx-auto flex w-full max-w-sm flex-col gap-2 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2">
        {method.referenceMode !== 'off' && (
          <input
            aria-label={method.referenceLabel || t('Referensi')}
            placeholder={`${method.referenceLabel || t('No. Ref')}${method.referenceMode === 'optional' ? t(' (opsional)') : ''}`}
            value={reference}
            onChange={(event) => onReferenceChange(event.target.value)}
            className={inputBase}
          />
        )}
        {error && <p role="alert" className="rounded-md bg-danger-50 px-3 py-2 text-[13px] text-danger-700">{error}</p>}
        <div className="grid grid-cols-[auto_1fr] gap-2">
          <button type="button" onClick={onClose} className={btnSecondary}>{t('Batal')}</button>
          <button type="button" disabled={isSubmitting} onClick={onPaid} className={btnPrimary}>
            <CircleCheck aria-hidden size={19} /> {isSubmitting ? t('Menyimpan…') : t('Sudah dibayar')}
          </button>
        </div>
      </footer>
    </div>
  );
}
