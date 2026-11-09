import { BASES } from '../../../engine/client';
import { pixelArenaArt } from './arena-art-pixel-v2';
import type { ArenaCharacterArt, ArenaSpriteFrameImage } from './arena-art';
import { arenaScreenAngleFor } from '../../../presentation/arena-camera';
import equipment from './player-equipment-v1.json';
import type { Character } from '@sim/core/player';
import type { GameState, Item } from '@sim/core/types';

type Point = { x: number; y: number };
type Bounds = [number, number, number, number];
type EquipmentView = {
  href: string;
  imageWidth: number;
  imageHeight: number;
  rawAlphaBounds: Bounds | null;
  visibleBoundsAlphaGt8: Bounds;
  pivotSource: Point;
  forwardAxisSource: Point;
  pivotProvenance: string;
  tolerancePx: number;
};
type EquipmentRecord = {
  targetLengthBodyHeightRatio: number;
  attachmentHand: 'main' | 'offhand';
  views: Record<string, EquipmentView>;
};
type EquipmentFrame = ArenaSpriteFrameImage;

const source = equipment as unknown as {
  weapons: Record<string, EquipmentRecord>;
  shield: { targetHeightBodyHeightRatio: number; attachmentHand: 'off'; views: Record<string, EquipmentView> };
};

/** Pawn body is the default; worn weapons and shields stay as separate layers. */
export const equippedPlayerArt: ArenaCharacterArt = pixelArenaArt.hero;

export type ArenaEquipmentLayer = {
  href: string;
  imageWidth: number;
  imageHeight: number;
  clipBounds: Bounds;
  transform: string;
  kind: 'weapon' | 'shield';
};

function baseRow(base: string) {
  return (BASES.bases as { name: string; family?: string | null }[]).find(row => row.name === base);
}

/** Resolve the exact canonical frame name to its weapon family without guessing from melee/ranged group. */
function weaponTypeOf(base: string): { id: string; hands: string } | undefined {
  const weapons = BASES.weapons as { name: string; hands?: string }[];
  const direct = weapons.find(weapon => weapon.name === base);
  if (direct) return { id: direct.name, hands: direct.hands ?? 'Single' };
  for (const [id, frames] of Object.entries(BASES.weapon_frames as Record<string, { name: string }[]>)) {
    if (frames.some(frame => frame.name === base))
      return { id, hands: weapons.find(weapon => weapon.name === id)?.hands ?? 'Single' };
  }
  return undefined;
}

function itemView(view: EquipmentView, grip: Point, bodyHeight: number, desiredLength: number, facing: number): ArenaEquipmentLayer {
  const [left, top, right, bottom] = view.visibleBoundsAlphaGt8;
  const width = right - left, height = bottom - top;
  const axis = view.forwardAxisSource;
  const along = Math.max(1, width * Math.abs(axis.x) + height * Math.abs(axis.y));
  const scale = bodyHeight * desiredLength / along;
  const screenFacing = arenaScreenAngleFor({ x: Math.cos(facing), y: Math.sin(facing) });
  const eastReference = arenaScreenAngleFor({ x: 1, y: 0 });
  const rotation = (screenFacing - eastReference) * 180 / Math.PI;
  const transform = `translate(${grip.x} ${grip.y}) rotate(${rotation}) scale(${scale}) translate(${-view.pivotSource.x} ${-view.pivotSource.y})`;
  return { href: view.href, imageWidth: view.imageWidth, imageHeight: view.imageHeight,
    clipBounds: view.visibleBoundsAlphaGt8, transform, kind: 'weapon' };
}

function shieldView(view: EquipmentView, grip: Point, bodyHeight: number, desiredHeight: number): ArenaEquipmentLayer {
  const [, top, , bottom] = view.visibleBoundsAlphaGt8;
  const scale = bodyHeight * desiredHeight / Math.max(1, bottom - top);
  return {
    href: view.href,
    imageWidth: view.imageWidth,
    imageHeight: view.imageHeight,
    clipBounds: view.visibleBoundsAlphaGt8,
    transform: `translate(${grip.x} ${grip.y}) scale(${scale}) translate(${-view.pivotSource.x} ${-view.pivotSource.y})`,
    kind: 'shield',
  };
}

/** Build equipment layers at the current actor's measured main/offhand cell sockets. */
export function playerEquipmentLayers(args: {
  state: GameState;
  character: Character;
  frame?: Pick<EquipmentFrame, 'mainGripCell' | 'offGripCell'>;
  bodyHeight: number;
  clip: string;
  phase?: string;
  facing: number;
}): ArenaEquipmentLayer[] {
  const { state, character, frame, bodyHeight, clip, phase, facing } = args;
  if (!frame || !(bodyHeight > 0)) return [];
  const mainHand = state.gear.find((item): item is Item => !!item && !item.broken && item.slot === 'main hand');
  const base = mainHand?.base ?? character.weaponName;
  const weaponType = weaponTypeOf(base);
  const record = weaponType ? source.weapons[weaponType.id] : undefined;
  const layers: ArenaEquipmentLayer[] = [];
  const phaseKey = clip === 'attack'
    ? phase === 'windup' ? 'raised'
      : phase === 'contact' || phase === 'active' ? 'foreshortened'
        : 'side'
    : 'side';
  const isRanged = weaponType?.id === 'bow' || weaponType?.id === 'crossbow';
  const selectedView = isRanged
    ? clip === 'attack' && phase === 'windup' ? 'drawn'
      : clip === 'attack' && (phase === 'contact' || phase === 'active') ? 'released'
        : 'ready'
    : phaseKey;

  const mainGrip = frame.mainGripCell;
  if (record && mainGrip) {
    const view = record.views[selectedView] ?? record.views.side ?? record.views.ready;
    if (view) layers.push(itemView(view, mainGrip, bodyHeight, record.targetLengthBodyHeightRatio, facing));
  }

  const offhand = state.gear.find((item): item is Item => !!item && !item.broken && item.slot === 'off hand');
  const offhandFamily = offhand ? baseRow(offhand.base)?.family : undefined;
  const offGrip = frame.offGripCell;
  if (offhandFamily === 'Shield' && offGrip) {
    const stow = weaponType?.hands === 'Two' || weaponType?.hands === 'Two (range)';
    const view = source.shield.views[stow ? 'stowed' : 'front'] ?? source.shield.views.front;
    if (view) {
      const sign = Math.cos(facing) < 0 ? -1 : 1;
      const grip = stow ? { x: offGrip.x - sign * bodyHeight * .18, y: offGrip.y - bodyHeight * .35 } : offGrip;
      layers.push(shieldView(view, grip, bodyHeight, source.shield.targetHeightBodyHeightRatio));
    }
  }
  return layers;
}
