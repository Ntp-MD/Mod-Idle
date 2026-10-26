# Monster art references

This folder stores reference and candidate art. It is not the game asset shelf; approved animation atlases are copied to `game/public/combat/arpg/`.

## Layout

```text
art-reference/monsters/
  production-roster.json
  README.md
  animation-prompt-template.md
  <species>/
    animation/
    <style-variant>/
  _shared/collection/reference.png
```

- `<species>` is the canonical species id.
- `animation/` is a first-party animation set.
- `<style-variant>/` is a third-party reference pack, named in full (`spear-goblin`, `stone-golem`, `shadow-wolf`, `sword-shield`), never a bare suffix such as `spear` or `stone`.
- `_shared/collection/reference.png` is the one shared style reference.
- `animation-prompt-template.md` is the copy-ready generation and revision
workflow. New animation must use its single-frame intake (Step 2b) with
`tools/monster-animation-compose.py`; grid atlases are accepted only for
drafts already under review.
- `production-roster.json` is the index of species status and animation paths.

## Required variant layout

Every variant must contain `meta.json`.

A first-party animation variant must contain:
```text
<species>/animation/
  meta.json
  atlas/animation.png
  source/            optional: concept or source image
  clips/             optional: per-action strips
```

Keep generated atlases under review as `atlas/animation-draft.png` and set `meta.json` status to `draft-review`. Promote a draft to `atlas/animation.png` only after its base and atlas are approved and its frame bounds are recorded.

Named gameplay variants from `tools/data/engine.json` (`mob.variants`) keep their own first-party set under:
```text
<species>/variants/<variant-id>/
  meta.json
  atlas/animation-draft.png
```
Use a lowercase-hyphen slug of the canonical variant name for `<variant-id>`. A named variant folder is not a version folder; keep one current set per named variant.

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

`frames/<clip>/000.png` is optional and only used when raw frames exist. Clip names are always `idle`, `walk`, `attack`, `hit`, `death`. Keep one current set per variant; do not add version folders.

## Current set

```text
player/animation/
goblin/animation/
orc/animation/
kobold/animation/
ogre/animation/
troll/animation/
minotaur/animation/
skeleton/animation/
mummy/animation/
vampire/animation/
demon/animation/
slime/animation/
golem/animation/
dragon/animation/
treant/animation/
human/animation/
lizardman/animation/
elf/animation/
giant/animation/
werewolf/animation/
dryad/animation/
spider/animation/
wisp/animation/
wolf/animation/

goblin/spear-goblin/
golem/stone-golem/
imp/little-demon/
skeleton/original-bone/
skeleton/sword-shield/
spider/pixiblop-spider/
wisp/eclipse-wisp/
wolf/shadow-wolf/
wraith/crypt-wraith/

_shared/collection/reference.png
```

This folder intentionally keeps only app-used animation and review packs. There is no `_packs/`, `archive/`, or version-folder layer.
The 20 target species above have approved baseline atlases at `animation/atlas/animation.png`; each runtime copy is registered in the Pixel-v2 combat atlas.

## Generation prompt

Use `animation-prompt-template.md` as the copy-ready source. It carries the
species block, exact 8x5 output contract, single-frame intake (Step 2b),
rejection checklist, revision prompt and species lines.
