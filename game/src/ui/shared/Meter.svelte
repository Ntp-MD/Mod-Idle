<script lang="ts">
  import { bar } from './field';

  let {
    value,
    max,
    tone,
    label,
    title = undefined,
    valueText,
    role = 'img',
  }: {
    value: number;
    max: number;
    /** `hp`, `es` or `mana`; the shared track-meter colours read this class. */
    tone: 'hp' | 'es' | 'mana' | 'exp';
    /** The accessible read, including any reservation the caller knows about. */
    label: string;
    title?: string;
    valueText: string;
    role?: string;
  } = $props();
</script>

<span class={`meter track track-meter ${tone}`} {role} aria-label={label} {title}>
  <i style={bar(value, max)}></i><b>{valueText}</b>
</span>

<style>
  .meter {
    display: block;
    position: relative;
    width: 100%;
    height: max(var(--spacing-sm), var(--font-xs));
    overflow: hidden;
  }
  .meter i {
    display: block;
    height: 100%;
    width: 100%;
  }
  .meter b {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    max-width: 100%;
    overflow: hidden;
    white-space: nowrap;
    text-align: center;
    font-size: var(--font-xs);
    line-height: 1;
    font-weight: 600;
    color: var(--text);
    font-variant-numeric: tabular-nums;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.95);
    pointer-events: none;
  }
</style>
