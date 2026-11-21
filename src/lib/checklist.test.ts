import { describe, expect, it } from 'vitest';
import { HELP_TOPIC_IDS, HELP_TOPICS, INTRO_CARDS, searchHelp } from '../content/help';
import { buildChecklist, checklistProgress, type ChecklistFacts } from './checklist';

const none: ChecklistFacts = { hasMenu: false, hasSale: false, hasOwnerPin: false, usesQris: true, hasQrisImage: false, hasClosing: false, hasBackup: false };

describe('Langkah awal checklist', () => {
  it('lists six steps for a store that uses QRIS, five otherwise', () => {
    expect(buildChecklist(none).map((i) => i.id)).toEqual(['menu', 'sale', 'qris', 'pin', 'closing', 'backup']);
    expect(buildChecklist({ ...none, usesQris: false }).map((i) => i.id)).toEqual(['menu', 'sale', 'pin', 'closing', 'backup']);
  });

  it('ticks items from facts and knows when everything is done', () => {
    const some = buildChecklist({ ...none, hasSale: true, hasOwnerPin: true });
    expect(checklistProgress(some)).toEqual({ done: 2, total: 6, isComplete: false });
    const all = buildChecklist({ hasMenu: true, hasSale: true, hasOwnerPin: true, usesQris: true, hasQrisImage: true, hasClosing: true, hasBackup: true });
    expect(checklistProgress(all).isComplete).toBe(true);
  });
});

describe('help content', () => {
  it('has a complete entry for every topic and four intro cards', () => {
    expect(HELP_TOPICS.map((t) => t.id)).toEqual([...HELP_TOPIC_IDS]);
    for (const topic of HELP_TOPICS) {
      expect(topic.title.length).toBeGreaterThan(3);
      expect(topic.summary.length).toBeGreaterThan(20);
      expect(topic.steps.length).toBeGreaterThanOrEqual(2);
      expect(topic.notes.length).toBeGreaterThanOrEqual(1);
    }
    expect(INTRO_CARDS).toHaveLength(4);
  });

  it('finds topics by any word, in any order, including keywords', () => {
    expect(searchHelp('refund').map((t) => t.id)).toContain('riwayat');
    expect(searchHelp('hutang').map((t) => t.id)).toEqual(expect.arrayContaining(['simpan', 'pelanggan']));
    expect(searchHelp('laci selisih').map((t) => t.id)).toEqual(['kas']);
    expect(searchHelp('  ')).toHaveLength(HELP_TOPIC_IDS.length);
    expect(searchHelp('zzzz')).toEqual([]);
  });
});
