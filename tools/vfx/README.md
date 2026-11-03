# Godot shader adaptation prototype

`aftershock-shader.mjs` translates the scalar masks, noise decay, colour mixing and
stepped lighting from the CC0 ExplosionFXFree `explosion_rings`, `explosion_impact`
and `explosion_smoke` shaders under `art-reference/VFX-Godot`.

This is a JavaScript CPU/Canvas adaptation. It does not execute Godot or reproduce
the original 3D scene, particle meshes, normal textures or lighting. Seeded value
noise replaces Godot's generated FastNoiseLite textures. The sprites are authored
top down; the game applies its shared camera matrix once.

Regenerate the atlas and standalone animated preview from the project root:

```powershell
node --experimental-strip-types tools/render-aftershock-shader.mjs --version=v5
node --experimental-strip-types tools/skill-vfx-pool.ts
```

Open `output/aftershock-shader/preview.html` directly in a browser. Its time slider
and view selector compare the top-down source with the arena projection; the cyan
guide is the canonical world footprint. `projected-preview.png` is an offline
1920 by 1080 comparison, not an in-game screenshot.

Atlas metadata uses `projection: "ground"` and a content radius ratio. See
[VFX angle authoring](../../art-reference/vfx/angle-authoring.md) for the camera contract.

## Remaining skill families

The seven `*-shaders.mjs` modules cover the other 93 active skills: fire, cold,
lightning, dark/poison/curses, earth, physical attacks and support. Each recipe
lists its actual source shader files and records the approximations in `meta.json`.
Regenerate without changing version selections:

```powershell
node tools/bake-shader-recipes.mjs tools/vfx/fire-shaders.mjs tools/vfx/cold-shaders.mjs tools/vfx/lightning-shaders.mjs tools/vfx/dark-shaders.mjs tools/vfx/earth-shaders.mjs tools/vfx/physical-shaders.mjs tools/vfx/support-shaders.mjs
node --experimental-strip-types tools/skill-vfx-pool.ts
node --experimental-strip-types tools/shader-vfx-gallery.mjs
```

The baker reuses only its own recipe/version; manually authored versions stay
untouched. Sixteen padded frames are validated for nonempty active frames and
tile-edge clipping. Family reports contain file sizes; per-version `qa.json`
contains frame checks and the atlas SHA-256. Supplied license files are copied
with pack names so one pack's license cannot overwrite another's. Some supplied
packs omit a local license or contain a misnamed license; these copies are
provenance, not a complete rights audit.

Open `output/shader-skills/index.html` for the animated 94-skill gallery, source
frames and canonical ground projection. This is an art review; actual projectile
paths, rain and hit timing must be checked in the game showcase. Runtime uses
prebaked PNGs, not these CPU render functions. Each 1024-square RGBA atlas occupies
approximately 4 MiB decoded; avoid preloading the whole roster.

Projectile art follows individual committed payloads and actual contact receipts;
it does not schedule damage. Fields use the engine's duration. Active aura art
follows the sampled player, but historical replay uses the current aura toggle
state because arena frames do not snapshot aura reservations.

Blizzard's selected `v6` combines `v3` frost bursts
and `v1` ice rain. `node tools/mix-blizzard.mjs` copies both source atlases
into that version and writes per-layer metadata; regenerate the pool afterward.
`additionalLayers` retain independent frame grids, anchors, rain cadence and
opacity. This composition has no ground shader layer. Original source
versions are retained; discarded versions are not dependencies.

Arrow Shower's selected `v4` uses the original `v1` sprites as falling arrow rain.
The engine's projectile-burst receipts own the shot count, interval and hits;
the decorative `rainSpreadM` provides spread for a single-target skill without
changing its hit area. Each contact retains its full rain animation.
Regenerate with `node tools/compose-arrow-shower.mjs`,
then `node --experimental-strip-types tools/skill-vfx-pool.ts --skill=attack.arrow_shower`.
