import type { Mob } from '../src/sim/types';

/**
 * One mob fixture for the suite.
 *
 * The fixture owns the SHAPE: the field set a mob carries, on a neutral baseline. Each test file
 * keeps its own scenario — its species, its level, its numbers, its Element — because those are
 * what the assertion is about, and they stay explicit there.
 *
 * A test may also pin a field the `Mob` type does not declare (a scenario's own `align` or `crit`),
 * so the override type is loose on purpose; the fixture's own return is a `Mob`.
 */

/**
 * What a scenario may override: the Mob's own fields, plus anything a test pins on the row.
 *
 * `damage` is widened to a string because one scenario names the old tag; the fixture's own return is
 * still a `Mob`.
 */
export type MobOverride = Omit<Partial<Mob>, 'damage'> & { damage?: string } & Record<string, any>;

export const mobFixture = (over: MobOverride = {}): Mob => ({
  id: 'm1',
  species: 'Rat',
  kind: 'Small',
  zone: 1,
  level: 20,
  hp: 1e9,
  hpMax: 1e9,
  ps: 200,
  acc: 400,
  evasion: 0,
  dodgeRate: 0,
  armour: 0,
  res: 0,
  damage: 'mixed',
  innate: ['fire'],
  xp: 1,
  line: 'front',
  hitsPerSec: 1,
  atkTimer: 0,
  engageSec: 0,
  ...over,
} as Mob);
