<script lang="ts">
  import { E, eng, sm } from '../../engine/client';
  import { fxByMob as bucketFx, windupOf } from './plate';
  import { fieldLabel } from '../hud/hud';
  import { fxOut } from '../shared/motion';
  import { elementIcon, skillIcon } from '../../icon';
  import { bossMark } from '../../icon';
  import Icon from '../shared/Icon.svelte';
  import Meter from '../shared/Meter.svelte';
  import PlayerVitalCard from './PlayerVitalCard.svelte';
  import SkillCastCue from './SkillCastCue.svelte';
  import CombatSceneEffects from './CombatSceneEffects.svelte';
  import CombatActor from './CombatActor.svelte';
  import CombatEffectBadge from './CombatEffectBadge.svelte';
  import { combatDamagePops, combatEffectLevel, type CombatEffectLevel } from './combat-presentation';
  import { snapshotEnemy, type EnemySnapshot } from '@sim/combat/combat-history';
  import { effectLine } from '@sim/combat/skills';
  import { statusLabel, type MobStatusName } from '@sim/combat/mobStatus';
  import { mobSkillById } from '@sim/combat/mobSkills';
  import type { GameState, Mob, FxEvent } from '@sim/core/types';
  import type { Character } from '@sim/core/player';
  import type { Statuses } from '@sim/combat/combat';

  /** Full-body actors move independently of their fixed names, vitals and status badges. */
  let { s, c, ring, plates, statuses, zone, town, townLive, vitals, reserved, onSheet,
    fmtNum, selfFx, plateMotion, fxOutMs, speed = 1, effectLevel = 'auto', onInspectEnemy }: {
    s: GameState; c: Character; ring: FxEvent[]; plates: Mob[]; statuses: Statuses; zone: any;
    town: any; townLive: boolean; vitals: { hp: number; es: number; mana: number }; reserved: number;
    onSheet: () => void; fmtNum: (n: number) => string; selfFx: FxEvent[];
    plateMotion: number; fxOutMs: number; speed?: number; effectLevel?: CombatEffectLevel;
    onInspectEnemy?: (enemy: EnemySnapshot) => void;
  } = $props();
  const effects = $derived(combatEffectLevel(effectLevel, speed));

  function defenseColour(text: string) {
    const answer = text.toLowerCase();
    if (answer.includes('block')) return 'var(--es-lit)';
    if (answer.includes('evasion')) return 'var(--good-lit)';
    if (answer.includes('dodge')) return 'var(--gold-lit)';
    if (answer.includes('miss')) return 'var(--dim)';
    return 'var(--focus)';
  }

  const statusElement = (name: string) =>
    Object.entries(E.elements.status_of as Record<string, string>).find(([, status]) => status === name)?.[0] || 'physical';

  function mobDebuffMarks(mobId: string) {
    void s.clockSec;
    const marks: { id: string; label: string; icon: string; secs: number | null; stacks: number; detail?: string }[] = [];
    const mobStatuses = s.mobStatus[mobId]?.statuses || {};
    for (const [name, line] of Object.entries(mobStatuses) as [MobStatusName, { stacks: number; secLeft: number }][]) {
      if (line.stacks <= 0 && line.secLeft <= 0) continue;
      marks.push({
        id: `status-${name}`, label: statusLabel(name), icon: elementIcon(statusElement(name)),
        secs: line.secLeft > 0 ? line.secLeft : null, stacks: line.stacks,
      });
    }

    const curses = new Map<string, { label: string; icon: string; secs: number; stacks: number; detail: string }>();
    for (const [key, line] of Object.entries(s.curses[mobId] || {})) {
      if (line.secLeft <= 0) continue;
      const skillId = line.from || key;
      const current = curses.get(skillId);
      curses.set(skillId, {
        label: sm.byId[skillId]?.name || skillId,
        icon: skillIcon(skillId, 'curse'),
        secs: Math.max(current?.secs || 0, line.secLeft),
        stacks: 1,
        detail: effectLine(sm.byId[skillId]) || sm.byId[skillId]?.effect || '',
      });
    }
    for (const [id, curse] of curses) marks.push({ id: `curse-${id}`, ...curse });
    return marks.sort((a, b) => a.id.localeCompare(b.id));
  }

  function mobAuraMarks(mob: Mob) {
    return [...new Set((mob.auraSources || []).map((source) => source.id))].sort().flatMap((id) => {
      const aura = mobSkillById(id);
      if (!aura) return [];
      const detail = Object.entries(aura.effects || {}).map(([stat, value]) =>
        `${stat === 'armour_pct' ? 'Armour' : 'Resistances'} +${value}%`).join(' · ');
      return [{ id, label: aura.name, icon: skillIcon(id, 'aura'), detail }];
    });
  }

  /** Presentation can fade a leaving figure; combat has already removed it from the live group. */
  function plateLife(node: Element, { duration = 0 }: { duration?: number } = {}) {
    return {
      duration,
      css: (t: number, u: number) => `opacity: ${t}; transform: translateY(${(u * 14).toFixed(1)}px)`,
    };
  }

  /** every blow the ring still holds, in its own mob's bucket, newest first as the ring already is */
  const fxByMob = $derived(bucketFx(ring));

  const hereName = $derived(townLive ? (town?.name ?? 'the field') : zone.name);
  const nextSpawnSec = $derived.by(() => {
    const due = (s.field?.slots ?? [])
      .filter((slot) => !slot.mobId && slot.respawnAtSec > 0)
      .map((slot) => slot.respawnAtSec)
      .sort((a, b) => a - b)[0];
    return due == null ? null : Math.max(0, Math.ceil(due - s.clockSec));
  });
</script>

<div class="combat-ground" class:engaged={plates.length > 0} aria-hidden="true"></div>

{#if plates.length}
<div class="plate-row" class:effects-minimal={effects === 'minimal'} class:effects-reduced={effects === 'reduced'}>
{#each plates as m, mi (m.id)}
  {@const mobDebuffs = mobDebuffMarks(m.id)}
  {@const auraMarks = mobAuraMarks(m)}
  {@const windup = windupOf(m)}
  <div
    class="mob"
    data-mob-id={m.id}
    class:front={mi === 0}
    class:elite={m.kind === 'Elite'}
    class:boss={m.kind.startsWith('Boss')}
    in:plateLife={{ duration: effects === 'minimal' ? 0 : plateMotion }}
    out:plateLife={{ duration: effects === 'minimal' ? 0 : plateMotion }}
  >
    <div class="mob-actor-slot"><CombatActor {ring} {c} mob={m} {speed} {effectLevel} /></div>
    <!-- Numbers are keyed independently of actor motion, so an exchange never replays either beat. -->
    <div class="plate-fx" aria-hidden="true">
      {#each combatDamagePops((fxByMob.get(m.id) || []).filter((e) => e.kind === 'hit'), speed, 4, effectLevel) as e (e.id)}
        <span class="fx pop pop-damage" class:critical={e.crit} class:dot={e.via === 'dot'} out:fxOut={{ ms: fxOutMs }} style={`--fx:${e.colour}; --lane:${e.id % 4}`}>{eng.fmt(e.value ?? 0)}{e.crit ? '!' : ''}{#if e.count > 1}<small class="hit-count"> · {e.count} hits</small>{/if}</span>
      {/each}
      {#each (fxByMob.get(m.id) || []).filter((e) => e.kind === 'block').slice(0, 2) as e (e.id)}
        <span class="fx pop pop-word" out:fxOut={{ ms: fxOutMs }} style={`--fx:${defenseColour(e.text)}; --lane:${e.id % 4}`}>{e.text}</span>
      {/each}
    </div>
    {#if m.hp > 0 && s.group.some((live) => live.id === m.id)}<SkillCastCue {ring} mob={m} {speed} {effectLevel} />{/if}
    {#if auraMarks.length}
      <div class="mob-aura-rail" role="list" aria-label={`${fieldLabel(m)} active auras`}>
        {#each auraMarks as mark (mark.id)}
          <div role="listitem"><CombatEffectBadge {...mark} id={`${m.id}-${mark.id}`} permanent align="end" /></div>
        {/each}
      </div>
    {/if}
    {#if mobDebuffs.length}
      <div class="mob-debuff-rail" role="list" aria-label={`${fieldLabel(m)} debuffs`}>
        {#each mobDebuffs as mark (mark.id)}
          <div role="listitem"><CombatEffectBadge {...mark} id={`${m.id}-${mark.id}`} harmful /></div>
        {/each}
      </div>
    {/if}
      <div class="mob-readout card-combat" class:front={mi === 0} class:elite={m.kind === 'Elite'} class:boss={m.kind.startsWith('Boss')}>
        <div class="mob-head">
            <div class="identity">
              <button class="mob-name card-name" class:elite={m.kind === 'Elite'} class:boss={m.kind.startsWith('Boss')} type="button" onclick={() => onInspectEnemy?.(snapshotEnemy(m))} disabled={!onInspectEnemy} aria-label={`Inspect ${fieldLabel(m)}`}>{fieldLabel(m)}{#if m.kind.startsWith('Boss')}<img class="tier-mark" src={bossMark} alt="" aria-hidden="true" />{/if}</button>
              <small class="mob-level">Lv {m.level} · {m.readsAs || m.kind}</small>
            </div>
          {#if m.innate.length}
            <div class="innate-rail">
              {#each m.innate as element}
                <span class="innate-mark" role="img" aria-label={`Innate Element: ${element}`} title={`Innate · ${element}`}>
                  <Icon src={elementIcon(element)} />
                </span>
              {/each}
            </div>
          {/if}
        </div>
        <Meter
          value={m.hp}
          max={m.hpMax}
          tone="hp"
          label={`${fieldLabel(m)} health`}
          valueText={`${Math.max(0, Math.round(m.hp))} / ${Math.round(m.hpMax)}`}
        />
        <span class="mob-windup" role="progressbar" aria-label="Next swing" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(windup * 100)} title="Next swing">
          <i style={`--windup:${windup}`}></i>
        </span>
      </div>
  </div>
{/each}
</div>
{:else}
  {#if s.walk}
    <!-- The walk is a clock, not a journey to watch: the destination already reads in the zone tag and the
         road itself reads on the map, so the field says the one word and counts nothing — no block counter
         and no trail of prints. It mounts only while the field is empty, so a live plate is never covered,
         and it takes no pointer — the ground behind it still pans. -->
    <p class="clear-field"><b>Traveling…</b></p>
  {:else if !s.hunting}
    <!-- ground that fields nothing says so, and says what would change it: a promise that the next
         group walks in is false here, and a player who believes it waits forever -->
    <p class="clear-field">
      <b>No group walks in while the hunt is off.</b>
      <span>Pick a cell on the map, then hunt it.</span>
    </p>
  {:else}
    <p class="clear-field">
      {#if nextSpawnSec != null}<b>Next group in {nextSpawnSec} sec.</b>{:else}<b>All slots are occupied.</b>{/if}
      <span>{hereName} · levels {zone.levels[0]}–{zone.levels[1]}</span>
    </p>
  {/if}
{/if}

<div class="combat-player-slot" class:effects-minimal={effects === 'minimal'} class:effects-reduced={effects === 'reduced'}>
  <SkillCastCue {ring} {speed} {effectLevel} />
  <PlayerVitalCard s={s} {c} {ring} {statuses} {vitals} {reserved} {onSheet} {fxOutMs} {fmtNum} {speed} {effectLevel} />
  <div class="float-side self-side" aria-hidden="true">
    {#each selfFx as e (e.id)}
      <span class="fx fx-{e.kind}" class:pop={e.kind === 'drop'} class:pop-loot={e.kind === 'drop'} out:fxOut={{ ms: fxOutMs }} style="--fx:{e.colour}; --lane:{e.id % 3}">{e.text}</span>
    {/each}
  </div>
</div>

<CombatSceneEffects {ring} {c} {plates} {speed} {effectLevel} />

<style>
  .combat-ground {
    position: absolute; inset: -5% -8%; z-index: 0; pointer-events: none;
    opacity: 0; transition: opacity var(--motion-ui) var(--ease-out);
    background: radial-gradient(ellipse at 50% 48%, rgba(9, 15, 18, .9), rgba(9, 15, 18, .72) 44%, transparent 73%);
    backdrop-filter: blur(2px) saturate(.65);
    mask-image: radial-gradient(ellipse at 50% 48%, black 30%, transparent 72%);
  }
  .combat-ground.engaged { opacity: 1; }
  .clear-field { z-index: var(--z-content); text-align: center; }
  .clear-field b { color: var(--text); font-weight: 600; }
  .combat-player-slot {
    position: absolute; left: 50%; bottom: var(--spacing-sm); z-index: var(--z-content);
    width: min(calc(var(--card-w) * 1.35), 100%); height: 47%;
    transform: translateX(-50%); pointer-events: auto;
  }
  .combat-player-slot .self-side { left: calc(100% + var(--spacing-xs)); bottom: 0; align-items: flex-start; }
  .float-side .pop-loot { padding: var(--spacing-xs); }
  .plate-row {
    position: relative; z-index: var(--z-content); display: flex; flex: 0 0 46%;
    justify-content: center; align-items: stretch; gap: var(--spacing-md); width: 100%; min-height: 0;
  }
  .mob { position: relative; display: grid; grid-template-rows: minmax(0, 1fr) auto; flex: 0 1 calc(var(--card-w) * 1.35); min-width: 0; height: 100%; pointer-events: auto; }
  .mob-actor-slot { position: relative; min-height: 0; }
  .mob-readout {
    position: relative; display: grid; gap: var(--spacing-xs); min-width: 0;
    padding: var(--spacing-xs) var(--spacing-sm) var(--spacing-sm);
  }
  .mob-head { position: relative; min-width: 0; }
  .identity { display: grid; justify-items: center; gap: 2px; min-width: 0; text-align: center; }
  .mob-name { display: flex; align-items: center; justify-content: center; gap: var(--spacing-xs); max-width: 100%; margin: 0; padding: 0; border: 0; background: transparent; color: var(--text); font: inherit; font-size: var(--font-sm); line-height: 1.15; cursor: pointer; }
  .mob-name:hover { color: var(--es-lit); }
  .mob-name:focus-visible { outline: 2px solid var(--focus); outline-offset: 3px; }
  .mob-name .tier-mark { width: var(--icon-label); height: var(--icon-label); flex: none; }
  .mob-level { color: var(--dim); font-size: var(--font-xs); line-height: 1.15; }
  .innate-rail { position: absolute; top: 0; right: 0; display: flex; gap: 2px; }
  .innate-mark { display: grid; place-items: center; width: var(--icon-label); height: var(--icon-label); background: var(--inset); }
  .mob-windup { display: block; height: 2px; overflow: hidden; background: var(--bar); }
  .mob-windup i { display: block; height: 100%; width: 100%; background: var(--gold-lit); transform: scaleX(var(--windup)); transform-origin: left center; transition: transform var(--motion-fast) linear; }
  .mob-aura-rail { position: absolute; top: 24%; right: 0; z-index: var(--z-floater); display: flex; flex-direction: column; gap: var(--spacing-xs); }
  .mob-debuff-rail { position: absolute; top: 24%; left: 0; z-index: var(--z-floater); display: flex; flex-direction: column; gap: var(--spacing-xs); pointer-events: none; }
  .plate-fx { position: absolute; inset: 0; z-index: var(--z-label); pointer-events: none; }
  .plate-fx .pop { position: absolute; left: 50%; top: 30%; white-space: nowrap; padding: var(--spacing-xs); }
  .plate-fx .pop-word { top: 48%; }
  .hit-count { color: var(--text); font-size: var(--font-3xs); }
  .effects-reduced .plate-fx .pop { animation: enemy-number-fade 800ms linear both; transform: translateX(-50%); }
  .effects-minimal .plate-fx .pop { animation: none; opacity: 1; transform: translateX(-50%); top: calc(30% + var(--lane) * var(--icon-label)); }
  .effects-minimal .plate-fx .pop-word { top: calc(65% + var(--lane) * var(--spacing-sm)); }
  .effects-minimal .float-side .fx { animation: none; opacity: 1; transform: none; }
  .effects-minimal .mob-windup i { transition: none; }
  @keyframes enemy-number-fade { 0%, 100% { opacity: 0; } 15%, 75% { opacity: 1; } }
  @media (prefers-reduced-motion: reduce) {
    .combat-ground { transition: none; }
    .mob-windup i { transition: none; }
  }
</style>
