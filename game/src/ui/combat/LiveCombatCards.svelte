<script lang="ts">
  import { sm } from '../../engine/client';
  import { snapshotEnemy, type EnemySnapshot } from '@sim/combat/combat-history';
  import { mobSkillById } from '@sim/combat/mobSkills';
  import { statusLabel, type MobStatusName } from '@sim/combat/mobStatus';
  import { fieldLabel } from '../hud/hud';
  import Meter from '../shared/Meter.svelte';
  import PlayerVitalCard from './PlayerVitalCard.svelte';
  import SkillCastCue from './SkillCastCue.svelte';
  import { fxByMob, windupOf } from './plate';
  import { nearbyDistanceLabel, type NearbyMobView } from './nearby-field';
  import type { FxEvent, GameState } from '@sim/core/types';
  import type { Character } from '@sim/core/player';
  import type { Statuses } from '@sim/combat/combat';
  import type { CombatEffectLevel } from './combat-presentation';

  let {
    s, c, ring, views, atUs, vitals, statuses, reserved, fmtNum, fxOutMs, speed = 1, effectLevel = 'auto',
    focusId = null, offView = null, onFocus, onInspectEnemy, onSheet,
  }: {
    s: GameState; c: Character; ring: FxEvent[]; views: NearbyMobView[]; atUs: number;
    vitals: { hp: number; es: number; mana: number }; statuses: Statuses; reserved: number;
    fmtNum: (n: number) => string; fxOutMs: number; speed?: number; effectLevel?: CombatEffectLevel;
    focusId?: string | null; offView?: string | null;
    onFocus: (mobId: string) => void;
    onInspectEnemy: (enemy: EnemySnapshot) => void;
    onSheet: () => void;
  } = $props();

  const byMob = $derived(fxByMob(ring));

  function statusMarks(id: string) {
    const lines = s.mobStatus[id]?.statuses || {};
    return Object.entries(lines)
      .filter(([, line]) => line && (line.stacks > 0 || line.secLeft > 0))
      .slice(0, 3)
      .map(([name, line]) => `${statusLabel(name as MobStatusName)}${line!.stacks > 1 ? ` ×${line!.stacks}` : ''}`);
  }

  /** One phase from the actual action timing; a cancelled cast never claims an impact. */
  function phase(view: NearbyMobView): string | null {
    const action = view.actor.action;
    const t = action?.timing;
    if (!t) return null;
    if (action?.cancelledAtUs != null && atUs >= action.cancelledAtUs) return 'canceled';
    if (atUs < t.startedAtUs) return 'approach';
    if (atUs < t.releaseAtUs) return 'windup';
    if (atUs < t.impactAtUs) return 'release';
    if (atUs < t.recoveryUntilUs) return 'recovery';
    return null;
  }

  function skillName(view: NearbyMobView): string {
    const id = view.actor.action?.skillId;
    if (!id) return '';
    return mobSkillById(id)?.name || sm.byId[id]?.name || id;
  }

  const impactKey = (view: NearbyMobView) => (byMob.get(view.id) || []).find((e) => e.kind === 'hit')?.id ?? 0;
  /** Defence words are real receipts too: a block or miss must not read as damage. */
  const defenseWord = (view: NearbyMobView) =>
    (byMob.get(view.id) || []).find((e) => e.kind === 'block')?.text ?? null;
</script>

<section class="live-cards surface-hud" aria-label="Nearby enemy cards">
  <header>
    <span class="text-heading">Nearby enemies</span>
    <span class="text-dim">{views.length} · &lt; 10 m</span>
  </header>
  <div class="card-scroll scroll-pane">
    {#each views as view (view.id)}
      {@const phaseText = phase(view)}
      {@const skill = skillName(view)}
      <div class="enemy-card" class:focused={focusId === view.id} class:calm={effectLevel !== 'full'}>
        <button class="card-head" type="button" aria-pressed={focusId === view.id}
                aria-label={`Focus ${fieldLabel(view.mob)}`} onclick={() => onFocus(view.id)}>
          <span class="identity">
            <strong>{fieldLabel(view.mob)}</strong>
            <small>Lv {view.mob.level} · {view.mob.kind} · {nearbyDistanceLabel(view.distanceM)}</small>
          </span>
          <span class="focus-mark" aria-hidden="true">{focusId === view.id ? '◆' : '◇'}</span>
        </button>
        {#key impactKey(view)}
          <span class="impact" aria-hidden="true"></span>
        {/key}
        <SkillCastCue ring={ring} mob={view.mob} {speed} {effectLevel} />
        <Meter value={view.actor.hp} max={view.actor.hpMax} tone="hp"
               label={`${fieldLabel(view.mob)} health`}
               valueText={`${Math.max(0, Math.round(view.actor.hp))} / ${Math.round(view.actor.hpMax)}`} />
        {#if phaseText || skill || defenseWord(view)}
          <p class="cast-read text-note">
            {#if skill}<b>{skill}</b>{/if}{#if phaseText && skill} · {/if}{#if phaseText}{phaseText}{/if}
            {#if defenseWord(view)}<span class="defense">{defenseWord(view)}</span>{/if}
          </p>
        {/if}
        <span class="windup" role="progressbar" aria-label="Next swing" aria-valuemin={0} aria-valuemax={100}
              aria-valuenow={Math.round(windupOf(view.mob) * 100)}><i style={`--windup:${windupOf(view.mob)}`}></i></span>
        {#if statusMarks(view.id).length}
          <div class="statuses" aria-label="Statuses">
            {#each statusMarks(view.id) as mark}<span class="status-chip">{mark}</span>{/each}
          </div>
        {/if}
        <button class="btn btn-flat inspect" type="button" onclick={() => onInspectEnemy(snapshotEnemy(view.mob))}>Inspect</button>
      </div>
    {:else}
      <p class="cards-empty text-note">No nearby enemies. Walk toward the fight to bring bodies into view.</p>
    {/each}
  </div>
  {#if offView}<p class="off-view text-note" role="status">{offView}</p>{/if}
  <div class="player-card-slot">
    <PlayerVitalCard {s} {c} {ring} {statuses} {vitals} {reserved} {onSheet} {fxOutMs} {fmtNum} {speed} {effectLevel} showActor={false} />
  </div>
</section>

<style>
  .live-cards { display: grid; gap: var(--spacing-xs); padding: var(--spacing-sm); width: min(20rem, 100%); max-height: 100%; }
  header { display: flex; justify-content: space-between; align-items: baseline; gap: var(--spacing-xs); font-size: var(--font-xs); }
  .card-scroll { display: grid; gap: var(--spacing-xs); min-height: 0; overflow-y: auto; }
  .enemy-card { position: relative; display: grid; gap: 3px; padding: var(--spacing-xs);
    border: 1px solid var(--edge); border-radius: var(--radius-card); background: var(--glass); }
  .enemy-card.focused { border-color: var(--gold); box-shadow: inset 2px 0 var(--gold); }
  .card-head { display: flex; justify-content: space-between; align-items: center; gap: var(--spacing-xs);
    padding: 0; border: 0; background: none; color: var(--text); text-align: left; cursor: pointer; }
  .card-head:focus-visible { outline: 2px solid var(--gold-lit); outline-offset: 2px; }
  .identity { display: grid; min-width: 0; }
  .identity strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: var(--font-xs); }
  .identity small { color: var(--dim); font-size: var(--font-3xs); line-height: 1.3; }
  .focus-mark { color: var(--gold-lit); }
  .impact { position: absolute; inset: 0; border-radius: inherit; pointer-events: none; box-shadow: inset 0 0 0 1px var(--gold); animation: card-impact 320ms ease-out both; }
  @keyframes card-impact { from { opacity: .9; } to { opacity: 0; } }
  .cast-read { margin: 0; font-size: var(--font-3xs); }
  .defense { color: var(--es-lit); }
  .calm .impact { animation: none; opacity: 0; }
  .windup { display: block; height: 2px; background: var(--bar); }
  .windup i { display: block; height: 100%; background: var(--gold-lit); transform: scaleX(var(--windup)); transform-origin: left; }
  .statuses { display: flex; flex-wrap: wrap; gap: 2px; }
  .status-chip { padding: 0 3px; border: 1px solid var(--edge); color: var(--dim); font-size: var(--font-3xs); }
  .inspect { justify-self: start; font-size: var(--font-3xs); }
  .cards-empty { margin: 0; }
  .off-view { margin: 0; color: var(--gold-lit); }
  .player-card-slot { height: 5.5rem; }
  @media (prefers-reduced-motion: reduce) { .impact { animation: none; opacity: 0; } }
</style>
