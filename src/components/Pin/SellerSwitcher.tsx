import { ArrowLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { useStaff } from '../../hooks/useStaff';
import { verifyMemberPin } from '../../services/staff';
import { useSessionStore } from '../../store/useSessionStore';
import type { StoreMember } from '../../types';
import { btnGhost } from '../ui/styles';
import { PinPad } from './PinPad';
import { t } from '../../i18n';

const ROLE_LABEL = { owner: t('Pemilik'), cashier: t('Kasir::orang') } as const;
export const initialsOf = (name: string): string => name.trim().slice(0, 2).toUpperCase() || '?';

/** Pick a member, then enter that member's PIN. Used by the lock screen and the account sheet. */
export function SellerSwitcher({ onDone }: { onDone: () => void }) {
  const storeId = useSessionStore((s) => s.storeId);
  const activeId = useSessionStore((s) => s.cashier?.memberId);
  const signInCashier = useSessionStore((s) => s.signInCashier);
  const members = useStaff(storeId);
  const [selected, setSelected] = useState<StoreMember | null>(null);

  if (selected) {
    return (
      <div className="flex flex-col items-center gap-1">
        <p className="text-[15px] font-semibold">{selected.displayName}</p>
        <p className="mb-2 text-[13px] text-muted">{ROLE_LABEL[selected.role]}</p>
        <PinPad
          label={t('PIN {0}', selected.displayName)}
          verify={(pin) => verifyMemberPin(selected.id, pin)}
          onSuccess={() => {
            signInCashier({ memberId: selected.id, displayName: selected.displayName, role: selected.role });
            onDone();
          }}
        />
        <button type="button" onClick={() => setSelected(null)} className={`${btnGhost} text-[14px]`}>
          <ArrowLeft aria-hidden size={16} /> {t('Pilih nama lain')}
        </button>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
      {members?.map((member) => (
        <li key={member.id}>
          <button type="button" onClick={() => setSelected(member)} className="flex min-h-16 w-full items-center gap-3 px-4 text-left hover:bg-subtle">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink text-[13px] font-semibold text-white">{initialsOf(member.displayName)}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-semibold">{member.displayName}</span>
              <span className="block text-[13px] text-muted">
                {ROLE_LABEL[member.role]}
                {member.id === activeId ? t(' · sedang berjualan') : ''}
              </span>
            </span>
            <ChevronRight aria-hidden size={18} className="text-faint" />
          </button>
        </li>
      ))}
    </ul>
  );
}
