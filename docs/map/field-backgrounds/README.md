# Field ground materials

Twelve ground-material families are installed for combat fields: meadow, forest, marsh,
mountain, coast, cave, snow, desert, tomb, ruins, volcanic and rift.

The new images were generated with the built-in image_gen tool. Forest reuses the existing
approved source. Full prompts are in [generation-prompts.json](generation-prompts.json),
original generator paths in [generated-files.json](generated-files.json), and installed/source
paths, dimensions, encoding sizes and hashes in [asset-manifest.json](asset-manifest.json).

## Runtime contract

- Runtime images are in `game/src/assets/combat/*-floor.webp`; generated source PNGs are
  retained in `outputs/`, with the original forest source retained in its existing asset path.
- Images are opaque, straight-down world-plane materials. `ArenaGround.svelte` applies the
  arena projection once, anchored to world coordinates. Do not bake perspective into these files.
- `game/src/ui/combat/arena/arena-ground-materials.ts` owns the visual environment/terrain
  lookup. Named subzones use their authored environment; bare ground uses standing terrain;
  generic dungeon runs use the cave material. The Molten Deeps override disambiguates the
  shared `deeps` environment name.
- Each field renders one texture image in a viewport-sized SVG pattern. URL imports do not
  preload the complete image catalogue. Source PNGs are not used by the runtime catalogue.
- All families use the same world tile scale. WebP is encoded at quality 85; source PNGs remain
  available for future encoding changes.

## Location composition

These assets are the floor layer of each terrain kit. Location landmarks, upright props and
collision layouts remain separate work in the unique-map habitat plan.
Trees, walls, pits and other blocking silhouettes must not be painted into the floor texture.
Any obstacle prop must match movement/sight/projectile data in `tools/data/spawns.json`.

Changing a background does not change roster, habitat eligibility, loot, navigation or save state.
The irregular world-island renovation is tracked separately in the world-map plan.
