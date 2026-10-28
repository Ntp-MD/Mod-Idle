<script lang="ts">
  import { E } from '../../engine/client';
  import { elementIcon } from '../../icon';
  import { statusLabel } from '@sim/combat/mobStatus';
  import { statusViews } from '@sim/combat/playerStatus';
  import type { Statuses } from '@sim/combat/combat';

  let { statuses }: { statuses: Statuses } = $props();
  const views = $derived(statusViews(statuses).filter((view) => view.stacks > 0 || view.secLeft > 0).map((view) => {
    const element = Object.entries(E.elements.status_of as Record<string, string>)
      .find(([, status]) => status === view.family)?.[0] ?? 'physical';
    return { ...view, label: statusLabel(view.family), icon: elementIcon(element),
      colour: (E.elements.colour as Record<string, string>)[element] || E.elements.physical_colour };
  }));
  const describe = (view: { label: string; stacks: number; secLeft: number }): string =>
    `${view.label}${view.stacks > 1 ? ` · ${view.stacks} stacks` : ''}${view.secLeft > 0 ? ` · ${Math.ceil(view.secLeft)}s` : ''}`;
</script>

{#if views.length}
  <div class="player-statuses" role="list" aria-label="Player status">
    {#each views as view (view.family)}
      <span class="player-status" role="listitem" title={describe(view)} aria-label={describe(view)} style:color={view.colour}>
        <span class="icon-mask" style={`--glyph:url(${view.icon})`} aria-hidden="true"></span>
        {#if view.stacks > 1}<small>{view.stacks}</small>{/if}
        {#if view.secLeft > 0}<em>{Math.ceil(view.secLeft)}</em>{/if}
      </span>
    {/each}
  </div>
{/if}

<style>
  .player-statuses { display: flex; justify-content: center; gap: var(--spacing-xs); flex-wrap: wrap; }
  .player-status { position: relative; display: grid; place-items: center; width: 30px; height: 30px; padding: 4px; border: 1px solid var(--hud-edge); border-radius: 3px; background: var(--bg); }
  .player-status .icon-mask { width: 20px; height: 20px; }
  .player-status small { position: absolute; top: -4px; right: -3px; padding: 0 2px; border-radius: 2px; background: var(--bg); color: var(--text); font-size: var(--font-3xs); font-variant-numeric: tabular-nums; }
  .player-status em { position: absolute; bottom: -1px; right: 1px; padding: 0 2px; background: var(--bg); color: var(--text); font-size: var(--font-3xs); font-style: normal; font-variant-numeric: tabular-nums; }
</style>
