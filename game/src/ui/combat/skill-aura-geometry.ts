import { skillAreaSnapshot } from '@engine/skill-area';
import { ownsSkill, type SkillState } from '@sim/combat/skills';
import type { CombatArenaFrame } from '@sim/combat/combat-arena';
import { sm } from '../../engine/client';
import { ARENA_VIEW, type ArenaViewSize } from './combat-arena-view';
import { skillAimGeometry, type SkillGeometry } from './skill-geometry';

/** Reservations have no cast action: their presentation follows the sampled player. */
export function activeAuraGeometry(skills: SkillState, frame: CombatArenaFrame,
  atUs: number, unitsPerSec: number, view: ArenaViewSize = ARENA_VIEW,
  body?: { width: number; height: number }): SkillGeometry[] {
  if (frame.player.hp <= 0 || !(unitsPerSec > 0)) return [];
  const elapsedSec = Math.max(0, atUs / unitsPerSec);
  return Object.entries(skills.auras).flatMap(([id, on]) => {
    const skill = sm.byId[id];
    if (!on || !ownsSkill(skills, id) || skill?.type !== 'aura' || skill.retired) return [];
    const area = skillAreaSnapshot({ origin: 'caster', radius_m: 0 }, frame.player, frame.player, 'player');
    const mark = skillAimGeometry({ skillId: id, area, source: frame.player,
      rangeM: 0, valid: true, targetName: 'You' }, view, undefined, body);
    return mark ? [{ ...mark, key: `aura-${id}`, phase: 'Field' as const,
      elapsedSec, phaseElapsedSec: elapsedSec }] : [];
  });
}
