import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { RupiahInput } from '../../components/ui/RupiahInput';
import { Sheet } from '../../components/ui/Sheet';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { btnIcon, btnPrimary, btnSecondary, inputBase, labelBase, sectionTitle } from '../../components/ui/styles';
import { Switch } from '../../components/ui/Switch';
import { uuidv7 } from '../../lib/id';
import { newMeta, saveVariantGroup } from '../../services/catalog';
import type { Id, VariantGroup, VariantOption } from '../../types';
import { t } from '../../i18n';
import { NumberInput } from '../../components/ui/NumberInput';

interface VariantGroupFormProps {
  group: VariantGroup | null;
  storeId: Id;
  onClose: () => void;
}

const SELECT_OPTIONS = [
  { value: 'single', label: t('Pilih satu') },
  { value: 'multi', label: t('Pilih beberapa') },
] as const;

const newOption = (sortOrder: number): VariantOption => ({ id: uuidv7(), name: '', priceDelta: 0, sortOrder });

const newGroup = (storeId: Id): VariantGroup => ({
  ...newMeta(storeId),
  name: '',
  isRequired: true,
  selectType: 'single',
  min: 1,
  max: 1,
  options: [newOption(0)],
});

/** M2 variant group: e.g. "Level Pedas" (single, wajib) or "Topping" (multi, maks 3, +Rp). */
export function VariantGroupForm({ group, storeId, onClose }: VariantGroupFormProps) {
  const [draft, setDraft] = useState<VariantGroup>(() => group ?? newGroup(storeId));
  const [isSaving, setIsSaving] = useState(false);

  const update = (patch: Partial<VariantGroup>) => setDraft((prev) => ({ ...prev, ...patch }));
  const updateOption = (id: Id, patch: Partial<VariantOption>) =>
    setDraft((prev) => ({ ...prev, options: prev.options.map((o) => (o.id === id ? { ...o, ...patch } : o)) }));
  const removeOption = (id: Id) =>
    setDraft((prev) => ({ ...prev, options: prev.options.filter((o) => o.id !== id) }));
  const addOption = () => setDraft((prev) => ({ ...prev, options: [...prev.options, newOption(prev.options.length)] }));

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveVariantGroup(draft);
      toast.success(t('{0} disimpan', draft.name.trim()));
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('Gagal menyimpan add-on.'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Sheet
      title={group ? t('Ubah grup add-on') : t('Grup add-on baru')}
      isOpen
      onClose={onClose}
      footer={
        <button type="button" disabled={isSaving} onClick={() => void handleSave()} className={`${btnPrimary} w-full`}>
          {t('Simpan add-on')}
        </button>
      }
    >
      <div className="flex flex-col gap-5">
        <div>
          <label htmlFor="group-name" className={labelBase}>{t('Nama grup')}</label>
          <input id="group-name" value={draft.name} onChange={(e) => update({ name: e.target.value })} placeholder={t('Contoh: Es, Gula, Ukuran, Topping')} className={inputBase} />
        </div>

        <div>
          <p className={labelBase}>{t('Cara memilih')}</p>
          <SegmentedControl
            label={t('Cara memilih')}
            isFullWidth
            options={SELECT_OPTIONS}
            value={draft.selectType}
            onChange={(selectType) => update({ selectType, max: selectType === 'single' ? 1 : Math.max(draft.max, 2) })}
          />
        </div>

        {draft.selectType === 'multi' && (
          <div>
            <label htmlFor="group-max" className={labelBase}>{t('Maksimal pilihan')}</label>
            <NumberInput id="group-max" isInteger min={1} max={99} value={draft.max} onChange={(max) => update({ max })} />
          </div>
        )}

        <Switch checked={draft.isRequired} onChange={(isRequired) => update({ isRequired })} label={t('Wajib dipilih')} description={t('Kasir tidak bisa menambah item sebelum memilih.')} />

        <fieldset className="border-t border-line pt-4">
          <legend className={`${sectionTitle} mb-2.5`}>{t('Pilihan & tambahan harga')}</legend>
          <ul className="flex flex-col gap-2">
            {draft.options.map((option) => (
              <li key={option.id} className="grid grid-cols-[1fr_8.5rem_auto] gap-2">
                <input aria-label={t('Nama pilihan')} value={option.name} onChange={(e) => updateOption(option.id, { name: e.target.value })} placeholder={t('Nama pilihan')} className={inputBase} />
                <RupiahInput ariaLabel={t('Tambahan harga {0}', option.name)} value={option.priceDelta} onChange={(v) => updateOption(option.id, { priceDelta: v ?? 0 })} />
                <button type="button" aria-label={t('Hapus {0}', option.name || 'pilihan')} disabled={draft.options.length === 1} onClick={() => removeOption(option.id)} className={`${btnIcon} h-12 w-12`}>
                  <Trash2 aria-hidden size={18} />
                </button>
              </li>
            ))}
          </ul>
          <button type="button" onClick={addOption} className={`${btnSecondary} mt-2 h-11 w-full border-dashed`}>
            <Plus aria-hidden size={18} /> {t('Tambah pilihan')}
          </button>
        </fieldset>
      </div>
    </Sheet>
  );
}
