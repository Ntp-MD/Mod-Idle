/**
 * Shared affine primitives and unit-branded points for world presentation.
 * Pure math only: no Svelte, DOM or sim imports. Distinct branded
 * interfaces make mixing coordinate spaces a compile error at boundaries.
 */
export interface Affine2 {
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly d: number;
  readonly e: number;
  readonly f: number;
}

export const IDENTITY_AFFINE: Affine2 = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

/** Serialize the shared affine transform for SVG without changing its basis. */
export const matrixAttribute = (m: Affine2): string =>
  `matrix(${m.a} ${m.b} ${m.c} ${m.d} ${m.e} ${m.f})`;

declare const fieldMBrand: unique symbol;
declare const fieldVectorBrand: unique symbol;
declare const viewportPxBrand: unique symbol;
declare const viewportVectorBrand: unique symbol;
declare const clientPxBrand: unique symbol;
declare const sourcePxBrand: unique symbol;
declare const lengthMBrand: unique symbol;
declare const worldHexBrand: unique symbol;

export interface FieldPointM {
  readonly x: number;
  readonly y: number;
  readonly __fieldM: typeof fieldMBrand;
}
export interface FieldVectorM {
  readonly x: number;
  readonly y: number;
  readonly __fieldVectorM: typeof fieldVectorBrand;
}
export interface ViewportPointPx {
  readonly x: number;
  readonly y: number;
  readonly __viewportPx: typeof viewportPxBrand;
}
export interface ViewportVectorPx {
  readonly x: number;
  readonly y: number;
  readonly __viewportVectorPx: typeof viewportVectorBrand;
}
export interface ClientPointPx {
  readonly x: number;
  readonly y: number;
  readonly __clientPx: typeof clientPxBrand;
}
export interface SourcePointPx {
  readonly x: number;
  readonly y: number;
  readonly __sourcePx: typeof sourcePxBrand;
}
export interface LengthM {
  readonly value: number;
  readonly __lengthM: typeof lengthMBrand;
}
export interface WorldHex {
  readonly q: number;
  readonly r: number;
  readonly __worldHex: typeof worldHexBrand;
}

export const fieldPointM = (x: number, y: number): FieldPointM =>
  ({ x, y }) as FieldPointM;
export const fieldVectorM = (x: number, y: number): FieldVectorM =>
  ({ x, y }) as FieldVectorM;
export const viewportPointPx = (x: number, y: number): ViewportPointPx =>
  ({ x, y }) as ViewportPointPx;
export const viewportVectorPx = (x: number, y: number): ViewportVectorPx =>
  ({ x, y }) as ViewportVectorPx;
export const clientPointPx = (x: number, y: number): ClientPointPx =>
  ({ x, y }) as ClientPointPx;
export const sourcePointPx = (x: number, y: number): SourcePointPx =>
  ({ x, y }) as SourcePointPx;
export const lengthM = (value: number): LengthM => ({ value }) as LengthM;
export const worldHex = (q: number, r: number): WorldHex =>
  ({ q, r }) as WorldHex;

export function composeAffine(outer: Affine2, inner: Affine2): Affine2 {
  return {
    a: outer.a * inner.a + outer.c * inner.b,
    b: outer.b * inner.a + outer.d * inner.b,
    c: outer.a * inner.c + outer.c * inner.d,
    d: outer.b * inner.c + outer.d * inner.d,
    e: outer.a * inner.e + outer.c * inner.f + outer.e,
    f: outer.b * inner.e + outer.d * inner.f + outer.f,
  };
}

/** Every component finite: the precondition for composing or inverting a container matrix. */
export function isFiniteAffine(m: Affine2): boolean {
  return [m.a, m.b, m.c, m.d, m.e, m.f].every(Number.isFinite);
}

/** Null for non-invertible (singular or non-finite) matrices. */
export function invertAffine(m: Affine2): Affine2 | null {
  const det = m.a * m.d - m.b * m.c;
  if (!Number.isFinite(det) || det === 0) return null;
  const invDet = 1 / det;
  const a = m.d * invDet;
  const b = -m.b * invDet;
  const c = -m.c * invDet;
  const d = m.a * invDet;
  const e = -(a * m.e + c * m.f);
  const f = -(b * m.e + d * m.f);
  if (![a, b, c, d, e, f].every(Number.isFinite)) return null;
  return { a, b, c, d, e, f };
}

export function applyWorldToViewport(m: Affine2, p: FieldPointM): ViewportPointPx {
  return viewportPointPx(
    m.a * p.x + m.c * p.y + m.e,
    m.b * p.x + m.d * p.y + m.f,
  );
}

export function applyViewportToWorld(m: Affine2, p: ViewportPointPx): FieldPointM {
  return fieldPointM(m.a * p.x + m.c * p.y + m.e, m.b * p.x + m.d * p.y + m.f);
}

/** Vectors ignore translation, so a vector never acquires a point's offset. */
export function applyWorldVector(m: Affine2, v: FieldVectorM): ViewportVectorPx {
  return viewportVectorPx(m.a * v.x + m.c * v.y, m.b * v.x + m.d * v.y);
}

export function applyWorldToClient(m: Affine2, p: FieldPointM): ClientPointPx {
  return clientPointPx(m.a * p.x + m.c * p.y + m.e, m.b * p.x + m.d * p.y + m.f);
}

export function applyClientToWorld(m: Affine2, p: ClientPointPx): FieldPointM {
  return fieldPointM(m.a * p.x + m.c * p.y + m.e, m.b * p.x + m.d * p.y + m.f);
}

/** Uniform top-down scale: a === d > 0 and no shear (b === c === 0). */
export function isUniformScale(m: Affine2): boolean {
  return m.a > 0 && m.a === m.d && m.b === 0 && m.c === 0;
}
