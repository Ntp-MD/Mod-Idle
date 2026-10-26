# Spatial VFX art replacement pack

User-directed art pass: use a 0.5m-wide player/mob idle silhouette as the visual ruler. The production contract is [vfx-production.md](../../vfx-production.md). All fourteen replacements are active through the additive spatial overrides in `game/src/ui/combat/arena-authored-vfx.ts`. Original PNGs and presets remain intact in `LEGACY_AUTHORED_VFX`; `authoredVfxFor(id, 'legacy')` retrieves them for reuse or rollback. Combat behavior and action/field timing remain governed by the implementation of [the combat core plan](../../../../docs/plans/combat-core-engine-ai-plan.md).

## Replacement scope

Thirteen whole-area/sector atlases: Meteor, Blizzard, Firestorm, Sand Storm, Void Blast, Ground Slam, Earth Shock, Shatter, Overload, Aftershock, Whirlwind, Venom Spray and Cleave. Meteor contains many separated falling stones and distributed impacts. Blizzard contains many falling ice elements, wind and scattered ice impacts across its field. Other replacements express their own circle, expanding wave, cone or sweep.

Arrow Shower also has a replacement projectile-component atlas: its old art showed arrows falling onto a ground patch, whereas the current canonical action is a three-shot projectile burst. Use the new single-arrow flight/contact component once for each real launch. Its 0.6m artwork length is a presentation reference against the 0.5m actor body, separate from the skill's canonical flight range. This makes fourteen replacement atlases in total.

`review.json` covers every live skill and distinguishes new field art from reusable actor/contact/projectile components. Reusing a component is an art decision; its old runtime size or composition is not thereby approved. In particular, Chain Lightning needs target-connected links, piercing attacks need their true line path, Arrow Shower needs the action's real individual launches, and support effects stay attached to their owning actor.

The [source art preview](../../../../game/public/fx/authored/spatial-v2-preview.html) is available on an existing dev server at `/fx/authored/spatial-v2-preview.html`. It plays all fourteen atlases with the renderer's alpha threshold and a 0.5m actor-body ruler. It uses the source footprint's measured visible span for comparison; provisional source anchors and a flat ruler grid do not verify the live arena's projected ground plane. Cone span uses its authored angle and reach rather than the enclosing circle's diameter. Source metadata is collected in [manifest.json](manifest.json) and staged at `game/public/fx/authored/spatial-v2-manifest.json`.

## Integration contract

- Read current skill data and actual action/field geometry at integration time. Prompt dimensions are the authoring snapshot, not a second gameplay data source.
- Read the measured source rectangles in each `meta.json`; never slice an assumed 384px or 256px grid. The generator's actual PNG dimensions can differ from the request.
- Original PNG pixels are preserved. Apply the existing alpha discard threshold of 8/255 before sampling. Raw transparency and thresholded gutter checks are recorded separately.
- A replacement atlas is a complete distributed field/sector, not one individual projectile to repeat at full-field size. Fit the ground plane to the committed footprint, preserving its circular/cone shape and facing. Keep the falling height distinct from ground depth when projecting.
- Calibrate the actor ruler and meter projection together: a 6m-wide field spans twelve 0.5m-wide bodies. Do not scale one tiny projectile to six meters or size the field from a hit actor's bounding box.
- Opening, active and exit frame ranges describe source animation. Runtime action/field ownership supplies actual playback timing. Meteor's decorative arrivals add no gameplay impacts. Blizzard loops for the live committed field; it does not derive its lifetime from one attack sprite.
- Runtime activation keeps the original batch manifest as the legacy source and overlays this pack's entries. Circle fields fit the committed projected ellipse; cone art follows the committed direction and clips to its actual sector. Ground bursts render behind actors. The actor idle reference and camera share the half-meter ruler, with camera-aware ground input. Source QA remains separate from runtime acceptance; geometry/layer/reduced-motion checks and integrated arena samples are recorded in the QA metadata.

The older design catalogue's single-comet Meteor description is superseded by the user's meteor-shower direction in the production contract. Do not infer a three-target online cap from legacy queue text.

Integrated stopped-frame samples at a verified 1920x1080 browser viewport: [Meteor](meteor-integrated-1920.png) and [Blizzard](blizzard-integrated-1920.png). Captures omit browser scrollbars. Ground Slam, Venom Spray and Arrow Shower were also inspected in the live arena; local movement and Shift-click focus were checked with the followed camera.
