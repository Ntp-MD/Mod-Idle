<script lang="ts">
  import type { CombatFxPreview } from '../combat-fx-preview';

  type SkillOption = { id: string; name?: string; type?: string };

  let {
    animate, preview, skillId, skills, fireName, lightningName, healName, areaName,
    onAnimate, onPreview, onSkill, onReplay,
  }: {
    animate: boolean;
    preview: CombatFxPreview;
    skillId: string;
    skills: readonly SkillOption[];
    fireName?: string;
    lightningName?: string;
    healName?: string;
    areaName?: string;
    onAnimate: (checked: boolean) => void;
    onPreview: (value: CombatFxPreview) => void;
    onSkill: (value: string) => void;
    onReplay: () => void;
  } = $props();
</script>

<div class="combat-fx-preview-controls">
  <label><input type="checkbox" checked={animate} onchange={(event) => {
    onAnimate(event.currentTarget.checked);
  }} /> Animate combat effects</label>
  <label>Combat effect preview <select aria-label="Combat effect preview" value={preview} onchange={(event) => {
    onPreview(event.currentTarget.value as CombatFxPreview);
  }}>
    <option value="swing">Weapon swing</option>
    <option value="critical">Critical hit</option>
    <option value="fire">{fireName || 'Fire skill'}</option>
    <option value="lightning">{lightningName || 'Lightning skill'}</option>
    <option value="heal">{healName || 'Heal skill'}</option>
    <option value="block">Block</option>
    <option value="lethal">Killing blow</option>
    <option value="rapid">Rapid sequence</option>
    <option value="aoe">{areaName || 'Area skill'} · 3 targets</option>
    <option value="exchange">Simultaneous exchange</option>
    <option value="miss">Missed skill</option>
    <option value="sizes">Small · Large · Boss</option>
    <option value="boss">Boss skill</option>
    <option value="skill">Chosen skill · all roster</option>
  </select></label>
  <label>Skill <select aria-label="Skill effect" value={skillId} onchange={(event) => {
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
  <button onclick={onReplay}>Replay combat effect</button>
  <span class="text-note">Sample effects only · game progress stays unchanged · replay restores the encounter</span>
</div>

<style>
  .combat-fx-preview-controls { display: flex; align-items: center; flex-wrap: wrap; gap: var(--spacing-md); padding: var(--spacing-xs) var(--screen-pad); border-bottom: 1px solid var(--line); background: var(--inset); }
  .combat-fx-preview-controls label { display: inline-flex; align-items: center; gap: var(--spacing-xs); }
</style>
