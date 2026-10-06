import { describe, it, expect } from 'vitest';
import { sm } from '../src/engine/client';
import { buildCharacter, emptyGear } from '../src/sim/player';
import { mobSwing, playerSwing } from '../src/sim/combat';
import { newCurses, applyCurse, modsOn, tickCurses, psMult, accMult, takenMult, NO_CURSE, curableRows } from '../src/sim/curse';
import { mulberry32 } from '../src/engine/client-helpers';
import { newGame, tick, setLevel } from '../src/sim/game';
import type { Mob } from '../src/sim/types';

const row = (id: string) => sm.byId[id];
const valueOf = (id: string, stat: string) =>
  row(id).effects.find((e: any) => e.stat === stat).value;

const mobOf = (over: Partial<Mob> = {}): Mob => ({
  id: 'mob-1', species: 'Rat', kind: 'Small', zone: 1, level: 20,
  hp: 100000, hpMax: 100000, ps: 500, acc: 500, evasion: 100, dodgeRate: 0,
  armour: 0, res: 0, damage: 'mixed', innate: ['fire'], xp: 10, line: 'front',
  hitsPerSec: 1, atkTimer: 0, engageSec: 0, ...over,
} as Mob);

function cursed(...ids: string[]) {
  const store = newCurses();
  for (const id of ids) applyCurse(store, 'mob-1', row(id));
  return store;
}

describe('a curse writes its own row onto the mob', () => {
  it('stores the row values and the row duration, per mob', () => {
    const store = newCurses();
    const sec = applyCurse(store, 'mob-1', row('curse.weaken'));
    expect(sec).toBe(Number(String(row('curse.weaken').duration).match(/\d+/)?.[0]));
    expect(modsOn(store, 'mob-1').damageDealt).toBe(valueOf('curse.weaken', 'damage_dealt'));
    expect(modsOn(store, 'mob-2').damageDealt).toBe(0); // another mob carries nothing
    expect(store['mob-1'].damage_dealt.secLeft).toBe(sec);
  });

  it('refreshes the same line instead of stacking it, and adds a different one', () => {
    const twice = cursed('curse.weaken', 'curse.weaken');
    expect(modsOn(twice, 'mob-1').damageDealt).toBe(valueOf('curse.weaken', 'damage_dealt'));
    const both = cursed('curse.weaken', 'curse.cripple');
    const m = modsOn(both, 'mob-1');
    expect(m.damageDealt).toBe(valueOf('curse.weaken', 'damage_dealt'));
    expect(m.attackSpeed).toBe(valueOf('curse.cripple', 'attack_speed'));
    // -25% damage and -20% swing rate both shrink a DPS-priced mob, and they compound
    expect(psMult(m)).toBeCloseTo(0.75 * 0.8, 10);
  });

  it('keeps every magnitude it took from the roster text', () => {
    expect(accMult(modsOn(cursed('curse.blinding_mark'), 'mob-1'))).toBe(1 + valueOf('curse.blinding_mark', 'accuracy') / 100);
    expect(takenMult(modsOn(cursed('curse.expose'), 'mob-1'))).toBe(1 + valueOf('curse.expose', 'damage_taken') / 100);
    // the count is read from the roster, not typed: any curse whose row states a target number is in.
    // An attack that states a target number (Puncture, Flame Wisp) writes stacks through the mob's
    // status store instead, so it is not in the list the panel offers to cure.
    expect(curableRows().length).toBe(
      sm.all().filter((s: any) => s.type === 'curse' && (s.effects || []).some((e: any) => e.subject === 'target')).length);
    expect(curableRows().length).toBeGreaterThan(5); // the status curses joined them 
  });
});

describe('the fight feels it', () => {
  const c = buildCharacter(60, emptyGear());

  it('Weaken and Cripple land as less incoming damage, swing for swing', () => {
    const mob = mobOf();
    const clean = mobSwing(mulberry32(9), c, mob, {}, NO_CURSE);
    const weak = mobSwing(mulberry32(9), c, mob, {}, modsOn(cursed('curse.weaken'), 'mob-1'));
    expect(weak.raw).toBeCloseTo(clean.raw * 0.75, 6);
    const slow = mobSwing(mulberry32(9), c, mob, {}, modsOn(cursed('curse.cripple'), 'mob-1'));
    expect(slow.raw).toBeCloseTo(clean.raw * 0.8, 6);
  });

  it('Blinding Mark costs the mob accuracy on both rolls it feeds', () => {
    const acc = mobOf({ acc: 900, evasion: 5000 });
    let misses = 0;
    let cursedMisses = 0;
    const mods = modsOn(cursed('curse.blinding_mark'), 'mob-1');
    for (let i = 0; i < 400; i++) {
      const rng = mulberry32(1000 + i);
      if (mobSwing(rng, c, acc, {}, NO_CURSE).blocked === 'evasion') misses++;
      if (mobSwing(rng, c, acc, {}, mods).blocked === 'evasion') cursedMisses++;
    }
    expect(cursedMisses).toBeGreaterThan(misses);
  });

  it('Expose raises our hit on that mob alone', () => {
    const target = mobOf({ id: 'mob-1' });
    const other = mobOf({ id: 'mob-2' });
    const store = cursed('curse.expose');
    let seed = 1; // a hit that misses has no damage to compare, so find one that lands
    while (playerSwing(mulberry32(seed), c, target, null, NO_CURSE).damage === 0) seed++;
    const clean = playerSwing(mulberry32(seed), c, target, null, NO_CURSE).damage;
    const cursedDmg = playerSwing(mulberry32(seed), c, target, null, modsOn(store, 'mob-1')).damage;
    const elsewhere = playerSwing(mulberry32(seed), c, other, null, modsOn(store, 'mob-2')).damage;
    expect(clean).toBeGreaterThan(0);
    expect(cursedDmg).toBeCloseTo(clean * 1.2, 6);
    expect(elsewhere).toBeCloseTo(clean, 6);
  });

  it('Jinx lands crits it would not have landed before', () => {
    const target = mobOf({ id: 'mob-1' });
    const mods = modsOn(cursed('curse.jinx'), 'mob-1');
    expect(mods.critChance).toBe(valueOf('curse.jinx', 'crit_chance'));
    let clean = 0;
    let jinxed = 0;
    for (let i = 0; i < 400; i++) {
      if (playerSwing(mulberry32(2000 + i), c, target, null, NO_CURSE).crit) clean++;
      if (playerSwing(mulberry32(2000 + i), c, target, null, mods).crit) jinxed++;
    }
    expect(jinxed).toBeGreaterThan(clean);
  });
});

describe('the clock runs out', () => {
  it('each line lapses on its own row duration', () => {
    const store = cursed('curse.weaken');
    const secs = row('curse.weaken').duration;
    const live = new Set(['mob-1']);
    for (let i = 0; i < Number(String(secs).match(/\d+/)?.[0]); i++) tickCurses(store, live);
    expect(store['mob-1']).toBeUndefined();
    expect(modsOn(store, 'mob-1').damageDealt).toBe(0);
  });

  it('forgets a mob that left the field', () => {
    const store = cursed('curse.weaken');
    tickCurses(store, new Set<string>());
    expect(Object.keys(store).length).toBe(0);
  });

  it('the sim attaches a landed curse and its log says so', () => {
    const s = newGame(61);
    setLevel(s, 50);
    s.zone = 4;
    s.skills.owned['curse.weaken'] = 1;
    s.skills.list[0] = 'curse.weaken';
    let guard = 0;
    while (!s.group.length && guard++ < 30) tick(s, {});
    expect(s.group.length).toBeGreaterThan(0);
    s.player.mana = buildCharacter(s.player.level, s.gear, {}, 0).maxMana;
    guard = 0;
    while (!Object.keys(s.curses).length && guard++ < 60) {
      s.player.mana = buildCharacter(s.player.level, s.gear, {}, 0).maxMana;
      tick(s, {});
    }
    expect(Object.keys(s.curses).length).toBe(1);
    expect(s.log.some((l) => /Weaken lands for \d+ sec/.test(l.text))).toBe(true);
    expect(modsOn(s.curses, Object.keys(s.curses)[0]).damageDealt).toBe(valueOf('curse.weaken', 'damage_dealt'));
  });
});
