import { readFile } from 'node:fs/promises';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { AnimationMixer, Box3, Group, Matrix4, Texture, TextureLoader, Vector3 } from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { ARENA_VIEW, arenaCameraOffset, projectArenaPoint } from '../../src/presentation/arena-camera';
import { SOURCE_MODEL_VERTICAL_PX, sourceModelAnimation, sourceModelProjection, sourceModelScale, sourceModelScreenPoint,
  type SourceModelActor, type SourceModelDurations } from '../../src/ui/dev/three-arena-layer';

const durations: SourceModelDurations = { Idle: 1, Walk: 1, Weapon: .866667, HitReact: .6, Death: .766667 };
const actor = (): SourceModelActor => ({
  actor: { id: 'player', x: 25, y: 16, facing: 0, moving: false, radiusM: .25, hp: 100, hpMax: 100 },
  walkPhase: .25, opacity: 1,
});

describe('source model Field projection and captured animation', () => {
  it('keeps model feet on the existing ground at the centre and every camera edge', () => {
    for (const player of [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 0, y: 32.0513 }, { x: 50, y: 32.0513 }, { x: 25, y: 16 }]) {
      const matrix = new Matrix4().set(...sourceModelProjection(player) as Parameters<Matrix4['set']>);
      for (const point of [{ x: 1, y: 2 }, { x: 25, y: 16 }, { x: 49, y: 31 }]) {
        const projected = new Vector3(point.x, 0, point.y).applyMatrix4(matrix);
        const ground = projectArenaPoint(point), offset = arenaCameraOffset(player);
        expect((projected.x + 1) / 2 * ARENA_VIEW.width).toBeCloseTo(ground.x - offset.x, 8);
        expect((1 - projected.y) / 2 * ARENA_VIEW.height).toBeCloseTo(ground.y - offset.y, 8);
        const head = sourceModelScreenPoint({ x: point.x, y: 1.5, z: point.y }, player);
        expect(head.x).toBeCloseTo(ground.x - offset.x, 8);
        expect(head.y).toBeCloseTo(ground.y - offset.y - 1.5 * SOURCE_MODEL_VERTICAL_PX, 8);
      }
    }
  });

  it('repeats an absolute pose after backwards seeking and maps the strike to real melee impact', () => {
    const view = actor();
    view.action = { id: 4, actorId: 'player', kind: 'swing', atUs: 1_000_000, endsAtUs: 3_000_000, x: 25, y: 16,
      timing: { delivery: 'melee', startedAtUs: 1_000_000, releaseAtUs: 1_200_000, impactAtUs: 1_400_000, recoveryUntilUs: 2_000_000 } };
    const impact = sourceModelAnimation(view, 1_400_000, 1_000_000, durations);
    expect(impact.clip).toBe('Weapon');
    expect(impact.time).toBeCloseTo(durations.Weapon * .45, 7);
    const before = sourceModelAnimation(view, 1_100_000, 1_000_000, durations);
    sourceModelAnimation(view, 1_900_000, 1_000_000, durations);
    expect(sourceModelAnimation(view, 1_100_000, 1_000_000, durations)).toEqual(before);
    expect(sourceModelAnimation(view, 1_100_000, 1_000_000, durations)).toEqual(before);
  });

  it('uses captured distance phase for walking and clamps death through seek and reduced motion', () => {
    const view = actor();
    view.actor.moving = true;
    expect(sourceModelAnimation(view, 9_000_000, 1_000_000, durations)).toEqual({ clip: 'Walk', time: .25 });
    expect(sourceModelAnimation(view, 15_000_000, 1_000_000, durations)).toEqual({ clip: 'Walk', time: .25 });
    expect(sourceModelAnimation(view, 15_000_000, 1_000_000, durations, true)).toEqual({ clip: 'Idle', time: 0 });
    view.actor.hp = 0;
    view.actor.diedAtUs = 10_000_000;
    expect(sourceModelAnimation(view, 10_200_000, 1_000_000, durations)).toEqual({ clip: 'Death', time: .2 });
    expect(sourceModelAnimation(view, 20_000_000, 1_000_000, durations)).toEqual({ clip: 'Death', time: durations.Death });
  });
});

describe('committed source model contract', () => {
  let models: GLTF[];
  beforeAll(async () => {
    // FileLoader dispatches this browser event while reading embedded glTF buffers under Node.
    vi.stubGlobal('ProgressEvent', class { constructor(public type: string, public init: object) {} });
    vi.stubGlobal('self', globalThis);
    // Node has no image decoder. Keep the actual material/geometry loader, substituting only
    // browser image decoding; the real texture is covered by the browser visual check.
    vi.spyOn(TextureLoader.prototype, 'load').mockImplementation((_url, onLoad) => {
      const texture = new Texture<HTMLImageElement>();
      queueMicrotask(() => onLoad?.(texture));
      return texture;
    });
    models = await Promise.all(['orc', 'ninja'].map(async name => {
      const json = await readFile(new URL(`../../public/showcase-models/quaternius-${name}.gltf`, import.meta.url), 'utf8');
      return new GLTFLoader().parseAsync(json, '');
    }));
  });
  afterAll(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it('loads original meshes, normals, materials and every sampled source clip', () => {
    for (const model of models) {
      for (const name of Object.keys(durations)) expect(model.animations.find(clip => clip.name === name)?.duration).toBeGreaterThan(0);
      const body = clone(model.scene);
      const mixer = new AnimationMixer(body);
      mixer.clipAction(model.animations.find(clip => clip.name === 'Idle')!).play();
      mixer.update(0);
      const original = new Box3().setFromObject(body);
      expect(Number.isFinite(original.min.y)).toBe(true);
      body.position.y -= original.min.y;
      const root = new Group();
      root.add(body);
      root.scale.setScalar(sourceModelScale(.25));
      const grounded = new Box3().setFromObject(root);
      expect(grounded.min.y).toBeCloseTo(0, 6);
      expect(grounded.max.y).toBeCloseTo((original.max.y - original.min.y) * sourceModelScale(.25), 6);
      let skinnedMeshes = 0;
      body.traverse(node => {
        if (!('isSkinnedMesh' in node) || !node.isSkinnedMesh) return;
        skinnedMeshes++;
        const mesh = node as import('three').SkinnedMesh;
        expect(mesh.geometry.getAttribute('normal').count).toBeGreaterThan(0);
        expect(mesh.material).toBeDefined();
      });
      expect(skinnedMeshes).toBeGreaterThan(0);
      mixer.stopAllAction();
      mixer.uncacheRoot(body);
    }
  });
});
