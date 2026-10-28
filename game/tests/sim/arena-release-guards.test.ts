import { describe, expect, it } from 'vitest';
import type { NavLayout } from '@engine/navigation.ts';
import { seededEncounter } from '../fixtures/encounter';

const screen = (x: number): NavLayout => ({
  version: 1, bounds: { x: 0, y: 0, width: 50, height: 32 }, cellSize: 1,
  obstacles: [{ kind: 'box', id: 'screen', x, y: 0, width: 0.2, height: 32,
    flags: { movement: false, sight: true, projectiles: false } }],
});

/** Everything before this point belongs to the field settling, not to the command under test. */
function clearEvidence(state: { log: { text: string }[] }) {
  state.log.length = 0;
}

function strike(seed: number, withScreen: boolean) {
  const e = seededEncounter({ seed, bodies: 3, skills: ['attack.double_strike'] });
  e.run(1, undefined, { autoSkills: false });
  const target = Object.values(e.arena.mobs).find((m) => m.hp > 0 && !m.returning)!;
  Object.assign(e.arena.player, { x: target.x - 1, y: target.y });
  e.arena.focusId = target.id;
  if (withScreen) e.arena.nav = screen(target.x - 0.5);
  clearEvidence(e.state);
  e.run(1, { tick: 0, manual: { cast: { skillId: 'attack.double_strike' } } }, { autoSkills: false });
  e.run(2, undefined, { autoSkills: false });
  return e;
}

function storm(seed: number, withWall: boolean) {
  const e = seededEncounter({ seed, bodies: 4, skills: ['attack.firestorm'] });
  e.run(1, undefined, { autoSkills: false });
  const target = Object.values(e.arena.mobs).find((m) => m.hp > 0 && !m.returning)!;
  const point = { x: target.x, y: 5 };
  Object.assign(e.arena.player, { x: target.x - 2, y: 5 });
  if (withWall) {
    e.arena.nav = { version: 1, bounds: { x: 0, y: 0, width: 50, height: 32 }, cellSize: 1,
      obstacles: [{ kind: 'box', id: 'wall', x: point.x - 0.5, y: 0, width: 2, height: 32,
        flags: { movement: true, sight: false, projectiles: false } }] };
  }
  clearEvidence(e.state);
  e.run(1, { tick: 0, manual: { cast: { skillId: 'attack.firestorm', point } } }, { autoSkills: false });
  e.run(2, undefined, { autoSkills: false });
  return e;
}

describe('P2 release — line of sight is re-checked when the cast fires', () => {
  it('lands the pinned strike on open ground', () => {
    expect(strike(71, false).state.log.some((line) => line.text.startsWith('Double Strike'))).toBe(true);
  });

  it('refuses the strike when the target sits behind a sight screen', () => {
    expect(strike(71, true).state.log.some((line) => line.text.startsWith('Double Strike'))).toBe(false);
  });
});

describe('P2 release — a placed area needs standable ground', () => {
  it('lands on open ground', () => {
    expect(storm(81, false).state.log.some((line) => line.text.startsWith('Firestorm'))).toBe(true);
  });

  it('refuses a placement inside a movement-blocking wall', () => {
    expect(storm(81, true).state.log.some((line) => line.text.startsWith('Firestorm'))).toBe(false);
  });
});
