import type { GameState, Mob } from '../types';
import { arenaDistance, type CombatArena, type CombatArenaAction } from '../../combat/combat-arena';
import { E } from '../../../engine/client';
import { traceSight } from '../../../../../engine/navigation.ts';
import type { EngagementCause } from '../../world/field-area';

/**
 * Spatial engagement for one encounter: who joins and who leaves.
 *
 * Awareness begins only through authored proximity aggression, a resolved hostile contact or an
 * eligible direct assist. Focus, approach and skill selection are player-side and never wake a
 * body. A body inside `aggro_m` acquires the player only when its Species is authored for
 * proximity and the sight mask is clear. An assist is one link: same-Species neighbours of a
 * directly alerted body, never a source on a later sample. Once pulled, a body stays engaged
 * until it dies, the player dies or the field stops hunting; there is no home leash return.
 */

export type EngagementDelta = { added: string[]; removed: string[] };

/** The tick's committed-target latch: `engageTarget` writes it, this stage reads it. */
export interface EngagementState {}

export const createEngagementState = (): EngagementState => ({});

type FieldProfile = {
  offline_share: number;
  aggro_m: number;
  assist_m: number;
};

const proximity = new Set<string>(E.mob.engagement?.proximity ?? []);
const assist = new Set<string>(E.mob.engagement?.assist ?? []);

/** A directly alerted body that answers a refused contact turns into its own direct cause. */
function noticeContact(s: GameState, mobId: string): void {
  if (!s.field || !s.group.some((mob) => mob.id === mobId && mob.hp > 0)) return;
  if (!s.field.engagementIds.includes(mobId)) s.field.engagementIds.push(mobId);
  (s.field.engagementCauses ??= {})[mobId] = 'contact';
}

export function advanceEngagement(s: GameState, opts: {
  arena: CombatArena | undefined;
  online: boolean;
  fieldProfile: () => FieldProfile;
  cancelMobPreparation: (action: CombatArenaAction, atUs: number, reason: string) => void;
  tickStartUs: number;
  state: EngagementState;
  /** The world second's opening pass. Combat windows after it only rebind their callbacks. */
  prime?: boolean;
  /** Released-work targets stay engaged while their impact is owed. */
  pinnedIds?: ReadonlySet<string>;
}): {
  syncEngagement: (atUs: number) => EngagementDelta;
  /** A resolved hostile contact attempt alerts this body once; a cancelled or pre-release press does not. */
  alertContact: (mobId: string, atUs?: number) => EngagementDelta;
} {
  const { arena, online, fieldProfile, cancelMobPreparation } = opts;

  const inFight = (): boolean =>
    !!s.field && (s.hunting || s.fieldwork.campEncounters?.active?.stage === 'combat') && s.player.hp > 0;

  function sightClear(source: { x: number; y: number }, target: { x: number; y: number }): boolean {
    if (!arena?.nav) return true;
    return traceSight(arena.nav, source, target) === null;
  }

  function speciesOf(mob: Mob): string | undefined {
    return mob.speciesId;
  }

  function syncEngagement(atUs: number): EngagementDelta {
    const empty: EngagementDelta = { added: [], removed: [] };
    if (!s.field) return empty;
    const was = new Set(s.field.engagementIds);
    if (!arena) {
      if (!online) {
        // A-lite offline duty: accumulate the authored engagement share and fight a solo pull only
        // on whole engaged seconds. The population and slot timers still advance on wall time.
        const profile = fieldProfile();
        const credit = (s.field.offlineCredit ?? 0) + profile.offline_share;
        const active = credit >= 1;
        s.field.offlineCredit = active ? credit - 1 : credit;
        s.field.engagementIds = active
          ? s.group.filter((mob) => mob.hp > 0).slice(0, 1).map((mob) => mob.id) : [];
      } else {
        // An online host without the arena renderer (tests, headless settle) keeps every living
        // body in the engagement set; the ground resolver is the only difference.
        s.field.engagementIds = s.group.filter((mob) => mob.hp > 0).map((mob) => mob.id);
      }
      s.field.engagementCauses = Object.fromEntries(
        s.field.engagementIds.map((id) => [id, 'contact' as const]));
      const now = new Set(s.field.engagementIds);
      return {
        added: [...now].filter((id) => !was.has(id)),
        removed: [...was].filter((id) => !now.has(id)),
      };
    }
    const profile = fieldProfile();
    const causes = new Map<string, EngagementCause>(
      Object.entries(s.field.engagementCauses ?? {}).map(([id, cause]) => [id, cause]));
    const next = new Map<string, EngagementCause>();
    const live = s.group.filter((mob) => mob.hp > 0 && arena.mobs[mob.id]);
    const liveById = new Map(live.map((mob) => [mob.id, mob]));
    const acquiring = inFight();
    if (acquiring) {
      const campFight = s.fieldwork.campEncounters?.active?.stage === 'combat';
      // A body already in the fight stays in it; distance alone never releases it. Its recorded
      // cause decides whether it may seed an assist on this sample.
      for (const mob of live) {
        if (was.has(mob.id)) next.set(mob.id, causes.get(mob.id) ?? 'contact');
      }
      // A camp encounter participates as one authored group.
      if (campFight) for (const mob of live) if (!next.has(mob.id)) next.set(mob.id, 'contact');
      for (const mob of live) {
        if (next.has(mob.id)) continue;
        const speciesId = speciesOf(mob);
        if (!speciesId || !proximity.has(speciesId)) continue;
        const pose = arena.mobs[mob.id];
        if (arenaDistance(pose, arena.player) > profile.aggro_m + 1e-7) continue;
        if (!sightClear(pose, arena.player)) continue;
        next.set(mob.id, 'proximity');
      }
      // One link, same Species, direct sources only: an assisted body never wakes its neighbours.
      for (const [sourceId, cause] of [...next]) {
        if (cause === 'assist') continue;
        const sourceMob = liveById.get(sourceId);
        const sourceSpecies = sourceMob ? speciesOf(sourceMob) : undefined;
        if (!sourceSpecies || !assist.has(sourceSpecies)) continue;
        const sourcePose = arena.mobs[sourceId];
        for (const mob of live) {
          if (next.has(mob.id) || speciesOf(mob) !== sourceSpecies) continue;
          const pose = arena.mobs[mob.id];
          if (arenaDistance(pose, sourcePose) > profile.assist_m + 1e-7) continue;
          if (!sightClear(pose, sourcePose)) continue;
          next.set(mob.id, 'assist');
        }
      }
    }
    for (const id of opts.pinnedIds ?? []) {
      if (liveById.has(id)) next.set(id, next.get(id) ?? 'contact');
    }
    const capped = [...next].slice(0, Math.max(1, s.field.slots.length));
    s.field.engagementIds = capped.map(([id]) => id);
    s.field.engagementCauses = Object.fromEntries(capped);
    const now = new Set(s.field.engagementIds);
    const removed = [...was].filter((id) => !now.has(id));
    for (const id of removed) {
      const action = arena.mobs[id]?.action;
      if (action && action.cancelledAtUs == null && action.releasedAtUs == null && !action.impactCount)
        cancelMobPreparation(action, atUs, 'disengaged');
    }
    return { added: [...now].filter((id) => !was.has(id)), removed };
  }

  function alertContact(mobId: string, atUs = opts.tickStartUs): EngagementDelta {
    const was = new Set(s.field?.engagementIds ?? []);
    noticeContact(s, mobId);
    syncEngagement(atUs);
    const now = s.field?.engagementIds ?? [];
    return { added: now.filter((id) => !was.has(id)), removed: [...was].filter((id) => !now.includes(id)) };
  }

  if (opts.prime !== false) syncEngagement(opts.tickStartUs);

  return { syncEngagement, alertContact };
}
