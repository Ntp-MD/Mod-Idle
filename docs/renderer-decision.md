# Renderer decision — sprites are production; Three.js is a source/candidate

The current production direction is the **32-view 2.5D sprite set** described in the combat plan.
Three.js WebGL2 remains a candidate for offline/source inspection and for a future cutover only;
it is not the runtime renderer. This record exists so a later 3D proposal has to clear the same
gate instead of silently replacing the sprite path.

## Candidates

| Candidate | Fit | Risk |
|---|---|---|
| Three.js WebGL2 | Skinned rigs and clips, socketed equipment, shadows, depth/occlusion, orthographic camera matching the existing affine projection. The DEV Quaternius layer already proves feet projection, clip sampling and context-loss handling. | Extra draw-call/material cost; a real GPU measurement is still missing. |
| PixiJS sprites | Strong for the current sheet art; light on hardware. | No 3D rig, sockets, depth or shadow path; a separate model pipeline would still be needed for P4. |

## Evidence

Fixture: `?sample=arpg-arena`, 1920 × 1080, Chrome (Playwright), the authored field population
(11 visible actors on the sample), warm run. Frame timing is the page's own `requestAnimationFrame`
interval over 2.5–3 s.

| Path | Average | p95 | Notes |
|---|---|---|---|
| Sprite field, Full, 11 visible actors | ~12.4 ms | ~35.4 ms | Headless Chrome; SwiftShader/software GL is not a hardware result. |
| Sprite field, Full, 4 visible actors after the 20 Hz raw-state refresh was removed | ~9.1 ms | ~11.7 ms | Same conditions; the arena is sampled on its own render clock. |
| Sprite field, Minimal | ~7.0–8.9 ms | ~11.8–17.6 ms | Cosmetic layers off, threat rings remain. |
| DEV Three.js source layer | ~15.7 ms | ~41.2 ms | Quaternius stand-ins; measured before the source assets were removed from the working tree. |

The headless browser reports a software raster path, so these numbers are a **regression and
correctness baseline**, not the P3 performance gate. The 60 FPS / p95 ≤ 16.7 ms target from the
plan is still unproven on a hardware GPU. The actor count changes the result by ~3×, so a gate
report must name its workload.

## Gate before cutover

1. Record machine, browser, power mode and workload (actor count, effect tier) with the result.
2. 48 actors, 1920 × 1080, hardware WebGL2: p95 frame time ≤ 16.7 ms and no resource growth after
   warm-up. 96/200 actors are diagnostics, not gameplay population requirements.
3. The same fixture must match the sprite path's visual timing and command acknowledgement.
4. WebGL context loss pauses the sim and leaves the HUD playable; the sprite fallback must be named
   and actually render.

If a hardware run fails the gate, the fallback is the existing sprite path, not a second
simulation. The candidate's selection is therefore reversible without touching `engine/` or the
combat runtime.
