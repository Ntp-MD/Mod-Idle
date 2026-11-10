# Component VFX tools

Run commands from the repository root. Python authoring helpers use the installed Pillow package; browser helpers use the game's installed Playwright package and the existing dev server at `http://localhost:5173`.

```powershell
node docs/vfx-skill/component-vfx/tools/review-vfx.cjs colors
node docs/vfx-skill/component-vfx/tools/review-vfx.cjs matrix
python docs/vfx-skill/component-vfx/tools/produce-vfx-components.py verify
```

The review script resumes accepted color and camera records from [manifests](../evidence/manifests/). It writes palette screenshots to [captures/palettes](../evidence/captures/palettes/) and recipe screenshots to [captures/recipes](../evidence/captures/recipes/). The execution plan remains at [docs/plan/vfx-component-library.html](../../../plan/vfx-component-library.html); its open Meteor phase item still governs the next implementation step.

The `produce-*`, `register-*` and `compose-*` scripts retain the original authoring workflows and version guards for the three source batches and their demonstration recipes. The `verify` command above checks the original fourteen masters and the saved default-pointer hashes. `probe-*`, `debug-*` and `check-vfx-fallback.cjs` are focused browser diagnostics.

These files were moved from `.cache` at the user's request. Historical [gate logs](../evidence/logs/) retain their original bytes and command paths. [cache-migration.json](../evidence/manifests/cache-migration.json) records each original path, destination, size and hash; historical path text inside that migration record is provenance, not a current tool dependency.
