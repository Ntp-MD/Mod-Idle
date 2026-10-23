export type MapPoint = { x: number; y: number };
export type MapMatrix = { a: number; b: number; c: number; d: number; e: number; f: number };

export const mapBearingDegrees = (degrees: number) => ((degrees % 360) + 360) % 360;
export const mapTurnTo = (from: number, to: number) => mapBearingDegrees(to - from + 180) - 180;

export function transformMapPoint(matrix: MapMatrix, point: MapPoint): MapPoint {
  return { x: matrix.a * point.x + matrix.c * point.y + matrix.e, y: matrix.b * point.x + matrix.d * point.y + matrix.f };
}

export function composeMapMatrix(outer: MapMatrix, inner: MapMatrix): MapMatrix {
  const offset = transformMapPoint(outer, { x: inner.e, y: inner.f });
  return { a: outer.a * inner.a + outer.c * inner.b, b: outer.b * inner.a + outer.d * inner.b,
    c: outer.a * inner.c + outer.c * inner.d, d: outer.b * inner.c + outer.d * inner.d, e: offset.x, f: offset.y };
}

/** Undo the camera's full linear transform so a label keeps its screen size and reading direction. */
export function mapScreenLabelMatrix(matrix: MapMatrix, point: MapPoint): MapMatrix {
  const det = matrix.a * matrix.d - matrix.b * matrix.c;
  const a = matrix.d / det, b = -matrix.b / det, c = -matrix.c / det, d = matrix.a / det;
  const x = point.x - matrix.e, y = point.y - matrix.f;
  return { a, b, c, d, e: a * x + c * y, f: b * x + d * y };
}

/** Orbit the world plane while retaining the world point underneath the camera's screen origin. */
export function orbitMapPan(pan: MapPoint, origin: MapPoint, zoom: number, previous: MapMatrix, next: MapMatrix): MapPoint {
  const anchor = mapScreenLabelMatrix(previous, { x: origin.x - pan.x / zoom, y: origin.y - pan.y / zoom });
  const position = transformMapPoint(next, { x: anchor.e, y: anchor.f });
  return { x: zoom * (origin.x - position.x), y: 0 };
}

/** Clamp left/right coverage while keeping vertical pan fixed at zero. */
export function clampMapPan(pan: MapPoint, frame: { width: number; height: number },
  paper: { x: number; y: number; width: number; height: number }, projection: MapMatrix,
  zoom: number): MapPoint {
  const origin = { x: frame.width / 2, y: frame.height * .46 };
  const a = projection.a * zoom, b = projection.b * zoom, c = projection.c * zoom, d = projection.d * zoom;
  const e = origin.x + pan.x + zoom * (projection.e - origin.x), f = origin.y + zoom * (projection.f - origin.y);
  const det = a * d - b * c;
  const mx = frame.width / 2, my = frame.height / 2;
  const perPixel = -d / det;
  let minShift = -Infinity, maxShift = Infinity;
  for (const [x, y] of [[-mx, -my], [frame.width + mx, -my],
    [frame.width + mx, frame.height + my], [-mx, frame.height + my]]) {
    const worldX = (d * (x - e) - c * (y - f)) / det;
    const first = (paper.x - worldX) / perPixel, second = (paper.x + paper.width - worldX) / perPixel;
    minShift = Math.max(minShift, Math.min(first, second));
    maxShift = Math.min(maxShift, Math.max(first, second));
  }
  const shift = minShift <= maxShift ? Math.min(maxShift, Math.max(minShift, 0)) : (minShift + maxShift) / 2;
  return { x: pan.x + shift, y: 0 };
}
