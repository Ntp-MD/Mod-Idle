import { describe, expect, it } from 'vitest';
import { materialSources } from '@sim/gear/material-sources';

describe('material sources', () => {
  it('names the Mine zones for ore', () => {
    const sources = materialSources('iron-ore');
    expect(sources.some((source) => source.kind === 'mine')).toBe(true);
    expect(sources.find((source) => source.kind === 'mine')!.detail.length).toBeGreaterThan(0);
  });

  it('names the Grove zones for wood', () => {
    expect(materialSources('pine-wood').some((source) => source.kind === 'grove')).toBe(true);
  });

  it('names a Hunt source for a monster material', () => {
    expect(materialSources('thick-pelt').some((source) => source.kind === 'hunt')).toBe(true);
  });

  it('names the Smithing recipe for a processed bar', () => {
    const sources = materialSources('iron-bar');
    expect(sources.some((source) => source.kind === 'workshop' && source.label === 'Smithing')).toBe(true);
  });

  it('names Salvage as an iron-ore source', () => {
    expect(materialSources('iron-ore').some((source) => source.kind === 'salvage')).toBe(true);
  });

  it('names the generic field action for generic ore', () => {
    expect(materialSources('ore').some((source) => source.label === 'Field mine')).toBe(true);
  });

  it('returns no sources for an unknown id', () => {
    expect(materialSources('not-a-material')).toEqual([]);
  });
});
