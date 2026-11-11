# Component VFX tools

The [source guide](../outputs/README.md) owns the single named-asset workflow. Named masters, local raw images, QA and exact prompts live in `../outputs/`; the [roster](../outputs/index.html) shows the current count. Runtime copies live directly under their skill folder; neither location uses delivery subfolders. Python uses the installed Pillow package. Run commands from the repository root.

```powershell
python docs/vfx-skill/component-vfx/tools/produce-vfx-components.py produce
python docs/vfx-skill/component-vfx/tools/produce-vfx-components.py verify
python docs/vfx-skill/component-vfx/tools/compose-vfx-all.py
node --experimental-strip-types tools/skill-vfx-pool.ts
```

`produce` normalizes local raw sources into the same named masters and refreshes measured QA. `verify` checks every registered shape, source/master hashes, RGBA canvas and padding. Neither command writes runtime art or current art.

The active 33-component raster roster uses built-in imagegen with the exact `pendingMasters` prompts in [generation-prompts.json](../outputs/generation-prompts.json). After inspecting one generated transparent PNG, run `python docs/vfx-skill/component-vfx/tools/register-raster-source.py <shape> <generated-png-path>`. It copies the untouched raw, registers the named master and family, uses the existing normalizer and updates the raster roster. Named `produce`/`verify` commands also accept optional shape names, so an addition does not rewrite existing art. Human approval and runtime adoption remain separate.

`compose-vfx-all.py` reads layer metadata and PNGs from the shared shelf, without depending on archived owner versions. It refreshes referenced images directly under each skill while retaining its existing metadata and shape selection. New recipes use the established composition rules; a folder without `componentRecipe` metadata is protected. The established Thunder Storm, Meteor and Blizzard exclusions remain. Timing still uses existing gameplay producers; this command does not authorize human visual approval. The recipe manifest stays in [evidence/manifests/vfx-component-recipes.json](../evidence/manifests/vfx-component-recipes.json).

The earlier batch-specific producers, registrars and demonstration composers were retired. New source art updates the named master and its existing recipe, with history kept in Git. Runtime selection IDs in old receipts remain historical compatibility data.

`review-vfx-materials.cjs --resume` reads the retained 71-recipe material manifest from the shared shelf and reviews the current flat runtime recipes in one headless 1920 × 1080 tab. It uses the existing dev server at `http://localhost:5173`. Buff activations use live captures; other recipes use the native timeline. Resume is valid only while recorded recipe inputs are unchanged; remove an affected record after editing its art or metadata. Human visual approval remains separate from technical checks.

`review-vfx.cjs` retains the historical palette/camera harness. `probe-*`, `debug-*` and `check-vfx-fallback.cjs` are focused diagnostics. Captures go to local `.cache/vfx-captures/`; [manifests](../evidence/manifests/) and [historical logs](../evidence/logs/) retain measured evidence. Old paths inside those receipts record what was checked; they are not instructions for future output directories.
## Deferred procedural 3D production

The earlier [3D source guide](../sources/README.md), [animated gallery](../outputs/animated/index.html) and Blender tools remain historical exploration. The owner has requested no further 3D work for the current target; their earlier checks do not fulfill the new named raster assets.
