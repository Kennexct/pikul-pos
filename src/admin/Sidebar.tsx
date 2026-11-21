import { LogOut } from 'lucide-react';
import { LogoMark } from '../components/Brand/Logo';
import { t } from '../i18n';
import { navGroups, type Section } from './nav';

interface SidebarProps {
  value: Section;
  onSelect: (id: Section) => void;
  /** Small number beside an item (plans, campaigns). */
  counts?: Partial<Record<Section, number>>;
  isPreview: boolean;
  /** Shown only when a real server session exists. */
  onSignOut?: () => void;
}

/** Left menu of the admin console (ADR-021): fixed on tablet and laptop, inside the drawer on a phone. */
export function Sidebar({ value, onSelect, counts, isPreview, onSignOut }: SidebarProps) {
  return (
    <div className="flex h-full flex-col bg-surface">
      <div className="flex items-center gap-2.5 px-5 pb-4 pt-5">
        <LogoMark size={30} />
        <div className="min-w-0">
          <p className="truncate text-[16px] font-bold tracking-[-0.02em] text-ink">Pikul</p>
          <p className="truncate text-[12px] font-semibold text-muted">{t('Konsol admin')}</p>
        </div>
      </div>
      <nav aria-label={t('Menu konsol')} className="flex-1 overflow-y-auto px-3 pb-4">
        {navGroups().map((group) => (
          <div key={group.label} className="mt-3 first:mt-0">
            <p className="px-3 pb-1.5 pt-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">{group.label}</p>
            <ul className="flex flex-col gap-0.5">
              {group.items.map(({ id, label, icon: Icon }) => {
                const isActive = id === value;
                const count = counts?.[id];
                return (
                  <li key={id}>
                    <button
                      type="button"
                      aria-current={isActive ? 'page' : undefined}
                      onClick={() => onSelect(id)}
                      className={`relative flex h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-[15px] font-semibold transition-colors ${
                        isActive ? 'bg-brand-50 text-brand-700' : 'text-ink-soft hover:bg-subtle hover:text-ink'
                      }`}
                    >
                      <span aria-hidden className={`absolute -left-3 top-2.5 bottom-2.5 w-[3px] rounded-r-full ${isActive ? 'bg-brand-600' : 'bg-transparent'}`} />
                      <Icon aria-hidden size={20} className={isActive ? 'text-brand-600' : 'text-muted'} />
                      <span className="min-w-0 flex-1 truncate">{label}</span>
                      {count !== undefined && <span className="num text-[13px] font-semibold text-muted">{count}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      {(isPreview || onSignOut) && (
        <div className="border-t border-line px-3 py-3">
          {isPreview && <p className="mb-2 px-3 text-[12px] font-semibold text-warn-700">{t('Mode pratinjau')}</p>}
          {onSignOut && (
            <button
              type="button"
              onClick={onSignOut}
              className="flex h-11 w-full items-center gap-3 rounded-lg px-3 text-[15px] font-semibold text-ink-soft transition-colors hover:bg-subtle hover:text-ink"
            >
              <LogOut aria-hidden size={20} className="text-muted" />
              {t('Keluar')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
