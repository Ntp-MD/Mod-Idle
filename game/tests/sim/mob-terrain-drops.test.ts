import { liveSpecies } from '../fixtures/liveMob';
import { mobFixture } from '../fixtures/mobFixture';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { E, TOWN, eng } from '../../src/engine/client';
import { createEngine } from '@engine/index.ts';
import { mobIcon, mobSpeciesArt } from '../../src/icon/index';
import { huntZone, newGame, setLevel, spawnMob, tick } from '@sim/core/game';
import { buildCharacter } from '@sim/core/player';
import { mobSwing } from '@sim/combat/combat';
import { newMobStatusStore, applyBleed, placeStatus } from '@sim/combat/mobStatus';
import * as loot from '@engine/loot.ts';
import { leanReweight, leanReweightMany } from '@engine/loot.ts';
import { mulberry32 } from '../../src/engine/client-helpers';
import { pinFieldPopulation } from '../fixtures/mobFixture';
import { rollDrop } from '@sim/gear/drop';

const engineData = JSON.parse(readFileSync(new URL('../../../tools/data/engine.json', import.meta.url), 'utf8'));
const mapData = JSON.parse(readFileSync(new URL('../../../tools/data/map.json', import.meta.url), 'utf8'));


const FIRST = 'fixture-first', SECOND = 'fixture-second';
function engineFixture() {
  const data = structuredClone(engineData);
  const template = data.mob.species[0];
  // Engine construction computes its reference defense line from zone 9.
  const zones = [1, 4, 9].map((id, index) => ({ ...data.mob.zones[0], id,
    levels: [index * 20 + 1, (index + 1) * 20], subzones: [] }));
  data.mob.zones = zones;
  data.mob.form_level_cap = 100;
  data.mob.species = [FIRST, SECOND].map(id => ({ ...structuredClone(template), id, name: id,
    zones: zones.map(zone => zone.id), sizes: ['small', 'medium', 'large'], damage: 'physical',
    mechanics: {}, zone_levels: Object.fromEntries(zones.map(zone => [zone.id, zone.levels[0]])) }));
  data.mob.variants = Object.fromEntries([FIRST, SECOND].map(id => [id, zones.map((zone, index) => ({
    name: id + '-variant-' + index, levels: zone.levels, core: { ...template.core }, damage: 'physical',
  }))]));
  data.mob.forms = Object.fromEntries(zones.map(zone => [zone.id, Object.fromEntries([FIRST, SECOND].map(id => [id, {
    name: id + '-form-' + zone.id, levels: zone.levels, core: { ...template.core }, drop_profile: id,
  }]))]));
  data.mob.bosses = zones.map(zone => ({ ...structuredClone(engineData.mob.bosses[0]),
    zone: zone.id, species: FIRST, name: 'fixture-boss-' + zone.id }));
  data.mob.uniques = [FIRST, SECOND].map(id => ({ ...structuredClone(engineData.mob.uniques[0]),
    species: id, name: id + '-unique' }));
  return data;
}

describe('mob, terrain and drop data', () => {
  it('maps every mob environment to a terrain used by the world map', () => {
    const mapping = engineData.mob.environment_terrain as Record<string, string>;
    const environments = new Set<string>(engineData.mob.zones.flatMap((zone: any) =>
      zone.subzones.map((sub: any) => sub.environment)));
    const terrains = new Set<string>(Object.keys(mapData.terrain_colors || {}));

    expect(Object.keys(mapping).sort()).toEqual([...environments].sort());
    for (const terrain of Object.values(mapping)) expect(terrains.has(terrain)).toBe(true);
  });

  it('labels each wild-side cell with its own activity', () => {
    for (const town of TOWN.settlements as any[]) {
      const food = (E.fieldwork.regional_sources as Record<string, { food: string }>)[String(town.zone)]?.food;
      const fishable = !!food && E.fieldwork.fishing.foods.includes(food);
      const kinds = ['dungeon', 'mine', 'grove', ...(fishable ? ['fishing'] : [])];
      const sites = engineData.road.locations.filter((loc: any) => loc.zone === town.zone && loc.kind === 'site');
      expect(sites).toHaveLength(kinds.length);
      expect(sites.map((site: any) => site.site).sort()).toEqual([...kinds].sort());
    }
  });

  it('maps each presentation region to the gameplay regions of its zones', () => {
    const claimed = mapData.regions.flatMap((region: any) => region.zones);

    expect(new Set(claimed).size).toBe(claimed.length);
    expect(claimed.slice().sort((a: number, b: number) => a - b))
      .toEqual(engineData.mob.zones.map((zone: any) => zone.id).sort((a: number, b: number) => a - b));
    for (const region of mapData.regions) {
      expect(region.name).toBeTruthy();
      for (const id of region.zones) expect(engineData.mob.zones.some((zone: any) => zone.id === id)).toBe(true);
    }
  });

  it('assigns environment drop leans to the complete subzone vocabulary', () => {
    const mapping = E.mob.environment_lean as Record<string, string>;
    const environments = new Set<string>(E.mob.zones.flatMap((zone: any) =>
      zone.subzones.map((sub: any) => sub.environment)));

    expect(Object.keys(mapping).sort()).toEqual([...environments].sort());
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
    const races = new Set(E.mob.races.set);
    for (const species of E.mob.species) {
      expect(races.has(species.race), species.id).toBe(true);
      if (species.potion_source != null) expect(typeof species.potion_source, species.id).toBe('boolean');
    }
  });

  it('carries the closest earlier Variant through an authored level gap', () => {
    const data = engineFixture();
    const ladder = data.mob.variants[FIRST];
    data.mob.variants[FIRST] = [
      { ...ladder[0], levels: [20, 30] }, { ...ladder[1], levels: [50, 60] },
    ];
    const model = createEngine(data);
    expect(model.variantsInZone(FIRST, 1).map(row => row.name)).toEqual([ladder[0].name]);
    expect(model.variantsInZone(FIRST, 4).map(row => row.name)).toEqual([ladder[0].name]);
    expect(model.variantsInZone(FIRST, 9).map(row => row.name)).toEqual([ladder[1].name]);
  });

  it('lets a caster Variant use magic damage without changing its Species siblings or zone power', () => {
    const data = engineFixture();
    const caster = data.mob.variants[FIRST][1];
    caster.core = { ...caster.core, str: 4, int: 22 };
    caster.damage = 'magic';
    const beforeData = structuredClone(data);
    const oldCaster = beforeData.mob.variants[FIRST][1];
    oldCaster.damage = 'physical';
    oldCaster.core = { ...oldCaster.core, str: 22, int: 4 };
    const before = createEngine(beforeData).spawnAt(4, 'medium', FIRST);
    const model = createEngine(data);
    const castBody = model.spawnAt(4, 'medium', FIRST);
    const sibling = model.spawnAt(1, 'medium', FIRST);
    expect(castBody.damage).toBe('magic');
    expect(castBody.core.int).toBe(caster.core.int);
    expect(castBody.core.int).toBeGreaterThan(castBody.core.str);
    expect(castBody.ps).toBeCloseTo(before.ps, 10);
    expect(model.damageSplit(castBody.damage)).toEqual([0, 1]);
    expect(model.mobRoster().find(row => row.zone === 4 && row.speciesId === FIRST
      && row.variant === caster.name && row.kind === model.sizeById('small')!.name)?.damage).toBe('magic');
    expect(sibling.damage).toBe('physical');
  });

  it('supports Species with no Unique or several Uniques', () => {
    const data = engineFixture();
    const extra = structuredClone(data.mob.uniques.find((row: any) => row.species === SECOND));
    data.mob.uniques = data.mob.uniques.filter((row: any) => row.species !== FIRST);
    data.mob.uniques.push({ ...extra, name: 'fixture-extra-unique' });
    const model = createEngine(data);
    expect(model.uniquesOf(FIRST)).toEqual([]);
    expect(model.uniquesOf(SECOND)).toHaveLength(2);
    const rows = model.mobRoster().filter(row => row.speciesId === SECOND && String(row.kind).startsWith('Unique'));
    expect(new Set(rows.map(row => row.id)).size).toBe(rows.length);
    expect(rows.some(row => row.variant === 'fixture-extra-unique')).toBe(true);
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
    const data = engineFixture();
    delete data.mob.forms['4'][FIRST];
    const model = createEngine(data);
    const variant = model.variantsInZone(FIRST, 4)[0];
    const mob = model.spawnAt(4, 'small', FIRST, undefined, variant.core);
    expect(mob.formName).toBe(data.mob.forms['1'][FIRST].name);
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
    const data = engineFixture();
    data.mob.variants[FIRST] = [{ ...data.mob.variants[FIRST][0], levels: [1, 100] }];
    const model = createEngine(data);
    expect(model.variantsOf(FIRST)).toHaveLength(1);
    expect(model.variantsOf(SECOND)).toHaveLength(data.mob.variants[SECOND].length);
    for (const zone of data.mob.zones) {
      expect(model.variantsInZone(FIRST, zone.id)).toEqual([data.mob.variants[FIRST][0]]);
      expect(model.variantsInZone(SECOND, zone.id)).toEqual([data.mob.variants[SECOND]
        .find((row: any) => row.levels[0] <= zone.levels[0] && row.levels[1] >= zone.levels[1])]);
    }
  });

  it('live spawns use the fixed-level variant assigned to their zone', () => {
    for (const zone of E.mob.zones) {
      const sides = [null, ...(zone.subzones ?? []).map((_, index) => index)];
      for (const side of sides) for (const kind of ['normal', 'elite'] as const) {
        const mob = spawnMob(mulberry32(77), zone.id, kind, undefined, side, { allowWildUnique: false });
        const variants = eng.variantsInZone(mob.speciesId!, zone.id);
        expect(variants, mob.speciesId).toContainEqual(expect.objectContaining({ name: mob.variant, core: mob.core }));
        const species = E.mob.species.find(row => row.id === mob.speciesId)!;
        expect(mob.level, species.id).toBe((species.zone_levels as Record<string, number | undefined>)[zone.id]);
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
    for (const zone of E.mob.zones) for (const side of zone.subzones ?? []) for (const speciesId of side.species) {
      const variants = eng.variantsInZone(speciesId, zone.id);
      expect(variants.length, speciesId).toBeGreaterThan(0);
      for (const variant of variants) expect((E.mob.variant_drops as any)[variant.name], speciesId).toBeDefined();
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
    for (const key of E.mob.trait_mechanics.set)
      expect((E.mob.trait_mechanics as Record<string, unknown>)[key], key).toBeDefined();
    for (const species of E.mob.species as any[]) for (const key of Object.keys(species.mechanics ?? {}))
      expect(E.mob.trait_mechanics.set, species.id).toContain(key);
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
    const skeleton = spawnOf(liveSpecies(row => !!row.mechanics?.bleed_immune, 'bleed immunity').id);
    const orc = spawnOf(liveSpecies(row => !row.mechanics?.bleed_immune, 'a bleedable body').id);
    expect(skeleton.immune).toContain('bleed');
    expect(orc.immune).toEqual([]);
    expect(applyBleed(mulberry32(3), newMobStatusStore(), 'a', 100, 1, skeleton.immune)).toBe(false);
    expect(applyBleed(mulberry32(3), newMobStatusStore(), 'b', 100, 1, orc.immune)).toBe(true);
    // the immunity answers the status its key names and nothing else: the same body still burns
    expect(placeStatus(newMobStatusStore(), 'a', 'burn', {} as any, 20, skeleton.immune)).toBe('burn');
    expect(placeStatus(newMobStatusStore(), 'a', 'bleed', {} as any, 20, skeleton.immune)).toBe(null);
  });

  it('swings the fast clock faster for exactly the same damage per second', () => {
    const quick = liveSpecies(row => !!row.mechanics?.fast_clock, 'fast attack clock');
    const plain = liveSpecies(row => !row.mechanics?.fast_clock, 'ordinary attack clock');
    const base = spawnOf(quick.id);
    const clockMult = E.mob.trait_mechanics.fast_clock.clock_mult;
    expect(base.clock_mult).toBe(clockMult);
    expect(spawnOf(plain.id).clock_mult).toBe(1);
    const state = newGame(12);
    const body = mobFixture({ ...base, hitsPerSec: Math.min(clockMult, 1 / E.caps.attack_interval_sec) });
    const sheet = buildCharacter(state.player.level, state.gear);
    const slow = mobSwing(() => 0.999, sheet, { ...body, hitsPerSec: 1 }, {});
    const fast = mobSwing(() => 0.999, sheet, body, {});
    expect(fast.raw * body.hitsPerSec).toBeCloseTo(slow.raw, 6);
    expect(fast.raw * body.hitsPerSec).toBeCloseTo(body.ps, 6);
  });

  it('takes more of the one Element a body is weak to, and no more of the rest', () => {
    for (const species of E.mob.species) {
      const body = spawnOf(species.id);
      const weak = body.weak;
      if (!weak) continue;
      const hit = (element: string) => eng.mitigateMobHit({ armour: 0, res: 0, weak }, 0, { [element]: 100 });
      expect(hit(weak.element), species.id).toBeCloseTo(100 * (1 + weak.taken_pct / 100), 6);
      for (const element of Object.keys(E.elements.status_of).filter(element => element !== weak.element))
        expect(hit(element), species.id).toBeCloseTo(100, 6);
    }
  });

  it('pays its poison burst as it dies', () => {
    const species = liveSpecies(row => !!row.mechanics?.poison_burst, 'poison death burst');
    const state = newGame(31);
    setLevel(state, 80);
    state.zone = species.zones[0];
    state.hunting = true;
    const base = spawnOf(species.id);
    const body = mobFixture({ ...base, id: 'burst-fixture', speciesId: species.id, hp: 0.5, hpMax: base.hp });
    const perSec = body.ps * body.burst!.ps_pct / 100;
    state.group = [body];
    pinFieldPopulation(state);
    state.playerStatuses = {};
    tick(state, { online: true });
    expect(state.playerStatuses.poison?.stacks).toBeGreaterThanOrEqual(1);
    expect(state.playerStatuses.poison?.perSec).toBeCloseTo(perSec, 6);
  });
});

describe('the side the feet stand on', () => {
  const range = (value: string) => value.split('-').map(Number);

  it('uses the zone defaults when no named side is selected', () => {
    for (const zone of E.mob.zones) {
      expect(eng.groupRangeOf(zone.id, null)).toEqual(range(zone.group));
      expect(eng.eliteChanceOf(zone.id, undefined)).toBe(E.loot.elite_spawn_chance);
      expect(eng.spawnPackOf(zone.id, null)).toEqual(E.mob.spawn_packs.even);
    }
  });

  it('reads every authored side without fixing its count, mix or relative strength', () => {
    for (const zone of E.mob.zones) for (const [index, side] of (zone.subzones ?? []).entries()) {
      expect(eng.groupRangeOf(zone.id, index)).toEqual(range(side.spawn.group));
      expect(eng.eliteChanceOf(zone.id, index)).toBe(side.spawn.elite_pct / 100);
      expect(eng.spawnPackOf(zone.id, index)).toEqual(
        (E.mob.spawn_packs as Record<string, unknown>)[side.spawn.pack]);
    }
  });
});
