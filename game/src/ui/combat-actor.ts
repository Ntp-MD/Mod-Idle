import { E, sm } from '../engine/client';
import { mobSkillById } from '../sim/mobSkills';
import type { Character } from '../sim/player';
import type { FxEvent, Mob } from '../sim/types';
import spriteBounds from './map-sprite-bounds.json' with { type: 'json' };

export type ActorAction = 'melee' | 'ranged' | 'magic' | 'support' | 'prepare';
export type ActorReaction = 'hit' | 'block' | 'dodge';

const PLAYER_ART = '/map/characters/player/traveler-piece.png';
const SPECIES_ART = new Map(Object.keys(spriteBounds)
  .filter((href) => href.startsWith('/map/characters/species/'))
  .map((href) => [href.split('/')[4], href]));
const SHELF_SPRITES = import.meta.glob<string>('../icon/mob/sprite/*.png', { eager: true, query: '?url', import: 'default' });
/** Alpha >=128 bounds for the additional approved paintings, which have no map-piece measurements. */
const SHELF_BOUNDS: Record<string, number[]> = {
  briarling: [1385, 1136, 95, 91, 1194, 1000],
  harpy: [1385, 1136, 224, 91, 934, 1000],
  barghest: [1385, 1136, 96, 91, 1193, 1000],
  miretoad: [1385, 1136, 83, 108, 1219, 983],
  glassserpent: [1385, 1136, 171, 92, 1042, 999],
  palemoth: [1385, 1136, 83, 459, 1219, 632],
  drownedknight: [1385, 1136, 273, 92, 838, 999],
  bonehound: [1385, 1136, 192, 91, 1001, 1000],
  revenant: [1385, 1136, 289, 92, 806, 999],
  mirehydra: [1385, 1136, 83, 166, 1219, 925],
  moorhag: [1385, 1136, 282, 91, 821, 1000],
  thornstalker: [1385, 1136, 126, 94, 1133, 996],
  slaggolem: [1385, 1136, 228, 91, 928, 1000],
  rivernymph: [1385, 1136, 164, 91, 1057, 1000],
  wyrmling: [1385, 1136, 83, 161, 1219, 930],
  ashphoenix: [1385, 1136, 195, 91, 994, 1000],
  stormherald: [1385, 1136, 148, 92, 1085, 999],
  bogtitan: [1385, 1136, 161, 91, 1062, 1000],
};

/** These measured full-body paintings were retained with an old- prefix when the map adopted icons. */
export function actorArt(mob?: Pick<Mob, 'speciesId' | 'species'>) {
  const species = mob && (mob.speciesId || E.mob.species.find((row) => row.name.toLowerCase() === mob.species.toLowerCase())?.id
    || mob.species.toLowerCase());
  const measuredPath = mob ? SPECIES_ART.get(species!) : PLAYER_ART;
  const box = measuredPath ? (spriteBounds as Record<string, number[]>)[measuredPath] : SHELF_BOUNDS[species!];
  const href = measuredPath ? mob ? measuredPath.replace(/\/([^/]+)$/, '/old-$1') : measuredPath
    : SHELF_SPRITES[`../icon/mob/sprite/${species}.png`];
  if (!box || !href) return null;
  const [imageWidth, imageHeight, left, top, width, height] = box;
  return { href, imageWidth, imageHeight, viewBox: `${left} ${top} ${width} ${height}` };
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
export function actorImpactMs(event: FxEvent, c: Pick<Character, 'weaponName'>, source?: Mob): number {
  if (!['hit', 'taken', 'block'].includes(event.kind) || event.via === 'dot') return 0;
  const profile = actorProfile(source);
  const action = actorAction(event, c, source);
  const spell = action === 'magic' || action === 'support';
  const duration = spell ? Math.max(350, profile.attackMs) : profile.attackMs;
  return Math.round(duration * (spell ? .52 : profile.boss ? .5 : .4));
}

/** Only a real mob cast marker can prepare a body; ordinary attack progress predicts no skill. */
export function actorPrepareMs(event: FxEvent): number {
  if (event.kind !== 'cast' || event.side !== 'field' || !event.skillId) return 0;
  return Math.max(0, mobSkillById(event.skillId)?.cast_sec || 0) * 1000;
}
