import { X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { t } from '../../i18n';

interface SheetProps {
  title: string;
  /** Secondary line under the title (order no., context). */
  subtitle?: string;
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  /** Wider panel on tablet (forms with two columns). */
  isWide?: boolean;
  /** Content manages its own padding and scrolling (e.g. the cart). */
  isFlush?: boolean;
}

/** Longest exit animation (sheet-out / dialog-out in index.css) plus a little slack. */
const EXIT_FALLBACK_MS = 260;
/** Drag distance (px) or flick speed (px/ms) that dismisses a phone sheet. */
const DISMISS_DISTANCE = 96;
const DISMISS_VELOCITY = 0.5;
/** Movement before a press on the header becomes a drag (keeps taps on the close button working). */
const DRAG_SLOP = 6;

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/** Open sheets, newest last: only the top one answers Escape and traps Tab. */
const openStack: symbol[] = [];

const matches = (query: string) => typeof window.matchMedia === 'function' && window.matchMedia(query).matches;
/** jsdom (tests) has no matchMedia: treat it like reduced motion so closing stays synchronous. */
const isMotionOff = () => typeof window.matchMedia !== 'function' || matches('(prefers-reduced-motion: reduce)');

interface Drag {
  pointerId: number;
  startY: number;
  startTime: number;
  dy: number;
  isActive: boolean;
}

/**
 * Bottom sheet on phone (slides up from the edge, drag the header down to dismiss), centred dialog on tablet
 * (rises and scales in). Every close — X, backdrop, Escape, swipe — plays the exit before `onClose` runs.
 */
export function Sheet({ title, subtitle, isOpen, onClose, children, footer, isWide = false, isFlush = false }: SheetProps) {
  const [isRendered, setIsRendered] = useState(isOpen);
  const [isClosing, setIsClosing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const closedByUser = useRef(false);
  const drag = useRef<Drag | null>(null);
  const [id] = useState(() => Symbol('sheet'));

  // Parent opened us, or closed us without going through requestClose (e.g. cart → payment).
  if (isOpen && !isRendered) {
    setIsRendered(true);
    setIsClosing(false);
  } else if (!isOpen && isRendered && !isClosing) {
    if (isMotionOff()) setIsRendered(false);
    else {
      closedByUser.current = false;
      setIsClosing(true);
    }
  }

  const requestClose = useCallback(() => {
    if (isClosing) return;
    if (isMotionOff()) {
      onClose();
      return;
    }
    closedByUser.current = true;
    setIsClosing(true);
  }, [isClosing, onClose]);

  const finishClose = useCallback(() => {
    setIsClosing(false);
    setIsRendered(false);
    if (closedByUser.current) {
      closedByUser.current = false;
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    if (!isClosing) return undefined;
    const timer = window.setTimeout(finishClose, EXIT_FALLBACK_MS);
    return () => window.clearTimeout(timer);
  }, [isClosing, finishClose]);

  // Focus moves into the sheet on open and back to whatever opened it on close.
  useEffect(() => {
    if (!isRendered) return undefined;
    const opener = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    if (panel && !panel.contains(document.activeElement)) panel.focus({ preventScroll: true });
    openStack.push(id);
    return () => {
      openStack.splice(openStack.indexOf(id), 1);
      // Hand focus back only if nothing else (e.g. the next sheet) has taken it meanwhile.
      const focus = document.activeElement;
      const isOurs = focus === null || focus === document.body || (panel?.contains(focus) ?? false);
      if (isOurs && opener && opener.isConnected && opener !== document.body) opener.focus({ preventScroll: true });
    };
  }, [isRendered, id]);

  useEffect(() => {
    if (!isRendered) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (openStack[openStack.length - 1] !== id) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        requestClose();
      } else if (event.key === 'Tab' && panelRef.current) {
        const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
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
    return () => window.removeEventListener('keydown', onKey);
  }, [isRendered, id, requestClose]);

  // Phone only: drag the grabber/header down to dismiss, like a native sheet.
  const onDragStart = (event: ReactPointerEvent) => {
    if (event.pointerType === 'mouse' || matches('(min-width: 768px)') || isClosing) return;
    drag.current = { pointerId: event.pointerId, startY: event.clientY, startTime: event.timeStamp, dy: 0, isActive: false };
  };
  const onDragMove = (event: ReactPointerEvent) => {
    const d = drag.current;
    const panel = panelRef.current;
    if (!d || !panel || d.pointerId !== event.pointerId) return;
    d.dy = Math.max(0, event.clientY - d.startY);
    if (!d.isActive && d.dy > DRAG_SLOP) {
      d.isActive = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      panel.style.transition = 'none';
    }
    if (d.isActive) panel.style.transform = `translateY(${d.dy}px)`;
  };
  const onDragEnd = (event: ReactPointerEvent) => {
    const d = drag.current;
    const panel = panelRef.current;
    drag.current = null;
    if (!d || !panel || !d.isActive) return;
    const velocity = d.dy / Math.max(1, event.timeStamp - d.startTime);
    if (d.dy > DISMISS_DISTANCE || velocity > DISMISS_VELOCITY) {
      requestClose(); // sheet-out animates from the current dragged position
      return;
    }
    panel.style.transition = 'transform 200ms var(--ease-out-quart)';
    panel.style.transform = '';
  };

  if (!isRendered) return null;

  return (
    <div role="presentation" className={`fixed inset-0 z-40 flex items-end justify-center md:items-center md:p-6 ${isClosing ? 'pointer-events-none' : ''}`}>
      {/* Translucent scrim: the sale behind stays visible, just quieter. Fades on its own so the panel never ghosts. */}
      <div
        aria-hidden
        onClick={requestClose}
        className={`absolute inset-0 bg-ink/45 backdrop-blur-[3px] ${isClosing ? 'animate-fade-out' : 'animate-fade'}`}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onAnimationEnd={(event) => {
          if (isClosing && event.target === event.currentTarget) finishClose();
        }}
        className={`relative flex max-h-[92dvh] w-full flex-col rounded-t-xl bg-surface shadow-pop outline-none md:rounded-xl ${
          isClosing ? 'animate-sheet-out md:animate-dialog-out' : 'animate-sheet-in md:animate-dialog-in'
        } ${isWide ? 'md:max-w-2xl' : 'md:max-w-[440px]'}`}
      >
        <div onPointerDown={onDragStart} onPointerMove={onDragMove} onPointerUp={onDragEnd} onPointerCancel={onDragEnd} className="touch-none md:touch-auto">
          <div aria-hidden className="mx-auto mt-2 h-1 w-9 rounded-full bg-line-strong md:hidden" />
          <header className="flex items-start gap-3 px-5 pb-3 pt-3 md:pt-4">
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-[17px] font-bold tracking-[-0.01em] text-ink">{title}</h2>
              {subtitle && <p className="num truncate text-[13px] text-muted">{subtitle}</p>}
            </div>
            <button
              type="button"
              aria-label={t('Tutup')}
              onClick={requestClose}
              className="-mr-2 -mt-1 flex h-11 w-11 items-center justify-center rounded-lg text-muted transition-colors hover:bg-subtle hover:text-ink"
            >
              <X aria-hidden size={20} />
            </button>
          </header>
        </div>
        <div
          className={
            isFlush
              ? 'flex min-h-0 flex-1 flex-col border-t border-line'
              : 'flex-1 overscroll-contain overflow-y-auto border-t border-line px-5 py-4'
          }
        >
          {children}
        </div>
        {footer && (
          <footer className="border-t border-line px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{footer}</footer>
        )}
      </div>
    </div>
  );
}
