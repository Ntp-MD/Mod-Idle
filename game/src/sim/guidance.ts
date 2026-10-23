import { E, TOWN, eng, fieldwork, tree, trade } from '../engine/client';
import type { ForgeKind } from '../../../engine/forge.ts';
import type { GameState } from './types';
import { canForge, forge } from './forge';
import { contractById, deliveryTimeLeft, deliveryPauseReason } from './delivery';
import { tradeBucket } from './trade';
import { materialSources } from './material-sources';
import { slotsFree } from './slots';
import { treePath, treePointsFree } from './tree';
import { cellBlocks, currentCell, ownerOf, settlementCell } from './road';

/**
 * The player's next step, in one place.
 *
 * A goal is only a reference: a delivery id, a forge pattern, a map cell, a material, a tree node or
 * the current zone. Every number the card prints is read live from the owner that will act on it, so a
 * receipt, a sale or a spent point never leaves a stale copy behind. Resolution never mutates the run.
 */
export type GoalKind = 'forge' | 'workshop' | 'delivery' | 'destination' | 'shortage' | 'passive' | 'tree' | 'hunt';

export interface ForgeGoal {
  kind: 'forge';
  patternKind: ForgeKind;
  pattern: string;
  material: string;
}

export interface WorkshopGoal {
  kind: 'workshop';
  recipe: string;
}

export interface DeliveryGoal {
  kind: 'delivery';
  id: string;
}

export interface DestinationGoal {
  kind: 'destination';
  q: number;
  r: number;
  label: string;
  /** Why the guidance picked it, when the player did not pin it themselves. */
  why?: 'deposit';
}

export interface ShortageOriginForge {
  kind: 'forge';
  patternKind: ForgeKind;
  pattern: string;
  material: string;
}

export interface ShortageOriginDelivery {
  kind: 'delivery';
  id: string;
}

export interface ShortageOriginWorkshop {
  kind: 'workshop';
  recipe: string;
}

export type ShortageOrigin = ShortageOriginForge | ShortageOriginDelivery | ShortageOriginWorkshop;

export interface ShortageGoal {
  kind: 'shortage';
  /** The trade-good id when the game knows one; otherwise the material id. */
  good: string;
  /** The whole quantity the origin needs. The card reports held/want. */
  want: number;
  origin: ShortageOrigin;
}

export interface PassiveGoal {
  kind: 'passive';
  id: string;
}

/** No node pinned yet: the tree itself is the next step while points are banked. */
export interface TreeGoal {
  kind: 'tree';
}

export interface HuntGoal {
  kind: 'hunt';
  zone: number;
}

export type GoalRef = ForgeGoal | WorkshopGoal | DeliveryGoal | DestinationGoal | ShortageGoal | PassiveGoal | TreeGoal | HuntGoal;

export interface GuidanceState {
  /** The player's own pin. It outranks every automatic suggestion, and stays until cleared. */
  tracked: GoalRef | null;
}

export const newGuidance = (): GuidanceState => ({ tracked: null });

const isInt = (value: unknown): value is number => Number.isSafeInteger(value);
const isId = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 120;

/** Save reader: keep the shape a later resolver can explain, drop anything that is not a goal. */
export function normalizeGuidance(raw: unknown): GuidanceState {
  const value = raw as Partial<GuidanceState> | null;
  const ref = normalizeGoalRef(value?.tracked);
  return { tracked: ref };
}

export function normalizeGoalRef(raw: unknown): GoalRef | null {
  if (!raw || typeof raw !== 'object') return null;
  const ref = raw as Record<string, unknown>;
  switch (ref.kind) {
    case 'forge':
      return isId(ref.pattern) && isId(ref.material) && (ref.patternKind === 'armour' || ref.patternKind === 'weapon')
        ? { kind: 'forge', patternKind: ref.patternKind, pattern: ref.pattern, material: ref.material } : null;
    case 'workshop':
      return isId(ref.recipe) ? { kind: 'workshop', recipe: ref.recipe } : null;
    case 'delivery':
      return isId(ref.id) ? { kind: 'delivery', id: ref.id } : null;
    case 'destination':
      return isInt(ref.q) && isInt(ref.r) && isId(ref.label)
        ? { kind: 'destination', q: ref.q, r: ref.r, label: ref.label, ...(ref.why === 'deposit' ? { why: 'deposit' as const } : {}) } : null;
    case 'shortage': {
      const origin = normalizeShortageOrigin(ref.origin);
      const want = ref.want;
      return isId(ref.good) && typeof want === 'number' && Number.isSafeInteger(want) && want > 0 && origin
        ? { kind: 'shortage', good: ref.good, want, origin } : null;
    }
    case 'passive':
      return isId(ref.id) ? { kind: 'passive', id: ref.id } : null;
    case 'tree':
      return { kind: 'tree' };
    case 'hunt':
      return isInt(ref.zone) ? { kind: 'hunt', zone: ref.zone } : null;
    default:
      return null;
  }
}

function normalizeShortageOrigin(raw: unknown): ShortageOrigin | null {
  if (!raw || typeof raw !== 'object') return null;
  const origin = raw as Record<string, unknown>;
  if (origin.kind === 'forge') {
    return isId(origin.pattern) && isId(origin.material) && (origin.patternKind === 'armour' || origin.patternKind === 'weapon')
      ? { kind: 'forge', patternKind: origin.patternKind, pattern: origin.pattern, material: origin.material } : null;
  }
  if (origin.kind === 'delivery' && isId(origin.id)) return { kind: 'delivery', id: origin.id };
  if (origin.kind === 'workshop' && isId(origin.recipe)) return { kind: 'workshop', recipe: origin.recipe };
  return null;
}

export function setTrackedGoal(state: GameState, ref: GoalRef | null): void {
  state.guidance ||= newGuidance();
  state.guidance.tracked = ref;
}

export function isTracking(state: GameState, ref: GoalRef): boolean {
  return JSON.stringify(state.guidance?.tracked ?? null) === JSON.stringify(ref);
}

/** The goal the Journey card shows: the player's pin, or the first automatic suggestion. */
export function nextGoal(state: GameState): { view: GoalView; source: 'tracked' | 'recommended' } | null {
  const tracked = state.guidance?.tracked;
  if (tracked) return { view: resolveGoal(state, tracked), source: 'tracked' };
  const ref = recommendGoal(state);
  return ref ? { view: resolveGoal(state, ref), source: 'recommended' } : null;
}

/**
 * Automatic suggestions use the same fixed order every tick, so the card doesn't shuffle while the
 * player reads it. Player pins and Delivery tracking are intent, not suggestions, and outrank all of it.
 */
export function recommendGoal(state: GameState): GoalRef | null {
  const trackedDelivery = openTrackedDelivery(state);
  if (trackedDelivery) return { kind: 'delivery', id: trackedDelivery.id };
  if (slotsFree(state) < 1) {
    const here = ownerOf(currentCell(state));
    const cell = settlementCell(here.id);
    if (cell) return { kind: 'destination', q: cell.q, r: cell.r, label: here.name, why: 'deposit' };
  }
  if (treePointsFree(state) > 0 || treePointsFree(state, 'attainment') > 0) return { kind: 'tree' };
  return { kind: 'hunt', zone: state.zone };
}

export function openTrackedDelivery(state: GameState) {
  for (const id of state.town.trackedContractIds || []) {
    const contract = contractById(state, id);
    if (contract?.status === 'open' && deliveryTimeLeft(state, contract) > 0) return contract;
  }
  return null;
}

export type GoalStatus = 'active' | 'complete' | 'stale';
export type GoalAction = 'delivery' | 'forge' | 'market' | 'map' | 'tree' | 'hunt';

export interface GoalSource {
  label: string;
  detail: string;
  zones: number[];
  /** One map pin per zone; the label is the settlement the pin lands on. */
  pins: { zone: number; label: string }[];
}

export interface GoalView {
  ref: GoalRef;
  kind: GoalKind;
  kindLabel: string;
  title: string;
  reason: string;
  progress: string | null;
  status: GoalStatus;
  action: GoalAction | null;
  actionLabel: string;
  /** Where the action leads: a shortage points back at the recipe or contract it belongs to. */
  target: GoalRef;
  sources: GoalSource[];
}

const townName = (id: string) => TOWN.settlements.find((town: any) => town.id === id)?.name || id;
const zoneName = (zone: number) =>
  E.mob.zones.find((row: any) => row.id === zone)?.name || `Zone ${zone}`;
const ACTIVITY_NAME: Record<string, string> = {
  mine: 'Mine', grove: 'Grove', hunt: 'Hunt', salvage: 'Salvage', fish: 'Fishing', cook: 'Cooking',
  workshop: 'Workshop', farm: 'Farm', trail: 'Trail', town: 'Settlement',
};

export const goalKindLabel: Record<GoalKind, string> = {
  forge: 'Forge recipe', workshop: 'Workshop recipe', delivery: 'Delivery', destination: 'Destination', shortage: 'Missing material',
  passive: 'Passive node', tree: 'Passive tree', hunt: 'Hunting',
};

function settle(state: GameState, base: Omit<GoalView, 'status' | 'sources'> & { status?: GoalStatus; sources?: GoalSource[] }): GoalView {
  void state;
  return { ...base, status: base.status ?? 'active', sources: base.sources ?? [] };
}

export function resolveGoal(state: GameState, ref: GoalRef): GoalView {
  switch (ref.kind) {
    case 'forge': return resolveForge(state, ref);
    case 'workshop': return resolveWorkshop(state, ref);
    case 'delivery': return resolveDelivery(state, ref);
    case 'destination': return resolveDestination(state, ref);
    case 'shortage': return resolveShortage(state, ref);
    case 'passive': return resolvePassive(state, ref);
    case 'tree': return resolveTree(state);
    case 'hunt': return resolveHunt(state, ref);
  }
}

function resolveForge(state: GameState, ref: ForgeGoal): GoalView {
  const base: Omit<GoalView, 'reason' | 'progress' | 'status' | 'sources'> = {
    ref, kind: 'forge', kindLabel: goalKindLabel.forge, title: 'Forge a piece',
    action: 'forge', actionLabel: 'Open Forge', target: ref,
  };
  const pattern = forge.patternOf(ref.patternKind, ref.pattern);
  if (!pattern) return settle(state, { ...base, title: 'Forge recipe unavailable', reason: 'That pattern is no longer in the Forge catalogue. Pin another goal.', progress: null, status: 'stale' });
  const materialName = fieldwork.materialById[ref.material]?.name || ref.material;
  const held = state.fieldwork.materials[ref.material] || 0;
  const want = pattern.count;
  const missing = Math.max(0, want - held);
  const sources = materialSources(ref.material).map(sourceToGoalSource);
  const source = sources[0] ? `${sources[0].label} · ${sources[0].detail}` : 'Open the material list in the Forge';
  const verdict = canForge(state, ref.patternKind, ref.pattern, ref.material);
  const reason = missing > 0
    ? `Need ${missing} more ${materialName}. ${source}`
    : verdict.ok ? 'Materials ready — forge it at a settlement.'
      : `${verdict.why || 'Finish what is in progress'}.`;
  return settle(state, { ...base, title: `${pattern.name} · ${materialName}`, reason, progress: `${held}/${want} ${materialName}`, sources });
}

function resolveWorkshop(state: GameState, ref: WorkshopGoal): GoalView {
  const base: Omit<GoalView, 'reason' | 'progress' | 'status' | 'sources'> = {
    ref, kind: 'workshop', kindLabel: goalKindLabel.workshop, title: 'Refine a workshop material',
    action: 'market', actionLabel: 'Open workshop', target: ref,
  };
  const recipe = (fieldwork.workshopById as Record<string, any>)[ref.recipe];
  if (!recipe) return settle(state, { ...base, title: 'Workshop recipe unavailable', reason: 'That recipe is no longer in the workshop catalogue. Pin another goal.', progress: null, status: 'stale' });
  const costs = Object.entries(recipe.materials as Record<string, number>);
  const missing = costs.filter(([id, need]) => (state.fieldwork.materials[id] || 0) < need);
  const first = missing[0];
  const sources = first ? materialSources(first[0]).map(sourceToGoalSource) : [];
  const source = sources[0] ? `${sources[0].label} · ${sources[0].detail}` : '';
  const reason = missing.length
    ? `Short ${missing.map(([id, need]) => `${need - (state.fieldwork.materials[id] || 0)} ${fieldwork.materialById[id]?.name || id}`).join(' · ')}${source ? ` — ${source}` : ''}.`
    : 'Materials are ready at a settlement workshop.';
  return settle(state, { ...base, title: `${recipe.name} ×${recipe.yield}`, reason, progress: null, sources });
}

function resolveDelivery(state: GameState, ref: DeliveryGoal): GoalView {
  const base: Omit<GoalView, 'reason' | 'progress' | 'status' | 'sources'> = {
    ref, kind: 'delivery', kindLabel: goalKindLabel.delivery, title: 'Deliver goods',
    action: 'delivery', actionLabel: 'Open Delivery board', target: ref,
  };
  const contract = contractById(state, ref.id);
  if (!contract) return settle(state, { ...base, title: 'Delivery no longer exists', reason: 'This want has left the board. Clear the goal or pin another.', progress: null, status: 'stale' });
  const good = trade.byId[contract.good];
  if (!good) return settle(state, { ...base, title: 'Delivery needs a content migration', reason: `The good ${contract.good} is not in the catalogue.`, progress: null, status: 'stale' });
  if (contract.status !== 'open') return settle(state, { ...base, title: `${good.name} · ${townName(contract.town)}`, reason: `This delivery is ${contract.status}. The reward or forfeit is recorded on the board.`, progress: `${contract.delivered}/${contract.target}`, status: 'stale' });
  const left = deliveryTimeLeft(state, contract);
  if (left <= 0) return settle(state, { ...base, title: `${good.name} · ${townName(contract.town)}`, reason: 'The deadline has passed; this want has expired.', progress: `${contract.delivered}/${contract.target}`, status: 'stale' });
  const carried = tradeBucket(state, good)[good.key] || 0;
  const remaining = Math.max(0, contract.target - contract.delivered);
  const steps = acquisitionSources(contract.acquisition);
  const source = steps[0] ? `${steps[0].label} · ${steps[0].detail}` : '';
  const pause = deliveryPauseReason(state);
  const reason = [
    carried < remaining ? `Need ${remaining - carried} more ${good.name}${source ? ` — ${source}` : ''}.` : `${carried} carried; ready to hand in.`,
    pause ? `Deadline paused: ${pause}.` : '',
  ].filter(Boolean).join(' ');
  return settle(state, { ...base, title: `${good.name} · ${townName(contract.town)}`, reason, progress: `${contract.delivered}/${contract.target} · ${Math.floor(left / 60)}m ${left % 60}s left`, sources: steps });
}

function resolveDestination(state: GameState, ref: DestinationGoal): GoalView {
  const base: Omit<GoalView, 'reason' | 'progress' | 'status' | 'sources'> = {
    ref, kind: 'destination', kindLabel: goalKindLabel.destination, title: ref.why === 'deposit' ? `Deposit at ${ref.label}` : `Travel to ${ref.label}`,
    action: 'map', actionLabel: 'Open map', target: ref,
  };
  const blocks = cellBlocks(state, ref);
  const reason = ref.why === 'deposit'
    ? 'The bag is full — the field has stopped paying until space is freed at a settlement.'
    : blocks === 0 ? 'You are standing on this destination.' : 'A pinned destination. The map keeps this block in context.';
  return settle(state, { ...base, reason, progress: blocks === 0 ? 'You are here' : `${blocks} block${blocks === 1 ? '' : 's'} away`, sources: [] });
}

function resolveShortage(state: GameState, ref: ShortageGoal): GoalView {
  const originView = resolveGoal(state, ref.origin as GoalRef);
  const base: Omit<GoalView, 'reason' | 'progress' | 'status' | 'sources'> = {
    ref, kind: 'shortage', kindLabel: goalKindLabel.shortage, title: 'Gather the missing material',
    action: originView.action, actionLabel: originView.actionLabel, target: ref.origin as GoalRef,
  };
  const good = trade.byId[ref.good];
  const name = good?.name || fieldwork.materialById[ref.good.replace(/^material:/, '')]?.name || ref.good.replace(/^material:/, '');
  const have = good ? tradeBucket(state, good)[good.key] || 0 : state.fieldwork.materials[ref.good.replace(/^material:/, '')] || 0;
  const sources = shortageSources(state, ref);
  const origin = `${originView.title} — ${originView.reason}`;
  if (have >= ref.want) {
    return settle(state, { ...base, title: `${name} ready`, reason: `You hold ${have}/${ref.want}. Return to ${origin}`, progress: `${have}/${ref.want}`, status: 'complete', sources });
  }
  const source = sources[0] ? `${sources[0].label} · ${sources[0].detail}` : '';
  return settle(state, { ...base, title: `Gather ${name}`, reason: `Need ${ref.want - have} more${source ? ` — ${source}` : ''}. For ${origin}`, progress: `${have}/${ref.want}`, sources });
}

function resolvePassive(state: GameState, ref: PassiveGoal): GoalView {
  const base: Omit<GoalView, 'reason' | 'progress' | 'status' | 'sources'> = {
    ref, kind: 'passive', kindLabel: goalKindLabel.passive, title: 'Passive node',
    action: 'tree', actionLabel: 'Open tree', target: ref,
  };
  const node = tree.byId[ref.id];
  if (!node) return settle(state, { ...base, title: 'Passive node unavailable', reason: 'The tree no longer holds that node. Clear the goal or pin another.', progress: null, status: 'stale' });
  const rank = state.player.treeRanks?.[ref.id] || 0;
  const title = node.name || ref.id;
  if (rank >= node.ranks) return settle(state, { ...base, title, reason: 'This node is already allocated.', progress: `${rank}/${node.ranks}`, status: 'complete' });
  const path = treePath(state, ref.id);
  const holder = node.kind === 'keystone' ? tree.pairHolder(ref.id, state.player.treeRanks || {}) : null;
  const pair = holder ? tree.byId[holder]?.name || holder : '';
  const treeFree = treePointsFree(state, node.currency);
  const affordable = treeFree >= node.cost;
  const reason = pair
    ? `${pair} is incompatible with this keystone.`
    : path.nodes.length === 0
      ? 'No unowned route reaches this node.'
      : `Route: ${path.nodes.length} node${path.nodes.length === 1 ? '' : 's'} · ${path.cost.tree} tree · ${path.cost.attainment} attainment.${affordable ? '' : ` Needs ${node.cost - treeFree} more ${node.currency === 'tree' ? 'tree points' : 'attainment points'}.`}`;
  return settle(state, { ...base, title, reason, progress: path.nodes.length ? `${path.cost.tree} tree · ${path.cost.attainment} attainment` : null, sources: [] });
}

function resolveTree(state: GameState): GoalView {
  const treeFree = treePointsFree(state);
  const attainment = treePointsFree(state, 'attainment');
  return settle(state, {
    ref: { kind: 'tree' }, kind: 'tree', kindLabel: goalKindLabel.tree,
    title: `${treeFree} tree point${treeFree === 1 ? '' : 's'} to spend`,
    reason: attainment ? `${attainment} attainment point${attainment === 1 ? '' : 's'} also banked. Open the tree and choose a node.` : 'Open the tree and choose a node; the game never allocates points for you.',
    progress: null, action: 'tree', actionLabel: 'Open tree', target: { kind: 'tree' }, sources: [],
  });
}

function resolveHunt(state: GameState, ref: HuntGoal): GoalView {
  const zone = eng.zoneById(ref.zone);
  const hunting = state.hunting && state.zone === ref.zone;
  return settle(state, {
    ref, kind: 'hunt', kindLabel: goalKindLabel.hunt, title: `Hunt in ${zone.name}`,
    reason: hunting ? 'The field is already running this zone; keep hunting for XP, drops and materials.' : 'Nothing is pinned; hunting is the field activity that always moves the character forward.',
    progress: `Level ${state.player.level}`, action: 'hunt', actionLabel: hunting ? 'Keep hunting' : 'Hunt here', target: ref, sources: [],
  });
}

function sourceToGoalSource(source: ReturnType<typeof materialSources>[number]): GoalSource {
  return {
    label: source.label,
    detail: source.detail,
    zones: source.zones,
    pins: source.zones.flatMap((zone) => {
      const town = TOWN.settlements.find((row: any) => row.zone === zone);
      return town ? [{ zone, label: town.name }] : [];
    }),
  };
}

function shortageSources(state: GameState, ref: ShortageGoal): GoalSource[] {
  if (ref.origin.kind === 'forge') return materialSources(ref.origin.material).map(sourceToGoalSource);
  if (ref.origin.kind === 'workshop') return materialSources(ref.good.replace(/^material:/, '')).map(sourceToGoalSource);
  const contract = contractById(state, ref.origin.id);
  return contract ? acquisitionSources(contract.acquisition) : [];
}

/** The acquisition route a Delivery offer already carries, grouped for a short, non-duplicated list. */
export function acquisitionSources(acquisition: { steps: { kind: string; zone: number; quantity: number }[] }): GoalSource[] {
  const groups = new Map<string, { kinds: Set<string>; zones: Set<number>; quantity: number }>();
  for (const step of acquisition.steps) {
    const key = step.kind;
    const row = groups.get(key) || { kinds: new Set<string>(), zones: new Set<number>(), quantity: 0 };
    row.kinds.add(step.kind);
    row.zones.add(step.zone);
    row.quantity += step.quantity;
    groups.set(key, row);
  }
  return [...groups.entries()].map(([kind, row]) => {
    const zones = [...row.zones];
    return {
      label: ACTIVITY_NAME[kind] || kind,
      detail: zones.map(zoneName).join(' · '),
      zones,
      pins: zones.flatMap((zone) => {
        const town = TOWN.settlements.find((row: any) => row.zone === zone);
        return town ? [{ zone, label: town.name }] : [];
      }),
    };
  });
}

export function materialSourceFor(materialId: string): GoalSource[] {
  return materialSources(materialId).map(sourceToGoalSource);
}

export function zoneDestination(zone: number): DestinationGoal | null {
  const town = TOWN.settlements.find((row: any) => row.zone === zone);
  if (!town) return null;
  const cell = settlementCell(town.id);
  return cell ? { kind: 'destination', q: cell.q, r: cell.r, label: town.name } : null;
}

/**
 * The optional activities, in the words the panels use. These are guidance only: nothing here unlocks,
 * rewards or gates a system, and the panels keep their own explanations.
 */
export const ACTIVITY_GUIDE = {
  farm: {
    label: 'Farm',
    when: 'When you want steady herbs or provisions without leaving safety.',
    helps: 'Herb tiers feed potions, cooking and Market sales; plots keep working while you hunt.',
  },
  craft: {
    label: 'Craft',
    when: 'When a carried or worn piece is close to the build you want.',
    helps: 'Stones reroll, add or protect Mod lines; the bench shows costs and refuses unsafe presses.',
  },
  delivery: {
    label: 'Delivery',
    when: 'When a tracked want pays more than selling the same goods at market.',
    helps: 'Hand-ins pay market value now and a bonus at the full count before the deadline.',
  },
  market: {
    label: 'Market',
    when: 'When the bag is full, a material is missing, or gold would solve the next step.',
    helps: 'Sells cargo, refines regional materials and stocks town services — prices read live.',
  },
} as const;

export type NoticeKind = 'error' | 'blocked' | 'decision' | 'tracked' | 'optional';

export interface GuidanceNotice {
  id: string;
  kind: NoticeKind;
  priority: number;
  title: string;
  detail: string;
  actionLabel?: string;
  action?: GoalAction;
  target?: GoalRef;
  count?: number;
}

export interface NoticeContext {
  storageError?: boolean;
  writerState?: 'owner' | 'readonly' | 'waiting' | 'unavailable' | 'checking';
}

/**
 * One ordered list for the Journey surface. The first entry is the decision the player has to make;
 * the rest stay visible but never outrank a save or read-only problem. Repeated conditions are one row.
 */
export function guidanceNotices(state: GameState, context: NoticeContext = {}): GuidanceNotice[] {
  const out: GuidanceNotice[] = [];
  if (context.storageError) {
    out.push({ id: 'storage-error', kind: 'error', priority: 0, title: 'Storage error', detail: 'Progress may not be saved. Open Save and export before closing.', actionLabel: 'Open Save' });
  }
  if (context.writerState && context.writerState !== 'owner' && context.writerState !== 'checking') {
    const title = context.writerState === 'readonly' ? 'Read-only · another tab controls progress'
      : context.writerState === 'waiting' ? 'Waiting for account control' : 'Progression paused · save control unavailable';
    out.push({ id: 'writer', kind: 'error', priority: 0, title, detail: 'Take account control in Save before changing the character.', actionLabel: 'Open Save' });
  }
  const next = nextGoal(state);
  if (slotsFree(state) < 1 && next?.view.kind !== 'destination') {
    out.push({ id: 'bag-full', kind: 'blocked', priority: 1, title: 'Bag full', detail: 'The field has stopped paying until a settlement deposit frees a slot.', actionLabel: 'Open map', action: 'map', target: recommendGoal(state) || undefined });
  }
  if (state.fieldwork.campEncounters.active) {
    out.push({ id: 'camp-encounter', kind: 'decision', priority: 2, title: 'Camp encounter needs a choice', detail: 'Choose before the threat reaches Camp.', actionLabel: 'Show Camp' });
  }
  if (next && next.view.status !== 'active') {
    out.push({ id: 'stale-goal', kind: 'decision', priority: 2, title: 'Pinned goal needs attention', detail: next.view.reason, actionLabel: next.view.actionLabel, action: next.view.action ?? undefined, target: next.view.target });
  }
  const tracked = openTrackedDelivery(state);
  if (tracked && next?.view.kind !== 'delivery') {
    const good = trade.byId[tracked.good];
    const left = deliveryTimeLeft(state, tracked);
    out.push({ id: `delivery:${tracked.id}`, kind: 'tracked', priority: 3, title: `Tracked Delivery · ${good?.name || tracked.good}`, detail: `${tracked.delivered}/${tracked.target} · ${Math.floor(left / 60)}m ${left % 60}s left`, actionLabel: 'Open Delivery', action: 'delivery', target: { kind: 'delivery', id: tracked.id } });
  }
  // Stable sort: rows of the same severity keep the order the checks ran in (save before control,
  // blockers before decisions), so the list never shuffles between ticks.
  return out.sort((a, b) => a.priority - b.priority);
}
