import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

const root = path.resolve(process.cwd(), '..');
const shelf = path.join(root, 'docs/vfx-skill/component-vfx/outputs');
const readJson = (file: string) => JSON.parse(fs.readFileSync(file, 'utf8'));
const digest = (file: string) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');

describe('component VFX source shelf', () => {
  it('resolves every registered shape to one named master, its original and measured QA', () => {
    const inventory = readJson(path.join(root, 'tools/data/vfx-components.json'));
    const { masters } = readJson(path.join(shelf, 'generation-prompts.json'));
    const names = masters.map((row: any) => row.shape);
    expect(new Set(names).size).toBe(names.length);
    expect([...names].sort()).toEqual(Object.keys({ ...inventory.families, ...inventory.variants }).sort());
    expect(fs.readdirSync(shelf).filter(name => /^library-v\d+$/.test(name))).toEqual([]);
    for (const row of masters) {
      expect(row.file, row.shape).toBe(`${row.shape}.png`);
      expect(row.rawFile, row.shape).toBe(`raw/${row.shape}.png`);
      expect(row.qaFile, row.shape).toBe(`qa/${row.shape}.json`);
      expect(row.prompt, row.shape).toBeTruthy();
      expect(row.layer.layerId, row.shape).toBe(row.shape);
      const qa = readJson(path.join(shelf, row.qaFile));
      expect(digest(path.join(shelf, row.file)), row.shape).toBe(qa.masterSha256);
      expect(digest(path.join(shelf, row.rawFile)), row.shape).toBe(qa.sourceSha256);
      expect(qa.canvas, row.shape).toEqual([1024, 1024]);
    }
  });

  it('keeps every gallery ingredient and local navigation link resolvable after consolidation', () => {
    const gallery = fs.readFileSync(path.join(shelf, 'index.html'), 'utf8');
    for (const match of gallery.matchAll(/(?:src|href)="([^"]+)"/g)) {
      const href = match[1];
      if (/^(https?:|#)/.test(href)) continue;
      expect(fs.existsSync(path.resolve(shelf, href)), href).toBe(true);
    }
    const { masters } = readJson(path.join(shelf, 'generation-prompts.json'));
    for (const row of masters) expect(gallery, row.shape).toContain(`href="${row.file}"`);
  });

  it('keeps the raster expansion separate from earlier atlases and preserves the original pixels', () => {
    const report = readJson(path.join(shelf, 'qa/raster-expansion.json'));
    const manifest = readJson(path.join(shelf, 'generation-prompts.json'));
    expect(report.expectedAdditions).toHaveLength(33);
    expect(new Set(report.expectedAdditions).size).toBe(33);
    const selected = manifest.masters.filter((row: any) => report.expectedAdditions.includes(row.shape));
    expect(selected.map((row: any) => row.shape)).toEqual(report.selectedAdditions);
    expect(manifest.masters).toHaveLength(report.originalCount + selected.length);
    expect([...selected, ...manifest.pendingMasters].map((row: any) => row.shape).sort())
      .toEqual([...report.expectedAdditions].sort());
    for (const row of selected) {
      expect(row.authoringKind).toBe('raster-still');
      expect(row.layer).toMatchObject({ columns: 1, rows: 1, imageWidth: 1024, imageHeight: 1024 });
      expect(row.file).toBe(`${row.shape}.png`);
      expect(row.humanReview).toBe(false);
    }
    for (const [file, hash] of Object.entries(report.originalFiles)) {
      expect(digest(path.join(shelf, file)), file).toBe(hash);
    }
  });
});
