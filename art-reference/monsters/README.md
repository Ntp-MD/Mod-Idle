# Monster art references

This folder stores reference and candidate art. It is not the game asset shelf; approved animation atlases are copied to `game/public/combat/arpg/`.

## Layout

```text
art-reference/monsters/
  production-roster.json
  README.md
  animation-prompt-template.md
  <race>/
    <species>/
      reference.png, reference.meta.json, prompt.txt
      animation/
        v1/
          meta.json
          poses/
          atlas/
        v2/
        source/
      variants/<variant-id>/
        v1/
        v2/
      <style-variant>/
  _shared/collection/reference.png
  _shared/mob-animation-template.json
```

- `<race>` is the canonical race id from `tools/data/engine.json` `mob.races`; each species lives under its race.
- `<species>` is the canonical species id.
- `reference.png` + `reference.meta.json` + `prompt.txt` at the set root fix the identity and the one baked weapon; every pose below must match them.
- `animation/` is a first-party animation set.
- `poses/` holds the 41 base slots plus `skill/<action-slug>/` per kit entry with a cast block, exactly as named in `_shared/mob-animation-template.json`; each pose ships as `<slot>.png` + `<slot>.meta.json` + `<slot>.prompt.txt`.
- `animation/meta.json` declares `attackKind` (`close` for front line, `far` for stand-off unless recorded otherwise) and the baked weapon ids.
- `v1/`, `v2/`, ... are versioned candidates; a new candidate always opens a new version folder, never overwrites a shipped path. `source/` and the root reference trio are shared across versions. Version lifecycle follows the versioned asset pool in `docs/plans/vfx-image-generation-work.md`; the integrator promotes the selected version as default per slice and keeps the previous one as fallback.
- `<style-variant>/` is a third-party reference pack, named in full (`spear-goblin`, `stone-golem`, `shadow-wolf`, `sword-shield`), never a bare suffix such as `spear` or `stone`.
- `_shared/collection/reference.png` is the one shared style reference.
- `_shared/mob-animation-template.json` is the per-pose mold: required slots, naming, baked-weapon rule (one fixed baked weapon per species/variant, no equip switch) and reject list. New animation must fill every slot it names; completeness is machine-checked with `python tools/monster-animation-qa.py --mold <species-dir> --species <id>`.
- `animation-prompt-template.md` is the copy-ready generation and revision
workflow. New animation must use its single-frame intake (Step 2b) with
`tools/monster-animation-compose.py`; grid atlases are accepted only for
drafts already under review.
- `production-roster.json` is the machine-read atlas geometry contract, versioned path patterns and species list.

## Required variant layout

Every variant must contain `meta.json`.

A first-party animation variant must contain:
```text
<race>/<species>/animation/
  source/            optional, shared across versions: concept or source image
  v<k>/
    meta.json
    poses/
    atlas/animation.png
    clips/           optional: per-action strips
```

Keep each new version's atlas under review as `v<k>/atlas/animation-draft.png` until approved; promote to `v<k>/atlas/animation.png` only after its base and atlas are approved and its frame bounds are recorded.

Named gameplay variants from `tools/data/engine.json` (`mob.variants`) keep their own first-party set under:
```text
<race>/<species>/variants/<variant-id>/v<k>/
  reference.png, reference.meta.json, prompt.txt
  meta.json
  poses/
  atlas/animation-draft.png
```
Use a lowercase-hyphen slug of the canonical variant name for `<variant-id>`. Each new candidate opens a new `v<k>/` folder; never overwrite a shipped version. Variants mirror the species inner layout because each carries its own baked set.

A third-party reference variant must contain:
```text
<species>/<style-variant>/
  meta.json
  source/reference.png
  clips/idle.png
  clips/walk.png
  clips/attack.png
  clips/hit.png      optional: only when the pack ships a recoil clip
  clips/death.png
  atlas/             optional: full sheet if the pack provides one
```

`frames/<clip>/000.png` is optional and only used when raw frames exist. Clip names are always `idle`, `walk`, `attack`, `hit`, `death`. Third-party packs stay single-set reference only; they are never versioned and never enter `animation/`.

## Current set

```text
humanoid/goblin/animation/
humanoid/orc/animation/
humanoid/kobold/animation/
humanoid/ogre/animation/
humanoid/troll/animation/
humanoid/minotaur/animation/
undead/skeleton/animation/
undead/mummy/animation/
undead/vampire/animation/
demon/demon/animation/
formless/slime/animation/
elemental/golem/animation/
dragon/dragon/animation/
plant/treant/animation/
humanoid/human/animation/
humanoid/lizardman/animation/
humanoid/elf/animation/
humanoid/giant/animation/
beast/werewolf/animation/
plant/dryad/animation/
insect/spider/animation/
elemental/wisp/animation/
beast/wolf/animation/

humanoid/goblin/spear-goblin/
elemental/golem/stone-golem/
demon/imp/little-demon/
undead/skeleton/original-bone/
undead/skeleton/sword-shield/
insect/spider/pixiblop-spider/
elemental/wisp/eclipse-wisp/
beast/wolf/shadow-wolf/
undead/wraith/crypt-wraith/

_shared/collection/reference.png
```

This folder intentionally keeps only app-used animation and review packs. There is no `_packs/` or `archive/` layer; history lives in the `v<k>/` version folders.
The 20 target species above have approved baseline atlases at `animation/atlas/animation.png`; each runtime copy is registered in the Pixel-v2 combat atlas.

## Generation prompt

Use `animation-prompt-template.md` as the copy-ready source. It carries the
species block, exact 8x5 output contract, single-frame intake (Step 2b),
rejection checklist, revision prompt and species lines.
