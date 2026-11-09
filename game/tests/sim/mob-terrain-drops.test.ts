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
    mechanics: {} }));
  data.mob.variants = zones.flatMap((zone, index) => [FIRST, SECOND].map(id => ({
    id: `${id}.z${String(zone.id).padStart(2, '0')}.s01`, species: id, name: id + '-variant-' + index,
    level: zone.levels[0], zone: zone.id, subzone: 1, role: 'line', weight: 20,
    core: { ...template.core }, damage: 'physical',
  })));
  data.mob.forms = Object.fromEntries(zones.map(zone => [zone.id, Object.fromEntries([FIRST, SECOND].map(id => [id, {
    name: id + '-form-' + zone.id, levels: zone.levels, core: { ...template.core }, drop_profile: id,
  }]))]));
  data.mob.bosses = zones.map(zone => ({ ...structuredClone(engineData.mob.bosses[0]),
    id: `${FIRST}.z${String(zone.id).padStart(2, '0')}.boss`, level: zone.levels[1], zone: zone.id, species: FIRST,
    name: 'fixture-boss-' + zone.id }));
  data.mob.uniques = [FIRST, SECOND].map((id, index) => ({ ...structuredClone(engineData.mob.uniques[0]),
    id: `${id}.z01.unique`, zone: zones[0].id, level: zones[0].levels[1], weight: 1, species: id, name: id + '-unique' }));
  return data;
}

describe('mob, terrain and drop data', () => {

  it('resolves every placement by its stable id and authored Zone/Subzone', () => {
    const ids = new Set<string>();
    for (const row of E.mob.variants as any[]) {
      expect(ids.has(row.id), row.id).toBe(false);
      ids.add(row.id);
      expect(eng.placementById(row.id)).toBe(row);
      expect(eng.placementsIn(row.zone, row.subzone)).toContainEqual(row);
      expect(eng.placementsIn(row.zone)).toContainEqual(row);
    }
    expect(() => eng.placementById('nope.z01.s99')).toThrow(RangeError);
    expect(() => eng.placementsIn(99)).toThrow(RangeError);
    expect(() => eng.placementsIn(1, 99)).toThrow(RangeError);
  });

  it('adds a newly authored placement to its side pool and removes it from that side only', () => {
    const data = structuredClone(engineData);
    const pool = data.mob.zones[0].subzones[0];
    const speciesId = pool.species.find((id: string) => {
      const species = data.mob.species.find((row: any) => row.id === id);
      return species.sizes.includes('small') || species.sizes.includes('medium');
    });
    const row = {
      id: `${speciesId}.z01.s01`, species: speciesId, name: 'Probe Sibling', level: 5,
      zone: 1, subzone: 1, role: 'line', weight: 20, core: { ...speciesRow(speciesId).core },
    };
    (data.mob.variants as any[]).push(row);
    (data.mob.variant_drops as any)[row.id] = { item: 'Probe Item', rarity: 'common', lean: 'none' };
    const context = { subzone: 1, rank: 'normal' as const, bodyHint: null, terrain: null, standing: true };
    const withRow = createEngine(data).placementPool(1, context).map((entry: any) => entry.id);
    expect(withRow).toContain(row.id);
    const removed = structuredClone(data);
    removed.mob.variants = (removed.mob.variants as any[]).filter((entry: any) => entry.id !== row.id);
    const model = createEngine(removed);
    expect(model.placementPool(1, context).map((entry: any) => entry.id)).not.toContain(row.id);
    expect(model.placementsIn(2).some((entry: any) => entry.id === row.id)).toBe(false);
  });

  it('puts Int above Str on every magic-damage placement', () => {
    const rows = (E.mob.variants as any[]).filter((row) => (row.damage ?? speciesRow(row.species).damage) === 'magic');
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) expect(row.core.int).toBeGreaterThan(row.core.str);
  });

  it('lets one placement use magic damage without changing its siblings or the zone power mean', () => {
    const data = structuredClone(engineData);
    const target = data.mob.variants.find((row: any) => row.species === 'goblin' && row.zone === 1)!;
    const peers = data.mob.variants.filter((row: any) => row.species === 'goblin' && row.zone === 1 && row.id !== target.id);
    target.core = { ...target.core, str: 4, int: 22 };
    target.damage = 'magic';
    const model = createEngine(data);
    const cast = model.spawnAt(target.zone, 'medium', target.id);
    expect(cast.damage).toBe('magic');
    expect(cast.core.int).toBeGreaterThan(cast.core.str);
    const expectedPs = model.mobPsAt(cast.level) * model.sizeById('medium')!.ps / model.zoneBodyFactor(target.zone)
      * model.speciesPsMult(target.zone, target.species, target.core, 'magic');
    expect(cast.ps).toBeCloseTo(expectedPs, 10);
    expect(model.damageSplit(cast.damage)).toEqual([0, 1]);
    for (const peer of peers) expect(model.spawnAt(peer.zone, 'medium', peer.id).damage).not.toBe('magic');
  });

  it('returns [] or the Zone Uniques and keeps every special id unique', () => {
    const rows = new Set<string>();
    for (const zone of E.mob.zones) {
      for (const species of E.mob.species) {
        for (const unique of eng.uniquesOf(species.id, zone.id)) {
          expect(unique.zone).toBe(zone.id);
          expect(unique.species).toBe(species.id);
          expect(rows.has(unique.id), unique.id).toBe(false);
          rows.add(unique.id);
        }
      }
    }
    expect(rows.size).toBe(E.mob.uniques.length);
    for (const boss of E.mob.bosses as any[]) {
      expect(eng.placementById(boss.id)).toBe(boss);
      expect(rows.has(boss.id)).toBe(false);
      rows.add(boss.id);
    }
    expect(rows.size).toBe(E.mob.uniques.length + E.mob.bosses.length);
  });

  it('makes the placement own spawn level, Core and display name', () => {
    for (const row of E.mob.variants as any[]) {
      const body = speciesRow(row.species).sizes[0];
      const mob = eng.spawnAt(row.zone, body, row.id);
      expect(mob.level).toBe(row.level);
      expect(mob.core).toEqual(row.core);
      expect(mob.formName).toBe(speciesRow(row.species).name);
      expect(mob.placementId).toBe(row.id);
    }
  });

  it('keeps form rows and the reference catalogue as data, not live level owners', () => {
    const bands = E.mob.zones.filter((zone) => zone.levels[0] <= E.mob.form_level_cap);
    const forms = E.mob.forms as any;
    const names = new Set<string>();
    for (const zone of bands) for (const [speciesId, form] of Object.entries<any>(forms[zone.id] || {})) {
      expect(E.mob.species.some((species) => species.id === speciesId)).toBe(true);
      expect(form.levels).toEqual(zone.levels);
      expect(names.has(form.name)).toBe(false);
      names.add(form.name);
      expect(Object.values(form.core).every(Number.isInteger)).toBe(true);
    }
    expect(Number.isFinite(eng.MEAN_CORE.str)).toBe(true);
    expect(eng.MOB_EVASION_REF).toBeGreaterThan(0);
  });

  it('spawns each live normal/Elite from an authored placement', () => {
    for (const zone of E.mob.zones) {
      const sides = [null, ...((zone.subzones ?? []).map((_, index) => index))];
      for (const side of sides) for (const kind of ['normal', 'elite'] as const) {
        const mob = spawnMob(mulberry32(77), zone.id, kind, undefined, side, { allowWildUnique: false });
        const row = eng.placementById(mob.placementId!);
        expect(row.species).toBe(mob.speciesId);
        expect(row.zone).toBe(zone.id);
        expect(row.name).toBe(mob.variant);
        expect(mob.level).toBe(row.level);
        expect(mob.core).toEqual(row.core);
      }
    }
  });

  it('fields only species with a small/medium body and one lean per placement', () => {
    const drops = E.mob.variant_drops as any;
    for (const row of E.mob.variants as any[]) {
      const sp = speciesRow(row.species);
      expect(sp.sizes.some((size: string) => size === 'small' || size === 'medium'), row.id).toBe(true);
      expect(drops[row.id], row.id).toBeDefined();
      const first = (E.mob.variants as any[]).find((entry) => entry.species === row.species)!;
      expect(drops[row.id].lean).toBe(drops[first.id].lean);
    }
    for (const unique of E.mob.uniques as any[]) expect(drops[unique.id].lean).toBe('none');
  });
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


  it('keeps Race classification separate from explicit potion eligibility', () => {
    const races = new Set(E.mob.races.set);
    for (const species of E.mob.species) {
      expect(races.has(species.race), species.id).toBe(true);
      if (species.potion_source != null) expect(typeof species.potion_source, species.id).toBe('boolean');
    }
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

  it('pays a saved retired placement the same reward as its pinned legacy payload', () => {
    const id = 'skeleton.z01.s01';
    const drop = (E.mob.retired_variant_drops as Record<string, any>)[id];
    expect(drop).toBeDefined();
    expect(eng.placementsIn(1).some(row => row.id === id)).toBe(false);
    let paidJunk = false;
    for (let seed = 1; seed <= 64 && !paidJunk; seed++) {
      const state = newGame(seed);
      setLevel(state, 80);
      state.cell = { q: 0, r: -1, sub: 0, site: null };
      state.hunting = true;
      state.group = [mobFixture({ id: 'retired', species: 'Skeleton', speciesId: 'skeleton',
        placementId: id, variant: 'Warrior Skeleton', level: 11, hp: 1, hpMax: 1, ps: 0,
        acc: 0, innate: [], damage: 'physical' })];
      pinFieldPopulation(state);
      state.field!.actors = [{ id: 'retired', x: state.field!.player.x + 1, y: state.field!.player.y }];
      const pinned = structuredClone(state);
      pinned.group[0].legacySnapshot = true;
      pinned.group[0].legacyDrop = { item: drop.item, rarity: drop.rarity, lean: drop.lean };
      for (let second = 0; second < 10 && state.counters.kills === 0; second++) {
        tick(state, { online: true, autoSkills: false });
        tick(pinned, { online: true, autoSkills: false });
      }
      expect(state.counters.kills).toBe(1);
      expect(state.junk).toEqual(pinned.junk);
      expect(state.counters.junk).toBe(pinned.counters.junk);
      expect(state.rngState).toBe(pinned.rngState);
      paidJunk = state.counters.junk > 0;
    }
    expect(paidJunk).toBe(true);
  });

  it('gives bosses their own combat profile in the engine roster', () => {
    const roster = eng.mobRoster();

    for (const boss of E.mob.bosses as any[]) {
      const row = roster.find((entry: any) => entry.id === `${boss.id}_boss`);
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

});

const speciesRow = (id: string) => (E.mob.species as any[]).find((sp: any) => sp.id === id)!;
/** A spawn of one lineage in one of its own zones, shaped exactly as the sim shapes it. */
const spawnOf = (id: string, body?: string) => {
  const sp = speciesRow(id);
  const row = (E.mob.variants as any[]).find((entry) => entry.species === id)!;
  return eng.spawnAt(row.zone, body || sp.sizes[0], row.id);
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
