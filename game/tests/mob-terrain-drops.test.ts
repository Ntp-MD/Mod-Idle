import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { E, eng } from '../src/engine/client';
import { huntZone, newGame, setLevel, tick } from '../src/sim/game';
import { buildCharacter } from '../src/sim/player';
import { mobSwing } from '../src/sim/combat';
import { newMobStatusStore, applyBleed, placeStatus } from '../src/sim/mobStatus';
import type { Mob } from '../src/sim/types';
import { leanReweight, leanReweightMany } from '../../engine/loot.ts';
import { mulberry32 } from '../src/engine/client-helpers';
import { rollDrop } from '../src/sim/drop';

const engineData = JSON.parse(readFileSync(new URL('../../tools/data/engine.json', import.meta.url), 'utf8'));
const mapData = JSON.parse(readFileSync(new URL('../../tools/data/map.json', import.meta.url), 'utf8'));

describe('mob, terrain and drop data', () => {
  it('maps every mob environment to a terrain used by the world map', () => {
    const mapping = mapData.environment_terrain as Record<string, string>;
    const environments = new Set<string>(engineData.mob.zones.flatMap((zone: any) =>
      zone.subzones.map((sub: any) => sub.environment)));
    const terrains = new Set<string>(mapData.cells.flatMap((cell: any) =>
      cell.subs.map((sub: any) => sub.terrain)));

    expect(Object.keys(mapping).sort()).toEqual([...environments].sort());
    for (const terrain of Object.values(mapping)) expect(terrains.has(terrain)).toBe(true);
  });

  it('labels each wild cell with the site kind assigned to its index', () => {
    const byIndex = Object.fromEntries(Object.entries(engineData.fieldwork.wild_site_index)
      .map(([kind, index]) => [String(index), kind]));

    for (const cell of mapData.cells) {
      expect(cell.wild).toHaveLength(Object.keys(byIndex).length);
      cell.wild.forEach((site: any, index: number) => expect(site.kind).toBe(byIndex[String(index)]));
    }
  });

  it('maps each presentation region to the gameplay regions of its zones', () => {
    const zones = new Map(engineData.mob.zones.map((zone: any) => [zone.id, zone]));
    const claimed = mapData.regions.flatMap((region: any) => region.zones);

    expect(new Set(claimed).size).toBe(claimed.length);
    expect(claimed.slice().sort((a: number, b: number) => a - b))
      .toEqual(engineData.mob.zones.map((zone: any) => zone.id).sort((a: number, b: number) => a - b));
    for (const region of mapData.regions) {
      const expected = [...new Set(region.zones.map((id: number) => (zones.get(id) as any)?.region).filter(Boolean))].sort();
      expect(region.zone_regions?.slice().sort()).toEqual(expected);
    }
  });

  it('assigns environment drop leans to the complete subzone vocabulary', () => {
    const mapping = E.mob.environment_lean as Record<string, string>;
    const environments = new Set<string>(E.mob.zones.flatMap((zone: any) =>
      zone.subzones.map((sub: any) => sub.environment)));

    expect(Object.keys(mapping).sort()).toEqual([...environments].sort());
    expect(mapping['poison fen']).toBe('herb');
    expect(mapping.tombs).toBe('junk');
    expect(mapping.grove).toBe('herb');
    expect(mapping.tunnels).toBe('gear');
    expect(Object.values(mapping).every((lean) => ['none', 'gear', 'herb', 'junk'].includes(lean))).toBe(true);
  });

  it('layers an environment lean over the variant lean without adding drops', () => {
    const base = { gear: 0.08, herb: 0.17, junk: 0.3 };
    const variantOnly = leanReweight(base, 'gear', 25);
    const layered = leanReweightMany(base, ['gear', 'herb'], 25);
    const total = (weights: typeof base) => weights.gear + weights.herb + weights.junk;

    expect(total(layered)).toBeCloseTo(total(base), 12);
    expect(layered.herb).toBeGreaterThan(variantOnly.herb);
    expect(layered.gear).toBeLessThan(variantOnly.gear);
  });

  it('keeps hand-slot gear off non-weapon-carrier drops', () => {
    const seeds = Array.from({ length: 64 }, (_, index) => index + 1);
    const unarmedDrops = seeds.map((seed) => rollDrop(mulberry32(seed), 'low', 1, undefined, false));
    const armedDrops = seeds.map((seed) => rollDrop(mulberry32(seed), 'low', 1, undefined, true));

    expect(unarmedDrops.every((item) => item.slot !== 'main hand' && item.slot !== 'off hand')).toBe(true);
    expect(armedDrops.some((item) => item.slot === 'main hand')).toBe(true);
    expect(armedDrops.some((item) => item.slot === 'off hand')).toBe(true);
  });

  it('keeps species power centered on the published 1.00 baseline', () => {
    const power = E.mob.species.map((species: any) => species.power_base);

    expect(power.every((value: number) => Number.isFinite(value) && value > 0)).toBe(true);
    expect(power.reduce((sum: number, value: number) => sum + value, 0) / power.length).toBeCloseTo(1, 10);
    expect(new Set(power).size).toBeGreaterThanOrEqual(4);
  });

  it('assigns named fixed-Core forms through level 100 and uses base lineage above it', () => {
    for (const species of E.mob.species as any[]) {
      for (const zoneId of species.zones) {
        const zone = E.mob.zones.find((entry: any) => entry.id === zoneId);
        const form = (E.mob.forms as any)[zoneId]?.[species.id];
        const mob = eng.spawnAt(zoneId, species.zone_levels[zoneId], species.sizes[0], species.id);
        if (zone.levels[0] <= E.mob.form_level_cap) {
          expect(form).toBeDefined();
          expect(form.levels).toEqual(zone.levels);
          expect(eng.mobStatsOf(species.id, zoneId)).toEqual(form.core);
          expect(eng.coreOf(species, 'vit', zoneId)).toBe(form.core.vit);
          expect(mob.core).toEqual(form.core);
          expect(mob.formName).toBe(form.name);
        } else {
          expect(form).toBeUndefined();
          const priorForm = [...E.mob.zones]
            .filter((entry: any) => entry.id <= zoneId && entry.levels[0] <= E.mob.form_level_cap)
            .sort((a: any, b: any) => b.levels[0] - a.levels[0])
            .map((entry: any) => (E.mob.forms as any)[entry.id]?.[species.id])
            .find(Boolean);
          const expectedCore = priorForm?.core || species.core;
          const expectedName = priorForm?.name || species.name;
          expect(eng.mobStatsOf(species.id, zoneId)).toEqual(expectedCore);
          expect(mob.core).toEqual(expectedCore);
          expect(mob.formName).toBe(expectedName);
        }
      }
    }
  });

  it('catalogs one uniquely named fixed-Core form per race in every real level band', () => {
    const bands = E.mob.zones.filter((zone: any) => zone.levels[0] <= E.mob.form_level_cap);
    const catalog = E.mob.form_catalog as any;
    const names: string[] = [];
    let count = 0;
    for (const zone of bands) {
      expect(Object.keys(catalog[zone.id]).sort()).toEqual(E.mob.species.map((species: any) => species.id).sort());
      for (const species of E.mob.species as any[]) {
        const form = catalog[zone.id][species.id];
        expect(form.levels).toEqual(zone.levels);
        expect(form.name).toBeTruthy();
        expect(Object.values(form.core).every(Number.isInteger)).toBe(true);
        expect(form.drop_profile).toBe(species.id);
        const dropLadder = (E.mob.variants as any)[species.id];
        expect(dropLadder).toHaveLength(5);
        expect(dropLadder.slice(0, 3).every((name: string) => Boolean((E.mob.variant_drops as any)[name]))).toBe(true);
        names.push(form.name);
        count++;
      }
    }
    expect(count).toBe(E.mob.species.length * bands.length);
    expect(new Set(names).size).toBe(count);
  });

  it('gives late-zone species more than one damage archetype', () => {
    for (const zoneId of [16, 17, 18]) {
      const species = E.mob.species.filter((entry: any) => entry.zones.includes(zoneId));
      const nonPhysical = species.filter((entry: any) => entry.damage !== 'physical').length;
      expect(nonPhysical).toBeGreaterThanOrEqual(Math.ceil(species.length / 2));
    }
  });

  it('keeps swarm bodies small or medium and bruisers medium or large', () => {
    const byId = new Map(E.mob.species.map((species: any) => [species.id, species]));
    for (const id of ['kobold', 'slime', 'spider', 'wolf']) {
      expect((byId.get(id) as any).sizes).not.toContain('large');
    }
    for (const id of ['ogre', 'troll', 'golem', 'treant', 'giant']) {
      expect((byId.get(id) as any).sizes).not.toContain('small');
    }
    expect(new Set(E.mob.species.map((species: any) => species.sizes.slice().sort().join('+'))).size)
      .toBeGreaterThanOrEqual(6);
  });

  it('uses at least 40 distinct race casts across the 54 subzones', () => {
    const casts = E.mob.zones.flatMap((zone: any) => zone.subzones.map((sub: any) =>
      sub.races.slice().sort().join('+')));

    expect(casts).toHaveLength(54);
    expect(new Set(casts).size).toBeGreaterThanOrEqual(40);
  });

  it('gives bosses their own combat profile in the engine roster', () => {
    const roster = eng.mobRoster();

    for (const boss of E.mob.bosses as any[]) {
      const row = roster.find((entry: any) => entry.id === `z${boss.zone}_boss`);
      expect(row).toBeDefined();
      expect(row.innate).toEqual([boss.element]);
      expect(row.damage).toBe(boss.damage);
      expect(row.core.vit).toBe(boss.core.vit);
      expect(row.vit).toBe(row.core.vit);
      expect(row.readsAs).toBe(boss.reads_as);
    }
  });

  it('spawns the boss profile declared for the current zone', () => {
    const state = newGame(991);
    setLevel(state, 60);
    expect(huntZone(state, state.zone).ok).toBe(true);
    state.bossDueAt = state.clockSec + 0.1;
    state.spawnIn = 0;
    state.player.atkTimer = -10000;
    tick(state, {}, { autoSkills: false });

    const boss = state.group[0];
    const profile = E.mob.bosses.find((entry: any) => entry.zone === state.zone) as any;
    expect(boss.kind).toContain('Boss');
    expect(boss.innate).toEqual([profile.element]);
    expect(boss.damage).toBe(profile.damage);
    expect(boss.readsAs).toBe(profile.reads_as);
    expect(boss.trait).toBe(profile.trait);
  });

  it('keeps the collectible lean stable across each species normal variants', () => {
    for (const species of E.mob.species as any[]) {
      const variants = (E.mob.variants as Record<string, string[]>)[species.id];
      const leans = variants.slice(0, 3).map((name: string) => (E.mob.variant_drops as any)[name].lean);
      expect(new Set(leans).size).toBe(1);
      for (const name of variants.slice(3)) {
        const row = (E.mob.variant_drops as any)[name];
        if (row) expect(row.lean).toBe('none');
      }
    }
  });
});

const speciesRow = (id: string) => (E.mob.species as any[]).find((sp: any) => sp.id === id)!;
/** A spawn of one lineage in one of its own zones, shaped exactly as the sim shapes it. */
const spawnOf = (id: string, body?: string) => {
  const sp = speciesRow(id);
  return eng.spawnAt(sp.zones[0], 30, body || sp.sizes[0], sp.id);
};

describe('the species trait read as a mechanic', () => {
  it('writes the closed set onto the spawn', () => {
    expect((E.mob as any).trait_mechanics.set).toEqual(['bleed_immune', 'poison_burst', 'fast_clock', 'element_weak']);
    for (const sp of E.mob.species as any[]) {
      const base = spawnOf(sp.id);
      expect(base.immune).toEqual((sp.mechanics?.bleed_immune ? (E.mob as any).trait_mechanics.bleed_immune.statuses : []));
      expect(base.clock_mult).toBe(sp.mechanics?.fast_clock ? (E.mob as any).trait_mechanics.fast_clock.clock_mult : 1);
      expect(base.weak).toEqual(sp.mechanics?.element_weak
        ? { element: sp.mechanics.element_weak, taken_pct: (E.mob as any).trait_mechanics.element_weak.taken_pct } : null);
      expect(base.burst).toEqual(sp.mechanics?.poison_burst
        ? { ps_pct: (E.mob as any).trait_mechanics.poison_burst.ps_pct } : null);
    }
  });

  it('refuses the bleed on a bloodless body and takes it on a bloody one', () => {
    const skeleton = spawnOf('skeleton');
    const orc = spawnOf('orc');
    expect(skeleton.immune).toContain('bleed');
    expect(orc.immune).toEqual([]);
    expect(applyBleed(mulberry32(3), newMobStatusStore(), 'a', 100, 1, skeleton.immune)).toBe(false);
    expect(applyBleed(mulberry32(3), newMobStatusStore(), 'b', 100, 1, orc.immune)).toBe(true);
    // the immunity answers the status its key names and nothing else: the same body still burns
    expect(placeStatus(newMobStatusStore(), 'a', 'burn', {} as any, 20, skeleton.immune)).toBe('burn');
    expect(placeStatus(newMobStatusStore(), 'a', 'bleed', {} as any, 20, skeleton.immune)).toBe(null);
  });

  it('swings the fast clock faster for exactly the same damage per second', () => {
    const wolf = spawnOf('wolf', 'small');
    const goblin = spawnOf('goblin', 'small');
    const clockMult = (E.mob as any).trait_mechanics.fast_clock.clock_mult;
    expect(wolf.clock_mult).toBe(clockMult);
    expect(goblin.clock_mult).toBe(1);
    // the sim puts the species clock on the spawn it forms, under the one clock Cap the player obeys
    const s = newGame(12);
    setLevel(s, 1);
    huntZone(s, 1);
    s.hunting = true;
    let guard = 0;
    while (guard++ < 20000 && !s.group.some((m: any) => m.speciesId === 'wolf')) tick(s, {}, { online: true });
    const live = s.group.find((m: any) => m.speciesId === 'wolf') as any;
    expect(live).toBeDefined();
    expect(live.hitsPerSec).toBeCloseTo(Math.min(1 * clockMult, 1 / E.caps.attack_interval_sec), 10);
    const c = buildCharacter(s.player.level, s.gear);
    const slow = mobSwing(() => 0.999, c, { ...live, hitsPerSec: 1 }, {});
    const fast = mobSwing(() => 0.999, c, live, {});
    // a swing is the body's per-second output divided by its own clock, so the faster lineage lands
    // more blows of a thinner size and never deals more damage than its published PS
    expect(fast.raw * live.hitsPerSec).toBeCloseTo(slow.raw, 6);
    expect(fast.raw * live.hitsPerSec).toBeCloseTo(live.ps, 6);
  });

  it('takes more of the one Element a body is weak to, and no more of the rest', () => {
    const treant = spawnOf('treant', 'large');
    const golem = spawnOf('golem', 'large');
    expect(treant.weak?.element).toBe('fire');
    const hit = (base: any, element: string) => eng.mitigateMobHit(
      { armour: 0, res: base.res, resByElement: base.resByElement, weak: base.weak }, 0, { [element]: 100 });
    expect(hit(treant, 'fire')).toBeCloseTo(100 * (1 + (E.mob as any).trait_mechanics.element_weak.taken_pct / 100), 6);
    expect(hit(treant, 'lightning')).toBeCloseTo(100, 6);
    expect(hit(golem, 'fire')).toBeCloseTo(100, 6);
    expect(hit(golem, 'cold')).toBeGreaterThan(hit(golem, 'fire'));
  });

  it('pays its poison burst as it dies', () => {
    const s = newGame(31);
    setLevel(s, 80);
    huntZone(s, s.zone);
    s.zone = 3;
    s.hunting = true;
    s.spawnIn = 0;
    const statuses: any = {};
    let guard = 0;
    while (guard++ < 40000 && !s.group.some((m: any) => m.burst?.ps_pct)) tick(s, statuses, { online: true });
    const burst = s.group.find((m: any) => m.burst?.ps_pct) as any;
    expect(burst).toBeDefined();
    // the kill is the whole application: no proc roll, and the line is a share of the body's own output
    const perSec = burst.ps * burst.burst.ps_pct / 100;
    burst.hp = 0.5;
    tick(s, statuses, { online: true });
    expect(statuses.poison?.stacks).toBeGreaterThanOrEqual(1);
    expect(statuses.poison?.perSec).toBeCloseTo(perSec, 6);
  });
});

describe('the side the feet stand on', () => {
  const mid = (range: string) => { const [lo, hi] = range.split('-').map(Number); return (lo + hi) / 2; };

  it('fields its own pack, Elite rate and body mix, and the zone keeps the published average', () => {
    for (const zone of E.mob.zones as any[]) {
      const subs = zone.subzones || [];
      if (!subs.length) continue;
      const groups = subs.map((_: any, i: number) => {
        const [lo, hi] = eng.groupRangeOf(zone.id, i);
        return (lo + hi) / 2;
      });
      expect(groups.reduce((a: number, b: number) => a + b, 0) / groups.length).toBeCloseTo(mid(zone.group), 10);
      const elites = subs.map((_: any, i: number) => eng.eliteChanceOf(zone.id, i));
      expect(elites.reduce((a: number, b: number) => a + b, 0) / elites.length).toBeCloseTo(E.loot.elite_spawn_chance, 10);
      // bare ground, a town and a wild side are not a side: they roll the zone's own figures
      expect(eng.groupRangeOf(zone.id, null)).toEqual([Number(zone.group.split('-')[0]), Number(zone.group.split('-')[1])]);
      expect(eng.eliteChanceOf(zone.id, undefined)).toBeCloseTo(E.loot.elite_spawn_chance, 10);
      expect(eng.spawnPackOf(zone.id, null)).toEqual((E.mob as any).spawn_packs.even);
    }
  });

  /** Count the groups the hunt actually forms on one side, with nothing dying to hide a size. */
  const sampleSide = (zoneId: number, sub: number | null, want = 240) => {
    const s = newGame(1234);
    setLevel(s, 1);
    huntZone(s, zoneId);
    if (s.cell) s.cell = { ...s.cell, sub };
    let groups = 0, normals = 0, mobs = 0, smalls = 0, bodies = 0;
    for (let i = 0; i < 400000 && groups < want; i++) {
      s.hunting = true;
      s.player.hp = 1e9;
      tick(s, {}, { online: true });
      if (!s.group.length) continue;
      groups++;
      if (s.group[0].kind === 'Elite') { s.group = []; s.spawnIn = 0; continue; }
      normals++;
      mobs += s.group.length;
      for (const m of s.group) { bodies++; if (m.kind === 'Small') smalls++; m.hp = 1e9; }
      s.group = [];
      s.spawnIn = 0;
    }
    return { elite: groups ? (groups - normals) / groups : 0, pack: mobs / Math.max(1, normals), small: smalls / Math.max(1, bodies) };
  };

  it('reads crowded on one side and heavy on another, and the zone pays its published rates', () => {
    const zone = (E.mob.zones as any[]).find((z) => z.subzones?.length === 3)!;
    const sides = [0, 1, 2].map((i) => ({ i, ...sampleSide(zone.id, i, 200) }));
    const byPack = Object.fromEntries(sides.map((s) => [(zone.subzones[s.i] as any).spawn.pack, s]));
    // the swarm side rolls the denser pack, the heavy side the sparser one, and each side its own Elite rate
    expect((byPack.swarm as any).pack).toBeGreaterThan((byPack.brute as any).pack);
    expect((byPack.swarm as any).small).toBeGreaterThan((byPack.brute as any).small);
    expect((byPack.brute as any).elite).toBeGreaterThan((byPack.swarm as any).elite);
    for (const side of sides) {
      // a sampled rate, so the bar is the side's own figure within the sampling noise — not a fixed window
      expect(Math.abs(side.elite - zone.subzones[side.i].spawn.elite_pct / 100)).toBeLessThan(0.05);
    }
    // and the zone's own average is the figure the published rates state
    expect(Math.abs(sides.reduce((a, s) => a + s.pack, 0) / 3 - mid(zone.group))).toBeLessThan(0.15);
    expect(Math.abs(sides.reduce((a, s) => a + s.elite, 0) / 3 - E.loot.elite_spawn_chance)).toBeLessThan(0.03);
    const bare = sampleSide(zone.id, null, 200);
    expect(Math.abs(bare.pack - mid(zone.group))).toBeLessThan(0.15);
    expect(Math.abs(bare.elite - E.loot.elite_spawn_chance)).toBeLessThan(0.05);
  });
});
