/** Presentation-only selection over the actual player candidate pool. Angles are requested bearings. */
export function normalizeFacing(degrees: number) { return ((degrees % 360) + 360) % 360; }
export function facingSample(degrees: number, directions: 16 | 32) {
  const index = Math.round(normalizeFacing(degrees) / (360 / directions)) % directions;
  const angle = index * 360 / directions;
  return { index, angle, sourceRow: index * (32 / directions),
    error: ((angle - normalizeFacing(degrees) + 540) % 360) - 180 };
}
