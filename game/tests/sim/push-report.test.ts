import { describe, expect, it } from 'vitest';
import { buildPushReport, pushReportLines } from '@sim/core/push-report';
import { characterSheet, huntZone, newGame, tick } from '@sim/core/game';
import { mobFixture } from '../fixtures/mobFixture';
import type { Character } from '@sim/core/player';
import type { GameState, Mob } from '@sim/core/types';

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

describe('P5 push report — name the cause, not the bystander', () => {
  it('blames the body whose blow took the last HP', () => {
    const game = newGame(3);
    game.clockSec = 10;
    const bystander = mobFixture({ id: 'bystander', ps: 900, species: 'Rat', hp: 10, hpMax: 10 });
    const killer = mobFixture({ id: 'killer', ps: 100, species: 'Ogre', hp: 10, hpMax: 10 });
    game.lastFatalHit = { mobId: 'killer', species: 'Ogre', value: 1234, atSec: 9.5 };

    const report = buildPushReport(game, characterSheet(game), [bystander, killer]);

    expect(report?.name).toBe('Ogre');
    expect(report?.advice[0]).toContain('killing blow');
    expect(report?.advice[0]).toContain('Ogre');
  });

  it('ignores a fatal blow from outside the report window', () => {
    const game = newGame(3);
    game.clockSec = 30;
    const only = mobFixture({ id: 'rat', ps: 900, species: 'Rat', hp: 10, hpMax: 10 });
    game.lastFatalHit = { mobId: 'rat', species: 'Rat', value: 9, atSec: 1 };

    const report = buildPushReport(game, characterSheet(game), [only]);

    expect(report?.advice.some((line) => line.includes('killing blow'))).toBe(false);
  });
});

describe('P5 push report — refused commands are part of the cause', () => {
  it('names refusals from the final seconds', () => {
    const game = newGame(3);
    game.clockSec = 10;
    game.combatReceipts = [
      { atUs: 9_500_000, atSec: 9.5, command: 'cast', status: 'rejected', reason: 'unknown skill' },
      { atUs: 9_600_000, atSec: 9.6, command: 'move', status: 'rejected', reason: 'unreachable' },
    ];
    const only = mobFixture({ id: 'w', ps: 10, species: 'wolf', hp: 1, hpMax: 1 });

    const report = buildPushReport(game, characterSheet(game), [only]);

    expect(report?.advice.join(' ')).toContain('refused');
    expect(report?.advice.join(' ')).toContain('unreachable');
  });

  it('ignores refusals older than the window', () => {
    const game = newGame(3);
    game.clockSec = 30;
    game.combatReceipts = [
      { atUs: 1_000_000, atSec: 1, command: 'cast', status: 'rejected', reason: 'unknown skill' },
    ];
    const only = mobFixture({ id: 'w', ps: 10, species: 'wolf', hp: 1, hpMax: 1 });

    const report = buildPushReport(game, characterSheet(game), [only]);

    expect(report?.advice.join(' ')).not.toContain('refused');
  });
});

describe('P5 push report — resource state at the Push', () => {
  it('notes an empty mana pool', () => {
    const game = newGame(3);
    const sheet = { ...characterSheet(game), maxMana: 100 } as Character;
    game.player.mana = 5;
    const only = mobFixture({ id: 'w', ps: 10, species: 'wolf', hp: 1, hpMax: 1 });

    const report = buildPushReport(game, sheet, [only]);

    expect(report?.advice.join(' ')).toContain('Mana');
  });
});

describe('F26 one actionable change — ranked by the event graph', () => {
  it('tells a farmer with auto-avoid off to turn it on after a heavy landing', () => {
    const game = newGame(3);
    game.clockSec = 10;
    game.autoAvoidOff = true;
    game.lastFatalHit = { mobId: 'm', species: 'Ogre', value: 5000, atSec: 9.5, skillId: 'mob.earth.boulder-toss' };
    const only = mobFixture({ id: 'm', ps: 10, species: 'ogre', hp: 1, hpMax: 1 });

    const report = buildPushReport(game, characterSheet(game), [only]);

    expect(report?.advice[0]).toContain('Turn on auto-avoid');
  });

  it('names the most common refusal with its fix', () => {
    const game = newGame(3);
    game.clockSec = 10;
    game.combatReceipts = [
      { atUs: 9_100_000, atSec: 9.1, command: 'cast', status: 'rejected', reason: 'recovery' },
      { atUs: 9_200_000, atSec: 9.2, command: 'cast', status: 'rejected', reason: 'out of range' },
      { atUs: 9_300_000, atSec: 9.3, command: 'cast', status: 'rejected', reason: 'recovery' },
    ];
    const only = mobFixture({ id: 'w', ps: 10, species: 'wolf', hp: 1, hpMax: 1 });

    const report = buildPushReport(game, characterSheet(game), [only]);

    expect(report?.advice[0]).toContain('recovery');
  });

  it('holds Mana above static matchup advice when the pool is empty', () => {
    const game = newGame(3);
    const sheet = { ...characterSheet(game), maxMana: 100 } as Character;
    game.player.mana = 5;
    const only = mobFixture({ id: 'w', ps: 10, species: 'wolf', hp: 1, hpMax: 1 });

    const report = buildPushReport(game, sheet, [only]);

    expect(report?.advice[0]).toContain('Hold Mana');
  });
});
