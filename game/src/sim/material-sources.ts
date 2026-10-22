import { E, fieldwork } from '../engine/client';

/**
 * Where a carried material comes from, read from the same data the field ticks use. The Forge is a
 * material sink, so the panel has to answer "where do I farm this?" without sending the player to
 * the wiki. One entry per source kind keeps the panel short; the UI decides how many names to print.
 */
export type MaterialSourceKind = 'mine' | 'grove' | 'hunt' | 'workshop' | 'salvage';

export interface MaterialSource {
  kind: MaterialSourceKind;
  label: string;
  detail: string;
}

const zoneName = (id: number): string =>
  E.mob.zones.find((zone: any) => zone.id === id)?.name || `Zone ${id}`;

export function materialSources(id: string): MaterialSource[] {
  const out: MaterialSource[] = [];
  const sources = E.fieldwork.regional_sources as Record<string, { mine?: string; grove?: string }>;

  const mines = Object.entries(sources)
    .filter(([, row]) => row.mine === id)
    .map(([zone]) => zoneName(Number(zone)));
  if (mines.length) out.push({ kind: 'mine', label: 'Mine', detail: mines.join(' · ') });

  const groves = Object.entries(sources)
    .filter(([, row]) => row.grove === id)
    .map(([zone]) => zoneName(Number(zone)));
  if (groves.length) out.push({ kind: 'grove', label: 'Grove', detail: groves.join(' · ') });

  const species = (E.mob.species as any[]).filter((row) => row.bonus_material?.resource === id);
  const huntDrops = ((E.fieldwork.hunt as any)?.material_drops || []) as { species: string[]; resource: string }[];
  const huntNames = new Set<string>(species.map((row) => row.name));
  for (const row of huntDrops) {
    if (row.resource !== id) continue;
    for (const name of row.species) huntNames.add(name);
  }
  if (huntNames.size) {
    const detail = [...huntNames]
      .map((name) => {
        const row = (E.mob.species as any[]).find((entry) => entry.name === name);
        const chance = row?.bonus_material?.resource === id ? ` (${Math.round((row.bonus_material.chance || 0) * 100)}%)` : '';
        return `${name}${chance}`;
      })
      .join(' · ');
    out.push({ kind: 'hunt', label: 'Hunt', detail });
  }

  for (const [site, action] of Object.entries((E.fieldwork.actions || {}) as Record<string, { resource?: string; rare_resource?: string }>)) {
    if (action.resource !== id && action.rare_resource !== id) continue;
    out.push({
      kind: site === 'mine' ? 'mine' : site === 'grove' ? 'grove' : 'hunt',
      label: `Field ${site}`,
      detail: 'Field site action',
    });
  }

  for (const recipe of fieldwork.workshopRecipes as any[]) {
    if (recipe.id !== id) continue;
    const inputs = Object.entries(recipe.materials || {})
      .map(([key, count]) => `${fieldwork.materialById[key]?.name || key} ×${count}`)
      .join(' + ');
    out.push({
      kind: 'workshop',
      label: recipe.skill === 'smithing' ? 'Smithing' : 'Workshop',
      detail: `${recipe.name}${inputs ? ` · ${inputs}` : ''}`,
    });
  }

  if ((E.salvage.outputs as Record<string, number>)[id]) {
    out.push({ kind: 'salvage', label: 'Salvage', detail: 'Dissolve gear at the Craft bench' });
  }

  return out;
}

/** A short line for a material row or a title attribute. */
export function sourceLine(id: string): string {
  return materialSources(id).map((source) => `${source.label}: ${source.detail}`).join(' · ');
}
