# Deferred camera-agnostic 3D VFX specification

**Active owner direction, 2026-11-11:** continue the existing 2D raster component roster. Current deliverables are named transparent still PNG ingredients, local raw files, layer metadata and measured QA under [outputs/](outputs/README.md). Do not start further 3D sources, directional renders or animation-atlas production for this batch. The requirements below remain a deferred 3D proposal, not acceptance criteria for the current raster assets.

## Objective

Build a reusable, procedural VFX production system for a stylized 2.5D RPG, targeting the visual quality of Ragnarok-style mobile games and RimWorld magic mods.

## Camera Requirements

- Initial camera: Orthographic, 33° elevation from the ground plane.
- Support configurable camera elevation, azimuth, and orthographic scale.
- Never hardcode camera parameters into VFX geometry or animation logic.
- Allow alternative camera presets without rebuilding the source effect.
- Treat camera settings as rendering configurations rather than effect definitions.

## Directional Requirements

- Support 8 directions: N, NE, E, SE, S, SW, W, NW.
- Define directions in world space, independently of camera orientation.
- Rotate the effect around the world vertical axis.
- Preserve animation timing, spatial consistency, scale, and pivot alignment across directions.

## VFX Quality

- Target stylized MMORPG/mobile game effects, not cinematic realism.
- Prioritize readable silhouettes, appealing motion, layered visuals, and satisfying impacts.
- Use procedural meshes, animated materials, trails, particles, and carefully designed timing where appropriate.
- Avoid primitive-only effects, generic glowing spheres, flat circles, and single-line slashes.
- Do not introduce unnecessary geometry or detail purely for complexity.

## Pipeline Requirements

1. Create and retain editable 3D VFX source assets.
2. Separate effect logic, camera configuration, directional transforms, and export logic.
3. Render all 8 directions using the same animation timeline.
4. Support automatic re-rendering for new camera presets.
5. Export transparent sprite atlases and metadata containing pivots, frame timing, direction labels, and camera preset identifiers.
6. Generate preview contact sheets for visual review.
7. Preserve the original source assets when generating new variants.

## Acceptance Criteria

- Changing camera elevation from 33° to 45° must not require recreating the underlying effect.
- All 8 directions must remain visually consistent and aligned to the same world-space origin.
- Effects must remain readable at the intended gameplay resolution.
- No clipped particles, inconsistent frame bounds, or unintended pivot drift.
- Any camera-dependent visual issues must be reported and corrected without changing the underlying gameplay behavior.

## Architecture Principle

**Effects exist in 3D world space. Cameras are interchangeable views. Sprite atlases are generated outputs, not source assets.**

Favor a straightforward, maintainable implementation over complex frameworks or unnecessary abstractions.
