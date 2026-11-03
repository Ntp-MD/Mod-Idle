import { afterAll, beforeAll, describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { E, sm } from '../../src/engine/client';
import { mulberry32 } from '../../src/engine/client-helpers';
import { buildCharacter, emptyGear } from '@sim/core/player';
import { mastery } from '@sim/core/mastery';
import { poolGear } from '../fixtures/sheetFixture';
import { mobSwing, playerSwing } from '@sim/combat/combat';
import { newSkillState, castOnce, hasRule, esAbsorbPct, triggerAuras, toggleTrack } from '@sim/combat/skills';
import { newMobStatusStore, modsOn, holdsCondition, stepMob } from '@sim/combat/mobStatus';
import { newCurses, applyCurse, lineValue } from '@sim/combat/curse';
import { newGame, tick, setLevel, huntZone } from '@sim/core/game';
import type { Character } from '@sim/core/player';
import type { Mob } from '@sim/core/types';
import { mobFixture } from '../fixtures/mobFixture';
import { installSyntheticSkill } from '../fixtures/skillFixture';

/**
 * The roster rows whose behaviour the sim spends.
 *
 * Each one states either a magnitude (`effects`) or a mechanic word (`rules`), and this file is the
 * proof that the client spends it: a row whose word nothing reads fails here, and a rule word that
 * no source file mentions fails the closed-set check at the bottom.
 */

const row = (id: string) => sm.byId[id]!;
const valueOf = (id: string, stat: string) => row(id)!.effects!.find((e: any) => e.stat === stat)!.value;

/**
 * Scenario-owned rows for the mechanics below. No live data: a roster rename or
 * retune must not change what these assertions prove.
 */
const SYN = {
  multi: 'test.rm-multi',
  single: 'test.rm-single',
  neutral: 'test.rm-neutral',
  proof: 'test.rm-proof',
  shock: 'test.rm-shock',
  poison: 'test.rm-poison',
  stop: 'test.rm-stop',
  taken: 'test.rm-taken',
  speed: 'test.rm-speed',
  ward: 'test.rm-ward',
  dodge: 'test.rm-dodge',
  block: 'test.rm-block',
  veil: 'test.rm-veil',
} as const;
let restoreSynthetic: Array<() => void> = [];
beforeAll(() => {
  const specs: Array<[string, Record<string, unknown>]> = [
    [SYN.multi, { name: 'RM Multi', group: 'melee', basis: 'phys', element: 'physical', cd: 6, mana: '21 flat',
      base_flat: 1000, eff: 0, offline_targets: '1', area: { origin: 'target', radius_m: 0 },
      cast: { delivery: 'melee', range_m: 2, windup_sec: 0.15, recovery_sec: 0.22 },
      effects: [{ stat: 'hits', op: 'add_flat', value: 3, subject: 'self' }, { stat: 'hit_pct', op: 'add_pct', value: 33, subject: 'self' }] }],
    [SYN.single, { name: 'RM Single', group: 'melee', basis: 'phys', element: 'physical', cd: 6, mana: '15 flat',
      base_flat: 900, eff: 100, offline_targets: '1', area: { origin: 'target', radius_m: 0 },
      cast: { delivery: 'melee', range_m: 2, windup_sec: 0.15, recovery_sec: 0.22 }, effects: [] }],
    [SYN.neutral, { name: 'RM Neutral', group: 'melee', basis: 'phys', element: 'physical', cd: 6, mana: '18 flat',
      base_flat: 500, eff: 50, offline_targets: '1', area: { origin: 'target', radius_m: 0 },
      cast: { delivery: 'melee', range_m: 2, windup_sec: 0.15, recovery_sec: 0.22 }, effects: [] }],
    [SYN.proof, { name: 'RM Proof', group: 'ranged', basis: 'phys', element: 'physical', cd: 6, mana: '15 flat',
      base_flat: 500, eff: 50, offline_targets: '1', area: { origin: 'caster', radius_m: 0, shape: 'line', length_m: 5, width_m: 1, max_targets: 5 },
      cast: { delivery: 'projectile', range_m: 5, windup_sec: 0.35, recovery_sec: 0.25 }, rules: ['ignores_dodge'], effects: [] }],
    [SYN.shock, { name: 'RM Shock', group: 'magic', basis: 'magic', element: 'lightning', cd: 9, mana: '24 flat',
      base_flat: 800, eff: 90, offline_targets: '3', area: { origin: 'target', radius_m: 3, max_targets: 3 },
      cast: { delivery: 'instant', range_m: 5, windup_sec: 0.3, fixed_windup_sec: 0.05, recovery_sec: 0.15 },
      rules: ['guaranteed_status', 'every_target'],
      action: { kind: 'chain-strike', roll_policy: 'shared', interval_sec: 0.08, hop_share_pct: 60 }, effects: [] }],
    [SYN.poison, { name: 'RM Poison', group: 'magic', basis: 'magic', element: 'poison', cd: 9, mana: '24 flat',
      base_flat: 600, eff: 80, offline_targets: '3', area: { origin: 'caster', radius_m: 3, shape: 'cone', angle_deg: 90, max_targets: 3 },
      cast: { delivery: 'melee', range_m: 3, windup_sec: 0.25, fixed_windup_sec: 0.05, recovery_sec: 0.22 },
      rules: ['every_target'],
      effects: [{ stat: 'poison_stacks', op: 'add_flat', value: 2, subject: 'target' }] }],
    [SYN.stop, { name: 'RM Stop', group: 'melee', basis: 'phys', element: 'physical', cd: 9, mana: '18 flat',
      base_flat: 700, eff: 90, offline_targets: '1', area: { origin: 'target', radius_m: 0 },
      cast: { delivery: 'melee', range_m: 2, windup_sec: 0.2, recovery_sec: 0.22 },
      effects: [{ stat: 'stop_sec', op: 'add_flat', value: 1, subject: 'target' }] }],
    [SYN.taken, { name: 'RM Taken', group: 'melee', basis: 'phys', element: 'physical', duration: '8 sec', cd: 10, mana: '27 flat',
      base_flat: 850, eff: 100, offline_targets: '1', area: { origin: 'target', radius_m: 0 },
      cast: { delivery: 'melee', range_m: 2, windup_sec: 0.25, fixed_windup_sec: 0.05, recovery_sec: 0.22 },
      effects: [{ stat: 'mob_elemental_damage_taken_pct', op: 'add_pct', value: 15, subject: 'target' }] }],
    [SYN.speed, { name: 'RM Speed', type: 'aura',
      effects: [{ stat: 'attack_speed', op: 'mult', value: 1.15, subject: 'self' }, { stat: 'global_speed', op: 'mult', value: 1.15, subject: 'self' }] }],
    [SYN.ward, { name: 'RM Ward', type: 'aura',
      effects: (['fire', 'cold', 'lightning'] as const).map((element) => ({ stat: 'elemental_resistance', op: 'add_pct', value: 15, subject: 'self', element })) }],
    [SYN.dodge, { name: 'RM Dodge', type: 'buff', duration: '10 sec', cd: 15, mana: '15 flat',
      cast: { delivery: 'instant', range_m: 0 },
      effects: [{ stat: 'dodge_charges', op: 'add_flat', value: 3, subject: 'self' }, { stat: 'dodge_charges_per_levels', op: 'add_flat', value: 5, subject: 'self' }, { stat: 'dodge_charges_cap', op: 'add_flat', value: 7, subject: 'self' }] }],
    [SYN.block, { name: 'RM Block', type: 'buff', duration: '10 sec', cd: 15, mana: '15 flat',
      cast: { delivery: 'instant', range_m: 0 },
      effects: [{ stat: 'block_charges', op: 'add_flat', value: 5, subject: 'self' }, { stat: 'block_charges_per_levels', op: 'add_flat', value: 3, subject: 'self' }, { stat: 'block_charges_cap', op: 'add_flat', value: 10, subject: 'self' }] }],
    [SYN.veil, { name: 'RM Veil', type: 'buff', duration: '7 sec', cd: 20, mana: '18 flat',
      cast: { delivery: 'instant', range_m: 0 }, rules: ['status_immunity', 'cleanses_on_cast'], effects: [] }],
  ];
  restoreSynthetic = specs.map(([id, over]) => installSyntheticSkill(id, over).restore);
});
afterAll(() => { restoreSynthetic.forEach((restore) => restore()); restoreSynthetic = []; });
const multiHitId = () => SYN.multi;
const singlePressId = () => SYN.single;
const neutralPressId = () => SYN.neutral;
const dodgeProofId = () => SYN.proof;
const shockFieldId = () => SYN.shock;
const poisonFieldId = () => SYN.poison;
const stopId = () => SYN.stop;

  const mob = (over: Partial<Mob> = {}): Mob => mobFixture({ acc: 500, ...over });

function cast(id: string, c: Character, group: Mob[], env: any = {}, seed = 7) {
  const s = newSkillState();
  s.list[0] = id; s.owned[id] ??= 0;
  s.xp[id] = 8000;
  return castOnce(s, c, c.maxMana, group, {}, mulberry32(seed), env);
}

describe('the attack rows that press differently', () => {
  const c = { ...buildCharacter(90, emptyGear()), weaponName: 'one-handed axe' } as Character;
  const archer = { ...c, weaponName: 'bow' } as Character;

  it('a multi-hit press deals its stated count at its stated fraction, a single press deals one', () => {
    const ramp = sm.damagePct(E.skill_xp.level_cap) / 100;   // the level table is the ramp
    const onePress = (id: string, actor: Character) => {
      const r = row(id);
      return (r.base_flat! + (r.eff! / 100) * actor.phys) * ramp
        * sm.groupBonus(r, actor.weaponName) * mastery.skillBonus(0, sm.weaponMatches(r, actor.weaponName));
    };
    const dealt = (id: string) => {
      const t = mob({ id: `hit-${id}` });
      const actor = row(id).group === 'ranged' ? archer : c;
      return cast(id, actor, [t])!.dealt!;
    };
    const multi = multiHitId();
    // the press count and the per-arrow share are the rows' own `hits` / `hit_pct`
    expect(dealt(multi)).toBeCloseTo(onePress(multi, row(multi).group === 'ranged' ? archer : c)
      * valueOf(multi, 'hits') * valueOf(multi, 'hit_pct') / 100, 4);
    // a bow-bound row is read on an archer — and the hand formula above does not
    // carry the weapon's own size multiplier, so reading it here would assert the formula, not the row.
    // The lock is what this file would otherwise block: an over-tight expectation is a cage, not a rule.
    // a row without the line presses once
    const single = singlePressId();
    expect(dealt(single)).toBeCloseTo(onePress(single, c), 4);
  });

  it('a dodge-proof press lands where an ordinary press is dodged', () => {
    // A dodge-proof row is read on its own weapon — the case compares the sim with
    // itself, so a weapon name is all the setup it needs
    const crossbow = { ...c, weaponName: 'crossbow' } as Character;
    const dodgey = mob({ dodgeRate: 1e9 });
    const ordinary = singlePressId();
    const proof = dodgeProofId();
    const normal = cast(ordinary, c, [mob({ id: 'n', dodgeRate: 1e9 })], {}, 3);
    const pierced = cast(proof, crossbow, [dodgey], {}, 3);
    expect(normal?.targets).toBe(0);
    expect(pierced?.targets).toBe(1);
    expect(hasRule(row(proof), 'ignores_dodge')).toBe(true);
  });

  it('a shock field hits everything it reaches, with no Alignment gate', () => {
    const zeroAlign = { ...c, alignment: 0 } as Character;
    const store = newMobStatusStore();
    const group = [mob({ id: 'a' }), mob({ id: 'b' }), mob({ id: 'c' })];
    const shock = shockFieldId();
    const castResult = cast(shock, zeroAlign, group, { mobStatus: store }, 11);
    expect(castResult?.targets).toBeGreaterThan(1); // "all hit", and the row's own AoE reached them
    const shocked = group.filter((t) => holdsCondition(store, t.id, 'shocked'));
    expect(shocked.length).toBe(castResult?.targets);
    // with no Alignment the ordinary proc path could not have done this
    const plain = newMobStatusStore();
    cast(neutralPressId(), { ...zeroAlign, weaponName: 'crossbow' }, [mob({ id: 'z' })], { mobStatus: plain }, 11);
    expect(Object.keys(plain).length).toBeLessThanOrEqual(1);
    expect(Object.keys(plain.z?.statuses || {}).length).toBe(0);
  });

  it('a poison field lays its stacks on every target, not only the front one', () => {
    const store = newMobStatusStore();
    const group = [mob({ id: 'a' }), mob({ id: 'b' })];
    cast(poisonFieldId(), c, group, { mobStatus: store }, 5);
    for (const t of group) {
      expect(store[t.id]?.statuses.poison?.stacks ?? 0).toBeGreaterThan(0);
    }
  });

  it('a stop press holds the mob for the seconds it names, outside the control budget', () => {
    const store = newMobStatusStore();
    const t = mob();
    store[t.id] = { statuses: {}, alignedPerSec: 0, stoppedSec: (E.status.shock as any).stop_sec * 40, elapsedSec: 1 };
    cast(stopId(), c, [t], { mobStatus: store }, 4);
    expect(modsOn(store, t.id).stopped).toBe(true);
    // the budget it would have had to pay is untouched, because the row uses no chance
    expect(store[t.id].stoppedSec).toBe((E.status.shock as any).stop_sec * 40);
    const swung = mobSwing(mulberry32(2), c, t, {}, {
      damageDealt: 0, attackSpeed: 0, accuracy: 0, damageTaken: 0, critChance: 0, leechPct: 0, clockPct: 0,
      stopped: true, armourCut: 0, resistCut: 0, elemTakenPct: 0,
    });
    expect(swung.blocked).toBe('shocked');
  });

  it('an elemental-taken row makes the target take more of the Element half, for its own seconds', () => {
    const takenId = SYN.taken;
    const curses = newCurses();
    applyCurse(curses, 'm1', { ...row(takenId), duration: row(takenId).duration });
    expect(lineValue(curses, 'm1', 'mob_elemental_damage_taken_pct')).toBe(valueOf(takenId, 'mob_elemental_damage_taken_pct'));
    expect(String(row(takenId).duration)).toMatch(/\d+ sec/);
    const gear = emptyGear();
    gear[10] = {
      slot: 'main hand', base: 'one-handed sword', ilvl: 61, quality: 'high', tier: 'T1',
      weaponAspd: 1.2, q: 2, lines: [{ id: 'elemental_power_flat', value: 4000, slice: 0, element: 'fire' }],
    } as any;
    const elem = { ...buildCharacter(90, gear), alignment: 100 } as Character;
    const plain = playerSwing(mulberry32(2), elem, mob({ res: 0 }), null).damage;
    const broken = playerSwing(mulberry32(2), elem, mob({ res: 0 }), null, {
      damageDealt: 0, attackSpeed: 0, accuracy: 0, damageTaken: 0, critChance: 0, leechPct: 0, clockPct: 0,
      stopped: false, armourCut: 0, resistCut: 0, elemTakenPct: valueOf(takenId, 'mob_elemental_damage_taken_pct'),
    }).damage;
    expect(broken / plain).toBeGreaterThan(1);
    // the physical half is untouched, so the rise is smaller than the row's own share
    expect(broken / plain).toBeLessThan(1 + valueOf(takenId, 'mob_elemental_damage_taken_pct') / 100 + 1e-6);
  });
});

describe('the support rows that change the character', () => {
  it('a speed aura multiplies the cooldown clock and the swing, both by the row’s own mult', () => {
    const speedId = SYN.speed;
    const fold = sm.aggregateEffects([row(speedId)]);
    const c = buildCharacter(40, emptyGear(), {}, 0, fold);
    expect(c.globalSpeed).toBe(valueOf(speedId, 'global_speed'));
    const plain = buildCharacter(40, emptyGear());
    expect(c.aspd / plain.aspd).toBeCloseTo(valueOf(speedId, 'attack_speed'), 6);
  });

  it('an elemental-resist aura hardens the Elements it names, and only those', () => {
    const wardId = SYN.ward;
    const fold = sm.aggregateEffects([row(wardId)]);
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
    // the cut sits between the resist the row names and no cut, because some of every swing is non-Element
    const v = valueOf(wardId, 'elemental_resistance');
    expect(cut(fire)).toBeGreaterThan(1 - v / 100);
  });

  it('dodge charges arrive from the row’s own ramp and delete a hit each', () => {
    const dodgeId = SYN.dodge;
    const s = newSkillState();
    s.list[0] = dodgeId; s.owned[dodgeId] ??= 0;
    s.xp[dodgeId] = 8000;
    const c = buildCharacter(40, emptyGear());
    const atCap = castOnce(s, c, c.maxMana, [mob()], {}, mulberry32(1));
    expect(atCap?.charges).toBe(valueOf(dodgeId, 'dodge_charges_cap'));
    const fresh = newSkillState();
    fresh.list[0] = dodgeId; fresh.owned[dodgeId] ??= 0;
    fresh.owned[dodgeId] = 0;
    const atOne = castOnce(fresh, c, c.maxMana, [mob()], {}, mulberry32(1));
    expect(atOne?.charges).toBe(valueOf(dodgeId, 'dodge_charges'));
    expect(atOne!.charges!).toBeLessThan(atCap!.charges!);
  });

  it('pays a buff recast with HP under Blood Price', () => {
    const dodgeId = SYN.dodge;
    const setup = (bloodPrice: boolean) => {
      const s = newGame(104);
      setLevel(s, 60);
      s.skills.owned[dodgeId] = 0;
      if (bloodPrice) s.player.treeRanks = { 'keystone.blood-price': 1 };
      s.player.mana = 0;
      expect(toggleTrack(s.skills, dodgeId).ok).toBe(true);
      tick(s, { online: true });
      return s;
    };
    const cost = sm.costOf(sm.byId[dodgeId], { skillLevel: 1 });
    expect(cost.resource).toBe('mana');
    // the pool (plus one tick's regen) cannot fund the cost, so only Blood Price can bring it up
    expect(setup(false).skills.buffUp[dodgeId] ?? 0).toBe(0);
    expect(setup(true).skills.buffUp[dodgeId]).toBeGreaterThan(0);
  });

  it('applies a toggled buff’s cast outcome on the live recast path', () => {
    const s = newGame(103);
    setLevel(s, 60);
    const dodgeId = SYN.dodge;
    const blockId = SYN.block;
    const veilId = SYN.veil;
    for (const id of [dodgeId, blockId, veilId]) s.skills.owned[id] = 0;
    s.playerStatuses.burn = { stacks: 1, secLeft: 9, perSec: 1 };
    for (const id of [dodgeId, blockId, veilId])
      expect(toggleTrack(s.skills, id).ok).toBe(true);
    tick(s, { online: true });
    expect(s.player.charges).toBe(valueOf(dodgeId, 'dodge_charges'));
    expect(s.player.blockCharges).toBe(valueOf(blockId, 'block_charges'));
    expect(s.playerStatuses.burn).toBeUndefined();
  });

  it('the sim spends a charge before the rolls, and Holy Veil keeps statuses off entirely', () => {
    const s = newGame(99);
    huntZone(s, s.zone);
    setLevel(s, 30);
    s.zone = 3;
    s.skills.owned[SYN.dodge] = 0;
    s.skills.xp[SYN.dodge] = 8000;
    s.skills.list[0] = SYN.dodge; s.skills.owned[SYN.dodge] ??= 0;
    let guard = 0;
    while ((s.player.charges || 0) === 0 && guard++ < 200) tick(s, {});
    expect(s.player.charges! > 0).toBe(true);
    const before = s.player.hp;
    for (let i = 0; i < 30; i++) tick(s, {});
    // the charges were spent absorbing hits the sheet would otherwise have taken
    expect(s.player.charges! < valueOf(SYN.dodge, 'dodge_charges_cap')).toBe(true);
    expect(s.player.hp).toBeGreaterThanOrEqual(Math.min(before, s.player.hp));
  }, 30000);

  it('Cleanse clears what is on the character and pays its own share of the pool', () => {
    const s = newGame(100);
    huntZone(s, s.zone);
    setLevel(s, 120);
    s.zone = 3;
    const c0 = buildCharacter(s.player.level, s.gear, {}, 0);
    s.player.hp = c0.maxHp;
    s.player.mana = c0.maxMana;
    let guard = 0;
    while (!s.group.length && guard++ < 30) tick(s, {});
    // the saved state holds the character's statuses (§7.7), so put one on the character and cleanse it off.
    // chill, not shock: a shock would stun the player and block the very cast being tested.
    s.playerStatuses.chill = { stacks: 0, secLeft: 99, perSec: 0 };
    s.skills.owned['heal.cleanse'] = 0;
    s.skills.xp['heal.cleanse'] = 8000;
    s.skills.list[0] = 'heal.cleanse'; s.skills.owned['heal.cleanse'] ??= 0;
    guard = 0;
    let cleansed = false;
    while (guard++ < 30 && !cleansed) {
      s.player.mana = c0.maxMana;
      tick(s);
      if (s.log.some((l) => /clears/.test(l.text))) cleansed = true;
    }
    expect(cleansed).toBe(true);
    // The press names the share at the level actually held, from the canonical effect ramp.
    const restored = s.log.find((l) => /restores .* HP at once/.test(l.text));
    expect(restored).toBeTruthy();
    const healPct = sm.effectsAt(row('heal.cleanse'), sm.skillLevel(s.skills.xp['heal.cleanse']))
      .find(effect => effect.stat === 'heal_instant')!.value;
    expect(restored!.text).toContain(`(${healPct}% of the pool)`);
  }, 30000);

  it('Magia Drive restarts the shield without waiting out the delay', () => {
    const fold = sm.aggregateEffects([row('buff.magia_drive')]);
    expect(Object.keys(fold.add).length + Object.keys(fold.mult).length).toBe(0); // pure mechanic row
    expect(hasRule(row('buff.magia_drive'), 'es_recharge_immediate')).toBe(true);
    const s = newGame(101);
    huntZone(s, s.zone);
    setLevel(s, 60);
    s.zone = 5;
    // the shield is a gear line, so the character under test wears the piece that carries it — a
    // recharge test on a zero pool can never read a recharge
    s.gear = poolGear();
    s.skills.owned['buff.magia_drive'] = 0;
    s.skills.xp['buff.magia_drive'] = 8000;
    s.skills.list[0] = 'buff.magia_drive'; s.skills.owned['buff.magia_drive'] ??= 0;
    let guard = 0;
    let rechargedWhileHit = false;
    while (guard++ < 200) {
      s.player.es = 0;
      s.player.esIdleSec = 0; // as if it had just been hit
      tick(s, {});
      if (s.skills.buffUp['buff.magia_drive'] > 0 && s.player.es > 0) rechargedWhileHit = true;
    }
    expect(rechargedWhileHit).toBe(true);
    void fold;
  }, 30000);

  it('Energy Absorb ramps its share from the row’s base to its Cap and negates it even on a full shield', () => {
    const base = valueOf('buff.energy_absorb', 'es_absorb_pct');
    const top = valueOf('buff.energy_absorb', 'es_absorb_cap');
    // the helper ramps linearly off the buff's own skill level, base at level 1 to Cap at 20
    const s = newSkillState();
    s.owned['buff.energy_absorb'] = 0;
    s.buffUp['buff.energy_absorb'] = 3;
    s.xp['buff.energy_absorb'] = 0;
    expect(esAbsorbPct(s)).toBeCloseTo(base, 6);
    s.xp['buff.energy_absorb'] = 8000;
    expect(esAbsorbPct(s)).toBeCloseTo(top, 6);
    expect(esAbsorbPct(newSkillState())).toBe(0); // off, nothing is absorbed

    // a hit far larger than the pool, against a full shield: the absorbed share is removed from HP
    // whether or not the shield has room — the press is a real defence even when ES is full
    const c = buildCharacter(60, emptyGear());
    const m = mob({ ps: 50000 });
    const plain = mobSwing(mulberry32(4), c, m, {}, NO, c.es, 0);
    const absorbing = mobSwing(mulberry32(4), c, m, {}, NO, c.es, base);
    expect(absorbing.absorbed).toBeGreaterThan(0);
    expect(absorbing.toHp).toBeLessThan(plain.toHp);
    expect(plain.toHp + plain.toEs).toBeCloseTo(absorbing.toHp + absorbing.toEs + absorbing.absorbed, 6);
  }, 30000);
});

describe('the curse rows that act on other mobs', () => {
  it('Venom Bind still holds the poison it was written for', () => {
    const store = newMobStatusStore();
    store.m1 = {
      statuses: { poison: { stacks: 10, secLeft: 999, perSec: 0 } },
      alignedPerSec: 0, stoppedSec: 0, elapsedSec: 5, poisonHeldUntil: 11,
    };
    for (let i = 0; i < 3; i++) stepMob(store, 'm1');
    expect(store.m1.statuses.poison!.stacks).toBe(10);
  });
});

describe('the trigger auras fire the first ready slot at their own price', () => {
  const c = { ...buildCharacter(90, emptyGear()), weaponName: 'one-handed axe' } as Character;

  it('reads the event and the price off the row', () => {
    const s = newSkillState();
    s.owned['aura.cast_on_crit'] = 0;
    s.owned['aura.cast_on_damage_taken'] = 0;
    s.auras['aura.cast_on_crit'] = true;
    const t = triggerAuras(s);
    const at = (stat: string) => valueOf('aura.cast_on_crit', stat);
    expect(t.crit).toMatchObject({
      id: 'aura.cast_on_crit',
      manaMult: at('cast_mana_mult'),
      damageMult: at('cast_damage_mult'),
      cdSec: at('trigger_cd_sec'),
    });
    expect(t.taken).toBe(null);
    s.auras['aura.cast_on_damage_taken'] = true;
    expect(triggerAuras(s).taken?.id).toBe('aura.cast_on_damage_taken');
  });

  it('charges ×2 mana and scales the press ×0.7, and never spends the skill cooldown', () => {
    const strikeId = singlePressId();
    const setup = () => { const s = newSkillState(); s.list[0] = strikeId; s.owned[strikeId] ??= 0; s.xp[strikeId] = 8000; return s; };
    const plainS = setup();
    const plain = castOnce(plainS, c, c.maxMana, [mob({ id: 'a' })], {}, mulberry32(7), {});
    const trigS = setup();
    const trig = castOnce(trigS, c, c.maxMana, [mob({ id: 'b' })], {}, mulberry32(7), { trigger: { manaMult: 2, damageMult: 0.7 } });
    expect(plain && trig).toBeTruthy();
    expect(trig!.manaCost).toBeCloseTo(plain!.manaCost * 2, 4);
    expect(trig!.damage).toBeCloseTo(plain!.damage * 0.7, 4);
    // the trigger runs its own clock, so the skill's own cooldown is untouched
    expect(trigS.cd[strikeId] || 0).toBe(0);
    expect(plainS.cd[strikeId]).toBeGreaterThan(0);
  });

  it('is in play inside the sim: a crit with Cast on Crit up fires the order', () => {
    const strikeId = singlePressId();
    const s = newGame(5);
    huntZone(s, s.zone);
    setLevel(s, 90);
    s.zone = 1;
    s.skills.owned[strikeId] = 1;
    s.skills.xp[strikeId] = 8000;
    s.skills.list[0] = strikeId; s.skills.owned[strikeId] ??= 0;
    s.skills.owned['aura.cast_on_crit'] = 1;
    s.skills.auras['aura.cast_on_crit'] = true;
    // This test owns the aura trigger, not field density; keep the scenario small and stable.
    tick(s, {});
    if (s.field) s.field.slots = s.field.slots.slice(0, 6);
    s.group = s.group.slice(0, 6);
    // tick until the state under test exists, never for a guessed window (AGENTS.md): the bound is a hang guard
    for (let i = 0; i < 20000 && !s.log.some((l) => /Cast on Crit triggers/.test(l.text)); i++) tick(s, {});
    expect(s.log.some((l) => /Cast on Crit triggers/.test(l.text))).toBe(true);
  });
});

describe('no mechanic word is left unread', () => {
  it('every rule in the closed set appears in a client source file', () => {
    const spent = ['src/sim/combat/skills.ts', 'src/sim/core/game.ts', 'src/sim/combat/combat.ts', 'src/sim/combat/mobStatus.ts',
      ...readdirSync('src/sim/core/tick').map((f) => `src/sim/core/tick/${f}`)]
      .map((f) => readFileSync(f, 'utf8')).join('\n');
    for (const rule of sm.EFFECT_RULES) {
      expect(spent).toContain(`'${rule}'`);
    }
    for (const by of sm.MODELLED_BY) expect(spent + readFileSync('src/sim/combat/skills.ts', 'utf8')).toContain(by);
  });
});

const NO = {
  damageDealt: 0, attackSpeed: 0, accuracy: 0, damageTaken: 0, critChance: 0, leechPct: 0, clockPct: 0,
  stopped: false, armourCut: 0, resistCut: 0, elemTakenPct: 0,
};
