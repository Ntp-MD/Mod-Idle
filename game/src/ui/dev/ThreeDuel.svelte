<script lang="ts">
  import { onMount } from 'svelte';
  import * as THREE from 'three';
  import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
  import { approachPoint, clipForPhase, DUEL_CLIPS, exchangeTimeline } from './three-duel';

  /** Source inspection and an optional scripted exchange; neither mode drives game combat. */
  interface Fighter {
    root: THREE.Group;
    mixer: THREE.AnimationMixer;
    clips: Map<string, THREE.AnimationClip>;
    current: string | null;
    hp: number;
    side: 1 | -1;
    floorY: number;
    cooldownUntil: number;
    exchange: { startedAt: number; release: number; recover: number; struck: boolean } | null;
    dead: boolean;
    name: string;
  }

  type View = 'front' | 'three-quarter' | 'side';
  const MODEL_URL = (file: string) => `${import.meta.env.BASE_URL}showcase-models/${file}`;
  const CLIP_ORDER = ['Idle', 'Walk', 'Run', 'Punch', 'Weapon', 'HitReact', 'Death', 'Jump', 'Jump_Idle', 'Jump_Land', 'Duck', 'Wave', 'Yes', 'No'];
  const WINDUP = 0.35, RELEASE = 0.6, RECOVER = 1.1, COOLDOWN = 2.2, RANGE = 2.4, SPEED = 3.2, BOUT_HP = 100, HIT_PCT = 34;

  let host: HTMLDivElement | null = null;
  let mode = $state<'inspect' | 'duel'>('inspect');
  let selectedClip = $state('Walk');
  let view = $state<View>('three-quarter');
  let zoom = $state(100);
  let paused = $state(false);
  let reducedMotion = $state(false);
  let loadState = $state<'loading' | 'ready' | 'error'>('loading');
  let errorMessage = $state('');
  let clipOptions = $state<{ name: string; duration: number }[]>([]);
  let fighters = $state<{ name: string; hp: number }[]>([]);
  let winner = $state<string | null>(null);
  let restartScene = () => {};
  let updateView = () => {};
  const selectedDuration = $derived(clipOptions.find((clip) => clip.name === selectedClip)?.duration ?? 0);

  function setClip(f: Fighter, name: string, loop: boolean, restart = false) {
    if (!restart && f.current === name) return;
    const clip = f.clips.get(name);
    if (!clip) return;
    f.mixer.stopAllAction();
    f.current = name;
    const action = f.mixer.clipAction(clip);
    action.enabled = true;
    action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    action.clampWhenFinished = !loop;
    action.reset().play();
    f.mixer.update(0);
  }

  function setPhase(f: Fighter, phase: 'idle' | 'walk' | 'attack' | 'hit' | 'dead') {
    setClip(f, DUEL_CLIPS[clipForPhase(phase)], phase === 'idle' || phase === 'walk');
  }

  /** glTF materials retain their atlas, normals and filtering. Dispose their textures too. */
  function disposeObjects(root: THREE.Object3D) {
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    const textures = new Set<THREE.Texture>();
    const skeletons = new Set<THREE.Skeleton>();
    const bitmaps = new Set<ImageBitmap>();
    root.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh) return;
      geometries.add(mesh.geometry);
      if ((mesh as THREE.SkinnedMesh).isSkinnedMesh) skeletons.add((mesh as THREE.SkinnedMesh).skeleton);
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        materials.add(material);
        for (const value of Object.values(material)) {
          if (value instanceof THREE.Texture) textures.add(value);
        }
      }
    });
    for (const texture of textures) {
      if (typeof ImageBitmap !== 'undefined' && texture.image instanceof ImageBitmap) bitmaps.add(texture.image);
      texture.dispose();
    }
    for (const bitmap of bitmaps) bitmap.close();
    for (const skeleton of skeletons) skeleton.dispose();
    for (const material of materials) material.dispose();
    for (const geometry of geometries) geometry.dispose();
  }

  onMount(() => {
    if (!host) return;
    const mount = host;
    reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    paused = reducedMotion;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch (error) {
      loadState = 'error';
      errorMessage = `WebGL could not start. ${error instanceof Error ? error.message : String(error)}`;
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.VSMShadowMap;
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.setAttribute('role', 'img');
    renderer.domElement.setAttribute('aria-label', 'Original Quaternius Orc and Ninja models with their embedded animation');
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x303134);
    const camera = new THREE.OrthographicCamera(-6, 6, 3.3, -3.3, 0.1, 100);
    scene.add(new THREE.HemisphereLight(0xffffff, 0xc9c9c9, 2.2));
    const sun = new THREE.DirectionalLight(0xffffff, 2.8);
    sun.position.set(-4, 9, 7);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 0.5, far: 30 });
    sun.shadow.camera.updateProjectionMatrix();
    sun.shadow.normalBias = 0.03;
    sun.shadow.bias = -0.0001;
    sun.shadow.radius = 6;
    sun.shadow.blurSamples = 8;
    scene.add(sun);
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(60, 60),
      new THREE.ShadowMaterial({ color: 0x000000, opacity: 0.25 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const loader = new GLTFLoader();
    const clock = new THREE.Clock();
    let raf = 0, disposed = false, elapsed = 0, boutOverAt = -1;
    let bout: Fighter[] = [];

    function makeFighter(gltf: GLTF, name: string, side: 1 | -1): Fighter {
      const root = gltf.scene;
      const floorY = -new THREE.Box3().setFromObject(root).min.y;
      root.traverse((node) => {
        const mesh = node as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.castShadow = true;
          mesh.receiveShadow = false;
        }
      });
      scene.add(root);
      return {
        root, mixer: new THREE.AnimationMixer(root),
        clips: new Map(gltf.animations.map((clip) => [clip.name, clip])),
        current: null, hp: BOUT_HP, side, floorY,
        cooldownUntil: 0, exchange: null, dead: false, name,
      };
    }

    function syncBars() {
      fighters = bout.map((f) => ({ name: f.name, hp: f.hp }));
    }

    function placeInspection() {
      const angle = view === 'front' ? 0 : view === 'side' ? Math.PI / 2 : Math.PI / 5;
      const aspect = (mount.clientWidth || 960) / (mount.clientHeight || 540);
      const spacing = Math.min(2.4, 6.6 * aspect / 4);
      for (let i = 0; i < bout.length; i++) {
        const f = bout[i];
        const offset = (i === 0 ? -1 : 1) * spacing;
        f.root.position.set(Math.cos(angle) * offset, f.floorY, -Math.sin(angle) * offset);
        f.root.rotation.set(0, 0, 0);
      }
    }

    updateView = () => {
      const width = mount.clientWidth || 960, height = mount.clientHeight || 540;
      const angle = mode === 'duel' ? 0 : view === 'front' ? 0 : view === 'side' ? Math.PI / 2 : Math.PI / 5;
      const span = mode === 'duel' ? 8.5 : 6.6 * 100 / zoom;
      camera.left = -span * width / height / 2;
      camera.right = span * width / height / 2;
      camera.top = span / 2;
      camera.bottom = -span / 2;
      camera.position.set(Math.sin(angle) * 12, mode === 'duel' ? 8 : 5.4, Math.cos(angle) * 12);
      camera.lookAt(0, 1.4, 0);
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
      if (mode === 'inspect') placeInspection();
    };

    restartScene = () => {
      elapsed = 0;
      boutOverAt = -1;
      winner = null;
      for (const f of bout) {
        f.hp = BOUT_HP;
        f.dead = false;
        f.exchange = null;
        f.cooldownUntil = 1 + (f.side > 0 ? 0.4 : 0);
        f.root.position.set(f.side * 4.5, f.floorY, 0);
        f.root.rotation.set(0, f.side > 0 ? -Math.PI / 2 : Math.PI / 2, 0);
        setClip(f, mode === 'inspect' ? selectedClip : DUEL_CLIPS.idle, true, true);
      }
      syncBars();
      updateView();
    };

    function startExchange(f: Fighter) {
      const beats = exchangeTimeline({ windupSec: WINDUP, releaseSec: RELEASE, recoverySec: RECOVER });
      f.exchange = { startedAt: elapsed, release: beats[1].at, recover: beats[2].at, struck: false };
      setPhase(f, 'attack');
    }

    function strike(f: Fighter, victim: Fighter) {
      victim.hp = Math.max(0, victim.hp - HIT_PCT);
      setPhase(victim, victim.hp <= 0 ? 'dead' : 'hit');
      if (victim.hp <= 0) {
        victim.dead = true;
        winner = f.name;
        boutOverAt = elapsed + 4;
      }
      syncBars();
    }

    function stepDuel(dt: number) {
      elapsed += dt;
      if (winner && elapsed >= boutOverAt) restartScene();
      for (const f of bout) {
        if (f.dead) continue;
        const foe = bout.find((other) => other !== f)!;
        if (f.exchange) {
          const t = elapsed - f.exchange.startedAt;
          if (!f.exchange.struck && t >= f.exchange.release && !foe.dead) {
            f.exchange.struck = true;
            strike(f, foe);
          }
          if (t >= f.exchange.recover) {
            f.exchange = null;
            f.cooldownUntil = elapsed + COOLDOWN;
            if (!f.dead) setPhase(f, 'idle');
          }
          continue;
        }
        const gap = f.root.position.distanceTo(foe.root.position);
        f.root.lookAt(foe.root.position.x, f.floorY, foe.root.position.z);
        if (gap > RANGE) {
          const next = approachPoint(f.root.position, foe.root.position, SPEED, dt);
          f.root.position.x = next.x;
          f.root.position.z = next.z;
          setPhase(f, 'walk');
        } else if (elapsed >= f.cooldownUntil && !foe.dead) {
          startExchange(f);
        } else {
          setPhase(f, 'idle');
        }
      }
    }

    async function boot() {
      const results = await Promise.allSettled([
        loader.loadAsync(MODEL_URL('quaternius-orc.gltf')),
        loader.loadAsync(MODEL_URL('quaternius-ninja.gltf')),
      ]);
      const loaded = results.flatMap((result) => result.status === 'fulfilled' ? [result.value] : []);
      const failure = results.find((result) => result.status === 'rejected');
      if (disposed || failure) {
        for (const gltf of loaded) disposeObjects(gltf.scene);
        if (!disposed && failure?.status === 'rejected') {
          loadState = 'error';
          errorMessage = `Models could not load. ${failure.reason instanceof Error ? failure.reason.message : String(failure.reason)}`;
          console.error('[three-duel]', errorMessage);
        }
        return;
      }
      bout = [makeFighter(loaded[0], 'Orc', 1), makeFighter(loaded[1], 'Ninja', -1)];
      clipOptions = [...bout[0].clips.values()]
        .filter((clip) => bout[1].clips.has(clip.name))
        .sort((a, b) => CLIP_ORDER.indexOf(a.name) - CLIP_ORDER.indexOf(b.name))
        .map((clip) => ({ name: clip.name, duration: clip.duration }));
      restartScene();
      loadState = 'ready';
    }

    function frame() {
      if (disposed) return;
      raf = requestAnimationFrame(frame);
      const dt = Math.min(clock.getDelta(), 0.1);
      if (!paused && loadState === 'ready') {
        if (mode === 'duel') stepDuel(dt);
        for (const f of bout) f.mixer.update(dt);
      }
      renderer.render(scene, camera);
    }

    const observer = new ResizeObserver(updateView);
    observer.observe(mount);
    updateView();
    void boot();
    frame();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
      restartScene = () => {};
      updateView = () => {};
      for (const f of bout) {
        f.mixer.stopAllAction();
        f.mixer.uncacheRoot(f.root);
      }
      disposeObjects(scene);
      sun.shadow.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  });
</script>

<section class="three-duel" aria-label="Quaternius source model preview">
  <div class="preview-tools">
    <label>Mode
      <select value={mode} onchange={(event) => { mode = event.currentTarget.value as 'inspect' | 'duel'; restartScene(); }} disabled={loadState !== 'ready'}>
        <option value="inspect">Source animations</option>
        <option value="duel">Scripted duel</option>
      </select>
    </label>
    <label>Animation
      <select value={selectedClip} onchange={(event) => { selectedClip = event.currentTarget.value; restartScene(); }} disabled={loadState !== 'ready' || mode !== 'inspect'}>
        {#if !clipOptions.length}<option value="Walk">loading models…</option>{/if}
        {#each clipOptions as clip (clip.name)}<option value={clip.name}>{clip.name} · {clip.duration.toFixed(2)} s</option>{/each}
      </select>
    </label>
    <div class="playback-controls">
      <button type="button" onclick={() => paused = !paused} disabled={loadState !== 'ready'}>{paused ? 'Play' : 'Pause'}</button>
      <button type="button" onclick={() => restartScene()} disabled={loadState !== 'ready'}>Restart</button>
    </div>
    <fieldset disabled={loadState !== 'ready' || mode !== 'inspect'}>
      <legend>Camera</legend>
      <div class="camera-controls">
        {#each [{ value: 'front', label: 'Front' }, { value: 'three-quarter', label: 'Three-quarter' }, { value: 'side', label: 'Side' }] as angle}
          <button type="button" aria-pressed={view === angle.value} onclick={() => { view = angle.value as View; updateView(); }}>{angle.label}</button>
        {/each}
      </div>
    </fieldset>
    <label class="zoom-control">Zoom
      <input type="range" min="75" max="125" step="5" value={zoom} oninput={(event) => { zoom = Number(event.currentTarget.value); updateView(); }} disabled={loadState !== 'ready' || mode !== 'inspect'} />
      <output>{zoom}%</output>
    </label>
  </div>

  <div class="preview-stage" bind:this={host}>
    <p class="preview-status" role="status">
      {#if loadState === 'loading'}loading models…
      {:else if loadState === 'error'}{errorMessage} <button type="button" onclick={() => window.location.reload()}>Reload preview</button>
      {:else if mode === 'inspect'}{selectedClip} · {selectedDuration.toFixed(2)} s · {paused ? 'Paused' : 'Playing'}{reducedMotion && paused ? ' · reduced motion' : ''}
      {:else}Scripted duel · {paused ? 'Paused' : winner ? `${winner} wins` : 'Playing'}{/if}
    </p>
    {#if loadState === 'ready'}
      <div class="model-labels" class:duel-labels={mode === 'duel'}>
        {#each fighters as fighter (fighter.name)}
          <p><strong>{fighter.name}</strong>{#if mode === 'duel'}<span>{fighter.hp}/{BOUT_HP} HP</span>{/if}</p>
        {/each}
      </div>
    {/if}
  </div>
  <div class="preview-caption">
    <p>Original Quaternius meshes, atlas and {clipOptions.length || 14} embedded animations. White light, soft shadows, original proportions.</p>
    <a href="/__showcase?sample=arpg-arena&renderer=3d">Open the real Field in 3D</a>
    {#if mode === 'duel'}<p>The duel uses scripted preview timing.</p>{/if}
  </div>
</section>

<style>
  .three-duel { display: grid; grid-template-rows: auto minmax(0, 1fr) auto; width: 100%; height: 100%; min-width: 0; min-height: 0; color: var(--text); font: 14px/1.45 var(--ui); }
  .preview-tools { display: flex; flex-wrap: wrap; align-items: end; gap: 12px 18px; padding: 14px 18px; background: var(--panel); }
  .preview-tools label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--text); }
  .preview-tools select, .preview-tools button, .preview-status button { min-height: 34px; padding: 5px 10px; border: 1px solid var(--line); border-radius: 4px; background: var(--inset); color: var(--text); font: 14px var(--ui); }
  .preview-tools button:enabled:hover, .preview-status button:hover { background: var(--bar-2); }
  .preview-tools button[aria-pressed='true'] { border-color: var(--es); color: var(--es-lit); background: var(--bar-2); }
  .preview-tools :disabled { opacity: 0.5; cursor: not-allowed; }
  .preview-tools :focus-visible, .preview-status button:focus-visible, .preview-caption a:focus-visible { outline: 2px solid var(--focus); outline-offset: 3px; }
  .playback-controls, .camera-controls { display: flex; gap: 5px; }
  .preview-tools fieldset { margin: 0; padding: 0; border: 0; }
  .preview-tools legend { padding: 0 0 4px; font-size: 12px; }
  .preview-tools .zoom-control { display: grid; grid-template-columns: 100px 38px; align-items: center; gap: 4px 8px; }
  .zoom-control input { grid-column: 1; margin: 0; accent-color: var(--es); }
  .zoom-control output { grid-column: 2; grid-row: 2; font-variant-numeric: tabular-nums; text-align: right; }
  .preview-stage { position: relative; width: 100%; min-height: 0; overflow: hidden; background: #303134; }
  .preview-status { position: absolute; z-index: 1; top: 14px; left: 18px; right: 18px; margin: 0; display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; color: #e4e6e9; font-size: 13px; }
  .preview-status button { margin: 0; }
  .model-labels { position: absolute; z-index: 1; left: 12%; right: 12%; bottom: 9%; display: grid; grid-template-columns: 1fr 1fr; text-align: center; pointer-events: none; color: #e4e6e9; }
  .model-labels p { display: flex; flex-direction: column; gap: 3px; margin: 0; }
  .model-labels strong { font-size: 18px; }
  .model-labels span { font-variant-numeric: tabular-nums; }
  .duel-labels { left: 18px; right: auto; top: 44px; bottom: auto; display: flex; gap: 24px; text-align: left; }
  .duel-labels strong { font-size: 14px; }
  .preview-caption { display: flex; flex-wrap: wrap; gap: 5px 24px; justify-content: space-between; padding: 10px 18px; background: var(--panel); font-size: 12px; color: var(--text); }
  .preview-caption p { margin: 0; }
  .preview-caption a { color: var(--es-lit); text-underline-offset: 3px; }
</style>
