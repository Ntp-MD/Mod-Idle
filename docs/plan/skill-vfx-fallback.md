# Skill VFX Fallback Implementation Plan

Status: locked implementation specification; runtime work has not started. Start at VFX-0 when implementation is ordered. This plan creates no images and changes no combat data.

Goal: every existing skill remains readable without a skin, while loading, and after an image failure. Base VFX and skins describe the same committed geometry, payloads and simulation clock. The implementation choices below are fixed; do not introduce another renderer, asset service, timing model or gameplay fallback.

Follow [AGENTS.md](../../AGENTS.md). Work in the current directory/branch, preserve concurrent edits, and commit/push only when requested. This work is independent of the remaining map-trailer task in [README.md](README.md); it does not require a progressed save or authorize restarting map/mob migrations.

## 1 Decisions and scope

| Topic | Fixed decision |
|---|---|
| No skin | Draw complete procedural Base VFX using the existing SVG effects stage. Do not substitute another skill's skin. |
| Selection order | Ready selected version → ready promoted default → Base. Load the selected/default candidates together; never scan/download every version. |
| Loading | Base is visible immediately. Readiness may change presentation at the current playhead, never restart a cast, animation phase or resource transaction. |
| Broken image | Reject that entire skin bundle and resolve the same fallback order. No partially loaded bundle or concurrent full Base/skin impact. |
| Geometry | Simulation action/area/flight/payload receipts remain the authority; appearance does not supply hitboxes, targets or range. |
| Forms | Reuse existing forms and derive a safe default from canonical skill metadata when no DESIGN override exists. |
| Coverage | Player attacks/curses/heals/buffs/active auras and existing mob cast marks. Passive rows with no action/activation produce no invented effect. |
| Art | Reuse current files/metadata. No generation, new art approval, atlas renaming or changes to pool.generated.ts. |
| Controls | Add Base VFX to the existing showcase version selector. Normal gameplay stays automatic; add no player settings panel or save field. |
| Errors | Asset failure is a presentation state; the game and simulation continue. No blocking dialog or repeated per-frame retry. |
| Performance | Reuse shared geometry/cache and browser URLs. Numeric frame/load values are watches; asset request/lifecycle correctness is mandatory. |

All durations, geometry and damage facts stay in their existing engine/sim owners. Presentation particle budgets stay in arena-skill-vfx.ts. Shared colours remain in engine element colours and [variables.css](../../game/src/styles/variables.css); do not copy palettes into a new file.

## 2 Verified starting points

- [SkillGeometryLayer.svelte](../../game/src/ui/combat/SkillGeometryLayer.svelte) draws committed marks plus an independent aim mark. Its current `!art?.atlas` branch selects procedural effects by metadata existence rather than successful image loading.
- [ArenaSkillVfxStage.svelte](../../game/src/ui/combat/ArenaSkillVfxStage.svelte) already draws gathering, travel, impacts and sustained effects from [arena-skill-vfx.ts](../../game/src/ui/combat/arena-skill-vfx.ts). Its current spec resolver excludes support and mob rows.
- [catalog.ts](../../game/src/ui/fx/catalog.ts) owns registered versions, the selected-version storage and promoted defaults. It validates neither network readiness nor image decode success.
- [AtlasFrame.svelte](../../game/src/ui/fx/AtlasFrame.svelte) is the shared SVG atlas image reader; it currently sends no image-failure signal upstream. Its only component consumer is [SkillAtlas.svelte](../../game/src/ui/combat/SkillAtlas.svelte).
- [skill-geometry.ts](../../game/src/ui/combat/skill-geometry.ts) produces geometry and payload views. Payload-art expansion is currently selected only when an atlas exists; Base must use the same payload facts.
- [skill-support-geometry.ts](../../game/src/ui/combat/skill-support-geometry.ts) currently requires an atlas before emitting standalone heal/upkeep marks. [skill-aura-geometry.ts](../../game/src/ui/combat/skill-aura-geometry.ts) already reads actual active/owned aura state.
- App's current `chooseArenaVersion()` calls `replayArena()`. Remove that replay from appearance changes; the separate explicit Replay button retains its behavior.
- Existing AoE regressions protect the windup-locked ground point, a dead/departed original target, manual ground with no body, and simultaneous aim/committed circles. Preserve them.

## 3 What the player sees

### 3.1 Mandatory information by phase

| Phase | Base appearance | Skin-independent information |
|---|---|---|
| Aim | Thin actual footprint and cast-range guide; invalid aim is dashed using current invalid styling | Aim can move; it never replaces an already committed cast |
| Windup | Actual footprint with the existing progress edge/fill; restrained gathering particles | Ground center is locked; no target-following repaint |
| Travel | Small element-coloured projectile or falling piece along the actual delivery path, with a short trail | Target/contact/pursuit changes come only from flight/payload data |
| Impact | Short contact flash/sweep plus small fragments at the resolved contact or ground landing | No damage number, hit count or repeat impact is invented by the renderer |
| Field | Thin actual boundary, low-opacity fill and bounded ambient particles inside it | Exists only for the real field window, not for an arbitrary atlas loop |
| Channel | Existing beam/arc/ring sampled from the current channel and caster position | Ends on real interruption; mobile channels alone follow their caster |
| Support | A short body pulse on the actual recipient; an active aura uses a steady halo | No ground damage radius is invented for a body-only support effect |

Keep the current skill-name/phase/timer labels and incoming/invalid styling. Show diagnostic crosshairs, dimensions and payload debug lines only in Aim/Inspect; essential footprints remain available without Inspect. Do not use missing-image boxes or a different skill's icon as VFX. SVG remains scene/effect geometry under AGENTS.md, not a standalone icon system.

### 3.2 Exact form and motif rules

The canonical action kind wins before visual DESIGN overrides. Keep DESIGN's existing decorative heights/counts where compatible; never let it change the committed area or turn a field into a body-targeted strike.

| Source | Base form/motif |
|---|---|
| Projectile / ordinary ranged | Existing bolt silhouette and travel core/trail; position is sampled from its own payload/flight |
| Meteor field | Existing field footprint; glowing rock fragments descend from above inside the committed area, never from the caster's hand |
| Blizzard field | Existing field footprint; sparse descending cold motes |
| Thunder field | Existing field footprint; thin vertical sparks inside it, no whole-screen flashes |
| Sand field | Existing field footprint; low drifting dust inside it |
| Ground burst / nova / sigil | Short landing/expansion sampled from its actual phase and footprint |
| Line / cone / cleave | Existing directional footprint plus a restrained wave/sweep along its real axis |
| Chain | One bridge per actual hop path; no nearest-neighbor search in the renderer |
| Volley / split / targeted burst | One effect per real payload and its own source/destination/contact; no fabricated extra arrows |
| Ray / whirlwind | Existing channel beam or caster arc; no loop after cancellation or end |
| Heal | Body pulse using `--good-lit` when it has no authored Element |
| Buff activation | Small ward pulse using `--es-lit` when it has no authored Element |
| Curse | Small target-body pulse using its Element or `--curse`; do not draw an invented active aura |
| Active aura | One steady Base halo per actor for any unskinned active auras; representative is the lowest skill ID in stable order |

Use mark.colour for authored Elements and the existing hitColour/physical fallback. The support token exceptions above are appearance only. Incoming effects retain the existing incoming/dashed distinction; do not rely on colour alone.

Add `cue: 'attack' | 'heal' | 'ward' | 'curse' | 'aura'` to SkillVfxSpec. Keep the existing SkillVfxForm vocabulary. Add `fieldStyle?: 'meteor' | 'snow' | 'lightning' | 'sand'` for the four real field kinds. Their maximum simultaneous Base ambient bodies are respectively 4, 8, 4 and 8; these are visual budgets, not hit counts or spawn rates. Keep other attack budgets in the current FAMILY/DESIGN tables. Support cues use zero debris/trails/gather, with 6 activation motes for heal, 4 for ward/curse and 0 for steady aura.

Extend `activeSkillVfx(id, incoming = false)` in its existing module. Incoming marks resolve mobSkillById first; player marks resolve sm.byId. Retired/unknown/passive rows return null without crashing; a valid new skill without DESIGN receives the metadata-derived default. `activeSkillVfxIds()` covers the supported live player types; DESIGN keys must be a valid subset, not a requirement to author a duplicate row for every future skill.

### 3.3 Motion and phase sampling

Travel, pulse progress, fades, orbit and falling offsets use mark.progress/phaseElapsedSec and the existing projection helpers. Seed decorative placement from the stable mark/action/payload key; never use simulation RNG, Date.now or an independent damage timer. Do not restart CSS motion when Base mounts after an image failure: sample motion in code, or use a paused animation with negative delay from the same phase age. The result at one playhead must be stable after pause, seek and skin failure.

Forward the existing reducedMotion value from CombatArenaScene, which already includes reduced quality. In reduced motion: remove gathering/trails/spin/drifting debris; retain current projectile position, one short fading contact cue, static field fill/boundary and steady aura halo. No extra quality option, screen shake or strobe is added.

## 4 Ownership and exact file scope

| Owner | Change |
|---|---|
| ui/fx/catalog.ts | Candidate order, metadata validation, bundle URI collection, reactive selected version; retain the storage key/schema |
| **NEW ui/fx/vfx-assets.svelte.ts** | Shared browser image readiness, one preload/decode per URI and failure notification |
| ui/fx/AtlasFrame.svelte | Report SVG image error to that owner; do not resolve versions or command gameplay |
| ui/combat/arena-skill-art.ts | Pure ready-art resolution and stable metadata-only presentation envelope |
| ui/combat/skill-geometry.ts | Typed mark provenance and one payload view used by both Base and skins |
| ui/combat/skill-support-geometry.ts / skill-aura-geometry.ts | Asset-independent support/aura producers and deduplication semantics |
| ui/combat/arena-skill-vfx.ts / ArenaSkillVfxStage.svelte | Base forms/cues and timeline-driven procedural drawing |
| ui/combat/SkillGeometryLayer.svelte / SkillAtlas.svelte | Separate essential geometry from one chosen effect renderer |
| ui/combat/CombatArenaScene.svelte / App.svelte | Forward automatic/Base mode; showcase selector changes presentation without replay |
| Tests / playwright.config.ts | Existing suites plus the two new suites listed in section 9 |

All production paths in this table are under `game/src/`. Add only one production file. Reuse SvelteMap from the installed `svelte/reactivity`; do not add an asset library, DOM emulator, canvas/WebGL engine or a generic event bus.

## 5 Skin candidates and readiness

### 5.1 Catalog contract

Add these metadata exports to catalog.ts:

```ts
export interface VfxArtCandidate {
  versionId: string;
  art: SkillArt;
  sources: readonly string[];
}
export declare function vfxArtCandidates(skillId: string): readonly VfxArtCandidate[];
```

The function is pure metadata: selected renderable version first, then the promoted default (`default === true`). When no promoted default exists, use versions[0] as the default, retaining catalog order. Deduplicate by version ID. Exclude arena:false and invalid metadata. Do not scan other versions as a third fallback. Missing/invalid selection goes directly to the default, then Base.

Each candidate's required source set is the deduplicated union of its declared atlas/atlases/decal/burst URLs. Every declared layer is required for this bundle. Empty URLs, non-finite/non-positive grid sizes/FPS, invalid frame ranges or source rectangles outside declared texture bounds make the candidate invalid before loading. Keep that validation in this catalog owner and reuse the existing artOf conversion; do not duplicate version interpretation in Svelte components.

Use SvelteMap for the selected-version map so a paused renderer observes preference changes. Persist Object.fromEntries of that map through the current localStorage key/shape, with the current private-mode/error fallback. This changes no GameState/save version. Invalid version IDs remain refused by setActiveVfxVersion.

### 5.2 Shared readiness API

```ts
export type VfxAssetStatus = 'idle' | 'loading' | 'ready' | 'failed';
export declare function getVfxAssetStatus(src: string): VfxAssetStatus;
export declare function getVfxAssetSize(src: string): Readonly<{ width: number; height: number }> | null;
export declare function ensureVfxAssets(sources: readonly string[]): void;
export declare function reportVfxAssetFailure(src: string): void;
```

Implement in vfx-assets.svelte.ts with one SvelteMap keyed by the catalog's exact source URI. Unknown URI reads idle without creating work. All updates replace the map entry so ready/failed transitions invalidate paused consumers. No Image/window/document access at import time; SSR reads remain idle and ensure performs no browser work there.

State transitions are fixed:

| State/event | Next state/action |
|---|---|
| idle + ensure in browser | loading; create one Image and assign src once |
| loading + onload + successful decode + nonzero natural dimensions | ready |
| loading + error, decode rejection, zero dimensions or constructor failure | failed |
| loading for 10,000 ms | failed; technical asset timeout, not simulation time |
| ready + an actual SVG image error | failed |
| ensure on loading/ready/failed | no new request |
| late completion after failure/timeout | ignored; failed is terminal for this URI in this document |

Use Image.decode when available; onload plus positive natural dimensions is the fallback when decode is absent. Detach listeners and clear the timeout when settled. Retain status/error category and ready image dimensions as primitives, not a decoded bitmap, canvas, base64 copy or a growing list of image elements. getVfxAssetSize returns null outside ready. Do not issue fetch probes as well as Image loads.

Before choosing a ready candidate, validate its grid/source rectangles against those actual texture dimensions, including any declared textureWidth/textureHeight. A decoded image with incompatible version metadata rejects that candidate without marking the shared URI failed: another version may validly use a different region of the same image. No required sources means an invalid candidate, not vacuous readiness. Use error categories network/decode/empty/timeout/display internally; they do not add a gameplay notification flow.

All renderers share the same URI status. A failed URI stays failed until a page reload; a different version URI is a different entry. Emit no blocking UI or repeated error toast. A component unmount stops its reactive consumer; an already shared preload can finish for other consumers. Stale completion may update the shared status but must never patch a destroyed component or start a new frame loop.

### 5.3 Pure presentation resolution

Add in arena-skill-art.ts:

```ts
export type SkillVfxMode = 'auto' | 'base';
export type VfxPresentation =
  | { kind: 'base'; reason: 'forced' | 'unavailable' | 'loading' | 'failed' }
  | { kind: 'skin'; versionId: string; art: SkillArt };
export declare function resolveVfxPresentation(skillId: string, mode: SkillVfxMode): VfxPresentation;
```

Base mode returns forced and requests no images. Automatic mode picks the first candidate whose **entire** source set is ready; a pending preferred candidate does not hide a ready default. If neither is ready, return loading when any candidate is idle/loading, failed when candidates have settled with failures, otherwise unavailable. Invalid/no candidate is unavailable. The resolver reads state and never starts I/O.

SkillGeometryLayer's effect derives URIs only for currently represented skills and the selected/default candidates, then calls ensure inside untrack. Do not preload the whole roster. Reactive presentation reads happen in derived values; no readiness writes or requests occur in derived/frame geometry helpers.

Keep `activeVfxArt` metadata-only. Change `skillArtFor(skillId, mode = 'auto')` to return only the ready resolver's skin art, or undefined for Base. Migrate metadata/lifetime producers off skillArtFor so a network event cannot create or remove their simulation facts. All callers are enumerated in VFX-0 before editing.

Report `<image>` errors from every AtlasFrame, still decal and burst through reportVfxAssetFailure. All four SkillAtlas branches (ground, rain/drop/shard and ordinary stamp) use the same handler through AtlasFrame. Repeated shard errors settle one URI once.

## 6 Shared geometry, windows and layer composition

Add these fields to SkillGeometry in its current owner:

```ts
sourceKind: 'cast' | 'aim' | 'aura' | 'support';
actorId: string;
actionId?: number;
eventId?: number;
payloadIndex?: number;
```

Producers set them explicitly: action marks bind actor/action IDs, aim uses player/aim, aura uses player/aura, support binds its existing FxEvent ID. Never infer this identity by parsing the label, CSS class or key. Keep current stable render keys and add no simulation identifiers or persisted fields.

Use two derived collections in SkillGeometryLayer:

1. **Gameplay marks:** committed action footprints plus independent aim and real aura/support marks. Draw each action footprint once, not once per projectile.
2. **Effect marks:** expand actual payload views before any skin test; append aura/support cues. Resolve one Base-or-skin presentation per effect mark. Rename skillPayloadArtGeometry to `skillPayloadGeometry`, update its callers/tests and remove the old export after migration.

In the effect layer render exactly one complete bundle or ArenaSkillVfxStage. Do not leave a full procedural impact beneath a skin. The existing essential geometry/labels remain independent of that choice. Give procedural effect groups their existing element colour and pointer-events:none when moving them to this layer.

Preserve `arenaPresentationArea`, actual homing-flight sampling, per-payload contact/interception/fizzle and the frozen ground snapshot. The renderer does not reacquire targets, choose chain hops, schedule pulses or move a planted field. Body marks use the existing release socket/body impact placement; all ground geometry uses the current arena projection once.

### 6.1 Stable presentation envelope

Add metadata-only `vfxPresentationTailSec(skillId)` in arena-skill-art.ts. Its value is the maximum of a 0.6-second Base contact tail and atlasImpactDuration across **all structurally valid registered versions/layers** for that skill. It reads neither active selection, mode, readiness nor decoded dimensions. Cache by catalog skill entry, not by playhead. Post-decode candidate rejection does not change this envelope. Do not add an asset-driven simulation duration.

Pass this same stable envelope to gameplay-mark and payload-view helpers in every mode. Preserve existing canonical cancellation/field/channel/duration guards, which always win over the envelope. An asset loading, failing or changing selection must not extend a field, reopen an expired mark, change phase or create an impact receipt. Atlas opacity/frame sampling is additionally clipped to that existing mark's remaining window.

Real field/channel guards read the normalized action's active window and actual release/cancellation receipts, never skin rainDurationSec. A generic dot_sec on a one-shot does not authorize a sustained field loop; keep its existing status feedback separate from active ground-area presentation. Add that distinction to geometry/spec tests rather than changing combat rules.

Support-event marks use their original event timestamp and the same metadata-only envelope, even when no atlas exists. Remove their current `if (!atlas)` gate. Keep current normal-cast/event deduplication using action/event identity so a heal is not flashed twice. Late heal ticks with distinct FxEvent IDs remain distinct cues. Aura marks come only from active owned aura state and a living actor; stop immediately on off/push/ownership loss. Aggregate only unskinned aura halos per actor as specified in section 3.2; keep each real aura's skin and skill-bar information intact. The halo group key is `base-aura:<actorId>` and is omitted when no eligible Base aura remains.

Both Base and skin stay eligible for exactly the same window. Image completion can replace the visible appearance at the current phase age; it cannot cause a previously absent/expired cue to reappear. Do not reset elapsedSec/phaseElapsedSec, add a new action key or mount an animation at phase zero. An explicit Replay still starts a new real showcase encounter through its existing button.

## 7 Showcase and integration

Add `vfxMode: SkillVfxMode = 'auto'` to CombatArenaScene and SkillGeometryLayer, forwarding it directly. App changes it only inside the existing combat showcase; normal game calls retain automatic mode. Support `?vfx=base` on the existing showcase URL; ignore this override outside showcase.

The existing VFX selector has Base VFX (no skin), then its current default/version entries. Use control value `base` for Base and `version:<id>` for versions, avoiding collisions with real version IDs. Choosing Base keeps the saved preferred version unchanged. Choosing a version strips the `version:` prefix, sets auto mode and passes the raw ID to the existing validated version setter. A skinless skill still has the Base option. Unknown control values are ignored and unknown query values use auto.

Remove replayArena from chooseArenaVersion and from mode changes. Do not replenish mana, rewind the playhead, reset actors/cooldowns or issue combat commands when switching appearance. Keep explicit Replay and existing showcase initialization separate. A paused frame must update its readiness/selected art without advancing the simulation or rebuilding committed geometry.

Use `data-vfx-renderer="base|skin"`, `data-vfx-version`, `data-vfx-base-reason` and the existing skill/action/payload data marks for tests/Inspect. Keep diagnostic loading/error information inside showcase/Inspect; add no implementation status text to normal gameplay.

## 8 Implementation order and completion gates

| Step | Work | End condition |
|---|---|---|
| VFX-0 | Read every current asset/spec/geometry consumer; record affected-file status; capture cold/warm Base/skin behavior and reproduce broken-registered-atlas failure | Baseline records real behavior, current source inputs and relevant test results; preserve concurrent edits |
| VFX-1 | Implement metadata candidate/bundle validation and the shared readiness state machine | Unit coverage proves deduplication, decode/error/timeout/late-event behavior, SSR safety and no per-frame retries |
| VFX-2 | Unify gameplay/effect marks, typed provenance, payload expansion and stable envelope; remove support's asset requirement | Same frame yields the same geometry/timing/receipts in all modes and states; no duplicate heal/volley effect |
| VFX-3 | Complete Base player/mob/support cues and the four field motifs using the existing stage | All supported live rows and missing DESIGN cases resolve; phase/motion/reduced-motion behavior matches section 3 |
| VFX-4 | Wire ready-art rendering, all SVG failure paths and showcase Base selector | Pending/failed bundles retain Base; version/mode changes never replay combat |
| VFX-5 | Run the full scenario matrix, real showcase and isolated browser faults; measure comparable cold/warm loads and drawing work | All SVF acceptance below has evidence; report numeric watches separately |
| VFX-6 | Remove temporary forwarding exports/debug code; update surviving ownership references and README status | Required checks pass; delete this completed plan under docs/plan rules |

Work one boundary at a time. If an asset/metadata case fails, correct that presentation owner and repeat the affected case; do not change skill numbers, skip the case or replace it with another skill. Missing browser/tool access is a reported verification blocker, not permission to claim completion. Existing map-trailer blockers do not block this feature's independent tests.

## 9 Required tests and fixed review scenarios

Add only `game/tests/ui/vfx-assets.test.ts` for the new state owner and `game/browser-tests/skill-vfx-fallback.spec.ts` for real browser faults. Add that spec to the existing hmr project testMatch. Extend current catalog, geometry, payload, aura/support, Base-spec and art-projection suites. Use fake Image/decode/timers for the state unit tests; use real browser images/decoding for integration, not a new DOM package.

| Case | Required assertion |
|---|---|
| Missing skin and missing DESIGN | Valid skill shows correct metadata-derived Base cue and footprint without a crash |
| Selected ready | Selected bundle only; essential telegraph remains; no full Base impact beneath it |
| Selected pending / default ready | Default renders while preferred loads; readiness change samples the same live playhead |
| Selected 404 / default ready | Default bundle wins; failed URI is requested programmatically once |
| Both fail, corrupt decode, zero dimensions | Complete Base persists with no unhandled exception or simulation mutation |
| Multi-layer partial failure | No partial bundle; resolve complete default or Base; simultaneous shards do not retry the same URI |
| Pending asset crosses timeout | Base remains; late load/decode cannot revive the failed entry |
| Ready SVG subsequently errors | All consumers of its URI degrade through the same shared state without blanking |
| Last consumer unmounts while loading | No detached-node writes or leaked component subscriptions; shared completion is safe |
| Asset arrives during Travel/Field or after expiry | Same footprint/action/payload, current phase age; expired/cancelled marks remain absent |
| Base ↔ auto and version switch while paused | Geometry, actors, HP/mana/cooldowns, RNG, action IDs and clock stay unchanged; saved version survives Base mode |
| Meteor / Blizzard / Thunder / Sand | Correct field motif stays inside the committed area; no new impact/damage timer |
| Bolt / cone / line / chain / split burst | Per-payload paths/contact/obstacle receipts match the real geometry in both renderers |
| Heal/upkeep without art | One pulse per actual activation/tick; no duplicate normal-cast cue |
| Aura on/off/push | One aggregated Base halo per actor while eligible; stops immediately; no invented range |
| Incoming mob skill | Correct warning/shape/source/element through Base, independent of player DESIGN entries |
| Ground target moves/dies / all leave / manual no body | Preserve existing combat regression outcomes; appearance cannot retarget or cancel it |
| Same-skill aim while cast/field exists | Both marks remain visible; pending aim cannot hide the committed effect |
| Reduced motion and minimal quality | Essential shapes/contact survive with restrained motion; no extra damage flashes or state changes |

For reviews use the existing `http://localhost:5173/__showcase?skill=attack.meteor&vfx=base#showcase-field`, then replace vfx=base with vfx=auto. The exact player sample IDs are `attack.fireball`, `attack.meteor`, `attack.blizzard`, `attack.thunder_storm`, `attack.sand_storm`, `attack.chain_lightning`, `attack.double_strafe`, `attack.void_ray`, `heal.heal`, `buff.flame_guard`, `aura.vitality` and `curse.expose`. Activate Vitality through the existing owned-aura fixture/command, not a fabricated halo. Use `mob.earth.boulder-toss` for the incoming ground case. Resolve all skill stats from their current data owners, not new numeric fixtures.

Use headless Playwright at 1920 × 1080 and deviceScaleFactor 1, one tab per check. Read the snapshot/console, interact, and close the browser. Extend the current isolated combat-layer harness to inject no-art, delayed, 404, corrupt and partial-layer responses; use the actual components and asset owner, not a fake renderer. Do not use networkidle for continuously animated effects: wait for explicit renderer/status marks. Expected injected resource failures are distinguished from unexpected console/page errors. Test-local fixture controls are allowed; add no production gameplay-write bridge.

Record cold/warm render readiness, unique requested/preloaded URIs, decode counts, retained status entries, DOM/image count and frame interval p50/p95/p99 over 120 rAF samples under the same browser/save/camera/action sequence. Count manager preloads separately from browser SVG/cache requests; the hard invariant is one manager preload/decode per URI, not an assumption of one physical browser request. Record values as watches; claim no speed/memory improvement without before/after evidence.

Commands, from repository root with the HMR server running:

```text
npm --prefix game run test -- tests/ui/vfx-assets.test.ts tests/ui/vfx-catalog.test.ts tests/ui/arena-skill-vfx.test.ts tests/ui/skill-geometry.test.ts tests/ui/skill-payload-art.test.ts tests/ui/skill-support-geometry.test.ts tests/ui/skill-aura-geometry.test.ts tests/ui/vfx-aim.test.ts tests/ui/skill-art-projection.test.ts tests/ui/skill-display-twin.test.ts tests/ui/arrow-shower-vfx.test.ts tests/ui/skill-geometry-cache.test.ts
npm --prefix game run test -- tests/sim/combat-timing.test.ts tests/sim/manual-control.test.ts tests/sim/combat-arena-detarget.test.ts tests/sim/field-execution.test.ts tests/sim/lock-on.test.ts tests/sim/ray-channel.test.ts tests/sim/release-live-channel.test.ts
npm run test:browser -- --project=hmr skill-vfx-fallback.spec.ts combat-aoe.spec.ts
npm --prefix game run check
npm run build
npm --prefix game run test
```

Do not fix/rerun an unrelated unchanged failure from concurrent work. Report its exact path/error and the checks that did pass. No generated pool or gameplay JSON changes means no generator/data migration is required for this work.

## 10 Acceptance

| ID | Must be demonstrated |
|---|---|
| SVF-01 | Supported player/mob/support marks have a complete Base path independent of any skin |
| SVF-02 | Selected-ready → default-ready → Base ordering is exact and bundle-atomic |
| SVF-03 | Loading, decode failure, timeout, late completion and SVG errors have tested bounded behavior |
| SVF-04 | Shared preloads deduplicate per URI and perform no import-time browser work or per-frame retries |
| SVF-05 | Committed geometry, pursuit/contact paths, clocks, cancellation and lifetime guards agree in every mode |
| SVF-06 | Skin readiness cannot resurrect an expired cue, restart a phase or duplicate a payload/support impact |
| SVF-07 | Four real field motifs, chain/volley, incoming attacks and support/aura cues match the fixed visual rules |
| SVF-08 | Base/showcase/version changes preserve combat state and the saved preferred version; no replay side effect |
| SVF-09 | Reduced motion/quality preserves essential information and stops inactive auras/channels promptly |
| SVF-10 | Existing AoE target/ground/aim regressions remain green |
| SVF-11 | Required tests, Svelte check, build, real showcase review and controlled browser faults pass |
| SVF-12 | Comparable load/drawing measurements are reported honestly; no guessed FPS or performance budget |

This plan changes no HP/damage/XP, cost, cooldown, target cap, field duration, skill roster, mob placement, save schema, map topology, HUD regions, sound system or game speed. It adds no cosmetic storefront or new skin content. Before closeout, remove temporary compatibility exports and surviving references to this plan, point documentation to the landed catalog/readiness/geometry/tests, then delete the completed plan and its README entry.
