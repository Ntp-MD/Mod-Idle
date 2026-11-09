/**
 * Compile-time negative cases for unit boundaries.
 * Every // @ts-expect-error must actually error; otherwise
 * `npm --prefix game run check` fails, proving the boundary leaks.
 */
import {
  applyViewportToWorld,
  applyWorldToViewport,
  applyWorldVector,
  clientPointPx,
  fieldPointM,
  fieldVectorM,
  sourcePointPx,
  viewportPointPx,
  viewportVectorPx,
  type ClientPointPx,
  type FieldPointM,
  type FieldVectorM,
  type SourcePointPx,
  type ViewportPointPx,
  type ViewportVectorPx,
} from '../../src/presentation/view-transform';
import {
  createFieldViewFrame,
  type FieldViewFrame,
} from '../../src/presentation/arena-view-frame';

export function negativeCases(): void {
  const field = fieldPointM(1, 2);
  const viewport = viewportPointPx(10, 20);
  const client = clientPointPx(10, 20);
  const source = sourcePointPx(10, 20);
  const identity = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

  // @ts-expect-error - Viewport px is not Field metres.
  applyWorldToViewport(identity, viewport);
  // @ts-expect-error - Field metres is not Viewport px.
  applyViewportToWorld(identity, field);
  // @ts-expect-error - Client px is not Viewport px.
  applyViewportToWorld(identity, client);
  // @ts-expect-error - Source px is not Field metres.
  applyWorldToViewport(identity, source);

  createFieldViewFrame({
    sceneKey: 'negative', atUs: 0,
    viewportCss: { width: 1920, height: 1080 },
    // @ts-expect-error - Viewport px cannot be the world focus.
    focusM: viewport,
    worldScale: 1,
  });

  const asField: FieldPointM = field;
  const asViewport: ViewportPointPx = viewport;
  const asClient: ClientPointPx = client;
  const asSource: SourcePointPx = source;
  // @ts-expect-error - branded points are not interchangeable.
  const wrong: FieldPointM = asViewport;
  // @ts-expect-error - branded points are not interchangeable.
  const wrong2: ViewportPointPx = asField;
  // @ts-expect-error - branded points are not interchangeable.
  const wrong3: ClientPointPx = asViewport;
  // @ts-expect-error - branded points are not interchangeable.
  const wrong4: SourcePointPx = asClient;
  // @ts-expect-error - a point is not a vector.
  const wrong5: FieldVectorM = asField;
  void [wrong, wrong2, wrong3, wrong4, wrong5];

  const vector = viewportVectorPx(3, 4);
  const asVector: ViewportVectorPx = vector;
  // @ts-expect-error - a viewport vector is not a viewport point.
  applyViewportToWorld(identity, vector);
  // @ts-expect-error - a viewport point is not a viewport vector.
  const wrongVec: ViewportVectorPx = asViewport;
  // @ts-expect-error - a viewport vector is not a field vector.
  const wrongVec2: FieldVectorM = asVector;
  // Vectors still convert through the shared affine helper.
  const moved: ViewportVectorPx = applyWorldVector(identity, fieldVectorM(1, 0));
  void [wrongVec, wrongVec2, moved];

  const frame: FieldViewFrame = createFieldViewFrame({
    sceneKey: 'negative', atUs: 0,
    viewportCss: { width: 0, height: 0 },
    focusM: field,
    worldScale: 1,
  });
  if (!frame.renderable) {
    // @ts-expect-error - hidden frames expose no matrices to use.
    void frame.worldToViewport;
  }
}
