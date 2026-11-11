# Material studies — library v4

New silhouettes commissioned on 2026-11-10 after the user rejected the visual sameness of the earlier compositions. Thunder Storm remains the approved reference. The earlier generation prompts are not inputs to this batch.

Open [the review gallery](index.html) for paired Raw/master images and the active-skill ingredient assemblies. Native arena links open the existing field showcase; select the version printed on the card. Static ingredient strips are not gameplay screenshots.

The batch contains 24 independently generated material silhouettes, each with an untouched `-raw.png`, a padded `.png`, the exact prompt and a measured `-qa.json`. Generation uses the built-in `imagegen` tool. Packaging preserves the complete native image and alpha, uniformly fits it inside 818 × 818 without stretching either axis, and centers it on a 1024 × 1024 transparent canvas. Some native outputs are rectangular despite the square prompt; their original aspect ratios are preserved. Production palette mapping remains in `AtlasFrame`.

| Material | Added silhouettes |
| --- | --- |
| Fire | flame-tongue, molten-projectile, ember-ground-cracks |
| Ice | ice-shard-cluster, ice-lance, frost-fracture |
| Water | water-impact-crown, water-jet |
| Electricity | lightning-arc, electric-contact |
| Poison | poison-droplet, toxic-vapor, acid-splash |
| Earth | dust-impact-plume, rock-shrapnel, sand-vortex |
| Void | void-rift, gravitic-lens |
| Weapon contact | blade-thrust, heavy-cleave, blood-contact |
| Support | healing-wisps, root-entangle, barrier-facets |

[Blizzard's VFX breakdown](https://news.blizzard.com/en-us/article/23746639/diablo-iv-quarterly-updatedecember-2021) informed the separation of primary silhouettes, secondary material response and quieter residue. This is an original asset batch; no game textures were downloaded or repackaged. The [Path of Exile 2 artist portfolio](https://www.artstation.com/artwork/8BLe0O) was found during research, but the available page reader returned a sign-in page; its embedded artwork was not inspected.

`recipes.json` names the new version for each of 71 active skills. Aura rows are excluded. Thunder Storm and existing default pointers are hash-checked by the packaging tool. `reviewOnly: true` makes these versions selectable without letting the registry's highest-version fallback promote them. Human visual approval remains pending.

Dust required two revisions: the first candidate contained a rectangular haze, and the second still had a nonzero background alpha. Both rejected originals are retained as `dust-rejected-*-raw.png`; the selected cutout, its edit prompt and provenance are recorded in `dust-revisions.json`. Only the selected `dust-impact-plume.png` is registered or used in the new recipes.

Verification: all 71/71 native recipes had every expected layer observed with zero browser errors at 1920 × 1080, world scale 1. Buffs use live activation captures; the remaining skills use timeline sampling. Results are in [native-review.json](native-review.json), with screenshots under [captures/materials](../../evidence/captures/materials/). Gallery filtering and the Fireball screenshot load passed in the same viewport. `npm run check` passed with 0 errors / 0 warnings; the five focused catalog, projection, placement, arena-VFX and asset-budget files passed 29/29 tests. The protected-pointer/Thunder Storm hashes match. Full-suite testing, every palette/camera combination and human visual approval were not performed for this batch.

Reproduce packaging once with `python docs/vfx-skill/component-vfx/tools/compose-vfx-materials.py`, then rebuild the registry with `node --experimental-strip-types tools/skill-vfx-pool.ts`. Do not rerun packaging over an existing delivery: versions are immutable. Native scene captures use `node docs/vfx-skill/component-vfx/tools/review-vfx-materials.cjs` with the dev server running on port 5173. Read `native-review.json` for measured visibility and console results; existence of a capture is not human approval.
