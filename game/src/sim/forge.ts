import { BASES, ED, fieldwork } from '../engine/client';
import { createForge, type ForgeKind, type ForgeResolved } from '../../../engine/forge.ts';
import { atSettlement } from './craft';
import { itemFromFrame } from './drop';
import { fieldSkillLevel } from './fieldwork';
import { itemName } from './item-name';
import { slotsFree, slotsFreedBy, type BagCost } from './slots';
import type { GameState, Item } from './types';

/** One resolver for the panel, the cage and the tests; the shared engine owns the rules. */
export const forge = createForge(ED, BASES);

export interface ForgeVerdict {
  ok: boolean;
  why?: string;
  plan?: ForgeResolved;
}

const busy = (state: GameState): boolean =>
  Boolean(state.walk || state.hunting || state.group.length || state.dungeon
    || state.phase === 'camp' || state.fieldwork.action);

export function canForge(state: GameState, kind: ForgeKind, id: string, materialId: string): ForgeVerdict {
  if (!atSettlement(state)) return { ok: false, why: 'forge only in a settlement' };
  if (busy(state)) return { ok: false, why: 'finish the active field activity before forging' };
  const plan = forge.resolve(kind, id, materialId, state.player.level, fieldSkillLevel(state, 'smithing'));
  if (!plan.ok) return plan;
  const held = state.fieldwork.materials[materialId] || 0;
  if (held < plan.count) {
    return { ok: false, why: `needs ${plan.count} ${fieldwork.materialById[materialId]?.name || materialId}` };
  }
  const costs: BagCost[] = [{ bucket: state.fieldwork.materials, key: materialId, capKind: 'material', amount: plan.count }];
  if (slotsFree(state) + slotsFreedBy(costs) < 1) return { ok: false, why: 'make room in the bag' };
  return { ok: true, plan };
}

export function forgeGear(
  state: GameState,
  kind: ForgeKind,
  id: string,
  materialId: string,
  rng: () => number,
): { ok: boolean; why?: string; item?: Item; note?: string } {
  const verdict = canForge(state, kind, id, materialId);
  if (!verdict.ok) return { ok: false, why: verdict.why };
  const plan = verdict.plan!;
  // Build the piece before touching the purse: a refusal or a bad roll must not eat materials.
  const item = itemFromFrame(rng, plan.slot, plan.frame, plan.weapon, plan.ilvl, plan.q);
  state.fieldwork.materials[materialId] -= plan.count;
  state.bag.unshift(item);
  state.fieldwork.skills.smithing.xp += plan.xp;
  return {
    ok: true,
    item,
    note: `Forged ${itemName(item)} · ${plan.band} ilvl ${plan.ilvl} · ${plan.pattern.name}`,
  };
}
