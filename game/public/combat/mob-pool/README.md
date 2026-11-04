# Mob sprite pool

Production mob atlases and their metadata live together under their race and species from
`tools/data/engine.json`. The player atlas remains separate. The generated runtime registry is
embedded by the arena, so the game does not fetch metadata during combat.

```text
<race>/<species>/
  default/version.json          # { "version": "v1" }
  v1/atlas.png
  v1/meta.json
  variants/<variant-id>/        # only when a variant has its own art
    default/version.json
    v1/atlas.png
    v1/meta.json
```

To replace art, add a new `vN` with its matching atlas and metadata, change its
`default/version.json`, and run `npm run mob-sprites` from the repository root. The generator
validates race membership, pointers, image presence and variant identity. Run
`node tools/mob-sprite-pool.mjs --check` to verify that the embedded registry is current.
Animation metadata must follow the existing frame and anchor contract in `docs/animation.md`;
preserve variant `speciesId`, `variantId`, `name` and directional `frames` when applicable.
Check the result in the arena and with the monster animation QA tool before using new art.
After writing restored runtime atlases with `tools/monster-animation-restore-raw.py`, run
`npm run mob-sprites` again to refresh the embedded metadata.

Files under `public/` are copied into the build. Move retired versions to an archive outside
`game/public/` if they should no longer ship, and repoint the default first.
