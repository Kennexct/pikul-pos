import { useState } from 'react';
import toast from 'react-hot-toast';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import { btnPrimary, helperText, labelBase } from '../../../components/ui/styles';
import { PERCENT_MAX } from '../../../constants';
import { updateStore } from '../../../services/bootstrap';
import type { PermissionLevel, Store, StoreRules } from '../../../types';
import { SettingsSection } from '../SettingsSection';
import { t } from '../../../i18n';
import { NumberInput } from '../../../components/ui/NumberInput';

type RuleChoice = 'free' | 'pin';
const RULE_OPTIONS = [
  { value: 'free', label: t('Kasir boleh langsung') },
  { value: 'pin', label: t('Perlu PIN pemilik') },
] as const;
const MAX_REFUND_WINDOW_DAYS = 90;

/** `owner_only` and `cashier_with_pin` behave the same (ADR-004), so the UI offers two choices. */
const toChoice = (level: PermissionLevel): RuleChoice => (level === 'cashier' ? 'free' : 'pin');
const toLevel = (choice: RuleChoice): PermissionLevel => (choice === 'free' ? 'cashier' : 'cashier_with_pin');

/** Rules a cashier works under: void, refund, discount limit, refund window (PRD M11/M14). */
export function RulesSection({ store }: { store: Store }) {
  const [rules, setRules] = useState<StoreRules>(store.settings);
  const update = (patch: Partial<StoreRules>) => setRules((prev) => ({ ...prev, ...patch }));
  const isDirty = JSON.stringify(rules) !== JSON.stringify(store.settings);

  const save = async () => {
    try {
      await updateStore({ ...store, settings: rules });
      toast.success(t('Aturan kasir disimpan'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('Gagal menyimpan aturan.'));
    }
  };

  return (
    <SettingsSection
      title={t('Aturan kasir')}
      description={t('Berlaku saat mode pemilik terkunci. Tanpa PIN pemilik, semua tindakan terbuka.')}
      footer={
        <button type="button" disabled={!isDirty} onClick={() => void save()} className={`${btnPrimary} h-11`}>
          {t('Simpan aturan')}
        </button>
      }
    >
      <div className="flex flex-col gap-5">
        <div>
          <p className={labelBase}>{t('Void (batalkan transaksi hari ini)')}</p>
          <SegmentedControl label={t('Aturan void')} options={RULE_OPTIONS} value={toChoice(rules.voidPermission)} onChange={(c) => update({ voidPermission: toLevel(c) })} />
        </div>
        <div>
          <p className={labelBase}>{t('Refund')}</p>
          <SegmentedControl label={t('Aturan refund')} options={RULE_OPTIONS} value={toChoice(rules.refundPermission)} onChange={(c) => update({ refundPermission: toLevel(c) })} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="rule-discount" className={labelBase}>{t('Batas diskon kasir (%)')}</label>
            <NumberInput id="rule-discount" isInteger max={PERCENT_MAX} value={rules.cashierMaxDiscountPct} onChange={(cashierMaxDiscountPct) => update({ cashierMaxDiscountPct })} />
            <p className={helperText}>{t('Di atas batas ini perlu PIN pemilik.')}</p>
          </div>
          <div>
            <label htmlFor="rule-refund-window" className={labelBase}>{t('Batas waktu refund (hari)')}</label>
            <NumberInput id="rule-refund-window" isInteger max={MAX_REFUND_WINDOW_DAYS} value={rules.refundWindowDays} onChange={(refundWindowDays) => update({ refundWindowDays })} />
            <p className={helperText}>{t('0 = hanya di hari yang sama.')}</p>
          </div>
        </div>
      </div>
    </SettingsSection>
  );
}
