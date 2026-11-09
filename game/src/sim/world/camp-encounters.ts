import { E, eng, fieldwork, STORY } from '../../engine/client';
import { mulberry32 } from '../../engine/client-helpers';
import { fitsTransaction } from '../gear/slots';
import { currentCell } from './road';
import { surveyMapAround } from './map-exploration';
import { settlementOfZone } from '../town/town';
import type { GameState, Mob, Cell } from '../core/types';
import { fieldInFight } from './field-area';
import type { CampEncounterActive, CampEncounterKind, CampEncounterStage, CampStoryReceipt, CampStoryResource } from './fieldwork';
export type { CampEncounterPolicy } from './fieldwork';

const CFG = E.fieldwork.camp_encounters;
type Spawn = (zone: number, subzone: number | null, rng: () => number) => Mob[];
export type CampEncounterAction = 'investigate' | 'quiet' | 'shelter' | 'secure' | 'fight'
  | 'listen' | 'trade-ore' | 'trade-timber' | 'decline' | 'pause' | 'relocate'
  | 'dismiss' | 'follow' | 'help-food' | 'help-potion'
  | 'cache-careful' | 'cache-quick' | 'cache-leave' | 'cache-collect' | 'cache-cancel';

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
const eligible = (s: GameState) => atCamp(s) && !s.cell?.site && !s.hunting && !fieldInFight(s) && !s.dungeon
  && s.phase !== 'camp';

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

/** The frozen payload for a selected pool row. The pool owns eligibility; this only builds data. */
function payloadFor(s: GameState, kind: CampEncounterKind): Record<string, unknown> {
  const camp = s.fieldwork.camp!;
  const regionalFood = (E.fieldwork.regional_sources as Record<string, { food: string }>)[String(camp.zone)]?.food;
  const materials = ['ore', 'timber'].filter(id => E.fieldwork.materials.some((m: any) => m.id === id));
  const species = poolFor(s, camp.cell)?.species ?? [];
  switch (kind) {
    case 'sounds': case 'prowler': case 'discovered': return { species };
    case 'traveler': return { foodId: regionalFood, foodAmount: CFG.barter_food, materials };
    case 'nest': return { species, activity: s.fieldwork.action?.kind };
    case 'supply-cache': return { foodId: regionalFood };
    default: return {};
  }
}

function makeEvent(s: GameState, kind: CampEncounterKind, payload: Record<string, unknown>, rng: () => number, spawn: Spawn, story: CampEncounterActive['story'] = null): CampEncounterActive {
  const camp = { ...s.fieldwork.camp!.cell };
  const hostile = ['sounds', 'prowler', 'nest', 'discovered'].includes(kind);
  const preparedGroup = hostile ? spawn(s.zone, camp.sub, () => rng()) : [];
  return {
    id: ++s.fieldwork.campEncounters.serial, kind, stage: 'warning', origin: camp,
    warningSec: CFG.warning_sec, choiceSec: CFG.choice_sec,
    payload: { ...payload, ...(hostile ? { species: preparedGroup[0]?.speciesId || null } : {}) },
    preparedGroup, participantIds: [], story,
  };
}

const STORY_SCENES = () => (STORY.scenes as { id: string; lines: string[]; source: string }[]).filter((x) => x.source === 'camp');
function canonicalRow(kind: CampEncounterKind) {
  return (CFG.event_pool as any[]).find((row: any) => row.kind === kind) ?? null;
}
function canonicalEventId(kind: CampEncounterKind): string {
  const fallback: Record<string, string> = {
    'sounds': 'camp-sounds', 'prowler': 'camp-prowler', 'traveler': 'camp-traveler',
    'nest': 'camp-nest', 'discovered': 'camp-discovered', 'supply-cache': 'camp-supply-cache',
  };
  return canonicalRow(kind)?.id ?? fallback[kind] ?? `camp-${kind}`;
}
function defaultSceneId(kind: CampEncounterKind): string {
  return canonicalRow(kind)?.scene_id ?? kind;
}
function cacheElapsed(active: CampEncounterActive): number {
  const offer = (active.story?.cache ?? (active.payload?.cache as any)) as any;
  if (active.kind !== 'supply-cache' || !offer) return 0;
  if (active.stage === 'collect') return offer.carefulSec;
  return Math.max(0, Math.min(offer.carefulSec, offer.carefulSec - Number(active.story?.remainingSec ?? offer.carefulSec)));
}
function finalize(s: GameState, active: CampEncounterActive, opts: {
  terminalAction: string; action: string; sceneId: string; elapsedSec: number;
  paid?: CampStoryResource[]; earned?: CampStoryResource[]; lost?: CampStoryResource[];
  info?: string[]; recap: string;
}): void {
  const state = s.fieldwork.campEncounters;
  const history = state.storyHistory.find((entry) => entry.encounterId === active.id);
  if (history && history.terminalAction == null) history.terminalAction = opts.terminalAction;
  const receipt: CampStoryReceipt = {
    encounterId: active.id,
    eventId: active.story?.eventId ?? canonicalEventId(active.kind),
    kind: active.kind, action: opts.action, sceneId: opts.sceneId,
    elapsedSec: opts.elapsedSec, paid: opts.paid ?? [], earned: opts.earned ?? [], lost: opts.lost ?? [], info: opts.info ?? [],
  };
  state.lastReceipt = receipt;
  state.active = null;
  state.cooldownSec = CFG.cooldown_sec;
  state.checkSec = 0;
  state.recap = opts.recap;
}
function bumpBeat(active: CampEncounterActive): void {
  if (active.story) active.story.beat++;
}
function surveyInfo(before: { scouted: string[]; visited: string[] }, s: GameState): string[] {
  const beforeSet = new Set([...before.scouted, ...before.visited]);
  const j = s.mapJournal!;
  const fresh = [...j.scouted, ...j.visited].filter((x) => !beforeSet.has(x)).length;
  return fresh > 0 ? [`${fresh} newly revealed nearby cells`] : ['No new nearby map information'];
}
function journalSnapshot(s: GameState) {
  return { scouted: [...(s.mapJournal!.scouted ?? [])], visited: [...(s.mapJournal!.visited ?? [])] };
}

export function cancelCampEncounter(s: GameState, note = 'Encounter declined',
  opts: { terminalAction?: string; receiptAction?: string; sceneId?: string } = {}): void {
  const state = s.fieldwork.campEncounters;
  const active = state.active;
  if (!active) return;
  const terminalAction = opts.terminalAction ?? 'cancelled';
  let sceneId = opts.sceneId ?? active.story?.sceneId ?? defaultSceneId(active.kind);
  let elapsedSec = 0;
  if (active.kind === 'supply-cache') {
    if (active.stage === 'resolving' || active.stage === 'collect') sceneId = 'cache-cancel-result';
    else sceneId = 'cache-left-result';
    elapsedSec = cacheElapsed(active);
  }
  finalize(s, active, {
    terminalAction, action: opts.receiptAction ?? terminalAction, sceneId, elapsedSec,
    info: note ? [note] : [], recap: note,
  });
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
  s.player.atkTimer = 0;
  if (active.kind === 'discovered') s.fieldwork.campEncounters.exposureSec = 0;
  return true;
}

export function chooseCampEncounter(s: GameState, id: number, action: CampEncounterAction, writer: boolean,
  expected?: { beat: number; stage: CampEncounterStage }): { ok: boolean; why?: string } {
  const active = s.fieldwork.campEncounters.active;
  if (!writer) return { ok: false, why: 'This tab is read-only' };
  if (!active || active.id !== id) return { ok: false, why: 'This encounter has ended' };
  if (expected && (!active.story || active.story.beat !== expected.beat || active.stage !== expected.stage))
    return { ok: false, why: 'This encounter has changed' };
  if (!atCamp(s) || s.phase === 'camp' || s.dungeon) return { ok: false, why: 'Return to a clear Camp first' };
  const resolve = (text: string, receipt: Partial<Parameters<typeof finalize>[2]> = {}) => {
    finalize(s, active, {
      terminalAction: receipt.terminalAction ?? action,
      action: receipt.action ?? action,
      sceneId: receipt.sceneId ?? active.story?.sceneId ?? defaultSceneId(active.kind),
      elapsedSec: receipt.elapsedSec ?? 0,
      paid: receipt.paid, earned: receipt.earned, lost: receipt.lost, info: receipt.info,
      recap: text,
    });
  };
  // supply-cache is never a fight
  if (action.startsWith('cache-')) {
    if (active.kind !== 'supply-cache' || !active.story) return { ok: false, why: 'That choice is unavailable for this encounter' };
    const offer = active.story.cache;
    if (!offer) return { ok: false, why: 'That choice is unavailable for this encounter' };
    if (action === 'cache-careful' && (active.stage === 'warning' || active.stage === 'choice')) {
      if (s.fieldwork.action) return { ok: false, why: 'Finish the field activity before starting the recovery' };
      const preview = fieldwork.cachePreview(offer, 'careful');
      const outcome = preview.outcomes[0];
      const grants = outcome.materialCount > 0
        ? [{ bucket: s.fieldwork.materials, key: offer.materialId, capKind: 'material', amount: outcome.materialCount }]
        : [];
      if (!fitsTransaction(s, [] as any, grants as any)) return { ok: false, why: 'The bag has no room for the recovered materials' };
      active.stage = 'resolving';
      active.story.remainingSec = offer.carefulSec;
      active.warningSec = 0; active.choiceSec = 0;
      bumpBeat(active);
      return { ok: true };
    }
    if (action === 'cache-quick' && (active.stage === 'warning' || active.stage === 'choice')) {
      const preview = fieldwork.cachePreview(offer, 'quick');
      if ((s.fieldwork.foods[offer.foodId] || 0) < preview.maxFoodLoss)
        return { ok: false, why: 'You carry too little food for that reach' };
      for (const outcome of preview.outcomes) {
        const costs = outcome.foodLoss > 0
          ? [{ bucket: s.fieldwork.foods, key: offer.foodId, capKind: 'food', amount: outcome.foodLoss }] : [];
        const grants = outcome.materialCount > 0
          ? [{ bucket: s.fieldwork.materials, key: offer.materialId, capKind: 'material', amount: outcome.materialCount }] : [];
        if (!fitsTransaction(s, costs as any, grants as any)) return { ok: false, why: 'The food or bag capacity changed' };
      }
      const result = fieldwork.cacheResult(offer, 'quick');
      // Receipt first, then the atomic inventory delta (no RNG here: outcome is frozen).
      if (result.foodLoss > 0) s.fieldwork.foods[offer.foodId] = (s.fieldwork.foods[offer.foodId] || 0) - result.foodLoss;
      if (result.materialCount > 0) s.fieldwork.materials[offer.materialId] = (s.fieldwork.materials[offer.materialId] || 0) + result.materialCount;
      resolve('Quick cache recovery complete', {
        terminalAction: 'cache-quick', action: 'cache-quick', sceneId: result.sceneId,
        paid: [], lost: result.foodLoss > 0 ? [{ bucket: 'food', id: offer.foodId, count: result.foodLoss }] : [],
        earned: result.materialCount > 0 ? [{ bucket: 'material', id: offer.materialId, count: result.materialCount }] : [],
      });
      return { ok: true };
    }
    if (action === 'cache-leave' && (active.stage === 'warning' || active.stage === 'choice')) {
      resolve('Left the cache where it was', {
        terminalAction: 'cache-leave', action: 'cache-leave', sceneId: 'cache-left-result',
      });
      return { ok: true };
    }
    if (action === 'cache-cancel' && (active.stage === 'resolving' || active.stage === 'collect')) {
      resolve('Cache recovery abandoned', {
        terminalAction: 'cache-cancel', action: 'cache-cancel', sceneId: 'cache-cancel-result',
        elapsedSec: cacheElapsed(active),
      });
      return { ok: true };
    }
    if (action === 'cache-collect' && active.stage === 'collect') {
      const result = fieldwork.cacheResult(offer, 'careful');
      const grants = result.materialCount > 0
        ? [{ bucket: s.fieldwork.materials, key: offer.materialId, capKind: 'material', amount: result.materialCount }] : [];
      if (!fitsTransaction(s, [] as any, grants as any)) return { ok: false, why: 'The bag has no room for the recovered materials' };
      if (result.materialCount > 0) s.fieldwork.materials[offer.materialId] = (s.fieldwork.materials[offer.materialId] || 0) + result.materialCount;
      resolve('Collected recovered materials', {
        terminalAction: 'cache-collect', action: 'cache-collect', sceneId: result.sceneId,
        elapsedSec: offer.carefulSec,
        earned: result.materialCount > 0 ? [{ bucket: 'material', id: offer.materialId, count: result.materialCount }] : [],
      });
      return { ok: true };
    }
    return { ok: false, why: 'That choice is unavailable for this encounter' };
  }
  if (action === 'fight' && ['sounds', 'prowler', 'nest', 'discovered'].includes(active.kind)
    && (active.kind !== 'sounds' || active.stage === 'choice')) {
    if (!startFight(s, active)) return { ok: false, why: 'No prepared group is available' };
    bumpBeat(active);
    return { ok: true };
  }
  if (active.kind === 'sounds' && active.stage === 'warning' && action === 'investigate') {
    surveyMapAround(s, active.origin);
    active.stage = 'choice'; active.warningSec = 0; active.choiceSec = CFG.choice_sec;
    bumpBeat(active);
    return { ok: true };
  }
  if (active.kind === 'traveler' && action === 'listen') {
    const before = journalSnapshot(s);
    surveyMapAround(s, active.origin);
    resolve('Traveler shared news from nearby', { terminalAction: 'listen', info: surveyInfo(before, s) });
    return { ok: true };
  }
  if (active.kind === 'traveler' && (action === 'trade-ore' || action === 'trade-timber')) {
    const p = active.payload, material = action === 'trade-ore' ? 'ore' : 'timber';
    if (!(p.materials as string[] | undefined)?.includes(material)) return { ok: false, why: 'That trade is unavailable' };
    const costs = [{ bucket: s.fieldwork.foods, key: String(p.foodId), capKind: 'food', amount: Number(p.foodAmount) }];
    const grants = [{ bucket: s.fieldwork.materials, key: material, capKind: 'material', amount: 1 }];
    if (!fitsTransaction(s, costs, grants)) return { ok: false, why: 'The food or bag capacity changed' };
    costs.forEach(x => { x.bucket[x.key] -= x.amount; }); grants.forEach(x => { x.bucket[x.key] = (x.bucket[x.key] || 0) + x.amount; });
    resolve(`Traded ${p.foodAmount} provisions for ${material}`, {
      paid: [{ bucket: 'food', id: String(p.foodId), count: Number(p.foodAmount) }],
      earned: [{ bucket: 'material', id: material, count: 1 }],
    }); return { ok: true };
  }
  if (active.kind === 'discovered' && action === 'shelter') {
    s.fieldwork.campEncounters.exposureSec = 0;
    resolve('Sheltered as the threat passed');
    return { ok: true };
  }
  if (['quiet', 'shelter', 'secure', 'pause', 'decline', 'dismiss', 'relocate'].includes(action)) {
    if (active.kind === 'sounds' && action === 'quiet') {
      const before = journalSnapshot(s);
      surveyMapAround(s, active.origin);
      resolve('The noise passed', { info: surveyInfo(before, s) }); return { ok: true };
    }
    if (active.kind === 'traveler' && action === 'decline') { resolve('You sent the traveler away'); return { ok: true }; }
    if (active.kind === 'nest' && action === 'pause') { resolve('The nest moved on'); return { ok: true }; }
    if (active.kind === 'prowler' && (action === 'shelter' || action === 'secure')) {
      s.fieldwork.action = null;
      resolve('You secured the supplies and waited it out');
      return { ok: true };
    }
  }
  return { ok: false, why: 'That choice is unavailable for this encounter' };
}

function tickCacheWork(s: GameState, active: CampEncounterActive): void {
  // Timed work needs the ordinary Camp gate and an idle character; the general gate alone
  // still permits gathering, which would make the recovery an incompatible activity.
  if (!eligible(s) || s.fieldwork.action) { cancelCampEncounter(s, 'Encounter declined'); return; }
  if (active.stage === 'collect') return;
  const story = active.story;
  if (!story) { cancelCampEncounter(s, 'Encounter declined'); return; }
  story.remainingSec = Math.max(0, story.remainingSec - 1);
  if (story.remainingSec > 0) return;
  const offer = story.cache;
  if (!offer) { cancelCampEncounter(s, 'Encounter declined'); return; }
  const preview = fieldwork.cachePreview(offer, 'careful');
  const outcome = preview.outcomes[0];
  const grants = outcome.materialCount > 0
    ? [{ bucket: s.fieldwork.materials, key: offer.materialId, capKind: 'material', amount: outcome.materialCount }]
    : [];
  if (!fitsTransaction(s, [] as any, grants as any)) {
    active.stage = 'collect';
    story.remainingSec = 0;
    bumpBeat(active);
    return;
  }
  const result = fieldwork.cacheResult(offer, 'careful');
  if (result.materialCount > 0) s.fieldwork.materials[offer.materialId] = (s.fieldwork.materials[offer.materialId] || 0) + result.materialCount;
  finalize(s, active, {
    terminalAction: 'cache-careful', action: 'cache-careful', sceneId: result.sceneId,
    elapsedSec: offer.carefulSec,
    earned: result.materialCount > 0 ? [{ bucket: 'material', id: offer.materialId, count: result.materialCount }] : [],
    recap: 'Recovered materials carefully',
  });
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
    if (s.phase === 'camp') cancelCampEncounter(s, 'Camp fight interrupted', { terminalAction: 'combat-pushed' });
    else if (!at) cancelCampEncounter(s, 'Camp fight interrupted');
    else cancelCampEncounter(s, 'Camp threat defeated', { terminalAction: 'combat-won' });
    return;
  }
  if (active && (active.stage === 'resolving' || active.stage === 'collect')) { tickCacheWork(s, active); return; }
  if (active && !eligible(s)) { cancelCampEncounter(s, 'Encounter declined'); return; }
  if (active) {
    if (active.stage === 'warning' && --active.warningSec <= 0) {
      active.stage = 'choice'; active.choiceSec = CFG.choice_sec;
      if (['prowler', 'nest', 'discovered'].includes(active.kind) && state.policy === 'engage') { startFight(s, active); bumpBeat(active); return; }
    } else if (active.stage === 'choice' && --active.choiceSec <= 0) {
      if (['prowler', 'nest', 'discovered'].includes(active.kind) && state.policy === 'defend') { startFight(s, active); bumpBeat(active); return; }
      if (active.kind === 'discovered') state.exposureSec = 0;
      cancelCampEncounter(s, active.kind === 'nest' ? 'The nest moved on' : 'Encounter passed', { terminalAction: 'timeout' });
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
  const exposure = state.exposureSec >= CFG.exposure_threshold_sec;
  // closed facts (4.5.3)
  const campCell = s.fieldwork.camp!.cell;
  const campZone = s.fieldwork.camp!.zone;
  const species = poolFor(s, campCell)?.species ?? [];
  const localMobs = species.length > 0;
  const regionalFood = (fieldwork.F.regional_sources as Record<string, { food: string }>)[String(s.zone)]?.food;
  const foodIdValid = !!regionalFood && !!fieldwork.foodById[regionalFood];
  const cacheMaterialValid = (fieldwork.F.materials as any[]).some((m: any) => m.id === CFG.cache.material_id);
  const home = settlementOfZone(campZone);
  const foodCount = foodIdValid ? (s.fieldwork.foods[regionalFood] || 0) : 0;
  const materials = ['ore', 'timber'].filter(id => (fieldwork.F.materials as any[]).some((m: any) => m.id === id));
  const facts = {
    localMobs,
    travelerOffer: !!(home && regionalFood && foodCount >= CFG.barter_food && materials.length),
    worksite: !!(s.fieldwork.action?.kind === 'mine' || s.fieldwork.action?.kind === 'grove'),
    exposureThreshold: exposure,
    idleCache: !s.fieldwork.action && foodIdValid && cacheMaterialValid,
  };
  const seen = state.storyHistory.map(h => ({ eventId: h.eventId, kind: h.kind, encounterId: h.encounterId }));
  const rows = fieldwork.eligibleCampPool(facts, seen, state.serial + 1);
  if (!rows.length) return;
  const row: any = fieldwork.selectCampPool(rows, rng());
  if (!row) return;
  const payload = payloadFor(s, row.kind);
  const nextId = state.serial + 1;
  // freeze variant (pure hash, no RNG) + traveler-return continuation
  const scenes = STORY_SCENES();
  let sceneId: string = row.scene_id;
  let lineIndex = 0;
  let variantId: string;
  if (row.kind === 'traveler') {
    // Only the newest terminal traveler record may continue; an older trade never skips past
    // a later listen/decline.
    const latest = [...state.storyHistory].reverse().find((h) => h.kind === 'traveler' && h.terminalAction !== null);
    if (latest && (latest.terminalAction === 'trade-ore' || latest.terminalAction === 'trade-timber') && !latest.followupUsed) {
      latest.followupUsed = true;
      sceneId = 'traveler-return';
      lineIndex = 0;
    }
  }
  const scene = scenes.find(x => x.id === sceneId);
  if (scene) {
    const variantIds = scene.lines.map((_: any, i: number) => `${sceneId}-${i}`);
    const recentIds = state.storyHistory.map(h => h.variantId);
    variantId = fieldwork.selectCampVariant({ seed: s.seed, serial: nextId, eventId: row.id, variantIds, recentIds });
    lineIndex = Number(variantId.split('-').pop()) || 0;
  } else variantId = `${sceneId}-0`;
  let cacheOffer: any = null;
  if (row.kind === 'supply-cache') cacheOffer = fieldwork.cacheOffer(s.zone, String(regionalFood), rng());
  const story = {
    revision: 1 as const, eventId: row.id, sceneId, lineIndex, beat: 0,
    cache: cacheOffer, remainingSec: 0,
  };
  state.active = makeEvent(s, row.kind, payload, rng, spawn, story);
  state.storyHistory.push({ encounterId: state.active.id, eventId: row.id, kind: row.kind, variantId, terminalAction: null, followupUsed: false });
  const limit = Number(CFG.story.recent_limit) || 4;
  if (state.storyHistory.length > limit) state.storyHistory = state.storyHistory.slice(-limit);
  /* A threat pauses the work at its Camp; a visitor or a clue leaves the work alone. Cache never interrupts. */
  if (['sounds', 'prowler', 'nest', 'discovered'].includes(row.kind)) s.fieldwork.action = null;
}
