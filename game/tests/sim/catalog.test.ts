import { describe, expect, it } from 'vitest';
import { createCatalog } from '@engine/catalog.ts';
import { BASES, catalog, E, MODS, SKILLS, TOWN } from '../../src/engine/client';

describe('canonical catalog', () => {
  it('indexes every pool and resolves all current cross-pool references', () => {
    expect(catalog.problems).toEqual([]);
    expect(catalog.items.bases.rows).toHaveLength(BASES.bases.length);
    expect(catalog.items.mods.byId.size).toBe(MODS.mods.length);
    for (const base of BASES.bases) expect(catalog.items.bases.byName.get(base.name)).toEqual(base);
    for (const weapon of BASES.weapons) expect(catalog.items.weapons.byName.get(weapon.name)).toEqual(weapon);
    for (const mod of MODS.mods) expect(catalog.items.mods.byId.get(mod.id)).toEqual(mod);
    for (const species of E.mob.species) {
      expect(catalog.mobs.species.byId.get(species.id)).toEqual(species);
      for (const zone of species.zones) expect(catalog.mobs.speciesByZone.get(zone)).toContainEqual(species);
    }
    for (const skill of SKILLS.skills) {
      expect(catalog.skills.all.byId.get(skill.id)).toEqual(skill);
      expect(catalog.skills.byType.get(skill.type)).toContainEqual(skill);
    }
    for (const town of TOWN.settlements) expect(catalog.town.settlements.byId.get(town.id)).toEqual(town);
  });

  it('keeps shop rows and Collector stock entries in one stock namespace', () => {
    for (const row of [...TOWN.one_time, ...TOWN.repeatable])
      expect(catalog.town.stockEntries.get(row.id)).toMatchObject({ kind: 'shop', row });
    for (const row of TOWN.collector_sets)
      expect(catalog.town.stockEntries.get(row.id)).toMatchObject({ kind: 'collector', row });
    expect(catalog.town.shopRows.rows).toHaveLength(TOWN.one_time.length + TOWN.repeatable.length);
  });

  it('rebuilds indexes when content is added, renamed or removed', () => {
    const source = structuredClone({ engine: E, mods: MODS, skills: SKILLS, town: TOWN, bases: BASES });
    const species = { ...source.engine.mob.species[0], id: 'test-added-mob', name: 'Test mob' };
    const skill = { ...source.skills.skills[0], id: 'test.added-skill', name: 'Test skill' };
    const base = { ...source.bases.bases[0], name: 'Test base' };
    source.engine.mob.species.push(species);
    source.skills.skills.push(skill);
    source.bases.bases.push(base);
    let updated = createCatalog(source as any);
    expect(updated.problems).toEqual([]);
    expect(updated.mobs.species.byId.get(species.id)).toEqual(species);
    expect(updated.skills.byType.get(skill.type)).toContainEqual(skill);
    expect(updated.items.bases.byName.get(base.name)).toEqual(base);

    species.id = 'test-renamed-mob';
    skill.id = 'test.renamed-skill';
    base.name = 'Renamed test base';
    updated = createCatalog(source as any);
    expect(updated.problems).toEqual([]);
    expect(updated.mobs.species.byId.has('test-added-mob')).toBe(false);
    expect(updated.mobs.species.byId.get(species.id)).toEqual(species);
    expect(updated.skills.all.byId.has('test.added-skill')).toBe(false);
    expect(updated.skills.all.byId.get(skill.id)).toEqual(skill);
    expect(updated.items.bases.byName.has('Test base')).toBe(false);
    expect(updated.items.bases.byName.get(base.name)).toEqual(base);

    source.engine.mob.species.pop();
    source.skills.skills.pop();
    source.bases.bases.pop();
    updated = createCatalog(source as any);
    expect(updated.problems).toEqual([]);
    expect(updated.mobs.species.byId.has(species.id)).toBe(false);
    expect(updated.skills.all.byId.has(skill.id)).toBe(false);
    expect(updated.items.bases.byName.has(base.name)).toBe(false);
  });

  it('reports a broken shop reference instead of silently dropping it', () => {
    const source = {
      engine: structuredClone(E),
      mods: structuredClone(MODS),
      skills: structuredClone(SKILLS),
      town: structuredClone(TOWN),
      bases: structuredClone(BASES),
    };
    source.town.settlements[0].stock.push('missing_shop_row');
    (source.town.black_market.skill_weights as Record<string, number>)['missing.skill'] = 1;
    const broken = createCatalog(source as any);
    expect(broken.problems).toContain(`town.settlements.${source.town.settlements[0].id}.stock: unknown row missing_shop_row`);
    expect(broken.problems).toContain('town.black_market.skill_weights: unknown skill missing.skill');
  });

  it('resolves the same rows after reordering every catalogue array', () => {
    const source = {
      engine: structuredClone(E),
      mods: structuredClone(MODS),
      skills: structuredClone(SKILLS),
      town: structuredClone(TOWN),
      bases: structuredClone(BASES),
    };
    source.engine.mob.species.reverse();
    source.skills.skills.reverse();
    source.bases.bases.reverse();
    const reordered = createCatalog(source as any);
    expect(reordered.problems).toEqual([]);
    for (const skill of SKILLS.skills)
      expect(reordered.skills.all.byId.get(skill.id)).toEqual(skill);
    for (const species of E.mob.species)
      expect(reordered.mobs.species.byId.get(species.id)).toEqual(species);
  });
});
