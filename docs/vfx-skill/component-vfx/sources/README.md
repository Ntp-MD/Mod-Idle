# Deferred procedural 3D sources

The owner switched current production to the existing 2D raster roster on 2026-11-11. These scenes and their measured exports are retained as earlier experiments. Do not run further Blender production for the raster roster; follow the [named PNG/raw/QA guide](../outputs/README.md). None of these scenes counts as a finished new raster ingredient.

The raster roster defines 33 components. The first five have editable Blender scenes and measured camera exports: `charge-gather`, `motion-trail`, `contact-flash`, `shield-ripple` and `body-coating`. Human visual approval is pending.

Each `.blend` retains separate meshes, procedural emission/alpha materials, object keyframes and an embedded copy of its builder. Shield ripples use editable absolute shape keys to travel across the curved surface. A camera-only render opens the saved scene and does not rebuild or save effect geometry.

## Ownership

| File | Owns |
| --- | --- |
| [components.json](components.json) | 33 stable component IDs, review skill/phase, binding, FPS and special attachment requirements. |
| [cameras.json](cameras.json) | Orthographic elevation, azimuth, span, target height and eight world headings. |
| `<component>.blend` | Editable geometry, materials and the shared 24-frame timeline. |
| [build-vfx-scenes.py](../tools/build-vfx-scenes.py) | Procedural authoring and separate camera/direction export functions. |
| [pack-vfx-atlases.py](../tools/pack-vfx-atlases.py) | Exact RGBA packing, frame checks, metadata, contact sheets and gallery. |
| [verify-vfx-scene.py](../tools/verify-vfx-scene.py) | Source preservation, camera-only rerender, decoded-pixel determinism and fixed roots. |

Blender source axes are X east, Y north, Z up. Runtime ground axes are X east, Y south. Heading labels use runtime clockwise angles from east; the exporter negates that angle for the source Z rotation. This conversion keeps north up and east right. The source audit checks both axes instead of inferring them from the preview.

## Reproduce

Use Blender 4.5 with Cycles CPU and Python with Pillow. The verified portable executable on this machine is `.cache/tools/blender/blender.exe`; its official download URL and SHA256 are in the ignored `.cache/tools/blender-install.json`. GPU Eevee is unsupported on this machine; CPU rendering passed. No runtime dependency is installed in the game.

Run these PowerShell commands from the repository root. Replace the executable path if Blender is installed elsewhere.

```powershell
$blender = '.cache/tools/blender/blender.exe'
$topic = 'docs/vfx-skill/component-vfx'

# Author and save the editable scene, replacing the named source in place.
& $blender --background --factory-startup -noaudio --threads 4 --python "$topic/tools/build-vfx-scenes.py" -- --component charge-gather

# Render both configured cameras and all eight headings from the saved source.
& $blender --background --factory-startup -noaudio --threads 4 --python "$topic/tools/build-vfx-scenes.py" -- --component charge-gather --from-source --render

# Pack only after every camera/heading has all 24 frames.
python "$topic/tools/pack-vfx-atlases.py" --component charge-gather

# Check preserved source geometry and repeated decoded pixels at both cameras.
& $blender --background --factory-startup -noaudio --threads 4 --python "$topic/tools/verify-vfx-scene.py" -- --component charge-gather
```

`--preset arena` or `--preset raised` restricts rendering; `--direction east` and `--frame 10` support focused inspection. `--overwrite` replaces rendered frames when using `--from-source`. When geometry, material or camera configuration changes, render the affected named exports again before packing; do not reuse stale cells. No numbered source/atlas directories or Blender backup deliveries are used.

Each direction exports one 1536x1024 atlas containing 24 untrimmed 256x256 cells in a 6x4 grid. The same world root is projected into each camera's normalized anchor; frames are never independently cropped, shifted or resized. Timing metadata is presentation only. Decorative randomness has a fixed source seed and does not read game RNG.

## Review and evidence

Open the [animated gallery](../outputs/animated/index.html) through the dev server. It offers 33/45-degree cameras, all eight world headings, pause/frame controls and a root crosshair. Each component links its scene, contact sheet, `meta.json`, `qa.json` and `source-qa.json`.

The frame gate requires RGBA, transparent background, all 14 active frames visible per view, at least 12 pixels of alpha-content margin and at least ten distinct decoded animation frames. The source gate checks the source hash and geometry hash after camera changes, deterministic decoded pixels, north-up/east-right axes and the same root across headings. PNG metadata includes render time, so determinism compares decoded pixels rather than file headers.

Native DEV review uses the existing `CombatArenaScene`, catalog, body models and atlas renderer. At 1920x1080, open `/__showcase?sample=vfx-charge-gather#showcase-field`, replacing the sample suffix with any of the five component IDs. The sample selects a named review candidate; the default public recipes are preserved. The offline gallery is an atlas viewer, not another field renderer.

The shell injects a UI catalog adapter into the fixture. Authoring imports sit behind a DEV-only module boundary: a clean production build was checked by PNG SHA256 and contained none of the 80 review atlases. Keep eager authoring asset imports inside that boundary.

With the dev server running on `127.0.0.1:5173`, run `node docs/vfx-skill/component-vfx/tools/review-vfx-procedural.cjs`. It opens one 1920x1080 headless Edge tab at a time, freezes an active source frame, checks the selected native atlas and zero browser errors, and records [native-review.json](../outputs/animated/native-review.json). `PLAYWRIGHT_CHANNEL` can select another installed Chromium channel. Screenshots stay in ignored `.cache/vfx-3d/`.

## Open acceptance

`motion-trail` has an editable ribbon source and attachment metadata, but native deformation along sampled flight history remains open. `body-coating` has an animated surface source and an explicit current-actor-alpha attachment requirement; native silhouette masking remains open. Their source previews do not fulfill those attachment requirements. `heat-shimmer` still needs an authored vector pass and actual background deformation. The remaining 28 components are targets, not completed assets.

Visual judgment, timing feel, palette quality and runtime promotion remain human decisions. Mechanical QA does not grant art approval.
