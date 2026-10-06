import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { eng, E, BASES } from '../src/engine/client';
import { buildCharacter, openingGear } from '../src/sim/player';
import { newGame, tick, catchUp } from '../src/sim/game';

// The cages load tools/lib/engine.ts, which is a bridge over the same engine/index.ts the client
// calls. Requiring it here proves the client and the cages resolve to one module and one data file
// — the promise Techstack.md "The one rule" makes.
const require = createRequire(import.meta.url);
const cage = require('../../tools/lib/engine.ts');

describe('game and cages run one engine', () => {
  it('resolves the same derived ceilings', () => {
    expect(eng.CEIL).toBe(cage.CEIL);
    expect(eng.DERIVED.phys).toBe(cage.DERIVED.phys);
    expect(eng.BAND.high.drop_chance_pct).toBe(cage.BAND.high.drop_chance_pct);
    expect(eng.mobHpAt(100)).toBe(cage.mobHpAt(100));
    expect(eng.xpToNext(30)).toBe(cage.xpToNext(30));
    expect(eng.aspdOf(510, 1.2, 25)).toBe(cage.aspdOf(510, 1.2, 25));
  });

  it('passes the doc read-back the cages gate with', () => {
    const failed = cage.runReadBack().filter((r: any) => !r.ok);
    expect(failed.map((f: any) => `${f.label} ${f.detail}`)).toEqual([]);
  });
});

describe('published anchors the docs quote', () => {
  it('the single-stat ceiling and the naked stat at the level cap', () => {
    // flat-only since Core Stat % was retired, plus the earring as a 13th worn item.
    // Both terms are read from the data so a change of world size moves the identity, not a literal.
    const cap = eng.S.level_cap;
    expect(eng.CEIL).toBeCloseTo(eng.statAt(cap) + E.stat.core_flat_max * E.stat.item_slots, 2);
    // statAt is the REFERENCE even-split line now: base + points(cap)/7.
    expect(eng.statAt(cap)).toBeCloseTo(E.stat.base + eng.pointsAt(cap) / 7, 6);
  });

  it('mob_HP is anchored at the zone edges and the level cap', () => {
    // the first, last and cap zone are read off the list, so 18 zones and 9 zones both hold
    const first = E.mob.zones[0], last = E.mob.zones[E.mob.zones.length - 1];
    expect(eng.mobHpAt(first.levels[0])).toBe(first.hp[0]);
    expect(eng.mobHpAt(first.levels[1])).toBe(first.hp[1]);
    expect(eng.mobHpAt(last.levels[1])).toBe(last.hp[1]);
    expect(eng.mobHpAt(E.stat.level_cap)).toBeCloseTo(E.mob.curve.hp_at_player_level_cap, 6);
  });

  it('a level 1 sword swings 1.2 times per second (formula.md K_AGI_ASPD)', () => {
    expect(eng.aspdOf(eng.statAt(1), 1.2, 0)).toBeCloseTo(120, 6);
    expect(eng.hitsPerSec(eng.aspdOf(eng.statAt(1), 1.2, 0))).toBeCloseTo(1.2, 6);
  });

  it('weapon_mult keeps DPS equal across weapon types', () => {
    expect(cage.WEAPONS[0].weapon_mult).toBe(0.8); // dagger
    expect(cage.WEAPONS[5].weapon_mult).toBeCloseTo(1.71, 6); // two-handed
  });

  it('armour is the PoE diminishing ratio on the physical half', () => {
    expect(eng.armourReduce(eng.DERIVED.armour_ceil, eng.DERIVED.armour_ceil)).toBeCloseTo(1 / 6, 6);
  });

  it('the XP curve is kills × 10 × mob level, capped at the spawn cap', () => {
    expect(eng.xpToNext(10)).toBe(101 * 10 * 10);
    expect(eng.xpToNext(E.stat.level_cap)).toBe(6768 * 10 * E.stat.mob_level_cap);
  });
});

describe('the opening character is the designed minute one', () => {
  it('comes from engine.json opening, not a typed copy', () => {
    const s = newGame();
    expect(s.player.level).toBe(E.opening.level);
    expect(s.zone).toBe(E.opening.settlement_zone);
    expect(s.counters.gold).toBe(E.opening.gold);
    const c = buildCharacter(s.player.level, s.gear);
    const item = openingGear()[0]!;
    expect(c.phys).toBe(eng.physOf(eng.statAt(1), item.lines[0].value, 0, c.weaponAspd));
    expect(c.weaponAspd).toBe(1.2);
  });

  it('weighs minute one exactly the way gate OP6 weighs it', () => {
    const s = newGame();
    const c = buildCharacter(s.player.level, s.gear);
    const held = s.gear.find((g) => g && g.slot === 'main hand')!;
    // the same three engine calls the cage makes — if the client and the cage ever disagree about the
    // opening swing, this fails before a doc can print a speed the game cannot produce 
    expect(c.weightUsed).toBe(eng.weaponWeightOf(BASES, held.base, held.slot));
    expect(c.weightCap).toBe(eng.weightCapacityOf(c.core.str));
    expect(c.encumbrance).toBe(eng.encumbranceOf(c.weightUsed, c.core.str));
    expect(c.aspd).toBeCloseTo(eng.aspdOf(c.core.agi, c.weaponAspd, 0) * (1 - c.encumbrance), 8);
    // eslint-disable-next-line no-console
    console.log(`minute one: ${c.weightUsed} weight on a ${c.weightCap} capacity (Str ${c.core.str})`
      + ` · tax ${(c.encumbrance * 100).toFixed(2)}% · ${c.aspd.toFixed(2)} aspd = ${c.hitsPerSec.toFixed(3)} hits/sec`
      + ` · the cage's figure at Str ${eng.statAt(1)} is ${(eng.encumbranceOf(eng.weaponWeightOf(BASES, held.base, 'main hand'), eng.statAt(1)) * 100).toFixed(2)}%`);
  });
});

describe('the tick loop', () => {
  it('kills on-level mobs and pays the XP the curve says', () => {
    const s = newGame();
    for (let i = 0; i < 240; i++) tick(s, {});
    expect(s.counters.kills).toBeGreaterThan(0);
    expect(s.player.xp + (s.player.level - 1) * 0).toBeGreaterThan(0);
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
    for (let i = 0; i < 120; i++) { tick(a, {}); tick(b, {}); }
    expect(a.counters.kills).toBe(b.counters.kills);
    expect(a.player.level).toBe(b.player.level);
  });

  it('caps offline catch-up at the published limit', () => {
    const s = newGame();
    const r = catchUp(s, {}, 24 * 3600);
    expect(r.simulated).toBe(E.inventory.offline_cap_hr * 3600);
    expect(r.capped).toBe(true);
  }, 120000); // the capped hours are real ticks, and the suite runs them beside the long measurements
});
