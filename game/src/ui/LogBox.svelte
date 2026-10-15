<script lang="ts">
  import { emptyFeedState } from './logbox';
  type ChatTab = 'all' | 'combat' | 'loot' | 'system';
  type FeedLine = { id: number; text: string; tone: string; chan: Exclude<ChatTab, 'all'> };

  let { lines, tabs, active, hasActivity, onTab }: {
    lines: FeedLine[];
    tabs: [ChatTab, string][];
    active: ChatTab;
    hasActivity: boolean;
    onTab: (tab: ChatTab) => void;
  } = $props();
  const empty = $derived(emptyFeedState(active, hasActivity));
</script>

<div class="combatlog" role="log" aria-label="Event feed" aria-live="polite" aria-relevant="additions">
  <!-- one stream, four ways to read it: combat, loot and system each keep their own channel -->
  <div class="chattabs" role="group" aria-label="Chronicle filters">
    {#each tabs as [id, label] (id)}
      <button type="button" class:active={active === id} aria-pressed={active === id} onclick={() => onTab(id)}>{label}</button>
    {/each}
  </div>
  <div class="feed-body">
    {#if lines.length === 0}
      <div class="empty-feed" role="status">
        <strong>{empty.title}</strong>
        <small>{empty.detail}</small>
      </div>
    {:else}
      {#each lines as line, i (line.id)}
        <p class={line.tone} style={`--age:${lines.length - 1 - i}`}>{line.text}</p>
      {/each}
    {/if}
  </div>
</div>

<style>
  /* A persistent chronicle surface: filters and the empty state exist before the first event. */
  .combatlog {
    width: min(clamp(263px, 20.33vw, 567px), 100%); height: 100%;
    min-height: calc(var(--font-xs) * 10 + var(--spacing-xs) * 4 + var(--spacing-md));
    display: flex; flex-direction: column; gap: var(--spacing-2xs); padding: var(--spacing-2xs);
    overflow: hidden; pointer-events: none;
    background: var(--glass); border: 1px solid var(--hud-edge); border-radius: var(--radius-sm);
    box-shadow: 0 3px 10px rgba(0, 0, 0, .32);
  }
  .feed-body {
    display: flex; flex: 1; flex-direction: column; justify-content: flex-end; gap: var(--spacing-3xs);
    min-height: 0; overflow: hidden; padding: var(--spacing-2xs);
    background: rgba(0, 0, 0, .2); border-radius: var(--radius-sm);
  }
  .empty-feed {
    display: flex; flex: 1; flex-direction: column; align-items: center; justify-content: center;
    gap: var(--spacing-3xs); padding: var(--spacing-xs); text-align: center;
  }
  .empty-feed strong { color: var(--text); font-size: var(--font-xs); font-weight: 600; }
  .empty-feed small { max-width: 34ch; color: var(--dim); font-size: var(--font-xs); line-height: 1.35; }
  .feed-body p {
    flex: none;
    margin: 0; padding: var(--spacing-3xs) var(--spacing-xs); font-size: var(--font-xs); color: var(--dim);
    background: linear-gradient(90deg, rgba(0, 0, 0, .62), rgba(0, 0, 0, .3) 78%, transparent);
    border-radius: var(--radius-sm);
    opacity: calc(1 - var(--age, 0) * .14);
    overflow: hidden; white-space: nowrap; text-overflow: ellipsis;
  }
  .feed-body p.gold { color: var(--gold); }
  .feed-body p.good { color: var(--good-lit); }
  /* channel filters share one framed rail; log lines stay passive */
  .chattabs {
    pointer-events: auto; display: flex; flex: none; width: 100%;
    overflow: hidden; border: 1px solid var(--hud-edge); border-radius: var(--radius-sm);
    background: rgba(8, 11, 16, .82); box-shadow: inset 0 1px 0 rgba(255, 255, 255, .04);
  }
  .chattabs button {
    flex: 1 1 0; min-width: 0; padding: var(--spacing-2xs) var(--spacing-3xs); font-size: var(--font-xs);
    text-transform: capitalize; background: transparent; border: 0; border-right: 1px solid var(--edge); color: var(--dim);
  }
  .chattabs button:last-child { border-right: 0; }
  .chattabs button.active { color: var(--gold-lit); background: color-mix(in srgb, var(--gold) 12%, transparent); box-shadow: inset 0 -1px 0 var(--gold); }
  .chattabs button:focus-visible { position: relative; z-index: var(--z-underlay); outline: 2px solid var(--focus); outline-offset: -2px; }
</style>
