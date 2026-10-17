<script lang="ts">
  import { emptyFeedState } from './logbox';
  type ChatTab = 'all' | 'combat' | 'loot' | 'system' | 'objectives';
  type FeedLine = { id: number; text: string; tone: string; chan: 'combat' | 'loot' | 'system' };

  let { lines, tabs, active, hasActivity, objectives, onTab }: {
    lines: FeedLine[];
    tabs: [ChatTab, string][];
    active: ChatTab;
    hasActivity: boolean;
    /** the run's target: the chronicle's one reference read, and the pointer to the sheet's rungs */
    objectives: { goal: string };
    onTab: (tab: ChatTab) => void;
  } = $props();
  const empty = $derived(emptyFeedState(active === 'objectives' ? 'all' : active, hasActivity));
</script>

<div class="combatlog" role="log" aria-label="Event feed" aria-live="polite" aria-relevant="additions">
  <!-- one stream, four ways to read it, and one reference read on the end: combat, loot and system each
       keep their own channel, and the run's target has no events to filter -->
  <div class="chattabs tab-strip" role="group" aria-label="Chronicle filters">
    {#each tabs as [id, label] (id)}
      <button type="button" class="tab-rail" class:active={active === id} aria-pressed={active === id} onclick={() => onTab(id)}>{label}</button>
    {/each}
  </div>
  <div class="feed-body" class:reference={active === 'objectives'}>
    {#if active === 'objectives'}
      <div class="objectives" role="group" aria-label="Objectives">
        <p class="goal text-value">{objectives.goal}</p>
        <p class="note text-note">The life-skill rungs read on the character sheet's Life skills tab.</p>
      </div>
    {:else if lines.length === 0}
      <div class="empty-feed" role="status">
        <strong>{empty.title}</strong>
        <small>{empty.detail}</small>
      </div>
    {:else}
      {#each lines as line, i (line.id)}
        <p class={line.tone === 'gold' ? 'text-value' : line.tone === 'good' ? 'text-good' : 'text-dim'} style={`--age:${lines.length - 1 - i}`}>{line.text}</p>
      {/each}
    {/if}
  </div>
</div>

<style>
  /* A persistent chronicle surface: filters and the empty state exist before the first event. */
  .combatlog {
    width: min(clamp(263px, 20.33vw, 567px), 100%); height: 100%;
    min-height: calc(var(--font-xs) * 10 + var(--spacing-xs) * 4 + var(--spacing-md));
    display: flex; flex-direction: column; gap: var(--spacing-xs); padding: var(--spacing-xs);
    overflow: hidden; pointer-events: none;
    background: var(--glass); border: 1px solid var(--hud-edge); border-radius: var(--radius-sm);
    box-shadow: 0 3px 10px rgba(0, 0, 0, .32);
  }
  .feed-body {
    display: flex; flex: 1; flex-direction: column; justify-content: flex-end; gap: var(--spacing-xs);
    min-height: 0; overflow: hidden; padding: var(--spacing-xs);
    background: rgba(0, 0, 0, .2); border-radius: var(--radius-sm);
  }
  /* the reference read is a line of the target and where the rungs live: it starts at the top, where the
     event stream stays pinned to its newest line */
  .feed-body.reference { justify-content: flex-start; }
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
    border-radius: var(--radius-sm);
    opacity: calc(1 - var(--age, 0) * .14);
    overflow: hidden; white-space: nowrap; text-overflow: ellipsis;
  }
  /* one rung per row, the figures in their own columns: the ten rungs read down, never into each other */
  .objectives { display: grid; gap: var(--spacing-xs); }
  .objectives p { margin: 0; }
  .objectives .goal { font-size: var(--font-sm); line-height: 1.3; }
  .objectives .note { line-height: 1.35; }
  /* channel filters share one framed rail; log lines stay passive */
  .chattabs {
    pointer-events: auto; display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); flex: none; width: 100%;
    overflow: hidden; border: 1px solid var(--hud-edge); border-radius: var(--radius-sm);
    background: rgba(8, 11, 16, .82); box-shadow: inset 0 1px 0 rgba(255, 255, 255, .04);
  }
  /* five fixed channels: three on the first line, two on the second — never a lone stretched tab */
  .chattabs button {
    min-width: 0; font-size: var(--font-xs);
    text-transform: capitalize;
  }
  .chattabs button:nth-child(-n+3) { grid-column: span 2; }
  .chattabs button:nth-child(n+4) { grid-column: span 3; }
  .chattabs button:nth-child(3), .chattabs button:last-child { border-right: 0; }
  .chattabs button:focus-visible { position: relative; z-index: var(--z-underlay); outline: 2px solid var(--focus); outline-offset: -2px; }
</style>
