<script lang="ts">
  import { tick } from 'svelte';
  import type { GameState } from '@sim/core/types';
  import { currentCell } from '@sim/world/road';
  import { createMapRenderer, type MapRenderer } from './map';
  import { buildMapPaintModel } from './map-view-model';
  import type { MapPaintModel, MapStaticCell, MapViewOptions, Picked } from './map-types';
  import { attachMapInput, neighborInDirection, HEX_NEIGHBOURS, type MapInputHandlers } from './map-input';
  import {
    clampMapPan, composeMapMatrix, MAP_ANCHOR_X, MAP_ANCHOR_Y, mapDetail, mapMinReadableZoom, transformMapPoint,
    MAP_MAX_ZOOM, MAP_MIN_ZOOM, MAP_OPEN_ZOOM, DEFAULT_MAP_CAMERA, type MapCameraState,
  } from './map-camera';
  import { createMapProjection } from './map-projection';

  export type MapIntent =
    | { type: 'select'; cell: Picked }
    | { type: 'clear-selection' }
    | { type: 'activate'; cell: Picked };

  let {
    markup,
    state: gameState,
    selected,
    camera = $bindable({ ...DEFAULT_MAP_CAMERA }),
    options,
    interactive,
    visible,
    announcement,
    onintent,
    oncells,
  }: {
    markup: string;
    state: GameState;
    selected: Picked | null;
    camera: MapCameraState;
    options: MapViewOptions;
    interactive: boolean;
    visible: boolean;
    announcement: string;
    onintent: (intent: MapIntent) => void;
    oncells?: (cells: readonly MapStaticCell[]) => void;
  } = $props();

  let root: HTMLDivElement;
  let renderer = $state.raw<MapRenderer | null>(null);
  let cells = $state.raw<readonly MapStaticCell[]>([]);
  let hovered = $state<string | null>(null);
  let gesture = $state<'dragging' | null>(null);
  let generation = 0;
  let resizeObserver: ResizeObserver | null = null;
  let input: { destroy(): void } | null = null;

  const model: MapPaintModel | null = $derived(cells.length ? buildMapPaintModel({ state: gameState, cells, selected, options }) : null);

  function paper() {
    const svg = root?.querySelector('svg');
    return svg?.querySelector('rect.paper') as SVGRectElement | null;
  }
  function planeMatrix() {
    const viewport = root?.querySelector('svg')?.getCTM();
    if (!viewport || Math.abs(viewport.a * viewport.d - viewport.b * viewport.c) < 1e-12) return null;
    return composeMapMatrix(viewport, { ...createMapProjection(), e: 0, f: 0 });
  }
  function origin() {
    const box = root?.getBoundingClientRect();
    return box && box.width > 0 && box.height > 0
      ? { x: box.left + box.width * MAP_ANCHOR_X, y: box.top + box.height * MAP_ANCHOR_Y } : null;
  }
  function readableMinZoom(): number {
    const box = root?.getBoundingClientRect();
    const matrix = planeMatrix();
    if (!box || box.width <= 0 || box.height <= 0 || !matrix || !Number.isFinite(matrix.a)) return MAP_MIN_ZOOM;
    // At zoom 1 place 1 plan unit against the SVG surface scale; camera
    // scales that once. Hidden/invalid hosts keep the global floor (D2).
    const planToCss = Math.hypot(matrix.a, matrix.b) || 1;
    const extent = { icon: 2.8, text: 3.6 };
    const textOn = options.showNames && !options.cleanMap;
    return mapMinReadableZoom({ icon: extent.icon * planToCss, text: extent.text * planToCss }, textOn);
  }
  function clampPan(next: MapCameraState) {
    const box = root?.getBoundingClientRect(), svg = root?.querySelector('svg') as SVGSVGElement | null;
    const sheet = paper();
    if (!box || !svg || !sheet) return next;
    const matrix = planeMatrix();
    if (!matrix) return next;
    const pan = clampMapPan({ x: next.panX, y: next.panY }, box, sheet.getBBox(), matrix, next.zoom);
    return { ...next, panX: pan.x, panY: pan.y };
  }
  function zoomAt(clientX: number, clientY: number, factor: number) {
    const o = origin();
    if (!o) return;
    const min = readableMinZoom();
    const zoom = Math.min(MAP_MAX_ZOOM, Math.max(min, camera.zoom * factor));
    const f = zoom / camera.zoom;
    const panX = (clientX - o.x) * (1 - f) + camera.panX * f;
    const panY = (clientY - o.y) * (1 - f) + camera.panY * f;
    camera = clampPan({ panX, panY, zoom });
  }
  function centerAt(hex: { q: number; r: number }) {
    const box = root?.getBoundingClientRect(), svg = root?.querySelector('svg') as SVGSVGElement | null;
    const cell = root?.querySelector(`polygon.cell[data-ax="${hex.q},${hex.r}"]`) as SVGGraphicsElement | null;
    if (!box || !svg || !cell) return;
    const bounds = cell.getBBox(), matrix = planeMatrix();
    if (!matrix) return;
    const point = transformMapPoint(matrix, { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 });
    camera = clampPan({ ...camera, panX: -camera.zoom * (point.x - box.width * MAP_ANCHOR_X), panY: -camera.zoom * (point.y - box.height * MAP_ANCHOR_Y) });
  }
  function centerOnPlayer() { centerAt(currentCell(gameState)); }
  export function zoomBy(factor: number) {
    const o = origin();
    if (o) zoomAt(o.x, o.y, factor);
  }
  export function resetCamera() {
    camera = clampPan({ ...camera, zoom: MAP_OPEN_ZOOM, panX: 0, panY: 0 });
    requestAnimationFrame(centerOnPlayer);
  }
  export { centerAt, centerOnPlayer };
  export function pickAt(hex: { q: number; r: number }): Picked | null {
    const cell = root?.querySelector<SVGPolygonElement>(`polygon.cell[data-ax="${hex.q},${hex.r}"]`);
    return cell ? renderer?.pick(cell) ?? null : null;
  }
  export function focus() { root?.focus(); }

  function pick(target: EventTarget | null): Picked | null {
    return renderer?.pick(target) ?? null;
  }
  function neighbour(direction: readonly [number, number]): Picked | null {
    const feet = currentCell(gameState);
    const originPicked = selected ?? { q: feet.q, r: feet.r };
    const originCell = root?.querySelector<SVGPolygonElement>(`polygon.cell[data-ax="${originPicked.q},${originPicked.r}"]`);
    if (!originCell) return null;
    const originBox = originCell.getBoundingClientRect();
    const originPoint = { x: originBox.x + originBox.width / 2, y: originBox.y + originBox.height / 2 };
    const candidates = HEX_NEIGHBOURS.flatMap(([dq, dr]) => {
      const cell = root?.querySelector<SVGPolygonElement>(`polygon.cell[data-ax="${originPicked.q + dq},${originPicked.r + dr}"]`);
      if (!cell) return [];
      const box = cell.getBoundingClientRect();
      return [{ ax: cell.getAttribute('data-cell') || '', element: cell, point: { x: box.x + box.width / 2, y: box.y + box.height / 2 } }];
    });
    const displayKey = neighborInDirection(originPoint, candidates, direction);
    const candidate = candidates.find((entry) => entry.ax === displayKey);
    return candidate ? renderer?.pick(candidate.element) ?? null : null;
  }

  const handlers: MapInputHandlers = {
    active: () => !!interactive,
    pick,
    current: () => selected,
    select: (cell) => onintent({ type: 'select', cell }),
    clear: () => onintent({ type: 'clear-selection' }),
    activate: (cell) => onintent({ type: 'activate', cell }),
    hover: (key) => { hovered = key; },
    neighbour,
    camera: () => camera,
    setCamera: (next) => { camera = clampPan({ ...camera, ...next }); },
    zoomAt,
    gesture: (next) => { gesture = next; },
    measure: () => renderer?.resize(),
  };

  $effect(() => {
    const currentGeneration = ++generation;
    markup;
    tick().then(() => {
      if (currentGeneration !== generation || !root) return;
      input?.destroy();
      input = null;
      renderer?.destroy();
      renderer = null;
      try {
        renderer = createMapRenderer(root);
        cells = renderer.cells;
        oncells?.(cells);
      } catch (error) {
        console.error(error);
        cells = [];
      }
      resizeObserver?.disconnect();
      resizeObserver = new ResizeObserver(() => renderer?.resize());
      resizeObserver.observe(root);
    });
    return () => { if (currentGeneration === generation) { input?.destroy(); input = null; } };
  });

  $effect(() => {
    if (!renderer || !model) return;
    renderer.updateModel(model);
  });
  $effect(() => {
    if (!renderer) return;
    renderer.updateCamera(camera);
  });
  $effect(() => {
    if (!renderer) return;
    renderer.setVisible(visible);
  });
  $effect(() => {
    if (!renderer) return;
    renderer.setHover(hovered);
  });
  $effect(() => {
    if (input) { input.destroy(); input = null; }
    if (!root || !interactive || !visible || !renderer) return;
    input = attachMapInput(root, handlers);
    return () => { input?.destroy(); input = null; };
  });
  $effect(() => () => {
    generation += 1;
    input?.destroy();
    resizeObserver?.disconnect();
    renderer?.destroy();
  });
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
  bind:this={root}
  class="map-back sheet"
  class:clean-map={options.cleanMap}
  class:map-show-relief={options.relief}
  class:map-detail-far={mapDetail(camera.zoom) === 'far'}
  class:map-detail-near={mapDetail(camera.zoom) === 'near'}
  class:dragging={gesture === 'dragging'}
  role="application"
  data-testid="world-map"
  aria-label="World map. North is up. Drag to pan. Scroll to zoom. Arrow keys select adjacent blocks in the screen direction; Enter performs the destination's primary action."
  tabindex="0"
>
  <div class="map-sheet" style:transform={`translate(${camera.panX.toFixed(1)}px, ${camera.panY.toFixed(1)}px) scale(${camera.zoom.toFixed(4)})`}>
    <div class="map-projection" class:hex-calibrating={options.showHexCalibration}>{@html markup}</div>
  </div>
  <span class="aloud" aria-live="polite" aria-atomic="true">{announcement}</span>
</div>
