# Skill VFX pool

Each active player skill owns one current raster recipe directly under its skill folder. Update these named files in place; Git keeps history. Source masters, raw images, exact prompts and QA live in the [shared source shelf](../../../../docs/vfx-skill/component-vfx/outputs/README.md).

## Layout

```text
game/public/fx/skill-pool/
  attack-fire/
    attack-fireball/
      meta.json
      molten-projectile.png
      flame-tongue.png
      ember-ground-cracks.png
  attack-cold/
  attack-lightning/
  attack-poison/
  attack-chaos/
  attack-earth/
  attack-phy/
  aura/
  buff/
  curse/
  heal/
```

There are no nested art directories or default pointer files. Do not create `vN`, `vfx-component`, `default`, `final` or other delivery folders under a skill. The registry generator rejects nested folders instead of selecting a highest version. Skill groups remain organizational: attacks use their element (`phy` means physical); other skills use their type.

## Updating art

1. Update the named source master and its QA in the shared shelf.
2. Update the same skill's `meta.json` and copy only its referenced PNGs beside it. The main `src` uses `/fx/skill-pool/<group>/<slug>/<file>.png`; `additionalLayers` uses local filenames. Preserve registration, geometry, phase timing and human approval requirements.
3. Run `node --experimental-strip-types tools/skill-vfx-pool.ts` and the focused VFX tests. `--skill=<id>` can refresh one skill's registry row.

`docs/vfx-skill/component-vfx/tools/compose-vfx-all.py` refreshes the referenced named images while retaining an existing recipe's metadata. A new recipe uses the established composition rules. Artwork owned by another producer is protected; review ownership before replacing it.

The generator validates element grouping, image grids, projection, layer IDs and metadata, then writes `game/src/ui/fx/pool.generated.ts`. The existing catalog API receives one stable `pool` row labeled Current art per skill. Its internal selection types also support DEV fixtures; they do not represent versioned files. The showcase offers Base or current art. Missing/failed raster art keeps the existing Base fallback.

The flat migration preserved all 90 previously selected skill recipes, all 241 layer images and their render metadata. Unselected copies were removed from public output; their component images remain in the shared source shelf and their previous recipes remain in Git. Historical native-review receipts keep their original identifiers without becoming runtime dependencies. Human visual approval is unchanged.
