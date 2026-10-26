import { E, eng, farm, TOWN } from '../../engine/client';
import { mulberry32 } from '../../engine/client-helpers';
import { fitsTransaction } from '../gear/slots';
import { currentCell, startWalk, zoneOf } from './road';
import { surveyMapAround } from './map-exploration';
import { settlementById, settlementOfZone } from '../town/town';
import type { GameState, Mob, Cell } from '../core/types';
import { fieldInFight } from './field-area';
import type { CampEncounterActive, CampEncounterKind } from './fieldwork';
export type { CampEncounterPolicy } from './fieldwork';

const CFG = E.fieldwork.camp_encounters;
type Spawn = (zone: number, subzone: number | null, rng: () => number) => Mob[];
export type CampEncounterAction = 'investigate' | 'quiet' | 'shelter' | 'secure' | 'fight'
  | 'listen' | 'trade-ore' | 'trade-timber' | 'decline' | 'pause' | 'relocate'
  | 'dismiss' | 'follow' | 'help-food' | 'help-potion';

export function setCampEncounterPolicy(s: GameState, policy: unknown, writer: boolean): boolean {
  if (!writer || !['avoid', 'defend', 'engage'].includes(String(policy))) return false;
  s.fieldwork.campEncounters.policy = policy as GameState['fieldwork']['campEncounters']['policy'];
  return true;
}

const sameHex = (a: { q: number; r: number }, b: { q: number; r: number }) => a.q === b.q && a.r === b.r;
const atCamp = (s: GameState) => {
  const camp = s.fieldwork.camp;
  return !!camp && camp.zone === s.zone && !s.walk && !!s.cell && sameHex(currentCell(s), camp.cell);
};
const poolFor = (s: GameState, camp: Cell) => ({ species: camp.sub == null
  ? eng.speciesInZone(s.zone)
  : E.mob.zones.find((z: any) => z.id === s.zone)?.subzones?.[camp.sub]?.species || [] });
const eligible = (s: GameState) => atCamp(s) && !s.hunting && !fieldInFight(s) && !s.dungeon
  && s.phase !== 'camp' && !s.patrol.active && s.autoReturn.phase === 'idle';

/** The gate a Camp event needs, read as a rule so a tick can snapshot it before the world moves. */
export function campEncounterEligible(s: GameState): boolean {
  return eligible(s);
}

function eventGenerator(s: GameState): () => number {
  const state = s.fieldwork.campEncounters;
  const rng = mulberry32(state.streamState);
  state.streamState = (state.streamState + 0x6d2b79f5) >>> 0;
  return rng;
}

function candidates(s: GameState, exposure: boolean): { kind: CampEncounterKind; payload: Record<string, unknown> }[] {
  const out: { kind: CampEncounterKind; payload: Record<string, unknown> }[] = [];
  const camp = s.fieldwork.camp!;
  const home = settlementOfZone(camp.zone);
  const regionalFood = (E.fieldwork.regional_sources as Record<string, { food: string }>)[String(camp.zone)]?.food;
  const foodCount = regionalFood ? s.fieldwork.foods[regionalFood] || 0 : 0;
  const materials = ['ore', 'timber'].filter(id => E.fieldwork.materials.some((m: any) => m.id === id));
  const pool = poolFor(s, camp.cell);
  const hasHuntPool = !!pool?.species?.length;
  if (hasHuntPool) out.push({ kind: 'sounds', payload: { species: pool.species } });
  if (hasHuntPool) out.push({ kind: 'prowler', payload: { species: pool.species } });
  if (home && regionalFood && foodCount >= CFG.barter_food && materials.length)
    out.push({ kind: 'traveler', payload: { foodId: regionalFood, foodAmount: CFG.barter_food, materials } });
  if (s.fieldwork.action?.kind === 'mine' || s.fieldwork.action?.kind === 'grove')
    if (hasHuntPool) out.push({ kind: 'nest', payload: { species: pool.species, activity: s.fieldwork.action.kind } });
  if (home && home.zone === s.zone) {
    const budget = eng.SETTLEMENT_BUDGET_KILLS[s.zone] || 0;
    const cap = Math.floor(budget * TOWN.standing.camp_aid_credit_cap_share);
    const credit = Math.max(1, Math.floor(budget * TOWN.standing.camp_aid_credit_share));
    const remaining = cap - (s.town.helpCredit[home.id] || 0);
    const bottles = farm.P.list.filter((p: any) => farm.potionPct(p, 'hp') > 0
      && (s.farm.potions[p.name] || 0) >= CFG.aid_potion_count)
      .sort((a: any, b: any) => farm.potionPct(a, 'hp') - farm.potionPct(b, 'hp') || a.name.localeCompare(b.name));
    const potion = bottles[0]?.name;
    if (cap > 0 && remaining > 0 && credit > 0 && (foodCount >= CFG.aid_food || potion))
      out.push({ kind: 'injured', payload: {
        settlementId: home.id, foodId: regionalFood, foodAmount: CFG.aid_food,
        potionName: potion || null, potionAmount: CFG.aid_potion_count,
        credit: Math.min(credit, remaining),
      } });
  }
  const expedition = s.town.tasks.find(task => task && task.kind === 'expedition' && !task.claimed
    && task.progress < task.n && task.zone === camp.zone && task.targetSpecies && Number.isInteger(task.subzone));
  const stop = expedition && s.patrol.stops.find(x => x.zone === expedition.zone && x.subzone === expedition.subzone
    && !sameHex(x.cell, camp.cell));
  if (expedition && stop && (s.mapJournal?.scouted || []).includes(`${stop.cell.q},${stop.cell.r}`))
    out.push({ kind: 'herd', payload: { species: expedition.targetSpecies, zone: stop.zone, subzone: stop.subzone, cell: stop.cell } });
  if (exposure && hasHuntPool) out.push({ kind: 'discovered', payload: { species: pool.species } });
  return out.filter(x => CFG.kinds.includes(x.kind));
}

function makeEvent(s: GameState, kind: CampEncounterKind, payload: Record<string, unknown>, rng: () => number, spawn: Spawn): CampEncounterActive {
  const camp = { ...s.fieldwork.camp!.cell };
  const hostile = ['sounds', 'prowler', 'nest', 'discovered'].includes(kind);
  const preparedGroup = hostile ? spawn(s.zone, camp.sub, () => rng()) : [];
  return {
    id: ++s.fieldwork.campEncounters.serial, kind, stage: 'warning', origin: camp,
    warningSec: CFG.warning_sec, choiceSec: CFG.choice_sec,
    payload: { ...payload, ...(hostile ? { species: preparedGroup[0]?.speciesId || null } : {}) },
    preparedGroup, participantIds: [],
  };
}

export function cancelCampEncounter(s: GameState, note = 'Encounter declined'): void {
  const state = s.fieldwork.campEncounters;
  if (!state.active) return;
  state.active = null;
  state.cooldownSec = CFG.cooldown_sec;
  state.checkSec = 0;
  state.recap = note;
}

function startFight(s: GameState, active: CampEncounterActive): boolean {
  if (!active.preparedGroup.length || !atCamp(s) || fieldInFight(s) || s.phase === 'camp') return false;
  s.group = active.preparedGroup.map(mob => ({ ...mob, innate: [...mob.innate],
    ...(mob.core ? { core: { ...mob.core } } : {}),
    ...(mob.resByElement ? { resByElement: { ...mob.resByElement } } : {}),
    ...(mob.immune ? { immune: [...mob.immune] } : {}),
  }));
  active.participantIds = s.group.map(m => m.id);
  active.preparedGroup = [];
  active.stage = 'combat';
  active.choiceSec = 0;
  s.hunting = false;
  s.fieldwork.action = null;
  s.patrol.active = false;
  s.player.atkTimer = 0;
  if (active.kind === 'discovered') s.fieldwork.campEncounters.exposureSec = 0;
  return true;
}

export function chooseCampEncounter(s: GameState, id: number, action: CampEncounterAction, writer: boolean): { ok: boolean; why?: string } {
  const active = s.fieldwork.campEncounters.active;
  if (!writer) return { ok: false, why: 'This tab is read-only' };
  if (!active || active.id !== id) return { ok: false, why: 'This encounter has ended' };
  if (!atCamp(s) || s.phase === 'camp' || s.dungeon) return { ok: false, why: 'Return to a clear Camp first' };
  const resolve = (text: string) => { s.fieldwork.campEncounters.recap = text; s.fieldwork.campEncounters.active = null; s.fieldwork.campEncounters.cooldownSec = CFG.cooldown_sec; s.fieldwork.campEncounters.checkSec = 0; };
  if (action === 'fight' && ['sounds', 'prowler', 'nest', 'discovered'].includes(active.kind)
    && (active.kind !== 'sounds' || active.stage === 'choice')) {
    if (!startFight(s, active)) return { ok: false, why: 'No prepared group is available' };
    return { ok: true };
  }
  if (active.kind === 'sounds' && active.stage === 'warning' && action === 'investigate') {
    surveyMapAround(s, active.origin);
    active.stage = 'choice'; active.warningSec = 0; active.choiceSec = CFG.choice_sec;
    return { ok: true };
  }
  if (active.kind === 'traveler' && action === 'listen') { surveyMapAround(s, active.origin); resolve('Traveler shared news from nearby'); return { ok: true }; }
  if (active.kind === 'traveler' && (action === 'trade-ore' || action === 'trade-timber')) {
    const p = active.payload, material = action === 'trade-ore' ? 'ore' : 'timber';
    if (!(p.materials as string[] | undefined)?.includes(material)) return { ok: false, why: 'That trade is unavailable' };
    const costs = [{ bucket: s.fieldwork.foods, key: String(p.foodId), capKind: 'food', amount: Number(p.foodAmount) }];
    const grants = [{ bucket: s.fieldwork.materials, key: material, capKind: 'material', amount: 1 }];
    if (!fitsTransaction(s, costs, grants)) return { ok: false, why: 'The food or bag capacity changed' };
    costs.forEach(x => { x.bucket[x.key] -= x.amount; }); grants.forEach(x => { x.bucket[x.key] = (x.bucket[x.key] || 0) + x.amount; });
    resolve(`Traded ${p.foodAmount} provisions for ${material}`); return { ok: true };
  }
  if (active.kind === 'injured' && (action === 'help-food' || action === 'help-potion')) {
    const p = active.payload, food = action === 'help-food', key = String(food ? p.foodId : p.potionName);
    const bucket = food ? s.fieldwork.foods : s.farm.potions;
    const capKind = food ? 'food' : 'potion', amount = Number(food ? p.foodAmount : p.potionAmount);
    const settlementId = String(p.settlementId), credit = Number(p.credit);
    const budget = eng.SETTLEMENT_BUDGET_KILLS[s.zone] || 0;
    const maximum = Math.floor(budget * TOWN.standing.camp_aid_credit_cap_share);
    if (!key || settlementById(settlementId)?.zone !== s.zone || !Number.isSafeInteger(credit) || credit <= 0
      || (s.town.helpCredit[settlementId] || 0) + credit > maximum)
      return { ok: false, why: 'The help offer is no longer valid' };
    const costs = [{ bucket, key, capKind, amount }];
    if (!fitsTransaction(s, costs, [])) return { ok: false, why: 'The required supplies are no longer available' };
    bucket[key] -= amount;
    s.town.helpCredit[settlementId] = (s.town.helpCredit[settlementId] || 0) + credit;
    resolve(`Helped ${settlementId} · Standing +${credit}`); return { ok: true };
  }
  if (active.kind === 'discovered' && action === 'shelter') {
    s.fieldwork.campEncounters.exposureSec = 0;
    resolve('Sheltered as the threat passed');
    return { ok: true };
  }
  if (['quiet', 'shelter', 'secure', 'pause', 'decline', 'dismiss', 'relocate'].includes(action)) {
    if (active.kind === 'sounds' && action === 'quiet') { surveyMapAround(s, active.origin); resolve('The sound passed'); return { ok: true }; }
    if (active.kind === 'traveler' && action === 'decline') { resolve('You sent the traveler away'); return { ok: true }; }
    if (active.kind === 'nest' && action === 'pause') { resolve('The nest moved on'); return { ok: true }; }
    if (active.kind === 'herd' && action === 'dismiss') { resolve('The herd moved on'); return { ok: true }; }
    if (active.kind === 'injured' && action === 'decline') { resolve('You moved on without helping'); return { ok: true }; }
    if (active.kind === 'prowler' && (action === 'shelter' || action === 'secure')) {
      s.fieldwork.action = null;
      resolve('You secured the supplies and waited it out');
      return { ok: true };
    }
  }
  if (active.kind === 'herd' && action === 'follow') {
    const p = active.payload, task = s.town.tasks.find(x => x && x.kind === 'expedition' && !x.claimed
      && x.progress < x.n && x.zone === p.zone && x.subzone === p.subzone && x.targetSpecies === p.species);
    const cell = p.cell as Cell;
    const owner = Number.isInteger(cell?.q) && Number.isInteger(cell?.r) ? zoneOf(cell) : null;
    if (!task || !cell || owner !== p.zone || !(s.mapJournal?.scouted || []).includes(`${cell.q},${cell.r}`))
      return { ok: false, why: 'The hunting lead is no longer accessible' };
    const walk = startWalk(s, cell);
    if (!walk.ok) return { ok: false, why: walk.why };
    s.patrol.active = false;
    s.fieldwork.action = null;
    cancelCampEncounter(s, 'Followed the herd tracks');
    return { ok: true };
  }
  return { ok: false, why: 'That choice is unavailable for this encounter' };
}

export function tickCampEncounters(s: GameState, online: boolean, spawn: Spawn,
  opts: { eligibleAtStart?: boolean } = {}): void {
  if (!online) return;
  const state = s.fieldwork.campEncounters, camp = s.fieldwork.camp;
  const at = !!camp && atCamp(s);
  if (state.cooldownSec > 0) state.cooldownSec--;
  if (!at) state.exposureSec = Math.max(0, state.exposureSec - CFG.exposure_decay_per_sec);
  else state.exposureSec = Math.min(CFG.exposure_cap_sec, state.exposureSec + 1);

  const active = state.active;
  if (active?.stage === 'combat') {
    const alive = s.group.some(m => active.participantIds.includes(m.id));
    if (alive) return;
    if (s.phase === 'camp' || !at) cancelCampEncounter(s, 'Camp fight interrupted');
    else cancelCampEncounter(s, 'Camp threat defeated');
    return;
  }
  if (active && !eligible(s)) { cancelCampEncounter(s, 'Encounter declined'); return; }
  if (active) {
    if (active.stage === 'warning' && --active.warningSec <= 0) {
      active.stage = 'choice'; active.choiceSec = CFG.choice_sec;
      if (['prowler', 'nest', 'discovered'].includes(active.kind) && state.policy === 'engage') { startFight(s, active); return; }
    } else if (active.stage === 'choice' && --active.choiceSec <= 0) {
      if (['prowler', 'nest', 'discovered'].includes(active.kind) && state.policy === 'defend') { startFight(s, active); return; }
      if (active.kind === 'discovered') state.exposureSec = 0;
      cancelCampEncounter(s, active.kind === 'nest' ? 'The nest moved on' : 'Encounter passed');
    }
    return;
  }
  if (!eligible(s)) return;
  /* The gate has to hold on both sides of the tick: a walk that ends, a Push that recovers or a
     fight that clears this second does not open a Camp event on the same tick. */
  if (opts.eligibleAtStart === false) return;
  if (state.graceSec > 0) { state.graceSec--; return; }
  if (++state.checkSec < CFG.check_interval_sec) return;
  state.checkSec = 0;
  const rng = eventGenerator(s);
  if (rng() >= CFG.chance_per_check) return;
  const pool = candidates(s, state.exposureSec >= CFG.exposure_threshold_sec);
  if (!pool.length) return;
  const choice = pool[Math.floor(rng() * pool.length)];
  state.active = makeEvent(s, choice.kind, choice.payload, rng, spawn);
  /* A threat pauses the work at its Camp; a visitor or a clue leaves the work alone. */
  if (['sounds', 'prowler', 'nest', 'discovered'].includes(choice.kind)) s.fieldwork.action = null;
}
