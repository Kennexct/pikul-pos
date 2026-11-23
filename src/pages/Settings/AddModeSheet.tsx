import { useState } from 'react';
import toast from 'react-hot-toast';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { Sheet } from '../../components/ui/Sheet';
import { btnPrimary, helperText, inputBase, labelBase } from '../../components/ui/styles';
import { CONFIG_NAME_MAX } from '../../constants';
import { createSalesMode } from '../../services/checkoutConfig';
import type { Id, PriceRule } from '../../types';
import { PRICE_RULE_HELP, PRICE_RULE_OPTIONS } from './priceRules';
import { t } from '../../i18n';
import { NumberInput } from '../../components/ui/NumberInput';

const DEFAULT_MARKUP_PCT = 20;

export function AddModeSheet({ storeId, onClose }: { storeId: Id; onClose: () => void }) {
  const [name, setName] = useState('');
  const [priceRule, setPriceRule] = useState<PriceRule>('none');
  const [markupPct, setMarkupPct] = useState(DEFAULT_MARKUP_PCT);
  const [isSaving, setIsSaving] = useState(false);

  const submit = async () => {
    setIsSaving(true);
    try {
      const mode = await createSalesMode(storeId, { name, priceRule, markupPct });
      toast.success(t('{0} ditambahkan', mode.name));
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('Gagal menambah mode.'));
      setIsSaving(false);
    }
  };

  return (
    <Sheet
      title={t('Tambah mode penjualan')}
      isOpen
      onClose={onClose}
      footer={
        <button type="button" disabled={isSaving || name.trim() === ''} onClick={() => void submit()} className={`${btnPrimary} w-full`}>
          {t('Tambah mode')}
        </button>
      }
    >
      <div className="flex flex-col gap-5">
        <div>
          <label htmlFor="mode-name" className={labelBase}>{t('Nama mode')}</label>
          <input id="mode-name" autoFocus value={name} maxLength={CONFIG_NAME_MAX} placeholder={t('mis. ShopeeFood, Pesan antar')} onChange={(e) => setName(e.target.value)} className={inputBase} />
        </div>
        <div>
          <p className={labelBase}>{t('Aturan harga')}</p>
          <SegmentedControl label={t('Aturan harga mode baru')} options={PRICE_RULE_OPTIONS} value={priceRule} onChange={setPriceRule} isFullWidth />
          <p className={helperText}>{PRICE_RULE_HELP[priceRule]}</p>
        </div>
        {priceRule === 'markup' && (
          <div>
            <label htmlFor="mode-markup" className={labelBase}>{t('Markup (%)')}</label>
            <NumberInput id="mode-markup" max={100} value={markupPct} onChange={setMarkupPct} />
          </div>
        )}
      </div>
    </Sheet>
  );
}
