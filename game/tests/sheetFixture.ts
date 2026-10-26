import { E } from '../src/engine/client';
import { emptyGear } from '../src/sim/core/player';
import type { Item } from '../src/sim/core/types';

/**
 * A worn piece carrying the two lines a bare sheet does not have.
 *
 * Energy Shield and Elemental resistance are **gear lines, not Core stat lines** (`engine.json`
 * `energy_shield`: no Core stat feeds either), so a character wearing nothing holds a zero shield and
 * zero resistance. A test that reads either — a pool floor, a shield recharge, a resistance buff —
 * therefore has to put the line on the sheet it swings at, or it is measuring zero against zero.
 * The two values are the engine's own maxima, so nothing here is a typed number of its own.
 */
export function poolGear(): (Item | null)[] {
  const gear = emptyGear();
  gear[0] = {
    slot: 'helmet',
    base: '',
    ilvl: 1,
    quality: 'low',
    tier: 'T3',
    q: 0,
    lines: [
      { id: 'energy_shield_flat', value: E.mod_max.energy_shield_flat_t1, slice: 0, element: null },
      { id: 'elemental_resistance', value: E.mod_max.res_pct_per_item, slice: 0, element: null },
    ],
  } as unknown as Item;
  return gear;
}
