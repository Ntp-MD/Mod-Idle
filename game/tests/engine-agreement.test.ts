import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { eng, E, BASES } from '../src/engine/client';
import { buildCharacter, openingGear } from '../src/sim/player';
import { newGame, tick, catchUp, huntZone } from '../src/sim/game';

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

});


describe('the opening character is the designed minute one', () => {
  it('comes from engine.json opening, not a typed copy', () => {
    const s = newGame();
    expect(s.player.level).toBe(E.opening.level);
    expect(s.zone).toBe(E.opening.settlement_zone);
    expect(s.counters.gold).toBe(E.opening.gold);
    const c = buildCharacter(s.player.level, s.gear);
    // the array is slot-ordered, so the worn set is read by slot, never by index
    const piece = (slot: string) => s.gear.find((g) => g && g.slot === slot)!;
    const item = piece('main hand');
    expect(c.phys).toBe(eng.physOf(eng.statAt(1), item.lines[0].value, 0, c.weaponAspd));
    expect(c.weaponAspd).toBe(1.2);
  });

  it('dresses the character in the whole set: one line per slot, no attack power, no tax', () => {
    const s = newGame();
    const worn = s.gear.filter(Boolean);
    expect(worn.length).toBe(E.stat.item_slots); // every slot the data declares is filled
    for (const item of worn) {
      expect(item!.lines.length).toBe(1); // a hand-authored junk piece: its frame's Frame Mod, nothing else
      expect(item!.ilvl).toBe(E.opening.level);
      if (item!.slot !== 'main hand') expect(item!.lines[0].extra).toBeUndefined();
    }
    const c = buildCharacter(s.player.level, s.gear);
    expect(c.encumbrance).toBe(0); // the lightest frame of every slot fits under the weight_base line
    // and nothing outside the main hand feeds the attack side the curve is priced against
    expect(c.phys).toBeGreaterThan(0);
  });

  it('weighs minute one exactly the way gate OP6 weighs it', () => {
    const s = newGame();
    const c = buildCharacter(s.player.level, s.gear);
    const held = s.gear.find((g) => g && g.slot === 'main hand')!;
    const setWeight = s.gear.reduce((t, g) => t + (g?.weight || 0), 0);
    // the same calls the cage makes — if the client and the cage ever disagree about the opening set,
    // this fails before a doc can print a speed the game cannot produce
    expect(c.weightUsed).toBe(setWeight);
    expect(c.weightUsed).toBe(eng.weaponWeightOf(BASES, held.base, held.slot)
      + s.gear.filter((g) => g && g.slot !== 'main hand').reduce((t, g) => t + (g!.weight || 0), 0));
    expect(c.weightCap).toBe(eng.weightCapacityOf(c.core.str));
    expect(c.encumbrance).toBe(eng.encumbranceOf(c.weightUsed, c.core.str));
    expect(c.aspd).toBeCloseTo(eng.aspdOf(c.core.agi, c.weaponAspd, c.lines.aspdPct) * (1 - c.encumbrance), 8);
    // eslint-disable-next-line no-console
    console.log(`minute one: ${c.weightUsed} weight on a ${c.weightCap} capacity (Str ${c.core.str})`
      + ` · tax ${(c.encumbrance * 100).toFixed(2)}% · ${c.aspd.toFixed(2)} aspd = ${c.hitsPerSec.toFixed(3)} hits/sec`
      + ` · the cage's figure at Str ${eng.statAt(1)} is ${(eng.encumbranceOf(eng.weaponWeightOf(BASES, held.base, 'main hand'), eng.statAt(1)) * 100).toFixed(2)}%`);
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

  it('caps offline catch-up at the published limit', () => {
    const s = newGame();
    const r = catchUp(s, {}, 24 * 3600);
    expect(r.simulated).toBe(E.inventory.offline_cap_hr * 3600);
    expect(r.capped).toBe(true);
  }, 120000); // the capped hours are real ticks, and the suite runs them beside the long measurements
});
