import { sm } from '../../engine/client';
import { arenaSkillRange } from '@sim/combat/combat-arena';
import { mobSkillById } from '@sim/combat/mobSkills';

/**
 * Per-skill presentation spec for the live arena, authored for the game's one camera.
 *
 * The arena projects the ground plane through the oblique basis in `presentation/arena-camera.ts`
 * (world +x → screen (137.5, -26.2) px, world +y → (32.7, 98.2) px per metre), so a world circle
 * lands as a skewed ellipse and verticals stay vertical. This module therefore stores every size
 * in **world metres** and every particle count as an explicit integer; the renderer is the only
 * place that converts metres to pixels, so angle, viewpoint and range can never drift from the
 * projection the simulation uses for hit tests.
 *
 * Sizing contract:
 * - `radiusM` / `lengthM` / `widthM` / `angleDeg` mirror the canonical row's `area` (or its cast
 *   profile reach when the row carries no area) — never a hand-picked screen size.
 * - `heightM` is the upright burst height above the ground anchor; `apexM` is a lob's flight apex.
 *   Both convert at `VFX_HEIGHT_PX_PER_M`, matching the body-lift convention (48 px at 0.52 m).
 * - `particles` is the deliberate budget per stage; the renderer draws exactly these counts,
 *   deterministically seeded, so any skill looks identical on every cast.
 */

export type SkillVfxFamily = 'fire' | 'cold' | 'lightning' | 'earth' | 'poison' | 'chaos' | 'physical';

export type SkillVfxForm =
  | 'bolt'     // straight projectile from caster to the hit point
  | 'lob'      // arcing comet to a committed ground point
  | 'strike'   // melee/instant hit at the target body
  | 'cleave'   // melee cone sweep from the caster
  | 'line'     // ground line wave from the caster
  | 'nova'     // expanding ring centred on the caster
  | 'cone'     // sustained cone spray from the caster
  | 'chain'    // chain hops between targets
  | 'skybolt'  // vertical bolt column on a ground point
  | 'sigil'    // planted ground mark that erupts after its lead time
  | 'field'    // sustained ground field with a continuous particle loop
  | 'channel'  // rotating caster-centred channel
  | 'volley';  // simultaneous fan of projectiles onto a point

export interface SkillVfxParticles {
  /** Windup motes pulled inward while the cast charges. */
  gather: number;
  /** Impact scatter bodies thrown outward on the ground plane. */
  burst: number;
  /** Upright motes rising from the anchor in the screen-vertical plane. */
  embers: number;
  /** Ground debris pieces that stay where they land. */
  ground: number;
  /** Simultaneous bodies in the sustained loop (fields/channels only; 0 otherwise). */
  loop: number;
  /** Trail segments behind a travelling sprite (0 for no sprite). */
  trail: number;
}

export interface SkillVfxSpec {
  id: string;
  name: string;
  family: SkillVfxFamily;
  form: SkillVfxForm;
  element: string;
  cue: 'attack' | 'heal' | 'ward' | 'curse' | 'aura';
  fieldStyle?: 'meteor' | 'snow' | 'lightning' | 'sand';
  radiusM: number;
  lengthM: number;
  widthM: number;
  angleDeg: number;
  rangeM: number;
  heightM: number;
  apexM: number;
  particles: SkillVfxParticles;
  projectile: boolean;
  lob: boolean;
  /** Discrete impact beats for folded multihit rows; split rows keep 1. */
  pulses: number;
}

type Partials = Partial<Omit<SkillVfxSpec, 'id' | 'name' | 'family' | 'element' | 'particles'>> & {
  particles?: Partial<SkillVfxParticles>;
};

/** Family budgets; a skill's row overrides any field. Counts are design decisions, not guesses. */
const FAMILY: Record<SkillVfxFamily, SkillVfxParticles & { heightM: number; apexM: number }> = {
  fire:      { gather: 7,  burst: 16, embers: 12, ground: 8,  loop: 0,  trail: 6, heightM: 1.5, apexM: 2.2 },
  cold:      { gather: 6,  burst: 14, embers: 9,  ground: 10, loop: 0,  trail: 5, heightM: 1.6, apexM: 2.0 },
  lightning: { gather: 5,  burst: 18, embers: 6,  ground: 4,  loop: 0,  trail: 8, heightM: 2.4, apexM: 3.2 },
  earth:     { gather: 5,  burst: 12, embers: 5,  ground: 14, loop: 0,  trail: 4, heightM: 1.2, apexM: 1.4 },
  poison:    { gather: 6,  burst: 12, embers: 10, ground: 8,  loop: 0,  trail: 7, heightM: 1.3, apexM: 1.8 },
  chaos:     { gather: 6,  burst: 15, embers: 8,  ground: 6,  loop: 0,  trail: 6, heightM: 1.8, apexM: 2.4 },
  physical:  { gather: 4,  burst: 10, embers: 0,  ground: 4,  loop: 0,  trail: 0, heightM: .5,  apexM: 0 },
};

/**
 * The authored pass. One row per live attack skill; anything not listed here still resolves a
 * family-default spec, but the cage test fails the data until every live attack id is authored.
 * `pulses` mirrors folded multihit rows (Water Ball 5, Double Strike 2) and ignores rows whose
 * impacts the tick already splits — repeating those would strobe.
 */
const DESIGN: Record<string, Partials> = {
  // ── Fire ──────────────────────────────────────────────────────────────────
  'attack.fireball': { projectile: true, heightM: 1.1, particles: { trail: 7 } },
  'attack.firestorm': { lob: true, particles: { burst: 20, embers: 14, ground: 10, gather: 0, trail: 8 } },
  'attack.meteor': { lob: true, apexM: 3.4, particles: { burst: 24, embers: 16, ground: 14, gather: 0, trail: 10 } },
  'attack.ignite': { form: 'strike', heightM: 1.4, particles: { burst: 12, embers: 10 } },
  'attack.cinder_nova': { form: 'nova', particles: { burst: 18, embers: 14, ground: 12, gather: 8 } },
  // ── Cold ──────────────────────────────────────────────────────────────────
  'attack.ice_lance': { form: 'bolt', projectile: true, particles: { trail: 8 } },
  'attack.blizzard': { form: 'field', lob: true, particles: { loop: 16, ground: 8, gather: 0, trail: 5 } },
  'attack.frostbite': { form: 'strike', heightM: 2.2, particles: { burst: 16, embers: 8, ground: 8 } },
  'attack.frost_nova': { form: 'nova', heightM: .9, particles: { burst: 14, embers: 10, ground: 16, gather: 8 } },
  'attack.water_ball': { projectile: true, pulses: 5, particles: { trail: 7, burst: 10 } },
  'attack.glacial_spike': { projectile: true, heightM: 2.4, particles: { trail: 6, burst: 16, ground: 8 } },
  'attack.shatter': { lob: true, particles: { burst: 22, embers: 6, ground: 20, gather: 0, trail: 6 } },
  'attack.tidal_wave': { form: 'line', lob: true, heightM: 1.6, particles: { burst: 18, embers: 4, ground: 24, gather: 6 } },
  // ── Lightning ─────────────────────────────────────────────────────────────
  'attack.chain_lightning': { form: 'chain', heightM: 1.2, particles: { burst: 14, embers: 8, ground: 2, gather: 6 } },
  'attack.spark': { projectile: true, particles: { trail: 9, burst: 14 } },
  'attack.thunder_strike': { form: 'skybolt', heightM: 4.2, particles: { burst: 20, embers: 10, ground: 6, gather: 0, trail: 0 } },
  'attack.overload': { form: 'field', lob: true, particles: { loop: 12, burst: 16, ground: 6, gather: 0, trail: 7 } },
  'attack.thunder_storm': { form: 'field', lob: true, heightM: 3.6, particles: { burst: 16, embers: 12, ground: 6, gather: 0, loop: 8 } },
  'attack.unravel': { form: 'strike', projectile: true, heightM: 1.4, particles: { burst: 16, embers: 8 } },
  // ── Poison ────────────────────────────────────────────────────────────────
  'attack.poison_bolt': { projectile: true, particles: { trail: 8 } },
  'attack.acid_arrow': { projectile: true, particles: { trail: 7, burst: 10, ground: 6 } },
  'attack.poison_cloud': { form: 'field', lob: true, particles: { loop: 14, ground: 6, gather: 0, trail: 5 } },
  'attack.hemotoxin': { projectile: true, heightM: 1.4, particles: { trail: 8, burst: 12 } },
  'attack.contagion': { projectile: true, particles: { trail: 7, burst: 10, ground: 6 } },
  'attack.venom_coffin': { projectile: true, particles: { trail: 7, burst: 10, ground: 6 } },
  // ── Chaos ─────────────────────────────────────────────────────────────────
  'attack.chaos_bolt': { projectile: true, particles: { trail: 8 } },
  'attack.void_blast': { lob: true, heightM: 2.0, particles: { burst: 18, embers: 12, ground: 8, gather: 0, trail: 7 } },
  'attack.chaos_wave': { form: 'nova', particles: { burst: 16, embers: 12, ground: 8, gather: 0 } },
  'attack.void_orb': { form: 'volley', projectile: true, particles: { trail: 7, burst: 8, gather: 0 } },
  'attack.void_ray': { form: 'line', projectile: true, heightM: 1.2, particles: { trail: 8, burst: 10, gather: 0 } },
  'attack.entropy_well': { form: 'field', lob: true, particles: { loop: 12, ground: 8, gather: 0, trail: 6 } },
  // ── Earth ─────────────────────────────────────────────────────────────────
  'attack.sand_storm': { form: 'field', lob: true, particles: { loop: 18, ground: 10, gather: 0, trail: 5 } },
  'attack.earth_splitter': { form: 'sigil', heightM: 2.2, particles: { burst: 16, embers: 6, ground: 18, gather: 8 } },
  'attack.earth_shock': { lob: true, particles: { burst: 16, embers: 4, ground: 16, gather: 0, trail: 4 } },
  'attack.aftershock': { form: 'nova', heightM: 1.0, particles: { burst: 14, embers: 6, ground: 14, gather: 8 } },
  'attack.stone_spike': { form: 'sigil', heightM: 2.8, particles: { burst: 14, embers: 4, ground: 16, gather: 8 } },
  'attack.fissure': { form: 'line', heightM: 1.6, particles: { burst: 18, embers: 4, ground: 24, gather: 6 } },
  // ── Physical · melee ─────────────────────────────────────────────────────
  'attack.backstab': { form: 'strike', particles: { burst: 12, ground: 2 } },
  'attack.impale': { form: 'line', heightM: .9, particles: { burst: 12, ground: 6, gather: 4 } },
  'attack.skull_crack': { form: 'strike', heightM: .9, particles: { burst: 14, ground: 4 } },
  'attack.ground_slam': { form: 'nova', heightM: .4, particles: { burst: 12, embers: 0, ground: 16, gather: 6 } },
  'attack.cleave': { form: 'cleave', heightM: .7, particles: { burst: 14, ground: 6, gather: 4 } },
  'attack.elemental_break': { form: 'strike', heightM: 1.3, particles: { burst: 16, embers: 8, ground: 4 } },
  'attack.whirlwind': { form: 'channel', heightM: .8, particles: { loop: 10, burst: 10, ground: 6, gather: 0 } },
  'attack.shield_bash': { form: 'strike', particles: { burst: 12, ground: 4 } },
  'attack.puncture': { form: 'strike', particles: { burst: 10, ground: 2 } },
  'attack.reap': { form: 'strike', heightM: 1.0, particles: { burst: 14, ground: 4 } },
  'attack.double_strike': { form: 'strike', pulses: 2, particles: { burst: 10, ground: 2 } },
  // ── Physical · ranged ────────────────────────────────────────────────────
  'attack.piercing_shot': { form: 'line', projectile: true, heightM: .8, particles: { burst: 10, ground: 6, trail: 8, gather: 4 } },
  'attack.arrow_shower': { form: 'volley', lob: true, particles: { burst: 12, ground: 10, trail: 4, gather: 0, loop: 12 } },
  'attack.headshot': { projectile: true, particles: { trail: 6, burst: 8 } },
  'attack.split_shot': { form: 'cone', projectile: true, heightM: .8, particles: { burst: 10, ground: 6, trail: 8, gather: 4 } },
  'attack.double_strafe': { form: 'volley', projectile: true, particles: { trail: 6, burst: 8, gather: 0 } },
};

/** The authored design keys; the gate test pins them to the live attack roster. */
export const SKILL_VFX_DESIGN_IDS = Object.keys(DESIGN).sort();

const familyOf = (element?: string | null): SkillVfxFamily => {  switch (String(element ?? '').toLowerCase()) {
    case 'fire': case 'cold': case 'lightning': case 'earth': case 'poison': case 'chaos':
      return String(element).toLowerCase() as SkillVfxFamily;
    default: return 'physical';
  }
};

function formOf(row: {
  element?: string | null; group?: string | null;
  area?: { origin?: string; radius_m?: number; shape?: string; length_m?: number; width_m?: number; angle_deg?: number } | null;
  cast?: { delivery?: string } | null; action?: { kind?: string } | null;
}): SkillVfxForm {
  const area = row.area ?? undefined;
  const radius = Number(area?.radius_m ?? 0);
  const shape = area?.shape ?? (radius > 0 ? 'circle' : 'single');
  const casterOrigin = area?.origin === 'caster';
  const kind = row.action?.kind;
  const delivery = row.cast?.delivery ?? 'instant';
  if (kind === 'ray-channel') return 'line';
  if (kind === 'whirlwind-channel') return 'channel';
  if (kind === 'blizzard-field' || kind === 'sand-field' || kind === 'meteor-field' || kind === 'thunder-field') return 'field';
  if (kind === 'chain-strike') return 'chain';
  if (kind === 'targeted-burst' || kind === 'projectile-burst' || kind === 'cluster-burst') return 'volley';
  if (kind === 'ground-pulse-burst') return 'field';
  if (shape === 'line') return 'line';
  if (shape === 'cone') return casterOrigin ? 'cone' : 'cleave';
  if (delivery === 'projectile') return radius > 0 ? 'volley' : 'bolt';
  if (delivery === 'ground') {
    if (casterOrigin && radius > 0) return 'nova';
    if (radius > 0) return 'lob';
    return 'sigil';
  }
  if (delivery === 'melee') return casterOrigin && radius > 0 ? 'nova' : 'strike';
  // Instant: caster circle is a nova, a point on the target is a strike.
  return casterOrigin && radius > 0 ? 'nova' : radius > 0 ? 'lob' : 'strike';
}

/** Projectile sprites ride their delivery: a straight bolt, or an arc when the row commits ground.
 *  An authored `projectile`/`lob` in the design row overrides the derivation (e.g. a piercing line
 *  that flies). */
function flightOf(form: SkillVfxForm, delivery: string, design?: Partials): { projectile: boolean; lob: boolean } {
  const lobOverride = design?.lob;
  let base: { projectile: boolean; lob: boolean };
  if (lobOverride != null) base = { projectile: lobOverride || form === 'bolt' || form === 'volley' && delivery === 'projectile', lob: lobOverride };
  else if (form === 'bolt' || form === 'volley') base = { projectile: delivery === 'projectile', lob: false };
  else if (form === 'lob' || form === 'field' && delivery === 'ground') base = { projectile: true, lob: true };
  else base = { projectile: false, lob: false };
  return { projectile: design?.projectile ?? base.projectile, lob: base.lob };
}

/** Resolve the authored spec for one skill id. Incoming resolves mob first, player resolves sm. */
export function activeSkillVfx(id: string | undefined, incoming = false): SkillVfxSpec | null {
  if (!id) return null;
  let row: any = null;
  let resolvedType = '' as string;
  if (incoming) {
    row = mobSkillById(id);
    if (!row) return null;
    resolvedType = 'attack';
  } else {
    row = sm.byId[id];
    if (!row || row.retired) return null;
    resolvedType = row.type ?? '';
    if (!['attack', 'heal', 'buff', 'aura', 'curse'].includes(resolvedType)) return null;
    // passive rows with no action/activation produce no invented effect
    if (resolvedType !== 'attack' && !row.action && resolvedType !== 'aura') {
      // still allow heal/buff/curse with explicit type even without action kind
      if (!row.action) {
        // fall through to Base derivation below
      }
    }
  }
  const family = familyOf(row.element);
  const kind = row.action?.kind;
  let cue: SkillVfxSpec['cue'] = 'attack';
  if (resolvedType === 'heal') cue = 'heal';
  else if (resolvedType === 'buff') cue = 'ward';
  else if (resolvedType === 'curse') cue = 'curse';
  else if (resolvedType === 'aura' || kind?.includes?.('aura')) cue = 'aura';
  else if (String(row.type ?? '').startsWith('curse')) cue = 'curse';

  const form = DESIGN[id]?.form ?? formOf(row);
  const area = row.area ?? undefined;
  const radiusM = Number(area?.radius_m ?? 0);
  const lengthM = Number(area?.length_m ?? 0);
  const widthM = Number(area?.width_m ?? 0);
  const angleDeg = Number(area?.angle_deg ?? 0);
  const profile = sm.castProfileOf(incoming ? (sm.byId[id] ?? row) : row);
  const { projectile, lob } = flightOf(form, profile.delivery, DESIGN[id]);
  let budget: any = { ...FAMILY[family], ...(DESIGN[id]?.particles ?? {}) };
  // Support cues: zero debris/trails/gather; activation motes heal 6, ward/curse 4, aura 0
  if (cue === 'heal' || cue === 'ward' || cue === 'curse' || cue === 'aura') {
    budget = { ...budget, gather: 0, ground: 0, trail: 0, loop: 0 };
    if (cue === 'heal') budget.burst = 6;
    else if (cue === 'ward' || cue === 'curse') budget.burst = 4;
    else budget.burst = 0;
    if (cue === 'aura') budget.burst = 0;
  }
  // Field styles with fixed visual budgets (max simultaneous ambient bodies)
  let fieldStyle: SkillVfxSpec['fieldStyle'];
  const FIELD_BUDGET: Record<string, { style: 'meteor' | 'snow' | 'lightning' | 'sand'; loop: number }> = {
    'meteor-field': { style: 'meteor', loop: 4 },
    'blizzard-field': { style: 'snow', loop: 8 },
    'thunder-field': { style: 'lightning', loop: 4 },
    'sand-field': { style: 'sand', loop: 8 },
  };
  if (kind && FIELD_BUDGET[kind]) {
    fieldStyle = FIELD_BUDGET[kind].style;
    budget.loop = FIELD_BUDGET[kind].loop;
  } else if (id === 'attack.meteor') {
    fieldStyle = 'meteor'; budget.loop = 4;
  } else if (id === 'attack.blizzard') {
    fieldStyle = 'snow'; budget.loop = 8;
  } else if (id === 'attack.thunder_storm' || id === 'attack.thunder_strike') {
    fieldStyle = 'lightning'; budget.loop = 4;
  } else if (id === 'attack.sand_storm') {
    fieldStyle = 'sand'; budget.loop = 8;
  }
  return {
    id, name: String(row.name ?? id), family, form, element: String(row.element ?? 'physical'),
    cue, ...(fieldStyle ? { fieldStyle } : {}),
    radiusM, lengthM, widthM, angleDeg, rangeM: arenaSkillRange(id) === Infinity ? 0 : arenaSkillRange(id),
    heightM: DESIGN[id]?.heightM ?? FAMILY[family].heightM,
    apexM: DESIGN[id]?.apexM ?? FAMILY[family].apexM,
    particles: {
      gather: budget.gather, burst: budget.burst, embers: budget.embers,
      ground: budget.ground, loop: budget.loop, trail: budget.trail,
    },
    projectile, lob,
    pulses: DESIGN[id]?.pulses ?? 1,
  };
}

/** Every live attack id that must carry an authored design row; the cage test reads this. */
export function activeSkillVfxIds(): string[] {
  return Object.values(sm.byId)
    .filter((row) => ['attack', 'heal', 'buff', 'aura', 'curse'].includes(String((row as any).type)) && !(row as any).retired)
    .map((row) => String((row as any).id))
    .sort();
}
