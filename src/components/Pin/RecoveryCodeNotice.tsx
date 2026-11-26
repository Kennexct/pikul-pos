import { KeyRound } from 'lucide-react';
import { btnPrimary } from '../ui/styles';
import { t } from '../../i18n';

interface RecoveryCodeNoticeProps {
  code: string;
  onDone: () => void;
}

/** Shown exactly once after the owner PIN is set or recovered — the code is not stored in readable form. */
export function RecoveryCodeNotice({ code, onDone }: RecoveryCodeNoticeProps) {
  return (
    <div className="rounded-lg border border-warn-200 bg-warn-50 p-4">
      <p className="flex items-center gap-2 text-[14px] font-semibold text-warn-700">
        <KeyRound aria-hidden size={18} /> {t('Catat kode pemulihan ini')}
      </p>
      <p className="mt-1 text-[13px] text-ink-soft">
        {t('Hanya ditampilkan sekali. Kode ini satu-satunya cara mengatur ulang PIN pemilik jika lupa.')}
      </p>
      <p data-testid="recovery-code" className="my-3 select-all rounded-md bg-surface py-3 text-center font-mono text-[24px] font-semibold tracking-[0.15em] text-ink ring-1 ring-warn-200">
        {code}
      </p>
      <button type="button" onClick={onDone} className={`${btnPrimary} w-full`}>
        {t('Sudah saya catat')}
      </button>
    </div>
  );
}
