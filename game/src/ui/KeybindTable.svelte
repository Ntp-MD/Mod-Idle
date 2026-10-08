<script lang="ts">
  /**
   * The keyboard settings.
   *
   * A binding is recorded by pressing the key, not by typing a name: the table stores the same canonical
   * token the dispatcher matches against, so what the screen shows and what fires cannot drift apart. Two
   * actions on one key is reported on both rows rather than resolved quietly, and an action the client
   * cannot honour right now — a settlement screen while the character is in the field — says so in its own
   * row instead of doing nothing.
   */
  import { KEYBINDS, KEYGROUP_LABEL, DEFAULT_BINDS, formatKey, isModifierKey, tokenOf, conflicts, type KeyGroup } from './keybinds';

  let { binds, onset, onreset, onclear }: {
    binds: Record<string, string>;
    onset: (id: string, token: string) => void;
    onreset: () => void;
    onclear: (id: string) => void;
  } = $props();

  let capturing = $state<string | null>(null);
  const clash = $derived(conflicts(binds));
  const groups = $derived(Object.keys(KEYGROUP_LABEL) as KeyGroup[]);

  function record(ev: KeyboardEvent) {
    if (!capturing) return;
    ev.preventDefault();
    ev.stopImmediatePropagation();
    if (ev.key === 'Escape') { capturing = null; return; }
    if (isModifierKey(ev)) return;
    onset(capturing, tokenOf(ev));
    capturing = null;
  }
  const offDefault = (id: string) => binds[id] !== DEFAULT_BINDS[id];
</script>

<svelte:window onkeydown={record} />

<div class="keys">
  <div class="top">
    <p><small>Press a key to rebind it, Esc to back out of a row without changing it. The map is a client
      setting, shared by all three save slots, and it never enters a save file.</small></p>
    <button onclick={onreset}>Restore every default</button>
  </div>

  {#if Object.keys(clash).length}
    <p class="clash">
      {Object.keys(clash).length} key{Object.keys(clash).length === 1 ? '' : 's'} bound twice:
      {#each Object.entries(clash) as [token, ids]}
        <b>{formatKey(token)}</b> on {ids.map((i) => KEYBINDS.find((b) => b.id === i)?.label || i).join(' and ')} ·{' '}
      {/each}
      the first row in the list below wins, so give one of them another key.
    </p>
  {/if}

  {#each groups as g (g)}
    <section class="grp">
      <h4>{KEYGROUP_LABEL[g]}</h4>
      <table class="kb">
        <thead><tr><th>Action</th><th>Where it works</th><th>Key</th><th></th></tr></thead>
        <tbody>
          {#each KEYBINDS.filter((b) => b.group === g) as b (b.id)}
            {@const hot = capturing === b.id}
            {@const dup = (clash[binds[b.id]] || []).length > 1}
            <tr class:hot class:dup>
              <td class="act">{b.label}</td>
              <td class="where">{b.where}</td>
              <td>
                <button class="cap" class:waiting={hot} onclick={() => (capturing = hot ? null : b.id)}
                        aria-label={hot ? `Press a key for ${b.label}` : `Rebind ${b.label} to ${formatKey(binds[b.id])}`}>
                  {#if hot}press a key…{:else}{formatKey(binds[b.id])}{/if}
                </button>
                {#if dup}<span class="warn">twice</span>{/if}
              </td>
              <td class="tail">
                {#if offDefault(b.id)}
                  <button class="mini" onclick={() => onset(b.id, DEFAULT_BINDS[b.id])}>default</button>
                  <button class="mini" onclick={() => onclear(b.id)}>clear</button>
                {:else}
                  <span class="dim">as shipped</span>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </section>
  {/each}

  <p class="foot"><small>The rail prints each screen's key on its own tab, and a control that has one names
    it in its tooltip — so a binding you never set here is still a binding you can find on screen.</small></p>
</div>

<style>
  .keys { display: grid; gap: .8rem; }
  .top { display: flex; flex-wrap: wrap; gap: .6rem; align-items: center; justify-content: space-between; }
  .top p { margin: 0; color: var(--dim); max-width: 46rem; }
  .clash {
    margin: 0; padding: .45rem .65rem; border-radius: 10px; font-size: .76rem; line-height: 1.5;
    background: rgba(232, 193, 105, .1); border: 1px solid rgba(232, 193, 105, .4); color: #f0dcae;
  }
  .clash b { font-family: var(--num); color: var(--gold); }
  .grp { display: grid; gap: .25rem; }
  .grp h4 { margin: .3rem 0 0; }
  .kb td { border-bottom-color: var(--line); }
  .kb .act { font-family: var(--ui); color: var(--text); font-size: .8rem; }
  .kb .where { font-family: var(--ui); color: var(--mob); font-size: .7rem; }
  .kb .tail { display: flex; gap: .25rem; justify-content: flex-end; align-items: center; }
  .cap {
    min-width: 5.5rem; font-family: var(--num); font-size: .76rem; letter-spacing: .04em;
    background: #12151b; border-color: var(--line);
  }
  .cap.waiting { border-color: var(--focus); color: var(--focus); background: rgba(127, 212, 255, .1); }
  tr.hot { background: rgba(127, 212, 255, .07); }
  tr.dup .cap { border-color: var(--hp); }
  .warn { margin-left: .4rem; font-size: .66rem; color: #e8a093; }
  .mini { padding: .08rem .4rem; font-size: .66rem; }
  .foot { margin: 0; color: var(--dim); }
</style>
