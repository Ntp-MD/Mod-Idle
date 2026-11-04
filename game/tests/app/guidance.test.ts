import { describe, expect, it } from 'vitest';
import { newGame } from '@sim/core/game';
import { forge } from '@sim/gear/forge';
import { fieldwork } from '../../src/engine/client';
import {
  guidanceNotices, materialSourceFor, newGuidance, nextGoal, normalizeGuidance, recommendGoal, resolveGoal, setTrackedGoal,
} from '@sim/core/guidance';
import { migrate } from '../../src/state/save';
import { slotsAvailable } from '@sim/gear/slots';

const forgeFixture = () => {
  const pattern = forge.patternOf('armour', 'helmet')!;
  const family = forge.familiesFor(pattern.kind, pattern.id)[0];
  const material = forge.materialsFor(family)[0];
  return { pattern, material };
};

describe('guidance goals', () => {
  it('starts a character with no pin', () => {
    expect(newGame().guidance).toEqual(newGuidance());
  });

  it('reads a forge goal from the live material count', () => {
    const state = newGame();
    const { pattern, material } = forgeFixture();
    const ref = { kind: 'forge' as const, patternKind: 'armour' as const, pattern: pattern.id, material: material.id };
    setTrackedGoal(state, ref);
    state.fieldwork.materials[material.id] = pattern.count - 1;
    const view = resolveGoal(state, ref);
    expect(view.title).toContain(pattern.name);
    expect(view.progress).toBe(`${pattern.count - 1}/${pattern.count} ${fieldwork.materialById[material.id].name}`);
    expect(view.reason).toContain('Need 1 more');
    expect(view.sources.some((source) => source.zones.length > 0 || source.pins.length === 0)).toBe(true);
  });

  it('marks a forge goal stale instead of sending the player elsewhere', () => {
    const state = newGame();
    const ref = { kind: 'forge' as const, patternKind: 'armour' as const, pattern: 'not-a-pattern', material: 'iron-ore' };
    setTrackedGoal(state, ref);
    expect(nextGoal(state)?.view.status).toBe('stale');
    expect(nextGoal(state)?.source).toBe('tracked');
  });

  it('keeps the player pin ahead of the automatic tree suggestion', () => {
    const state = newGame();
    const { pattern, material } = forgeFixture();
    const ref = { kind: 'forge' as const, patternKind: 'armour' as const, pattern: pattern.id, material: material.id };
    setTrackedGoal(state, ref);
    state.player.treePoints = 3;
    expect(recommendGoal(state)).toEqual({ kind: 'tree' });
    expect(nextGoal(state)?.source).toBe('tracked');
    expect(nextGoal(state)?.view.kind).toBe('forge');
  });

  it('tracks a missing material back to the recipe that needs it', () => {
    const state = newGame();
    const { pattern, material } = forgeFixture();
    const origin = { kind: 'forge' as const, patternKind: 'armour' as const, pattern: pattern.id, material: material.id };
    const ref = { kind: 'shortage' as const, good: `material:${material.id}`, want: pattern.count, origin };
    state.fieldwork.materials[material.id] = 0;
    setTrackedGoal(state, ref);
    const view = resolveGoal(state, ref);
    expect(view.progress).toBe(`0/${pattern.count}`);
    expect(view.reason).toContain('Need');
    expect(view.target).toEqual(origin);
    expect(view.action).toBe('forge');
  });

  it('reports a completed shortage without rerouting the action', () => {
    const state = newGame();
    const { pattern, material } = forgeFixture();
    const origin = { kind: 'forge' as const, patternKind: 'armour' as const, pattern: pattern.id, material: material.id };
    const ref = { kind: 'shortage' as const, good: `material:${material.id}`, want: pattern.count, origin };
    state.fieldwork.materials[material.id] = pattern.count;
    const view = resolveGoal(state, ref);
    expect(view.status).toBe('complete');
    expect(view.action).toBe('forge');
  });

  it('names a field source with map pins', () => {
    const sources = materialSourceFor('iron-ore');
    expect(sources.some((source) => source.pins.some((pin) => pin.label.length > 0))).toBe(true);
    expect(sources.every((source) => source.zones.length === source.pins.length)).toBe(true);
  });

  it('routes a workshop shortage back to the Market workshop', () => {
    const state = newGame();
    const recipe = (fieldwork as any).workshopRecipes[0];
    const [material, need] = Object.entries(recipe.materials as Record<string, number>)[0];
    state.fieldwork.materials[material] = 0;
    const origin = { kind: 'workshop' as const, recipe: recipe.id };
    const ref = { kind: 'shortage' as const, good: `material:${material}`, want: need, origin };
    setTrackedGoal(state, ref);
    const view = resolveGoal(state, ref);
    expect(view.action).toBe('market');
    expect(view.target).toEqual(origin);
    expect(view.reason).toContain('Need');
  });

  it('puts save and read-only problems ahead of goals', () => {
    const state = newGame();
    setTrackedGoal(state, { kind: 'forge', patternKind: 'armour', pattern: 'not-a-pattern', material: 'iron-ore' });
    const notices = guidanceNotices(state, { storageError: true, writerState: 'readonly' });
    expect(notices[0].id).toBe('storage-error');
    expect(notices[1].id).toBe('writer');
    expect(notices.some((notice) => notice.id === 'stale-goal')).toBe(true);
  });

  it('shows the startup choice and the unsaved-character notice between writer trouble and goals', () => {
    const state = newGame();
    setTrackedGoal(state, { kind: 'forge', patternKind: 'armour', pattern: 'not-a-pattern', material: 'iron-ore' });
    const startup = guidanceNotices(state, { startup: true });
    expect(startup[0]).toMatchObject({ id: 'startup', kind: 'decision', title: 'Choose a character' });
    expect(startup[0].detail).toBe('Load a character, or start a new one. Existing slots are kept.');
    const unsaved = guidanceNotices(state, { unsaved: true, writerState: 'readonly' });
    expect(unsaved[0].id).toBe('writer');
    expect(unsaved[1]).toMatchObject({ id: 'unsaved', title: 'Not saved yet.' });
    expect(unsaved[1].detail).toBe('Choose a slot to keep this character.');
    expect(unsaved.some((notice) => notice.id === 'stale-goal')).toBe(true);
  });
});

describe('guidance save shape', () => {
  it('drops a malformed pin and keeps a valid one', () => {
    const state = newGame();
    (state as any).guidance = { tracked: { kind: 'destination', q: 1, r: 2, label: 'Eastgate' } };
    expect(migrate(JSON.parse(JSON.stringify(state)), 21).guidance?.tracked).toEqual({ kind: 'destination', q: 1, r: 2, label: 'Eastgate' });
    (state as any).guidance = { tracked: { kind: 'forge', pattern: 3 } };
    expect(migrate(JSON.parse(JSON.stringify(state)), 21).guidance?.tracked).toBeNull();
  });

  it('backfills an older save with no pin', () => {
    const state = newGame() as any;
    delete state.guidance;
    expect(migrate(JSON.parse(JSON.stringify(state)), 20).guidance).toEqual(newGuidance());
  });

  it('normalizes unknown refs to no pin', () => {
    expect(normalizeGuidance({ tracked: { kind: 'nonsense' } })).toEqual(newGuidance());
  });

  it('names the deposit settlement from the field, never undefined', () => {
    const state = newGame();
    state.cell = { q: 2, r: 0, sub: null, site: null };
    state.bag = Array.from({ length: slotsAvailable(state) }, (_, i) => ({
      slot: 'ring', base: `Keep ${i}`, ilvl: 1, quality: 'low', tier: 'T1', lines: [],
    })) as never;
    const ref = recommendGoal(state);
    expect(ref?.kind).toBe('destination');
    const label = (ref as { label?: unknown }).label;
    expect(typeof label === 'string' && label.length).toBeTruthy();
    const view = resolveGoal(state, ref!);
    expect(view.title).toContain(label as string);
    expect(view.title).not.toContain('undefined');
    expect(normalizeGuidance({ tracked: ref }).tracked).toEqual(ref);
  });
});
