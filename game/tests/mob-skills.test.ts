import { describe, expect, it } from 'vitest';
import { MS, eng } from '../src/engine/client';
import { mulberry32 } from '../src/engine/client-helpers';
import { spawnMob, newGame, setLevel, tick } from '../src/sim/core/game';
import { applyStatus, mobSwing, type Statuses } from '../src/sim/combat/combat';
import { buildCharacter } from '../src/sim/core/player';
import { applyMobAuras, markMobSkillUsed, mobSkillById, planMobSkills, readyMobSkill, resolveMobKit } from '../src/sim/combat/mobSkills';
import type { Mob } from '../src/sim/core/types';

const mob = (over: Partial<Mob> = {}): Mob => ({
  id: 'm', species: 'Test', speciesId: 'goblin', kind: 'Normal', zone: 1, level: 1,
  hp: 10, hpMax: 10, ps: 1, acc: 1, evasion: 0, dodgeRate: 0, armour: 100,
  res: 10, resByElement: { fire: 10 }, damage: 'physical', innate: ['fire'], xp: 1,
  line: 'front', hitsPerSec: 1, atkTimer: 0, engageSec: 0, ...over,
} as Mob);

describe('mob skill kits', () => {
  it('resolves by override and never merges layers', () => {
    expect(resolveMobKit('normal', 'goblin', 'Sneak Goblin')).toEqual(['mob.physical.backstab']);
    expect(resolveMobKit('normal', 'goblin', 'Shaman Goblin')).toEqual(['mob.fire.ember-lash', 'mob.fire.flame-guard']);
    expect(resolveMobKit('boss', 'goblin', undefined, 'Goblin King')).toHaveLength(3);
    expect(resolveMobKit('unique', 'demon', 'Archdemon', 'Archdemon')).toHaveLength(4);
    expect(resolveMobKit('unique', 'demon', 'Archdemon', 'Archdemon')).toContain('mob.chaos.warped-aura');
    expect(resolveMobKit('normal', 'slaggolem')).toEqual([]);
  });

  it('keeps every authored kit within the cap and pointed at a real row', () => {
    const kits = [MS.kits.species, MS.kits.variants, MS.kits.bosses, MS.kits.uniques];
    for (const group of kits) {
      for (const ids of Object.values(group)) {
        expect(ids.length).toBeGreaterThan(0);
        expect(ids.length).toBeLessThanOrEqual(MS.meta.max_kit);
        for (const id of ids) expect(mobSkillById(id), id).toBeDefined();
      }
    }
  });

  it('picks the first ready strike, skips auras and spends its own cooldown', () => {
    const m = mob({ skillIds: ['mob.chaos.unreal-veil', 'mob.cold.ice-shard', 'mob.physical.cleave'] });
    expect(readyMobSkill(m, 0)?.id).toBe('mob.cold.ice-shard');
    markMobSkillUsed(m, mobSkillById('mob.cold.ice-shard')!, 0, 1_000_000);
    expect(readyMobSkill(m, 1_000_000)?.id).toBe('mob.physical.cleave');
    expect(readyMobSkill(m, 9_000_000)?.id).toBe('mob.cold.ice-shard');
  });

  it('stamps the resolved kit on a fresh spawn and starts every cooldown ready', () => {
    const boss = spawnMob(mulberry32(11), 1, 'boss');
    expect(boss.skillIds?.length).toBeGreaterThanOrEqual(2);
    expect(boss.skillReadyAtUs).toEqual({});
  });

  it('plans a cast ahead without letting the cooldown reset inside the same window', () => {
    const m = mob({ skillIds: ['mob.cold.ice-shard'] });
    const plan = planMobSkills(m, [1_000_000, 2_000_000, 10_000_000], 1_000_000);
    expect(plan.get(1_000_000)?.id).toBe('mob.cold.ice-shard');
    expect(plan.has(2_000_000)).toBe(false);
    expect(plan.get(10_000_000)?.id).toBe('mob.cold.ice-shard');
  });

  it('skips an unavailable earlier kit entry without hiding a later usable strike', () => {
    const m = mob({ skillIds: ['mob.physical.cleave', 'mob.cold.ice-shard'] });
    expect(readyMobSkill(m, 0, row => row.role === 'stand-off')?.id).toBe('mob.cold.ice-shard');
    expect(m.skillReadyAtUs ?? {}).toEqual({});
    expect(readyMobSkill(m, 0, () => false)).toBeUndefined();
  });

  it('casts a boss kit inside the live field loop', () => {
    const s = newGame(7);
    setLevel(s, 50);
    s.hunting = true;
    s.spawnIn = 999;
    const boss = spawnMob(mulberry32(11), 1, 'boss');
    boss.hp = boss.hpMax = 1e12;
    s.group = [boss];
    for (let i = 0; i < 12; i++) tick(s, { online: true });
    expect(s.fx.some((e) => e.kind === 'cast' && !!e.mobId)).toBe(true);
    const casts = s.fx.filter((event) => event.kind === 'cast' && event.mobId === boss.id);
    expect(casts.every((event) => !!event.skillId && boss.skillIds?.includes(event.skillId))).toBe(true);
    const skillHits = s.fx.filter((event) => event.byId === boss.id && !!event.skillId);
    expect(skillHits.every((event) => !!mobSkillById(event.skillId!))).toBe(true);
  });

  it('leaves the basic swing identical whether or not a strike kit is attached', () => {
    const s = newGame(7);
    const c = buildCharacter(s.player.level, s.gear, {}, 0, { add: {}, mult: {} }, s.player.points, s.player.treeRanks, {});
    const plain = spawnMob(mulberry32(11), 1, 'normal');
    const armed = { ...plain, id: 'armed', skillIds: ['mob.physical.crushing-blow'], skillReadyAtUs: {} };
    const a = mobSwing(mulberry32(3), c, plain, {});
    const b = mobSwing(mulberry32(3), c, armed, {});
    expect(b.raw).toBe(a.raw);
    expect(b.toHp).toBe(a.toHp);
    expect(b.toEs).toBe(a.toEs);
  });
});

describe('mob auras', () => {
  it('applies engaged auras to every engaged body and line auras only to that line', () => {
    const frontSource = mob({ id: 'fs', line: 'front', skillIds: ['mob.chaos.unreal-veil'] });
    const standSource = mob({ id: 'ss', line: 'stand-off', skillIds: ['mob.earth.rooted-stance'] });
    const front = mob({ id: 'f', line: 'front' });
    const stand = mob({ id: 's', line: 'stand-off' });
    applyMobAuras([frontSource, standSource, front, stand], [frontSource, standSource, front, stand]);
    expect(front.effRes).toBe(25);
    expect(stand.effRes).toBe(30);
    expect(front.auraSources?.some((aura) => aura.id === 'mob.chaos.unreal-veil' && aura.sourceId === 'fs')).toBe(true);
    expect(front.auraSources?.some((aura) => aura.id === 'mob.earth.rooted-stance')).toBe(false);
    expect(stand.auraSources?.some((aura) => aura.id === 'mob.earth.rooted-stance' && aura.sourceId === 'ss')).toBe(true);
  });

  it('takes the strongest source per stat and drops a dead source on the next tick', () => {
    const strong = mob({ id: 'strong', line: 'stand-off', skillIds: ['mob.earth.rooted-stance'] });
    const weak = mob({ id: 'weak', line: 'stand-off', skillIds: ['mob.fire.ash-veil'] });
    const target = mob({ id: 'target', line: 'stand-off' });
    applyMobAuras([strong, weak, target], [strong, weak, target]);
    expect(target.effRes).toBe(30);
    strong.hp = 0;
    applyMobAuras([strong, weak, target], [strong, weak, target]);
    expect(target.effRes).toBe(20);
    expect(target.auraSources?.some((aura) => aura.id === 'mob.earth.rooted-stance')).toBe(false);
  });

  it('leaves non-engaged bodies and both damage multipliers untouched', () => {
    const source = mob({ id: 'source', skillIds: ['mob.earth.stone-guard'] });
    const back = mob({ id: 'back', line: 'stand-off' });
    applyMobAuras([source, back], [source]);
    expect(source.effArmour).toBe(125);
    expect(back.effArmour).toBe(100);
    expect(back.effRes).toBe(10);
    expect(back.auraSources).toEqual([]);    expect(back.auraDamageMult).toBe(1);
    expect(back.auraSpeedMult).toBe(1);
  });

  it('ships no aura that can raise the mob damage or speed budget', () => {
    for (const row of MS.skills) {
      if (row.mode !== 'aura') continue;
      for (const stat of Object.keys(row.effects || {})) expect(MS.meta.aura_stats).toContain(stat);
    }
  });

  it('reads aura-adjusted defence and outgoing damage through the shared fields', () => {
    const plain = mob({ id: 'plain' });
    const buffed = mob({ id: 'buffed', effArmour: 200, effRes: 60, resByElement: { fire: 60 }, auraDamageMult: 2 });
    expect(eng.mitigateMobHit(buffed, 100, { fire: 100 })).toBeLessThan(eng.mitigateMobHit(plain, 100, { fire: 100 }));
    const s = newGame(7);
    const c = buildCharacter(s.player.level, s.gear, {}, 0, { add: {}, mult: {} }, s.player.points, s.player.treeRanks, {});
    const a = mobSwing(mulberry32(3), c, plain, {});
    const b = mobSwing(mulberry32(3), c, buffed, {});
    expect(b.raw).toBeCloseTo(a.raw * 2, 6);
  });
});

describe('mob skill statuses', () => {
  it('keeps strongest-wins auras inside the local radius and legacy scopes', () => {
    const source = mob({ id: 'aura-source', skillIds: ['mob.fire.ash-veil'] });
    const target = mob({ id: 'aura-target' });
    applyMobAuras([source, target], [source, target], () => false);
    expect(target.effRes).toBe(target.res);
    applyMobAuras([source, target], [source, target]);
    expect(target.effRes).toBeGreaterThan(target.res);

    const lineSource = mob({ id: 'line-source', line: 'front', skillIds: ['mob.fire.flame-guard'] });
    const standoff = mob({ id: 'line-target', line: 'stand-off' });
    applyMobAuras([lineSource, standoff], [lineSource, standoff], () => true);
    expect(standoff.effArmour).toBe(standoff.armour);
    expect(lineSource.effArmour).toBeGreaterThan(lineSource.armour);
  });

  it('writes a control status through the shared status writer', () => {
    const statuses: Statuses = {};
    expect(applyStatus(statuses, 'chill', 10)).toBe('chill');
    expect(statuses.chill?.secLeft).toBeGreaterThan(0);
    expect(applyStatus(statuses, 'shock', 10)).toBe('shock');
    expect(statuses.shock).toBeDefined();
  });
});
