import { eng, TOWN, trade } from '../../engine/client';
import type { GameState } from '../core/types';

/**
 * The town's authored rows and their price lines. This is the leaf the rest of the sim reads
 * (`road.ts` prices a Waypoint warp, the HUD prints the same number), so it owns no flow: it
 * mutates nothing and imports no other sim module. Town flow stays in `town.ts`.
 */

export const ALL_ROWS: any[] = [...TOWN.one_time, ...TOWN.repeatable];
export const rowById = (id: string) => ALL_ROWS.find((r) => r.id === id);
export const settlementById = (id: string) => TOWN.settlements.find((s: any) => s.id === id);
export const settlementOfZone = (zone: number) => TOWN.settlements.find((s: any) => s.zone === zone);
export const npcOf = (id: string) => TOWN.npcs.find((n: any) => n.id === id);

/** The `m` a row charges at this settlement, honouring the teaching discount where one exists. */
export function priceMinutes(row: any, settlementId: string, state?: GameState, blocks = 1): number {
  const s = settlementById(settlementId)!;
  if (row.discount && row.discount.settlement === s.id) return row.discount.m;
  // the pedlar's stock is a fresh roll of three slots each real day, priced inside its band
  if (row.id === 'pedlar_rotation' && state?.pedlar?.minutes?.length) {
    return state.pedlar.minutes[Math.min(state.pedlar.bought, state.pedlar.minutes.length - 1)];
  }
  // a per-block line (the Waypoint warp) is priced by the walk it replaces, not by a fixed `m`
  if (row.m_per_block != null) return row.m_per_block * blocks;
  return row.m != null ? row.m : row.m_min;
}

/** Gold = minutes of that band's full-sell junk income. */
export function priceGold(row: any, settlementId: string, state?: GameState, blocks = 1): number {
  const s = settlementById(settlementId)!;
  // a teaching discount is priced at the settlement's own band, the price its note and the wiki state;
  // every other line charges the band the row names
  const discounted = row.discount && row.discount.settlement === s.id;
  const band = discounted ? s.band : (row.charge_band || s.band);
  return Math.round(priceMinutes(row, settlementId, state, blocks) * eng.goldPerMinute(band)
    * trade.haggling(state?.town.hagglingXp ?? 0).serviceMult * 100) / 100;
}
