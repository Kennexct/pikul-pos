import { X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { t } from '../../i18n';

/** Space kept around the banner: 16px gutter each side, a little more top and bottom for the close button. */
const SIDE_GUTTER = 32;
const TOP_BOTTOM_GUTTER = 48;
/** Largest banner width on a tablet or desktop: square (1:1) and wide (16:9) banners. */
const MAX_SQUARE = 640;
const MAX_WIDE = 880;
const EXIT_MS = 200;

interface BannerDialogProps {
  /** Campaign title: the dialog name and the image's alt text (it is not shown as text). */
  title: string;
  imageUrl: string;
  /** Present when the banner is clickable. */
  onOpen?: () => void;
  onClose: () => void;
  /** The image could not load: the caller shows the text version instead. */
  onError: () => void;
}

const isMotionOff = () => typeof window.matchMedia !== 'function' || window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Image-led campaign pop-up: the banner alone, as large as the screen allows at its own aspect ratio (never cropped),
 * centred on phone and tablet, with a close button over its corner. The whole banner is the link when one is set.
 */
export function BannerDialog({ title, imageUrl, onOpen, onClose, onError }: BannerDialogProps) {
  const [ratio, setRatio] = useState<number | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const requestClose = (then?: () => void) => {
    if (isClosing) return;
    if (isMotionOff()) {
      then?.();
      onClose();
      return;
    }
    then?.();
    setIsClosing(true);
    window.setTimeout(onClose, EXIT_MS);
  };

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    closeRef.current?.focus({ preventScroll: true });
    return () => {
      if (opener && opener.isConnected && opener !== document.body) opener.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    // Capture phase so a sheet underneath does not also close on the same Escape.
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        requestClose();
      } else if (event.key === 'Tab' && panelRef.current) {
        const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>('button'));
        const index = items.indexOf(document.activeElement as HTMLElement);
        event.preventDefault();
        const next = (index + (event.shiftKey ? -1 : 1) + items.length) % items.length;
        items[next]?.focus();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  });

  // Width fits the screen both ways: never wider than the viewport, never taller than it, never past the max for its shape.
  const maxWidth = ratio && ratio > 1.3 ? MAX_WIDE : MAX_SQUARE;
  const width = ratio
    ? `min(${maxWidth}px, calc(100vw - ${SIDE_GUTTER}px), calc((100dvh - ${TOP_BOTTOM_GUTTER}px) * ${ratio}))`
    : `min(${MAX_SQUARE}px, calc(100vw - ${SIDE_GUTTER}px))`;
  const image = (
    <img
      src={imageUrl}
      alt={title}
      onLoad={(e) => {
        const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
        setRatio(w > 0 && h > 0 ? w / h : 1);
      }}
      onError={onError}
      className="block h-auto w-full"
    />
  );

  return (
    <div role="presentation" className={`fixed inset-0 z-50 flex items-center justify-center ${isClosing ? 'pointer-events-none' : ''}`}>
      <div
        aria-hidden
        onClick={() => requestClose()}
        className={`absolute inset-0 bg-ink/60 backdrop-blur-[3px] ${isClosing ? 'animate-fade-out' : 'animate-fade'}`}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{ width }}
        className={`relative overflow-hidden rounded-xl bg-surface shadow-pop ${ratio ? '' : 'opacity-0'} ${
          isClosing ? 'animate-dialog-out' : ratio ? 'animate-dialog-in' : ''
        }`}
      >
        {onOpen ? (
          <button type="button" onClick={() => requestClose(onOpen)} className="block w-full cursor-pointer">
            {image}
          </button>
        ) : (
          image
        )}
        <button
          ref={closeRef}
          type="button"
          aria-label={t('Tutup')}
          onClick={() => requestClose()}
          className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-full bg-surface/90 text-ink shadow-pop transition-colors hover:bg-surface"
        >
          <X aria-hidden size={20} />
        </button>
      </div>
    </div>
  );
}
