<script lang="ts">
  import { sm } from '../engine/client';
  import { stoneName } from '../sim/craft';
  import { ownsSkill, usefulSkillDuplicate } from '../sim/skills';
  import type { GameState } from '../sim/types';
  import type { QuestBonus } from '../sim/quest-rewards';
  import { questBonusText } from './quest-rewards';
  let { state, options, name, choice, writer = true, onchoose }: {
    state: GameState; options: QuestBonus[]; name: string; choice?: string; writer?: boolean;
    onchoose?: (choice: string) => void;
  } = $props();
  const choosing = $derived(options.length > 1);
</script>

<fieldset disabled={!writer} class:choosing>
  <legend>{choosing ? 'Choose one reward' : 'Fixed reward'}</legend>
  <div class="options">
    {#each options as option (option.id)}
      <div class="option" class:selected={choosing && choice === option.id}>
        {#if choosing}
          <label><input type="radio" {name} value={option.id} aria-label={`${option.label}: ${questBonusText(option)}`} checked={choice === option.id} onchange={() => onchoose?.(option.id)} /><strong>{option.label}</strong></label>
        {/if}
        <p class="reward">{questBonusText(option)}</p>
        {#if option.skill}
          <small class="text-dim">{!ownsSkill(state.skills, option.skill) ? 'New skill · unlocks ownership' : usefulSkillDuplicate(state.skills, option.skill) ? 'Owned skill · advances its Duplicate Ladder' : 'Already at its useful limit · the fallback pays instead'}</small>
          {#if option.fallback}<small class="text-dim">If no useful copy remains: {option.fallback.count} {stoneName(option.fallback.key)} instead of {sm.byId[option.skill]?.name}.</small>{/if}
        {/if}
      </div>
    {/each}
  </div>
  {#if choosing}<small class="text-dim">Choose at completion · the other reward is given up.</small>{/if}
</fieldset>

<style>
  fieldset { display: grid; gap: var(--spacing-sm); min-width: 0; padding: 0; border: 0; }
  legend { padding: 0; padding-bottom: var(--spacing-sm); color: var(--gold); font-weight: 600; font-size: var(--font-sm); }
  .options { display: flex; flex-wrap: wrap; gap: var(--spacing-sm); }
  .option { display: grid; align-content: start; gap: var(--spacing-xs); min-width: 0; flex: 1 1 12rem; }
  .choosing .option { padding: var(--spacing-md); border: 1px solid var(--edge); background: var(--inset); border-radius: var(--radius-card); }
  .choosing .selected { border-color: var(--gold); background: var(--surface-selected); }
  label { display: flex; align-items: start; gap: var(--spacing-sm); cursor: pointer; }
  label input { flex: none; accent-color: var(--gold); }
  .reward { margin: 0; overflow-wrap: anywhere; line-height: 1.5; }
  small { display: block; font-size: var(--font-xs); line-height: 1.5; }
</style>
