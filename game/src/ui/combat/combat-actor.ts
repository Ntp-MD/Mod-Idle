import { E, sm } from '../../engine/client';
import { mobIcon } from '../../icon';
import { mobSkillById } from '../../sim/combat/mobSkills';
import type { Character } from '../../sim/core/player';
import type { FxEvent, Mob } from '../../sim/core/types';
import spriteBounds from '../map/data/map-sprite-bounds.json' with { type: 'json' };
import { combatTempo } from './combat-presentation';

export type ActorAction = 'melee' | 'ranged' | 'magic' | 'support' | 'prepare';
export type ActorReaction = 'hit' | 'block' | 'dodge';
export type ActorArt = { href: string; imageWidth: number; imageHeight: number; viewBox: string; icon?: boolean };

const PLAYER_ART = '/map/characters/player/traveler-piece.png';
const SPECIES_ART = new Map(Object.keys(spriteBounds)
  .filter((href) => href.startsWith('/map/characters/species/'))
  .map((href) => [href.split('/')[4], href]));
/** The white mob icon is a 256 square head mark, drawn in place of a full-body figure. */
const ICON_ART = { imageWidth: 256, imageHeight: 256, viewBox: '0 0 256 256', icon: true } as const;

function speciesKey(mob?: Pick<Mob, 'speciesId' | 'species'>) {
  return mob && (mob.speciesId || E.mob.species.find((row) => row.name.toLowerCase() === mob.species.toLowerCase())?.id
    || mob.species.toLowerCase());
}

/** The full-body art the ARPG arena can fall back to: a measured map piece, otherwise the white icon. */
export function actorArt(mob?: Pick<Mob, 'speciesId' | 'species'>): ActorArt | null {
  const species = speciesKey(mob);
  const measuredPath = mob ? SPECIES_ART.get(species!) : PLAYER_ART;
  if (measuredPath) {
    const box = (spriteBounds as Record<string, number[]>)[measuredPath];
    if (!box) return null;
    const href = mob ? measuredPath.replace(/\/([^/]+)$/, '/old-$1') : measuredPath;
    const [imageWidth, imageHeight, left, top, width, height] = box;
    return { href, imageWidth, imageHeight, viewBox: `${left} ${top} ${width} ${height}` };
  }
  return species ? { href: mobIcon(species), ...ICON_ART } : null;
}

/** FieldPlates draws the canonical white mob icon; the player keeps the map traveler figure. */
export function plateArt(mob?: Pick<Mob, 'speciesId' | 'species'>): ActorArt | null {
  if (!mob) return actorArt();
  const species = speciesKey(mob);
  return species ? { href: mobIcon(species), ...ICON_ART } : null;
}

/** Presentation measurements only. The body's class comes from the spawned mob and canonical roster. */
export function actorProfile(mob?: Mob) {
  if (!mob) return { size: 'player', height: 1, attackMs: 340, reach: 27, recoil: 8, boss: false };
  const species = E.mob.species.find((row) => row.id === mob.speciesId || row.name.toLowerCase() === mob.species.toLowerCase());
  const boss = mob.kind.startsWith(E.mob.sizes.find((row) => row.id === 'boss')!.name);
  const body = mob.readsAs || E.mob.sizes.find((row) => row.name === mob.kind)?.id
    || (mob.kind === E.mob.elite.name ? 'large' : species?.sizes.includes('medium') ? 'medium' : species?.sizes[0]) || 'medium';
  if (boss) return { size: 'boss', height: 1, attackMs: 520, reach: 17, recoil: 4, boss: true };
  if (body === 'large') return { size: 'large', height: .97, attackMs: 430, reach: 20, recoil: 5, boss: false };
  if (body === 'small') return { size: 'small', height: .74, attackMs: 240, reach: 31, recoil: 11, boss: false };
  return { size: 'medium', height: .87, attackMs: 330, reach: 25, recoil: 8, boss: false };
}

/** Outgoing and incoming beats are independent: simultaneous exchanges move both nested wrappers. */
export function actorBeats(ring: FxEvent[], mob?: Mob) {
  const action = ring.find((event) => mob
    ? (event.byId === mob.id && (event.kind === 'taken' || event.kind === 'block') && event.via !== 'dot')
      || (event.side === 'field' && event.mobId === mob.id && event.kind === 'cast')
    : (event.side === 'self' && (event.kind === 'cast' || event.kind === 'buff' || (event.kind === 'heal' && !!event.skillId)))
      || (event.side === 'field' && ((event.kind === 'hit' && (event.via === 'swing' || event.via === 'cast'))
        || (event.kind === 'block' && !!event.mobId))));
  const reaction = ring.find((event) => mob
    ? event.mobId === mob.id && event.side === 'field'
      && ((event.kind === 'hit' && (event.via === 'swing' || event.via === 'cast')) || event.kind === 'block')
    : event.side === 'self' && ((event.kind === 'taken' && event.via !== 'dot') || event.kind === 'block'));
  return { action: action || null, reaction: reaction || null };
}

export function actorAction(event: FxEvent, c: Pick<Character, 'weaponName'>, mob?: Mob): ActorAction {
  if (mob) {
    if (event.kind === 'cast') return 'prepare';
    const skill = event.skillId ? mobSkillById(event.skillId) : undefined;
    return skill?.role === 'stand-off' || (!skill && mob.damage === 'magic') ? 'magic' : 'melee';
  }
  if (event.kind === 'buff' || event.kind === 'heal') return 'support';
  const skill = event.skillId ? sm.byId[event.skillId] : undefined;
  if (skill?.type && ['heal', 'buff', 'aura'].includes(skill.type)) return 'support';
  const group = skill?.group && skill.group !== 'all' ? skill.group : sm.weaponGroupOf(c.weaponName);
  return group === 'magic' ? 'magic' : group === 'ranged' ? 'ranged' : 'melee';
}

export function actorReaction(event: FxEvent): ActorReaction {
  return event.kind !== 'block' ? 'hit' : /block/i.test(event.text) ? 'block' : 'dodge';
}

/** The visual contact point follows the source's gesture; damage is already resolved by the sim. */
export function actorImpactMs(event: FxEvent, c: Pick<Character, 'weaponName'>, source?: Mob, speed = 1): number {
  if (!['hit', 'taken', 'block'].includes(event.kind) || event.via === 'dot') return 0;
  const profile = actorProfile(source);
  const action = actorAction(event, c, source);
  const spell = action === 'magic' || action === 'support';
  const duration = spell ? Math.max(350, profile.attackMs) : profile.attackMs;
  return Math.round(duration * (spell ? .52 : profile.boss ? .5 : .4) / combatTempo(speed));
}

/** Only a real mob cast marker can prepare a body; ordinary attack progress predicts no skill. */
export function actorPrepareMs(event: FxEvent): number {
  if (event.kind !== 'cast' || event.side !== 'field' || !event.skillId) return 0;
  return Math.max(0, mobSkillById(event.skillId)?.cast_sec || 0) * 1000;
}
