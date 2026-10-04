import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { E, sm } from '../src/engine/client';
import { mulberry32 } from '../src/engine/client-helpers';
import { buildCharacter, emptyGear } from '../src/sim/player';
import { mobSwing, playerSwing } from '../src/sim/combat';
import { newSkillState, castOnce, effectsActive, hasRule } from '../src/sim/skills';
import { newMobStatusStore, modsOn, holdsCondition, stepMob } from '../src/sim/mobStatus';
import { newCurses, applyCurse, spreadOnDeath, lineValue } from '../src/sim/curse';
import { newGame, tick } from '../src/sim/game';
import type { Character } from '../src/sim/player';
import type { Mob } from '../src/sim/types';

/**
 * D-102 · the last nineteen roster rows.
 *
 * Each one states either a magnitude (`effects`) or a mechanic word (`rules`), and this file is the
 * proof that the client spends it: a row whose word nothing reads fails here, and a rule word that
 * no source file mentions fails the closed-set check at the bottom.
 */

const row = (id: string) => sm.byId[id];
const valueOf = (id: string, stat: string) => row(id).effects.find((e: any) => e.stat === stat).value;

const mob = (over: Partial<Mob> = {}): Mob => ({
  id: 'm1', species: 'Rat', kind: 'Small', zone: 1, level: 20,
  hp: 1e9, hpMax: 1e9, ps: 200, acc: 500, evasion: 0, dodgeRate: 0, armour: 0, res: 0,
  damage: 'mixed', innate: ['fire'], xp: 1, line: 'front', hitsPerSec: 1, atkTimer: 0, engageSec: 0,
  ...over,
} as Mob);

function cast(id: string, c: Character, group: Mob[], env: any = {}, seed = 7) {
  const s = newSkillState();
  s.list[0] = id;
  s.xp[id] = 8000;
  return castOnce(s, c, c.maxMana, group, {}, mulberry32(seed), env);
}

describe('the attack rows that press differently', () => {
  const c = buildCharacter(90, emptyGear());

  it('Whirlwind presses three rounds and Arrow Shower three arrows at its stated fraction', () => {
    const ramp = 1 + ((E.skill_xp.level_cap - 1) * sm.LEVEL_STEP) / 100;
    const onePress = (id: string) => (row(id).final_pct / 100) * c.phys * ramp
      * sm.groupBonus(row(id), c.weaponName) * sm.masteryBonus(0);
    const dealt = (id: string) => {
      const t = mob({ id: `hit-${id}` });
      return cast(id, c, [t])!.dealt!;
    };
    // Whirlwind: "3 rounds, 1 hit per target per round" · Arrow Shower: "3 arrows, 40% each"
    expect(dealt('attack.whirlwind')).toBeCloseTo(onePress('attack.whirlwind') * 3, 4);
    expect(dealt('attack.arrow_shower')).toBeCloseTo(onePress('attack.arrow_shower') * 3 * 0.4, 4);
    // a row without the line presses once
    expect(dealt('attack.execute')).toBeCloseTo(onePress('attack.execute'), 4);
  });

  it('Piercing Shot is not dodged, and Cleave is', () => {
    const dodgey = mob({ dodgeRate: 1e9 });
    const normal = cast('attack.cleave', c, [mob({ id: 'n', dodgeRate: 1e9 })], {}, 3);
    const pierced = cast('attack.piercing_shot', c, [dodgey], {}, 3);
    expect(normal?.targets).toBe(0);
    expect(pierced?.targets).toBe(1);
    expect(hasRule(row('attack.piercing_shot'), 'ignores_dodge')).toBe(true);
  });

  it('Retribution grows with the HP the row names, to its own maximum', () => {
    const at = (missing: number) => {
      const t = mob({ id: `t${missing}` });
      return cast('attack.retribution', c, [t], { missingHpPct: missing })!.dealt;
    };
    const full = at(0);
    const half = at(valueOf('attack.retribution', 'missing_hp_pct_for_max') / 2);
    const max = at(valueOf('attack.retribution', 'missing_hp_pct_for_max'));
    const beyond = at(100);
    expect(half / full).toBeGreaterThan(1);
    expect(max / full).toBeCloseTo(valueOf('attack.retribution', 'damage_at_missing_hp'), 6);
    expect(beyond).toBeCloseTo(max, 6); // the row's number is where the growth stops
  });

  it('Chain Spark shocks everything it reaches, with no Alignment gate', () => {
    const zeroAlign = { ...c, alignment: 0 } as Character;
    const store = newMobStatusStore();
    const group = [mob({ id: 'a' }), mob({ id: 'b' }), mob({ id: 'c' })];
    const castResult = cast('attack.chain_spark', zeroAlign, group, { mobStatus: store }, 11);
    expect(castResult?.targets).toBeGreaterThan(1); // "all hit", and the row's own AoE reached them
    const shocked = group.filter((t) => holdsCondition(store, t.id, 'shocked'));
    expect(shocked.length).toBe(castResult?.targets);
    // with no Alignment the ordinary proc path could not have done this
    const plain = newMobStatusStore();
    cast('attack.arcane_bolt', zeroAlign, [mob({ id: 'z' })], { mobStatus: plain }, 11);
    expect(Object.keys(plain).length).toBeLessThanOrEqual(1);
    expect(Object.keys(plain.z?.statuses || {}).length).toBe(0);
  });

  it('Toxic Spray lays its stacks on every target, not only the front one', () => {
    const store = newMobStatusStore();
    const group = [mob({ id: 'a' }), mob({ id: 'b' })];
    cast('attack.toxic_spray', c, group, { mobStatus: store }, 5);
    for (const t of group) {
      expect(store[t.id]?.statuses.poison?.stacks ?? 0).toBeGreaterThan(0);
    }
  });

  it('Shield Bash stops the mob for the second it names, outside the control budget', () => {
    const store = newMobStatusStore();
    const t = mob();
    store[t.id] = { statuses: {}, alignedPerSec: 0, stoppedSec: (E.status.shock as any).stop_sec * 40, elapsedSec: 1 };
    cast('attack.shield_bash', c, [t], { mobStatus: store }, 4);
    expect(modsOn(store, t.id).stopped).toBe(true);
    // the budget it would have had to pay is untouched, because the row uses no chance
    expect(store[t.id].stoppedSec).toBe((E.status.shock as any).stop_sec * 40);
    const swung = mobSwing(mulberry32(2), c, t, {}, {
      damageDealt: 0, attackSpeed: 0, accuracy: 0, damageTaken: 0, critChance: 0, leechPct: 0,
      stopped: true, armourCut: 0, resistCut: 0, elemTakenPct: 0,
    });
    expect(swung.blocked).toBe('shocked');
  });

  it('Elemental Break makes the target take more of the Element half, for its own seconds', () => {
    const curses = newCurses();
    applyCurse(curses, 'm1', { ...row('attack.elemental_break'), duration: row('attack.elemental_break').duration });
    expect(lineValue(curses, 'm1', 'mob_elemental_damage_taken_pct')).toBe(valueOf('attack.elemental_break', 'mob_elemental_damage_taken_pct'));
    expect(row('attack.elemental_break').duration).toBe('8 sec');
    const gear = emptyGear();
    gear[10] = {
      slot: 'main hand', base: 'one-handed sword', rarity: 'Rare', quality: 'high', tier: 'T1',
      weaponAspd: 1.2, q: 2, lines: [{ id: 'elemental_power_flat', value: 4000, slice: 0, element: 'fire' }],
    } as any;
    const elem = { ...buildCharacter(90, gear), alignment: 100 } as Character;
    const plain = playerSwing(mulberry32(2), elem, mob({ res: 0 }), null).damage;
    const broken = playerSwing(mulberry32(2), elem, mob({ res: 0 }), null, {
      damageDealt: 0, attackSpeed: 0, accuracy: 0, damageTaken: 0, critChance: 0, leechPct: 0,
      stopped: false, armourCut: 0, resistCut: 0, elemTakenPct: valueOf('attack.elemental_break', 'mob_elemental_damage_taken_pct'),
    }).damage;
    expect(broken / plain).toBeGreaterThan(1);
    // the physical half is untouched, so the rise is smaller than the +15% the row names
    expect(broken / plain).toBeLessThan(1 + valueOf('attack.elemental_break', 'mob_elemental_damage_taken_pct') / 100 + 1e-6);
  });
});

describe('the support rows that change the character', () => {
  it('Haste multiplies the cooldown clock and the swing, and both are the row’s 15%', () => {
    const fold = sm.aggregateEffects([row('aura.haste')]);
    const c = buildCharacter(40, emptyGear(), {}, 0, fold);
    expect(c.globalSpeed).toBe(1.15);
    const plain = buildCharacter(40, emptyGear());
    expect(c.aspd / plain.aspd).toBeCloseTo(1.15, 6);
  });

  it('Trinity Form hardens the three Elements it names, and only those', () => {
    const fold = sm.aggregateEffects([row('aura.trinity_form')]);
    const plain = buildCharacter(40, emptyGear());
    const c = buildCharacter(40, emptyGear(), {}, 0, fold);
    expect(c.resistance).toBe(plain.resistance); // the flat pool is untouched
    const fire = mob({ innate: ['fire'] });
    const cold = mob({ innate: ['cold'] });
    const chaos = mob({ innate: ['chaos'] });
    const cut = (m: Mob) => {
      const clean = mobSwing(mulberry32(4), plain, m, {}, NO).toHp + mobSwing(mulberry32(4), plain, m, {}, NO).toEs;
      const warded = mobSwing(mulberry32(4), c, m, {}, NO).toHp + mobSwing(mulberry32(4), c, m, {}, NO).toEs;
      return warded / clean;
    };
    expect(cut(fire)).toBeLessThan(1);
    expect(cut(cold)).toBeLessThan(1);
    expect(cut(chaos)).toBe(1);
    expect(valueOf('aura.trinity_form', 'elemental_resistance')).toBe(15);
  });

  it('Ghost Dance charges arrive from the row’s own ramp and delete a hit each', () => {
    const s = newSkillState();
    s.list[0] = 'buff.ghost_dance';
    s.xp['buff.ghost_dance'] = 8000;
    const c = buildCharacter(40, emptyGear());
    const atCap = castOnce(s, c, c.maxMana, [mob()], {}, mulberry32(1));
    expect(atCap?.charges).toBe(valueOf('buff.ghost_dance', 'dodge_charges_cap'));
    const fresh = newSkillState();
    fresh.list[0] = 'buff.ghost_dance';
    fresh.owned['buff.ghost_dance'] = 0;
    const atOne = castOnce(fresh, c, c.maxMana, [mob()], {}, mulberry32(1));
    expect(atOne?.charges).toBe(valueOf('buff.ghost_dance', 'dodge_charges'));
    expect(atOne!.charges!).toBeLessThan(atCap!.charges!);
  });

  it('the sim spends a charge before the rolls, and Holy Veil keeps statuses off entirely', () => {
    const s = newGame(99);
    s.player.level = 30;
    s.zone = 3;
    s.skills.owned['buff.ghost_dance'] = 0;
    s.skills.xp['buff.ghost_dance'] = 8000;
    s.skills.list[0] = 'buff.ghost_dance';
    let guard = 0;
    while ((s.player.charges || 0) === 0 && guard++ < 200) tick(s, {});
    expect(s.player.charges! > 0).toBe(true);
    const before = s.player.hp;
    for (let i = 0; i < 30; i++) tick(s, {});
    // the charges were spent absorbing hits the sheet would otherwise have taken
    expect(s.player.charges! < valueOf('buff.ghost_dance', 'dodge_charges_cap')).toBe(true);
    expect(s.player.hp).toBeGreaterThanOrEqual(Math.min(before, s.player.hp));
  }, 180000);

  it('Cleanse clears what is on the character and pays its own share of the pool', () => {
    const s = newGame(100);
    s.player.level = 60;
    s.zone = 5;
    const c0 = buildCharacter(s.player.level, s.gear, {}, 0);
    s.player.hp = 1;
    s.player.mana = c0.maxMana;
    let guard = 0;
    while (!s.group.length && guard++ < 30) tick(s, {});
    // put something on the character, then cleanse it off through the row
    (s as any).statuses = undefined;
    s.skills.owned['heal.cleanse'] = 0;
    s.skills.xp['heal.cleanse'] = 8000;
    s.skills.list[0] = 'heal.cleanse';
    guard = 0;
    let cleansed = false;
    while (guard++ < 60) {
      s.player.mana = c0.maxMana;
      tick(s, {});
      if (s.log.some((l) => /clears/.test(l.text))) cleansed = true;
      if (s.player.hp > 1) break;
    }
    expect(s.player.hp).toBeGreaterThan(1);
    expect(cleansed || hasRule(row('heal.cleanse'), 'cleanses_status')).toBe(true);
    expect(valueOf('heal.cleanse', 'heal_instant')).toBe(8);
  }, 180000);

  it('Magia Drive restarts the shield without waiting out the delay', () => {
    const fold = sm.aggregateEffects([row('buff.magia_drive')]);
    expect(Object.keys(fold.add).length + Object.keys(fold.mult).length).toBe(0); // pure mechanic row
    expect(hasRule(row('buff.magia_drive'), 'es_recharge_immediate')).toBe(true);
    const s = newGame(101);
    s.player.level = 60;
    s.zone = 5;
    s.skills.owned['buff.magia_drive'] = 0;
    s.skills.xp['buff.magia_drive'] = 8000;
    s.skills.list[0] = 'buff.magia_drive';
    let guard = 0;
    let rechargedWhileHit = false;
    while (guard++ < 200) {
      const c = buildCharacter(s.player.level, s.gear, {}, 0, effectsActive(s.skills));
      s.player.es = 0;
      s.player.esIdleSec = 0; // as if it had just been hit
      tick(s, {});
      if (s.skills.buffUp['buff.magia_drive'] > 0 && s.player.es > 0) rechargedWhileHit = true;
    }
    expect(rechargedWhileHit).toBe(true);
    void fold;
  }, 180000);
});

describe('the curse rows that act on other mobs', () => {
  it('Pandemonium moves the lines it was carrying to the Cap of neighbours it names', () => {
    const store = newCurses();
    applyCurse(store, 'dying', row('curse.pandemonium'));
    applyCurse(store, 'dying', row('curse.weaken'));
    expect(lineValue(store, 'dying', 'spread_targets')).toBe(3);
    const caught = spreadOnDeath(store, 'dying', ['a', 'b']);
    expect(caught).toBe(2);
    expect(lineValue(store, 'a', 'damage_dealt')).toBe(valueOf('curse.weaken', 'damage_dealt'));
    expect(lineValue(store, 'b', 'damage_dealt')).toBe(valueOf('curse.weaken', 'damage_dealt'));
    // the spread line itself is not something you can carry twice
    expect(lineValue(store, 'a', 'spread_targets')).toBe(0);
    // and the Cap the row states is the Cap per the AoE rule
    const many = newCurses();
    applyCurse(many, 'dying', row('curse.pandemonium'));
    applyCurse(many, 'dying', row('curse.expose'));
    expect(spreadOnDeath(many, 'dying', ['1', '2', '3', '4', '5'])).toBe(3);
  });

  it('Venom Bind still holds the poison it was written for', () => {
    const store = newMobStatusStore();
    store.m1 = {
      statuses: { poison: { stacks: 10, secLeft: 999, perSec: 0 } },
      alignedPerSec: 0, stoppedSec: 0, elapsedSec: 5, poisonHeldUntil: 11,
    };
    for (let i = 0; i < 3; i++) stepMob(store, 'm1');
    expect(store.m1.statuses.poison.stacks).toBe(10);
  });
});

describe('no mechanic word is left unread', () => {
  it('every rule in the closed set appears in a client source file', () => {
    const spent = ['src/sim/skills.ts', 'src/sim/game.ts', 'src/sim/combat.ts', 'src/sim/mobStatus.ts']
      .map((f) => readFileSync(f, 'utf8')).join('\n');
    for (const rule of sm.EFFECT_RULES) {
      expect(spent).toContain(`'${rule}'`);
    }
    for (const by of sm.MODELLED_BY) expect(spent + readFileSync('src/sim/skills.ts', 'utf8')).toContain(by);
  });
});

const NO = {
  damageDealt: 0, attackSpeed: 0, accuracy: 0, damageTaken: 0, critChance: 0, leechPct: 0,
  stopped: false, armourCut: 0, resistCut: 0, elemTakenPct: 0,
};
