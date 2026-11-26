import { useState } from 'react';
import toast from 'react-hot-toast';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { btnGhost, btnPrimary, fieldGrid, helperText, inputBase, labelBase } from '../../components/ui/styles';
import { normalizeReceiptPrefix, RECEIPT_PREFIX_DEFAULT, RECEIPT_PREFIX_MAX } from '../../lib/businessDate';
import { Switch } from '../../components/ui/Switch';
import { PERCENT_MAX } from '../../constants';
import { updateStore } from '../../services/bootstrap';
import type { Store } from '../../types';
import { SettingsSection } from './SettingsSection';
import { t } from '../../i18n';
import { NumberInput } from '../../components/ui/NumberInput';

type TextField = 'name' | 'address' | 'phone' | 'receiptHeader' | 'receiptFooter';

const PROFILE_FIELDS: ReadonlyArray<{ key: TextField; label: string; placeholder: string }> = [
  { key: 'name', label: t('Nama toko'), placeholder: t('Bakso Pak Budi') },
  { key: 'phone', label: t('No. HP / WhatsApp'), placeholder: t('0812xxxx') },
  { key: 'address', label: t('Alamat'), placeholder: t('Jl. Melati No. 5, Depok') },
];
const RECEIPT_FIELDS: ReadonlyArray<{ key: TextField; label: string; placeholder: string }> = [
  { key: 'receiptHeader', label: t('Teks atas struk'), placeholder: t('Buka 10.00–22.00') },
  { key: 'receiptFooter', label: t('Teks bawah struk'), placeholder: t('Terima kasih, sampai jumpa lagi') },
];
const PAPER_OPTIONS = [
  { value: '58', label: t('58 mm') },
  { value: '80', label: t('80 mm') },
] as const;


/** M14 store profile, receipt text, tax & service. */
export function StoreSettings({ store }: { store: Store }) {
  const [draft, setDraft] = useState<Store>(store);
  const update = (patch: Partial<Store>) => setDraft((prev) => ({ ...prev, ...patch }));

  const handleSave = async () => {
    if (!draft.name.trim()) {
      toast.error(t('Nama toko wajib diisi.'));
      return;
    }
    try {
      const saved = { ...draft, name: draft.name.trim() };
      await updateStore(saved);
      setDraft(saved);
      toast.success(t('Pengaturan toko disimpan'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('Gagal menyimpan.'));
    }
  };

  const textField = ({ key, label, placeholder }: { key: TextField; label: string; placeholder: string }) => (
    <div key={key}>
      <label htmlFor={`store-${key}`} className={labelBase}>{label}</label>
      <input id={`store-${key}`} value={draft[key]} placeholder={placeholder} onChange={(e) => update({ [key]: e.target.value })} className={inputBase} />
    </div>
  );

  /** updatedAt changes on every save (and on sync), so it never counts as an unsaved change. */
  const comparable = ({ updatedAt: _updatedAt, ...rest }: Store) => JSON.stringify(rest);
  const isDirty = comparable(draft) !== comparable(store);

  return (
    <>
      <SettingsSection title={t('Profil toko')} description={t('Tampil di bagian atas struk.')}>
        <div className={fieldGrid}>{PROFILE_FIELDS.map(textField)}</div>
      </SettingsSection>

      <SettingsSection title={t('Struk')} description={t('Teks tambahan dan ukuran kertas printer thermal.')}>
        <div className="grid gap-4">
          <div className={fieldGrid}>
            {RECEIPT_FIELDS.map(textField)}
            <div>
              <label htmlFor="store-receiptPrefix" className={labelBase}>{t('Awalan nomor struk')}</label>
              <input
                id="store-receiptPrefix"
                value={draft.receiptPrefix ?? ''}
                maxLength={RECEIPT_PREFIX_MAX}
                autoCapitalize="characters"
                autoComplete="off"
                placeholder={RECEIPT_PREFIX_DEFAULT}
                onChange={(e) => update({ receiptPrefix: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, RECEIPT_PREFIX_MAX) || undefined })}
                className={`${inputBase} num uppercase`}
              />
              <p className={helperText}>
                {t('Huruf/angka di depan nomor struk, maks. {0}. Contoh: {1}', RECEIPT_PREFIX_MAX, `${normalizeReceiptPrefix(draft.receiptPrefix)}-20261123-A10001`)}
              </p>
            </div>
            <div>
              <p className={labelBase}>{t('Lebar kertas')}</p>
              <SegmentedControl
                label={t('Lebar kertas')}
                options={PAPER_OPTIONS}
                value={String(draft.receiptPaperMm) as '58' | '80'}
                onChange={(mm) => update({ receiptPaperMm: mm === '80' ? 80 : 58 })}
              />
            </div>
          </div>
          <Switch
            checked={draft.settings.shouldAutoShowReceipt}
            onChange={(shouldAutoShowReceipt) => update({ settings: { ...draft.settings, shouldAutoShowReceipt } })}
            label={t('Tampilkan struk setelah bayar')}
            description={t('Matikan jika antrean ramai dan struk jarang diminta.')}
          />
        </div>
      </SettingsSection>

      <SettingsSection title={t('Pajak & service')} description={t('Isi 0 jika usaha Anda tidak memungut pajak.')}>
        <div className={fieldGrid}>
          <div>
            <label htmlFor="tax-pct" className={labelBase}>{t('Pajak PB1/PPN (%)')}</label>
            <NumberInput id="tax-pct" max={PERCENT_MAX} value={draft.taxPct} onChange={(taxPct) => update({ taxPct })} />
          </div>
          <div>
            <label htmlFor="service-pct" className={labelBase}>{t('Service (%)')}</label>
            <NumberInput id="service-pct" max={PERCENT_MAX} value={draft.servicePct} onChange={(servicePct) => update({ servicePct })} />
          </div>
          <div className="sm:col-span-2">
            <Switch checked={draft.isTaxInclusive} onChange={(isTaxInclusive) => update({ isTaxInclusive })} label={t('Harga sudah termasuk pajak')} />
          </div>
        </div>
      </SettingsSection>

      {/* The save bar shows only once something changed (Kenny): nothing to save, nothing on screen. */}
      {isDirty && (
        <div className="sticky bottom-0 -mx-4 flex animate-fade items-center justify-end gap-3 border-t border-line bg-canvas/95 px-4 py-3 backdrop-blur md:mx-0 md:rounded-lg md:border">
          <span className="mr-auto hidden text-[13px] text-muted sm:inline">{t('Ada perubahan yang belum disimpan')}</span>
          <button type="button" onClick={() => setDraft(store)} className={`${btnGhost} h-11`}>
            {t('Batal')}
          </button>
          <button type="button" onClick={() => void handleSave()} className={`${btnPrimary} h-11`}>
            {t('Simpan perubahan')}
          </button>
        </div>
      )}
    </>
  );
}
