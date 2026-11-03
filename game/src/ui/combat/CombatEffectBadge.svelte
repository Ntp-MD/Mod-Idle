<script lang="ts">
  import Icon from '../shared/Icon.svelte';

  let { id, label, icon, secs = null, stacks = 1, permanent = false, harmful = false, detail = '', align = 'start' }: {
    id: string; label: string; icon: string; secs?: number | null; stacks?: number;
    permanent?: boolean; harmful?: boolean; detail?: string; align?: 'start' | 'end';
  } = $props();
  const remaining = $derived(secs == null ? '' : secs >= 60 ? `${Math.ceil(secs / 60)}m` : `${Math.ceil(secs)}s`);
  const readout = $derived(`${label}${stacks > 1 ? `, ${stacks} stacks` : ''}${permanent ? ', aura active' : secs != null ? `, ${Math.ceil(secs)} seconds left` : ', active'}`);
  const descriptionId = $derived(`combat-effect-${id}`);
  let dismissed = $state(false);
</script>

<span class="effect-badge" class:harmful class:permanent class:dismissed class:align-end={align === 'end'}>
  <button type="button" class="effect-mark" aria-label={readout} aria-describedby={descriptionId}
    onfocus={() => dismissed = false} onpointerenter={() => dismissed = false}
    onkeydown={(event) => { if (event.key === 'Escape') { dismissed = true; event.stopPropagation(); } }}>
    <Icon src={icon} />
    {#if stacks > 1}<span class="stack-count">×{stacks}</span>{/if}
    <small class="effect-time">{permanent ? 'Aura' : remaining || 'Active'}</small>
  </button>
  <span class="effect-detail" id={descriptionId} role="tooltip">
    <strong>{label}</strong>
    <span>{permanent ? 'Aura active' : secs != null ? `${Math.ceil(secs)} seconds remaining` : 'Active'}{stacks > 1 ? ` · ${stacks} stacks` : ''}</span>
    {#if detail}<span>{detail}</span>{/if}
  </span>
</span>

<style>
  .effect-badge { position: relative; display: block; pointer-events: auto; }
  .effect-badge:hover, .effect-badge:focus-within { z-index: var(--z-toast); }
  .effect-mark {
    position: relative; display: grid; place-items: center; width: calc(var(--icon-label) * 1.7); height: calc(var(--icon-label) * 1.7 + 10px);
    padding: 2px 2px 13px; border: 1px solid color-mix(in srgb, var(--good-lit) 58%, var(--edge)); border-radius: 4px;
    background: var(--inset); color: var(--good-lit); box-shadow: var(--shadow-soft); cursor: help;
  }
  .harmful .effect-mark { border-color: color-mix(in srgb, var(--alarm) 65%, var(--edge)); color: var(--alarm); }
  .permanent .effect-mark { border-style: dashed; border-color: var(--es); color: var(--es-lit); }
  .effect-mark:hover { background: var(--face-top); }
  .effect-mark:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
  .effect-time { position: absolute; bottom: 2px; left: 1px; right: 1px; color: var(--text); font-size: var(--font-3xs); line-height: 1; text-align: center; font-variant-numeric: tabular-nums; }
  .stack-count { position: absolute; top: -5px; right: -5px; padding: 1px 2px; border-radius: 2px; background: var(--inset); color: var(--text); font-size: var(--font-3xs); line-height: 1.2; font-variant-numeric: tabular-nums; }
  .effect-detail {
    position: absolute; top: 0; left: calc(100% + var(--spacing-xs)); display: none; gap: 4px; width: max-content; max-width: 250px;
    padding: var(--spacing-sm); border: 1px solid var(--hud-edge); border-radius: 4px; background: var(--inset); box-shadow: var(--shadow-raised);
    color: var(--text); font-size: var(--font-xs); line-height: 1.35; pointer-events: none;
  }
  .align-end .effect-detail { left: auto; right: calc(100% + var(--spacing-xs)); }
  .effect-detail strong { color: var(--good-lit); }
  .harmful .effect-detail strong { color: var(--alarm); }
  .permanent .effect-detail strong { color: var(--es-lit); }
  .effect-badge:hover .effect-detail, .effect-badge:focus-within .effect-detail { display: grid; }
  .effect-badge.dismissed .effect-detail { display: none; }
</style>
