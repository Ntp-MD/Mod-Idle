import { mkdir, readdir, rename, rm, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const svgDir = join(dirname(fileURLToPath(import.meta.url)), 'svg');

const exists = async (path) => {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
};

// One-shot: re-running would sweep already-categorised folders back through the mapping.
for (const done of ['skill', 'interface', 'weapon']) {
  if (await exists(join(svgDir, done))) {
    console.error(`${done}/ already exists — tree already reorganised, nothing to do.`);
    process.exit(1);
  }
}

const RULES = [
  ['weapon', /sword|sabre|saber|rapier|blade|katana|dagger|knife|dirk|spear|lance|pike|halberd|glaive|trident|axe|ax|scythe|mace|maul|hammer|mallet|flail|whip|staff|rod|wand|bow|crossbow|quiver|arrow|sling|weapon|claw|fang|tusk|talon|truncheon/],
  ['equipment', /helmet|helm|hat|hood|crown|circlet|mask|face|shield|buckler|armor|armour|chestplate|breastplate|greaves|leggings|gauntlet|glove|pauldron|vest|robe|cloak|cape|tunic|mail|bracer|ring|amulet|belt|boot|earring|necklace|pendant|locket|outfit|sock|jaw|visor/],
  ['currency', /currency|coin|coins|gold|silver|money|moneys|nugget|purse|tribute|voucher|souls|token|chit|strongbox|riches|treasure(?!-chest)/],
  ['skill', /skill|aura|buff|curse|heal|attack|spell|magic|element|status|debuff|energy|mana|damage|talent|skilltree/],
  ['character', /mob|monster|demon|goblin|orc|slime|wraith|minotaur|dragon|hydra|spider|bat|wolf|rat$|troll|bandit|knight|elf|golem|husk|seraph|skeleton|skull|ghost|zombie|vampire|boss|elite|species|rank|party|troop|army|enemy|npc-|villager|merchant|paw|pelt|fur|horns/],
  ['map', /map|compass|waypoint|road|path|trail|signpost|landmark|travel|portal|atlas|terrain|region|zone/],
  ['building', /house|hut|home|tower|castle|gate|wall|brick|forge|furnace|camp|shop|store|bank|mill|barn|door|ruin|well|shrine|altar|statue|bastion|keep|village|town|city|building|structure|anvil/],
  ['interface', /add|remove|plus|minus|check|cross|close|cancel|confirm|delete|edit|lock|unlock|key|slot|tab|panel|window|button|menu|banner|title|badge|gear$|cog|setting|ui-|balance|warning/],
];

const DIRECT_MAP = {
  'gear/weapons': 'weapon',
  'gear/slots': 'equipment',
  'gear/offhand': 'equipment',
  'character': 'skill',
  'monsters/boss': 'character/boss',
  'monsters/elite': 'character/elite',
  'monsters/rank': 'character/rank',
  'monsters/species': 'character/species',
  'skills/attack': 'skill/attack',
  'skills/aura': 'skill/aura',
  'skills/buff': 'skill/buff',
  'skills/curse': 'skill/curse',
  'skills/heal': 'skill/heal',
  'items/materials': 'misc/materials',
  'items/potions': 'misc/potions',
  'items/stones': 'misc/stones',
  'economy': 'currency',
  'zones': 'map',
  'ui': 'interface',
  'quests': 'misc',
};

const FILE_MAP = {
  'economy/bank.svg': 'building/bank.svg',
  'items/materials/gold-nuggets.svg': 'currency/gold-nuggets.svg',
  'ui/house.svg': 'building/house.svg',
  'ui/plot-deed.svg': 'building/plot-deed.svg',
  'ui/road-link.svg': 'building/road-link.svg',
  'ui/repair-service.svg': 'building/repair-service.svg',
  'ui/map.svg': 'map/map.svg',
};

const PREFIX_STRIP = [
  /^general-\d+-/,
  /^general-/,
  /^new-skill-support-/,
  /^duplicate-of-existing-skill-/,
];

function classify(name) {
  const key = PREFIX_STRIP.reduce((value, pattern) => value.replace(pattern, ''), name);
  for (const [category, pattern] of RULES) {
    if (pattern.test(key)) return category;
  }
  return 'misc';
}

async function move(from, to) {
  const target = join(svgDir, to);
  if (await exists(target)) {
    const rest = `${to.slice(0, to.lastIndexOf('/'))}/unclassified-${to.slice(to.lastIndexOf('/') + 1)}`;
    await mkdir(dirname(join(svgDir, rest)), { recursive: true });
    console.log(`collision  ${from} -> ${rest}`);
    await rename(join(svgDir, from), join(svgDir, rest));
    return rest;
  }
  await mkdir(dirname(target), { recursive: true });
  await rename(join(svgDir, from), target);
  return to;
}

const moves = [];

for (const [source, category] of Object.entries(DIRECT_MAP)) {
  const dir = join(svgDir, source);
  if (!(await exists(dir))) continue;
  for (const name of await readdir(dir)) {
    if (!name.endsWith('.svg')) continue;
    const rel = `${source}/${name}`;
    moves.push([rel, FILE_MAP[rel] ?? `${category}/${name}`]);
  }
}

const inbox = join(svgDir, 'inbox');
if (await exists(inbox)) {
  for (const name of await readdir(inbox)) {
    const dir = join(inbox, name);
    if (!(await stat(dir)).isDirectory()) continue;
    for (const file of await readdir(dir)) {
      if (!file.endsWith('.svg')) continue;
      moves.push([`inbox/${name}/${file}`, `${classify(file)}/${file}`]);
    }
  }
}

const byCategory = new Map();
for (const [from, to] of moves) {
  const category = to.slice(0, to.indexOf('/'));
  if (!byCategory.has(category)) byCategory.set(category, []);
  byCategory.get(category).push([from, to]);
}

for (const [category, list] of byCategory) {
  console.log(`\n== ${category} (${list.length}) ==`);
  for (const [from, to] of list) await move(from, to);
}

console.log(`\nmoved ${moves.length} files`);

for (const entry of await readdir(svgDir, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const dir = join(svgDir, entry.name);
  const files = await readdir(dir);
  if (files.length === 0 || (files.length === 1 && files[0] === '.gitkeep')) {
    await rm(dir, { recursive: true, force: true });
  }
}