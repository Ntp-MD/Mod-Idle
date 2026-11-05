# Mob pose completion

**Goal:** all 36 species reach 272/272 canonical source slots against the Goblin mold: 16 idle slots and 64 each for walk, attack, hit and death.

Inventory snapshot: 2026-11-04. Refresh with `python -B tools/monster-animation-v5-inventory.py`. Exact missing slots are in each species' `animation/missing-poses.json`, where present.

Canonical pose PNGs count toward coverage; draft files do not. `candidate-review` frames count toward 272/272 but are not approved. Slot coverage, visual approval and atlas promotion are separate.

## Priority 1 - Every mob reaches 272/272

Work on one species at a time, starting with the smallest current gap. Finish that species at 272/272 and refresh the inventory before moving to the next. The active target is `plant/dryad`; `beast/harpy` and `beast/werewolf` follow in that order.

The built-in image generator has reached the team-plan `HTTP 429 usage_limit_reached` limit while Dryad is in progress. Resume Dryad after quota reset; do not move to Harpy before Dryad reaches 272/272.

- [ ] `plant/dryad` - 172/272; 100 missing (active; +72 candidate-review slots)
- [x] `insect/beetle` - 272/272
- [ ] `beast/harpy` - 74/272; 198 missing (next)
- [ ] `beast/werewolf` - 64/272; 208 missing (queued)
- [ ] `beast/wolf` - 51/272; 221 missing
- [ ] `demon/imp` - 48/272; 224 missing
- [ ] `dragon/dragon` - 48/272; 224 missing
- [ ] `dragon/mirehydra` - 48/272; 224 missing
- [ ] `dragon/wyrmling` - 48/272; 224 missing
- [ ] `dragon/wyvern` - 48/272; 224 missing
- [ ] `humanoid/giant` - 48/272; 224 missing
- [ ] `humanoid/orc` - 48/272; 224 missing
- [ ] `plant/treant` - 41/272; 231 missing
- [ ] `fish/siren` - 40/272; 232 missing
- [ ] `humanoid/elf` - 40/272; 232 missing
- [ ] `undead/mummy` - 40/272; 232 missing
- [ ] `undead/bonehound` - 40/40 under the former draft spec; full 272-slot inventory needed
- [ ] `undead/revenant` - 40/40 under the former draft spec; full 272-slot inventory needed

Already at 272/272 (19): `humanoid/human`, `humanoid/kobold`, `humanoid/lizardman`, `humanoid/goblin`, `elemental/golem`, `humanoid/minotaur`, `demon/demon`, `undead/skeleton`, `undead/vampire`, `undead/wraith`, `formless/slime`, `insect/spider`, `humanoid/ogre`, `humanoid/troll`, `elemental/slaggolem`, `formless/ooze`, `elemental/wisp`, `insect/hornet`, `insect/beetle`.

## Priority 2 - Review follow-up

Start this pass after every species reaches 272/272. Review candidates before approval or atlas promotion.

- **Goblin:** Normalize its 232 candidate poses to the 384 x 384 canvas and (192, 288) anchor. Check scale, facing and sequence; semi-transparent alpha still needs the hard-alpha QA. Contact sheets alone are inconclusive because they shrink canvases.
- **Beetle:** Exact direction and phase mapping remain unverified across the generated candidates; its death poses read mostly upright. Review facing, stride/collapse, scale, anchor and edge alpha.
- **Dryad:** The current attack sheet has repeated facings and an edge halo. Review exact direction, phase, scale, alpha and anchor before approval.
- **Human:** The 64 walk candidates lack clear alternating steps; the east/west legacy walks also lose and regain the held object. Normalize the south opposite-stride draft and review the full loop. Generated near-north idle poses need exact-facing review; eight legacy idle poses passed.
- **Kobold and Lizardman:** Eight legacy idle poses passed. Generated intermediate idles remain on hold for identity differences; review the full direction sets and atlases.
- **Golem:** Generated idle candidates have uncertain facing and semi-transparent alpha. Check south attack windup scale, anchor and phase order against contact frames.
- **Minotaur:** Review the shrinking south/east death settles, weapon continuity, idle facing and alpha, and axe shape in the north-west direction.
- **Demon:** In 13 directions, contact and follow-through candidates duplicate the windup crop. Review those sequences against the directional grids; 153 sidecars also need their recorded phase origin checked.
- **Skeleton:** Review poses that appear to show an extra shield, including north-west and recovery frames. A one-shield west recovery draft is available for comparison.
- **Spider:** The south attack contact is visible but smaller and higher than adjacent frames. Generated idles are shorter (81-90 px vs. 122-134 px), and the north-west pose may face the wrong way. Identity remains unverified because `reference.png` is absent.
- **Vampire:** Check generated idle scale (about 184 px vs. 159-165 px for legacy directions), attack identity (orb cast vs. claw strike), death `03-settle` scale and east/west hit scale.
- **Wraith:** Review the 16 east/west walk and attack candidates. South death `03-settle` is an intentional dissipating remnant; keep its approval unless full-sequence review finds a defect.
- **Slime:** Review north walk frame 02 for an eye-like edge and check loop timing. Normalize the alternate stride drafts before comparing them.
- **All remaining candidates:** Check identity, exact facing, phase order, alpha, scale, anchor and atlas. Source completion alone does not approve frames or promote runtime atlases.
