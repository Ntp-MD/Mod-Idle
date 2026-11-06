# Modular Hex Map Layout and Trailer Design Plan

Status: locked visual implementation specification; implementation, image creation, coordinate moves or enabling terrain art in the game have not started. The implementation agent executes the fixed choices and review/repair rules below under the owner's delegation in README.md.

Implementation prerequisites and execution order live in [README.md](README.md). Start MAP-0 only after the placement migration and map architecture acceptance are complete. The starting runtime uses fixed-level placement IDs and the extracted map owners, with terrain art still disabled. No remaining choice of pilot Zone, progression order or gameplay authority is delegated to visual implementation.

The goal is for viewers to see the map in a trailer and understand that this world has places to explore, routes to choose, resources to return for, and dangerous areas worth coming back to challenge. The starting direction is a 2.5D fantasy diorama world that uses painted artwork and hex piece composition to form continuous terrain.

This document fixes the visual direction, asset selection, composition and work order. Recording this plan is not an instruction to start runtime work in the steps below.

## 1 Scope and data ownership

- Use the existing structure of 18 Zones, 54 Subzones and existing mining/woodcutting/fishing points. This plan adds no hexes and moves no places.
- Keep walking, distances, hex selection, keyboard navigation, waypoints and already-discovered data under the existing systems.
- Use the landed engine placement lookup and Zone-filtered Unique seam in [engine/index.ts](../../engine/index.ts), validated by [catalog.ts](../../engine/catalog.ts) and the existing exploration/drop tests. Read the real pool, never a Species band or a level copied into map data. Resource permissions and output remain owned by [engine/fieldwork.ts](../../engine/fieldwork.ts), [sim/world/fieldwork.ts](../../game/src/sim/world/fieldwork.ts) and `engine.json`'s `road.locations`/`fieldwork`; these contracts survive migration-plan deletion.
- Shapes and positions come from `engine.json → road`; presentation comes from [map.json](../../tools/data/map.json).
- Use the camera system in [map-projection.ts](../../game/src/ui/map/map-projection.ts) and [map-camera.ts](../../game/src/ui/map/map-camera.ts). Do not create another camera or geometry set for the trailer.
- Follow [AGENTS.md](../../AGENTS.md) for HUD, PNG glyphs, markers, accessibility and checks at 1920 × 1080.

## 2 What already exists and the design conclusions

The existing base already supports projected ground, upright artwork, depth ordering and pan/orbit/zoom, but [map.css](../../game/src/styles/map.css) disables `layer-diorama` and `diorama-figure` with a shortcut that only shows flat color. The preceding architecture phase preserves that appearance. MAP-0 records this post-refactor flat baseline before composition work begins on the extracted renderer.

Images in the library are not all considered reviewed. Placing a base on a hex does not confirm that trees or buildings have the correct camera angle. Use the [reference kit](../../art-reference/map/README.md), [geometry](../../art-reference/map/geometry/hex-spec.json) and [checklist](../../art-reference/map/review/checklist.md) as the image-requirements owners.

Decisions for this direction:

| Topic | Initial implementation decision |
|---|---|
| Visual language | Painterly terrain on a hex ground, with readable height from shadow and silhouette |
| Composition | Connected hexes inside an area form forests, ridges and coasts; soil layers are visible only at appropriate edges |
| Focal points | Use one main landmark per plate as the eye-catching point, then reveal sub-places when zooming |
| Color | Use the existing biome palette; each area has one clear main color and limited highlights |
| Travel | Show the real selected route via the road API and the real player position |
| Information | Details appear according to zoom distance and what has been discovered; no full labels on every hex in a wide shot |
| Movement | Camera, travel and existing activity status are the only beats; add no decorative animation in this rollout |

### 2.1 Fixed asset and layer recipe

Use the following candidates, with no alternate style selection or random tile variants. `TERRAIN_ART` in `map-terrain.ts` becomes the ground-texture catalogue; add `TERRAIN_RELIEF` in that same file for the upright column. Keep `TERRAIN_VARIANTS` empty. Paths are relative to `game/public/map/`; these are selected candidates, not claims of visual approval.

| Terrain | Ground candidate | Upright candidate |
|---|---|---|
| grass | `terrain/grass-2.png` | none |
| forest | `terrain/grass-2.png` | `terrain/forest-relief.png` |
| rock | `terrain/mountain-relief-2.png` | `terrain/mountain-relief.png` |
| snow | `terrain/snow-2.png` | none |
| water | `terrain/water-2.png` | none |
| marsh | `terrain/marsh-2.png` | none |
| moor | `terrain/moor-2.png` | none |
| salt | `terrain/salt-2.png` | none |
| waste | `terrain/waste-2.png` | none |
| ash | `terrain/ash-2.png` | none |
| village | `terrain/grass-2.png` | `landmark/village.png` |
| camp | `terrain/grass-2.png` | `landmark/camp.png` |
| town | `terrain/grass-2.png` | `landmark/town.png` |
| dungeon | `terrain/waste-2.png` | `landmark/encounter-ruins.png` |

Ground is a full-hex low-relief surface. Upright candidates are separate objects with real alpha, not full-hex canvases. Do not use the numbered forest/town paintings as the upright object or flatten trees/buildings by baking them into the rotating plane. The forest/tree and town originals have the needed separate silhouettes; the mountain original requires particular halo/shadow review. These observations select the route through review; they do not replace live object-angle checks.

In `tools/map.ts`, place registered ground under one `#terrain-ground` group inside the existing projected board. Register the source's six measured vertices to the **existing polygon's local six points**, then translate to its cached center; the parent uses the existing board projection exactly once. Reuse the current sector-registration helper with those polygon targets rather than its old camera-baked `PROJ_HEX` targets. Ground images neither counter-rotate nor enter upright depth sorting. Keep selected/route/hover outlines above the texture using those same cached polygon points, with no additional world geometry.

Use the existing `.diorama-figure`/actor holder for the upright piece and the existing `mapSpriteWidth`/measured painted bounds/`mapUprightAt` helpers. `LANDMARK_ART` must read the upright `TERRAIN_RELIEF.town`, not the new ground `TERRAIN_ART.town`. Preserve each settlement's existing landmark assignment; all current city/village size labels continue to share the same reviewed town family. Never put a mixed ground-plus-object canvas through the planar branch. Initial art scale is exactly the current helper/metadata scale; change no positions, camera angle, gap or scale by eye.

Ground images and relief use `pointer-events: none`; existing polygon/marker targets, focus, blue medallions and leaders own input. Keep all existing highlight/filter values from map.css. The saved `cleanMap` setting continues to hide both ground textures and upright art; DEFAULT_SETTINGS already selects the art-capable view. Run art checks with cleanMap false without overwriting a player's saved preference.

## 3 World layout

### 3.1 World level

Keep the three plates already in the map data and their existing board positions:

| Plate | Role in reading the picture | Initial focal point |
|---|---|---|
| Dawnreach | Starting world that invites exploration; city and nature read easily | Highspire ridge shape connected to the early green areas |
| Riftward | Travel that starts to feel pressure, with wet areas, ruined cities and harsh terrain per the existing biomes | City/ruined-structure shape in Blackwater Reach |
| Elderwake | Endpoint that feels large and historic | Ashfall town and forest clusters as an anchor before reading the surrounding areas |

This ranks the prominence of existing things; it does not change whole plates into a single biome or add landmarks with new gameplay.

Add one presentation-only `plate_anchors` map in `map.json`, with exactly `dawnreach: 'zone:2:sub:2'`, `riftward: 'zone:7:town'`, `elderwake: 'zone:16:town'`. Resolve each ID through `road.locations`; store no coordinates in this map. These are Dragon Peak, Blackwater Reach town and Ashfall town. The generator marks the matching existing cell/figure as an anchor, and the shared index exposes that boolean. Highspire's neighboring town remains the route destination associated with its ridge; it is not another invented landmark.

Elements when the whole world is visible:

1. Plate shape and terrain lines serve as the large composition.
2. A main city or landmark helps convey size and destination.
3. The selected route carries the eye to the player position or target.
4. Secondary towns and sub-areas carry less weight than the anchor.
5. Keep empty space between terrain clusters so cities and markers read clearly.

Compose relief deterministically from existing same-terrain connected components using the road's six-neighbor relation. At far distance show only anchor relief, player and the selected route. At mid/near show authored town/village/camp/dungeon relief at their own locations. Forest relief is placed on component-boundary cells and at one interior cell maximizing distance from the boundary, breaking ties by numeric q then r; omit relief on resource/site cells so their center stays readable. Rock relief is one existing cell per component: prefer its anchor if present, else maximize boundary distance with the same tie break. Other rock cells retain the ground painting's small rocks. Do not add random offsets, extra mountains or per-Subzone variants. Compute component/relief assignment once during generation, not on camera frames. A source ground image implying an unauthored road/barrier fails review and follows the repair recipe below.

### 3.2 Zone level

Each Zone has a main town/destination and three Subzones per the existing data. Visual arrangement should help read the difference between entrance, deeper areas and dangerous regions, through height, vegetation density and existing landmarks.

Do not assume the third Subzone always has the highest levels. Use the actually authored placements. The visual design must support the surprise where the player can read risk correctly.

Use plain areas as a backdrop so focal points carry weight. Do not put a large mountain, large town, large ruin and large marker on every hex so that all silhouettes compete.

### 3.3 Place and activity level

| Place | What can be read from the picture | Data when approached or selected |
|---|---|---|
| Town | Building cluster and opening around the town | Name and actions that actually exist |
| Hunting area | Biome character and traces/representatives of monsters the system permits to be seen | Placements and levels from the real pool |
| Mine | Mountain gap, rock face or mine mouth per the existing terrain | Mining, resources and fieldwork restrictions |
| Grove | Tree cluster distinguishable from the background forest | Woodcutting, output and available activities |
| Fishing | Waterside or aquatic-life area per authored sources | Fish/food the Zone actually supports |
| Dungeon / Boss / Unique | Landmark and marker for known data | Danger level and primary action per the existing system |

Fishing points do not need to exist in every Zone, and a water picture alone does not make that hex fishable. Positions and resource sources retain their existing owners.

## 4 Modular hex composition contract

Use four layers of artwork without adding any gameplay system:

| Layer | Function | Rules |
|---|---|---|
| Ground | Surface and ground edge | Use the existing footprint and projected geometry |
| Relief / vegetation | Rocks, mountains, trees and area depth | Stay within the existing depth ordering and do not cover selectable points |
| Landmark | Town, ruins and activity points | Place by position from the registry, not guessed from the picture |
| Interaction | Player, route, markers and labels | Read clearly above the picture without repainting terrain on hover/selection |

Rules for image pieces:

- The six-sided base must fit the project geometry. Use metadata actually measured from that image.
- Forest edges must join into one mass. Ridge and coast edges must not create seams that look like several image plates colliding from the wrong direction.
- Let some vegetation stay at terrain-cluster edges and leave marker-readable space; trees do not need to fill the center of every piece.
- Use height as image layering; do not add equal height to every hex.
- Shadow has one direction matching the chosen art set and does not stretch so far that the next piece's edge looks dirty.
- Road/water/valley pictures must not imply new walkable paths or walls that the real system does not have.
- Do not create new pictures for every Subzone from the start. Reuse image families deliberately and review a small set first.

## 5 Information by zoom distance

Use the existing CSS far/mid/near status and cutpoints as the starting point. Do not define another threshold set in the document or engine.

| Distance | Should be visible | Should be de-emphasized |
|---|---|---|
| Far | World/plate shape, biome color, main anchor, player position | Small labels, generic resource markers, per-piece vegetation |
| Mid | Towns, Subzones, the selected route, key destinations | Long data and markers for every activity at once |
| Near | Selected hex, discovered names/data, mining/wood/fishing, pool and primary action | Data for outer hexes unrelated to the selection |

Use `mapDetail` and the existing camera constants moved by ARC, without adding cutpoints. Far labels are only known anchor captions, the three existing plate captions, and the selected/hovered cell; suppress the old all-region-name overview loop. Mid adds known towns and the selected/hovered cell; near adds discovered Subzones and sites. At every distance, selected/hovered labels retain existing forced priority and unknown names/levels stay hidden through the discovery owner. Use `placeMapNames`'s current collision rules; never shrink text or invent abbreviations to fit more labels. Player, route and selected target remain visible at all distances. Resource/ordinary threat marks are near-only except on the selected cell; a live fight and camp warning retain their existing urgent visibility. The review presets are MAP_MIN_ZOOM, MAP_BASE_ZOOM and MAP_OPEN_ZOOM for far/mid/near respectively, with bearings 0°, 90°, 180° and 270°.

Markers use PNG shelf glyphs in medallions on vertical leaders from the hex center per the existing rules. Frames and leaders use `--es`; activity differences come from glyph/label, not repaints of terrain.

Selection keeps keyboard focus and announcements for arrows/Enter. Mountain or building shadows must not make targets unpressable.

## 6 Trailer presentation

Initial sequence of about 15 seconds, shot from the renderer and real systems when reaching the implementation step:

| Approximate time | Picture | What the viewer should understand |
|---|---|---|
| 0–3 seconds | World silhouette and main anchor visible before the camera moves toward the route | There is a world to travel and memorable destinations |
| 3–7 seconds | Follow the player position through a town and resource points; cut to activities actually happening | Travel connects to mining, wood or food gathering |
| 7–11 seconds | Move toward an area with dangerous placements and readable data | The player has a choice to risk it or return later |
| 11–15 seconds | Cut to combat at that location, then return to show the connection to the world | The map and gameplay are the same place |

Editing may skip waiting time, but must not invent reward, spawn, activity speed or data the game does not yet support just for a good shot. If using existing game speed, it must not make the viewer wrongly think it is normal time.

Use the existing pan/zoom/orbit. Design the camera so it is clear where it is going. In future, disabling the HUD for filming must keep the data needed for understanding; do not add a cinematic engine for this sequence.

The shot recipe is fixed: use seed 7, the real progressed save recorded during the pilot, bearing 0°, and camera methods from WorldMap. The opening uses MAP_MIN_ZOOM centered on Dawnreach's anchor; the route shot uses MAP_BASE_ZOOM centered on Highspire town and its actual mine/grove route; the danger/combat close-up uses MAP_OPEN_ZOOM centered on Dragon Peak. Include Blackwater's real fishing action as the resource cut when that pilot is complete. Record at 1920 × 1080 with normal game speed, keep the selected destination/action text, and trim captured waits to the existing four time windows. Do not fabricate progression, teleport the player for a shot, force a special proc or publish footage automatically.

## 7 Work order when implementation is ordered

None of the steps below have started:

| Step | Work | Check at end of step |
|---|---|---|
| MAP-0 | Verify prerequisites, capture the flat baseline, compare current art and real data for Highspire | Identify its existing town, three Subzones, mine, grove and real routes from the canonical owners, with no new coordinates |
| MAP-1 | Review only the terrain/landmark pieces needed for that pilot against the reference kit | Base, image, object angle, edges and depth order pass separate reviews; missing/failed pieces have an explicit repair/create task |
| MAP-2 | Compose Highspire through the extracted map owners, using the presentation allowlist below | Only the pilot's reviewed art is enabled; town, all three Subzones and resource points work in reality |
| MAP-3 | Check far/mid/near and marker/label/focus | Wide shots read the shape and close shots can select hexes/activities |
| MAP-4 | Repeat MAP-0–MAP-3 for Blackwater Reach, then extend across Dawnreach, Riftward and Elderwake | Water/fishing passes the second pilot before wider rollout; terrain connects and each plate has its chosen anchor |
| MAP-5 | Check performance and try the trailer sequence | Pictures come from the real game, with correctness and rendering-load measurements |

The first pilot is Highspire because Mountain Slopes, Cliff Holds and Dragon Peak test height/ridge edges alongside the existing town, mine and grove. Blackwater Reach is the second pilot for wet terrain and its existing fishing site. These are visual pilots; they do not replace or reorder the placement migration's gameplay-validation cases.

Enable terrain through one presentation-only `terrain_art_zones` allowlist in `tools/data/map.json`: initially `[]`, then `[2]` for Highspire, then `[2, 7]` after Highspire passes. The generator resolves each figure's Zone from existing location/land ownership and emits an enabled class; it does not copy coordinates, placement levels or resource permission into the allowlist. Replace the global CSS disable with scoped rules that show the diorama layer only when needed and keep every non-enabled figure hidden. Unreviewed figures stay on their existing flat/fallback presentation. Expand the list only with reviewed Zones during MAP-4; it controls presentation and grants no gameplay access.

MAP-1 reviews the exact §2.1 candidates. The implementation agent is the delegated reviewer for this rollout under README.md and completes the kit's visual review/approval step without asking the owner to choose images. Approval is earned through the following recipe; keep atlas/asset identities independent of gameplay placement IDs.

### 7.1 Fixed review, repair and rollout path

1. Inspect the selected file and its actual alpha/bounds. Ground uses its existing measured footprint entry; upright uses painted bounds and no fake six-vertex metadata. Run the kit's measurement/registration checks, then inspect an isolated piece and a connected 3 × 3 patch at the existing camera's four quarter-turn bearings. Inspect the pilot at far/mid/near at 1920 × 1080. These are test patches, not extra world cells.
2. Reject a piece for an unmeasured/misaligned ground footprint, changed apparent object angle, opaque halo/backdrop, clipped silhouette, hard cast shadow outside its ground contact, visible extra base/border, a baked unauthored road/wall, unreadable overlap, or a wrong seam that persists beyond the map's existing gap. Matching vertices alone never passes the object-angle test.
3. Repair the selected source through image editing, keeping its subject, painterly palette, upper-left illumination and existing kit camera. Ground brief: one continuous low-relief terrain surface to the exact reference hex, no buildings/tall trees, roads, walls, text, extruded base or shadow outside the hex. Upright brief: the same tree/peak/building cluster as a transparent separate object, remove background/halo, full hex base and external cast shadow, retain a compact ground contact and the kit object perspective. Use the kit geometry/reference image, not a newly guessed angle. Do not switch asset family, biome or style.
4. Store each candidate under `art-reference/map/outputs/` with the next numbered stem, retaining originals. Measure that output and review it again; use the first revision passing every criterion. Limit to three repair revisions per failed piece. If none passes or the editing tool is unavailable, leave that piece on the flat runtime fallback and report the exact asset/criterion as a blocker; the affected visual acceptance remains incomplete. Do not ask for a new direction or mark a fallback-only pilot complete.
5. Store a compact `<stem>-<version>.review.json` with source/output hashes, layer type, measurement reference, actual screenshot paths, criterion verdicts and `accepted` status alongside the candidate. This is asset-review metadata, not a copied gate transcript. The delegated reviewer accepts only after all criteria pass, then installs the numbered asset and updates the one catalogue/metadata owner. Do not overwrite raw originals or copy an unaccepted image to runtime.
6. If overlap/readability fails despite a valid image, apply this fixed correction order: verify cached ground contact/bounds; remove the offending non-anchor relief instance; retain ground and marker; re-run the same scene check. If an anchor itself fails, repair its image under steps 3–5 instead of moving/scaling the world or deleting its prominence. If label clutter fails, apply the visibility table and existing collision suppression; change no font size, thresholds or coordinates.
7. Highspire must pass before enabling Blackwater. Blackwater must pass before expanding through Zones 1, 3, 4, 5, 6, then 8–12, then 13–18 in numeric order. Reuse an accepted family without regenerating it per Zone, but check each new Zone's town/Subzones/sites and anchor composition before adding it to the allowlist. A hard failure leaves that Zone disabled and blocks its acceptance; numeric watches are recorded without automatic tuning or rejected art being silently enabled.

Points the implementation will touch:

- `tools/map.ts`: sheet composition from existing data sources
- `game/src/ui/map/map-terrain.ts` and footprint metadata: selection and placement of reviewed pictures
- `game/src/ui/map/map-scene.ts`, `map-projection.ts`, `map-camera.ts`: terrain, camera and layer ordering
- `game/src/styles/map.css`: prominence order and zoom-level detail
- `game/src/ui/map/map-markers.ts` and existing label owners: readability and selection
- `game/src/ui/map/WorldMap.svelte`, `map-view-model.ts` and `map.ts`: consume the landed placement/resource snapshot and update the existing layers
- `game/src/App.svelte`: only existing region/intent wiring when needed; no map DOM traversal, new listener lifecycle or HUD relocation

Do not remove the shortcut that hides the diorama and turn on all pictures at once as the first step. The pilot must pass and readability/load must be evaluated first.

## 8 Design acceptance and measurement

| ID | Evidence required when implemented |
|---|---|
| HXM-01 | Hex coordinates, road locations, distances and travel results are unchanged from existing data |
| HXM-02 | The same picture at far/mid/near shows the information order in item 5 |
| HXM-03 | Wide shots still show the start/player and world anchor without showing every area name |
| HXM-04 | Delegated reviewer inspects the wide shot with ordinary labels hidden and can identify the authored anchor, player and selected route target; apply §7.1's fixed clutter/anchor repair order if any is obscured |
| HXM-05 | Pieces have evidence of footprint fit and real object-angle review; do not use vertex-fit results instead of visual review |
| HXM-06 | Forests, ridges and coasts do not reveal wrong seams/shadows/overlaps when panning or orbiting |
| HXM-07 | Markers, hover, arrows, Enter, focus and announcements work even when tall pictures overlap the area |
| HXM-08 | Mining/wood/fishing and monsters reference real data; no activity or level is created from a picture |
| HXM-09 | Failed sprite/landmark/terrain loads still have a fallback and do not block walking or target selection |
| HXM-10 | The trailer test sequence shows real systems and does not claim features that do not exist yet |
| HXM-11 | There are baseline/current values for load time, DOM/image count and frame interval p50/p95/p99 under the same conditions |
| HXM-12 | Map checks, focused tests, Svelte check and real viewing at 1920 × 1080 pass with no unexpected console errors |

For performance, keep flat ground/needed geometry when far away and show upright art only for detail useful at that distance. Reuse art URLs through the browser cache system and the existing scene index. Avoid creating new SVG every frame or rescanning the whole board just to move the camera.

Measure flat post-ARC, Highspire, Blackwater and full-world compositions with the same browser/build/device scale, seed/save, starting camera and pan/zoom/orbit/selection sequence at 1920 × 1080. Record actual SVG/art load time, requests, DOM/image count and frame interval p50/p95/p99. Hidden images may still load; count network/decoded-image work rather than treating CSS hiding as proof of deferred loading. Retain a comparable flat run when the asset set changes. Numeric values are watches with witnesses; unexpected console errors, missing fallback or lost interaction fail correctness acceptance.

Extend the existing real `game/browser-tests/map.spec.ts` for far/mid/near, pilot scoping, tall-art selection, resource actions and failed-image fallback. Run `npm run map:check`, the affected map/destination tests, `npm --prefix game run check`, `npm run build` and `npm run test:browser -- --project=hmr map.spec.ts` against the HMR server specified by AGENTS.md. Inspect one headless tab at the showcase URL, read its snapshot/console, interact and close it. A placeholder browser assertion or measurement with no navigation/state transition cannot satisfy HXM acceptance.

Time and unit numbers are values to measure, not budgets to set or claims of being fast enough from concept pictures. Use the project's correctness gates and numeric watches. Reducing drawing work must not stop simulation or discard time.

## 9 What is not in this work

Do not add Zones, hexes, routes, resources, combat mechanics, fog-of-war systems or new cinematic engines. Do not move the game to a WebGL/3D engine and do not produce pictures for the whole world in batch before reviewing the pilot.

Future pictures are stored in `art-reference/` and pass the [reference kit](../../art-reference/map/README.md) review process before integration. Use runtime assets that passed that process for real trailer filming.

When starting work is ordered, use MAP-0 after the prerequisites in README.md. The delegated review recipe and measured HXM checks still run during implementation; this specification does not assert their outcomes. When all work is complete, update surviving references to the landed owners and handle this file under the [docs/plan rules](README.md).
