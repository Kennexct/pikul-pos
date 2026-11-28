import { Mail } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { normalizeEmail } from '../../lib/customers';
import { setCustomerEmail } from '../../services/customers';
import { queueReceiptEmail } from '../../services/receiptShare';
import type { Customer, Order } from '../../types';
import { Sheet } from '../ui/Sheet';
import { Switch } from '../ui/Switch';
import { btnPrimary, helperText, inputBase, labelBase } from '../ui/styles';
import { t } from '../../i18n';

interface EmailReceiptSheetProps {
  order: Order;
  token: string;
  cashierName: string;
  customer: Customer | null;
  onClose: () => void;
}

/** Address for the receipt email (ADR-028). Queued on the device; the server sends it once online. */
export function EmailReceiptSheet({ order, token, cashierName, customer, onClose }: EmailReceiptSheetProps) {
  const activeCustomer = customer && !customer.deletedAt ? customer : null;
  const [to, setTo] = useState(activeCustomer?.email ?? '');
  const [isSaveToCustomer, setIsSaveToCustomer] = useState(true);
  const isNewAddress = activeCustomer !== null && normalizeEmail(to) !== null && normalizeEmail(to) !== activeCustomer.email;
  const [error, setError] = useState('');
  const [isSending, setIsSending] = useState(false);

  const send = async () => {
    const email = normalizeEmail(to);
    if (!email) {
      setError(t('Alamat email tidak valid. Contoh: nama@email.com.'));
      return;
    }
    setIsSending(true);
    try {
      await queueReceiptEmail(order.id, email, token, cashierName);
      if (activeCustomer && isNewAddress && isSaveToCustomer) await setCustomerEmail(activeCustomer.id, email);
      toast.success(navigator.onLine ? t('Struk dikirim ke {0}', email) : t('Struk akan dikirim ke {0} saat online', email));
      onClose();
    } catch {
      setError(t('Email belum bisa diantrekan. Coba lagi.'));
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Sheet
      title={t('Kirim struk lewat email')}
      subtitle={order.receiptNo}
      isOpen
      onClose={onClose}
      footer={
        <button type="button" disabled={isSending || to.trim() === ''} onClick={() => void send()} className={`${btnPrimary} w-full`}>
          <Mail aria-hidden size={18} /> {t('Kirim')}
        </button>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
        className="flex flex-col gap-4"
      >
        <div>
          <label htmlFor="receipt-email" className={labelBase}>{t('Email pelanggan')}</label>
          <input
            id="receipt-email"
            type="email"
            inputMode="email"
            autoFocus
            autoComplete="off"
            maxLength={254}
            value={to}
            placeholder="nama@email.com"
            aria-invalid={error !== ''}
            onChange={(e) => {
              setTo(e.target.value);
              setError('');
            }}
            className={inputBase}
          />
          {error ? <p className="mt-1.5 text-[13px] text-danger-700">{error}</p> : <p className={helperText}>{t('Struk dikirim sebagai gambar, dengan tautan untuk melihatnya di web.')}</p>}
        </div>
        {activeCustomer && isNewAddress && (
          <Switch checked={isSaveToCustomer} onChange={setIsSaveToCustomer} label={t('Simpan ke data {0}', activeCustomer.name)} />
        )}
      </form>
    </Sheet>
  );
}
