# Player art references

Canonical player reference set plus review concepts. Not the game asset shelf.

## Layout

```text
art-reference/players/
  README.md
  production.json          set manifest (coverage, frame contract, runtime pointers)
  runtime-candidate.json   runtime integration candidate data
  animation-mold.json      pose mold spec (slot order, phases)
  body/                    canonical clean player body, no weapon
    reference.png, reference.meta.json
    idle/                  8 directions, one <slot>.png + .meta.json each
    walk/                  east/west phases
    attack/one-hand/       east/west x windup/contact/follow-through/recovery
    hit/ death/            east/west single poses
    skill/shield-bash/     east/west baked contact poses
  weapons/                 one folder per family (side/raised/foreshortened;
                           bow/crossbow: ready/drawn/released)
  shield/                  front/side/stowed
  concepts/                review-only drafts, never runtime
    pixel-archer-direction-concept-*.png
    one-handed-sword-direction-proof/
```

## Rules

- Lowercase-hyphen names. No versioned or staging duplicates: one canonical
  copy of each pixel; drafts live under `concepts/`.
- Body frames contain no weapon. Baking a weapon into a pose is art-owner
  work; never fake it by compositing pixels here.
