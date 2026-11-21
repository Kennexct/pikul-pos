import { useCallback, useEffect, useRef, useState } from 'react';
import { isAuthError } from './errors';

/** Loads console data; keeps the last result while reloading; auth errors go to `onError` (sign-in again). */
export function useLoad<T>(load: () => Promise<T>, deps: readonly unknown[], onError: (e: unknown) => Promise<void>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(true);
  const seq = useRef(0);
  const run = useCallback(load, deps);
  const reload = useCallback(async () => {
    const id = ++seq.current;
    setBusy(true);
    try {
      const v = await run();
      if (id === seq.current) {
        setData(v);
        setError(null);
      }
    } catch (e) {
      if (id !== seq.current) return;
      setError(e);
      if (isAuthError(e)) await onError(e);
    } finally {
      if (id === seq.current) setBusy(false);
    }
  }, [run, onError]);
  useEffect(() => {
    void reload();
  }, [reload]);
  return { data, error, busy, reload };
}
