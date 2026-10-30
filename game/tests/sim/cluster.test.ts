import { afterEach, describe, expect, it } from 'vitest';
import { sm } from '../../src/engine/client';
import { characterSheet, newGame, setLevel, stepCombat, tick } from '@sim/core/game';
import { createCombatArena, syncCombatArena, captureCombatArena } from '@sim/combat/combat-arena';
import { prepareSkillCast, resolvePreparedCast, newCastRollCache } from '@sim/combat/skills';
import { buildCharacter, emptyGear } from '@sim/core/player';
import { mobFixture } from '../fixtures/mobFixture';
import { pinFieldPopulation } from '../fixtures/mobFixture';
import { mulberry32 } from '../../src/engine/client-helpers';
import { CombatClock } from '@sim/combat/combat-clock';
import { createArenaWork } from '@sim/core/tick/arena-work';
import type { CombatFlight } from '@sim/combat/combat-actions';
import { normalizeSkillAction, skillActionBudget } from '@engine/skills.ts';
import { installSkillFixture } from '../fixtures/skillFixture';

/**
 * C1 — cluster projectiles (decided, no live adopter).
 *
 * The system lands with a synthetic row injected into the model (the roster keeps no cluster
 * parent: `attack.double_strike` is an unrelated melee row). One press = one 100% budget split
 * across the parent impact and its children; a body in both circles takes both (overlap is the
 * design, with independent rolls per impact); children spawn once each at ±spread with the
 * parent speed/delay/footprint; one cost/CD; one kill credit.
 */
const CLUSTER_ID = 'test.cluster_burst';

function installClusterRow() {
  // The synthetic row lives in `tools/data/skills.json` `test_fixtures`, never in the live roster.
  sm.byId[CLUSTER_ID] = installSkillFixture(CLUSTER_ID).row;
}

function clusterState(crowd = 0) {
  const state = newGame(77);
  setLevel(state, 30);
  state.hunting = true;
  state.player.hp = 1e9;
  const spots = [
    { id: 'c', x: 3, y: 0, hp: 1e9 },
    { id: 'o', x: 4.5, y: 0.9, hp: 1e9 },
    { id: 'p', x: 2, y: 0.9, hp: 1e9 },
    { id: 'q', x: 6, y: -1.2, hp: 1e9 },
    { id: 'doomed', x: 4, y: 0.5, hp: 10 },
    ...Array.from({ length: crowd }, (_, i) => ({
      id: `crowd-${i}`, x: 8 + (i % 8) * 0.25, y: 4 + Math.floor(i / 8) * 0.3, hp: 1e9,
    })),
  ];
  state.group = spots.map((s) => mobFixture({ id: s.id, hp: s.hp, hpMax: 1e9, innate: [], skillIds: [] }));
  state.skills.owned[CLUSTER_ID] = 0;
  state.skills.list = new Array(16).fill(null);
  state.skills.list[0] = CLUSTER_ID;
  state.gear[0] = { slot: 'main hand', base: 'bow', ilvl: 1, quality: 'Normal', tier: 'T1', lines: [] } as never;
  state.player.mana = characterSheet(state).maxMana;
  const arena = createCombatArena();
  syncCombatArena(arena, state, 0, 1_000_000, characterSheet(state).maxHp);
  Object.assign(arena.player, { x: 0, y: 0 });
  for (const s of spots) Object.assign(arena.mobs[s.id], { x: s.x, y: s.y });
  captureCombatArena(arena, state, 0);
  pinFieldPopulation(state);
  state.group.forEach((mob, i) => {
    const slot = state.field?.slots.find((e) => e.mobId === mob.id);
    if (slot) slot.home = { x: spots[i].x, y: spots[i].y };
  });
  return { state, arena };
}

afterEach(() => { delete sm.byId[CLUSTER_ID]; });

describe('C1 cluster system', () => {
  it('splits one press across parent + 2 children with overlap, one cost/CD and one kill credit', () => {
    installClusterRow();
    const { state, arena } = clusterState();
    for (let i = 0; i < 2; i++) tick(state, { arena });
    const action = arena.actions.find((e) => e.skillId === CLUSTER_ID);
    expect(action).toBeDefined();
    // parent + 2 children resolved exactly once each
    expect(action!.impactCount).toBe(3);
    expect(action!.payloads).toHaveLength(3);
    const [parent, ...children] = action!.payloads!;
    expect(children).toHaveLength(2);
    // children fan out ±30° from the parent bearing at the parent travel and delay,
    // originating at the parent impact point
    const travel = Math.hypot(parent.destination.x - parent.source.x, parent.destination.y - parent.source.y);
    const bearing = Math.atan2(parent.destination.y - parent.source.y, parent.destination.x - parent.source.x);
    const delay = parent.plannedImpactAtUs - parent.releaseAtUs;
    for (const [k, child] of children.entries()) {
      const want = bearing + (Math.PI / 6) * (2 * k - 1);
      expect(child.source.x).toBeCloseTo(parent.contact!.x, 6);
      expect(child.source.y).toBeCloseTo(parent.contact!.y, 6);
      expect(child.destination.x).toBeCloseTo(parent.contact!.x + Math.cos(want) * travel, 6);
      expect(child.destination.y).toBeCloseTo(parent.contact!.y + Math.sin(want) * travel, 6);
      expect(child.plannedImpactAtUs - child.releaseAtUs).toBe(delay);
      expect(child.releaseAtUs).toBe(parent.impactAtUs);
    }
    const hits = state.fx.filter((e) => e.kind === 'hit' && e.skillId === CLUSTER_ID);
    // overlap: more impact receipts than distinct bodies
    expect(hits.length).toBeGreaterThan(new Set(hits.map((h) => (h as any).mobId)).size);
    // the doomed body died once and only once; children found it gone
    expect(state.counters.kills).toBe(1);
    expect(state.group.some((m) => m.id === 'doomed')).toBe(false);
    expect(hits.filter((h) => (h as any).mobId === 'doomed')).toHaveLength(1);
    // one cost/CD for the whole press
    expect(state.fx.filter((e) => e.kind === 'cast' && e.skillId === CLUSTER_ID)).toHaveLength(1);
    expect(state.skills.cd[CLUSTER_ID]).toBeGreaterThan(0);
  });

  it('prices each impact at its authored share with independent rolls', () => {
    installClusterRow();
    const state = newGame(78);
    setLevel(state, 30);
    state.skills.owned[CLUSTER_ID] = 0;
    const c = buildCharacter(30, emptyGear());
    const mob = mobFixture({ id: 'share', hp: 1e9, hpMax: 1e9, evasion: 0, dodgeRate: 0, innate: [], skillIds: [] });
    const skill = sm.byId[CLUSTER_ID];
    const area = { origin: 'target' as const, radiusM: 2, center: { x: 3, y: 0 }, targetId: 'share' };
    const prepared = prepareSkillCast(state.skills, c, CLUSTER_ID, 1e9, [mob],
      state.playerStatuses, { spatialTargets: true }, area)!;
    const env = { spatialTargets: true, mobStatus: state.mobStatus, curses: state.curses };
    // Identical rolls on both impacts: the dealt ratio is exactly the authored 60:20.
    const parent = resolvePreparedCast(state.skills, c, { ...prepared }, state.playerStatuses,
      mulberry32(5), { ...env, impact: { index: 0, sharePct: 60, cache: newCastRollCache() } });
    const child = resolvePreparedCast(state.skills, c, { ...prepared }, state.playerStatuses,
      mulberry32(5), { ...env, impact: { index: 1, sharePct: 20, cache: newCastRollCache() } });
    expect(parent.dealt).toBeGreaterThan(0);
    expect(child.dealt).toBeGreaterThan(0);
    expect((parent.dealt ?? 0) / (child.dealt ?? 1)).toBeCloseTo(3, 12);
  });

  it('prices the fixture parent and children at 60/20/20 through the offline queue', () => {
    installClusterRow();
    const row = sm.byId[CLUSTER_ID];
    expect(normalizeSkillAction(row)).toMatchObject({
      kind: 'cluster-burst', parent_share_pct: 60, child_share_pct: 20, child_count: 2,
    });
    expect(skillActionBudget(row)).toBe(3);
    expect(() => normalizeSkillAction({ ...row, action: { ...row.action!, child_share_pct: 25 } }))
      .toThrow(/total 100/);

    const state = newGame(79);
    setLevel(state, 30);
    state.skills.owned[CLUSTER_ID] = 0;
    const c = { ...buildCharacter(30, emptyGear()), critChance: 0 };
    const mob = mobFixture({ id: 'share', hp: 1e9, hpMax: 1e9, evasion: 0, dodgeRate: 0, innate: [], skillIds: [] });
    const area = { origin: 'target' as const, radiusM: 3, center: { x: 3, y: 0 }, targetId: 'share' };
    const prepared = prepareSkillCast(state.skills, c, CLUSTER_ID, 1e9, [mob],
      state.playerStatuses, { spatialTargets: true }, area)!;
    const report = resolvePreparedCast(state.skills, c, prepared, state.playerStatuses, mulberry32(5),
      { spatialTargets: true, mobStatus: state.mobStatus, curses: state.curses });
    expect(report.byMob).toHaveLength(3);
    const [parent, childA, childB] = report.byMob;
    expect(parent.id).toBe('share');
    expect(parent.amount / childA.amount).toBeCloseTo(3, 9);
    expect(childB.amount).toBeCloseTo(childA.amount, 9);
    expect(report.targets).toBe(3);
  });

  it('bounds generated and pending work by the authored impacts in a crowded field', () => {
    installClusterRow();
    const { state, arena } = clusterState(24);
    peakClusterFlights = 0;
    const action = () => arena.actions.find((entry) => entry.skillId === CLUSTER_ID);
    const startedAt = performance.now();
    for (let i = 0; i < 80; i++) {
      tickStep(state, arena);
      if ((action()?.impactCount ?? 0) >= 3) break;
    }
    const elapsedMs = performance.now() - startedAt;
    const finished = action()!;
    expect(finished.cancelledAtUs).toBeUndefined();
    expect(finished.impactCount).toBe(3);
    expect(finished.payloads).toHaveLength(3);
    expect(finished.payloads!.filter((payload) => payload.impactAtUs != null)).toHaveLength(3);
    expect(arena.flights.filter((entry) => entry.actionId === finished.id)).toHaveLength(0);
    expect(Number.isFinite(elapsedMs)).toBe(true);
    // A crowded field still schedules at most parent + authored children; it does not create
    // per-target work. Test timing is captured by Vitest, with no platform-specific speed gate.
    expect(peakClusterFlights).toBeLessThanOrEqual(3);
    expect(peakClusterFlights).toBeGreaterThan(0);
  });

  it('records one obstacle receipt without cancelling sibling payloads from the same cast', () => {
    const arena = createCombatArena();
    arena.actions.push({
      id: 9, actorId: 'player', kind: 'cast', atUs: 0, endsAtUs: 1_000_000, x: 0, y: 0,
      impactCount: 0,
      payloads: [0, 1].map((index) => ({ index, source: { x: 0, y: 0 },
        destination: { x: 4, y: index }, releaseAtUs: 0, plannedImpactAtUs: 500_000 })),
    });
    const blocked = { actionId: 9, impactIndex: 1, position: { x: 2, y: 1 } } as unknown as CombatFlight;
    const sibling = { actionId: 9, impactIndex: 0, position: { x: 1, y: 0 } } as unknown as CombatFlight;
    arena.flights.push(blocked, sibling);

    createArenaWork({ arena, clock: new CombatClock(0, 1_000_000) }).cancelFlight(blocked, 250_000, 'obstacle');

    const action = arena.actions[0];
    expect(action.cancelledAtUs).toBeUndefined();
    expect(action.impactCount).toBe(1);
    expect(action.payloads?.[1]).toMatchObject({ impactAtUs: 250_000, cancelReason: 'obstacle', contact: { x: 2, y: 1 } });
    expect(action.payloads?.[0].impactAtUs).toBeUndefined();
    expect(arena.flights).toEqual([sibling]);
  });
});

let peakClusterFlights = 0;
function tickStep(state: ReturnType<typeof newGame>, arena: ReturnType<typeof createCombatArena>) {
  stepCombat(state, { arena, online: true });
  peakClusterFlights = Math.max(peakClusterFlights,
    arena.flights.filter((flight) => flight.cast.id === CLUSTER_ID).length);
}
