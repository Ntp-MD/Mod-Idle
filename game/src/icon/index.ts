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
import padlock from './interface/padlock.svg?url';
import aura from './skill/aura/expanded-rays.svg?url';
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
import centurionHelmet from './equipment/centurion-helmet.svg?url';
import heartBeats from './interface/heart-beats.svg?url';
import droplets from './misc/droplets.svg?url';
import manaPotion from './misc/potions/magic-potion-1.svg?url';
import arrowhead from './weapon/arrowhead.svg?url';
import cloudRing from './character/cloud-ring.svg?url';
import snowflake from './skill/snowflake-1.svg?url';
import rock from './character/rock.svg?url';
import fire from './skill/small-fire.svg?url';
import helmet from './equipment/helmet-1.svg?url';
import ring from './equipment/swirl-ring.svg?url';

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
  poison: droplets,
  chaos,
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

export function stackIcon(group: string, name: string): string {
  const category = group.toLowerCase();
  const item = name.toLowerCase();
  if (category === 'stones') return crystal;
  if (category === 'herbs') return leaf;
  if (category === 'draughts' || category === 'condensed') return item.includes('mana') ? manaPotion : healthPotion;
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

export function skillIcon(id: string, type: string): string {
  const skill = id.toLowerCase();
  if (skill.includes('whirlwind')) return cloudRing;
  if (skill.includes('arrow') || skill.includes('shot') || skill.includes('volley')) return bow;
  if (skill.includes('shield')) return crossShield;
  if (skill.includes('flame') || skill.includes('fire')) return fire;
  if (skill.includes('frost') || skill.includes('cold')) return snowflake;
  if (skill.includes('lightning') || skill.includes('spark')) return lightning;
  if (skill.includes('poison') || skill.includes('toxic')) return droplets;
  if (skill.includes('heal') || skill.includes('cleanse')) return heartBeats;
  if (type === 'curse') return padlock;
  if (type === 'buff') return aura;
  if (type === 'aura') return chaos;
  if (type === 'attack') return crossedSwords;
  return spellBook;
}
