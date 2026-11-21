import { X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { t } from '../i18n';

const FOCUSABLE = 'a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])';

interface NavDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
}

/** Phone only (ADR-021): the sidebar slides in from the left over a scrim. Escape, scrim tap or ✕ closes it. */
export function NavDrawer({ isOpen, onClose, children }: NavDrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return undefined;
    const opener = document.activeElement as HTMLElement | null;
    panelRef.current?.focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      } else if (event.key === 'Tab' && panelRef.current) {
        const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
        const first = items[0];
        const last = items[items.length - 1];
        if (!first || !last) return;
        if (event.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (opener?.isConnected && opener !== document.body) opener.focus({ preventScroll: true });
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  return (
    <div role="presentation" className="fixed inset-0 z-40 md:hidden">
      <div aria-hidden onClick={onClose} className="absolute inset-0 bg-ink/45 backdrop-blur-[3px] animate-fade" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('Menu konsol')}
        tabIndex={-1}
        className="animate-drawer-in absolute inset-y-0 left-0 w-[280px] max-w-[85vw] shadow-pop outline-none"
      >
        <button
          type="button"
          aria-label={t('Tutup menu')}
          onClick={onClose}
          className="absolute right-2 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-lg text-muted transition-colors hover:bg-subtle hover:text-ink"
        >
          <X aria-hidden size={20} />
        </button>
        {children}
      </div>
    </div>
  );
}
