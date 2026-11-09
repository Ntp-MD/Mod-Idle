<script lang="ts">
  import Panel from '../hud/Panel.svelte';
  import Tabs from '../shared/Tabs.svelte';
  import { TEMP_DISABLE_SLOT_SAVES, type SlotName } from '../../state/save';
  import { SAVE_CFG } from '@sim/core/snapshot';
  import type { ClientSettings } from '../../state/save';

  let {
    saveTab = $bindable(), showcaseMode, startupPending, accountWriterState, accountWriterMessage,
    takeoverSlot = $bindable(), saveSlots, persistenceError, attachedSlot, saveNote, snaps, snapSlot = $bindable(), snapNote,
    modalGridArea, settings, canWriteAccount,
    onLoadSnaps, onTakeOverAndLoad, onCancelTakeover, onDownload, onStartNewCharacter, onDoSave, onLoadFromSave,
    onImportFromSave, onRestoreFromSave, onSetSetting, onclose,
  }: {
    saveTab: 'slots' | 'backups' | 'settings';
    showcaseMode: boolean;
    startupPending: boolean;
    accountWriterState: 'owner' | 'readonly' | 'waiting' | 'checking' | 'unsupported';
    accountWriterMessage: string;
    takeoverSlot: SlotName;
    saveSlots: readonly SlotName[];
    persistenceError: string | null;
    attachedSlot: SlotName | null;
    saveNote: string;
    snaps: any[];
    snapSlot: SlotName;
    snapNote: string;
    modalGridArea: string;
    settings: ClientSettings;
    canWriteAccount: boolean;
    onLoadSnaps: () => void;
    onTakeOverAndLoad: () => void;
    onCancelTakeover: () => void;
    onDownload: () => void;
    onStartNewCharacter: () => void;
    onDoSave: (slot: SlotName) => void;
    onLoadFromSave: (slot: SlotName) => void;
    onImportFromSave: (e: Event) => void;
    onRestoreFromSave: (i: number) => void;
    onSetSetting: (key: keyof ClientSettings, value: any) => void;
    onclose: () => void;
  } = $props();
</script>

<Panel title="Save"
  subtitle="Local saves, backups and shared preferences"
  width="compact" showcase={showcaseMode} gridArea={modalGridArea} onclose={onclose}>
  <!-- The Save body owns the panel's scroll; focus makes wheel and arrow/Page keys reach it. -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex (the scroll region needs keyboard focus) -->
  <div class="save-panel scroll-pane" role="region" aria-label="Save content" tabindex="0">
  <Tabs label="Save sections" active={saveTab} onpick={(id) => { saveTab = id as typeof saveTab; if (id === 'backups') onLoadSnaps(); }}
        tabs={[{ id: 'slots', label: 'Slots' }, { id: 'backups', label: 'Backups' }, { id: 'settings', label: 'Settings' }]} />
  {#if showcaseMode}<p class="showcase-note">Save, load, backup, import, and export are disabled here. This page never reads or writes a player save.</p>{/if}
  {#if !showcaseMode && startupPending}<p class="showcase-note" role="status">Load a character, or start a new one. Existing slots are kept.</p>{/if}
  {#if !showcaseMode}
    <div class="account-writer card-tile" class:owner={accountWriterState === 'owner'} role="status" aria-live="polite">
      <p>{accountWriterMessage}</p>
      {#if accountWriterState === 'readonly'}
        <label>Reload after takeover
          <select bind:value={takeoverSlot}>{#each saveSlots as slot}<option value={slot}>{slot}</option>{/each}</select>
        </label>
        <button type="button" onclick={onTakeOverAndLoad}>Take over and reload</button>
      {:else if accountWriterState === 'waiting'}
        <button type="button" onclick={onCancelTakeover}>Cancel wait</button>
      {/if}
      {#if accountWriterState !== 'owner'}<button type="button" onclick={onDownload}>Export recovery JSON</button>{/if}
    </div>
  {/if}
  {#if saveTab === 'slots'}
  {#if persistenceError}<div role="alert"><p class="text-alarm">{persistenceError}</p><button onclick={onDownload}>Export recovery JSON</button></div>{/if}
  <p>Three local character slots · offline progress has no time limit. Autosave starts after you save or load a slot; a new or imported character needs its own slot choice.</p>
  <div class="save-actions">
  <button disabled={showcaseMode || !canWriteAccount} onclick={onStartNewCharacter}>Start new character</button>
  {#each saveSlots as slot}
    <button disabled={showcaseMode || startupPending || !canWriteAccount || TEMP_DISABLE_SLOT_SAVES} onclick={() => onDoSave(slot)}>Save {slot}</button>
    <button disabled={showcaseMode || accountWriterState === 'checking' || accountWriterState === 'waiting' || accountWriterState === 'unsupported' || TEMP_DISABLE_SLOT_SAVES} onclick={() => void onLoadFromSave(slot)}>Load {slot}</button>
  {/each}
  <button disabled={showcaseMode} onclick={onDownload}>Export JSON</button>
  <label>Import <input type="file" accept="application/json" disabled={showcaseMode || !canWriteAccount || TEMP_DISABLE_SLOT_SAVES} onchange={onImportFromSave} /></label>
  </div>
  {#if TEMP_DISABLE_SLOT_SAVES}<p class="text-note">Slot saves are off until the game is finished.</p>
  {:else if attachedSlot}<p class="text-note">Autosave is on for {attachedSlot}.</p>{:else}<p class="text-note">Not saved yet. Choose a slot to keep this character.</p>{/if}
  {#if saveNote}<p class="save-note-inline" role="status">{saveNote}</p>{/if}
  {:else if saveTab === 'backups'}
  <h2>Backups · {SAVE_CFG.snapshot_slots} walking snapshots</h2>
  <p><small>Owed on a level up, an Ascend or Refine, and every {SAVE_CFG.snapshot_interval_min} min of play. A restore takes the character back whole.</small></p>
  <label>Which slot <select bind:value={snapSlot} disabled={showcaseMode} onchange={onLoadSnaps}>{#each saveSlots as s}<option value={s}>{s}</option>{/each}</select></label>
  <button disabled={showcaseMode} onclick={onLoadSnaps}>Show backups</button>
  <table>
    <thead><tr><th>#</th><th>Taken because</th><th>Then</th><th></th></tr></thead>
    <tbody>
      {#each snaps as shot, i}
        <tr>
          <td>{i + 1}</td>
          <td>{shot.reason}</td>
          <td>{Math.round(shot.clockSec / 60)} min of play · level {shot.state.player.level}</td>
          <td><button disabled={showcaseMode || !canWriteAccount} onclick={() => onRestoreFromSave(i)}>Rewind to this</button></td>
        </tr>
      {:else}
        <tr><td colspan="4">Nothing stored yet.</td></tr>
      {/each}
    </tbody>
  </table>
  <p>{snapNote}</p>
  {:else}
  <h2>Settings</h2>
  <p><small>Shared by all three slots · potions and auto-farm on Farm · filters on Bags · presets on Skills.</small></p>
  <label>Number format
    <select value={settings.numberFormat} onchange={(e) => onSetSetting('numberFormat', (e.target as HTMLSelectElement).value as 'plain' | 'short')}>
      <option value="plain">plain — 12,345</option>
      <option value="short">short — 12.3k</option>
    </select>
  </label>
  <label><input type="checkbox" checked={settings.offlineReport} onchange={(e) => onSetSetting('offlineReport', (e.target as HTMLInputElement).checked)} /> Show the welcome-back report after an away period</label>
  <label>Combat effects
    <select value={settings.combatEffects || 'auto'} onchange={(e) => onSetSetting('combatEffects', (e.target as HTMLSelectElement).value as NonNullable<ClientSettings['combatEffects']>)}>
      <option value="auto">Automatic — adapt to playback speed</option>
      <option value="full">Full</option>
      <option value="reduced">Reduced</option>
      <option value="minimal">Minimal</option>
    </select>
  </label>
  <label><input type="checkbox" checked={settings.holdPosition === true} onchange={(e) => onSetSetting('holdPosition', (e.target as HTMLInputElement).checked)} /> Hold position — no automatic approach; manual moves and avoidance still run</label>
  <label>Auto target
    <select value={settings.targetPriority ?? 'nearest'} onchange={(e) => onSetSetting('targetPriority', (e.target as HTMLSelectElement).value as NonNullable<ClientSettings['targetPriority']>)}>
      <option value="nearest">Nearest</option>
      <option value="lowest-hp">Lowest HP</option>
      <option value="highest-hp">Highest HP</option>
    </select>
  </label>
  <p class="text-note">Explicit effect levels stay the same at every playback speed. Cast labels and status details remain available; your system's reduced-motion preference is respected.</p>
  {/if}
  </div>
</Panel>

<style>
  .save-panel { height: 100%; min-height: 0; display: flex; flex-direction: column; align-content: start; gap: var(--spacing-sm); }
  .save-panel p { margin: 0; }
  .save-panel table { font-size: var(--font-xs); }
  .save-note-inline { color: var(--good); font-size: var(--font-xs); }
  .account-writer { display: flex; flex-wrap: wrap; align-items: center; gap: var(--spacing-sm); padding: var(--spacing-xs); }
  .account-writer.owner { border-color: color-mix(in srgb, var(--good) 48%, var(--line)); }
  .account-writer p { flex: 1 1 clamp(150px, 11.62vw, 324px); min-width: 0; color: var(--dim); font-size: var(--font-xs); }
  .account-writer.owner p { color: var(--good-lit); }
  .account-writer label { display: inline-flex; align-items: center; gap: var(--spacing-xs); color: var(--dim); font-size: var(--font-xs); }
  .account-writer select, .account-writer button { font-size: var(--font-xs); border-radius: var(--radius-card); }
  .save-actions { display: flex; flex-wrap: wrap; gap: var(--spacing-sm); align-items: center; }
  .save-panel h2 { margin: 0; font-size: var(--font-md); }
</style>
