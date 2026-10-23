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
    delete broken.node_kinds.keystone;
    expect(verdict(checks(broken), 'TR1')).toBe('FAIL');
  });

  it('fails when a node grants a line that is not a real Mod', () => {
    const broken = readTree();
    broken.profiles['notable.str.01'][0].id = 'no_such_line';
    expect(verdict(checks(broken), 'TR4')).toBe('FAIL');
  });

  it('fails when a node grants a line the character sheet has no bucket for', () => {
    const broken = readTree();
    // every Mod row the sheet knows is a bucket, so a line that is neither a Mod nor a sheet bucket is
    // the shape this gate exists for: the node is bought and nothing moves
    broken.profiles['notable.str.01'][0].id = 'no_such_line';
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

  it('fails when a keystone bundle carries a key the registry does not read', () => {
    const broken = readTree();
    broken.nodes.find((n: any) => n.kind === 'keystone').effects[0].power = 1;
    expect(verdict(checks(broken), 'TR11')).toBe('FAIL');
  });

  it('fails when a granted value sits above the line it grants', () => {
    const broken = readTree();
    broken.profiles['notable.str.01'][0].values = [9999];
    expect(verdict(checks(broken), 'TR7')).toBe('FAIL');
  });

  it('fails when the Start marker overlaps the tree nodes', () => {
    const broken = readTree();
    broken.layout.radii.start = 1000;
    expect(verdict(checks(broken), 'TR13')).toBe('FAIL');
  });

  it('fails when a node id disagrees with its placement', () => {
    const broken = readTree();
    broken.nodes[0].placement = { role: 'spine', index: 2 };
    expect(verdict(checks(broken), 'TR9')).toBe('FAIL');
  });

  it('fails when the regions are not ringed together', () => {
    const broken = readTree();
    broken.links = [];
    expect(verdict(checks(broken), 'TR10')).toBe('FAIL');
  });

  it('fails when connecting the roads would require a Notable or Keystone', () => {
    const broken = readTree();
    const kinds = new Map(broken.nodes.map((n: any) => [n.id, n.kind]));
    broken.links = broken.links.filter((link: any) => kinds.get(link.a) !== 'normal' || kinds.get(link.b) !== 'normal');
    expect(verdict(checks(broken), 'TR10')).toBe('FAIL');
  });

  it('fails when the file is not the recipe\'s own output', () => {
    const broken = readTree();
    broken.nodes[0].name = 'Hand edit';
    expect(verdict(checks(broken), 'TR14')).toBe('FAIL');
  });

  it('fails when a profile nobody reads is left in the file', () => {
    const broken = readTree();
    broken.profiles['notable.unused'] = [{ id: 'armour_flat', values: [1] }];
    expect(verdict(checks(broken), 'TR15')).toBe('FAIL');
  });

  it('leaves the file it was given untouched', () => {
    const doc = readTree();
    const before = JSON.stringify(doc);
    checks(doc);
    expect(JSON.stringify(doc)).toBe(before);
  });

  it('fails when two Keystones use the same immediate Notable', () => {
    const broken = readTree();
    const second = broken.nodes.find((node: any) => node.kind === 'keystone' && node.placement?.slot === 2);
    const first = broken.nodes.find((node: any) => node.kind === 'keystone' && node.wing === second.wing
      && node.placement?.cluster === second.placement.cluster && node.id !== second.id);
    second.needs = [...first.needs];
    expect(verdict(checks(broken), 'TR19')).toBe('FAIL');
  });

  it('fails when a Keystone entrance requires buying the other branch Notable first', () => {
    const broken = readTree();
    const gate = broken.nodes.find((node: any) => node.kind === 'notable' && node.placement?.slot === 2);
    gate.needs = [gate.id.slice(0, -3)];
    expect(verdict(checks(broken), 'TR19')).toBe('FAIL');
  });
});
