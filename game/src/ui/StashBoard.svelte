<script lang="ts">
  /**
   * The warehouse board — and the reason the hunt pile has somewhere to go.
   *
   * The stash is one record on the character, not a chest per town: every settlement opens the same tabs,
   * which is the quality-of-life the owner asked for. So a trip home is never wasted on a walk to a
   * particular house, and the town's own screen spends its bag slot on this instead of a second pile.
   *
   * Two grids face each other and one piece is selected at a time, because the actual job is a transfer:
   * read the piece, say which way it moves. Deposit and withdrawal rules stay in `sim/town` — a locked
   * piece stays put, and a full pile refuses the walk back rather than dropping anything.
   */
  import { E } from '../engine/client';
  import { gearIcon } from '../icon';
  import { gearEntry, sortEntries, SORT_LABELS, type SortKey } from './bag';
  import ItemDetail from './ItemDetail.svelte';
  import type { GameState, Item } from '../sim/types';

  let { game, tabs, tab, pileSort = 'level', ontab, onpilesort, ondeposit, onwithdraw, ondepositAll, onwithdrawAll, onlock, onequip, wornOf }: {
    game: GameState;
    tabs: number;
    tab: number;
    pileSort?: SortKey;
    ontab: (t: number) => void;
    onpilesort?: (k: SortKey) => void;
    ondeposit: (pileIndex: number) => void;
    onwithdraw: (stashIndex: number) => void;
    ondepositAll: () => void;
    onwithdrawAll: () => void;
    onlock: (item: Item) => void;
    onequip: (pileIndex: number) => void;
    wornOf: (slot: string) => Item | null;
  } = $props();

  let side = $state<'pile' | 'stash'>('pile');
  let at = $state(-1);
  const stored = $derived(game.stash[tab] || []);
  const pile = $derived(sortEntries(game.bag.map((item, i) => gearEntry(item, i)), pileSort));
  /** both shelves fold at the same page size instead of scrolling: a full pile is four pages */
  const PAGE = 30;
  let pilePage = $state(0);
  let stashPage = $state(0);
  const pilePages = $derived(Math.max(1, Math.ceil(pile.length / PAGE)));
  const stashPages = $derived(Math.max(1, Math.ceil(stored.length / PAGE)));
  const pileAt = $derived(Math.min(pilePage, pilePages - 1));
  const stashAt = $derived(Math.min(stashPage, stashPages - 1));
  const pileView = $derived(pile.slice(pileAt * PAGE, pileAt * PAGE + PAGE));
  const storedView = $derived(stored.slice(stashAt * PAGE, stashAt * PAGE + PAGE));
  const chosen: Item | null = $derived(side === 'pile' ? (game.bag[at] ?? null) : (stored[at] ?? null));
  const cap = $derived(E.inventory.adventure_slots as number);
  const full = $derived(game.bag.length >= cap);
  const storedAll = $derived(game.stash.reduce((n, t) => n + t.length, 0));

  function pick(s: 'pile' | 'stash', i: number) { side = s; at = i; }
  function act(fn: () => void, keep: 'same' | 'pile' | 'stash' = 'same') {
    fn();
    if (keep === 'pile') { side = 'pile'; at = -1; }
    else if (keep === 'stash') { side = 'stash'; at = -1; }
    else if (side === 'pile') at = Math.min(at, game.bag.length - 1);
    else at = Math.min(at, stored.length - 1);
  }
</script>

<div class="board">
  <div class="tabs" role="tablist" aria-label="Stash tabs">
    {#each Array(tabs) as _, t (t)}
      <button role="tab" class="tb" class:here={t === tab} aria-selected={t === tab} onclick={() => { ontab(t); pick('stash', -1); }}>
        Tab {t + 1}<b>{(game.stash[t] || []).length}</b>
      </button>
    {/each}
    <span class="spacer"></span>
    <span class="shared">one warehouse, every settlement</span>
  </div>

  <div class="grids">
    <section class="side">
      <header>
        <h4>Hunt pile · this trip</h4>
        <span class="count" class:alarm={full}>{game.bag.length} / {cap}</span>
      </header>
      <div class="grid">
        {#each pileView as e, k (e.index)}
          <button class="cell" class:here={side === 'pile' && at === pileAt * PAGE + k} class:lock={e.item?.locked}
                  onclick={() => pick('pile', pileAt * PAGE + k)} aria-label={e.title}>
            <img src={e.icon} alt="" aria-hidden="true" />
            {#if (e.item?.upgrade_lv || 0) > 0}<b class="pl">+{e.item?.upgrade_lv}</b>{/if}
          </button>
        {:else}
          <p class="dim">The pile is empty.</p>
        {/each}
      </div>
      {#if pilePages > 1}
        <div class="pager" role="group" aria-label="Pile pages">
          <button disabled={pileAt === 0} onclick={() => (pilePage = pileAt - 1)} aria-label="Previous page">‹</button>
          <span>{pileAt + 1} / {pilePages}</span>
          <button disabled={pileAt === pilePages - 1} onclick={() => (pilePage = pileAt + 1)} aria-label="Next page">›</button>
        </div>
      {/if}
      <div class="bulk">
        <select value={pileSort} aria-label="Order the pile"
                onchange={(e) => onpilesort?.((e.target as HTMLSelectElement).value as SortKey)}>
          {#each Object.keys(SORT_LABELS) as k (k)}<option value={k}>{SORT_LABELS[k as SortKey]}</option>{/each}
        </select>
        <button disabled={!game.bag.length || !tabs} onclick={() => act(ondepositAll, 'pile')}>Stash every unlocked piece → Tab {tab + 1}</button>
      </div>
    </section>

    <section class="side">
      <header>
        <h4>Stash · tab {tab + 1}</h4>
        <span class="count">{stored.length} stored · {storedAll} in all tabs</span>
      </header>
      {#if tabs}
        <div class="grid">
          {#each storedView as it, k (stashAt * PAGE + k)}
            <button class="cell" class:here={side === 'stash' && at === stashAt * PAGE + k} class:lock={it.locked}
                    onclick={() => pick('stash', stashAt * PAGE + k)} aria-label={it.base}>
              <img src={gearIcon(it)} alt="" aria-hidden="true" />
              {#if (it.upgrade_lv || 0) > 0}<b class="pl">+{it.upgrade_lv}</b>{/if}
            </button>
          {:else}
            <p class="dim">This tab is empty.</p>
          {/each}
        </div>
        {#if stashPages > 1}
          <div class="pager" role="group" aria-label="Stash pages">
            <button disabled={stashAt === 0} onclick={() => (stashPage = stashAt - 1)} aria-label="Previous page">‹</button>
            <span>{stashAt + 1} / {stashPages}</span>
            <button disabled={stashAt === stashPages - 1} onclick={() => (stashPage = stashAt + 1)} aria-label="Next page">›</button>
          </div>
        {/if}
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
        {#if side === 'pile'}
          <button class="go" disabled={!tabs} onclick={() => act(() => ondeposit(at), 'pile')}>Deposit → Tab {tab + 1}</button>
          <button disabled={chosen.locked} onclick={() => act(() => onequip(at))}>Equip it</button>
        {:else}
          <button class="go" disabled={full} onclick={() => act(() => onwithdraw(at), 'stash')}>
            {full ? 'The pile is full — sell, dissolve or free a tab first' : 'Take into the hunt pile'}
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
  .tabs { display: flex; flex-wrap: wrap; align-items: center; gap: 3px; }
  .tb { display: inline-flex; align-items: center; gap: 4px; padding: 3px var(--spacing-sm); font-size: var(--font-xs); }
  .tb b { font-family: var(--num); color: var(--dim); font-weight: 500; }
  .tb.here { border-color: var(--gold); color: var(--gold); background: rgba(232, 193, 105, .12); }
  .tb.here b { color: var(--gold); }
  .spacer { flex: 1; }
  .shared { font-size: var(--font-xs); color: var(--mob); letter-spacing: clamp(0.5px, 0.033vw + 0.13px, 1.08px); }

  .grids { display: grid; grid-template-columns: 1fr 1fr; gap: var(--spacing-sm); }
  .side { display: grid; gap: 4px; align-content: start; }
  .side header { display: flex; align-items: baseline; gap: var(--spacing-xs); justify-content: space-between; }
  .side h4 { margin: 0; }
  .count { font-family: var(--num); font-size: var(--font-xs); color: var(--dim); }
  .count.alarm { color: var(--alarm); }

  .grid {
    display: grid; grid-template-columns: repeat(auto-fill, minmax(clamp(32.5px, 2.119vw + 8.19px, 70.2px), 1fr)); gap: 3px;
    padding: 1px;
    /* one cell is one piece, so an empty row of the grid is a gap in the warehouse rather than a message */
  }
  .pager { display: flex; align-items: center; gap: var(--spacing-xs); font-size: var(--font-xs); color: var(--dim); font-variant-numeric: tabular-nums; }
  .pager button { font-size: var(--font-xs); padding: 1px var(--spacing-xs); }
  .pager button:disabled { opacity: .4; }
  /* an empty side says so across the whole shelf, not down one cell's width */
  .grid p { grid-column: 1 / -1; max-width: var(--box-520); font-size: var(--font-xs); }
  .cell {
    position: relative; aspect-ratio: 1 / 1; padding: 0; border-radius: 3px; background: var(--inset);
  }
  .cell img { position: absolute; inset: 0; margin: auto; width: var(--icon-md); height: var(--icon-md); object-fit: contain; pointer-events: none; }
  .cell .pl { position: absolute; left: clamp(1.5px, 0.098vw + 0.38px, 3.24px); bottom: clamp(0.63px, 0.041vw + 0.16px, 1.35px); font-size: var(--font-xs); color: var(--xp); }
  .cell.lock { border-style: dashed; border-color: var(--dim); }
  .cell.here { border-color: var(--gold); box-shadow: 0 0 0 1px rgba(232, 193, 105, .5); background: rgba(232, 193, 105, .1); }

  .bulk { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; }
  .bulk select, .bulk button { font-size: var(--font-xs); padding: 2px var(--spacing-xs); }

  .draw {
    display: grid; grid-template-columns: minmax(clamp(225px, 14.67vw + 56.7px, 486px), clamp(300px, 19.56vw + 75.6px, 648px)) 1fr; gap: var(--spacing-md); align-items: start;
    border-top: 1px solid var(--line); padding-top: var(--spacing-sm);
  }
  .moves { display: grid; gap: 4px; justify-items: start; }
  .go { border-color: rgba(232, 193, 105, .5); color: var(--gold); }
  .lk { font-size: var(--font-xs); }
  .moves p { margin: 2px 0 0; color: var(--dim); max-width: var(--box-680); }

  @media (max-width: 1280px) {
    .grids, .draw { grid-template-columns: 1fr; }
  }
</style>
