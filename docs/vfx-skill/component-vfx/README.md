# Reusable VFX components

Use one of the 29 registered source shapes, choose any of the seven palettes, then assemble layers through the existing `meta.json` and `additionalLayers` fields. Production `AtlasFrame` desaturates the neutral sources and applies the selected palette without changing alpha, anchors or geometry. Native verification and human approval are tracked separately below.

All component and demonstration versions are non-default. Mechanical verification and human visual approval are tracked separately in the [execution plan](../../plan/vfx-component-library.html).

## Choosing a shape

| Shape | Family | Placement / size | Registered master |
| --- | --- | --- | --- |
| `ground-fill` | `ground-fill` | ground / footprint | [attack.firestorm v4](../../../game/public/fx/skill-pool/attack-fire/attack-firestorm/v4/ground-fill.png) |
| `ground-edge` | `ground-edge` | ground / footprint | [attack.cinder_nova v2](../../../game/public/fx/skill-pool/attack-fire/attack-cinder-nova/v2/ground-edge.png) |
| `ground-residue` | `ground-residue` | ground / footprint | [attack.firestorm v4](../../../game/public/fx/skill-pool/attack-fire/attack-firestorm/v4/ground-residue.png) |
| `projectile-core` | `projectile-core` | billboard / body | [attack.fireball v3](../../../game/public/fx/skill-pool/attack-fire/attack-fireball/v3/projectile-core.png) |
| `ribbon-beam` | `ribbon-beam` | billboard / world | [attack.void_ray v2](../../../game/public/fx/skill-pool/attack-chaos/attack-void-ray/v2/ribbon-beam.png) |
| `slash-sweep` | `slash-sweep` | billboard / world | [attack.cleave v3](../../../game/public/fx/skill-pool/attack-phy/attack-cleave/v3/slash-sweep.png) |
| `impact-burst` | `impact-burst` | billboard / body | [attack.fireball v3](../../../game/public/fx/skill-pool/attack-fire/attack-fireball/v3/impact-burst.png) |
| `column-eruption` | `column-eruption` | billboard / world | [attack.fissure v2](../../../game/public/fx/skill-pool/attack-earth/attack-fissure/v2/column-eruption.png) |
| `vortex` | `vortex` | billboard / world | [attack.firestorm v4](../../../game/public/fx/skill-pool/attack-fire/attack-firestorm/v4/vortex.png) |
| `cloud-mist` | `cloud-mist` | billboard / world | [attack.blizzard v7](../../../game/public/fx/skill-pool/attack-cold/attack-blizzard/v7/cloud-mist.png) |
| `mote` | `mote` | billboard / body | [heal.heal v2](../../../game/public/fx/skill-pool/heal/heal-heal/v2/mote.png) |
| `fragment-debris` | `fragment-debris` | billboard / body | [attack.blizzard v7](../../../game/public/fx/skill-pool/attack-cold/attack-blizzard/v7/fragment-debris.png) |
| `ward-shell` | `ward-shell` | billboard / body | [buff.flame_guard v2](../../../game/public/fx/skill-pool/buff/buff-flame-guard/v2/ward-shell.png) |
| `mark-sigil` | `mark-sigil` | billboard / body | [curse.jinx v2](../../../game/public/fx/skill-pool/curse/curse-jinx/v2/mark-sigil.png) |
| `crack-strip` | `ground-residue` | ground / footprint | [attack.fissure v4](../../../game/public/fx/skill-pool/attack-earth/attack-fissure/v4/crack-strip.png) |
| `stone-spike` | `column-eruption` | billboard / world | [attack.stone_spike v2](../../../game/public/fx/skill-pool/attack-earth/attack-stone-spike/v2/stone-spike.png) |
| `wave-crest` | `ribbon-beam` | billboard / world | [attack.tidal_wave v2](../../../game/public/fx/skill-pool/attack-cold/attack-tidal-wave/v2/wave-crest.png) |
| `arrow-core` | `projectile-core` | billboard / body | [attack.piercing_shot v2](../../../game/public/fx/skill-pool/attack-phy/attack-piercing-shot/v2/arrow-core.png) |
| `orb-core` | `projectile-core` | billboard / body | [attack.water_ball v2](../../../game/public/fx/skill-pool/attack-cold/attack-water-ball/v2/orb-core.png) |
| `rock-core` | `projectile-core` | billboard / body | [attack.meteor v3](../../../game/public/fx/skill-pool/attack-fire/attack-meteor/v3/rock-core.png) |
| `forked-bolt` | `ribbon-beam` | billboard / world | [attack.thunder_strike v2](../../../game/public/fx/skill-pool/attack-lightning/attack-thunder-strike/v2/forked-bolt.png) |
| `ground-spiral` | `ground-fill` | ground / footprint | [attack.entropy_well v2](../../../game/public/fx/skill-pool/attack-chaos/attack-entropy-well/v2/ground-spiral.png) |
| `cone-stream` | `cloud-mist` | ground / committed cone | [attack.cleave v5](../../../game/public/fx/skill-pool/attack-phy/attack-cleave/v5/cone-stream.png) |
| `wall-segment` | `column-eruption` | upright / line-series | [attack.fissure v6](../../../game/public/fx/skill-pool/attack-earth/attack-fissure/v6/wall-segment.png) |
| `tether-strand` | `ribbon-beam` | sampled hand to target / world thickness | [curse.jinx v4](../../../game/public/fx/skill-pool/curse/curse-jinx/v4/tether-strand.png) |
| `shockwave-ring` | `ground-edge` | ground / expanding footprint | [attack.frost_nova v2](../../../game/public/fx/skill-pool/attack-cold/attack-frost-nova/v2/shockwave-ring.png) |
| `crescent-wave` | `projectile-core` | billboard / body projectile | [attack.piercing_shot v4](../../../game/public/fx/skill-pool/attack-phy/attack-piercing-shot/v4/crescent-wave.png) |
| `shield-dome` | `ward-shell` | upright / caster footprint root | [buff.flame_guard v4](../../../game/public/fx/skill-pool/buff/buff-flame-guard/v4/shield-dome.png) |
| `bind-strand` | `mark-sigil` | billboard / sampled target body | [curse.venom_bind v2](../../../game/public/fx/skill-pool/curse/curse-venom-bind/v2/bind-strand.png) |

## Palette selection

Every shape supports every row below, including combinations unused by the current owner skill. A palette is a visual choice and does not change the gameplay element.

| Palette | Dark to highlight stops |
| --- | --- |
| `fire` | `#23120b` ? `#ba310a` ? `#ff9d14` ? `#fff8c2` |
| `cold` | `#0b1e33` ? `#176da3` ? `#69dfff` ? `#f0ffff` |
| `lightning` | `#262008` ? `#b57d10` ? `#ffdf52` ? `#ffffe8` |
| `earth` | `#1e1a11` ? `#755328` ? `#c29a53` ? `#eee0b9` |
| `poison` | `#0a2411` ? `#29882e` ? `#a0ee46` ? `#efffd2` |
| `chaos` | `#190d2d` ? `#7525a6` ? `#d56bff` ? `#fff0ff` |
| `physical` | `#151d25` ? `#6d8292` ? `#c2d1d8` ? `#ffffff` |

## Assembly rules

- Copy ingredient PNGs into the new skill version directory; reference local filenames in `additionalLayers`. Keep each `layerId` unique, including repeated uses of one image.
- Ground ingredients use `projection: "ground"` and committed-footprint sizing. Directional line textures opt into `orient: true`; do not bake camera tilt into the source.
- Upright ingredients use body or authored world size. Bind roots explicitly to area, caster, target, contact or the existing release/socket point.
- Use `phases`, `delaySec` and `durationSec` for presentation timing. They do not create impacts, targets or damage.
- Optional `placement` supports `line-series` (spacingM, staggerSec), `line-front` (durationSec on the layer), `spin` (cycleSec), and `orbit` (cycleSec, radiusM). Offsets stay in world metres and reduced motion preserves contact/coverage.
- `tether` placement spans the sampled hand and target through the shared projection. It keeps authored world thickness, falls back to committed endpoints if an actor is missing, and hides coincident endpoints. `expand` uses `fromScale` in (0, 1] and layer `durationSec`; it scales around the stable root and shows final coverage in reduced motion.
- Horizontal cone material uses ground projection and `orient: true`. Upright wall segments remain screen-facing; their roots follow the committed line. Target/caster bindings use sampled actors when available. The dome is a translucent overlay; it does not implement a collision or 3D occlusion shell.
- Existing committed projectile, fan, volley, homing, chain, channel and rain producers remain authoritative. Do not invent duplicate gameplay trajectories or consume gameplay RNG.
- Additional layers do not inherit a parent rain or placement mode unless they declare it. Single-frame fragments stay inside their source frame.
- Follow [camera and registration](../shared/angle-authoring.md) and preserve default pointers until human approval.

## Demonstration versions

| Skill | Version | Ingredients |
| --- | --- | --- |
| `attack.firestorm` | [v5](../../../game/public/fx/skill-pool/attack-fire/attack-firestorm/v5/meta.json) | animated base + ground-fill, vortex, mote |
| `attack.fireball` | [v4](../../../game/public/fx/skill-pool/attack-fire/attack-fireball/v4/meta.json) | animated base + projectile-core, ribbon-beam, impact-burst |
| `attack.cinder_nova` | [v3](../../../game/public/fx/skill-pool/attack-fire/attack-cinder-nova/v3/meta.json) | animated base + ground-fill, ground-edge, mote, ground-residue |
| `attack.blizzard` | [v8](../../../game/public/fx/skill-pool/attack-cold/attack-blizzard/v8/meta.json) | animated base + cloud-mist, fragment-debris, ground-edge |
| `attack.cleave` | [v4](../../../game/public/fx/skill-pool/attack-phy/attack-cleave/v4/meta.json) | animated base + slash-sweep, ground-edge, impact-burst |
| `attack.fissure` | [v3](../../../game/public/fx/skill-pool/attack-earth/attack-fissure/v3/meta.json) | animated base + ground-fill, column-eruption, fragment-debris |
| `attack.chain_lightning` | [v2](../../../game/public/fx/skill-pool/attack-lightning/attack-chain-lightning/v2/meta.json) | animated base + ribbon-beam, impact-burst |
| `attack.void_ray` | [v3](../../../game/public/fx/skill-pool/attack-chaos/attack-void-ray/v3/meta.json) | ground base + ribbon-beam, impact-burst (Channel-compatible) |
| `heal.heal` | [v3](../../../game/public/fx/skill-pool/heal/heal-heal/v3/meta.json) | animated base + mote, ground-edge |
| `buff.flame_guard` | [v3](../../../game/public/fx/skill-pool/buff/buff-flame-guard/v3/meta.json) | animated base + ward-shell, mote |
| `curse.jinx` | [v3](../../../game/public/fx/skill-pool/curse/curse-jinx/v3/meta.json) | animated base + mark-sigil, cloud-mist |
| `aura.grace` | [v2](../../../game/public/fx/skill-pool/aura/aura-grace/v2/meta.json) | animated base + ground-edge, mote |
| `attack.fissure` | [v5](../../../game/public/fx/skill-pool/attack-earth/attack-fissure/v5/meta.json) | crack-strip, stone-spike, fragment-debris, cloud-mist |
| `attack.stone_spike` | [v3](../../../game/public/fx/skill-pool/attack-earth/attack-stone-spike/v3/meta.json) | stone-spike, impact-burst, fragment-debris |
| `attack.tidal_wave` | [v3](../../../game/public/fx/skill-pool/attack-cold/attack-tidal-wave/v3/meta.json) | wave-crest, cloud-mist |
| `attack.piercing_shot` | [v3](../../../game/public/fx/skill-pool/attack-phy/attack-piercing-shot/v3/meta.json) | arrow-core, impact-burst |
| `attack.water_ball` | [v3](../../../game/public/fx/skill-pool/attack-cold/attack-water-ball/v3/meta.json) | orb-core, impact-burst |
| `attack.meteor` | [v4](../../../game/public/fx/skill-pool/attack-fire/attack-meteor/v4/meta.json) | rock-core, impact-burst, ground-residue, ground-fill |
| `attack.thunder_strike` | [v3](../../../game/public/fx/skill-pool/attack-lightning/attack-thunder-strike/v3/meta.json) | forked-bolt, impact-burst |
| `attack.entropy_well` | [v3](../../../game/public/fx/skill-pool/attack-chaos/attack-entropy-well/v3/meta.json) | ground-spiral, cloud-mist, mote |
| `attack.arrow_shower` | [v5](../../../game/public/fx/skill-pool/attack-phy/attack-arrow-shower/v5/meta.json) | arrow-core, impact-burst |
| `attack.split_shot` | [v2](../../../game/public/fx/skill-pool/attack-phy/attack-split-shot/v2/meta.json) | arrow-core, impact-burst |
| `attack.double_strafe` | [v2](../../../game/public/fx/skill-pool/attack-phy/attack-double-strafe/v2/meta.json) | arrow-core, impact-burst |
| `attack.void_orb` | [v2](../../../game/public/fx/skill-pool/attack-chaos/attack-void-orb/v2/meta.json) | orb-core, impact-burst |
| `attack.whirlwind` | [v3](../../../game/public/fx/skill-pool/attack-phy/attack-whirlwind/v3/meta.json) | slash-sweep, ground-edge, mote |
| `buff.enchant_poison` | [v2](../../../game/public/fx/skill-pool/buff/buff-enchant-poison/v2/meta.json) | ribbon-beam, mote |

The [139-skill coverage map](coverage.md) separates published component recipes from remaining adoption gaps. A gap does not imply that an existing whole-skill effect is absent.

## Sources and review

The [seven additional source shapes](outputs/library-v3/README.md) now have non-default runtime masters listed above. All 203 shape/palette combinations have accepted native captures. The dome fixture freezes its displayed frame through the native timeline; using Pause instead could jump beyond the activation. The engine-agreement test imports the same tool bridge through Vitest and passes 15/15. Ray composition retains its ground source and both channel layers, with all five elevations and three zooms verified. The full suite completed: 265 files / 2613 tests passed; only three known baseline files failed. The native matrix stopped at 21/165 camera records because Meteor v4's Impact-only contact layer does not render during Field. Field recipe phase auditing and remaining camera/recipe checks stay open in the execution plan; human visual approval remains separate.

- [Original fourteen prompts and native source images](outputs/library-v1/generation-prompts.json)
- [Eight extension prompts and native source images](outputs/library-v2/generation-prompts.json)
- Each master version has measured `qa.json`; `humanReview: false` is not approval.
- [Palette captures](evidence/captures/palettes/) contain all 203 shape/element images; [recipe captures](evidence/captures/recipes/) and the [probe capture](evidence/captures/vfx-probe.png) preserve native scene reviews. Use the field showcase version selector at 1920 x 1080 for human review.
- [Tools and commands](tools/README.md), [evidence manifests](evidence/manifests/) and [historical gate logs](evidence/logs/) now live with this library and are tracked in Git, following the user's 2026-11-10 request. Unrelated caches remain under `.cache`.
