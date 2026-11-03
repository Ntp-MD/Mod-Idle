/**
 * The animation manifest contract: one runtime identity resolves to one rig and its clips, or to
 * a named fallback. The simulation owns start/release/impact/recovery times; a clip never owns a
 * damage event. `docs/animation.md` is the ownership note, and `validateAnimationManifest` is the
 * gate every imported set must pass before an identity may point at it.
 *
 * Clips are authored in metres with the feet at the root pivot. A clip declares presentation
 * markers (`release`, `impact`) as fractions of its own length only so a renderer can align the
 * pose; gameplay reads the sim's microsecond timing, never these markers.
 */
export type AnimationPhase = 'idle' | 'walk' | 'turn' | 'windup' | 'release' | 'recovery' | 'channel' | 'hit' | 'death' | 'despawn';

export interface AnimationClip {
  name: string;
  phase: AnimationPhase;
  /** Seconds; presentation only. */
  durationSec: number;
  /** Presentation markers in [0, 1], not gameplay events. */
  release?: number;
  impact?: number;
  /** A phase that must not be shortened below this length (F44). */
  minPhaseSec?: number;
}

export interface AnimationRig {
  /** A model resolved from the art shelf; lowercase-hyphen file stem. */
  model: string;
  skeleton: string;
  /** Root/feet pivot in metres from the model origin. */
  feetPivot: { x: number; y: number; z: number };
  sockets: Record<string, string>;
  clips: Record<string, AnimationClip>;
}

export interface AnimationIdentity {
  rig?: AnimationRig;
  /** The sprite set a missing rig falls back to; the name is reported, never silent. */
  sprite: string;
}

export interface AnimationManifest {
  units: 'metres';
  scale: number;
  /** The phase floor every windup/recovery must be able to play (F44). */
  phaseFloorSec: number;
  player: Record<'melee' | 'ranged' | 'magic', AnimationIdentity>;
  species: Record<string, AnimationIdentity>;
}

const REQUIRED_CLIPS: Record<string, AnimationPhase[]> = {
  locomotion: ['idle', 'walk', 'turn'],
  action: ['windup', 'release', 'recovery'],
  outcome: ['hit', 'death'],
};

function validPivot(pivot: AnimationRig['feetPivot']): boolean {
  return !!pivot && Number.isFinite(pivot.x) && Number.isFinite(pivot.y) && Number.isFinite(pivot.z)
    && Math.abs(pivot.y) < 1e-9;
}

/** Every identity either owns a complete rig or names the sprite it actually renders as. */
export function validateAnimationManifest(manifest: AnimationManifest, speciesIds: readonly string[]): string[] {
  const problems: string[] = [];
  if (manifest.units !== 'metres') problems.push('units must be metres');
  if (!(manifest.scale > 0)) problems.push('scale must be positive');
  if (!(manifest.phaseFloorSec >= 0)) problems.push('phaseFloorSec must be non-negative');
  const check = (label: string, identity: AnimationIdentity) => {
    if (!identity.sprite) problems.push(`${label}: a sprite fallback is required when no rig resolves`);
    const rig = identity.rig;
    if (!rig) return;
    if (!/^[a-z0-9-]+$/.test(rig.model)) problems.push(`${label}: model must be a lowercase-hyphen stem`);
    if (!rig.skeleton) problems.push(`${label}: skeleton is required`);
    if (!validPivot(rig.feetPivot)) problems.push(`${label}: feet pivot must be authored in metres with y = 0`);
    for (const [socket, bone] of Object.entries(rig.sockets)) {
      if (!socket || !bone) problems.push(`${label}: socket ${socket || '(empty)'} must name a bone`);
    }
    for (const [family, phases] of Object.entries(REQUIRED_CLIPS)) {
      const clips = Object.values(rig.clips).filter((clip) => phases.includes(clip.phase));
      if (!clips.length) problems.push(`${label}: ${family} is missing (${phases.join(', ')})`);
      for (const clip of clips) {
        if (!(clip.durationSec > 0)) problems.push(`${label}: clip ${clip.name} has no length`);
        for (const marker of [clip.release, clip.impact]) {
          if (marker != null && (!(marker >= 0) || !(marker <= 1))) problems.push(`${label}: clip ${clip.name} marker outside 0..1`);
        }
        if ((clip.phase === 'windup' || clip.phase === 'recovery')
          && clip.minPhaseSec != null && clip.minPhaseSec < manifest.phaseFloorSec - 1e-9) {
          problems.push(`${label}: clip ${clip.name} is below the phase floor`);
        }
      }
    }
  };
  for (const group of ['melee', 'ranged', 'magic'] as const) check(`player.${group}`, manifest.player[group]);
  for (const id of speciesIds) {
    const identity = manifest.species[id];
    if (!identity) { problems.push(`species.${id}: no identity and no named fallback`); continue; }
    check(`species.${id}`, identity);
  }
  for (const id of Object.keys(manifest.species)) {
    if (!speciesIds.includes(id)) problems.push(`species.${id}: not in the canonical roster`);
  }
  return problems;
}

export type AnimationResolution =
  | { kind: 'rig'; identity: string; model: string; clips: Record<string, AnimationClip>; sockets: Record<string, string> }
  | { kind: 'sprite'; identity: string; fallback: string; reason: 'no-rig' };

/** One lookup for every renderer: the identity names what it actually draws. */
export function resolveAnimation(manifest: AnimationManifest, identity: string): AnimationResolution {
  const [kind, ...rest] = identity.split('.');
  const found = kind === 'player'
    ? manifest.player[rest.join('.') as 'melee' | 'ranged' | 'magic']
    : manifest.species[rest.join('.')];
  if (found?.rig) {
    return { kind: 'rig', identity, model: found.rig.model, clips: found.rig.clips, sockets: found.rig.sockets };
  }
  return { kind: 'sprite', identity, fallback: found?.sprite ?? 'unknown', reason: 'no-rig' };
}

/**
 * The shipped set has no production rig: every identity resolves to the sprite it already draws,
 * under its own name. The two source stand-ins remain DEV-only inspections, not runtime rigs.
 * A species fallback names the shelf identity a renderer actually uses, so a missing rig is
 * reported by name instead of silently drawing a default.
 */
export function shippedAnimationManifest(species: readonly { id: string }[]): AnimationManifest {
  return {
    units: 'metres',
    scale: 1,
    phaseFloorSec: 0.1,
    player: {
      melee: { sprite: 'player-equipped-melee' },
      ranged: { sprite: 'player-equipped-ranged' },
      magic: { sprite: 'player-equipped-magic' },
    },
    species: Object.fromEntries(species.map(({ id }) => [id, { sprite: `sprite-${id}` }])),
  };
}
