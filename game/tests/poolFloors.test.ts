import { describe, it, expect } from 'vitest';
import { buildCharacter, emptyGear, type Character } from '../src/sim/player';
import { mobSwing } from '../src/sim/combat';
import { NO_CURSE } from '../src/sim/curse';
import { newGame, tick, carried, heldWeaponName } from '../src/sim/game';
import { masteryLevel } from '../src/sim/mastery';
import { effectsActive } from '../src/sim/skills';
import { mulberry32 } from '../src/engine/client-helpers';
import type { GameState, Mob } from '../src/sim/types';

/**
 * Mana and Energy Shield are pools, so their floor is nothing and their ceiling is what the sheet
 * says they hold. A bar reading `-12` is not a rounding to hide: it meant a swing had spent a shield
 * that was already half gone (D-109).
 */
const mob = (): Mob => ({
  id: 'm1', species: 'Rat', zone: 1, level: 90, kind: 'normal', hp: 1e9, hpMax: 1e9,
  ps: 600, acc: 900, armour: 0, res: 0, evasion: 0, dodgeRate: 0, innate: ['fire'],
  damage: 'mixed', hitsPerSec: 1, atkTimer: 0,
} as Mob);

/** The same sheet the tick builds, so "above its maximum" means above what the game itself allows. */
const sheetOf = (s: GameState) => buildCharacter(
  s.player.level, s.gear, carried(s), masteryLevel(s, heldWeaponName(s)), effectsActive(s.skills),
);

describe('a pool spends only what stands in it', () => {
  it('one swing cannot spend more Energy Shield than is left', () => {
    const c = buildCharacter(90, emptyGear());
    expect(c.es).toBeGreaterThan(0);
    // This test is about the split, so the swing has to land: the Evasion layer is zeroed rather
    // than hunting a seed that happens to get past it.
    const sheet = { ...c, evasion: 0, evasionFromAgi: 0 } as Character;

    const standing = mobSwing(mulberry32(3), sheet, mob(), {}, NO_CURSE, sheet.es);
    const half = mobSwing(mulberry32(3), sheet, mob(), {}, NO_CURSE, sheet.es / 2);
    const gone = mobSwing(mulberry32(3), sheet, mob(), {}, NO_CURSE, 0);

    expect(standing.toEs).toBeGreaterThan(0);
    expect(half.toEs).toBeLessThanOrEqual(sheet.es / 2 + 1e-9);
    expect(gone.toEs).toBe(0);
    expect(gone.toHp).toBeGreaterThan(0); // the damage does not vanish, it moves onto HP
    // and the swing totals the same either way — the clamp moves the split, it never invents a hit
    expect(half.toEs + half.toHp).toBeCloseTo(standing.toEs + standing.toHp, 8);
  });

  it('a long hunt never leaves a negative or over-full pool', () => {
    const s = newGame(4242);
    let esSpent = 0;
    let manaSpent = 0;
    let minEs = Infinity;
    let minMana = Infinity;
    let bad: string | null = null;
    for (let i = 0; i < 3000 && !bad; i++) {
      tick(s, {}, { online: true });
      const c = sheetOf(s);
      minEs = Math.min(minEs, s.player.es);
      minMana = Math.min(minMana, s.player.mana);
      if (s.player.es < 0) bad = `Energy Shield went negative at ${i}: -${(-s.player.es).toFixed(1)}`;
      else if (s.player.mana < 0) bad = `Mana went negative at ${i}: -${(-s.player.mana).toFixed(1)}`;
      else if (s.player.es > c.es + 1e-6) bad = `Energy Shield read above its own maximum at ${i}`;
      else if (s.player.mana > c.maxMana + 1e-6) bad = `Mana read above its own maximum at ${i}`;
      esSpent = Math.max(esSpent, c.es - s.player.es);
      manaSpent = Math.max(manaSpent, c.maxMana - s.player.mana);
    }
    // eslint-disable-next-line no-console
    console.log(`\n3,000 sec of hunting: lowest shield ${minEs.toFixed(1)} · lowest mana ${minMana.toFixed(1)} `
      + `· deepest spend ${esSpent.toFixed(1)} ES / ${manaSpent.toFixed(1)} mana · Pushes ${s.counters.pushes} · level ${s.player.level}`);
    expect(bad).toBeNull();
    // the run has to actually spend a pool, or the gate proves nothing
    expect(Math.max(esSpent, manaSpent)).toBeGreaterThan(0);
  }, 180000);
});
