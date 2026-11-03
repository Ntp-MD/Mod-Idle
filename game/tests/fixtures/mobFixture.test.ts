import { describe, expect, it } from 'vitest';
import { mobFixture } from './mobFixture';
import { E } from '../../src/engine/client';

describe('mob fixture isolation (C)', () => {
  it('uses explicit speciesId without calling live fallback', () => {
    const m = mobFixture({ speciesId: 'test.explicit-species', species: 'Explicit' });
    expect(m.speciesId).toBe('test.explicit-species');
    expect(m.species).toBe('Explicit');
    // Should not throw even if roster has no ordinary proximity
    // Change roster order simulation: ensure not reading live
    const speciesIds = (E.mob.species as any[]).map((s) => s.id);
    expect(speciesIds).toContain('wolf');
  });

  it('default fixture does not depend on live roster', () => {
    const a = mobFixture();
    const b = mobFixture();
    expect(a.speciesId).toBe('test.fixture-species');
    expect(b.speciesId).toBe('test.fixture-species');
    // Mutate one, other unchanged
    a.speciesId = 'mutated';
    expect(b.speciesId).toBe('test.fixture-species');
  });

  it('nested state is fresh per fixture', () => {
    const a = mobFixture({ skillReadyAtUs: { 'test.skill': 123 }, innate: ['fire'] });
    const b = mobFixture({ skillReadyAtUs: { 'test.skill': 123 }, innate: ['fire'] });
    expect(a.skillReadyAtUs).not.toBe(b.skillReadyAtUs);
    expect(a.innate).not.toBe(b.innate);
    a.innate.push('cold');
    expect(b.innate).toEqual(['fire']);
    (a.skillReadyAtUs as any)['test.skill'] = 999;
    expect((b.skillReadyAtUs as any)['test.skill']).toBe(123);
  });

  it('mutating one fixture does not affect another', () => {
    const m1 = mobFixture({ id: 'm1', hp: 100 });
    const m2 = mobFixture({ id: 'm2', hp: 100 });
    m1.hp = 1;
    m1.innate = ['cold'];
    expect(m2.hp).toBe(100);
    expect(m2.innate).toEqual(['fire']);
  });

  it('explicit species order change does not affect synthetic default', () => {
    const first = (E.mob.species[0] as any).id;
    const m = mobFixture({ id: 'm-order', speciesId: 'test.custom-order' });
    expect(m.speciesId).toBe('test.custom-order');
    // Default still synthetic, not first roster id
    const def = mobFixture();
    expect(def.speciesId).not.toBe(first);
    expect(def.speciesId).toBe('test.fixture-species');
  });
});
