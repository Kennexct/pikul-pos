import { Banknote } from 'lucide-react';
import { useState } from 'react';
import { METHOD_ICON } from '../../../components/ui/paymentIcon';
import { RupiahInput } from '../../../components/ui/RupiahInput';
import { Sheet } from '../../../components/ui/Sheet';
import { btnPrimary, inputBase, labelBase, option, receiptRule, sectionTitle } from '../../../components/ui/styles';
import { QUICK_CASH_AMOUNTS } from '../../../constants';
import { formatRupiah } from '../../../lib/money';
import { calculateChange } from '../../../lib/pricing';
import { validatePayment, type PaymentInput } from '../../../services/orders';
import type { PaymentMethod } from '../../../types';
import { QrisDisplay } from './QrisDisplay';
import { t } from '../../../i18n';

interface PaymentSheetProps {
  total: number;
  methods: PaymentMethod[];
  storeName: string;
  isSubmitting: boolean;
  onConfirm: (payment: PaymentInput) => void;
  onClose: () => void;
}

export function PaymentSheet({ total, methods, storeName, isSubmitting, onConfirm, onClose }: PaymentSheetProps) {
  const activeMethods = methods.filter((m) => m.isActive);
  const [methodId, setMethodId] = useState(activeMethods[0]?.id ?? '');
  const [cashReceived, setCashReceived] = useState<number | null>(null);
  const [reference, setReference] = useState('');
  const [isQrisOpen, setIsQrisOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const method = activeMethods.find((m) => m.id === methodId);
  if (!method) {
    return (
      <Sheet title={t('Pembayaran')} isOpen onClose={onClose}>
        <p className="text-[14px] text-muted">{t('Belum ada metode pembayaran aktif. Aktifkan di Pengaturan.')}</p>
      </Sheet>
    );
  }

  const isCash = method.type === 'cash';
  const isQris = method.type === 'qris';
  const change = cashReceived === null ? null : calculateChange(total, cashReceived);
  const shortBy = cashReceived !== null && change === null ? total - cashReceived : 0;
  const quickAmounts = [total, ...QUICK_CASH_AMOUNTS.filter((amount) => amount > total)].slice(0, 4);

  const submit = () => {
    const payment: PaymentInput = { method, amount: total, reference, cashReceived: isCash ? (cashReceived ?? undefined) : undefined };
    const validationError = validatePayment(payment, total);
    setError(validationError);
    if (!validationError) onConfirm(payment);
  };

  const selectMethod = (next: PaymentMethod) => {
    setMethodId(next.id);
    setError(null);
    setReference('');
    if (next.type === 'qris') setIsQrisOpen(true);
  };

  if (isQrisOpen && isQris) {
    return (
      <QrisDisplay
        method={method}
        storeName={storeName}
        amount={total}
        reference={reference}
        onReferenceChange={setReference}
        error={error}
        isSubmitting={isSubmitting}
        onPaid={submit}
        onClose={() => setIsQrisOpen(false)}
      />
    );
  }

  return (
    <Sheet
      title={t('Pembayaran')}
      isOpen
      onClose={onClose}
      footer={
        <button type="button" disabled={isSubmitting} onClick={isQris ? () => setIsQrisOpen(true) : submit} className={`${btnPrimary} w-full`}>
          {isQris ? t('Tampilkan QRIS') : isSubmitting ? t('Menyimpan…') : t('Selesaikan pembayaran')}
        </button>
      }
    >
      <div className={`mb-5 flex items-end justify-between border-b ${receiptRule} pb-4`}>
        <span className="text-[14px] font-medium text-muted">{t('Total tagihan')}</span>
        <span className="num text-[32px] font-semibold leading-none tracking-[-0.03em]">{formatRupiah(total)}</span>
      </div>

      <h3 className={`${sectionTitle} mb-2.5`}>{t('Metode pembayaran')}</h3>
      <div className="mb-5 grid grid-cols-3 gap-2">
        {activeMethods.map((m) => {
          const Icon = METHOD_ICON[m.type];
          return (
            <button key={m.id} type="button" aria-pressed={m.id === method.id} onClick={() => selectMethod(m)} className={`${option(m.id === method.id)} h-[68px] flex-col gap-1 px-2 text-[13px]`}>
              <Icon aria-hidden size={22} />
              <span className="truncate">{m.name}</span>
            </button>
          );
        })}
      </div>

      {isCash && (
        <section className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2">
            {quickAmounts.map((amount, index) => (
              <button
                key={amount}
                type="button"
                onClick={() => setCashReceived(amount)}
                className={`${option(cashReceived === amount)} num ${index === 0 ? 'font-semibold' : ''}`}
              >
                {index === 0 && <Banknote aria-hidden size={17} />}
                {index === 0 ? t('Uang pas') : formatRupiah(amount)}
              </button>
            ))}
          </div>
          <div>
            <label htmlFor="cash-received" className={labelBase}>{t('Uang diterima')}</label>
            <RupiahInput id="cash-received" value={cashReceived} onChange={setCashReceived} size="lg" />
          </div>
          <div className={`flex items-center justify-between rounded-lg px-4 py-3 ${shortBy > 0 ? 'bg-danger-50 text-danger-700' : 'bg-brand-50 text-brand-800'}`}>
            <span className="text-[14px] font-semibold">{shortBy > 0 ? t('Kurang') : t('Kembalian')}</span>
            <span className="num text-[24px] font-semibold tracking-[-0.02em]">
              {shortBy > 0 ? formatRupiah(shortBy) : change === null ? '—' : formatRupiah(change)}
            </span>
          </div>
        </section>
      )}

      {!isCash && !isQris && method.referenceMode !== 'off' && (
        <section>
          <label htmlFor="payment-ref" className={labelBase}>
            {method.referenceLabel || t('No. Ref')} {method.referenceMode === 'optional' && <span className="font-normal text-muted">{t('(opsional)')}</span>}
          </label>
          <input id="payment-ref" value={reference} onChange={(event) => setReference(event.target.value)} className={inputBase} />
        </section>
      )}

      {isQris && <p className="text-[14px] text-muted">{t('Tampilkan kode QRIS ke pelanggan, lalu konfirmasi setelah dana masuk.')}</p>}

      {error && <p role="alert" className="mt-3 rounded-md bg-danger-50 px-3 py-2 text-[13px] text-danger-700">{error}</p>}
    </Sheet>
  );
}
