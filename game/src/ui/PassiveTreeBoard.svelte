<script lang="ts">
  import { onMount, tick } from 'svelte';
  import type { TreeNode } from '../../../engine/tree';
  import type { GameState } from '../sim/types';
  import { lineName } from '../sim/craft';
  import { tree } from '../engine/client';
  import { treePath } from '../sim/tree';
  import { buildPassiveTreeView, treeOrbitPath } from './passive-tree-view';
  import swords from '../icon/gear/crossed-swords-1.png';
  import boots from '../icon/gear/winged-boots.png';
  import bow from '../icon/gear/bow-arrow.png';
  import staff from '../icon/gear/staff.png';
  import shield from '../icon/gear/shield-crest.png';
  import pendant from '../icon/gear/gem-pendant.png';
  import heart from '../icon/skill/heart-beats.png';
  import flame from '../icon/skill/fireball.png';
  import eye from '../icon/skill/eye.png';
  import treeMark from '../icon/ui/tree.png';

  let { nodes, graph, layout, game, selectedId, verdict, onselect, onbuy, onpath }: {
    nodes: TreeNode[];
    graph: { start: { x: number; y: number } };
    layout: { x: number; y: number; width: number; height: number; nodeRadius: number; radii?: Record<string, number> };
    game: GameState;
    selectedId: string;
    verdict: { ok: boolean; why?: string };
    onselect: (id: string) => void;
    onbuy: (id: string) => void;
    onpath: (id: string) => void;
  } = $props();
  const regionNames: Record<string, string> = { str: 'Strength', agi: 'Agility', dex: 'Dexterity', int: 'Intelligence', wis: 'Wisdom', vit: 'Vitality', lck: 'Luck' };
  const regionIcons: Record<string, string> = { str: swords, agi: boots, dex: bow, int: staff, wis: eye, vit: heart, lck: pendant };
  const model = $derived(buildPassiveTreeView(nodes, graph.start));
  const selected = $derived(model.byId[selectedId] || model.nodes[0]);
  const ownedRank = (id: string) => id === 'start' ? 1 : game.player.treeRanks?.[id] || 0;
  const connected = (node: TreeNode) => tree.connected(node.id, game.player.treeRanks);
  const sizeOf = (node: TreeNode) => (layout.radii?.[node.kind] ?? layout.nodeRadius) * 1.3;
  const lineLabel = (id: string) => lineName(id).replace(/_/g, ' ');
  const grantLabel = (grant: TreeNode['grants'][number]) => grant.stat ? regionNames[grant.stat] || grant.stat : (grant.element ? grant.element + ' ' : '') + lineLabel(grant.id);
  const titleOf = (node: TreeNode) => {
    if (node.kind === 'normal' && node.grants[0]?.stat) return grantLabel(node.grants[0]);
    if (node.name && !/^[A-Z]{3} Focus \d+$/.test(node.name)) return node.name;
    return [...new Set(node.grants.map((grant) => grantLabel(grant).replace(/\s+(?:flat|%)$/i, '')))].join(' & ') || node.name || node.id;
  };
  const iconOf = (node: TreeNode) => {
    if (node.kind === 'normal') return regionIcons[node.wing] || pendant;
    const text = [node.id, node.description, ...node.grants.map((g) => g.id), ...(node.effects || []).map((e) => e.key)].join(' ').toLowerCase();
    if (/armour|block|shield|resist/.test(text)) return shield;
    if (/life|hp|regen|leech|blood/.test(text)) return heart;
    if (/speed|move|evade|dodge/.test(text)) return boots;
    if (/fire|cold|lightning|element|burn/.test(text)) return flame;
    if (/spell|mana|cast|aura/.test(text)) return staff;
    if (/crit|accuracy|projectile|bow/.test(text)) return bow;
    if (/attack|physical|weapon|melee|bleed/.test(text)) return swords;
    return regionIcons[node.wing] || eye;
  };
  const currencyName = (currency: string) => currency === 'tree' ? 'tree point' : currency === 'attainment' ? 'attainment point' : currency + ' point';
  const plural = (n: number) => n === 1 ? '' : 's';
  const effectText = (node: TreeNode) => node.description || (node.effects || []).map((e) => e.key.replace(/_/g, ' ')).join(' · ');
  const kindLabel = (kind: string) => kind === 'normal' ? 'Passive' : kind.charAt(0).toUpperCase() + kind.slice(1);
  const allocationReason = $derived((verdict.why || '')
    .replace(/^needs (\d+) banked point$/, (_, count: string) => 'You need ' + count + ' tree point' + (Number(count) === 1 ? '' : 's') + '.')
    .replace(/^needs (\d+) attainment point$/, (_, count: string) => 'You need ' + count + ' attainment point' + (Number(count) === 1 ? '' : 's') + '.')
    .replace('connect this node to an owned path first', 'Allocate an adjacent skill, or follow the route below.'));
  let query = $state('');
  let hovered = $state<string | null>(null);
  let focusedRegion = $state<string | null>(null);
  const searchText = $derived(new Map(nodes.map((node) => [node.id, [node.id, node.name, regionNames[node.wing], titleOf(node), node.description, ...node.grants.map(grantLabel), ...(node.effects || []).map((e) => e.key)].join(' ').toLowerCase()])));
  const matches = (node: TreeNode) => !query.trim() || !!searchText.get(node.id)?.includes(query.trim().toLowerCase());
  const searchResults = $derived(query.trim() ? model.nodes.filter(matches) : []);
  const selectedPath = $derived(treePath(game, selected?.id || ''));
  const pathNodes = $derived(new Set(treePath(game, hovered || selected?.id || '').nodes));
  const selectedConflict = $derived(selected?.kind === 'keystone' ? tree.pairHolder(selected.id, game.player.treeRanks) : null);
  const pathAffordable = $derived(selectedPath.nodes.length > 0 && selectedPath.cost.tree <= game.player.treePoints && selectedPath.cost.attainment <= (game.player.attainmentPoints ?? 0) && !selectedConflict);
  const hoverNode = $derived(hovered ? model.byId[hovered] : null);
  const allocated = $derived(nodes.filter((node) => ownedRank(node.id) > 0).length);
  const links = $derived.by(() => {
    const found = new Map<string, { a: string; b: string; path: string }>();
    const draw = (aId: string, bId: string, shape = 'line') => {
      const key = [aId, bId].sort().join('|');
      if (found.has(key)) return;
      const a = aId === 'start' ? graph.start : model.byId[aId], b = model.byId[bId];
      if (!a || !b) return;
      const group = model.clusterOf.get(aId);
      const path = group && group === model.clusterOf.get(bId) ? treeOrbitPath(a, b, group)
        : shape === 'arc' ? treeOrbitPath(a, b, graph.start) : 'M' + a.x + ' ' + a.y + 'L' + b.x + ' ' + b.y;
      found.set(key, { a: aId, b: bId, path });
    };
    for (const node of model.nodes) for (const parent of node.needs) draw(parent, node.id);
    for (const link of tree.links) draw(link.a, link.b, link.shape);
    return [...found.values()];
  });
  const routeLink = (a: string, b: string) => (pathNodes.has(a) || pathNodes.has(b)) && (pathNodes.has(a) || ownedRank(a) > 0) && (pathNodes.has(b) || ownedRank(b) > 0);
  let mapEl = $state<HTMLDivElement | null>(null);
  let viewportWidth = $state(1), viewportHeight = $state(1);
  let camera = $state({ x: 0, y: 0, zoom: 1.7 });
  const baseScale = $derived(Math.min(viewportWidth / model.bounds.width, viewportHeight / model.bounds.height) || 1);
  const scale = $derived(baseScale * camera.zoom);
  const viewBox = $derived({ x: camera.x - viewportWidth / scale / 2, y: camera.y - viewportHeight / scale / 2, width: viewportWidth / scale, height: viewportHeight / scale });
  const clamp = (v: number, low: number, high: number) => Math.max(low, Math.min(high, v));
  onMount(() => { camera = { x: graph.start.x, y: graph.start.y, zoom: 1.7 }; });
  function zoomBy(factor: number, at?: { x: number; y: number }) {
    const zoom = clamp(camera.zoom * factor, .65, 5), point = at || camera, ratio = camera.zoom / zoom;
    camera = { x: point.x - (point.x - camera.x) * ratio, y: point.y - (point.y - camera.y) * ratio, zoom };
  }
  function overview() { focusedRegion = null; camera = { x: model.bounds.x + model.bounds.width / 2, y: model.bounds.y + model.bounds.height / 2, zoom: 1 }; }
  function focusStart() { focusedRegion = null; camera = { x: graph.start.x, y: graph.start.y, zoom: 2.2 }; }
  function focusRegion(wing: string) {
    const members = model.nodes.filter((node) => node.wing === wing), xs = members.map((n) => n.x), ys = members.map((n) => n.y);
    const x1 = Math.min(...xs) - 45, x2 = Math.max(...xs) + 45, y1 = Math.min(...ys) - 45, y2 = Math.max(...ys) + 45;
    focusedRegion = wing;
    camera = { x: (x1 + x2) / 2, y: (y1 + y2) / 2, zoom: clamp(Math.min(viewportWidth / (x2 - x1), viewportHeight / (y2 - y1)) / baseScale, 1, 5) };
  }
  function locate(node: TreeNode) { onselect(node.id); hovered = null; query = ''; camera = { x: node.x, y: node.y, zoom: Math.max(camera.zoom, 2.4) }; }
  function onWheel(event: WheelEvent) {
    event.preventDefault();
    const rect = mapEl?.getBoundingClientRect();
    if (rect) zoomBy(event.deltaY < 0 ? 1.15 : 1 / 1.15, { x: viewBox.x + (event.clientX - rect.left) / rect.width * viewBox.width, y: viewBox.y + (event.clientY - rect.top) / rect.height * viewBox.height });
  }
  let dragging = $state<{ id: number; x: number; y: number; startX: number; startY: number; moved: boolean } | null>(null);
  let suppressClickUntil = 0;
  function onPointerDown(event: PointerEvent) {
    if (event.button !== 0 || (event.target as Element).closest('button, input, .tree-tooltip')) return;
    dragging = { id: event.pointerId, x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, moved: false };
  }
  function onPointerMove(event: PointerEvent) {
    if (!dragging || dragging.id !== event.pointerId || (!dragging.moved && Math.hypot(event.clientX - dragging.startX, event.clientY - dragging.startY) < 5)) return;
    mapEl?.setPointerCapture(event.pointerId);
    camera = { ...camera, x: camera.x - (event.clientX - dragging.x) / scale, y: camera.y - (event.clientY - dragging.y) / scale };
    dragging = { ...dragging, x: event.clientX, y: event.clientY, moved: true }; hovered = null;
  }
  function onPointerUp(event: PointerEvent) {
    if (dragging?.moved) suppressClickUntil = performance.now() + 150;
    if (mapEl?.hasPointerCapture(event.pointerId)) mapEl.releasePointerCapture(event.pointerId);
    dragging = null;
  }
  function onNodeClick(event: MouseEvent, id: string) {
    if (performance.now() < suppressClickUntil) return;
    onselect(id); if (event.shiftKey) onpath(id);
  }
  async function onNodeKey(event: KeyboardEvent, node: TreeNode) {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onselect(node.id); if (event.shiftKey) onpath(node.id); return; }
    const direction = ({ ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] } as Record<string, number[]>)[event.key];
    if (!direction) return;
    event.preventDefault();
    const adjacent = links.filter((link) => link.a === node.id || link.b === node.id).map((link) => model.byId[link.a === node.id ? link.b : link.a]).filter(Boolean);
    const score = (n: TreeNode) => { const dx = n.x - node.x, dy = n.y - node.y, distance = Math.hypot(dx, dy), projection = dx * direction[0] + dy * direction[1]; return projection > .1 ? distance / Math.pow(projection / distance, 3) : Infinity; };
    const candidates = adjacent.some((n) => Number.isFinite(score(n))) ? adjacent : model.nodes.filter((n) => n.id !== node.id);
    const next = candidates.reduce<TreeNode | null>((best, n) => score(n) < (best ? score(best) : Infinity) ? n : best, null);
    if (!next) return;
    onselect(next.id);
    if (next.x < viewBox.x + 25 || next.x > viewBox.x + viewBox.width - 25 || next.y < viewBox.y + 25 || next.y > viewBox.y + viewBox.height - 25) camera = { ...camera, x: next.x, y: next.y };
    await tick(); mapEl?.querySelector<SVGElement>('[data-node-id="' + next.id + '"]')?.focus();
  }
  const tooltipPosition = $derived(hoverNode ? { x: clamp((hoverNode.x - viewBox.x) * scale + 18, 12, Math.max(12, viewportWidth - 270)), y: clamp((hoverNode.y - viewBox.y) * scale + 18, 12, Math.max(12, viewportHeight - 145)) } : { x: 0, y: 0 });
</script>

<div class="tree-board">
  <header class="tree-toolbar">
    <div class="tree-search-area">
      <label class="tree-search">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="10" r="6" /><path d="m15 15 5 5" /></svg>
        <input type="search" aria-label="Search passive skills" placeholder="Search skills, stats, effects…" bind:value={query} onkeydown={(event) => { if (event.key === 'Enter' && searchResults[0]) locate(searchResults[0]); if (event.key === 'Escape') query = ''; }} />
      </label>
      {#if query.trim()}
        <div class="search-results" aria-label="Matching passive skills">
          <span class="search-count" aria-live="polite">{searchResults.length} matching skills</span>
          {#each searchResults.slice(0, 6) as node (node.id)}
            <button onclick={() => locate(node)}><img src={iconOf(node)} alt="" /><span>{titleOf(node)}<small>{regionNames[node.wing] || node.wing} · {kindLabel(node.kind)}</small></span></button>
          {:else}<p>No matching skills. Try a stat or effect.</p>{/each}
        </div>
      {/if}
    </div>
    <div class="tree-purse" aria-label="Available skill points"><span><strong>{game.player.treePoints}</strong> Tree points</span><span class="attainment"><strong>{game.player.attainmentPoints ?? 0}</strong> Attainment</span><small>{allocated} skills allocated</small></div>
  </header>
  <nav class="tree-regions" aria-label="Passive tree regions">
    <button class:active={!focusedRegion && camera.zoom <= 1.05} aria-pressed={!focusedRegion && camera.zoom <= 1.05} onclick={overview}>Overview</button>
    {#each model.regions as region (region.id)}
      <button class={'region-button ' + region.id} class:active={focusedRegion === region.id} aria-pressed={focusedRegion === region.id} onclick={() => focusRegion(region.id)} aria-label={'Show ' + (regionNames[region.id] || region.id) + ' region'}><img src={regionIcons[region.id] || pendant} alt="" /><span>{regionNames[region.id] || region.id}</span></button>
    {/each}
  </nav>
  <div class="tree-workspace">
    <div class="tree-map" bind:this={mapEl} bind:clientWidth={viewportWidth} bind:clientHeight={viewportHeight} class:dragging={dragging?.moved}
      role="group" aria-label="Connected passive skill tree" onwheel={onWheel} onpointerdown={onPointerDown} onpointermove={onPointerMove} onpointerup={onPointerUp} onpointercancel={onPointerUp}>
      <svg class="tree-canvas" viewBox={[viewBox.x, viewBox.y, viewBox.width, viewBox.height].join(' ')} role="group" aria-label="Passive skills and their connections">
        <defs>
          <radialGradient id="tree-node-face"><stop stop-color="#30302a" /><stop offset="1" stop-color="#111410" /></radialGradient>
          <radialGradient id="tree-cluster-face"><stop stop-color="#b89c60" stop-opacity=".08" /><stop offset="1" stop-color="#b89c60" stop-opacity="0" /></radialGradient>
          <clipPath id="tree-icon-clip" clipPathUnits="objectBoundingBox"><circle cx=".5" cy=".5" r=".5" /></clipPath>
        </defs>
        <g class="tree-clusters" aria-hidden="true">{#each model.clusters as cluster (cluster.id)}<circle cx={cluster.x} cy={cluster.y} r={cluster.radius * 1.5} fill="url(#tree-cluster-face)" />{/each}</g>
        <g class="tree-region-labels" class:region-focused={!!focusedRegion} aria-hidden="true">
          {#each model.regions as region (region.id)}<g class={region.id} transform={'translate(' + region.x + ' ' + region.y + ')'}><text class="region-code" text-anchor="middle">{region.id.toUpperCase()}</text><text class="region-name" text-anchor="middle" y="17">{regionNames[region.id] || region.id}</text></g>{/each}
        </g>
        <g class="tree-links" aria-hidden="true">
          {#each links as link, index (index)}<path d={link.path} class:active={ownedRank(link.a) > 0 && ownedRank(link.b) > 0} class:frontier={(ownedRank(link.a) > 0) !== (ownedRank(link.b) > 0)} class:route={routeLink(link.a, link.b)} />{/each}
        </g>
        <g class="tree-start" transform={'translate(' + graph.start.x + ' ' + graph.start.y + ')'} aria-label="Starting point"><circle class="origin-ornament" r="34" /><circle class="origin-rim" r="19" /><circle class="origin-face" r="15" /><image href={treeMark} x="-12" y="-12" width="24" height="24" /><text text-anchor="middle" y="48">ORIGIN</text></g>
        {#each model.nodes as node (node.id)}
          {@const rank = ownedRank(node.id)}{@const radius = sizeOf(node)}
          <g class={'tree-node ' + node.wing + ' ' + node.kind} class:selected={selectedId === node.id} class:owned={rank > 0} class:ready={!rank && connected(node)} class:on-path={pathNodes.has(node.id)} class:dimmed={!matches(node)} class:search-match={!!query.trim() && matches(node)}
            role="button" tabindex={selected?.id === node.id ? 0 : -1} data-node-id={node.id} aria-pressed={selectedId === node.id}
            aria-label={titleOf(node) + ', ' + kindLabel(node.kind) + ', ' + (regionNames[node.wing] || node.wing) + ', rank ' + rank + ' of ' + node.ranks + (rank ? ', allocated' : connected(node) ? ', connected' : ', not connected')}
            transform={'translate(' + node.x + ' ' + node.y + ')'} onclick={(event) => onNodeClick(event, node.id)} onkeydown={(event) => onNodeKey(event, node)}
            onpointerenter={() => { if (!dragging?.moved) hovered = node.id; }} onpointerleave={() => hovered = null}>
            <circle class="node-hit" r={Math.max(radius + 1, 6)} /><circle class="node-halo" r={radius + 4} />
            {#if node.kind !== 'normal'}<circle class="node-rim" r={radius + 1.8} />{/if}
            <circle class="node-face" r={radius} fill="url(#tree-node-face)" />
            {#if node.kind !== 'normal' || camera.zoom >= 1.45}<image class="node-icon" href={iconOf(node)} x={-radius * .76} y={-radius * .76} width={radius * 1.52} height={radius * 1.52} clip-path="url(#tree-icon-clip)" />{:else}<circle class="node-core" r={radius * .38} />{/if}
            {#if node.kind === 'keystone'}<path class="keystone-corners" d={'M' + (-radius-4) + ' -5v-9h9M' + (radius+4) + ' -5v-9h-9M' + (-radius-4) + ' 5v9h9M' + (radius+4) + ' 5v9h-9'} />{/if}
          </g>
        {/each}
      </svg>
      {#if hoverNode && !dragging?.moved}<div class="tree-tooltip" role="tooltip" style:left={tooltipPosition.x + 'px'} style:top={tooltipPosition.y + 'px'}><strong>{titleOf(hoverNode)}</strong><span>{kindLabel(hoverNode.kind)} · {regionNames[hoverNode.wing] || hoverNode.wing}</span>{#if hoverNode.grants[0]}<p>+{hoverNode.grants[0].values[Math.min(ownedRank(hoverNode.id), hoverNode.grants[0].values.length - 1)]} {grantLabel(hoverNode.grants[0])}</p>{:else}<p>{effectText(hoverNode)}</p>{/if}<small>{ownedRank(hoverNode.id) ? 'Allocated' : hoverNode.cost + ' ' + currencyName(hoverNode.currency) + plural(hoverNode.cost)}</small></div>{/if}
      <div class="tree-legend" aria-label="Node states"><span class="legend-owned">Allocated</span><span class="legend-ready">Available</span><span class="legend-route">Preview route</span></div>
      <div class="tree-tools" role="group" aria-label="The board's view">
        <button onclick={focusStart} aria-label="Focus starting point">Origin</button>
        <button onclick={() => selected && locate(selected)} aria-label="Locate selected skill"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="6" /><path d="M12 2v5m0 10v5M2 12h5m10 0h5" /></svg></button>
        <button onclick={() => zoomBy(1.25)} aria-label="Zoom in"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M12 5v14" /></svg></button><span aria-live="polite">{Math.round(camera.zoom * 100)}%</span>
        <button onclick={() => zoomBy(.8)} aria-label="Zoom out"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14" /></svg></button>
        <button onclick={overview} aria-label="Reset the view" title="Fit the complete tree"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5" /></svg></button>
      </div>
    </div>
    <aside class="tree-detail" aria-label="Selected passive skill">
      {#if selected}
        {@const rank = ownedRank(selected.id)}
        <div class={'detail-title ' + selected.wing}><div class={'detail-medallion ' + selected.kind}><img src={iconOf(selected)} alt="" /></div><div><h3>{titleOf(selected)}</h3><p>{kindLabel(selected.kind)} · {regionNames[selected.wing] || selected.wing}</p></div></div>
        <div class="detail-status"><span class:allocated={rank > 0} class:available={!rank && connected(selected)}>{rank >= selected.ranks ? 'Allocated' : connected(selected) ? 'Available to allocate' : 'Requires a connected path'}</span><span>{selected.cost} {currencyName(selected.currency)}{plural(selected.cost)}</span></div>
        {#if selected.grants.length}<div class="grant-list" aria-label="The bonuses this skill grants">
          {#each selected.grants as grant (grant.id)}<div class="grant"><strong>+{grant.values[Math.min(rank, grant.values.length - 1)]}</strong><span>{grantLabel(grant)}</span>{#if selected.ranks > 1}<small>Rank {rank} / {selected.ranks} · {grant.values.join(' / ')}</small>{/if}</div>{/each}
        </div>{/if}
        {#if effectText(selected)}<p class="keystone-effect">{effectText(selected)}</p>{/if}
        {#if selected.weapon}<p>Active while holding {selected.weapon}.</p>{/if}
        {#if selected.rule}<p class="rule-line">You no longer receive {lineLabel(selected.rule.target)}.</p>{/if}
        {#if selectedConflict}<p class="rule-line">Incompatible with {titleOf(model.byId[selectedConflict])}.</p>{/if}
        <div class="detail-actions">
          <button class="allocate-button" disabled={!verdict.ok} title={verdict.why || 'Allocate this passive skill'} onclick={() => onbuy(selected.id)}>{rank >= selected.ranks ? 'Skill allocated' : 'Allocate skill'}</button>
          {#if !verdict.ok && rank < selected.ranks}<p class="allocation-reason">{allocationReason}</p>{/if}
          {#if selectedPath.nodes.length > 1}
            <div class="route-summary"><span>Route to this skill</span><strong>{selectedPath.nodes.length} unallocated skills</strong><p>{selectedPath.cost.tree} tree points{selectedPath.cost.attainment ? ' · ' + selectedPath.cost.attainment + ' attainment' : ''}</p></div>
            <button class="path-button" disabled={!pathAffordable} onclick={() => onpath(selected.id)}>Allocate path</button>
            {#if !pathAffordable && !selectedConflict}<p class="allocation-reason">You need enough points for the complete route.</p>{/if}
            <details class="path-detail"><summary>Inspect route</summary><ol aria-label="The path to the selected skill">{#each selectedPath.nodes as id (id)}<li>{titleOf(model.byId[id])}</li>{/each}</ol></details>
          {/if}
        </div>
        <div class="tree-help"><h4>Follow the connections</h4><p>Select a skill to preview its route. Shift-click allocates the complete route when you have enough points.</p><p>Drag to move · Scroll to zoom<br />Arrow keys move between skills.</p><small>Respec is free at the town Counterhand.</small></div>
      {/if}
    </aside>
  </div>
</div>

<style>
  .tree-board { --tree-bronze: #7b694b; --tree-muted: #b2ad9e; display: grid; grid-template-rows: auto auto minmax(0, 1fr); flex: 1; min-width: 0; min-height: 0; overflow: hidden; border: 1px solid color-mix(in srgb, var(--gold) 22%, var(--line)); background: var(--ground); }
  .tree-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 24px; padding: 13px 18px; background: var(--inset); border-bottom: 1px solid var(--line); }
  .tree-search-area { position: relative; width: min(390px, 45%); z-index: 3; }
  .tree-search { display: flex; align-items: center; gap: 10px; border: 1px solid var(--tree-bronze); background: var(--ground); padding: 0 12px; }
  .tree-search > svg { width: 17px; height: 17px; flex: none; fill: none; stroke: var(--tree-muted); stroke-width: 1.6; }
  .tree-search input { background: transparent; border: 0; outline: 0; box-shadow: none; width: 100%; min-width: 0; padding: 10px 0; font-size: 14px; color: var(--text); caret-color: var(--gold-lit); }
  .tree-search:focus-within { outline: 2px solid var(--focus); outline-offset: 2px; }
  .tree-search input::placeholder { color: var(--tree-muted); }
  .search-results { position: absolute; top: calc(100% + 6px); inset-inline: 0; background: var(--inset); border: 1px solid var(--tree-bronze); box-shadow: var(--shadow-raised); max-height: 360px; overflow: auto; }
  .search-count { display: block; padding: 10px 12px; color: var(--tree-muted); font-size: 12px; border-bottom: 1px solid var(--line); }
  .search-results button { width: 100%; display: flex; align-items: center; gap: 10px; padding: 9px 12px; text-align: left; background: transparent; border: 0; border-radius: 0; color: var(--text); }
  .search-results button:hover { background: var(--surface-selected); }
  .search-results img { width: 26px; height: 26px; object-fit: contain; }
  .search-results small { display: block; color: var(--tree-muted); font-size: 12px; margin-top: 3px; }
  .search-results p { margin: 12px; font-size: 14px; color: var(--tree-muted); }
  .tree-purse { display: flex; align-items: center; gap: 23px; font-size: 13px; color: var(--tree-muted); font-variant-numeric: tabular-nums; }
  .tree-purse span { display: flex; align-items: baseline; gap: 8px; white-space: nowrap; }
  .tree-purse strong { color: var(--gold-lit); font-size: 23px; font-weight: 500; }
  .tree-purse .attainment strong { color: var(--es-lit); }
  .tree-purse small { color: var(--tree-muted); font-size: 12px; }
  .tree-regions { display: flex; gap: 2px; align-items: stretch; padding: 0 12px; background: color-mix(in srgb, var(--panel) 45%, var(--ground)); border-bottom: 1px solid var(--tree-bronze); }
  .tree-regions button { display: flex; gap: 7px; align-items: center; justify-content: center; padding: 10px 12px; border: 0; border-bottom: 2px solid transparent; border-radius: 0; background: transparent; color: var(--tree-muted); font-size: 13px; }
  .tree-regions button:hover { color: var(--text); background: var(--surface-selected); }
  .tree-regions button.active { color: var(--gold-lit); border-bottom-color: var(--gold); background: var(--surface-selected); }
  .tree-regions img { width: 21px; height: 21px; object-fit: contain; }
  .tree-workspace { display: grid; grid-template-columns: minmax(0, 1fr) 300px; min-height: 0; overflow: hidden; }
  .tree-map { position: relative; overflow: hidden; min-width: 0; min-height: 0; touch-action: none; cursor: grab; background: radial-gradient(ellipse at 48% 45%, #20231c 0, #131812 42%, #090d0d 85%); }
  .tree-map.dragging { cursor: grabbing; }
  .tree-canvas { position: absolute; inset: 0; display: block; width: 100%; height: 100%; min-height: 0; user-select: none; }
  :global(.panel-showcase) .tree-board { height: min(780px, calc(100vh - 130px)); }
  .tree-links path { fill: none; stroke: #786b50; stroke-width: 1.15; opacity: .63; }
  .tree-links path.frontier { stroke: #aa976b; opacity: .85; }
  .tree-links path.active { stroke: var(--gold); stroke-width: 2.4; opacity: 1; }
  .tree-links path.route { stroke: var(--gold-lit); stroke-width: 1.8; opacity: 1; stroke-dasharray: 3 2; }
  .tree-links path.active.route { stroke-dasharray: none; }
  .origin-ornament { fill: none; stroke: var(--tree-bronze); stroke-width: .65; stroke-dasharray: 1 7; }
  .origin-rim { fill: #171b15; stroke: var(--gold); stroke-width: 1.6; }
  .origin-face { fill: #0c100e; stroke: var(--tree-bronze); stroke-width: 1; }
  .tree-start text { fill: var(--gold-lit); font-size: 9px; letter-spacing: 2px; }
  .region-code { fill: var(--tree-muted); font: 17px Georgia, serif; letter-spacing: 3px; }
  .region-name { fill: var(--tree-muted); opacity: .75; font: 10px var(--ui); }
  .tree-region-labels.region-focused { display: none; }
  .tree-node { --node-colour: var(--gold); cursor: pointer; outline: none; transition: opacity 140ms ease; }
  .str { --node-colour: var(--hp-lit); } .agi { --node-colour: var(--good-lit); } .dex { --node-colour: var(--gold-lit); }
  .int { --node-colour: var(--mana-lit); } .wis { --node-colour: var(--es-lit); } .vit { --node-colour: var(--hot); } .lck { --node-colour: var(--curse); }
  .node-hit { fill: transparent; stroke: none; }
  .node-face { stroke: var(--tree-bronze); stroke-width: 1.2; }
  .node-core { fill: var(--node-colour); opacity: .65; }
  .node-icon { opacity: .77; pointer-events: none; }
  .node-rim { fill: #191d17; stroke: #967e50; stroke-width: .9; }
  .node-halo { fill: none; stroke: transparent; stroke-width: 1; pointer-events: none; }
  .tree-node.ready .node-face { stroke: var(--gold-lit); stroke-width: 1.35; }
  .tree-node.owned .node-face { fill: #5e4c20; stroke: #ffdd8a; stroke-width: 1.8; }
  .tree-node.owned .node-rim { stroke: var(--gold-lit); stroke-width: 1.6; }
  .tree-node.owned .node-icon { opacity: 1; }
  .tree-node.on-path .node-halo { stroke: var(--gold); stroke-dasharray: 2 2; }
  .tree-node.selected .node-halo, .tree-node:focus-visible .node-halo { stroke: var(--focus); stroke-width: 1.6; stroke-dasharray: none; }
  .tree-node.search-match .node-halo { stroke: var(--focus); stroke-width: 2; }
  .tree-node.dimmed { opacity: .13; }
  .tree-node:hover .node-face { stroke: var(--text); }
  .tree-node:hover .node-icon { opacity: 1; }
  .keystone-corners { fill: none; stroke: var(--tree-bronze); stroke-width: 1.2; pointer-events: none; }
  .tree-node.keystone .node-face { stroke: var(--gold); stroke-width: 1.6; }
  .tree-node.keystone.owned .keystone-corners { stroke: var(--gold-lit); }
  .tree-tooltip { position: absolute; width: 250px; padding: 12px 14px; pointer-events: none; z-index: 2; background: #101410; border: 1px solid var(--tree-bronze); box-shadow: var(--shadow-raised); color: var(--text); }
  .tree-tooltip strong { display: block; font: 18px Georgia, serif; color: var(--gold-lit); text-transform: capitalize; }
  .tree-tooltip > span, .tree-tooltip small { display: block; color: var(--tree-muted); margin-top: 5px; font-size: 12px; }
  .tree-tooltip p { margin: 10px 0; font-size: 13px; line-height: 1.45; max-height: 5em; overflow: hidden; }
  .tree-tools { position: absolute; right: 14px; bottom: 14px; display: flex; align-items: center; gap: 3px; padding: 3px; background: var(--inset); border: 1px solid var(--tree-bronze); }
  .tree-tools button { padding: 6px 8px; min-width: 30px; height: 32px; border: 0; border-radius: 0; background: transparent; color: var(--tree-muted); font-size: 12px; }
  .tree-tools button:hover { color: var(--gold-lit); background: var(--surface-selected); }
  .tree-tools svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 1.6; }
  .tree-tools > span { min-width: 38px; text-align: center; color: var(--tree-muted); font-size: 11px; font-variant-numeric: tabular-nums; }
  .tree-legend { position: absolute; bottom: 20px; left: 18px; display: flex; flex-wrap: wrap; gap: 15px; color: var(--tree-muted); font-size: 11px; pointer-events: none; }
  .tree-legend span::before { content: ''; display: inline-block; width: 6px; height: 6px; margin-right: 6px; border: 1px solid var(--tree-bronze); border-radius: 50%; }
  .legend-owned::before { background: var(--gold); border-color: var(--gold); }
  .legend-ready::before { border-color: var(--gold-lit); }
  .legend-route::before { border-color: var(--gold); border-style: dashed; }
  .tree-detail { display: flex; flex-direction: column; gap: 18px; min-width: 0; min-height: 0; overflow: auto; padding: 23px 21px; border-left: 1px solid var(--tree-bronze); background: var(--inset); color: var(--tree-muted); font-size: 13px; line-height: 1.6; scrollbar-color: var(--tree-bronze) var(--inset); scrollbar-width: thin; }
  .detail-title { display: flex; align-items: center; gap: 13px; padding-bottom: 18px; border-bottom: 1px solid var(--line); }
  .detail-title h3 { margin: 0 0 5px; color: var(--gold-lit); font: 24px/1.2 Georgia, serif; text-transform: capitalize; }
  .detail-title p { margin: 0; font-size: 12px; color: var(--tree-muted); }
  .detail-medallion { display: grid; place-items: center; width: 52px; height: 52px; flex: none; border: 2px solid var(--tree-bronze); border-radius: 50%; background: #1d2118; }
  .detail-medallion.keystone { outline: 1px solid var(--gold); outline-offset: 3px; }
  .detail-medallion img { width: 35px; height: 35px; object-fit: contain; }
  .detail-status { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 6px 12px; font-size: 12px; }
  .detail-status .allocated { color: var(--gold-lit); } .detail-status .available { color: var(--good-lit); }
  .grant-list { display: grid; gap: 10px; padding: 0 0 16px; border-bottom: 1px solid var(--line); }
  .grant { display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: baseline; gap: 0 12px; }
  .grant strong { color: var(--text); font-size: 25px; font-weight: 500; font-variant-numeric: tabular-nums; }
  .grant > span { color: var(--text); text-transform: capitalize; } .grant small { grid-column: 1 / -1; }
  .tree-detail > p { margin: 0; } .tree-detail .keystone-effect { color: var(--text); } .tree-detail .rule-line { color: var(--alarm); }
  .detail-actions { display: grid; gap: 9px; }
  .allocate-button, .path-button { width: 100%; padding: 11px 14px; border: 1px solid var(--tree-bronze); border-radius: 2px; font-size: 14px; color: var(--gold-lit); background: #322b1d; }
  .allocate-button:hover:not(:disabled), .path-button:hover:not(:disabled) { background: #453a24; border-color: var(--gold); }
  .allocate-button:disabled, .path-button:disabled { opacity: .48; cursor: not-allowed; } .path-button { background: transparent; }
  .allocation-reason { margin: 0; font-size: 12px; color: var(--tree-muted); }
  .route-summary { margin-top: 13px; padding-top: 16px; border-top: 1px solid var(--line); }
  .route-summary > span { display: block; color: var(--tree-muted); font-size: 12px; }
  .route-summary strong { color: var(--text); font-size: 15px; font-weight: 500; }
  .route-summary p { margin: 2px 0 4px; color: var(--gold-lit); font-variant-numeric: tabular-nums; }
  .path-detail { font-size: 12px; } .path-detail summary { color: var(--tree-muted); cursor: pointer; }
  .path-detail ol { padding-left: 19px; margin: 8px 0; } .path-detail li { padding: 2px 0; }
  .tree-help { margin-top: auto; padding-top: 23px; border-top: 1px solid var(--line); font-size: 12px; color: var(--tree-muted); }
  .tree-help h4 { color: var(--text); font-size: 13px; font-weight: 500; margin: 0 0 7px; } .tree-help p { margin: 0 0 12px; } .tree-help small { color: var(--tree-muted); font-size: 11px; }
  .tree-board button:focus-visible, .tree-board summary:focus-visible { outline: 2px solid var(--focus); outline-offset: 3px; }
  .tree-board ::selection { background: var(--sel); color: var(--text); }
  @media (max-width: 1150px) { .tree-workspace { grid-template-columns: minmax(0, 1fr) 260px; } .tree-regions { padding: 0 5px; } .tree-regions button { padding: 9px 8px; font-size: 12px; } .tree-purse { gap: 12px; } .tree-purse small { display: none; } .tree-detail { padding: 18px 16px; } .tree-legend { bottom: 60px; gap: 10px; } }
  @media (max-width: 760px) { .tree-toolbar { padding: 10px; gap: 10px; flex-wrap: wrap; } .tree-search-area { width: 100%; } .tree-purse { width: 100%; justify-content: space-between; } .tree-purse strong { font-size: 19px; } .tree-regions { overflow-x: auto; } .tree-regions button { flex: none; } .tree-regions img { width: 18px; height: 18px; } .tree-workspace { grid-template-columns: minmax(0, 1fr) 220px; } .tree-detail { padding: 14px 12px; gap: 12px; font-size: 12px; } .detail-title { gap: 8px; } .detail-title h3 { font-size: 19px; } .detail-medallion { width: 35px; height: 35px; } .detail-medallion img { width: 25px; height: 25px; } .tree-legend { display: none; } .tree-tools { right: 8px; bottom: 8px; } }
  @media (prefers-reduced-motion: reduce) { .tree-node { transition: none; } }
</style>
