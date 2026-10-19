<script lang="ts">
  import type { StatKey } from '../engine/client';

  /** The level's points, spent where the level is read: this is the only place a point is added,
   *  and Respec stays a settlement service so a field refund cannot serve a build switch mid-fight. */
  let { stats, core, points, statPoints, treePoints, autoSpend, level, onallocate, ontoggleauto }: {
    stats: StatKey[];
    core: Record<StatKey, number>;
    points: Record<StatKey, number>;
    statPoints: number;
    treePoints: number;
    autoSpend: boolean;
    level: number;
    onallocate: (k: StatKey, delta: number) => void;
    ontoggleauto: () => void;
  } = $props();

  const FULL_NAME: Record<StatKey, string> = {
    str: 'Strength', int: 'Intelligence', vit: 'Vitality', agi: 'Agility',
    dex: 'Dexterity', wis: 'Wisdom', lck: 'Luck',
  };
</script>

<div class="stat-allocator">
  <header><h3 class="text-accent">Core stats</h3><strong class="text-value" aria-live="polite">{statPoints} unspent</strong></header>
  <label class="allocator-auto text-note"><input type="checkbox" checked={autoSpend} onchange={ontoggleauto} /> Auto-allocate evenly</label>
  <table class="stats"><tbody>
    {#each stats as k (k)}
      <tr>
        <th scope="row" title={FULL_NAME[k]}>{k.toUpperCase()}</th>
        <td><div class="allocator-value">{core[k].toFixed(1)}<small class="text-note">{points[k]} pts</small></div></td>
        <td>
          <div class="allocator-actions" role="group" aria-label={`${FULL_NAME[k]} points`}>
          <button class="btn btn-quiet" type="button" onclick={() => onallocate(k, -1)} disabled={autoSpend || !points[k]}
                  aria-label={`Decrease ${FULL_NAME[k]}`}>−</button>
          <button class="btn btn-quiet" type="button" onclick={() => onallocate(k, 1)} disabled={autoSpend || statPoints <= 0}
                  aria-label={`Increase ${FULL_NAME[k]}`}>+</button>
          <button class="btn btn-quiet" type="button" onclick={() => onallocate(k, statPoints)} disabled={autoSpend || statPoints <= 0}
                  aria-label={`Allocate all available points to ${FULL_NAME[k]}`}>Max</button>
          </div>
        </td>
      </tr>
    {/each}
  </tbody></table>
  <p class="allocator-left text-note">Level {level} · <b>{treePoints}</b> tree points banked</p>
  <details class="allocator-help text-note">
    <summary>Allocation help</summary>
    <p>Levels grant points, not stats. Turn off auto-allocation to bank points and spend them by hand. Respec is free at the town Counterhand.</p>
  </details>
</div>

<style>
  .stat-allocator { display: grid; align-content: start; gap: var(--spacing-xs); min-width: 0; }
  .stat-allocator header { display: flex; align-items: baseline; justify-content: space-between; gap: var(--spacing-xs); }
  .stat-allocator h3 { font-size: var(--font-sm); }
  .stat-allocator header strong { font-size: var(--font-xs); font-variant-numeric: tabular-nums; }
  .allocator-auto { display: flex; align-items: center; gap: var(--spacing-xs); }
  .stat-allocator .stats { width: 100%; border-collapse: collapse; }
  .stat-allocator .stats td { padding: var(--spacing-xs) var(--spacing-xs); font-size: var(--font-xs); line-height: 1.15; vertical-align: middle; }
  .stat-allocator .stats th { font-size: var(--font-xs); }
  .allocator-value { display: flex; align-items: baseline; gap: var(--spacing-xs); }
  .allocator-actions { display: flex; justify-content: flex-end; align-items: center; gap: var(--spacing-xs); }
  .allocator-actions button { padding: 0 var(--spacing-xs); min-width: var(--icon-label); min-height: var(--icon-label); }
  .allocator-left { margin: 0; font-variant-numeric: tabular-nums; }
  .allocator-help { display: grid; gap: var(--spacing-xs); }
  .allocator-help p { margin: 0; }
  .stat-allocator :is(button, input):focus-visible { outline-offset: 1px; }
</style>
