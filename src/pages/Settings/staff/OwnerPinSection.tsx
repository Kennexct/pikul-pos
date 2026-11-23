import { useState } from 'react';
import toast from 'react-hot-toast';
import { PinInput } from '../../../components/Pin/PinInput';
import { RecoveryCodeNotice } from '../../../components/Pin/RecoveryCodeNotice';
import { badgeBrand, badgeNeutral, btnPrimary, fieldGrid, helperText, labelBase } from '../../../components/ui/styles';
import { isValidPin } from '../../../lib/pin';
import { setOwnerPin } from '../../../services/staff';
import { useSessionStore } from '../../../store/useSessionStore';
import type { Id } from '../../../types';
import { SettingsSection } from '../SettingsSection';
import { t } from '../../../i18n';

/** Set or change the owner PIN. The first time, a recovery code is shown once. */
export function OwnerPinSection({ storeId }: { storeId: Id }) {
  const ownerId = useSessionStore((s) => s.ownerId);
  const hasOwnerPin = useSessionStore((s) => s.hasOwnerPin);
  const setOwnerInfo = useSessionStore((s) => s.setOwnerInfo);
  const unlockOwner = useSessionStore((s) => s.unlockOwner);
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const isMismatch = confirmPin !== '' && confirmPin !== newPin;
  const canSubmit = !isBusy && isValidPin(newPin) && confirmPin === newPin && (!hasOwnerPin || currentPin !== '');

  const submit = async () => {
    if (!ownerId) return;
    setIsBusy(true);
    try {
      const result = await setOwnerPin(storeId, newPin, hasOwnerPin ? currentPin : undefined);
      setOwnerInfo(ownerId, true);
      unlockOwner(); // the owner just proved who they are — don't lock them out of this screen
      setRecoveryCode(result.recoveryCode);
      setCurrentPin('');
      setNewPin('');
      setConfirmPin('');
      toast.success(hasOwnerPin ? t('PIN pemilik diganti') : t('PIN pemilik aktif'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('Gagal menyimpan PIN.'));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <SettingsSection
      title={t('PIN pemilik')}
      description={t('Mengunci Laporan, Produk dan Pengaturan, serta dipakai untuk menyetujui void, refund dan diskon besar.')}
    >
      {recoveryCode ? (
        <RecoveryCodeNotice code={recoveryCode} onDone={() => setRecoveryCode(null)} />
      ) : (
        <div className="flex flex-col gap-4">
          <p>
            <span className={hasOwnerPin ? badgeBrand : badgeNeutral}>{hasOwnerPin ? t('PIN aktif') : t('Belum diatur')}</span>
          </p>
          <div className={fieldGrid}>
            {hasOwnerPin && (
              <div>
                <label htmlFor="owner-pin-current" className={labelBase}>{t('PIN saat ini')}</label>
                <PinInput id="owner-pin-current" value={currentPin} onChange={setCurrentPin} />
              </div>
            )}
            <div>
              <label htmlFor="owner-pin-new" className={labelBase}>{hasOwnerPin ? t('PIN baru') : t('PIN (4–6 angka)')}</label>
              <PinInput id="owner-pin-new" value={newPin} onChange={setNewPin} />
            </div>
            <div>
              <label htmlFor="owner-pin-confirm" className={labelBase}>{t('Ulangi PIN')}</label>
              <PinInput id="owner-pin-confirm" value={confirmPin} onChange={setConfirmPin} />
              {isMismatch && <p role="alert" className="mt-1.5 text-[13px] text-danger-700">{t('PIN tidak sama.')}</p>}
            </div>
          </div>
          <p className={helperText}>
            {t('PIN mencegah penyalahgunaan di kasir dan mencatat siapa yang menyetujui. Jangan pakai tanggal lahir atau 1234.')}
          </p>
          <div>
            <button type="button" disabled={!canSubmit} onClick={() => void submit()} className={`${btnPrimary} h-11`}>
              {hasOwnerPin ? t('Ganti PIN') : t('Aktifkan PIN')}
            </button>
          </div>
        </div>
      )}
    </SettingsSection>
  );
}
