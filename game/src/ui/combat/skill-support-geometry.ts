import { skillAreaSnapshot } from '@engine/skill-area';
import type { CombatArena, CombatArenaFrame } from '@sim/combat/combat-arena';
import type { FxEvent } from '@sim/core/types';
import { sm } from '../../engine/client';
import { ARENA_VIEW, type ArenaViewSize } from './combat-arena-view';
import { vfxPresentationTailSec } from './arena-skill-art';
import { skillAimGeometry, type SkillGeometry } from './skill-geometry';

/** Toggle upkeep and healing ticks emit receipts without starting an arena action. */
export function supportEventGeometry(events: readonly FxEvent[], arena: CombatArena,
  frame: CombatArenaFrame, atUs: number, view: ArenaViewSize = ARENA_VIEW,
  body?: { width: number; height: number }): SkillGeometry[] {
  return events.flatMap(event => {
    if (!event.skillId || event.side !== 'self' || !['buff', 'heal'].includes(event.kind)) return [];
    const skill = sm.byId[event.skillId];
    if (!skill || skill.type !== 'buff' && skill.type !== 'heal') return [];
    const startedAtUs = event.atUs ?? event.sec * arena.unitsPerSec;
    const elapsedSec = (atUs - startedAtUs) / arena.unitsPerSec;
    // Asset-independent: same metadata envelope as Base/skin; no atlas gate.
    if (elapsedSec < 0 || elapsedSec >= vfxPresentationTailSec(event.skillId)) return [];
    // A normal heal cast already has art; upkeep and later heal ticks have no action.
    if (arena.actions.some(action => action.kind === 'cast' && action.actorId === 'player'
      && action.skillId === event.skillId && (action.id === event.actionId
        || Math.abs(action.atUs - startedAtUs) < 2))) return [];
    const area = skillAreaSnapshot({ origin: 'caster', radius_m: 0 }, frame.player, frame.player, 'player');
    const mark = skillAimGeometry({ skillId: event.skillId, area, source: frame.player,
      rangeM: 0, valid: true, targetName: 'You' }, view, undefined, body);
    return mark ? [{ ...mark, key: `support-${event.id}`, sourceKind: 'support' as const, actorId: 'player', eventId: event.id, phase: 'Impact' as const,
      elapsedSec, phaseElapsedSec: elapsedSec }] : [];
  });
}
