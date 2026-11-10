import { DEFAULT_SHOWCASE_SAMPLE, isShowcaseSample, type ShowcaseSampleId } from './samples';

export type ShowcaseEffects = 'full' | 'reduced' | 'minimal';

export interface ShowcaseBoot {
  sample: ShowcaseSampleId;
  skill: string | null;
  spriteSpecies: string | null;
  spriteVariant: string | null;
  spritePreview: boolean;
  mechanic: string | null;
  playerWeapon: string | null;
  playerOffhand: string | null;
  aoePreview: boolean;
  vfx: 'base' | 'auto' | null;
  effects: ShowcaseEffects | null;
}

const EFFECTS: readonly ShowcaseEffects[] = ['full', 'reduced', 'minimal'];

/** Pure showcase query reader: no DOM writes, no state, no mechanic import. */
export function readShowcaseBoot(pathname: string, search: string, dev: boolean): ShowcaseBoot | null {
  if (!dev || pathname.replace(/\/+$/, '') !== '/__showcase') return null;
  const query = new URLSearchParams(search);
  const sample = query.get('sample');
  const effects = query.get('effects');
  const vfx = query.get('vfx');
  return {
    sample: isShowcaseSample(sample) ? sample : DEFAULT_SHOWCASE_SAMPLE,
    skill: query.get('skill'),
    spriteSpecies: query.get('sprite-species'),
    spriteVariant: query.get('sprite-variant'),
    spritePreview: query.get('sprite-preview') !== 'fallback',
    mechanic: query.get('mechanic'),
    playerWeapon: query.get('player-weapon'),
    playerOffhand: query.get('player-offhand'),
    aoePreview: query.get('aoe-preview') === '1',
    vfx: vfx === 'base' ? 'base' : vfx == null ? null : 'auto',
    effects: EFFECTS.includes(effects as ShowcaseEffects) ? effects as ShowcaseEffects : null,
  };
}
