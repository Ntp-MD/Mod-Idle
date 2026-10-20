<script lang="ts">
  type Cell = { q: number; r: number };
  let { markup, cell, onopen }: { markup: string; cell: Cell | null; onopen: () => void } = $props();

  // The thumbnail shares no DOM with the sheet: every id, title and label is stripped, only the
  // cells' fills and the settlement dots survive — a second inline copy of the sheet would collide
  // the ids the map screen's repaint effect queries (X33 · M7).
  const thumb = $derived.by(() => {
    const doc = new DOMParser().parseFromString(markup, 'image/svg+xml');
    const svg = doc.documentElement;
    const base = (svg.getAttribute('data-plan-view-box') || svg.getAttribute('viewBox') || '0 0 100 100').split(/\s+/).map(Number);
    let cells = '';
    for (const p of Array.from(svg.querySelectorAll('polygon.cell'))) {
      p.querySelector('title')?.remove();
      cells += p.outerHTML;
    }
    let dots = '';
    for (const g of Array.from(svg.querySelectorAll('g.node'))) {
      const m = /translate\(([-\d.]+),([-\d.]+)\)\s*scale\(([\d.]+)\)/.exec(g.querySelector('use')?.getAttribute('transform') || '');
      if (!m) continue;
      const s = Number(m[3]);
      dots += `<circle class="mdot" cx="${(Number(m[1]) + 16 * s).toFixed(1)}" cy="${(Number(m[2]) + 15 * s).toFixed(1)}" r="9"/>`;
    }
    let you = '';
    let box = base.join(' ');
    if (cell) {
      const at = svg.querySelector(`polygon.cell[data-ax="${cell.q},${cell.r}"]`);
      const pts = (at?.getAttribute('points') || '').trim().split(/\s+/).map((p) => p.split(',').map(Number));
      if (pts.length) {
        const cx = pts.reduce((n, p) => n + p[0], 0) / pts.length;
        const cy = pts.reduce((n, p) => n + p[1], 0) / pts.length;
        you = `<circle class="you-ring" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="30"/><circle class="you-dot" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="9"/>`;
        // local-area crop: the box follows the feet, clamped so it never shows past the sheet's edge
        const [bx, by, bw, bh] = base;
        const w = Math.min(640, bw), h = Math.min(420, bh);
        const x = Math.max(bx, Math.min(cx - w / 2, bx + bw - w));
        const y = Math.max(by, Math.min(cy - h / 2, by + bh - h));
        box = `${x.toFixed(1)} ${y.toFixed(1)} ${w} ${h}`;
      }
    }
    return { body: cells + dots + you, box };
  });
</script>

<button class="mini-map" onclick={onopen} title="Open the map" aria-label="Open the map">
  <svg viewBox={thumb.box} aria-hidden="true">{@html thumb.body}</svg>
  <!-- the two reads a corner map owes: which way is north, and where the feet are on the sheet -->
  <span class="compass" aria-hidden="true">N</span>
  {#if cell}<span class="coord" aria-hidden="true">{cell.q},{cell.r}</span>{/if}
</button>

<style>
  .mini-map {
    position: relative; z-index: var(--z-hud-control);
    width: var(--minimap-size); height: var(--minimap-size);
    border-radius: var(--radius-round); overflow: hidden; cursor: pointer;
    background: var(--glass);
    border: 2px solid color-mix(in srgb, var(--gold) 45%, var(--edge));
    box-shadow: var(--shadow-raised), inset 0 0 0 1px rgba(0, 0, 0, .55);
  }
  .mini-map svg { width: 100%; height: 100%; display: block; }
  .mini-map .compass {
    position: absolute; top: 1px; left: 50%; transform: translateX(-50%);
    font-size: var(--font-xs); font-weight: 700; color: var(--gold);
    text-shadow: 0 1px 2px rgba(0, 0, 0, .95); pointer-events: none;
  }
  .mini-map .coord {
    position: absolute; bottom: 1px; left: 50%; transform: translateX(-50%);
    font-family: var(--num); font-size: var(--font-xs); color: var(--sheet-ink);
    text-shadow: 0 1px 2px rgba(0, 0, 0, .95); pointer-events: none; font-variant-numeric: tabular-nums;
  }
  .mini-map :global(.mcell) { stroke: rgba(0, 0, 0, .35); stroke-width: 1.4; }
  .mini-map :global(.mdot) { fill: var(--sheet-place); stroke: rgba(0, 0, 0, .6); stroke-width: 1.4; }
  .mini-map :global(.you-ring) { fill: none; stroke: var(--gold); stroke-width: 3; opacity: .85; }
  .mini-map :global(.you-dot) { fill: var(--gold); }
  .mini-map:hover { border-color: var(--gold); box-shadow: var(--shadow-raised), 0 0 14px color-mix(in srgb, var(--gold) 30%, transparent); }
  .mini-map:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
</style>
