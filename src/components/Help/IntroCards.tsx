import { CalendarCheck, ClipboardList, HardDriveDownload, Store } from 'lucide-react';
import { INTRO_CARDS } from '../../content/help';

const ICONS = [Store, ClipboardList, CalendarCheck, HardDriveDownload] as const;

/** "Cara kerja Pikul": four short cards, shown at the end of the first-time journey and replayable from Bantuan. */
export function IntroCards() {
  return (
    <ol className="flex flex-col gap-2.5">
      {INTRO_CARDS.map((cardText, index) => {
        const Icon = ICONS[index] ?? Store;
        return (
          <li key={cardText.title} className="flex gap-3.5 rounded-lg border border-line bg-surface px-4 py-3.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
              <Icon aria-hidden size={20} />
            </span>
            <div className="min-w-0">
              <p className="text-[15px] font-semibold text-ink">{cardText.title}</p>
              <p className="mt-0.5 text-[14px] text-ink-soft">{cardText.body}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
