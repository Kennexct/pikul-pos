import { Image as ImageIcon, Mail, MessageCircle, Printer } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { canShareFiles, downloadBlob } from '../../lib/export/deliver';
import { buildReceiptDoc } from '../../lib/receiptDoc';
import { receiptFileName, receiptPng } from '../../lib/receiptImage';
import { buildReceiptMessage, buildReceiptText, whatsAppShareUrl } from '../../lib/receiptText';
import { markShared, receiptUrl } from '../../services/receiptShare';
import type { Customer, Order, Refund, Store } from '../../types';
import { btnSecondary } from '../ui/styles';
import { EmailReceiptSheet } from './EmailReceiptSheet';
import { useReceiptShare } from './useReceiptShare';
import { t } from '../../i18n';

interface ReceiptShareActionsProps {
  order: Order;
  store: Store;
  cashierName: string;
  refunds?: readonly Refund[];
  customer?: Customer | null;
  printLabel: string;
}

const canShareImage = () => {
  if (!canShareFiles()) return false;
  try {
    return navigator.canShare({ files: [new File([''], 'probe.png', { type: 'image/png' })] });
  } catch {
    return false;
  }
};

/**
 * Print, WhatsApp, Email and image buttons under a receipt (ADR-028). WhatsApp opens the customer's own chat with
 * a short message and the web receipt link when the store is signed in; otherwise the full text receipt as before.
 */
export function ReceiptShareActions({ order, store, cashierName, refunds = [], customer, printLabel }: ReceiptShareActionsProps) {
  const share = useReceiptShare(order.id);
  const [isEmailOpen, setIsEmailOpen] = useState(false);
  const [isImageBusy, setIsImageBusy] = useState(false);
  const phone = customer && !customer.deletedAt ? customer.phone : undefined;
  const link = receiptUrl(share.token);
  const isOnline = typeof navigator === 'undefined' || navigator.onLine;
  const message = share.isLinkable ? buildReceiptMessage(order, store, link, isOnline) : buildReceiptText(order, store);
  const isShareable = canShareImage();
  const hasEmail = share.isLinkable && share.isEmailAvailable;
  const imageLabel = isShareable ? t('Bagikan gambar') : t('Simpan gambar');

  const sendImage = async () => {
    setIsImageBusy(true);
    try {
      const blob = await receiptPng(buildReceiptDoc(order, store, cashierName, refunds));
      const fileName = receiptFileName(order.receiptNo);
      if (!isShareable) {
        downloadBlob(blob, fileName);
        return;
      }
      if (share.isLinkable) void markShared(order.id, share.token, cashierName);
      const file = new File([blob], fileName, { type: 'image/png' });
      await navigator.share({ files: [file], text: share.isLinkable ? t('Struk {0} · {1}', order.receiptNo, link) : t('Struk {0}', order.receiptNo) });
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) toast.error(t('Gambar struk tidak bisa dibuat.'));
    } finally {
      setIsImageBusy(false);
    }
  };

  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => window.print()} className={btnSecondary}>
          <Printer aria-hidden size={18} /> {printLabel}
        </button>
        <a
          href={whatsAppShareUrl(message, phone)}
          target="_blank"
          rel="noopener noreferrer"
          title={phone ? t('Kirim struk ke WhatsApp pelanggan') : t('Bagikan struk lewat WhatsApp')}
          onClick={() => {
            if (share.isLinkable) void markShared(order.id, share.token, cashierName);
          }}
          className={btnSecondary}
        >
          <MessageCircle aria-hidden size={18} /> {t('WhatsApp')}
        </a>
        {hasEmail && (
          <button type="button" onClick={() => setIsEmailOpen(true)} className={btnSecondary}>
            <Mail aria-hidden size={18} /> {t('Email')}
          </button>
        )}
        <button
          type="button"
          disabled={isImageBusy}
          aria-label={imageLabel}
          onClick={() => void sendImage()}
          className={`${btnSecondary} whitespace-nowrap ${hasEmail ? '' : 'col-span-2'}`}
        >
          <ImageIcon aria-hidden size={18} />
          {/* A phone-width half button fits one word. */}
          <span aria-hidden className={hasEmail ? 'sm:hidden' : 'hidden'}>{t('Gambar')}</span>
          <span aria-hidden className={hasEmail ? 'hidden sm:inline' : ''}>{imageLabel}</span>
        </button>
      </div>
      {isEmailOpen && (
        <EmailReceiptSheet order={order} token={share.token} cashierName={cashierName} customer={customer ?? null} onClose={() => setIsEmailOpen(false)} />
      )}
    </>
  );
}
