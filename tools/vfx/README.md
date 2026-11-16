# Godot shader adaptation prototype

`aftershock-shader.mjs` translates the scalar masks, noise decay, colour mixing and
stepped lighting from the CC0 ExplosionFXFree `explosion_rings`, `explosion_impact`
and `explosion_smoke` shaders.

This is a JavaScript CPU/Canvas adaptation. It does not execute Godot or reproduce
the original 3D scene, particle meshes, normal textures or lighting. Seeded value
noise replaces Godot's generated FastNoiseLite textures. The sprites are authored
top down; the game applies its shared camera matrix once. The original packs are
local-only under `archive/art-reference/VFX-Godot/` and are not part of the repo.

Regenerate the atlas and standalone animated preview from the project root:

```powershell
node --experimental-strip-types tools/render-aftershock-shader.mjs
node --experimental-strip-types tools/skill-vfx-pool.ts
```

Open `output/aftershock-shader/preview.html` directly in a browser. Its time slider
and view selector compare the top-down source with the arena projection; the cyan
guide is the canonical world footprint. `projected-preview.png` is an offline
1920 by 1080 comparison, not an in-game screenshot.

Atlas metadata uses `projection: "ground"` and a content radius ratio. See
[Arena camera](../../game/src/presentation/arena-camera.ts) for the current projection.

## Remaining skill families

The seven `*-shaders.mjs` modules cover the other 93 active skills: fire, cold,
lightning, dark/poison/curses, earth, physical attacks and support. Each recipe
lists its actual source shader files and records the approximations in `meta.json`.
Regenerate the same named recipe only when it is owned by this baker:

```powershell
node tools/bake-shader-recipes.mjs tools/vfx/fire-shaders.mjs tools/vfx/cold-shaders.mjs tools/vfx/lightning-shaders.mjs tools/vfx/dark-shaders.mjs tools/vfx/earth-shaders.mjs tools/vfx/physical-shaders.mjs tools/vfx/support-shaders.mjs
node --experimental-strip-types tools/skill-vfx-pool.ts
node --experimental-strip-types tools/shader-vfx-gallery.mjs
```

The baker reuses only its own flat recipe; manually authored assets stay
untouched. Sixteen padded frames are validated for nonempty active frames and
tile-edge clipping. Family reports contain file sizes; per-skill `qa.json`
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

Blizzard and Arrow Shower now use the flat skill folders described in the [runtime guide](../../game/public/fx/skill-pool/README.md). Their earlier version-only composers were retired. Refresh named source images through the shared component composer; retain independent layer grids, anchors, rain cadence and opacity in the same skill metadata. Committed projectile receipts still own shot count, timing and hits. Decorative rain never changes hit geometry.
