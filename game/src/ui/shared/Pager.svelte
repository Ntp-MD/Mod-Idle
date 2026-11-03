<script lang="ts">
  import { tick } from 'svelte';

  /**
   * The one pager bar: previous, the position, next — the shape every paged list repeats.
   *
   * CraftWorkshop's stone pages, ObjectiveFeed's tracked deliveries and SlotGrid's grid fold each
   * hand- Rolled this same row, with its own symbols and its own counter text. The bar here draws it
   * once; the caller owns the page state and the label. When a turn closes the button that was
   * clicked (the first or last page), focus hops to the button that still works.
   */
  let {
    pages,
    page,
    onturn,
    group,
    text,
    buttonClass = '',
    announce = false,
  }: {
    /** The total page count; the bar hides below two. */
    pages: number;
    /** The zero-based page the caller is showing. */
    page: number;
    onturn: (page: number) => void;
    /** The bar's own accessible name. */
    group: string;
    /** The position line, e.g. `3 / 7` or `1–8 / 24`. */
    text: string;
    /** A caller-owned class for the two buttons, when a panel wants them quieter. */
    buttonClass?: string;
    /** Announce the position line when the page turns. */
    announce?: boolean;
  } = $props();

  let bar = $state<HTMLDivElement | null>(null);

  function turn(next: number) {
    onturn(next);
    void tick().then(() => {
      const active = document.activeElement as HTMLButtonElement | null;
      if (active?.disabled) bar?.querySelector<HTMLButtonElement>(':scope button:not(:disabled)')?.focus();
    });
  }
</script>

{#if pages > 1}
  <div class="pager" bind:this={bar} role="group" aria-label={group}>
    <button type="button" class={buttonClass} disabled={page <= 0} aria-label="Previous page" onclick={() => turn(page - 1)}>‹</button>
    <span role={announce ? 'status' : undefined}>{text}</span>
    <button type="button" class={buttonClass} disabled={page >= pages - 1} aria-label="Next page" onclick={() => turn(page + 1)}>›</button>
  </div>
{/if}

<style>
  .pager { display: flex; align-items: center; gap: var(--spacing-xs); font-size: var(--font-xs); color: var(--dim); font-variant-numeric: tabular-nums; }
  .pager button { font-size: var(--font-xs); }
  .pager button:disabled { opacity: 0.4; }
</style>
