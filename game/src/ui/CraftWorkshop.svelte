<script lang="ts">
  import { E } from '../engine/client';
  import { gearIcon } from '../icon';
  import { itemName } from '../sim/item-name';
  import { craft, stoneName, type CraftOp, type Where } from '../sim/craft';
  import { gearEntry, type SlotEntry } from './bag';
  import SlotGrid from './SlotGrid.svelte';
  import Forge from './Forge.svelte';
  import CraftBoard from './CraftBoard.svelte';
  import type { GameState, Item } from '../sim/types';
  import stoneRerollValue from '../icon/misc/stones/stone-reroll-value.svg?url';
  import stoneRerollTier from '../icon/misc/stones/stone-reroll-tier.svg?url';
  import stoneAdd from '../icon/misc/stones/stone-add-mod.svg?url';
  import stoneRemove from '../icon/misc/stones/stone-remove-mod.svg?url';
  import stoneQuality from '../icon/misc/stones/stone-quality.svg?url';
  import stoneRepair from '../icon/misc/stones/stone-repair.svg?url';
  import stoneCorrupt from '../icon/misc/stones/stone-corrupt.svg?url';
  import runeStone from '../icon/misc/stones/rune-stone.svg?url';
  import crystalOne from '../icon/misc/stones/crystal-cluster-1.svg?url';
  import crystalTwo from '../icon/misc/stones/crystal-cluster-2.svg?url';
  import crystalGrowth from '../icon/misc/stones/crystal-growth.svg?url';

  let { game, item, where = null, index = -1, onpick, onclear, onrun, wornOf, note = '' }: {
    game: GameState;
    item: Item | null;
    where?: Where | null;
    index?: number;
    onpick: (where: Where, index: number) => void;
    onclear: () => void;
    onrun: (op: CraftOp, line?: number, pick?: string) => void;
    wornOf: (slot: string) => Item | null;
    note?: string;
  } = $props();

  const MIME = 'application/x-modworld-gear';
  const STONE_MIME = 'application/x-modworld-stone';
  const STONES = [
    { key: 'reroll_value', icon: stoneRerollValue, detail: 'Reroll a Mod value inside its Tier' },
    { key: 'tier', icon: stoneRerollTier, detail: 'Change a Mod Tier' },
    { key: 'add', icon: stoneAdd, detail: 'Add an Unbound Mod' },
    { key: 'remove', icon: stoneRemove, detail: 'Remove an Unbound Mod' },
    { key: 'replace', icon: runeStone, detail: 'Change a Mod identity' },
    { key: 'quality', icon: stoneQuality, detail: 'Enhance a gear piece one step' },
    { key: 'polish', icon: crystalOne, detail: 'Reroll every Mod value' },
    { key: 'reforge', icon: crystalTwo, detail: 'Redraw the piece Tier' },
    { key: 'rebirth', icon: crystalGrowth, detail: 'Redraw Unbound Mods' },
    { key: 'corrupt', icon: stoneCorrupt, detail: 'One permanent gamble' },
    { key: 'repair', icon: stoneRepair, detail: 'Repair a Broken piece' },
  ];

  const held = $derived(game.counters.stones || {});
  const regularStones = $derived(STONES.map((stone) => ({ ...stone, name: stoneName(stone.key), count: Number(held[stone.key] || 0) })));
  const imprintStones = $derived(Object.entries(held)
    .filter(([key, count]) => key.startsWith('imprint_') && Number(count) > 0)
    .map(([key, count]) => ({ key, icon: runeStone, detail: 'Write this named Mod', name: stoneName(key), count: Number(count) }))
    .sort((a, b) => a.name.localeCompare(b.name)));
  const ownedRegular = $derived(regularStones.filter((stone) => stone.count > 0));
  const ownedKinds = $derived(ownedRegular.length + imprintStones.length);
  const totalStones = $derived(regularStones.reduce((total, stone) => total + stone.count, 0)
    + imprintStones.reduce((total, stone) => total + stone.count, 0));
  let showAllRegular = $state(false);
  let showImprints = $state(false);
  let imprintQuery = $state('');
  let imprintPage = $state(0);
  let inspectedKey = $state<string | null>(null);
  const regularView = $derived(showAllRegular ? regularStones : ownedRegular);
  const imprintMatches = $derived(imprintStones.filter((stone) => stone.name.toLowerCase().includes(imprintQuery.trim().toLowerCase())));
  const IMPRINTS_PER_PAGE = 8;
  const imprintPages = $derived(Math.max(1, Math.ceil(imprintMatches.length / IMPRINTS_PER_PAGE)));
  const imprintAt = $derived(Math.min(imprintPage, imprintPages - 1));
  const imprintView = $derived(imprintMatches.slice(imprintAt * IMPRINTS_PER_PAGE, (imprintAt + 1) * IMPRINTS_PER_PAGE));
  const inspectedStone = $derived([...regularStones, ...imprintStones].find((stone) => stone.key === inspectedKey) ?? null);
  const wornEntries = $derived(game.gear
    .map((piece, position) => piece ? ({ ...gearEntry(piece, position), kind: 'worn' } as SlotEntry) : null)
    .filter((entry): entry is SlotEntry => entry !== null));
  const bagEntries = $derived(game.bag.map((piece, position) => gearEntry(piece, position)));
  let bagQuery = $state('');
  const shownBag = $derived(bagEntries.filter((entry) =>
    `${entry.title} ${entry.slot} ${entry.sub}`.toLowerCase().includes(bagQuery.trim().toLowerCase())));
  let dropReady = $state(false);
  let dropKind = $state<'piece' | 'stone' | null>(null);
  let dropNote = $state('');
  let stoneRequestId = 0;
  let stoneRequest = $state<{ key: string; id: number; applied?: boolean } | null>(null);

  const STONE_OP: Partial<Record<string, CraftOp>> = {
    reroll_value: 'reroll_random', add: 'add', remove: 'remove', quality: 'upgrade',
    repair: 'repair', corrupt: 'corrupt', polish: 'polish', reforge: 'reforge', rebirth: 'rebirth',
  };

  function selectPiece(source: Where, position: number) {
    stoneRequest = null;
    dropNote = '';
    onpick(source, position);
  }

  function clearBench() {
    stoneRequest = null;
    dropNote = '';
    onclear();
  }

  function startDrag(source: Where, position: number, event: DragEvent) {
    if (!event.dataTransfer) return;
    event.dataTransfer.setData(MIME, JSON.stringify({ where: source, index: position }));
    event.dataTransfer.effectAllowed = 'copy';
  }

  function startStoneDrag(key: string, event: DragEvent) {
    if (!event.dataTransfer) return;
    inspectedKey = key;
    event.dataTransfer.setData(STONE_MIME, key);
    event.dataTransfer.effectAllowed = 'copy';
  }

  function useStone(key: string) {
    if (!item || where == null || index < 0) {
      dropNote = 'Select an equipped or inventory piece before using a stone.';
      return;
    }
    if (!(held[key] > 0)) {
      dropNote = `No ${stoneName(key)} left in the stack.`;
      return;
    }
    inspectedKey = key;
    const direct = STONE_OP[key];
    if (direct) {
      stoneRequestId += 1;
      stoneRequest = { key, id: stoneRequestId, applied: true };
      dropNote = '';
      onrun(direct);
      return;
    }
    const firstUnbound = item.lines.findIndex((_, line) => line >= craft.UNTOUCHABLE);
    if ((key === 'tier' || key.startsWith('imprint_')) && firstUnbound < 0) {
      dropNote = `${stoneName(key)} needs an Unbound Mod line on this piece.`;
      return;
    }
    stoneRequestId += 1;
    stoneRequest = { key, id: stoneRequestId };
    dropNote = '';
  }

  function dragOver(event: DragEvent) {
    const types = Array.from(event.dataTransfer?.types ?? []);
    const hasPiece = types.includes(MIME);
    const hasStone = types.includes(STONE_MIME);
    if (!hasPiece && !hasStone) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    dropReady = true;
    dropKind = hasStone ? 'stone' : 'piece';
  }

  function leaveDrop(event: DragEvent) {
    const target = event.currentTarget as HTMLElement;
    if (event.relatedTarget instanceof Node && target.contains(event.relatedTarget)) return;
    dropReady = false;
    dropKind = null;
  }

  function drop(event: DragEvent) {
    event.preventDefault();
    dropReady = false;
    dropKind = null;
    const stone = event.dataTransfer?.getData(STONE_MIME);
    if (stone) {
      useStone(stone);
      return;
    }
    const raw = event.dataTransfer?.getData(MIME);
    if (!raw) return;
    try {
      const picked = JSON.parse(raw) as { where?: string; index?: number };
      if ((picked.where !== 'gear' && picked.where !== 'bag') || !Number.isInteger(picked.index)) return;
      const position = picked.index as number;
      const source = picked.where === 'gear' ? game.gear : game.bag;
      if (position < 0 || !source[position]) return;
      selectPiece(picked.where, position);
    } catch { /* ignore drops from outside the equipment grids */ }
  }
</script>

<div class="workshop" role="group" aria-label="Crafting workspace" ondragend={() => { dropReady = false; dropKind = null; }}>
  <aside class="stone-pane" aria-label="Crafting stones">
    <header class="pane-head">
      <h3>Stones</h3>
      <span>{ownedKinds} kinds · {totalStones} held</span>
    </header>
    {#if showImprints}
      <div class="stone-controls">
        <button onclick={() => (showImprints = false)}>Regular stones</button>
        <b>{imprintStones.length} imprints</b>
      </div>
      <input class="imprint-search" type="search" placeholder="Find an imprint…" aria-label="Find an imprint stone"
             bind:value={imprintQuery} oninput={() => (imprintPage = 0)} />
      <div class="imprint-list" aria-live="polite">
        {#each imprintView as stone (stone.key)}
          <button class="imprint-row" class:chosen={inspectedKey === stone.key} title={stone.name}
                  aria-pressed={inspectedKey === stone.key} draggable={stone.count > 0}
                  ondragstart={(event) => startStoneDrag(stone.key, event)} onclick={() => (inspectedKey = stone.key)}>
            <img src={stone.icon} alt="" aria-hidden="true" />
            <span>{stone.name.replace(/^Imprint — /, '')}</span>
            <b>{stone.count}</b>
          </button>
        {:else}
          <p class="stone-empty">{imprintStones.length ? 'No imprint matches that name.' : 'No imprint stones held yet.'}</p>
        {/each}
      </div>
      <div class="imprint-pages" role="group" aria-label="Imprint stone pages">
        <button disabled={imprintAt === 0} onclick={() => (imprintPage = imprintAt - 1)}>Previous</button>
        <span>{imprintAt + 1} / {imprintPages}</span>
        <button disabled={imprintAt === imprintPages - 1} onclick={() => (imprintPage = imprintAt + 1)}>Next</button>
      </div>
    {:else}
      <div class="stone-controls">
        <span>Regular stones</span>
        <button class="imprint-open" aria-expanded="false" onclick={() => { showImprints = true; imprintPage = 0; }}>
          Imprints · {imprintStones.length}
        </button>
      </div>
      <div class="stone-grid">
        {#each regularView as stone (stone.key)}
          <button class="stone-tile" class:unowned={stone.count === 0} class:chosen={inspectedKey === stone.key}
                  title={`${stone.name} · ${stone.count} held · ${stone.detail}`}
                  aria-label={`${stone.name}, ${stone.count} held. Inspect details`}
                  aria-pressed={inspectedKey === stone.key} draggable={stone.count > 0}
                  ondragstart={(event) => startStoneDrag(stone.key, event)} onclick={() => (inspectedKey = stone.key)}>
            <img src={stone.icon} alt="" aria-hidden="true" />
            <b>{stone.count}</b>
            <span>{stone.name.replace(/ Stone$/, '')}</span>
          </button>
        {:else}
          <p class="stone-empty">No regular stones held. Open all types to see the catalogue.</p>
        {/each}
      </div>
      {#if ownedRegular.length < regularStones.length}
        <button class="all-types" onclick={() => (showAllRegular = !showAllRegular)}>
          {showAllRegular ? 'Show held only' : 'Show all types'}
        </button>
      {/if}
    {/if}
    <div class="stone-detail" aria-live="polite">
      {#if inspectedStone}
        <strong>{inspectedStone.name} · {inspectedStone.count} held</strong>
        <span>{inspectedStone.detail}</span>
      {:else}
        <span>Select a stone to read what it does.</span>
      {/if}
    </div>
  </aside>

  <section class="craft-pane" aria-label="Crafting bench">
    <header class="pane-head">
      <h3>Craft</h3>
      <span>Drag gear to select · drag a stone onto the piece to use it</span>
    </header>
    <div class="drop-slot" class:ready={dropReady} class:stone-ready={dropKind === 'stone'} role="group" aria-label="Item on the crafting bench"
         ondragover={dragOver} ondragleave={leaveDrop} ondrop={drop}>
      {#if item}
        <div class="piece-icon"><img src={gearIcon(item)} alt="" aria-hidden="true" /></div>
        <div class="piece-copy">
          <strong>{itemName(item)}{item.upgrade_lv ? ` +${item.upgrade_lv}` : ''}</strong>
          <span>{where === 'gear' ? 'Equipped' : 'Inventory'} · {item.slot} · level {item.ilvl}</span>
          <small>{item.quality} quality · {item.tier} · {item.lines.length} Mod lines · hover gear for full Mods</small>
          {#if dropReady}<small class="drop-hint">{dropKind === 'stone' ? 'Release to use this stone' : 'Release to select this piece'}</small>{/if}
        </div>
        <button class="clear" onclick={clearBench} aria-label="Remove item from crafting bench">Clear</button>
      {:else}
        <div class="piece-icon vacant"><img src={stoneQuality} alt="" aria-hidden="true" /></div>
        <div class="piece-copy">
          <strong>Place a piece here</strong>
          <span>Drag from Equipped or Inventory</span>
          <small>Drag gear from Equipped or Inventory here first.</small>
          {#if dropReady}<small class="drop-hint">Release to select this piece</small>{/if}
        </div>
      {/if}
    </div>
    <div class="operations">
      {#if item}
        {#if dropNote}<p class="work-note" role="status">{dropNote}</p>{/if}
        {#if note}<p class="work-note" role="status">{note}</p>{/if}
        <Forge state={game} {item} {where} {index} {onpick} onrun={(op) => onrun(op, 0)} {wornOf} embedded compact />
        <CraftBoard {game} {item} {where} {index} {onpick} {onrun} {wornOf} {stoneRequest}
                    onstoneclear={() => (stoneRequest = null)} embedded />
      {:else}
        {#if dropNote}<p class="work-note" role="status">{dropNote}</p>{/if}
        <p class="empty-work">Select a piece to see the stones and actions it can use.</p>
      {/if}
    </div>
  </section>

  <aside class="equipment-pane" aria-label="Equipped gear">
    <header class="pane-head">
      <h3>Equipped</h3>
      <span>Click or drag an equipped piece</span>
    </header>
    <div class="doll-wrap">
      <SlotGrid entries={wornEntries} capacity={E.stat.item_slots} fixed layout="doll" compactDoll {wornOf}
                selectedIndex={where === 'gear' ? index : null}
                onpick={(position) => selectPiece('gear', position)}
                ondragitem={(entry, event) => startDrag('gear', entry.index, event)} />
    </div>
  </aside>

  <aside class="inventory-pane" aria-label="Inventory gear">
    <div class="pile-head">
      <h3>Inventory</h3>
      <span>Hunt pile · {game.bag.length} / {E.inventory.adventure_slots}</span>
    </div>
    <input type="search" class="pile-search" placeholder="Find gear…" aria-label="Find gear to craft" bind:value={bagQuery} />
    <SlotGrid entries={shownBag} capacity={E.inventory.adventure_slots} mode="grid" {wornOf}
              selectedIndex={where === 'bag' ? index : null}
              onpick={(position) => selectPiece('bag', position)}
              ondragitem={(entry, event) => startDrag('bag', entry.index, event)} />
  </aside>
</div>

<style>
  .workshop {
    display: grid; grid-template-columns: minmax(clamp(150px, 11.62vw, 324px), .75fr) minmax(0, 2.1fr) minmax(clamp(150px, 11.62vw, 324px), 1fr);
    grid-template-rows: minmax(clamp(200px, 15.49vw, 432px), 1.2fr) minmax(clamp(150px, 11.62vw, 324px), .9fr);
    grid-template-areas: "stones craft equipment" "stones inventory inventory";
    gap: var(--spacing-sm); width: 100%; height: 100%; min-height: 0;
  }
  .stone-pane, .craft-pane, .equipment-pane, .inventory-pane { min-width: 0; min-height: 0; border: 1px solid var(--line); background: var(--panel); }
  .stone-pane { grid-area: stones; }
  .craft-pane { grid-area: craft; }
  .equipment-pane { grid-area: equipment; }
  .inventory-pane { grid-area: inventory; }
  .stone-pane { display: flex; flex-direction: column; overflow: hidden; }
  .craft-pane { display: flex; flex-direction: column; overflow: hidden; background: var(--bg); }
  .equipment-pane, .inventory-pane { display: flex; flex-direction: column; overflow: hidden; }
  .pane-head, .pile-head {
    display: flex; align-items: baseline; justify-content: space-between; flex-wrap: wrap; gap: var(--spacing-xs);
    padding: var(--spacing-sm); border-bottom: 1px solid var(--line);
  }
  h3 { margin: 0; color: var(--gold); font-size: var(--font-sm); }
  .pane-head span, .pile-head span { color: var(--dim); font-size: var(--font-xs); font-variant-numeric: tabular-nums; }
  .stone-controls { display: flex; align-items: center; justify-content: space-between; gap: var(--spacing-xs); padding: var(--spacing-xs) var(--spacing-sm); color: var(--dim); font-size: var(--font-xs); }
  .stone-controls button { padding: var(--spacing-xs) var(--spacing-xs); color: var(--gold); font-size: var(--font-xs); }
  .stone-controls b { font-weight: 500; font-variant-numeric: tabular-nums; }
  .stone-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--spacing-xs); align-content: start; padding: 0 var(--spacing-sm); min-height: 0; }
  .stone-tile { position: relative; display: grid; grid-template-columns: var(--icon-sm) minmax(0, 1fr); align-items: center; gap: var(--spacing-xs); min-width: 0; min-height: var(--icon-lg); padding: var(--spacing-xs); text-align: left; background: var(--inset); }
  .stone-tile img { width: var(--icon-sm); height: var(--icon-sm); object-fit: contain; }
  .stone-tile span { grid-column: 1 / -1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--dim); font-size: var(--font-xs); }
  .stone-tile b { justify-self: end; color: var(--gold-lit); font-family: var(--num); font-size: var(--font-xs); font-variant-numeric: tabular-nums; }
  .stone-tile[draggable="true"], .imprint-row[draggable="true"] { cursor: grab; }
  .stone-tile[draggable="true"]:active, .imprint-row[draggable="true"]:active { cursor: grabbing; }
  .stone-tile.unowned { opacity: .65; }
  .stone-tile.chosen, .imprint-row.chosen { border-color: var(--gold); background: color-mix(in srgb, var(--gold) 10%, var(--inset)); }
  .all-types { align-self: flex-start; margin: var(--spacing-xs) var(--spacing-sm); padding: var(--spacing-xs) var(--spacing-xs); color: var(--dim); font-size: var(--font-xs); }
  .imprint-search { margin: 0 var(--spacing-sm) var(--spacing-xs); min-width: 0; }
  .imprint-list { flex: 1; min-height: 0; display: grid; grid-template-rows: repeat(8, minmax(0, 1fr)); gap: var(--spacing-xs); padding: 0 var(--spacing-sm); }
  .imprint-row { display: grid; grid-template-columns: var(--icon-sm) minmax(0, 1fr) auto; align-items: center; gap: var(--spacing-xs); min-width: 0; min-height: 0; padding: var(--spacing-xs) var(--spacing-xs); text-align: left; background: var(--inset); }
  .imprint-row img { width: var(--icon-sm); height: var(--icon-sm); object-fit: contain; }
  .imprint-row span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: var(--font-xs); }
  .imprint-row b { color: var(--gold-lit); font-family: var(--num); font-size: var(--font-xs); }
  .imprint-pages { display: flex; align-items: center; justify-content: space-between; gap: var(--spacing-xs); padding: var(--spacing-xs) var(--spacing-sm); font-size: var(--font-xs); font-variant-numeric: tabular-nums; }
  .imprint-pages button { padding: var(--spacing-xs) var(--spacing-xs); font-size: var(--font-xs); }
  .imprint-pages button:disabled { opacity: .4; }
  .stone-empty { grid-column: 1 / -1; margin: var(--spacing-xs) 0; color: var(--dim); font-size: var(--font-xs); }
  .stone-detail { display: grid; gap: var(--spacing-xs); margin-top: auto; padding: var(--spacing-sm); border-top: 1px solid var(--line); font-size: var(--font-xs); }
  .stone-detail strong { color: var(--gold-lit); font-weight: 600; }
  .stone-detail span { color: var(--dim); }
  .drop-slot {
    display: flex; align-items: center; gap: var(--spacing-sm); min-height: clamp(81px, 6.29vw, 176px);
    margin: var(--spacing-sm); padding: var(--spacing-sm); border: 1px dashed var(--gold);
    background: color-mix(in srgb, var(--gold) 6%, var(--inset)); transition: background var(--motion-fast) var(--ease-ui), border-color var(--motion-fast) var(--ease-ui);
  }
  .drop-slot.ready { border-style: solid; border-color: var(--focus); background: color-mix(in srgb, var(--focus) 14%, var(--inset)); }
  .drop-slot.stone-ready { border-style: solid; border-color: var(--gold-lit); background: color-mix(in srgb, var(--gold) 14%, var(--inset)); }
  .drop-hint { color: var(--gold-lit) !important; }
  .piece-icon { flex: none; width: var(--icon-xl); aspect-ratio: 1; display: grid; place-items: center; border: 1px solid var(--edge); background: var(--inset); }
  .piece-icon img { width: 80%; height: 80%; object-fit: contain; }
  .piece-icon.vacant img { opacity: .38; }
  .piece-copy { display: grid; gap: var(--spacing-xs); min-width: 0; }
  .piece-copy strong { color: var(--text); font-size: var(--font-sm); }
  .piece-copy span, .piece-copy small { color: var(--dim); font-size: var(--font-xs); }
  .clear { margin-left: auto; align-self: start; font-size: var(--font-xs); }
  .operations { flex: 1; min-height: 0; overflow: hidden; padding: var(--spacing-xs); display: grid; align-content: start; gap: var(--spacing-xs); }
  .work-note { margin: 0; color: var(--gold-lit); font-size: var(--font-xs); }
  .empty-work { margin: 0; color: var(--dim); font-size: var(--font-sm); }
  .doll-wrap { padding: var(--spacing-xs); }
  .pile-head { flex: none; }
  .pile-search { display: block; flex: none; width: calc(100% - var(--spacing-sm) * 2); margin: var(--spacing-sm); }
  .inventory-pane :global(.grid) { flex: 1; min-height: 0; overflow: hidden; align-content: start; grid-template-columns: repeat(auto-fill, minmax(var(--icon-lg), 1fr)); margin: 0 var(--spacing-sm) var(--spacing-sm); }
  .inventory-pane :global(.bar) { display: none; }
</style>
