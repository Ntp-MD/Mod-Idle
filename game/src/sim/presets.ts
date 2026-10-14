import { sm } from '../engine/client';
import { ACTIVE_SLOTS, clampAuraReservations, clearUnownedTracks } from './skills';
import type { GameState } from './types';
import type { SkillState } from './skills';

/**
 * Loadout presets (`skill-pool.md` · `engine.json` `presets`).
 *
 * Six sets exist; each holds the 14-slot order plus the buff and aura toggles and the zones it is
 * bound to. Skill XP, cooldowns and duplicates are account-wide and never live in a preset, so
 * switching does not reset progress and a Push that returns to the main set leaves every running
 * cooldown counting (`skill-pool-system.md` rule 12).
 */
export interface Preset {
  name: string;
  list: (string | null)[];
  buffs: Record<string, boolean>;
  auras: Record<string, boolean>;
  /** §14: the per-slot Always / Conditional / Never switch rides the set, so six sets are six
   *  rotations. So does each row's own condition list — a set that gates a row on a boss is a
   *  different rotation from one that fires it always, and the player should not have to rebuild it. */
  mode: Record<string, string>;
  conditions: Record<string, unknown>;
  zones: number[];
}

export function newPresets(): Preset[] {
  return Array.from({ length: sm.presetCount }, (_, i) => ({
    name: i === sm.mainPreset ? 'Main' : `Set ${i + 1}`,
    list: new Array(ACTIVE_SLOTS).fill(null),
    buffs: {},
    auras: {},
    mode: {},
    conditions: {},
    zones: [],
  }));
}

/** Copy the live loadout into its preset slot. */
export function storePreset(state: GameState) {
  const p = state.presets[state.activePreset];
  p.list = [...state.skills.list];
  p.buffs = { ...state.skills.buffs };
  p.auras = { ...state.skills.auras };
  p.mode = { ...(state.skills.mode || {}) };
  p.conditions = { ...(state.skills.conditions || {}) };
}

/** Load a preset into the live loadout. Cooldowns and XP are deliberately untouched. */
export function switchPreset(state: GameState, index: number): boolean {
  const p = state.presets[index];
  if (!p) return false;
  state.presets[state.activePreset] && storePreset(state);
  state.activePreset = index;
  const real = (id: string | null): id is string =>
    Boolean(id) && Boolean(sm.byId[id as string]) && Object.hasOwn(state.skills.owned, id as string);
  // a preset written by an older or hand-edited save can name a skill that is unknown or no longer
  // owned: the live loadout only ever carries rows the collection knows and owns
  state.skills.list = p.list.map((id: string | null) => (real(id) ? id : null));
  state.skills.buffs = {};
  state.skills.auras = {};
  for (const [id, on] of Object.entries(p.buffs)) if (on && real(id)) state.skills.buffs[id] = true;
  for (const [id, on] of Object.entries(p.auras)) if (on && real(id)) state.skills.auras[id] = true;
  clearUnownedTracks(state.skills);
  clampAuraReservations(state.skills);
  state.skills.mode = { ...(p.mode || {}) };
  state.skills.conditions = { ...(p.conditions || {}) };
  // a buff that was up under the old set dies with it: its toggle is off in this one, so its clock
  // cannot keep folding effects the player can no longer see or cancel
  for (const id of Object.keys(state.skills.buffUp)) if (!state.skills.buffs[id]) state.skills.buffUp[id] = 0;
  return true;
}

/** The game picks the set bound to the zone; with no binding the current set simply stays. */
export function autoSelect(state: GameState, zone: number): number | null {
  if (!sm.PRESETS.auto_select_by_zone) return null;
  const found = state.presets.findIndex((p: Preset) => p.zones.includes(zone));
  if (found < 0) return null;
  return switchPreset(state, found) ? found : null;
}

export function bindZone(state: GameState, index: number, zone: number) {
  const p = state.presets[index];
  if (!p) return false;
  p.zones = p.zones.includes(zone) ? p.zones.filter((z: number) => z !== zone) : [...p.zones, zone];
  return true;
}
