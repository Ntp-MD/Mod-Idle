<script lang="ts">
  import { emptyFeedState } from './logbox';
  import CollapseToggle from '../shared/CollapseToggle.svelte';
  type ChatTab = 'all' | 'combat' | 'loot' | 'system';
  type FeedLine = { id: number; text: string; tone: string; chan: 'combat' | 'loot' | 'system' };

  let { lines, tabs, active, hasActivity, onTab, onOpenHistory }: {
    lines: FeedLine[];
    tabs: [ChatTab, string][];
    active: ChatTab;
    hasActivity: boolean;
    onTab: (tab: ChatTab) => void;
    onOpenHistory?: () => void;
  } = $props();
  const empty = $derived(emptyFeedState(active, hasActivity));
  let expanded = $state(true);
</script>

<div class="combatlog surface-hud" class:collapsed={!expanded}>
  <div class="feed-heading">
    <CollapseToggle label="Log feed" controls="chronicle-content" bind:expanded />
    {#if onOpenHistory}<button type="button" class="btn btn-ghost" onclick={onOpenHistory} aria-label="Open recent combat history">Details</button>{/if}
  </div>
  <div id="chronicle-content" class="log-content" hidden={!expanded}>
  <!-- One stream with combat, loot and system filters. -->
  <div class="chattabs tab-strip" role="group" aria-label="Chronicle filters">
    {#each tabs as [id, label] (id)}
      <button type="button" class="tab-rail" class:picked={active === id} aria-pressed={active === id} onclick={() => onTab(id)}>{label}</button>
    {/each}
  </div>
  <!-- svelte-ignore a11y_no_noninteractive_tabindex (Keyboard focus enables native Arrow and Page Up/Down scrolling through the event history.) -->
  <div class="feed-body scroll-pane" role="log" tabindex="0" aria-label="Event feed" aria-live="polite" aria-relevant="additions">
    {#if lines.length === 0}
      <div class="empty-feed" role="status">
        <strong>{empty.title}</strong>
        <small>{empty.detail}</small>
      </div>
    {:else}
      {#each lines as line (line.id)}
        <p class={line.tone === 'gold' ? 'text-value' : line.tone === 'good' ? 'text-good' : 'text-dim'}>{line.text}</p>
      {/each}
    {/if}
  </div>
  </div>
</div>

<style>
  .feed-heading { display: flex; align-items: center; justify-content: space-between; gap: var(--spacing-xs); min-width: 0; }
  .feed-heading > :global(.collapse-toggle) { min-width: 0; }
  .feed-heading > button { flex: none; font-size: var(--font-2xs); }
  /* A persistent chronicle surface: filters and the empty state exist before the first event. */
  .combatlog {
    width: min(clamp(263px, 20.33vw, 567px), 100%); height: 100%;
    min-height: calc(var(--font-xs) * 10 + var(--spacing-xs) * 4 + var(--spacing-md));
    display: flex; flex-direction: column; gap: var(--spacing-xs); padding: var(--spacing-xs);
    overflow: hidden; pointer-events: none;
    box-shadow: 0 3px 10px rgba(0, 0, 0, .32);
  }
  .combatlog.collapsed { height: auto; min-height: 0; }
  .log-content { display: flex; flex: 1; flex-direction: column; gap: var(--spacing-xs); min-height: 0; }
  .log-content[hidden] { display: none; }
  .feed-body {
    display: flex; flex: 1; flex-direction: column; justify-content: safe flex-end; gap: var(--spacing-xs);
    padding: var(--spacing-xs); pointer-events: auto;
    background: rgba(0, 0, 0, .2); border-radius: var(--radius-card);
  }
  .empty-feed {
    display: flex; flex: 1; flex-direction: column; align-items: center; justify-content: center;
    gap: var(--spacing-xs); padding: var(--spacing-xs); text-align: center;
  }
  .empty-feed strong { font-size: var(--font-xs); font-weight: 600; }
  .empty-feed small { max-width: 34ch; line-height: 1.35; }
  /* the log lines are the feed's own children, so the strip rule never reaches the read beside them */
  .feed-body > p {
    flex: none;
    margin: 0; padding: var(--spacing-xs) var(--spacing-xs); font-size: var(--font-xs);
    background: linear-gradient(90deg, rgba(0, 0, 0, .62), rgba(0, 0, 0, .3) 78%, transparent);
    border-radius: var(--radius-card);
    overflow-wrap: anywhere;
  }
  /* channel filters share one framed rail; log lines stay passive */
  .chattabs {
    pointer-events: auto; display: flex; flex: none; width: 100%;
    overflow: hidden; border: 1px solid var(--hud-edge); border-radius: var(--radius-card);
    background: rgba(8, 11, 16, .82); box-shadow: inset 0 1px 0 rgba(255, 255, 255, .04);
  }
  .chattabs button {
    flex: 1; min-width: 0; font-size: var(--font-xs);
    text-transform: capitalize;
  }
  .chattabs button:last-child { border-right: 0; }
  .chattabs button:focus-visible { position: relative; z-index: var(--z-underlay); outline: 2px solid var(--focus); outline-offset: -2px; }
</style>
