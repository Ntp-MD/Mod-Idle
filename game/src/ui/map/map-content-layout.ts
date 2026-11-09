/** The sole sizing owner for in-hex content. Values are reference map-plan units, never CSS pixels. */
export const HEX_CONTENT_SIZING = Object.freeze({
  referenceRadius: 15,
  inset: 0.75,
  iconSize: 2.6,
  iconGap: 0.4,
  iconY: 3.3,
  maxIcons: 16,
  iconsPerRowMax: 6,
  nameY: -6.1,
  nameFont: 3.6,
  nameCharacters: 16,
  levelY: -0.5,
  levelFont: 3,
  overflowY: 10.2,
  overflowFont: 2.6,
  textOutline: 0.6,
  lineHeight: 1.4,
  uniqueGlow: 0.7,
  uniqueStroke: 0.45,
});

export interface HexContentTextLayout {
  readonly y: number;
  readonly fontSize: number;
  readonly height: number;
  readonly maxWidth: number;
}

export interface HexContentLayout {
  readonly radius: number;
  readonly safeRadius: number;
  readonly name: HexContentTextLayout;
  readonly level: HexContentTextLayout;
  readonly overflow: HexContentTextLayout;
  readonly nameCharacters: number;
  readonly textOutline: number;
  readonly uniqueGlow: number;
  readonly uniqueStroke: number;
  readonly icons: readonly Readonly<{ x: number; y: number; size: number }>[];
  readonly extra: number;
}

/** Split a count into balanced row counts that respect per-row capacity. */
function layoutRowCounts(count: number, caps: readonly number[]): number[] {
  if (count <= 0) return [];
  const rows = count <= caps[0] ? 1 : count <= caps[0] + caps[1] ? 2 : caps.length;
  const counts = Array.from({ length: rows }, () => 0);
  for (let i = 0; i < count; i++) counts[i % rows] += 1;
  // Move excess off narrower bottom rows to top rows with space.
  for (let r = 0; r < rows; r++) {
    while (counts[r] > caps[r]) {
      counts[r] -= 1;
      let placed = false;
      for (let t = 0; t < rows; t++) {
        if (counts[t] < caps[t]) { counts[t] += 1; placed = true; break; }
      }
      if (!placed) throw new RangeError('map: hex content sizing exceeds its safe area');
    }
  }
  return counts;
}

/** Available width across a pointy regular hex, including its tapered top and bottom. */
function widthAt(radius: number, y: number): number {
  return Math.max(0, Math.min(Math.sqrt(3) * radius, 2 * Math.sqrt(3) * (radius - Math.abs(y))));
}

/** Every role, asset resolution and icon count uses the same icon size relative to the cell. */
export function layoutHexContent(radius: number, iconCount: number): HexContentLayout {
  if (!Number.isFinite(radius) || radius <= 0) throw new RangeError('map: hex radius must be finite and positive');
  if (!Number.isSafeInteger(iconCount) || iconCount < 0) throw new RangeError('map: icon count must be a nonnegative integer');
  const p = HEX_CONTENT_SIZING, unit = radius / p.referenceRadius;
  const safeRadius = radius - p.inset * unit;
  const outline = p.textOutline * unit;
  const text = (y: number, font: number): HexContentTextLayout => {
    const center = y * unit, fontSize = font * unit;
    const height = fontSize * p.lineHeight + outline;
    return { y: center, fontSize, height,
      maxWidth: Math.min(widthAt(safeRadius, center - height / 2), widthAt(safeRadius, center + height / 2)) - outline };
  };
  const size = p.iconSize * unit, gap = p.iconGap * unit;
  const name = text(p.nameY, p.nameFont), level = text(p.levelY, p.levelFont), overflow = text(p.overflowY, p.overflowFont);
  if (iconCount > p.maxIcons) {
    throw new RangeError(`map: hex content capacity ${p.maxIcons} exceeded by ${iconCount} icons`);
  }
  // Largest single icon size that fits the R0-confirmed maximum (16) in
  // three rows [6,6,4] inside the tapered safe hex. Row capacities derive
  // from the safe width at each row centre — never a per-hex shrink.
  const rowY = (row: number) => (p.iconY + row * (p.iconSize + p.iconGap)) * unit - size / 2;
  const rowCaps = [0, 1, 2].map((row) => {
    const centre = (p.iconY + row * (p.iconSize + p.iconGap)) * unit;
    const avail = Math.min(widthAt(safeRadius, centre - size / 2), widthAt(safeRadius, centre + size / 2));
    return Math.max(1, Math.floor((avail + gap) / (size + gap)));
  });
  const rowCounts = layoutRowCounts(iconCount, rowCaps);
  if (rowCounts.length > rowCaps.length) throw new RangeError('map: hex content sizing exceeds its safe area');
  for (const [row, count] of rowCounts.entries()) {
    const widths = count * size + Math.max(0, count - 1) * gap;
    const centre = (p.iconY + row * (p.iconSize + p.iconGap)) * unit;
    const avail = Math.min(widthAt(safeRadius, centre - size / 2), widthAt(safeRadius, centre + size / 2));
    if (widths > avail + 1e-9) throw new RangeError('map: hex content sizing exceeds its safe area');
  }
  if (![name.maxWidth, level.maxWidth, overflow.maxWidth].every(Number.isFinite)
    || Math.min(name.maxWidth, level.maxWidth, overflow.maxWidth) <= 0
    || name.y + name.height / 2 >= level.y - level.height / 2
    || (rowCounts.length > 0 && level.y + level.height / 2 >= rowY(0))) {
    throw new RangeError('map: hex content sizing exceeds its safe area');
  }
  const icons: { x: number; y: number; size: number }[] = [];
  rowCounts.forEach((count, row) => {
    for (let i = 0; i < count; i++) {
      icons.push({ x: (i - (count - 1) / 2) * (size + gap) - size / 2, y: rowY(row), size });
    }
  });
  return { radius, safeRadius, name, level, overflow, nameCharacters: p.nameCharacters,
    textOutline: outline, uniqueGlow: p.uniqueGlow * unit, uniqueStroke: p.uniqueStroke * unit,
    extra: 0, icons };
}
