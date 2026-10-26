import { describe, expect, it } from 'vitest';
import { newGame } from '../src/sim/game';
import { repairGear } from '../src/sim/town';
import { settlementCell } from '../src/sim/road';
import type { Item } from '../src/sim/types';
import { refreshSelectionAfterRepair, resolveItemSelection } from '../src/ui/inventory/item-selection';
import { newCraftWorkbenchView, nextCraftReveal, revealPageFor } from '../src/ui/inventory/craft-workbench';

const piece = (ilvl: number, broken = false): Item => ({
  slot: 'ring', base: 'Band', ilvl, quality: 'mid', tier: 'T1', q: 1, broken,
  lines: [{ id: 'max_hp_flat', value: ilvl }, { id: 'armour_flat', value: 8 }],
});

describe('workbench item identity', () => {
  it('follows the same Item object through insert, reorder and removal', () => {
    const game = newGame(71);
    const selected = piece(20), first = piece(10), last = piece(30);
    game.bag = [selected, first];
    const selection = { where: 'bag' as const, item: selected };
    expect(resolveItemSelection(game, selection)?.index).toBe(0);

    game.bag.unshift(last);
    expect(resolveItemSelection(game, selection)?.index).toBe(1);
    game.bag.reverse();
    expect(resolveItemSelection(game, selection)?.index).toBe(1);
    game.bag.splice(game.bag.indexOf(selected), 1);
    expect(resolveItemSelection(game, selection)).toBeNull();
  });

  it('does not follow a different Item that happens to hold the same data', () => {
    const game = newGame(72);
    const selected = piece(20), lookalike = piece(20);
    game.bag = [lookalike];
    expect(resolveItemSelection(game, { where: 'bag', item: selected })).toBeNull();
  });

  it('moves the bench to the repaired replacement only when the repaired piece is the bench target', () => {
    const game = newGame(73);
    const selected = piece(20), other = piece(30);
    game.bag = [selected, other];
    const selection = { where: 'bag' as const, item: selected };
    const target = resolveItemSelection(game, selection)!;
    const repaired = piece(20);
    repaired.broken = false;
    game.bag[0] = repaired;

    expect(refreshSelectionAfterRepair(game, selection, target, 'bag', 0)?.item).toBe(repaired);
    expect(refreshSelectionAfterRepair(game, selection, target, 'bag', 1)?.item).toBe(selected);
    game.bag[1] = piece(40);
    expect(refreshSelectionAfterRepair(game, selection, target, 'bag', 0)?.item).toBe(repaired);
  });

  it('keeps the bench reference after the Armourer replaces a broken piece', () => {
    const game = newGame(74);
    game.cell = settlementCell('highspire')!;
    game.walk = null;
    game.counters.gold = 5000;
    const broken = piece(20, true), other = piece(30);
    game.bag = [broken, other];
    const selection = { where: 'bag' as const, item: broken };
    const target = resolveItemSelection(game, selection)!;
    const result = repairGear(game, 'highspire', 'bag', 0);
    expect(result.ok, result.why).toBe(true);
    expect(game.bag[0]).not.toBe(broken);
    expect(game.bag[0].broken).toBe(false);
    const kept = refreshSelectionAfterRepair(game, selection, target, 'bag', 0);
    expect(kept?.item).toBe(game.bag[0]);

    const refused = repairGear(game, 'highspire', 'bag', 0);
    expect(refused.ok).toBe(false);
    expect(refreshSelectionAfterRepair(game, kept, target, 'bag', 0)?.item).toBe(game.bag[0]);
  });
});

describe('contextual source reveal', () => {
  it('finds the page from the live filtered order and the measured capacity', () => {
    const target = piece(20);
    const entries = [piece(10), piece(15), target, piece(30), piece(40)].map((item) => ({ item }));
    expect(revealPageFor(entries, target, 1)).toBe(2);
    expect(revealPageFor(entries, target, 2)).toBe(1);
    expect(revealPageFor(entries, target, 3)).toBe(0);
    entries.reverse();
    expect(revealPageFor(entries, target, 2)).toBe(1);
    entries.splice(entries.findIndex((entry) => entry.item === target), 1);
    expect(revealPageFor(entries, target, 2)).toBeNull();
  });

  it('does not reveal a piece that is not in the current source list', () => {
    expect(revealPageFor([{ item: piece(10) }], piece(20), 4)).toBeNull();
  });

  it('waits for the bag grid measurement, resolves the page, and reports a vanished piece', () => {
    const target = piece(20);
    const entries = [piece(10), target, piece(30)].map((item) => ({ item }));
    const view = { ...newCraftWorkbenchView(), reveal: { where: 'bag' as const, item: target } };
    expect(nextCraftReveal(view, entries, 1, null)).toEqual({ kind: 'wait' });
    expect(nextCraftReveal(view, entries, 1, 'stash')).toEqual({ kind: 'wait' });
    expect(nextCraftReveal(view, entries, 1, 'inventory')).toEqual({ kind: 'page', page: 1 });
    const missing = { ...view, reveal: { where: 'bag' as const, item: piece(99) } };
    expect(nextCraftReveal(missing, entries, 1, 'inventory')).toEqual({ kind: 'missing' });
  });

  it('resolves an equipped reveal without a page and does nothing without a request', () => {
    const target = piece(20);
    const view = { ...newCraftWorkbenchView(), reveal: { where: 'gear' as const, item: target } };
    expect(nextCraftReveal(view, [{ item: target }], 1, null)).toEqual({ kind: 'page', page: null });
    expect(nextCraftReveal(newCraftWorkbenchView(), [{ item: target }], 1, null)).toEqual({ kind: 'none' });
  });

  it('keeps browsing state while adding only the contextual reveal request', () => {
    const view = { ...newCraftWorkbenchView(), advanced: true, bagQuery: 'Band', selectedKey: 'tier' };
    const next = { ...view, reveal: { where: 'bag' as const, item: piece(20) } };
    expect(next.advanced).toBe(true);
    expect(next.bagQuery).toBe('Band');
    expect(next.selectedKey).toBe('tier');
    expect(newCraftWorkbenchView().reveal).toBeNull();
  });
});
