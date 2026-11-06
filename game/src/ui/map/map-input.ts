import type { Picked } from './map-view-model';

export type MapPoint2 = { x: number; y: number };

/** The same six-neighbour order App used; candidates arrive in it, never re-sorted. */
export const HEX_NEIGHBOURS: readonly (readonly [number, number])[] = [
  [1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1],
];
export const MAP_ARROW_VECTORS: Record<string, readonly [number, number]> = {
  ArrowRight: [1, 0],
  ArrowLeft: [-1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

/**
 * Screen-direction neighbour: reject candidates behind the arrow, minimise |cross|/dot and keep the
 * first candidate on ties (strict `<`). Pure numeric input, so it is testable without a DOM.
 */
export function neighborInDirection(
  origin: MapPoint2,
  candidates: readonly { ax: string; point: MapPoint2 }[],
  direction: readonly [number, number],
): string | null {
  const [ux, uy] = direction;
  let nearest: string | null = null;
  let nearestAngle = Infinity;
  for (const candidate of candidates) {
    const dx = candidate.point.x - origin.x, dy = candidate.point.y - origin.y;
    const forward = dx * ux + dy * uy;
    if (forward <= 0) continue;
    const angle = Math.abs(dx * uy - dy * ux) / forward;
    if (angle < nearestAngle) {
      nearest = candidate.ax;
      nearestAngle = angle;
    }
  }
  return nearest;
}

export interface MapInputHandlers {
  active(): boolean;
  pick(target: EventTarget | null): Picked | null;
  current(): Picked | null;
  select(picked: Picked): void;
  clear(): void;
  activate(picked: Picked): void;
  hover(key: string | null): void;
  neighbour(direction: readonly [number, number]): Picked | null;
  camera(): { panX: number; panY: number; zoom: number; bearing: number };
  setCamera(next: { panX: number; panY: number; zoom: number; bearing: number }): void;
  zoomAt(clientX: number, clientY: number, factor: number): void;
  gesture(state: 'dragging' | 'rotating' | null): void;
  measure(): void;
}

function typing(target: EventTarget | null): boolean {
  const node = target as HTMLElement | null;
  if (!node) return false;
  const tag = node.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || node.isContentEditable;
}

/** One attachment owns every map gesture and key listener; `destroy()` detaches them all. */
export function attachMapInput(root: HTMLElement, handlers: MapInputHandlers): { destroy(): void } {
  let down: { pointerId: number; x: number; y: number; panX: number; panY: number; bearing: number; turn: boolean } | null = null;
  let moved = false;
  const click = (event: Event) => {
    if (moved) { moved = false; return; }
    if (!handlers.active()) return;
    const picked = handlers.pick(event.target);
    const current = handlers.current();
    if (!picked || (current && current.q === picked.q && current.r === picked.r)) { handlers.clear(); return; }
    handlers.select(picked);
  };
  const key = (event: Event) => {
    const ev = event as KeyboardEvent;
    if (!handlers.active() || typing(ev.target) || ev.altKey || ev.ctrlKey || ev.metaKey) return;
    if (ev.key === 'Escape') {
      if (!handlers.current()) return;
      ev.preventDefault(); ev.stopPropagation(); handlers.clear(); return;
    }
    const direction = MAP_ARROW_VECTORS[ev.key];
    if (direction) {
      ev.preventDefault(); ev.stopPropagation();
      const picked = handlers.neighbour(direction);
      if (picked) handlers.select(picked);
      return;
    }
    if (ev.key === 'Enter') {
      const current = handlers.current();
      if (!current) return;
      ev.preventDefault(); ev.stopPropagation();
      if (!ev.repeat) handlers.activate(current);
    }
  };
  const onDown = (ev: PointerEvent) => {
    if (!handlers.active() || ev.button !== 0 || !ev.isPrimary) return;
    const camera = handlers.camera();
    down = { pointerId: ev.pointerId, x: ev.clientX, y: ev.clientY, panX: camera.panX, panY: camera.panY, bearing: camera.bearing, turn: ev.ctrlKey };
    moved = false;
  };
  const onMove = (ev: PointerEvent) => {
    if (!down) {
      if (handlers.active() && ev.pointerType !== 'touch') {
        const hit = ev.target as Element | null;
        const town = hit?.closest('g[data-node]')?.getAttribute('data-node');
        const cell = hit?.closest('polygon.cell')
          || (town ? root.querySelector(`polygon.cell.town[data-node="${town}"]`) : null);
        handlers.hover(cell?.getAttribute('data-cell') || null);
      } else handlers.hover(null);
      return;
    }
    if (ev.pointerId !== down.pointerId) return;
    if (!handlers.active()) { onUp(ev); return; }
    handlers.hover(null);
    const dx = ev.clientX - down.x, dy = ev.clientY - down.y;
    if (!moved && Math.hypot(dx, dy) < 4) return;
    if (!moved) root.setPointerCapture(ev.pointerId);
    moved = true;
    const camera = handlers.camera();
    if (down.turn) {
      handlers.gesture('rotating');
      handlers.setCamera({ ...camera, bearing: down.bearing + dx * .4 });
    } else {
      handlers.gesture('dragging');
      handlers.setCamera({ ...camera, panX: down.panX + dx, panY: down.panY + dy });
    }
  };
  const onUp = (ev: PointerEvent) => {
    if (!down || ev.pointerId !== down.pointerId) return;
    if (down.turn) moved = true;
    down = null;
    handlers.gesture(null);
    if (moved) handlers.measure();
    if (root.hasPointerCapture(ev.pointerId)) root.releasePointerCapture(ev.pointerId);
  };
  const onWheel = (ev: WheelEvent) => {
    if (!handlers.active()) return;
    ev.preventDefault();
    handlers.zoomAt(ev.clientX, ev.clientY, ev.deltaY < 0 ? 1.12 : 1 / 1.12);
  };
  const onLeave = () => handlers.hover(null);
  const onTransform = (ev: Event) => {
    if ((ev.target as Element).classList.contains('map-sheet')) handlers.measure();
  };
  root.addEventListener('click', click);
  root.addEventListener('keydown', key);
  root.addEventListener('pointerdown', onDown);
  root.addEventListener('pointermove', onMove);
  root.addEventListener('pointerup', onUp);
  root.addEventListener('pointercancel', onUp);
  root.addEventListener('lostpointercapture', onUp);
  root.addEventListener('wheel', onWheel, { passive: false });
  root.addEventListener('pointerleave', onLeave);
  root.addEventListener('transitionend', onTransform);
  return {
    destroy() {
      root.removeEventListener('click', click);
      root.removeEventListener('keydown', key);
      root.removeEventListener('pointerdown', onDown);
      root.removeEventListener('pointermove', onMove);
      root.removeEventListener('pointerup', onUp);
      root.removeEventListener('pointercancel', onUp);
      root.removeEventListener('lostpointercapture', onUp);
      root.removeEventListener('wheel', onWheel);
      root.removeEventListener('pointerleave', onLeave);
      root.removeEventListener('transitionend', onTransform);
      down = null;
      moved = false;
    },
  };
}
