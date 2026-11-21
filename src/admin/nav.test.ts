import { describe, expect, it } from 'vitest';
import { navGroups, SECTIONS, sectionLabel } from './nav';

describe('admin sidebar menu (ADR-021)', () => {
  it('lists every console section exactly once, in section order', () => {
    const ids = navGroups().flatMap((g) => g.items.map((i) => i.id));
    expect(ids).toEqual([...SECTIONS]);
  });

  it('groups business sections before site and promotion', () => {
    expect(navGroups().map((g) => g.items.length)).toEqual([4, 3]);
  });

  it('gives each section a label for the phone top bar and the page title', () => {
    for (const id of SECTIONS) expect(sectionLabel(id)).not.toBe('');
    expect(sectionLabel('report')).toBe('Laporan');
  });
});
