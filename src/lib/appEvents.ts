/** Small app-wide signals between services and background UI (ADR-020). No-ops outside a browser (unit tests). */
export const APP_EVENTS = { registerOpened: 'pikul:register-opened', dayClosed: 'pikul:day-closed' } as const;
export type AppEvent = (typeof APP_EVENTS)[keyof typeof APP_EVENTS];

export function emitAppEvent(name: AppEvent, detail?: Record<string, string>): void {
  if (typeof window === 'undefined' || typeof CustomEvent === 'undefined') return;
  window.dispatchEvent(new CustomEvent(name, { detail }));
}
