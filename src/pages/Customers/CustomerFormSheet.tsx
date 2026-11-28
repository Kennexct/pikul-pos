import { useState } from 'react';
import toast from 'react-hot-toast';
import { CustomerFields, type CustomerDraft } from '../../components/Customers/CustomerFields';
import { Sheet } from '../../components/ui/Sheet';
import { btnPrimary } from '../../components/ui/styles';
import { formatPhone } from '../../lib/customers';
import { saveCustomer } from '../../services/customers';
import type { Customer, Id } from '../../types';
import { t } from '../../i18n';

interface CustomerFormSheetProps {
  storeId: Id;
  customer: Customer | null;
  onClose: () => void;
}

export function CustomerFormSheet({ storeId, customer, onClose }: CustomerFormSheetProps) {
  const [draft, setDraft] = useState<CustomerDraft>({
    name: customer?.name ?? '',
    phone: customer?.phone ? formatPhone(customer.phone) : '',
    email: customer?.email ?? '',
    note: customer?.note ?? '',
  });
  const [isSaving, setIsSaving] = useState(false);

  const save = async () => {
    setIsSaving(true);
    try {
      const saved = await saveCustomer(storeId, { id: customer?.id, ...draft });
      toast.success(t('{0} disimpan', saved.name));
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('Gagal menyimpan pelanggan.'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Sheet
      title={customer ? t('Ubah pelanggan') : t('Pelanggan baru')}
      isOpen
      onClose={onClose}
      footer={
        <button type="button" disabled={isSaving || draft.name.trim() === ''} onClick={() => void save()} className={`${btnPrimary} w-full`}>
          {isSaving ? t('Menyimpan…') : t('Simpan pelanggan')}
        </button>
      }
    >
      <CustomerFields idPrefix="customer" value={draft} onChange={(patch) => setDraft((prev) => ({ ...prev, ...patch }))} autoFocusName={!customer} />
    </Sheet>
  );
}
