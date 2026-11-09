# public

Static shelves served by Vite. Keep hrefs stable; generated registries own the canonical href.

- combat/ player, mobs, gear shelves (part of game/src/ui/combat/arena/mob-pool.generated.json and player-equipment-v1.json)
- fx/ skill FX shelves
- map/ ground + landmark shelves (see game/src/presentation/ground-materials.ts, game/src/ui/map/map-terrain.ts)

Rules:
- New asset: add under the owning shelf, update the owning registry/generator, run its check.
- Do not rename or move a shelf without updating mob-pool.generated.json, player-equipment-v1.json, map-terrain, ground-materials, icon shelf and tests in the same change.
- Version folders v1/v2 stay as authored; default/version.json selects the active version.
