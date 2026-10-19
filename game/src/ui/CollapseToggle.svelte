<script lang="ts">
  let { label, controls, direction = 'down', expanded = $bindable(true) }: {
    label: string;
    controls: string;
    direction?: 'down' | 'right';
    expanded?: boolean;
  } = $props();
</script>

<button class="disclosure-toggle btn-flat" type="button" aria-expanded={expanded}
        aria-controls={controls} onclick={() => (expanded = !expanded)}>
  <strong>{label}</strong>
  <svg class="icon-chevron" class:expanded class:sideways={direction === 'right'} viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4" /></svg>
</button>

<style>
  .disclosure-toggle { display: flex; align-items: center; justify-content: space-between; gap: var(--spacing-sm); width: 100%; text-align: left; pointer-events: auto; }
  strong { font-size: var(--font-sm); }
  svg { width: var(--icon-label); height: var(--icon-label); flex: none; }
  svg.expanded { transform: rotate(180deg); }
  svg.sideways { transform: rotate(90deg); }
  svg.sideways.expanded { transform: rotate(-90deg); }
</style>
