import { useEffect, useState } from 'react';

/** The part of the screen the user can still see while the on-screen keyboard is up. */
export interface KeyboardArea {
  top: number;
  height: number;
}

/** Less than this many px hidden is a browser bar or the iPad shortcut strip, not a keyboard. */
const KEYBOARD_MIN_PX = 120;
/** Pinch-zoom also shrinks the visual viewport; only follow it at normal zoom. */
const MAX_SCALE = 1.05;

const readArea = (viewport: VisualViewport): KeyboardArea | null =>
  window.innerHeight - viewport.height > KEYBOARD_MIN_PX && viewport.scale < MAX_SCALE
    ? { top: Math.round(viewport.offsetTop), height: Math.round(viewport.height) }
    : null;

/**
 * iPad Safari (and Chrome on Android by default) lay the keyboard over the page instead of shrinking it,
 * so a fixed sheet ends up behind the keys. This returns the area above the keyboard (null when there is
 * no keyboard) so a sheet can fit itself into it (ADR-029).
 */
export function useKeyboardArea(isEnabled: boolean): KeyboardArea | null {
  const [area, setArea] = useState<KeyboardArea | null>(null);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!isEnabled || !viewport) return undefined;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const next = readArea(viewport);
        setArea((prev) => (prev?.top === next?.top && prev?.height === next?.height ? prev : next));
      });
    };
    update();
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    return () => {
      cancelAnimationFrame(frame);
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
      setArea(null);
    };
  }, [isEnabled]);

  return area;
}

/** Once the keyboard has settled, scroll the focused field inside `container` into view. */
export function revealFocused(container: HTMLElement | null): void {
  const el = document.activeElement;
  if (!container || !(el instanceof HTMLElement) || !container.contains(el) || !el.matches('input, textarea, select')) return;
  el.scrollIntoView({ block: 'nearest' });
}
