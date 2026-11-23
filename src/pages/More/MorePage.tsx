import { ChevronRight, Lock, LockOpen, Repeat } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '../../components/Brand/Logo';
import { NAV_ITEMS } from '../../components/Layout/navItems';
import { PageHeader } from '../../components/Layout/PageHeader';
import { SyncBadge } from '../../components/Layout/SyncBadge';
import { AccountSheet } from '../../components/Pin/AccountSheet';
import { initialsOf } from '../../components/Pin/SellerSwitcher';
import { btnSecondary, card } from '../../components/ui/styles';
import { useOwnerAccess } from '../../hooks/useOwnerAccess';
import { useSessionStore } from '../../store/useSessionStore';
import { t } from '../../i18n';

/** Phone-only "Akun" tab: the seller, sync, owner-mode lock, Pengaturan and Bantuan. */
export function MorePage() {
  const cashier = useSessionStore((s) => s.cashier);
  const hasOwnerPin = useSessionStore((s) => s.hasOwnerPin);
  const lockOwner = useSessionStore((s) => s.lockOwner);
  const access = useOwnerAccess();
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const items = [NAV_ITEMS.settings, NAV_ITEMS.help];

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <PageHeader title={t('Akun')} />
      <div className="flex flex-col gap-4 p-4">
        <div className={`${card} p-4`}>
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ink text-[13px] font-bold text-white">
              {initialsOf(cashier?.displayName ?? '')}
            </span>
            <div className="flex-1">
              <p className="text-[15px] font-semibold">{cashier?.displayName}</p>
              <p className="text-[13px] text-muted">{cashier?.role === 'owner' ? t('Pemilik') : t('Kasir::orang')}</p>
            </div>
            <SyncBadge variant="inline" />
          </div>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => setIsAccountOpen(true)} className={`${btnSecondary} h-11 flex-1 text-[14px]`}>
              <Repeat aria-hidden size={16} /> {hasOwnerPin ? t('Ganti kasir') : t('Akun')}
            </button>
            {access.kind === 'unlocked' && (
              <button type="button" onClick={lockOwner} className={`${btnSecondary} h-11 text-[14px]`}>
                <LockOpen aria-hidden size={16} /> {t('Kunci')}
              </button>
            )}
          </div>
        </div>

        <ul className={`${card} divide-y divide-line`}>
          {items.map((item) => {
            const { to, label, icon: Icon } = item;
            return (
            <li key={to}>
              <Link to={to} viewTransition className="flex min-h-14 items-center gap-3 px-4 text-[15px] font-medium hover:bg-subtle">
                <Icon aria-hidden size={20} className="text-muted" />
                <span className="flex-1">{label}</span>
                {access.kind === 'locked' && 'isOwnerOnly' in item && <Lock aria-label={t('terkunci, butuh PIN pemilik')} size={15} className="text-faint" />}
                <ChevronRight aria-hidden size={18} className="text-faint" />
              </Link>
            </li>
            );
          })}
        </ul>

        <div className="mt-4 flex justify-center opacity-70">
          <Logo size={24} />
        </div>
      </div>

      {isAccountOpen && <AccountSheet onClose={() => setIsAccountOpen(false)} />}
    </section>
  );
}
