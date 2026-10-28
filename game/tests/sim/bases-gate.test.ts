import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { checks } from '../../../tools/bases.ts';

/**
 * The Bases cage gates a file, but the gate must be provable: a structure that is broken has to
 * FAIL, and the proof runs on a copy — the real `tools/data/bases.json` is never touched.
 */

const readBases = (): any =>
  JSON.parse(readFileSync(new URL('../../../tools/data/bases.json', import.meta.url), 'utf8'));

/** The verdict of one gate. */
const verdict = (rows: { id: string; verdict: string }[], id: string): string | undefined =>
  rows.find((r) => r.id === id)?.verdict;

describe('the Bases cage gates the structure of the file it reads', () => {
  it('passes on the real file', () => {
    const rows = checks(readBases());
    expect(rows.filter((r) => r.verdict === 'FAIL')).toEqual([]);
  });

  it('gives every gate its own id', () => {
    const ids = checks(readBases()).map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('fails when the weapon table is empty', () => {
    const broken = readBases();
    broken.weapons = [];
    const rows = checks(broken);
    expect(verdict(rows, 'BS5')).toBe('FAIL');
    expect(verdict(rows, 'BS6')).toBe('FAIL');
  });

  it('fails when a weapon row disagrees with engine.json', () => {
    const broken = readBases();
    broken.weapons[0].weapon_aspd = 9.99;
    expect(verdict(checks(broken), 'BS6')).toBe('FAIL');
  });

  it('fails when an armour slot stops covering the three defence lines', () => {
    const broken = readBases();
    const helmet = broken.bases.find((b: any) => b.slot === 'helmet');
    helmet.base_lines = ['armour_flat'];
    expect(verdict(checks(broken), 'BS11')).toBe('FAIL');
  });

  it('fails when a weapon type has no named Mod pool', () => {
    const broken = readBases();
    broken.weapon_pools['main hand'][broken.weapons[0].name] = [];
    expect(verdict(checks(broken), 'BS14')).toBe('FAIL');
  });

  it('leaves the file it was given untouched', () => {
    const doc = readBases();
    const before = JSON.stringify(doc);
    checks(doc);
    expect(JSON.stringify(doc)).toBe(before);
  });
});
