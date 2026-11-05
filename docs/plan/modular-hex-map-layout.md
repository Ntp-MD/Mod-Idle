# Modular Hex Map Layout and Trailer Design Plan

Status: design plan only; implementation, image creation, coordinate moves or enabling terrain art in the game have not started.

The goal is for viewers to see the map in a trailer and understand that this world has places to explore, routes to choose, resources to return for, and dangerous areas worth coming back to challenge. The starting direction is a 2.5D fantasy diorama world that uses painted artwork and hex piece composition to form continuous terrain.

This document sets the visual direction and the future work order. Recording this plan is not an instruction to start work in the steps below.

## 1 Scope and data ownership

- Use the existing structure of 18 Zones, 54 Subzones and existing mining/woodcutting/fishing points. This plan adds no hexes and moves no places.
- Keep walking, distances, hex selection, keyboard navigation, waypoints and already-discovered data under the existing systems.
- Use monster data through the engine seam per the [placement plan](mob-variant-level-placement.md) and section P4a of that plan. Do not copy placement levels into the map.
- Shapes and positions come from `engine.json → road`; presentation comes from [map.json](../../tools/data/map.json).
- Use the camera system in [map-projection.ts](../../game/src/ui/map/map-projection.ts) and [map-camera.ts](../../game/src/ui/map/map-camera.ts). Do not create another camera or geometry set for the trailer.
- Follow [AGENTS.md](../../AGENTS.md) for HUD, PNG glyphs, markers, accessibility and checks at 1920 × 1080.

## 2 What already exists and the design conclusions

The existing base already supports projected ground, upright artwork, depth ordering and pan/orbit/zoom, but [map.css](../../game/src/styles/map.css) disables `layer-diorama` and `diorama-figure` with a shortcut that only shows flat color. Future work therefore starts by checking visual composition on the existing renderer.

Images in the library are not all considered reviewed. Placing a base on a hex does not confirm that trees or buildings have the correct camera angle. Use the [reference kit](../../art-reference/map/README.md), [geometry](../../art-reference/map/geometry/hex-spec.json) and [checklist](../../art-reference/map/review/checklist.md) as the image-requirements owners.

Decisions for this direction:

| Topic | Proposal in this plan |
|---|---|
| Visual language | Painterly terrain on a hex ground, with readable height from shadow and silhouette |
| Composition | Connected hexes inside an area form forests, ridges and coasts; soil layers are visible only at appropriate edges |
| Focal points | Use one main landmark per plate as the eye-catching point, then reveal sub-places when zooming |
| Color | Use the existing biome palette; each area has one clear main color and limited highlights |
| Travel | Show the real selected route via the road API and the real player position |
| Information | Details appear according to zoom distance and what has been discovered; no full labels on every hex in a wide shot |
| Movement | Camera, travel and activity status are the main beats; decorative movement is added later only when measurements support it |

## 3 World layout

### 3.1 World level

Keep the three plates already in the map data and their existing board positions:

| Plate | Role in reading the picture | Proposed focal point |
|---|---|---|
| Dawnreach | Starting world that invites exploration; city and nature read easily | Highspire ridge shape connected to the early green areas |
| Riftward | Travel that starts to feel pressure, with wet areas, ruined cities and harsh terrain per the existing biomes | City/ruined-structure shape in Blackwater Reach |
| Elderwake | Endpoint that feels large and historic | Ashfall town and forest clusters as an anchor before reading the surrounding areas |

This ranks the prominence of existing things; it does not change whole plates into a single biome or add landmarks with new gameplay.

Elements when the whole world is visible:

1. Plate shape and terrain lines serve as the large composition.
2. A main city or landmark helps convey size and destination.
3. The selected route carries the eye to the player position or target.
4. Secondary towns and sub-areas carry less weight than the anchor.
5. Keep empty space between terrain clusters so cities and markers read clearly.

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

Markers use PNG shelf glyphs in medallions on vertical leaders from the hex center per the existing rules. Frames and leaders use `--es`; activity differences come from glyph/label, not repaints of terrain.

Selection keeps keyboard focus and announcements for arrows/Enter. Mountain or building shadows must not make targets unpressable.

## 6 Trailer presentation

Proposed sequence of about 15 seconds, shot from the renderer and real systems when reaching the implementation step:

| Approximate time | Picture | What the viewer should understand |
|---|---|---|
| 0–3 seconds | World silhouette and main anchor visible before the camera moves toward the route | There is a world to travel and memorable destinations |
| 3–7 seconds | Follow the player position through a town and resource points; cut to activities actually happening | Travel connects to mining, wood or food gathering |
| 7–11 seconds | Move toward an area with dangerous placements and readable data | The player has a choice to risk it or return later |
| 11–15 seconds | Cut to combat at that location, then return to show the connection to the world | The map and gameplay are the same place |

Editing may skip waiting time, but must not invent reward, spawn, activity speed or data the game does not yet support just for a good shot. If using existing game speed, it must not make the viewer wrongly think it is normal time.

Use the existing pan/zoom/orbit. Design the camera so it is clear where it is going. In future, disabling the HUD for filming must keep the data needed for understanding; do not add a cinematic engine for this sequence.

## 7 Work order when implementation is ordered

None of the steps below have started:

| Step | Work | Check at end of step |
|---|---|---|
| MAP-0 | Confirm the brief, compare current pictures and real data, choose one Zone for the pilot | Know which anchor, resources and routes must read, with no new coordinates |
| MAP-1 | Review a small set of existing terrain/landmark pieces against the reference kit | Base, image, object angle, edges and depth order pass separate reviews |
| MAP-2 | Experimentally compose one Zone on the existing renderer | The Zone's town, three Subzones and resource points work in reality |
| MAP-3 | Check far/mid/near and marker/label/focus | Wide shots read the shape and close shots can select hexes/activities |
| MAP-4 | Extend the direction across the three plates with the existing image families | Terrain connects and each plate has a memorable anchor |
| MAP-5 | Check performance and try the trailer sequence | Pictures come from the real game, with correctness and rendering-load measurements |

The proposed pilot is Highspire because it has Mountain Slopes, Cliff Holds and Dragon Peak, which clearly test height/ridge-edge levels, and it still tests coexistence with the existing town, mine and grove. Then use Blackwater Reach to test water/wet areas and fishing points before extending to the whole world.

Points the implementation will touch:

- `tools/map.ts`: sheet composition from existing data sources
- `game/src/ui/map/map-terrain.ts` and footprint metadata: selection and placement of reviewed pictures
- `game/src/ui/map/map-scene.ts`, `map-projection.ts`, `map-camera.ts`: terrain, camera and layer ordering
- `game/src/styles/map.css`: prominence order and zoom-level detail
- `game/src/ui/map/map-markers.ts` and existing label owners: readability and selection
- `game/src/App.svelte`: wiring of the existing map region, without moving HUD regions in this work

Do not remove the shortcut that hides the diorama and turn on all pictures at once as the first step. The pilot must pass and readability/load must be evaluated first.

## 8 Design acceptance and measurement

| ID | Evidence required when implemented |
|---|---|
| HXM-01 | Hex coordinates, road locations, distances and travel results are unchanged from existing data |
| HXM-02 | The same picture at far/mid/near shows the information order in item 5 |
| HXM-03 | Wide shots still show the start/player and world anchor without showing every area name |
| HXM-04 | After briefly viewing a wide shot, a reviewer can point out the anchor and next destination; if they must read labels across the whole map, adjust the hierarchy |
| HXM-05 | Pieces have evidence of footprint fit and real object-angle review; do not use vertex-fit results instead of visual review |
| HXM-06 | Forests, ridges and coasts do not reveal wrong seams/shadows/overlaps when panning or orbiting |
| HXM-07 | Markers, hover, arrows, Enter, focus and announcements work even when tall pictures overlap the area |
| HXM-08 | Mining/wood/fishing and monsters reference real data; no activity or level is created from a picture |
| HXM-09 | Failed sprite/landmark/terrain loads still have a fallback and do not block walking or target selection |
| HXM-10 | The trailer test sequence shows real systems and does not claim features that do not exist yet |
| HXM-11 | There are baseline/current values for load time, DOM/image count and frame interval p50/p95/p99 under the same conditions |
| HXM-12 | Map checks, focused tests, Svelte check and real viewing at 1920 × 1080 pass with no unexpected console errors |

For performance, keep flat ground/needed geometry when far away and show upright art only for detail useful at that distance. Reuse art URLs through the browser cache system and the existing scene index. Avoid creating new SVG every frame or rescanning the whole board just to move the camera.

Time and unit numbers are values to measure, not budgets to set or claims of being fast enough from concept pictures. Use the project's correctness gates and numeric watches. Reducing drawing work must not stop simulation or discard time.

## 9 What is not in this work

Do not add Zones, hexes, routes, resources, combat mechanics, fog-of-war systems or new cinematic engines. Do not move the game to a WebGL/3D engine and do not produce pictures for the whole world in batch before reviewing the pilot.

Future pictures are stored in `art-reference/` and pass the [reference kit](../../art-reference/map/README.md) review process before integration. Use runtime assets that passed that process for real trailer filming.

When starting work is ordered, use MAP-0 as the beginning, and when all work in the plan is done, handle the file per the [docs/plan rules](README.md).
