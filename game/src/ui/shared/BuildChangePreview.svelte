<script lang="ts">
  import { formatBuildValue, type BuildPreview } from '@sim/core/build-preview';

  let { preview, title = 'After equipping', omitNote = '' }: {
    preview: BuildPreview;
    title?: string;
    omitNote?: string;
  } = $props();
  const primary = $derived(preview.changes.slice(0, 6));
  const additional = $derived(preview.changes.slice(6));
  const notes = $derived(preview.notes.filter((note) => note.key !== omitNote));
</script>

<section class="build-preview" aria-label={title}>
  <h4>{title}</h4>
  {#if preview.ok}
    {#if primary.length}
      <table aria-label="Changed character values">
        <thead><tr><th scope="col">Character value</th><th scope="col">Current</th><th scope="col">After</th></tr></thead>
        <tbody>
          {#each primary as change (change.key)}
            <tr><th scope="row">{change.label}</th><td>{formatBuildValue(change, change.current)}</td><td>{formatBuildValue(change, change.after)}</td></tr>
          {/each}
        </tbody>
      </table>
      {#if additional.length}
        <details>
          <summary>{additional.length} more changed value{additional.length === 1 ? '' : 's'}</summary>
          <table aria-label="Additional changed character values">
            <thead><tr><th scope="col">Character value</th><th scope="col">Current</th><th scope="col">After</th></tr></thead>
            <tbody>
              {#each additional as change (change.key)}
                <tr><th scope="row">{change.label}</th><td>{formatBuildValue(change, change.current)}</td><td>{formatBuildValue(change, change.after)}</td></tr>
              {/each}
            </tbody>
          </table>
        </details>
      {/if}
    {:else}<p>No displayed character values change. Skill and Keystone effects can still change combat behavior.</p>{/if}
    {#if notes.length}<ul>{#each notes as note (note.key)}<li>{note.text}</li>{/each}</ul>{/if}
    <p class="snapshot-note">Current buff windows, meal and hunger. Target and conditional combat effects are not forecast.</p>
  {:else}<p class="unavailable">{preview.why}</p>{/if}
</section>

<style>
  .build-preview { display: grid; gap: var(--spacing-xs); min-width: 0; padding-top: var(--spacing-sm); border-top: 1px solid var(--line); font-size: var(--font-xs); line-height: 1.5; }
  h4, p { margin: 0; }
  h4 { color: var(--gold-lit); font-size: var(--font-sm); font-weight: 600; }
  table { width: 100%; border-collapse: collapse; font-size: inherit; }
  th, td { padding: 5px 0; border-bottom: 1px solid color-mix(in srgb, var(--line) 65%, transparent); }
  th { text-align: left; font-weight: 400; }
  thead th { color: var(--dim); font-size: var(--font-xs); }
  td, thead th:not(:first-child) { padding-left: 8px; text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  tbody td:last-child { color: var(--gold-lit); font-weight: 600; }
  summary { padding-block: var(--spacing-xs); color: var(--gold-lit); cursor: pointer; }
  summary:hover { color: var(--text); }
  summary:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
  ul { display: grid; gap: var(--spacing-xs); margin: 0; padding-left: 17px; color: var(--text); }
  .snapshot-note { color: var(--dim); }
  .unavailable { color: var(--alarm); }
</style>
