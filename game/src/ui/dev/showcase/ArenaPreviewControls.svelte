<script lang="ts">
  type SkillOption = { id: string; name?: string; type?: string };
  type VariantGroup = { speciesId: string; speciesName: string; variants: { name: string; variantId: string }[] };

  let {
    livingCount, focusId, aimSkill, aimName, rayChannel,
    worldScale = $bindable(1), spriteMode, species, variantKey,
    mobSpecies, additionalSpecies, variantGroups, skills, skillId,
    versionId, versions, vfxMode,
    minZoom, maxZoom, zoomStep, speciesName,
    onFocus, onClearFocus, onToggleAim, onCastAtFocus,
    onSpriteMode, onSpecies, onVariant, onSkill, onVersion, onReplay,
  }: {
    livingCount: number;
    focusId: string | null;
    aimSkill: string | null;
    aimName: string;
    rayChannel: boolean;
    worldScale?: number;
    spriteMode: boolean;
    species: string;
    variantKey: string | null;
    mobSpecies: readonly string[];
    additionalSpecies: readonly VariantGroup[];
    variantGroups: readonly VariantGroup[];
    skills: readonly SkillOption[];
    skillId: string;
    versionId: string;
    versions: readonly { id: string; label: string }[];
    vfxMode: 'auto' | 'base';
    minZoom: number;
    maxZoom: number;
    zoomStep: number;
    speciesName: (id: string) => string;
    onFocus: () => void;
    onClearFocus: () => void;
    onToggleAim: () => void;
    onCastAtFocus: (holdToken?: string) => void;
    onSpriteMode: (value: string) => void;
    onSpecies: (value: string) => void;
    onVariant: (value: string) => void;
    onSkill: (value: string) => void;
    onVersion: (value: string) => void;
    onReplay: () => void;
  } = $props();
</script>

<div class="arena-preview-controls">
  <strong>Forest clearing</strong>
  <div class="arena-command-controls" role="group" aria-label="Local combat commands">
    <button class="btn btn-quiet" type="button" onclick={() => onFocus()} disabled={!livingCount}>
      {focusId ? 'Next focus' : 'Focus enemy'}
    </button>
    <button class="btn btn-quiet" type="button" onclick={onClearFocus} disabled={!focusId}>Clear focus</button>
    <button class="btn btn-quiet" type="button" aria-pressed={!!aimSkill} onclick={onToggleAim}>
      {aimSkill ? 'Cancel aim' : `Aim ${aimName || 'skill'}`}
    </button>
    <button class="btn btn-quiet" type="button"
      onpointerdown={(event) => {
        if (!rayChannel) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        onCastAtFocus(`pointer:${event.pointerId}`);
      }}
      onkeydown={(event) => {
        if (!rayChannel || (event.key !== 'Enter' && event.key !== ' ')) return;
        event.preventDefault();
        if (!event.repeat) onCastAtFocus(`key:${event.code}`);
      }} onclick={() => {
        if (!rayChannel) onCastAtFocus();
      }} disabled={!livingCount}>
      Cast at focus
    </button>
  </div>
  <label>World scale <input type="range" aria-label="World scale in the arena"
    min={minZoom} max={maxZoom} step={zoomStep} bind:value={worldScale} />
    <output>{Math.round(worldScale * 100)}%</output></label>
  <label>Mob rendering <select aria-label="Mob rendering mode in the arena" value={spriteMode ? 'sprite' : 'fallback'} onchange={(event) => {
    onSpriteMode(event.currentTarget.value);
  }}>
    <option value="sprite">Sprite animations</option>
    <option value="fallback">Fallback icons</option>
  </select></label>
  {#if spriteMode}
    <label>Species <select value={species} onchange={(event) => {
      onSpecies(event.currentTarget.value);
    }}>
      <optgroup label="ARPG mob animations">
        {#each mobSpecies as speciesId}
          <option value={speciesId}>{speciesName(speciesId)}</option>
        {/each}
      </optgroup>
      {#if additionalSpecies.length}
        <optgroup label="Other variant species">
          {#each additionalSpecies as entry}
            <option value={entry.speciesId}>{entry.speciesName}</option>
          {/each}
        </optgroup>
      {/if}
      <optgroup label="Existing previews">
        <option value="spear-goblin">Spear Goblin reference</option><option value="little-demon">Little Demon reference</option>
        <option value="skeleton-sword">Skeleton (Sword &amp; Shield) reference</option><option value="skeleton-bone">Skeleton (Original Bone) reference</option><option value="crypt-wraith">Crypt Wraith reference</option>
        <option value="shadow-wolf">Shadow Wolf reference</option><option value="eclipse-wisp">Eclipse Wisp reference</option><option value="pixiblop-spider">Pixiblop Spider reference</option><option value="stone-golem">Stone Golem reference</option>
      </optgroup>
    </select></label>
    <label>Named variant <select aria-label="Named variant animation preview" value={variantKey ?? ''} onchange={(event) => {
      onVariant(event.currentTarget.value);
    }}>
      <option value="">Species animation</option>
      {#each variantGroups as group}
        <optgroup label={group.speciesName}>
          {#each group.variants as variant}
            <option value={`${group.speciesId}/${variant.variantId}`}>{variant.name}</option>
          {/each}
        </optgroup>
      {/each}
    </select></label>
  {/if}
  <label>Skill <select aria-label="Skill cast in the arena" value={skillId} onchange={(event) => {
    onSkill(event.currentTarget.value);
  }}>
    {#each ['attack', 'curse', 'heal', 'buff', 'aura'] as kind}
      <optgroup label={kind}>
        {#each skills.filter((skill) => skill.type === kind) as skill}
          <option value={skill.id}>{skill.name ?? skill.id}</option>
        {/each}
      </optgroup>
    {/each}
  </select></label>
  {#if versions.length}
    <label>VFX art <select aria-label="Preview VFX art in the arena" value={vfxMode === 'base' ? 'base' : `version:${versionId}`} onchange={(event) => {
      onVersion(event.currentTarget.value);
    }}>
      <option value="base">Base VFX (no skin)</option>
      {#each versions as version (version.id)}
        <option value={`version:${version.id}`}>{version.label}</option>
      {/each}
      {#if !versions.some((version) => version.id === versionId)}
        <option value={`version:${versionId}`}>Selected</option>
      {/if}
    </select></label>
  {/if}
  <button class="btn btn-quiet" type="button" onclick={onReplay}>Replay encounter</button>
</div>

<style>
  .arena-preview-controls { display: flex; align-items: center; flex-wrap: wrap; gap: var(--spacing-md); padding: var(--spacing-xs) var(--screen-pad); border-bottom: 1px solid var(--line); background: var(--inset); font-size: var(--font-xs); }
  .arena-preview-controls strong { color: var(--gold-lit); }
  .arena-preview-controls label { display: inline-flex; align-items: center; gap: var(--spacing-xs); }
  .arena-command-controls { display: inline-flex; align-items: center; flex-wrap: wrap; gap: var(--spacing-xs); }
  .arena-command-controls button[aria-pressed="true"] { border-color: var(--gold-lit); color: var(--gold-lit); }
</style>
