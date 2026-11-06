# Mob pose status

**Updated:** 2026-11-06

**Coverage is complete:** all 36 species have 136/136 canonical 8-direction slots (4,896/4,896), with no missing PNGs or sidecars. `candidate-review` counts toward coverage, not visual approval or atlas promotion. Do not extend the grandfathered 16-direction sets.

The inventory reports metadata/path differences for `undead/bonehound`, `undead/revenant` and `undead/wraith`, plus extra east/west attack phases for `beast/harpy` and `undead/wraith`. These do not change target-slot coverage; check their manifests before changing paths or files.

**Anti-duplication claim:** `/root` owns `beast/werewolf` as the first regeneration target. Its 136 source slots were reviewed at full resolution; no PNG has been changed or approved. Keep the claim until this species' candidate review is recorded.

**Grade-4 source screen:** 20/25 complete: 12 species need no visual correction; 8 have specific fixes in the table; 5 remain.

## Per-species fixes

`P` = passes the composer per-frame check, `A` = rejected for soft alpha, `D` = rejected for multiple disconnected poses. `D` is measured only after hard-alpha frames pass. Each row totals 136. The exact check found 954 pass, 3,898 alpha failures, 44 disconnected-pose failures and no edge-touch failures. This is the per-frame source gate; full compose and atlas QA remain pending regenerated candidates.

| Species | Grade | Visual fix or next review | Composer gate |
| ------- | -----: | ------------------------- | ------------- |
| `beast/harpy` | 4 | Full-res screen complete; eight headings and action sequences read clearly. Reconcile extra east/west attack phases against the manifest. | P0 A136 D0 |
| `beast/werewolf` | 3 | Replace mixed biped/quadruped action views with one consistent werewolf form; correct reused headings in walk/attack/hit/death and frontal idle views. | P0 A136 D0 |
| `beast/wolf` | 4 | Replace east/west side-view cells across idle and actions: they are visibly smaller, flatter and lower-detail than the other headings. Other direction sequence reads clearly. | P57 A79 D0 |
| `demon/demon` | 4 | Brighten/separate detail in dark side/back views; vary repeated near-identical attack/hit/death silhouettes across headings. | P0 A136 D0 |
| `demon/imp` | 4 | Regenerate east idle and action cells: they contain tiny multi-pose fragments, not one readable sprite. Replace the low-detail west-facing art to match the other headings. | P128 A2 D6 |
| `dragon/dragon` | 3 | Regenerate front-facing idle headings; make action views distinct across headings instead of reusing a small set. | P19 A117 D0 |
| `dragon/mirehydra` | 3 | Regenerate front-facing idle and repeated neighboring action views; stabilize death-frame silhouette size. | P0 A136 D0 |
| `dragon/wyrmling` | 4 | Full-res screen complete; headings and action sequences read clearly, with no specific source-frame correction. | P0 A136 D0 |
| `dragon/wyvern` | 4 | Full-res screen complete; headings, wing silhouettes and action sequences read clearly, with no specific source-frame correction. | P0 A136 D0 |
| `elemental/golem` | 3 | Regenerate idle headings to show their exact directions; action views remain under review. | P73 A63 D0 |
| `elemental/slaggolem` | 4 | Fix death phase `03-settle`: most headings end as tiny upright sprites while east/west lie down as large silhouettes. Make the final collapse consistent across headings. | P136 A0 D0 |
| `elemental/wisp` | 4 | Full-res screen complete; swirl headings, effect phases and collapse sequence read clearly, with no specific source-frame correction. | P0 A136 D0 |
| `fish/siren` | 4 | Regenerate all 32 east-facing slots (idle plus 4 phases for each action): they are tiny, pixelated and fragmented instead of one full-size sprite. | P9 A96 D31 |
| `formless/ooze` | 4 | Full-res screen complete; heading silhouettes and action/death phases read clearly, with no specific source-frame correction. | P136 A0 D0 |
| `formless/slime` | 3 | Regenerate front-facing idle headings; remove or attach detached attack droplets. | P0 A136 D0 |
| `humanoid/elf` | 4 | Regenerate all 32 east-facing slots: the current figure is tiny, pixelated and mismatched in detail from the other headings. | P0 A136 D0 |
| `humanoid/giant` | 3 | Regenerate front-facing idle headings; action views remain under review. | P0 A136 D0 |
| `humanoid/goblin` | 4 | Full-res screen complete; headings and action sequences read clearly, with no specific source-frame correction. | P0 A136 D0 |
| `humanoid/human` | 3 | Regenerate front-facing idle headings; action views remain under review. | P0 A136 D0 |
| `humanoid/kobold` | 4 | Full-res screen complete; headings and action sequences read clearly, with no specific source-frame correction. | P0 A136 D0 |
| `humanoid/lizardman` | 4 | Full-res screen complete; tail, scale silhouette, headings and action sequence read clearly, with no specific source-frame correction. | P0 A136 D0 |
| `humanoid/minotaur` | 4 | Full-res screen complete; horns, axe, headings and action sequence read clearly, with no specific source-frame correction. | P0 A136 D0 |
| `humanoid/ogre` | 3 | Regenerate front-facing idle headings; distinguish action views for nearby headings. | P93 A43 D0 |
| `humanoid/orc` | 4 | Full-res screen complete; armor, axe, headings and action sequence read clearly, with no specific source-frame correction. | P0 A136 D0 |
| `humanoid/troll` | 3 | Regenerate front-facing idle headings; action views remain under review. | P94 A42 D0 |
| `insect/beetle` | 4 | Screen found no direction/sequence defect. Remove detached second poses in `idle/north-east/north-east.png`, `walk/east/01-stride-b.png`, `attack/east/02-follow-through.png`, `death/east/02-ground.png`, `death/east/03-settle.png` and `death/west/01-collapse.png`. | P34 A96 D6 |
| `insect/hornet` | 4 | Screen found no directional/sequence defect. Regenerate detached second pose in `attack/west/01-contact.png`. | P39 A96 D1 |
| `insect/spider` | 3 | Regenerate front-facing idle headings; action views remain under review. | P0 A136 D0 |
| `plant/dryad` | 4 | Full-res screen complete; leafy silhouette, heading changes and action/death sequences read clearly, with no specific source-frame correction. | P0 A136 D0 |
| `plant/treant` | 4 | Full-res screen complete; headings and idle/walk/attack/hit/death sequences read clearly, with no specific source-frame correction. | P0 A136 D0 |
| `undead/bonehound` | 4 | Full-res screen; overview found no specific frame defect. Check its manifest/path differences before editing. | P0 A136 D0 |
| `undead/mummy` | 3 | Regenerate front-facing idle; restore distinct views for all eight headings across actions currently reduced to east/west profiles. | P0 A136 D0 |
| `undead/revenant` | 4 | Full-res screen; overview found no specific frame defect. Check its manifest/path differences before editing. | P136 A0 D0 |
| `undead/skeleton` | 4 | Full-res screen; overview found no specific frame defect. | P0 A136 D0 |
| `undead/vampire` | 4 | Full-res screen; overview found no specific frame defect. | P0 A136 D0 |
| `undead/wraith` | 4 | Full-res screen; overview found no specific frame defect. Check manifest/path differences and extra east/west attack phases before editing. | P0 A136 D0 |

All regenerated frames stay `candidate-review` until exact facing, identity, action sequence, alpha and anchor pass. The 447 coverage-only directional duplicates also remain `candidate-review`; coverage is not approval.



