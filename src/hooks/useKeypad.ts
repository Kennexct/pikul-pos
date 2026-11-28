import { useEffect, useRef, useState } from 'react';

/** Props a number field spreads so the in-app keypad (ADR-029) drives it instead of the system keyboard. */
export interface KeypadField {
  inputMode: 'none';
  onFocus: () => void;
  onKeyDown: () => void;
  'data-keypad': 'active' | 'idle';
}

const isTextEntry = (el: EventTarget | null): boolean =>
  (el instanceof HTMLTextAreaElement || (el instanceof HTMLInputElement && !['checkbox', 'radio', 'button', 'submit'].includes(el.type))) &&
  el.inputMode !== 'none';

/**
 * Which number field the keypad types into. Picking a field makes it the target and "fresh" (the first key
 * replaces it, like a selected field). Focusing a text field (a note) hides the keypad so the system keyboard
 * can take over; tapping a number field again brings it back.
 */
export function useKeypad<K extends string>(initial: K | null) {
  const [active, setActive] = useState<K | null>(initial);
  const isFresh = useRef(true);

  useEffect(() => {
    const onFocusIn = (event: FocusEvent) => {
      if (isTextEntry(event.target)) setActive(null);
    };
    document.addEventListener('focusin', onFocusIn);
    return () => document.removeEventListener('focusin', onFocusIn);
  }, []);

  const field = (key: K): KeypadField => ({
    inputMode: 'none',
    onFocus: () => {
      isFresh.current = true;
      setActive(key);
    },
    // A hardware keyboard types straight into the field; the next keypad key then adds to it.
    onKeyDown: () => {
      isFresh.current = false;
    },
    'data-keypad': active === key ? 'active' : 'idle',
  });

  /** True once after the field was picked (or `restart`), then false. */
  const takeFresh = (): boolean => {
    const fresh = isFresh.current;
    isFresh.current = false;
    return fresh;
  };

  /** After a quick-pick chip filled the field, the next key starts over. */
  const restart = () => {
    isFresh.current = true;
  };

  return { active, setActive, field, takeFresh, restart };
}
