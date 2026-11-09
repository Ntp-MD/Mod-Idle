import { describe, expect, it } from 'vitest';
import {
  campStoryView, deliveryStoryView, roadStoryView, siteStoryView,
  dungeonStoryView, marketStoryView, forgeStoryView,
} from '../../src/ui/story/story-presenters';

describe('story presenters', () => {
  it('maps a camp warning to the shared decision view and never mutates its input', () => {
    const input = {
      key: 'camp:1:0:warning', kind: 'sounds', stage: 'warning', sceneId: 'sounds-signs', lineIndex: 1,
      speciesName: 'Goblin', writable: true,
    } as const;
    const before = JSON.stringify(input);
    const view = campStoryView(input);
    expect(view).toMatchObject({ source: 'camp', mode: 'decision', heading: 'Movement near Camp', speaker: 'Narrator', media: 'camp' });
    expect(view.line).toBe('A silhouette stops at the edge of the firelight.');
    expect(view.actions.map((entry) => entry.id)).toEqual(['investigate', 'quiet']);
    expect(JSON.stringify(input)).toBe(before);
    expect(campStoryView(input)).toEqual(view);
  });

  it('marks cache quick unavailable without revealing the outcome when food is short', () => {
    const cache = { foodId: 'river-fish', materialId: 'ore', carefulSec: 120, quickOutcome: 'gain' };
    const preview = { timeSec: 120, maxFoodLoss: 2, outcomes: [{ id: 'gain', chance: 0.5, materialCount: 2, foodLoss: 0 }, { id: 'loss', chance: 0.25, materialCount: 0, foodLoss: 2 }] };
    const view = campStoryView({
      key: 'camp:2:0:choice', kind: 'supply-cache', stage: 'choice', sceneId: 'cache-ledge', lineIndex: 0,
      materialName: 'Ore', foodName: 'River Fish', cache, cachePreview: preview, foodHeld: 1, writable: true,
    });
    expect(view.actions.find((entry) => entry.id === 'cache-quick')).toMatchObject({ disabled: true });
    expect(view.facts.find((entry) => entry.label === 'Maximum loss')?.value).toBe('2 River Fish');
    expect(view.line).not.toContain('gain');
  });

  it('renders camp receipts from actual paid/earned/lost buckets', () => {
    const view = campStoryView({
      key: 'camp:receipt:3:cache-quick', kind: 'supply-cache', stage: 'combat', sceneId: 'cache-mixed-result', lineIndex: 0,
      writable: true,
      receipt: { action: 'cache-quick', sceneId: 'cache-mixed-result', elapsedSec: 0, paid: [], earned: [{ id: 'ore', count: 1 }], lost: [{ id: 'river-fish', count: 1 }], info: [] },
    });
    expect(view.mode).toBe('receipt');
    expect(view.facts).toContainEqual(expect.objectContaining({ label: 'Earned', value: '1 ore', tone: 'good' }));
    expect(view.facts).toContainEqual(expect.objectContaining({ label: 'Lost', value: '1 river-fish', tone: 'loss' }));
  });

  it('leaves the combat stage to the ordinary fight controls', () => {
    const view = campStoryView({
      key: 'camp:combat', kind: 'prowler', stage: 'combat', sceneId: 'prowler-edge', lineIndex: 0,
      writable: true,
    });
    expect(view.actions).toEqual([]);
  });

  it('formats a receipt from a scene whose line carries a token', () => {
    const view = campStoryView({
      key: 'camp:receipt:9', kind: 'prowler', stage: 'combat', sceneId: 'prowler-edge', lineIndex: 0,
      writable: true,
      receipt: { action: 'quiet', sceneId: 'prowler-edge', elapsedSec: 0, paid: [], earned: [], lost: [], info: [] },
    });
    expect(view.line).toBe('A nearby creature circles the supplies, keeping beyond the fire.');
  });

  it('separates local and courier delivery contexts', () => {
    const local = deliveryStoryView({
      key: 'delivery:1', status: 'open', kind: 'request', accepted: false, goodName: 'Copper Ore',
      townName: 'Eastgate', destinationName: 'Eastgate', speaker: 'Steward', target: 5, delivered: 2,
      timeText: '10m left', writable: true,
    });
    expect(local.line).toBe('Eastgate needs Copper Ore. Bring what you can before the request ends.');
    expect(local.actions).toEqual([]);
    const courier = deliveryStoryView({
      key: 'delivery:courier', status: 'open', kind: 'courier', accepted: false, goodName: 'Timber',
      townName: 'Eastgate', destinationName: 'Westford', speaker: 'Armourer', target: 3, delivered: 0,
      timeText: '20m left', writable: true,
    });
    expect(courier.line).toBe('Westford needs Timber. Will you take this request from Eastgate to them?');
    expect(courier.actions.map((entry) => entry.id)).toEqual(['courier-accept', 'courier-decline']);
  });

  it('reflects road, site and dungeon receipts as read-only results', () => {
    const road = roadStoryView({ key: 'road:1', atSec: 10, text: 'Found food', resourceDeltas: [{ id: 'river-fish', count: 0 }], hungerDelta: 0 });
    expect(road.mode).toBe('receipt');
    expect(road.facts).toContainEqual(expect.objectContaining({ label: 'Result', value: 'The food bag is full' }));
    const site = siteStoryView({ key: 'site:1', mode: 'result', siteName: 'Shallow Cache', text: 'Hunger 90%', hungerDelta: 5 });
    expect(site.facts).toContainEqual(expect.objectContaining({ label: 'Hunger' }));
    const dungeon = dungeonStoryView({
      key: 'dungeon:x', receipt: {
        reason: 'retreated', kept: [{ bucket: 'stone', id: 'tier', count: 1, name: 'Tier stone' }],
        forfeited: [{ bucket: 'junk', id: 'junk', count: 2, name: 'junk' }], uncollected: [],
        gear: { processed: 1, retained: 1, salvaged: 0, rejected: 0, forfeited: 2 },
      },
    });
    expect(dungeon.facts).toContainEqual(expect.objectContaining({ label: 'Forfeited', tone: 'loss' }));
    expect(dungeon.actions).toEqual([]);
  });

  it('keeps market and forge greetings deterministic and receipt-first', () => {
    const market = { key: 'm', seed: 7, townId: 'eastgate', npcId: 'counterhand', speaker: 'Counterhand', townName: 'Eastgate', cycle: 0, contextKey: 'greeting' };
    expect(marketStoryView(market)).toEqual(marketStoryView(market));
    expect(marketStoryView({ ...market, latestResult: { text: 'Sold', goldText: '10 gold' } }).mode).toBe('receipt');
    const forge = { key: 'f', seed: 7, townId: 'eastgate', npcId: 'armourer', speaker: 'Armourer', cycle: 0, contextKey: 'plan', patternName: 'Helmet', materialName: 'Copper', valid: false, why: 'needs 2 Copper' };
    const blocked = forgeStoryView(forge);
    expect(blocked.mode).toBe('greeting');
    expect(blocked.facts).toContainEqual(expect.objectContaining({ label: 'Reason' }));
    expect(forgeStoryView({ ...forge, resultItem: 'Copper Helmet' }).mode).toBe('receipt');
  });
});
