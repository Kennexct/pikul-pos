import type { HelpTopic } from '../../content/help';
import { t } from '../../i18n';

/** One help topic: what it is, numbered steps, then things to know. */
export function HelpTopicView({ topic }: { topic: HelpTopic }) {
  return (
    <div className="flex flex-col gap-4 text-[14px] leading-relaxed text-ink-soft">
      <p>{topic.summary}</p>
      <ol className="flex flex-col gap-2.5">
        {topic.steps.map((step, index) => (
          <li key={step} className="flex gap-3">
            <span aria-hidden className="num mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-brand-50 text-[12px] font-semibold text-brand-700">{index + 1}</span>
            <span className="text-ink">{step}</span>
          </li>
        ))}
      </ol>
      <div className="rounded-lg bg-subtle px-3.5 py-3">
        <p className="mb-1.5 text-[12px] font-semibold text-muted">{t('Perlu diketahui')}</p>
        <ul className="flex list-disc flex-col gap-1.5 pl-4 marker:text-faint">
          {topic.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
