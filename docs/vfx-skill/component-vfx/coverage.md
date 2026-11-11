# Component coverage

Roster: 90 live player skills + 49 live mob skills = 139 rows.

`recipe` names a packaged component version; `gap` means no component recipe has been published for that skill. Existing whole-skill artwork may still exist. Suggested ingredients are candidates for composition, not finished or visually approved recipes. Geometry and delivery below come from the roster; actor-bound support has no authored area.

| Owner | Skill | Shape | Delivery | Recipe / disposition | Ingredients or suggested reuse |
| --- | --- | --- | --- | --- | --- |
| player | `attack.fireball` | single | projectile | recipe vfx-component (component-only) | projectile-core, impact-burst |
| player | `attack.firestorm` | circle | ground | recipe vfx-component (component-only) | ground-fill, ground-edge, cloud-mist, impact-burst |
| player | `attack.meteor` | circle | ground | recipe vfx-component (component-only) | orb-core, impact-burst, ground-residue, ground-fill |
| player | `attack.ice_lance` | single | projectile | recipe vfx-component (component-only) | arrow-core, impact-burst |
| player | `attack.blizzard` | circle | ground | recipe vfx-component (component-only) | fragment-debris, cloud-mist, ground-fill, ground-edge, ground-residue |
| player | `attack.frostbite` | single | instant | recipe vfx-component (component-only) | impact-burst, mark-sigil |
| player | `attack.chain_lightning` | circle | instant | recipe vfx-component (component-only) | forked-bolt, impact-burst |
| player | `attack.spark` | circle | projectile | recipe vfx-component (component-only) | projectile-core, impact-burst |
| player | `attack.thunder_strike` | single | ground | recipe vfx-component (component-only) | forked-bolt, impact-burst |
| player | `attack.poison_bolt` | single | projectile | recipe vfx-component (component-only) | orb-core, impact-burst |
| player | `attack.acid_arrow` | single | projectile | recipe vfx-component (component-only) | arrow-core, impact-burst |
| player | `attack.chaos_bolt` | single | projectile | recipe vfx-component (component-only) | orb-core, impact-burst |
| player | `attack.void_blast` | circle | ground | recipe vfx-component (component-only) | ground-fill, ground-edge, cloud-mist, impact-burst |
| player | `attack.sand_storm` | circle | ground | recipe vfx-component (component-only) | fragment-debris, ground-fill, ground-edge, cloud-mist |
| player | `attack.earth_splitter` | single | ground | recipe vfx-component (component-only) | mark-sigil, impact-burst, fragment-debris |
| player | `attack.backstab` | single | melee | recipe vfx-component (component-only) | slash-sweep, impact-burst, fragment-debris |
| player | `attack.impale` | line | melee | recipe vfx-component (component-only) | ribbon-beam, crack-strip, impact-burst |
| player | `attack.skull_crack` | single | melee | recipe vfx-component (component-only) | slash-sweep, impact-burst, fragment-debris |
| player | `attack.ground_slam` | circle | melee | recipe vfx-component (component-only) | slash-sweep, ground-edge, impact-burst, fragment-debris |
| player | `attack.cleave` | cone | melee | recipe vfx-component (component-only) | cone-stream, impact-burst |
| player | `attack.elemental_break` | single | melee | recipe vfx-component (component-only) | slash-sweep, impact-burst, fragment-debris |
| player | `attack.whirlwind` | circle | melee | recipe vfx-component (component-only) | slash-sweep, ground-edge, mote |
| player | `attack.shield_bash` | single | melee | recipe vfx-component (component-only) | slash-sweep, impact-burst |
| player | `attack.puncture` | single | melee | recipe vfx-component (component-only) | slash-sweep, impact-burst |
| player | `attack.reap` | circle | melee | recipe vfx-component (component-only) | slash-sweep, ground-edge, impact-burst, fragment-debris |
| player | `attack.piercing_shot` | line | projectile | recipe vfx-component (component-only) | crescent-wave, impact-burst |
| player | `attack.arrow_shower` | circle | projectile | recipe vfx-component (component-only) | arrow-core, impact-burst |
| player | `attack.headshot` | single | projectile | recipe vfx-component (component-only) | arrow-core, impact-burst |
| player | `attack.earth_shock` | circle | ground | recipe vfx-component (component-only) | ground-fill, ground-edge, cloud-mist, impact-burst |
| player | `attack.shatter` | circle | ground | recipe vfx-component (component-only) | ground-fill, ground-edge, cloud-mist, impact-burst |
| player | `attack.overload` | circle | ground | recipe vfx-component (component-only) | ground-fill, ground-edge, cloud-mist, impact-burst |
| player | `attack.aftershock` | circle | ground | recipe vfx-component (component-only) | ground-fill, ground-edge, impact-burst, fragment-debris |
| player | `buff.warcry` | actor | instant | recipe vfx-component (component-only) | ward-shell, ground-edge, mote |
| player | `buff.berserker` | actor | instant | recipe vfx-component (component-only) | ward-shell, ground-edge, mote |
| player | `buff.iron_will` | actor | instant | recipe vfx-component (component-only) | ward-shell, ground-edge, mote |
| player | `buff.holy_veil` | actor | instant | recipe vfx-component (component-only) | ward-shell, ground-edge, mote |
| player | `buff.ghost_dance` | actor | instant | recipe vfx-component (component-only) | ward-shell, ground-edge, mote |
| player | `buff.earth_wall` | actor | instant | recipe vfx-component (component-only) | ward-shell, ground-edge, mote |
| player | `buff.magia_drive` | actor | instant | recipe vfx-component (component-only) | ward-shell, ground-edge, mote |
| player | `buff.energy_absorb` | actor | instant | recipe vfx-component (component-only) | ward-shell, ground-edge, mote |
| player | `buff.flame_guard` | actor | instant | recipe vfx-component (component-only) | shield-dome, ward-shell, mote |
| player | `curse.weaken` | single | instant | recipe vfx-component (component-only) | mark-sigil, cloud-mist |
| player | `curse.blinding_mark` | single | instant | recipe vfx-component (component-only) | mark-sigil, cloud-mist |
| player | `curse.expose` | single | instant | recipe vfx-component (component-only) | mark-sigil, cloud-mist |
| player | `curse.cripple` | single | instant | recipe vfx-component (component-only) | mark-sigil, cloud-mist |
| player | `curse.jinx` | single | instant | recipe vfx-component (component-only) | mark-sigil, cloud-mist, tether-strand |
| player | `curse.venom_bind` | single | instant | recipe vfx-component (component-only) | bind-strand, mark-sigil |
| player | `heal.heal` | actor | instant | recipe vfx-component (component-only) | mote, ground-edge |
| player | `heal.greater_heal` | actor | instant | recipe vfx-component (component-only) | mote, ground-edge |
| player | `heal.cleanse` | actor | instant | recipe vfx-component (component-only) | mote, ground-edge |
| player | `aura.wraith_of_fury` | actor | actor-bound | recipe vfx-component (component-only) | ward-shell, ground-edge, mote |
| player | `aura.clarity` | actor | actor-bound | recipe vfx-component (component-only) | ward-shell, ground-edge, mote |
| player | `aura.haste` | actor | actor-bound | recipe vfx-component (component-only) | ward-shell, ground-edge, mote |
| player | `aura.vitality` | actor | actor-bound | recipe vfx-component (component-only) | ward-shell, ground-edge, mote |
| player | `aura.herald_of_ash` | actor | actor-bound | recipe vfx-component (component-only) | ward-shell, ground-edge, mote |
| player | `aura.herald_of_frost` | actor | actor-bound | recipe vfx-component (component-only) | ward-shell, ground-edge, mote |
| player | `aura.herald_of_lightning` | actor | actor-bound | recipe vfx-component (component-only) | ward-shell, ground-edge, mote |
| player | `aura.ember_conversion` | actor | actor-bound | recipe vfx-component (component-only) | ward-shell, ground-edge, mote |
| player | `aura.rime_conversion` | actor | actor-bound | recipe vfx-component (component-only) | ward-shell, ground-edge, mote |
| player | `aura.storm_conversion` | actor | actor-bound | recipe vfx-component (component-only) | ward-shell, ground-edge, mote |
| player | `aura.cast_on_crit` | actor | actor-bound | recipe vfx-component (component-only) | ward-shell, ground-edge, mote |
| player | `aura.cast_on_damage_taken` | actor | actor-bound | recipe vfx-component (component-only) | ward-shell, ground-edge, mote |
| player | `aura.rimbo_form` | actor | actor-bound | recipe vfx-component (component-only) | ward-shell, ground-edge, mote |
| player | `aura.elemental_fury` | actor | actor-bound | recipe vfx-component (component-only) | ward-shell, ground-edge, mote |
| player | `aura.trinity_form` | actor | actor-bound | recipe vfx-component (component-only) | ward-shell, ground-edge, mote |
| player | `aura.grace` | actor | actor-bound | recipe vfx-component (component-only) | ward-shell, ground-edge, mote |
| player | `aura.iron_guard` | actor | actor-bound | recipe vfx-component (component-only) | ward-shell, ground-edge, mote |
| player | `aura.energy_guard` | actor | actor-bound | recipe vfx-component (component-only) | ward-shell, ground-edge, mote |
| player | `attack.water_ball` | single | projectile | recipe vfx-component (component-only) | orb-core, impact-burst |
| player | `attack.frost_nova` | circle | instant | recipe vfx-component (component-only) | shockwave-ring, ground-edge, mote |
| player | `attack.glacial_spike` | single | projectile | recipe vfx-component (component-only) | arrow-core, impact-burst |
| player | `attack.split_shot` | cone | projectile | recipe vfx-component (component-only) | arrow-core, impact-burst |
| player | `attack.double_strafe` | single | projectile | recipe vfx-component (component-only) | arrow-core, impact-burst |
| player | `attack.double_strike` | single | melee | recipe vfx-component (component-only) | slash-sweep, impact-burst |
| player | `attack.ignite` | single | instant | recipe vfx-component (component-only) | impact-burst, mark-sigil |
| player | `attack.cinder_nova` | circle | instant | recipe vfx-component (component-only) | ground-fill, ground-edge, mote, ground-residue |
| player | `attack.thunder_storm` | circle | ground | recipe vfx-component (component-only, default live) | forked-bolt, ground-fill, ground-edge, ground-residue, impact-burst, cloud-mist |
| player | `attack.poison_cloud` | circle | ground | recipe vfx-component (component-only) | ground-fill, ground-edge, cloud-mist |
| player | `attack.chaos_wave` | circle | instant | recipe vfx-component (component-only) | ground-fill, ground-edge, cloud-mist, impact-burst |
| player | `attack.stone_spike` | single | ground | recipe vfx-component (component-only) | stone-spike, impact-burst, fragment-debris |
| player | `attack.fissure` | line | ground | recipe vfx-component (component-only) | crack-strip, stone-spike, fragment-debris, cloud-mist |
| player | `attack.void_orb` | single | projectile | recipe vfx-component (component-only) | orb-core, impact-burst |
| player | `attack.hemotoxin` | single | projectile | recipe vfx-component (component-only) | orb-core, impact-burst |
| player | `attack.unravel` | single | projectile | recipe vfx-component (component-only) | orb-core, impact-burst |
| player | `attack.contagion` | circle | projectile | recipe vfx-component (component-only) | orb-core, impact-burst, cloud-mist |
| player | `attack.venom_coffin` | single | projectile | recipe vfx-component (component-only) | orb-core, impact-burst, mark-sigil |
| player | `attack.tidal_wave` | line | ground | recipe vfx-component (component-only) | wave-crest, cloud-mist |
| player | `attack.void_ray` | line | projectile | recipe vfx-component (component-only) | ribbon-beam, impact-burst |
| player | `attack.entropy_well` | circle | ground | recipe vfx-component (component-only) | ground-spiral, vortex, cloud-mist, mote |
| player | `buff.enchant_poison` | actor | instant | recipe vfx-component (component-only) | ribbon-beam, mote |
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
