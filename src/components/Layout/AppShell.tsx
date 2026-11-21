import { Lock, LockOpen, MoreHorizontal } from 'lucide-react';
import { SubscriptionBanner } from '../Access/SubscriptionBanner';
import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { ROUTES } from '../../constants';
import { useOpenOrderCount } from '../../hooks/useOpenOrderCount';
import { useOwnerAccess, useOwnerAutoLock } from '../../hooks/useOwnerAccess';
import { useSessionStore } from '../../store/useSessionStore';
import { LogoMark } from '../Brand/Logo';
import { AccountSheet } from '../Pin/AccountSheet';
import { initialsOf } from '../Pin/SellerSwitcher';
import { NAV_ITEMS, type NavItem } from './navItems';
import { SyncBadge } from './SyncBadge';
import { t } from '../../i18n';

function CountBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span
      aria-label={t('{0} pesanan belum dibayar', count)}
      className="num absolute right-2 top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-danger-600 px-1 text-[11px] font-bold text-white ring-2 ring-surface"
    >
      {count}
    </span>
  );
}

function LockMark({ isShown }: { isShown: boolean }) {
  if (!isShown) return null;
  return (
    <span aria-label={t('terkunci, butuh PIN pemilik')} className="absolute right-2 top-1.5 text-faint">
      <Lock aria-hidden size={12} strokeWidth={2.5} />
    </span>
  );
}

/** Tablet rail item: icon over label, 3px indicator bar on the active item. */
function RailLink({ item, badge, isLocked }: { item: NavItem; badge: number; isLocked: boolean }) {
  const { to, label, icon: Icon } = item;
  return (
    <NavLink
      to={to}
      end={to === ROUTES.pos}
      viewTransition
      className={({ isActive }) =>
        `group relative flex h-[60px] flex-col items-center justify-center gap-1 rounded-lg text-[11px] font-semibold transition-colors ${
          isActive ? 'bg-brand-50 text-brand-700' : 'text-muted hover:bg-subtle hover:text-ink'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <span aria-hidden className={`absolute -left-3 top-3 bottom-3 w-[3px] rounded-r-full ${isActive ? 'bg-brand-600' : 'bg-transparent'}`} />
          <Icon aria-hidden size={22} />
          {label}
          <CountBadge count={badge} />
          <LockMark isShown={isLocked} />
        </>
      )}
    </NavLink>
  );
}

/** Phone tab item: no pill background — color + weight carry the active state. */
function TabLink({ to, label, icon: Icon, badge, isLocked }: { to: string; label: string; icon: NavItem['icon']; badge: number; isLocked: boolean }) {
  return (
    <NavLink
      to={to}
      end={to === ROUTES.pos}
      viewTransition
      className={({ isActive }) =>
        `relative flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${isActive ? 'text-brand-700' : 'text-muted'}`
      }
    >
      <Icon aria-hidden size={22} />
      {label}
      <CountBadge count={badge} />
      <LockMark isShown={isLocked} />
    </NavLink>
  );
}

/**
 * Phone (< md): content + bottom tab bar (primary items + "Lainnya").
 * Tablet/desktop (>= md): 84px side rail with logomark, nav, sync status, owner-mode lock and the seller.
 */
export function AppShell() {
  const cashier = useSessionStore((s) => s.cashier);
  const lockOwner = useSessionStore((s) => s.lockOwner);
  const access = useOwnerAccess();
  const openOrders = useOpenOrderCount();
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  useOwnerAutoLock();

  const badgeFor = (item: NavItem) => (item.to === ROUTES.openOrders ? openOrders : 0);
  const isLocked = (item: NavItem) => access.kind === 'locked' && item.isOwnerOnly === true;

  return (
    <div className="flex h-dvh overflow-hidden bg-canvas text-ink">
      <nav aria-label={t('Navigasi utama')} className="hidden w-[84px] shrink-0 flex-col border-r border-line bg-surface px-3 py-3 md:flex">
        <div className="mb-4 flex justify-center">
          <LogoMark size={36} />
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto [scrollbar-width:none]">
          {NAV_ITEMS.map((item) => (
            <RailLink key={item.to} item={item} badge={badgeFor(item)} isLocked={isLocked(item)} />
          ))}
        </div>
        <div className="mt-2 flex shrink-0 flex-col items-center gap-3 border-t border-line pt-3">
          <SyncBadge />
          {access.kind === 'unlocked' && (
            <button type="button" onClick={lockOwner} title={t('Kunci mode pemilik')} className="flex h-11 w-full flex-col items-center justify-center rounded-lg text-[11px] font-semibold text-brand-700 hover:bg-brand-50">
              <LockOpen aria-hidden size={18} />
              {t('Kunci')}
            </button>
          )}
          <button
            type="button"
            aria-label={t('Akun: {0}. Ganti kasir', cashier?.displayName ?? '')}
            title={`${cashier?.displayName ?? ''} · ${cashier?.role === 'owner' ? t('Pemilik') : t('Kasir::orang')}`}
            onClick={() => setIsAccountOpen(true)}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-ink text-[12px] font-bold text-white hover:bg-ink-soft"
          >
            {initialsOf(cashier?.displayName ?? '')}
          </button>
        </div>
      </nav>

      <main className="page-pane relative flex min-w-0 flex-1 flex-col pb-[calc(64px+env(safe-area-inset-bottom))] md:pb-0">
        <SubscriptionBanner />
        <Outlet />
      </main>

      <nav
        aria-label={t('Navigasi bawah')}
        className="fixed inset-x-0 bottom-0 z-30 grid h-[calc(64px+env(safe-area-inset-bottom))] auto-cols-fr grid-flow-col border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        {NAV_ITEMS.filter((item) => item.isPrimary).map((item) => (
          <TabLink key={item.to} to={item.to} label={item.label} icon={item.icon} badge={badgeFor(item)} isLocked={isLocked(item)} />
        ))}
        <TabLink to={ROUTES.more} label={t('Lainnya::menu')} icon={MoreHorizontal} badge={0} isLocked={false} />
      </nav>

      {isAccountOpen && <AccountSheet onClose={() => setIsAccountOpen(false)} />}
    </div>
  );
}
