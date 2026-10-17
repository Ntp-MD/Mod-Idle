<script lang="ts">
  import type { TreeNode } from '../../../engine/tree';
  import type { GameState } from '../sim/types';

  let { nodes, graph, state, selectedId, verdict, onselect, onbuy }: {
    nodes: TreeNode[];
    graph: { start: { x: number; y: number } };
    state: GameState;
    selectedId: string;
    verdict: { ok: boolean; why?: string };
    onselect: (id: string) => void;
    onbuy: (id: string) => void;
  } = $props();

  const selected = $derived(nodes.find((node: TreeNode) => node.id === selectedId) || nodes[0]);
  const ownedRank = (id: string) => state.player.treeRanks?.[id] || 0;
  const links = $derived.by(() => {
    const found = new Map<string, { x1: number; y1: number; x2: number; y2: number; branch: string }>();
    for (const node of nodes) {
      for (const parent of node.needs) {
        const key = [parent, node.id].sort().join('|');
        if (found.has(key)) continue;
        const from = parent === 'start' ? graph.start : nodes.find((item: TreeNode) => item.id === parent);
        if (!from) continue;
        found.set(key, { x1: from.x, y1: from.y, x2: node.x, y2: node.y, branch: node.branch });
      }
    }
    return [...found.values()];
  });
  const ready = (node: TreeNode) => node.needs.includes('start') || node.needs.some((id) => id !== 'start' && ownedRank(id) > 0);
  function onNodeKey(event: KeyboardEvent, id: string) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    onselect(id);
  }
</script>

<div class="tree-board">
  <div class="tree-map" aria-label="Connected passive skill tree">
    <svg viewBox="0 0 100 100" role="group" aria-label="Passive tree with three connected branches">
      <g class="tree-links" aria-hidden="true">
        {#each links as link, index (index)}
          {@const active = link.branch && (ownedRank(nodes.find((node: TreeNode) => node.x === link.x2 && node.y === link.y2)?.id || '') > 0)}
          <line class:active x1={link.x1} y1={link.y1} x2={link.x2} y2={link.y2} />
        {/each}
      </g>
      <g class="tree-start" aria-label="Starting point">
        <circle cx={graph.start.x} cy={graph.start.y} r="2.3" />
        <path d={`M${graph.start.x - 1} ${graph.start.y}l1 -1l1 1l-1 1z`} />
      </g>
      {#each nodes as node (node.id)}
        {@const rank = ownedRank(node.id)}
        <g
          class="tree-node {node.branch}"
          class:selected={selectedId === node.id}
          class:owned={rank > 0}
          class:ready={ready(node)}
          role="button"
          tabindex="0"
          aria-pressed={selectedId === node.id}
          aria-label={`${node.branch} node ${node.index}, ${node.line}, rank ${rank} of ${node.ranks}${ready(node) ? ', connected' : ', not connected'}`}
          transform={`translate(${node.x} ${node.y})`}
          onclick={() => onselect(node.id)}
          onkeydown={(event) => onNodeKey(event, node.id)}
        >
          <title>{node.id} · {node.line} · {rank}/{node.ranks} ranks</title>
          <circle r="1.05" />
          {#if rank > 0}<circle class="rank-mark" cx="1.4" cy="-1.4" r="0.45" />{/if}
        </g>
      {/each}
    </svg>
  </div>
  {#if selected}
    {@const rank = ownedRank(selected.id)}
    <aside class="tree-detail">
      <div class="detail-top">
        <span class="branch-label">{selected.branch}</span>
        <b>{selected.id}</b>
      </div>
      <h3>{selected.name || selected.line.replaceAll('_', ' ')}</h3>
      <p>{selected.weapon ? `Active while holding ${selected.weapon}. ` : ''}{ready(selected) ? 'Connected to an owned path' : 'Connect through a neighbouring node first'}</p>
      <div class="rank-table" aria-label="Node rank values">
        {#each selected.values as value, index (index)}
          <span class:owned-rank={rank >= index + 1}>
            <small>Rank {index + 1}</small>
            <b>{value}</b>
          </span>
        {/each}
      </div>
      <div class="detail-actions">
        <button disabled={!verdict.ok} title={verdict.why || 'Buy one rank'} onclick={() => onbuy(selected.id)}>
          {rank >= selected.ranks ? 'Fully ranked' : `Buy Rank ${rank + 1}`}
        </button>
        {#if !verdict.ok}<small>{verdict.why}</small>{/if}
      </div>
    </aside>
  {/if}
</div>

<style>
  .tree-board { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); gap: var(--spacing-md); flex: 1; min-width: 0; min-height: 0; overflow: hidden; }
  .tree-map { display: grid; place-items: center; min-width: 0; min-height: 0; overflow: hidden; background: radial-gradient(ellipse at center, color-mix(in srgb, var(--ground-2) 64%, transparent), transparent 70%); }
  .tree-map svg { width: 100%; height: 100%; min-height: 0; overflow: visible; }
  .tree-links line { stroke: var(--line); stroke-width: 0.34; stroke-opacity: 0.62; }
  .tree-links line.active { stroke: var(--gold); stroke-opacity: 0.8; }
  .tree-start circle { fill: var(--gold); stroke: var(--bg); stroke-width: 0.5; }
  .tree-start path { fill: var(--bg); }
  .tree-node { cursor: pointer; outline: none; }
  .tree-node circle:first-of-type { fill: var(--panel); stroke: var(--line); stroke-width: 0.5; transition: fill var(--motion-fast) var(--ease-ui), stroke var(--motion-fast) var(--ease-ui); }
  .tree-node.impact circle:first-of-type { stroke: var(--hot); }
  .tree-node.control circle:first-of-type { stroke: var(--mana-lit); }
  .tree-node.stream circle:first-of-type { stroke: var(--good-lit); }
  .tree-node.ready circle:first-of-type { fill: var(--ground-2); }
  .tree-node.owned circle:first-of-type { fill: var(--gold); stroke: var(--gold); }
  .tree-node.selected circle:first-of-type, .tree-node:focus-visible circle:first-of-type { stroke: var(--focus); stroke-width: 0.8; }
  .tree-node:hover circle:first-of-type { fill: var(--focus); }
  .tree-node .rank-mark { fill: var(--text); stroke: var(--bg); stroke-width: 0.25; }
  .tree-detail { display: flex; flex-direction: column; gap: var(--spacing-sm); min-width: 0; min-height: 0; padding: var(--spacing-md); border-left: 1px solid var(--edge); background: color-mix(in srgb, var(--panel) 55%, transparent); }
  .detail-top { display: flex; justify-content: space-between; align-items: center; gap: var(--spacing-xs); color: var(--dim); }
  .branch-label { text-transform: capitalize; }
  .tree-detail h3 { color: var(--gold); text-transform: capitalize; }
  .tree-detail p { margin: 0; color: var(--dim); }
  .rank-table { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--spacing-xs); }
  .rank-table span { display: grid; justify-items: center; gap: var(--spacing-xs); padding: var(--spacing-xs); border: 1px solid var(--line); color: var(--dim); font-variant-numeric: tabular-nums; }
  .rank-table span.owned-rank { border-color: var(--gold); color: var(--gold); }
  .detail-actions { display: grid; gap: var(--spacing-xs); }
  .detail-actions small { color: var(--dim); }
</style>
