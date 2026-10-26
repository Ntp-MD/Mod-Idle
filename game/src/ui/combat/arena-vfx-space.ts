import type { SkillAreaSnapshot } from '../../../../engine/types';
import { projectArenaPoint } from './combat-arena-view';

export type VfxFootprint = {
  center: {x:number; y:number};
  basisX: {x:number; y:number};
  basisY: {x:number; y:number};
  diameter: number;
  /** Directional footprints keep their world geometry; the shape component projects it. */
  shape?: 'line' | 'cone';
  worldCenter?: {x:number; y:number};
  lengthM?: number;
  widthM?: number;
  angleDeg?: number;
  directionRad?: number;
};

/** Presentation-only foot ring: a level ellipse matching the painted arena camera. */
export function groundAuraFootprint(center: {x:number; y:number}, radius = 72): VfxFootprint {
  return {center, basisX:{x:radius,y:0}, basisY:{x:0,y:radius*.34}, diameter:radius*2};
}

/** UI clock input from one combat action; all values are seconds on the same clock. */
export type VfxTiming = {
  startedAtSec:number;
  releasedAtSec:number;
  impactAtSec:number;
  nowSec:number;
};

/** Project the combat action's frozen footprint; this never selects targets. */
export function projectVfxFootprint(area: SkillAreaSnapshot): VfxFootprint | undefined {
  const directed = area.shape === 'line' || area.shape === 'cone';
  if (!directed && area.radiusM <= 0) return undefined;
  const center = projectArenaPoint(area.center);
  const reach = area.shape === 'line' ? (area.lengthM ?? area.radiusM) : area.radiusM;
  const x = projectArenaPoint({x:area.center.x+Math.max(1, reach),y:area.center.y});
  const y = projectArenaPoint({x:area.center.x,y:area.center.y+Math.max(1, reach)});
  const basisX = {x:x.x-center.x,y:x.y-center.y};
  const basisY = {x:y.x-center.x,y:y.y-center.y};
  const diameter = 2*Math.max(Math.hypot(basisX.x,basisX.y),Math.hypot(basisY.x,basisY.y));
  if (!directed) return {center,basisX,basisY,diameter};
  return {
    center, basisX, basisY, diameter,
    shape: area.shape as 'line' | 'cone',
    worldCenter: { x: area.center.x, y: area.center.y },
    lengthM: area.shape === 'line' ? (area.lengthM ?? area.radiusM) : area.radiusM,
    widthM: area.widthM,
    angleDeg: area.angleDeg,
    directionRad: area.directionRad ?? 0,
  };
}
