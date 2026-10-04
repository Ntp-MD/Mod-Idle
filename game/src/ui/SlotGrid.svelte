<script lang="ts">
  import { lineName } from '../sim/craft';
  import { SORT_LABELS, type SlotEntry, type SortKey } from './bag';
  import ItemDetail from './ItemDetail.svelte';
  import type { StatKey } from '../engine/client';
  import type { Item } from '../sim/types';

  /**
   * A bag drawn as slots — the Melvor shape, where one square is one thing and the grid *is* the
   * inventory. Two modes because a hunt wants the grid and a decision wants the words, and a sort bar
   * because fifty pieces have dropped since the last trip. Hovering a slot opens the detail card
   * (`ItemDetail.svelte`) and the card's own Equip button is the only way a piece gets worn, which is
   * the owner's rule rather than a convenience (`harness/decisions.md` D-089).
   */
  let { entries, capacity, mode = 'grid', onmode = null, sort = 'newest', onsort = null, wornOf, onequip = null, onstat = null, fixed = false, empty = 'Empty.' }: {
    entries: SlotEntry[];
    capacity: number;
    mode?: 'grid' | 'list';
    onmode?: ((m: 'grid' | 'list') => void) | null;
    sort?: SortKey;
    onsort?: ((k: SortKey) => void) | null;
    /** the piece worn in a given slot, which is what the card compares against */
    wornOf: (slot: string) => Item | null;
    onequip?: ((index: number) => void) | null;
    onstat?: ((index: number, stat: StatKey) => void) | null;
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
  <div class="grid">
    {#each cells as entry, pos (pos)}
      {#if entry}
        <button
          class="slot"
          class:gear={entry.kind === 'gear' || entry.kind === 'worn'}
          class:stack={entry.kind === 'stack'}
          class:rare={entry.item && entry.item.rarity !== 'Common'}
          class:held={Boolean(entry.heldFor)}
          class:worn={entry.kind === 'worn'}
          data-glyph={entry.glyph}
          onmouseenter={(e) => open(e.currentTarget, entry)}
          onfocus={(e) => open(e.currentTarget, entry)}
          onmouseleave={scheduleClose}
          onclick={(e) => open(e.currentTarget, entry)}
          aria-label={entry.kind === 'stack' ? `${entry.title} ×${entry.count}` : entry.title}
        >
          {#if entry.count}<span class="count">{entry.count}</span>{/if}
          {#if entry.item && (entry.item.upgrade_lv || 0) > 0}<span class="plus">+{entry.item.upgrade_lv}</span>{/if}
        </button>
      {:else}
        <span class="slot empty" aria-hidden="true"></span>
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
            <b>{entry.title}</b>
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
        onstat={onstat ? (s: StatKey) => onstat(pinned.index, s) : null}
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
  .slot.empty { background: #12151b; border-style: dotted; cursor: default; }
  .slot.gear::before, .slot.stack::before {
    content: '';
    position: absolute;
    inset: 22%;
    background: var(--dim);
    opacity: .6;
  }
  .slot[data-glyph='weapon']::before { clip-path: polygon(50% 0, 68% 38%, 58% 100%, 42% 100%, 32% 38%); }
  .slot[data-glyph='armour']::before { clip-path: polygon(0 0, 100% 0, 100% 62%, 50% 100%, 0 62%); }
  .slot[data-glyph='jewellery']::before { clip-path: circle(40% at 50% 50%); }
  .slot[data-glyph='stone']::before { clip-path: polygon(30% 0, 70% 0, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0 70%, 0 30%); }
  .slot[data-glyph='herb']::before { clip-path: polygon(50% 0, 100% 45%, 72% 100%, 28% 100%, 0 45%); }
  .slot[data-glyph='draught']::before { clip-path: polygon(38% 0, 62% 0, 62% 26%, 100% 62%, 100% 100%, 0 100%, 0 62%, 38% 26%); }
  .slot[data-glyph='junk']::before { clip-path: polygon(12% 0, 100% 22%, 82% 100%, 0 76%); }
  .count, .plus { position: absolute; font-size: .6rem; line-height: 1; }
  .count { right: .15rem; bottom: .1rem; }
  .plus { left: .15rem; bottom: .1rem; color: var(--xp); }

  .list td, .list th { font-size: .78rem; }
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
