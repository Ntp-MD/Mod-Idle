<script lang="ts">
  type ChatTab = 'all' | 'combat' | 'loot' | 'system';
  type FeedLine = { id: number; text: string; tone: string; chan: Exclude<ChatTab, 'all'> };

  let { lines, hasFeed, tabs, active, onTab }: {
    lines: FeedLine[];
    hasFeed: boolean;
    tabs: [ChatTab, string][];
    active: ChatTab;
    onTab: (tab: ChatTab) => void;
  } = $props();
</script>

{#if hasFeed}
  <div class="combatlog" role="log" aria-live="polite">
    <!-- one stream, four ways to read it: combat, loot and system each keep their own channel -->
    <div class="chattabs" role="tablist" aria-label="The chronicle">
      {#each tabs as [id, label] (id)}
        <button role="tab" class:active={active === id} aria-selected={active === id} onclick={() => onTab(id)}>{label}</button>
      {/each}
    </div>
    {#each lines as line, i (line.id)}
      <p class={line.tone} style={`--age:${lines.length - 1 - i}`}>{line.text}</p>
    {/each}
  </div>
{/if}

<style>
  /* the field's own log follows the map's fight toggle in the shared bottom-left column */
  .combatlog {
    width: min(var(--box-420), 100%); display: grid; gap: 2px; pointer-events: none;
  }
  .combatlog p {
    margin: 0; padding: 2px var(--spacing-xs); font-size: var(--font-xs); color: var(--dim);
    background: linear-gradient(90deg, rgba(0, 0, 0, .62), rgba(0, 0, 0, .3) 78%, transparent);
    border-radius: clamp(5px, 0.326vw + 1px, 11px);
    opacity: calc(1 - var(--age, 0) * .14);
    overflow: hidden; white-space: nowrap; text-overflow: ellipsis;
  }
  .combatlog p.gold { color: var(--gold); }
  .combatlog p.good { color: var(--good-lit); }
  /* channel tabs stay pressable; log lines stay passive */
  .chattabs { pointer-events: auto; display: flex; gap: 3px; margin-bottom: 1px; }
  .chattabs button {
    padding: 1px var(--spacing-xs); font-size: var(--font-xs); border-radius: 999px;
    background: rgba(0, 0, 0, .5); border: 1px solid var(--edge); color: var(--dim);
  }
  .chattabs button.active { color: var(--gold); border-color: color-mix(in srgb, var(--gold) 45%, transparent); }
</style>
