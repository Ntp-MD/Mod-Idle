<script lang="ts">
  import App from './App.svelte';
</script>

<svelte:boundary onerror={(error) => console.error('ModWorld: UI failed', error)}>
  <App />
  {#snippet failed()}
    <section class="app-recovery" role="alert" aria-labelledby="runtime-failure-title">
      <h1 id="runtime-failure-title">The game could not continue</h1>
      <p>A display error interrupted the game. Reload to try again.</p>
      <button type="button" onclick={() => window.location.reload()}>Reload game</button>
    </section>
  {/snippet}
</svelte:boundary>
