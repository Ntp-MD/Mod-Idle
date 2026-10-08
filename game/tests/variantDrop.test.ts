import { describe, expect, it } from 'vitest';
import { newGame, tick } from '../src/sim/game';
import { E } from '../src/engine/client';
import { sellJunk } from '../src/sim/town';

const ladderOf = (speciesId: string) => (E.mob.variants as Record<string, string[]>)[speciesId];
const drops = (E.mob as any).variant_drops as Record<string, { item: string; rarity: string; lean: string }>;

/**
 * Every mob variant the sim fields, driven to the state the test needs (a number of distinct spawns)
 * rather than for a fixed window of ticks: a fixed window is a time premise (AGENTS.md) and a coin
 * flip on which sub-zone the roll lands in. The bound is a hang guard.
 */
function seenVariants(state: any, want: number) {
  const seen = new Set<string>();
  for (let i = 0; i < 200000 && seen.size < want; i++) {
    tick(state, {});
    for (const m of state.group || []) seen.add(`${m.speciesId}|${m.variant}|${m.subzone || '-'}`);
  }
  return seen;
}

describe('a variant is a drop identity, not decoration', () => {
  it('every spawn carries a name its own ladder owns, and that name pays a real item', () => {
    const s = newGame(11);
    const seen = [...seenVariants(s, 6)].map((k) => k.split('|') as [string, string]);
    expect(seen.length).toBeGreaterThan(0);
    for (const [speciesId, variant] of seen) {
      expect(ladderOf(speciesId)).toContain(variant);
      const row = drops[variant];
      expect(row, `${variant} has no variant_drops row`).toBeTruthy();
      expect((E.junk.rarities as any)[row.rarity]).toBeTruthy();
    }
  }, 60000);

  it('a zone rolls its own whole cast — there is no hunting ground to pick', () => {
    const s = newGame(5);
    const zone = s.zone;
    const cast = ((E.mob.zones.find((z: any) => z.id === zone) as any).subzones || []).map((x: any) => x.name);
    expect(cast.length).toBeGreaterThan(1);
    const seen = new Set<string>();
    for (let i = 0; i < 200000 && seen.size < 2; i++) {
      tick(s, {});
      for (const m of s.group || []) if (m.subzone) seen.add(String(m.subzone));
    }
    // more than one sub-zone actually spawns, and every one of them belongs to the zone's own cast
    expect(seen.size).toBeGreaterThan(1);
    for (const name of seen) expect(cast).toContain(name);
  });

  it('the Counterhand pays each item its own rarity, so a variant never changes the gold', () => {
    const s: any = newGame(3);
    // value-exact by construction: every rarity's chance x sell equals the published junk line, so a
    // stack of any item is worth count x its rarity price and nothing depends on which variant paid it
    for (const row of Object.values(drops)) s.junk[row.item] = (s.junk[row.item] || 0) + 1;
    const expectGold = Object.values(drops).reduce((a, r) => a + (E.junk.rarities as any)[r.rarity].sell_gold, 0);
    const before = s.counters.gold;
    const r = sellJunk(s);
    expect(r.pieces).toBe(Object.keys(drops).length);
    expect(r.gold).toBe(expectGold);
    expect(s.counters.gold - before).toBe(expectGold);
    expect(Object.values(s.junk).every((n) => !n)).toBe(true);
  });
});
