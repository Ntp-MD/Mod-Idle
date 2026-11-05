<script lang="ts">
  import { loadPanel } from '../../app/panel-loader';
  let { id, children }: { id: string; children: any } = $props();
  let promise = $derived(loadPanel(id));
</script>
{#await promise}
  <div role="status" aria-label="Loading {id}">Loading…</div>
{:then mod}
  {@render children?.(mod)}
{:catch error}
  <div role="alert">Failed to load {id}: {String((error as Error)?.message ?? error)} <button onclick={() => promise = loadPanel(id)}>Retry</button></div>
{/await}
