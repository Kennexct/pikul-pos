import { CircleUserRound, LockOpen } from 'lucide-react';
import { SubscriptionBanner } from '../Access/SubscriptionBanner';
import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { ROUTES } from '../../constants';
import { useOpenOrderCount } from '../../hooks/useOpenOrderCount';
import { useOwnerAccess, useOwnerAutoLock } from '../../hooks/useOwnerAccess';
import { useSessionStore } from '../../store/useSessionStore';
import { LogoMark } from '../Brand/Logo';
import { AccountSheet } from '../Pin/AccountSheet';
import { initialsOf } from '../Pin/SellerSwitcher';
import { RailGroupLink, SubNav, TabBarLink } from './GroupNav';
import { groupOf, NAV_GROUPS, NAV_ITEMS, type NavGroup, type NavItem } from './navItems';
import { SyncBadge } from './SyncBadge';
import { t } from '../../i18n';

/**
 * Main menu = four groups (Kasir, Transaksi, Keuangan, Kelola); a group with several pages shows them as a sub-menu above the page.
 * Phone (< md): content + bottom tab bar (the four groups + Akun).
 * Tablet/desktop (>= md): 84px side rail with logomark, groups, Bantuan, sync status, owner-mode lock and the seller.
 */
export function AppShell() {
  const cashier = useSessionStore((s) => s.cashier);
  const lockOwner = useSessionStore((s) => s.lockOwner);
  const access = useOwnerAccess();
  const openOrders = useOpenOrderCount();
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const { pathname } = useLocation();
  const current = groupOf(pathname);
  /** Last page opened in each group, so tapping the group returns there. */
  const lastVisited = useRef<Partial<Record<NavGroup['id'], string>>>({});
  const [, rerender] = useState(0);
  useOwnerAutoLock();

  useEffect(() => {
    if (!current || lastVisited.current[current.id] === pathname) return;
    lastVisited.current[current.id] = pathname;
    rerender((n) => n + 1);
  }, [current, pathname]);

  const badgeFor = (item: NavItem) => (item.to === ROUTES.openOrders ? openOrders : 0);
  const isLocked = (item: NavItem) => access.kind === 'locked' && item.isOwnerOnly === true;
  const groupProps = (group: NavGroup) => ({
    to: lastVisited.current[group.id] ?? group.items[0]?.to ?? ROUTES.pos,
    isActive: current?.id === group.id,
    badge: group.items.reduce((sum, item) => sum + badgeFor(item), 0),
    isLocked: group.items.every(isLocked),
  });

  return (
    <div className="flex h-dvh overflow-hidden bg-canvas text-ink">
      <nav aria-label={t('Navigasi utama')} className="hidden w-[84px] shrink-0 flex-col border-r border-line bg-surface px-3 py-3 md:flex">
        <div className="mb-4 flex justify-center">
          <LogoMark size={36} />
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto [scrollbar-width:none]">
          {NAV_GROUPS.map((group) => (
            <RailGroupLink key={group.id} group={group} {...groupProps(group)} />
          ))}
        </div>
        <div className="mt-2 flex shrink-0 flex-col items-center gap-3 border-t border-line pt-3">
          <NavLink
            to={NAV_ITEMS.help.to}
            viewTransition
            aria-label={NAV_ITEMS.help.label}
            title={NAV_ITEMS.help.label}
            className={({ isActive }) => `flex h-10 w-10 items-center justify-center rounded-lg transition-colors ${isActive ? 'bg-brand-50 text-brand-700' : 'text-muted hover:bg-subtle hover:text-ink'}`}
          >
            <NAV_ITEMS.help.icon aria-hidden size={20} />
          </NavLink>
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
        {current && current.items.length > 1 && <SubNav group={current} badgeFor={badgeFor} isLocked={isLocked} />}
        <Outlet />
      </main>

      <nav
        aria-label={t('Navigasi bawah')}
        className="fixed inset-x-0 bottom-0 z-30 grid h-[calc(64px+env(safe-area-inset-bottom))] auto-cols-fr grid-flow-col border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        {NAV_GROUPS.map((group) => (
          <TabBarLink key={group.id} label={group.label} icon={group.icon} {...groupProps(group)} />
        ))}
        <TabBarLink to={ROUTES.more} label={t('Akun')} icon={CircleUserRound} isActive={pathname === ROUTES.more || pathname === ROUTES.help} />
      </nav>

      {isAccountOpen && <AccountSheet onClose={() => setIsAccountOpen(false)} />}
    </div>
  );
}
