import type { GameState, Mob } from '../types';
import { arenaDistance, type CombatArena, type CombatArenaAction } from '../../combat/combat-arena';
import { isBossKind } from '../kinds';
import { push } from '../log';

/**
 * Spatial engagement for one encounter: who is pulled, who is released, and who walks home.
 *
 * Only bodies inside aggro, an existing leash, an assist neighbour, or the player's committed target
 * may attack. The same resolver runs again after every authoritative movement sample, so joining or
 * leaving is never a second late.
 */

export type EngagementDelta = { added: string[]; removed: string[] };

/** The tick's committed-target latch: `engageTarget` writes it, this stage reads it. */
export interface EngagementState { deliberateTargetId?: string }

export const createEngagementState = (): EngagementState => ({});

type FieldProfile = {
  home_band_m: number;
  offline_share: number;
  aggro_m: number;
  leash_m: number;
  assist_m: number;
};

export function advanceEngagement(s: GameState, opts: {
  arena: CombatArena | undefined;
  online: boolean;
  fieldProfile: () => FieldProfile;
  cancelIntent: (reason: string) => void;
  cancelMobPreparation: (action: CombatArenaAction, atUs: number, reason: string) => void;
  tickStartUs: number;
  state: EngagementState;
}): {
  syncEngagement: (atUs: number) => EngagementDelta;
  refreshReturning: (atUs: number) => void;
  insideHomeLeash: (mob: Mob) => boolean;
} {
  const { arena, online, fieldProfile, cancelIntent, cancelMobPreparation, tickStartUs, state } = opts;

  /** Keep the saved field actor in step when the return flag changes mid-tick. */
  function persistReturning(id: string, value: boolean): void {
    const actor = s.field?.actors.find((entry) => entry.id === id);
    if (!actor) return;
    if (value) actor.returning = true;
    else delete actor.returning;
  }

  /**
   * Home return is a committed state: a displaced ordinary body drops damage and may not be
   * targeted again until it reaches its authored home band. Bosses and camp fights keep their own
   * boundary policy, so they are never given this field immunity automatically.
   */
  function refreshReturning(atUs: number): void {
    if (!arena || !s.field) return;
    const campFight = s.fieldwork.campEncounters?.active?.stage === 'combat';
    const band = Math.max(0.01, Number(fieldProfile().home_band_m) || 0.35);
    const engaged = new Set(s.field.engagementIds);
    for (const mob of s.group) {
      const actor = arena.mobs[mob.id];
      if (!actor || mob.hp <= 0) continue;
      const slot = s.field.slots.find((entry) => entry.id === mob.spawnSlotId);
      if (!slot) continue;
      const ordinary = !campFight && !isBossKind(String(mob.kind));
      const distance = arenaDistance(actor, slot.home);
      if (!ordinary) { actor.returning = false; persistReturning(mob.id, false); continue; }
      // The transition out of engagement owns the one reset and the persisted flag; this pass
      // only releases the state once the body has actually reached its home band. A stale saved
      // engagement id cannot cancel an in-progress return.
      if (actor.returning) {
        if (distance <= band + 1e-6) {
          actor.returning = false;
          persistReturning(mob.id, false);
        }
        continue;
      }
      if (engaged.has(mob.id)) continue;
    }
    if (arena.focusId && arena.mobs[arena.focusId]?.returning) {
      const name = s.group.find((mob) => mob.id === arena!.focusId)?.species ?? 'Target';
      arena.focusId = undefined;
      push(s, `${name} is returning home`);
    }
    if (arena.intent?.targetId && arena.mobs[arena.intent.targetId]?.returning)
      cancelIntent('target returning');
  }

  /** Home leash is an outer bound for proximity, assistance and deliberate targeting alike. */
  function insideHomeLeash(mob: Mob): boolean {
    if (!arena || !s.field || s.fieldwork.campEncounters?.active?.stage === 'combat') return true;
    const actor = arena.mobs[mob.id];
    const slot = s.field.slots.find(entry => entry.id === mob.spawnSlotId);
    return !!actor && (!slot || arenaDistance(actor, slot.home) <= fieldProfile().leash_m + 1e-7);
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
      const now = new Set(s.field.engagementIds);
      return {
        added: [...now].filter((id) => !was.has(id)),
        removed: [...was].filter((id) => !now.has(id)),
      };
    }
    const profile = fieldProfile();
    const next = new Set<string>();
    const live = s.group.filter((mob) => mob.hp > 0 && arena.mobs[mob.id]
      && !arena.mobs[mob.id].returning && insideHomeLeash(mob));
    const campFight = s.fieldwork.campEncounters?.active?.stage === 'combat';
    if ((s.hunting || campFight) && s.player.hp > 0) {
      for (const mob of live) {
        if (campFight || arenaDistance(arena.mobs[mob.id], arena.player) <= profile.aggro_m + 1e-7) next.add(mob.id);
      }
      for (const mob of live) {
        if (!was.has(mob.id)) continue;
        const slot = s.field.slots.find((entry) => entry.id === mob.spawnSlotId);
        if (!slot || arenaDistance(arena.mobs[mob.id], slot.home) <= profile.leash_m + 1e-7) next.add(mob.id);
      }
      if (arena.intent?.targetId && live.some(mob => mob.id === arena.intent!.targetId)) next.add(arena.intent.targetId);
      if (arena.focusId && live.some(mob => mob.id === arena.focusId)) next.add(arena.focusId);
      if (state.deliberateTargetId && live.some(mob => mob.id === state.deliberateTargetId)) next.add(state.deliberateTargetId);
      const basicTarget = arena.player.action?.targetId;
      if (basicTarget && live.some(mob => mob.id === basicTarget)) next.add(basicTarget);
      // F27 — stop the overpull: assistance reaches one link, never cascades. A body the
      // player aggroed, focused or committed to wakes its neighbours; those neighbours do not
      // wake theirs. Deliberate targeting still adds directly above, outside this expansion.
      const assisting: { id: string; depth: number }[] = [...next].map((id) => ({ id, depth: 0 }));
      for (let index = 0; index < assisting.length; index++) {
        const { id, depth } = assisting[index];
        if (depth > 0) continue;
        const source = arena.mobs[id];
        for (const mob of live) {
          if (!next.has(mob.id) && arenaDistance(arena.mobs[mob.id], source) <= profile.assist_m + 1e-7) {
            next.add(mob.id);
            assisting.push({ id: mob.id, depth: depth + 1 });
          }
        }
      }
    }
    // A body that leaves its leash drops its damage and returns with its home pool, like a map
    // reset; this is the same receipt whether it was pulled too far or the player left it behind.
    const campFightNow = s.fieldwork.campEncounters?.active?.stage === 'combat';
    for (const id of was) {
      if (next.has(id)) continue;
      const mob = s.group.find((entry) => entry.id === id);
      if (!mob || mob.hp <= 0) continue;
      mob.hp = mob.hpMax;
      delete s.mobStatus[id];
      delete s.curses[id];
      const actor = arena.mobs[id];
      if (actor && !campFightNow && !isBossKind(String(mob.kind))) {
        actor.returning = true;
        persistReturning(id, true);
      }
    }
    s.field.engagementIds = [...next].slice(0, Math.max(1, s.field.slots.length));
    const now = new Set(s.field.engagementIds);
    const removed = [...was].filter((id) => !now.has(id));
    for (const id of removed) {
      const action = arena.mobs[id]?.action;
      if (action && action.cancelledAtUs == null && action.releasedAtUs == null && !action.impactCount)
        cancelMobPreparation(action, atUs, 'disengaged');
    }
    return { added: [...now].filter((id) => !was.has(id)), removed };
  }

  refreshReturning(tickStartUs);
  syncEngagement(tickStartUs);

  return { syncEngagement, refreshReturning, insideHomeLeash };
}
