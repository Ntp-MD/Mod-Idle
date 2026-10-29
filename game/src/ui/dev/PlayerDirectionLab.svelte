<script lang="ts">
  import { onMount } from 'svelte';
  import manifest from '../../../../art-reference/players/one-handed-sword/direction-proof/manifest.json';
  import { facingSample, normalizeFacing } from './sprite-directions';

  const sourcePrefix = '../../../../art-reference/players/one-handed-sword/';
  const sourceUrls = import.meta.glob([
    '../../../../art-reference/players/one-handed-sword/poses/idle/*.png',
    '../../../../art-reference/players/one-handed-sword/direction-proof/poses/idle/*.png',
  ], { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
  let left = $state<HTMLCanvasElement>();
  let right = $state<HTMLCanvasElement>();
  let angle = $state(0);
  let playing = $state(true);
  let autoTurn = $state(true);
  let turnSpeed = $state(15);
  let zoom = $state(2);
  let status = $state<'loading' | 'ready' | 'error'>('loading');
  let message = $state('Loading original player views…');
  let images = $state.raw<HTMLImageElement[]>([]);
  let render = () => {};
  const sixteen = $derived(facingSample(angle, 16));
  const thirtyTwo = $derived(facingSample(angle, 32));
  $effect(() => { void images; void angle; void zoom; render(); });

  onMount(() => {
    if (!left || !right) return;
    let disposed = false, raf = 0, previous = performance.now();
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { playing = false; autoTurn = false; }
    render = () => {
      if (images.length !== 32) return;
      for (const [canvas, count] of [[left, 16], [right, 32]] as const) {
        if (!canvas) continue;
        const context = canvas.getContext('2d');
        if (!context) continue;
        const index = facingSample(angle, count).sourceRow;
        const image = images[index], frame = manifest.frames[index];
        const [l, t, r, b] = frame.bounds;
        const scale = manifest.displayHeight / (b - t) * zoom;
        const x = Math.round(canvas.width / 2), y = Math.round(canvas.height * .68);
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = '#11161b';
        context.beginPath(); context.ellipse(x, y + 4, 30 * zoom, 7 * zoom, 0, 0, Math.PI * 2); context.fill();
        context.imageSmoothingEnabled = false;
        context.drawImage(image, l, t, r - l, b - t,
          x - (frame.footAnchor.x - l) * scale, y - (frame.footAnchor.y - t) * scale,
          (r - l) * scale, (b - t) * scale);
      }
    };
    const resize = new ResizeObserver(entries => {
      for (const entry of entries) {
        const canvas = entry.target as HTMLCanvasElement;
        canvas.width = Math.max(1, Math.round(entry.contentRect.width));
        canvas.height = Math.max(1, Math.round(entry.contentRect.height));
      }
      render();
    });
    resize.observe(left); resize.observe(right);
    const loadImage = (path: string) => new Promise<HTMLImageElement>((resolve, reject) => {
      const url = sourceUrls[sourcePrefix + path];
      if (!url) { reject(new Error(`Missing player view: ${path}`)); return; }
      const image = new Image(); image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`Player view could not load: ${path}`)); image.src = url;
    });
    void Promise.all(manifest.frames.map(frame => loadImage(frame.path))).then(loaded => {
      if (!disposed) { images = loaded; status = 'ready'; render(); }
    }).catch(error => { if (!disposed) { status = 'error'; message = error instanceof Error ? error.message : String(error); } });
    function tick(now: number) {
      const dt = Math.min(.1, Math.max(0, (now - previous) / 1000)); previous = now;
      if (playing && autoTurn && status === 'ready') angle = normalizeFacing(angle + dt * turnSpeed);
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => { disposed = true; cancelAnimationFrame(raf); resize.disconnect(); render = () => {}; };
  });
</script>

<section class="direction-lab" aria-label="Original player 32-view target versus 16-view baseline review" data-direction-lab data-ready={status === 'ready'} data-player-source="art-reference/players/one-handed-sword" data-chosen-direction-target="32">
  <header class="lab-header">
    <div><h1>Player · 32-view target</h1><p>Compare 16 views as the baseline against the selected 32-view target.</p></div>
    <p class="source-note">Original cream-hooded player from art-reference/players/one-handed-sword.<br />8 existing views + 24 generated candidates · idle turntable</p>
  </header>
  <div class="lab-tools">
    <button type="button" class="btn btn-quiet" disabled={status !== 'ready'} onclick={() => playing = !playing}>{playing ? 'Pause' : 'Play'}</button>
    <button type="button" class="btn btn-quiet" disabled={status !== 'ready'} onclick={() => angle = 0}>Restart</button>
    <label><input type="checkbox" bind:checked={autoTurn} /> Auto turn</label>
    <label>Turn speed <select bind:value={turnSpeed}><option value={15}>Slow · 15°/s</option><option value={30}>30°/s</option><option value={60}>60°/s</option></select></label>
    <label>Size <select bind:value={zoom}><option value={1}>1× · play size</option><option value={2}>2× · inspect</option><option value={3}>3× · close view</option></select></label>
    <label class="angle-control">Requested facing <input aria-label="Facing angle" type="range" min="0" max="359.9" step="0.1" value={angle} oninput={event => { autoTurn = false; angle = Number(event.currentTarget.value); }} /><output>{angle.toFixed(1)}°</output></label>
  </div>
  {#if status !== 'ready'}<div class="load-status" role="status">{message}{#if status === 'error'} <button class="btn btn-quiet" onclick={() => location.reload()}>Reload</button>{/if}</div>{/if}
  <div class="comparison">
    {#each [16, 32] as count}
      {@const sample = count === 16 ? sixteen : thirtyTwo}
      {@const source = manifest.frames[sample.sourceRow]}
      <article class="view" data-direction-count={count} data-facing-index={sample.index} data-source-row={sample.sourceRow} data-frame="0" data-source-kind={source.kind}>
        <header><h2>{count === 16 ? '16 views · comparison baseline' : '32 views · selected target'}</h2><p>Requested spacing: {360 / count}°</p></header>
        {#if count === 16}<canvas bind:this={left} aria-label="16 view original player"></canvas>{:else}<canvas bind:this={right} aria-label="32 view original player"></canvas>{/if}
        <footer><span>Selected view: <b>{sample.angle.toFixed(2)}°</b></span><span>{source.kind === 'existing-player-source' ? 'Existing player source' : 'Generated candidate'}</span></footer>
      </article>
    {/each}
  </div>
  <footer class="lab-footer"><p><strong>Draft review:</strong> generated angles and silhouette continuity are not approved. This compares idle-facing candidates; walking animation has not been produced for these new directions.</p></footer>
</section>

<style>
  .direction-lab { height: 100%; min-height: 0; display: grid; grid-template-rows: auto auto minmax(0, 1fr) auto; color: var(--text); background: var(--bg); }
  .lab-header { display: flex; align-items: center; justify-content: space-between; gap: 24px; padding: 20px 28px 16px; }
  .lab-header > div { display: grid; gap: 5px; }
  h1 { margin: 0; font-size: 26px; font-weight: 600; }
  .lab-header p { margin: 0; color: var(--dim); font-size: 14px; }
  .source-note { text-align: right; }
  .lab-tools { display: flex; flex-wrap: wrap; align-items: center; gap: 14px; padding: 12px 28px; border-block: 1px solid var(--line); background: var(--panel); font-size: 14px; }
  label { display: flex; align-items: center; gap: 8px; }
  .angle-control { flex: 1; min-width: 250px; }
  .angle-control input { flex: 1; accent-color: var(--es); }
  output { width: 60px; text-align: right; font-variant-numeric: tabular-nums; }
  .comparison { display: grid; grid-template-columns: 1fr 1fr; min-height: 0; }
  .view { min-width: 0; min-height: 0; display: grid; grid-template-rows: auto minmax(0, 1fr) auto; background: #25282d; }
  .view + .view { border-left: 1px solid var(--line); }
  .view header { display: grid; gap: 4px; padding: 24px 28px 0; }
  h2 { margin: 0; font-size: 22px; font-weight: 600; }
  .view header p { margin: 0; color: #bec8d5; font-size: 14px; }
  canvas { display: block; width: 100%; height: 100%; min-height: 0; }
  .view footer { display: flex; justify-content: space-between; gap: 20px; padding: 16px 28px; color: #bec8d5; font-size: 14px; font-variant-numeric: tabular-nums; }
  .view b { color: var(--text); font-weight: 600; }
  .lab-footer { padding: 12px 28px; font-size: 13px; color: var(--dim); }
  .lab-footer p { margin: 0; }
  .lab-footer strong { color: var(--gold-lit); }
  .load-status { position: absolute; z-index: 2; top: 45%; left: 0; right: 0; text-align: center; padding: 20px; color: var(--text); background: var(--panel); }
  :focus-visible { outline: 2px solid var(--focus); outline-offset: 3px; }
</style>
