<script lang="ts">
  import { onMount } from 'svelte';
  import * as THREE from 'three';

  let { onClose }: { onClose: () => void } = $props();
  let viewport = $state<HTMLDivElement | null>(null);
  let problem = $state('');

  onMount(() => {
    const host = viewport;
    if (!host) return;
    let live = true;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    } catch {
      problem = 'WebGL is unavailable in this browser.';
      return;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-3.7, 3.7, 3.1, -3.1, .1, 50);
    const distance = 12, yaw = THREE.MathUtils.degToRad(-16), elevation = THREE.MathUtils.degToRad(38);
    camera.position.set(-Math.sin(-yaw) * Math.cos(elevation) * distance,
      Math.sin(elevation) * distance, Math.cos(yaw) * Math.cos(elevation) * distance);
    camera.lookAt(0, .9, 0);

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setClearColor(0x111715, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    host.append(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xdfe8d1, 0x493c2c, 2.15));
    const keyLight = new THREE.DirectionalLight(0xffe0ad, 3.2);
    keyLight.position.set(-4.5, 8, -3.5);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.left = -5; keyLight.shadow.camera.right = 5;
    keyLight.shadow.camera.top = 5; keyLight.shadow.camera.bottom = -5;
    keyLight.shadow.normalBias = .035;
    scene.add(keyLight);

    const hex = new THREE.Mesh(new THREE.CylinderGeometry(2.7, 2.79, .34, 6, 1), [
      new THREE.MeshStandardMaterial({ color: 0x65492f, roughness: .94 }),
      new THREE.MeshStandardMaterial({ color: 0x6e8749, roughness: 1 }),
      new THREE.MeshStandardMaterial({ color: 0x694a2d, roughness: .92 }),
    ]);
    hex.rotation.y = Math.PI / 6;
    hex.position.y = .18;
    hex.receiveShadow = true;
    hex.castShadow = true;
    scene.add(hex);

    const rimPoints = Array.from({ length: 7 }, (_, i) => {
      const a = Math.PI / 6 + Math.PI / 3 * i;
      return new THREE.Vector3(2.68 * Math.cos(a), .353, 2.68 * Math.sin(a));
    });
    const rimGeometry = new THREE.BufferGeometry().setFromPoints(rimPoints);
    const rim = new THREE.LineLoop(rimGeometry, new THREE.LineBasicMaterial({ color: 0xc2aa77, transparent: true, opacity: .8 }));
    scene.add(rim);

    const bark = new THREE.MeshStandardMaterial({ color: 0x67472c, roughness: .98 });
    const needles = [0x294835, 0x36573d, 0x476744].map(color => new THREE.MeshStandardMaterial({ color, roughness: .96, flatShading: true }));
    const addPine = (x: number, z: number, scale: number) => {
      const tree = new THREE.Group();
      tree.position.set(x, .36, z);
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.075 * scale, .12 * scale, .78 * scale, 6), bark);
      trunk.position.y = .39 * scale; trunk.castShadow = true; trunk.receiveShadow = true;
      tree.add(trunk);
      for (let i = 0; i < 4; i++) {
        const radius = (.61 - i * .105) * scale, height = (.77 - i * .065) * scale;
        const boughs = new THREE.Mesh(new THREE.ConeGeometry(radius, height, 8, 2), needles[Math.min(2, i % needles.length)]);
        boughs.position.y = (.78 + i * .34) * scale;
        boughs.castShadow = true; boughs.receiveShadow = true;
        tree.add(boughs);
      }
      scene.add(tree);
    };
    addPine(-.78, -.9, 1);
    addPine(-1.55, .42, .7);
    addPine(1.2, -.08, .64);

    const rockMaterial = new THREE.MeshStandardMaterial({ color: 0x817967, roughness: 1, flatShading: true });
    for (const [x, z, scale] of [[-1.95, 1.2, .24], [.35, 1.55, .21], [1.95, .8, .29], [1.65, -1.45, .21]] as const) {
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(scale, 0), rockMaterial);
      rock.position.set(x, .34 + scale * .5, z); rock.scale.y = .58;
      rock.rotation.set(.16, .41, .12); rock.castShadow = true; rock.receiveShadow = true;
      scene.add(rock);
    }

    const loader = new THREE.TextureLoader();
    const addFigure = (src: string, x: number, z: number, width: number, height: number) => {
      loader.load(src, texture => {
        if (!live) { texture.dispose(); return; }
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
        const figure = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true,
          alphaTest: .04, depthTest: true, depthWrite: false }));
        figure.position.set(x, .36, z);
        figure.scale.set(width, height, 1);
        figure.center.set(.5, 0);
        figure.renderOrder = 3;
        scene.add(figure); draw();
      }, undefined, () => { if (live) problem = `Could not load figure ${src}`; });
    };
    addFigure('/map/characters/player/traveler-piece.png', -.85, .82, .86, 1.35);
    addFigure('/map/characters/species/wolf/wolf.png', 1.08, .72, 1.03, 1.15);

    const draw = () => renderer.render(scene, camera);
    const resize = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (!width || !height) return;
      const halfH = 3.25, halfW = halfH * width / height;
      camera.left = -halfW; camera.right = halfW; camera.top = halfH; camera.bottom = -halfH;
      camera.updateProjectionMatrix(); renderer.setSize(width, height, false); draw();
    });
    resize.observe(host);
    draw();
    return () => {
      live = false;
      resize.disconnect(); scene.traverse(o => {
        if (o instanceof THREE.Mesh || o instanceof THREE.LineLoop) {
          o.geometry.dispose();
          const materials = Array.isArray(o.material) ? o.material : [o.material];
          materials.forEach(m => m.dispose());
        }
        if (o instanceof THREE.Sprite) { o.material.map?.dispose(); o.material.dispose(); }
      });
      renderer.dispose(); renderer.domElement.remove();
    };
  });
</script>

<section class="hex3d-preview" aria-label="Single hex Three.js prototype">
  <header class="hex3d-head">
    <div><h2>One hex · camera and depth test</h2><p>Three.js mesh against the current forest art</p></div>
    <button class="btn btn-quiet" type="button" onclick={onClose}>Close preview</button>
  </header>
  {#if problem}<p class="hex3d-error" role="status">{problem}</p>{/if}
  <div class="hex3d-compare">
    <figure><figcaption><b>Current 2.5D tile</b><span>Full forest art, fitted to one hex</span></figcaption>
      <div class="hex3d-art"><img src="/map/terrain/forest-relief.png" alt="Current forest terrain art" /></div>
    </figure>
    <figure><figcaption><b>Three.js prototype</b><span>Extruded ground · raised pines · placed figures</span></figcaption>
      <div class="hex3d-canvas" bind:this={viewport}></div>
    </figure>
  </div>
  <footer>Both use the map's −16° yaw and 38° camera elevation. This is one prototype tile, not a map-wide renderer change.</footer>
</section>

<style>
  .hex3d-preview { position: fixed; z-index: var(--z-popover); inset: 10vh 12vw 14vh; display: grid; grid-template-rows: auto minmax(0,1fr) auto; gap: var(--spacing-md); padding: var(--spacing-md); color: var(--sheet-ink); background: var(--ground-3); border: 1px solid color-mix(in srgb, var(--gold) 52%, var(--ground-3)); border-radius: var(--radius-card); box-shadow: var(--shadow-raised); }
  .hex3d-head { display:flex; justify-content:space-between; align-items:center; gap:var(--spacing-md); }
  .hex3d-head h2,.hex3d-head p { margin:0; }
  .hex3d-head h2 { font-size:var(--font-lg); color:var(--gold-lit); }
  .hex3d-head p,.hex3d-compare figcaption span,.hex3d-preview footer { color:var(--dim); font-size:var(--font-xs); }
  .hex3d-compare { display:grid; grid-template-columns:1fr 1fr; gap:var(--spacing-md); min-height:0; }
  .hex3d-compare figure { display:grid; grid-template-rows:auto minmax(0,1fr); min-width:0; margin:0; border:1px solid color-mix(in srgb, var(--gold) 25%, transparent); border-radius:var(--radius-card); background:var(--ground-2); overflow:hidden; }
  .hex3d-compare figcaption { display:flex; flex-direction:column; gap:2px; padding:var(--spacing-sm) var(--spacing-md); border-bottom:1px solid color-mix(in srgb, var(--gold) 16%, transparent); }
  .hex3d-compare figcaption b { color:var(--gold-lit); font-size:var(--font-sm); }
  .hex3d-art,.hex3d-canvas { display:grid; place-items:center; min-height:0; overflow:hidden; }
  .hex3d-art img { display:block; width:min(100%,660px); max-height:100%; object-fit:contain; }
  .hex3d-canvas { position:relative; }
  .hex3d-canvas :global(canvas) { display:block; width:100%; height:100%; }
  .hex3d-error { align-self:center; justify-self:center; color:var(--alarm); }
  .hex3d-preview footer { line-height:1.4; }
  @media(max-width:1100px) { .hex3d-preview { inset:9vh 4vw 12vh; } }
</style>
