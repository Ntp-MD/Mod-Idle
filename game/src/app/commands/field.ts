import { establishCamp, startFieldAction, stopFieldAction, cookMeal, eatMeal } from '@sim/world/fieldwork';
import { cancelCampEncounter, chooseCampEncounter, setCampEncounterPolicy, type CampEncounterAction, type CampEncounterPolicy } from '@sim/world/camp-encounters';
import { plant, harvest, craftPotion, condense, drink, cycleQuickbar } from '@sim/world/farm';
import { farm } from '../../engine/client';
import { allocateStats, respecStats } from '@sim/core/respec';
import { allocateTreePath, respecTree, spendTreePoint } from '@sim/core/tree';
import { moveSlot, toggleTrack, setAuraPool, condOf } from '@sim/combat/skills';
import { storePreset, switchPreset, bindZone } from '@sim/core/presets';
import { push, isBossKind } from '@sim/core/game';
import { fieldwork, sm, eng } from '../../engine/client';
import { recordMapDiscovery } from '@sim/world/map-exploration';
import { currentCell } from '@sim/world/road';
import type { GameState } from '@sim/core/types';
import type { StatKey } from '../../engine/client';
import type { SkillConditions } from '@sim/combat/skills';

/**
 * Field commands: field/camp/gathering/cooking/provision, farming/potions/quick slots,
 * Core/tree/skill/aura. Same getter pattern as gear/economy.
 */
export interface FieldContext {
  get gameState(): GameState;
  set gameState(value: GameState);
  get saveNote(): string;
  set saveNote(value: string);
  get skillNote(): string;
  set skillNote(value: string);
  get farmNote(): string;
  set farmNote(value: string);
  get transactionWriter(): boolean;
  get fieldCellName(): string;
  get viewHere(): boolean;
  get c(): import('@sim/core/player').Character;
  get ownedAuras(): Array<{ id: string }>;
  get travelScene(): boolean;
  set travelScene(value: boolean);
  get running(): boolean;
  set running(value: boolean);
  get showcaseMode(): boolean;
  get panel(): string | null;
  set panel(value: string | null);
  requireAccountWriter(action: string): boolean;
  rowFlag(id: string | null): { key: string; label: string } | null;
  rowExploitFlag(id: string | null): { key: string; label: string } | null;
}

export function createFieldCommands(ctx: FieldContext) {
  function allocate(k: StatKey, delta: number) {
    const result = allocateStats(ctx.gameState, k, delta, { writer: ctx.transactionWriter });
    if (result.ok) ctx.gameState = { ...ctx.gameState };
    else ctx.saveNote = result.why || 'Cannot allocate Core points';
  }

  function doSpendTree(nodeId: string) {
    if (!ctx.requireAccountWriter('spending Tree Points')) return { ok: false, why: 'This tab is read-only.' };
    const r = spendTreePoint(ctx.gameState, nodeId);
    if (r.ok) ctx.gameState = { ...ctx.gameState };
    return r;
  }

  function doAllocateTreePath(nodeId: string) {
    if (!ctx.requireAccountWriter('allocating a tree path')) return { ok: false, why: 'This tab is read-only.' };
    const r = allocateTreePath(ctx.gameState, nodeId);
    if (r.ok) { ctx.gameState = { ...ctx.gameState }; ctx.saveNote = ''; }
    else ctx.saveNote = `Cannot buy that path: ${r.why}`;
    return r;
  }

  function doRespecTree() {
    if (!ctx.requireAccountWriter('resetting the passive tree')) return;
    if (!ctx.viewHere) return;
    if (respecTree(ctx.gameState).ok) ctx.gameState = { ...ctx.gameState };
  }

  function respec() {
    if (!ctx.requireAccountWriter('resetting Core points')) return;
    if (!ctx.viewHere) return;
    if (respecStats(ctx.gameState).ok) ctx.gameState = { ...ctx.gameState };
  }

  function doEstablishCamp() {
    if (!ctx.requireAccountWriter('setting Field Camp')) return;
    const r = establishCamp(ctx.gameState);
    if (r.ok) cancelCampEncounter(ctx.gameState, 'Camp relocated');
    ctx.saveNote = r.ok ? (r.moved ? `Camp moved · ${ctx.fieldCellName}` : `Camp established · ${ctx.fieldCellName}`) : `Cannot set Camp: ${r.why}`;
    if (r.ok) push(ctx.gameState, r.moved ? `Camp moved to ${ctx.fieldCellName}` : `Field Camp established at ${ctx.fieldCellName}`);
    ctx.gameState = { ...ctx.gameState };
  }

  function doStartFieldAction(kind: 'mine' | 'grove' | 'fish') {
    if (!ctx.requireAccountWriter('starting gathering')) return;
    const r = startFieldAction(ctx.gameState, kind);
    ctx.saveNote = r.ok ? (kind === 'mine' ? 'Mining started' : kind === 'grove' ? 'Woodcutting started' : 'Fishing started') : `Cannot gather: ${r.why}`;
    ctx.gameState = { ...ctx.gameState };
  }

  function doStopFieldAction() {
    if (!ctx.requireAccountWriter('stopping gathering')) return;
    stopFieldAction(ctx.gameState);
    ctx.saveNote = 'Gathering stopped';
    ctx.gameState = { ...ctx.gameState };
  }

  function doCampEncounter(id: number, action: CampEncounterAction, expected?: { beat: number; stage: import('@sim/world/fieldwork').CampEncounterStage }) {
    const result = chooseCampEncounter(ctx.gameState, id, action, ctx.transactionWriter, expected);
    ctx.saveNote = result.ok ? '' : `Cannot respond: ${result.why}`;
    if (result.ok && (action === 'fight' || action === 'follow')) {
      if (action === 'fight') push(ctx.gameState, 'Camp encounter · fight started');
      ctx.travelScene = action === 'follow';
      if (ctx.showcaseMode) ctx.running = true;
      ctx.panel = 'map';
    }
    ctx.gameState = { ...ctx.gameState };
    return result;
  }

  function doCampPolicy(policy: CampEncounterPolicy) {
    if (!setCampEncounterPolicy(ctx.gameState, policy, ctx.transactionWriter)) return;
    ctx.gameState = { ...ctx.gameState };
  }

  function doCookMeal(id: string, count = 1) {
    if (!ctx.requireAccountWriter('cooking')) return;
    const recipe = fieldwork.recipeById[id];
    const r = cookMeal(ctx.gameState, id, count);
    const made = r.made ?? (r.ok ? 1 : 0);
    ctx.saveNote = r.ok ? `${recipe?.name || id} · ${made} cooked${r.why ? ` · stopped: ${r.why}` : ''}` : `Cannot cook: ${r.why}`;
    if (r.ok) {
      const text = `Camp kitchen · ${recipe?.name || id} ×${made}`;
      recordMapDiscovery(ctx.gameState);
      ctx.gameState.mapJournal!.lastEvent = { ...currentCell(ctx.gameState), text, atSec: ctx.gameState.clockSec, activity: 'cook' };
      push(ctx.gameState, text);
    }
    ctx.gameState = { ...ctx.gameState };
  }

  function doEatMeal(id: string) {
    if (!ctx.requireAccountWriter('eating provisions')) return;
    const food = fieldwork.foodById[id];
    const recipe = fieldwork.recipeById[id];
    const r = eatMeal(ctx.gameState, id);
    ctx.saveNote = r.ok ? `${food?.name || id} eaten · Hunger ${Math.floor(ctx.gameState.fieldwork.hunger)}%` : `Cannot eat: ${r.why}`;
    if (r.ok) push(ctx.gameState, recipe
      ? `${recipe.name} eaten · +${food.hunger_restore} Hunger · +${recipe.damage_pct}% damage for ${Math.round(recipe.duration_sec / 60)} min`
      : `${food?.name || id} eaten · +${food?.hunger_restore || 0} Hunger`);
    ctx.gameState = { ...ctx.gameState };
  }

  function updateAutoEat(patch: Partial<typeof ctx.gameState.fieldwork.autoEat>) {
    if (!ctx.requireAccountWriter('changing Auto Eat')) return;
    ctx.gameState.fieldwork.autoEat = { ...ctx.gameState.fieldwork.autoEat, ...patch };
    ctx.gameState = { ...ctx.gameState };
  }

  function doPlant(i: number, tier: string) {
    if (!ctx.requireAccountWriter('planting')) return;
    const r = plant(ctx.gameState, i, tier);
    ctx.farmNote = r.ok ? `Plot ${i + 1}: ${tier} herb in the ground, ready in ${farm.F.growth_hours} h` : `Plot ${i + 1}: ${r.why}`;
    ctx.gameState = { ...ctx.gameState };
  }

  function doHarvest(i: number) {
    if (!ctx.requireAccountWriter('harvesting')) return;
    const r = harvest(ctx.gameState, i);
    ctx.farmNote = r.ok ? `Plot ${i + 1}: +${r.herbs} herbs · +${r.xp} Farm XP` : `Plot ${i + 1}: ${r.why}`;
    ctx.gameState = { ...ctx.gameState };
  }

  function doBrew(name: string) {
    if (!ctx.requireAccountWriter('brewing')) return;
    const r = craftPotion(ctx.gameState, name);
    ctx.farmNote = r.ok ? `Brewed ${name}` : `${name}: ${r.why}`;
    ctx.gameState = { ...ctx.gameState };
  }

  function doDrink(name: string) {
    if (!ctx.requireAccountWriter('drinking a potion')) return;
    const r = drink(ctx.gameState, ctx.c as never, name, ctx.gameState.group.some((m) => isBossKind(String(m.kind))));
    ctx.farmNote = r.ok ? `Drank ${name}` : `${name}: ${r.why}`;
    ctx.gameState = { ...ctx.gameState };
  }

  function useQuickSlot(i: number) {
    if (!ctx.requireAccountWriter('using a potion shortcut')) return;
    const name = ctx.gameState.quickbar[i];
    if (!name) return;
    const r = drink(ctx.gameState, ctx.c as never, name, ctx.gameState.group.some((m) => isBossKind(String(m.kind))));
    push(ctx.gameState, r.ok ? `Downed the ${name}` : `${name}: ${r.why}`);
    ctx.gameState = { ...ctx.gameState };
  }

  function doCondense(name: string) {
    if (!ctx.requireAccountWriter('condensing potions')) return;
    const r = condense(ctx.gameState, name);
    ctx.farmNote = r.ok ? `Condensed ${name} · ${farm.P.condensed.effect_mult}× in one bottle` : `${name}: ${r.why}`;
    ctx.gameState = { ...ctx.gameState };
  }

  function setAutoPotion(pool: 'hp' | 'mana', enabled: boolean) {
    if (!ctx.requireAccountWriter('changing potion auto-use')) return;
    ctx.gameState.farm.autoUse[pool] = enabled;
    ctx.gameState = { ...ctx.gameState };
  }

  function setPotionThreshold(pool: 'hp' | 'mana', value: number) {
    if (!ctx.requireAccountWriter('changing potion thresholds') || !Number.isFinite(value)) return;
    ctx.gameState.farm.threshold[pool] = Math.min(99, Math.max(1, value));
    ctx.gameState = { ...ctx.gameState };
  }

  function setFarmAutomation(kind: 'plant' | 'harvest' | 'brew', enabled: boolean) {
    if (!ctx.requireAccountWriter('changing Farm automation')) return;
    ctx.gameState.farm.autoFarm[kind] = enabled;
    ctx.gameState = { ...ctx.gameState };
  }

  function cycleQuickSlot(slot: number) {
    if (!ctx.requireAccountWriter('changing a potion shortcut')) return;
    cycleQuickbar(ctx.gameState, slot);
    ctx.gameState = { ...ctx.gameState };
  }

  function assignQuickSlot(slot: number, name: string | null) {
    if (!ctx.requireAccountWriter('assigning a potion shortcut')) return;
    ctx.gameState.quickbar[slot] = name;
    ctx.gameState = { ...ctx.gameState };
  }

  function doSwitchPreset(i: number) {
    if (!ctx.requireAccountWriter('switching skill presets')) return;
    switchPreset(ctx.gameState, i);
    ctx.skillNote = `Loaded ${ctx.gameState.presets[i].name}`;
    ctx.gameState = { ...ctx.gameState };
  }

  function doStorePreset() {
    if (!ctx.requireAccountWriter('saving skill presets')) return;
    storePreset(ctx.gameState);
    ctx.skillNote = `Saved ${ctx.gameState.presets[ctx.gameState.activePreset].name}`;
    ctx.gameState = { ...ctx.gameState };
  }

  function doBind(i: number) {
    if (!ctx.requireAccountWriter('binding a skill preset')) return;
    bindZone(ctx.gameState, i, ctx.gameState.zone);
    ctx.skillNote = `${ctx.gameState.presets[i].name} now ${ctx.gameState.presets[i].zones.includes(ctx.gameState.zone) ? 'binds' : 'unbinds'} ${eng.zoneById(ctx.gameState.zone).name}`;
    ctx.gameState = { ...ctx.gameState };
  }

  function setSlot(i: number, id: string) {
    if (!ctx.requireAccountWriter('assigning skills')) return;
    const at = ctx.gameState.skills.list.indexOf(id);
    if (at >= 0) ctx.gameState.skills.list[at] = null;
    ctx.gameState.skills.list[i] = id || null;
    ctx.gameState = { ...ctx.gameState };
  }

  function setMode(id: string, mode: string) {
    if (!ctx.requireAccountWriter('changing skill mode')) return;
    ctx.gameState.skills.mode[id] = mode as never;
    ctx.gameState = { ...ctx.gameState };
  }

  function setAutoMode(id: string, mode: 'auto' | 'manual' | 'both') {
    if (!ctx.requireAccountWriter('changing skill automation')) return;
    (ctx.gameState.skills.autoMode ||= {})[id] = mode;
    ctx.gameState = { ...ctx.gameState };
  }

  function setCond(id: string, patch: Partial<SkillConditions>) {
    if (!ctx.requireAccountWriter('changing skill conditions')) return;
    const next = { ...condOf(ctx.gameState.skills, id), ...patch };
    const flag = ctx.rowFlag(id);
    next.statusMissing = flag && next.statusMissing.includes(flag.key) ? [flag.key] : [];
    const exploit = ctx.rowExploitFlag(id);
    if (!exploit) { next.statusPresent = false; next.statusStacksAtLeast = 0; }
    if (!next.statusPresent) next.statusStacksAtLeast = 0;
    ctx.gameState.skills.conditions[id] = next;
    ctx.gameState = { ...ctx.gameState };
  }

  function doMoveSlot(from: number, to: number) {
    if (!ctx.requireAccountWriter('reordering skills')) return;
    moveSlot(ctx.gameState.skills, from, to);
    ctx.gameState = { ...ctx.gameState };
  }

  function toggle(id: string) {
    if (!ctx.requireAccountWriter('toggling skills')) return;
    const r = toggleTrack(ctx.gameState.skills, id, ctx.c.keystones as never);
    ctx.saveNote = r.ok ? '' : r.why || 'cannot';
    ctx.gameState = { ...ctx.gameState };
  }

  function chooseAuraPool(id: string, pool: 'hp' | 'mana') {
    if (!ctx.requireAccountWriter('changing aura reservation')) return;
    const r = setAuraPool(ctx.gameState.skills, id, pool, ctx.c.keystones as never);
    ctx.saveNote = r.ok ? '' : r.why || 'cannot';
    if (r.ok) ctx.gameState = { ...ctx.gameState };
  }

  function disableAllAuras() {
    if (!ctx.requireAccountWriter('disabling auras')) return;
    for (const k of ctx.ownedAuras) ctx.gameState.skills.auras[k.id] = false;
    ctx.saveNote = 'All auras off';
    ctx.gameState = { ...ctx.gameState };
  }

  return { allocate, doSpendTree, doAllocateTreePath, doRespecTree, respec, doEstablishCamp, doStartFieldAction, doStopFieldAction, doCampEncounter, doCampPolicy, doCookMeal, doEatMeal, updateAutoEat, doPlant, doHarvest, doBrew, doDrink, useQuickSlot, doCondense, setAutoPotion, setPotionThreshold, setFarmAutomation, cycleQuickSlot, assignQuickSlot, doSwitchPreset, doStorePreset, doBind, setSlot, setMode, setAutoMode, setCond, doMoveSlot, toggle, chooseAuraPool, disableAllAuras };
}
