import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import { characterSheet, newGame } from '@sim/core/game';
import { captureCombatArena, createCombatArena, syncCombatArena } from '@sim/combat/combat-arena';
import CombatArenaScene from '../../src/ui/combat/CombatArenaScene.svelte';

describe('manual skill placement feedback', () => {
  function aim(covered: boolean, skillId = 'attack.firestorm') {
    const s = newGame(915), arena = createCombatArena();
    const c = characterSheet(s);
    syncCombatArena(arena, s, 0, 1_000_000, c.maxHp);
    Object.assign(arena.player, { x: 5, y: 10 });
    captureCombatArena(arena, s, 0);
    if (covered) arena.nav = { version: 1, bounds: { x: 0, y: 0, width: 50, height: 32 }, cellSize: 1,
      obstacles: [{ kind: 'box', id: 'wall', x: 6.5, y: 9.5, width: 1, height: 1,
        flags: { movement: true, sight: false, projectiles: false } }] };
    const body = render(CombatArenaScene, { props: { arena, s, c, ring: [], aimSkill: skillId,
      keyboardAim: { x: 7, y: 10 } } }).body;
    return body.match(/<g class="([^"]*)"[^>]*data-skill-phase="aim"/)?.[1];
  }

  it('shows an open point inside cast range as valid', () => {
    expect(aim(false)).toBeDefined();
    expect(aim(false)).not.toContain('invalid');
  });

  it.each(['attack.firestorm', 'attack.cleave'])('shows an unstandable %s placement as invalid', (id) => {
    expect(aim(true, id)).toContain('invalid');
  });
});
