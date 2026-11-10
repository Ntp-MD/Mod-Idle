<script lang="ts">
  import { SHOWCASE_SAMPLE_LABELS, SHOWCASE_SAMPLES } from '../../../app/showcase/samples';

  let { sample, onsample }: { sample: string; onsample: (sample: string) => void } = $props();
</script>

<header class="showcase-banner">
  <div>
    <h1>UI Showcase</h1>
    <p>Live game components · sample state · changes to source UI appear here through Vite HMR</p>
    <label>Gameplay sample <select aria-label="Gameplay sample" value={sample} onchange={(event) => {
      onsample(event.currentTarget.value);
    }}>
      {#each SHOWCASE_SAMPLES as entry}
        <option value={entry}>{SHOWCASE_SAMPLE_LABELS[entry]}</option>
      {/each}
    </select></label>
  </div>
  <a href="/">Return to the game</a>
</header>

<style>
  .showcase-banner {
    display: flex; align-items: center; justify-content: space-between; gap: var(--spacing-md);
    padding: var(--spacing-xs) var(--screen-pad); border-bottom: 1px solid var(--line);
    background: linear-gradient(90deg, var(--panel), var(--bg));
  }
  .showcase-banner > div { display: flex; flex: 1; align-items: center; gap: var(--spacing-md); min-width: 0; }
  .showcase-banner h1 { margin: 0; color: var(--gold); font-size: var(--font-md); }
  .showcase-banner p { flex: 1; min-width: 0; margin: 0; color: var(--dim); font-size: var(--font-xs); }
  .showcase-banner label { flex: none; }
  .showcase-banner a { flex: none; padding: var(--spacing-xs) var(--spacing-sm); border: 1px solid var(--line); border-radius: var(--radius-card); text-decoration: none; }
</style>
