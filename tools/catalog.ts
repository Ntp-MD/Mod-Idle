/**
 * Catalog cage — cross-pool references that a single JSON file cannot see.
 *
 *   node tools/catalog.ts            help
 *   node tools/catalog.ts --checks   index the item, mob, skill and town pools and refuse dangling ids
 */

import path from 'node:path';
import { createCatalog, type BaseCatalogSource, type TownCatalogSource } from '../engine/catalog.ts';
import { validateEngineData } from '../engine/validate.ts';
import type { ModsData, SkillsData } from '../engine/types.ts';
import { gates, report } from './lib/gates.ts';
import { readJson } from './lib/json.ts';

const root = path.resolve(import.meta.dirname, '..');
const E = validateEngineData(readJson(path.join(root, 'tools/data/engine.json')));
const MODS = readJson<ModsData>(path.join(root, 'tools/data/mods.json'));
const SKILLS = readJson<SkillsData>(path.join(root, 'tools/data/skills.json'));
const TOWN = readJson<TownCatalogSource>(path.join(root, 'tools/data/town.json'));
const BASES = readJson<BaseCatalogSource>(path.join(root, 'tools/data/bases.json'));
const catalog = createCatalog({ engine: E, mods: MODS, skills: SKILLS, town: TOWN, bases: BASES });

const G = gates();
const details = catalog.problems.length
  ? `${catalog.problems.length} unresolved cross-pool reference(s): ${catalog.problems.slice(0, 8).join(' · ')}`
  : `${catalog.items.bases.rows.length} bases · ${catalog.items.mods.rows.length} mods · ${catalog.mobs.species.rows.length} species · ${catalog.skills.all.rows.length} skills · ${catalog.town.settlements.rows.length} settlements indexed; no unresolved cross-pool references`;
G.add('CAT1', catalog.problems.length === 0, details);
report(G.rows());
