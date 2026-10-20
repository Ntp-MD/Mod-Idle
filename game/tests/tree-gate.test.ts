import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { checks } from '../../tools/tree.ts';

/**
 * The tree cage gates a file, but the gate must be provable: a structure that is broken has to
 * FAIL, and the proof runs on a copy — the real `tools/data/tree.json` is never touched.
 */

const readTree = (): any =>
  JSON.parse(readFileSync(new URL('../../tools/data/tree.json', import.meta.url), 'utf8'));

/** The verdict of one gate. */
const verdict = (rows: { id: string; verdict: string }[], id: string): string | undefined =>
  rows.find((r) => r.id === id)?.verdict;

describe('the tree cage gates the structure of the spec it reads', () => {
  it('passes on the real file', () => {
    const rows = checks(readTree());
    expect(rows.filter((r) => r.verdict === 'FAIL')).toEqual([]);
  });

  it('gives every gate its own id', () => {
    const ids = checks(readTree()).map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('fails when the spec cannot build', () => {
    const broken = readTree();
    broken.rank_tiers.shallow = [];
    expect(verdict(checks(broken), 'TR1')).toBe('FAIL');
  });

  it('fails when a node grants a line that is not a real Mod', () => {
    const broken = readTree();
    broken.nodes[0].grants[0].id = 'no_such_line';
    expect(verdict(checks(broken), 'TR4')).toBe('FAIL');
  });

  it('fails when a node grants a line the character sheet has no bucket for', () => {
    const broken = readTree();
    // every Mod row the sheet knows is a bucket, so a line that is neither a Mod nor a sheet bucket is
    // the shape this gate exists for: the node is bought and nothing moves
    broken.nodes[0].grants[0].id = 'no_such_line';
    expect(verdict(checks(broken), 'TR5')).toBe('FAIL');
    expect(verdict(checks(broken), 'TR4')).toBe('FAIL');
  });

  it('fails when a node names a parent that does not exist', () => {
    const broken = readTree();
    broken.nodes[5].needs = ['no_such_node'];
    expect(verdict(checks(broken), 'TR1')).toBe('FAIL');
  });

  it('fails when the note figures drift from the tree', () => {
    const broken = readTree();
    broken.meta.note = 'There are 64 nodes, 192 ranks and one point per rank.';
    expect(verdict(checks(broken), 'TR12')).toBe('FAIL');
  });

  it('fails when the spec carries a number the engine does not read', () => {
    const broken = readTree();
    broken.nodes[0].values = [1, 2, 3];
    expect(verdict(checks(broken), 'TR11')).toBe('FAIL');
  });

  it('fails when a granted value sits above the line it grants', () => {
    const broken = readTree();
    broken.nodes[0].grants[0].values = [9999];
    expect(verdict(checks(broken), 'TR7')).toBe('FAIL');
  });

  it('fails when two nodes sit on top of one another', () => {
    const broken = readTree();
    broken.layout.node_radius = 1000;
    expect(verdict(checks(broken), 'TR13')).toBe('FAIL');
  });

  it('leaves the file it was given untouched', () => {
    const doc = readTree();
    const before = JSON.stringify(doc);
    checks(doc);
    expect(JSON.stringify(doc)).toBe(before);
  });
});
