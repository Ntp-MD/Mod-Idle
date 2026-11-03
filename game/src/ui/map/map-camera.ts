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
  return { x: zoom * (origin.x - position.x), y: zoom * (origin.y - position.y) };
}

/**
 * Clamp a two-axis pan so the ground keeps covering the frame. When the paper is smaller than the
 * frame, centre it instead of pinning an edge: the sea beyond the field has to stay reachable, and a
 * world overview cannot be pushed into a corner.
 */
export function clampMapPan(pan: MapPoint, frame: { width: number; height: number },
  paper: { x: number; y: number; width: number; height: number }, projection: MapMatrix,
  zoom: number): MapPoint {
  const origin = { x: frame.width / 2, y: frame.height * .46 };
  const screen = (x: number, y: number): MapPoint => {
    const world = transformMapPoint(projection, { x, y });
    return { x: origin.x + pan.x + zoom * (world.x - origin.x), y: origin.y + pan.y + zoom * (world.y - origin.y) };
  };
  const corners = [
    screen(paper.x, paper.y), screen(paper.x + paper.width, paper.y),
    screen(paper.x, paper.y + paper.height), screen(paper.x + paper.width, paper.y + paper.height),
  ];
  const minX = Math.min(...corners.map((p) => p.x)), maxX = Math.max(...corners.map((p) => p.x));
  const minY = Math.min(...corners.map((p) => p.y)), maxY = Math.max(...corners.map((p) => p.y));
  let x = pan.x, y = pan.y;
  if (maxX - minX >= frame.width) {
    if (minX > 0) x -= minX;
    else if (maxX < frame.width) x += frame.width - maxX;
  } else x += (frame.width - (minX + maxX)) / 2;
  if (maxY - minY >= frame.height) {
    if (minY > 0) y -= minY;
    else if (maxY < frame.height) y += frame.height - maxY;
  } else y += (frame.height - (minY + maxY)) / 2;
  return { x, y };
}
