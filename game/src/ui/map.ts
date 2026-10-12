import { eng } from '../engine/client';
import { E } from '../engine/client';
import { settlementById } from '../sim/town';
import { ownerOf, rankOf, currentCell, walkedCells, trailCells, cellsTo } from '../sim/road';

/**
 * The map cluster's own reader — the geometry and the sheet repaint that `App.svelte` used to hold
 * inline. These are pure over the data and the generated sheet: they read the engine's cell keys and
 * paint the DOM the `{@html}` rebuild left behind, and they write no reactive state of their own, so
 * `App` keeps the `$state` and calls these from its effect and its pick handler.
 */

/** The clicked cell, read off the sheet's own marks: town · sub-zone · wild side · bare ground. */
export type Picked = { key: string; q: number; r: number; kind: 'town' | 'sub' | 'wild' | 'bare'; label: string; sub: number | null; wild: number | null };

/** The band ramp: dark green at the first band of levels, deep red at the last. */
export const ramp = (band: number) => {
  const t = band / (E.mob.zones.length - 1);
  return `hsl(${Math.round(94 - 82 * t)} 36% ${Math.round(20 + 20 * t)}%)`;
};

/** What a cell is called, read off the sheet's own marks. */
export function cellLabel(node: Element): Picked {
  const ax = (node.getAttribute('data-ax') || '0,0').split(',').map(Number);
  const key = node.getAttribute('data-cell') || '';
  const sub = node.getAttribute('data-sub');
  const wild = node.getAttribute('data-wild');
  const id = node.getAttribute('data-node');
  const h = { q: ax[0], r: ax[1] };
  if (id && rankOf(h) === 0) return { key, q: h.q, r: h.r, kind: 'town', label: settlementById(id)!.name, sub: null, wild: null };
  if (id && sub != null) {
    const s = settlementById(id)!;
    return { key, q: h.q, r: h.r, kind: 'sub', label: (eng.zoneById(s.zone).subzones || [])[Number(sub)]?.name || '', sub: Number(sub), wild: null };
  }
  if (id && wild != null) {
    const s = settlementById(id)!, w = Number(wild);
    return { key, q: h.q, r: h.r, kind: 'wild', wild: w, label: w === 0 ? s.name + ' Dungeon' : s.name + ' ' + (w + 1), sub: null };
  }
  const own = ownerOf(h);
  return { key, q: h.q, r: h.r, kind: 'bare', label: `${key} · ${own ? settlementById(own.id)!.name : 'the field'}`, sub: null, wild: null };
}

/** The view, gate floor and the two overlays, plus the pick and the walk the state carries. */
export type PaintOpts = {
  view: 'terrain' | 'band' | 'gate';
  gateLevel: number;
  showIds: boolean;
  showWalk: boolean;
  pickedCell: Picked | null;
  gameState: any;
};

/**
 * The sheet is repainted after every `{@html}` rebuild: the fills follow the view, the walk graph
 * and the cell ids show or hide, and the plotted route lights up one cell per block — the cells
 * already crossed in a darker tone. It matches the engine's own cell keys against the labels the
 * generated sheet carries, so no position table is ever read (X33 · M7 · M10). The hex the feet are
 * on is marked where it lies, and a character mark is built once and then moved cell to cell, so a
 * walk reads as a walk rather than a jump.
 */
export function paintSheet(root: HTMLElement, opts: PaintOpts) {
  const { view: v, gateLevel: lv, showIds: ids, showWalk: hops, pickedCell, gameState } = opts;
  const walk = gameState.walk;
  for (const p of Array.from(root.querySelectorAll('polygon.cell'))) {
    p.classList.remove('locked');
    if (v === 'terrain') p.setAttribute('fill', p.getAttribute('data-tone') || 'none');
    else if (!p.hasAttribute('data-lo')) p.setAttribute('fill', 'none');
    else {
      p.setAttribute('fill', ramp(Number(p.getAttribute('data-band'))));
      // the gate holds the fill as a state the stylesheet paints (`--ground`), not a second colour here
      if (v !== 'band' && lv < Number(p.getAttribute('data-lo'))) p.classList.add('locked');
    }
    p.classList.remove('route', 'walked', 'picked', 'standing');
  }
  const toggle = (id: string, on: boolean) => {
    const g = root.querySelector('#' + id) as HTMLElement | null;
    if (g) g.style.display = on ? '' : 'none';
  };
  toggle('ids', ids);
  toggle('walk', hops);
  const regions = root.querySelector('#regions') as HTMLElement | null;
  if (regions) regions.style.opacity = v === 'terrain' ? '1' : '0';
  if (pickedCell) {
    const crossed = new Set(walkedCells(gameState));
    const keys = walk ? trailCells(gameState) : cellsTo(gameState, { q: pickedCell.q, r: pickedCell.r });
    keys.forEach((k: string) => {
      const cell = root.querySelector(`polygon.cell[data-ax="${k}"]`);
      if (cell) cell.classList.add(crossed.has(k) ? 'walked' : 'route');
    });
    root.querySelector(`polygon.cell[data-ax="${pickedCell.q},${pickedCell.r}"]`)?.classList.add('picked');
  }
  // the hex the feet are on is marked where it lies, so standing is read off the ground itself
  const feet = currentCell(gameState);
  const at = root.querySelector(`polygon.cell[data-ax="${feet.q},${feet.r}"]`);
  at?.classList.add('standing');
  // …and the character stands on it, one hex per block: the cell's own hexagon washed in the accent and
  // a mark at its centre, both read off the geometry the sheet already carries (X33 · M7). Every cell is
  // the same hexagon translated, so the mark is built once and then *moved* — the sheet slides it to the
  // next cell, and a walk reads as a walk rather than as a jump.
  const svg = root.querySelector('svg');
  if (svg && at) {
    let you = svg.querySelector('g.you');
    const pts = (at.getAttribute('points') || '').trim().split(/\s+/).map((p: string) => p.split(',').map(Number));
    const cx = pts.reduce((n: number, p: number[]) => n + p[0], 0) / pts.length;
    const cy = pts.reduce((n: number, p: number[]) => n + p[1], 0) / pts.length;
    if (!you) {
      const NS = 'http://www.w3.org/2000/svg';
      you = document.createElementNS(NS, 'g');
      you.setAttribute('class', 'you');
      const hex = document.createElementNS(NS, 'polygon');
      hex.setAttribute('class', 'hex');
      hex.setAttribute('points', pts.map(([x, y]: number[]) => `${(x - cx).toFixed(1)},${(y - cy).toFixed(1)}`).join(' '));
      const mark = document.createElementNS(NS, 'path');
      mark.setAttribute('class', 'mark');
      mark.setAttribute('d', 'M0 -10L7.5 0L0 10L-7.5 0Z');
      you.append(hex, mark);
      svg.appendChild(you);
    }
    you.setAttribute('transform', `translate(${cx.toFixed(1)} ${cy.toFixed(1)})`);
    you.classList.toggle('walking', !!walk);
  }
}
