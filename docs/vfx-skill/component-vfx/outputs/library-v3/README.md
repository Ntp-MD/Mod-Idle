# Additional VFX source shapes

Seven selected sources were generated with the built-in `image_gen` tool on 2026-11-10. Each master is a 1024 x 1024 RGBA PNG. The complete native square was uniformly resampled to 818 x 818 and centered with at least 103 pixels of transparent padding. No background keying, silhouette crop, independent axis stretch or alpha recoloring was applied.

| Shape | Selected master | Intended reuse |
| --- | --- | --- |
| cone-stream | [PNG](cone-stream.png) | Elemental breath and spray |
| wall-segment | [PNG](wall-segment.png) | Repeated upright barrier sections |
| tether-strand | [PNG](tether-strand.png) | Drain, healing and restraint links |
| shockwave-ring | [PNG](shockwave-ring.png) | Expanding hollow radial impacts |
| crescent-wave | [PNG](crescent-wave.png) | Sword and wind projectiles |
| shield-dome | [PNG, revision 2](shield-dome-v2.png) | Translucent actor shields and area domes |
| bind-strand | [PNG](bind-strand.png) | Roots, vines and magical restraints |

Exact prompts and source paths are in [generation-prompts.json](generation-prompts.json). Each selected master has a matching `-qa.json`; each untouched original is retained as `-raw.png`. The first shield candidate and its QA remain for provenance; it was rejected because its thick swirling ribbons did not read as a continuous dome. Use `shield-dome-v2.png`.

Native outputs are near-neutral rather than byte-exact grayscale. QA records visible RGB channel spread; production `AtlasFrame` already desaturates before applying the seven palettes. All seven shapes passed all seven runtime palettes (49/49 new pairs): fire, cold, lightning, earth, poison, chaos and physical. The dome review uses the native timeline to freeze the displayed activation rather than snapping to the latest simulation time.

These source assets now have non-default runtime masters in the [component guide](../../README.md). Moving endpoint bindings, repeated wall sections, ring expansion, cone projection and body attachments are integrated. Browser captures and the camera/zoom matrix are in progress. The dome is a translucent overlay, with no 3D occlusion shell or gameplay collision. Human visual approval remains open. The [execution plan](../../../../plan/vfx-component-library.html) tracks accepted evidence and the final gates.
