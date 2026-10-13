<script lang="ts">
  type ChatTab = 'all' | 'combat' | 'loot' | 'system';
  type FeedLine = { id: number; text: string; tone: string; chan: Exclude<ChatTab, 'all'> };

  let { lines, tabs, active, onTab }: {
    lines: FeedLine[];
    tabs: [ChatTab, string][];
    active: ChatTab;
    onTab: (tab: ChatTab) => void;
  } = $props();
</script>

<div class="combatlog" role="log" aria-live="polite">
  <!-- one stream, four ways to read it: combat, loot and system each keep their own channel -->
  <div class="chattabs" role="group" aria-label="Chronicle filters">
    {#each tabs as [id, label] (id)}
      <button type="button" class:active={active === id} aria-pressed={active === id} onclick={() => onTab(id)}>{label}</button>
    {/each}
  </div>
  {#each lines as line, i (line.id)}
    <p class={line.tone} style={`--age:${lines.length - 1 - i}`}>{line.text}</p>
  {/each}
</div>

<style>
  /* the field's own log follows the map's fight toggle in the shared bottom-left column */
  .combatlog {
    width: min(var(--box-420), 100%); min-height: calc(var(--font-xs) * 10 + var(--spacing-xs) * 4 + var(--spacing-md));
    display: grid; align-content: end; gap: var(--spacing-3xs); pointer-events: none;
  }
  .combatlog p {
    margin: 0; padding: var(--spacing-3xs) var(--spacing-xs); font-size: var(--font-xs); color: var(--dim);
    background: linear-gradient(90deg, rgba(0, 0, 0, .62), rgba(0, 0, 0, .3) 78%, transparent);
    border-radius: clamp(5px, 0.39vw, 11px);
    opacity: calc(1 - var(--age, 0) * .14);
    overflow: hidden; white-space: nowrap; text-overflow: ellipsis;
  }
  .combatlog p.gold { color: var(--gold); }
  .combatlog p.good { color: var(--good-lit); }
  /* channel filters share one framed rail; log lines stay passive */
  .chattabs {
    pointer-events: auto; display: flex; width: 100%; margin-bottom: var(--seam);
    overflow: hidden; border: 1px solid var(--hud-edge); border-radius: var(--spacing-2xs);
    background: rgba(8, 11, 16, .82); box-shadow: inset 0 1px 0 rgba(255, 255, 255, .04);
  }
  .chattabs button {
    flex: 1 1 0; min-width: 0; padding: var(--spacing-2xs) var(--spacing-3xs); font-size: var(--font-xs);
    text-transform: capitalize; background: transparent; border: 0; border-right: 1px solid var(--edge); color: var(--dim);
  }
  .chattabs button:last-child { border-right: 0; }
  .chattabs button.active { color: var(--gold-lit); background: color-mix(in srgb, var(--gold) 12%, transparent); box-shadow: inset 0 -1px 0 var(--gold); }
  .chattabs button:focus-visible { position: relative; z-index: 1; outline: 2px solid var(--focus); outline-offset: -2px; }
</style>
