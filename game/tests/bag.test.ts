import { describe, it, expect } from 'vitest';
import { compareLines, vsWorn } from '../src/ui/inventory/bag';
import type { Item } from '../src/sim/types';

/**
 * The swap reading the bag panel shows. `vsWorn` is the aggregate score's answer and `compareLines` is
 * the per-axis one, so the pair is tested on hand-made pieces: a real drop cannot be asked to carry a
 * chosen line, and the claims here are about the pairing, not about what the loot table rolls.
 */
const piece = (over: Partial<Item>): Item => ({
  slot: 'helmet', base: 'coif', ilvl: 1, quality: 'low', tier: 'T3', lines: [], q: 0, ...over,
});
const line = (id: string, value: number, extra?: any) => ({ id, value, ...(extra ? { extra } : {}) } as any);

describe('the line-by-line swap reading', () => {
  it('names what each axis becomes: gained, lost, over, under', () => {
    const worn = piece({ lines: [line('max_hp_flat', 40), line('armour_pct', 12)] });
    const cand = piece({ lines: [line('max_hp_flat', 55), line('crit_pct', 8)] });
    const rows = compareLines(cand, worn);
    expect(rows.find((r) => r.id === 'max_hp_flat')).toMatchObject({ kind: 'over', worn: 40, cand: 55 });
    expect(rows.find((r) => r.id === 'armour_pct')).toMatchObject({ kind: 'lost', worn: 12, cand: null });
    expect(rows.find((r) => r.id === 'crit_pct')).toMatchObject({ kind: 'gained', worn: null, cand: 8 });
    expect(rows.length).toBe(3);
  });

  it('drops an axis the swap leaves untouched, so the card prints only the trade', () => {
    const worn = piece({ lines: [line('max_hp_flat', 40), line('armour_pct', 12)] });
    const cand = piece({ lines: [line('max_hp_flat', 40), line('armour_pct', 9)] });
    const rows = compareLines(cand, worn);
    expect(rows.map((r) => r.id)).toEqual(['armour_pct']);
    expect(rows[0].kind).toBe('under');
  });

  it('reads a Frame Mod\u2019s carried extras as lines of their own, the way the card prints them', () => {
    const frame = line('phys_flat_main_hand', 20, [line('accuracy_pct', 5)]);
    const rows = compareLines(piece({ lines: [frame] }), piece({ lines: [line('phys_flat_main_hand', 20)] }));
    expect(rows).toEqual([{ id: 'accuracy_pct', element: undefined, cand: 5, worn: null, kind: 'gained' }]);
  });

  it('keeps two lines of one Mod apart when they rolled different Elements', () => {
    const worn = piece({ lines: [line('elemental_damage_pct', 9, []), { id: 'elemental_damage_pct', value: 4, element: 'fire' } as any] });
    const cand = piece({ lines: [{ id: 'elemental_damage_pct', value: 7, element: 'fire' } as any] });
    const rows = compareLines(cand, worn);
    const fire = rows.find((r) => r.element === 'fire');
    expect(fire).toMatchObject({ kind: 'over', worn: 4, cand: 7 });
    expect(rows.find((r) => !r.element)).toMatchObject({ kind: 'lost', cand: null });
  });

  it('has nothing to say when nothing is worn', () => {
    expect(compareLines(piece({ lines: [line('max_hp_flat', 40)] }), null)).toEqual([]);
    expect(vsWorn(piece({ lines: [line('max_hp_flat', 40)] }), null)).toBeNull();
  });
});
