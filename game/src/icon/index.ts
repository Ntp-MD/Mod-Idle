import type { Item } from '../sim/types';

import battleAxe from './002-lorc-battle-axe.svg?url';
import bow from './007-delapouite-bow-arrow.svg?url';
import crossbow from './008-carl-olsen-crossbow.svg?url';
import spellBook from './010-delapouite-spell-book.svg?url';
import healthPotion from './011-delapouite-health-potion.svg?url';
import dagger from './012-lorc-knife-thrust.svg?url';
import broadSword from './016-lorc-broadsword.svg?url';
import warhammer from './017-delapouite-warhammer.svg?url';
import goblin from './020-delapouite-goblin-head.svg?url';
import bootPrints from './022-lorc-boot-prints.svg?url';
import ogre from './023-delapouite-ogre.svg?url';
import skull from './024-lorc-dread-skull.svg?url';
import cloak from './026-lucasms-cloak.svg?url';
import wolf from './027-lorc-wolf-head.svg?url';
import paw from './028-lorc-paw-print.svg?url';
import crystal from './035-lorc-crystal-cluster.svg?url';
import padlock from './037-lorc-padlock.svg?url';
import aura from './040-lorc-expanded-rays.svg?url';
import crossShield from './042-delapouite-cross-shield.svg?url';
import chaos from './043-lorc-vortex.svg?url';
import leaf from './045-lorc-leaf-skeleton.svg?url';
import lightning from './049-lorc-lightning-branches.svg?url';
import knight from './053-delapouite-black-knight-helm.svg?url';
import dragonShield from './057-delapouite-dragon-shield.svg?url';
import crossedSwords from './062-lorc-crossed-swords.svg?url';
import spiderWeb from './064-lorc-spider-web.svg?url';
import wings from './065-delapouite-fairy-wings.svg?url';
import pendant from './068-lorc-gem-pendant.svg?url';
import gauntlet from './110-delapouite-gauntlet.svg?url';
import armorUpgrade from './076-delapouite-armor-upgrade.svg?url';
import clothes from './078-delapouite-clothes.svg?url';
import coins from './080-delapouite-coins-pile.svg?url';
import centurionHelmet from './071-delapouite-centurion-helmet.svg?url';
import heartBeats from './087-delapouite-heart-beats.svg?url';
import droplets from './090-lorc-droplets.svg?url';
import manaPotion from './093-delapouite-magic-potion.svg?url';
import arrowhead from './105-lorc-arrowhead.svg?url';
import hood from './113-lorc-hood.svg?url';
import cloudRing from './117-lorc-cloud-ring.svg?url';
import snowflake from './119-lorc-snowflake-1.svg?url';
import rock from './120-lorc-rock.svg?url';
import fire from './130-lorc-small-fire.svg?url';
import helmet from './001-sbed-helmet.svg?url';
import ring from './075-lorc-swirl-ring.svg?url';

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
  bandit: hood,
  goblin,
  rat: paw,
  slime: cloudRing,
  troll: ogre,
  orc: skull,
  knight,
  seraph: wings,
  demon: skull,
  drake: dragonShield,
  elf: wings,
  golem: rock,
  spider: spiderWeb,
  wolf,
  husk: skull,
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
