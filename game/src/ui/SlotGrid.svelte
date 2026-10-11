<script lang="ts">
  import { lineName, craftedMark } from '../sim/craft';
  import { loot } from '../engine/client';
  import { SORT_LABELS, vsWorn, type SlotEntry, type SortKey } from './bag';
  import { popPlace } from './pop';
  import ItemDetail from './ItemDetail.svelte';
  import type { Item } from '../sim/types';

  /**
   * The equipment panel's fixed grid (owner layout): three columns by five rows around where a
   * body would stand, but no body is drawn — the empty cells are simply gaps. One `grid-area` per
   * canonical slot, addressed by name (`loot.SLOTS` order) rather than array index. The blank corners
   * are not rendered at all; they are the `.` cells the template leaves empty. The earring fills the
   * cell beside the belt, so only the two bottom corners stay blank.
   */
  const DOLL_LAYOUT: { area: string; slot: number }[] = [
    { area: 'cape', slot: 9 }, { area: 'helmet', slot: 0 }, { area: 'amulet', slot: 8 },
    { area: 'main', slot: 10 }, { area: 'chest', slot: 1 }, { area: 'off', slot: 11 },
    { area: 'gloves', slot: 5 }, { area: 'belt', slot: 4 }, { area: 'earring', slot: 12 },
    { area: 'ringa', slot: 6 }, { area: 'pant', slot: 2 }, { area: 'ringb', slot: 7 },
    { area: 'boots', slot: 3 },
  ];

  /**
   * A bag drawn as slots — the Melvor shape, where one square is one thing and the grid *is* the
   * inventory. Two modes because a hunt wants the grid and a decision wants the words, and a sort bar
   * because fifty pieces have dropped since the last trip. Hovering a slot opens the detail card
   * (`ItemDetail.svelte`) and the card's own Equip button is the only way a piece gets worn, which is
   * the owner's rule rather than a convenience.
   */
  let { entries, capacity, mode = 'grid', layout = 'grid', onmode = null, sort = 'newest', onsort = null, wornOf, onequip = null, fixed = false, empty = 'Empty.', onpick = null, pageSize = 0 }: {
    entries: SlotEntry[];
    capacity: number;
    mode?: 'grid' | 'list';
    /** `doll` draws the fixed equipment panel on the five-row slot grid (no body) */
    layout?: 'grid' | 'doll';
    onmode?: ((m: 'grid' | 'list') => void) | null;
    sort?: SortKey;
    onsort?: ((k: SortKey) => void) | null;
    /** the piece worn in a given slot, which is what the card compares against */
    wornOf: (slot: string) => Item | null;
    onequip?: ((index: number) => void) | null;
    /** an equipment panel keeps its positions: one tile per slot, always, sorted or not */
    fixed?: boolean;
    empty?: string;
    /** when set, a press on a gear piece hands it over instead of opening the card — the craft bench's way onto itself */
    onpick?: ((index: number) => void) | null;
    /** a page holds this many slots, and a pager folds the rest: every page is the same height, so a
        paged grid never grows the modal it sits in (the doll layout is never paged) */
    pageSize?: number;
  } = $props();

  /** The hovered piece and the box of the square it came from. The card's own place is derived from the
      pair plus the size the card measures, so nothing here has to guess how tall a piece's card is. */
  let hover = $state<{ entry: SlotEntry; top: number; left: number; right: number; bottom: number } | null>(null);
  let gridEl: HTMLElement | null = null;
  let popEl: HTMLElement | null = null;
  /** the card's measured box — zero until it paints, and the card stays out of sight until it is not */
  let popW = $state(0);
  let popH = $state(0);

  /** What the grid draws: a card per filled position and a blank where there is nothing. */
  const cells = $derived.by(() => {
    if (fixed) {
      const byIndex = new Map(entries.map((e) => [e.index, e]));
      return Array.from({ length: capacity }, (_, pos) => byIndex.get(pos) ?? null);
    }
    return [...entries, ...Array.from({ length: Math.max(0, capacity - entries.length) }, () => null)];
  });

  /**
   * The doll addresses slots by name, not array index — a piece sits at its own slot's index, but the
   * two rings share the name `ring`, so each entry claims the first still-free canonical slot that
   * names it.
   */
  const dollCells = $derived.by(() => {
    const slots = loot.SLOTS as string[];
    const used = new Set<number>();
    const out: (SlotEntry | null)[] = Array.from({ length: slots.length }, () => null);
    for (const e of entries) {
      const i = slots.findIndex((s, k) => s === e.slot && !used.has(k));
      if (i >= 0) { used.add(i); out[i] = e; }
    }
    return out;
  });

  /** One cell per shown position: `area` places it on the doll grid, `slot` names an empty cell. */
  type Cell = { area: string | null; slot: number | null; entry: SlotEntry | null };

  /** the fold: page state lives here so every paged grid keeps its own page across modal opens */
  let page = $state(0);
  const perPage = $derived(pageSize > 0 ? pageSize : Math.max(cells.length, 1));
  const full = $derived(mode === 'list' ? entries : cells);
  const pages = $derived(Math.max(1, Math.ceil(full.length / perPage)));
  /** clamped, so a filter that shrinks the list cannot strand the pager past the end */
  const at = $derived(Math.min(page, pages - 1));

  const shown: Cell[] = $derived.by(() => {
    if (layout === 'doll') {
      return DOLL_LAYOUT.map(({ area, slot }) => ({ area, slot, entry: dollCells[slot] ?? null }));
    }
    const list = pageSize > 0 ? cells.slice(at * perPage, at * perPage + perPage) : cells;
    // padded back to a full page: every page draws the same count of slots, so flipping pages never
    // moves the pager or anything under the grid
    if (pageSize > 0) while (list.length < perPage) list.push(null);
    return list.map((entry) => ({ area: null, slot: null, entry }));
  });
  /** the list mode folds on the same page, over the entries rather than the padded cells */
  const listView = $derived(pageSize > 0 ? entries.slice(at * perPage, at * perPage + perPage) : entries);

  function open(el: HTMLElement, entry: SlotEntry) {
    const b = el.getBoundingClientRect();
    hover = { entry, top: b.top, left: b.left, right: b.right, bottom: b.bottom };
  }

  /**
   * Where the card goes: beside the square, on the square's own line, and turned to the other side or the
   * other end whenever that is where the room actually is. The card measures itself, so a five-line piece
   * and a stack chip are each placed by the box they really have — an assumed size is what used to run a
   * tall card off the bottom of a short screen.
   */
  const place = $derived(hover && popPlace(hover, { w: popW, h: popH }, window.innerWidth, window.innerHeight));

  /**
   * Leaving closes at once — the pointer has gone somewhere else. It stays open while the pointer is
   * only crossing the grid's own gaps or stepping onto the card, read off the element the pointer
   * landed on rather than by a timer: the card holds the buttons, so nothing closes under the hand
   * that is reaching for one, and no ghost of a closed decision lingers after the pointer is gone.
   */
  function leaveTo(related: EventTarget | null) {
    if (related instanceof Node && ((gridEl && gridEl.contains(related)) || (popEl && popEl.contains(related)))) return;
    hover = null;
  }

  function lineSummary(entry: SlotEntry) {
    if (!entry.item) return entry.stack ? `${entry.stack.count} carried · ${Math.round(entry.stack.weight)} weight` : '';
    return entry.item.lines.map((l) => `${lineName(l.id)} +${l.value}${craftedMark(l)}`).join(' · ') || 'no lines';
  }
</script>

<div class="bar">
  {#if onsort}
    <span class="lab">Order</span>
    {#each Object.keys(SORT_LABELS) as k}
      <button class={sort === k ? 'active' : ''} onclick={() => onsort(k as SortKey)}>{SORT_LABELS[k as SortKey]}</button>
    {/each}
  {/if}
  {#if onmode}
    <span class="spacer"></span>
    <button class={mode === 'grid' ? 'active' : ''} onclick={() => onmode('grid')}>Grid slots</button>
    <button class={mode === 'list' ? 'active' : ''} onclick={() => onmode('list')}>Item list</button>
  {/if}
</div>

{#if mode === 'grid'}
  <div class={layout === 'doll' ? 'doll' : 'grid'} bind:this={gridEl}>
    {#each shown as cell, pos (pos)}
      {#if cell.entry}
        <button
          class="slot"
          style={cell.area ? `grid-area:${cell.area}` : ''}
          class:gear={cell.entry.kind === 'gear' || cell.entry.kind === 'worn'}
          class:stack={cell.entry.kind === 'stack'}
          class:rare={cell.entry.item && cell.entry.item.tier === 'T1'}
          class:held={Boolean(cell.entry.heldFor)}
          class:worn={cell.entry.kind === 'worn'}
          onmouseenter={(e) => open(e.currentTarget, cell.entry!)}
          onfocus={(e) => open(e.currentTarget, cell.entry!)}
          onmouseleave={(e) => leaveTo(e.relatedTarget)}
          onclick={(e) => (onpick && cell.entry.kind === 'gear' ? onpick(cell.entry.index) : open(e.currentTarget, cell.entry!))}
          aria-label={cell.entry.kind === 'stack' ? `${cell.entry.title} ×${cell.entry.count}` : cell.entry.title}
        >
          <img class="slot-icon" src={cell.entry.icon} alt="" aria-hidden="true" />
          {#if cell.entry.count}<span class="count">{cell.entry.count}</span>{/if}
          {#if cell.entry.item && (cell.entry.item.upgrade_lv || 0) > 0}<span class="plus">+{cell.entry.item.upgrade_lv}</span>{/if}
          {#if cell.entry.item && cell.entry.kind !== 'worn'}
            <!-- the comparison the list mode already prints, on the square itself: whether this piece
                 beats what the slot wears, before the pointer ever lands on it -->
            {@const m = vsWorn(cell.entry.item, wornOf(cell.entry.item.slot))}
            {#if m != null}<span class="delta" class:up={m > 0} class:down={m < 0}>{m > 0 ? '+' : ''}{m}%</span>{/if}
          {/if}
        </button>
      {:else}
        <span class="slot empty" style={cell.area ? `grid-area:${cell.area}` : ''} aria-hidden="true">
          {#if cell.slot != null}<span class="slotname">{loot.SLOTS[cell.slot]}</span>{/if}
        </span>
      {/if}
    {/each}
  </div>
{:else}
  <table class="list">
    <thead><tr><th>Slot</th><th>Piece</th><th>Lines</th><th>Strength</th><th></th></tr></thead>
    <tbody>
      {#each listView as entry (entry.kind + entry.index + entry.title)}
        <tr>
          <td>{entry.slot || entry.stack?.group || '—'}</td>
          <td>
            <b class="list-title"><img src={entry.icon} alt="" aria-hidden="true" />{entry.title}</b>
            {#if entry.count !== undefined}<span class="dim"> ×{entry.count}</span>{/if}
            <br /><small class="dim">{entry.sub}</small>
          </td>
          <td>{lineSummary(entry)}</td>
          <td>{entry.kind === 'gear' ? Math.round(entry.score) : '—'}</td>
          <td>{#if onequip && entry.item}<button onclick={() => onequip(entry.index)}>Equip</button>{/if}</td>
        </tr>
      {:else}
        <tr><td colspan="5" class="dim">{empty}</td></tr>
      {/each}
    </tbody>
  </table>
{/if}

{#if pages > 1}
  <!-- the fold: pages instead of a scrollbar, so the grid never grows past its page -->
  <div class="pager" role="group" aria-label="Grid pages">
    <button disabled={at === 0} onclick={() => (page = at - 1)} aria-label="Previous page">‹</button>
    <span>{at + 1} / {pages}</span>
    <button disabled={at === pages - 1} onclick={() => (page = at + 1)} aria-label="Next page">›</button>
  </div>
{/if}

{#if hover && place}
  <!-- Equipping closes the card: the decision is made, and the piece it described is no longer here. -->
  {@const pinned = hover.entry}
  <div
    class="pop"
    class:blind={!popW || !popH}
    role="tooltip"
    style="top:{place.top}px; left:{place.left}px"
    bind:offsetWidth={popW}
    bind:offsetHeight={popH}
    bind:this={popEl}
    onmouseleave={(e) => leaveTo(e.relatedTarget)}
  >
    {#if pinned.item}
      <ItemDetail
        item={pinned.item}
        worn={wornOf(pinned.item.slot)}
        wornHere={pinned.kind === 'worn'}
        onequip={onequip ? () => { onequip(pinned.index); hover = null; } : null}
      />
    {:else}
      <div class="plain">
        <h4>{pinned.title}</h4>
        <p>{pinned.sub}</p>
        <p>{pinned.count} carried · {Math.round(pinned.stack?.weight || 0)} weight</p>
      </div>
    {/if}
  </div>
{/if}

<style>
  .bar { display: flex; flex-wrap: wrap; gap: 3px; align-items: center; margin-bottom: var(--spacing-xs); }
  .lab { color: var(--dim); font-size: var(--font-xs); }
  .spacer { flex: 1; }
  .bar button { padding: 2px var(--spacing-xs); font-size: var(--font-xs); }

  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(clamp(33.75px, 2.2vw + 8.51px, 72.9px), 1fr)); gap: 3px; }

  /* The equipment panel: three columns by five rows, no body drawn — the `.` cells are the blanks. */
  .doll {
    display: grid;
    grid-template-columns: repeat(3, clamp(55px, 3.586vw + 13.86px, 118.8px));
    grid-template-rows: repeat(5, auto);
    grid-template-areas:
      "cape    helmet  amulet"
      "main    chest   off"
      "gloves  belt    earring"
      "ringa   pant    ringb"
      ".       boots   .";
    gap: 4px;
    width: fit-content;
    margin: 0 auto var(--spacing-sm);
  }

  .slot {
    position: relative;
    aspect-ratio: 1 / 1;
    padding: 0;
    background: var(--inset);
    border: 1px solid var(--line);
    border-radius: 3px;
  }
  .slot.rare { border-color: var(--xp); }
  .slot.worn { box-shadow: inset 0 0 0 1px var(--line); background: var(--panel); }
  /* the comparison badge: how far this piece sits from what the slot already wears */
  .slot .delta {
    position: absolute; right: clamp(1.5px, 0.098vw + 0.38px, 3.24px); top: clamp(0.63px, 0.041vw + 0.16px, 1.35px);
    font-family: var(--num); font-size: var(--font-xs); line-height: 1;
    color: var(--dim); text-shadow: 0 1px 0 rgba(0, 0, 0, .8);
  }
  .slot .delta.up { color: var(--good); }
  .slot .delta.down { color: var(--hp); }
  .slot.held { border-style: dashed; border-color: var(--good); }
  .slot.empty { display: flex; align-items: center; justify-content: center; background: var(--inset); border-style: dotted; cursor: default; }
  .slotname { font-size: var(--font-xs); color: var(--dim); opacity: .55; text-align: center; line-height: 1.05; padding: 0 2px; }
  .slot-icon {
    position: absolute;
    inset: 17%;
    width: 66%;
    height: 66%;
    object-fit: contain;
    opacity: .92;
    pointer-events: none;
  }
  .count, .plus { position: absolute; z-index: 1; font-size: var(--font-xs); line-height: 1; }
  .count { right: clamp(1.88px, 0.122vw + 0.47px, 4.05px); bottom: clamp(1.25px, 0.082vw + 0.32px, 2.7px); }
  .plus { left: clamp(1.88px, 0.122vw + 0.47px, 4.05px); bottom: clamp(1.25px, 0.082vw + 0.32px, 2.7px); color: var(--xp); }

  .list td, .list th { font-size: var(--font-xs); }
  .pager { display: flex; align-items: center; gap: var(--spacing-xs); margin-top: var(--spacing-xs); font-size: var(--font-xs); color: var(--dim); font-variant-numeric: tabular-nums; }
  .pager button { padding: 1px var(--spacing-sm); font-size: var(--font-xs); }
  .pager button:disabled { opacity: .4; }
  .list-title { display: inline-flex; align-items: center; gap: var(--spacing-xs); }
  .list-title img { width: var(--icon-sm); height: var(--icon-sm); object-fit: contain; }
  .dim { color: var(--dim); }

  /* the card is placed by `place` above, out of the slot's box and its own measured one. It is capped to the
     frame and scrolls inside itself, so a piece with more lines than a short screen has room is read by
     scrolling rather than by being cut. `blind` is the first frame only: the card cannot be measured until it
     paints, and a card that has not been measured has no business being seen. */
  .pop {
    position: fixed; z-index: 40;
    max-height: calc(100dvh - var(--icon-sm)); overflow: auto; overscroll-behavior: contain;
  }
  .pop.blind { visibility: hidden; }
  .plain {
    background: var(--inset);
    border: 1px solid var(--line);
    padding: var(--spacing-xs) var(--spacing-sm);
    font-size: var(--font-xs);
    min-width: var(--box-240);
  }
  .plain h4 { margin: 0; }
  .plain p { margin: 3px 0 0; color: var(--dim); }
</style>
