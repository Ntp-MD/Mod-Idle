import { describe, it, expect } from 'vitest';
import { E } from '../src/engine/client';
import { newGame } from '../src/sim/game';
import { farm, rollPotion } from '../src/sim/farm';

/**
 * `owner/idea-gameplay.md` items 2 + 4: some species drop HP/MP potions, and the humanoid tribes are
 * that source. The rate is **derived, not typed** — the band's own herb stream divided by a potion's
 * herb cost — so the mobs supplement the farm instead of replacing it, and a band with no herb stream
 * has no mob potion source at all. `X49` gates the same derivation.
 */

describe('the humanoid tribes drop potions (items 2 + 4)', () => {
  it('the chance comes out of the herb stream and stays under it', () => {
    const mid = farm.potionDropChance('mid');
    const high = farm.potionDropChance('high');
    expect(mid).toBeGreaterThan(0);
    expect(high).toBeGreaterThan(0);
    expect(farm.potionDropChance('low')).toBe(0);       // that band has no herb stream either
    expect(mid).toBeLessThan(E.herbs.mid_chance);       // a supplement, never the source
    expect(high).toBeLessThan(E.herbs.high_chance);
    // and the flag really is on a lineage, not on a name list beside the roster
    expect((E.mob.species as any[]).filter((r) => r.humanoid).length).toBeGreaterThan(0);
  });

  it('only a humanoid lineage carries it, and the bottle follows the zone band', () => {
    const s = newGame(5);
    // an rng that always passes the chance and always picks the hp pool
    const name = rollPotion(s, () => 0, 'mid', true);
    expect(name).toBeTruthy();
    expect(s.farm.potions[name as string]).toBe(1);
    const row = (E.potions as any).list.find((p: any) => p.name === name);
    expect(row.tier).toBe('mid');
    expect(['hp', 'mp']).toContain(row.pool);
  });

  it('an ordinary lineage, the low band and a failed roll all drop nothing', () => {
    const s = newGame(5);
    expect(rollPotion(s, () => 0, 'mid', false)).toBeNull();
    expect(rollPotion(s, () => 0, 'low', true)).toBeNull();
    expect(rollPotion(s, () => 0.99, 'mid', true)).toBeNull();
  });
});
