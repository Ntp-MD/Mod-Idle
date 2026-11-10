# Component coverage

Roster: 90 live player skills + 49 live mob skills = 139 rows.

`recipe` names a packaged component version; `gap` means no component recipe has been published for that skill. Existing whole-skill artwork may still exist. Suggested ingredients are candidates for composition, not finished or visually approved recipes. Geometry and delivery below come from the roster; actor-bound support has no authored area.

| Owner | Skill | Shape | Delivery | Recipe / disposition | Ingredients or suggested reuse |
| --- | --- | --- | --- | --- | --- |
| player | `attack.fireball` | single | projectile | recipe v4 (hybrid) | projectile-core, ribbon-beam, impact-burst |
| player | `attack.firestorm` | circle | ground | recipe v5 (hybrid) | ground-fill, vortex, mote |
| player | `attack.meteor` | circle | ground | recipe v4 (component-only) | rock-core, impact-burst, ground-residue, ground-fill |
| player | `attack.ice_lance` | single | projectile | gap | projectile-core / arrow-core / orb-core, impact-burst |
| player | `attack.blizzard` | circle | ground | recipe v8 (hybrid) | cloud-mist, fragment-debris, ground-edge |
| player | `attack.frostbite` | single | instant | gap | impact-burst, mark-sigil |
| player | `attack.chain_lightning` | circle | instant | recipe v2 (hybrid) | ribbon-beam, impact-burst |
| player | `attack.spark` | circle | projectile | gap | projectile-core / arrow-core / orb-core, impact-burst |
| player | `attack.thunder_strike` | single | ground | recipe v3 (component-only) | forked-bolt, impact-burst |
| player | `attack.poison_bolt` | single | projectile | gap | projectile-core / arrow-core / orb-core, impact-burst |
| player | `attack.acid_arrow` | single | projectile | gap | projectile-core / arrow-core / orb-core, impact-burst |
| player | `attack.chaos_bolt` | single | projectile | gap | projectile-core / arrow-core / orb-core, impact-burst |
| player | `attack.void_blast` | circle | ground | gap | ground-fill, ground-edge, cloud-mist |
| player | `attack.sand_storm` | circle | ground | gap | ground-fill, ground-edge, cloud-mist |
| player | `attack.earth_splitter` | single | ground | gap | impact-burst, mark-sigil |
| player | `attack.backstab` | single | melee | gap | slash-sweep, impact-burst, fragment-debris |
| player | `attack.impale` | line | melee | gap | ribbon-beam, crack-strip, impact-burst |
| player | `attack.skull_crack` | single | melee | gap | slash-sweep, impact-burst, fragment-debris |
| player | `attack.ground_slam` | circle | melee | gap | slash-sweep, impact-burst, fragment-debris |
| player | `attack.cleave` | cone | melee | recipe v4 (hybrid); master v5 | slash-sweep, ground-edge, impact-burst; cone-stream |
| player | `attack.elemental_break` | single | melee | gap | slash-sweep, impact-burst, fragment-debris |
| player | `attack.whirlwind` | circle | melee | recipe v3 (component-only) | slash-sweep, ground-edge, mote |
| player | `attack.shield_bash` | single | melee | gap | slash-sweep, impact-burst, fragment-debris |
| player | `attack.puncture` | single | melee | gap | slash-sweep, impact-burst, fragment-debris |
| player | `attack.reap` | circle | melee | gap | slash-sweep, impact-burst, fragment-debris |
| player | `attack.piercing_shot` | line | projectile | recipe v3 (component-only); master v4 | arrow-core, impact-burst; crescent-wave |
| player | `attack.arrow_shower` | circle | projectile | recipe v5 (component-only) | arrow-core, impact-burst |
| player | `attack.headshot` | single | projectile | gap | projectile-core / arrow-core / orb-core, impact-burst |
| player | `attack.earth_shock` | circle | ground | gap | ground-fill, ground-edge, cloud-mist |
| player | `attack.shatter` | circle | ground | gap | ground-fill, ground-edge, cloud-mist |
| player | `attack.overload` | circle | ground | gap | ground-fill, ground-edge, cloud-mist |
| player | `attack.aftershock` | circle | ground | gap | ground-fill, ground-edge, cloud-mist |
| player | `buff.warcry` | actor | instant | gap | ward-shell, ground-edge, mote |
| player | `buff.berserker` | actor | instant | gap | ward-shell, ground-edge, mote |
| player | `buff.iron_will` | actor | instant | gap | ward-shell, ground-edge, mote |
| player | `buff.holy_veil` | actor | instant | gap | ward-shell, ground-edge, mote |
| player | `buff.ghost_dance` | actor | instant | gap | ward-shell, ground-edge, mote |
| player | `buff.earth_wall` | actor | instant | gap | ward-shell, ground-edge, mote |
| player | `buff.magia_drive` | actor | instant | gap | ward-shell, ground-edge, mote |
| player | `buff.energy_absorb` | actor | instant | gap | ward-shell, ground-edge, mote |
| player | `buff.flame_guard` | actor | instant | recipe v3 (hybrid); master v4 | ward-shell, mote; shield-dome |
| player | `curse.weaken` | single | instant | gap | mark-sigil, cloud-mist |
| player | `curse.blinding_mark` | single | instant | gap | mark-sigil, cloud-mist |
| player | `curse.expose` | single | instant | gap | mark-sigil, cloud-mist |
| player | `curse.cripple` | single | instant | gap | mark-sigil, cloud-mist |
| player | `curse.jinx` | single | instant | recipe v3 (hybrid); master v4 | mark-sigil, cloud-mist; tether-strand |
| player | `curse.venom_bind` | single | instant | component master v2 | bind-strand |
| player | `heal.heal` | actor | instant | recipe v3 (hybrid) | mote, ground-edge |
| player | `heal.greater_heal` | actor | instant | gap | mote, ground-edge |
| player | `heal.cleanse` | actor | instant | gap | mote, ground-edge |
| player | `aura.wraith_of_fury` | actor | actor-bound | gap | ward-shell, ground-edge, mote |
| player | `aura.clarity` | actor | actor-bound | gap | ward-shell, ground-edge, mote |
| player | `aura.haste` | actor | actor-bound | gap | ward-shell, ground-edge, mote |
| player | `aura.vitality` | actor | actor-bound | gap | ward-shell, ground-edge, mote |
| player | `aura.herald_of_ash` | actor | actor-bound | gap | ward-shell, ground-edge, mote |
| player | `aura.herald_of_frost` | actor | actor-bound | gap | ward-shell, ground-edge, mote |
| player | `aura.herald_of_lightning` | actor | actor-bound | gap | ward-shell, ground-edge, mote |
| player | `aura.ember_conversion` | actor | actor-bound | gap | ward-shell, ground-edge, mote |
| player | `aura.rime_conversion` | actor | actor-bound | gap | ward-shell, ground-edge, mote |
| player | `aura.storm_conversion` | actor | actor-bound | gap | ward-shell, ground-edge, mote |
| player | `aura.cast_on_crit` | actor | actor-bound | gap | ward-shell, ground-edge, mote |
| player | `aura.cast_on_damage_taken` | actor | actor-bound | gap | ward-shell, ground-edge, mote |
| player | `aura.rimbo_form` | actor | actor-bound | gap | ward-shell, ground-edge, mote |
| player | `aura.elemental_fury` | actor | actor-bound | gap | ward-shell, ground-edge, mote |
| player | `aura.trinity_form` | actor | actor-bound | gap | ward-shell, ground-edge, mote |
| player | `aura.grace` | actor | actor-bound | recipe v2 (hybrid) | ground-edge, mote |
| player | `aura.iron_guard` | actor | actor-bound | gap | ward-shell, ground-edge, mote |
| player | `aura.energy_guard` | actor | actor-bound | gap | ward-shell, ground-edge, mote |
| player | `attack.water_ball` | single | projectile | recipe v3 (component-only) | orb-core, impact-burst |
| player | `attack.frost_nova` | circle | instant | component master v2 | shockwave-ring |
| player | `attack.glacial_spike` | single | projectile | gap | projectile-core / arrow-core / orb-core, impact-burst |
| player | `attack.split_shot` | cone | projectile | recipe v2 (component-only) | arrow-core, impact-burst |
| player | `attack.double_strafe` | single | projectile | recipe v2 (component-only) | arrow-core, impact-burst |
| player | `attack.double_strike` | single | melee | gap | slash-sweep, impact-burst, fragment-debris |
| player | `attack.ignite` | single | instant | gap | impact-burst, mark-sigil |
| player | `attack.cinder_nova` | circle | instant | recipe v3 (hybrid) | ground-fill, ground-edge, mote, ground-residue |
| player | `attack.thunder_storm` | circle | ground | recipe vfx-component (component-only, default live) | forked-bolt, ground-fill, ground-edge, ground-residue, impact-burst, cloud-mist |
| player | `attack.poison_cloud` | circle | ground | gap | ground-fill, ground-edge, cloud-mist |
| player | `attack.chaos_wave` | circle | instant | gap | ground-fill, ground-edge, cloud-mist |
| player | `attack.stone_spike` | single | ground | recipe v3 (component-only) | stone-spike, impact-burst, fragment-debris |
| player | `attack.fissure` | line | ground | recipe v5 (component-only); master v6 | crack-strip, stone-spike, fragment-debris, cloud-mist; wall-segment |
| player | `attack.void_orb` | single | projectile | recipe v2 (component-only) | orb-core, impact-burst |
| player | `attack.hemotoxin` | single | projectile | gap | projectile-core / arrow-core / orb-core, impact-burst |
| player | `attack.unravel` | single | projectile | gap | projectile-core / arrow-core / orb-core, impact-burst |
| player | `attack.contagion` | circle | projectile | gap | projectile-core / arrow-core / orb-core, impact-burst |
| player | `attack.venom_coffin` | single | projectile | gap | projectile-core / arrow-core / orb-core, impact-burst |
| player | `attack.tidal_wave` | line | ground | recipe v3 (component-only) | wave-crest, cloud-mist |
| player | `attack.void_ray` | line | projectile | recipe v3 (hybrid) | ribbon-beam, impact-burst |
| player | `attack.entropy_well` | circle | ground | recipe v3 (component-only) | ground-spiral, cloud-mist, mote |
| player | `buff.enchant_poison` | actor | instant | recipe v2 (component-only) | ribbon-beam, mote |
| mob | `mob.physical.backstab` | single | melee | gap | slash-sweep, impact-burst, fragment-debris |
| mob | `mob.physical.cleave` | single | melee | gap | slash-sweep, impact-burst, fragment-debris |
| mob | `mob.physical.hamstring` | single | melee | gap | slash-sweep, impact-burst, fragment-debris |
| mob | `mob.physical.shield-bash` | single | melee | gap | slash-sweep, impact-burst, fragment-debris |
| mob | `mob.physical.pounce` | single | melee | gap | slash-sweep, impact-burst, fragment-debris |
| mob | `mob.physical.gore` | single | melee | gap | slash-sweep, impact-burst, fragment-debris |
| mob | `mob.physical.crushing-blow` | single | melee | gap | slash-sweep, impact-burst, fragment-debris |
| mob | `mob.physical.sweeping-tail` | single | melee | gap | slash-sweep, impact-burst, fragment-debris |
| mob | `mob.physical.rend` | single | melee | gap | slash-sweep, impact-burst, fragment-debris |
| mob | `mob.physical.trample` | single | melee | gap | slash-sweep, impact-burst, fragment-debris |
| mob | `mob.physical.skull-crack` | single | melee | gap | slash-sweep, impact-burst, fragment-debris |
| mob | `mob.physical.overbear` | single | melee | gap | slash-sweep, impact-burst, fragment-debris |
| mob | `mob.fire.ember-lash` | single | projectile | gap | projectile-core / arrow-core / orb-core, impact-burst |
| mob | `mob.fire.cinder-burst` | single | projectile | gap | projectile-core / arrow-core / orb-core, impact-burst |
| mob | `mob.fire.scorching-roar` | single | melee | gap | slash-sweep, impact-burst, fragment-debris |
| mob | `mob.fire.molten-step` | single | melee | gap | slash-sweep, impact-burst, fragment-debris |
| mob | `mob.cold.frost-bite` | single | melee | gap | slash-sweep, impact-burst, fragment-debris |
| mob | `mob.cold.rime-snare` | single | projectile | gap | projectile-core / arrow-core / orb-core, impact-burst |
| mob | `mob.cold.winter-howl` | single | melee | gap | slash-sweep, impact-burst, fragment-debris |
| mob | `mob.cold.ice-shard` | single | projectile | gap | projectile-core / arrow-core / orb-core, impact-burst |
| mob | `mob.lightning.static-jab` | single | melee | gap | slash-sweep, impact-burst, fragment-debris |
| mob | `mob.lightning.thunderclap` | single | projectile | gap | projectile-core / arrow-core / orb-core, impact-burst |
| mob | `mob.lightning.chain-spark` | single | projectile | gap | projectile-core / arrow-core / orb-core, impact-burst |
| mob | `mob.lightning.volt-rush` | single | melee | gap | slash-sweep, impact-burst, fragment-debris |
| mob | `mob.poison.venom-spit` | single | projectile | gap | projectile-core / arrow-core / orb-core, impact-burst |
| mob | `mob.poison.toxic-cloud` | single | projectile | gap | projectile-core / arrow-core / orb-core, impact-burst |
| mob | `mob.poison.serpent-strike` | single | melee | gap | slash-sweep, impact-burst, fragment-debris |
| mob | `mob.poison.acid-spray` | single | projectile | gap | projectile-core / arrow-core / orb-core, impact-burst |
| mob | `mob.chaos.mind-shear` | single | projectile | gap | projectile-core / arrow-core / orb-core, impact-burst |
| mob | `mob.chaos.void-pulse` | single | projectile | gap | projectile-core / arrow-core / orb-core, impact-burst |
| mob | `mob.chaos.hex-bolt` | single | projectile | gap | projectile-core / arrow-core / orb-core, impact-burst |
| mob | `mob.chaos.dissonant-cry` | single | projectile | gap | projectile-core / arrow-core / orb-core, impact-burst |
| mob | `mob.earth.stone-fist` | single | melee | gap | slash-sweep, impact-burst, fragment-debris |
| mob | `mob.earth.quake-step` | single | melee | gap | slash-sweep, impact-burst, fragment-debris |
| mob | `mob.earth.dust-blind` | single | projectile | gap | projectile-core / arrow-core / orb-core, impact-burst |
| mob | `mob.earth.boulder-toss` | circle | ground | gap | ground-fill, ground-edge, cloud-mist |
| mob | `mob.fire.ash-veil` | actor | actor-bound | gap | ward-shell, ground-edge, mote |
| mob | `mob.fire.flame-guard` | actor | actor-bound | gap | ward-shell, ground-edge, mote |
| mob | `mob.cold.glacial-ward` | actor | actor-bound | gap | ward-shell, ground-edge, mote |
| mob | `mob.cold.permafrost` | actor | actor-bound | gap | ward-shell, ground-edge, mote |
| mob | `mob.lightning.storm-mantle` | actor | actor-bound | gap | ward-shell, ground-edge, mote |
| mob | `mob.lightning.charged-field` | actor | actor-bound | gap | ward-shell, ground-edge, mote |
| mob | `mob.poison.miasma` | actor | actor-bound | gap | ward-shell, ground-edge, mote |
| mob | `mob.poison.creeping-rot` | actor | actor-bound | gap | ward-shell, ground-edge, mote |
| mob | `mob.chaos.unreal-veil` | actor | actor-bound | gap | ward-shell, ground-edge, mote |
| mob | `mob.chaos.warped-aura` | actor | actor-bound | gap | ward-shell, ground-edge, mote |
| mob | `mob.earth.stone-guard` | actor | actor-bound | gap | ward-shell, ground-edge, mote |
| mob | `mob.earth.rooted-stance` | actor | actor-bound | gap | ward-shell, ground-edge, mote |
| mob | `mob.earth.seismic-slam` | circle | ground | gap | ground-fill, ground-edge, cloud-mist |
