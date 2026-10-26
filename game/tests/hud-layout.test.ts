import { describe, expect, it } from 'vitest';
import {
  DEFAULT_HUD_LAYOUT, DEFAULT_MODAL_AREA, HUD_LAYOUT_VERSION, HUD_LAYOUT_PREVIOUS_STORAGE_KEYS, HUD_REGION_META,
  copyHudLayout, migrateHudLayout, salvageHudLayout, validateHudLayout,
  type GridArea, type HudLayout, type HudRegion,
} from '../src/ui/hud/hud-layout';

const area = (rowStart: number, rowEnd: number, columnStart: number, columnEnd: number): GridArea =>
  ({ rowStart, rowEnd, columnStart, columnEnd });

const region = (id: string, a: GridArea, justify = 'stretch', align = 'stretch') =>
  ({ id, label: id, area: a, justify, align });

type LegacyRegion = Omit<HudRegion, 'id'> & { id: string };
function legacyJourneyLayout(version = 12): HudLayout & Record<'travel' | 'panels', LegacyRegion> {
  const hud = copyHudLayout();
  hud.objectives = { ...hud.objectives, area: version === 11 ? area(1, 4, 1, 3) : area(1, 3, 1, 4), justify: 'start', align: 'start' };
  return {
    ...hud,
    travel: { ...hud.objectives, id: 'travel', label: 'Map tools', area: version === 11 ? area(5, 6, 1, 3) : area(4, 5, 1, 4) },
    panels: { ...hud.objectives, id: 'panels', label: 'Field panels', area: version === 11 ? area(7, 10, 1, 3) : area(6, 10, 1, 4), justify: 'stretch', align: 'stretch' },
  };
}

/** An old layout file with a separate game-controls placement on the bottom row. */
function legacyFile(hudOverrides: Record<string, unknown> = {}) {
  const hud: Record<string, unknown> = {};
  for (const { id } of HUD_REGION_META) {
    hud[id] = region(id, DEFAULT_HUD_LAYOUT[id].area);
  }
  hud.controls = region('controls', area(15, 15, 12, 15), 'end', 'stretch');
  return JSON.stringify({ version: 1, hud: { ...hud, ...hudOverrides }, modal: DEFAULT_MODAL_AREA });
}

describe('HUD layout migration', () => {
  it('keeps the shipped default layout overlap-free', () => {
    expect(validateHudLayout(DEFAULT_HUD_LAYOUT)).toBeNull();
  });

  it('merges the v11 and v12 stock panels into Journey and round-trips the upgraded layout', () => {
    for (const version of [11, 12]) {
      const migrated = migrateHudLayout({ version, hud: legacyJourneyLayout(version), modal: DEFAULT_MODAL_AREA });
      expect(HUD_LAYOUT_PREVIOUS_STORAGE_KEYS).toContain(`modworld.hud-layout.v${version}`);
      expect(migrated.hud.objectives).toEqual(DEFAULT_HUD_LAYOUT.objectives);
      expect(migrated.hud).not.toHaveProperty('travel');
      expect(migrated.hud).not.toHaveProperty('panels');
      expect(migrated.notice).toMatch(/share Journey/);
      expect(validateHudLayout(migrated.hud)).toBeNull();
      expect(migrateHudLayout(JSON.stringify(migrated))).toEqual(migrated);
      expect(() => migrateHudLayout({ ...migrated, version: HUD_LAYOUT_VERSION + 1 })).toThrow(/Unsupported/);
    }
  });

  it('keeps a custom Place anchor, including its absolute box and stacking order', () => {
    for (const absolute of [false, true]) {
      const source = legacyJourneyLayout();
      if (absolute) {
        source.objectives.mode = 'absolute';
        source.objectives.rect = { x: 35, y: 4, w: 25, h: 20 };
        source.objectives.z = 8;
      } else source.objectives.area = area(1, 2, 1, 3);
      source.panels.mode = 'absolute';
      source.panels.rect = { x: 60, y: 10, w: 25, h: 30 };
      const migrated = migrateHudLayout({ version: 12, hud: source, modal: DEFAULT_MODAL_AREA });
      expect(migrated.hud.objectives).toEqual(source.objectives);
      expect(validateHudLayout(migrated.hud)).toBeNull();
    }
  });

  it('uses custom Panels, then Travel, when Place still uses its stock placement', () => {
    for (const id of ['panels', 'travel'] as const) {
      const source = legacyJourneyLayout();
      source[id].mode = 'absolute';
      source[id].rect = { x: 65, y: 12, w: 25, h: 40 };
      source[id].z = 9;
      const migrated = migrateHudLayout({ version: 12, hud: source, modal: DEFAULT_MODAL_AREA });
      expect(migrated.hud.objectives).toEqual({ ...source[id], id: 'objectives', label: 'Journey' });
      expect(validateHudLayout(migrated.hud)).toBeNull();
    }
  });

  it('fits Journey to the legacy column when a custom neighbour occupies the wider space', () => {
    const source = legacyJourneyLayout(11);
    source.tasks.area = area(1, 3, 4, 5);
    const migrated = migrateHudLayout({ version: 11, hud: source, modal: DEFAULT_MODAL_AREA });
    expect(migrated.hud.objectives.area).toEqual(area(1, 10, 1, 3));
    expect(migrated.hud.tasks).toEqual(source.tasks);
    expect(validateHudLayout(migrated.hud)).toBeNull();
  });

  it('lets an absolute region overlap and round-trips its box and z-index', () => {
    const next = copyHudLayout(DEFAULT_HUD_LAYOUT);
    next.feed = { ...next.feed, mode: 'absolute', rect: { x: 55.5, y: 12, w: 30, h: 18 }, z: 7 };
    expect(validateHudLayout(next)).toBeNull();
    const round = migrateHudLayout({ version: HUD_LAYOUT_VERSION, hud: next, modal: DEFAULT_MODAL_AREA });
    expect(round.hud.feed.mode).toBe('absolute');
    expect(round.hud.feed.rect).toEqual({ x: 55.5, y: 12, w: 30, h: 18 });
    expect(round.hud.feed.z).toBe(7);
  });

  it('refuses an absolute region whose box makes no sense', () => {
    const next = copyHudLayout(DEFAULT_HUD_LAYOUT);
    next.feed = { ...next.feed, mode: 'absolute', rect: { x: 0, y: 0, w: 0, h: 50 } };
    expect(validateHudLayout(next)).toMatch(/invalid free box/);
  });

  it('falls back to grid placement when a saved box is unreadable', () => {
    const next = copyHudLayout(DEFAULT_HUD_LAYOUT);
    next.feed = { ...next.feed, mode: 'absolute', rect: { x: NaN, y: 0, w: 30, h: 18 } };
    const fixed = copyHudLayout(next);
    expect(fixed.feed.mode).toBe('absolute');
    expect(fixed.feed.rect).toEqual(DEFAULT_HUD_LAYOUT.feed.rect);
  });

  it('extends the unchanged stock Game controls through M12–M15 while preserving custom placement', () => {
    const source = copyHudLayout(DEFAULT_HUD_LAYOUT);
    source.commands.area = area(14, 15, 12, 15);
    const migrated = migrateHudLayout({ version: 9, hud: source, modal: DEFAULT_MODAL_AREA });
    expect(migrated.hud.commands.area).toEqual(DEFAULT_HUD_LAYOUT.commands.area);
    expect(migrated.notice).toMatch(/Journey/);
    expect(validateHudLayout(migrated.hud)).toBeNull();

    source.commands.area = area(12, 13, 12, 15);
    expect(migrateHudLayout({ version: 9, hud: source, modal: DEFAULT_MODAL_AREA }).hud.commands.area).toEqual(source.commands.area);
  });

  it('preserves the combat field and folds a retired controls anchor into the right-edge dock', () => {
    const custom = region('feed', area(11, 13, 1, 2));
    const migrated = migrateHudLayout(legacyFile({ feed: custom }));
    expect(migrated.version).toBe(HUD_LAYOUT_VERSION);
    expect(migrated.notice).toMatch(/Journey/);
    expect(validateHudLayout(migrated.hud)).toBeNull();
    // the custom feed placement survives untouched
    expect(migrated.hud.feed.area).toEqual(custom.area);
    expect(migrated.hud.field.area).toEqual(DEFAULT_HUD_LAYOUT.field.area);
    expect(migrated.hud.commands.area).toEqual(DEFAULT_HUD_LAYOUT.commands.area);
  });

  it('folds a v3 automation region into the new commands dock without moving the combat field', () => {
    const source: Record<string, unknown> = {};
    for (const { id } of HUD_REGION_META) if (id !== 'commands') source[id] = { ...DEFAULT_HUD_LAYOUT[id], area: { ...DEFAULT_HUD_LAYOUT[id].area } };
    source.field = { ...DEFAULT_HUD_LAYOUT.field, area: area(4, 10, 4, 12) };
    source.automation = region('automation', area(7, 9, 14, 15), 'end', 'center');
    const migrated = migrateHudLayout({ version: 3, hud: source, modal: DEFAULT_MODAL_AREA });
    expect(migrated.hud.field.area).toEqual(area(4, 10, 4, 12));
    expect(migrated.hud.commands.area).toEqual(DEFAULT_HUD_LAYOUT.commands.area);
    expect(migrated.notice).toMatch(/Journey/);
    expect(validateHudLayout(migrated.hud)).toBeNull();
  });

  it('migrates a v4 layout that already uses the current top-band placement', () => {
    const source = copyHudLayout(DEFAULT_HUD_LAYOUT);
    source.field.area = area(4, 10, 4, 12);
    source.commands.area = area(12, 15, 12, 15);
    const file = JSON.stringify({ version: 4, hud: source, modal: DEFAULT_MODAL_AREA });
    const migrated = migrateHudLayout(file);
    expect(migrated.hud.field.area).toEqual(area(4, 10, 4, 12));
    expect(migrated.hud.commands.area).toEqual(area(12, 15, 12, 15));
    expect(migrated.notice).toMatch(/Journey/);
  });

  it('reflows the stock v4 target, menu and field-panel areas without changing custom field placement', () => {
    const source = legacyJourneyLayout();
    source.target.area = area(1, 2, 6, 10);
    source.menu.area = area(1, 1, 11, 15);
    source.panels.area = area(2, 6, 13, 14);
    source.field.area = area(4, 10, 4, 12);
    const migrated = migrateHudLayout({ version: 4, hud: source, modal: DEFAULT_MODAL_AREA });
    expect(migrated.hud.target.area).toEqual(DEFAULT_HUD_LAYOUT.target.area);
    expect(migrated.hud.menu.area).toEqual(DEFAULT_HUD_LAYOUT.menu.area);
    expect(migrated.hud).not.toHaveProperty('panels');
    expect(migrated.hud.field.area).toEqual(source.field.area);
    expect(migrated.notice).toMatch(/Journey/);
    expect(validateHudLayout(migrated.hud)).toBeNull();
  });

  it('preserves a custom v4 target while moving the stock menu and panels', () => {
    const source = legacyJourneyLayout();
    source.target.area = area(1, 2, 5, 9);
    source.menu.area = area(1, 1, 11, 15);
    source.panels.area = area(2, 6, 13, 14);
    const migrated = migrateHudLayout({ version: 4, hud: source, modal: DEFAULT_MODAL_AREA });
    expect(migrated.hud.target.area).toEqual(source.target.area);
    expect(migrated.hud.menu.area).toEqual(DEFAULT_HUD_LAYOUT.menu.area);
    expect(migrated.hud).not.toHaveProperty('panels');
    expect(migrated.notice).toMatch(/Journey/);
    expect(validateHudLayout(migrated.hud)).toBeNull();
  });

  it('reflows the interim v5 stock layout and leaves edited regions alone', () => {
    const source = legacyJourneyLayout();
    source.target.area = area(1, 2, 3, 6);
    source.menu.area = area(1, 1, 7, 15);
    source.panels.area = area(2, 6, 13, 14);
    const migrated = migrateHudLayout({ version: 5, hud: source, modal: DEFAULT_MODAL_AREA });
    expect(migrated.hud.target.area).toEqual(DEFAULT_HUD_LAYOUT.target.area);
    expect(migrated.hud.menu.area).toEqual(DEFAULT_HUD_LAYOUT.menu.area);
    expect(migrated.hud).not.toHaveProperty('panels');
    expect(migrated.notice).toMatch(/Journey/);
    expect(validateHudLayout(migrated.hud)).toBeNull();
  });

  it('refuses files the strict migration cannot honour', () => {
    const backfilled = migrateHudLayout(JSON.stringify({ version: 4, hud: {}, modal: DEFAULT_MODAL_AREA }));
    expect(backfilled.hud).toEqual(DEFAULT_HUD_LAYOUT);
    expect(() => migrateHudLayout(JSON.stringify({ version: 1, modal: DEFAULT_MODAL_AREA }))).toThrow(/region map/);
    expect(() => migrateHudLayout('not json')).toThrow();
  });

  it('salvages a conflicting layout region by region instead of discarding it', () => {
    // strict migration throws on this file: two saved regions claim the same cells, and there is no
    // controls anchor to expand — the salvage must keep what fits and default only the conflict
    const broken = JSON.stringify({
      version: HUD_LAYOUT_VERSION,
      hud: {
        objectives: region('objectives', area(1, 3, 1, 2)),
        feed: region('feed', area(1, 3, 1, 2)), // overlaps objectives — cannot also be kept
        menu: region('menu', area(1, 1, 12, 15)),
      },
      modal: DEFAULT_MODAL_AREA,
    });
    expect(() => migrateHudLayout(broken)).toThrow();
    const salvaged = salvageHudLayout(broken);
    expect(validateHudLayout(salvaged.hud)).toBeNull();
    expect(salvaged.version).toBe(HUD_LAYOUT_VERSION);
    // the first fitting regions keep their saved placement; the conflicting one falls back to default
    expect(salvaged.hud.objectives.area).toEqual(area(1, 3, 1, 2));
    expect(salvaged.hud.menu.area).toEqual(area(1, 1, 12, 15));
    expect(salvaged.hud.feed.area).not.toEqual(area(1, 3, 1, 2));
    expect(salvaged.notice).toMatch(/region/);
  });

  it('salvages unreadable input to defaults without throwing', () => {
    for (const garbage of ['not json', null, undefined, 42, JSON.stringify({ version: 99 })]) {
      const salvaged = salvageHudLayout(garbage as unknown);
      expect(validateHudLayout(salvaged.hud)).toBeNull();
      expect(salvaged.modal).toEqual(DEFAULT_MODAL_AREA);
    }
  });

  it('salvages the legacy controls anchor while keeping the card in the combat field', () => {
    const hud: Record<string, unknown> = { controls: region('controls', area(15, 15, 12, 15), 'end', 'end') };
    const salvaged = salvageHudLayout(JSON.stringify({ version: 1, hud, modal: DEFAULT_MODAL_AREA }));
    expect(validateHudLayout(salvaged.hud)).toBeNull();
    expect(salvaged.hud.field.area).toEqual(DEFAULT_HUD_LAYOUT.field.area);
    expect(salvaged.notice).toMatch(/region/);
  });

  it('accepts every region list the Studio exposes, so no reader can fall out of sync', () => {
    const layout = copyHudLayout() as HudLayout;
    for (const { id } of HUD_REGION_META) expect(layout[id].id).toBe(id);
    expect(HUD_REGION_META.map(({ id }) => id)).toContain('field');
    expect(HUD_REGION_META.map(({ id }) => id)).not.toContain('controls');
    expect(HUD_REGION_META.map(({ id }) => id)).not.toContain('automation');
    expect(HUD_REGION_META.map(({ id }) => id)).toContain('commands');
    expect(HUD_REGION_META.map(({ id }) => id)).not.toContain('player');
    expect(HUD_REGION_META.map(({ id }) => id)).not.toContain('travel');
    expect(HUD_REGION_META.map(({ id }) => id)).not.toContain('panels');
    expect(DEFAULT_HUD_LAYOUT.objectives.label).toBe('Journey');
  });
});
