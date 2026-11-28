import { useState } from 'react';
import toast from 'react-hot-toast';
import { Keypad } from '../../components/ui/Keypad';
import { RupiahInput } from '../../components/ui/RupiahInput';
import { Sheet } from '../../components/ui/Sheet';
import { Switch } from '../../components/ui/Switch';
import { btnPrimary, helperText, inputBase, labelBase, option } from '../../components/ui/styles';
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABEL, EXPENSE_NOTE_MAX } from '../../constants';
import { useKeypad } from '../../hooks/useKeypad';
import { applyKeypadKeyToNumber } from '../../lib/keypad';
import { formatBusinessDate } from '../../lib/dateRange';
import { addExpense } from '../../services/expenses';
import type { BusinessDate, ExpenseCategory, Id } from '../../types';
import { t } from '../../i18n';

interface ExpenseSheetProps {
  storeId: Id;
  actorId: Id;
  businessDate: BusinessDate;
  onClose: () => void;
}

/** "Catat pengeluaran": amount first (the only required field), then category, note, and whether it came from the drawer. */
export function ExpenseSheet({ storeId, actorId, businessDate, onClose }: ExpenseSheetProps) {
  const [amount, setAmount] = useState<number | null>(null);
  const [category, setCategory] = useState<ExpenseCategory>('ingredients');
  const [note, setNote] = useState('');
  const [isFromDrawer, setIsFromDrawer] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const pad = useKeypad<'amount'>('amount');

  const submit = async () => {
    setIsSaving(true);
    try {
      await addExpense(storeId, { businessDate, category, amount, note, isFromDrawer, actorId });
      toast.success(t('Pengeluaran dicatat'));
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('Gagal mencatat pengeluaran.'));
      setIsSaving(false);
    }
  };

  return (
    <Sheet
      title={t('Catat pengeluaran')}
      subtitle={formatBusinessDate(businessDate)}
      isOpen
      onClose={onClose}
      footer={
        <div className="flex flex-col gap-3">
          {pad.active && <Keypad onKey={(key) => setAmount(applyKeypadKeyToNumber(amount, key, pad.takeFresh()))} />}
          <button type="button" disabled={isSaving || !amount} onClick={() => void submit()} className={`${btnPrimary} w-full`}>
            {t('Simpan pengeluaran')}
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <div>
          <label htmlFor="expense-amount" className={labelBase}>{t('Jumlah')}</label>
          <RupiahInput id="expense-amount" value={amount} onChange={setAmount} autoFocus size="lg" keypad={pad.field('amount')} />
        </div>
        <div>
          <p className={labelBase}>{t('Kategori')}</p>
          <div role="radiogroup" aria-label={t('Kategori pengeluaran')} className="grid grid-cols-2 gap-2">
            {EXPENSE_CATEGORIES.map((value) => (
              <button key={value} type="button" role="radio" aria-checked={category === value} onClick={() => setCategory(value)} className={`${option(category === value)} h-11 justify-start! px-3 text-left text-[14px]`}>
                {EXPENSE_CATEGORY_LABEL[value]}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label htmlFor="expense-note" className={labelBase}>{t('Catatan')} <span className="font-normal text-muted">{t('(opsional)')}</span></label>
          <input id="expense-note" value={note} maxLength={EXPENSE_NOTE_MAX} placeholder={t('mis. es batu 2 kantong')} onChange={(e) => setNote(e.target.value)} className={inputBase} />
        </div>
        <div>
          <Switch
            checked={isFromDrawer}
            onChange={setIsFromDrawer}
            label={t('Dibayar dari uang laci')}
            description={isFromDrawer ? t('Mengurangi uang laci saat tutup kasir.') : t('Dibayar dari uang lain (transfer, dompet pribadi).')}
          />
          <p className={helperText}>{t('Salah catat? Hapus lalu catat ulang.')}</p>
        </div>
      </div>
    </Sheet>
  );
}
