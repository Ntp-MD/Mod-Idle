import { describe, expect, it } from 'vitest';
import { E, eng, TOWN, fieldwork } from '../../src/engine/client';
import { catchUp, catchUpAsync, newGame, setLevel, tick } from '@sim/core/game';
import { exportJson, importJson } from '../../src/state/save';
import { openingGear } from '@sim/core/player';
import { depositMany } from '@sim/town/town';
import { road, settlementCell, startWalk, zoneOf, rankOf } from '@sim/world/road';
import { resolveTravelEvent } from '@sim/world/fieldwork';
import {
  autoReturnThreshold, driveAutoReturn, finishAutoReturnDeposit, maybeStartAutoReturn,
  recordPatrolGroupClear, startPatrol, stopPatrol, togglePatrolStop,
} from '@sim/world/exploration';
import { progressTasks, rollTask, taskReward } from '@sim/town/town';
import type { PatrolStop, TaskSlot } from '@sim/core/types';

function stopsForZone(zone: number): PatrolStop[] {
  const settlement = TOWN.settlements.find((entry: any) => entry.zone === zone)!;
  const home = settlementCell(settlement.id)!;
  const sides = road.neighbours(home).filter((cell: { q: number; r: number }) => zoneOf(cell) === zone && rankOf(cell) > 0).slice(0, 2);
  return sides.map((cell: { q: number; r: number }, subzone: number) => ({
    zone,
    subzone,
    cell: { ...cell, sub: subzone, wild: null },
  }));
}

const expedition = (overrides: Partial<TaskSlot> = {}): TaskSlot => ({
  kind: 'expedition', zone: 1, targetSpecies: 'goblin', subzone: 0,
  n: 3, progress: 0, stone: 'tier', count: 1, claimed: false, offeredAt: 0,
  ...overrides,
});

describe('fixed zone rosters', () => {
  it('spawns every normal and Elite at its Species-authored level inside the displayed zone band', () => {
    const rows = eng.mobRoster();
    for (const zone of E.mob.zones as any[]) {
      for (const species of (E.mob.species as any[]).filter((entry) => entry.zones.includes(zone.id))) {
        const level = species.zone_levels[zone.id];
        expect(level).toBeGreaterThanOrEqual(zone.levels[0]);
        expect(level).toBeLessThanOrEqual(zone.levels[1]);
        const normal = rows.find((row: any) => row.zone === zone.id && row.speciesId === species.id && !/Elite|Unique|Boss/.test(row.kind));
        const elite = rows.find((row: any) => row.zone === zone.id && row.speciesId === species.id && row.kind === E.mob.elite.name);
        expect(normal?.level).toBe(level);
        if (species.sizes.includes('large')) expect(elite?.level).toBe(level);
        const variant = eng.variantsInZone(species.id, zone.id)[0];
        const body = species.sizes.includes('medium') ? 'medium' : species.sizes[0];
        expect(eng.spawnAt(zone.id, body, species.id, undefined, variant?.core).level).toBe(level);
      }
    }
  });

  it('keeps the analysis roster Elite HP and PS equal to the live spawn formula', () => {
    for (const row of eng.mobRoster().filter((entry: any) => entry.kind === E.mob.elite.name) as any[]) {
      const flat = eng.LG.hp_per_level * (row.level - 1) + row.vit * eng.K.K_VIT_HP;
      const expectedHp = (eng.mobHpAt(row.level) + flat) * E.mob.elite.hp;
      const variant = eng.variantsInZone(row.speciesId, row.zone)[0]!;
      const expectedPs = eng.mobPsAt(row.level) * E.mob.elite.ps / eng.zoneBodyFactor(row.zone)
        * eng.speciesPsMult(row.zone, row.speciesId, variant.core, variant.damage);
      expect(row.hpFrom).toBeCloseTo(expectedHp, 8);
      expect(row.ps).toBeCloseTo(expectedPs, 8);
    }
  });
});

describe('location Expeditions', () => {
  it('rolls a target Species and subzone from the selected zone and keeps the Elite stone reward', () => {
    const state = newGame(81);
    const rolls = [0, 0.6, 0];
    const task = rollTask(() => rolls.shift() ?? 0, state);
    expect(task.kind).toBe('expedition');
    expect(task.zone).toBe(1);
    expect(task.targetSpecies).toBeTruthy();
    expect(E.mob.zones[0].subzones?.[task.subzone!]?.species).toContain(task.targetSpecies);
    expect(task.n).toBe(TOWN.task_sizing.elite_n);
    expect(taskReward('expedition', 'low').stone).toBe('tier');
    expect(TOWN.task_sizing.offer_weight_elite + TOWN.task_sizing.offer_weight_expedition).toBeCloseTo(0.75);
  });

  it('counts only the target Elite in its exact zone and subzone', () => {
    const state = newGame(82);
    state.town.tasks[0] = expedition();
    progressTasks(state, 'Elite', 1, 'goblin', 0);
    progressTasks(state, 'Elite', 1, 'orc', 0);
    progressTasks(state, 'Elite', 1, 'goblin', 1);
    progressTasks(state, 'Elite', 2, 'goblin', 0);
    progressTasks(state, 'Medium', 1, 'goblin', 0);
    expect(state.town.tasks[0]!.progress).toBe(1);
    progressTasks(state, 'Elite', 1, 'goblin', 0);
    expect(state.town.tasks[0]!.progress).toBe(2);
  });
});

describe('regional trail events', () => {
  it('forages the fixed regional food and names the zone', () => {
    const state = newGame(82);
    const localFood = fieldwork.F.regional_sources[state.zone].food;
    const event = resolveTravelEvent(state, () => 0);
    expect(event).toContain(eng.zoneById(state.zone).name);
    expect(state.fieldwork.foods[localFood]).toBeGreaterThan(0);
  });
});

describe('staying put without Forward travel', () => {
  it.each(['sync', 'async'] as const)('holds the current hunt during %s catch-up and starts no walk on return', async (mode) => {
    const state = newGame(87);
    const next = TOWN.settlements.find((entry: any) => entry.zone === 2)!;
    state.town.visited.push(next.id);
    setLevel(state, 11);
    const cell = structuredClone(state.cell);
    if (mode === 'sync') catchUp(state, 10);
    else await catchUpAsync(state, 10);
    expect(state.walk).toBeNull();
    expect(state.cell).toEqual(cell);
    expect(state.zone).toBe(1);

    const restored = importJson(exportJson(state));
    tick(restored, { online: true, autoSkills: false });
    expect(restored.walk).toBeNull();
  });

  it.each(['sync', 'async'] as const)('preserves an in-flight block timer through %s catch-up and reload', async (mode) => {
    const state = newGame(88);
    const next = TOWN.settlements.find((entry: any) => entry.zone === 2)!;
    expect(startWalk(state, settlementCell(next.id)!).ok).toBe(true);
    const walk = structuredClone(state.walk);
    if (mode === 'sync') catchUp(state, 10);
    else await catchUpAsync(state, 10);
    expect(state.walk).toEqual(walk);
    const restored = importJson(exportJson(state));
    expect(restored.walk).toEqual(walk);
    tick(restored, { online: true, autoSkills: false });
    expect(restored.walk?.blocksWalked).toBe(1);
  });

});

describe('local Patrol and Auto-Return', () => {
  it('finishes at town when Patrol is stopped during the trip back to the field, including reload', () => {
    const state = newGame(86), [first, second] = stopsForZone(state.zone);
    const home = settlementCell(state.town.waypoint)!;
    state.cell = { ...home, sub: null, wild: null }; state.hunting = false;
    state.patrol.stops = [first, second]; state.patrol.active = true;
    state.autoReturn = { enabled: true, phase: 'to-stop', resumeCell: first.cell };
    expect(driveAutoReturn(state, true).message).toContain('heading back');
    stopPatrol(state);
    const restored = importJson(exportJson(state));
    expect(restored.autoReturn.phase).toBe('to-stop');
    restored.walk = null; restored.cell = first.cell; restored.hunting = true;
    driveAutoReturn(restored, true);
    expect(restored.autoReturn.phase).toBe('to-town');
    expect((restored.walk as ReturnType<typeof newGame>['walk'])?.to).toMatchObject({ q: home.q, r: home.r });
    expect(restored.hunting).toBe(false);
    restored.walk = null; restored.cell = { ...home, sub: null, wild: null };
    expect(driveAutoReturn(restored, true).deposit).toBe(true);
    finishAutoReturnDeposit(restored, 0);
    expect(restored.autoReturn.phase).toBe('idle');
    expect(restored.patrol.active).toBe(false);
    expect(restored.hunting).toBe(false);
  });
  it('requires two visited subzones, then advances the saved route after groups are cleared', () => {
    const state = newGame(83);
    const [first, second] = stopsForZone(state.zone);
    expect(first).toBeDefined(); expect(second).toBeDefined();
    expect(togglePatrolStop(state, first).ok).toBe(true);
    expect(startPatrol(state).ok).toBe(false);
    expect(togglePatrolStop(state, second).ok).toBe(true);
    expect(startPatrol(state).ok).toBe(true);
    expect(state.walk?.to).toMatchObject({ q: first.cell.q, r: first.cell.r });

    state.walk = null;
    state.cell = first.cell;
    state.zone = first.zone;
    for (let i = 0; i < E.road.patrol.groups_per_stop - 1; i++) recordPatrolGroupClear(state, true);
    const moved = recordPatrolGroupClear(state, true);
    expect(moved).toContain(eng.zoneById(second.zone).subzones?.[second.subzone]?.name);
    expect(state.patrol.index).toBe(1);
  });

  it('stashes unlocked gear before resuming and pauses safely when nothing can be moved', () => {
    const state = newGame(84);
    state.gear = openingGear();
    const [first, second] = stopsForZone(state.zone);
    state.patrol.stops = [first, second];
    state.patrol.active = true;
    state.cell = first.cell;
    state.zone = first.zone;
    state.autoReturn.enabled = true;
    state.grants.stash_tabs = 1;
    const gear = structuredClone(state.gear.find(Boolean)!);
    state.bag = Array.from({ length: autoReturnThreshold(state) }, () => structuredClone(gear));
    expect(maybeStartAutoReturn(state, true)).toContain('Auto-Return');
    expect(state.autoReturn.phase).toBe('to-town');

    const home = settlementCell(road.nodeById(state.town.waypoint)!.id)!;
    state.walk = null;
    state.cell = { ...home, sub: null, wild: null };
    expect(driveAutoReturn(state, true).deposit).toBe(true);
    const moved = depositMany(state, state.bag.map((_, i) => i), 0);
    expect(moved).toBe(autoReturnThreshold(state));
    expect(finishAutoReturnDeposit(state, moved)).toContain('returning to Patrol');
    expect(driveAutoReturn(state, true).message).toContain('heading back');
    expect((state.walk as any)?.to).toMatchObject({ q: first.cell.q, r: first.cell.r });

    const locked = newGame(85);
    locked.gear = openingGear();
    const [lockedFirst, lockedSecond] = stopsForZone(locked.zone);
    locked.patrol.stops = [lockedFirst, lockedSecond];
    locked.patrol.active = true;
    locked.cell = lockedFirst.cell;
    locked.zone = lockedFirst.zone;
    locked.autoReturn.enabled = true;
    locked.grants.stash_tabs = 1;
    const protectedGear = structuredClone(locked.gear.find(Boolean)!);
    protectedGear.locked = true;
    locked.bag = Array.from({ length: autoReturnThreshold(locked) }, () => structuredClone(protectedGear));
    maybeStartAutoReturn(locked, true);
    locked.walk = null;
    locked.cell = { ...home, sub: null, wild: null };
    driveAutoReturn(locked, true);
    const lockedMoved = depositMany(locked, locked.bag.map((_, i) => i), 0);
    expect(lockedMoved).toBe(0);
    expect(finishAutoReturnDeposit(locked, lockedMoved)).toContain('no unlocked gear');
    expect(locked.bag).toHaveLength(autoReturnThreshold(locked));
    expect(locked.patrol.active).toBe(false);
  });
});
