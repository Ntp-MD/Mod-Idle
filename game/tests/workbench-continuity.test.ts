import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { fileURLToPath } from 'node:url';
import { createServer, type ViteDevServer } from 'vite';
import type { Component } from 'svelte';
import type { render as renderComponent } from 'svelte/server';
import { tree } from '../src/engine/client';
import { newGame } from '../src/sim/game';
import { canSpendTree, treePath } from '../src/sim/tree';
import type { Item } from '../src/sim/types';
import { newCraftWorkbenchView } from '../src/ui/inventory/craft-workbench';

let server: ViteDevServer;
let render: typeof renderComponent;
let CraftWorkshop: Component<any>;
let PassiveTreeDetails: Component<any>;
beforeAll(async () => {
  // The ordinary suite imports pure TS. Use the app's compiler for these SSR-only component checks.
  server = await createServer({
    configFile: fileURLToPath(new URL('../vite.config.ts', import.meta.url)),
    server: { middlewareMode: true, watch: null, hmr: false }, appType: 'custom',
  });
  render = (await server.ssrLoadModule('svelte/server')).render;
  CraftWorkshop = (await server.ssrLoadModule('/src/ui/inventory/CraftWorkshop.svelte')).default;
  PassiveTreeDetails = (await server.ssrLoadModule('/src/ui/passive-tree/PassiveTreeDetails.svelte')).default;
});
afterAll(async () => { await server?.close(); });

const piece = (ilvl: number): Item => ({
  slot: 'ring', base: 'Band', ilvl, quality: 'mid', tier: 'T1', q: 1,
  lines: [{ id: 'max_hp_flat', value: ilvl }, { id: 'armour_flat', value: 8 },
    { id: 'max_mana_flat', value: 15 }, { id: 'hp_regen_flat', value: 5 }],
});

describe('workbench panel continuity', () => {
  it('reopens a retained Craft operation and searches with the stone disarmed', () => {
    const game = newGame(41), item = piece(20);
    game.bag = [item];
    game.counters.stones.tier = 20;
    const view = {
      ...newCraftWorkbenchView(), advanced: true, selectedKey: 'tier', modeOp: 'reroll_mod_all' as const,
      chosenMod: 'max_hp_flat', stoneQuery: 'tier', bagQuery: 'Band', sourceTab: 'inventory' as const,
    };
    const props = { game, item, where: 'bag' as const, index: 0, view,
      onpick: vi.fn(), onclear: vi.fn(), onrun: vi.fn(() => true), wornOf: () => null };
    const before = JSON.stringify(view);
    for (let open = 0; open < 2; open++) {
      const { body } = render(CraftWorkshop, { props });
      expect(body).toContain('value="tier"');
      expect(body).toContain('value="Band"');
      expect(body).toMatch(/<option value="reroll_mod_all"[^>]* selected/);
      expect(body).toContain('Use this stone');
      expect(body).not.toContain('Cancel · Esc');
      expect(props.onrun).not.toHaveBeenCalled();
      expect(JSON.stringify(view)).toBe(before);
    }
  });

  it('keeps the source page and resolves a stashed selection after reorder or removal', () => {
    const game = newGame(42), selected = piece(20);
    game.bag = [piece(10), piece(30), piece(40)];
    game.stash = [[piece(10), selected]];
    const view = { ...newCraftWorkbenchView(), sourceTab: 'inventory' as const, bagPage: 1 };
    const props = { game, item: null, view, stashTabs: 1,
      onpick: vi.fn(), onclear: vi.fn(), onrun: vi.fn(() => true), wornOf: () => null };
    expect(render(CraftWorkshop, { props }).body).toContain('2 / 3');
    expect(view.bagPage).toBe(1);

    const stashView = { ...view, sourceTab: 'stash' as const, stashItem: selected };
    game.stash[0].unshift(piece(60));
    const read = () => render(CraftWorkshop, { props: { ...props, view: stashView } }).body;
    expect(read()).not.toMatch(/<button[^>]*disabled[^>]*>Take to bench/);
    game.stash[0].splice(game.stash[0].indexOf(selected), 1);
    expect(read()).toMatch(/<button[^>]*disabled[^>]*>Take to bench/);
  });

  it('renders inspectable route-step grants while retaining the destination and full-route action', () => {
    const game = newGame(43);
    game.player.treePoints = 10000;
    game.player.attainmentPoints = 10000;
    const selected = tree.byId['keystone.ironwall'], path = treePath(game, selected.id);
    const titleOf = (node: typeof selected) => node.name || node.id;
    const select = vi.fn();
    const { body } = render(PassiveTreeDetails, { props: {
      selected, game, path, verdict: canSpendTree(game, selected.id), byId: tree.byId,
      titleOf, grantLabel: (grant: typeof selected.grants[number]) => grant.id,
      effectText: (node: typeof selected) => node.description || '', lineLabel: (id: string) => id,
      iconOf: () => '', onbuy: vi.fn(), onpath: vi.fn(), onselect: select, ontrackgoal: vi.fn(),
    } });
    expect(path.nodes.length).toBeGreaterThan(1);
    expect(body).toMatch(/<h3\b[^>]*>Ironwall<\/h3>/);
    expect(body).toContain('Allocate full route');
    expect(body).toContain(`${path.nodes.length} skills`);
    for (const id of path.nodes) {
      expect(body).toContain(`aria-label="${titleOf(tree.byId[id])} route step details"`);
    }
    expect(select).not.toHaveBeenCalled();
  });
});
