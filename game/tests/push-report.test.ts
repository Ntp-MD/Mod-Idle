import { describe, expect, it } from 'vitest';
import { buildPushReport, pushReportLines } from '../src/sim/core/push-report';
import { huntZone, newGame, tick } from '../src/sim/core/game';
import type { Character } from '../src/sim/core/player';
import type { GameState, Mob } from '../src/sim/core/types';

const state = { player: { level: 10 }, zone: 1 } as unknown as GameState;
const character = {
  resistance: 20, resCap: 75, resByElement: {}, maxHp: 500, es: 50,
  armour: 100, evasion: 80,
} as unknown as Character;

function wolf(overrides: Partial<Mob> = {}): Mob {
  return {
    id: 'w1', species: 'wolf', kind: 'Normal', level: 15, ps: 10,
    damage: 'physical', innate: ['fire'], hp: 0, hpMax: 100,
    acc: 0, evasion: 0, dodgeRate: 0, armour: 0, res: 0, xp: 0, line: '', hitsPerSec: 1,
    atkTimer: 0, engageSec: 0, zone: 1,
    ...overrides,
  } as Mob;
}

describe('the Push report', () => {
  it('names the threat, its Element and the character pools', () => {
    const report = buildPushReport(state, character, [wolf()])!;
    expect(report.name).toBe('wolf');
    expect(report.element).toBe('fire');
    expect(report.resistance).toBe(20);
    expect(report.advice.join(' ')).toMatch(/levels above/);
    const lines = pushReportLines(report);
    expect(lines[0]).toMatch(/^Push report — wolf/);
    expect(lines[0]).toMatch(/physical/);
    expect(lines[0]).not.toMatch(/resistance/);
  });

  it('recommends resistance for an Elemental threat', () => {
    const report = buildPushReport(state, character, [wolf({ species: 'imp', kind: 'Elite', innate: ['fire'], damage: 'magic', level: 11 })])!;
    expect(report.advice.join(' ')).toMatch(/fire resistance/);
    expect(report.advice.join(' ')).toMatch(/Armour/);
    expect(pushReportLines(report)[0]).toMatch(/fire resistance 20%/);
  });

  it('returns nothing when the pack is empty', () => {
    expect(buildPushReport(state, character, [])).toBeNull();
    expect(pushReportLines(null)).toEqual([]);
  });

  it('writes the report to the log when a tick Pushes', () => {
    const game = newGame(902);
    huntZone(game, game.zone);
    for (let i = 0; i < 400 && !game.group.length; i++) tick(game, { online: true });
    game.player.hp = 0;
    tick(game, { online: true });
    expect(game.phase).toBe('camp');
    expect(game.log.some((line) => line.text.startsWith('Push report —'))).toBe(true);
  });
});
