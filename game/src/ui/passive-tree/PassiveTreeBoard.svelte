<script lang="ts">
  import { onMount, tick, untrack } from 'svelte';
  import type { TreeNode } from '../../../../engine/tree';
  import type { GameState } from '../../sim/types';
  import { lineName } from '../../sim/craft';
  import { tree } from '../../engine/client';
  import { treePath } from '../../sim/tree';
  import { buildPassiveTreeView, initialTreeCamera, treeOrbitPath, treeViewNodeRadius, treeRouteEdges, newPassiveTreeSession, type PassiveTreeSession } from './passive-tree-view';
  import PassiveTreeDetails from './PassiveTreeDetails.svelte';
  import { recommendTreeNodes, treeGoals, type TreeGoalId } from '../../sim/tree-guide';
  import swords from '../../icon/gear/weapon/crossed-swords-1.png';
  import boots from '../../icon/gear/armour/winged-boots.png';
  import bow from '../../icon/gear/weapon/bow-arrow.png';
  import staff from '../../icon/gear/weapon/staff.png';
  import shield from '../../icon/gear/offhand/shield-crest.png';
  import pendant from '../../icon/gear/accessory/gem-pendant.png';
  import heart from '../../icon/skill/heart-beats.png';
  import flame from '../../icon/skill/fireball.png';
  import eye from '../../icon/skill/eye.png';
  import treeMark from '../../icon/plant/oak.png';
  import searchGlyph from '../../icon/ui/search.png';
  import locateGlyph from '../../icon/ui/locate.png';
  import zoomInGlyph from '../../icon/ui/add-plus.png';
  import zoomOutGlyph from '../../icon/ui/remove-minus.png';
  import fitGlyph from '../../icon/ui/expand.png';

  let { nodes, graph, layout, game, selectedId, verdict, onselect, onbuy, onpath, ontrackgoal = () => {}, goalId = null, session = $bindable(newPassiveTreeSession()), focusId = $bindable<string | null>(null) }: {
    nodes: TreeNode[];
    graph: { start: { x: number; y: number } };
    layout: { x: number; y: number; width: number; height: number; nodeRadius: number; radii?: Record<string, number> };
    game: GameState;
    selectedId: string;
    verdict: { ok: boolean; why?: string };
    onselect: (id: string) => void;
    onbuy: (id: string) => void;
    onpath: (id: string) => void;
    /** Pin a node in the Journey as the player's target; it never allocates a point. */
    ontrackgoal?: (id: string) => void;
    goalId?: string | null;
    session?: PassiveTreeSession;
    focusId?: string | null;
  } = $props();
  let goalLens = $state<TreeGoalId | null>(null);
  let guideOpen = $state(untrack(() => session.guideOpen));
  let viewMode = $state<'build' | 'overview' | 'region' | 'free'>(untrack(() => session.viewMode));
  const goals = $derived(treeGoals(game));
  const recommendations = $derived(goalLens ? recommendTreeNodes(game, goalLens, 6) : []);
  const lensReason = $derived(goals.find((goal) => goal.id === goalLens)?.reason || '');
  const viewFor = (id: string) => nodes.find((node) => node.id === id) || null;
  function focusNode(id: string) {
    const node = viewFor(id);
    if (node) locate(node);
  }
  const regionNames: Record<string, string> = { str: 'Strength', agi: 'Agility', dex: 'Dexterity', int: 'Intelligence', wis: 'Wisdom', vit: 'Vitality', lck: 'Luck' };
  const regionIcons: Record<string, string> = { str: swords, agi: boots, dex: bow, int: staff, wis: eye, vit: heart, lck: pendant };
  const model = $derived(buildPassiveTreeView(nodes, graph.start));
  const selected = $derived(model.byId[selectedId] || model.nodes[0]);
  const ownedRank = (id: string) => id === 'start' ? 1 : game.player.treeRanks?.[id] || 0;
  const connected = (node: TreeNode) => tree.connected(node.id, game.player.treeRanks);
  const sizeOf = (node: TreeNode) => treeViewNodeRadius(node, layout);
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
  let query = $state(untrack(() => session.query));
  let hovered = $state<string | null>(null);
  let focusedRegion = $state<string | null>(untrack(() => session.focusedRegion));
  const searchText = $derived(new Map(nodes.map((node) => [node.id, [node.id, node.name, regionNames[node.wing], titleOf(node), node.description, ...node.grants.map(grantLabel), ...(node.effects || []).map((e) => e.key)].join(' ').toLowerCase()])));
  const matches = (node: TreeNode) => !query.trim() || !!searchText.get(node.id)?.includes(query.trim().toLowerCase());
  const searchResults = $derived(query.trim() ? model.nodes.filter(matches) : []);
  const selectedPath = $derived(treePath(game, selected?.id || ''));
  const previewPath = $derived(treePath(game, hovered || selected?.id || '').nodes);
  const pathNodes = $derived(new Set(previewPath));
  const selectedConflict = $derived(selected?.kind === 'keystone' ? tree.pairHolder(selected.id, game.player.treeRanks) : null);
  const hoverNode = $derived(hovered ? model.byId[hovered] : null);
  const allocated = $derived(nodes.filter((node) => ownedRank(node.id) > 0).length);
  const links = $derived.by(() => {
    const found = new Map<string, { a: string; b: string; path: string; crossRegion: boolean }>();
    const draw = (aId: string, bId: string, shape = 'line') => {
      const key = [aId, bId].sort().join('|');
      if (found.has(key)) return;
      const a = aId === 'start' ? graph.start : model.byId[aId], b = model.byId[bId];
      if (!a || !b) return;
      const aNode = model.byId[aId], bNode = model.byId[bId];
      const path = shape === 'arc' ? treeOrbitPath(a, b, graph.start) : 'M' + a.x + ' ' + a.y + 'L' + b.x + ' ' + b.y;
      found.set(key, { a: aId, b: bId, path, crossRegion: !!aNode && !!bNode && aNode.wing !== bNode.wing });
    };
    for (const node of model.nodes) for (const parent of node.needs) draw(parent, node.id);
    for (const link of tree.links) draw(link.a, link.b, link.shape);
    return [...found.values()];
  });
  const previewEdges = $derived(treeRouteEdges(previewPath, links, (id) => ownedRank(id) > 0));
  const routeLink = (a: string, b: string) => previewEdges.has([a, b].sort().join('|'));
  let mapEl = $state<HTMLDivElement | null>(null);
  let viewportWidth = $state(1), viewportHeight = $state(1);
  const savedCamera = untrack(() => session.camera);
  const initialFocus = untrack(() => focusId);
  let camera = $state(savedCamera || { x: 0, y: 0, zoom: 1.7 });
  $effect(() => { session = { camera: { ...camera }, query, viewMode, focusedRegion, guideOpen }; });
  $effect(() => {
    if (!mapEl || !focusId) return;
    const target = model.byId[focusId];
    if (target) untrack(() => locate(target));
    focusId = null;
  });
  const baseScale = $derived(Math.min(viewportWidth / model.bounds.width, viewportHeight / model.bounds.height) || 1);
  const scale = $derived(baseScale * camera.zoom);
  const viewBox = $derived({ x: camera.x - viewportWidth / scale / 2, y: camera.y - viewportHeight / scale / 2, width: viewportWidth / scale, height: viewportHeight / scale });
  const clamp = (v: number, low: number, high: number) => Math.max(low, Math.min(high, v));
  onMount(() => {
    const frame = requestAnimationFrame(() => { if (!savedCamera && !initialFocus) focusBuild(); });
    return () => cancelAnimationFrame(frame);
  });
  function focusBuild() {
    const rect = mapEl?.getBoundingClientRect();
    focusedRegion = null; viewMode = 'build';
    camera = initialTreeCamera(model, graph.start, game.player.treeRanks || {},
      { width: rect?.width || viewportWidth, height: rect?.height || viewportHeight }, links);
  }
  function zoomBy(factor: number, at?: { x: number; y: number }) {
    viewMode = 'free'; focusedRegion = null;
    const zoom = clamp(camera.zoom * factor, .65, 8), point = at || camera, ratio = camera.zoom / zoom;
    camera = { x: point.x - (point.x - camera.x) * ratio, y: point.y - (point.y - camera.y) * ratio, zoom };
  }
  function overview() { focusedRegion = null; viewMode = 'overview'; camera = { x: model.bounds.x + model.bounds.width / 2, y: model.bounds.y + model.bounds.height / 2, zoom: 1 }; }
  function focusStart() { focusedRegion = null; viewMode = 'free'; camera = { x: graph.start.x, y: graph.start.y, zoom: 2.6 }; }
  function focusRegion(wing: string) {
    const region = model.regions.find((entry) => entry.id === wing);
    if (!region) return;
    const box = region.bounds;
    focusedRegion = wing; viewMode = 'region';
    camera = { x: box.x + box.width / 2, y: box.y + box.height / 2,
      zoom: clamp(Math.min((viewportWidth - 100) / box.width, (viewportHeight - 100) / box.height) / baseScale, .65, 5) };
  }
  function locate(node: TreeNode) { onselect(node.id); hovered = null; query = ''; viewMode = 'free'; focusedRegion = null; camera = { x: node.x, y: node.y, zoom: Math.max(camera.zoom, 4) }; }
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
    viewMode = 'free';
    focusedRegion = null;
    camera = { ...camera, x: camera.x - (event.clientX - dragging.x) / scale, y: camera.y - (event.clientY - dragging.y) / scale };
    dragging = { ...dragging, x: event.clientX, y: event.clientY, moved: true }; hovered = null;
  }
  function onPointerUp(event: PointerEvent) {
    if (dragging?.moved) suppressClickUntil = performance.now() + 150;
    if (mapEl?.hasPointerCapture(event.pointerId)) mapEl.releasePointerCapture(event.pointerId);
    dragging = null;
  }
  function onNodeClick(event: MouseEvent, id: string) {
    event.stopPropagation();
    if (performance.now() < suppressClickUntil) return;
    onselect(id); if (event.shiftKey) onpath(id);
  }
  async function onNodeKey(event: KeyboardEvent, node: TreeNode) {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); onselect(node.id); if (event.shiftKey) onpath(node.id); return; }
    const direction = ({ ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] } as Record<string, number[]>)[event.key];
    if (!direction) return;
    event.preventDefault(); event.stopPropagation();
    const adjacent = links.filter((link) => link.a === node.id || link.b === node.id).map((link) => model.byId[link.a === node.id ? link.b : link.a]).filter(Boolean);
    const score = (n: TreeNode) => { const dx = n.x - node.x, dy = n.y - node.y, distance = Math.hypot(dx, dy), projection = dx * direction[0] + dy * direction[1]; return projection > .1 ? distance / Math.pow(projection / distance, 3) : Infinity; };
    const candidates = adjacent.some((n) => Number.isFinite(score(n))) ? adjacent : model.nodes.filter((n) => n.id !== node.id);
    const next = candidates.reduce<TreeNode | null>((best, n) => score(n) < (best ? score(best) : Infinity) ? n : best, null);
    if (!next) return;
    onselect(next.id);
    if (next.x < viewBox.x + 25 || next.x > viewBox.x + viewBox.width - 25 || next.y < viewBox.y + 25 || next.y > viewBox.y + viewBox.height - 25) {
      focusedRegion = null; viewMode = 'free'; camera = { ...camera, x: next.x, y: next.y };
    }
    await tick(); mapEl?.querySelector<SVGElement>('[data-node-id="' + next.id + '"]')?.focus();
  }
  const tooltipPosition = $derived(hoverNode ? { x: clamp((hoverNode.x - viewBox.x) * scale + 18, 12, Math.max(12, viewportWidth - 270)), y: clamp((hoverNode.y - viewBox.y) * scale + 18, 12, Math.max(12, viewportHeight - 145)) } : { x: 0, y: 0 });
  function framePath(kind: string, r: number) {
    if (kind === 'keystone') return `M0 ${-r}L${r} 0 0 ${r} ${-r} 0Z`;
    if (kind === 'notable') return `M${-r} 0L${-r * .5} ${-r * .87}H${r * .5}L${r} 0 ${r * .5} ${r * .87}H${-r * .5}Z`;
    return `M${-r} 0a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0`;
  }
  const nodeLabels = $derived.by(() => {
    const visible = model.nodes.filter(node => node.x > viewBox.x && node.x < viewBox.x + viewBox.width && node.y > viewBox.y && node.y < viewBox.y + viewBox.height);
    const candidates = visible.filter(node => node.kind !== 'normal' && matches(node)
      && (sizeOf(node) * scale >= 11 || node.id === selectedId || node.id === goalId));
    candidates.sort((a, b) => Number(b.id === selectedId) - Number(a.id === selectedId)
      || Number(b.kind === 'keystone') - Number(a.kind === 'keystone') || a.id.localeCompare(b.id));
    const placed: { x: number; y: number; w: number; h: number }[] = [];
    const labels: { id: string; x: number; y: number; text: string }[] = [];
    for (const node of candidates) {
      const title = titleOf(node), text = title.length > 24 ? title.slice(0, 23) + '…' : title;
      const w = text.length * 6.2, x = (node.x - viewBox.x) * scale;
      const y = (node.y - viewBox.y) * scale + sizeOf(node) * scale + 13;
      const box = { x: x - w / 2 - 4, y: y - 11, w: w + 8, h: 16 };
      const intersects = (rect: typeof box) => box.x < rect.x + rect.w && box.x + box.w > rect.x && box.y < rect.y + rect.h && box.y + box.h > rect.y;
      if (box.x < 8 || box.x + box.w > viewportWidth - 8 || box.y + box.h > viewportHeight - 48 || placed.some(intersects)) continue;
      if (visible.some(other => {
        if (other.id === node.id) return false;
        const r = sizeOf(other) * scale + 3;
        return intersects({ x: (other.x - viewBox.x) * scale - r, y: (other.y - viewBox.y) * scale - r, w: r * 2, h: r * 2 });
      })) continue;
      placed.push(box); labels.push({ id: node.id, x: node.x, y: viewBox.y + y / scale, text });
    }
    return labels;
  });
</script>

<div class="tree-board surface-tree" class:guide-open={guideOpen}>
  <header class="tree-toolbar">
    <div class="tree-search-area">
      <label class="tree-search">
        <span class="icon-mask" style={`--glyph:url(${searchGlyph})`} aria-hidden="true"></span>
        <input type="search" aria-label="Search passive skills" placeholder="Search skills, stats, effects…" bind:value={query} onkeydown={(event) => { if (event.key === 'Enter' && searchResults[0]) locate(searchResults[0]); if (event.key === 'Escape') query = ''; }} />
      </label>
      {#if query.trim()}
        <div class="search-results scroll-pane" aria-label="Matching passive skills">
          <span class="search-count" aria-live="polite">{searchResults.length} matching skills</span>
          {#each searchResults.slice(0, 6) as node (node.id)}
            <button class="btn btn-flat" onclick={() => locate(node)}><img src={iconOf(node)} alt="" /><span>{titleOf(node)}<small>{regionNames[node.wing] || node.wing} · {kindLabel(node.kind)}</small></span></button>
          {:else}<p>No matching skills. Try a stat or effect.</p>{/each}
        </div>
      {/if}
    </div>
    <div class="tree-purse" aria-label="Available skill points"><span><strong>{game.player.treePoints}</strong> Tree points</span><span class="attainment"><strong>{game.player.attainmentPoints ?? 0}</strong> Attainment</span><small>{allocated} skills allocated</small></div>
    <button class="guide-toggle btn btn-quiet" class:toggled={guideOpen} type="button" aria-expanded={guideOpen} aria-controls="tree-build-goals" onclick={() => (guideOpen = !guideOpen)}>Build goals{goalLens ? ' · active' : ''}</button>
  </header>
  <nav class="tree-regions" aria-label="Passive tree regions">
    <button class="btn btn-quiet region-button" class:picked={viewMode === 'build'} aria-pressed={viewMode === 'build'} onclick={focusBuild}>My build</button>
    <button class="btn btn-quiet region-button" class:picked={viewMode === 'overview'} aria-pressed={viewMode === 'overview'} onclick={overview}>Overview</button>
    {#each model.regions as region (region.id)}
      <button class={'region-button btn btn-quiet ' + region.id} class:picked={focusedRegion === region.id} aria-pressed={focusedRegion === region.id} onclick={() => focusRegion(region.id)} aria-label={'Show ' + (regionNames[region.id] || region.id) + ' region'}><img src={regionIcons[region.id] || pendant} alt="" /><span>{regionNames[region.id] || region.id}</span></button>
    {/each}
  </nav>
  {#if guideOpen}
  <section class="tree-guide scroll-pane" id="tree-build-goals" aria-label="Build goal helper">
    <div class="tree-guide-head">
      <strong>Build goals</strong>
      <div role="group" aria-label="Choose a build goal">
        {#each goals as goal (goal.id)}
          <button type="button" class="btn btn-quiet" class:picked={goalLens === goal.id} aria-pressed={goalLens === goal.id}
            title={goal.reason} onclick={() => (goalLens = goalLens === goal.id ? null : goal.id)}>{goal.label}</button>
        {/each}
      </div>
      {#if goalLens}<button type="button" class="clear-lens btn btn-quiet" onclick={() => (goalLens = null)}>Clear lens</button>{/if}
    </div>
    {#if goalLens}
      <p class="text-note">{lensReason} Choose a destination to inspect its route, or track it in Journey.</p>
      <div class="tree-recs">
        {#each recommendations as rec (rec.node.id)}
          <article class:blocked={!rec.affordable || !!rec.conflict}>
            <button class="rec-title btn btn-flat" type="button" onclick={() => focusNode(rec.node.id)}>{titleOf(rec.node)} <small>{kindLabel(rec.node.kind)}{rec.node.weapon ? ` · ${rec.node.weapon}` : ''}</small></button>
            <p>{rec.reason}</p>
            <div class="rec-meta">
              <span>{rec.pathLength} node{rec.pathLength === 1 ? '' : 's'} · <b>{rec.cost.tree}</b> tree · <b>{rec.cost.attainment}</b> attainment</span>
              {#if rec.conflict}<span class="text-alarm">Incompatible with {rec.conflict}</span>
              {:else if !rec.affordable}<span class="text-alarm">Not enough points for the complete route</span>{/if}
            </div>
            <div class="rec-actions">
              <button class="btn btn-quiet" type="button" onclick={() => focusNode(rec.node.id)}>Show route</button>
              <button class="btn btn-quiet" type="button" disabled={goalId === rec.node.id} onclick={() => ontrackgoal(rec.node.id)}>{goalId === rec.node.id ? 'Tracked in Journey' : 'Track this node'}</button>
            </div>
          </article>
        {:else}<p class="text-note">No unallocated Notable or Keystone matches this lens. Clear the lens and search manually.</p>{/each}
      </div>
    {/if}
  </section>
  {/if}
  <div class="tree-workspace">
    <div class="tree-map" bind:this={mapEl} bind:clientWidth={viewportWidth} bind:clientHeight={viewportHeight} class:dragging={dragging?.moved} class:route-focused={previewPath.length > 2}
      role="group" aria-label="Connected passive skill tree" onwheel={onWheel} onpointerdown={onPointerDown} onpointermove={onPointerMove} onpointerup={onPointerUp} onpointercancel={onPointerUp} onlostpointercapture={() => (dragging = null)}>
      <svg class="tree-canvas" viewBox={[viewBox.x, viewBox.y, viewBox.width, viewBox.height].join(' ')} role="group" aria-label="Passive skills and their connections">
        <defs>
          <radialGradient id="tree-node-face"><stop stop-color="var(--tree-node-grad-top)" /><stop offset="1" stop-color="var(--tree-node-grad-bottom)" /></radialGradient>
          <clipPath id="tree-icon-clip" clipPathUnits="objectBoundingBox"><circle cx=".5" cy=".5" r=".5" /></clipPath>
        </defs>
        <g class="tree-region-labels" class:region-focused={!!focusedRegion} aria-hidden="true">
          {#each model.regions as region (region.id)}<g class={region.id} transform={'translate(' + region.x + ' ' + region.y + ')'}><text class="region-name" text-anchor="middle" font-size={14 / scale} stroke-width={3 / scale}>{regionNames[region.id] || region.id}</text></g>{/each}
        </g>
        <g class="tree-links" aria-hidden="true">
          {#each links as link, index (index)}<path d={link.path} class:cross-region={link.crossRegion} class:active={ownedRank(link.a) > 0 && ownedRank(link.b) > 0} class:frontier={(ownedRank(link.a) > 0) !== (ownedRank(link.b) > 0)} class:route={routeLink(link.a, link.b)} />{/each}
        </g>
        <g class="tree-start" transform={'translate(' + graph.start.x + ' ' + graph.start.y + ')'} aria-label="Starting point"><circle class="origin-ornament" r="56" /><circle class="origin-rim" r="30" /><circle class="origin-face" r="24" /><image href={treeMark} x="-19" y="-19" width="38" height="38" /><text text-anchor="middle" y="78">ORIGIN</text></g>
        {#each model.nodes as node (node.id)}
          {@const rank = ownedRank(node.id)}{@const radius = sizeOf(node)}
          <g class={'tree-node ' + node.wing + ' ' + node.kind} class:selected={selectedId === node.id} class:owned={rank > 0} class:ready={!rank && connected(node)} class:on-path={pathNodes.has(node.id)} class:dimmed={!matches(node)} class:search-match={!!query.trim() && matches(node)}
            role="button" tabindex={selected?.id === node.id ? 0 : -1} data-node-id={node.id} aria-pressed={selectedId === node.id}
            aria-label={titleOf(node) + ', ' + kindLabel(node.kind) + ', ' + (regionNames[node.wing] || node.wing) + ', rank ' + rank + ' of ' + node.ranks + (rank ? ', allocated' : connected(node) ? ', connected' : ', not connected')}
            transform={'translate(' + node.x + ' ' + node.y + ')'} onclick={(event) => onNodeClick(event, node.id)} onkeydown={(event) => onNodeKey(event, node)}
            onpointerenter={() => { if (!dragging?.moved) hovered = node.id; }} onpointerleave={() => hovered = null}>
            <circle class="node-hit" r={Math.max(radius + 2, 6)} /><path class="node-halo" d={framePath(node.kind, radius + 4)} />
            {#if node.kind !== 'normal'}<path class="node-rim" d={framePath(node.kind, radius + 1.8)} />{/if}
            <path class="node-face" d={framePath(node.kind, radius)} fill="url(#tree-node-face)" />
            {#if node.kind !== 'normal' || radius * scale >= 7}<image class="node-icon" href={iconOf(node)} x={-radius * (node.kind === 'keystone' ? .51 : .66)} y={-radius * (node.kind === 'keystone' ? .51 : .66)} width={radius * (node.kind === 'keystone' ? 1.02 : 1.32)} height={radius * (node.kind === 'keystone' ? 1.02 : 1.32)} clip-path="url(#tree-icon-clip)" />{:else}<circle class="node-core" r={radius * .32} />{/if}
          </g>
        {/each}
        <g class="tree-node-labels" aria-hidden="true">
          {#each nodeLabels as label (label.id)}<text class:muted={previewPath.length > 2 && !pathNodes.has(label.id) && !ownedRank(label.id)} x={label.x} y={label.y} text-anchor="middle" font-size={11 / scale} stroke-width={3 / scale}>{label.text}</text>{/each}
        </g>
      </svg>
      {#if hoverNode && !dragging?.moved}<div class="tree-tooltip" role="tooltip" style:left={tooltipPosition.x + 'px'} style:top={tooltipPosition.y + 'px'}><strong>{titleOf(hoverNode)}</strong><span>{kindLabel(hoverNode.kind)} · {regionNames[hoverNode.wing] || hoverNode.wing}</span>{#if hoverNode.grants[0]}<p>+{hoverNode.grants[0].values[Math.min(ownedRank(hoverNode.id), hoverNode.grants[0].values.length - 1)]} {grantLabel(hoverNode.grants[0])}</p>{:else}<p>{effectText(hoverNode)}</p>{/if}<small>{ownedRank(hoverNode.id) ? 'Allocated' : hoverNode.cost + ' ' + currencyName(hoverNode.currency) + plural(hoverNode.cost)}</small></div>{/if}
      <div class="tree-legend" aria-label="Node and connection states"><span class="legend-owned">Allocated</span><span class="legend-ready">Connected</span><span class="legend-route">Preview route</span><span class="legend-cross">Cross-region link</span></div>
      <div class="tree-tools" role="group" aria-label="The board's view">
        <button class="btn btn-quiet btn-icon" onclick={focusStart} aria-label="Focus starting point">Origin</button>
        <button class="btn btn-quiet btn-icon" onclick={() => selected && locate(selected)} aria-label="Locate selected skill"><span class="icon-mask" style={`--glyph:url(${locateGlyph})`} aria-hidden="true"></span></button>
        <button class="btn btn-quiet btn-icon" onclick={() => zoomBy(1.25)} aria-label="Zoom in"><span class="icon-mask" style={`--glyph:url(${zoomInGlyph})`} aria-hidden="true"></span></button><span aria-live="polite">{Math.round(camera.zoom * 100)}%</span>
        <button class="btn btn-quiet btn-icon" onclick={() => zoomBy(.8)} aria-label="Zoom out"><span class="icon-mask" style={`--glyph:url(${zoomOutGlyph})`} aria-hidden="true"></span></button>
        <button class="btn btn-quiet btn-icon" onclick={overview} aria-label="Reset the view" title="Fit the complete tree"><span class="icon-mask" style={`--glyph:url(${fitGlyph})`} aria-hidden="true"></span></button>
      </div>
    </div>
    <PassiveTreeDetails selected={selected} {game} path={selectedPath} {verdict} byId={model.byId}
      conflict={selectedConflict ? model.byId[selectedConflict] || null : null}
      {titleOf} {grantLabel} {effectText} {lineLabel} {iconOf}
      {onbuy} {onpath} onselect={focusNode} {ontrackgoal} {goalId} />
  </div>
</div>

<style>
  .tree-board { display: grid; grid-template-rows: auto auto minmax(0, 1fr); flex: 1; min-width: 0; min-height: 0; overflow: hidden; border: 1px solid var(--line); background: var(--tree-bg); }
  .tree-board.guide-open { grid-template-rows: auto auto auto minmax(0, 1fr); }
  .tree-toolbar { display: flex; align-items: center; gap: 16px; padding: 9px 14px; background: var(--tree-panel); border-bottom: 1px solid var(--line); }
  .tree-search-area { position: relative; width: min(360px, 38%); z-index: var(--z-floater); }
  .tree-search { display: flex; align-items: center; gap: 9px; border: 1px solid var(--tree-bronze); background: var(--tree-deep); padding: 0 10px; }
  .tree-search .icon-mask { width: 16px; height: 16px; color: var(--tree-muted); }
  .tree-search input { width: 100%; min-width: 0; padding: 8px 0; background: transparent; border: 0; outline: 0; box-shadow: none; font-size: var(--tree-fs-sm); color: var(--text); caret-color: var(--gold-lit); }
  .tree-search input::placeholder { color: var(--tree-muted); }
  .tree-search:focus-within { outline: 2px solid var(--focus); outline-offset: 2px; }
  .search-results { position: absolute; top: calc(100% + 5px); inset-inline: 0; max-height: 330px; background: var(--inset); border: 1px solid var(--tree-bronze); box-shadow: var(--shadow-raised); }
  .search-count { display: block; padding: 8px 10px; color: var(--tree-muted); font-size: var(--tree-fs-xs); border-bottom: 1px solid var(--line); }
  .search-results button { display: flex; align-items: center; gap: 10px; width: 100%; padding: 8px 10px; text-align: left; border-radius: 0; color: var(--text); }
  .search-results button:hover { background: var(--surface-selected); }
  .search-results img { width: 25px; height: 25px; object-fit: contain; }
  .search-results small { display: block; color: var(--tree-muted); font-size: var(--tree-fs-2xs); padding-top: 2px; }
  .search-results p { padding: 10px; font-size: var(--tree-fs-sm); color: var(--tree-muted); }
  .tree-purse { display: flex; align-items: center; gap: 19px; margin-left: auto; font-size: var(--tree-fs-xs); color: var(--tree-muted); font-variant-numeric: tabular-nums; }
  .tree-purse span { display: flex; align-items: baseline; gap: 6px; white-space: nowrap; }
  .tree-purse strong { color: var(--gold-lit); font-size: var(--tree-fs-xl); font-weight: 600; }
  .tree-purse .attainment strong { color: var(--es-lit); }
  .tree-purse small { font-size: var(--tree-fs-2xs); }
  .tree-board .guide-toggle { padding: 7px 11px; font-size: var(--tree-fs-xs); white-space: nowrap; }
  .tree-regions { display: flex; gap: 1px; align-items: stretch; padding: 0 9px; overflow-x: auto; background: var(--tree-strip); border-bottom: 1px solid var(--tree-bronze); }
  .tree-regions button { display: flex; gap: 6px; align-items: center; justify-content: center; flex: none; padding: 8px 11px; border: 0; border-bottom: 2px solid transparent; border-radius: 0; background: transparent; color: var(--tree-muted); font-size: var(--tree-fs-xs); }
  .tree-regions button:hover { color: var(--text); }
  .tree-regions button.picked { color: var(--gold-lit); border-bottom-color: var(--gold); background: var(--surface-selected); }
  .tree-regions img { width: 18px; height: 18px; object-fit: contain; }
  .tree-guide { display: grid; gap: 7px; max-height: 220px; padding: 10px 14px; border-bottom: 1px solid var(--tree-bronze); background: var(--tree-guide); font-size: var(--tree-fs-xs); }
  .tree-guide-head { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; }
  .tree-guide-head > strong { color: var(--text); font-size: var(--tree-fs-xs); }
  .tree-guide-head > div { display: flex; flex-wrap: wrap; gap: 4px; }
  .tree-guide-head > div > button, .tree-board .clear-lens { padding: 4px 8px; font-size: var(--tree-fs-xs); }
  .tree-board .clear-lens { margin-left: auto; }
  .tree-guide > p { margin: 0; line-height: 1.4; }
  .tree-recs { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 3px; scrollbar-color: var(--tree-bronze) transparent; scrollbar-width: thin; }
  .tree-recs article { flex: 0 0 min(295px, 82vw); display: grid; align-content: start; gap: 5px; padding: 8px 10px; border: 1px solid var(--line); background: var(--tree-card); }
  .tree-recs article.blocked { border-style: dashed; }
  .tree-board .rec-title { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; padding: 0; color: var(--gold-lit); text-align: left; font: var(--tree-fs-md)/1.25 var(--tree-display); text-transform: capitalize; }
  .rec-title small { color: var(--tree-muted); font: var(--tree-fs-2xs) var(--ui); white-space: nowrap; }
  .tree-recs article > p { margin: 0; color: var(--text); line-height: 1.35; }
  .rec-meta { display: flex; flex-wrap: wrap; gap: 3px 8px; color: var(--tree-muted); font-variant-numeric: tabular-nums; }
  .rec-meta b { color: var(--gold-lit); }
  .rec-actions { display: flex; flex-wrap: wrap; gap: 4px; }
  .rec-actions button { padding: 3px 7px; font-size: var(--tree-fs-2xs); }
  .tree-workspace { display: grid; grid-template-columns: minmax(0, 1fr) 320px; min-height: 0; overflow: hidden; }
  .tree-map { position: relative; overflow: hidden; min-width: 0; min-height: 0; touch-action: none; cursor: grab; background: radial-gradient(ellipse at 50% 48%, var(--tree-canvas-glow), var(--tree-canvas-mid) 55%, var(--tree-canvas)); }
  .tree-map.dragging { cursor: grabbing; }
  .tree-canvas { position: absolute; inset: 0; display: block; width: 100%; height: 100%; min-height: 0; user-select: none; }
  :global(.panel-showcase) .tree-board { height: min(860px, calc(100vh - 150px)); }
  .tree-links path { fill: none; stroke: var(--tree-link); stroke-width: 1.05; opacity: .38; }
  .tree-links path.cross-region { stroke: var(--tree-link-cross); stroke-width: 1.3; stroke-dasharray: 2.5 2; opacity: .62; }
  .tree-links path.frontier { stroke: var(--tree-link-frontier); opacity: .85; }
  .tree-links path.active { stroke: var(--gold); stroke-width: 2.4; stroke-dasharray: none; opacity: 1; }
  .tree-links path.route { stroke: var(--gold-lit); stroke-width: 2.1; stroke-dasharray: 4 2; opacity: 1; }
  .tree-links path.active.route { stroke-dasharray: none; }
  .route-focused .tree-links path:not(.active, .route) { opacity: .12; }
  .origin-ornament { fill: none; stroke: var(--tree-bronze); stroke-width: .8; stroke-dasharray: 1 8; }
  .origin-rim { fill: var(--tree-origin-rim); stroke: var(--gold); stroke-width: 1.5; }
  .origin-face { fill: var(--tree-origin-face); stroke: var(--tree-bronze); stroke-width: 1; }
  .tree-start image { opacity: .8; }
  .tree-start text { fill: var(--tree-muted); font-size: var(--tree-fs-sm); letter-spacing: .6px; }
  .tree-region-labels { pointer-events: none; }
  .tree-region-labels.region-focused { display: none; }
  .region-name { fill: var(--node-colour, var(--tree-muted)); stroke: var(--tree-ink-stroke); paint-order: stroke; font-weight: 600; }
  .tree-node { --node-colour: var(--gold); cursor: pointer; outline: none; transition: opacity 120ms ease; }
  .str { --node-colour: var(--tree-str); } .agi { --node-colour: var(--tree-agi); } .dex { --node-colour: var(--tree-dex); }
  .int { --node-colour: var(--tree-int); } .wis { --node-colour: var(--tree-wis); } .vit { --node-colour: var(--tree-vit); } .lck { --node-colour: var(--tree-lck); }
  .node-hit { fill: transparent; stroke: none; }
  .node-face { stroke: var(--tree-node-edge); stroke-width: 1.1; }
  .tree-node.normal .node-face { stroke: color-mix(in srgb, var(--node-colour) 50%, var(--tree-normal-mix)); }
  .node-core { fill: var(--node-colour); opacity: .7; }
  .node-icon { opacity: .86; pointer-events: none; filter: sepia(.2) saturate(.65); }
  .tree-node.notable .node-face { stroke: var(--tree-node-notable); stroke-width: 1.45; }
  .tree-node.keystone .node-face { stroke: var(--gold); stroke-width: 1.6; }
  .node-rim { fill: var(--tree-node-face); stroke: var(--tree-node-rim); stroke-width: .9; }
  .node-halo { fill: none; stroke: transparent; stroke-width: 1; pointer-events: none; }
  .tree-node.ready .node-face { stroke: var(--tree-node-ready); stroke-width: 1.5; }
  .tree-node.owned .node-face { fill: var(--tree-node-owned); stroke: var(--gold-lit); stroke-width: 1.8; }
  .tree-node.owned .node-icon { filter: sepia(.2) saturate(.9) brightness(1.2); opacity: 1; }
  .tree-node.on-path .node-halo { stroke: var(--gold); stroke-dasharray: 2 2; }
  .tree-node.selected .node-halo, .tree-node:focus-visible .node-halo { stroke: var(--focus); stroke-width: 1.8; stroke-dasharray: none; }
  .tree-node.search-match .node-halo { stroke: var(--focus); stroke-width: 1.8; }
  .route-focused .tree-node:not(.owned, .on-path, .selected) { opacity: .3; }
  .tree-node.dimmed, .route-focused .tree-node.dimmed { opacity: .1; }
  .tree-node:hover .node-face { stroke: var(--text); }
  .tree-node-labels { pointer-events: none; }
  .tree-node-labels text { fill: var(--tree-ink); stroke: var(--tree-ink-stroke); paint-order: stroke; font-weight: 500; text-transform: capitalize; }
  .tree-node-labels text.muted { opacity: .25; }
  .tree-tooltip { position: absolute; display: grid; gap: var(--spacing-xs); width: 250px; padding: 11px 13px; pointer-events: none; z-index: var(--z-floater); background: var(--tree-tooltip); border: 1px solid var(--tree-bronze); box-shadow: var(--shadow-raised); color: var(--text); }
  .tree-tooltip strong { display: block; font: var(--tree-fs-lg) var(--tree-display); color: var(--gold-lit); text-transform: capitalize; }
  .tree-tooltip > span { display: block; color: var(--tree-muted); font-size: var(--tree-fs-xs); }
  .tree-tooltip small { display: block; color: var(--tree-muted); font-size: var(--tree-fs-xs); }
  .tree-tooltip p { font-size: var(--tree-fs-sm); line-height: 1.45; max-height: 6em; overflow: hidden; }
  .tree-tools { position: absolute; right: 12px; bottom: 12px; display: flex; align-items: center; gap: 3px; padding: 3px; background: var(--tree-tools); border: 1px solid var(--tree-bronze); }
  .tree-tools button { padding: 6px 8px; min-width: 30px; height: 30px; border-radius: 0; font-size: var(--tree-fs-xs); }
  .tree-tools .icon-mask { width: 17px; height: 17px; }
  .tree-tools > span { min-width: 38px; text-align: center; color: var(--tree-muted); font-size: var(--tree-fs-2xs); font-variant-numeric: tabular-nums; }
  .tree-legend { position: absolute; bottom: 14px; left: 14px; display: flex; flex-wrap: wrap; gap: 13px; padding: 5px 8px; background: var(--tree-legend); border-radius: 3px; color: var(--tree-muted); font-size: var(--tree-fs-2xs); pointer-events: none; }
  .tree-legend span { display: flex; align-items: center; gap: 5px; }
  .tree-legend span::before { content: ''; display: inline-block; width: 6px; height: 6px; border: 1px solid var(--tree-bronze); border-radius: 50%; }
  .legend-owned::before { background: var(--gold); border-color: var(--gold); }
  .legend-ready::before { border-color: var(--tree-node-ready); }
  .legend-route::before { border-color: var(--gold); border-style: dashed; }
  .legend-cross::before { border-color: var(--tree-link-cross); border-radius: 0; height: 1px; }
  @media (max-width: 1100px) {
    .tree-workspace { grid-template-columns: minmax(0, 1fr) 285px; }
    .tree-purse small { display: none; }
    .tree-regions button { padding-inline: 8px; }
  }
  @media (prefers-reduced-motion: reduce) { .tree-node { transition: none; } }
</style>
