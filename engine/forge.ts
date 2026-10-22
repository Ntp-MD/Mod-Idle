/**
 * The Forge: a pattern names what to make, the material's family picks the Base or weapon Frame,
 * and its grade picks the item band. The output is an ordinary drop skeleton — this module only
 * resolves the inputs; the client rolls the piece with the same loot builder a drop uses.
 *
 * No RNG and no state live here: the resolver is a pure read of `engine.json` `forge` and
 * `bases.json`, so the client and the cage cannot disagree about what a material buys.
 */

import type { BasesData, EngineData } from './types.ts';

export type ForgeKind = 'armour' | 'weapon';

export interface ForgePattern {
  kind: ForgeKind;
  id: string;
  name: string;
  count: number;
  family?: string;
  frame?: string;
}

export interface ForgeMaterial {
  id: string;
  family: string;
  grade: number;
}

export interface ForgeResolved {
  ok: true;
  kind: ForgeKind;
  id: string;
  pattern: ForgePattern;
  material: ForgeMaterial;
  family: string;
  slot: string;
  /** The Base frame (armour) or the named weapon Frame. */
  frame: any;
  /** The weapon-type row for a main hand, otherwise null. */
  weapon: any | null;
  ilvl: number;
  q: number;
  band: string;
  count: number;
  xp: number;
}

export interface ForgeRefusal {
  ok: false;
  why: string;
}

export function createForge(E: EngineData, BASES: BasesData) {
  const F = E.forge;

  const materialOf = (id: string): ForgeMaterial | null => {
    const row = F.materials[id];
    return row ? { id, family: row.family, grade: row.grade } : null;
  };

  const patternOf = (kind: ForgeKind, id: string): ForgePattern | null => {
    if (kind === 'weapon') {
      const row = F.weapons[id];
      return row ? { kind, id, name: row.name, count: row.count, family: row.family, frame: row.frame } : null;
    }
    const row = F.armour[id];
    return row ? { kind, id, name: row.name, count: row.count } : null;
  };

  /** Families a pattern accepts: every family with a Base for an armour slot, the fixed one for a weapon. */
  const familiesFor = (kind: ForgeKind, id: string): string[] => {
    if (kind === 'weapon') {
      const pattern = patternOf(kind, id);
      return pattern?.family ? [pattern.family] : [];
    }
    return Object.keys(F.families).filter((family) => Boolean(F.families[family].bases?.[id]));
  };

  const materialsFor = (family: string): ForgeMaterial[] =>
    Object.keys(F.materials)
      .filter((id) => F.materials[id].family === family)
      .map((id) => materialOf(id)!)
      .sort((a, b) => a.grade - b.grade || a.id.localeCompare(b.id));

  const refuse = (why: string): ForgeRefusal => ({ ok: false, why });

  /**
   * Resolve one pattern + material at the character's level and the smithing level already earned.
   * The span is the published item-level window, so the grade's gate and the item level cannot drift
   * from the Band the rest of the game reads.
   */
  const resolve = (
    kind: ForgeKind,
    id: string,
    materialId: string,
    characterLevel: number,
    smithingLevel: number,
  ): ForgeResolved | ForgeRefusal => {
    const pattern = patternOf(kind, id);
    if (!pattern) return refuse('no such forge pattern');
    const material = materialOf(materialId);
    if (!material) return refuse('no such forge material');
    if (kind === 'weapon' && material.family !== pattern.family) {
      return refuse(`this pattern needs ${F.families[pattern.family!]?.name || pattern.family} materials`);
    }
    const family = kind === 'weapon' ? pattern.family! : material.family;
    if (!familiesFor(kind, id).includes(family)) {
      return refuse(kind === 'weapon'
        ? `this pattern needs ${F.families[pattern.family!]?.name || pattern.family} materials`
        : `${F.families[family]?.name || family} cannot forge a ${pattern.name}`);
    }
    const q = material.grade - 1;
    const span = E.item_level.spans?.[q];
    if (!span) return refuse('this material has no item band');
    if (characterLevel < span.from) {
      return refuse(`${materialId} is ${span.band} grade — reach character level ${span.from} first`);
    }
    const needed = F.smithing_level[q];
    if (smithingLevel < needed) return refuse(`smithing level ${needed} required`);

    let slot: string;
    let frame: any;
    let weapon: any | null = null;
    if (kind === 'weapon') {
      weapon = (BASES.weapons || []).find((row: any) => row.name === id) || null;
      if (!weapon) return refuse(`no weapon type named ${id}`);
      frame = (BASES.weapon_frames?.[id] || []).find((row: any) => row.name === pattern.frame) || null;
      if (!frame) return refuse(`no weapon frame named ${pattern.frame}`);
      slot = 'main hand';
    } else {
      const baseName = F.families[family].bases?.[id];
      if (!baseName) return refuse(`${F.families[family].name} cannot forge a ${pattern.name}`);
      frame = BASES.bases.find((row: any) => row.name === baseName && row.slot === id) || null;
      if (!frame) return refuse(`no Base named ${baseName} in ${id}`);
      slot = id;
    }

    const ilvl = Math.max(span.from, Math.min(Math.floor(characterLevel), span.to));
    return {
      ok: true,
      kind,
      id,
      pattern,
      material,
      family,
      slot,
      frame,
      weapon,
      ilvl,
      q,
      band: span.band,
      count: pattern.count,
      xp: F.xp_per_grade[q],
    };
  };

  return { F, materialOf, patternOf, familiesFor, materialsFor, resolve };
}
