<script lang="ts">
  import { E, spawns } from '../../engine/client';
  import { groundReferenceReport, proofCells, proofIssues, proofNavLayout, proofRoute } from './field-nav-proof';

  const WIDTH = E.combat_arena.width;
  const HEIGHT = E.combat_arena.height;
  const RADIUS = 0.3;
  const START = { x: E.combat_arena.player_start.x, y: E.combat_arena.player_start.y };
  const model = proofNavLayout('forest-clearing');
  const layout = model.layout;
  const cells = proofCells(layout, RADIUS);
  const blocked = cells.filter((cell) => !cell.walkable);
  const homes = spawns.pointsFor(1, null);
  const issues = proofIssues('forest-clearing', START, RADIUS);
  const ground = groundReferenceReport();

  let showGrid = $state(true);
  let goalId = $state(homes[0]?.id ?? '');
  let probe = $state<{ x: number; y: number } | null>(null);
  const home = $derived(homes.find((point) => point.id === goalId));
  const goal = $derived(probe ?? (home ? { x: home.x, y: home.y } : { x: WIDTH / 2, y: HEIGHT / 2 }));
  const goalLabel = $derived(probe ? 'clicked ground' : goalId);
  const routeResult = $derived(proofRoute(layout, START, goal, RADIUS));

  const clamp = (point: { x: number; y: number }) => ({
    x: Math.min(WIDTH, Math.max(0, point.x)),
    y: Math.min(HEIGHT, Math.max(0, point.y)),
  });

  function pick(event: MouseEvent) {
    const box = (event.currentTarget as SVGSVGElement).getBoundingClientRect();
    probe = clamp({
      x: ((event.clientX - box.left) / box.width) * WIDTH,
      y: ((event.clientY - box.top) / box.height) * HEIGHT,
    });
  }

  function nudge(event: KeyboardEvent) {
    const step = event.shiftKey ? 2 : 0.5;
    const delta: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step],
    };
    const move = delta[event.key];
    if (!move) return;
    event.preventDefault();
    probe = clamp({ x: goal.x + move[0], y: goal.y + move[1] });
  }
</script>

<div class="nav-proof">
  <header>
    <strong>Field navigation · proof overlay</strong>
    <span>{model.authored ? 'Authored geometry' : 'Proof grid at 1 m — obstacles are not authored yet'}</span>
  </header>
  <div class="controls" role="group" aria-label="Navigation proof controls">
    <label><input type="checkbox" bind:checked={showGrid} /> Grid</label>
    <label>Goal
      <select bind:value={goalId} onchange={() => (probe = null)} aria-label="Route goal home">
        {#each homes as point (point.id)}<option value={point.id}>{point.id}</option>{/each}
      </select>
    </label>
    <span class="status">{cells.length} cells · {blocked.length} blocked · body {RADIUS} m</span>
    {#if routeResult.ok}
      <span class="status good">Route · {routeResult.length.toFixed(2)} m · {routeResult.waypoints.length} points</span>
    {:else}
      <span class="status bad">No route · {routeResult.reason}</span>
    {/if}
    <span class="status">{issues === null
      ? 'Homes unauthored — validator idle'
      : issues.length ? `${issues.length} homes blocked or unreachable` : 'All homes clear and reachable'}</span>
    <span class="status" class:bad={!ground.worldLocked}>
      {ground.worldLocked
        ? `Ground locked to camera · ${ground.artPxPerMeter.x.toFixed(1)}×${ground.artPxPerMeter.y.toFixed(1)} art px per meter (anisotropic world)`
        : `Ground art ${ground.artPx.width}×${ground.artPx.height} px is not camera-locked`}
    </span>
  </div>
  <svg
    viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
    style={`aspect-ratio: ${WIDTH} / ${HEIGHT};`}
    role="button"
    tabindex="0"
    aria-label="Field navigation map. Click the ground to set the route goal; arrow keys nudge it."
    onclick={pick}
    onkeydown={nudge}
  >
    {#if showGrid}
      {#each cells as cell (cell.row * 1000 + cell.col)}
        <rect class="cell" x={cell.x} y={cell.y} width={cell.width} height={cell.height} />
      {/each}
    {/if}
    {#each blocked as cell (`b${cell.row}:${cell.col}`)}
      <rect class="blocked" x={cell.x} y={cell.y} width={cell.width} height={cell.height} />
    {/each}
    {#each layout.obstacles as obstacle (obstacle.id)}
      {#if obstacle.kind === 'circle'}
        <circle class="obstacle" cx={obstacle.x} cy={obstacle.y} r={obstacle.radius} />
      {:else}
        <rect class="obstacle" x={obstacle.x} y={obstacle.y} width={obstacle.width} height={obstacle.height} />
      {/if}
    {/each}
    {#each homes as home (home.id)}
      <circle class="roam" cx={home.x} cy={home.y} r={home.roam_m} />
      <circle class="home" cx={home.x} cy={home.y} r="0.28" />
    {/each}
    {#if routeResult.ok}
      <polyline class="route" points={routeResult.waypoints.map((point) => `${point.x},${point.y}`).join(' ')} />
    {/if}
    <circle class="goal" cx={goal.x} cy={goal.y} r="0.45" />
    <circle class="start" cx={START.x} cy={START.y} r="0.42" />
  </svg>
</div>

<style>
  .nav-proof { display: flex; flex-direction: column; gap: var(--spacing-sm); padding: var(--spacing-sm); min-height: 0; }
  header { display: flex; align-items: baseline; gap: var(--spacing-sm); }
  header span { color: var(--dim); font-size: var(--font-xs); }
  .controls { display: flex; flex-wrap: wrap; align-items: center; gap: var(--spacing-sm) var(--spacing-md); font-size: var(--font-xs); }
  .status { color: var(--dim); }
  .status.good { color: var(--es); }
  .status.bad { color: #ff8a80; }
  svg {
    width: 100%; max-height: 70vh; display: block; cursor: crosshair;
    background: color-mix(in srgb, var(--inset) 70%, transparent);
    border: 1px solid var(--line); border-radius: var(--radius-card);
  }
  svg:focus-visible { outline: 2px solid var(--es); outline-offset: 2px; }
  .cell { fill: none; stroke: var(--line); stroke-width: 0.035; opacity: 0.55; }
  .blocked { fill: color-mix(in srgb, #ff5252 40%, transparent); }
  .obstacle { fill: color-mix(in srgb, var(--dim) 55%, transparent); }
  .roam { fill: none; stroke: var(--es); stroke-width: 0.06; opacity: 0.35; }
  .home { fill: var(--es); opacity: 0.8; }
  .route { fill: none; stroke: #ffd54f; stroke-width: 0.16; stroke-linejoin: round; }
  .goal { fill: #ffd54f; }
  .start { fill: #ffffff; stroke: #101014; stroke-width: 0.08; }
</style>
