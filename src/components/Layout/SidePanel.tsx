import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { t } from '../../i18n';

const COLLAPSED_KEY = 'kk.subnav.collapsed';

const readCollapsed = (): boolean => {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
};

/** One choice for every sub-menu (Transaksi, Kelola, Pengaturan), remembered on this device. */
export function useSubNavCollapsed(): [boolean, (value: boolean) => void] {
  const [isCollapsed, setIsCollapsed] = useState(readCollapsed);
  const set = (value: boolean) => {
    setIsCollapsed(value);
    try {
      localStorage.setItem(COLLAPSED_KEY, value ? '1' : '0');
    } catch {
      // Storage unavailable (private mode): the choice lasts until reload.
    }
  };
  return [isCollapsed, set];
}

interface SidePanelProps {
  title: string;
  isCollapsed: boolean;
  onCollapsedChange: (value: boolean) => void;
  /** The list itself; renders icon-only rows while collapsed. */
  children: ReactNode;
  /** role/aria for the list wrapper (a <nav> of links, or a vertical tablist). */
  as?: 'nav' | 'tablist';
}

/**
 * Tablet sub-menu column left of the page. The seller can fold it to a slim icon strip
 * (Kenny: "make the nav bar can be hide") to give the page more room.
 */
export function SidePanel({ title, isCollapsed, onCollapsedChange, children, as = 'nav' }: SidePanelProps) {
  const toggle = (
    <button
      type="button"
      aria-label={isCollapsed ? t('Tampilkan sub-menu') : t('Sembunyikan sub-menu')}
      title={isCollapsed ? t('Tampilkan sub-menu') : t('Sembunyikan sub-menu')}
      onClick={() => onCollapsedChange(!isCollapsed)}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-subtle hover:text-ink"
    >
      {isCollapsed ? <PanelLeftOpen aria-hidden size={18} /> : <PanelLeftClose aria-hidden size={18} />}
    </button>
  );
  const listProps =
    as === 'tablist'
      ? { role: 'tablist' as const, 'aria-label': title, 'aria-orientation': 'vertical' as const }
      : { 'aria-label': t('Menu {0}', title) };
  const List = as === 'tablist' ? 'div' : 'nav';
  return (
    <div
      className={`hidden shrink-0 flex-col overflow-y-auto border-r border-line bg-surface py-4 transition-[width] duration-200 md:flex ${isCollapsed ? 'w-16 items-center px-2' : 'w-52 px-3'}`}
    >
      <div className={`mb-2 flex items-center ${isCollapsed ? 'justify-center' : 'justify-between pl-3'}`}>
        {!isCollapsed && <p className="truncate text-[12px] font-semibold uppercase tracking-[0.06em] text-muted">{title}</p>}
        {toggle}
      </div>
      <List {...listProps} className="flex w-full flex-col gap-1">
        {children}
      </List>
    </div>
  );
}

/** Row classes shared by link and tab rows. */
export const sideItem = (isActive: boolean, isCollapsed: boolean): string =>
  `flex h-11 items-center rounded-lg text-[14px] font-semibold transition-colors ${isCollapsed ? 'relative w-11 justify-center self-center' : 'gap-3 px-3 text-left'} ${
    isActive ? 'bg-brand-50 text-brand-700' : 'text-ink-soft hover:bg-subtle hover:text-ink'
  }`;
