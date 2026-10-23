<script lang="ts">
  import { E, eng, sm } from '../engine/client';
  import { fxByMob as bucketFx, windupOf } from './plate';
  import { fieldLabel } from './hud';
  import { fxOut } from './motion';
  import { elementIcon, skillIcon } from '../icon';
  import { bossMark } from '../icon';
  import Icon from './Icon.svelte';
  import Meter from './Meter.svelte';
  import PlayerVitalCard from './PlayerVitalCard.svelte';
  import SkillCastCue from './SkillCastCue.svelte';
  import CombatSceneEffects from './CombatSceneEffects.svelte';
  import CombatActor from './CombatActor.svelte';
  import { statusLabel, type MobStatusName } from '../sim/mobStatus';
  import { mobSkillById } from '../sim/mobSkills';
  import type { GameState, Mob, FxEvent } from '../sim/types';
  import type { Character } from '../sim/player';
  import type { Statuses } from '../sim/combat';

  /** Full-body actors move independently of their fixed names, vitals and status badges. */
  let { s, c, ring, plates, statuses, zone, town, townLive, vitals, reserved, onSheet,
    fmtNum, selfFx, plateMotion, fxOutMs }: {
    s: GameState; c: Character; ring: FxEvent[]; plates: Mob[]; statuses: Statuses; zone: any;
    town: any; townLive: boolean; vitals: { hp: number; es: number; mana: number }; reserved: number;
    onSheet: () => void; fmtNum: (n: number) => string; selfFx: FxEvent[];
    plateMotion: number; fxOutMs: number;
  } = $props();

  function defenseColour(text: string) {
    const answer = text.toLowerCase();
    if (answer.includes('block')) return 'var(--es-lit)';
    if (answer.includes('evasion')) return 'var(--good-lit)';
    if (answer.includes('dodge')) return 'var(--gold-lit)';
    if (answer.includes('miss')) return 'var(--dim)';
    return 'var(--focus)';
  }

  const shortTime = (secs: number) => secs >= 60 ? `${Math.ceil(secs / 60)}m` : `${Math.ceil(secs)}s`;
  const statusElement = (name: string) =>
    Object.entries(E.elements.status_of as Record<string, string>).find(([, status]) => status === name)?.[0] || 'physical';

  function mobDebuffMarks(mobId: string) {
    void s.clockSec;
    const marks: { id: string; label: string; icon: string; secs: number | null; stacks: number }[] = [];
    const mobStatuses = s.mobStatus[mobId]?.statuses || {};
    for (const [name, line] of Object.entries(mobStatuses) as [MobStatusName, { stacks: number; secLeft: number }][]) {
      if (line.stacks <= 0 && line.secLeft <= 0) continue;
      marks.push({
        id: `status-${name}`, label: statusLabel(name), icon: elementIcon(statusElement(name)),
        secs: line.secLeft > 0 ? line.secLeft : null, stacks: line.stacks,
      });
    }

    const curses = new Map<string, { label: string; icon: string; secs: number; stacks: number }>();
    for (const [key, line] of Object.entries(s.curses[mobId] || {})) {
      if (line.secLeft <= 0) continue;
      const skillId = line.from || key;
      const current = curses.get(skillId);
      curses.set(skillId, {
        label: sm.byId[skillId]?.name || skillId,
        icon: skillIcon(skillId, 'curse'),
        secs: Math.max(current?.secs || 0, line.secLeft),
        stacks: 1,
      });
    }
    for (const [id, curse] of curses) marks.push({ id: `curse-${id}`, ...curse });
    return marks;
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
</script>

<div class="combat-ground" class:engaged={plates.length > 0} aria-hidden="true"></div>

{#if plates.length}
<div class="plate-row">
{#each plates as m, mi (m.id)}
  {@const mobDebuffs = mobDebuffMarks(m.id)}
  {@const mobCast = (fxByMob.get(m.id) || []).find((e) => e.kind === 'cast')}
  {@const auraNames = (m.auraSources || []).map((aura) => mobSkillById(aura.id)?.name).filter((name): name is string => !!name)}
  {@const windup = windupOf(m)}
  <div
    class="mob"
    data-mob-id={m.id}
    class:front={mi === 0}
    class:elite={m.kind === 'Elite'}
    class:boss={m.kind.startsWith('Boss')}
    in:plateLife={{ duration: plateMotion }}
    out:plateLife={{ duration: plateMotion }}
  >
    <div class="mob-actor-slot"><CombatActor {ring} {c} mob={m} /></div>
    <!-- Numbers are keyed independently of actor motion, so an exchange never replays either beat. -->
    <div class="plate-fx" aria-hidden="true">
      {#each (fxByMob.get(m.id) || []).filter((e) => e.kind === 'hit' && e.value).slice(0, 4) as e (e.id)}
        <span class="fx pop pop-damage" class:critical={e.crit} class:dot={e.via === 'dot'} out:fxOut={{ ms: fxOutMs }} style={`--fx:${e.colour}; --lane:${e.id % 4}`}>{eng.fmt(e.value ?? 0)}{e.crit ? '!' : ''}</span>
      {/each}
      {#each (fxByMob.get(m.id) || []).filter((e) => e.kind === 'block').slice(0, 2) as e (e.id)}
        <span class="fx pop pop-word" out:fxOut={{ ms: fxOutMs }} style={`--fx:${defenseColour(e.text)}; --lane:${e.id % 4}`}>{e.text}</span>
      {/each}
      {#if mobCast}
        <span class="fx pop pop-word mob-cast-word" out:fxOut={{ ms: fxOutMs }} style={`--fx:${mobCast.colour}; --lane:0`}>{mobCast.text}</span>
      {/if}
    </div>
    {#if auraNames.length}
      <span class="mob-aura" title={auraNames.join(' · ')} aria-label={`Aura: ${auraNames.join(', ')}`}>{auraNames[0]}{auraNames.length > 1 ? ` +${auraNames.length - 1}` : ''}</span>
    {/if}
    {#if mobDebuffs.length}
      <div class="mob-debuff-rail" role="list" aria-label={`${fieldLabel(m)} debuffs`}>
        {#each mobDebuffs as mark (mark.id)}
          <span class="mob-status-badge badge-mark badge-status debuff" role="listitem"
                aria-label={`${mark.label}${mark.stacks > 1 ? `, ${mark.stacks} stacks` : ''}${mark.secs != null ? `, ${Math.ceil(mark.secs)} seconds left` : ''}`}
                title={`${mark.label}${mark.stacks > 1 ? ` ×${mark.stacks}` : ''}${mark.secs != null ? ` · ${Math.ceil(mark.secs)}s left` : ''}`}>
            <Icon src={mark.icon} />
            {#if mark.stacks > 1}<small>×{mark.stacks}</small>{:else if mark.secs != null}<small>{shortTime(mark.secs)}</small>{/if}
          </span>
        {/each}
      </div>
    {/if}
      <div class="mob-readout card-combat" class:front={mi === 0} class:elite={m.kind === 'Elite'} class:boss={m.kind.startsWith('Boss')}>
        <div class="mob-head">
            <div class="identity">
              <p class="mob-name card-name" class:elite={m.kind === 'Elite'} class:boss={m.kind.startsWith('Boss')}>{fieldLabel(m)}{#if m.kind.startsWith('Boss')}<img class="tier-mark" src={bossMark} alt="" aria-hidden="true" />{/if}</p>
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
      <b>Next group in {Math.max(0, s.spawnIn)} sec.</b>
      <span>{hereName} · levels {zone.levels[0]}–{zone.levels[1]}</span>
    </p>
  {/if}
{/if}

<div class="combat-player-slot">
  <SkillCastCue {ring} />
  <PlayerVitalCard s={s} {c} {ring} {statuses} {vitals} {reserved} {onSheet} {fxOutMs} {fmtNum} />
  <div class="float-side self-side" aria-hidden="true">
    {#each selfFx as e (e.id)}
      <span class="fx fx-{e.kind}" class:pop={e.kind === 'drop'} class:pop-loot={e.kind === 'drop'} out:fxOut={{ ms: fxOutMs }} style="--fx:{e.colour}; --lane:{e.id % 3}">{e.text}</span>
    {/each}
  </div>
</div>

<CombatSceneEffects {ring} {c} {plates} />

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
  .mob-name { display: flex; align-items: center; justify-content: center; gap: var(--spacing-xs); max-width: 100%; margin: 0; font-size: var(--font-sm); line-height: 1.15; }
  .mob-name .tier-mark { width: var(--icon-label); height: var(--icon-label); flex: none; }
  .mob-level { color: var(--dim); font-size: var(--font-xs); line-height: 1.15; }
  .innate-rail { position: absolute; top: 0; right: 0; display: flex; gap: 2px; }
  .innate-mark { display: grid; place-items: center; width: var(--icon-label); height: var(--icon-label); background: var(--inset); }
  .mob-windup { display: block; height: 2px; overflow: hidden; background: var(--bar); }
  .mob-windup i { display: block; height: 100%; width: 100%; background: var(--gold-lit); transform: scaleX(var(--windup)); transform-origin: left center; transition: transform var(--motion-fast) linear; }
  .mob-aura { position: absolute; right: var(--spacing-xs); top: var(--spacing-xs); z-index: var(--z-floater); max-width: 80%; padding: 2px var(--spacing-xs); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; border-radius: 3px; background: var(--inset); color: var(--gold-lit); font-size: var(--font-xs); }
  .mob-debuff-rail { position: absolute; top: 24%; left: 0; z-index: var(--z-floater); display: flex; flex-direction: column; gap: var(--spacing-xs); pointer-events: none; }
  .plate-fx { position: absolute; inset: 0; z-index: var(--z-label); pointer-events: none; }
  .plate-fx .pop { position: absolute; left: 50%; top: 30%; white-space: nowrap; padding: var(--spacing-xs); }
  .plate-fx .pop-word { top: 48%; }
  .plate-fx .pop.mob-cast-word { top: 0; left: 50%; max-width: 100%; padding: 2px var(--spacing-xs); background: var(--inset); border-radius: 3px; color: var(--gold-lit); font-size: var(--font-xs); text-overflow: ellipsis; overflow: hidden; animation: mob-cast-note 1.3s ease both; }
  @keyframes mob-cast-note { 0% { opacity: 0; transform: translate(-50%, 4px); } 14%, 72% { opacity: 1; transform: translate(-50%, 0); } 100% { opacity: 0; transform: translate(-50%, -4px); } }
  @media (prefers-reduced-motion: reduce) {
    .combat-ground { transition: none; }
    .mob-windup i { transition: none; }
    .plate-fx .pop.mob-cast-word { animation-name: mob-cast-note-reduced; }
    @keyframes mob-cast-note-reduced { 0%, 100% { opacity: 0; } 14%, 72% { opacity: 1; } }
  }
</style>
