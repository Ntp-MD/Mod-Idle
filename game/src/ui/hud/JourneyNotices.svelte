<script lang="ts">
  import type { GuidanceNotice } from '@sim/core/guidance';
  let { notices, onaction }: { notices: GuidanceNotice[]; onaction: (notice: GuidanceNotice) => void } = $props();
  const attention = $derived(notices.filter(notice => notice.kind !== 'tracked' && notice.kind !== 'optional'));
  const updates = $derived(notices.filter(notice => notice.kind === 'tracked' || notice.kind === 'optional'));
</script>

<div class="journey-notices">
  {#each attention as notice (notice.id)}
    <section class="attention" class:alarm={notice.kind === 'error' || notice.kind === 'blocked'} role={notice.kind === 'error' ? 'alert' : undefined}>
      <div><h3>{notice.title}</h3><p>{notice.detail}</p></div>
      {#if notice.actionLabel}<button class="btn btn-quiet" type="button" onclick={() => onaction(notice)}>{notice.actionLabel}</button>{/if}
    </section>
  {/each}
  {#if updates.length}
    <details class="updates"><summary>Tracked updates · {updates.length}</summary>
      {#each updates as notice (notice.id)}<section><h3>{notice.title}</h3><p>{notice.detail}</p>{#if notice.actionLabel}<button class="btn btn-flat" type="button" onclick={() => onaction(notice)}>{notice.actionLabel}</button>{/if}</section>{/each}
    </details>
  {/if}
</div>

<style>
  .journey-notices { display: grid; gap: 8px; min-width: 0; }
  .attention { display: grid; gap: 7px; padding: 9px 10px; border-inline-start: 2px solid var(--gold); background: var(--inset); }
  .attention.alarm { border-color: var(--alarm); }
  h3, p { margin: 0; } h3 { color: var(--gold-lit); font-size: var(--font-2xs); line-height: 1.4; }
  .alarm h3 { color: var(--alarm); } p { color: var(--sheet-ink); font-size: var(--font-2xs); line-height: 1.5; }
  button { justify-self: start; font-size: var(--font-2xs); }
  .updates { border-top: 1px solid var(--edge); font-size: var(--font-2xs); }
  summary { cursor: pointer; padding-block: 7px; color: var(--sheet-ink); }
  .updates section { display: grid; gap: 6px; padding-block: 8px; border-top: 1px solid var(--edge); }
</style>
