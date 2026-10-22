<script lang="ts">
  let {
    text,
    tone = 'dim',
  }: {
    text: string;
    /** The muted voice the caller's list uses: dim (parent size), note (xs), dense (0.75rem), xs. */
    tone?: 'dim' | 'note' | 'dense' | 'xs';
  } = $props();
</script>

<p class={`empty-note ${tone === 'dim' ? 'text-dim' : tone === 'note' ? 'text-note' : tone}`}>{text}</p>

<style>
  .empty-note { margin: 0; }
  .dense { color: var(--dim); font-size: 0.75rem; }
  .xs { color: var(--dim); font-size: var(--font-xs); }
</style>
