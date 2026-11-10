# VFX component library: scope, rationale and agent handoff

Status: implementation in progress; 14 families, 29 registered source shapes and seven palette choices per shape (203 target combinations). See the [execution plan](../../plan/vfx-component-library.html).
All seven additional runtime masters are registered (90 skills / 248 versions). All 203/203 shape/palette pairs have accepted native captures. The dome fixture now freezes the displayed frame through the native timeline. Fixed the engine-agreement test import without changing assertions; it passes 15/15. Normalized the retained Void Ray base into the existing multi-atlas path and aligned contact art with Channel; its recipe passed all five camera elevations and three zooms. Latest check: 0 errors / 0 warnings; ray/registry/placement focused specs: 34/34. Final full suite: 265 files passed / three known baseline files failed, 2613 tests passed / two baseline tests failed. Native matrix checkpoint: 21/165 camera records. Execution stopped at p7-field-contact: Meteor v4 impact-burst permits only Impact while its producer uses Field. Field phase auditing and remaining camera/recipe acceptance stay open. All 95 default pointers are unchanged; human visual approval remains open.
Scope baseline: 2026-11-09.

Additional source generation, 2026-11-10: all seven requested shapes are saved with native originals, padded masters, exact prompts and measured QA in [library-v3](outputs/library-v3/README.md). Source generation, runtime packaging and all 49 added palette combinations are verified; remaining composed-recipe and camera checks are tracked under p7.

This is the design brief and scope reference. The user has authorized implementation after documentation; the linked execution plan tracks actual completion. Read [AGENTS.md](../../../AGENTS.md) before making repository changes.

## User-approved extension ? 2026-11-10

The original 14-family / 98-option baseline below is retained. The user additionally approved
`crack-strip`, `stone-spike`, `wave-crest`, `arrow-core`, `orb-core`, `rock-core`,
`forked-bolt` and `ground-spiral`, plus reusable placement recipes. These are eight
shape subtypes in the existing families, not eight new gameplay elements.
Every subtype must support fire, cold, lightning, earth, poison, chaos and physical.
The expanded target is 22 source shapes x 7 palettes = 154 verified options.
A top-level `variants` inventory retains the original `families[*].master` references.
All new art and recipes remain non-default until human visual approval.

## Locked scope

**14 component families * 7 element palettes = 98 required family-palette variants.**

- Every family must have all seven palettes, including combinations that no current skill uses.
- Support effects use the same seven palettes. The scope has no eighth support palette.
- A master is one of its family's seven variants: 14 masters + 84 remaining color variants = 98, not 112.
- Count selectable, verified visual variants. The count is independent of PNG packaging, frame count and revision count.
- Start with one approved canonical shape per family. Additional silhouettes or material remodelling are separate scope additions; do not silently multiply the inventory.
- Palette choice is a visual choice. It must never change a skill's gameplay element, damage, status or hit area.

## What we are building and why

Build reusable visual ingredients and assemble them through metadata into one skill effect. A Firestorm can combine a ground surface, an upright vortex and small embers; a Fireball can combine a projectile, a trail and a contact burst.

The intended result is a library that agents can reuse without generating a complete skill sheet from scratch each time. The components share registration rules, while each skill can retain its own composition and visual identity.

This addresses three recurring problems:

1. A PNG's overall visible bounds do not necessarily describe the center or radius of its ground base. Flames and smoke can move the apparent center.
2. A single image containing both a ground plane and an upright effect cannot independently follow ground foreshortening and preserve upright proportions as the camera changes.
3. Regenerating entire effects for every color or minor composition change can alter framing, anchors and animation continuity.

Keep the authoring components separate and compose them at runtime. A texture atlas is image storage; metadata describes assembly. Packing separate components into one PNG can retain this separation. Flattening the components into one finished image per frame loses it.

The approach is established in other engines: [Niagara systems](https://dev.epicgames.com/documentation/en-us/unreal-engine/overview-of-niagara-effects-for-unreal-engine) combine multiple emitters and modules into an effect. This project needs a small data-driven version built on its existing renderer, not a replacement particle engine.

## Component inventory

Each row below requires the complete seven-palette set. The examples describe reuse, not seven different material geometries.

| No. | Family ID | Purpose | Placement and size authority |
| --- | --- | --- | --- |
| 1 | `ground-fill` | A filled surface for the skill footprint: the coin face beneath fire, frost, poison or energy. | Ground; footprint |
| 2 | `ground-edge` | A textured perimeter, expanding ripple or pulse for novas, shockwaves and auras. | Ground; footprint |
| 3 | `ground-residue` | Scorches, cracks, frost or puddles left during the visual exit. | Ground; footprint |
| 4 | `projectile-core` | One directional projectile body, reusable for straight and arcing deliveries. | Billboard; body or authored size |
| 5 | `ribbon-beam` | A trail, continuous beam or chain connection drawn along the committed path. | Projected path; authored thickness |
| 6 | `slash-sweep` | An arc stroke for slashes, cleaves and rotating attacks. | Billboard or path; aim-oriented |
| 7 | `impact-burst` | A localized contact burst, explosion or shattering impact. | Billboard; contact anchor |
| 8 | `column-eruption` | An upright column, strike or eruption rooted at the contact point. | Billboard; ground root |
| 9 | `vortex` | An upright rotating funnel or spiral, separate from its ground base. | Billboard; ground root |
| 10 | `cloud-mist` | A soft cloud, fog or dust volume distributed over an area. | Billboards; area distribution |
| 11 | `mote` | A small spark, ember, flake or healing light used in repeated patterns. | Billboard; sampled position |
| 12 | `fragment-debris` | A small shard or fragment thrown out of an impact. | Billboard; sampled position |
| 13 | `ward-shell` | A protective shell or veil that follows an actor. | Billboard; actor/body |
| 14 | `mark-sigil` | A curse mark, rune or status symbol attached to an actor or planted on the ground. | Explicit actor or ground binding |

Footprint masks, perimeter geometry, paths and instance positions should use the game's existing geometry helpers. Generate painted textures and characteristic effect shapes; do not ask an image model to calculate gameplay metres or hit boundaries.

## Palette variants

The palette identities are fixed by scope. Exact swatches and highlight handling are part of master visual review, not approved RGB values in this brief.

| Palette ID | Color-production intent |
| --- | --- |
| `fire` | Fire palette; keep highlights readable. |
| `cold` | Cold palette; this color variant retains the master's geometry. |
| `lightning` | Lightning palette; this color variant retains the master's geometry. |
| `earth` | Earth palette; this color variant retains the master's geometry. |
| `poison` | Poison palette; this color variant retains the master's geometry. |
| `chaos` | Chaos palette; this color variant retains the master's geometry. |
| `physical` | Physical/neutral palette, also available to support recipes. |

A blue flame remains the same flame shape. Turning it into an ice crystal is a different geometry/material task. Do not require a new material treatment for every color variant.

Color-only variants retain the master's canvas, frame rectangles, alpha silhouette, padding, anchors, content bounds, phase ranges and frame timing. Do not re-center or re-scale each color independently. Preserve highlight structure instead of replacing the whole image with a flat tint.

Use the available image-generation/editing workflow under its tool and skill rules. If a color edit changes geometry or registration, do not count it as a completed color-only variant. Inspect and resolve the production method before accepting the batch. No generation cost or throughput has been measured for this scope.

## Registration and camera contract

Use the shared [camera and authoring notes](../shared/angle-authoring.md) with this contract.

- A skill's committed world footprint owns its center, shape, radius, direction and contact points.
- All parts of one effect bind to the same cast/payload or actor event. Do not compare different casts that happen to use the same skill ID.
- Ground artwork is authored unprojected and receives the shared camera projection once.
- A circular ground fill is a centered coin face. Its measured painted base defines coverage; transparent padding does not.
- Use a visible guide/reference for the ground disk when authoring. At peak strength, paint the agreed interior surface across that disk. Opening and exit phases may be smaller, but the root stays fixed.
- Ground components are clipped to their actual footprint when clipping is required. Do not clip upright flames to a ground disk.
- Billboard roots are projected from world positions; their painted axes use uniform world zoom. Camera elevation must not add a squash or require per-camera asset metadata.
- A ground root is the center of the component's base on the floor, not the bottommost pixel or the center of all smoke and sparks. Store that authored point once.
- Components that follow actors use the shared body model and socket/impact data. They must not inherit a large AoE's full diameter merely because they share its cast.
- Use measured static asset metadata. Do not continually rewrite anchors or content bounds to compensate for camera changes.

The current default camera is 33 degrees above the horizontal plane. Future verification must cover 30, 33, 45, 60 and 90 degrees through the same camera/frame path. This scope does not add a camera-control UI.

The showcase's optional 1-3 m preview rings are centered on the player. They are rulers, not the authoritative target-origin footprint. Validate a component against the actual footprint of its matching cast.

The coin is a ground-coverage reference. A full-coverage material can occupy a square source and receive its circle, line or cone outline from the runtime mask. Use the committed boundary helpers for those masks; do not stretch a painted circular base and assume that it now fills a different shape.

## Composition behavior

Reuse the existing action phases and delivery information for straight flight, arcs, sweeps, chains, repeated contacts, rain, orbiting effects, sustained fields, channels and actor-following overlays. A behavior places or repeats ingredients; it is not a separate full-skill image.

Gameplay owns hit count, hit timing, duration, targets and statuses. Visual repetition must consume the committed actions/payloads, not create hits or duplicate combat formulas. Decorative random sampling must not consume or reorder gameplay RNG.

Extend the existing metadata and `additionalLayers` path only as actual recipes require. The assembly contract needs:

- A stable layer identity separate from a texture URL.
- A component/palette/revision reference and its registered frame data.
- Explicit ground or billboard placement, a semantic root binding, and a size authority such as footprint, body or authored world size.
- Phase selection and only the timing offsets, loop and exit controls required by the pilot recipes.
- Layer order, scale and opacity. Reuse existing fields where they already have the required meaning.

These are required capabilities, not a second JSON schema that is already loadable. Do not introduce a general scripting language, free-form node graph or speculative controls.

## Repository baseline and gaps

Inspected source baseline: 90 non-retired player skills (53 attack, 10 buff, 6 curse, 3 heal, 18 aura) and 49 non-retired mob skills (37 strike, 12 aura). Recount [player data](../../../tools/data/skills.json) and [mob data](../../../tools/data/mob-skills.json) if those inputs change.

| Area | Confirmed current behavior | Work the component library still needs |
| --- | --- | --- |
| Camera and raster placement | [arena-skill-art.ts](../../../game/src/ui/combat/arena-skill-art.ts) has `billboardMatrixForFrame` and `groundDecalMatrixForFrame`. | Keep both paths; verify registration at multiple camera angles. |
| Shared frame | [arena-view-frame.ts](../../../game/src/presentation/arena-view-frame.ts) owns forward and inverse transforms. | All component placement and input must use the same current frame. |
| Metadata | [catalog.ts](../../../game/src/ui/fx/catalog.ts) has `VfxLayer`, `VfxAimMeta`, anchors, scale, opacity and frame phases. | Make layer binding and size authority explicit where automatic skill-level inference is insufficient. |
| Multiple layers | [SkillGeometryLayer.svelte](../../../game/src/ui/combat/SkillGeometryLayer.svelte) draws multiple atlases; [mix-blizzard.mjs](../../../tools/mix-blizzard.mjs) already assembles two sources. | Keep one renderer and one cast timeline. |
| Layer identity | The atlas loop is keyed by `atlas.src`. | Repeated components and packed textures need identities that remain unique when URLs match. |
| Multiple ground layers | [skill-vfx-pool.ts](../../../tools/skill-vfx-pool.ts) validates the main ground atlas but rejects additional ground atlases. | Apply the same projection/grid/content validation to every ground layer. |
| Ground shapes | `groundDecalMatrixForFrame` takes a radius; the ground-atlas branch currently passes `mark.area.radiusM`. | Generalize ground placement/masking for committed lines and cones using existing boundary helpers, without inventing replacement radii. |
| Still components | `artOf` currently selects animated layers with `frame.count > 1`. | Support valid single-frame ingredients alongside animated ingredients. |
| Size authority | `artSizePolicyFor` derives policy from the mark's shape and delivery. | Allow a body-sized child overlay to coexist with a footprint-sized ground base without per-skill branches. |
| Scene order | The existing skill-art container is an overlay at `z-index: 1100`. | Ground fills must appear below actors; upright components use the appropriate effect layer. List order alone cannot put ground below actors. |
| Existing diagnostics | [skill-art-projection.test.ts](../../../game/tests/ui/skill-art-projection.test.ts) checks billboard and ground transforms. | Add actual component, registration and coverage checks; existing helper tests alone do not prove full multi-angle integration. |

Do not describe these gaps as already implemented.

## Asset ownership and versioning

All published runtime skill VFX must follow the existing home: `game/public/fx/skill-pool/<type-or-attack-element>/<skill-slug>/vN/`. The generator rejects sibling VFX homes and unsupported pool groups.

Keep reusable component references in an authoring inventory that records family, palette, revision, asset location and QA state. Canonical source assets can be owned by an existing representative skill's new version; record that ownership instead of inventing synthetic live skill IDs or a new public asset root.

Publish each assembled skill version with the component files it needs in its own version directory, following the copy-and-compose precedent in `mix-blizzard.mjs`. Runtime recipes must not depend on an older skill version that may later be removed. Source assets still referenced by the authoring inventory need separate reference-aware retention.

Family, palette and revision are separate concepts. A new color does not become a new gameplay element or an unrelated numeric art revision. Use lowercase-hyphen filenames, create new versions for new work, and preserve existing versions until replacement and reference checks pass.

## Production method

1. Define one canonical shape and a visual reference for each family. Keep the technical registration contract fixed while choosing art direction per family; do not restore a universal generation prompt.
2. Produce a master in one of the seven palettes. Validate canvas/grid, transparency, root, painted bounds and phase continuity before deriving colors. [Cinder Nova V1](../../../game/public/fx/skill-pool/attack-fire/attack-cinder-nova/v1/atlas.png) is a quality reference for readable silhouettes and highlights, not a camera or framing template for every family.
3. Produce the other six palettes from that registered master. Keep the shape and animation geometry unchanged. Every family receives all seven palettes, regardless of current usage.
4. Build contact sheets and an inventory covering exactly 98 family-palette entries. Each completed entry must resolve to real renderable output, not merely a palette label.
5. Compose pilot skills through metadata, beginning with Firestorm's ground fill/vortex and Fireball's projectile/trail/contact. Use the same production scene and geometry as the game.
6. Verify technical behavior and review the pilot visuals. Map the 90 player skills and 49 mob skills to ingredients/behaviors, noting real gaps instead of claiming that 98 color variants provide finished unique art for every skill.
7. Expand adoption with per-skill compositions and visual decisions. Consider packing textures only after measuring a benefit; preserve independent layer metadata and projection modes.

No fixed frame count or grid is imposed on all 14 families. Within a family, all seven palettes share the registered layout and timing. A static ingredient can have one frame.

## Representative recipes

These twelve recipes exercise the library before a full roster conversion. They are proposed verification cases, not completed assets.

| Skill ID | Ingredients | What it proves |
| --- | --- | --- |
| `attack.firestorm` | Ground fill + vortex + motes | Ground coverage and upright art share one root. |
| `attack.fireball` | Projectile core + trail + impact burst | Release, travel and actual contact stay synchronized. |
| `attack.cinder_nova` | Ground fill + edge pulse + motes + residue | Caster-origin area and peak coverage. |
| `attack.blizzard` | Cloud/mist + falling fragments + ground pulses | Field duration, rain and independent layers. |
| `attack.cleave` | Slash/sweep + footprint edge + impact | Cone direction and geometry. |
| `attack.fissure` | Ground surface + eruptions + debris | Line length and width come from the committed area. |
| `attack.chain_lightning` | Ribbon/beam + contact bursts | Actual hop endpoints and timing. |
| `attack.void_ray` | Ribbon/beam + contact effect | Channel start, continuation and end. |
| `heal.heal` | Motes + pulse | Actor attachment and healing cue. |
| `buff.flame_guard` | Ward/shell + motes | Body sizing and protective overlay. |
| `curse.jinx` | Mark/sigil + optional mist | Correct target attachment. |
| `aura.grace` | Ground edge + actor effect | Follow, enable and disable behavior. |

## Acceptance and verification

- Inventory: exactly 14 family IDs, exactly seven palette IDs and all 98 combinations are present; support components are included in that matrix.
- Color variants: registered geometry, alpha silhouette, frame layout, anchors and timing match their master; palette output is visually distinct and highlights remain readable.
- Alignment: at 1920 x 1080, the registered ground center and matching cast center agree within 1 CSS pixel. Check the painted base/reference, not only a metadata point transformed onto itself.
- Coverage: at peak strength, the painted/clipped base matches the actual committed footprint within 2 CSS pixels at the boundary. Check circles, lines and cones where applicable.
- Camera and zoom: cover elevations 30, 33, 45, 60 and 90 degrees and world scales 0.5, 1 and 2. Ground follows the projected footprint; billboard camera axes remain uniformly scaled.
- Timing and ownership: cover interrupted casts, repeated contacts, moving actors, channel end and aura off. Presentation never schedules damage or changes gameplay RNG.
- Composition: test two layers sharing a texture, multiple ground layers, single-frame art, independent animation timing, and a missing/failed component. Preserve the existing fallback behavior.
- Scene order: the filled ground does not cover actors; upright effects keep the intended reading order.
- Performance: compare representative compositions at the same viewport and encounter. Record loading, active image/layer counts and visible regressions before making packing decisions; no performance budget or cost saving is claimed by this brief.

Read [known failures](../../reference/known-failures.md) before judging any red gate. Follow the verification and execution rules in AGENTS.md. Reuse unchanged evidence and keep gate logs in ignored local cache directories.

Relevant existing commands:

```powershell
node --experimental-strip-types tools/skill-vfx-pool.ts --skill=attack.firestorm
npm run check
npm --prefix game run test -- tests/ui/skill-art-projection.test.ts tests/ui/skill-geometry-frame.test.ts tests/ui/vfx-aim.test.ts tests/ui/meteor-rain.test.ts tests/ui/vfx-catalog.test.ts tests/ui/blizzard-composition.test.ts
node game/node_modules/@playwright/test/cli.js test --config=game/playwright.config.ts --project=hmr arena-scale.spec.ts dynamic-relative.spec.ts
```

Implementation plans use `test:fast` plus focused specs during work and run the full suite once at closeout, under AGENTS.md. Do not rerun or repair documented baseline failures merely to make a report green.

## Manual sign-off

Human visual review is still required for the 14 master shapes, palette swatches, color/highlight quality, ground-fill appearance and the twelve pilot compositions. These reviews have not happened for this library. Automated geometry checks do not approve art quality.

## Scope boundaries and handoff

The deliverable is the component library, its 98 variants, reusable assembly metadata and verified representative recipes. Replacing all 139 current skill visuals in the first production batch is not implied by the inventory target.

This scope does not change combat balance, hit geometry, statuses, saves or autosave. It does not add a VFX node editor, a second arena renderer, a new engine dependency, a camera-control UI, a new gameplay element or an eighth palette.

A future implementing agent should first read this brief, AGENTS.md, the linked renderer/generator files, the existing Blizzard composition and known failures. Re-check current files and concurrent edits. Resolve concrete art questions with the user while reusing answers already given.

Report implemented capabilities, produced inventory entries, exact verification results, deviations and remaining human review separately. Do not mark planned assets or capabilities complete because they appear in this document.
