import { MoreHorizontal, Plus, QrCode, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { btnIcon, btnSecondary, card, helperText, inputBase, labelBase } from '../../components/ui/styles';
import { Switch } from '../../components/ui/Switch';
import { compressQrisImage } from '../../lib/image';
import { savePaymentMethod } from '../../services/catalog';
import { MAX_PAYMENT_METHODS, PAYMENT_TYPE_LABEL } from '../../constants';
import type { Id, PaymentMethod, ReferenceMode } from '../../types';
import { AddMethodSheet } from './AddMethodSheet';
import { ConfigItemSheet } from './ConfigItemSheet';
import { METHOD_ICON } from '../../components/ui/paymentIcon';
import { t } from '../../i18n';

const REFERENCE_OPTIONS: ReadonlyArray<{ value: ReferenceMode; label: string }> = [
  { value: 'off', label: t('Tidak ada') },
  { value: 'optional', label: t('Opsional') },
  { value: 'required', label: t('Wajib') },
];

async function persist(method: PaymentMethod): Promise<void> {
  try {
    await savePaymentMethod(method);
  } catch (error) {
    toast.error(error instanceof Error ? error.message : t('Gagal menyimpan metode.'));
  }
}

/** M5: add, rename, reorder and delete methods; configure the reference field and the static QRIS image. */
export function PaymentMethodSettings({ storeId, methods }: { storeId: Id; methods: PaymentMethod[] }) {
  const [isAdding, setIsAdding] = useState(false);
  const [managingId, setManagingId] = useState<Id | null>(null);
  const managingIndex = methods.findIndex((m) => m.id === managingId);
  const managing = methods[managingIndex];
  const isFull = methods.length >= MAX_PAYMENT_METHODS;
  const activeCount = methods.filter((m) => m.isActive).length;

  return (
    <div className="grid items-start gap-4 @4xl/settings:grid-cols-2">
      <div className="col-span-full flex items-center gap-3">
        <p className="min-w-0 flex-1 text-[14px] text-muted">
          {isFull ? t('Sudah {0} metode (batas maksimal).', MAX_PAYMENT_METHODS) : t('Urutan di sini sama dengan urutan di layar pembayaran.')}
        </p>
        <button type="button" disabled={isFull} onClick={() => setIsAdding(true)} className={`${btnSecondary} h-11 shrink-0 text-[14px]`}>
          <Plus aria-hidden size={17} /> {t('Tambah metode')}
        </button>
      </div>
      {methods.map((method) => (
        <PaymentMethodCard key={method.id} method={method} isLastActive={method.isActive && activeCount === 1} onManage={() => setManagingId(method.id)} />
      ))}

      {isAdding && <AddMethodSheet storeId={storeId} onClose={() => setIsAdding(false)} />}
      {managing && (
        <ConfigItemSheet
          key={managing.id}
          table="paymentMethods"
          noun="metode"
          item={managing}
          index={managingIndex}
          count={methods.length}
          deleteBlockedReason={managing.isActive && activeCount === 1 ? t('Ini satu-satunya metode aktif, jadi tidak bisa dihapus. Aktifkan metode lain dulu.') : null}
          onClose={() => setManagingId(null)}
        />
      )}
    </div>
  );
}

function PaymentMethodCard({ method, isLastActive, onManage }: { method: PaymentMethod; isLastActive: boolean; onManage: () => void }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const Icon = METHOD_ICON[method.type];
  const isCash = method.type === 'cash';

  const handleQris = async (file: File | undefined) => {
    if (!file) return;
    const result = await compressQrisImage(file);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    await persist({ ...method, qrisImageUrl: result.value });
    toast.success(t('Gambar QRIS disimpan'));
  };

  return (
    <section className={`${card} overflow-hidden ${method.isActive ? '' : 'bg-subtle'}`}>
      <div className="flex items-center gap-3 px-5 py-2">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-line bg-surface text-ink-soft">
          <Icon aria-hidden size={20} />
        </span>
        <div className="flex-1">
          <Switch
            checked={method.isActive}
            disabled={isLastActive}
            onChange={(isActive) => void persist({ ...method, isActive })}
            label={method.name}
            description={`${PAYMENT_TYPE_LABEL[method.type]} · ${isLastActive ? t('Satu-satunya metode aktif') : method.isActive ? t('Tampil di pembayaran') : t('Disembunyikan')}`}
          />
        </div>
        <button type="button" aria-label={t('Kelola {0}', method.name)} onClick={onManage} className={`${btnIcon} border-transparent! bg-transparent!`}>
          <MoreHorizontal aria-hidden size={20} />
        </button>
      </div>

      {method.isActive && !isCash && (
        <div className="flex flex-col gap-4 border-t border-line px-5 py-4">
          <div>
            <p className={labelBase}>{t('Nomor referensi')}</p>
            <SegmentedControl label={t('Referensi {0}', method.name)} options={REFERENCE_OPTIONS} value={method.referenceMode} onChange={(referenceMode) => void persist({ ...method, referenceMode })} />
            <p className={helperText}>{t('Untuk mencocokkan dengan mutasi bank / aplikasi merchant.')}</p>
          </div>
          {method.referenceMode !== 'off' && (
            <div className="max-w-sm">
              <label htmlFor={`ref-${method.id}`} className={labelBase}>{t('Label kolom referensi')}</label>
              <input
                id={`ref-${method.id}`}
                defaultValue={method.referenceLabel}
                placeholder={t('No. Ref / 4 digit terakhir')}
                onBlur={(e) => e.target.value !== method.referenceLabel && void persist({ ...method, referenceLabel: e.target.value.trim() })}
                className={inputBase}
              />
            </div>
          )}

          {method.type === 'qris' && (
            <div>
              <p className={labelBase}>{t('QRIS statis')}</p>
              <div className="flex items-center gap-4">
                {method.qrisImageUrl ? (
                  <img src={method.qrisImageUrl} alt={t('QRIS statis')} className="h-28 w-28 rounded-lg border border-line bg-surface object-contain p-1" />
                ) : (
                  <div className="flex h-28 w-28 items-center justify-center rounded-lg border border-dashed border-line-strong bg-subtle text-faint">
                    <QrCode aria-hidden size={32} />
                  </div>
                )}
                <div className="flex flex-col gap-1.5">
                  <input ref={fileInput} type="file" accept="image/*" hidden onChange={(e) => void handleQris(e.target.files?.[0])} />
                  <button type="button" onClick={() => fileInput.current?.click()} className={`${btnSecondary} h-11 text-[14px]`}>
                    <Upload aria-hidden size={17} /> {method.qrisImageUrl ? t('Ganti gambar') : t('Unggah QRIS')}
                  </button>
                  <p className="max-w-[220px] text-[12px] text-muted">{t('Screenshot QRIS dari bank atau aplikasi merchant Anda.')}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
