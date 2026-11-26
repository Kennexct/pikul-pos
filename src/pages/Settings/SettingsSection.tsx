import type { ReactNode } from 'react';
import { card } from '../../components/ui/styles';

interface SettingsSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}

/** Card with a titled header — the building block of every settings screen. */
export function SettingsSection({ title, description, children, footer }: SettingsSectionProps) {
  return (
    <section className={`${card} mb-4 overflow-hidden`}>
      <header className="border-b border-line px-5 py-4">
        <h2 className="text-[16px] font-semibold tracking-[-0.01em]">{title}</h2>
        {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
      </header>
      <div className="@container/card px-5 py-4">{children}</div>
      {footer && <footer className="flex justify-end border-t border-line bg-subtle px-5 py-3">{footer}</footer>}
    </section>
  );
}
