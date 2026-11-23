import { MoreHorizontal, Plus, Star } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { badgeBrand, btnGhost, btnIcon, btnSecondary, card, helperText, labelBase } from '../../components/ui/styles';
import { Switch } from '../../components/ui/Switch';
import { saveSalesMode } from '../../services/catalog';
import { MAX_SALES_MODES } from '../../constants';
import type { Id, SalesMode } from '../../types';
import { AddModeSheet } from './AddModeSheet';
import { ConfigItemSheet } from './ConfigItemSheet';
import { PRICE_RULE_HELP, PRICE_RULE_OPTIONS } from './priceRules';
import { t } from '../../i18n';
import { NumberInput } from '../../components/ui/NumberInput';

async function persist(mode: SalesMode): Promise<void> {
  try {
    await saveSalesMode(mode);
  } catch (error) {
    toast.error(error instanceof Error ? error.message : t('Gagal menyimpan mode.'));
  }
}

/** M4: add, rename, reorder and delete modes; pick the default and decide how each mode is priced. */
export function SalesModeSettings({ storeId, modes }: { storeId: Id; modes: SalesMode[] }) {
  const [isAdding, setIsAdding] = useState(false);
  const [managingId, setManagingId] = useState<Id | null>(null);
  const managingIndex = modes.findIndex((m) => m.id === managingId);
  const managing = modes[managingIndex];
  const isFull = modes.length >= MAX_SALES_MODES;

  const setDefault = async (target: SalesMode) => {
    for (const mode of modes) {
      const isDefault = mode.id === target.id;
      if (mode.isDefault !== isDefault) await persist({ ...mode, isDefault, isActive: isDefault || mode.isActive });
    }
  };

  return (
    <div className="grid items-start gap-4 @4xl/settings:grid-cols-2">
      <div className="col-span-full flex items-center gap-3">
        <p className="min-w-0 flex-1 text-[14px] text-muted">
          {isFull ? t('Sudah {0} mode (batas maksimal).', MAX_SALES_MODES) : t('Urutan di sini sama dengan urutan di kasir.')}
        </p>
        <button type="button" disabled={isFull} onClick={() => setIsAdding(true)} className={`${btnSecondary} h-11 shrink-0 text-[14px]`}>
          <Plus aria-hidden size={17} /> {t('Tambah mode')}
        </button>
      </div>
      {modes.map((mode) => (
        <section key={mode.id} className={`${card} overflow-hidden ${mode.isActive ? '' : 'bg-subtle'}`}>
          <div className="flex items-center gap-3 px-5 py-2">
            <div className="flex-1">
              <Switch
                checked={mode.isActive}
                disabled={mode.isDefault}
                onChange={(isActive) => void persist({ ...mode, isActive })}
                label={mode.name}
                description={mode.isDefault ? t('Mode default saat kasir dibuka') : mode.isActive ? t('Tampil di kasir') : t('Disembunyikan')}
              />
            </div>
            {mode.isDefault ? (
              <span className={badgeBrand}>{t('Default')}</span>
            ) : (
              <button type="button" aria-label={t('Jadikan {0} default', mode.name)} onClick={() => void setDefault(mode)} className={`${btnGhost} text-[13px]`}>
                <Star aria-hidden size={15} /> <span className="hidden sm:inline">{t('Jadikan default')}</span>
              </button>
            )}
            <button type="button" aria-label={t('Kelola {0}', mode.name)} onClick={() => setManagingId(mode.id)} className={`${btnIcon} border-transparent! bg-transparent!`}>
              <MoreHorizontal aria-hidden size={20} />
            </button>
          </div>
          {mode.isActive && (
            <div className="border-t border-line px-5 py-4">
              <p className={labelBase}>{t('Aturan harga')}</p>
              <SegmentedControl label={t('Aturan harga {0}', mode.name)} options={PRICE_RULE_OPTIONS} value={mode.priceRule} onChange={(priceRule) => void persist({ ...mode, priceRule })} />
              <p className={helperText}>{PRICE_RULE_HELP[mode.priceRule]}</p>
              {mode.priceRule === 'markup' && (
                <div className="mt-3 max-w-[180px]">
                  <label htmlFor={`markup-${mode.id}`} className={labelBase}>{t('Markup (%)')}</label>
                  <NumberInput
                    id={`markup-${mode.id}`}
                    max={100}
                    value={mode.markupPct}
                    onChange={() => undefined}
                    onCommit={(markupPct) => {
                      if (markupPct !== mode.markupPct) void persist({ ...mode, markupPct });
                    }}
                  />
                </div>
              )}
            </div>
          )}
        </section>
      ))}

      {isAdding && <AddModeSheet storeId={storeId} onClose={() => setIsAdding(false)} />}
      {managing && (
        <ConfigItemSheet
          key={managing.id}
          table="salesModes"
          noun="mode"
          item={managing}
          index={managingIndex}
          count={modes.length}
          deleteBlockedReason={managing.isDefault ? t('Mode default tidak bisa dihapus. Jadikan mode lain sebagai default dulu.') : null}
          onClose={() => setManagingId(null)}
        />
      )}
    </div>
  );
}
