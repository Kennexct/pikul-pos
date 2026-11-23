import { KeyRound, UserMinus, UserPlus, Users } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { PinInput } from '../../../components/Pin/PinInput';
import { initialsOf } from '../../../components/Pin/SellerSwitcher';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Sheet } from '../../../components/ui/Sheet';
import { btnDangerSolid, btnGhost, btnPrimary, btnSecondary, fieldGrid, inputBase, labelBase } from '../../../components/ui/styles';
import { MEMBER_NAME_MAX } from '../../../constants';
import { useStaff } from '../../../hooks/useStaff';
import { isValidPin } from '../../../lib/pin';
import { addCashier, deactivateCashier, getOwner, resetCashierPin } from '../../../services/staff';
import { useSessionStore } from '../../../store/useSessionStore';
import type { Id, StoreMember } from '../../../types';
import { SettingsSection } from '../SettingsSection';
import { t } from '../../../i18n';

type Dialog = { kind: 'reset' | 'deactivate'; member: StoreMember } | null;
const message = (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback);

/** Add cashiers, reset their PIN, or deactivate them (name stays in history). */
export function CashierSection({ storeId }: { storeId: Id }) {
  const hasOwnerPin = useSessionStore((s) => s.hasOwnerPin);
  const activeSellerId = useSessionStore((s) => s.cashier?.memberId);
  const signInCashier = useSessionStore((s) => s.signInCashier);
  const unlockOwner = useSessionStore((s) => s.unlockOwner);
  const cashiers = useStaff(storeId)?.filter((m) => m.role === 'cashier') ?? [];
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [resetPin, setResetPin] = useState('');
  const [dialog, setDialog] = useState<Dialog>(null);
  const [isBusy, setIsBusy] = useState(false);

  const run = async (task: () => Promise<void>, success: string, fallback: string) => {
    setIsBusy(true);
    try {
      await task();
      toast.success(success);
      setDialog(null);
      setResetPin('');
    } catch (error) {
      toast.error(message(error, fallback));
    } finally {
      setIsBusy(false);
    }
  };

  const handleAdd = () =>
    run(
      async () => {
        await addCashier(storeId, name, pin);
        setName('');
        setPin('');
      },
      t('{0} ditambahkan', name.trim()),
      t('Gagal menambah kasir.'),
    );

  const handleDeactivate = (member: StoreMember) =>
    run(
      async () => {
        await deactivateCashier(member.id);
        if (member.id !== activeSellerId) return;
        // The seller who was signed in no longer exists: hand the device back to the owner, still in owner mode.
        const owner = await getOwner(storeId);
        signInCashier({ memberId: owner.id, displayName: owner.displayName, role: owner.role });
        unlockOwner();
      },
      t('{0} dinonaktifkan', member.displayName),
      t('Gagal menonaktifkan kasir.'),
    );

  return (
    <SettingsSection title={t('Kasir::orang')} description={t('Setiap kasir punya PIN sendiri, sehingga penjualan tercatat atas namanya.')}>
      {!hasOwnerPin ? (
        <p className="text-[14px] text-muted">{t('Atur PIN pemilik dulu untuk menambah kasir.')}</p>
      ) : (
        <div className="flex flex-col gap-4">
          {cashiers.length === 0 ? (
            <EmptyState icon={Users} title={t('Belum ada kasir')} description={t('Tambahkan kasir pertama di bawah ini.')} />
          ) : (
            <ul className="divide-y divide-line rounded-lg border border-line">
              {cashiers.map((member) => (
                <li key={member.id} className="flex flex-wrap items-center gap-3 px-3.5 py-2.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink text-[12px] font-bold text-white">{initialsOf(member.displayName)}</span>
                  <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{member.displayName}</span>
                  <button type="button" onClick={() => setDialog({ kind: 'reset', member })} className={`${btnGhost} text-[14px]`}>
                    <KeyRound aria-hidden size={16} /> {t('Reset PIN')}
                  </button>
                  <button type="button" aria-label={t('Nonaktifkan {0}', member.displayName)} onClick={() => setDialog({ kind: 'deactivate', member })} className={`${btnGhost} text-[14px] text-danger-700!`}>
                    <UserMinus aria-hidden size={16} /> {t('Nonaktifkan')}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <fieldset className={`${fieldGrid} items-end rounded-lg border border-dashed border-line-strong p-4`}>
            <legend className="px-1 text-[13px] font-semibold text-ink-soft">{t('Tambah kasir')}</legend>
            <div>
              <label htmlFor="cashier-name" className={labelBase}>{t('Nama')}</label>
              <input id="cashier-name" value={name} maxLength={MEMBER_NAME_MAX} placeholder={t('Contoh: Dika')} onChange={(e) => setName(e.target.value)} className={inputBase} />
            </div>
            <div>
              <label htmlFor="cashier-pin" className={labelBase}>{t('PIN kasir')}</label>
              <PinInput id="cashier-pin" value={pin} onChange={setPin} />
            </div>
            <button type="button" disabled={isBusy || name.trim() === '' || !isValidPin(pin)} onClick={() => void handleAdd()} className={`${btnPrimary} justify-self-start`}>
              <UserPlus aria-hidden size={18} /> {t('Tambah')}
            </button>
          </fieldset>
        </div>
      )}

      {dialog?.kind === 'reset' && (
        <Sheet
          title={t('Reset PIN kasir')}
          subtitle={dialog.member.displayName}
          isOpen
          onClose={() => setDialog(null)}
          footer={
            <button type="button" disabled={isBusy || !isValidPin(resetPin)} onClick={() => void run(() => resetCashierPin(dialog.member.id, resetPin), t('PIN kasir diganti'), t('Gagal mengganti PIN.'))} className={`${btnPrimary} w-full`}>
              {t('Simpan PIN baru')}
            </button>
          }
        >
          <label htmlFor="cashier-reset-pin" className={labelBase}>{t('PIN baru (4–6 angka)')}</label>
          <PinInput id="cashier-reset-pin" value={resetPin} onChange={setResetPin} />
        </Sheet>
      )}

      {dialog?.kind === 'deactivate' && (
        <Sheet
          title={t('Nonaktifkan {0}?', dialog.member.displayName)}
          isOpen
          onClose={() => setDialog(null)}
          footer={
            <div className="flex gap-2">
              <button type="button" onClick={() => setDialog(null)} className={btnSecondary}>{t('Batal')}</button>
              <button type="button" disabled={isBusy} onClick={() => void handleDeactivate(dialog.member)} className={`${btnDangerSolid} flex-1`}>
                {t('Nonaktifkan')}
              </button>
            </div>
          }
        >
          <p className="text-[14px] text-ink-soft">{t('Kasir ini tidak bisa masuk lagi. Namanya tetap tampil di riwayat dan laporan penjualan yang sudah ada.')}</p>
        </Sheet>
      )}
    </SettingsSection>
  );
}
