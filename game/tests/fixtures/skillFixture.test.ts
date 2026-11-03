import { describe, expect, it } from 'vitest';
import { sm } from '../../src/engine/client';
import { installSkillFixture, installSyntheticSkill } from './skillFixture';

/**
 * Registry hygiene for installed test rows (plan §3): installing never mutates
 * shared fixture data, restore brings back the exact prior key state, and a
 * throw inside the test body still restores via `finally`.
 */

describe('skill fixture registry', () => {
  it('restores a pre-existing row, value and key alike', () => {
    const id = 'test.registry-kept';
    const marker = { id, name: 'Prior Row' } as never;
    sm.byId[id] = marker;
    const installed = installSyntheticSkill(id, { name: 'Overlay Fixture' });
    expect(sm.byId[id]).not.toBe(marker);
    installed.restore();
    expect(sm.byId[id]).toBe(marker);
    delete sm.byId[id];
  });

  it('hands out a fresh copy on every install', () => {
    const first = installSkillFixture('test.cluster_burst');
    (first.row.effects as unknown[]).push({ stat: 'hits', op: 'add_flat', value: 99, subject: 'self' });
    first.restore();
    const second = installSkillFixture('test.cluster_burst');
    expect(second.row.effects).toHaveLength(0);
    second.restore();
    expect(sm.byId['test.cluster_burst']).toBeUndefined();
  });

  it('restores through a throw inside try/finally', () => {
    const installed = installSyntheticSkill('test.registry-throw', { name: 'Throw Fixture' });
    expect(() => {
      try {
        throw new Error('scenario failure');
      } finally {
        installed.restore();
      }
    }).toThrow('scenario failure');
    expect(sm.byId['test.registry-throw']).toBeUndefined();
  });

  it('keeps a synthetic install invisible to the rest of the suite', () => {
    const installed = installSyntheticSkill('test.registry-solo', { name: 'Solo Fixture' });
    expect(sm.byId['test.registry-solo'].name).toBe('Solo Fixture');
    installed.restore();
    expect('test.registry-solo' in sm.byId).toBe(false);
  });

  it('does not share over.effects reference with caller', () => {
    const over: any = { effects: [{ stat: 'hits', op: 'add_flat', value: 1, subject: 'self' }], cast: { delivery: 'melee', range_m: 2, windup_sec: 0.1, recovery_sec: 0.1 } };
    const installed = installSkillFixture('test.cluster_burst', over);
    expect(installed.row.effects).not.toBe(over.effects);
    expect(installed.row.cast).not.toBe(over.cast);
    // mutate installed should not affect over
    (installed.row.effects as any).push({ stat: 'hits', op: 'add_flat', value: 99, subject: 'self' });
    expect(over.effects).toHaveLength(1);
    installed.restore();
    const second = installSkillFixture('test.cluster_burst', over);
    expect(second.row.effects).toHaveLength(1);
    second.restore();
  });

  it('mutate installed row does not taint next install with same over', () => {
    const over: any = { effects: [{ stat: 'hits', op: 'add_flat', value: 2, subject: 'self' }] };
    const first = installSkillFixture('test.cluster_burst', over);
    (first.row.effects as any)[0].value = 999;
    first.restore();
    const second = installSkillFixture('test.cluster_burst', over);
    expect((second.row.effects as any)[0].value).toBe(2);
    second.restore();
    expect(over.effects[0].value).toBe(2);
  });

  it('deletes only key it created and restores prior', () => {
    const id = 'test.registry-delete';
    const marker = { id, name: 'Prior' } as never;
    sm.byId[id] = marker;
    const over = installSyntheticSkill(id, { name: 'Overlay2' } as any);
    expect(sm.byId[id]).not.toBe(marker);
    over.restore();
    expect(sm.byId[id]).toBe(marker);
    delete sm.byId[id];
    const fresh = installSyntheticSkill(id, { name: 'Fresh' } as any);
    expect(sm.byId[id].name).toBe('Fresh');
    fresh.restore();
    expect(id in sm.byId).toBe(false);
  });

  it('restore twice is idempotent and duplicate install throws', () => {
    const a = installSyntheticSkill('test.registry-dup', { name: 'A' });
    expect(() => installSyntheticSkill('test.registry-dup', { name: 'B' })).toThrow();
    a.restore();
    a.restore();
    expect('test.registry-dup' in sm.byId).toBe(false);
    const b = installSyntheticSkill('test.registry-dup', { name: 'B' });
    expect(sm.byId['test.registry-dup'].name).toBe('B');
    b.restore();
  });

  it('restores through async throw and rejected promise', async () => {
    const installed = installSyntheticSkill('test.registry-async', { name: 'Async' });
    try {
      await Promise.reject(new Error('async fail'));
    } catch {
      installed.restore();
    }
    expect('test.registry-async' in sm.byId).toBe(false);

    const installed2 = installSyntheticSkill('test.registry-async2', { name: 'Async2' });
    expect(() => {
      try {
        throw new Error('sync in async');
      } finally {
        installed2.restore();
      }
    }).toThrow('sync in async');
    expect('test.registry-async2' in sm.byId).toBe(false);
  });

  it('isolates synthetic installs', () => {
    const a = installSyntheticSkill('test.registry-iso-a', { name: 'A', base_flat: 1 });
    const b = installSyntheticSkill('test.registry-iso-b', { name: 'B', base_flat: 2 });
    (a.row as any).base_flat = 999;
    expect((b.row as any).base_flat).toBe(2);
    a.restore(); b.restore();
    expect('test.registry-iso-a' in sm.byId).toBe(false);
    expect('test.registry-iso-b' in sm.byId).toBe(false);
  });
});
