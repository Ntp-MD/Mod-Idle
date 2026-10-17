import { E, blackMarket, sm, TOWN, fieldwork, trade } from '../engine/client';
import { atSettlement } from './craft';
import { grantNamedSkill } from './skills';
import { fitsTransaction } from './slots';
import type { GameState } from './types';

export interface BlackMarketTownState {
  offers: import('../../../engine/black-market.ts').BlackMarketOffer[];
  refreshRemainingSec: number;
  serial: number;
}

function refresh(state: GameState, town: string, rng: () => number): BlackMarketTownState {
  const previous = state.town.blackMarket[town];
  const serial = previous?.serial || 0;
  const offers = blackMarket.roll(town, serial, rng);
  return { offers, refreshRemainingSec: blackMarket.C.refresh_interval_sec, serial: serial + offers.length };
}

/** Called only by the writer's online tick finalizer, after world and delivery draws. */
export function tickBlackMarket(state: GameState, rng: () => number, access: { writer: boolean }, online: boolean): void {
  if (!access.writer || !online) return;
  for (const town of TOWN.settlements) {
    if (!state.town.visited.includes(town.id)) continue;
    const current = state.town.blackMarket[town.id];
    if (!current) { state.town.blackMarket[town.id] = refresh(state, town.id, rng); continue; }
    current.refreshRemainingSec = Math.max(0, current.refreshRemainingSec - 1);
    if (current.refreshRemainingSec === 0) state.town.blackMarket[town.id] = refresh(state, town.id, rng);
  }
}

export function blackMarketState(state: GameState, town: string): BlackMarketTownState | null {
  return state.town.blackMarket[town] || null;
}

export function blackMarketOfferReason(state: GameState, town: string, offerId: string, writer: boolean): string | null {
  if (!writer) return 'This tab is read-only.';
  if (!atSettlement(state, town)) return `Stand in ${TOWN.settlements.find((entry: any) => entry.id === town)?.name || 'the issuing settlement'} to buy.`;
  const offer = state.town.blackMarket[town]?.offers.find((row) => row.id === offerId);
  if (!offer || !Number.isSafeInteger(offer.remaining) || offer.remaining < 1) return 'Sold out until the next refresh.';
  if (!Number.isFinite(offer.price) || offer.price < 0 || trade.floorCurrency(offer.price) !== offer.price) return 'Invalid saved offer.';
  if (state.counters.gold < offer.price) return `Needs ${offer.price} gold.`;
  if (offer.kind === 'material') {
    const good = trade.byId[offer.good || ''];
    if (!good || good.bucket !== 'material') return 'Saved material is no longer available.';
    if (!fitsTransaction(state, [], [{ bucket: state.fieldwork.materials, key: good.key, capKind: 'material', amount: offer.count }])) return 'Make room in the character bag for this material.';
  } else if (offer.kind === 'stone') {
    if (!offer.stone || !validStone(offer.stone)) return 'Saved stone is no longer available.';
    if (!fitsTransaction(state, [], [{ bucket: state.counters.stones, key: offer.stone, capKind: 'stone', amount: offer.count }])) return 'Make room in the character bag for this stone.';
  } else if (offer.kind === 'skill') {
    if (!offer.skill || !sm.byId[offer.skill] || !Number.isSafeInteger(offer.level) || offer.level! < 1 || offer.level! > E.skill_xp.level_cap) return 'Saved skill offer is no longer available.';
    if (Object.hasOwn(state.skills.owned, offer.skill) && (state.skills.xp[offer.skill] || 0) >= sm.skillXpForLevel(offer.level!)) return 'This skill already has that XP Level or higher.';
  }
  return null;
}

/** Validate frozen stock on load without rolling or repairing a reward. */
export function normalizeBlackMarket(state: GameState): void {
  const book = state.town.blackMarket as Record<string, BlackMarketTownState> | undefined;
  if (book == null) { state.town.blackMarket = {}; return; }
  if (typeof book !== 'object' || Array.isArray(book)) throw new Error('black market save: invalid stock index');
  for (const townId of Object.keys(book)) {
    const town = TOWN.settlements.find((entry: any) => entry.id === townId);
    const saved = book[townId];
    const fail = (why: string): never => { throw new Error(`black market save: ${why}`); };
    if (!town || !saved || !Array.isArray(saved.offers) || !Number.isSafeInteger(saved.serial) || saved.serial < 0
      || !Number.isSafeInteger(saved.refreshRemainingSec) || saved.refreshRemainingSec < 0 || saved.refreshRemainingSec > blackMarket.C.refresh_interval_sec
      || saved.offers.length > blackMarket.C.offers_per_refresh) fail(`invalid stock record for ${townId}`);
    const ids = new Set<string>();
    let maxSerial = 0;
    for (const offer of saved.offers) {
      const match = /^black-market:([^:]+):(\d+)$/.exec(offer.id || '');
      if (match?.[1] !== townId || ids.has(offer.id)) fail(`invalid offer identity in ${townId}`);
      ids.add(offer.id); maxSerial = Math.max(maxSerial, Number(match?.[2]));
      if (!Number.isSafeInteger(offer.count) || offer.count < 1 || !Number.isSafeInteger(offer.remaining) || offer.remaining < 0 || offer.remaining > 1
        || !Number.isFinite(offer.price) || offer.price < 0 || trade.floorCurrency(offer.price) !== offer.price) fail(`invalid quantity or price in ${offer.id}`);
      if (offer.kind === 'material') {
        const good = trade.byId[offer.good || ''];
        const row = blackMarket.C.materials.find((entry) => entry.good === offer.good);
        if (!row || !good || good.bucket !== 'material' || offer.count < blackMarket.C.item_count_min || offer.count > blackMarket.C.item_count_max || offer.count > E.inventory.stack_size.material) fail(`unknown material in ${offer.id}`);
      } else if (offer.kind === 'stone') {
        const row = blackMarket.C.stones.find((entry) => entry.key === offer.stone);
        if (!offer.stone || !validStone(offer.stone) || !row || offer.count < row.count_min || offer.count > row.count_max || offer.count > E.inventory.stack_size.stone) fail(`unknown stone in ${offer.id}`);
      } else if (offer.kind === 'skill') {
        if (!offer.skill || !Object.hasOwn(blackMarket.C.skill_weights, offer.skill) || !sm.byId[offer.skill] || offer.count !== 1 || !Number.isSafeInteger(offer.level) || !blackMarket.C.skill_level_offers.some((row) => row.level === offer.level) || offer.level! > E.skill_xp.level_cap) fail(`unknown skill entitlement in ${offer.id}`);
      } else fail(`unknown offer kind in ${offer.id}`);
    }
    if (saved.serial < maxSerial) fail(`serial moved backwards for ${townId}`);
  }
}

export function buyBlackMarket(state: GameState, town: string, offerId: string, access: { writer: boolean }) {
  const refuse = (why: string) => ({ ok: false as const, why });
  const reason = blackMarketOfferReason(state, town, offerId, access.writer);
  if (reason) return refuse(reason);
  const stock = state.town.blackMarket[town];
  const offer = stock?.offers.find((row) => row.id === offerId);
  if (!offer) return refuse('sold out; wait for the next refresh');
  if (!Number.isFinite(offer.price) || offer.price < 0 || trade.floorCurrency(offer.price) !== offer.price || !Number.isSafeInteger(offer.count) || offer.count < 1) return refuse('invalid saved offer');
  if (state.counters.gold < offer.price) return refuse(`needs ${offer.price} gold`);
  let grantedSkill: ReturnType<typeof grantNamedSkill> = null;
  let material: { bucket: Record<string, number>; key: string; capKind: string; amount: number } | null = null;
  if (offer.kind === 'material') {
    const good = trade.byId[offer.good || ''];
    if (!good || good.bucket !== 'material' || !Number.isSafeInteger(offer.count)) return refuse('saved material is no longer available');
    material = { bucket: state.fieldwork.materials, key: good.key, capKind: 'material', amount: offer.count };
    if (!fitsTransaction(state, [], [material])) return refuse('make room in the character bag for this material');
  } else if (offer.kind === 'stone') {
    if (!offer.stone || !validStone(offer.stone)) return refuse('saved stone is no longer available');
    if (!fitsTransaction(state, [], [{ bucket: state.counters.stones, key: offer.stone, capKind: 'stone', amount: offer.count }])) return refuse('make room in the character bag for this stone');
  } else {
    const skillId = offer.skill;
    const skill = skillId ? sm.byId[skillId] : null;
    if (!skill || !Number.isSafeInteger(offer.level) || offer.level! < 1 || offer.level! > E.skill_xp.level_cap) return refuse('saved skill offer is no longer available');
    const targetXp = sm.skillXpForLevel(offer.level!);
    if (Object.hasOwn(state.skills.owned, skillId!) && (state.skills.xp[skillId!] || 0) >= targetXp) return refuse('this skill already has that XP Level or higher');
    grantedSkill = { id: skillId!, duplicate: Object.hasOwn(state.skills.owned, skillId!) };
  }
  if (material) state.fieldwork.materials[material.key] = (state.fieldwork.materials[material.key] || 0) + material.amount;
  else if (offer.kind === 'stone') state.counters.stones[offer.stone!] = (state.counters.stones[offer.stone!] || 0) + offer.count;
  else grantNamedSkill(state.skills, grantedSkill!.id, { duplicate: false, level: offer.level });
  state.counters.gold = trade.floorCurrency(state.counters.gold - offer.price);
  offer.remaining--;
  return { ok: true as const, offer, grantedSkill };
}

const allowedStones = new Set((TOWN.black_market.stones as { key: string }[]).map((row) => row.key));
const validStone = (key: string) => allowedStones.has(key);
