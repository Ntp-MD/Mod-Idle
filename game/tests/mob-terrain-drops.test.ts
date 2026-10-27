import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { E, eng } from '../src/engine/client';
import { createEngine } from '../../engine/index.ts';
import { mobIcon, mobSpeciesArt } from '../src/icon/index';
import { huntZone, newGame, setLevel, spawnMob, tick } from '../src/sim/core/game';
import { buildCharacter } from '../src/sim/core/player';
import { mobSwing } from '../src/sim/combat/combat';
import { newMobStatusStore, applyBleed, placeStatus } from '../src/sim/combat/mobStatus';
import { road, settlementZone } from '../src/sim/world/road';
import type { Mob } from '../src/sim/core/types';
import * as loot from '../../engine/loot.ts';
import { leanReweight, leanReweightMany } from '../../engine/loot.ts';
import { mulberry32 } from '../src/engine/client-helpers';
import { pinFieldPopulation } from './mobFixture';
import { rollDrop } from '../src/sim/gear/drop';

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

  it('uses finite positive species power multipliers', () => {
    const power = E.mob.species.map((species: any) => species.power_base);

    expect(power.every((value: number) => Number.isFinite(value) && value > 0)).toBe(true);
  });

  it('puts Int above Str on every magic-damage Variant', () => {
    const variants = (E.mob.species as any[]).flatMap((species) =>
      ((E.mob.variants as any)[species.id] || []).filter((variant: any) => (variant.damage ?? species.damage) === 'magic'));
    expect(variants.length).toBeGreaterThan(0);
    for (const variant of variants) expect(variant.core.int).toBeGreaterThan(variant.core.str);
  });

  it('keeps Race classification separate from explicit potion eligibility', () => {
    const races = new Set((E.mob.races as any).set as string[]);
    expect(E.mob.species.every((species: any) => races.has(species.race))).toBe(true);
    expect(races.has('fish')).toBe(true);
    expect(races.has('celestial')).toBe(true);
    expect((E.mob.species.find((species: any) => species.id === 'goblin') as any).race).toBe('humanoid');
    expect((E.mob.species.find((species: any) => species.id === 'orc') as any).race).toBe('humanoid');
    expect((E.mob.species.find((species: any) => species.id === 'kobold') as any).race).toBe('humanoid');
    // Kobold and Lizardman are Tribal lines that DO mint a potion; the brute humanoids of the same Race
    // do not, so `race === 'humanoid'` cannot be what grants the drop.
    expect((E.mob.species.find((species: any) => species.id === 'kobold') as any).potion_source).toBe(true);
    expect((E.mob.species.find((species: any) => species.id === 'ogre') as any).potion_source).toBeUndefined();
    expect((E.mob.species.find((species: any) => species.id === 'troll') as any).potion_source).toBeUndefined();
  });

  it('carries the closest earlier Variant through an authored level gap', () => {
    const data = structuredClone(engineData);
    const ladder = data.mob.variants.goblin;
    data.mob.variants.goblin = [
      { ...ladder[0], levels: [20, 30] },
      { ...ladder[1], levels: [50, 60] },
    ];
    const testEngine = createEngine(data);

    expect(testEngine.variantsInZone('goblin', 1).map((variant: any) => variant.name)).toEqual([ladder[0].name]);
    expect(testEngine.variantsInZone('goblin', 4).map((variant: any) => variant.name)).toEqual([ladder[0].name]);
    expect(testEngine.variantsInZone('goblin', 7).map((variant: any) => variant.name)).toEqual([ladder[1].name]);
  });

  it('lets a caster Variant use magic damage without changing its Species siblings or zone power', () => {
    const casterCore = engineData.mob.variants.goblin.find((variant: any) => variant.name === 'Shaman Goblin').core;
    const casterInt = casterCore.int;
    const beforeData = structuredClone(engineData);
    const oldCaster = beforeData.mob.variants.goblin.find((variant: any) => variant.name === 'Shaman Goblin');
    delete oldCaster.damage;
    oldCaster.core.str = casterInt;
    oldCaster.core.int = 4;
    const before = createEngine(beforeData).spawnAt(5, 'medium', 'goblin');
    const data = structuredClone(engineData);
    const caster = data.mob.variants.goblin.find((variant: any) => variant.name === 'Shaman Goblin');
    caster.damage = 'magic';

    const testEngine = createEngine(data);
    const shaman = testEngine.spawnAt(5, 'medium', 'goblin');
    const sneak = testEngine.spawnAt(1, 'medium', 'goblin');

    expect(shaman.damage).toBe('magic');
    expect(shaman.core.int).toBe(casterInt);
    expect(shaman.core.int).toBeGreaterThan(shaman.core.str);
    expect(shaman.ps).toBeCloseTo(before.ps, 10);
    expect(testEngine.damageSplit(shaman.damage)).toEqual([0, 1]);
    expect(testEngine.mobRoster().find((row: any) => row.zone === 5 && row.speciesId === 'goblin'
      && row.variant === 'Shaman Goblin' && row.kind === 'Small')?.damage).toBe('magic');
    expect(sneak.damage).toBe('physical');
  });

  it('supports Species with no Unique or several Uniques', () => {
    const data = structuredClone(engineData);
    const extra = structuredClone(data.mob.uniques.find((unique: any) => unique.species === 'orc'));
    data.mob.uniques = data.mob.uniques.filter((unique: any) => unique.species !== 'goblin');
    data.mob.uniques.push({ ...extra, name: 'Orc Mire Champion' });
    const flexibleEngine = createEngine(data);

    expect(flexibleEngine.uniquesOf('goblin')).toEqual([]);
    expect(flexibleEngine.uniquesOf('orc')).toHaveLength(2);
    const orcRows = flexibleEngine.mobRoster().filter((row: any) => row.speciesId === 'orc' && String(row.kind).startsWith('Unique'));
    expect(new Set(orcRows.map((row: any) => row.id)).size).toBe(orcRows.length);
    expect(orcRows.some((row: any) => row.variant === 'Orc Mire Champion')).toBe(true);
  });

  it('uses authored field forms when present and inherits the latest label when absent', () => {
    for (const species of E.mob.species as any[]) {
      for (const zoneId of species.zones) {
        const zone = E.mob.zones.find((entry: any) => entry.id === zoneId)!;
        const form = (E.mob.forms as any)[zoneId]?.[species.id];
        const assigned = eng.variantsInZone(species.id, zoneId)[0] || null;
        const mob = eng.spawnAt(zoneId, species.sizes[0], species.id, undefined, assigned?.core);
        expect(mob.level).toBe(species.zone_levels[zoneId]);
        if (zone.levels[0] <= E.mob.form_level_cap) {
          if (form) expect(form.levels).toEqual(zone.levels);
          const previousForm = [...E.mob.zones]
            .filter((entry: any) => entry.id <= zoneId && entry.levels[0] <= E.mob.form_level_cap && (E.mob.forms as any)[entry.id]?.[species.id])
            .sort((a: any, b: any) => b.levels[0] - a.levels[0])
            .map((entry: any) => (E.mob.forms as any)[entry.id][species.id])
            .find(Boolean);
          const expectedLabel = form?.name || previousForm?.name || species.name;
          expect(assigned).toBeDefined();
          expect(eng.mobStatsOf(species.id, zoneId)).toEqual(form?.core || previousForm?.core || species.core);
          expect(mob.core).toEqual(assigned!.core);
          expect(mob.formName).toBe(expectedLabel);
        } else {
          expect(form).toBeUndefined();
          const priorForm = [...E.mob.zones]
            .filter((entry: any) => entry.id <= zoneId && entry.levels[0] <= E.mob.form_level_cap)
            .sort((a: any, b: any) => b.levels[0] - a.levels[0])
            .map((entry: any) => (E.mob.forms as any)[entry.id]?.[species.id])
            .find(Boolean);
          const frozenVariant = eng.variantsOf(species.id).at(-1);
          const expectedLegacyCore = priorForm?.core || species.core;
          const expectedCore = frozenVariant?.core || expectedLegacyCore;
          const expectedName = priorForm?.name || species.name;
          expect(eng.mobStatsOf(species.id, zoneId)).toEqual(expectedLegacyCore);
          expect(mob.core).toEqual(expectedCore);
          expect(mob.formName).toBe(expectedName);
        }
      }
    }
  });

  it('inherits a Species field label from the previous available form', () => {
    const data = structuredClone(engineData);
    delete data.mob.forms['2'].goblin;
    const fallbackEngine = createEngine(data);
    const variant = fallbackEngine.variantsInZone('goblin', 2)[0];
    const mob = fallbackEngine.spawnAt(2, 'small', 'goblin', undefined, variant.core);

    expect(mob.formName).toBe(data.mob.forms['1'].goblin.name);
    expect(mob.core).toEqual(variant.core);
  });

  it('validates any authored field-form rows without requiring a full grid', () => {
    const bands = E.mob.zones.filter((zone: any) => zone.levels[0] <= E.mob.form_level_cap);
    const forms = E.mob.forms as any;
    const names: string[] = [];
    let count = 0;
    for (const zone of bands) {
      for (const [speciesId, form] of Object.entries<any>(forms[zone.id] || {})) {
        expect(E.mob.species.some((species: any) => species.id === speciesId)).toBe(true);
        expect(form.levels).toEqual(zone.levels);
        expect(form.name).toBeTruthy();
        expect(Object.values(form.core).every(Number.isInteger)).toBe(true);
        expect(form.drop_profile).toBe(speciesId);
        names.push(form.name);
        count++;
      }
    }
    expect(new Set(names).size).toBe(count);
  });

  it('fields a Species with one Variant or several without a fixed count rule', () => {
    const data = structuredClone(engineData);
    const goblin = data.mob.variants.goblin[0];
    data.mob.variants.goblin = [{ ...goblin, levels: [1, 100] }];
    data.mob.variants.orc = [
      { ...data.mob.variants.orc[0], levels: [1, 25] },
      { ...data.mob.variants.orc[1], levels: [26, 60] },
      { ...data.mob.variants.orc[2], levels: [61, 100] },
    ];
    const flexibleEngine = createEngine(data);

    expect(flexibleEngine.variantsOf('goblin')).toHaveLength(1);
    expect(flexibleEngine.variantsOf('orc')).toHaveLength(3);
    for (const zone of data.mob.zones.filter((entry: any) => entry.levels[0] <= data.mob.form_level_cap)) {
      expect(flexibleEngine.variantsInZone('goblin', zone.id)).toHaveLength(1);
      expect(flexibleEngine.variantsInZone('orc', zone.id)).toHaveLength(1);
    }
  });

  it('live spawns use the fixed-level variant assigned to their zone', () => {
    const ladders = E.mob.variants as unknown as Record<string, { name: string; levels: [number, number]; core: Record<string, number> }[]>;
    for (const zoneId of [1, 6, 10]) {
      const zone = E.mob.zones.find((entry: any) => entry.id === zoneId)!;
      const seen: Mob[] = [];
      for (let seed = 1; seed <= 36 && seen.length < 6; seed++) {
        const s = newGame(seed);
        setLevel(s, zone.levels[0]);
        const town = road.nodes.find((node: any) => settlementZone(node.id) === zoneId)!;
        s.town.visited = [...new Set([...s.town.visited, town.id])];
        expect(huntZone(s, zoneId).ok).toBe(true);
        s.hunting = true;
        for (let step = 0; step < 250 && seen.length < 6; step++) {
          tick(s, { online: true });
          const mob = s.group.find((candidate) => candidate.speciesId != null
            && ladders[candidate.speciesId]?.some((variant) => variant.name === candidate.variant));
          if (mob) {
            seen.push(mob);
            break;
          }
          if (s.group.length) {
            s.group = [];
              }
        }
      }
      expect(seen).toHaveLength(6);
      for (const mob of seen) {
        const variants = eng.variantsInZone(mob.speciesId!, zoneId);
        expect(variants).toHaveLength(1);
        expect(mob.variant).toBe(variants[0]!.name);
        expect(mob.level).toBe((E.mob.species as any[]).find((sp) => sp.id === mob.speciesId)!.zone_levels[zoneId]);
        expect(mob.core).toEqual(variants[0]!.core);
      }
    }
  });

  it('gives every Species with Variants a Small or Medium body the group spawner can field', () => {
    const normalSpecies = Object.keys(E.mob.variants as Record<string, unknown[]>);
    const speciesById = new Map(E.mob.species.map((species: any) => [species.id, species]));

    for (const speciesId of normalSpecies) {
      const species = speciesById.get(speciesId) as any;
      expect(species.sizes.some((size: string) => size === 'small' || size === 'medium'), speciesId).toBe(true);
    }
  });

  it('allows a Species to declare a subset of unique junk alternatives', () => {
    const extras: string[] = E.mob.species.flatMap((species: any) => {
      const rarities = Object.keys(species.junk_items || {});
      expect(rarities.length).toBeGreaterThanOrEqual(1);
      expect(rarities.length).toBeLessThanOrEqual(3);
      expect(rarities.every((rarity) => ['common', 'uncommon', 'rare'].includes(rarity))).toBe(true);
      return Object.values(species.junk_items || {}) as string[];
    });
    const existing = Object.values(E.mob.variant_drops as Record<string, any>).map((row) => row.item);

    expect(new Set(extras).size).toBe(extras.length);
    expect(extras.some((item: string) => existing.includes(item))).toBe(false);
  });

  it('allows one Species in subzones with different environments and keeps its Variants fieldable', () => {
    const zone = E.mob.zones.find((entry: any) => entry.id === 1) as any;
    const appearances = new Map<string, any[]>();
    for (const subzone of zone.subzones) {
      for (const speciesId of subzone.species) {
        appearances.set(speciesId, [...(appearances.get(speciesId) || []), subzone]);
      }
    }
    const overlap = [...appearances.entries()].find(([, subzones]) =>
      new Set(subzones.map((subzone) => subzone.environment)).size > 1);

    expect(overlap).toBeDefined();
    if (!overlap) return;
    const [speciesId] = overlap;
    // the Species' fixed-level Variants field the zone whose band they own, whatever the side
    const fieldable = eng.variantsInZone(speciesId, zone.id);
    expect(fieldable.length).toBeGreaterThan(0);
    for (const v of fieldable) {
      expect((E.mob.variant_drops as any)[v.name]).toBeDefined();
    }
  });

  it('resolves a distinct icon for every Species', () => {
    const icons = E.mob.species.map((species: any) => mobSpeciesArt(species.id));

    expect(icons.every(Boolean)).toBe(true);
    expect(new Set(icons).size).toBe(E.mob.species.length);
    expect(E.mob.species.map((species: any) => mobIcon(species.id))).toEqual(icons);
  });

  it('chooses the Variant junk item or the matching Species alternative', () => {
    const chooseJunkItem = (loot as any).chooseJunkItem;
    expect(typeof chooseJunkItem).toBe('function');
    if (typeof chooseJunkItem !== 'function') return;

    expect(chooseJunkItem(() => 0, 'Variant item', 'common', { common: 'Common Species item' }))
      .toBe('Variant item');
    expect(chooseJunkItem(() => 0.75, 'Variant item', 'common', { common: 'Common Species item', rare: 'Rare Species item' }))
      .toBe('Common Species item');
    expect(chooseJunkItem(() => 0.75, 'Variant item', 'uncommon', { common: 'Common Species item', rare: 'Rare Species item' }))
      .toBe('Variant item');
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
    state.player.atkTimer = -10000;
    tick(state, { autoSkills: false });

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
      const variants = (E.mob.variants as Record<string, { name: string }[]>)[species.id];
      const leans = variants.map((v) => (E.mob.variant_drops as any)[v.name].lean);
      expect(new Set(leans).size).toBe(1);
    }
    for (const u of ((E.mob as any).uniques || []) as any[]) {
      expect((E.mob.variant_drops as any)[u.name].lean).toBe('none');
    }
  });
});

const speciesRow = (id: string) => (E.mob.species as any[]).find((sp: any) => sp.id === id)!;
/** A spawn of one lineage in one of its own zones, shaped exactly as the sim shapes it. */
const spawnOf = (id: string, body?: string) => {
  const sp = speciesRow(id);
  return eng.spawnAt(sp.zones[0], body || sp.sizes[0], sp.id);
};

describe('the species trait read as a mechanic', () => {
  it('writes the closed set onto the spawn', () => {
    expect((E.mob as any).trait_mechanics.set).toEqual(['bleed_immune', 'poison_burst', 'fast_clock']);
    for (const sp of E.mob.species as any[]) {
      const base = spawnOf(sp.id);
      expect(base.immune).toEqual((sp.mechanics?.bleed_immune ? (E.mob as any).trait_mechanics.bleed_immune.statuses : []));
      expect(base.clock_mult).toBe(sp.mechanics?.fast_clock ? (E.mob as any).trait_mechanics.fast_clock.clock_mult : 1);
      expect(base.weak).toEqual({ element: sp.weakness.element, taken_pct: sp.weakness.taken_pct });
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
    while (guard++ < 20000 && !s.group.some((m: any) => m.speciesId === 'wolf')) tick(s, { online: true });
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
    const treantWeakness = (E.mob.species as any[]).find((sp) => sp.id === 'treant').weakness.taken_pct;
    expect(hit(treant, 'fire')).toBeCloseTo(100 * (1 + treantWeakness / 100), 6);
    expect(hit(treant, 'lightning')).toBeCloseTo(100, 6);
    expect(hit(golem, 'fire')).toBeCloseTo(100, 6);
    expect(hit(golem, golem.weak!.element)).toBeGreaterThan(hit(golem, 'fire'));
  });

  it('pays its poison burst as it dies', () => {
    const s = newGame(31);
    setLevel(s, 80);
    huntZone(s, s.zone);
    s.zone = 3;
    s.hunting = true;
    let guard = 0;
    while (guard++ < 40000 && !s.group.some((m: any) => m.burst?.ps_pct)) tick(s, { online: true });
    const burst = s.group.find((m: any) => m.burst?.ps_pct) as any;
    expect(burst).toBeDefined();
    // the kill is the whole application: no proc roll, and the line is a share of the body's own output
    const perSec = burst.ps * burst.burst.ps_pct / 100;
    s.group = [burst];
    pinFieldPopulation(s, 1);
    s.playerStatuses = {};
    burst.hp = 0.5;
    tick(s, { online: true });
    expect(s.playerStatuses.poison?.stacks).toBeGreaterThanOrEqual(1);
    expect(s.playerStatuses.poison?.perSec).toBeCloseTo(perSec, 6);
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

  it('reads the authored body mix and Elite rate per side', () => {
    const zone = (E.mob.zones as any[]).find((z) => z.subzones?.length === 3)!;
    const sides = [0, 1, 2].map((i) => {
      const rng = mulberry32(500 + i);
      let smalls = 0;
      for (let n = 0; n < 240; n++) {
        const mob = spawnMob(rng, zone.id, 'normal', undefined, i, { allowWildUnique: false });
        if (mob.kind === 'Small') smalls++;
      }
      return { i, small: smalls / 240, elite: eng.eliteChanceOf(zone.id, i) };
    });
    const byPack = Object.fromEntries(sides.map((side) => [(zone.subzones[side.i] as any).spawn.pack, side]));
    // The body mix and Elite rate stay authored per side; population size and respawn are zone data.
    expect((byPack.swarm as any).small).toBeGreaterThan((byPack.brute as any).small);
    expect((byPack.brute as any).elite).toBeGreaterThan((byPack.swarm as any).elite);
    for (const side of sides)
      expect(side.elite).toBeCloseTo(zone.subzones[side.i].spawn.elite_pct / 100, 9);
  });
});
