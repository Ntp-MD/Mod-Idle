<script lang="ts">
  import chevronDown from '../../icon/ui/chevron-down.png';

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
  <span class="icon-mask disclosure-chevron" class:expanded class:sideways={direction === 'right'} style={`--glyph:url(${chevronDown})`} aria-hidden="true"></span>
</button>

<style>
  .disclosure-toggle { display: flex; align-items: center; justify-content: space-between; gap: var(--spacing-sm); width: 100%; text-align: left; pointer-events: auto; }
  strong { font-size: var(--font-sm); }
  .disclosure-chevron.expanded { transform: rotate(180deg); }
  .disclosure-chevron.sideways { transform: rotate(90deg); }
  .disclosure-chevron.sideways.expanded { transform: rotate(-90deg); }
</style>
