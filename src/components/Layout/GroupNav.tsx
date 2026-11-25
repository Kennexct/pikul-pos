import { Lock } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Link, NavLink } from 'react-router-dom';
import { t } from '../../i18n';
import type { NavGroup, NavItem } from './navItems';
import { SidePanel, sideItem, useSubNavCollapsed } from './SidePanel';

export function CountBadge({ count, className = 'absolute right-2 top-1' }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      aria-label={t('{0} pesanan belum dibayar', count)}
      className={`num flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-danger-600 px-1 text-[11px] font-bold text-white ring-2 ring-surface ${className}`}
    >
      {count}
    </span>
  );
}

export function LockMark({ isShown, className = 'absolute right-2 top-1.5' }: { isShown: boolean; className?: string }) {
  if (!isShown) return null;
  return (
    <span aria-label={t('terkunci, butuh PIN pemilik')} className={`text-faint ${className}`}>
      <Lock aria-hidden size={12} strokeWidth={2.5} />
    </span>
  );
}

interface GroupLinkProps {
  group: NavGroup;
  /** Page the group opens: the last one visited in it, else its first page. */
  to: string;
  isActive: boolean;
  badge: number;
  isLocked: boolean;
}

/** Tablet rail item: smaller icon over label, 3px indicator bar on the active group. */
export function RailGroupLink({ group, to, isActive, badge, isLocked }: GroupLinkProps) {
  const Icon = group.icon;
  return (
    <Link
      to={to}
      viewTransition
      aria-current={isActive ? 'page' : undefined}
      className={`group relative flex h-14 flex-col items-center justify-center gap-1 rounded-lg text-[11px] font-semibold transition-colors ${
        isActive ? 'bg-brand-50 text-brand-700' : 'text-muted hover:bg-subtle hover:text-ink'
      }`}
    >
      <span aria-hidden className={`absolute -left-3 top-3 bottom-3 w-[3px] rounded-r-full ${isActive ? 'bg-brand-600' : 'bg-transparent'}`} />
      <Icon aria-hidden size={20} />
      {group.label}
      <CountBadge count={badge} />
      <LockMark isShown={isLocked} />
    </Link>
  );
}

/** Phone tab item: color + weight carry the active state. */
export function TabBarLink({ to, label, icon: Icon, isActive, badge = 0, isLocked = false }: { to: string; label: string; icon: LucideIcon; isActive: boolean; badge?: number; isLocked?: boolean }) {
  return (
    <Link
      to={to}
      viewTransition
      aria-current={isActive ? 'page' : undefined}
      className={`relative flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${isActive ? 'text-brand-700' : 'text-muted'}`}
    >
      <Icon aria-hidden size={20} />
      {label}
      <CountBadge count={badge} />
      <LockMark isShown={isLocked} />
    </Link>
  );
}

interface SubNavProps {
  group: NavGroup;
  badgeFor: (item: NavItem) => number;
  isLocked: (item: NavItem) => boolean;
}

/** Phone: the open group's pages as underline tabs above the page (e.g. Transaksi → Riwayat · Kas · Pesanan). */
export function SubNavTabs({ group, badgeFor, isLocked }: SubNavProps) {
  return (
    <nav aria-label={t('Menu {0}', group.label)} className="shrink-0 border-b border-line bg-surface px-2 md:hidden">
      <div className="scroll-x -mb-px flex gap-1">
        {group.items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            viewTransition
            className={({ isActive }) =>
              `relative flex h-11 shrink-0 items-center gap-1.5 px-3 text-[14px] font-semibold transition-colors ${isActive ? 'text-brand-700' : 'text-muted hover:text-ink'}`
            }
          >
            {({ isActive }) => (
              <>
                <item.icon aria-hidden size={16} />
                {item.label}
                <CountBadge count={badgeFor(item)} className="static ring-0" />
                <LockMark isShown={isLocked(item)} className="static" />
                <span aria-hidden className={`absolute inset-x-2 bottom-0 h-[2px] rounded-full ${isActive ? 'bg-brand-600' : 'bg-transparent'}`} />
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

/** Tablet: the open group's pages as a list in a second column left of the page (can fold to icons). */
export function SubNavList({ group, badgeFor, isLocked }: SubNavProps) {
  const [isCollapsed, setIsCollapsed] = useSubNavCollapsed();
  return (
    <SidePanel title={group.label} isCollapsed={isCollapsed} onCollapsedChange={setIsCollapsed}>
      {group.items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          viewTransition
          aria-label={isCollapsed ? item.label : undefined}
          title={isCollapsed ? item.label : undefined}
          className={({ isActive }) => sideItem(isActive, isCollapsed)}
        >
          <item.icon aria-hidden size={18} />
          {!isCollapsed && <span className="min-w-0 flex-1 truncate">{item.label}</span>}
          <CountBadge count={badgeFor(item)} className={isCollapsed ? 'absolute -right-1 -top-1' : 'static ring-0'} />
          {!isCollapsed && <LockMark isShown={isLocked(item)} className="static" />}
        </NavLink>
      ))}
    </SidePanel>
  );
}
