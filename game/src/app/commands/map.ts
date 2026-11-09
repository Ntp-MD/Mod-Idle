import { huntZone, huntHere, push, fx, hitColour, retreatDungeon } from '@sim/core/game';
import { cancelCampEncounter } from '@sim/world/camp-encounters';
import { warpTo, warpCost, startWalk, walkBlocks } from '@sim/world/road';
import { settlementOfZone } from '@sim/town/town';
import { enterDungeon, cooldownLeft } from '@sim/world/dungeon';
import { settlementById } from '@sim/town/town';
import { recordMapDiscovery } from '@sim/world/map-exploration';
import { eng } from '../../engine/client';
import type { GameState, Cell } from '@sim/core/types';
import type { Picked } from '../../ui/map/map-types';

/**
 * Map travel/hunt sequencing behind the same authority checks as the other domains.
 * Map picking/camera/render stay in WorldMap/map-input (map/AGENTS.md); this module
 * owns only the command sequencing that ends in startWalk/warpTo/huntZone/huntHere.
 */
export interface TravelContext {
  get gameState(): GameState;
  set gameState(value: GameState);
  get saveNote(): string;
  set saveNote(value: string);
  get picked(): string | null;
  set picked(value: string | null);
  get pickedCell(): Picked | null;
  set pickedCell(value: Picked | null);
  get panel(): string | null;
  set panel(value: string | null);
  get travelScene(): boolean;
  set travelScene(value: boolean);
  get showcaseMode(): boolean;
  get running(): boolean;
  set running(value: boolean);
  get transactionWriter(): boolean;
  requireAccountWriter(action: string): boolean;
}

export function createTravelCommands(ctx: TravelContext) {
  function goToZone(id: number) {
    if (!ctx.requireAccountWriter('starting a hunt')) return;
    const r = huntZone(ctx.gameState, id);
    if (!r.ok) {
      const s = settlementOfZone(id);
      ctx.saveNote = `${eng.zoneById(id).name} is not opened yet — the map panel shows the walk to ${s?.name ?? 'its settlement'}`;
      ctx.picked = s?.id ?? null;
      ctx.pickedCell = null;
      ctx.panel = 'map';
      return;
    }
    cancelCampEncounter(ctx.gameState, 'Left Camp to hunt');
    push(ctx.gameState, `Heading out to hunt in ${eng.zoneById(id).name} (levels ${eng.zoneById(id).levels.join('-')})`);
    ctx.gameState = { ...ctx.gameState };
  }

  /**
   * Hunt from the cell the feet are on: a sub-zone side sends out that side's cast, and ground with no
   * side named rolls the zone whole (`road.standing_rule`). This is the verb a click on the ground buys.
   */
  function doHuntHere() {
    if (!ctx.requireAccountWriter('hunting')) return;
    const r = huntHere(ctx.gameState);
    if (!r.ok) { ctx.saveNote = `Cannot hunt here: ${r.why}`; ctx.gameState = { ...ctx.gameState }; return; }
    cancelCampEncounter(ctx.gameState, 'Left Camp to hunt');
    const z = eng.zoneById(ctx.gameState.zone);
    push(ctx.gameState, `Hunting ${ctx.pickedCell?.kind === 'sub' ? `${ctx.pickedCell.label} in ${z.name}` : z.name} (levels ${z.levels.join('-')}) from ${ctx.pickedCell?.key}`);
    ctx.gameState = { ...ctx.gameState };
  }

  function travelTo(id: string) {
    if (!ctx.requireAccountWriter('warping')) return;
    const s = settlementById(id)!;
    const saved = walkBlocks(ctx.gameState.town.waypoint, id);
    const r = warpTo(ctx.gameState, id);
    if (!r.ok) { ctx.saveNote = `Cannot warp: ${r.why}`; ctx.gameState = { ...ctx.gameState }; return; }
    cancelCampEncounter(ctx.gameState, 'Left Camp');
    if (r.forfeit) push(ctx.gameState, r.forfeit);
    push(ctx.gameState, `Waypoint to ${s.name} — ${r.gold} gold for the ${saved} blocks it saves`);
    fx(ctx.gameState, { kind: 'warp', side: 'self', text: `warp · ${s.name}`, colour: hitColour(null) });
    recordMapDiscovery(ctx.gameState);
    ctx.gameState = { ...ctx.gameState };
  }

  function warpPrice(id: string) {
    return warpCost(ctx.gameState, id);
  }

  function doWalk(dest: Picked | Cell & { key?: string }) {
    if (!ctx.requireAccountWriter('walking')) return;
    const r = startWalk(ctx.gameState, dest);
    if (!r.ok) { ctx.saveNote = `Cannot walk: ${r.why}`; ctx.gameState = { ...ctx.gameState }; return; }
    cancelCampEncounter(ctx.gameState, 'Left Camp');
    // Travel stays on the board; the presentation switches to combat after the pawn settles.
    ctx.travelScene = true;
    if (ctx.showcaseMode) ctx.running = true;
    ctx.panel = 'map';
    ctx.picked = null;
    ctx.pickedCell = null;
    if (r.forfeit) push(ctx.gameState, r.forfeit);
    ctx.saveNote = '';
    ctx.gameState = { ...ctx.gameState };
  }

  function doDungeon() {
    if (!ctx.transactionWriter) return;
    const r = enterDungeon(ctx.gameState);
    if (!r.ok) { ctx.saveNote = `Cannot enter: ${r.why}`; ctx.gameState = { ...ctx.gameState }; return; }
    push(ctx.gameState, `Entered the dungeon — ${ctx.gameState.dungeon!.total} mobs, loot held in escrow until the last one falls`);
    ctx.gameState = { ...ctx.gameState };
  }

  function doRetreat() {
    const result = retreatDungeon(ctx.gameState, { writer: ctx.transactionWriter });
    ctx.saveNote = result.ok ? `Retreat: selected ${result.selected}, received ${result.received}, rejected ${result.rejected}.` : `Cannot retreat: ${result.why}`;
    ctx.gameState = { ...ctx.gameState };
  }

  return { goToZone, doHuntHere, travelTo, warpPrice, doWalk, doDungeon, doRetreat };
}
