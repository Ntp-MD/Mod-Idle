/** Renderer lifetime and scheduling only. Painters consume an already resolved snapshot. */
import { createMapDomIndex } from './render/map-dom';
import { paintMapScene } from './render/map-scene';
import { paintMapContent } from './render/map-content';
import { paintSurface } from './render/map-surface';
import { paintHover } from './render/map-hover';
import type { MapPaintModel, MapStaticCell, Picked } from './map-types';
import { type MapCameraState, DEFAULT_MAP_CAMERA } from './map-camera';

export interface MapRenderer {
  readonly cells: readonly MapStaticCell[];
  updateModel(model: MapPaintModel): void;
  updateCamera(camera: MapCameraState): void;
  /** Display key for hover decoration; selection and commands use axial identity. */
  setHover(displayKey: string | null): void;
  setVisible(visible: boolean): void;
  pick(target: EventTarget | null): Picked | null;
  resize(): void;
  destroy(): void;
}

type Dirty = { Surface: boolean; Content: boolean; Viewport: boolean; Hover: boolean };
const clean = (): Dirty => ({ Surface: false, Content: false, Viewport: false, Hover: false });

/** One facade owns the index, the pending frame, the latest snapshot and its dirty flags. */
export function createMapRenderer(root: HTMLElement, observeWork?: (event: 'index' | 'depth-sort' | 'flush') => void): MapRenderer {
  const svg = root.querySelector('svg');
  if (!svg) throw new Error('map: no SVG');
  const index = createMapDomIndex(svg);
  const cells = index.cells.map(cell => cell.static);
  observeWork?.('index');
  let model: MapPaintModel | null = null;
  let camera: MapCameraState = { ...DEFAULT_MAP_CAMERA };
  let hovered: string | null = null;
  let visible = true;
  let destroyed = false;
  let raf = 0;
  let surfaceKey = '', adventureKey = '';
  const dirty: Dirty = clean();

  const flush = () => {
    raf = 0;
    if (!model || destroyed || !visible) return;
    const work = { ...dirty };
    for (const key of Object.keys(dirty) as (keyof Dirty)[]) dirty[key] = false;
    if (work.Surface) paintSurface(index, model);
    if (work.Content) paintMapContent(index, model);
    if (work.Viewport || work.Surface) {
      if (paintMapScene(index)) observeWork?.('depth-sort');
    }
    if (work.Hover) paintHover(index, hovered);
    observeWork?.('flush');
  };
  const schedule = () => {
    if (destroyed || !visible || !model || raf) return;
    raf = requestAnimationFrame(flush);
  };

  return {
    get cells() { return cells; },
    updateModel(next) {
      const nextSurface = JSON.stringify(next.surface);
      const { view, showNames, cleanMap } = next.surface.options;
      const nextAdventure = JSON.stringify([view, showNames, cleanMap, next.adventure, next.content]);
      if (nextSurface !== surfaceKey) {
        surfaceKey = nextSurface;
        dirty.Surface = true;
      }
      if (nextAdventure !== adventureKey) { adventureKey = nextAdventure; dirty.Content = true; }
      model = next;
      schedule();
    },
    updateCamera(next) {
      const previous = camera;
      camera = { ...next };
      if (previous.panX !== next.panX || previous.panY !== next.panY || previous.zoom !== next.zoom) {
        dirty.Viewport = true; dirty.Hover = true;
      }
      schedule();
    },
    setHover(key) {
      if (key === hovered) return;
      hovered = key;
      dirty.Hover = true;
      schedule();
    },
    setVisible(next) {
      visible = next;
      if (!next) { if (raf) cancelAnimationFrame(raf); raf = 0; return; }
      dirty.Surface = true; dirty.Content = true; dirty.Viewport = true;
      schedule();
    },
    pick(target) {
      const node = (target as Element | null)?.closest?.('polygon.cell') as SVGPolygonElement | null;
      if (!node) return null;
      const cell = index.byAx.get(node.getAttribute('data-ax') || '');
      return cell ? { ...cell.static.picked } : null;
    },
    resize() {
      dirty.Viewport = true;
      schedule();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      model = null;
    },
  };
}
