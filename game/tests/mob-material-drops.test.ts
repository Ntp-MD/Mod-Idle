import { describe, expect, it } from 'vitest';
import { E, TOWN, eng } from '../src/engine/client';
import { grantBonusMaterial, newGame, rollBonusMaterial } from '../src/sim/core/game';
import { newEscrow, payoutStacks } from '../src/sim/world/dungeon';
import type { Mob } from '../src/sim/core/types';

const goblin = (): Mob => eng.spawnAt(1, 'medium', 'goblin') as unknown as Mob;

function dropCounter(s: ReturnType<typeof newGame>, mob: Mob): number {
  s.seed = 1;
  for (let kill = 1; kill < 10000; kill++) {
    s.counters.kills = kill;
    if (rollBonusMaterial(s, mob)) return kill;
  }
  throw new Error('no bonus material drop found');
}

describe('species bonus materials', () => {
  it('gives every Species one priced material from the catalogue', () => {
    for (const sp of E.mob.species as any[]) {
      expect(sp.bonus_material, sp.id).toBeDefined();
      const material = (E.fieldwork.materials as any[]).find((m) => m.id === sp.bonus_material.resource);
      expect(material, sp.id).toBeDefined();
      expect((TOWN.trade.material_values as any)[sp.bonus_material.resource], sp.id).toBeGreaterThan(0);
      expect(sp.bonus_material.chance).toBeGreaterThan(0);
      expect(sp.bonus_material.chance).toBeLessThanOrEqual(1);
    }
  });

  it('is deterministic from seed + kill count and never advances the shared stream', () => {
    const s = newGame(1);
    const mob = goblin();
    const kill = dropCounter(s, mob);
    s.counters.kills = kill;
    const before = rollBonusMaterial(s, mob);
    const rngState = s.rngState;
    s.counters.kills = kill;
    expect(rollBonusMaterial(s, mob)).toEqual(before);
    expect(s.rngState).toBe(rngState);
  });

  it('pays a normal kill into the carried material stack', () => {
    const s = newGame(1);
    const mob = goblin();
    const kill = dropCounter(s, mob);
    s.counters.kills = kill;
    const drop = rollBonusMaterial(s, mob)!;
    const before = s.fieldwork.materials[drop.resource] || 0;
    const paid = grantBonusMaterial(s, mob, false);
    expect(paid?.granted).toBeGreaterThan(0);
    expect(s.fieldwork.materials[drop.resource]).toBe(before + paid!.granted);
  });

  it('escrows a dungeon kill and pays it through payoutStacks', () => {
    const s = newGame(1);
    const mob = goblin();
    const kill = dropCounter(s, mob);
    s.counters.kills = kill;
    const drop = rollBonusMaterial(s, mob)!;
    s.dungeon = { escrow: newEscrow() } as any;
    const paid = grantBonusMaterial(s, mob, false);
    expect(paid?.granted).toBe(drop.amount);
    expect(s.dungeon!.escrow.materials[drop.resource]).toBe(drop.amount);
    const payout = payoutStacks(s);
    expect(payout.materials).toBe(drop.amount);
    expect(s.fieldwork.materials[drop.resource]).toBe(drop.amount);
  });

  it('refuses a full-bag grant without deleting or duplicating it', () => {
    const s = newGame(1);
    for (let i = 0; i < 300; i++) s.junk[`filler-${i}`] = 1;
    const mob = goblin();
    const kill = dropCounter(s, mob);
    s.counters.kills = kill;
    const drop = rollBonusMaterial(s, mob)!;
    const before = s.fieldwork.materials[drop.resource] || 0;
    const paid = grantBonusMaterial(s, mob, false);
    expect(paid?.granted).toBe(0);
    expect(s.fieldwork.materials[drop.resource] || 0).toBe(before);
  });
});
