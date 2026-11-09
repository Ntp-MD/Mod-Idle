/**
 * Compile-time negative cases for the map boundary (WP5).
 * Every // @ts-expect-error must actually error; otherwise
 * `npm --prefix game run check` fails, proving map-plan units leak
 * into field metres (or vice versa).
 */
import {
  applyViewportToWorld,
  applyWorldToViewport,
  clientPointPx,
  fieldPointM,
  type Affine2,
} from '../../src/presentation/view-transform';
import {
  mapPlanPoint,
  mapPlanToScreen,
  mapScreenPx,
  mapScreenToPlan,
  type MapPlanPoint,
  type MapScreenPx,
} from '../../src/ui/map/map-view-transform';

const IDENTITY: Affine2 = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

export function mapNegativeCases(): void {
  const plan = mapPlanPoint(1, 2);
  const screen = mapScreenPx(10, 20);
  const field = fieldPointM(1, 2);
  const client = clientPointPx(10, 20);

  // @ts-expect-error - map-plan units are not field metres.
  mapPlanToScreen(IDENTITY, field);
  // @ts-expect-error - map screen px is not map-plan input.
  mapPlanToScreen(IDENTITY, screen);
  // @ts-expect-error - field metres are not map screen px.
  mapScreenToPlan(IDENTITY, field);
  // @ts-expect-error - client px is not map screen px.
  mapScreenToPlan(IDENTITY, client);
  // @ts-expect-error - map-plan units must not enter the field transform.
  applyWorldToViewport(IDENTITY, plan);
  // @ts-expect-error - field viewport px must not enter the map inverse.
  applyViewportToWorld(IDENTITY, screen);

  const asPlan: MapPlanPoint = plan;
  const asScreen: MapScreenPx = screen;
  // @ts-expect-error - plan and screen brands are not interchangeable.
  const wrong: MapPlanPoint = asScreen;
  // @ts-expect-error - plan and screen brands are not interchangeable.
  const wrong2: MapScreenPx = asPlan;
  void [wrong, wrong2];
}
