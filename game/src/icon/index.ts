import type { Item } from '../sim/types';

import battleAxe from './weapon/battle-axe-1.svg?url';
import bow from './weapon/bow-arrow.svg?url';
import crossbow from './weapon/crossbow-1.svg?url';
import spellBook from './equipment/spell-book.svg?url';
import healthPotion from './misc/potions/health-potion-1.svg?url';
import dagger from './weapon/knife-thrust.svg?url';
import broadSword from './weapon/broadsword.svg?url';
import warhammer from './weapon/warhammer.svg?url';
import goblin from './character/goblin-head-1.svg?url';
import bootPrints from './equipment/boot-prints.svg?url';
import ogre from './character/ogre-1.svg?url';
import skull from './character/dread-skull.svg?url';
import cloak from './equipment/cloak-1.svg?url';
import wolf from './character/wolf-head-2.svg?url';
import crystal from './misc/stones/crystal-cluster-1.svg?url';
import crossShield from './equipment/cross-shield.svg?url';
import chaos from './skill/vortex.svg?url';
import leaf from './misc/materials/leaf-skeleton.svg?url';
import lightning from './skill/lightning-branches.svg?url';
import dragonShield from './equipment/dragon-shield.svg?url';
import crossedSwords from './weapon/crossed-swords-1.svg?url';
import spiderWeb from './character/spider-web-1.svg?url';
import pendant from './equipment/gem-pendant.svg?url';
import gauntlet from './equipment/gauntlet-1.svg?url';
import armorUpgrade from './equipment/armor-upgrade.svg?url';
import clothes from './equipment/clothes.svg?url';
import coins from './currency/coins-pile.svg?url';
import roastFood from './misc/food-roast-meat.svg?url';
import berryFruit from './enviroment/berry-bush.svg?url';
import mushroomFood from './misc/mushroom.svg?url';
import herbFood from './misc/materials/herb.svg?url';
import centurionHelmet from './equipment/centurion-helmet.svg?url';
import heartBeats from './interface/heart-beats.svg?url';
import manaPotion from './misc/potions/magic-potion-1.svg?url';
import arrowhead from './weapon/arrowhead.svg?url';
import cloudRing from './character/cloud-ring.svg?url';
import snowflake from './skill/snowflake-1.svg?url';
import rock from './character/rock.svg?url';
import fire from './skill/small-fire.svg?url';
import helmet from './equipment/helmet-1.svg?url';
import ring from './equipment/swirl-ring.svg?url';
import accuracyMark from './interface/bullseye.svg?url';
import allStatsMark from './interface/d12.svg?url';
import cooldownMark from './interface/stopwatch.svg?url';
import healthMark from './interface/heart-beats.svg?url';
import strengthMark from './currency/attribute-strength.svg?url';
import intelligenceMark from './currency/attribute-intelligence.svg?url';
import agilityMark from './currency/attribute-agility.svg?url';
import dexterityMark from './currency/attribute-dexterity.svg?url';
import wisdomMark from './currency/attribute-wisdom.svg?url';
import luckMark from './currency/attribute-luck.svg?url';
import armorMark from './equipment/layer-armour.svg?url';
import armorPenMark from './equipment/layer-armour-penetration.svg?url';
import energyShieldMark from './equipment/layer-energy-shield.svg?url';
import attackSpeedMark from './skill/layer-attack-speed.svg?url';
import criticalDamageMark from './skill/layer-critical-damage.svg?url';
import magicPowerMark from './skill/layer-magic-power.svg?url';
import manaRegenMark from './skill/layer-mana-regeneration.svg?url';
import alignmentMark from './skill/layer-elemental-alignment.svg?url';
import statusResistanceMark from './skill/layer-status-resistance.svg?url';
import maxManaMark from './skill/potion-mana.svg?url';
import dodgeMark from './skill/buff/dodging.svg?url';
import bleedMark from './skill/debuff-bleed.svg?url';
import stunMark from './skill/status-stun.svg?url';
import genericModMark from './misc/gear.svg?url';
import poisonMark from './skill/poison.svg?url';
import voidMark from './skill/element-void.svg?url';
import sandstormMark from './skill/sandstorm.svg?url';
import activeSkillMark from './skill/type-active-skill.svg?url';
import auraSkillMark from './skill/type-aura-skill.svg?url';
import buffSkillMark from './skill/type-buff-skill.svg?url';
import curseSkillMark from './skill/type-curse-skill.svg?url';
import healSkillMark from './skill/type-heal-skill.svg?url';

// The four species the shelf carries a real creature for; the rest still fall back to the dread-skull.
import minotaur from './character/bull.svg?url';
import dragon from './character/wyvern.svg?url';
import lizardman from './character/lizardman.svg?url';
import werewolf from './character/wolf-howl.svg?url';
import troll from './character/troll.svg?url';
import kobold from './character/bad-gnome.svg?url';
import skeleton from './character/skeleton.svg?url';
import mummy from './character/mummy-head.svg?url';
import vampire from './character/vampire-dracula.svg?url';
import demon from './character/daemon-skull.svg?url';
import orc from './character/orc-head.svg?url';
import giant from './character/giant.svg?url';
import human from './character/archer.svg?url';
import elf from './character/woman-elf-face.svg?url';
import treant from './character/ent-mouth.svg?url';
import dryad from './enviroment/tree-face.svg?url';

const armorBySlot: Record<string, string> = {
  helmet,
  chest: armorUpgrade,
  pant: clothes,
  boots: bootPrints,
  belt: pendant,
  gloves: gauntlet,
  ring,
  amulet: pendant,
  earring: crystal,
  cape: cloak,
};

const skillAssets = import.meta.glob<string>('./skill/**/*.svg', {
  eager: true,
  query: '?url',
  import: 'default',
});

function skillAsset(...paths: string[]): string | undefined {
  for (const path of paths) {
    const asset = skillAssets[`./skill/${path}.svg`];
    if (asset) return asset;
  }
  return undefined;
}

const mobBySpecies: Record<string, string> = {
  goblin,
  slime: cloudRing,
  troll,
  orc,
  demon,
  elf,
  golem: rock,
  spider: spiderWeb,
  wolf,
  minotaur,
  dragon,
  lizardman,
  werewolf,
  kobold,
  skeleton,
  mummy,
  vampire,
  ogre,
  treant,
  human,
  giant,
  dryad,
};

const elementByName: Record<string, string> = {
  physical: broadSword,
  fire,
  cold: snowflake,
  lightning,
  poison: poisonMark,
  chaos,
  earth: rock,
};

const statIcons: Record<string, string> = {
  str: strengthMark,
  int: intelligenceMark,
  vit: healthMark,
  agi: agilityMark,
  dex: dexterityMark,
  wis: wisdomMark,
  lck: luckMark,
};

const modIcons: Record<string, string> = {
  accuracy: accuracyMark,
  attack_speed: attackSpeedMark,
  critical_chance: accuracyMark,
  critical_damage: criticalDamageMark,
  magic_power: magicPowerMark,
  attack_damage_pct: crossedSwords,
  spell_damage_pct: magicPowerMark,
  magic_power_flat: magicPowerMark,
  physical_power: crossedSwords,
  physical_power_flat: crossedSwords,
  armour_flat: armorMark,
  armour_pct: armorMark,
  cooldown_reduction: cooldownMark,
  energy_shield_flat: energyShieldMark,
  evasion_flat: dodgeMark,
  evasion_pct: dodgeMark,
  life_regen_flat: healthMark,
  life_regen_pct: healthMark,
  mana_regen_flat: manaRegenMark,
  mana_regen_pct: manaRegenMark,
  max_energy_shield_pct: energyShieldMark,
  energy_shield_regen: energyShieldMark,
  max_hp: healthMark,
  max_hp_flat: healthMark,
  max_mana: maxManaMark,
  max_mana_flat: maxManaMark,
  perfect_dodge_pct: dodgeMark,
  status_resistance_pct: statusResistanceMark,
  all_resistance_pct: statusResistanceMark,
  elemental_resistance_cap_pct: statusResistanceMark,
  elemental_alignment: alignmentMark,
  elemental_power: magicPowerMark,
  elemental_power_flat: magicPowerMark,
  elemental_resistance: energyShieldMark,
  bleed_chance: bleedMark,
  stun_chance: stunMark,
  block_chance: crossShield,
  armour_pen: armorPenMark,
};

const weaponIcon = (base: string): string => {
  if (base.includes('crossbow')) return crossbow;
  if (base.includes('bow')) return bow;
  if (base.includes('dagger')) return dagger;
  if (base.includes('mace')) return warhammer;
  if (base.includes('axe')) return battleAxe;
  if (base.includes('spear')) return arrowhead;
  if (base.includes('staff') || base.includes('wand')) return spellBook;
  return broadSword;
};

export function gearIcon(item: Item): string {
  const slot = item.slot.toLowerCase();
  const base = item.base.toLowerCase();
  if (slot === 'main hand') return weaponIcon(base);
  if (slot === 'helmet' && base.includes('barbute')) return centurionHelmet;
  if (slot === 'off hand') {
    if (base.includes('tome')) return spellBook;
    if (base.includes('kite')) return dragonShield;
    if (base.includes('sword') || base.includes('axe') || base.includes('dagger')) return weaponIcon(base);
    return crossShield;
  }
  return armorBySlot[slot] ?? armorUpgrade;
}

/** The glyph an empty slot wears on the doll — the same shelf a worn piece draws from, so a bare body
 *  still reads as a body with places to fill rather than as a grid of words. */
export function slotIcon(slot: string): string {
  const s = slot.toLowerCase();
  if (s === 'main hand') return broadSword;
  if (s === 'off hand') return crossShield;
  return armorBySlot[s] ?? armorUpgrade;
}

export function stackIcon(group: string, name: string): string {
  const category = group.toLowerCase();
  const item = name.toLowerCase();
  if (category === 'stones') return crystal;
  if (category === 'herbs') return leaf;
  if (category === 'draughts' || category === 'condensed') return item.includes('mana') ? manaPotion : healthPotion;
    if (category === 'food') {
      if (item.includes('berry') || item.includes('nut')) return berryFruit;
      if (item.includes('mushroom')) return mushroomFood;
      if (item.includes('herb')) return herbFood;
      return roastFood;
    }
  if (category === 'junk') return skull;
  return coins;
}

export function mobIcon(species: string): string {
  return mobBySpecies[species.toLowerCase()] ?? skull;
}

/** The mark a boss field label carries (§11): the same dread-skull the junk stream uses. */
export const bossMark = skull;

export function elementIcon(element: string): string {
  return elementByName[element.toLowerCase()] ?? broadSword;
}

/** A Mod's mark follows its stat or Element, so equipment lines scan by meaning as well as by number. */
export function modIcon(id: string, stat?: string | null, element?: string | null): string {
  const key = id.toLowerCase();
  if (key === 'stat_mod_flat') return statIcons[stat?.toLowerCase() ?? ''] ?? allStatsMark;
  if (key === 'all_stat_flat') return allStatsMark;
  if (element && ['elemental_power', 'elemental_power_flat', 'elemental_resistance'].includes(key)) {
    return elementIcon(element);
  }
  return modIcons[key] ?? genericModMark;
}

export function skillIcon(id: string, type?: string): string {
  const skill = id.toLowerCase();
  const kind = (type || skill.split('.')[0]).toLowerCase();
  const slug = skill.split('.').pop()?.replace(/_/g, '-') ?? skill.replace(/_/g, '-');
  const exact = skillAsset(`${kind}/${kind}-${slug}`, `${kind}/${slug}`, slug);
  if (exact) return exact;
  if (skill.includes('whirlwind') || skill.includes('whirlaxe') || skill.includes('twister')) {
    return skillAsset('whirlwind-1', 'whirlwind-2') ?? cloudRing;
  }
  if (skill.includes('sand_storm')) return sandstormMark;
  if (/fan_of_knives|backstab|nerve_strike|poisoned_edge/.test(skill)) return dagger;
  if (/impale|skewer_line|reach_thrust/.test(skill)) return arrowhead;
  if (/skull_crack|bone_breaker|iron_toll/.test(skill)) return warhammer;
  if (/low_sweep|wide_swing|cleave_down/.test(skill)) return crossedSwords;
  if (skill.includes('acid')) return poisonMark;
  if (skill.includes('arrow') || skill.includes('shot') || skill.includes('volley')) return bow;
  if (skill.includes('shield') || skill.includes('guard') || skill.includes('wall') || skill.includes('block') || skill.includes('damage_taken')) return crossShield;
  if (skill.includes('heal') || skill.includes('cleanse') || skill.includes('vitality')) return heartBeats;
  if (skill.includes('bleed') || skill.includes('reap') || skill.includes('carnage')) return bleedMark;
  if (/fire|flame|ember|meteor|wisp|burn/.test(skill)) return fire;
  if (/frost|cold|ice|rime|snow|blizzard|frozen/.test(skill)) return snowflake;
  if (/lightning|spark|thunder|storm|static/.test(skill)) return lightning;
  if (/poison|toxic|venom|acid/.test(skill)) return poisonMark;
  if (skill.includes('void') || skill.includes('veil')) return voidMark;
  if (skill.includes('chaos')) return chaos;
  if (/earth|sand|quake|ground|stone|rock/.test(skill)) return rock;
  if (skill.includes('dodge') || skill.includes('sidestep')) return dodgeMark;
  if (skill.includes('crit')) return criticalDamageMark;
  if (kind === 'curse') return curseSkillMark;
  if (kind === 'buff') return buffSkillMark;
  if (kind === 'aura') return auraSkillMark;
  if (kind === 'heal') return healSkillMark;
  if (kind === 'attack') return activeSkillMark;
  return spellBook;
}
