/**
 * One click, one decision. The HUD owns its own pointer events; below it the arena resolves in a
 * fixed order: an armed skill, then target/focus, then inspect, then ground. Keeping the order in
 * one pure function means a renderer or a keyboard path cannot invent a second priority.
 */
export type ArenaPick =
  | { kind: 'hud' }
  | { kind: 'armed-skill'; actorId?: string; point: { x: number; y: number } }
  | { kind: 'target'; actorId: string }
  | { kind: 'inspect'; actorId: string }
  | { kind: 'ground'; point: { x: number; y: number } };

export interface ArenaPickInput {
  /** The pointer landed on a HUD control; it never reaches the arena. */
  hud?: boolean;
  /** A skill is armed, so the next ground or body click is its aim. */
  armedSkill?: boolean;
  actorId?: string | null;
  /** The click carries the inspect modifier (Alt) instead of the ordinary target press. */
  inspect?: boolean;
  /** The body is already the committed target; a plain press keeps it rather than opening a panel. */
  actorIsTarget?: boolean;
  /** World point under the pointer or the keyboard reticle. */
  point: { x: number; y: number };
}

export function resolveArenaPick(input: ArenaPickInput): ArenaPick {
  if (input.hud) return { kind: 'hud' };
  const actorId = input.actorId || undefined;
  if (input.armedSkill) {
    return { kind: 'armed-skill', ...(actorId ? { actorId } : {}), point: { ...input.point } };
  }
  if (actorId && !input.inspect) {
    // An ordinary press targets a body. The inspect panel is a deliberate modifier, never the
    // default a player gets while trying to commit to a kill.
    return { kind: 'target', actorId };
  }
  if (actorId) return { kind: 'inspect', actorId };
  return { kind: 'ground', point: { ...input.point } };
}

/** One keyboard step for the aiming reticle, in arena metres. */
export function moveAimPoint(
  point: { x: number; y: number },
  direction: 'north' | 'south' | 'west' | 'east',
  step = 0.5,
  bounds?: { width: number; height: number },
): { x: number; y: number } {
  const dx = direction === 'east' ? step : direction === 'west' ? -step : 0;
  const dy = direction === 'south' ? step : direction === 'north' ? -step : 0;
  const next = { x: point.x + dx, y: point.y + dy };
  if (!bounds) return next;
  return {
    x: Math.max(0, Math.min(bounds.width, next.x)),
    y: Math.max(0, Math.min(bounds.height, next.y)),
  };
}
