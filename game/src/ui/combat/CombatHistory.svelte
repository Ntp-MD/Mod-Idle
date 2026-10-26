<script lang="ts">
  import { eng } from '../../engine/client';
  import type { CombatHistoryEntry, EnemySnapshot } from '../../sim/combat-history';
  import { COMBAT_HISTORY_LIMIT, summarizeCombat } from '../../sim/combat-history';
  import { fieldLabel } from '../hud/hud';

  let { entries, oninspect }: { entries: CombatHistoryEntry[]; oninspect: (enemy: EnemySnapshot) => void } = $props();
  let held = $state<CombatHistoryEntry[] | null>(null);
  let filter = $state<'all' | 'incoming' | 'push'>('all');
  const recorded = $derived(held || entries);
  const pushIndex = $derived(recorded.findIndex(entry => entry.kind === 'push'));
  const lastPush = $derived(pushIndex >= 0 ? recorded[pushIndex] : null);
  const shown = $derived.by(() => {
    if (filter === 'incoming') return recorded.filter(entry => entry.side === 'self' || entry.kind === 'push');
    if (filter === 'push') {
      if (pushIndex < 0) return [];
      const previousPush = recorded.findIndex((entry, index) => index > pushIndex && entry.kind === 'push');
      return recorded.slice(pushIndex, previousPush < 0 ? undefined : previousPush);
    }
    return recorded;
  });
  const summary = $derived(summarizeCombat(recorded));
  const time = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

  function description(entry: CombatHistoryEntry): string {
    const skill = entry.skillName || entry.skillId;
    switch (entry.kind) {
      case 'taken': return `${entry.via === 'dot' ? 'Damage over time' : skill || 'Attack'} · ${eng.fmt(entry.hpDamage != null && entry.esDamage != null ? entry.hpDamage + entry.esDamage : entry.value || 0)} damage received`;
      case 'hit': return `${skill || (entry.via === 'dot' ? 'Damage over time' : 'Your attack')} · ${eng.fmt(entry.value || 0)} damage dealt${entry.crit ? ' · Critical' : ''}`;
      case 'cast': return `${entry.side === 'self' ? 'You cast' : 'Enemy cast'} · ${skill || entry.text}`;
      case 'block': return `${entry.side === 'self' ? 'Your defence' : 'Enemy defence'} · ${entry.text}`;
      case 'proc': return entry.text === 'perfect dodge' ? 'Your defence · Perfect dodge' : `Effect applied${entry.side === 'self' ? ' to you' : ''} · ${entry.text}`;
      case 'buff': return `Your buff activated · ${skill || entry.text}`;
      case 'heal': return `Healing · ${entry.text}${skill ? ` · ${skill}` : ''}`;
      case 'kill': return 'Enemy defeated';
      case 'push': return entry.text;
    }
  }
</script>

<section class="combat-history" aria-label="Recent recorded combat">
  <header class="history-head">
    <div><h3>Recent combat</h3><p>Up to {COMBAT_HISTORY_LIMIT} recorded events, newest first. Times use the game clock.</p></div>
    <button class="btn btn-quiet" type="button" aria-pressed={held !== null} onclick={() => held = held ? null : [...entries]}>{held ? 'Resume updates' : 'Hold updates'}</button>
  </header>
  {#if held}<p class="history-note">History updates held. The game continues at its current speed.</p>{/if}
  <div class="history-filters tab-strip" role="group" aria-label="Combat history filters">
    <button class="tab-rail" type="button" aria-pressed={filter === 'all'} onclick={() => filter = 'all'}>All events</button>
    <button class="tab-rail" type="button" aria-pressed={filter === 'incoming'} onclick={() => filter = 'incoming'}>Incoming &amp; defences</button>
    <button class="tab-rail" type="button" aria-pressed={filter === 'push'} disabled={!lastPush} onclick={() => filter = 'push'}>Last Push</button>
  </div>
  <p class="history-total">Retained window {summary.windowSec}s · {eng.fmt(summary.outgoing)} dealt · {eng.fmt(summary.incoming)} received · {summary.kills} kill{summary.kills === 1 ? '' : 's'}{summary.crits ? ` · ${summary.crits} crit${summary.crits === 1 ? '' : 's'}` : ''}</p>
  {#if summary.skills.length}
    <p class="history-total">Top skills · {summary.skills.map(skill => `${skill.name} ${eng.fmt(skill.damage)}`).join(' · ')}</p>
  {/if}
  <p class="history-total">Showing {shown.length} retained events; older records may have left the window</p>
  {#if filter === 'push'}<p class="history-note">Last Push and its preceding retained events. Older events may have left the history.</p>{/if}
  {#if !shown.length}
    <div class="history-empty" role="status"><strong>No recorded events in this view</strong><p>Combat events appear after an attack, cast, defensive outcome, status or Push.</p></div>
  {:else}
    <ol class="history-events scroll-pane" aria-label="Recorded combat events">
      {#each shown as entry (entry.id)}
        <li class:push={entry.kind === 'push'}>
          <span class="event-time">{time(entry.sec)}{#if entry.away}<small>Away</small>{/if}</span>
          <div class="event-fact">
            {#if entry.kind === 'push'}<strong class="push-label">Push</strong>{/if}
            <p>{description(entry)}</p>
            {#if entry.hpDamage != null && entry.esDamage != null}<small>{eng.fmt(entry.hpDamage)} HP · {eng.fmt(entry.esDamage)} ES</small>{/if}
            {#if entry.enemy}<button class="btn btn-flat enemy-link" type="button" onclick={() => oninspect(entry.enemy!)}>Inspect {fieldLabel(entry.enemy)}</button>{/if}
          </div>
        </li>
      {/each}
    </ol>
  {/if}
</section>

<style>
  .combat-history { display: flex; flex-direction: column; gap: var(--spacing-sm); min-height: 0; height: 100%; color: var(--text); }
  .history-head { display: flex; align-items: start; justify-content: space-between; gap: var(--spacing-md); }
  .history-head > div { display: grid; gap: var(--spacing-xs); }
  h3, p, ol { margin: 0; }
  h3 { color: var(--gold-lit); font-size: var(--font-sm); }
  .history-head p, .history-note, .history-total { color: var(--sheet-ink); font-size: var(--font-2xs); line-height: 1.5; }
  .history-head button { flex: none; }
  .history-filters { display: flex; flex-wrap: wrap; flex: none; }
  .history-filters [aria-pressed='true'] { color: var(--gold-lit); background: var(--face-top); }
  .history-total { font-variant-numeric: tabular-nums; }
  .history-events { padding: 0; list-style: none; min-height: 0; flex: 1; overflow-y: auto; }
  li { display: grid; grid-template-columns: 70px minmax(0, 1fr); gap: var(--spacing-sm); padding: var(--spacing-sm); border-bottom: 1px solid var(--edge); }
  li.push { background: var(--face-top); }
  .event-time { display: grid; align-content: start; gap: var(--spacing-xs); color: var(--sheet-ink); font-size: var(--font-2xs); font-variant-numeric: tabular-nums; }
  .event-fact { display: grid; justify-items: start; gap: var(--spacing-xs); font-size: var(--font-xs); line-height: 1.5; overflow-wrap: anywhere; }
  .event-fact small, .event-time small { color: var(--sheet-ink); font-size: var(--font-2xs); }
  .push-label { color: var(--alarm); }
  .enemy-link { padding: 0; text-align: start; color: var(--es-lit); font-size: var(--font-2xs); }
  .history-empty { display: grid; align-content: center; justify-items: center; gap: var(--spacing-sm); min-height: 160px; color: var(--sheet-ink); font-size: var(--font-xs); text-align: center; }
</style>
