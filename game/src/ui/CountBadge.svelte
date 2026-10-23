<script lang="ts">
  let {
    value,
    tone = '',
    tag = 'span',
    title = undefined,
    placement = 'inline',
    underlay = false,
    spaced = false,
    class: extra = '',
  }: {
    value: string | number;
    /** Extra tone classes on the shared count badge (`count`, `xp`, `plus`, `tab-count`). */
    tone?: string;
    tag?: 'span' | 'b';
    title?: string;
    /** Corner placement when the badge sits on a slot or medallion. */
    placement?: 'inline' | 'bottom-right' | 'bottom-left' | 'top-right';
    /** Keep the badge under the slot art when the caller's stacking order needs it. */
    underlay?: boolean;
    /** Add inline padding for a badge parked beside a tab label. */
    spaced?: boolean;
    class?: string;
  } = $props();
</script>

<svelte:element
  this={tag}
  class={`badge badge-count ${tone} ${placement === 'inline' ? '' : placement} ${underlay ? 'underlay' : ''} ${spaced ? 'spaced' : ''} ${extra}`.trim()}
  {title}
>{value}</svelte:element>

<style>
  .bottom-right { position: absolute; right: var(--spacing-xs); bottom: var(--spacing-xs); line-height: 1; }
  .bottom-left { position: absolute; left: var(--spacing-xs); bottom: var(--spacing-xs); line-height: 1; }
  .top-right {
    position: absolute; top: calc(-1 * var(--spacing-2xs)); right: calc(-1 * var(--spacing-2xs));
    display: grid; place-items: center;
    min-width: calc(var(--font-xs) + var(--spacing-2xs));
    height: calc(var(--font-xs) + var(--spacing-2xs));
    padding-inline: var(--spacing-2xs);
    line-height: 1;
  }
  .underlay { z-index: var(--z-underlay); }
  .spaced { padding-inline: var(--spacing-xs); }
</style>
