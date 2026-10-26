import type { Item } from '../sim/types';
import {
  characterIconCandidates, gearIconCandidates, skillIconCandidates,
  slotIconCandidates, stackIconCandidates,
} from './registry';

/**
 * The icon shelf.
 *
 * Every PNG figure under this folder is shelf art, discovered by file name. Semantic item, skill, and
 * character associations live in registry.ts and use stable IDs where available. Resolvers try ordered
 * candidates and category fallbacks, so missing bespoke art never leaves a broken image in the UI. Mob art
 * is the white icon set under mob/icon/; the map overlay SVG under map/ is map artwork, not shelf icons.
 *
 * UI icons and map glyphs are PNG art from this shelf. UI controls draw it through `.icon-mask` in
 * skins.css; map markers draw it as SVG `<image>`. Inline SVG stays for structural graphics (tree/map
 * geometry, marker frames/leaders, charts, effects), never a standalone UI glyph.
 */
const shelfAssets = import.meta.glob<string>(['./**/*.png'], {
  eager: true,
  query: '?url',
  import: 'default',
});

const baseName = (path: string): string => path.slice(path.lastIndexOf('/') + 1).replace(/\.png$/, '');

const shelf = new Map<string, string>(
  Object.entries(shelfAssets).map(([p, url]) => [baseName(p), url]),
);
/** Mob icons resolve only inside mob/icon — a bare name like `bone` must not borrow a material icon. */
const mobShelf = new Map<string, string>(
  Object.entries(import.meta.glob<string>('./mob/icon/*.png', { eager: true, query: '?url', import: 'default' }))
    .map(([p, url]) => [baseName(p), url]),
);
const mobArt = (...names: (string | undefined)[]): string | undefined => {
  for (const name of names) {
    if (!name) continue;
    const url = mobShelf.get(name);
    if (url) return url;
  }
  return undefined;
};

/** The first name the shelf carries art for. */
function art(...names: (string | undefined)[]): string | undefined {
  for (const name of names) {
    if (!name) continue;
    const url = shelf.get(name);
    if (url) return url;
  }
  return undefined;
}

const ANCHOR = 'gear';

/** The mark a screen asks for by name, or the shelf's own generic mark when it has none. */
export function icon(name: string, fallback?: string): string {
  return art(name, fallback) ?? art(ANCHOR) ?? '';
}

/** The hub's art: the shelf figure where it carries one, the caller's PNG fallback where it does not.
 *  The rail is ringed and small, so a named file is the whole contract — no code per tab. */
export function hubIcon(name: string, fallback: string): string {
  return art(name) ?? fallback;
}

const ELEMENT_ART: Record<string, string> = {
  physical: 'broadsword',
  fire: 'fire',
  cold: 'snowflake',
  lightning: 'lightning',
  poison: 'poison',
  chaos: 'chaos',
  earth: 'boulder',
};

const STAT_ART: Record<string, string> = {
  str: 'battle-axe-1',
  int: 'concentration-orb',
  vit: 'heart-beats',
  agi: 'dodging',
  dex: 'bow-arrow',
  wis: 'awareness',
  lck: 'clover-2',
};

const MOD_ART: Record<string, string> = {
  accuracy: 'bullseye',
  attack_speed: 'layer-attack-speed',
  critical_chance: 'bullseye',
  critical_damage: 'layer-critical-damage',
  magic_power: 'layer-magic-power',
  attack_damage_pct: 'crossed-swords-1',
  spell_damage_pct: 'layer-magic-power',
  magic_power_flat: 'layer-magic-power',
  physical_power: 'crossed-swords-1',
  physical_power_flat: 'crossed-swords-1',
  armour_flat: 'layer-armour',
  armour_pct: 'layer-armour',
  cooldown_reduction: 'hourglass',
  energy_shield_flat: 'layer-energy-shield',
  evasion_flat: 'dodging',
  evasion_pct: 'dodging',
  life_regen_flat: 'heart-beats',
  life_regen_pct: 'heart-beats',
  mana_regen_flat: 'layer-mana-regeneration',
  mana_regen_pct: 'layer-mana-regeneration',
  max_energy_shield_pct: 'layer-energy-shield',
  energy_shield_regen: 'layer-energy-shield',
  max_hp: 'heart-beats',
  max_hp_flat: 'heart-beats',
  max_mana: 'potion-mana',
  max_mana_flat: 'potion-mana',
  perfect_dodge_pct: 'dodging',
  status_resistance_pct: 'layer-status-resistance',
  all_resistance_pct: 'layer-status-resistance',
  elemental_resistance_cap_pct: 'layer-status-resistance',
  elemental_alignment: 'layer-elemental-alignment',
  elemental_power: 'layer-magic-power',
  elemental_power_flat: 'layer-magic-power',
  elemental_resistance: 'layer-energy-shield',
  bleed_chance: 'debuff-bleed',
  stun_chance: 'status-stun',
  block_chance: 'cross-shield',
  armour_pen: 'layer-armour-penetration',
};

/** `old-<species>` covers most of the roster; only the species without such a mark need a row here. */
const MOB_BY_SPECIES: Record<string, string> = {
  ogre: 'minotaur-2',
  human: 'player',
  bonehound: 'animal-skull',
  revenant: 'ghost-1',
  mirehydra: 'hydra-1',
  slaggolem: 'dread-skull',
  wyrmling: 'dragon-head-1',
};

const pick = (...names: (string | undefined)[]): string => art(...names) ?? icon(ANCHOR);

export function gearIcon(item: Item): string {
  return art(...gearIconCandidates(item.base, item.slot)) ?? icon(ANCHOR);
}

/** The glyph an empty slot wears on the doll — the same shelf a worn piece draws from, so a bare body
 *  still reads as a body with places to fill rather than as a grid of words. */
export function slotIcon(slot: string): string {
  return art(...slotIconCandidates(slot)) ?? icon(ANCHOR);
}

export function stackIcon(group: string, name: string, stableId?: string): string {
  return art(...stackIconCandidates(group, name, stableId)) ?? icon(ANCHOR);
}

/** The species icon, shared by combat cards and map tokens. */
export function mobSpeciesArt(species: string): string {
  return mobIcon(species);
}

export function mobIcon(species: string): string {
  const key = species.toLowerCase();
  return mobArt(`old-${key}`, MOB_BY_SPECIES[key], 'dread-skull') ?? icon(ANCHOR);
}

/** The mark a boss field label carries (§11): the same dread-skull the junk stream uses. */
export const bossMark = pick('dread-skull');

export function elementIcon(element: string): string {
  return pick(ELEMENT_ART[element.toLowerCase()], 'broadsword');
}

/** A Mod's mark follows its stat or Element, so equipment lines scan by meaning as well as by number. */
export function modIcon(id: string, stat?: string | null, element?: string | null): string {
  const key = id.toLowerCase();
  if (key === 'stat_mod_flat') return pick(STAT_ART[stat?.toLowerCase() ?? ''], 'd12');
  if (key === 'all_stat_flat') return pick('d12');
  if (element && ['elemental_power', 'elemental_power_flat', 'elemental_resistance'].includes(key)) {
    return elementIcon(element);
  }
  return pick(MOD_ART[key], 'gear');
}

export function skillIcon(id: string, type?: string): string {
  return art(...skillIconCandidates(id, type)) ?? icon(ANCHOR);
}

/** The player portrait has its own stable registration, separate from Human mob art and the creation control. */
export function characterIcon(id = 'player.default'): string {
  return art(...characterIconCandidates(id)) ?? icon(ANCHOR);
}
