<script lang="ts">
  import type { TreeNode } from '../../../engine/tree';
  import type { GameState } from '../sim/types';
  import { lineName } from '../sim/craft';
  import { tree } from '../engine/client';
  import { allocateTreePath, treePath } from '../sim/tree';

  let { nodes, graph, layout, game, selectedId, verdict, onselect, onbuy }: {
    nodes: TreeNode[];
    graph: { start: { x: number; y: number } };
    /** The derived world the board draws over — the engine lays the tree out, the board only views it. */
    layout: { x: number; y: number; width: number; height: number; nodeRadius: number };
    game: GameState;
    selectedId: string;
    verdict: { ok: boolean; why?: string };
    onselect: (id: string) => void;
    onbuy: (id: string) => void;
  } = $props();

  const selected = $derived(nodes.find((node: TreeNode) => node.id === selectedId) || nodes[0]);
  const ownedRank = (id: string) => game.player.treeRanks?.[id] || 0;
  const links = $derived.by(() => {
    const found = new Map<string, { x1: number; y1: number; x2: number; y2: number; wing: string }>();
    for (const node of nodes) {
      for (const parent of node.needs) {
        const key = [parent, node.id].sort().join('|');
        if (found.has(key)) continue;
        const from = parent === 'start' ? graph.start : nodes.find((item: TreeNode) => item.id === parent);
        if (!from) continue;
        found.set(key, { x1: from.x, y1: from.y, x2: node.x, y2: node.y, wing: node.wing });
      }
    }
    return [...found.values()];
  });
  const ready = (node: TreeNode) => node.needs.includes('start') || node.needs.some((id) => id !== 'start' && ownedRank(id) > 0);
  /** The name a line reads by, the way the craft bench names it. */
  const lineLabel = (id: string) => lineName(id);
  /** The kinds and the shapes they draw as: a line is a dot, a notable a rounded square, a keystone a
   *  ring, and a capstone a diamond. */
  const shapeOf = (node: TreeNode) => {
    const r = layout.nodeRadius;
    if (node.kind === 'notable') return { kind: 'notable', size: r * 1.7 };
    if (node.kind === 'keystone') return { kind: 'keystone', size: r * 1.9 };
    if (node.kind === 'capstone') return { kind: 'capstone', size: r * 2.1 };
    return { kind: 'line', size: r };
  };

  // ---- the view: a viewport over the derived world, panned and zoomed by hand
  const MIN_ZOOM = 0.35, MAX_ZOOM = 4;
  let view = $state({ x: 0, y: 0, k: 1 });
  let mapEl = $state(null as HTMLDivElement | null);
  const box = $derived({ w: mapEl?.clientWidth || 1, h: mapEl?.clientHeight || 1 });
  /** The viewBox maps the world onto the element, so this is how many world units a screen pixel is. */
  const meet = $derived(Math.min(box.w / layout.width, box.h / layout.height) || 1);
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  const zoomAbout = (factor: number, at?: { x: number; y: number }) => {
    const k2 = clamp(view.k * factor, MIN_ZOOM, MAX_ZOOM);
    const cx = at ? at.x : layout.x + layout.width / 2;
    const cy = at ? at.y : layout.y + layout.height / 2;
    view = { x: ((cx + view.x) * view.k) / k2 - cx, y: ((cy + view.y) * view.k) / k2 - cy, k: k2 };
  };
  const resetView = () => { view = { x: 0, y: 0, k: 1 }; };
  const onWheel = (event: WheelEvent) => {
    event.preventDefault();
    const rect = mapEl?.getBoundingClientRect();
    if (!rect) return;
    const sx = (event.clientX - rect.left) / meet + layout.x;
    const sy = (event.clientY - rect.top) / meet + layout.y;
    zoomAbout(event.deltaY < 0 ? 1.15 : 1 / 1.15, { x: sx - view.x, y: sy - view.y });
  };
  let dragging = $state(null as { x: number; y: number } | null);
  // the drag is tracked on the map itself, not on a captured pointer: a captured pointer would steal
  // the click from the board's own buttons
  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return;
    dragging = { x: event.clientX, y: event.clientY };
  };
  const onPointerMove = (event: PointerEvent) => {
    if (!dragging) return;
    view = { ...view, x: view.x + (event.clientX - dragging.x) / meet, y: view.y + (event.clientY - dragging.y) / meet };
    dragging = { x: event.clientX, y: event.clientY };
  };
  const onPointerUp = () => { dragging = null; };

  // ---- what the board highlights
  let query = $state('');
  const matches = (node: TreeNode) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    if (node.id.toLowerCase().includes(q)) return true;
    if ((node.name || '').toLowerCase().includes(q)) return true;
    return node.grants.some((g) => g.id.toLowerCase().includes(q) || lineLabel(g.id).toLowerCase().includes(q));
  };
  const reachable = $derived(tree.reachableFrom(game.player.treeRanks));
  let hovered = $state(null as string | null);
  const pathNodes = $derived(new Set(tree.pathTo(hovered || selectedId || '', game.player.treeRanks)));
  const pathCost = $derived(hovered ? tree.pathCost(hovered, game.player.treeRanks) : 0);
  const pathOpen = $derived(hovered ? treePath(game, hovered).nodes.length : 0);

  const onNodeClick = (event: MouseEvent, id: string) => {
    onselect(id);
    if (event.shiftKey) allocateTreePath(game, id);
  };
  function onNodeKey(event: KeyboardEvent, id: string) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (event.shiftKey) allocateTreePath(game, id);
      onselect(id);
    }
  }
</script>

<div class="tree-board">
  <div class="tree-map" bind:this={mapEl} style={`--node-r:${layout.nodeRadius}`}
       role="group" onwheel={onWheel} onpointerdown={onPointerDown} onpointermove={onPointerMove} onpointerup={onPointerUp}
       aria-label="Connected passive skill tree">
    <svg viewBox={`${layout.x} ${layout.y} ${layout.width} ${layout.height}`} role="group" aria-label="Passive tree with its wings and their nodes">
      <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
        <g class="tree-links" aria-hidden="true">
          {#each links as link, index (index)}
            {@const active = link.wing && (ownedRank(nodes.find((node: TreeNode) => node.x === link.x2 && node.y === link.y2)?.id || '') > 0)}
            <line class:active x1={link.x1} y1={link.y1} x2={link.x2} y2={link.y2} />
          {/each}
        </g>
        <g class="tree-start" aria-label="Starting point">
          <circle cx={graph.start.x} cy={graph.start.y} r={layout.nodeRadius} />
          <path d={`M${graph.start.x - layout.nodeRadius * 0.45} ${graph.start.y}l${layout.nodeRadius * 0.45} -${layout.nodeRadius * 0.45}l${layout.nodeRadius * 0.45} ${layout.nodeRadius * 0.45}l-${layout.nodeRadius * 0.45} ${layout.nodeRadius * 0.45}z`} />
        </g>
        {#each nodes as node (node.id)}
          {@const rank = ownedRank(node.id)}
          {@const shape = shapeOf(node)}
          <g
            class="tree-node {node.wing} {shape.kind}"
            class:selected={selectedId === node.id}
            class:owned={rank > 0}
            class:ready={ready(node)}
            class:reachable={reachable.has(node.id)}
            class:dimmed={!matches(node)}
            class:on-path={pathNodes.has(node.id)}
            role="button"
            tabindex="0"
            aria-pressed={selectedId === node.id}
            aria-label={`${node.wing} node ${node.index}, ${node.kind}, ${node.grants.map((g) => g.id).join(' and ')}, rank ${rank} of ${node.ranks}${ready(node) ? ', connected' : ', not connected'}`}
            transform={`translate(${node.x} ${node.y})`}
            onclick={(event) => onNodeClick(event, node.id)}
            onkeydown={(event) => onNodeKey(event, node.id)}
            onpointerenter={() => (hovered = node.id)}
            onpointerleave={() => (hovered = null)}
          >
            <title>{node.id} · {node.kind} · {node.grants.map((g) => g.id).join(', ')} · {rank}/{node.ranks} ranks{node.rule ? ` · ${node.rule.kind} ${node.rule.target}` : ''}</title>
            {#if shape.kind === 'notable'}
              <rect class="shape" x={-shape.size} y={-shape.size} width={shape.size * 2} height={shape.size * 2} rx={shape.size * 0.35} />
            {:else if shape.kind === 'keystone'}
              <circle class="shape" r={shape.size} />
              <circle class="core" r={shape.size * 0.42} />
            {:else if shape.kind === 'capstone'}
              <path class="shape" d={`M0 ${-shape.size}L${shape.size} 0L0 ${shape.size}L${-shape.size} 0Z`} />
            {:else}
              <circle class="shape" r={shape.size} />
            {/if}
            {#if rank > 0}<circle class="rank-mark" cx={layout.nodeRadius * 1.35} cy={-layout.nodeRadius * 1.35} r={layout.nodeRadius * 0.45} />{/if}
          </g>
        {/each}
      </g>
    </svg>
    <div class="tree-tools" role="group" aria-label="The board's view">
      <button class="btn btn-flat" type="button" onclick={() => zoomAbout(1.2)} aria-label="Zoom in">+</button>
      <button class="btn btn-flat" type="button" onclick={() => zoomAbout(1 / 1.2)} aria-label="Zoom out">−</button>
      <button class="btn btn-flat" type="button" onclick={resetView} aria-label="Reset the view">⌂</button>
    </div>
  </div>
  <aside class="tree-detail">
    <div class="tree-controls">
      <label class="tree-search">
        <span>Find</span>
        <input type="search" placeholder="a node, a line…" bind:value={query} />
      </label>
      <div class="tree-purse">
        <span title="Tree points — what an ordinary rank costs">{game.player.treePoints} tree</span>
        <span title="Attainment points — what a keystone costs">{game.player.attainmentPoints ?? 0} attain</span>
      </div>
    </div>
    {#if selected}
      {@const rank = ownedRank(selected.id)}
      <div class="detail-top">
        <span class="branch-label">{selected.wing}</span>
        <b>{selected.id}</b>
      </div>
      <h3>{selected.name || selected.grants.map((g) => lineLabel(g.id)).join(' · ')}</h3>
      <p>{selected.weapon ? `Active while holding ${selected.weapon}. ` : ''}{ready(selected) ? 'Connected to an owned path' : 'Connect through a neighbouring node first'}</p>
      {#if selected.rule}
        <p class="rule-line">Keystone drawback — you no longer receive {lineLabel(selected.rule.target)}.</p>
      {/if}
      <div class="grant-list" aria-label="The lines this node grants">
        {#each selected.grants as grant (grant.id)}
          <div class="grant">
            <span class="grant-line">{lineLabel(grant.id)}</span>
            <span class="grant-ranks">
              {#each grant.values as value, index (index)}
                <span class:owned-rank={rank >= index + 1}>
                  <small>Rank {index + 1}</small>
                  <b>{value}</b>
                </span>
              {/each}
            </span>
          </div>
        {/each}
      </div>
      <div class="detail-actions">
        <button disabled={!verdict.ok} title={verdict.why || 'Buy one rank'} onclick={() => onbuy(selected.id)}>
          {rank >= selected.ranks ? 'Fully ranked' : `Buy Rank ${rank + 1}`}
        </button>
        {#if !verdict.ok}<small>{verdict.why}</small>{/if}
        {#if pathOpen > 0}
          <small>Shift-click buys the {pathOpen}-node path to it for {pathCost} point{pathCost === 1 ? '' : 's'}.</small>
        {/if}
      </div>
    {/if}
  </aside>
</div>

<style>
  .tree-board { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); gap: var(--spacing-md); flex: 1; min-width: 0; min-height: 0; overflow: hidden; }
  .tree-map { position: relative; display: grid; place-items: center; min-width: 0; min-height: 0; overflow: hidden; cursor: grab; touch-action: none; background: radial-gradient(ellipse at center, color-mix(in srgb, var(--ground-2) 64%, transparent), transparent 70%); }
  .tree-map:active { cursor: grabbing; }
  .tree-map svg { width: 100%; height: 100%; min-height: 0; overflow: visible; }
  .tree-links line { stroke: var(--line); stroke-width: calc(var(--node-r) * 0.32); stroke-opacity: 0.62; }
  .tree-links line.active { stroke: var(--gold); stroke-opacity: 0.8; }
  .tree-start circle { fill: var(--gold); stroke: var(--bg); stroke-width: calc(var(--node-r) * 0.24); }
  .tree-start path { fill: var(--bg); }
  .tree-node { cursor: pointer; outline: none; transition: opacity var(--motion-fast) var(--ease-ui); }
  .tree-node .shape { fill: var(--panel); stroke: var(--line); stroke-width: calc(var(--node-r) * 0.24); transition: fill var(--motion-fast) var(--ease-ui), stroke var(--motion-fast) var(--ease-ui); }
  .tree-node.impact .shape { stroke: var(--hot); }
  .tree-node.control .shape { stroke: var(--mana-lit); }
  .tree-node.stream .shape { stroke: var(--good-lit); }
  .tree-node.ready .shape { fill: var(--ground-2); }
  .tree-node.owned .shape { fill: var(--gold); stroke: var(--gold); }
  .tree-node.reachable .shape { stroke-dasharray: calc(var(--node-r) * 0.7) calc(var(--node-r) * 0.45); }
  .tree-node.on-path .shape { stroke: var(--focus); stroke-width: calc(var(--node-r) * 0.4); }
  .tree-node.dimmed { opacity: 0.25; }
  .tree-node.selected .shape, .tree-node:focus-visible .shape { stroke: var(--focus); stroke-width: calc(var(--node-r) * 0.38); }
  .tree-node:hover .shape { fill: var(--focus); }
  .tree-node.keystone .core { fill: var(--bg); stroke: none; }
  .tree-node .rank-mark { fill: var(--text); stroke: var(--bg); stroke-width: calc(var(--node-r) * 0.12); }
  .tree-tools { position: absolute; right: var(--spacing-xs); bottom: var(--spacing-xs); display: flex; gap: var(--spacing-xs); }
  .tree-tools button { min-width: 2.2em; font-family: var(--num); }
  .tree-detail { display: flex; flex-direction: column; gap: var(--spacing-sm); min-width: 0; min-height: 0; padding: var(--spacing-md); border-left: 1px solid var(--edge); background: color-mix(in srgb, var(--panel) 55%, transparent); overflow: auto; }
  .tree-controls { display: flex; flex-wrap: wrap; align-items: end; gap: var(--spacing-sm); padding-bottom: var(--spacing-sm); border-bottom: 1px solid var(--edge); }
  .tree-search { display: grid; gap: var(--spacing-xs); flex: 1; min-width: 0; }
  .tree-search span { color: var(--dim); font-size: var(--font-xs); text-transform: uppercase; letter-spacing: 1px; }
  .tree-search input { width: 100%; }
  .tree-purse { display: flex; gap: var(--spacing-sm); color: var(--gold-lit); font-variant-numeric: tabular-nums; font-size: var(--font-xs); }
  .detail-top { display: flex; justify-content: space-between; align-items: center; gap: var(--spacing-xs); color: var(--dim); }
  .branch-label { text-transform: capitalize; }
  .tree-detail h3 { color: var(--gold); text-transform: capitalize; }
  .tree-detail p { margin: 0; color: var(--dim); }
  .tree-detail p.rule-line { color: var(--alarm); }
  .grant-list { display: grid; gap: var(--spacing-sm); }
  .grant { display: grid; gap: var(--spacing-xs); }
  .grant-line { color: var(--dim); text-transform: capitalize; }
  .grant-ranks { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--spacing-xs); }
  .grant-ranks span { display: grid; justify-items: center; gap: var(--spacing-xs); padding: var(--spacing-xs); border: 1px solid var(--line); color: var(--dim); font-variant-numeric: tabular-nums; }
  .grant-ranks span.owned-rank { border-color: var(--gold); color: var(--gold); }
  .detail-actions { display: grid; gap: var(--spacing-xs); }
  .detail-actions small { color: var(--dim); }
</style>
