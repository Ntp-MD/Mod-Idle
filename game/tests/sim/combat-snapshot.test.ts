import { describe, expect, it } from 'vitest';
import { seededEncounter } from '../fixtures/encounter';
import { sampleCombatArena } from '@sim/combat/combat-arena';
import { applyCurse } from '@sim/combat/curse';
import { sm } from '../../src/engine/client';

describe('P1 snapshot — one timestamp for HUD facts', () => {
  it('carries curses, player buffs and the target pin on the sampled frame', () => {
    const encounter = seededEncounter({ seed: 41, bodies: 4 });
    encounter.run(1);
    const mob = encounter.state.group.find((body) => body.hp > 0);
    expect(mob).toBeDefined();

    applyCurse(encounter.state.curses, mob!.id, (sm as any).byId['curse.weaken']);
    encounter.state.skills.buffUp['buff.test'] = 12;
    encounter.arena.focusId = mob!.id;
    encounter.run(1);

    const frame = sampleCombatArena(encounter.arena, encounter.arena.nowUs);
    expect(frame.curses?.[mob!.id]).toBeDefined();
    expect(Object.keys(frame.curses?.[mob!.id] ?? {}).length).toBeGreaterThan(0);
    expect(frame.buffs?.['buff.test']).toBeGreaterThan(0);
    expect(frame.focusId).toBe(mob!.id);
  });

  it('keeps the curtain facts when the frame is interpolated between samples', () => {
    const encounter = seededEncounter({ seed: 41, bodies: 4 });
    encounter.run(2);
    const first = encounter.arena.frames.at(-1)!;
    expect(first).toBeDefined();
    const sampled = sampleCombatArena(encounter.arena, first.atUs);
    expect(sampled.buffs).toEqual(first.buffs);
    expect(sampled.curses).toEqual(first.curses);
  });
});
