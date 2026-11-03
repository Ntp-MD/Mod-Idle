# Skill VFX pool

**Single source of truth for player-skill VFX.** Every version here — regardless of where it was
generated (in-house tool, AI model, external pack, artist hand-off) — is the only copy the game
reads. No exceptions.

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
- Never store skill VFX anywhere else: not `output/…`, not `art-reference/…`, not
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
      default/version.json          # { "version": "v2" } — pointer only
      v1/
        atlas.png
        meta.json
        source-sheet.png            # optional raw generation
        qa.json                     # optional QC report
      v2/
        decal.png                   # straight-down ground texture instead of an atlas
        meta.json                   # { "decal": true, ... }
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

## Default

Resolution order: `default/version.json` → highest `vN`. The generated
registry marks that row `default: true`, so the combat-field version selector and the arena read the same version.
Runtime URLs address the resolved `vN` folder, never `.../default/atlas.png`.

## Registered by

- `tools/skill-vfx-pool.ts` scans every `attack-<element>/<slug>/vN/` and `<type>/<slug>/vN/`,
  reads `meta.json`, and writes `game/src/ui/fx/pool.generated.ts`.
- `game/src/ui/fx/catalog.ts` reads that generated registry; the first row is the default.
- Combat field showcase: `http://localhost:5173/__showcase?sample=combat-field&skill=<id>`; its
  VFX version selector reads the archived versions.

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
3. Regenerate the registry, then run the pool test. Each failure names its own cause: a stale
   `pool.generated.ts` fails "has every archived pool atlas on disk"; emptying a live skill
   fails "covers every live skill"; a test that reads a hardcoded version file (Fissure
   `v1/meta.json`, Arrow Shower `v1/atlas.png`, Blizzard's `v1`/`v3` sources) fails on the
   missing path.
