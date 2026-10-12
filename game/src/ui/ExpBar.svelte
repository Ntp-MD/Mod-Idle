<script lang="ts">
  let { level, pct, kills, minutes, allocOpen, onAllocate }: {
    level: number;
    pct: number;
    kills: string;
    minutes: number;
    allocOpen: boolean;
    onAllocate: () => void;
  } = $props();

  const progress = $derived(pct.toFixed(1));
</script>

<div class="expbar" role="group" aria-label={`Level ${level}, experience ${progress} percent`}>
  <button class="lv" type="button" aria-label={`Allocate stat points · level ${level}`} aria-expanded={allocOpen}
          title="Allocate stat points" onclick={onAllocate}>Lv {level}</button>
  <span class="track"><i style={`width:${progress}%`}></i><b>{progress}%</b></span>
  <span class="meta">{kills} kills · {minutes} min</span>
</div>

<style>
  /* the floor strip: the run's one bar pinned to the frame's bottom edge — the level and how far into
     it on the left, the track carrying its own figure, the run clock and its kills on the right */
  .expbar {
    position: absolute; left: 0; right: 0; bottom: 0; z-index: 6; height: var(--bar-h);
    display: flex; align-items: center; gap: var(--spacing-sm); padding: 0 var(--spacing-sm);
    background: linear-gradient(180deg, rgba(12, 16, 23, .9), rgba(8, 11, 16, .97));
    border-top: 1px solid color-mix(in srgb, var(--gold) 30%, var(--edge));
    font-size: var(--font-xs); font-variant-numeric: tabular-nums; pointer-events: none;
  }
  .lv {
    pointer-events: auto; padding: 0; border: 0; border-radius: 0; background: none;
    color: var(--gold); font: inherit; font-weight: 600; white-space: nowrap;
  }
  .track {
    position: relative; flex: 1; height: calc(var(--bar-h) - var(--spacing-xs)); min-width: 0;
    border-radius: 999px; background: rgba(255, 255, 255, .08); border: 1px solid var(--edge); overflow: hidden;
  }
  .track i { position: absolute; top: 0; bottom: 0; left: 0; border-radius: 999px; background-image: linear-gradient(90deg, var(--xp), var(--xp-lit)); transition: width .3s; }
  .track b {
    position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
    color: var(--text); text-shadow: 0 1px 2px rgba(0, 0, 0, .95);
  }
  .meta { color: var(--dim); white-space: nowrap; }
</style>
