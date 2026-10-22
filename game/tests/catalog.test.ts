import { describe, expect, it } from 'vitest';
import { createCatalog } from '../../engine/catalog.ts';
import { BASES, catalog, E, MODS, SKILLS, TOWN } from '../src/engine/client';

describe('canonical catalog', () => {
  it('indexes every pool and resolves all current cross-pool references', () => {
    expect(catalog.problems).toEqual([]);
    expect(catalog.items.bases.rows).toHaveLength(BASES.bases.length);
    expect(catalog.items.mods.byId.size).toBe(MODS.mods.length);
    expect(catalog.mobs.species.byId.get('goblin')?.name).toBe('Goblin');
    expect(catalog.mobs.speciesByZone.get(1)?.length).toBeGreaterThan(0);
    expect(catalog.skills.byType.get('attack')?.length).toBeGreaterThan(0);
    expect(catalog.town.settlements.byId.get('eastgate')?.name).toBe('Eastgate');
  });

  it('keeps shop rows and Collector stock entries in one stock namespace', () => {
    expect(catalog.town.stockEntries.get('stash_tab_1')).toMatchObject({ kind: 'shop' });
    expect(catalog.town.stockEntries.get('reliquary')).toMatchObject({ kind: 'collector' });
    expect(catalog.town.shopRows.rows).toHaveLength(TOWN.one_time.length + TOWN.repeatable.length);
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
});
