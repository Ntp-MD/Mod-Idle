import { BASES, E, loot } from '../src/engine/client';
import { emptyGear } from '../src/sim/player';
import type { Item } from '../src/sim/types';

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

// The client's slot order — the same array `buildCharacter` reads, index by index.
const SLOTS = ['helmet', 'chest', 'pant', 'boots', 'belt', 'gloves', 'ring', 'ring', 'amulet', 'cape', 'main hand', 'off hand', 'earring'];

/**
 * The lines a "dressed to the zone" character carries, in the survival cage's shape: a theme's
 * defensive lines plus the offensive ones a weapon slot would roll. `loot.poolFor` decides which of
 * them a given slot may carry, so the slot permissions come from the data and never from a list here.
 */
const WANTED = [
  'max_hp_flat', 'max_hp', 'max_mana_flat', 'max_mana', 'elemental_resistance', 'armour_flat',
  'energy_shield_flat', 'cooldown_reduction', 'physical_power_flat', 'physical_power',
  'attack_speed', 'accuracy',
];

/**
 * A character dressed to the **zone ceiling**: one piece per slot, every line at the maximum
 * `mods.json` publishes for it. This is a *state* premise, not a duration — it is the same instrument
 * `tools/survival.ts` prices its four builds with (thirteen items, each carrying its own defensive
 * line at the ceiling), so a test that needs a character at the curve never has to say how long it
 * farmed. `AGENT.md`: no time limit and no play-length target is a design constraint, so nothing in
 * this repo may be gated on hours of play.
 */
export function ceilingGear(): (Item | null)[] {
  const gear = emptyGear();
  SLOTS.forEach((slot, i) => {
    const base = (BASES.bases as any[]).find((b) => b.slot === slot) || null;
    const weapon = slot === 'main hand' ? (BASES.weapons as any[])[0] : null;
    const allowed = loot.poolFor(BASES, slot, base, weapon).map((e: any) => e.id);
    const lines = WANTED.filter((id) => allowed.includes(id) && loot.MAX_OF[id] != null)
      .map((id) => ({ id, value: loot.MAX_OF[id], slice: 0, element: null }));
    gear[i] = {
      slot,
      base: weapon ? weapon.name : (base?.name || ''),
      ilvl: 61,
      quality: E.mob.zones[E.mob.zones.length - 1].quality,
      tier: 'T3',
      q: 2,
      lines,
    } as unknown as Item;
  });
  return gear;
}
