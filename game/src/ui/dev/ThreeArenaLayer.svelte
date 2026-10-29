<script lang="ts">
  import { onMount } from 'svelte';
  import * as THREE from 'three';
  import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
  import { clone } from 'three/addons/utils/SkeletonUtils.js';
  import { sourceModelAnimation, sourceModelProjection, sourceModelScale,
    type SourceModelClip, type SourceModelDurations, type ThreeArenaLayerProps } from './three-arena-layer';

  let { actors, player, atUs, unitsPerSec, bounds, reducedMotion = false, onReadyChange }: ThreeArenaLayerProps = $props();
  let host: HTMLDivElement;
  let ready = $state(false);
  let renderSample: (() => void) | undefined;

  // Svelte's existing arena playhead is the only clock. No simulation or independent RAF runs here.
  $effect(() => {
    void actors; void player; void atUs; void unitsPerSec; void bounds; void reducedMotion;
    renderSample?.();
  });

  onMount(() => {
    let disposed = false;
    let failed = false;
    let renderer: THREE.WebGLRenderer | undefined;
    const sources: GLTF[] = [];
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera();
    const instances = new Map<string, {
      root: THREE.Group; mixer: THREE.AnimationMixer; actions: Map<SourceModelClip, THREE.AnimationAction>;
      durations: SourceModelDurations; materials: { material: THREE.Material; opacity: number; transparent: boolean }[];
    }>();
    const modelUrl = (file: string) => `${import.meta.env.BASE_URL}showcase-models/${file}`;
    const clipNames: SourceModelClip[] = ['Idle', 'Walk', 'Weapon', 'HitReact', 'Death'];
    let resize: ResizeObserver | undefined;
    let renderWidth = 0, renderHeight = 0;

    function fail(error: unknown) {
      if (failed || disposed) return;
      failed = true;
      ready = false;
      onReadyChange?.(false);
      if (renderer) renderer.domElement.style.visibility = 'hidden';
      console.warn('[source-model-preview] Using sprite fallback:', error);
    }

    function removeInstance(id: string) {
      const instance = instances.get(id);
      if (!instance) return;
      instance.mixer.stopAllAction();
      instance.mixer.uncacheRoot(instance.root);
      instance.root.traverse(node => { if (node instanceof THREE.SkinnedMesh) node.skeleton.dispose(); });
      for (const { material } of instance.materials) material.dispose();
      instance.root.removeFromParent();
      instances.delete(id);
    }

    function makeInstance(id: string) {
      const source = sources[id === 'player' ? 1 : 0];
      const body = clone(source.scene) as THREE.Group;
      const root = new THREE.Group();
      root.add(body);
      const materials: { material: THREE.Material; opacity: number; transparent: boolean }[] = [];
      body.traverse(node => {
        const mesh = node as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.castShadow = true;
        mesh.receiveShadow = false;
        // Exact source shading, normals and palette. A private material copy only permits the
        // existing corpse fade without changing another actor or the original loaded asset.
        const copy = (original: THREE.Material) => {
          const material = original.clone();
          materials.push({ material, opacity: material.opacity, transparent: material.transparent });
          return material;
        };
        mesh.material = Array.isArray(mesh.material) ? mesh.material.map(copy) : copy(mesh.material);
      });
      const mixer = new THREE.AnimationMixer(body);
      const actions = new Map<SourceModelClip, THREE.AnimationAction>();
      const durations = {} as SourceModelDurations;
      for (const name of clipNames) {
        const clip = source.animations.find(clip => clip.name === name);
        if (!clip) throw new Error(`Source model is missing ${name}`);
        const action = mixer.clipAction(clip);
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
        actions.set(name, action);
        durations[name] = clip.duration;
      }
      actions.get('Idle')!.play();
      mixer.update(0);
      body.position.y -= new THREE.Box3().setFromObject(body).min.y;
      scene.add(root);
      const instance = { root, mixer, actions, durations, materials };
      instances.set(id, instance);
      return instance;
    }

    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
      renderer.setClearColor(0x000000, 0);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.debug.onShaderError = () => fail('Source model shader compilation failed');
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.domElement.setAttribute('aria-label', 'Original Quaternius source models in the live Field');
      host.appendChild(renderer.domElement);
      renderer.domElement.addEventListener('webglcontextlost', event => { event.preventDefault(); fail('WebGL context lost'); });
      scene.add(new THREE.HemisphereLight(0xffffff, 0x7a8580, 2));
      const sun = new THREE.DirectionalLight(0xffffff, 2.2);
      sun.position.set(-15, 28, 16);
      sun.castShadow = true;
      sun.shadow.mapSize.set(2048, 2048);
      sun.shadow.camera.left = -10; sun.shadow.camera.right = 10;
      sun.shadow.camera.top = 10; sun.shadow.camera.bottom = -10;
      sun.shadow.camera.near = .5; sun.shadow.camera.far = 100;
      sun.shadow.bias = -.0003;
      sun.shadow.normalBias = .02;
      scene.add(sun, sun.target);
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShadowMaterial({ opacity: .13 }));
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = -.008;
      ground.receiveShadow = true;
      scene.add(ground);

      renderSample = () => {
        if (disposed || failed || sources.length !== 2 || !renderer) return;
        try {
          const matrix = new THREE.Matrix4().set(...sourceModelProjection(player) as Parameters<THREE.Matrix4['set']>);
          const depth = new THREE.Vector3(-matrix.elements[2], -matrix.elements[6], -matrix.elements[10]).normalize();
          camera.position.set(player.x + depth.x * 50, depth.y * 50, player.y + depth.z * 50);
          camera.lookAt(player.x, 0, player.y);
          camera.updateMatrixWorld();
          camera.projectionMatrix.multiplyMatrices(matrix, camera.matrixWorld);
          camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
          ground.position.set(bounds.width / 2, -.008, bounds.height / 2);
          ground.scale.set(bounds.width, bounds.height, 1);
          sun.position.set(player.x - 15, 28, player.y + 16);
          sun.target.position.set(player.x, 0, player.y);
          const ids = new Set(actors.map(view => view.actor.id));
          for (const id of instances.keys()) if (!ids.has(id)) removeInstance(id);
          for (const view of actors) {
            const instance = instances.get(view.actor.id) ?? makeInstance(view.actor.id);
            instance.root.position.set(view.actor.x, 0, view.actor.y);
            instance.root.rotation.y = Math.PI / 2 - view.actor.facing;
            instance.root.scale.setScalar(sourceModelScale(view.actor.radiusM));
            instance.root.visible = view.opacity > 0;
            const sampled = sourceModelAnimation(view, atUs, unitsPerSec, instance.durations, reducedMotion);
            for (const [name, action] of instance.actions) {
              action.enabled = name === sampled.clip;
              action.weight = name === sampled.clip ? 1 : 0;
              if (name === sampled.clip) {
                action.play();
                action.paused = true;
                action.time = Math.min(sampled.time, Math.max(0, instance.durations[name] - .00001));
              }
            }
            instance.mixer.update(0);
            for (const entry of instance.materials) {
              const transparent = entry.transparent || view.opacity < 1;
              if (entry.material.transparent !== transparent) { entry.material.transparent = transparent; entry.material.needsUpdate = true; }
              entry.material.opacity = entry.opacity * view.opacity;
            }
          }
          const width = Math.max(1, host.clientWidth), height = Math.max(1, host.clientHeight);
          if (width !== renderWidth || height !== renderHeight) {
            renderWidth = width; renderHeight = height;
            renderer.setSize(width, height, false);
          }
          renderer.render(scene, camera);
          if (!failed && !ready) { ready = true; onReadyChange?.(true); }
        } catch (error) { fail(error); }
      };
      resize = new ResizeObserver(() => renderSample?.());
      resize.observe(host);
      const loader = new GLTFLoader();
      void Promise.allSettled([
        loader.loadAsync(modelUrl('quaternius-orc.gltf')),
        loader.loadAsync(modelUrl('quaternius-ninja.gltf')),
      ]).then(results => {
        for (const result of results) if (result.status === 'fulfilled') sources.push(result.value);
        if (disposed) { disposeSources(); return; }
        const rejection = results.find(result => result.status === 'rejected');
        if (rejection?.status === 'rejected') { disposeSources(); throw rejection.reason; }
        renderSample?.();
      }).catch(fail);
    } catch (error) { fail(error); }

    function disposeSources() {
      const geometries = new Set<THREE.BufferGeometry>();
      const materials = new Set<THREE.Material>();
      const textures = new Set<THREE.Texture>();
      const bitmaps = new Set<ImageBitmap>();
      for (const source of sources) source.scene.traverse(node => {
        const mesh = node as THREE.Mesh;
        if (!mesh.isMesh) return;
        geometries.add(mesh.geometry);
        for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
          materials.add(material);
          for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
        }
      });
      for (const texture of textures) {
        if (typeof ImageBitmap !== 'undefined' && texture.image instanceof ImageBitmap) bitmaps.add(texture.image);
        texture.dispose();
      }
      for (const bitmap of bitmaps) bitmap.close();
      for (const material of materials) material.dispose();
      for (const geometry of geometries) geometry.dispose();
      sources.length = 0;
    }

    return () => {
      disposed = true;
      renderSample = undefined;
      resize?.disconnect();
      onReadyChange?.(false);
      for (const id of instances.keys()) removeInstance(id);
      disposeSources();
      scene.traverse(node => {
        const mesh = node as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.geometry.dispose();
          for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) material.dispose();
        }
        if (node instanceof THREE.DirectionalLight) node.shadow.dispose();
      });
      renderer?.dispose();
      renderer?.domElement.remove();
    };
  });
</script>

<div class="three-arena-layer" bind:this={host} data-source-model-layer data-ready={ready} data-source-model-actors={actors.length}
  data-source-model-time={Math.round(atUs)} aria-hidden="true"></div>

<style>
  .three-arena-layer { position: absolute; inset: 0; z-index: 0; pointer-events: none; }
  .three-arena-layer :global(canvas) { display: block; width: 100%; height: 100%; }
</style>
