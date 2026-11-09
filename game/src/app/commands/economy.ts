import { sellJunk, buy, quoteTownPurchase, firstBroken, skipTask, repairGear } from '@sim/town/town';
import { turnIn } from '@sim/town/collector';
import { sellGoods, processMaterials } from '@sim/town/trade';
import { deliver, acceptCourier, declineCourier, trackDelivery, acknowledgeDelivery, announceDelivery } from '@sim/town/delivery';
import { buyBlackMarket } from '@sim/town/black-market';
import { forgeGear } from '@sim/gear/forge';
import { doCraft, atSettlement, type CraftOp, type Where } from '@sim/gear/craft';
import { stashTabCount, deposit, withdraw, depositMany, withdrawMany } from '@sim/town/town';
import { claimTask } from '@sim/town/town';
import { taskBonuses, resolveQuestBonus } from '@sim/town/quest-rewards';
import { push, fx, hitColour } from '@sim/core/game';
import { E, TOWN, sm, fieldwork } from '../../engine/client';
import { itemName } from '@sim/gear/item-name';
import { mulberry32 } from '../../engine/client-helpers';
import { setTrackedGoal, type GoalRef } from '@sim/core/guidance';
import type { ForgeKind } from '@engine/forge.ts';
import type { GameState, Item } from '@sim/core/types';
import type { ItemSelection } from '../../ui/inventory/item-selection';

/**
 * Economy commands: town purchases/sales/trade, delivery/task/goal, craft/forge/stash/collector.
 * Same getter pattern as gear: read live GameState through the context, never a stale capture.
 */
export interface EconomyContext {
  get gameState(): GameState;
  set gameState(value: GameState);
  get saveNote(): string;
  set saveNote(value: string);
  get transactionWriter(): boolean;
  get town(): { id: string } | undefined;
  get marketTownId(): string;
  get marketSale(): { text: string; goldText: string; townId: string; goodId: string } | null;
  set marketSale(value: { text: string; goldText: string; townId: string; goodId: string } | null);
  requireAccountWriter(action: string): boolean;
  get bench(): (ItemSelection & { index: number }) | null;
  get benchSelection(): ItemSelection | null;
  set benchSelection(value: ItemSelection | null);
  get benchNote(): string;
  set benchNote(value: string);
  get townNote(): string;
  set townNote(value: string);
  get forgeNote(): string;
  set forgeNote(value: string);
  get forgeResultItem(): string | null;
  set forgeResultItem(value: string | null);
  get viewColSet(): { name: string } | null;
  fmtNum(n: number): string;
  questBonusText(bonus: Pick<import('@sim/town/quest-rewards').QuestBonus, 'gold' | 'stones' | 'skill'>): string;
  resolveItemSelection(game: Pick<GameState, 'bag' | 'gear'>, selection: ItemSelection | null): (ItemSelection & { index: number }) | null;
  refreshSelectionAfterRepair(game: Pick<GameState, 'bag' | 'gear'>, selection: ItemSelection | null, target: { where: Where; index: number } | null, where: Where, index: number): ItemSelection | null;
}

export function createEconomyCommands(ctx: EconomyContext) {
  function doSell() {
    if (!ctx.transactionWriter) { ctx.saveNote = 'This tab is read-only.'; return; }
    const r = sellJunk(ctx.gameState);
    push(ctx.gameState, `Counterhand: sold ${r.pieces} junk for ${r.gold.toFixed(TOWN.trade.currency_decimals)} gold`);
    if (r.pieces > 0) fx(ctx.gameState, { kind: 'sell', side: 'self', text: `+${ctx.fmtNum(r.gold)} gold`, colour: E.elements.crit_colour || 'var(--gold)' });
    ctx.gameState = { ...ctx.gameState };
  }

  function doTrade(id: string, count: number, expected?: { carried: number; gold: number }) {
    if (!ctx.transactionWriter) { ctx.saveNote = 'This tab is read-only.'; return; }
    const result = sellGoods(ctx.gameState, id, count, expected);
    ctx.saveNote = result.ok
      ? `Sold ${count} for ${result.gold.toFixed(TOWN.trade.currency_decimals)} gold${result.cityUnits != null ? ` — city took ${result.cityUnits}${result.basicUnits ? `, floor took ${result.basicUnits}` : ''}` : ''}`
      : `Cannot sell: ${result.why}`;
    if (result.ok) {
      push(ctx.gameState, ctx.saveNote);
      ctx.marketSale = { text: ctx.saveNote, goldText: `${result.gold.toFixed(TOWN.trade.currency_decimals)} gold`, townId: ctx.marketTownId || ctx.town?.id || '', goodId: id };
    } else ctx.marketSale = null;
    ctx.gameState = { ...ctx.gameState };
  }

  function doProcess(id: string) {
    if (!ctx.transactionWriter) { ctx.saveNote = 'This tab is read-only.'; return; }
    const result = processMaterials(ctx.gameState, id);
    ctx.saveNote = result.ok ? `Made ${fieldwork.workshopById[id].name}` : `Cannot make: ${result.why}`;
    if (result.ok) push(ctx.gameState, ctx.saveNote);
    ctx.gameState = { ...ctx.gameState };
  }

  function doBuy(rowId: string, settlementId = ctx.town!.id, expected?: import('@sim/town/pricing').TownPurchaseExpectation) {
    if (!ctx.transactionWriter) { ctx.saveNote = 'This tab is read-only.'; return; }
    const r = buy(ctx.gameState, settlementId, rowId, expected);
    ctx.saveNote = r.ok ? (r.repaired ? `Repaired ${r.repaired} · ${r.gold} gold` : `Bought ${r.row.item}`) : `Cannot buy: ${r.why}`;
    ctx.gameState = { ...ctx.gameState };
  }

  function buyExpectation(settlementId: string, row: any) {
    const quote = quoteTownPurchase(ctx.gameState, settlementId, row.id);
    const target = row.id === 'repair' || row.id === 'repair_ironrow' ? firstBroken(ctx.gameState) : null;
    return { token: quote.token, ...(target ? { target: { where: target.where, index: target.index } } : {}) };
  }

  function doSkipTask(i: number) {
    const r = skipTask(ctx.gameState, i, { writer: ctx.transactionWriter });
    push(ctx.gameState, r.ok ? `Task skipped · ${r.free ? 'free skip' : 'skip token spent'}` : `Cannot skip: ${r.why}`);
    ctx.gameState = { ...ctx.gameState };
  }

  function doRepairGear(where: Where, index: number, expected?: { token: string; target?: { where: Where; index: number } }) {
    if (!ctx.requireAccountWriter('repairing gear')) return false;
    const target = ctx.resolveItemSelection(ctx.gameState, ctx.benchSelection);
    const r = repairGear(ctx.gameState, ctx.town?.id ?? '', where, index, undefined, expected);
    if (r.ok) {
      if (r.where && r.index != null) {
        ctx.benchSelection = ctx.refreshSelectionAfterRepair(ctx.gameState, ctx.benchSelection, target, r.where, r.index);
      }
      ctx.benchNote = `Armourer repaired ${r.repaired} · ${r.gold} gold`;
      push(ctx.gameState, ctx.benchNote);
    } else ctx.benchNote = `Cannot repair: ${r.why}`;
    ctx.gameState = { ...ctx.gameState };
    return r.ok;
  }

  function doDelivery(id: string, count: number, choice?: string, expected?: import('@sim/town/delivery').DeliveryExpected) {
    const result = deliver(ctx.gameState, id, count, { writer: ctx.transactionWriter }, choice, expected);
    ctx.saveNote = result.ok ? `Delivery ${result.completed ? 'completed' : 'recorded'} · ${result.gold!.toFixed(TOWN.trade.currency_decimals)} gold paid` : `Cannot deliver: ${result.why}`;
    if (result.ok) push(ctx.gameState, ctx.saveNote);
    ctx.gameState = { ...ctx.gameState };
  }

  function doAcceptCourier(id: string) {
    const result = acceptCourier(ctx.gameState, id, { writer: ctx.transactionWriter });
    ctx.saveNote = result.ok ? 'Courier request accepted' : `Cannot accept: ${result.why}`;
    ctx.gameState = { ...ctx.gameState };
  }

  function doDeclineCourier(id: string) {
    const result = declineCourier(ctx.gameState, id, { writer: ctx.transactionWriter });
    ctx.saveNote = result.ok ? 'Courier request declined' : `Cannot decline: ${result.why}`;
    ctx.gameState = { ...ctx.gameState };
  }

  function doBlackMarketBuy(townId: string, offerId: string) {
    const result = buyBlackMarket(ctx.gameState, townId, offerId, { writer: ctx.transactionWriter });
    ctx.saveNote = result.ok ? `Black Market purchase · ${result.offer.kind === 'skill' ? `${sm.byId[result.offer.skill!]?.name} XP Level ${result.offer.level}` : `${result.offer.count} ${result.offer.kind === 'stone' ? result.offer.stone : result.offer.good}`} for ${result.offer.price} gold` : `Cannot buy: ${result.why}`;
    if (result.ok) push(ctx.gameState, ctx.saveNote);
    ctx.gameState = { ...ctx.gameState };
  }

  function doTrackDelivery(id: string, tracked: boolean) {
    trackDelivery(ctx.gameState, id, tracked, { writer: ctx.transactionWriter }); ctx.gameState = { ...ctx.gameState };
  }
  function doAcknowledgeDelivery(id: string) {
    acknowledgeDelivery(ctx.gameState, id, { writer: ctx.transactionWriter }); ctx.gameState = { ...ctx.gameState };
  }
  function doDismissDelivery(id: string) {
    announceDelivery(ctx.gameState, id, { writer: ctx.transactionWriter }); ctx.gameState = { ...ctx.gameState };
  }

  function doClaim(i: number, choice?: string) {
    const t = ctx.gameState.town.tasks[i];
    const selected = t && taskBonuses(t).find((option) => option.id === (choice ?? t.stone));
    const paid = selected && resolveQuestBonus(ctx.gameState, selected);
    if (t && claimTask(ctx.gameState, i, choice, { writer: ctx.transactionWriter })) {
      push(ctx.gameState, `Task paid: ${ctx.questBonusText({ ...selected!, ...paid! })}`);
    } else if (t && t.progress >= t.n && !t.claimed) {
      push(ctx.gameState, atSettlement(ctx.gameState)
        ? 'Task reward is waiting — make room in the bag, then claim again'
        : 'Visit a settlement to claim the task reward');
    }
    ctx.gameState = { ...ctx.gameState };
  }

  function doTrackGoal(ref: GoalRef | null) {
    if (!ctx.requireAccountWriter(ref ? 'pinning a goal' : 'clearing a goal')) return;
    setTrackedGoal(ctx.gameState, ref);
    ctx.gameState = { ...ctx.gameState };
    ctx.saveNote = ref ? 'Goal pinned to Journey · it stays ahead of suggestions' : 'Goal cleared · suggestions are back';
  }

  function runForge(kind: ForgeKind, id: string, materialId: string, expected?: { held: number; freeSlots: number }) {
    if (!ctx.transactionWriter) { ctx.forgeNote = 'This tab is read-only.'; return false; }
    const rng = mulberry32(ctx.gameState.rngState);
    const r = forgeGear(ctx.gameState, kind, id, materialId, rng, expected);
    if (!r.ok) { ctx.forgeResultItem = null; ctx.forgeNote = r.why || 'the forge refused'; return false; }
    ctx.gameState.rngState += 1;
    ctx.forgeNote = r.note || 'forged';
    ctx.forgeResultItem = r.item ? itemName(r.item) : null;
    push(ctx.gameState, `Forge · ${ctx.forgeNote}`);
    fx(ctx.gameState, { kind: 'craft', side: 'self', text: ctx.forgeNote, colour: E.elements.crit_colour || 'var(--gold)' });
    ctx.gameState = { ...ctx.gameState };
    return true;
  }

  function runCraft(op: CraftOp, lineIndex: number, pick?: string) {
    if (!ctx.requireAccountWriter('crafting')) return false;
    if (!ctx.bench) return false;
    const target = ctx.bench;
    const rng = mulberry32(ctx.gameState.rngState);
    ctx.gameState.rngState += 1;
    const r = doCraft(ctx.gameState, target.where, target.index, op, lineIndex, rng, pick);
    ctx.benchNote = r.ok ? `${op}: ${r.note}` : `${op} refused — ${r.why}`;
    if (r.ok) {
      ctx.benchSelection = { where: target.where, item: ctx.gameState[target.where][target.index]! };
      push(ctx.gameState, `Bench ${op} · ${r.note}`);
      fx(ctx.gameState, { kind: 'craft', side: 'self', text: `${op} · ${r.note}`, colour: E.elements.crit_colour || 'var(--gold)' });
    }
    ctx.gameState = { ...ctx.gameState };
    return r.ok;
  }

  function doDeposit(i: number, tab: number) {
    if (!ctx.requireAccountWriter('depositing gear')) return;
    const r = deposit(ctx.gameState, i, tab);
    ctx.townNote = r.ok ? 'Deposited into the stash' : `Deposit refused: ${r.why}`;
    ctx.gameState = { ...ctx.gameState };
  }

  function doWithdraw(tab: number, i: number) {
    if (!ctx.requireAccountWriter('withdrawing gear')) return;
    const r = withdraw(ctx.gameState, tab, i);
    ctx.townNote = r.ok ? 'Withdrawn into the bag' : `Withdrawal refused: ${r.why}`;
    ctx.gameState = { ...ctx.gameState };
  }

  function takeStashForCraft(tab: number, index: number): boolean {
    if (!ctx.transactionWriter) { ctx.benchNote = 'This tab is read-only.'; return false; }
    const r = withdraw(ctx.gameState, tab, index);
    if (!r.ok) {
      ctx.benchNote = `Cannot take this piece to the bench: ${r.why}`;
      ctx.gameState = { ...ctx.gameState };
      return false;
    }
    ctx.townNote = 'Taken from Stash into the bag for Crafting';
    ctx.gameState = { ...ctx.gameState };
    return true;
  }

  function storeCraftPiece(index: number, tab: number): boolean {
    if (!ctx.transactionWriter) { ctx.benchNote = 'This tab is read-only.'; return false; }
    const r = deposit(ctx.gameState, index, tab);
    if (!r.ok) {
      ctx.benchNote = `Cannot store this piece: ${r.why}`;
      ctx.gameState = { ...ctx.gameState };
      return false;
    }
    ctx.townNote = `Stored into Stash · Tab ${tab + 1}`;
    ctx.gameState = { ...ctx.gameState };
    return true;
  }

  function doDepositAll(tab: number) {
    if (!ctx.requireAccountWriter('depositing carried gear')) return;
    const n = depositMany(ctx.gameState, ctx.gameState.bag.map((_, i) => i), tab);
    ctx.townNote = n ? `Deposited ${n} piece${n === 1 ? '' : 's'} into tab ${tab + 1}` : 'Nothing to deposit — every piece is locked or the bag is empty';
    ctx.gameState = { ...ctx.gameState };
  }

  function doWithdrawAll(tab: number) {
    if (!ctx.requireAccountWriter('withdrawing stashed gear')) return;
    const n = withdrawMany(ctx.gameState, tab, (ctx.gameState.stash[tab] || []).map((_, i) => i));
    ctx.townNote = n ? `Withdrew ${n} piece${n === 1 ? '' : 's'} from tab ${tab + 1}` : 'Nothing to withdraw — every piece is locked';
    ctx.gameState = { ...ctx.gameState };
  }

  function doTurnIn() {
    if (!ctx.requireAccountWriter('claiming Collector rewards')) return;
    const r = turnIn(ctx.gameState, ctx.town!.id);
    ctx.townNote = r.ok ? `Turned in the ${ctx.viewColSet?.name} set · reward: ${r.reward}` : `Turn-in refused: ${r.why}`;
    ctx.gameState = { ...ctx.gameState };
  }

  return { doSell, doTrade, doProcess, doBuy, buyExpectation, doSkipTask, doRepairGear, doDelivery, doAcceptCourier, doDeclineCourier, doBlackMarketBuy, doTrackDelivery, doAcknowledgeDelivery, doDismissDelivery, doClaim, doTrackGoal, runForge, runCraft, doDeposit, doWithdraw, takeStashForCraft, storeCraftPiece, doDepositAll, doWithdrawAll, doTurnIn };
}
