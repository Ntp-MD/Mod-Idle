import type { EconomyCfg, EconomyPlayerCfg } from '@engine/economy';
import { TOWN } from '../../src/engine/client';

/**
 * Town economy fixture for tests: the cities, routes and events live in `tools/data/town.json`, so the
 * tests read one copy. The numbers are playtest values, not tuned balance, and no save or gameplay
 * path imports this file.
 */
const DATA = (TOWN as any).economy as EconomyCfg;

export const economyFixture = (): EconomyCfg => structuredClone(DATA);

export const economyPlayer = (): EconomyPlayerCfg => ({
  stock: { 'material:timber': 20, 'material:copper-ore': 20, 'material:iron-tools': 5, 'food:raw_game_meat': 10 },
  gold: 25,
  credit: 0,
});

/** The order the lab reads each city's shelves in; the values stay in the fixture above. */
export const LAB_CITIES = [
  {
    id: 'highspire', role: 'Mine',
    goods: ['material:copper-ore', 'material:iron-ore', 'material:timber', 'material:copper-fittings', 'material:iron-tools', 'food:raw_game_meat'],
  },
  {
    id: 'millbrook', role: 'Forest',
    goods: ['material:timber', 'material:pine-wood', 'food:raw_game_meat', 'material:copper-fittings', 'material:iron-tools'],
  },
  {
    id: 'emberhold', role: 'Craft',
    goods: ['material:copper-ore', 'material:iron-ore', 'material:timber', 'material:copper-fittings', 'material:iron-tools', 'food:raw_game_meat'],
  },
] as const;

export const LAB_PLAYER_GOODS = ['material:timber', 'material:copper-ore', 'material:iron-tools', 'food:raw_game_meat'] as const;
