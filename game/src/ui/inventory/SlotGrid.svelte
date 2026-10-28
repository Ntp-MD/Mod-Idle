<script lang="ts">
  import { lineName, craftedMark } from "@sim/gear/craft";
  import { loot } from "../../engine/client";
  import { slotIcon } from "../../icon";
  import { SORT_LABELS, vsWorn, rankTone, type SlotEntry, type SortKey } from "./bag";
  import { popPlace } from "../shared/pop";
  import ItemDetail from "./ItemDetail.svelte";
  import SlotMenu from "./SlotMenu.svelte";
  import Pager from "../shared/Pager.svelte";
  import CountBadge from "../shared/CountBadge.svelte";
  import type { MenuItem } from "../shared/menu";
  import type { GameState, Item } from "@sim/core/types";
  import type { Snippet } from "svelte";

  /**
   * The equipment panel's fixed grid (owner layout): 3×5, no body drawn, blank corners not rendered.
   * Slots are addressed by `loot.SLOTS` name, never by array index; the earring beside the belt leaves
   * only the two bottom corners blank.
   */
  const DOLL_LAYOUT: { area: string; slot: number }[] = [
    { area: "cape", slot: 9 },
    { area: "helmet", slot: 0 },
    { area: "amulet", slot: 8 },
    { area: "main", slot: 10 },
    { area: "chest", slot: 1 },
    { area: "off", slot: 11 },
    { area: "gloves", slot: 5 },
    { area: "belt", slot: 4 },
    { area: "earring", slot: 12 },
    { area: "ringa", slot: 6 },
    { area: "pant", slot: 2 },
    { area: "ringb", slot: 7 },
    { area: "boots", slot: 3 },
  ];

  /**
   * A bag drawn as slots: grid mode for the bag, list mode for decisions, sort bar for volume.
   * The detail card's own Equip button is the only way a piece gets worn — the owner's rule, not a
   * convenience.
   */
  let {
    entries,
    capacity,
    mode = "grid",
    layout = "grid",
    compactDoll = false,
    compactGrid = false,
    onmode = null,
    sort = "newest",
    onsort = null,
    wornOf,
    onequip = null,
    fixed = false,
    empty = "Empty.",
    onpick = null,
    ondragitem = null,
    selectedIndex = null,
    targetState = null,
    pageSize = 0,
    page = $bindable(0),
    padPage = true,
    actions = null,
    lead = null,
    game,
  }: {
    entries: SlotEntry[];
    game?: GameState;
    capacity: number;
    mode?: "grid" | "list";
    /** `doll` draws the fixed equipment panel on the five-row slot grid (no body) */
    layout?: "grid" | "doll" | "equipment";
    /** a narrower doll for a side panel with an adjacent inventory grid */
    compactDoll?: boolean;
    /** smaller cells for a full-capacity inventory that must fit the panel */
    compactGrid?: boolean;
    onmode?: ((m: "grid" | "list") => void) | null;
    sort?: SortKey;
    onsort?: ((k: SortKey) => void) | null;
    /** the piece worn in a given slot, which is what the card compares against */
    wornOf: (slot: string) => Item | null;
    onequip?: ((index: number) => void) | null;
    /** an equipment panel keeps its positions: one tile per slot, always, sorted or not */
    fixed?: boolean;
    empty?: string;
    /** when set, a press on a gear piece hands it over instead of opening the card — the craft bench's way onto itself */
    onpick?: ((index: number, event?: MouseEvent) => void) | null;
    /** an optional drag source for gear and worn pieces; the caller owns the drop payload */
    ondragitem?: ((entry: SlotEntry, event: DragEvent) => void) | null;
    /** the source position currently placed on a workbench */
    selectedIndex?: number | null;
    /** Optional craft-cursor feedback; ordinary inventory grids keep their existing appearance. */
    targetState?: ((entry: SlotEntry) => "ready" | "unavailable" | null) | null;
    /** a page holds this many slots, and a pager folds the rest: every page is the same height, so a
        paged grid never grows the modal it sits in (the doll layout is never paged) */
    pageSize?: number;
    page?: number;
    /** Selection browsers may omit empty page cells; inventory retains its full page by default. */
    padPage?: boolean;
    /** the verbs a right-click offers on a square — the caller owns them, so a grid in one panel and the
        same grid in another can answer differently without this component knowing why */
    actions?: ((entry: SlotEntry) => MenuItem[]) | null;
    /** the caller's own controls, joined to the front of the sort bar — the bag reads its filter from here */
    lead?: Snippet | null;
  } = $props();

  /** the hovered piece and its square's box; the card places itself from these plus its own measured size */
  let hover = $state<{ entry: SlotEntry; top: number; left: number; right: number; bottom: number } | null>(null);
  let gridEl = $state<HTMLElement | null>(null);
  let popEl = $state<HTMLElement | null>(null);
  /** the right-clicked square and where the pointer opened its menu */
  let menu = $state<{ x: number; y: number; entry: SlotEntry } | null>(null);
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

  /** the two rings share the name `ring`, so each entry claims the first still-free canonical slot that names it */
  const dollCells = $derived.by(() => {
    const slots = loot.SLOTS as string[];
    const used = new Set<number>();
    const out: (SlotEntry | null)[] = Array.from({ length: slots.length }, () => null);
    for (const e of entries) {
      const i = slots.findIndex((s, k) => s === e.slot && !used.has(k));
      if (i >= 0) {
        used.add(i);
        out[i] = e;
      }
    }
    return out;
  });

  /** One cell per shown position: `area` places it on the doll grid, `slot` names an empty cell. */
  type Cell = { area: string | null; slot: number | null; entry: SlotEntry | null };

  /** Callers may retain a page across panel navigation; other grids keep their local default. */
  const perPage = $derived(pageSize > 0 ? pageSize : Math.max(cells.length, 1));
  const full = $derived(mode === "list" ? entries : cells);
  const pages = $derived(Math.max(1, Math.ceil(full.length / perPage)));
  /** clamped, so a filter that shrinks the list cannot strand the pager past the end */
  const at = $derived(Math.min(page, pages - 1));

  const shown: Cell[] = $derived.by(() => {
    if (layout === "equipment") {
      return dollCells.map((entry, slot) => ({ area: null, slot, entry }));
    }
    if (layout === "doll") {
      return DOLL_LAYOUT.map(({ area, slot }) => ({ area, slot, entry: dollCells[slot] ?? null }));
    }
    const list = pageSize > 0 ? cells.slice(at * perPage, at * perPage + perPage) : cells;
    // padded back to a full page: every page draws the same count of slots, so flipping pages never
    // moves the pager or anything under the grid
    if (pageSize > 0 && padPage) while (list.length < perPage) list.push(null);
    return list.map((entry) => ({ area: null, slot: null, entry }));
  });
  /** the list mode folds on the same page, over the entries rather than the padded cells */
  const listView = $derived(pageSize > 0 ? entries.slice(at * perPage, at * perPage + perPage) : entries);

  function open(el: HTMLElement, entry: SlotEntry) {
    const b = el.getBoundingClientRect();
    hover = { entry, top: b.top, left: b.left, right: b.right, bottom: b.bottom };
  }

  /** the verbs come from the caller; this component only knows a square can offer some */
  function openMenu(e: MouseEvent, entry: SlotEntry) {
    if (!actions || !actions(entry).length) return;
    e.preventDefault();
    hover = null;
    menu = { x: e.clientX, y: e.clientY, entry };
  }

  /** the card measures itself and flips side/end to fit — an assumed size used to run tall cards off-screen */
  const place = $derived(hover && popPlace(hover, { w: popW, h: popH }, window.innerWidth, window.innerHeight));

  /** Keep the card while the pointer or focus moves to another filled slot or into the card itself.
   * Empty grid space counts as leaving, so the detail closes once the item does. */
  function leaveTo(related: EventTarget | null) {
    if (related instanceof Element && ((popEl && popEl.contains(related)) || (gridEl && gridEl.contains(related) && related.closest(".slot")))) return;
    hover = null;
  }

  function lineSummary(entry: SlotEntry) {
    if (!entry.item) return entry.stack ? `${entry.stack.count} carried · ${Math.round(entry.stack.weight)} weight` : "";
    return entry.item.lines.map((l) => `${lineName(l.id)} +${l.value}${craftedMark(l)}`).join(" · ") || "no lines";
  }
</script>

<div class="slot-grid-stack">
  <div class="bar">
    {#if lead}{@render lead()}{/if}
    {#if onsort}
      <span class="text-note">Order</span>
      {#each Object.keys(SORT_LABELS) as k}
        <button class={sort === k ? "active" : ""} onclick={() => onsort(k as SortKey)}>{SORT_LABELS[k as SortKey]}</button>
      {/each}
    {/if}
    {#if onmode}
      <span class="spacer"></span>
      <span class="views">
        <button class={mode === "grid" ? "active" : ""} onclick={() => onmode("grid")}>Grid slots</button>
        <button class={mode === "list" ? "active" : ""} onclick={() => onmode("list")}>Item list</button>
      </span>
    {/if}
  </div>

  {#if mode === "grid"}
    <div
      class={layout === "doll" ? "doll" : layout === "equipment" ? "equipment" : "grid"}
      class:compact-doll={layout === "doll" && compactDoll}
      class:compact-grid={compactGrid && layout === "grid"}
      bind:this={gridEl}
    >
      {#each shown as cell, pos (pos)}
        {#if cell.entry}
          {@const craftState = targetState?.(cell.entry) ?? null}
          <button
            class="slot"
            class:craft-target={craftState !== null}
            class:ready={craftState === "ready"}
            class:unavailable={craftState === "unavailable"}
            class:slot-gear={cell.entry.kind === "gear" || cell.entry.kind === "worn"}
            class:slot-stack={cell.entry.kind === "stack"}
            style={cell.area ? `grid-area:${cell.area}` : ""}
            style:--rar={cell.entry.item ? rankTone(cell.entry.item) : null}
            class:gear={cell.entry.kind === "gear" || cell.entry.kind === "worn"}
            class:stack={cell.entry.kind === "stack"}
            class:held={Boolean(cell.entry.heldFor)}
            class:worn={cell.entry.kind === "worn"}
            class:selected={Boolean(cell.entry.item && cell.entry.index === selectedIndex)}
            draggable={Boolean(ondragitem && cell.entry.item)}
            ondragstart={(e) => {
              hover = null;
              if (cell.entry) ondragitem?.(cell.entry, e);
            }}
            onmouseenter={(e) => open(e.currentTarget, cell.entry!)}
            onfocus={(e) => open(e.currentTarget, cell.entry!)}
            onblur={(e) => leaveTo(e.relatedTarget)}
            onmouseleave={(e) => leaveTo(e.relatedTarget)}
            oncontextmenu={(e) => openMenu(e, cell.entry!)}
            onclick={(e) => {
              if (onpick && cell.entry?.item) {
                hover = null;
                onpick(cell.entry.index, e);
              } else open(e.currentTarget, cell.entry!);
            }}
            aria-label={cell.entry.kind === "stack" ? `${cell.entry.title} ×${cell.entry.count}` : cell.entry.title}
          >
            <img class="slot-icon" src={cell.entry.icon} alt="" aria-hidden="true" />
            {#if layout === "equipment"}
              <span class="equipment-label"><small class="text-note">{cell.entry.slot}</small><span>{cell.entry.title}</span></span>
            {/if}
            {#if cell.entry.count}<CountBadge value={cell.entry.count} tone="count" placement="bottom-right" underlay />{/if}
            {#if cell.entry.item && (cell.entry.item.upgrade_lv || 0) > 0}<CountBadge value={`+${cell.entry.item.upgrade_lv}`} tone="xp plus" placement="bottom-left" underlay />{/if}
            {#if cell.entry.item && cell.entry.kind !== "worn"}
              <!-- the comparison the list mode already prints, on the square itself: whether this piece
                 beats what the slot wears, before the pointer ever lands on it -->
              {@const m = vsWorn(cell.entry.item, wornOf(cell.entry.item.slot))}
              {#if m != null}<span class="delta" class:up={m > 0} class:down={m < 0}>{m > 0 ? "+" : ""}{m}%</span>{/if}
            {/if}
          </button>
        {:else}
          <span
            class="slot slot-empty empty"
            style={cell.area ? `grid-area:${cell.area}` : ""}
            role={compactDoll || layout === "equipment" ? "img" : undefined}
            aria-hidden={!compactDoll && layout !== "equipment"}
            aria-label={(compactDoll || layout === "equipment") && cell.slot != null ? `Empty ${loot.SLOTS[cell.slot]} slot` : undefined}
            title={(compactDoll || layout === "equipment") && cell.slot != null ? `Empty ${loot.SLOTS[cell.slot]} slot` : undefined}
          >
            {#if cell.slot != null}
              <!-- the doll's bare cells carry the slot's own glyph, so an unworn body still reads as a
                 body with places to fill; a plain grid keeps its wordless blanks -->
              {#if layout === "doll" || layout === "equipment"}<img class="slot-glyph" src={slotIcon(loot.SLOTS[cell.slot])} alt="" />{/if}
              {#if layout === "equipment"}
                <span class="equipment-label"><span>{loot.SLOTS[cell.slot]}</span><small class="text-note">Empty</small></span>
              {:else}
                <span class="slotname">{loot.SLOTS[cell.slot]}</span>
              {/if}
            {/if}
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
            <td>{entry.slot || entry.stack?.group || "—"}</td>
            <td>
              <b class="list-title" style:--rar={entry.item ? rankTone(entry.item) : null}><img class="icon-label" src={entry.icon} alt="" aria-hidden="true" />{entry.title}</b>
              {#if entry.count !== undefined}<span class="text-dim"> ×{entry.count}</span>{/if}
              <br /><small class="text-dim">{entry.sub}</small>
            </td>
            <td>{lineSummary(entry)}</td>
            <td>{entry.kind === "gear" ? Math.round(entry.score) : "—"}</td>
            <td
              >{#if onequip && entry.item}<button onclick={() => onequip(entry.index)}>Equip</button>{/if}</td
            >
          </tr>
        {:else}
          <tr><td colspan="5" class="text-dim">{empty}</td></tr>
        {/each}
      </tbody>
    </table>
  {/if}

  {#if pages > 1}
    <!-- the fold: pages instead of a scrollbar, so the grid never grows past its page -->
    <Pager group="Grid pages" {pages} page={at} onturn={(p) => (page = p)} text={`${at + 1} / ${pages}`} />
  {/if}
</div>

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
        {game}
        bagIndex={game?.bag[pinned.index] === pinned.item ? pinned.index : undefined}
        worn={wornOf(pinned.item.slot)}
        wornHere={pinned.kind === "worn"}
        onequip={onequip
          ? () => {
              onequip(pinned.index);
              hover = null;
            }
          : null}
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

{#if menu}
  <!-- the square's own verbs, opened on the right-click that asked for them -->
  <SlotMenu x={menu.x} y={menu.y} items={actions ? actions(menu.entry) : []} onclose={() => (menu = null)} />
{/if}

<style>
  .slot-grid-stack {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: var(--spacing-xs);
    min-width: 0;
    min-height: 0;
  }
  /* Squares keep their token size; each panel fits as many columns as its width allows. */
  .slot-grid-stack > .grid {
    align-content: start;
    min-height: 0;
  }
  .slot-grid-stack > .doll {
    align-self: center;
  }
  .bar {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-sm);
    align-items: center;
  }
  .spacer {
    flex: 1;
  }
  .views {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    flex: none;
  }
  .bar button {
    font-size: var(--font-xs);
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, var(--slot-item));
    justify-content: start;
    gap: var(--spacing-xs);
  }
  .grid.compact-grid {
    grid-template-columns: repeat(13, 1fr);
  }

  /* The equipment panel: three columns by five rows, no body drawn — the `.` cells are the blanks. */
  .doll {
    display: grid;
    grid-template-columns: repeat(3, clamp(55px, 4.26vw, 119px));
    grid-template-rows: repeat(5, auto);
    grid-template-areas:
      "cape    helmet  amulet"
      "main    chest   off"
      "gloves  belt    earring"
      "ringa   pant    ringb"
      ".       boots   .";
    gap: var(--spacing-xs);
    width: fit-content;
  }
  .doll.compact-doll {
    grid-template-columns: repeat(3, min(calc(var(--icon-card) * 1.4 - var(--spacing-xs)), 4.5vh));
  }
  .compact-doll .slotname {
    display: none;
  }
  .equipment {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--spacing-xs);
    align-content: start;
  }
  .equipment .slot {
    display: grid;
    grid-template-columns: var(--slot-item) minmax(0, 1fr);
    align-items: center;
    gap: var(--spacing-xs);
    aspect-ratio: auto;
    padding: 0 var(--spacing-xs);
    min-width: 0;
  }
  .equipment .slot.empty {
    display: grid;
    justify-content: stretch;
  }
  .equipment .slot-icon,
  .equipment .slot-glyph {
    position: static;
    width: var(--slot-item);
    height: var(--slot-item);
    object-fit: contain;
  }
  .equipment-label {
    display: grid;
    gap: 0;
    min-width: 0;
    text-align: left;
    overflow-wrap: anywhere;
    font-size: var(--font-xs);
    line-height: 1.15;
  }

  .slot {
    position: relative;
    aspect-ratio: 1 / 1;
  }
  /* the comparison badge: how far this piece sits from what the slot already wears */
  .slot .delta {
    position: absolute;
    right: clamp(2px, 0.1vw, 3px);
    top: clamp(1px, 0.05vw, 1px);
    font-family: var(--num);
    font-size: var(--font-xs);
    line-height: 1;
  }
  .slot.empty {
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: default;
  }
  .slot-glyph {
    position: absolute;
    inset: 16%;
    width: 68%;
    height: 68%;
    object-fit: contain;
    pointer-events: none;
  }
  .slotname {
    position: relative;
    font-size: var(--font-xs);
    text-align: center;
    line-height: 1.05;
    padding: 0 var(--spacing-xs);
  }
  .slot-icon {
    position: absolute;
    inset: 17%;
    width: 66%;
    height: 66%;
    object-fit: contain;
    pointer-events: none;
  }

  .list td,
  .list th {
    font-size: var(--font-xs);
  }
  .list-title {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-xs);
    color: var(--rar, var(--text));
  }

  /* capped to the frame and self-scrolling; `blind` is the first frame only — unmeasured, unseen */
  .pop {
    position: fixed;
    z-index: var(--z-hud-control);
    max-height: none;
    overflow: hidden;
  }
  .pop.blind {
    visibility: hidden;
  }
  .plain {
    display: grid;
    gap: var(--spacing-xs);
    background: var(--inset);
    border: 1px solid var(--line);
    padding: var(--spacing-xs) var(--spacing-sm);
    font-size: var(--font-xs);
    min-width: clamp(150px, 11.62vw, 324px);
  }
  .plain h4 {
    margin: 0;
  }
  .plain p {
    color: var(--dim);
  }
</style>
