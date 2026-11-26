import { Lock } from 'lucide-react';
import type { ReactNode } from 'react';
import { useOwnerAccess } from '../../hooks/useOwnerAccess';
import { useSessionStore } from '../../store/useSessionStore';
import { OwnerPinForm } from '../Pin/OwnerPinForm';
import { t } from '../../i18n';

/**
 * Wraps owner-only routes (ADR-004). Locked → PIN pad in place of the page.
 * Unlocked → every interaction inside slides the 5-minute time box.
 */
export function OwnerGate({ children }: { children: ReactNode }) {
  const access = useOwnerAccess();
  const unlockOwner = useSessionStore((s) => s.unlockOwner);
  const touchOwner = useSessionStore((s) => s.touchOwner);

  if (access.kind === 'locked') {
    return (
      <section aria-label={t('Layar terkunci')} className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-4 py-8">
        <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-line bg-surface text-muted shadow-xs">
          <Lock aria-hidden size={22} />
        </span>
        <h1 className="text-[20px] font-semibold tracking-[-0.02em]">{t('Khusus pemilik')}</h1>
        <p className="mb-5 mt-1 text-center text-[14px] text-muted">{t('Masukkan PIN pemilik untuk membuka layar ini.')}</p>
        <div className="w-full max-w-sm">
          <OwnerPinForm onVerified={() => unlockOwner()} />
        </div>
      </section>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col" onPointerDown={() => touchOwner()} onKeyDown={() => touchOwner()}>
      {children}
    </div>
  );
}
