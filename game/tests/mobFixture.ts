import type { Mob } from '../src/sim/core/types';
import type { GameState } from '../src/sim/core/types';
import { createFieldState } from '../src/sim/world/field-area';

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

/**
 * Pin a test scenario to its current bodies: trim the authored field slots to the group size and
 * fill them, so the live population controller has no empty slot to refill. Production data keeps
 * its full cap; this fixture only keeps a mechanics test from growing an unrelated population.
 */
export function pinFieldPopulation(state: GameState, count = state.group.length): void {
  if (!state.field) state.field = createFieldState(state);
  if (state.field.slots.length < count) state.field.slots = createFieldState(state).slots;
  const slots = state.field.slots.slice(0, Math.max(1, count));
  for (const slot of slots) {
    slot.mobId = undefined;
    slot.respawnAtSec = Number.MAX_SAFE_INTEGER;
  }
  state.group.forEach((mob, index) => {
    const slot = slots[index];
    if (!slot) return;
    slot.mobId = mob.id;
    slot.respawnAtSec = 0;
    mob.spawnSlotId = slot.id;
  });
  state.field.slots = slots;
}
