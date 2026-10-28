<script lang="ts">
  import { onMount } from 'svelte';
  import * as THREE from 'three';
  import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
  import { approachPoint, clipForPhase, DUEL_CLIPS, exchangeTimeline } from './three-duel';

  /** Dev-only Three.js duel: Quaternius Orc vs Ninja on a slice of authored ground.
   *  The renderer lives entirely in onMount, so SSR renders only the container. All WebGL
   *  objects are disposed on unmount; one tab, one canvas, closed with the sample. */

  interface Fighter {
    root: THREE.Group;
    mixer: THREE.AnimationMixer;
    clips: Map<string, THREE.AnimationClip>;
    current: string | null;
    hp: number;
    maxHp: number;
    side: 1 | -1;
    cooldownUntil: number;
    exchange: { startedAt: number; windup: number; release: number; recover: number; struck: boolean } | null;
    dead: boolean;
    deadAt: number;
    name: string;
  }

  const MODEL_URL = (file: string) => `${import.meta.env.BASE_URL}showcase-models/${file}`;
  const WINDUP = 0.35, RELEASE = 0.6, RECOVER = 1.1, COOLDOWN = 2.2, RANGE = 2.4, SPEED = 3.2, BOUT_HP = 100, HIT_PCT = 34;

  let host: HTMLDivElement | null = null;
  let fighters = $state<{ name: string; hp: number; maxHp: number; winner: boolean }[]>([]);
  let status = $state('loading models…');
  let winner = $state<string | null>(null);
  let reducedMotion = $state(false);

  /** One animation owns the body at a time; replays only start on a phase change, so a
   *  loop keeps advancing instead of restarting every frame. */
  function setAnim(f: Fighter, phase: 'idle' | 'walk' | 'attack' | 'hit' | 'dead', loop: boolean, clamp = false) {
    const name = DUEL_CLIPS[clipForPhase(phase)];
    if (f.current === name) return;
    f.current = name;
    for (const [clipName, clip] of f.clips) {
      const action = f.mixer.clipAction(clip);
      if (clipName === name) {
        action.enabled = true;
        action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
        action.clampWhenFinished = clamp;
        action.reset().fadeIn(0.12).play();
      } else {
        action.fadeOut(0.12);
      }
    }
  }

  onMount(() => {
    if (!host) return;
    reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const W = () => host!.clientWidth || 960, H = () => host!.clientHeight || 540;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(W(), H());
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    host.appendChild(renderer.domElement);
    renderer.domElement.setAttribute('aria-label', 'Three.js duel: ninja versus orc');

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1d2b23);
    scene.fog = new THREE.Fog(0x1d2b23, 30, 70);
    const camera = new THREE.PerspectiveCamera(42, W() / H(), 0.1, 200);
    camera.position.set(0, 13, 15);
    camera.lookAt(0, 1, 0);

    scene.add(new THREE.HemisphereLight(0xdfeee6, 0x1c2620, 1.1));
    const sun = new THREE.DirectionalLight(0xfff2d8, 1.6);
    sun.position.set(6, 12, 4);
    scene.add(sun);

    const groundMat = new THREE.MeshStandardMaterial({ color: 0x2c463a, roughness: 1 });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(30, 18), groundMat);
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);
    const ridgeMat = new THREE.MeshStandardMaterial({ color: 0x3a4a52, roughness: 1 });
    const ridgeGeo = new THREE.BoxGeometry(2.5, 3, 6);
    for (const z of [-6.5, 6.5]) {
      const ridge = new THREE.Mesh(ridgeGeo, ridgeMat);
      ridge.position.set(-9, 1.5, z);
      scene.add(ridge);
    }

    const loader = new GLTFLoader();
    const clock = new THREE.Clock();
    let raf = 0, disposed = false, elapsed = 0;
    let bout: Fighter[] = [];
    let boutOverAt = -1;

    function makeFighter(gltf: any, name: string, side: 1 | -1, x: number): Fighter {
      const root = gltf.scene as THREE.Group;
      root.position.set(x, 0, 0);
      root.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
      scene.add(root);
      const mixer = new THREE.AnimationMixer(root);
      const clips = new Map<string, THREE.AnimationClip>();
      for (const clip of gltf.animations as THREE.AnimationClip[]) clips.set(clip.name, clip);
      const f: Fighter = {
        root, mixer, clips, current: null, hp: BOUT_HP, maxHp: BOUT_HP, side,
        cooldownUntil: 1 + (side > 0 ? 0.4 : 0), exchange: null,
        dead: false, deadAt: 0, name,
      };
      setAnim(f, 'idle', true);
      return f;
    }

    function startExchange(f: Fighter, now: number) {
      const beats = exchangeTimeline({ windupSec: WINDUP, releaseSec: RELEASE, recoverySec: RECOVER });
      f.exchange = { startedAt: now, windup: beats[0].at, release: beats[1].at, recover: beats[2].at, struck: false };
      setAnim(f, 'attack', false, true);
    }

    function strike(f: Fighter, v: Fighter) {
      v.hp = Math.max(0, v.hp - HIT_PCT);
      setAnim(v, v.hp <= 0 ? 'dead' : 'hit', v.hp > 0, v.hp <= 0);
      if (v.hp <= 0 && !v.dead) {
        v.dead = true;
        v.deadAt = elapsed;
        winner = f.name;
        boutOverAt = elapsed + 4;
      }
      syncBars();
    }

    function syncBars() {
      fighters = bout.map((f) => ({ name: f.name, hp: Math.round(f.hp), maxHp: f.maxHp, winner: winner === f.name }));
    }

    async function boot() {
      try {
        const [orc, ninja] = await Promise.all([
          loader.loadAsync(MODEL_URL('quaternius-orc.gltf')),
          loader.loadAsync(MODEL_URL('quaternius-ninja.gltf')),
        ]);
        if (disposed) return;
        const orcF = makeFighter(orc, 'Orc', 1, 4.5);
        const ninjaF = makeFighter(ninja, 'Ninja', -1, -4.5);
        bout = [orcF, ninjaF];
        syncBars();
        status = reducedMotion ? 'idle preview (reduced motion)' : 'fighting';
      } catch (error) {
        status = `models failed to load: ${error instanceof Error ? error.message : String(error)}`;
        console.error('[three-duel]', status);
      }
    }

    function step(dt: number) {
      elapsed += dt;
      if (reducedMotion || bout.length !== 2) {
        for (const f of bout) f.mixer.update(dt);
        return;
      }
      if (winner && elapsed >= boutOverAt) {
        for (const f of bout) {
          f.hp = f.maxHp; f.dead = false; f.exchange = null;
          f.cooldownUntil = elapsed + 1;
          f.current = null;
          setAnim(f, 'idle', true);
        }
        winner = null;
        syncBars();
      }
      for (const f of bout) f.mixer.update(dt);
      for (const f of bout) {
        if (f.dead) continue;
        const foe = bout.find((o) => o !== f)!;
        const gap = Math.hypot(foe.root.position.x - f.root.position.x, foe.root.position.z - f.root.position.z);
        if (f.exchange) {
          const t = elapsed - f.exchange.startedAt;
          if (!f.exchange.struck && t >= f.exchange.release && !foe.dead) {
            f.exchange.struck = true;
            strike(f, foe);
          }
          if (t >= f.exchange.recover) {
            f.exchange = null;
            f.cooldownUntil = elapsed + COOLDOWN;
            if (!f.dead) setAnim(f, 'idle', true);
          }
          continue;
        }
        if (gap > RANGE) {
          const next = approachPoint(
            { x: f.root.position.x, z: f.root.position.z },
            { x: foe.root.position.x, z: foe.root.position.z }, SPEED, dt);
          f.root.position.x = next.x;
          f.root.position.z = next.z;
          f.root.lookAt(foe.root.position.x, 0, foe.root.position.z);
          setAnim(f, 'walk', true);
        } else if (elapsed >= f.cooldownUntil && !foe.dead) {
          f.root.lookAt(foe.root.position.x, 0, foe.root.position.z);
          startExchange(f, elapsed);
        } else if (!f.exchange) {
          f.root.lookAt(foe.root.position.x, 0, foe.root.position.z);
          setAnim(f, 'idle', true);
        }
      }
    }

    function frame() {
      if (disposed) return;
      raf = requestAnimationFrame(frame);
      const dt = Math.min(clock.getDelta(), 0.1);
      step(dt);
      renderer.render(scene, camera);
    }

    function onResize() {
      camera.aspect = W() / H();
      camera.updateProjectionMatrix();
      renderer.setSize(W(), H());
    }
    window.addEventListener('resize', onResize);
    void boot();
    frame();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      for (const f of bout) {
        f.mixer.stopAllAction();
        f.mixer.uncacheRoot(f.root);
      }
      scene.traverse((node: THREE.Object3D) => {
        const mesh = node as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.geometry.dispose();
          const material = mesh.material as THREE.Material | THREE.Material[];
          (Array.isArray(material) ? material : [material]).forEach((m) => m.dispose());
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  });
</script>

<div class="three-duel" bind:this={host} aria-label="Three.js duel showcase">
  <div class="three-duel-hud" aria-hidden="false">
    <p class="three-duel-status" role="status">{status}</p>
    {#each fighters as fighter (fighter.name)}
      <p>{fighter.name}: {fighter.hp}/{fighter.maxHp}{fighter.winner ? ' — wins' : ''}</p>
    {/each}
  </div>
</div>

<style>
  .three-duel { position: relative; width: 100%; min-height: 420px; aspect-ratio: 16 / 9; background: #101814; }
  .three-duel-hud { position: absolute; left: 12px; top: 10px; color: #f2eedb; font: 600 13px/1.5 var(--ui, sans-serif); text-shadow: 0 1px 3px #000; pointer-events: none; }
  .three-duel-status { opacity: .8; }
</style>
