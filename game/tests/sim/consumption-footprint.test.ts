import { describe, expect, it } from 'vitest';
import { buildCharacter, emptyGear } from '@sim/core/player';
import { newSkillState, prepareSkillCast, resolvePreparedCast, newCastRollCache } from '@sim/combat/skills';
import { newMobStatusStore, setStacks } from '@sim/combat/mobStatus';
import { newCurses } from '@sim/combat/curse';
import { mulberry32 } from '../../src/engine/client-helpers';
import { mobFixture } from '../fixtures/mobFixture';
import { installSyntheticSkill } from '../fixtures/skillFixture';
import { createCombatArena, syncCombatArena } from '@sim/combat/combat-arena';
import { characterSheet, newGame, setLevel } from '@sim/core/game';
import { E, sm } from '../../src/engine/client';
import type { Mob } from '@sim/core/types';

function cFor() { return buildCharacter(30, emptyGear()) as any; }

describe('stage 2 consumption and footprint', () => {
  it('consume zero/one/multiple and partial/capped/full', () => {
    const id = 'test.consume-basic';
    const installed = installSyntheticSkill(id, {
      name: 'ConsumeBasic', group: 'melee', basis: 'phys', element: 'physical', cd: 1, mana: '10 flat',
      base_flat: 100, eff: 0, offline_targets: '1', area: { origin: 'target', radius_m: 0 },
      cast: { delivery: 'melee', range_m: 2, windup_sec: 0.15, recovery_sec: 0.22 },
      effects: [
        { stat: 'hits', op: 'add_flat', value: 1, subject: 'self' },
        { stat: 'consume_status', status: 'poison', op: 'add_pct', value: 10, subject: 'target' },
      ],
    });
    try {
      const s = newSkillState(); s.owned[id]=0; s.list[0]=id;
      const c = cFor();
      const check = (stacks: number, cap: number | undefined, expectedConsumed: number) => {
        const m = mobFixture({ id: 'm', hp: 1e9, hpMax: 1e9 });
        const mobStatus = newMobStatusStore();
        if (stacks > 0) setStacks(mobStatus, m.id, 'poison', stacks, 10);
        const curses = newCurses();
        const prepared = { id, manaCost: 10, hpCost: 0, level: 1, cooldownSec: 1, spatial: false, targets: [m] } as any;
        if (cap !== undefined) {
          const e = sm.byId[id].effects!.find(e=>e.stat==='consume_status') as any;
          const old = e.cap;
          e.cap = cap;
          const cache: any = { targets: {}, effects: {} };
          const report = resolvePreparedCast(s, c, prepared, {}, mulberry32(1), { mobStatus, curses, timeUs: 0, impact: { index: 0, sharePct: 100, cache } });
          e.cap = old;
          expect(report.consumed?.[0]?.stacks ?? 0).toBe(expectedConsumed);
          expect(mobStatus[m.id]?.statuses.poison?.stacks ?? 0).toBe(Math.max(0, stacks - expectedConsumed));
        } else {
          const cache: any = { targets: {}, effects: {} };
          const report = resolvePreparedCast(s, c, prepared, {}, mulberry32(1), { mobStatus, curses, timeUs: 0, impact: { index: 0, sharePct: 100, cache } });
          expect(report.consumed?.[0]?.stacks ?? 0).toBe(expectedConsumed);
        }
      };
      check(0, undefined, 0);
      check(1, undefined, 1);
      check(5, undefined, 5);
      check(5, 2, 2);
      check(3, 10, 3);
    } finally { installed.restore(); }
  });

  it('miss/dodge and expiry consume nothing', () => {
    const id = 'test.consume-miss';
    const installed = installSyntheticSkill(id, {
      name: 'ConsumeMiss', group: 'melee', basis: 'phys', element: 'physical', cd: 1, mana: '10 flat',
      base_flat: 100, eff: 0, offline_targets: '1', area: { origin: 'target', radius_m: 0 },
      cast: { delivery: 'melee', range_m: 2, windup_sec: 0.15, recovery_sec: 0.22 },
      effects: [
        { stat: 'hits', op: 'add_flat', value: 1, subject: 'self' },
        { stat: 'consume_status', status: 'poison', op: 'add_pct', value: 10, subject: 'target' },
      ],
    });
    try {
      const s = newSkillState(); s.owned[id]=0; s.list[0]=id;
      const c = { ...cFor(), accuracy: 0 } as any; // will miss
      const m = mobFixture({ id: 'm', hp: 1e9, hpMax: 1e9, evasion: 1e9 } as any);
      const mobStatus = newMobStatusStore();
      setStacks(mobStatus, m.id, 'poison', 5, 10);
      const curses = newCurses();
      const prepared = prepareSkillCast(s, c, id, 1e9, [m], {}, { mobStatus, curses, timeUs: 0 })!;
      const cache: any = { targets: {}, effects: {} };
      // force miss by rng that returns > hitChance
      const report = resolvePreparedCast(s, c, { ...prepared, targets: [m] }, {}, () => 0.99, { mobStatus, curses, timeUs: 0, impact: { index: 0, sharePct: 100, cache } });
      expect(report.targets).toBe(0);
      expect(mobStatus[m.id]?.statuses.poison?.stacks).toBe(5);
    } finally { installed.restore(); }
  });

  it('footprint copies to every body inside footprint, not count capped', () => {
    const id = 'test.footprint-copy';
    const installed = installSyntheticSkill(id, {
      name: 'FootprintCopy', group: 'melee', basis: 'phys', element: 'poison', cd: 1, mana: '10 flat',
      base_flat: 100, eff: 0, offline_targets: '1', area: { origin: 'target', radius_m: 3, max_targets: 3 },
      cast: { delivery: 'projectile', range_m: 5, windup_sec: 0.15, recovery_sec: 0.22 },
      effects: [{ stat: 'spread_status', status: 'poison', op: 'add_flat', value: 100, subject: 'target', spread_scope: 'footprint' } as any],
    });
    try {
      const s = newSkillState(); s.owned[id]=0; s.list[0]=id;
      const c = cFor();
      const m0 = mobFixture({ id: 'm0', hp: 1e9, hpMax: 1e9 });
      const m1 = mobFixture({ id: 'm1', hp: 1e9, hpMax: 1e9 });
      const m2 = mobFixture({ id: 'm2', hp: 1e9, hpMax: 1e9 });
      const m3 = mobFixture({ id: 'm3', hp: 1e9, hpMax: 1e9 });
      const mobStatus = newMobStatusStore();
      setStacks(mobStatus, 'm0', 'poison', 5, 10);
      const curses = newCurses();
      const group = [m0, m1, m2, m3];
      // positions: m0 at 0,0 ; m1 at 1,0 ; m2 at 2,0 ; m3 far at 10,0 ; footprint radius 3 centered at m0 should hit m1,m2 but not m3
      const p = E.combat_arena.player_start as { x: number; y: number };
      const area: any = { origin: 'target', radiusM: 3, center: { x: p.x + 1, y: p.y }, targetId: 'm0', shape: 'circle' };
      const prepared = prepareSkillCast(s, c, id, 1e9, group, {}, { mobStatus, curses, spatialTargets: true, resolveTargetsForSkill: () => ({ targets: group, area }) , availableGroup: group, positionOf: (id:string) => {
        const map: Record<string, {x:number,y:number}> = { m0: { x: p.x+1, y: p.y }, m1: { x: p.x+2, y: p.y }, m2: { x: p.x+3, y: p.y }, m3: { x: p.x+10, y: p.y } };
        return map[id];
      } })!;
      // Actually need to test via resolvePreparedCast with footprint
      const cache: any = { targets: {}, effects: {}, sharedOnceEffects: {}, refreshSeeded: {} };
      // Use direct resolve with footprint area
      const report = resolvePreparedCast(s, c, { ...prepared, targets: [m0], area }, {}, mulberry32(1), {
        mobStatus, curses, timeUs: 0, impact: { index: 0, sharePct: 100, cache },
        availableGroup: group,
        positionOf: (id:string) => {
          const map: Record<string, {x:number,y:number}> = { m0: { x: p.x+1, y: p.y }, m1: { x: p.x+2, y: p.y }, m2: { x: p.x+3, y: p.y }, m3: { x: p.x+10, y: p.y } };
          return map[id];
        },
      });
      expect(report.spread?.[0]?.to.sort()).toEqual(['m1','m2']);
      expect(mobStatus['m1']?.statuses.poison?.stacks).toBe(5);
      expect(mobStatus['m2']?.statuses.poison?.stacks).toBe(5);
      expect(mobStatus['m3']?.statuses.poison).toBeUndefined();
    } finally { installed.restore(); }
  });

  it('legacy count cap still works', () => {
    const id = 'test.legacy-count';
    const installed = installSyntheticSkill(id, {
      name: 'LegacyCount', group: 'melee', basis: 'phys', element: 'poison', cd: 1, mana: '10 flat',
      base_flat: 100, eff: 0, offline_targets: '1', area: { origin: 'target', radius_m: 3 },
      cast: { delivery: 'melee', range_m: 3, windup_sec: 0.15, recovery_sec: 0.22 },
      effects: [{ stat: 'spread_status', status: 'poison', op: 'add_flat', value: 1, subject: 'target' }],
    });
    try {
      const s = newSkillState(); s.owned[id]=0; s.list[0]=id;
      const c = cFor();
      const m0 = mobFixture({ id: 'm0' }); const m1 = mobFixture({ id: 'm1' }); const m2 = mobFixture({ id: 'm2' });
      const mobStatus = newMobStatusStore();
      setStacks(mobStatus, 'm0', 'poison', 3, 10);
      const curses = newCurses();
      const group = [m0,m1,m2];
      const area: any = { origin: 'target', radiusM: 3, center: { x: 0, y: 0 } };
      const prepared = prepareSkillCast(s, c, id, 1e9, group, {}, { mobStatus, curses })!;
      const cache: any = { targets: {}, effects: {} };
      const report = resolvePreparedCast(s, c, { ...prepared, targets: [m0], area }, {}, mulberry32(1), {
        mobStatus, curses, timeUs: 0, impact: { index: 0, sharePct: 100, cache },
        availableGroup: group,
        positionOf: () => ({ x: 0, y: 0 }),
      });
      expect(report.spread?.[0]?.to).toHaveLength(1);
    } finally { installed.restore(); }
  });
});
