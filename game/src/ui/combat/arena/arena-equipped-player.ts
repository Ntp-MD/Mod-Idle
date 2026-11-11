import { BASES } from '../../../engine/client';
import { pixelArenaArt } from './arena-art-pixel-v2';
import type { ArenaCharacterArt, ArenaSpriteFrameImage } from './arena-art';
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
type EquipmentFrame = ArenaSpriteFrameImage;

const source = equipment as unknown as {
  shield: { targetHeightBodyHeightRatio: number; attachmentHand: 'off'; views: Record<string, EquipmentView> };
};

/** Pawn body is the default; only a shield stays as a separate layer. Held weapons are not drawn. */
export const equippedPlayerArt: ArenaCharacterArt = pixelArenaArt.hero;

export type ArenaEquipmentLayer = {
  href: string;
  imageWidth: number;
  imageHeight: number;
  clipBounds: Bounds;
  transform: string;
  kind: 'shield';
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

/** Build equipment layers at the current actor's measured offhand socket. Weapons are not drawn. */
export function playerEquipmentLayers(args: {
  state: GameState;
  character: Character;
  frame?: Pick<EquipmentFrame, 'mainGripCell' | 'offGripCell'>;
  bodyHeight: number;
  clip: string;
  phase?: string;
  facing: number;
}): ArenaEquipmentLayer[] {
  const { state, frame, bodyHeight, facing } = args;
  if (!frame || !(bodyHeight > 0)) return [];
  const mainHand = state.gear.find((item): item is Item => !!item && !item.broken && item.slot === 'main hand');
  const base = mainHand?.base ?? args.character.weaponName;
  const weaponType = weaponTypeOf(base);
  const layers: ArenaEquipmentLayer[] = [];

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
