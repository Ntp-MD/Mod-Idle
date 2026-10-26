# Authored skill VFX production

Current user instruction: generate and integrate replacements for all live player skills. All 77 live player skills now have authored VFX, including Meteor and the 18 continuous auras. Selected sources and runtime paths for the additional batches are recorded in `generated/skill-batch-2026-10-25.json` and `generated/remaining-skills-batch.json`. Individual skill approval is not required for these batches. Fireball was already approved individually.

The batch covers Fireball, Frostbite, Ground Slam, Headshot, Ice Lance, Impale, Overload, Pierce the Veil, Piercing Shot, Poison Bolt, Puncture, Reap, Ruin, Sand Storm, Shatter, Shield Bash, Sidestep, Skull Crack, Spark, Thunder Strike, Venom Spray, Void Blast and Whirlwind.

Gameplay behavior belongs to `tools/data/skills.json`. Authored VFX consumes action timing, delivery, origin and area; it does not invent hits or change damage.

## Spatial art direction — applies to every skill

The current art replacement pack is [generated/spatial-v2/README.md](generated/spatial-v2/README.md), with per-skill source art, prompts, measured rectangles and QA. Its fourteen replacements are active through additive runtime overrides; the original batch presets and PNGs remain available through `LEGACY_AUTHORED_VFX`. Its roster review covers all live player skills. Combat behavior remains owned by canonical data and the combat implementation.

The user's scale reference is a player or mob approximately **0.5 meters wide**. Use a stable idle silhouette as the presentation footprint; attack poses, extended weapons and VFX do not change its scale. This is a presentation reference; gameplay targeting and body mechanics remain owned by canonical data and the engine.

Before generating or revising a skill, read its canonical delivery, origin, range, area radius and timing. Plan the assembled effect in meters and compare it with the actor ruler: a radius of 3 meters gives a diameter of 6 meters, approximately 12 actor-body widths. A radius is never a diameter. Read the behavior constraints in `docs/game-rules.md`; target counts do not specify the number of visible particles or falling objects.

The assembled VFX must communicate the skill's full spatial action. Use the cast's frozen `SkillAreaSnapshot` and the arena ground projection for its center, orientation and extent. An area effect must visibly occupy its actual footprint, including empty ground between enemies. Distribution follows the area rather than the list of hit actors. A single enlarged stamp at the primary enemy does not establish area coverage. Resolve any mismatch between the actor ruler and the arena's meter projection explicitly before approving scale; increasing one sprite's size alone is insufficient.

- **Meteor:** a rain of multiple meteors descending from above with staggered arrivals and distinct impact points spread throughout the committed area. Show the area being bombarded, including its outer portions. Each meteor is one component of the whole shower; one comet centered on one enemy does not satisfy this direction.
- **Blizzard:** a sustained snow-and-ice storm with multiple falling ice elements, wind/snow motion and distributed ground impacts across the committed area. Preserve visible space between particles so actors and the storm's extent remain readable. One diagonal ice projectile or one burst on an enemy does not satisfy this direction.
- **Other skills:** derive the composition from their action. Rain/storm skills distribute moving elements throughout an area; ground bursts and novas expand across their footprint; sweeps and cones reveal their direction and spread; projectiles show their path and impact; self effects and auras follow their caster and intended ground plane. Preserve each skill's distinct identity.

Generation briefs must include the current chibi player and mob style references, the 0.5-meter actor ruler, the skill's meter dimensions, the projected footprint and the planned motion/composition. Generate separable fall, flight, impact or field components when the composition needs them; the atlas is source art for the assembled effect. Match the actors' crisp silhouettes and pixel clusters while keeping luminous cores readable.

Acceptance requires inspecting the complete animation with actual player/mob sprites in the integrated arena at the viewport specified by `AGENTS.md`. Check the actor-to-area size ratio, perspective, center-to-edge coverage, arrival timing, overlap and readability. A contact sheet or isolated effect preview alone cannot approve spatial scale. Cosmetic particles and staggered impacts consume the existing action's timing and add no gameplay hits. Reduced motion must retain a visible indication of the same area.

Each asset is first-party, generated separately with the built-in image generator. Store prompt, raw and QA under `generated/<skill-slug>-batch-v1/`; stage runtime art and explicit source rectangles under `game/public/fx/authored/<skill-slug>/batch-v1/`. Runtime activation is controlled by `arena-authored-vfx.ts`.

Check real alpha, readable distinct silhouettes, consistent anchors and no visible content in cell gutters. The renderer explicitly discards alpha <=8/255 to remove generation noise; retain the original PNG and report raw alpha separately. `python tools/check-authored-vfx.py --write` finds empty separator scanlines above that threshold, rejects visible art at the atlas perimeter, and adds 64 pixels of virtual padding around source cells. Each source rectangle comes from actual image dimensions, never an assumed 256-pixel grid. Inspect motion and the integrated arena before handoff.

Aura atlases use all 16 frames as a continuous loop while enabled, independent of cast duration. `ArenaGroundAura.svelte` combines their texture with circular geometry using the presentation-only `groundAuraFootprint` in both the arena and preview. Its center follows the sampled actor's feet; its level ellipse matches the painted camera independently of facing and gameplay area geometry. Reduced motion holds a visible frame. Authored replacements suppress legacy supplemental skill art and actor marks; mob skills without authored replacements keep their existing effects.

The production roster records progress. Agents must preserve existing effects for skills outside this requested set.
