import { salvageAtSmith, runFilterNow } from '@sim/core/game';
import { savePreset, loadPreset, clearPreset } from '@sim/gear/filter';
import { equipFromBag, autoEquip, unequip } from '@sim/gear/gear';
import { smithService } from '@sim/town/town';
import { sm } from '../../engine/client';
import type { GameState, Item } from '@sim/core/types';
import type { ClientSettings } from '../../state/save';
import type { SlotEntry } from '../../ui/inventory/bag';
import type { MenuItem } from '../../ui/shared/menu';
import type { ItemSelection } from '../../ui/inventory/item-selection';

/**
 * Gear commands by domain. Small plain factory: App owns view state and lifecycle,
 * this module owns only the gear verbs. State is read through getters so session
 * replacement cannot leave stale captured objects (plan phase-1 app-contexts).
 */
export interface GearContext {
  get gameState(): GameState;
  set gameState(value: GameState);
  get settings(): ClientSettings;
  get equipNote(): string;
  set equipNote(value: string);
  get invTab(): 'inv' | 'stash';
  set invTab(value: 'inv' | 'stash');
  get townLive(): boolean;
  get tabs(): number;
  get stashTab(): number;
  requireAccountWriter(action: string): boolean;
  craftThisItem(selection: ItemSelection): void;
  doDeposit(index: number, tab: number): void;
  toggleLock(item: Item): void;
}

export function createGearCommands(ctx: GearContext) {
  function equip(index: number) {
    if (!ctx.requireAccountWriter('equipping gear')) return;
    // the rule lives in `sim/gear/gear.ts`, where the tests can reach it too; this copy only makes the
    // panel re-read the gameState the verb mutated in place
    const r = equipFromBag(ctx.gameState, index);
    if (!r.ok) ctx.equipNote = `Cannot put it on: ${r.why}`;
    ctx.gameState = { ...ctx.gameState };
  }

  function doSalvage(index: number) {
    if (!ctx.requireAccountWriter('salvaging gear')) return;
    const r = salvageAtSmith(ctx.gameState, index);
    ctx.equipNote = r.ok ? 'That piece dissolved — Iron Ore and Scrap entered the resources' : `Cannot salvage: ${r.why}`;
    ctx.gameState = { ...ctx.gameState };
  }

  /** The one bulk press for the carried pieces: the same verdict a fresh drop gets, run over the bag. */
  function doRunFilter() {
    if (!ctx.requireAccountWriter('running the bag filter')) return;
    const r = runFilterNow(ctx.gameState);
    ctx.equipNote = r.why ? `Filter run stopped: ${r.why}` : r.dissolved
      ? `Filter melted ${r.dissolved} piece${r.dissolved === 1 ? '' : 's'}${r.spared ? ` · ${r.spared} left alone` : ''}`
      : 'Nothing carried fails the filter right now';
    ctx.gameState = { ...ctx.gameState };
  }

  function doSaveFilterPreset(i: number) {
    if (!ctx.requireAccountWriter('saving a filter preset')) return;
    if (!savePreset(ctx.gameState, i)) { ctx.equipNote = `Preset ${i + 1} is not the character's to use — Collector sets pay the extra slots`; return; }
    ctx.equipNote = `Saved the bag filter to preset ${i + 1}`;
    ctx.gameState = { ...ctx.gameState };
  }

  function doLoadFilterPreset(i: number) {
    if (!ctx.requireAccountWriter('loading a filter preset')) return;
    if (!loadPreset(ctx.gameState, i)) return;
    ctx.equipNote = `Loaded preset ${i + 1} — every slot's rule is the preset's now`;
    ctx.gameState = { ...ctx.gameState };
  }

  function doClearFilterPreset(i: number) {
    if (!ctx.requireAccountWriter('clearing a filter preset')) return;
    clearPreset(ctx.gameState, i);
    ctx.gameState = { ...ctx.gameState };
  }

  function doUnequip(cell: number) {
    if (!ctx.requireAccountWriter('taking gear off')) return;
    const r = unequip(ctx.gameState, cell);
    ctx.equipNote = r.ok ? 'That piece came off into the bag' : `Cannot take it off: ${r.why}`;
    ctx.gameState = { ...ctx.gameState };
  }

  /**
   * What a right-click offers, per grid. The bag's verbs are the moves a piece can actually make from
   * there — onto the body, into the warehouse (only where a settlement has made that legal), or into a
   * stone. The worn grid's one verb is the way back off the body. Both lists read the same sim calls the
   * panel's buttons already make; nothing here is a second rule.
   *
   * A menu outlives the bag order it opened on: a drop that lands while it is open unshifts the bag,
   * so every verb re-resolves its piece by identity at press time. An index read at open time could
   * already name the neighbour.
   */
  function bagPieceActions(entry: SlotEntry): MenuItem[] {
    if (entry.kind !== 'gear' || !entry.item) return [];
    const it = entry.item;
    /** the piece's live bag slot, or -1 when it already left the bag */
    const liveIndex = () => ctx.gameState.bag.indexOf(it);
    const gone = () => {
      ctx.equipNote = 'That piece already left the bag';
      ctx.gameState = { ...ctx.gameState };
    };
    const out: MenuItem[] = [
      { label: 'Put it on', hint: it.slot, disabled: Boolean(it.broken), onpick: () => { const i = liveIndex(); if (i < 0) return gone(); equip(i); } },
      { label: 'Craft this item', hint: ctx.townLive ? 'Open on the workbench' : 'Available at a settlement', disabled: !ctx.townLive,
        onpick: () => ctx.craftThisItem({ where: 'bag', item: it }) },
      {
        label: it.locked ? 'Unlock' : 'Lock',
        hint: it.locked ? 'the bulk verbs will move it again' : 'the bulk verbs will leave it',
        onpick: () => ctx.toggleLock(it),
      },
    ];
    if (ctx.townLive && ctx.tabs) out.push({ label: `Stash it → Tab ${ctx.stashTab + 1}`, onpick: () => { const i = liveIndex(); if (i < 0) return gone(); ctx.doDeposit(i, ctx.stashTab); } });
    const smith = smithService(ctx.gameState);
    out.push({
      label: 'Dissolve',
      hint: smith.ok ? 'Iron Ore + Scrap · at the smith' : smith.why || 'no smith here',
      danger: true,
      disabled: Boolean(it.locked || it.heldFor || !smith.ok),
      onpick: () => { const i = liveIndex(); if (i < 0) return gone(); doSalvage(i); },
    });
    return out;
  }

  function wornActions(entry: SlotEntry): MenuItem[] {
    if (entry.kind !== 'worn') return [];
    return [{ label: 'Take it off', hint: 'back to the bag', onpick: () => doUnequip(entry.index) },
      ...(entry.item ? [{ label: 'Craft this item', hint: ctx.townLive ? 'Open on the workbench' : 'Available at a settlement', disabled: !ctx.townLive,
        onpick: () => ctx.craftThisItem({ where: 'gear', item: entry.item! }) }] : [])];
  }

  /**
   * One press, the whole body dressed from what the character carries. The choice itself — what counts as
   * best, and what must never be moved — is `sim/gear/gear.ts`'s, and the tests reach it there; this only says
   * what came of it, in the numbers the player acts on.
   */
  function doBestEquip() {
    if (!ctx.requireAccountWriter('equipping carried upgrades')) return;
    const r = autoEquip(ctx.gameState, ctx.settings.equipMargin || 0);
    ctx.gameState = { ...ctx.gameState };
    // the press just moved pieces out of the bag, so the bag is what the player needs to see now
    // (the tab alone — the press never drags the player onto another screen)
    if (r.swaps.length) ctx.invTab = 'inv';
    const parts: string[] = [];
    parts.push(r.swaps.length
      ? `${r.swaps.length} piece${r.swaps.length === 1 ? '' : 's'} went up (${r.swaps.map((w) => `${w.slot}${w.instead ? '' : ' from a free cell'}`).join(', ')})`
      : 'nothing you carry beats what you wear');
    const held = r.spared.locked + r.spared.set + r.spared.broken;
    if (held) parts.push(`${held} left alone — locked, promised to a set, or Broken`);
    if (r.inStash) parts.push(`${r.inStash} in the stash would beat something worn · take it out to wear it`);
    if (r.rotationHeld) {
      const names = r.rotationHeld.skills.map((id) => sm.byId[id]?.name || id);
      const shown = names.length > 3 ? `${names.slice(0, 3).join(', ')} +${names.length - 3} more` : names.join(', ');
      parts.push(`held back — ${r.rotationHeld.base} would silence ${shown}`);
    }
    ctx.equipNote = parts.join(' · ');
  }

  function equipCarriedBest() {
    const r = autoEquip(ctx.gameState, ctx.settings.equipMargin || 0);
    if (r.swaps.length) ctx.gameState = { ...ctx.gameState };
    return r;
  }

  return { equip, doSalvage, doRunFilter, doSaveFilterPreset, doLoadFilterPreset, doClearFilterPreset, doUnequip, bagPieceActions, wornActions, doBestEquip, equipCarriedBest };
}
