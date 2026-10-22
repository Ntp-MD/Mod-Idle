<script lang="ts">
  import { ED, fieldwork } from '../engine/client';
  import { forge, canForge } from '../sim/forge';
  import { fieldSkillLevel } from '../sim/fieldwork';
  import { materialSources, sourceLine } from '../sim/material-sources';
  import type { ForgeKind } from '../../../engine/forge.ts';
  import type { GameState } from '../sim/types';
  import EmptyNote from './EmptyNote.svelte';

  let { game, writer, note = '', onforge }: {
    game: GameState;
    writer: boolean;
    note?: string;
    onforge: (kind: ForgeKind, id: string, materialId: string) => boolean;
  } = $props();

  let kind = $state<ForgeKind>('armour');
  let patternId = $state('helmet');
  let family = $state('metal');
  let materialId = $state('');

  const smithing = $derived(fieldSkillLevel(game, 'smithing'));
  const patterns = $derived(kind === 'armour'
    ? Object.keys(ED.forge.armour).map((id) => forge.patternOf('armour', id)!).filter(Boolean)
    : Object.keys(ED.forge.weapons).map((id) => forge.patternOf('weapon', id)!).filter(Boolean));
  const pattern = $derived(patterns.find((row) => row.id === patternId) || patterns[0]);
  const families = $derived(pattern ? forge.familiesFor(pattern.kind, pattern.id) : []);
  const currentFamily = $derived(families.includes(family) ? family : families[0] || '');
  const materials = $derived(currentFamily ? forge.materialsFor(currentFamily) : []);
  const material = $derived.by(() => {
    if (!pattern) return null;
    const chosen = materials.find((row) => row.id === materialId);
    if (chosen) return chosen;
    return materials.find((row) => canForge(game, pattern.kind, pattern.id, row.id).ok)
      || materials[materials.length - 1]
      || null;
  });
  const resolved = $derived(pattern && material
    ? forge.resolve(pattern.kind, pattern.id, material.id, game.player.level, smithing)
    : null);
  const verdict = $derived(pattern && material
    ? canForge(game, pattern.kind, pattern.id, material.id)
    : { ok: false, why: 'choose a material' });
  const sources = $derived(material ? materialSources(material.id) : []);

  const materialName = (id: string) => fieldwork.materialById[id]?.name || id;
  const owned = (id: string) => game.fieldwork.materials[id] || 0;
  const bandOf = (grade: number) => ED.item_level.spans?.[grade - 1]?.band || '—';
  const missing = $derived(pattern && material ? Math.max(0, pattern.count - owned(material.id)) : 0);

  function pickKind(next: ForgeKind) {
    kind = next;
    patternId = '';
    materialId = '';
  }
</script>

<section class="forge">
  <header class="head">
    <div>
      <h3>Forge</h3>
      <p>Shape gathered materials into a new weapon or armour piece. The material grade sets the item band; the piece rolls like a drop.</p>
    </div>
    <div class="levels">
      <span>Smithing Lv <b>{smithing}</b></span>
      <span>Character Lv <b>{game.player.level}</b></span>
    </div>
  </header>

  {#if note}<p class="note" role="status">{note}</p>{/if}

  <nav class="tabs" aria-label="Forge pattern kind">
    <button class:selected={kind === 'armour'} onclick={() => pickKind('armour')}>Armour</button>
    <button class:selected={kind === 'weapon'} onclick={() => pickKind('weapon')}>Weapons</button>
  </nav>

  <div class="layout">
    <section class="patterns scroll-pane" aria-label="Forge patterns">
      {#each patterns as row (row.id)}
        <button class:selected={pattern?.id === row.id} onclick={() => { patternId = row.id; materialId = ''; }}>
          <b>{row.name}</b>
          <small>{row.count} material{row.count === 1 ? '' : 's'}</small>
        </button>
      {/each}
    </section>

    <section class="detail" aria-label="Selected pattern">
      {#if pattern}
        <header class="detail-head">
          <h4>{pattern.name}</h4>
          <span>{pattern.count} unit{pattern.count === 1 ? '' : 's'} of one material</span>
        </header>

        {#if families.length > 1}
          <div class="families" role="group" aria-label="Material family">
            {#each families as id (id)}
              <button class:selected={currentFamily === id} onclick={() => { family = id; materialId = ''; }}>
                {ED.forge.families[id]?.name || id}
              </button>
            {/each}
          </div>
        {/if}

        <div class="materials scroll-pane">
          {#each materials as row (row.id)}
            <button class:selected={material?.id === row.id} class:short={owned(row.id) < pattern.count}
              title={sourceLine(row.id) || undefined}
              onclick={() => materialId = row.id}>
              <span><b>{materialName(row.id)}</b><small>{bandOf(row.grade)} grade</small></span>
              <span class="count">{owned(row.id)} / {pattern.count}</span>
            </button>
          {:else}
            <EmptyNote text="No materials of this family yet." tone="dense" />
          {/each}
        </div>

        {#if pattern && material && resolved}
          <div class="plan" role="status">
            <p class:ready={missing === 0}>{missing === 0
              ? 'Materials ready'
              : `Missing ${missing} ${materialName(material.id)}`}</p>
            {#if sources.length}
              <details class="sources">
                <summary>Where to farm</summary>
                <ul>
                  {#each sources as source (`${source.kind}:${source.label}:${source.detail}`)}
                    <li><b>{source.label}</b> <span>{source.detail}</span></li>
                  {/each}
                </ul>
              </details>
            {/if}
          </div>
        {/if}

        {#if material && resolved && resolved.ok}
          <div class="preview">
            <p class="output"><b>{resolved.frame.name}</b> <span>{resolved.slot}</span></p>
            <dl>
              <div><dt>Band</dt><dd>{resolved.band}</dd></div>
              <div><dt>Item level</dt><dd>{resolved.ilvl}</dd></div>
              <div><dt>Cost</dt><dd>{materialName(material.id)} ×{resolved.count}</dd></div>
              <div><dt>Smithing XP</dt><dd>+{resolved.xp}</dd></div>
            </dl>
            <p class="lines">Line 1 + Bound pair + 2–5 Unbound lines, rolled at this level.</p>
          </div>
        {/if}

        {#if !verdict.ok && material}<p class="why">{verdict.why}</p>{/if}
        <button class="btn-gold forge-btn" disabled={!writer || !verdict.ok}
          onclick={() => material && onforge(pattern.kind, pattern.id, material.id)}>
          {writer ? 'Forge' : 'Read-only'}
        </button>
      {/if}
    </section>
  </div>
</section>

<style>
  .forge { display: flex; flex-direction: column; gap: 10px; min-height: 0; }
  .head { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; }
  .head > div { display: flex; flex-direction: column; gap: 3px; }
  .head h3 { margin: 0; font-size: 1rem; }
  .head p { margin: 0; color: var(--dim); font-size: 0.78rem; max-width: 62ch; }
  .levels { display: flex; gap: 10px; color: var(--dim); font-size: 0.75rem; white-space: nowrap; }
  .levels b { color: var(--text); }
  .note { margin: 0; padding: 6px 8px; border: 1px solid var(--line); background: var(--surface-selected); font-size: 0.78rem; }
  .tabs { display: flex; gap: 4px; }
  .tabs button, .families button, .patterns button, .materials button {
    border: 1px solid var(--line); background: var(--panel); color: var(--text);
    border-radius: 4px; cursor: pointer; text-align: left;
  }
  .tabs button { padding: 5px 12px; font-size: 0.78rem; }
  .tabs button.selected, .families button.selected, .patterns button.selected, .materials button.selected {
    border-color: var(--gold); background: var(--surface-selected);
  }
  .layout { display: grid; grid-template-columns: minmax(0, 0.85fr) minmax(0, 1.15fr); gap: 12px; min-height: 0; }
  .patterns { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4px; align-content: start; max-height: 340px; }
  .patterns button { padding: 6px 8px; display: flex; flex-direction: column; gap: 2px; }
  .patterns b { font-size: 0.8rem; }
  .patterns small { color: var(--dim); font-size: 0.68rem; }
  .detail { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
  .detail-head { display: flex; justify-content: space-between; gap: 10px; align-items: baseline; }
  .detail-head h4 { margin: 0; font-size: 0.9rem; }
  .detail-head span { color: var(--dim); font-size: 0.7rem; }
  .families { display: flex; flex-wrap: wrap; gap: 4px; }
  .families button { padding: 4px 8px; font-size: 0.72rem; }
  .materials { display: flex; flex-direction: column; gap: 3px; max-height: 300px; }
  .materials button { padding: 5px 8px; display: flex; justify-content: space-between; gap: 10px; align-items: center; }
  .materials b { font-size: 0.78rem; }
  .materials small { display: block; color: var(--dim); font-size: 0.68rem; }
  .materials .count { color: var(--dim); font-variant-numeric: tabular-nums; font-size: 0.75rem; }
  .materials button.short .count { color: var(--hp); }
  .plan { display: flex; flex-direction: column; gap: 2px; }
  .plan > p { margin: 0; color: var(--hp); font-size: 0.74rem; }
  .plan > p.ready { color: var(--good); }
  .sources { color: var(--dim); font-size: 0.7rem; }
  .sources summary { color: var(--gold); cursor: pointer; }
  .sources ul { display: grid; gap: 2px; padding: 3px 0 0 14px; margin: 0; }
  .sources li { line-height: 1.35; }
  .sources b { color: var(--text); }
  .preview { border-top: 1px solid var(--line); padding-top: 7px; display: flex; flex-direction: column; gap: 5px; }
  .output { margin: 0; font-size: 0.85rem; }
  .output span { color: var(--dim); font-size: 0.7rem; text-transform: capitalize; }
  dl { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4px 10px; margin: 0; }
  dl div { display: flex; justify-content: space-between; gap: 8px; font-size: 0.74rem; }
  dt { color: var(--dim); }
  dd { margin: 0; font-variant-numeric: tabular-nums; }
  .lines { margin: 0; color: var(--dim); font-size: 0.7rem; }
  .why { margin: 0; color: var(--hp); font-size: 0.74rem; }
  .forge-btn { align-self: flex-start; padding: 6px 16px; }
  @media (max-width: 720px) {
    .layout { grid-template-columns: minmax(0, 1fr); }
    .patterns { grid-template-columns: repeat(3, minmax(0, 1fr)); max-height: 180px; }
  }
</style>
