import { describe, expect, it } from 'vitest';
import type { NavLayout } from '@engine/navigation.ts';
import { arenaTarget, createCombatArena } from '@sim/combat/combat-arena';
import { mobFixture } from '../fixtures/mobFixture';

function scene() {
  const arena = createCombatArena();
  Object.assign(arena.player, { x: 5, y: 10 });
  const group = [
    ['near', 8, 10],
    ['far', 5, 14],
  ].map(([id, x, y]) => {
    const mob = mobFixture({ id: id as string, hp: 1000, hpMax: 1000 });
    arena.mobs[id as string] = { id, x, y, facing: 0, moving: false, radiusM: 0.3, hp: 1000, hpMax: 1000 } as never;
    return mob;
  });
  return { arena, group };
}

const sightScreen = (): NavLayout => ({
  version: 1, bounds: { x: 0, y: 0, width: 50, height: 32 }, cellSize: 1,
  obstacles: [{ kind: 'box', id: 'screen', x: 6.5, y: 0, width: 1, height: 20,
    flags: { movement: false, sight: true, projectiles: false } }],
});

describe('P2 acquisition — authored sight screens', () => {
  it('takes the nearest body when no geometry is authored', () => {
    const { arena, group } = scene();
    expect(arenaTarget(arena, group)?.id).toBe('near');
  });

  it('skips a body hidden behind a sight screen', () => {
    const { arena, group } = scene();
    arena.nav = sightScreen();
    expect(arenaTarget(arena, group)?.id).toBe('far');
  });

  it('keeps a deliberate focus even when the screen hides it', () => {
    const { arena, group } = scene();
    arena.nav = sightScreen();
    arena.focusId = 'near';
    expect(arenaTarget(arena, group)?.id).toBe('near');
  });

  it('does not hide a body behind a movement-only wall', () => {
    const { arena, group } = scene();
    arena.nav = {
      version: 1, bounds: { x: 0, y: 0, width: 50, height: 32 }, cellSize: 1,
      obstacles: [{ kind: 'box', id: 'wall', x: 6.5, y: 0, width: 1, height: 20,
        flags: { movement: true, sight: false, projectiles: true } }],
    };
    expect(arenaTarget(arena, group)?.id).toBe('near');
  });
});
