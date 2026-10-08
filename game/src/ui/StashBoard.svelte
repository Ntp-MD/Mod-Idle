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
    {:else}
      <span class="dim">No tab open yet — the first is the teaching purchase on a settlement stall, and a house grants two more.</span>
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
        {#each pile as e, i (e.index)}
          <button class="cell" class:here={side === 'pile' && at === i} class:lock={e.item?.locked}
                  onclick={() => pick('pile', i)} aria-label={e.title}>
            <img src={e.icon} alt="" aria-hidden="true" />
            {#if (e.item?.upgrade_lv || 0) > 0}<b class="pl">+{e.item?.upgrade_lv}</b>{/if}
          </button>
        {:else}
          <p class="dim">The pile is empty. Kills still drop — a bag that has filled and stopped paying is the
            reason this screen exists.</p>
        {/each}
      </div>
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
          {#each stored as it, i (i)}
            <button class="cell" class:here={side === 'stash' && at === i} class:lock={it.locked}
                    onclick={() => pick('stash', i)} aria-label={it.base}>
              <img src={gearIcon(it)} alt="" aria-hidden="true" />
              {#if (it.upgrade_lv || 0) > 0}<b class="pl">+{it.upgrade_lv}</b>{/if}
            </button>
          {:else}
            <p class="dim">This tab is empty.</p>
          {/each}
        </div>
        <div class="bulk">
          <button disabled={!stored.length || full} onclick={() => act(onwithdrawAll, 'stash')}>Take back every unlocked piece</button>
        </div>
      {:else}
        <p class="dim">Buy a tab on a settlement stall and this side opens.</p>
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
    {:else}
      <p class="dim">Pick a piece on either side to read it and move it. The two grids face each other because
        the job is one transfer at a time.</p>
    {/if}
  </div>
</div>

<style>
  .board { display: grid; gap: .7rem; }
  .tabs { display: flex; flex-wrap: wrap; align-items: center; gap: .25rem; }
  .tb { display: inline-flex; align-items: center; gap: .35rem; padding: .2rem .6rem; font-size: .74rem; }
  .tb b { font-family: var(--num); color: var(--dim); font-weight: 500; }
  .tb.here { border-color: var(--gold); color: var(--gold); background: rgba(232, 193, 105, .12); }
  .tb.here b { color: var(--gold); }
  .spacer { flex: 1; }
  .shared { font-size: .68rem; color: var(--mob); letter-spacing: .04em; }

  .grids { display: grid; grid-template-columns: 1fr 1fr; gap: .8rem; }
  .side { display: grid; gap: .35rem; align-content: start; }
  .side header { display: flex; align-items: baseline; gap: .5rem; justify-content: space-between; }
  .side h4 { margin: 0; }
  .count { font-family: var(--num); font-size: .72rem; color: var(--dim); }
  .count.alarm { color: #ff9a8c; }

  .grid {
    display: grid; grid-template-columns: repeat(auto-fill, minmax(2.6rem, 1fr)); gap: .22rem;
    max-height: 15rem; overflow: auto; padding: .1rem;
    /* one cell is one piece, so an empty row of the grid is a gap in the warehouse rather than a message */
  }
  /* an empty side says so across the whole shelf, not down one cell's width */
  .grid p { grid-column: 1 / -1; max-width: 26rem; font-size: .74rem; }
  .cell {
    position: relative; aspect-ratio: 1 / 1; padding: 0; border-radius: 3px; background: #171b22;
  }
  .cell img { position: absolute; inset: 17%; width: 66%; height: 66%; object-fit: contain; pointer-events: none; }
  .cell .pl { position: absolute; left: .12rem; bottom: .05rem; font-size: .58rem; color: var(--xp); }
  .cell.lock { border-style: dashed; border-color: var(--dim); }
  .cell.here { border-color: var(--gold); box-shadow: 0 0 0 1px rgba(232, 193, 105, .5); background: rgba(232, 193, 105, .1); }

  .bulk { display: flex; flex-wrap: wrap; gap: .3rem; align-items: center; }
  .bulk select, .bulk button { font-size: .72rem; padding: .18rem .5rem; }

  .draw {
    display: grid; grid-template-columns: minmax(18rem, 24rem) 1fr; gap: .9rem; align-items: start;
    border-top: 1px solid var(--line); padding-top: .7rem;
  }
  .draw > p { grid-column: 1 / -1; margin: 0; }
  .moves { display: grid; gap: .3rem; justify-items: start; }
  .go { border-color: rgba(232, 193, 105, .5); color: var(--gold); }
  .lk { font-size: .74rem; }
  .moves p { margin: .15rem 0 0; color: var(--dim); max-width: 34rem; }

  @media (max-width: 1280px) {
    .grids, .draw { grid-template-columns: 1fr; }
    .grid { max-height: 11rem; }
  }
</style>
