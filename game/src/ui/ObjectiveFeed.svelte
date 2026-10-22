<script lang="ts">
  import { onMount } from 'svelte';
  import CollapseToggle from './CollapseToggle.svelte';
  import Pager from './Pager.svelte';
  let { goal, deliveries, onSheet, onDelivery }: {
    goal: string;
    deliveries: { id: string; title: string; progress: string; clock: string; paused: string | null }[];
    onSheet: () => void;
    onDelivery: (id: string) => void;
  } = $props();
  let expanded = $state(true);
  let surface = $state<HTMLElement>();
  let list = $state<HTMLDivElement>();
  let start = $state(0);
  let pageSize = $state(1);
  const page = $derived(deliveries.slice(start, start + pageSize));
  $effect(() => { if (start >= deliveries.length) start = 0; });
  onMount(() => {
    let rowHeight = 0;
    const observer = new ResizeObserver(() => {
      if (!expanded || !surface || !list || !deliveries.length) return;
      const region = surface.parentElement!;
      const style = getComputedStyle(region);
      const gap = parseFloat(getComputedStyle(list).rowGap) || 0;
      for (const row of Array.from(list.children)) rowHeight = Math.max(rowHeight, row.getBoundingClientRect().height);
      if (!rowHeight) return;
      const available = region.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
      const overhead = surface.getBoundingClientRect().height - list.getBoundingClientRect().height;
      pageSize = Math.max(1, Math.min(deliveries.length, Math.floor((available - overhead + gap) / (rowHeight + gap))));
    });
    observer.observe(surface!);
    observer.observe(surface!.parentElement!);
    return () => observer.disconnect();
  });
</script>

<section bind:this={surface} class="objective-feed surface-hud" aria-label="Objectives">
  <CollapseToggle label={`Objectives ${deliveries.length + 1}`} controls="objective-content" bind:expanded />
  <div id="objective-content" hidden={!expanded} class="objective-content">
    <p class="objective-goal text-value">{goal}</p>
    <div class="delivery-list" bind:this={list}>
    {#each page as delivery (delivery.id)}
      <button type="button" class="objective-entry btn-quiet" onclick={() => onDelivery(delivery.id)} title="Open the Market delivery board">
        <strong>{delivery.title}</strong>
        <span>{delivery.progress} <span class="text-dim">· {delivery.clock}</span></span>
        {#if delivery.paused}<small class="text-dim">Paused · {delivery.paused}</small>{/if}
      </button>
    {/each}
    </div>
    <Pager
      group="Tracked delivery pages"
      pages={Math.ceil(deliveries.length / pageSize)}
      page={Math.floor(start / pageSize)}
      onturn={(p) => (start = p * pageSize)}
      text={`${start + 1}–${Math.min(start + pageSize, deliveries.length)} / ${deliveries.length}`}
      buttonClass="btn-quiet"
      announce
    />
    <button class="btn-flat objective-sheet text-note" type="button" onclick={onSheet}>Life-skill rungs · Sheet</button>
  </div>
</section>

<style>
  .objective-feed { width: 100%; min-width: 0; display: grid; gap: var(--spacing-sm); padding: var(--spacing-sm); }
  .objective-content { display: grid; gap: var(--spacing-sm); min-width: 0; }
  .objective-content[hidden] { display: none; }
  .delivery-list { display: grid; gap: var(--spacing-sm); }
  .delivery-list:empty { display: none; }
  .objective-goal { margin: 0; font-size: var(--font-xs); line-height: 1.4; overflow-wrap: anywhere; }
  .objective-entry { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: var(--spacing-xs) var(--spacing-sm); width: 100%; text-align: left; font-size: var(--font-xs); }
  .objective-entry strong { font-weight: 600; }
  .objective-entry small { flex-basis: 100%; }
  .objective-sheet { justify-self: start; text-align: left; font-size: var(--font-xs); }
</style>
