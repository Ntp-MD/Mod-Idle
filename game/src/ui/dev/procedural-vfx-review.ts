import { SKILL_VFX_POOL, setActiveVfxVersion, type VfxCameraAtlas, type VfxPhase, type VfxVersion } from '../fx/catalog';

const REVIEW_ROOT = '../../../../docs/vfx-skill/component-vfx/outputs/animated/';
const reviewAtlases = import.meta.env.DEV ? import.meta.glob<string>(
  '../../../../docs/vfx-skill/component-vfx/outputs/animated/*/*/*/atlas.png',
  { eager: true, query: '?url', import: 'default' }) : {};
const reviewMetadata = import.meta.env.DEV ? import.meta.glob(
  '../../../../docs/vfx-skill/component-vfx/outputs/animated/*/meta.json',
  { eager: true, import: 'default' }) : {};

/** Catalog adapter injected into DEV fixtures; app modules do not import the UI. */
export function selectProceduralVfxReview(component: string, skillId: string): void {
  if (!import.meta.env.DEV) return;
  const meta = reviewMetadata[`${REVIEW_ROOT}${component}/meta.json`] as {
    frame: { width: number; height: number; count: number; columns: number; rows: number };
    fps: number; durationSec: number; posterFrame: number;
    directional: { presets: VfxCameraAtlas[] };
  } | undefined;
  if (!meta) throw new Error(`Unbuilt VFX review component: ${component}`);
  const presets = meta.directional.presets.map(preset => ({ ...preset,
    sources: Object.fromEntries(Object.entries(preset.sources).map(([direction, relative]) => {
      const source = reviewAtlases[`${REVIEW_ROOT}${component}/${relative}`];
      if (!source) throw new Error(`Unbuilt VFX review atlas: ${component}/${relative}`);
      return [direction, source];
    })) as VfxCameraAtlas['sources'],
  }));
  const phases: Record<string, VfxPhase> = { 'charge-gather': 'Windup', 'motion-trail': 'Travel' };
  const version: VfxVersion = { id: `review-${component}`, label: `3D review: ${component}`,
    directional: { presets }, posterFrame: meta.posterFrame,
    binding: component === 'contact-flash' || component === 'motion-trail' ? 'contact' : 'caster',
    sizePolicy: 'world', phases: [phases[component] ?? 'Impact'],
    authoring: { delivery: component === 'motion-trail' ? 'projectile' : 'support',
      spanM: presets[0].orthographicSpanM, depthM: presets[0].orthographicSpanM },
    frames: { opening: [0,23], loop: [4,17], exit: [18,23] },
    layers: [{ id: component, role: 'upright', src: presets[0].sources.east,
      frame: meta.frame, fps: meta.fps, loop: false }],
  };
  const pool = SKILL_VFX_POOL[skillId];
  if (!pool.some(row => row.id === version.id)) pool.push(version);
  setActiveVfxVersion(skillId, version.id);
}
