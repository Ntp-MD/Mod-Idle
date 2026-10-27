# Player art references

Production player sets plus the frozen `equipment-v1` archive. Not the game asset shelf.

## Layout

```text
art-reference/players/
  README.md
  equipment-v1/        frozen archive of the modular pipeline (clean body + separate
                       weapon PNGs); runtime fallback only, do not extend
  <weapon-set>/        one baked set per weapon family (e.g. one-handed-sword)
    reference.png, reference.meta.json, prompt.txt
    README.md          set status plus conformance/gap map
    animation/v1/      meta.json (atlas/ appears after compose)
    poses/             mold slots, one <slot>.png + .meta.json + .prompt.txt each
    _staging/          pre-bake source and legacy-named files pending re-pose; never runtime
```

## Rules

- Lowercase-hyphen set names. New candidates ship as `v1/`, `v2/` versions per
  `art-reference/monsters/README.md`; never overwrite a shipped path.
- Mold: `art-reference/monsters/_shared/mob-animation-template.json` (41 base slots,
  close/far attack kinds, skill profiles per kit entry with a cast block).
  Baked only: one fixed weapon per set, no equip switch.
