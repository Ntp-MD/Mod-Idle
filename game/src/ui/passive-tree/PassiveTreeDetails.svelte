<script lang="ts">
  import type { TreeNode } from '../../../../engine/tree';
  import { tree } from '../../engine/client';
  import { canSpendTree, treePointsFree } from '../../sim/tree';
  import type { GameState } from '../../sim/types';
  import { previewTreeRoute } from '../../sim/build-preview';
  import BuildChangePreview from '../shared/BuildChangePreview.svelte';
  import flagGlyph from '../../icon/ui/flag.png';

  let {
    selected, game, path, verdict, byId, conflict = null, titleOf, grantLabel,
    effectText, lineLabel, iconOf, onbuy, onpath, onselect, ontrackgoal,
    goalId = null,
  }: {
    selected: TreeNode | undefined;
    game: GameState;
    path: { nodes: string[]; cost: { tree: number; attainment: number } };
    verdict: { ok: boolean; why?: string };
    byId: Record<string, TreeNode>;
    conflict?: TreeNode | null;
    titleOf: (node: TreeNode) => string;
    grantLabel: (grant: TreeNode['grants'][number]) => string;
    effectText: (node: TreeNode) => string;
    lineLabel: (id: string) => string;
    iconOf: (node: TreeNode) => string;
    onbuy: (id: string) => void;
    onpath: (id: string) => void;
    onselect: (id: string) => void;
    ontrackgoal: (id: string) => void;
    goalId?: string | null;
  } = $props();

  const regionNames: Record<string, string> = {
    str: 'Strength', agi: 'Agility', dex: 'Dexterity', int: 'Intelligence',
    wis: 'Wisdom', vit: 'Vitality', lck: 'Luck',
  };
  const kindLabel = (kind: string) => kind === 'normal' ? 'Normal passive' : kind.charAt(0).toUpperCase() + kind.slice(1);
  const currencyLabel = (currency: string) => currency === 'tree' ? 'Tree' : currency === 'attainment' ? 'Attainment' : currency;
  const signed = (value: number) => value > 0 ? `+${value}` : String(value);
  const readableReason = (reason = '') => reason
    .replace(/^needs (\d+) banked point$/, (_, count: string) => `Requires ${count} Tree point${Number(count) === 1 ? '' : 's'}.`)
    .replace(/^needs (\d+) attainment point$/, (_, count: string) => `Requires ${count} Attainment point${Number(count) === 1 ? '' : 's'}.`)
    .replace('connect this node to an owned path first', 'Allocate a connected skill first, or allocate the full route.');
  const rank = $derived(selected ? game.player.treeRanks?.[selected.id] || 0 : 0);
  const complete = $derived(!!selected && rank >= selected.ranks);
  const routeNodes = $derived(path.nodes.map((id) => byId[id]).filter((node): node is TreeNode => !!node));
  const wallets = $derived([
    { key: 'tree', label: 'Tree', available: treePointsFree(game, 'tree'), cost: path.cost.tree },
    { key: 'attainment', label: 'Attainment', available: treePointsFree(game, 'attainment'), cost: path.cost.attainment },
  ]);
  // Only ranks on this private player copy change. Allocation remains the runtime's job.
  const routeCheck = $derived.by(() => {
    if (!path.nodes.length) return { ok: false, why: complete ? 'This destination is already allocated.' : 'No connected route is available.', conflict: null as TreeNode | null };
    const ranks = { ...(game.player.treeRanks ?? {}) };
    const preview: GameState = { ...game, player: { ...game.player, treeRanks: ranks } };
    let blocked = '';
    let routeConflict: TreeNode | null = conflict;
    for (const id of path.nodes) {
      const holder = tree.version >= 3 ? tree.pairHolder(id, ranks) : tree.groupHolder(id, ranks);
      if (holder && !routeConflict) routeConflict = byId[holder] || tree.byId[holder] || null;
      const step = canSpendTree(preview, id);
      if (!step.ok && !blocked) blocked = step.why || 'This route cannot be allocated.';
      ranks[id] = (ranks[id] ?? 0) + 1;
    }
    const shortage = wallets.find((wallet) => wallet.cost > wallet.available);
    if (shortage) return { ok: false, why: `Requires ${shortage.cost} ${shortage.label} points for the complete route; ${shortage.cost - shortage.available} more needed.`, conflict: routeConflict };
    return { ok: !blocked, why: readableReason(blocked), conflict: routeConflict };
  });
  const routeKinds = $derived(['normal', 'junction', 'notable', 'keystone']
    .map((kind) => ({ kind, count: routeNodes.filter((node) => node.kind === kind).length }))
    .filter(({ count }) => count > 0));
  const buildPreview = $derived(selected && !complete && path.nodes.length ? previewTreeRoute(game, selected.id) : null);
</script>

<aside class="tree-detail scroll-pane" aria-label="Selected passive skill and route planner">
  {#if selected}
    <header class="destination">
      <div class={'medallion ' + selected.kind} aria-hidden="true"><img src={iconOf(selected)} alt="" /></div>
      <div>
        <h3>{titleOf(selected)}</h3>
        <p>{kindLabel(selected.kind)} <span>·</span> {regionNames[selected.wing] || selected.wing}</p>
      </div>
    </header>

    <div class="node-state" class:owned={complete} class:available={!complete && verdict.ok}>
      <span class="state-mark" aria-hidden="true"></span>
      <span>{complete ? 'Allocated' : verdict.ok ? 'Ready to allocate' : 'Unallocated'}</span>
      {#if selected.ranks > 1}<span class="rank">Rank {rank} / {selected.ranks}</span>{/if}
    </div>

    <section class="destination-benefits" aria-label="Destination bonuses and effects">
      {#if selected.grants.length}
        <h4>{complete ? 'Allocated bonuses' : 'Destination grants'}</h4>
        <dl class="grants">
          {#each selected.grants as grant}
            <div>
              <dt>{grantLabel(grant)}</dt>
              <dd>{signed(grant.values[Math.min(rank, grant.values.length - 1)])}</dd>
            </div>
          {/each}
        </dl>
        {#if selected.ranks > 1 && !complete}<p class="supporting">Values shown for the next rank.</p>{/if}
      {/if}
      {#if effectText(selected)}<p class="effect">{effectText(selected)}</p>{/if}
      {#if selected.weapon}<p class="condition">Requires {selected.weapon} equipped.</p>{/if}
      {#if selected.rule}<p class="restriction">You no longer receive {lineLabel(selected.rule.target)}.</p>{/if}
      {#if conflict || routeCheck.conflict}
        {@const holder = conflict || routeCheck.conflict}
        {#if holder}<p class="restriction">Incompatible with <strong>{titleOf(holder)}</strong>. Respec the conflicting Keystone before taking this route.</p>{/if}
      {/if}
    </section>

    {#if !complete}
      <section class="route-plan" aria-labelledby="tree-route-title">
        <div class="section-heading"><h4 id="tree-route-title">Route to destination</h4><strong>{path.nodes.length} <span>skill{path.nodes.length === 1 ? '' : 's'}</span></strong></div>
        {#if path.nodes.length}
          <p class="route-composition">
            {#each routeKinds as item, index}
              {#if index > 0}<span aria-hidden="true"> · </span>{/if}{item.count} {item.kind === 'normal' ? 'Normal' : kindLabel(item.kind)}
            {/each}
          </p>
          <table class="route-cost" aria-label="Full route cost and points remaining">
            <thead><tr><th scope="col">Points</th><th scope="col">Cost</th><th scope="col">After route</th></tr></thead>
            <tbody>
              {#each wallets as wallet (wallet.key)}
                <tr class:short={wallet.cost > wallet.available}>
                  <th scope="row">{wallet.label}</th><td>{wallet.cost}</td>
                  <td>{wallet.cost > wallet.available ? `${wallet.cost - wallet.available} needed` : `${wallet.available - wallet.cost} left`}</td>
                </tr>
              {/each}
            </tbody>
          </table>
          <details class="route-steps">
            <summary>Inspect {path.nodes.length} route step{path.nodes.length === 1 ? '' : 's'}</summary>
            <ol aria-label="Skills in purchase order">
              {#each routeNodes as node (node.id)}
                {@const stepRank = game.player.treeRanks?.[node.id] || 0}
                <li class:destination-step={node.id === selected.id}>
                  <details class="route-step">
                    <summary title={'Inspect ' + titleOf(node)}>
                      <span class="route-step-label"><span class={'step-symbol ' + node.kind} aria-hidden="true"></span><span>{titleOf(node)}<small>{kindLabel(node.kind)} · {node.cost} {currencyLabel(node.currency)}</small></span></span>
                    </summary>
                    <section class="step-inspection" aria-label={`${titleOf(node)} route step details`}>
                      {#if node.grants.length}
                        <dl class="grants">
                          {#each node.grants as grant}
                            <div><dt>{grantLabel(grant)}</dt><dd>{signed(grant.values[Math.min(stepRank, grant.values.length - 1)])}</dd></div>
                          {/each}
                        </dl>
                      {/if}
                      {#if effectText(node)}<p class="effect">{effectText(node)}</p>{/if}
                      {#if node.weapon}<p class="condition">Requires {node.weapon} equipped.</p>{/if}
                      {#if node.rule}<p class="restriction">You no longer receive {lineLabel(node.rule.target)}.</p>{/if}
                    </section>
                  </details>
                </li>
              {/each}
            </ol>
          </details>
        {:else}<p class="supporting">No connected route is available.</p>{/if}
      </section>
    {/if}

    {#if buildPreview}<BuildChangePreview preview={buildPreview} title="After the full route" omitNote={selected.id} />{/if}

    <div class="detail-actions">
      {#if !complete}
        {#if path.nodes.length > 1}
          <button class="btn btn-gold" type="button" disabled={!routeCheck.ok} title={routeCheck.ok ? 'Allocate every skill in this route' : routeCheck.why} onclick={() => onpath(selected.id)}>Allocate full route <span>{path.nodes.length} skills</span></button>
          {#if !routeCheck.ok}<p class="action-reason">{routeCheck.why}</p>{/if}
        {/if}
        <button class={`btn ${path.nodes.length <= 1 ? 'btn-gold' : 'btn-quiet'}`} type="button" disabled={!verdict.ok} title={verdict.ok ? 'Allocate this passive skill' : readableReason(verdict.why)} onclick={() => onbuy(selected.id)}>
          Allocate skill <span>{selected.cost} {currencyLabel(selected.currency)}</span>
        </button>
        {#if !verdict.ok && path.nodes.length <= 1}<p class="action-reason">{readableReason(verdict.why)}</p>{/if}
      {/if}
      <button class="track-action btn btn-flat" type="button" disabled={goalId === selected.id} onclick={() => ontrackgoal(selected.id)}>
        <span class="icon-mask" style={`--glyph:url(${flagGlyph})`} aria-hidden="true"></span>
        {goalId === selected.id ? 'Tracked in Journey' : 'Track destination'}
      </button>
    </div>

    <details class="tree-help">
      <summary>Planning your build</summary>
      <p>Select a skill to preview its route from your allocated skills; the price includes the destination.</p>
      <p>Drag to pan · Scroll to zoom<br />Arrow keys follow connected skills.<br />Shift-click allocates the full route.</p>
      <p>Respec is free at the town Counterhand.</p>
    </details>
  {:else}
    <div class="empty-detail"><h3>Choose a destination</h3><p>Select a passive to see its bonuses, route and point cost.</p></div>
  {/if}
</aside>

<style>
  .tree-detail { display: flex; flex-direction: column; align-items: stretch; gap: 17px; min-width: 0; padding: 22px 21px 18px; border-left: 1px solid var(--tree-bronze); background: color-mix(in srgb, var(--ground-3) 65%, var(--inset)); color: var(--text); font-size: var(--tree-fs-sm); line-height: 1.5; scrollbar-color: var(--tree-bronze) var(--inset); scrollbar-width: thin; }
  .destination { display: flex; align-items: center; gap: 13px; min-width: 0; }
  h3, h4, p, dl, dd { margin: 0; }
  h3 { color: var(--gold-lit); font: var(--tree-fs-3xl)/1.15 var(--tree-display); text-wrap: balance; text-transform: capitalize; overflow-wrap: anywhere; }
  .destination p { padding-top: 7px; color: var(--tree-muted); font-size: var(--tree-fs-xs); }
  .destination p > span { padding-inline: 3px; }
  .medallion { display: grid; place-items: center; flex: none; width: 46px; height: 46px; border: 1px solid var(--tree-bronze); border-radius: 50%; background: var(--ground-3); }
  .medallion.notable { outline: 1px solid var(--tree-bronze); outline-offset: 3px; }
  .medallion.keystone { border: 2px solid var(--gold); border-radius: 7px; outline: 1px solid var(--tree-bronze); outline-offset: 3px; }
  .medallion img { width: 32px; height: 32px; object-fit: contain; }
  .node-state { display: flex; align-items: center; gap: 7px; color: var(--tree-muted); font-size: var(--tree-fs-xs); }
  .state-mark { width: 5px; height: 5px; border: 1px solid currentColor; border-radius: 50%; flex: none; }
  .node-state.owned { color: var(--gold-lit); }
  .node-state.owned .state-mark { background: currentColor; }
  .node-state.available { color: var(--good-lit); }
  .rank { margin-inline-start: auto; font-variant-numeric: tabular-nums; }
  .destination-benefits { display: grid; gap: 10px; padding-top: 17px; border-top: 1px solid var(--line); }
  h4 { font-size: var(--tree-fs-sm); font-weight: 600; color: var(--tree-muted); }
  .grants { display: grid; gap: 6px; }
  .grants > div { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 12px; align-items: baseline; }
  .grants dt { text-transform: capitalize; }
  .grants dd { font-size: var(--tree-fs-2xl); line-height: 1.3; color: var(--good-lit); font-variant-numeric: tabular-nums; }
  .effect { line-height: 1.65; }
  .supporting, .condition { color: var(--tree-muted); font-size: var(--tree-fs-xs); }
  .restriction { color: var(--alarm); font-size: var(--tree-fs-xs); }
  .restriction strong { font-weight: 600; }
  .route-plan { display: grid; gap: 10px; padding-top: 17px; border-top: 1px solid var(--line); }
  .step-inspection { display: grid; gap: var(--spacing-sm); padding-block: var(--spacing-sm); }
  .section-heading { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }
  .section-heading strong { white-space: nowrap; color: var(--gold-lit); font-size: var(--tree-fs-md); font-weight: 500; font-variant-numeric: tabular-nums; }
  .section-heading strong > span { font-size: var(--tree-fs-xs); }
  .route-composition { color: var(--tree-muted); font-size: var(--tree-fs-2xs); }
  .route-cost { width: 100%; border-collapse: collapse; font-size: var(--tree-fs-xs); font-variant-numeric: tabular-nums; }
  .route-cost th, .route-cost td { padding: 7px 0; text-align: right; font-weight: 400; }
  .route-cost th:first-child { text-align: left; }
  .route-cost thead th { color: var(--tree-muted); font-size: var(--tree-fs-2xs); border-bottom: 1px solid var(--line); }
  .route-cost tbody td:nth-child(2) { color: var(--gold-lit); }
  .route-cost .short td:last-child { color: var(--alarm); }
  .route-steps { font-size: var(--tree-fs-xs); }
  summary { cursor: pointer; color: var(--tree-muted); }
  summary:hover { color: var(--gold-lit); }
  .route-steps ol { padding-top: 9px; padding-inline-start: 22px; color: var(--tree-muted); font-variant-numeric: tabular-nums; }
  .route-steps li { padding: 3px 0 3px 2px; }
  .route-step > summary { padding: 4px 2px; font-size: var(--tree-fs-xs); }
  .route-step-label { display: inline-flex; align-items: baseline; gap: 9px; }
  .route-steps small { display: block; padding-top: var(--spacing-2xs); color: var(--tree-muted); font-size: var(--tree-fs-2xs); }
  .step-symbol { width: 6px; height: 6px; border: 1px solid var(--tree-bronze); border-radius: 50%; flex: none; }
  .step-symbol.notable { outline: 1px solid var(--tree-bronze); outline-offset: 2px; }
  .step-symbol.keystone { border-color: var(--gold); border-radius: 0; transform: rotate(45deg); }
  .destination-step > details > summary { color: var(--gold-lit); }
  .detail-actions { display: grid; gap: 8px; }
  .detail-actions > button { display: flex; align-items: center; justify-content: space-between; gap: 10px; width: 100%; min-height: 40px; padding: 10px 12px; font-size: var(--tree-fs-sm); text-align: left; }
  .detail-actions > button > span { white-space: nowrap; font-size: var(--tree-fs-2xs); font-variant-numeric: tabular-nums; }
  .detail-actions > .track-action { justify-content: center; }
  .track-action .icon-mask { width: 16px; height: 16px; }
  .action-reason { color: var(--tree-muted); font-size: var(--tree-fs-xs); }
  .tree-help { margin-top: auto; padding-top: 17px; border-top: 1px solid var(--line); color: var(--tree-muted); font-size: var(--tree-fs-2xs); }
  .tree-help p { padding-top: var(--spacing-sm); }
  .empty-detail { display: grid; gap: var(--spacing-sm); }
  .empty-detail p { color: var(--tree-muted); }
  @media (max-width: 1150px) { .tree-detail { padding: 18px 16px; } h3 { font-size: var(--tree-fs-2xl); } .medallion { width: 40px; height: 40px; } .medallion img { width: 28px; height: 28px; } }
  @media (max-width: 760px) { .tree-detail { padding: 14px 12px; gap: 14px; } .destination { gap: 10px; } h3 { font-size: var(--tree-fs-xl); } .destination p { font-size: var(--tree-fs-2xs); } .medallion { width: 34px; height: 34px; } .medallion img { width: 25px; height: 25px; } }
</style>
