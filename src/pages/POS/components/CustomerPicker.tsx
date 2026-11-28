import { Check, UserRoundPlus, UserRoundX } from 'lucide-react';
import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { CustomerFields, type CustomerDraft } from '../../../components/Customers/CustomerFields';
import { SearchInput } from '../../../components/ui/SearchInput';
import { Sheet } from '../../../components/ui/Sheet';
import { btnGhost, btnPrimary, btnSecondary } from '../../../components/ui/styles';
import { useCustomers } from '../../../hooks/useCustomers';
import { formatPhone, searchCustomers } from '../../../lib/customers';
import { saveCustomer } from '../../../services/customers';
import type { Customer, Id } from '../../../types';
import { t } from '../../../i18n';

const MAX_RESULTS = 30;

interface CustomerPickerProps {
  storeId: Id;
  selectedId: Id | null;
  onSelect: (customer: Customer | null) => void;
  onClose: () => void;
}

/** Attach a customer to the cart: search existing ones or quick-add (name + optional phone). */
export function CustomerPicker({ storeId, selectedId, onSelect, onClose }: CustomerPickerProps) {
  const customers = useCustomers(storeId);
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState<CustomerDraft | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const results = useMemo(() => searchCustomers(customers ?? [], query).slice(0, MAX_RESULTS), [customers, query]);

  /** Pre-fill from what was typed: digits become the phone, anything else the name. */
  const startNew = () => {
    const typed = query.trim();
    const isPhone = /^[\d+\-\s]{4,}$/.test(typed);
    setDraft({ name: isPhone ? '' : typed, phone: isPhone ? typed : '', email: '', note: '' });
  };

  const saveNew = async () => {
    if (!draft) return;
    setIsSaving(true);
    try {
      onSelect(await saveCustomer(storeId, draft));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('Gagal menyimpan pelanggan.'));
    } finally {
      setIsSaving(false);
    }
  };

  if (draft) {
    return (
      <Sheet
        title={t('Pelanggan baru')}
        isOpen
        onClose={onClose}
        footer={
          <div className="flex gap-2">
            <button type="button" onClick={() => setDraft(null)} className={btnSecondary}>{t('Kembali')}</button>
            <button type="button" disabled={isSaving || draft.name.trim() === ''} onClick={() => void saveNew()} className={`${btnPrimary} flex-1`}>
              {isSaving ? t('Menyimpan…') : t('Simpan & pilih')}
            </button>
          </div>
        }
      >
        <CustomerFields idPrefix="quick-customer" value={draft} hasNote={false} hasEmail={false} autoFocusName onChange={(patch) => setDraft((prev) => (prev ? { ...prev, ...patch } : prev))} />
      </Sheet>
    );
  }

  return (
    <Sheet
      title={t('Pelanggan')}
      subtitle={t('Pilih untuk pesanan ini')}
      isOpen
      onClose={onClose}
      footer={
        <button type="button" onClick={startNew} className={`${btnSecondary} w-full`}>
          <UserRoundPlus aria-hidden size={18} /> {t('Pelanggan baru')}{query.trim() ? `: "${query.trim()}"` : ''}
        </button>
      }
    >
      <SearchInput value={query} onChange={setQuery} placeholder={t('Cari nama atau nomor HP…')} label={t('Cari pelanggan')} />
      {selectedId && (
        <button type="button" onClick={() => onSelect(null)} className={`${btnGhost} mt-2 text-[14px] text-danger-700!`}>
          <UserRoundX aria-hidden size={16} /> {t('Lepas pelanggan dari pesanan')}
        </button>
      )}
      {results.length === 0 ? (
        <p className="py-8 text-center text-[14px] text-muted">
          {customers && customers.length === 0 ? t('Belum ada pelanggan tersimpan.') : t('Tidak ditemukan.')}
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-line rounded-lg border border-line">
          {results.map((customer) => (
            <li key={customer.id}>
              <button type="button" onClick={() => onSelect(customer)} className="flex min-h-14 w-full items-center gap-3 px-3.5 py-2 text-left hover:bg-subtle">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold">{customer.name}</span>
                  <span className="num block truncate text-[13px] text-muted">{customer.phone ? formatPhone(customer.phone) : t('Tanpa nomor HP')}</span>
                </span>
                {customer.id === selectedId && <Check aria-label={t('terpilih')} size={18} className="text-brand-600" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}
