import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { eng, E, MODS } from '../src/engine/client';
import { buildCharacter } from '../src/sim/core/player';
import { newGame, tick, catchUp, huntZone, carried } from '../src/sim/core/game';
import { modRangeProblems } from '../../tools/lib/mod-ranges.ts';

// The cages load tools/lib/engine.ts, which is a bridge over the same engine/index.ts the client
// calls. Requiring it here proves the client and the cages resolve to one module and one data file
// — the shared-source ownership described in AGENTS.md.
const require = createRequire(import.meta.url);
const cage = require('../../tools/lib/engine.ts').eng;

describe('canonical Mod range gate', () => {
  it('accepts the current windows, including the positive singleton seam', () => {
    expect(modRangeProblems(MODS)).toEqual([]);
  });

  it.each(['lower', 'upper'])('rejects a slice outside its declared %s bound', (bound) => {
    const mods = structuredClone(MODS);
    const dodge = mods.mods.find((mod) => mod.id === 'perfect_dodge_pct')!;
    if (bound === 'lower') dodge.bands[1][0][0] = dodge.min - 1;
    else dodge.bands[1][0][1] = dodge.max + 1;
    expect(modRangeProblems(mods)).toContainEqual(expect.stringContaining('outside declared'));
  });

  it('rejects a decreasing band floor within the declared range', () => {
    const mods = structuredClone(MODS);
    const accuracy = mods.mods.find((mod) => mod.id === 'accuracy')!;
    const previousFloor = accuracy.bands[1][0][0];
    accuracy.bands[2][0][0] = previousFloor - 1;
    expect(modRangeProblems(mods)).toContainEqual(expect.stringContaining(`floor ${previousFloor - 1} decreases from ${previousFloor}`));
  });

  it('rejects an ordinary touching seam even when its final slice is a singleton', () => {
    const mods = structuredClone(MODS);
    const crit = mods.mods.find((mod) => mod.id === 'critical_chance')!;
    const previous = crit.bands[0];
    crit.bands[1][0][0] = previous[previous.length - 1][1];
    expect(modRangeProblems(mods)).toContainEqual(expect.stringContaining('seam 1 has no god-roll overlap'));
  });

  it('rejects a true gap after a singleton band', () => {
    const mods = structuredClone(MODS);
    const dodge = mods.mods.find((mod) => mod.id === 'perfect_dodge_pct')!;
    const afterSingleton = dodge.bands[0][0][1] + 1;
    dodge.bands[1][0][0] = afterSingleton;
    dodge.bands[2][0][0] = afterSingleton;
    expect(modRangeProblems(mods)).toContainEqual(expect.stringContaining('seam 1 has no god-roll overlap'));
  });
});

describe('game and cages run one engine', () => {
  it('resolves the same derived ceilings', () => {
    expect(eng.CEIL).toBe(cage.CEIL);
    expect(eng.DERIVED.phys).toBe(cage.DERIVED.phys);
    expect(eng.BAND.high.drop_chance_pct).toBe(cage.BAND.high.drop_chance_pct);
    expect(eng.mobHpAt(100)).toBe(cage.mobHpAt(100));
    expect(eng.xpToNext(30)).toBe(cage.xpToNext(30));
    expect(eng.aspdOf(510, 1.2, 25)).toBe(cage.aspdOf(510, 1.2, 25));
    expect(eng.speciesInZone(16)).toEqual(cage.speciesInZone(16));
    expect(eng.zoneElements(16)).toEqual(cage.zoneElements(16));
  });

});


describe('the opening character is the designed minute one', () => {
  it('starts below the designed Evasion ceiling against the reference and the top-accuracy zone-one Species', () => {
    const s = newGame();
    const c = buildCharacter(s.player.level, s.gear, {}, 0, undefined, s.player.points, s.player.treeRanks);
    expect(c.evasion).toBeGreaterThan(0);
    expect(c.evasionChance).toBeGreaterThan(0);
    expect(c.evasionChance).toBeLessThanOrEqual(E.evasion_roll.opening_max_chance_pct);
    const zoneCast = E.mob.species.filter((row) => row.zones.includes(s.zone));
    const topAccuracy = Math.max(...zoneCast.map((row) => eng.mobAcc(eng.coreOf(row, 'dex', s.zone), row.accuracy_mult)));
    const topAccuracySpecies = zoneCast.filter((row) => eng.mobAcc(eng.coreOf(row, 'dex', s.zone), row.accuracy_mult) === topAccuracy);
    expect(topAccuracySpecies.length).toBeGreaterThan(0);
    for (const species of topAccuracySpecies) {
      const acc = eng.mobAcc(eng.coreOf(species, 'dex', s.zone), species.accuracy_mult);
      expect(eng.evasionChance(c.evasion, acc), species.name).toBeLessThanOrEqual(E.evasion_roll.opening_max_chance_pct);
    }
  });

  it('comes from engine.json opening, not a typed copy', () => {
    const s = newGame();
    expect(s.player.level).toBe(E.opening.level);
    expect(s.zone).toBe(E.opening.settlement_zone);
    expect(s.counters.gold).toBe(E.opening.gold);
    // the kit is the data's: every named draught exists on the ladder and arrives in positive count
    // (equality with the source would be a self-comparison — what must not drift is ladder membership)
    for (const [name, count] of Object.entries(E.opening.potions as Record<string, number>)) {
      expect(E.potions.list.some((p: any) => p.name === name), name).toBe(true);
      expect(count, name).toBeGreaterThan(0);
      expect(s.farm.potions[name], name).toBeGreaterThan(0);
    }
  });

  it('starts wearing nothing: every slot empty, the kit carried in the pocket', () => {
    const s = newGame();
    expect(s.gear.every((g) => g === null)).toBe(true);
    const c = buildCharacter(s.player.level, s.gear);
    expect(c.weightUsed).toBe(0); // nothing worn, nothing in the bag yet
    expect(c.encumbrance).toBe(0);
  });

  it('weighs minute one exactly the way the data prices the kit', () => {
    const s = newGame();
    const bottles = Object.values(E.opening.potions as Record<string, number>).reduce((t, n) => t + n, 0);
    const c = buildCharacter(s.player.level, s.gear, carried(s));
    // the same carried() the HUD feeds the character — pocket weight is data × count, never a guess
    expect(c.weightUsed).toBe(bottles * E.potions.weight);
    expect(c.weightCap).toBe(eng.weightCapacityOf(c.core.str));
    expect(c.encumbrance).toBe(eng.encumbranceOf(c.weightUsed, c.core.str));
    expect(c.aspd).toBeCloseTo(eng.aspdOf(c.core.agi, c.weaponAspd, c.lines.aspdPct) * (1 - c.encumbrance), 8);
  });
});

describe('the tick loop', () => {
  it('kills on-level mobs and pays the XP the curve says', () => {
    const s = newGame();
    huntZone(s, s.zone);
    // tick until the loop has paid a kill, never for a guessed window: a fixed window is a time
    // premise (AGENTS.md). The bound is a hang guard.
    for (let i = 0; i < 20000 && s.counters.kills === 0; i++) tick(s, {});
    expect(s.counters.kills).toBeGreaterThan(0);
    expect(s.player.xp).toBeGreaterThan(0);
    expect(Number.isFinite(s.player.hp)).toBe(true);
    expect(s.player.hp).toBeLessThanOrEqual(buildCharacter(s.player.level, s.gear).maxHp + 1);
  });

  it('Pushes instead of dying, and the walk-back costs time only', () => {
    const s = newGame();
    s.player.hp = 1;
    s.player.es = 0;
    let guard = 0;
    while (s.phase !== 'camp' && guard++ < 600) tick(s, {});
    expect(s.counters.pushes).toBeLessThanOrEqual(1);
    const c = buildCharacter(s.player.level, s.gear);
    if (s.phase === 'camp') {
      expect(s.player.hp).toBe(0);
      expect(s.campSec).toBe(Math.ceil(c.maxHp / (c.hpRegen * 8)));
    }
  });

  it('is reproducible from the seed, so a save cannot be rerolled', () => {
    const a = newGame(4242);
    const b = newGame(4242);
    // the premise is the same SEQUENCE on both saves, so it stops at the same state either reaches
    for (let i = 0; i < 20000 && a.counters.kills === 0; i++) { tick(a, {}); tick(b, {}); }
    expect(a.counters.kills).toBe(b.counters.kills);
    expect(a.player.level).toBe(b.player.level);
  });

  it('credits the whole absence beyond the former twelve-hour limit', () => {
    const s = newGame();
    const away = 13 * 3600;
    const r = catchUp(s, away);
    expect(r.simulated).toBe(away);
    expect(s.clockSec).toBe(away);
    expect(r.capped).toBe(false);
  }, 120000);
});
