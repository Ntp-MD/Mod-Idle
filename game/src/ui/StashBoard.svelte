<script lang="ts">
  /**
   * The warehouse board — and the reason a kept piece has somewhere to go.
   *
   * The stash is one record on the character, not a chest per town: every settlement opens the same tabs,
   * which is the quality-of-life the owner asked for. So a trip home is never wasted on a walk to a
   * particular house, and the town's own screen spends its bag slot on this instead of a second shelf.
   *
   * Two grids face each other and one piece is selected at a time, because the actual job is a transfer:
   * read the piece, say which way it moves. Deposit and withdrawal rules stay in `sim/town` — a locked
   * piece stays put, and a full bag refuses the walk back rather than dropping anything. Neither shelf is
   * paged: every slot the side holds is drawn at once, and the panel body is what scrolls.
   */
  import { gearIcon, icon } from '../icon';
  import { STASH_TAB_CAP } from '../sim/town';
  import { slotsAvailable, slotsFree, slotsUsed } from '../sim/slots';
  import { itemName } from '../sim/item-name';
  import { gearEntry, sortEntries, rankTone, SORT_LABELS, type SortKey } from './bag';
  import ItemDetail from './ItemDetail.svelte';
  import Tabs from './Tabs.svelte';
  import { setDrag, readDrag } from './drag';
  import type { GameState, Item } from '../sim/types';

  let { game, tabs, tab, carriedSort = 'level', addtab = null, ontab, onaddtab, oncarriedsort, ondeposit, onwithdraw, ondepositAll, onwithdrawAll, onlock, onequip, wornOf }: {
    game: GameState;
    tabs: number;
    tab: number;
    carriedSort?: SortKey;
    addtab?: { rowId: string; label: string; price: number; can: boolean; why: string } | null;
    ontab: (t: number) => void;
    onaddtab?: (rowId: string) => void;
    oncarriedsort?: (k: SortKey) => void;
    ondeposit: (bagIndex: number) => void;
    onwithdraw: (stashIndex: number) => void;
    ondepositAll: () => void;
    onwithdrawAll: () => void;
    onlock: (item: Item) => void;
    onequip: (bagIndex: number) => void;
    wornOf: (slot: string) => Item | null;
  } = $props();

  let side = $state<'bag' | 'stash'>('bag');
  let at = $state(-1);
  const stored = $derived(game.stash[tab] || []);
  const carried = $derived(sortEntries(game.bag.map((item, i) => gearEntry(item, i)), carriedSort));
  const chosen: Item | null = $derived(side === 'bag' ? (game.bag[at] ?? null) : (stored[at] ?? null));
  /** the whole bag bounds a withdrawal: stacks and kept pieces share the same slots */
  const capacity = $derived(slotsAvailable(game));
  const used = $derived(slotsUsed(game));
  const full = $derived(slotsFree(game) < 1);
  const storedAll = $derived(game.stash.reduce((n, t) => n + t.length, 0));
  /** The Add-a-tab button's mark: a crate off the shelf, the same way every other figure is picked. */
  const crateArt = icon('crate');
  const tabLabel = (t: number) => `Tab ${t + 1} · ${(game.stash[t] || []).length} stored`;

  function pick(s: 'bag' | 'stash', i: number) { side = s; at = i; }

  /**
   * The two shelves are each other's drop target: a piece dragged from one side lands on the other, which
   * is the same transfer the two buttons below the card make. The ref names where the piece came from, so
   * the drop only ever moves it one way — a carried piece goes in, a stored one comes out.
   */
  function dragFrom(where: 'bag' | 'stash', index: number, e: DragEvent) {
    setDrag(e, where === 'stash' ? { where: 'stash', index, tab } : { where: 'bag', index });
  }

  function dropOn(s: 'bag' | 'stash', e: DragEvent) {
    const ref = readDrag(e);
    if (!ref) return;
    e.preventDefault();
    if (s === 'stash' && ref.where === 'bag') act(() => ondeposit(ref.index), 'bag');
    else if (s === 'bag' && ref.where === 'stash') act(() => onwithdraw(ref.index), 'stash');
  }
  function act(fn: () => void, keep: 'same' | 'bag' | 'stash' = 'same') {
    fn();
    if (keep === 'bag') { side = 'bag'; at = -1; }
    else if (keep === 'stash') { side = 'stash'; at = -1; }
    else if (side === 'bag') at = Math.min(at, game.bag.length - 1);
    else at = Math.min(at, stored.length - 1);
  }
</script>

<div class="board">
  <div class="shead">
    <div class="tabbar">
      <Tabs
        label="Stash tabs"
        tabs={Array.from({ length: tabs }, (_, t) => ({ id: String(t), label: tabLabel(t) }))}
        active={String(tab)}
        onpick={(id) => { ontab(Number(id)); pick('stash', -1); }}
        tabindex={tabs > 1}
        tabClass="tb"
      >
        {#snippet item(t)}
          <span>Tab {Number(t.id) + 1}</span><b>{(game.stash[Number(t.id)] || []).length}</b>
        {/snippet}
      </Tabs>
      <button class="add btn btn-quiet" disabled={!addtab?.can}
              title={addtab ? `${addtab.label} — ${addtab.price} gold at this settlement's stall` : 'No line this settlement stocks adds a tab'}
              onclick={() => addtab && onaddtab?.(addtab.rowId)}>
        <img src={crateArt} alt="" aria-hidden="true" />
        <span>Add a tab</span>
        {#if addtab}<b>{addtab.price} gold</b>{/if}
      </button>
      <p class="note"><small>{addtab
        ? (addtab.can ? addtab.label : `${addtab.label} — ${addtab.why}`)
        : (tabs >= STASH_TAB_CAP ? `All ${STASH_TAB_CAP} tabs are open.` : 'No tab for sale at this settlement.')}</small></p>
    </div>
  </div>

  <div class="grids">
    <section class="shelf">
      <header>
        <h4>Bag · what you carry</h4>
        <span class="count" class:alarm={full}>{game.bag.length} piece{game.bag.length === 1 ? '' : 's'} · {used} / {capacity} slots</span>
      </header>
      <div class="grid" role="group" aria-label="The bag — drop a stored piece here to take it back"
           ondragover={(e) => e.preventDefault()} ondrop={(e) => dropOn('bag', e)}>
        {#each carried as e, k (e.index)}
          <button class="cell slot slot-gear" class:selected={side === 'bag' && at === k} class:locked={e.item?.locked}
                  style:--rar={rankTone(e.item)}
                  draggable="true"
                  ondragstart={(ev) => dragFrom('bag', e.index, ev)}
                  onclick={() => pick('bag', k)} aria-label={e.title}>
            <img class="slot-icon" src={e.icon} alt="" aria-hidden="true" />
            {#if (e.item?.upgrade_lv || 0) > 0}<b class="badge badge-count xp plus">+{e.item?.upgrade_lv}</b>{/if}
          </button>
        {:else}
          <p class="dim">The bag holds no piece right now.</p>
        {/each}
      </div>
      <div class="bulk">
        <select value={carriedSort} aria-label="Order the bag"
                onchange={(e) => oncarriedsort?.((e.target as HTMLSelectElement).value as SortKey)}>
          {#each Object.keys(SORT_LABELS) as k (k)}<option value={k}>{SORT_LABELS[k as SortKey]}</option>{/each}
        </select>
        <button disabled={!game.bag.length || !tabs} onclick={() => act(ondepositAll, 'bag')}>Stash every unlocked piece → Tab {tab + 1}</button>
      </div>
    </section>

    <section class="shelf">
      <header>
        <h4>Stash · tab {tab + 1}</h4>
        <span class="count">{stored.length} stored · {storedAll} in all tabs</span>
      </header>
      {#if tabs}
        <div class="grid" role="group" aria-label={`Stash tab ${tab + 1} — drop a carried piece here to deposit it`}
             ondragover={(e) => e.preventDefault()} ondrop={(e) => dropOn('stash', e)}>
          {#each stored as it, k (k)}
            <button class="cell slot slot-gear" class:selected={side === 'stash' && at === k} class:locked={it.locked}
                    style:--rar={rankTone(it)}
                    draggable="true"
                    ondragstart={(ev) => dragFrom('stash', k, ev)}
                    onclick={() => pick('stash', k)} aria-label={itemName(it)}>
              <img class="slot-icon" src={gearIcon(it)} alt="" aria-hidden="true" />
              {#if (it.upgrade_lv || 0) > 0}<b class="badge badge-count xp plus">+{it.upgrade_lv}</b>{/if}
            </button>
          {:else}
            <p class="dim">This tab is empty.</p>
          {/each}
        </div>
        <div class="bulk">
          <button disabled={!stored.length || full} onclick={() => act(onwithdrawAll, 'stash')}>Take back every unlocked piece</button>
        </div>
      {:else}
        <p class="dim">Buy a tab on a settlement stall.</p>
      {/if}
    </section>
  </div>

  <div class="draw">
    {#if chosen}
      <div class="detail">
        <ItemDetail item={chosen} worn={wornOf(chosen.slot)} wornHere={false} onequip={null} />
      </div>
      <div class="moves">
        {#if side === 'bag'}
          <button class="go" disabled={!tabs} onclick={() => act(() => ondeposit(at), 'bag')}>Deposit → Tab {tab + 1}</button>
          <button disabled={chosen.locked} onclick={() => act(() => onequip(at))}>Equip it</button>
        {:else}
          <button class="go" disabled={full} onclick={() => act(() => onwithdraw(at), 'stash')}>
            {full ? 'The bag is full — sell, dissolve or free a slot first' : 'Take into the bag'}
          </button>
        {/if}
        <button class="lk" onclick={() => act(() => onlock(chosen))}>{chosen.locked ? 'Unlock' : 'Lock'} this piece</button>
        <p><small>{chosen.locked
          ? 'Locked: bulk deposit and withdrawal skip it, and the bag filter will not dissolve it.'
          : 'A locked piece never moves on its own — lock the ones a set or a gamble depends on.'}</small></p>
      </div>
    {/if}
  </div>
</div>

<style>
  .board { display: grid; gap: var(--spacing-sm); }
  .shead { display: grid; gap: var(--spacing-xs); }
  .tabbar { display: flex; flex-wrap: wrap; align-items: center; gap: var(--spacing-xs); padding-bottom: var(--spacing-xs); border-bottom: 1px solid var(--line); }
  /* the tab buttons live in Tabs.svelte's scope, so their face styles reach them globally */
  .tabbar :global(.tb) { display: inline-flex; align-items: center; gap: var(--spacing-xs); }
  .tabbar :global(.tb b) { font-family: var(--num); color: var(--dim); font-weight: 500; }
  .tabbar :global(.tb.picked b) { color: var(--gold); }
  .add { display: inline-flex; align-items: center; gap: var(--spacing-xs); }
  .add img { width: var(--icon-label); height: var(--icon-label); object-fit: contain; }
  .add b { font-family: var(--num); color: var(--gold); font-weight: 500; }
  .note { flex: 1 1 auto; min-width: 0; margin: 0; color: var(--dim); font-size: var(--font-xs); }

  .grids { display: grid; grid-template-columns: 1fr 1fr; gap: var(--spacing-md); align-items: start; }
  .shelf { display: grid; gap: var(--spacing-xs); align-content: start; min-width: 0; }
  .shelf header { display: flex; align-items: baseline; gap: var(--spacing-xs); justify-content: space-between; }
  .shelf h4 { margin: 0; }
  .count { font-family: var(--num); font-size: var(--font-xs); color: var(--dim); }
  .count.alarm { color: var(--alarm); }

  .grid {
    display: grid; grid-template-columns: repeat(auto-fill, var(--slot-item)); justify-content: start; gap: var(--spacing-xs);
    padding: var(--spacing-xs);
    /* one cell is one piece, so an empty row of the grid is a gap in the warehouse rather than a message */
  }
  /* an empty side says so across the whole shelf, not down one cell's width */
  .grid p { grid-column: 1 / -1; max-width: clamp(325px, 25.17vw, 702px); font-size: var(--font-xs); }
  .cell {
    position: relative; aspect-ratio: 1 / 1; display: grid; place-items: center;
  }
  .cell img { width: calc(var(--icon-label) * 1.5); height: calc(var(--icon-label) * 1.5); object-fit: contain; pointer-events: none; }
  .cell .plus { position: absolute; left: clamp(2px, 0.10vw, 3px); bottom: clamp(1px, 0.05vw, 1px); }

  .bulk { display: flex; flex-wrap: wrap; gap: var(--spacing-sm); align-items: center; }
  .bulk select, .bulk button { font-size: var(--font-xs); }

  .draw {
    display: grid; grid-template-columns: minmax(clamp(225px, 17.47vw, 486px), clamp(300px, 23.28vw, 648px)) 1fr; gap: var(--spacing-md); align-items: start;
    border-top: 1px solid var(--line); padding-top: var(--spacing-sm);
  }
  .moves { display: grid; gap: var(--spacing-xs); justify-items: start; }
  .go { border-color: color-mix(in srgb, var(--gold) 50%, transparent); color: var(--gold); }
  .lk { font-size: var(--font-xs); }
  .moves p { color: var(--dim); max-width: clamp(425px, 32.91vw, 918px); }

  @media (max-width: 1280px) {
    .grids, .draw { grid-template-columns: 1fr; }
  }
</style>
