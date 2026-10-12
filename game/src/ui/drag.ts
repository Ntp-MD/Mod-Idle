/**
 * The drag payload a bag square carries.
 *
 * An item has no stable id (identity is positional: an index into the bag, the body or a stash tab), so
 * a drag names where a piece came from and where it sat when the drag began. The drop re-reads that
 * position against the current state — a bag that shifted under the hand is the same risk every
 * index-addressed verb in the client already carries.
 */
export type DragRef = {
  where: 'pile' | 'carried' | 'worn' | 'stash';
  index: number;
  /** the stash tab a `stash` ref came from */
  tab?: number;
};

const MIME = 'application/x-modworld-piece';

export function setDrag(e: DragEvent, ref: DragRef): void {
  if (!e.dataTransfer) return;
  e.dataTransfer.setData(MIME, JSON.stringify(ref));
  e.dataTransfer.effectAllowed = 'move';
}

export function readDrag(e: DragEvent): DragRef | null {
  const raw = e.dataTransfer?.getData(MIME);
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as DragRef;
    return v && typeof v.index === 'number' && typeof v.where === 'string' ? v : null;
  } catch {
    return null;
  }
}

/**
 * The action bar's own bead. A cast-order row carries no path — its position along the bar is the whole
 * payload — so this is the same vocabulary as a piece drag with no `where` to re-read.
 */
export type CastRef = { index: number };

const CAST_MIME = 'application/x-modworld-castslot';

export function setCastDrag(e: DragEvent, ref: CastRef): void {
  if (!e.dataTransfer) return;
  e.dataTransfer.setData(CAST_MIME, String(ref.index));
  e.dataTransfer.effectAllowed = 'move';
}

export function readCastDrag(e: DragEvent): CastRef | null {
  const raw = e.dataTransfer?.getData(CAST_MIME);
  if (raw == null || raw === '') return null;
  const index = Number(raw);
  return Number.isFinite(index) ? { index } : null;
}
