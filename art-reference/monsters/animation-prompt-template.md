# Monster animation prompt template

Use the species block and approved references for every run. The roster below is for species-level baseline atlases. For named gameplay variants, use each row in `tools/data/engine.json` at `mob.variants` and generate one image per named variant. Do not combine two species or two variants in one image.

## Target roster

Create one atlas for each of these 20 canonical species, in this order. The identifier is the canonical species id from `production-roster.json`:

1. `goblin` — Goblin
2. `orc` — Orc
3. `kobold` — Kobold
4. `ogre` — Ogre
5. `troll` — Troll
6. `minotaur` — Minotaur
7. `skeleton` — Skeleton
8. `mummy` — Mummy
9. `vampire` — Vampire
10. `demon` — Demon
11. `slime` — Slime
12. `golem` — Golem
13. `dragon` — Dragon
14. `treant` — Treant
15. `human` — Human
16. `lizardman` — Lizardman
17. `elf` — Elf
18. `giant` — Giant
19. `werewolf` — Werewolf
20. `dryad` — Dryad

Use the approved species design and references to fill the Species block for each run. Do not infer a complete design from the species name alone. If a species has no approved design block yet, define and review that block before generating its atlas.

## Named gameplay variants

For a variant batch, enumerate `tools/data/engine.json` at `mob.variants`. Generate one atlas per named variant, using the species id plus a lowercase-hyphen slug of the variant name as its folder key. Preserve the species anatomy and approved base design; use the variant name only for a restrained, readable palette or equipment cue. Keep every variant in a separate image and folder.

For named variant atlases, keep at least 24 transparent pixels between visible alpha and all four edges of every 256 × 256 runtime cell. Preserve complete poses inside that safe area; keep the feet on the existing ground anchor.

## Inputs

- **Image 1 — style and animation standard:** `game/public/combat/arpg/pixel-v2/player-animation-v2.png`; match its camera, sprite scale, atlas arrangement and frame canvas. Do not copy the Player's identity or equipment.
- **Body-angle reference:** the approved bases (`ogre/animation/source/base-v2.png`, `troll/animation/source/base-v3.png`) show the required whole-body rotation; match their torso/hip/leg orientation, not just the head.
- **Image 2 — approved base (optional):** `art-reference/monsters/<race>/<species>/animation/source/base.png`; use only after the base is approved. Never use `game/src/icon/mob` painted icons.
- **Optional source:** `<path to an approved concept or previous variant>`
- **First pass:** when no approved base exists, generate from the written species block only; do not attach the mob icon shelf.

## Species block

```text
Species id: <species>
Species name: <name>
Silhouette: <body plan, limb count, tail/wings/horns, posture>
Head ratio: <head height as a fraction of visible body height>
Face: <species-specific deviations from the shared Face language below — ear shape, snout/beak, mouth/tusks; keep the glowing eyes, low detail and upper-left lighting. Tusks are optional per species>
Equipment: <weapon, shield, armour, clothing baked into every frame; write "none" if none. Mobs have no equip switch — one fixed baked set per species/variant>
Locomotion: <walk gait for a four-legged / biped / hover body>
Attack: <one readable attack; state windup and contact, and whether it is close (melee, body-edge) or far (projectile, center)>
Hit reaction: <how the body recoils without moving its feet>
Death: <how the body falls and settles>
Forbidden extras: <anything this species must never carry>
```

## Face language (shared)

Every species uses the same chibi goblin face language, adapted to its anatomy:

- **Structure:** oversized chibi head; large pointed ears where the species has ears; short broad nose; wide mouth. Add two small sharp tusks only where the species has them. Adapt the ears, nose and mouth to the species (beak, snout, mandibles) but keep the same simple readable face.
- **Eyes:** bright glowing eyes with a crisp inner highlight; pick a species-appropriate glow colour (ember orange, toxic green, cold blue, violet, etc. — not always yellow) with no outer glow halo, aura or lens flare. This is a mandatory checkpoint for every non-Slime species; verify the glow at the final 56–64 px size.
- **Detail:** low. Large flat colour areas; no warts, wrinkles, pores, scars, extra facial lines or busy texture.
- **Lighting:** fixed upper-left light. Flat highlight plane on the forehead, left cheekbone, nose bridge and chin; shadow under the brow, beside the nose, under the lower lip and along the jaw. Two to three shades per material, chunky pixel clusters.
- **Expression:** fierce and ugly, never cute or soft.
- **Species exception — Slime:** use a round, friendly blue slime face with large dark eyes and a small mouth (Rimuru-inspired), not the fierce goblin face. Keep every other shared face rule.

The approved reference is `art-reference/monsters/humanoid/ogre/animation/source/base-v2.png`.

## Step 1 — static base pose (generate first)

Generate one neutral base pose and wait for approval before any animation. This is the identity reference for every later frame.

- Output a single 1024 × 1024 PNG.
- Treat the canvas as one 128 × 128 logical cell upscaled 8× with crisp 8 × 8 pixel blocks.
- Character 56–64 logical pixels tall, feet at logical y=108, whole body in a three-quarter view facing down-right (south-east/east): near shoulder and hip forward, far side receding, chest foreshortened, feet staggered. Not a front-facing torso with only the head turned; centred.
- Hard alpha only; transparent outside the silhouette.
- Save the approved image as `source/base.png` (normalized 128 × 128) and keep raw generations as `source/base-v*.png`.

```text
Create ONE static neutral base-pose sprite for a dark-fantasy MMORPG monster, to be animated later. Image 1 is the visual-style reference only: match its compact chibi silhouette, low visual density, flat colour groups, sparse selective pixel outlines and small native pixel scale. Do not copy any creature, card, label or layout from it.

SPECIES
<Insert the completed Species block here, including Face.>

OUTPUT CONTRACT
- One transparent RGBA PNG, 1024 × 1024.
- One 128 × 128 logical sprite cell upscaled 8× with crisp 8 × 8 pixel blocks.
- Character 56–64 logical pixels tall, feet at logical y=108, centred horizontally.
- Fixed mildly elevated three-quarter isometric camera, facing down-right (south-east/east), upper-left light. Rotate the WHOLE body about 45° toward the viewer's right: near shoulder and hip forward, far side receding, chest foreshortened, feet staggered. Do not draw a front-facing torso with only the head turned.
- At most 12 opaque colours, about two flat shades per material; hard alpha only; no anti-aliasing, blur, gradients or dithering.
- No background, floor, shadow, scenery, effects, text, watermark, border or checkerboard.
- Exactly one sprite; no extra poses, weapons or accessories.

Return only the transparent base-pose PNG.
```

## Step 2 — animation atlas (after base approval)

```text
Create ONE production monster animation atlas for a dark-fantasy MMORPG. Image 1 is the approved Player animation atlas: match its view, scale, pixel-art rendering and 8×5 frame layout, but do not copy its identity or equipment. Image 2 is the approved static base pose for this species: preserve its identity, chibi proportions, face language, palette and camera. Do not use the painted mob icon shelf.

SPECIES
<Insert the completed Species block here.>

OUTPUT CONTRACT
- One transparent RGBA PNG.
- Match the Player atlas source canvas exactly: 1585 × 992 pixels, arranged as 8 columns × 5 rows. If the image generator returns a different size, record the actual dimensions in `meta.json` and keep the result in draft review; do not resize or promote it.
- The runtime frame canvas is 256 × 256 pixels with anchor (128,224), matching `player-animation-v2.json`. Record per-frame source bounds in `meta.json`; do not assume uniform 256-pixel source cells.
- All 40 cells occupied. No grid lines, labels or outer margins; keep at least 24 transparent pixels between each pose and every edge of its own cell, including below the feet.
- Draw at native pixel size with hard alpha edges: fully transparent or fully opaque pixels only. No anti-aliasing, soft alpha, blur, gradients, dithering or downsampling.
- At most 12 opaque colours total, with about two flat shades per material.
- Fixed mildly elevated three-quarter isometric camera and upper-left light for every frame. Keep the camera, projection and character scale fixed; change the facing by turning the whole body around its vertical axis. Torso, hips, limbs and feet must agree with the facing; a head-only turn is not a directional pose.
- Standing root anchor at local (128,224) in the 256 × 256 runtime frame. Keep the feet planted at that anchor in upright poses. The final death pose may lie low but must stay within its frame bounds.
- Match the Player atlas's visible sprite scale and keep the full silhouette inside its own cell, including weapons, tails, wings and ears. No pose may cross a cell edge, and the lowest foot pixel keeps clear space above the cell bottom so the feet are never cut by the frame crop.
- Preserve the same identity, scale, palette, equipment and camera in every frame.
- No shadows, floor, scenery, effects, trails, blood, text, watermark, borders, UI or checkerboard.

ROW ORDER
Row 0 — idle, eight distinct facings in this exact order: south (toward camera), south-east (toward camera-right), east (right-facing profile), north-east (away from camera-right), north (away from camera), north-west (away from camera-left), west (left-facing profile), south-west (toward camera-left). One neutral ready pose per facing. Match the Player's established game-direction convention. These are eight character facings under one fixed camera, not eight camera angles; diagonal views must be drawn as genuine whole-body diagonal facings, not rotated cardinal sprites.
Row 1 — one walk pose for each of the eight facings in the row order above. Use a species-appropriate gait and keep the root anchor stable.
Row 2 — one readable attack pose for each of the eight facings. Keep the weapon and equipment consistent with the facing.
Row 3 — one distinct hit-reaction pose for each of the eight facings. Feet stay planted in upright poses.
Row 4 — one defeated/death pose for each of the eight facings. Keep the body low and inside its cell.

This atlas contains 40 pose frames: 8 idle facings plus 32 action poses (walk, attack, hit and death in all eight facings). Each state has one pose per direction; do not add extra action frames.

## Step 2b — single-frame intake (required for all new animation)

Generate one pose per PNG and let `tools/monster-animation-compose.py` own the grid. A model that never draws a grid cannot bleed frames into each other; gutters then come from code, not from model obedience. Grid atlases (Step 2) remain valid only for in-flight drafts already under review.

Request 40 files named `000.png` … `039.png` in row-major order: idle, walk, attack, hit, death × south, south-east, east, north-east, north, north-west, west, south-west — or pass `--map` with an explicit index/action/direction list.

### Single-frame OUTPUT CONTRACT

- One transparent RGBA PNG per pose, exactly one connected opaque pose, hard alpha only (0 or 255, no semi-transparency), art clear of every source edge.
- Identical canvas size on all 40 frames; content boxes of upright poses share one ground line within tolerance (death poses are exempt).
- Content must fit the runtime cell minus the 24 px gutter on all sides (384 px cell → at most 336 × 336 above the ground anchor); the tool downscales by an integer factor with NEAREST only, never upscales, and rejects anything needing more than 4×.
- Feet planted at the declared anchor; do not resample, mirror or rearrange frames by hand — the tool places every content box bottom-centred on the anchor.

### Intake command

```powershell
python -B tools/monster-animation-compose.py --frames-dir <frames> --meta-base <base-meta.json> --out-dir art-reference/monsters/<race>/<species>/[<variant-id>/]
```

The tool fails closed (writes nothing) on any violation, writes `meta.json` + `atlas/animation-draft.png` as `draft-review`, then runs `monster-animation-qa.py` over the composed atlas. Promotion to `atlas/animation.png` and the game registry stays a human approval plus the existing runtime-repack path.

Every frame must be a real pose change, never a translated copy. Keep the weapon and equipment anatomically consistent. Return only the atlas PNG.
```

## Reject before saving

Reject the result and regenerate or revise if any of these fail:

- Canvas does not match the Player atlas's 1585 × 992 source canvas, or the 8 × 5 frame arrangement is unclear.
- The silhouette is not chibi (realistic proportions, small head, long limbs).
- The camera angle or projection changes between frames instead of keeping the fixed mildly elevated isometric view.
- An idle facing turns only the head, or a diagonal facing keeps the torso, hips, limbs or feet cardinal; the whole body must show the requested direction.
- The face is cute or loses the shared goblin-like facial language.
- The face is over-detailed (warts, wrinkles, pores, scars, extra lines) or the eyes do not read as glowing.
- The face lighting does not follow the upper-left highlight/shadow planes.
- The painted mob icon shelf or a third-party creature was used as identity.
- Any cell is empty, duplicated, or contains another pose fragment.
- A named variant has less than 24 transparent pixels between its visible alpha and any cell edge.
- A pose crosses into a neighboring frame or its source bounds cannot be recorded in `meta.json`.
- Any visible alpha is within 24 pixels of a cell edge, so the frame crop risks cutting the silhouette or pulling in a neighbour.
- Alpha has semi-transparent pixels.
- The root or ground line drifts between upright frames.
- Sprite scale differs materially from the Player atlas.
- Idle facings are not eight distinct directions.
- Any idle facing changes the camera angle instead of turning the character under the fixed camera.
- Diagonal idle facings are cardinal poses rotated or mirrored instead of distinct whole-body diagonal views.
- Any action row is missing one of the eight facings, duplicates another pose, or uses a mirrored cardinal pose as a diagonal.
- Colours exceed the palette budget or use gradients.
- Text, UI, shadows, scenery, grid lines, effects or extra equipment appear.

## Revision prompt

Use this only after the first atlas is otherwise correct:

```text
Edit Image 1. Preserve its exact canvas, all 40 frames, identity, scale, palette, camera, row order and transparent alpha. Change only <the single named defect>. Keep every other frame unchanged. The corrected frame must stay inside its own source bounds and keep the same logical frame canvas (256 × 256) and ground anchor (128,224). Preserve the idle/attack/hit/death pose contract. Do not add or remove frames, do not resample, and do not add text, effects, shadows or a background. Return only the corrected transparent atlas.
```

## Output placement

```text
art-reference/monsters/<race>/<species>/animation/
  source/base.png          approved static base (128×128, feet at y=108)
  source/base-v*.png       optional raw generations
  meta.json
  atlas/animation-draft.png generated atlas while it is under review
  atlas/animation.png      only after the base and atlas are approved
```

Set `meta.json` to the actual dimensions, frame size, anchor and status. Use `base-approved` until the atlas exists. Species-level baselines stay under `<race>/<species>/animation/`. Named gameplay variants use `<race>/<species>/variants/<variant-id>/v<k>/meta.json` and `<race>/<species>/variants/<variant-id>/v<k>/atlas/animation-draft.png`. Each new candidate opens a new `v<k>/` folder; never overwrite a shipped version.

## Example species lines

These examples are starting points only. Fill a complete, species-specific block for every target in the roster before generating that species.

- **Spear Goblin:** “Compact upright goblin; head about one-third of visible height, pointed ears and short sturdy limbs. Hold one clear spear. Attack with a short forward thrust.”
- **Stone Golem:** “Broad stone torso and shoulders; head about one-fifth to one-quarter of visible height, set between the shoulders. Use a few large stone shapes. Attack with a heavy downward stone-fist slam.”
- **Skeleton with Sword & Shield:** “Thin skeleton; skull about one-quarter to one-third of visible height, with separated ribs and limbs. Keep one sword and one shield distinct. Attack with a short sword slash while the shield guards the body.”
- **Little Demon:** “Compact demon; head about one-third to two-fifths of visible height. Use small horns and wings to define its silhouette. Attack with a quick claw swipe.”

The ratios refer to visible character height, not the 128-pixel cell. Use the reference for visual language only; do not use the mob icon shelf as a character reference. Apply the shared Face language above; the approved Ogre base (`art-reference/monsters/humanoid/ogre/animation/source/base-v2.png`) is the facial reference.
