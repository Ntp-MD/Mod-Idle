import { describe, expect, it } from 'vitest';
import { createDelivery, type AcquisitionContext, type DeliveryCfg } from '../../engine/delivery';
import { createEngine } from '../../engine/index';
import { createTrade, type TradeCfg, type TradeGood } from '../../engine/trade';
import { ED, TOWN } from '../src/engine/client';
import { acquisitionContext } from '../src/sim/town/delivery';
import { newGame } from '../src/sim/core/game';

function fixture(authored = false) {
  const data = structuredClone(ED);
  const engine = createEngine(data);
  const trade = createTrade(data, structuredClone(TOWN.trade) as TradeCfg);
  const model = createDelivery(data, structuredClone(TOWN.delivery) as DeliveryCfg, trade, engine);
  if (!authored) for (const key of Object.keys(model.sources)) delete model.sources[key];
  const low = data.mob.zones.find((zone) => zone.quality.startsWith('low'))!.id;
  const high = data.mob.zones.find((zone) => zone.quality.startsWith('high'))!.id;
  function good(id: string) {
    const [bucket, key] = id.split(':');
    trade.byId[id] = { id, key, bucket, name: key, group: bucket, value: 1, sourceZones: [], uses: [] } as TradeGood;
    return id;
  }
  function context(overrides: Partial<AcquisitionContext> = {}): AcquisitionContext {
    return {
      owned: {}, levels: { mining: 100, woodcutting: 100, cooking: 100, farming: 100 },
      zones: data.mob.zones.map((zone) => zone.id), canCamp: () => true, canHunt: () => true,
      camp: null, freeRelocations: 0, campCosts: {}, plots: [{ tier: null, readyAt: 0 }], plotCapacity: 1, now: 0,
      travelFromCurrent: () => 0, travelBetween: () => 0, ...overrides,
    };
  }
  return { data, engine, trade, model, low, high, good, context };
}

describe('delivery acquisition identity and availability', () => {
  it('uses a fully carried target despite inaccessible sources and skills', () => {
    const f = fixture(), target = f.good('food:carried-meal');
    f.model.sources[target] = [{ kind: 'cook', zone: f.low, skill: 'cooking', level: 20, camp: true, seconds: 0, yield: 1, inputs: { 'food:unknown': 1 } }];
    const route = f.model.acquisition(target, 3, f.low, f.context({ owned: { [target]: 3 }, levels: { cooking: 1 }, canCamp: () => false }));
    expect(route).toMatchObject({ steps: [], productionSec: 0 });
  });

  it('uses carried recipe inputs without requiring their locked source', () => {
    const f = fixture(), input = f.good('material:held-input'), target = f.good('material:processed-output');
    f.model.sources[input] = [{ kind: 'mine', zone: f.low, skill: 'mining', level: 20, camp: true, seconds: 10, yield: 1 }];
    f.model.sources[target] = [{ kind: 'workshop', zone: f.low, seconds: 0, yield: 1, inputs: { [input]: 2 } }];
    const route = f.model.acquisition(target, 1, f.low, f.context({ owned: { [input]: 2 }, levels: { mining: 1 }, canCamp: () => false }));
    expect(route?.steps.map((step) => step.good)).toEqual([target]);
    expect(route?.productionSec).toBe(0);
  });

  it('does not confuse a carried material with a food of the same key', () => {
    const f = fixture(), material = f.good('material:collision'), food = f.good('food:collision');
    const context = f.context({ owned: { [material]: 4 } });
    expect(f.model.acquisition(material, 4, f.low, context)?.steps).toEqual([]);
    expect(f.model.acquisition(food, 1, f.low, context)).toBeNull();
  });

  it('rejects missing inputs and cyclic recipes without a carried cycle break', () => {
    const f = fixture(), a = f.good('material:cycle-a'), b = f.good('material:cycle-b'), missing = f.good('material:missing-output');
    f.model.sources[a] = [{ kind: 'workshop', zone: f.low, seconds: 0, yield: 1, inputs: { [b]: 1 } }];
    f.model.sources[b] = [{ kind: 'workshop', zone: f.low, seconds: 0, yield: 1, inputs: { [a]: 1 } }];
    f.model.sources[missing] = [{ kind: 'workshop', zone: f.low, seconds: 0, yield: 1, inputs: { 'material:unknown': 1 } }];
    expect(f.model.acquisition(a, 1, f.low, f.context())).toBeNull();
    expect(f.model.acquisition(missing, 1, f.low, f.context())).toBeNull();
    expect(f.model.acquisition(a, 1, f.low, f.context({ owned: { [b]: 1 } }))?.steps.map((step) => step.good)).toEqual([a]);
  });

  it('does not invent a source for an authored variant that the zone cannot field', () => {
    const f = fixture(true);
    const nonFieldable = Object.entries(f.data.mob.variants || {}).flatMap(([species, variants]) => variants.flatMap((variant) => {
      const drop = f.data.mob.variant_drops?.[variant.name];
      if (!drop) return [];
      const unavailable = f.data.mob.zones.find((zone) => !f.engine.variantsInZone(species, zone.id).some((row) => row.name === variant.name)
        && !(f.model.sources[`junk:${drop.item}`] || []).some((source) => source.zone === zone.id));
      return unavailable ? [{ target: `junk:${drop.item}`, zone: unavailable.id }] : [];
    }))[0];
    expect(nonFieldable).toBeDefined();
    expect(f.trade.byId[nonFieldable.target]).toBeDefined();
    expect(f.model.acquisition(nonFieldable.target, 1, nonFieldable.zone, f.context({ zones: [nonFieldable.zone] }))).toBeNull();
  });
});

describe('delivery farming acquisition', () => {
  function farmFixture() {
    const f = fixture(), target = f.good('herb:seed-fixture');
    f.model.sources[target] = [{ kind: 'farm', zone: f.low, seconds: 10, yield: 3, seed: 1 }];
    return { ...f, target };
  }

  it('reserves an owned seed instead of counting it toward both delivery and planting', () => {
    const f = farmFixture();
    const route = f.model.acquisition(f.target, 3, f.low, f.context({ owned: { [f.target]: 1 } }));
    expect(route?.productionSec).toBe(10);
    expect(route?.steps).toEqual([{ good: f.target, kind: 'farm', zone: f.low, quantity: 3, seconds: 10 }]);
  });

  it('refuses a crop with neither an owned seed nor an obtainable seed path', () => {
    const f = farmFixture();
    expect(f.model.acquisition(f.target, 3, f.low, f.context())).toBeNull();
  });

  it('can obtain one wild seed before growing the requested crop', () => {
    const f = farmFixture();
    f.model.sources[f.target].push({ kind: 'hunt', zone: f.low, seconds: 100, yield: 1 });
    const route = f.model.acquisition(f.target, 3, f.low, f.context());
    expect(route?.productionSec).toBe(110);
    expect(route?.steps.map((step) => [step.kind, step.quantity])).toEqual([['hunt', 1], ['farm', 3]]);
  });

  it('waits for a growing occupied plot before planting another tier', () => {
    const f = farmFixture();
    const route = f.model.acquisition(f.target, 3, f.low, f.context({ owned: { [f.target]: 1 }, plots: [{ tier: 'different-tier', readyAt: 50 }], plotCapacity: 1 }));
    expect(route?.productionSec).toBe(60);
  });

  it('uses a planted crop deadline without requiring another seed', () => {
    const f = farmFixture();
    const route = f.model.acquisition(f.target, 3, f.low, f.context({ plots: [{ tier: 'seed-fixture', readyAt: 7 }] }));
    expect(route?.productionSec).toBe(7);
  });
});

describe('delivery Camp and route budgets', () => {
  it('rejects a different source kind when Camp cannot relocate', () => {
    const f = fixture(), target = f.good('material:mine-only');
    f.model.sources[target] = [{ kind: 'mine', zone: f.low, seconds: 10, yield: 1, camp: true }];
    const context = f.context({ camp: { zone: f.low, kind: 'grove' }, campCosts: { 'material:move-token': 1 } });
    expect(f.model.acquisition(target, 1, f.low, context)).toBeNull();
  });

  it('spends shared relocation resources once for each station change', () => {
    const f = fixture(), a = f.good('material:mine-input'), b = f.good('material:grove-input'), target = f.good('material:two-station-output');
    f.model.sources[a] = [{ kind: 'mine', zone: f.low, seconds: 1, yield: 1, camp: true }];
    f.model.sources[b] = [{ kind: 'grove', zone: f.low, seconds: 1, yield: 1, camp: true }];
    f.model.sources[target] = [{ kind: 'workshop', zone: f.low, seconds: 0, yield: 1, inputs: { [a]: 1, [b]: 1 } }];
    const context = f.context({ camp: { zone: f.low, kind: 'hunt' }, campCosts: { 'material:move-token': 1 }, owned: { 'material:move-token': 1 } });
    expect(f.model.acquisition(target, 1, f.low, context)).toBeNull();
    context.owned['material:move-token'] = 2;
    expect(f.model.acquisition(target, 1, f.low, context)?.steps.map((step) => step.kind)).toEqual(['mine', 'grove', 'workshop']);
  });

  it('includes positive local station travel through the actual sim context', () => {
    const f = fixture(), target = f.good('material:local-mine');
    const state = newGame(36), context = acquisitionContext(state);
    const zone = state.zone;
    f.model.sources[target] = [{ kind: 'mine', zone, seconds: 10, yield: 1, camp: true }];
    expect(f.model.acquisition(target, 1, zone, context)?.travelSec).toBeGreaterThan(0);
  });

  it('chooses a deterministic fastest route without changing its source data', () => {
    const f = fixture(), target = f.good('material:multi-source');
    f.model.sources[target] = [{ kind: 'mine', zone: f.low, seconds: 20, yield: 1 }, { kind: 'grove', zone: f.low, seconds: 5, yield: 1 }];
    const sources = structuredClone(f.model.sources);
    const first = f.model.acquisition(target, 2, f.low, f.context());
    expect(first?.steps[0].kind).toBe('grove');
    expect(f.model.acquisition(target, 2, f.low, f.context())).toEqual(first);
    expect(f.model.sources).toEqual(sources);
  });

  it('keeps target/count difficulty independent of which source is closer', () => {
    const f = fixture(), target = f.good('material:distance-independent');
    f.model.sources[target] = [{ kind: 'mine', zone: f.low, seconds: 10, yield: 1 }, { kind: 'mine', zone: f.high, seconds: 10, yield: 1 }];
    const nearLow = f.context({ travelFromCurrent: (zone) => zone === f.low ? 0 : 1000 });
    const nearHigh = f.context({ travelFromCurrent: (zone) => zone === f.high ? 0 : 1000 });
    const lowRoute = f.model.acquisition(target, 2, f.low, nearLow)!;
    const highRoute = f.model.acquisition(target, 2, f.low, nearHigh)!;
    expect(lowRoute.steps[0].zone).toBe(f.low);
    expect(highRoute.steps[0].zone).toBe(f.high);
    expect(highRoute.difficulty).toBe(lowRoute.difficulty);
  });
});
