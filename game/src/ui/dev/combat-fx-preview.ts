import { sm } from '../../engine/client';
import { mulberry32 } from '../../engine/client-helpers';
import { hitColour } from '../../sim/core/feedback';
import { spawnMob } from '../../sim/core/game';
import type { GameState, Mob, FxEvent } from '../../sim/core/types';

/**
 * The development showcase's combat-effect preview: the sample bodies a beat is drawn over, and the
 * events a beat publishes. Presentation only — this file builds no game state a save can see.
 */

export type CombatFxPreview = 'swing' | 'critical' | 'fire' | 'lightning' | 'heal' | 'block' | 'lethal' | 'rapid'
  | 'aoe' | 'exchange' | 'miss' | 'sizes' | 'boss' | 'skill';
export type CombatFxBeat = Exclude<CombatFxPreview, 'rapid' | 'sizes' | 'boss'>;

export const previewFire = sm.byId['attack.fireball'];
export const previewLightning = sm.of('attack').find((skill: any) => skill.element === 'lightning' && !skill.retired);
export const previewHeal = sm.of('heal').find((skill: any) => !skill.retired);
export const previewArea = sm.byId['attack.firestorm'];

export function combatPreviewGroup(sample: GameState, preview: CombatFxPreview): Mob[] {
  const rng = mulberry32(20261023);
  if (preview === 'aoe') return ['small', 'medium', 'medium'].map((body) =>
    spawnMob(rng, sample.zone, 'normal', body, undefined, { allowWildUnique: false }));
  if (preview === 'sizes') return [
    spawnMob(rng, sample.zone, 'normal', 'small', undefined, { allowWildUnique: false }),
    spawnMob(rng, sample.zone, 'elite'),
    spawnMob(rng, sample.zone, 'boss'),
  ];
  return preview === 'boss' ? [spawnMob(rng, sample.zone, 'boss')] : sample.group;
}

export function combatPreviewEvents(preview: CombatFxBeat, mobs: Mob[], skillId: string): Omit<FxEvent, 'id' | 'sec'>[] {
  const mob = mobs[0];
  if (!mob) return [];
  if (preview === 'swing' || preview === 'critical') {
    const crit = preview === 'critical';
    return [{ kind: 'hit', side: 'field', mobId: mob.id, via: 'swing', text: crit ? '1,240!' : '248', value: crit ? 1240 : 248, crit, colour: hitColour('physical', crit) }];
  }
  if (preview === 'block') return [{ kind: 'block', side: 'self', byId: mob.id, text: 'Block', colour: hitColour(null) }];
  if (preview === 'exchange') return [
    { kind: 'hit', side: 'field', mobId: mob.id, via: 'swing', text: '248', value: 248, colour: hitColour('physical') },
    { kind: 'taken', side: 'self', byId: mob.id, text: '142', value: 142, colour: hitColour(mob.innate[0]) },
  ];
  const selected = preview === 'skill' ? sm.byId[skillId] : undefined;
  const skill = selected ?? (preview === 'heal' ? previewHeal : preview === 'lightning' ? previewLightning
    : preview === 'aoe' ? previewArea : previewFire);
  if (!skill) return [];
  const colour = hitColour(skill.element || null);
  const skillType = selected?.type;
  const multi = preview === 'aoe' || (preview === 'skill' && Number(String(skill.targets || '').split('/')[0]) > 1);
  const outcome: Omit<FxEvent, 'id' | 'sec'>[] = preview === 'heal' || (preview === 'skill' && skillType === 'heal')
    ? [{ kind: 'heal', side: 'self', skillId: skill.id, text: '+86', value: 86, colour }]
    : preview === 'skill' && skillType === 'buff'
      ? [{ kind: 'buff', side: 'self', skillId: skill.id, text: skill.name || skill.id, colour }]
      : preview === 'skill' && skillType === 'aura'
        ? []
        : preview === 'miss'
          ? [{ kind: 'block', side: 'field', mobId: mob.id, text: 'Miss', colour: hitColour(null) }]
          : (multi ? mobs : [mob]).map((target) => ({
            kind: 'hit', side: 'field', mobId: target.id, via: 'cast', skillId: skill.id, text: '468', value: 468, colour,
          }));
  // Runtime publishes each outcome before its cast marker; plate.castForHit reads that order.
  return [
    ...outcome,
    { kind: 'cast', side: 'self', skillId: skill.id, text: skill.name || skill.id, colour },
  ];
}
