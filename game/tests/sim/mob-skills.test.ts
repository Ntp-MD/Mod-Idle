import { describe, expect, it } from 'vitest';
import { E, MS, eng } from '../../src/engine/client';
import { mulberry32 } from '../../src/engine/client-helpers';
import { spawnMob, newGame, setLevel, tick } from '@sim/core/game';
import { applyStatus, mobSwing, type Statuses } from '@sim/combat/combat';
import { buildCharacter } from '@sim/core/player';
import { applyMobAuras, createMobSkillModel, markMobSkillUsed, mobSkillById, planMobSkills, readyMobSkill, resolveMobKit } from '@sim/combat/mobSkills';
import type { Mob } from '@sim/core/types';
import { liveMobSkill } from '../fixtures/liveMob';
import { mobFixture } from '../fixtures/mobFixture';

const projectile = liveMobSkill(row => row.mode === 'strike' && row.cast?.delivery === 'projectile' && !row.phase && (row.cd ?? 0) > 0, 'projectile cooldown');
const melee = liveMobSkill(row => row.mode === 'strike' && row.cast?.delivery === 'melee' && !row.phase, 'melee strike');
const engagedResist = liveMobSkill(row => row.mode === 'aura' && row.scope === 'engaged' && (row.effects?.resist_pct ?? 0) > 0, 'engaged resistance aura');
const lineResist = liveMobSkill(row => row.mode === 'aura' && row.scope === 'line' && (row.effects?.resist_pct ?? 0) > 0, 'line resistance aura');
const engagedArmour = liveMobSkill(row => row.mode === 'aura' && row.scope === 'engaged' && (row.effects?.armour_pct ?? 0) > 0, 'engaged armour aura');
const lineArmour = liveMobSkill(row => row.mode === 'aura' && row.scope === 'line' && (row.effects?.armour_pct ?? 0) > 0, 'line armour aura');

const mob = (over: Partial<Mob> = {}): Mob => mobFixture({
  id: 'm', species: 'Test', kind: 'Normal', zone: 1, level: 1,
  hp: 10, hpMax: 10, ps: 1, acc: 1, evasion: 0, dodgeRate: 0, armour: 100,
  res: 10, resByElement: { fire: 10 }, damage: 'physical', innate: ['fire'], xp: 1,
  line: 'front', hitsPerSec: 1, atkTimer: 0, engageSec: 0, ...over,
});

describe('mob skill kits', () => {
  it('resolves by override and never merges layers', () => {
    for (const species of E.mob.species) {
      const base = MS.kits.species[species.id] ?? [];
      for (const placement of (E.mob.variants as any[]).filter((row) => row.species === species.id))
        expect(resolveMobKit('normal', species.id, placement.id), placement.id)
          .toEqual(MS.kits.variants[placement.id] ?? base);
    }
    for (const boss of E.mob.bosses as any[])
      expect(resolveMobKit('boss', boss.species, boss.id), boss.id)
        .toEqual(MS.kits.bosses[boss.id] ?? MS.kits.species[boss.species] ?? []);
    for (const unique of E.mob.uniques as any[])
      expect(resolveMobKit('unique', unique.species, unique.id), unique.id)
        .toEqual(MS.kits.uniques[unique.id] ?? MS.kits.bosses[unique.id.replace(/\.unique$/, '.boss')] ?? MS.kits.species[unique.species] ?? []);
    expect(resolveMobKit('normal', 'test-missing-species', 'missing.placement')).toEqual([]);
  });

  it('keeps every authored kit within its layer cap and pointed at a real row', () => {
    const kits: [Record<string, string[]>, number][] = [
      [MS.kits.species, MS.meta.species_max_kit ?? 2],
      [MS.kits.variants, MS.meta.max_kit],
      [MS.kits.bosses, MS.meta.max_kit],
      [MS.kits.uniques, MS.meta.max_kit],
    ];
    for (const [group, max] of kits) {
      for (const ids of Object.values(group)) {
        expect(ids.length).toBeGreaterThan(0);
        expect(ids.length).toBeLessThanOrEqual(max);
        for (const id of ids) expect(mobSkillById(id), id).toBeDefined();
      }
    }
  });

  it('picks the first ready strike, skips auras and spends its own cooldown', () => {
    const m = mob({ skillIds: [engagedResist.id, projectile.id, melee.id] });
    expect(readyMobSkill(m, 0)?.id).toBe(projectile.id);
    markMobSkillUsed(m, projectile, 0, 1_000_000);
    expect(readyMobSkill(m, 0)?.id).toBe(melee.id);
    expect(readyMobSkill(m, projectile.cd! * 1_000_000)?.id).toBe(projectile.id);
  });

  it('stamps the resolved kit on a fresh spawn and starts every cooldown ready', () => {
    for (const profile of E.mob.bosses) {
      const boss = spawnMob(mulberry32(11), profile.zone, 'boss');
      expect(boss.skillIds).toEqual(resolveMobKit('boss', profile.species, (profile as any).id));
      expect(boss.skillReadyAtUs).toEqual({});
    }
  });

  it('plans a cast ahead without letting the cooldown reset inside the same window', () => {
    const m = mob({ skillIds: [projectile.id] });
    const readyAt = projectile.cd! * 1_000_000;
    const plan = planMobSkills(m, [0, readyAt / 2, readyAt], 1_000_000);
    expect(plan.get(0)?.id).toBe(projectile.id);
    expect(plan.has(readyAt / 2)).toBe(false);
    expect(plan.get(readyAt)?.id).toBe(projectile.id);
  });

  it('skips an unavailable earlier kit entry without hiding a later usable strike', () => {
    const m = mob({ skillIds: [melee.id, projectile.id] });
    expect(readyMobSkill(m, 0, row => row.cast?.delivery === 'projectile')?.id).toBe(projectile.id);
    expect(m.skillReadyAtUs ?? {}).toEqual({});
    expect(readyMobSkill(m, 0, () => false)).toBeUndefined();
  });

  it('casts a boss kit inside the live field loop', () => {
    const s = newGame(7);
    setLevel(s, 50);
    s.hunting = true;
    const profile = E.mob.bosses.find(row => resolveMobKit('boss', row.species, (row as any).id)
      .some(id => mobSkillById(id)?.mode === 'strike'));
    expect(profile, 'a boss kit with an executable strike').toBeDefined();
    const boss = spawnMob(mulberry32(11), profile!.zone, 'boss');
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
    const armed = { ...plain, id: 'armed', skillIds: [melee.id], skillReadyAtUs: {} };
    const a = mobSwing(mulberry32(3), c, plain, {});
    const b = mobSwing(mulberry32(3), c, armed, {});
    expect(b.raw).toBe(a.raw);
    expect(b.toHp).toBe(a.toHp);
    expect(b.toEs).toBe(a.toEs);
  });
});

describe('mob auras', () => {
  it('applies engaged auras to every engaged body and line auras only to that line', () => {
    const frontSource = mob({ id: 'fs', line: 'front', skillIds: [engagedResist.id] });
    const standSource = mob({ id: 'ss', line: 'stand-off', skillIds: [lineResist.id] });
    const front = mob({ id: 'f', line: 'front' });
    const stand = mob({ id: 's', line: 'stand-off' });
    applyMobAuras([frontSource, standSource, front, stand], [frontSource, standSource, front, stand]);
    expect(front.effRes).toBe(Math.min(E.caps.elem_res, front.res + engagedResist.effects!.resist_pct!));
    expect(stand.effRes).toBe(Math.min(E.caps.elem_res, stand.res + Math.max(engagedResist.effects!.resist_pct!, lineResist.effects!.resist_pct!)));
    expect(front.auraSources?.some((aura) => aura.id === engagedResist.id && aura.sourceId === 'fs')).toBe(true);
    expect(front.auraSources?.some((aura) => aura.id === lineResist.id)).toBe(false);
    expect(stand.auraSources?.some((aura) => aura.id === lineResist.id && aura.sourceId === 'ss')).toBe(true);
  });

  it('takes the strongest source per stat and drops a dead source on the next tick', () => {
    const strong = mob({ id: 'strong', line: 'stand-off', skillIds: [lineResist.id] });
    const weak = mob({ id: 'weak', line: 'stand-off', skillIds: [engagedResist.id] });
    const target = mob({ id: 'target', line: 'stand-off' });
    applyMobAuras([strong, weak, target], [strong, weak, target]);
    expect(target.effRes).toBe(Math.min(E.caps.elem_res, target.res + Math.max(lineResist.effects!.resist_pct!, engagedResist.effects!.resist_pct!)));
    strong.hp = 0;
    applyMobAuras([strong, weak, target], [strong, weak, target]);
    expect(target.effRes).toBe(Math.min(E.caps.elem_res, target.res + engagedResist.effects!.resist_pct!));
    expect(target.auraSources?.some((aura) => aura.id === lineResist.id)).toBe(false);
  });

  it('leaves non-engaged bodies and both damage multipliers untouched', () => {
    const source = mob({ id: 'source', skillIds: [engagedArmour.id] });
    const back = mob({ id: 'back', line: 'stand-off' });
    applyMobAuras([source, back], [source]);
    expect(source.effArmour).toBe(source.armour * (1 + engagedArmour.effects!.armour_pct! / 100));
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
    const source = mob({ id: 'aura-source', skillIds: [engagedResist.id] });
    const target = mob({ id: 'aura-target' });
    applyMobAuras([source, target], [source, target], () => false);
    expect(target.effRes).toBe(target.res);
    applyMobAuras([source, target], [source, target]);
    expect(target.effRes).toBeGreaterThan(target.res);

    const lineSource = mob({ id: 'line-source', line: 'front', skillIds: [lineArmour.id] });
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

describe('injectable mob skill library', () => {
  const library = {
    skills: [
      { id: 't.strike', mode: 'strike', cast: { delivery: 'melee' }, cd: 6 },
      { id: 't.strike2', mode: 'strike', cast: { delivery: 'melee' }, cd: 6 },
      { id: 't.aura', mode: 'aura', scope: 'engaged', effects: { armour_pct: 20, resist_pct: 200 } },
    ] as never[],
    kits: { species: { tsp: ['t.strike', 't.strike2', 't.aura', 't.missing'] }, variants: {}, bosses: {}, uniques: {} },
    maxKit: 1,
    elemResCap: 37,
  };
  const model = createMobSkillModel(library as never);

  it('resolves, caps and filters unknown ids from the injected library, not the live one', () => {
    // Two valid strikes fit the cap of one; the unknown id never resolves.
    expect(model.resolveKit('normal', 'tsp', 'tsp.placement')).toEqual(['t.strike']);
    expect(model.byId('t.missing')).toBeUndefined();
    // The production registry never sees scenario ids.
    expect(mobSkillById('t.strike')).toBeUndefined();
    expect(MS.skills.some((row) => row.id === 't.strike')).toBe(false);
  });

  it('reads cooldowns and applies auras through the injected caps', () => {
    const striker = mob({ id: 'striker', skillIds: ['t.strike'] });
    expect(model.ready(striker, 0)?.id).toBe('t.strike');
    markMobSkillUsed(striker, model.byId('t.strike')!, 0, 1_000_000);
    expect(model.ready(striker, 0)).toBeUndefined();
    expect(model.ready(striker, 6_000_001)?.id).toBe('t.strike');

    const source = mob({ id: 'aura-source', skillIds: ['t.aura'] });
    const target = mob({ id: 'aura-target' });
    model.auras([source, target], [source, target]);
    // 10 base + 200 aura, clamped to the injected cap of 37 — not E.caps.elem_res.
    expect(target.effRes).toBe(37);
    expect(target.effArmour).toBe(target.armour * 1.2);
  });
});
