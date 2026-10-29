import { describe, expect, it } from 'vitest';
import { E } from '../../src/engine/client';
import { newGame, setLevel, spawnMob, stepCombat } from '@sim/core/game';
import { buildCharacter } from '@sim/core/player';
import { mobSwing } from '@sim/combat/combat';
import { planAttacks } from '@sim/combat/combat-clock';
import { mulberry32 } from '../../src/engine/client-helpers';
import { pinFieldPopulation } from '../fixtures/mobFixture';
import type { Mob } from '@sim/core/types';

/**
 * T4 — Spawn attack clock (bug 6).
 *
 * The spawn rank is lowercase (`'boss'` / `'unique'` inside `spawnMob`) while the
 * display kind is capitalised (`'Boss · …'` / `'Unique · …'`). `mobClock` must resolve
 * both spellings through the authored boss clock (`mob.attack_clock_per_sec.boss`),
 * capped by the one clock rule (`1 / caps.attack_interval_sec`). A fast-clock lineage
 * multiplies its own clock; `mobSwing` divides by the same number so published PS never
 * moves — frequency alone implies no raw-DPS increase.
 *
 * All expectations read the data (never a frozen number) and all bodies come from real
 * `spawnMob` runs; timestamps come from `planAttacks` (the live scheduler) plus real
 * `stepCombat` receipts, and damage comes from real `mobSwing` hits.
 */

const clocks = E.mob.attack_clock_per_sec as { normal: number; elite: number; boss: number };
const CAP = 1 / (E.caps as any).attack_interval_sec;
const FAST_MULT = (E.mob as any).trait_mechanics.fast_clock.clock_mult as number;
const UNITS = 1_000_000;

const speciesHasFastClock = (speciesId: string): boolean => {
  const sp = (E.mob.species as any[]).find((entry) => entry.id === speciesId);
  return !!(sp?.mechanics && 'fast_clock' in sp.mechanics);
};

/** Canonical rate for a rank + lineage, read from the data (boss clock for boss/unique). */
const canonicalRate = (rank: 'normal' | 'elite' | 'boss' | 'unique', speciesId: string): number => {
  const authored =
    rank === 'boss' || rank === 'unique'
      ? clocks.boss
      : rank === 'elite'
        ? clocks.elite
        : clocks.normal;
  const mult = speciesHasFastClock(speciesId) ? FAST_MULT : 1;
  return Math.min(authored * mult, CAP);
};

/** A normal spawn that stays normal (wild uniques off), so the rank is unambiguous. */
const spawnNormal = (seed: number, zone = 1): Mob =>
  spawnMob(mulberry32(seed), zone, 'normal', undefined, null, { allowWildUnique: false });

/** The first normal spawn (uniqueChance 1) that upgrades to a wild unique — via the normal API. */
const spawnUnique = (zone = 1): Mob => {
  for (let seed = 1; seed <= 2000; seed++) {
    const mob = spawnMob(mulberry32(seed), zone, 'normal', undefined, null, { uniqueChance: 1 });
    if (mob.kind.startsWith('Unique')) return mob;
  }
  throw new Error(`no wild unique spawned in zone ${zone}`);
};

/** The first normal spawn of a given lineage (wild uniques off). */
const spawnNormalOf = (speciesId: string, zone = 1): Mob => {
  for (let seed = 1; seed <= 5000; seed++) {
    const mob = spawnNormal(seed, zone);
    if (mob.speciesId === speciesId) return mob;
  }
  throw new Error(`no normal ${speciesId} spawned in zone ${zone}`);
};

describe('T4 spawn attack clock', () => {
  it('spawns normal bodies at the authored normal clock, with lineage multiplier and cap', () => {
    for (const seed of [11, 12, 13, 21, 42]) {
      const mob = spawnNormal(seed);
      expect(mob.kind.startsWith('Boss') || mob.kind.startsWith('Unique')).toBe(false);
      expect(mob.hitsPerSec).toBeCloseTo(canonicalRate('normal', mob.speciesId!), 10);
      expect(mob.hitsPerSec).toBeLessThanOrEqual(CAP + 1e-9);
    }
    // Fast lineage swings faster on the same authored clock, still under the one cap.
    const wolf = spawnNormalOf('wolf');
    expect(speciesHasFastClock('wolf')).toBe(true);
    expect(wolf.hitsPerSec).toBeCloseTo(Math.min(clocks.normal * FAST_MULT, CAP), 10);
    const goblin = spawnNormalOf('goblin');
    expect(speciesHasFastClock('goblin')).toBe(false);
    expect(goblin.hitsPerSec).toBeCloseTo(Math.min(clocks.normal, CAP), 10);
  });

  it('spawns elites at the authored elite clock, with lineage multiplier and cap', () => {
    for (const seed of [11, 12, 13]) {
      const mob = spawnMob(mulberry32(seed), 1, 'elite');
      expect(mob.kind).toBe('Elite');
      expect(mob.hitsPerSec).toBeCloseTo(canonicalRate('elite', mob.speciesId!), 10);
      expect(mob.hitsPerSec).toBeLessThanOrEqual(CAP + 1e-9);
    }
  });

  it("resolves the lowercase boss rank through the authored boss clock (not 1/s)", () => {
    // Observed defect: a zone-1 boss swung at 1/s while the data authors 0.8/s.
    // Follow the data — never freeze either number.
    for (const seed of [11, 12, 13]) {
      const mob = spawnMob(mulberry32(seed), 1, 'boss');
      expect(mob.kind.startsWith('Boss')).toBe(true);
      expect(mob.hitsPerSec).toBeCloseTo(canonicalRate('boss', mob.speciesId!), 10);
      expect(mob.hitsPerSec).toBeCloseTo(Math.min(clocks.boss, CAP), 10);
    }
    // A fast-clock boss (Wolf King, species wolf) multiplies the boss clock, not the normal one.
    const fastBoss = spawnMob(mulberry32(11), 10, 'boss');
    expect(fastBoss.kind.startsWith('Boss')).toBe(true);
    expect(fastBoss.speciesId).toBe('wolf');
    expect(fastBoss.hitsPerSec).toBeCloseTo(Math.min(clocks.boss * FAST_MULT, CAP), 10);
  });

  it('generates unique rank through the normal spawn API, on the authored boss clock', () => {
    const mob = spawnUnique(1);
    expect(mob.kind.startsWith('Unique')).toBe(true);
    expect(mob.hitsPerSec).toBeCloseTo(canonicalRate('unique', mob.speciesId!), 10);
    expect(mob.hitsPerSec).toBeCloseTo(
      Math.min(clocks.boss * (speciesHasFastClock(mob.speciesId!) ? FAST_MULT : 1), CAP),
      10,
    );
    expect(mob.hitsPerSec).toBeLessThanOrEqual(CAP + 1e-9);
  });

  it('keeps every rank under the one clock cap', () => {
    expect(CAP).toBeCloseTo(1 / (E.caps as any).attack_interval_sec, 12);
    const mobs: Mob[] = [
      spawnNormal(11),
      spawnMob(mulberry32(11), 1, 'elite'),
      spawnMob(mulberry32(11), 1, 'boss'),
      spawnUnique(1),
      spawnNormalOf('wolf'),
      spawnMob(mulberry32(11), 10, 'boss'),
    ];
    for (const mob of mobs) expect(mob.hitsPerSec).toBeLessThanOrEqual(CAP + 1e-9);
  });

  it('sizes a swing by the same clock that schedules it, so frequency adds no raw DPS', () => {
    const s = newGame(7);
    setLevel(s, 1);
    const c = buildCharacter(s.player.level, s.gear);
    const bodies: { label: string; mob: Mob; rank: 'normal' | 'elite' | 'boss' | 'unique' }[] = [
      { label: 'normal', mob: spawnNormal(11), rank: 'normal' },
      { label: 'elite', mob: spawnMob(mulberry32(11), 1, 'elite'), rank: 'elite' },
      { label: 'boss', mob: spawnMob(mulberry32(11), 1, 'boss'), rank: 'boss' },
      { label: 'unique', mob: spawnUnique(1), rank: 'unique' },
    ];
    for (const { mob, rank, label } of bodies) {
      // Opportunity timestamps from the live scheduler: a 5 s window holds rate × 5 beats.
      const windowUs = 5 * UNITS;
      const plan = planAttacks(0, 0, mob.hitsPerSec, UNITS, windowUs);
      expect(plan.times.length, `${label} opportunities in 5 s`).toBe(
        Math.floor(mob.hitsPerSec * 5 + 1e-9),
      );
      expect([...plan.times].sort((a, b) => a - b)).toEqual(plan.times);
      for (const atUs of plan.times) {
        expect(atUs).toBeGreaterThan(0);
        expect(atUs).toBeLessThanOrEqual(windowUs);
      }
      // Per-hit normalization on a real swing: the hit is PS ÷ clock, so PS never moves.
      const landed = mobSwing(() => 0.999, c, mob, {});
      expect(landed.raw, `${label} raw hit`).toBeGreaterThan(0);
      expect(landed.raw * mob.hitsPerSec, `${label} raw DPS`).toBeCloseTo(mob.ps, 6);
      void rank;
    }
    // The boss window holds fewer beats than the normal window at the same start.
    const normal = bodies[0].mob;
    const boss = bodies[2].mob;
    expect(boss.hitsPerSec).toBeLessThan(normal.hitsPerSec);
    expect(
      planAttacks(0, 0, boss.hitsPerSec, UNITS, 5 * UNITS).times.length,
    ).toBeLessThan(planAttacks(0, 0, normal.hitsPerSec, UNITS, 5 * UNITS).times.length);
    // A faster lineage lands thinner hits at the same PS (wolf 1.25× vs goblin 1×).
    const wolf = spawnNormalOf('wolf');
    const goblin = spawnNormalOf('goblin');
    const fast = mobSwing(() => 0.999, c, wolf, {});
    const slow = mobSwing(() => 0.999, c, { ...wolf, hitsPerSec: 1, ps: wolf.ps }, {});
    expect(fast.raw * wolf.hitsPerSec).toBeCloseTo(slow.raw, 6);
    expect(fast.raw * wolf.hitsPerSec).toBeCloseTo(wolf.ps, 6);
    expect(goblin.hitsPerSec).toBeCloseTo(1, 10);
  });

  it('lands live opportunities at the spawned clock over real stepCombat seconds', () => {
    const liveBeats = (template: Mob, seconds: number): number => {
      const state = newGame(901);
      setLevel(state, 30);
      state.hunting = true;
      const mob: Mob = {
        ...template,
        id: `live-${template.id}`,
        hp: 1e9,
        hpMax: 1e9,
        ps: 10,
        acc: 1e9,
        evasion: 0,
        dodgeRate: 0,
        armour: 0,
        line: 'front',
        damage: 'physical',
        innate: [],
        skillIds: [],
        skillReadyAtUs: {},
        atkTimer: 0,
        engageSec: 0,
      };
      state.group = [mob];
      state.skills.list.fill(null);
      state.player.hp = 1e9;
      pinFieldPopulation(state);
      state.fx = [];
      // Real combat steps: 20 × 50 ms per second, no arena (headless engagement keeps the body).
      const steps = Math.round(seconds * (UNITS / Math.round(0.05 * UNITS)));
      for (let i = 0; i < steps; i++) stepCombat(state, { online: true });
      return state.fx.filter(
        (event) => (event.kind === 'taken' || event.kind === 'block')
          && event.side === 'self'
          && (event as any).byId === mob.id,
      ).length;
    };

    const normal = spawnNormal(11);
    const boss = spawnMob(mulberry32(11), 1, 'boss');
    // Canonical 5 s windows: normal 1/s → 5 beats, boss 0.8/s → 4 beats.
    expect(planAttacks(0, 0, normal.hitsPerSec, UNITS, 5 * UNITS).times.length).toBe(5);
    expect(planAttacks(0, 0, boss.hitsPerSec, UNITS, 5 * UNITS).times.length).toBe(4);
    expect(liveBeats(normal, 5)).toBe(5);
    expect(liveBeats(boss, 5)).toBe(4);
  });
});
