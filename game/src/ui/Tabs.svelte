<script lang="ts">
  import type { Snippet } from 'svelte';

  /**
   * The one tablist for the client: a tablist of quiet buttons with the shared picked state,
   * the roving keyboard walk (arrows, Home, End) and a caller-owned face per tab.
   *
   * Every panel used to hand-write this row — its own `.x-tabs` class, its own picked/inverse
   * class name, its own arrow handler — so the faces drifted apart while staying the same shape.
   * The row here renders the buttons once; the panel supplies the list and, when a tab needs
   * more than a name (an icon, a count), the `item` snippet draws it inside the given tab.
   */
  export type TabItem = { id: string; label: string; disabled?: boolean; title?: string };

  let {
    tabs,
    active,
    onpick,
    label,
    orientation = 'horizontal',
    controls = '',
    prefix = '',
    class: extraClass = '',
    tabindex = true,
    tabClass = '',
    columns = 0,
    item,
  }: {
    /** The row's tabs, in order. */
    tabs: TabItem[];
    /** The active tab id; only it carries the roving tabindex. */
    active: string;
    onpick: (id: string) => void;
    /** The tablist's own accessible name. */
    label: string;
    orientation?: 'horizontal' | 'vertical';
    /** The tabpanel(s) the buttons control, when a panel body exists to name. */
    controls?: string;
    /** Prefix for stable tab ids (`${prefix}-${id}`), when another element points at one. */
    prefix?: string;
    /** Extra class for the row wrapper, so a panel may keep its own frame. */
    class?: string;
    /** Roving tabindex; `false` keeps every tab unfocusable-by-tab in a one-tab row. */
    tabindex?: boolean;
    /** A caller-owned class for the buttons themselves, when the row's tabs are richer than a label. */
    tabClass?: string;
    /** When set, the row is an equal-column grid instead of a wrapping flex row. */
    columns?: number;
    /** A tab's face; the default renders its label text. */
    item?: Snippet<[TabItem]>;
  } = $props();

  let row = $state<HTMLDivElement | null>(null);

  /** The shared keyboard line: arrows walk the enabled tabs, Home and End land on the ends. */
  function walk(event: KeyboardEvent) {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
    const list = Array.from(row?.querySelectorAll<HTMLButtonElement>('[role="tab"]:not(:disabled)') ?? []);
    const index = list.indexOf(document.activeElement as HTMLButtonElement);
    if (index < 0 || !list.length) return;
    let next = index;
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') next = (index + 1) % list.length;
    else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') next = (index - 1 + list.length) % list.length;
    else if (event.key === 'Home') next = 0;
    else next = list.length - 1;
    event.preventDefault();
    list[next].focus();
    list[next].click();
  }
</script>

<div
  bind:this={row}
  class={`tabs ${extraClass}`.trim()}
  class:grid={columns > 0}
  style:--tabs-columns={columns || undefined}
  role="tablist"
  aria-label={label}
  aria-orientation={orientation}
  tabindex={tabindex ? -1 : undefined}
  onkeydown={walk}
>
  {#each tabs as t (t.id)}
    <button
      id={prefix ? `${prefix}-${t.id}` : undefined}
      type="button"
      role="tab"
      class={`btn btn-quiet ${tabClass}`.trim()}
      class:picked={active === t.id}
      aria-selected={active === t.id}
      aria-controls={controls || undefined}
      title={t.title}
      disabled={t.disabled}
      tabindex={tabindex ? (active === t.id ? 0 : -1) : -1}
      onclick={() => onpick(t.id)}
    >
      {#if item}{@render item(t)}{:else}{t.label}{/if}
    </button>
  {/each}
</div>

<style>
  /* the row layouts the client owns: a wrapping flex row by default, a vertical column for the
     panels that stack their tabs beside the body, and a bottom frame for a sheet's header */
  .tabs { display: flex; flex-wrap: wrap; align-items: stretch; gap: var(--spacing-xs); min-width: 0; }
  .tabs[aria-orientation='vertical'] { display: grid; align-content: start; gap: var(--spacing-xs); align-items: start; border-right: 1px solid var(--line); padding-right: var(--spacing-md); }
  .tabs.frame { border-bottom: 1px solid var(--line); padding-bottom: var(--spacing-sm); }
  .tabs.grid { display: grid; grid-template-columns: repeat(var(--tabs-columns), minmax(0, 1fr)); }
</style>
