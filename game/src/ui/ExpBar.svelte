<script lang="ts">
  let { level, pct, allocOpen, onAllocate }: {
    level: number;
    pct: number;
    allocOpen: boolean;
    onAllocate: () => void;
  } = $props();

  const progress = $derived(pct.toFixed(1));
</script>

<div class="expbar" role="group" aria-label={`Level ${level}, experience ${progress} percent`}>
  <button class="lv" type="button" aria-label={`Allocate stat points · level ${level}`} aria-expanded={allocOpen}
          title="Allocate stat points" onclick={onAllocate}>Lv {level}</button>
  <span class="track"><i style={`--progress:${(pct / 100).toFixed(3)}`}></i><b>{progress}%</b></span>
</div>

<style>
  /* The compact run read sits below the vital and skill cluster. */
  .expbar {
    position: relative; flex: none; width: 100%; height: max(var(--bar-h), calc(var(--font-xs) + var(--spacing-2xs)));
    display: flex; align-items: center; gap: var(--spacing-sm); padding: 0 var(--spacing-sm);
    background: linear-gradient(180deg, rgba(12, 16, 23, .9), rgba(8, 11, 16, .97));
    border-top: 1px solid color-mix(in srgb, var(--gold) 30%, var(--edge));
    font-size: var(--font-xs); line-height: 1; font-variant-numeric: tabular-nums; pointer-events: none;
  }
  .lv {
    pointer-events: auto; padding: 0; border: 0; border-radius: var(--radius-sm); background: none;
    color: var(--gold); font: inherit; font-weight: 600; white-space: nowrap;
  }
  .track {
    position: relative; flex: 1; height: max(var(--bar-h), calc(var(--font-xs) + var(--spacing-3xs) + var(--seam))); min-width: 0;
    border-radius: var(--radius-round); background: rgba(255, 255, 255, .08); border: 1px solid var(--edge); overflow: hidden;
  }
  .track i { position: absolute; top: 0; bottom: 0; left: 0; width: 100%; border-radius: var(--radius-round); background-image: linear-gradient(90deg, var(--xp), var(--xp-lit)); transform: scaleX(var(--progress)); transform-origin: left center; transition: transform var(--motion-ui); }
  .track b {
    position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
    color: var(--text); text-shadow: 0 1px 2px rgba(0, 0, 0, .95);
  }
</style>
