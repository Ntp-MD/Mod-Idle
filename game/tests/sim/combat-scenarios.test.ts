import { describe, expect, it } from 'vitest';
import { seededEncounter } from '../fixtures/encounter';
import { mobFixture } from '../fixtures/mobFixture';

function heavyGround(encounter: ReturnType<typeof seededEncounter>, centre: { x: number; y: number }, impactAtUs: number) {
  encounter.arena.mobFlights.push({
    actionId: 101,
    mobId: 'hazard',
    mob: mobFixture(),
    source: { ...centre },
    destination: { ...centre },
    position: { ...centre },
    releaseAtUs: encounter.arena.nowUs,
    impactAtUs,
    speedMps: 5,
    radiusM: 0.25,
    skillId: 'mob.earth.boulder-toss',
    kind: 'ground' as const,
    impactRadiusM: 1.5,
  } as never);
}

describe('P0 scenarios — focus change', () => {
  it('moves the committed target onto the focused body', () => {
    const encounter = seededEncounter({ seed: 31, bodies: 6 });
    encounter.run(1);
    const living = Object.values(encounter.arena.mobs).filter((mob) => mob.hp > 0 && !mob.returning);
    expect(living.length).toBeGreaterThan(1);
    const chosen = living[living.length - 1].id;

    encounter.arena.focusId = chosen;
    encounter.run(2);

    const last = encounter.trace[encounter.trace.length - 1];
    expect(last.focusId).toBe(chosen);
    expect(last.intent?.targetId ?? chosen).toBe(chosen);
  });
});

describe('P0 scenarios — moving target', () => {
  it('keeps the committed target and closes the distance while it moves', () => {
    const encounter = seededEncounter({ seed: 33, bodies: 5 });
    encounter.run(1);
    const mob = Object.values(encounter.arena.mobs).find((body) => body.hp > 0 && !body.returning);
    expect(mob).toBeDefined();
    encounter.arena.focusId = mob!.id;
    const startGap = Math.hypot(encounter.arena.player.x - mob!.x, encounter.arena.player.y - mob!.y);

    for (let i = 0; i < 3; i++) {
      mob!.x = Math.min(49, mob!.x + 2);
      encounter.run(1);
    }

    const last = encounter.trace[encounter.trace.length - 1];
    expect(last.intent?.targetId ?? mob!.id).toBe(mob!.id);
    const endGap = Math.hypot(encounter.arena.player.x - mob!.x, encounter.arena.player.y - mob!.y);
    expect(endGap).toBeLessThanOrEqual(startGap);
  });
});

describe('P0 scenarios — ground hazard', () => {
  it('steps out of a circle that lands inside the same tick', () => {
    const encounter = seededEncounter({ seed: 32, bodies: 5 });
    encounter.run(1);
    const player = { ...encounter.arena.player };
    // player already near the rim, impact 0.4 s away, so only the remaining escape is owed
    heavyGround(encounter, { x: player.x + 1.45, y: player.y }, encounter.arena.nowUs + 400_000);

    encounter.run(1);

    const fromCentre = Math.hypot(encounter.arena.player.x - (player.x + 1.45), encounter.arena.player.y - player.y);
    expect(fromCentre).toBeGreaterThan(1.5);
  });

  // F45: the circle must be re-answered on every movement sample, not once per world tick.
  it('stays outside a circle that lands at the end of the next tick', () => {
    const encounter = seededEncounter({ seed: 32, bodies: 5 });
    encounter.run(1);
    const player = { ...encounter.arena.player };
    heavyGround(encounter, { ...player }, encounter.arena.nowUs + 1_000_000);

    encounter.run(1);

    const fromCentre = Math.hypot(encounter.arena.player.x - player.x, encounter.arena.player.y - player.y);
    expect(fromCentre).toBeGreaterThan(1.5);
  });
});
