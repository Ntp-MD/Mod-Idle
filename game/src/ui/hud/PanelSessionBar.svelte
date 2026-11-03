<script lang="ts">
  import { getContext } from 'svelte';
  import { PANEL_SESSION, type PanelSession } from './panel-session';

  const session = getContext<PanelSession | undefined>(PANEL_SESSION);
</script>

{#if session}
  <div class="session-bar" aria-label="Live game status">
    <span class="clock-state" class:playing={session.running && !session.blocked}>
      {session.blocked ? 'Progress waiting' : !session.running ? 'Paused' : session.state}
    </span>
    <span class="pace">×{session.speed}</span>
    <span class="health" class:low={session.hp <= session.maxHp * .25}>
      HP <strong>{session.format(Math.max(0, session.hp))}</strong> / {session.format(session.maxHp)}
    </span>
    <div class="session-actions">
      <button type="button" class="btn btn-ghost" onclick={session.onhistory}>Combat history</button>
      <button type="button" class="btn btn-ghost" disabled={!session.writable || session.blocked}
        title={!session.writable ? 'Take account control to pause or resume.' : session.blocked ? 'Wait for the current load to finish.' : undefined}
        onclick={session.onpause}>{session.running ? 'Pause' : 'Resume'}</button>
    </div>
  </div>
{/if}

<style>
  .session-bar { display: flex; align-items: center; flex-wrap: wrap; gap: var(--spacing-xs) var(--spacing-md); padding: var(--spacing-xs) var(--spacing-md); background: var(--inset); border-block: 1px solid var(--line); flex: none; font-size: var(--font-2xs); color: var(--dim); }
  .clock-state { color: var(--gold); }
  .clock-state.playing { color: var(--text); }
  .pace, .health { font-variant-numeric: tabular-nums; }
  .health strong { color: var(--text); }
  .health.low, .health.low strong { color: var(--hp-lit); }
  .session-actions { display: flex; gap: var(--spacing-xs); margin-inline-start: auto; }
  .session-actions button { font-size: inherit; padding: var(--spacing-xs) var(--spacing-sm); }
</style>
