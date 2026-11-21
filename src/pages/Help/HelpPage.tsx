import { ChevronDown, PlayCircle, SearchX } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChecklistCard } from '../../components/Checklist/ChecklistCard';
import { HelpTopicView } from '../../components/Help/HelpTopicView';
import { IntroCards } from '../../components/Help/IntroCards';
import { NARROW_COLUMN, PageHeader } from '../../components/Layout/PageHeader';
import { EmptyState } from '../../components/ui/EmptyState';
import { SearchInput } from '../../components/ui/SearchInput';
import { Sheet } from '../../components/ui/Sheet';
import { btnPrimary, btnSecondary, card } from '../../components/ui/styles';
import { HELP_TOPIC_IDS, searchHelp, type HelpTopicId } from '../../content/help';
import { useChecklist } from '../../hooks/useChecklist';
import { useSessionStore } from '../../store/useSessionStore';
import { t } from '../../i18n';

const isTopicId = (value: string | null): value is HelpTopicId => HELP_TOPIC_IDS.includes(value as HelpTopicId);

/** "Bantuan" (ADR-009): getting-started checklist, searchable topics, and the intro on replay. All offline. */
export function HelpPage() {
  const storeId = useSessionStore((s) => s.storeId);
  const checklist = useChecklist(storeId);
  const [params] = useSearchParams();
  const requested = params.get('topik');
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<HelpTopicId | null>(isTopicId(requested) ? requested : null);
  const [isIntroOpen, setIsIntroOpen] = useState(false);
  const topics = searchHelp(query);

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title={t('Bantuan')}
        isNarrow
        description={t('Cara memakai Pikul. Bisa dibuka tanpa internet.')}
        actions={
          <button type="button" onClick={() => setIsIntroOpen(true)} className={`${btnSecondary} h-11 text-[14px]`}>
            <PlayCircle aria-hidden size={18} /> <span className="hidden sm:inline">{t('Lihat lagi pengenalan')}</span>
            <span className="sm:hidden">{t('Pengenalan')}</span>
          </button>
        }
      />
      <div className="min-h-0 flex-1 overflow-y-auto p-4 md:px-8 md:py-6">
        <div className={`${NARROW_COLUMN} flex flex-col gap-4`}>
          {checklist && !checklist.isComplete && <ChecklistCard checklist={checklist} />}
          <SearchInput value={query} onChange={setQuery} placeholder={t('Cari bantuan, mis. refund, QRIS, tutup kasir…')} label={t('Cari topik bantuan')} />
          {topics.length === 0 ? (
            <EmptyState icon={SearchX} title={t('Topik tidak ditemukan')} description={t('Coba kata lain, misalnya: bayar, struk, laporan.')} />
          ) : (
            <ul className={`${card} divide-y divide-line overflow-hidden`}>
              {topics.map((topic) => {
                const isOpen = openId === topic.id;
                return (
                  <li key={topic.id}>
                    <h2>
                      <button type="button" aria-expanded={isOpen} aria-controls={`help-${topic.id}`} onClick={() => setOpenId(isOpen ? null : topic.id)} className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left hover:bg-subtle">
                        <span className="min-w-0 flex-1 text-[15px] font-semibold">{topic.title}</span>
                        <ChevronDown aria-hidden size={18} className={`shrink-0 text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                      </button>
                    </h2>
                    {isOpen && (
                      <div id={`help-${topic.id}`} className="px-4 pb-4">
                        <HelpTopicView topic={topic} />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {checklist?.isComplete && <ChecklistCard checklist={checklist} />}
        </div>
      </div>

      {isIntroOpen && (
        <Sheet title={t('Cara kerja Pikul')} isOpen onClose={() => setIsIntroOpen(false)} footer={<button type="button" onClick={() => setIsIntroOpen(false)} className={`${btnPrimary} w-full`}>{t('Mengerti')}</button>}>
          <IntroCards />
        </Sheet>
      )}
    </section>
  );
}
