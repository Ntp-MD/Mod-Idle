# Skill VFX pool

**Single source of truth for player-skill VFX.** Every version here — regardless of where it was
generated (in-house tool, AI model, external pack, artist hand-off) — is the only copy the game
reads. No exceptions.

## Current state: fallback active, component recipes land one skill at a time

Every live skill now carries a single `vfx-component` recipe built from the reusable library
(90 player skills, 2026-11-10). `rimworld` stays first and active for any skill without a `default`
pointer, so only `attack.thunder_storm` (approved) renders raster in game; every other recipe is
review-only until a human points `default/version.json` at `vfx-component`. The retired `vN` folders
sit in `archive/fx/skill-pool/<group>/<slug>/vN/` and are rollback history, not runtime art.

## Storage rule

- Every generated or imported skill VFX — any production pipeline, AI generator, external pack
  or hand pass — is stored as a **new immutable `vN`** under its skill slug:
  `game/public/fx/skill-pool/attack-<element>/<skill-slug>/vN/` for attack rows, and
  `game/public/fx/skill-pool/<type>/<skill-slug>/vN/` for every other type.
- Attack pools group by Element: `attack-phy`, `attack-fire`, `attack-cold`, `attack-lightning`,
  `attack-poison`, `attack-chaos`, `attack-earth`. The folder must match the row's `element`
  (`phy` is the short folder name for `physical`); a mis-filed atlas fails the generator.
- `<type>` for the other rows is exactly one of `aura`, `buff`, `curse`, `heal`; the slug keeps
  its existing type-prefixed name (`attack-aftershock`, `aura-haste`, …).
- Never store skill VFX anywhere else: not `output/…`, not `docs/…`, not
  `game/public/fx/<skill-id>/`, not a named folder such as `final/` or `painted-v6/`.
  `tools/skill-vfx-pool.ts` rejects sibling folders under `game/public/fx/` and unknown type
  folders under `skill-pool/`.
- One version owns its own `atlas.png`, `meta.json` and (when reviewed) `qa.json`; revise by
  adding `vN+1`, never by overwriting a version.
- `default/version.json` names the active version. It is a pointer and holds no art.
- A superseded or rejected version leaves the pool instead of sitting beside runtime art:
  move it whole to `archive/fx/skill-pool/<group>/<slug>/vN/`, or delete it when it can be
  regenerated. Nothing under `game/public/` is safe to keep "unused" — Vite copies it into
  `game/dist`.

## Layout

```
game/public/fx/skill-pool/
  attack-phy/                       # physical rows
    attack-ground-slam/
      rimworld/version.json         # { "renderer": "procedural" } — renderer-only fallback
      default/version.json          # { "version": "v2" } — pointer only, when raster art returns
      v2/
        atlas.png
        meta.json
        qa.json                     # optional QC report
        decal.png                   # straight-down ground texture instead of an atlas
  attack-fire/
  attack-cold/
  attack-lightning/
  attack-poison/
  attack-chaos/
  attack-earth/
  aura/
  buff/
  curse/
  heal/
```

## Fallback version

`rimworld/version.json` with `{"renderer":"procedural"}` registers a version with no raster slots;
the arena draws that skill procedurally (`game/src/ui/combat/rimworld-vfx.ts`). It is never the
promoted default while a raster `vN` exists, and `default` stays `false` for it.

## Default

Resolution order: `default/version.json` → highest `vN`. The generated registry marks that row
`default: true`, so the combat-field version selector and the arena read the same version.
Runtime URLs address the resolved `vN` folder, never `.../default/atlas.png`. With no pointer and no
`vN` folder the registry holds the `rimworld` fallback alone and the arena stays procedural.

## Registered by

- `tools/skill-vfx-pool.ts` scans every `attack-<element>/<slug>/` and `<type>/<slug>/`, reads each
  version folder, and writes `game/src/ui/fx/pool.generated.ts`.
- `game/src/ui/fx/catalog.ts` reads that generated registry; the first row is the default.
- Combat field showcase: `http://localhost:5173/__showcase?sample=combat-field&skill=<id>`; its
  VFX version selector reads the registered versions.

## Adding a version

1. Add a new `vN` folder under the skill's group (`attack-<element>` for attacks, `<type>`
   elsewhere) and its slug folder (never reuse a number).
   For an animated atlas put `atlas.png` (+ per-frame `meta.json`); for an exact-fit ground
   texture put a square `decal.png` + `meta.json` with `"decal": true` (no atlas frames;
   the renderer projects it through the arena ground basis).
2. Point `default/version.json` at the version that should open first.
3. Run `node --experimental-strip-types --disable-warning=ExperimentalWarning tools/skill-vfx-pool.ts`.
4. Keep older `vN` folders; they are the rollback path.

## Retiring a version

1. Move the folder whole to `archive/fx/skill-pool/<group>/<slug>/vN/` (the group it lived in),
   keeping `meta.json`, `qa.json` and every `source-license-*.txt` untouched. Delete it instead
   only when it can be regenerated from a source sheet you still hold.
2. Repoint `default/version.json` first if it names the retired folder — the generator throws
   on a pointer to a missing version.
3. Regenerate the registry, then run the pool test (`game/tests/ui/vfx-catalog.test.ts`). A stale
   `pool.generated.ts` fails "keeps every runtime registry row raster-free"; a `default` pointer to
   a folder that is gone fails the generator.
