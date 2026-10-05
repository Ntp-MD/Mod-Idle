<script lang="ts">
  import { lineName } from '../sim/craft';
  import { loot } from '../engine/client';
  import { SORT_LABELS, type SlotEntry, type SortKey } from './bag';
  import ItemDetail from './ItemDetail.svelte';
  import type { Item } from '../sim/types';

  /**
   * The equipment panel's fixed grid (owner layout, D-128): three columns by five rows around where a
   * body would stand, but no body is drawn — the empty cells are simply gaps. One `grid-area` per
   * canonical slot, addressed by name (`loot.SLOTS` order) rather than array index. The blank corners
   * are not rendered at all; they are the `.` cells the template leaves empty. The earring fills the
   * cell beside the belt (D-131), so only the two bottom corners stay blank.
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
   * the owner's rule rather than a convenience (`harness/decisions.md` D-089).
   */
  let { entries, capacity, mode = 'grid', layout = 'grid', onmode = null, sort = 'newest', onsort = null, wornOf, onequip = null, fixed = false, empty = 'Empty.' }: {
    entries: SlotEntry[];
    capacity: number;
    mode?: 'grid' | 'list';
    /** `doll` draws the fixed equipment panel on the five-row slot grid (no body, D-128) */
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
  } = $props();

  let hover = $state<{ entry: SlotEntry; top: number; left: number } | null>(null);
  let closing: ReturnType<typeof setTimeout> | null = null;

  /** What the grid draws: a card per filled position and a blank where there is nothing. */
  const cells = $derived.by(() => {
    if (fixed) {
      const byIndex = new Map(entries.map((e) => [e.index, e]));
      return Array.from({ length: capacity }, (_, pos) => byIndex.get(pos) ?? null);
    }
    return [...entries, ...Array.from({ length: Math.max(0, capacity - entries.length) }, () => null)];
  });

  /**
   * The doll addresses slots by name, not array index — the gear array is not slot-ordered (the
   * opening sword sits at index 0, not the main-hand index) and the two rings share the name `ring`,
   * so each entry claims the first still-free canonical slot that names it.
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

  const shown: Cell[] = $derived.by(() => {
    if (layout === 'doll') {
      return DOLL_LAYOUT.map(({ area, slot }) => ({ area, slot, entry: dollCells[slot] ?? null }));
    }
    return cells.map((entry) => ({ area: null, slot: null, entry }));
  });

  function open(el: HTMLElement, entry: SlotEntry) {
    if (closing) clearTimeout(closing);
    closing = null;
    const box = el.getBoundingClientRect();
    const width = 330;
    const height = 300;
    const left = box.right + width > window.innerWidth ? Math.max(8, box.left - width - 6) : box.right + 6;
    const top = Math.min(Math.max(8, box.top - 10), Math.max(8, window.innerHeight - height));
    hover = { entry, top, left };
  }

  /** The card holds the buttons, so leaving the slot must not snap it shut under the pointer. */
  function scheduleClose() {
    if (closing) clearTimeout(closing);
    closing = setTimeout(() => (hover = null), 180);
  }

  function lineSummary(entry: SlotEntry) {
    if (!entry.item) return entry.stack ? `${entry.stack.count} carried · ${Math.round(entry.stack.weight)} weight` : '';
    return entry.item.lines.map((l) => `${lineName(l.id)} +${l.value}`).join(' · ') || 'no lines';
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
  <div class={layout === 'doll' ? 'doll' : 'grid'}>
    {#each shown as cell, pos (pos)}
      {#if cell.entry}
        <button
          class="slot"
          style={cell.area ? `grid-area:${cell.area}` : ''}
          class:gear={cell.entry.kind === 'gear' || cell.entry.kind === 'worn'}
          class:stack={cell.entry.kind === 'stack'}
          class:rare={cell.entry.item && cell.entry.item.rarity !== 'Common'}
          class:held={Boolean(cell.entry.heldFor)}
          class:worn={cell.entry.kind === 'worn'}
          onmouseenter={(e) => open(e.currentTarget, cell.entry!)}
          onfocus={(e) => open(e.currentTarget, cell.entry!)}
          onmouseleave={scheduleClose}
          onclick={(e) => open(e.currentTarget, cell.entry!)}
          aria-label={cell.entry.kind === 'stack' ? `${cell.entry.title} ×${cell.entry.count}` : cell.entry.title}
        >
          <img class="slot-icon" src={cell.entry.icon} alt="" aria-hidden="true" />
          {#if cell.entry.count}<span class="count">{cell.entry.count}</span>{/if}
          {#if cell.entry.item && (cell.entry.item.upgrade_lv || 0) > 0}<span class="plus">+{cell.entry.item.upgrade_lv}</span>{/if}
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
      {#each entries as entry (entry.kind + entry.index + entry.title)}
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

{#if hover}
  <!-- Equipping closes the card: the decision is made, and the piece it described is no longer here. -->
  {@const pinned = hover.entry}
  <div
    class="pop"
    role="tooltip"
    style="top:{hover.top}px; left:{hover.left}px"
    onmouseenter={() => { if (closing) clearTimeout(closing); }}
    onmouseleave={scheduleClose}
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
  .bar { display: flex; flex-wrap: wrap; gap: .25rem; align-items: center; margin-bottom: .4rem; }
  .lab { color: var(--dim); font-size: .72rem; }
  .spacer { flex: 1; }
  .bar button { padding: .15rem .4rem; font-size: .72rem; }

  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(2.7rem, 1fr)); gap: .25rem; }

  /* The equipment panel: three columns by five rows, no body drawn — the `.` cells are the blanks. */
  .doll {
    display: grid;
    grid-template-columns: repeat(3, 4.4rem);
    grid-template-rows: repeat(5, auto);
    grid-template-areas:
      "cape    helmet  amulet"
      "main    chest   off"
      "gloves  belt    earring"
      "ringa   pant    ringb"
      ".       boots   .";
    gap: .3rem;
    width: fit-content;
    margin: 0 auto .6rem;
  }

  .slot {
    position: relative;
    aspect-ratio: 1 / 1;
    padding: 0;
    background: #171b22;
    border: 1px solid var(--line);
    border-radius: 3px;
  }
  .slot.rare { border-color: var(--xp); }
  .slot.worn { box-shadow: inset 0 0 0 1px #2f3a4d; background: #1b2029; }
  .slot.held { border-style: dashed; border-color: var(--good); }
  .slot.empty { display: flex; align-items: center; justify-content: center; background: #12151b; border-style: dotted; cursor: default; }
  .slotname { font-size: .5rem; color: var(--dim); opacity: .55; text-align: center; line-height: 1.05; padding: 0 .12rem; }
  .slot-icon {
    position: absolute;
    inset: 17%;
    width: 66%;
    height: 66%;
    object-fit: contain;
    opacity: .92;
    pointer-events: none;
  }
  .count, .plus { position: absolute; z-index: 1; font-size: .6rem; line-height: 1; }
  .count { right: .15rem; bottom: .1rem; }
  .plus { left: .15rem; bottom: .1rem; color: var(--xp); }

  .list td, .list th { font-size: .78rem; }
  .list-title { display: inline-flex; align-items: center; gap: .4rem; }
  .list-title img { width: 1.2rem; height: 1.2rem; object-fit: contain; }
  .dim { color: var(--dim); }

  .pop { position: fixed; z-index: 40; }
  .plain {
    background: #10131a;
    border: 1px solid var(--line);
    padding: .5rem .6rem;
    font-size: .78rem;
    min-width: 12rem;
  }
  .plain h4 { margin: 0; }
  .plain p { margin: .2rem 0 0; color: var(--dim); }
</style>
