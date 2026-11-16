# VFX source assets

One shared shelf: 86 named shapes in 14 families, with seven runtime palettes. Open [the gallery](index.html) for every raw/master pair and the 71 material recipe ingredient strips.

The 33 current additions are summarized in the [raster contact sheet](qa/raster-roster.png) and [expansion QA](qa/raster-expansion.json). Their human visual review remains pending.

## Update policy

Update the existing asset by its shape name. Do not create numbered library folders, append version suffixes to source filenames, or allocate a new runtime `vN` folder for a source-art update. Git records changes. Historical receipt IDs remain provenance, not runtime paths. Live art uses one flat folder per skill as described in the [runtime guide](../../../../game/public/fx/skill-pool/README.md).

| File | Purpose |
| --- | --- |
| `<shape>.png` | Selected 1024 × 1024 RGBA master |
| `raw/<shape>.png` | Untouched selected generator output |
| `qa/<shape>.json` | Measured alpha bounds, source/master hashes and review state |
| `generation-prompts.json` | Exact prompts, provenance and layer registration for every selected shape |
| `rejected/` | Rejected dome and dust candidates, QA and dust edit provenance |
| `recipes.json` | 71 material compositions and their current flat metadata URLs |
| `native-review.json` | Recorded native layer visibility and browser errors |
| `preserved-defaults.json` | Protected Thunder Storm PNG hashes at their current flat paths |

The original 14 ingredients, eight shape extensions, seven placement shapes and 24 material silhouettes now share this shelf. The 24 material silhouettes cover fire, ice, water, electricity, poison, earth, void, weapon contact and support. They were commissioned after the earlier compositions looked too similar; Thunder Storm remains the approved reference.

## Authoring

The raster roster adds 33 hand-painted still ingredients to the original 53. Exact unbuilt requests are under `pendingMasters` in `generation-prompts.json`; a selected image moves into `masters` only when its raw, normalized PNG, QA and inventory entry exist. Earlier 3D scenes are deferred exploration. These still textures do not implement actor masks, sampled-path trails, historical silhouettes or optical refraction.

Keep the complete raw image and its alpha. Uniformly fit it inside 818 × 818, preserving its aspect ratio, and center it on a 1024 × 1024 transparent canvas. The measured alpha bounds must leave at least 103 pixels of padding. Never crop the silhouette, stretch axes independently or bake in camera tilt. Near-neutral sources are desaturated by production `AtlasFrame` before palette mapping.

When adding a shape, add its exact prompt, local raw/master/QA paths and layer registration to `generation-prompts.json`, and register its family in `tools/data/vfx-components.json`. When revising one, update that same named record and raw file. Keep approval separate from technical QA; changed art requires fresh review.

From the repository root:

```powershell
python docs/vfx-skill/component-vfx/tools/produce-vfx-components.py produce
python docs/vfx-skill/component-vfx/tools/produce-vfx-components.py verify
```

`produce` refreshes the named masters and measured QA from the local raw files. It does not publish runtime art. `verify` checks the complete inventory, RGBA canvas, alpha padding and both hashes. To update a game recipe, use the existing skill's folder through [the composition tool](../tools/README.md); source consolidation alone does not approve or promote art.

## Provenance and recorded review

The selected dome is the continuous translucent shell; its earlier thick ribbon candidate is retained in `rejected/`. Dust needed two rejected attempts: rectangular haze, then nonzero background alpha. The selected dust is a transparent cutout. Rejected originals and the exact edit prompts remain available; they are not registered ingredients.

The material study used the built-in imagegen tool. [Blizzard's VFX breakdown](https://news.blizzard.com/en-us/article/23746639/diablo-iv-quarterly-updatedecember-2021) informed the separation of primary silhouettes, secondary material response and quieter residue. No game textures were downloaded or repackaged. The [Path of Exile 2 portfolio](https://www.artstation.com/artwork/8BLe0O) returned a sign-in page during research; its embedded artwork was not inspected.

Historical verification: the first 29 shapes have accepted records for all 203 shape/palette pairs. All 71 material recipes had every expected layer observed with zero browser errors at 1920 × 1080, world scale 1. Buffs used live activation captures; other skills used timeline sampling. That batch recorded check at 0 errors / 0 warnings and five focused files at 29/29 tests. These are recorded results, not new verification of changed art. Full-suite testing, every palette/camera combination for the 24 added material shapes, and human visual approval remain unperformed for that batch. Screenshots belong in local `.cache/vfx-captures/`, never in this shelf.
