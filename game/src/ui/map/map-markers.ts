import clawMarks from '../../icon/skill/claw-marks.png';
import saberTooth from '../../icon/mob/icon/saber-toothed-cat-head.png';
import dreadSkull from '../../icon/mob/icon/dread-skull.png';
import bootPrints from '../../icon/ui/boot-prints.png';
import flag from '../../icon/ui/flag.png';
import fire from '../../icon/element/fire.png';
import pickaxe from '../../icon/gear/tool/pickaxe.png';
import axe from '../../icon/gear/weapon/axe.png';
import fishingFish from '../../icon/mob/icon/fishing-fish.png';
import trailStew from '../../icon/food/trail-stew.png';
import cookingCauldron from '../../icon/food/cooking-cauldron.png';
import restCampfire from '../../icon/place/rest-campfire.png';
import adventureBags from '../../icon/ui/adventure-bags.png';
import heart from '../../icon/ui/heart.png';
import compassStar from '../../icon/ui/compass-star.png';
import sword from '../../icon/gear/weapon/sword.png';
import daemonSkull from '../../icon/mob/icon/daemon-skull.png';
import featheredWing from '../../icon/misc/junk/feathered-wing.png';
import flyingBeetle from '../../icon/mob/icon/flying-beetle.png';
import droplet from '../../icon/element/droplet.png';
import lightning from '../../icon/element/lightning.png';
import sun from '../../icon/element/sun.png';

/** Upright map tokens share an anchor at (0, 0), with their face centred at (0, -16). The glyph is a
 *  shelf PNG; the medallion, stem and leader are SVG geometry. */
export type MapMarkerKind = 'mob' | 'boss' | 'event' | 'unknown' | 'camp' | 'resource' | 'player' | 'patrol' | 'objective' | 'standing';
export type MapMarkerGlyph = 'claw' | 'fang' | 'skull' | 'tracks' | 'flag' | 'fire' | 'mine' | 'grove' | 'fish'
  | 'food' | 'cook' | 'rest' | 'caravan' | 'heal' | 'patrol' | 'compass' | 'expedition' | 'sword'
  | 'horns' | 'wings' | 'insect' | 'droplet' | 'spark' | 'sun';
export interface MapMarkerOptions { scale?: number; badge?: number | string; secondary?: MapMarkerGlyph; quiet?: boolean }

const escapeText = (value: string | number) => String(value).replace(/[<>&"']/g,
  char => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[char]!);

const glyphArt: Record<MapMarkerGlyph, string> = {
  claw: clawMarks,
  fang: saberTooth,
  skull: dreadSkull,
  tracks: bootPrints,
  flag,
  fire,
  mine: pickaxe,
  grove: axe,
  fish: fishingFish,
  food: trailStew,
  cook: cookingCauldron,
  rest: restCampfire,
  caravan: adventureBags,
  heal: heart,
  patrol: flag,
  compass: compassStar,
  expedition: compassStar,
  sword,
  horns: daemonSkull,
  wings: featheredWing,
  insect: flyingBeetle,
  droplet,
  spark: lightning,
  sun,
};

const glyphImage = (glyph: MapMarkerGlyph): string =>
  `<image class="map-marker-art" href="${glyphArt[glyph]}" x="-7" y="-7" width="14" height="14" preserveAspectRatio="xMidYMid meet"/>`;

const defaultGlyph: Record<MapMarkerKind, MapMarkerGlyph> = {
  mob: 'claw', boss: 'skull', event: 'flag', unknown: 'tracks', camp: 'fire', resource: 'mine',
  player: 'compass', patrol: 'patrol', objective: 'expedition', standing: 'flag',
};
/** Frame geometry + shelf glyphs: map styles own palette, contrast, and state treatments. */
export function mapMarker(kind: MapMarkerKind, glyph: MapMarkerGlyph = defaultGlyph[kind], options: MapMarkerOptions = {}): string {
  const secondary = options.secondary ? '<g class="map-marker-secondary" transform="translate(10 -5)">'
    + '<circle class="map-marker-face" r="6"/>'
    + `<g class="map-marker-glyph" transform="scale(.5)">${glyphImage(options.secondary)}</g></g>` : '';
  const badge = options.badge == null ? '' : '<g class="map-marker-badge" transform="translate(10 -26)">'
    + `<circle r="5.5"/><text x="0" y=".4" text-anchor="middle" dominant-baseline="middle">${escapeText(options.badge)}</text></g>`;
  return `<g class="map-marker map-marker-${kind}${options.quiet ? ' is-quiet' : ''}" data-marker-kind="${kind}" data-marker-glyph="${glyph}" transform="scale(${options.scale ?? .65})">`
    + '<ellipse class="map-marker-ground" cx="0" cy="0" rx="4" ry="1.5"/>'
    + '<path class="map-marker-stem" d="M0-7V0"/>'
    + '<circle class="map-marker-face" cy="-16" r="10"/>'
    + `<g class="map-marker-glyph" transform="translate(0 -16)">${glyphImage(glyph)}</g>${secondary}${badge}</g>`;
}

/** A species' family is visual vocabulary, with a neutral crest for unknown future lineages. */
export function mapSpeciesGlyph(species: string, family?: string): MapMarkerGlyph {
  const lineage: Record<string, MapMarkerGlyph> = {
    humanoid: 'sword', beast: 'claw', undead: 'skull', demon: 'horns', dragon: 'wings', insect: 'insect',
    plant: 'grove', fish: 'fish', formless: 'droplet', elemental: 'spark', celestial: 'sun',
  };
  return lineage[family || ''] || ({ wolf: 'fang', kobold: 'sword', human: 'sword', skeleton: 'skull', slime: 'droplet' } as Record<string, MapMarkerGlyph>)[species] || 'claw';
}
