import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, readSettings } from '../../src/state/save';

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('client settings compatibility', () => {
  it('starts from defaults when an older settings blob has no effect level', async () => {
    store.set('modworld:settings', JSON.stringify({ numberFormat: 'short', autoSkills: false }));
    await expect(readSettings()).resolves.toMatchObject({
      numberFormat: 'short', autoSkills: false, combatEffects: DEFAULT_SETTINGS.combatEffects,
    });
  });

  it.each(['', 'loud', 'FULL', null])('falls back to Automatic for an unknown effect level %s', async (combatEffects) => {
    store.set('modworld:settings', JSON.stringify({ numberFormat: 'short', combatEffects }));
    await expect(readSettings()).resolves.toMatchObject({ numberFormat: 'short', combatEffects: 'auto' });
  });

  it('keeps a known explicit effect level', async () => {
    store.set('modworld:settings', JSON.stringify({ combatEffects: 'minimal' }));
    await expect(readSettings()).resolves.toMatchObject({ combatEffects: 'minimal' });
  });

  it('drops the retired battlefield style so live play stays ARPG-only', async () => {
    store.set('modworld:settings', JSON.stringify({ battlefieldStyle: 'classic', combatEffects: 'auto' }));
    const settings = await readSettings();
    expect(settings).not.toHaveProperty('battlefieldStyle');
  });
});
