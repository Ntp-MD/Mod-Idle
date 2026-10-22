import path from 'node:path';
import { readJson } from './lib/json.ts';
import { gates, report } from './lib/gates.ts';
import type { BasesData, EngineData } from '../engine/types.ts';

/**
 * Forge cage — `engine.json` `forge` is the only owner of material families, grades, pattern costs
 * and the grade ladders. This cage proves every id resolves against the fieldwork roster and
 * `bases.json`, so a renamed Base or material cannot leave a dead pattern behind.
 */

const root = path.resolve(import.meta.dirname, '..');
const E = readJson<EngineData>(path.join(root, 'tools/data/engine.json'));
const BASES = readJson<BasesData>(path.join(root, 'tools/data/bases.json'));
const F = E.forge;
const G = gates();

const materialIds = new Set(E.fieldwork.materials.map((row: any) => row.id));
const families = F.families || {};
const familyIds = new Set(Object.keys(families));
const baseRows = BASES.bases || [];

const materialProblems: string[] = [];
for (const [id, row] of Object.entries(F.materials || {})) {
  if (!materialIds.has(id)) materialProblems.push(`${id}: not a fieldwork material`);
  if (!familyIds.has(row.family)) materialProblems.push(`${id}: unknown family ${row.family}`);
  if (!Number.isInteger(row.grade) || row.grade < 1 || row.grade > 3) materialProblems.push(`${id}: grade ${row.grade} is not 1-3`);
}
G.add('FC1', !materialProblems.length, materialProblems.join(' · ') || 'every forge material resolves to a fieldwork material, a family and grade 1-3');

const baseProblems: string[] = [];
for (const [family, row] of Object.entries(families)) {
  for (const [slot, name] of Object.entries(row.bases || {})) {
    if (!F.armour[slot]) baseProblems.push(`${family}.${slot}: no armour pattern for that slot`);
    const base = baseRows.find((b: any) => b.name === name && b.slot === slot);
    if (!base) baseProblems.push(`${family}.${slot}: ${name} is not a ${slot} Base`);
  }
}
G.add('FC2', !baseProblems.length, baseProblems.join(' · ') || 'every family Base resolves to a Base row in its own slot');

const weaponProblems: string[] = [];
const frameRows = BASES.weapon_frames || {};
for (const [type, row] of Object.entries(F.weapons || {})) {
  if (!(BASES.weapons || []).some((w: any) => w.name === type)) weaponProblems.push(`${type}: not a weapon type`);
  if (!familyIds.has(row.family)) weaponProblems.push(`${type}: unknown family ${row.family}`);
  if (!(frameRows[type] || []).some((frame: any) => frame.name === row.frame)) weaponProblems.push(`${type}: ${row.frame} is not a frame of ${type}`);
}
G.add('FC3', !weaponProblems.length, weaponProblems.join(' · ') || 'every weapon pattern resolves to its weapon type and named Frame');

const ARMOUR_SLOTS = ['helmet', 'chest', 'pant', 'boots', 'belt', 'gloves', 'ring', 'amulet', 'earring', 'cape', 'off hand'];
const patternProblems: string[] = [];
for (const slot of ARMOUR_SLOTS) if (!F.armour[slot]) patternProblems.push(`missing armour pattern ${slot}`);
for (const slot of Object.keys(F.armour || {})) if (!ARMOUR_SLOTS.includes(slot)) patternProblems.push(`extra armour pattern ${slot}`);
for (const [id, row] of Object.entries({ ...F.armour, ...F.weapons })) {
  if (!Number.isInteger(row.count) || row.count <= 0) patternProblems.push(`${id}: count must be a positive whole number`);
}
const weaponTypes = (BASES.weapons || []).map((w: any) => w.name);
for (const type of weaponTypes) if (!F.weapons[type]) patternProblems.push(`missing weapon pattern ${type}`);
for (const key of ['smithing_level', 'xp_per_grade'] as const) {
  const row = F[key] || [];
  if (row.length !== 3 || row.some((n) => !Number.isFinite(n) || n <= 0)) patternProblems.push(`${key} must be three positive numbers`);
  if (row.length === 3 && row.some((n, i) => i > 0 && n < row[i - 1])) patternProblems.push(`${key} must not fall by grade`);
}
G.add('FC4', !patternProblems.length, patternProblems.join(' · ') || '11 armour slots, every weapon type, positive costs and three-grade ladders');

report(G.rows());
