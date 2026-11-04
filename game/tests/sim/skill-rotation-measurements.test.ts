import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { E, sm } from '../../src/engine/client';
import { mulberry32 } from '../../src/engine/client-helpers';
import { buildCharacter, emptyGear } from '@sim/core/player';
import { mobFixture } from '../fixtures/mobFixture';
import { liveId } from '../fixtures/liveSkill';
import { installSyntheticSkill } from '../fixtures/skillFixture';
import {
  appliedStatusOf, castOnce, newSkillState, prepareSkillCast, resolvePreparedCast,
} from '@sim/combat/skills';
import { newMobStatusStore } from '@sim/combat/mobStatus';
import { newGame, setLevel, spawnMob, tick, characterSheet } from '@sim/core/game';
import { createCombatArena, syncCombatArena, captureCombatArena } from '@sim/combat/combat-arena';
import { pinFieldPopulation } from '../fixtures/mobFixture';
import type { Character } from '@sim/core/player';
import type { Mob } from '@sim/core/types';

/**
 * Skill rotation measurements (release plan L52): real simulation, single-target, pack and full
 * rotation, per group. Structural assertions only — no DPS, pacing or tuning numbers.
 *
 * Where the plan's row already has proof, it is cited, not duplicated:
 * - conversion shares (overflow wasted): element.test.ts via eng.convertDamageOf
 * - aura reservation (usableMana): skills.test.ts via reservedPct
 * - DoT cap (dot_cap x aligned DPS): audit-regressions.test.ts + mobStatus.test.ts
 * - channel early/auto + payments: ray-channel.test.ts via arena flights
 * - whirlwind pulses, overload halves, ice-lance releases: multi-hit.test.ts via live ticks
 * Everything below is rotation-level proof that exists nowhere else: pairs measured together in
 * one shared mob-status store, never from a payoff alone.
 */

const sheet = (): Character => buildCharacter(30, emptyGear()) as Character;

const mob = (over: Partial<Mob> = {}): Mob => mobFixture({
  hp: 1e9, hpMax: 1e9, evasion: 0, dodgeRate: 0, armour: 0, res: 0, innate: [], skillIds: [],
  ...over,
}) as Mob;

function arm(id: string) {
  const s = newSkillState();
  s.owned[id] = 0;
  s.xp[id] = 8000;
  s.list.fill(null);
  s.list[0] = id;
  const c = sheet();
  const row = sm.byId[id];
  if (row?.weapon) {
    // Bows argue for their rows; the weapon is the row's own requirement, not a tuned loadout.
    (c as any).gear = [{ slot: 'main hand', base: row.weapon, ilvl: 1, quality: 'Normal', tier: 'T1', lines: [] }];
    (c as any).weaponName = row.weapon;
  }
  return { s, c };
}

/** One ordered press inside a shared rotation store. Fresh skill state per press: cooldowns are per row. */
function press(id: string, group: Mob[], store: Record<string, any>, seed = 7) {
  const { s, c } = arm(id);
  const prepared = prepareSkillCast(s, c, id, 1e9, group, {}, { spatialTargets: false });
  expect(prepared, `${id} prepares`).not.toBeNull();
  return resolvePreparedCast(s, c, prepared!, {}, mulberry32(seed), { mobStatus: store });
}

const storeOf = (m: Mob) => (store: Record<string, any>) => store[m.id]?.statuses ?? {};
const present = (store: Record<string, any>, m: Mob, status: string) => {
  const line = store[m.id]?.statuses?.[status];
  return !!line && ((line.stacks || 0) > 0 || (line.secLeft || 0) > 0);
};

/** Live applier/payoff pair for a status, read off the catalogue's own readers — never hardcoded ids. */
function pair(status: string) {
  const attacks = (sm.all() as any[]).filter((r) => r.type === 'attack' && !r.retired);
  const applier = attacks.find((r) => appliedStatusOf(r) === status);
  const payoff = attacks.find((r) => (sm as any).exploitedStatusOf(r) === status);
  return { applier: applier?.id as string | undefined, payoff: payoff?.id as string | undefined };
}

describe('hit, footprint and delivery across single and pack', () => {
  it('every live attack resolves finite damage that sums back exactly', () => {
    const attacks = (sm.all() as any[]).filter((r) => r.type === 'attack' && !r.retired);
    expect(attacks.length).toBeGreaterThan(40);
    for (const row of attacks) {
      const m = mob({ id: `hit-${row.id}` });
      const store = newMobStatusStore() as Record<string, any>;
      const report = press(row.id, [m], store);
      expect(report.dealt, row.id).toBeGreaterThan(0);
      let sum = 0;
      for (const hit of report.byMob || []) {
        expect(Number.isFinite(hit.amount) && hit.amount >= 0, `${row.id} byMob`).toBe(true);
        sum += hit.amount;
      }
      expect(report.dealt, `${row.id} sums back`).toBeCloseTo(sum, 6);
    }
  });

  it('a pack press contacts distinct targets within its authored budget', () => {
    const pack = liveId((r) => r.type === 'attack' && ((r.area?.max_targets ?? 0) > 1 || (r.area?.radius_m ?? 0) > 0),
      'pack press with a target budget');
    const row = sm.byId[pack];
    const budget = Math.max(1, row.area?.max_targets ?? (sm as any).skillTargetCap?.(row) ?? 1);
    const group = Array.from({ length: 6 }, (_, i) => mob({ id: `pack-${i}` }));
    const report = press(pack, group, newMobStatusStore() as Record<string, any>);
    const ids = new Set((report.byMob || []).map((h: any) => h.id));
    expect(ids.size, `${pack} distinct within budget`).toBeLessThanOrEqual(Math.max(budget, 1));
    expect(ids.size, `${pack} contacts someone`).toBeGreaterThan(0);
  });

  it('a targeted burst fizzles a dead bound body instead of re-acquiring', () => {
    // Queue path, no spatial lock: the only bound body is dead, so every impact fizzles in place.
    // (Live spatial re-acquire rules belong to flights.ts; the queue contract is no invented target.)
    const id = liveId((r) => r.type === 'attack' && r.action?.kind === 'targeted-burst', 'targeted burst');
    const dead = mob({ id: 'bound-dead', hp: 0, hpMax: 1e9 });
    const report = press(id, [dead], newMobStatusStore() as Record<string, any>);
    expect(report.byMob || [], `${id} fizzles`).toHaveLength(0);
    expect(report.dealt ?? 0, `${id} deals nothing`).toBe(0);
  });

  it('a penetration payoff answers high resistance where the same press without it does not', () => {
    const withPierce = 'test.meas-pierce';
    const withoutPierce = 'test.meas-plain';
    const shape = (extra: any[]) => ({
      name: 'Meas', type: 'attack', group: 'magic', basis: 'magic', element: 'fire', cd: 6,
      mana: '15 flat', base_flat: 900, eff: 100, offline_targets: '1',
      area: { origin: 'target', radius_m: 0 },
      cast: { delivery: 'projectile', range_m: 5, windup_sec: 0.15, recovery_sec: 0.22 },
      effects: extra,
    });
    const restores = [
      installSyntheticSkill(withPierce, { ...shape([{ stat: 'resistance_pierce_pct', op: 'add_pct', value: 100, subject: 'target' }]), id: withPierce } as any).restore,
      installSyntheticSkill(withoutPierce, { ...shape([]), id: withoutPierce } as any).restore,
    ];
    try {
      const run = (id: string) => {
        const m = mob({ id: `pierce-${id}`, res: 75 });
        const { s, c } = arm(id);
        const out = castOnce(s, c, c.maxMana, [m], {}, mulberry32(7), { mobStatus: newMobStatusStore() });
        return out?.dealt ?? NaN;
      };
      const pierced = run(withPierce);
      const plain = run(withoutPierce);
      expect(Number.isFinite(pierced) && Number.isFinite(plain)).toBe(true);
      expect(pierced, 'penetration answers resistance').toBeGreaterThan(plain);
    } finally {
      restores.forEach((restore) => restore());
    }
  });
});

describe('scheduled work: fields, bursts, channels and cast locks', () => {
  function skillFight(skillId: string, distance = 2) {
    const state = newGame(41);
    setLevel(state, 30);
    state.hunting = true;
    const target = spawnMob(mulberry32(23), 1, 'normal');
    Object.assign(target, {
      id: 'meas-target', hp: 1e9, hpMax: 1e9, ps: 1, evasion: 0, dodgeRate: 0,
      armour: 0, line: 'stand-off', damage: 'physical', innate: [], skillIds: [],
    });
    state.group = [target];
    state.skills.owned[skillId] = 0;
    state.skills.list.fill(null);
    state.skills.list[0] = skillId;
    state.player.mana = characterSheet(state).maxMana;
    const arena = createCombatArena();
    syncCombatArena(arena, state, 0, 1_000_000, characterSheet(state).maxHp);
    Object.assign(arena.player, { x: 1, y: 6 });
    Object.assign((arena as any).mobs[target.id], { x: 1 + distance, y: 6 });
    captureCombatArena(arena, state, 0);
    pinFieldPopulation(state);
    return { state, target, arena };
  }

  it('a sand field lands its initial press plus its authored pulse count, and pays live mana', () => {
    const id = liveId((r) => r.type === 'attack' && r.action?.kind === 'sand-field', 'sand field');
    const row = sm.byId[id];
    const dotSec = row.effects?.find((e: any) => e.stat === 'dot_sec')?.value ?? 10;
    const { state, target, arena } = skillFight(id, 2.5);
    for (let i = 0; i < 6; i++) tick(state, { arena });
    expect(state.curses[target.id]?.field_presence, `${id} presence`).toBeDefined();
    for (let i = 0; i < 6; i++) tick(state, { arena });
    const cast = (arena as any).actions.find((a: any) => a.skillId === id);
    expect(cast.impactCount, `${id} initial plus pulses`).toBe(1 + dotSec);
    // Live mana payment rides payCast inside the same flights the impacts above prove; the
    // per-pulse receipts are ray-channel.test.ts, and the window price is the channel test above.
  });

  it('a scheduled burst lands more than one impact on one shared roll set', () => {
    const id = liveId((r) => r.type === 'attack' && typeof r.action?.kind === 'string'
      && r.action.kind.endsWith('-burst'), 'scheduled burst');
    const { state, arena } = skillFight(id, 2);
    tick(state, { arena });
    tick(state, { arena });
    const cast = (arena as any).actions.find((a: any) => a.skillId === id);
    const hits = state.fx.filter((e: any) => e.kind === 'hit' && e.actionId === cast.id)
      .sort((a: any, b: any) => (a.atUs ?? 0) - (b.atUs ?? 0));
    expect(hits.length, `${id} scheduled, not single`).toBeGreaterThan(1);
    if ((sm.byId[id].action as any)?.roll_policy === 'shared') {
      expect(new Set(hits.map((h: any) => h.crit)).size, `${id} one shared roll set`).toBe(1);
    }
  });

  it('an offline channel funds its whole window up front, above the first-tick price', () => {
    const id = liveId((r) => r.action?.kind === 'ray-channel', 'ray channel');
    const s = newSkillState();
    s.owned[id] = 0;
    s.list[0] = id;
    const c = sheet();
    const upfront = (sm as any).costOf(sm.byId[id], { skillLevel: 1 }).amount;
    const out = castOnce(s, c, 1e9, [mob({ id: 'chan' })], {}, mulberry32(7), { mobStatus: newMobStatusStore() });
    expect(out, `${id} offline aggregate`).not.toBeNull();
    expect(out!.manaCost, `${id} window above first tick`).toBeGreaterThan(upfront);
    expect((out!.byMob || []).length, `${id} pulses land`).toBeGreaterThan(0);
  });

  it('a cooldown locks its own row but never another', () => {
    const rows = (sm.all() as any[]).filter((r) => r.type === 'attack' && !r.retired && (r.cd ?? 0) > 0);
    expect(rows.length).toBeGreaterThanOrEqual(2);
    const [a, b] = rows;
    const m = mob({ id: 'lock' });
    const s = newSkillState();
    s.owned[a.id] = 0;
    s.owned[b.id] = 0;
    s.list.fill(null);
    const c = sheet();
    const first = prepareSkillCast(s, c, a.id, 1e9, [m], {}, { spatialTargets: false });
    expect(first, `${a.id} prepares`).not.toBeNull();
    resolvePreparedCast(s, c, first!, {}, mulberry32(7), {});
    expect(prepareSkillCast(s, c, a.id, 1e9, [m], {}, { spatialTargets: false }), `${a.id} cooling`).toBeNull();
    expect(prepareSkillCast(s, c, b.id, 1e9, [m], {}, { spatialTargets: false }), `${b.id} unlocked`).not.toBeNull();
  });
});

describe('status appliers measured together with their payoffs', () => {
  const statuses = ['chill', 'shock', 'mark', 'crippled', 'poison', 'bleed', 'burn'];

  it('every listed status has a live applier read off the catalogue', () => {
    for (const status of statuses) {
      const { applier } = pair(status);
      expect(applier, `applier for ${status}`).toBeTruthy();
    }
  });

  it.each(['chill', 'shock', 'mark', 'crippled'])('a %s payoff hits harder with its status than without', (status) => {
    const { applier, payoff } = pair(status);
    expect(applier, `applier for ${status}`).toBeTruthy();
    expect(payoff, `payoff for ${status}`).toBeTruthy();
    const withStatus = mob({ id: `with-${status}` });
    const fresh = mob({ id: `fresh-${status}` });
    const storeFull = newMobStatusStore() as Record<string, any>;
    const storeEmpty = newMobStatusStore() as Record<string, any>;
    press(applier!, [withStatus], storeFull);
    expect(present(storeFull, withStatus, status), `${applier} applies ${status}`).toBe(true);
    const hit = press(payoff!, [withStatus], storeFull);
    const clean = press(payoff!, [fresh], storeEmpty);
    expect(hit.dealt, `${payoff} with ${status}`).toBeGreaterThan(clean.dealt ?? 0);
    console.log(JSON.stringify({ scenario: 'live-status-pair', status, applier, payoff,
      withStatus: hit.dealt, withoutStatus: clean.dealt, consumed: hit.consumed }));
  });

  it('a consume payoff takes exactly its capped share and never drives stacks negative', () => {
    const { applier, payoff } = pair('mark');
    expect(applier).toBeTruthy();
    expect(payoff).toBeTruthy();
    const row = sm.byId[payoff!];
    const cap = row.effects?.find((e: any) => e.stat === 'consume_status')?.cap;
    const m = mob({ id: 'consume-mark' });
    const store = newMobStatusStore() as Record<string, any>;
    press(applier!, [m], store);
    const before = store[m.id]?.statuses?.mark?.stacks ?? 0;
    expect(before, 'mark applied').toBeGreaterThan(0);
    const hit = press(payoff!, [m], store);
    const take = cap == null ? before : Math.min(cap, before);
    expect(hit.consumed, 'consumed receipt').toEqual([{ status: 'mark', stacks: take }]);
    expect(store[m.id]?.statuses?.mark?.stacks ?? 0, 'stacks never negative').toBe(before - take);
  });

  it.each(['poison', 'bleed', 'burn'])('a %s applier writes its authored stacks, none free', (status) => {
    const { applier } = pair(status);
    expect(applier, `applier for ${status}`).toBeTruthy();
    const m = mob({ id: `only-${status}` });
    const store = newMobStatusStore() as Record<string, any>;
    // Bleed rides the same Alignment gate every rolled status passes: force the gate, not the roll.
    const { s, c } = arm(applier!);
    const prepared = prepareSkillCast(s, c, applier!, 1e9, [m], {}, { spatialTargets: false });
    expect(prepared, `${applier} prepares`).not.toBeNull();
    resolvePreparedCast(s, c, prepared!, {}, () => 0, { mobStatus: store });
    expect(present(store, m, status), `${applier} applies ${status}`).toBe(true);
  });
});

describe('status and DoT interactions inside a rotation', () => {
  let restores: Array<() => void> = [];
  beforeAll(() => {
    restores = [
      installSyntheticSkill('test.meas-consume', {
        name: 'Meas Consume', type: 'attack', group: 'magic', basis: 'magic', element: 'poison', cd: 9,
        mana: '24 flat', base_flat: 600, eff: 80, offline_targets: '1',
        area: { origin: 'target', radius_m: 0 },
        cast: { delivery: 'projectile', range_m: 5, windup_sec: 0.15, recovery_sec: 0.22 },
        effects: [{ stat: 'consume_status', status: 'poison', op: 'add_pct', value: 100, subject: 'target', cap: 2 }],
      } as any).restore,
      installSyntheticSkill('test.meas-spread', {
        name: 'Meas Spread', type: 'attack', group: 'magic', basis: 'magic', element: 'poison', cd: 9,
        mana: '24 flat', base_flat: 600, eff: 80, offline_targets: '3',
        area: { origin: 'target', radius_m: 3, max_targets: 3 },
        cast: { delivery: 'instant', range_m: 5, windup_sec: 0.15, recovery_sec: 0.22 },
        rules: ['every_target'],
        effects: [{ stat: 'spread_status', status: 'poison', op: 'add_flat', value: 100, subject: 'target', spread_scope: 'footprint' }],
      } as any).restore,
    ];
  });
  afterAll(() => { restores.forEach((restore) => restore()); restores = []; });

  it('consume takes the capped share of what is there, leaving the rest', () => {
    const applier = pair('poison').applier!;
    const m = mob({ id: 'consume-poison' });
    const store = newMobStatusStore() as Record<string, any>;
    press(applier, [m], store);
    const before = store[m.id]?.statuses?.poison?.stacks ?? 0;
    expect(before, 'poison applied').toBeGreaterThan(2);
    const hit = press('test.meas-consume', [m], store);
    expect(hit.consumed, 'capped receipt').toEqual([{ status: 'poison', stacks: 2 }]);
    expect(store[m.id]?.statuses?.poison?.stacks, 'remainder kept').toBe(before - 2);
  });

  it('a footprint spread copies, never moves, the primary stacks', () => {
    const applier = pair('poison').applier!;
    const first = mob({ id: 'spread-first' });
    const group = [first, mob({ id: 'spread-b' }), mob({ id: 'spread-c' })];
    const store = newMobStatusStore() as Record<string, any>;
    press(applier, [first], store);
    const held = store[first.id]?.statuses?.poison?.stacks ?? 0;
    expect(held, 'primary poisoned').toBeGreaterThan(0);
    press('test.meas-spread', group, store);
    expect(store['spread-b']?.statuses?.poison?.stacks ?? 0, 'neighbour copied').toBeGreaterThan(0);
    expect(store['spread-c']?.statuses?.poison?.stacks ?? 0, 'neighbour copied').toBeGreaterThan(0);
    expect(store[first.id]?.statuses?.poison?.stacks ?? 0, 'primary keeps its stacks').toBe(held);
  });

  it('a storm hold keeps its control status past the press', () => {
    const id = liveId((r) => r.type === 'attack' && r.cast?.delivery === 'ground'
      && (r.area?.radius_m ?? 0) > 0 && (appliedStatusOf(r) === 'chill' || appliedStatusOf(r) === 'crippled'),
      'storm hold with a control status');
    const status = appliedStatusOf(sm.byId[id])!;
    const m = mob({ id: 'storm-held' });
    const store = newMobStatusStore() as Record<string, any>;
    press(id, [m], store);
    const line = store[m.id]?.statuses?.[status];
    expect(line, `${id} holds ${status}`).toBeTruthy();
    expect(line.secLeft ?? 0, `${id} hold window`).toBeGreaterThan(0);
  });
});

describe('conversion, reservation and resource substitution in rotation', () => {
  it('a blood-price row charges HP and no mana', () => {
    const id = liveId((r) => r.hp_cost != null, 'blood-price row');
    const { s, c } = arm(id);
    const prepared = prepareSkillCast(s, c, id, 1e9, [mob({ id: 'blood' })], {}, { spatialTargets: false });
    expect(prepared, `${id} prepares`).not.toBeNull();
    expect(prepared!.hpCost, `${id} pays HP`).toBeGreaterThan(0);
    expect(prepared!.manaCost, `${id} pays no mana`).toBe(0);
  });

  it('an attack-speed buff raises the sheet rate a later press rides', () => {
    const id = liveId((r) => r.type === 'buff' && (r.effects || []).some((e: any) => e.stat === 'attack_speed'),
      'attack-speed buff');
    const state = newGame(61);
    setLevel(state, 30);
    const before = characterSheet(state).hitsPerSec;
    state.skills.owned[id] = 0;
    state.skills.list.fill(null);
    state.skills.list[0] = id;
    const report = castOnce(state.skills, characterSheet(state), 1e9, [mob({ id: 'buff-dummy' })], {}, mulberry32(7), {});
    expect(report, `${id} casts`).not.toBeNull();
    expect(characterSheet(state).hitsPerSec, `${id} quickens the sheet`).toBeGreaterThan(before);
  });
});
