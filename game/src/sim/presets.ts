import { sm } from '../engine/client';
import { ACTIVE_SLOTS } from './skills';
import type { GameState } from './types';
import type { SkillState } from './skills';

/**
 * Loadout presets (`skill-pool.md` · `engine.json` `presets`).
 *
 * Six sets exist; each holds the 15-slot order plus the buff and aura toggles and the zones it is
 * bound to. Skill XP, cooldowns and duplicates are account-wide and never live in a preset, so
 * switching does not reset progress and a Push that returns to the main set leaves every running
 * cooldown counting (`skill-pool-system.md` rule 12).
 */
export interface Preset {
  name: string;
  list: (string | null)[];
  buffs: Record<string, boolean>;
  auras: Record<string, boolean>;
  zones: number[];
}

export function newPresets(): Preset[] {
  return Array.from({ length: sm.presetCount }, (_, i) => ({
    name: i === sm.mainPreset ? 'Main' : `Set ${i + 1}`,
    list: new Array(ACTIVE_SLOTS).fill(null),
    buffs: {},
    auras: {},
    zones: [],
  }));
}

/** Copy the live loadout into its preset slot. */
export function storePreset(state: GameState) {
  const p = state.presets[state.activePreset];
  p.list = [...state.skills.list];
  p.buffs = { ...state.skills.buffs };
  p.auras = { ...state.skills.auras };
}

/** Load a preset into the live loadout. Cooldowns and XP are deliberately untouched. */
export function switchPreset(state: GameState, index: number): boolean {
  const p = state.presets[index];
  if (!p) return false;
  state.presets[state.activePreset] && storePreset(state);
  state.activePreset = index;
  state.skills.list = [...p.list];
  state.skills.buffs = { ...p.buffs };
  state.skills.auras = { ...p.auras };
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

export const activeLoadout = (state: GameState): SkillState => state.skills;
