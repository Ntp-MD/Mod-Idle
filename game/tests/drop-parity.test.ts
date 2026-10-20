import { describe, it, expect } from 'vitest';
import { mulberry32 } from '../../engine/loot.ts';
import { rollItem, LOOT, BASES_JSON } from '../../tools/loot.ts';
import { rollDrop } from '../src/sim/drop';
import { loot, BASES } from '../src/engine/client';
import { CAGE_REFERENCE, CLIENT_REFERENCE } from './dropReference';

/**
 * The drop roll, proved against the reference captured before the shared builder existed.
 *
 * The cage (`tools/loot.ts`) and the client (`game/src/sim/drop.ts`) each rolled their own lines.
 * They now share one builder in `engine/loot.ts`, so the proof cannot be "both call the same
 * helper" — it is the reference: every item each path rolled before the change, and the stream
 * position it left behind.
 */

/** One line, as the reference records it. */
const line = (l: any): string =>
  `${l.id}=${l.value}@${l.slice}` + (l.element ? `:${l.element}` : '') + (l.stat ? `/${l.stat}` : '')
  + (l.extra?.length ? `{${l.extra.map((x: any) => `${x.id}=${x.value}`).join('+')}}` : '');

const lines = (item: any): string => item.lines.map(line).join(',');

const CAGE_SEEDS = [1, 20260101];
const CAGE_BANDS = ['low', 'mid', 'high', 'high_full_lck'];
const CAGE_ITEMS = 20;
const CLIENT_SEEDS = [1, 20260101];
const CLIENT_BANDS = ['low', 'mid', 'high', 'high_full_lck'];
const CLIENT_ILVLS = [1, 90];
const CLIENT_ITEMS = 15;

describe('the cage roll is the roll the reference recorded', () => {
  it('rolls every item the reference holds, and leaves the stream where it was', () => {
    const now: string[] = [];
    for (const seed of CAGE_SEEDS) {
      for (const band of CAGE_BANDS) {
        const rng = mulberry32(seed);
        for (let i = 0; i < CAGE_ITEMS; i++) {
          const item = rollItem(rng, band, null);
          now.push(`${seed} ${band} ${item.slot}|${item.base}|${item.ilvl}|${item.q}|${item.tier}|${lines(item)}`);
        }
        now.push(`${seed} ${band} next ${rng()}`);
      }
    }
    expect(now).toEqual(CAGE_REFERENCE);
  });
});

describe('the client roll is the roll the reference recorded', () => {
  it('rolls every item the reference holds, and leaves the stream where it was', () => {
    const now: string[] = [];
    for (const seed of CLIENT_SEEDS) {
      for (const band of CLIENT_BANDS) {
        for (const ilvl of CLIENT_ILVLS) {
          const rng = mulberry32(seed);
          for (let i = 0; i < CLIENT_ITEMS; i++) {
            const item = rollDrop(rng, band, ilvl);
            now.push(`${seed} ${band} ${ilvl} ${item.slot}|${item.base}|${item.ilvl}|${item.weaponAspd ?? '-'}|${item.weight}|${item.unbound_at_drop}|${item.quality}|${item.tier}|${item.q}|${lines(item)}`);
          }
          now.push(`${seed} ${band} ${ilvl} next ${rng()}`);
        }
      }
    }
    expect(now).toEqual(CLIENT_REFERENCE);
  });
});

describe('the shared builder', () => {
  it('builds the same lines for the same inputs and the same entry state, on either path', () => {
    const slot = 'helmet';
    const frame = (BASES.bases as any[]).find((b: any) => b.slot === slot);
    const cageRng = mulberry32(99);
    const clientRng = mulberry32(99);
    const cage = LOOT.buildLines(BASES_JSON, { slot, frame, weapon: null, ilvl: 42, q: 1 }, cageRng);
    const client = loot.buildLines(BASES, { slot, frame, weapon: null, ilvl: 42, q: 1 }, clientRng);
    expect(client.lines).toEqual(cage.lines);
    expect(client.u).toBe(cage.u);
    // the same stream position afterwards, so the next draw lands where it landed before
    expect(clientRng()).toBe(cageRng());
  });

  it('is reached with the same base the client picks, so the two paths meet', () => {
    const cageRng = mulberry32(5);
    const clientRng = mulberry32(5);
    const cageBase = LOOT.rollBase(cageRng, BASES_JSON, 'main hand');
    const clientBase = loot.rollBase(clientRng, BASES, 'main hand');
    expect(clientBase.weapon.name).toBe(cageBase.weapon.name);
    expect(clientBase.frame.name).toBe(cageBase.frame.name);
  });
});

describe('the reference covers what the roll can produce', () => {
  it('holds an off hand, an Elemental line and a baked stat', () => {
    const all = [...CAGE_REFERENCE, ...CLIENT_REFERENCE].join('\n');
    expect(all).toContain('off hand');
    expect(all).toMatch(/elemental_\w+=/);
    expect(all).toMatch(/stat_mod_flat=\d+@\d+\/(str|vit|dex|agi|wis|int|lck)/);
  });
});
