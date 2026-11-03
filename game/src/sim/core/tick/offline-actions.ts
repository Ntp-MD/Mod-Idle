import { sm } from '../../../engine/client';
import { createCombatArena, syncCombatArena, type CombatArena } from '../../combat/combat-arena';
import { prepareSkillCast, resolvePreparedCast, rotationOrder, skillEligibility, spendableMana } from '../../combat/skills';
import { usefulFieldActive } from '../../combat/combat-actions';
import { isBossKind } from '../kinds';
import { snapshotPendingWork, restorePendingWork } from '../pending-work';
import type { GameState } from '../types';
import { createArenaWork } from './arena-work';
import { createFlights } from './flights';
import { createIntents } from './intents';
import { createLiveClocks } from './live-clocks';
import { fieldAreaKey } from '../../world/field-area';

const arenas = new WeakMap<GameState, CombatArena>();
const usesTimedMechanic = (id: string) => {
  const action = sm.byId[id]?.action;
  return !!action && (!!action.effect_policy || !!action.distinct_targets
    || ['meteor-field', 'thunder-field', 'ray-channel'].includes(action.kind));
};

/** Only new timed capabilities use this adapter. Encounter movement and ordinary offline attacks keep their own path. */
export function createOfflineActions(
  intentOptions: Parameters<typeof createIntents>[0],
  flightOptions: Parameters<typeof createFlights>[0],
  cooldown: { atUs: number },
) {
  const { s, c, attackCharacter, units, tickEndUs, clock } = intentOptions;
  if (!s.pendingWork?.offline && !arenas.has(s) && !rotationOrder(s.skills).some(usesTimedMechanic)) return undefined;
  let arena = arenas.get(s);
  if (!arena) {
    arena = createCombatArena();
    syncCombatArena(arena, s, flightOptions.tickStartUs, units, c.maxHp);
    if (s.pendingWork?.offline) restorePendingWork(arena, s);
    arenas.set(s, arena);
  } else if (flightOptions.tickStartUs === (s.clockSec - 1) * units) {
    syncCombatArena(arena, s, flightOptions.tickStartUs, units, c.maxHp);
  }
  arena.offline = true;
  arena.queueOnly = !s.field;
  arena.nav = undefined;
  const adapter = arena;
  const work = createArenaWork({ arena: adapter, s, clock });
  const { advanceLiveClocks } = createLiveClocks({ arena: adapter, s, c, units, cooldown,
    playerActiveFraction: intentOptions.playerActiveFraction });
  const flights = createFlights({ ...flightOptions, arena: adapter, ...work, advanceLiveClocks });
  const intents = createIntents({ ...intentOptions, arena: adapter, ...work, advanceLiveClocks,
    scheduleFlight: flights.scheduleFlight, resolveFlight: flights.resolveFlight });

  const blocked = () => !!adapter.intent && (adapter.intent.phase === 'windup'
    || clock.nowUs < (adapter.intent.recoveryUntilUs ?? 0));

  function interceptRotation(): boolean {
    advanceLiveClocks(clock.nowUs);
    if (adapter.intent?.phase === 'recovery' && !adapter.intent.channel
      && clock.nowUs >= (adapter.intent.recoveryUntilUs ?? 0)) adapter.intent = undefined;
    if (blocked()) return true;
    for (const id of rotationOrder(s.skills)) {
      if (usefulFieldActive(adapter, s.group, id)) continue;
      const resolved = intentOptions.resolveTargetsForSkill?.(id, s.group);
      const targets = resolved?.targets ?? s.group;
      const env = {
        spatialTargets: !adapter.queueOnly, mobStatus: s.mobStatus, curses: s.curses,
        currentHp: s.player.hp, freeCast: intentOptions.tranceFree(),
        missingHpPct: c.maxHp > 0 ? (1 - s.player.hp / c.maxHp) * 100 : 0,
        isBoss: s.group.some(mob => isBossKind(String(mob.kind))), timeUs: clock.nowUs,
      };
      const mana = spendableMana(attackCharacter, s.skills, s.player.mana);
      const eligibility = skillEligibility(s.skills, attackCharacter, id, mana, targets, s.playerStatuses, env);
      if (!eligibility.ready) continue;
      if (!usesTimedMechanic(id)) {
        const castEnv = { ...env, forceCrit: intentOptions.mirrorReady(), critDamageBonusPct: intentOptions.luckyBonus() };
        const prepared = prepareSkillCast(s.skills, attackCharacter, id, mana, targets, s.playerStatuses, castEnv, resolved?.area);
        intentOptions.applyCast(prepared ? resolvePreparedCast(s.skills, attackCharacter, prepared, s.playerStatuses, intentOptions.rng, castEnv) : null);
        return true;
      }
      const primary = targets[0];
      adapter.intent = { skillId: id, targetId: primary?.id ?? '', phase: 'approach',
        targetPoint: resolved?.area?.center ?? adapter.mobs[primary?.id ?? ''] ?? adapter.player };
      intents.startWindup(adapter.intent, clock.nowUs);
      return true;
    }
    return true;
  }

  function schedule() {
    if (s.player.hp <= 0) work.cancelArenaWork('death');
    if (adapter.intent?.phase === 'windup') {
      adapter.intent.releaseQueued = false;
      intents.scheduleRelease(adapter.intent);
    }
    for (const flight of [...adapter.flights]) { flight.queued = false; flights.scheduleFlight(flight); }
  }
  function checkpoint(atUs: number) {
    if (s.player.hp <= 0 || adapter.flights.some(flight => flight.areaKey && flight.areaKey !== fieldAreaKey(s)))
      work.cancelArenaWork(s.player.hp <= 0 ? 'death' : 'area-exit');
    advanceLiveClocks(atUs);
    adapter.nowUs = atUs;
    if (adapter.intent?.phase === 'recovery' && !adapter.intent.channel
      && atUs >= (adapter.intent.recoveryUntilUs ?? 0)) adapter.intent = undefined;
    s.pendingWork = snapshotPendingWork(adapter, s.group);
  }
  return { interceptRotation, blocked, schedule, checkpoint, cancel: work.cancelArenaWork };
}
