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
  let activeGroup = $state<KeyGroup>('screen');
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

  <div class="group-tabs" role="tablist" aria-label="Key binding groups">
    {#each groups as g (g)}
      <button role="tab" class="btn btn-quiet" class:toggled={activeGroup === g} aria-selected={activeGroup === g} onclick={() => (activeGroup = g)}>{KEYGROUP_LABEL[g]}</button>
    {/each}
  </div>

  <section class="grp" aria-label={KEYGROUP_LABEL[activeGroup]}>
    <h4>{KEYGROUP_LABEL[activeGroup]}</h4>
    <table class="kb">
      <thead><tr><th>Action</th><th>Where it works</th><th>Key</th><th>Actions</th></tr></thead>
      <tbody>
        {#each KEYBINDS.filter((b) => b.group === activeGroup) as b (b.id)}
          {@const hot = capturing === b.id}
          {@const dup = (clash[binds[b.id]] || []).length > 1}
          <tr class:hot class:dup>
            <td class="act">{b.label}</td>
            <td class="where">{b.where}</td>
            <td>
              <div class="key-value">
                <button class="cap" class:waiting={hot} onclick={() => (capturing = hot ? null : b.id)}
                        aria-label={hot ? `Press a key for ${b.label}` : `Rebind ${b.label} to ${formatKey(binds[b.id])}`}>
                  {#if hot}press a key…{:else}{formatKey(binds[b.id])}{/if}
                </button>
                {#if dup}<span class="warn">twice</span>{/if}
              </div>
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

  <p class="foot"><small>The rail prints each screen's key on its own tab, and a control that has one names
    it in its tooltip — so a binding you never set here is still a binding you can find on screen.</small></p>
</div>

<style>
  .keys { height: 100%; min-height: 0; display: grid; grid-template-rows: auto auto auto minmax(0, 1fr) auto; gap: var(--spacing-sm); }
  .top { display: flex; flex-wrap: wrap; gap: var(--spacing-sm); align-items: center; justify-content: space-between; }
  .top p { margin: 0; color: var(--dim); max-width: clamp(575px, 44.53vw, 1242px); }
  .clash {
    margin: 0; padding: var(--spacing-xs) var(--spacing-sm); border-radius: var(--radius-sm); font-size: var(--font-xs); line-height: 1.5;
    background: color-mix(in srgb, var(--gold) 10%, transparent); border: 1px solid color-mix(in srgb, var(--gold) 40%, transparent); color: var(--gold-lit);
  }
  .clash b { font-family: var(--num); color: var(--gold); }
  .group-tabs { display: flex; flex-wrap: wrap; gap: var(--spacing-sm); }
  .grp { min-height: 0; display: grid; grid-template-rows: auto 1fr; gap: var(--spacing-xs); }
  .key-value { display: flex; align-items: center; gap: var(--spacing-xs); }
  .kb td { border-bottom-color: var(--line); padding-bottom: 0; }
  .kb .act { font-family: var(--ui); color: var(--text); font-size: var(--font-xs); }
  .kb .where { font-family: var(--ui); color: var(--mob); font-size: var(--font-xs); }
  .kb .tail { display: flex; gap: var(--spacing-xs); justify-content: flex-end; align-items: center; }
  .cap {
    min-width: clamp(69px, 5.32vw, 149px); font-family: var(--num); font-size: var(--font-xs); letter-spacing: clamp(0px, 0.05vw, 1px);
    background: var(--inset); border-color: var(--line);
  }
  .cap.waiting { border-color: var(--focus); color: var(--focus); background: color-mix(in srgb, var(--focus) 10%, transparent); }
  tr.hot { background: color-mix(in srgb, var(--focus) 7%, transparent); }
  tr.dup .cap { border-color: var(--hp); }
  .warn { font-size: var(--font-xs); color: var(--alarm); }
  .foot { margin: 0; color: var(--dim); }
</style>
