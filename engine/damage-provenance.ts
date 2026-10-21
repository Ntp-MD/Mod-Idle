/**
 * Typed damage-packet provenance — the outgoing contract of
 * `docs/passive-tree-keystones-draft.md` §7.2. Pure: no imports beyond itself, no RNG, no globals.
 *
 * A damage packet describes ONE damage event against ONE target: which pool each raw part came from
 * (crit-eligible physical, physical that never takes crit, magic, and the three elemental lanes),
 * what phase it belongs to, and which rights it carries (crit, status, leech, kill effects). D1
 * builds these packets beside the existing math without moving a number; the keystone packets read
 * the parts and flags instead of re-deriving them.
 */

export interface DamageParts {
  /** The physical pool that took part in the crit roll, as it stands after crit and conversion. */
  physicalCritEligible: number;
  /** Physical added after the crit roll — a per-target HP-pool term rides here, never the crit pool. */
  physicalNonCrit: number;
  /** The magic share of the non-elemental part. */
  magic: number;
  /** The element pools the build already carried, keyed by canonical element (`''` = headline res). */
  nativeElement: Record<string, number>;
  /** The physical share routed into elements by conversion, after crit, before mitigation. */
  convertedElement: Record<string, number>;
  /** The as-extra elemental bonus a keystone adds (§7.2.8, key 65). Always empty until that packet. */
  extraElement: Record<string, number>;
}

export interface DamageFlags {
  /** Which phase the event belongs to — exactly one of these is true. */
  direct: boolean;
  secondary: boolean;
  dot: boolean;
  deferred: boolean;
  canCrit: boolean;
  canStatus: boolean;
  canLeech: boolean;
  canTriggerKillEffect: boolean;
}

export interface DamagePacket {
  /** The action that dealt it: the swing, or the skill row's id. */
  sourceActionId: string;
  actorId: string;
  targetId: string;
  /** Absolute µs on the simulation clock, or null while the combat clock (D2) has no value yet. */
  timeUs: number | null;
  /** The action's nominal hits-per-second the DoT budget is priced from (§7.6). */
  nominalRate: number;
  flags: DamageFlags;
  parts: DamageParts;
}

export function emptyParts(): DamageParts {
  return {
    physicalCritEligible: 0, physicalNonCrit: 0, magic: 0,
    nativeElement: {}, convertedElement: {}, extraElement: {},
  };
}

/** The non-elemental total, in the order the existing mitigation reads it. */
export const nonElementTotal = (p: DamageParts): number =>
  p.physicalCritEligible + p.physicalNonCrit + p.magic;

/** Every elemental part merged onto one map — the shape `mitigateMobHit` answers. */
export function elementalByElement(p: DamageParts): Record<string, number> {
  const out: Record<string, number> = {};
  for (const map of [p.nativeElement, p.convertedElement, p.extraElement])
    for (const [el, v] of Object.entries(map)) out[el] = (out[el] || 0) + v;
  return out;
}

export function directFlags(crit: boolean, status: boolean, leech: boolean): DamageFlags {
  return {
    direct: true, secondary: false, dot: false, deferred: false,
    canCrit: crit, canStatus: status, canLeech: leech, canTriggerKillEffect: true,
  };
}

const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Refuse a packet whose parts or ids are not what the save and the handlers may trust. */
export function validateDamagePacket(packet: DamagePacket): DamagePacket {
  if (!packet || typeof packet !== 'object') throw new Error('damage packet must be an object');
  if (typeof packet.sourceActionId !== 'string' || !packet.sourceActionId) throw new Error('damage packet: sourceActionId must name the action');
  if (typeof packet.actorId !== 'string' || !packet.actorId) throw new Error('damage packet: actorId must name the actor');
  if (typeof packet.targetId !== 'string' || !packet.targetId) throw new Error('damage packet: targetId must name the target');
  if (packet.timeUs !== null && !(typeof packet.timeUs === 'number' && Number.isSafeInteger(packet.timeUs) && packet.timeUs >= 0))
    throw new Error('damage packet: timeUs must be a non-negative safe integer of µs or null');
  if (!num(packet.nominalRate) || packet.nominalRate < 0) throw new Error('damage packet: nominalRate must be a finite number, zero or more');
  for (const [k, v] of Object.entries(packet.parts))
    if (k === 'nativeElement' || k === 'convertedElement' || k === 'extraElement') {
      for (const [el, n] of Object.entries(v as Record<string, number>))
        if (!num(n) || (n as number) < 0) throw new Error(`damage packet: parts.${k}.${el} must be a finite number, zero or more`);
    } else if (!num(v) || (v as number) < 0) {
      throw new Error(`damage packet: parts.${k} must be a finite number, zero or more`);
    }
  return packet;
}
