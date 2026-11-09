/**
 * The seven explicit read-only source mappings (plan §8). Every function is pure:
 * it formats values it is handed, never calls a commit, creates a contract,
 * mutates state or consumes RNG. Name and number formatting stays with the host;
 * presenters only place the formatted strings into StoryViews.
 */
import { STORY } from '../../engine/client';
import { formatStoryLine, storyHash32 } from '../../../../engine/storyteller.ts';
import type { StoryAction, StoryFact, StoryView } from './story-scene';

const sceneOf = (id: string) => {
  const scene = STORY.scenes.find((row) => row.id === id);
  if (!scene) throw new Error(`story-presenters: unknown scene ${id}`);
  return scene;
};
const labelOf = (id: string): string => STORY.labels[id] ?? id;
const lineOf = (id: string, tokens: Record<string, string> = {}, lineIndex = 0): string =>
  formatStoryLine(sceneOf(id).lines[Math.abs(lineIndex) % sceneOf(id).lines.length], tokens);
const fact = (id: string, label: string, value: string, tone: StoryFact['tone'] = 'normal'): StoryFact => ({ id, label, value, tone });
const action = (id: string, disabled = false, reason = '', kind: StoryAction['kind'] = 'commit'): StoryAction => ({
  id, label: labelOf(id), kind, disabled, reason,
});
const readOnly = 'Read-only: another tab controls progress.';

export interface CampStoryInput {
  key: string;
  kind: string;
  stage: string;
  sceneId: string;
  lineIndex: number;
  speciesName?: string;
  materialName?: string;
  foodName?: string;
  foodId?: string;
  materialId?: string;
  materials?: readonly string[];
  foodAmount?: number;
  foodHeld?: number;
  cache?: { foodId: string; materialId: string; carefulSec: number; quickOutcome: string } | null;
  cachePreview?: { timeSec: number; maxFoodLoss: number; outcomes: readonly { id: string; chance: number; materialCount: number; foodLoss: number }[] } | null;
  timeText?: string;
  writable: boolean;
  error?: string;
  receipt?: { action: string; sceneId: string; elapsedSec: number; paid: readonly { id: string; count: number }[]; earned: readonly { id: string; count: number }[]; lost: readonly { id: string; count: number }[]; info: readonly string[] } | null;
}

const KIND_TITLES: Record<string, string> = {
  prowler: 'A Mob approaches',
  traveler: 'A traveler at Camp',
  nest: 'A nest near the worksite',
  discovered: 'Your Camp was found',
};

export function campStoryView(input: CampStoryInput): StoryView {
  if (input.receipt) {
    const receipt = input.receipt;
    const facts: StoryFact[] = [
      ...receipt.paid.map((entry) => fact(`paid-${entry.id}`, 'Paid', `${entry.count} ${entry.id}`, 'loss')),
      ...receipt.earned.map((entry) => fact(`earned-${entry.id}`, 'Earned', `${entry.count} ${entry.id}`, 'good')),
      ...receipt.lost.map((entry) => fact(`lost-${entry.id}`, 'Lost', `${entry.count} ${entry.id}`, 'loss')),
      ...receipt.info.map((entry, index) => fact(`info-${index}`, 'Result', entry, 'muted')),
      fact('time', 'Time', input.timeText ?? `${receipt.elapsedSec}s`),
    ];
    return {
      key: input.key, source: 'camp', mode: 'receipt',
      heading: input.kind === 'sounds' ? labelOf('signs-title') : input.kind === 'supply-cache' ? labelOf('cache-title') : KIND_TITLES[input.kind] ?? input.kind,
      speaker: 'Narrator', media: sceneOf(receipt.sceneId).media,
      line: lineOf(receipt.sceneId, {
        species: input.speciesName ?? 'nearby creature',
        material: input.materialName ?? input.cache?.materialId ?? 'material',
        food: input.foodName ?? input.cache?.foodId ?? 'provisions',
      }, input.lineIndex),
      facts, actions: [], error: input.error ?? '',
    };
  }
  const disabled = !input.writable;
  const facts: StoryFact[] = [];
  let actions: StoryAction[] = [];
  if (input.kind === 'traveler') {
    const amount = input.foodAmount ?? 0;
    const foodLabel = input.foodName ?? input.foodId ?? 'provisions';
    facts.push(fact('cost', 'Cost', `${amount} ${foodLabel}`, 'loss'));
    facts.push(fact('gain', 'Possible gain', `1 ${input.materialName ?? 'material'}`, 'good'));
  }
  if (input.kind === 'supply-cache' && input.cache && input.cachePreview) {
    const material = input.materialName ?? input.cache.materialId;
    const food = input.foodName ?? input.cache.foodId;
    for (const outcome of input.cachePreview.outcomes) {
      facts.push(fact(`gain-${outcome.id}`, 'Possible gain', `${outcome.materialCount} ${material} (${Math.round(outcome.chance * 100)}%)`, 'good'));
    }
    facts.push(fact('max-loss', 'Maximum loss', `${input.cachePreview.maxFoodLoss} ${food}`, 'loss'));
    facts.push(fact('time', 'Time', `${input.cachePreview.timeSec}s`));
  }
  if (input.kind === 'sounds' && input.stage === 'warning') {
    actions = [action('investigate', disabled, disabled ? readOnly : ''), action('quiet', disabled, disabled ? readOnly : '')];
  } else if (input.kind === 'sounds') {
    actions = [action('fight', disabled, disabled ? readOnly : ''), action('quiet', disabled, disabled ? readOnly : '')];
  } else if (input.kind === 'prowler') {
    actions = [action('fight', disabled, disabled ? readOnly : ''), action('secure', disabled, disabled ? readOnly : '')];
  } else if (input.kind === 'discovered') {
    actions = [action('fight', disabled, disabled ? readOnly : ''), action('shelter', disabled, disabled ? readOnly : '')];
  } else if (input.kind === 'nest') {
    actions = [action('fight', disabled, disabled ? readOnly : ''), action('pause', disabled, disabled ? readOnly : '')];
  } else if (input.kind === 'traveler') {
    const noFood = (input.foodHeld ?? 0) < (input.foodAmount ?? 0);
    const tradeReason = disabled ? readOnly : noFood ? `Needs ${input.foodAmount} provisions` : '';
    actions = [
      action('listen', disabled, disabled ? readOnly : ''),
      action('trade-ore', disabled || !(input.materials ?? []).includes('ore') || noFood, !(input.materials ?? []).includes('ore') ? 'That trade is unavailable' : tradeReason),
      action('trade-timber', disabled || !(input.materials ?? []).includes('timber') || noFood, !(input.materials ?? []).includes('timber') ? 'That trade is unavailable' : tradeReason),
      action('decline', disabled, disabled ? readOnly : ''),
    ];
  } else if (input.kind === 'supply-cache') {
    if (input.stage === 'warning' || input.stage === 'choice') {
      const quickBlocked = (input.foodHeld ?? 0) < (input.cachePreview?.maxFoodLoss ?? 0);
      actions = [
        action('cache-careful', disabled, disabled ? readOnly : ''),
        action('cache-quick', disabled || quickBlocked, disabled ? readOnly : quickBlocked ? 'You carry too little food for that reach' : ''),
        action('cache-leave', disabled, disabled ? readOnly : ''),
      ];
    } else if (input.stage === 'resolving') {
      actions = [action('cache-cancel', disabled, disabled ? readOnly : '')];
    } else if (input.stage === 'collect') {
      actions = [action('cache-collect', disabled, disabled ? readOnly : ''), action('cache-cancel', disabled, disabled ? readOnly : '')];
    }
  }
  if (input.stage === 'combat') actions = [];
  const heading = input.kind === 'sounds' ? labelOf('signs-title') : input.kind === 'supply-cache' ? labelOf('cache-title') : KIND_TITLES[input.kind] ?? input.kind;
  return {
    key: input.key, source: 'camp', mode: 'decision', heading, speaker: 'Narrator',
    media: sceneOf(input.sceneId).media,
    line: lineOf(input.sceneId, {
      species: input.speciesName ?? 'a nearby Species',
      material: input.materialName ?? input.cache?.materialId ?? 'material',
      food: input.foodName ?? input.cache?.foodId ?? 'provisions',
    }, input.lineIndex),
    facts, actions, error: input.error ?? '',
  };
}

export interface DeliveryStoryInput {
  key: string;
  status: 'open' | 'completed' | 'expired';
  endReason?: 'expired' | 'declined' | null;
  kind: 'request' | 'courier';
  accepted: boolean;
  goodName: string;
  townName: string;
  destinationName: string;
  speaker: string;
  target: number;
  delivered: number;
  timeText: string;
  paidText?: string;
  lastQuantity?: number;
  bonusText?: string;
  writable: boolean;
  error?: string;
}

export function deliveryStoryView(input: DeliveryStoryInput): StoryView {
  const tokens = { town: input.townName, destination: input.destinationName, good: input.goodName };
  if (input.status !== 'open') {
    const sceneId = input.kind === 'courier' && input.status === 'completed' ? 'courier-paid'
      : input.status === 'expired' ? 'delivery-expired' : 'delivery-paid';
    const facts: StoryFact[] = [
      fact('source', 'From', input.townName),
      fact('destination', 'Destination', input.destinationName),
      fact('status', 'Status', input.endReason === 'declined' ? 'declined' : input.status),
      fact('paid', 'Paid', input.paidText ?? '0'),
    ];
    if (input.lastQuantity != null) facts.push(fact('delivered', 'Delivered', String(input.lastQuantity)));
    if (input.bonusText) facts.push(fact('bonus', 'Earned', input.bonusText, 'good'));
    return {
      key: input.key, source: 'delivery', mode: 'receipt', heading: input.goodName, speaker: input.speaker,
      media: 'market', line: lineOf(sceneId, tokens), facts, actions: [], error: input.error ?? '',
    };
  }
  const facts = [
    fact('source', 'From', input.townName),
    fact('destination', 'Destination', input.destinationName),
    fact('delivered', 'Delivered', `${input.delivered} / ${input.target}`),
    fact('time', 'Time', input.timeText),
  ];
  let sceneId = 'delivery-request';
  let actions: StoryAction[] = [];
  if (input.kind === 'courier') {
    if (!input.accepted) {
      sceneId = 'courier-request';
      actions = [
        action('courier-accept', !input.writable, !input.writable ? readOnly : ''),
        action('courier-decline', !input.writable, !input.writable ? readOnly : ''),
      ];
    } else {
      sceneId = 'courier-accepted';
      actions = [action('show-route', false, '', 'navigate')];
    }
  }
  return {
    key: input.key, source: 'delivery', mode: 'decision', heading: input.goodName, speaker: input.speaker,
    media: 'market', line: lineOf(sceneId, tokens), facts, actions, error: input.error ?? '',
  };
}

export interface RoadStoryInput {
  key: string;
  atSec: number;
  text: string;
  resourceDeltas?: readonly { id: string; count: number; name?: string }[];
  hungerDelta?: number;
  error?: string;
}

export function roadStoryView(input: RoadStoryInput): StoryView {
  const facts: StoryFact[] = [];
  for (const entry of input.resourceDeltas ?? []) {
    if (entry.count > 0) facts.push(fact(`earned-${entry.id}`, 'Earned', `${entry.count} ${entry.name ?? entry.id}`, 'good'));
    else facts.push(fact('bag-full', 'Result', 'The food bag is full', 'muted'));
  }
  if (input.hungerDelta) facts.push(fact('hunger', 'Hunger', `+${Math.round(input.hungerDelta)}`, 'good'));
  facts.push(fact('result', 'Result', input.text, 'muted'));
  return {
    key: input.key, source: 'journey', mode: 'receipt', heading: labelOf('road-title'), speaker: 'Narrator',
    media: 'trail', line: lineOf('road-result'), facts, actions: [], error: input.error ?? '',
  };
}

export interface SiteStoryInput {
  key: string;
  mode: 'inspect' | 'result';
  siteName: string;
  text?: string;
  resourceDeltas?: readonly { id: string; count: number; name?: string }[];
  hungerDelta?: number;
  error?: string;
}

export function siteStoryView(input: SiteStoryInput): StoryView {
  if (input.mode === 'result') {
    const facts: StoryFact[] = [];
    for (const entry of input.resourceDeltas ?? []) facts.push(fact(`earned-${entry.id}`, 'Earned', `${entry.count} ${entry.name ?? entry.id}`, 'good'));
    if (input.hungerDelta) facts.push(fact('hunger', 'Hunger', `+${Math.round(input.hungerDelta)}`, 'good'));
    if (input.text) facts.push(fact('result', 'Result', input.text, 'muted'));
    return {
      key: input.key, source: 'exploration', mode: 'receipt', heading: input.siteName, speaker: 'Narrator',
      media: 'discovery', line: lineOf('site-result'), facts, actions: [], error: input.error ?? '',
    };
  }
  return {
    key: input.key, source: 'exploration', mode: 'decision', heading: input.siteName, speaker: 'Narrator',
    media: 'discovery', line: lineOf('site-inspect'), facts: [], actions: [], error: input.error ?? '',
  };
}

export interface DungeonStoryInput {
  key: string;
  entry?: { left: number; total: number; active: boolean; cooldownText?: string } | null;
  receipt?: {
    reason: string;
    kept: readonly { id: string; count: number; name?: string; bucket: string }[];
    forfeited: readonly { id: string; count: number; name?: string; bucket: string }[];
    uncollected: readonly { id: string; count: number; name?: string; bucket: string }[];
    gear: { processed: number; retained: number; salvaged: number; rejected: number; forfeited: number };
  } | null;
  error?: string;
}

export function dungeonStoryView(input: DungeonStoryInput): StoryView {
  if (input.receipt) {
    const facts: StoryFact[] = [
      ...input.receipt.kept.map((entry, index) => fact(`kept-${index}`, 'Earned', `${entry.count} ${entry.name ?? entry.id}`, 'good')),
      ...input.receipt.forfeited.map((entry, index) => fact(`forfeited-${index}`, 'Forfeited', `${entry.count} ${entry.name ?? entry.id}`, 'loss')),
      ...input.receipt.uncollected.map((entry, index) => fact(`uncollected-${index}`, 'Uncollected', `${entry.count} ${entry.name ?? entry.id}`, 'loss')),
      fact('gear-retained', 'Retained', String(input.receipt.gear.retained)),
      fact('gear-processed', 'Processed', String(input.receipt.gear.processed)),
      fact('gear-salvaged', 'Salvaged', String(input.receipt.gear.salvaged), 'muted'),
      fact('gear-rejected', 'Rejected', String(input.receipt.gear.rejected), 'muted'),
      fact('gear-forfeited', 'Forfeited', String(input.receipt.gear.forfeited), 'loss'),
    ];
    return {
      key: input.key, source: 'dungeon', mode: 'receipt', heading: labelOf('dungeon-title'), speaker: 'Narrator',
      media: 'dungeon', line: lineOf('dungeon-result'), facts, actions: [], error: input.error ?? '',
    };
  }
  const facts: StoryFact[] = [];
  if (input.entry) facts.push(fact('mobs', 'Mobs left', `${input.entry.left} / ${input.entry.total}`));
  if (input.entry?.cooldownText) facts.push(fact('cooldown', 'Time', input.entry.cooldownText));
  return {
    key: input.key, source: 'dungeon', mode: 'decision', heading: labelOf('dungeon-title'), speaker: 'Narrator',
    media: 'dungeon', line: lineOf('dungeon-entry'), facts, actions: [], error: input.error ?? '',
  };
}

export interface MarketStoryInput {
  key: string;
  seed: number;
  townId: string;
  npcId: string;
  speaker: string;
  townName: string;
  cycle: number;
  contextKey: string;
  latestResult?: { text: string; goldText: string } | null;
  promotion?: { itemName: string; goldText: string; normalText: string; savingsText: string; remainingText: string } | null;
  selectedGood?: { goodName: string; quoteText: string; bestTownName?: string } | null;
  error?: string;
}

export function marketStoryView(input: MarketStoryInput): StoryView {
  const lineIndex = storyHash32(`${input.seed}|${input.townId}|${input.npcId}|${input.contextKey}|${input.cycle}`) % 3;
  if (input.latestResult) {
    return {
      key: input.key, source: 'market', mode: 'receipt', heading: input.townName, speaker: input.speaker,
      media: 'market', line: input.latestResult.text,
      facts: [fact('earned', 'Earned', input.latestResult.goldText, 'good')], actions: [], error: input.error ?? '',
    };
  }
  if (input.promotion) {
    return {
      key: input.key, source: 'market', mode: 'greeting', heading: input.townName, speaker: input.speaker,
      media: 'market', line: lineOf('market-promotion', { item: input.promotion.itemName }),
      facts: [
        fact('normal', 'Normal price', input.promotion.normalText),
        fact('cost', 'Cost', input.promotion.goldText, 'loss'),
        fact('savings', 'Savings', input.promotion.savingsText, 'good'),
        fact('time', 'Time', input.promotion.remainingText),
      ],
      actions: [], error: input.error ?? '',
    };
  }
  if (input.selectedGood) {
    const facts = [fact('quote', 'Quote', input.selectedGood.quoteText)];
    if (input.selectedGood.bestTownName) facts.push(fact('best', 'Best buyer', input.selectedGood.bestTownName));
    return {
      key: input.key, source: 'market', mode: 'greeting', heading: input.townName, speaker: input.speaker,
      media: 'market', line: lineOf('market-route', { good: input.selectedGood.goodName }), facts, actions: [], error: input.error ?? '',
    };
  }
  return {
    key: input.key, source: 'market', mode: 'greeting', heading: input.townName, speaker: input.speaker,
    media: 'market', line: lineOf('market-greeting', {}, lineIndex), facts: [], actions: [], error: input.error ?? '',
  };
}

export interface ForgeStoryInput {
  key: string;
  seed: number;
  townId: string;
  npcId: string;
  speaker: string;
  cycle: number;
  contextKey: string;
  patternName?: string;
  materialName?: string;
  valid?: boolean;
  why?: string;
  resultItem?: string;
  held?: number;
  costText?: string;
  bandText?: string;
  error?: string;
}

export function forgeStoryView(input: ForgeStoryInput): StoryView {
  const lineIndex = storyHash32(`${input.seed}|${input.townId}|${input.npcId}|${input.contextKey}|${input.cycle}`) % 3;
  if (input.resultItem) {
    return {
      key: input.key, source: 'forge', mode: 'receipt', heading: input.patternName ?? 'Forge', speaker: input.speaker,
      media: 'forge', line: lineOf('forge-result', { item: input.resultItem }),
      facts: [fact('earned', 'Earned', input.resultItem, 'good'), ...(input.costText ? [fact('cost', 'Paid', input.costText, 'loss')] : [])],
      actions: [], error: input.error ?? '',
    };
  }
  if (input.valid && input.patternName && input.materialName) {
    const facts = [fact('cost', 'Cost', input.costText ?? `${input.held ?? 0} ${input.materialName}`, 'loss')];
    if (input.bandText) facts.push(fact('band', 'Resulting band', input.bandText));
    return {
      key: input.key, source: 'forge', mode: 'greeting', heading: input.patternName, speaker: input.speaker,
      media: 'forge', line: lineOf('forge-ready', { material: input.materialName, pattern: input.patternName }),
      facts, actions: [], error: input.error ?? '',
    };
  }
  if (input.patternName && input.materialName && !input.valid) {
    return {
      key: input.key, source: 'forge', mode: 'greeting', heading: input.patternName, speaker: input.speaker,
      media: 'forge', line: lineOf('forge-blocked', { pattern: input.patternName }),
      facts: [fact('reason', 'Reason', input.why ?? 'not ready', 'loss')], actions: [], error: input.error ?? '',
    };
  }
  return {
    key: input.key, source: 'forge', mode: 'greeting', heading: input.patternName ?? 'Forge', speaker: input.speaker,
    media: 'forge', line: lineOf('forge-greeting', {}, lineIndex), facts: [], actions: [], error: input.error ?? '',
  };
}
