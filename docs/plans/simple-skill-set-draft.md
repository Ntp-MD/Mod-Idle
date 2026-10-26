# Simple skill set — 15-skill draft

Status: DRAFT ONLY. No `tools/data/skills.json`, icon registry, FX map or wiki file is changed by this document. It records the selected four skills (Water Ball, Frost Nova, Glacial Spike, Split Shot) plus eleven fillers so the set reaches 15 while staying element-balanced.

Revision 2: Corrode, Fire Wall and Flame Lash were rejected by the owner. They are replaced by Venom Bolt, Ignite and Cinder Nova. The replacements are direct-damage or stack-application rows; no resistance-strip, DoT-field or bonus-vs-status payoff remains in those slots.

Revision 3: Boulder Toss is replaced by **Fissure**, requested as an Earthshaker-style line skill. Fissure is the only row here that cannot be data-only: the current engine supports circle areas only, so it needs the line-area extension in section 5. Its concept is line damage + stop; the Dota-style impassable wall is not included because this game has no collision/obstacle navigation.

Revision 4: Thunderclap is renamed **Thunder Storm** (`attack.thunder_storm`). Its behavior stays the same caster-centered lightning AoE with a guaranteed shock; only the name, id, icon and FX label move. Storm Field keeps its name for now.

Source request: simple, readable skills in the spirit of Water Ball; build a 15-skill draft first, do not integrate yet.

## 1. Selection and element split

| Element | Count | Skills |
|---|---:|---|
| Cold | 3 | Water Ball, Frost Nova, Glacial Spike |
| Physical | 2 | Split Shot, Double Strike |
| Fire | 2 | Ignite, Cinder Nova |
| Lightning | 2 | Thunder Storm, Storm Field |
| Poison | 2 | Poison Cloud, Venom Bolt |
| Chaos | 2 | Chaos Wave, Entropy |
| Earth | 2 | Stone Spike, Fissure |

Cold has one extra because the three selected cold skills are kept. Every other element has two. If a strict 2-per-element split is required, drop Glacial Spike or move it to a later pass.

## 2. Design rules used

- One row = one combat verb. No row combines a setup and its payoff in the same slot.
- Water Ball and the other water-family skills use the existing **Cold** element. There is no live `water` element in `elements.order`; adding one would be a separate systems packet (status, gear pools, mob resistance, wiki).
- All effects below already exist in `engine/skills.ts` `EFFECT_STATS` and have a reader in `game/src/sim`.
- `guaranteed_status` applies the row's Element status to every target only when the row also carries `every_target`.
- `dot_dps` / `dot_sec` are per-target riders applied by the cast, not a persistent ground object. Copy must not claim an independent field that keeps ticking after the encounter moves.
- `Ignite` and `Venom Bolt` are dedicated stack applicators: they press once and write 5 burn or poison stacks. `Cinder Nova` is a direct caster-area burst that burns every target.
- **Fissure is not data-only.** The live `SkillAreaDefinition` is `{origin, radius_m}` and `targetsInSkillArea` is circle-only. Fissure's proposed line shape needs the engine extension in section 5; do not insert its row before that lands. Its stop is a normal `stop_sec` target effect; no wall/collision is implied.
- Numbers are calibrated against the existing rows at skill level 20 on the glass reference, 50% CDR and 30% ladder. `tools/skills.ts --calc` prints `dmg/press` without `hits` / `hit_pct`; the balance table below includes those multipliers and is the honest full-press figure.

## 3. Proposed rows

Insert these into `tools/data/skills.json` `skills` only after approval. The objects are complete attack rows; no other field is required by the current schema.

### Cold

```json
[
  {"id":"attack.water_ball","name":"Water Ball","type":"attack","group":"magic","element":"cold","cd":7,"mana":"20 flat","basis":"magic","targets":"1","area":{"origin":"target","radius_m":0},"cast":{"delivery":"projectile","range_m":4.6},"effect":"A volley of water spheres. Chills the target.","rules":["guaranteed_status"],"effects":[{"stat":"hits","op":"add_flat","value":5,"subject":"self"},{"stat":"hit_pct","op":"add_pct","value":20,"subject":"self"}],"base_flat":420,"eff":88},
  {"id":"attack.frost_nova","name":"Frost Nova","type":"attack","group":"magic","element":"cold","cd":10,"mana":"24 flat (AoE ×1.5)","basis":"magic","targets":"3","area":{"origin":"caster","radius_m":2.5},"cast":{"delivery":"instant","range_m":4.6},"effect":"Chills every enemy around you.","rules":["guaranteed_status","every_target"],"base_flat":550,"eff":100},
  {"id":"attack.glacial_spike","name":"Glacial Spike","type":"attack","group":"magic","element":"cold","cd":12,"mana":"20 flat","basis":"magic","targets":"1","area":{"origin":"target","radius_m":0},"cast":{"delivery":"projectile","range_m":4.6},"effect":"Stops the target for 1.5 sec.","effects":[{"stat":"stop_sec","op":"add_flat","value":1.5,"subject":"target"}],"base_flat":900,"eff":105}
]
```

### Physical

```json
[
  {"id":"attack.split_shot","name":"Split Shot","type":"attack","group":"ranged","element":"physical","cd":7,"mana":"15 flat (AoE ×1.5)","basis":"phys","targets":"3","area":{"origin":"target","radius_m":1.5},"cast":{"delivery":"projectile","range_m":5.2},"effect":"Splits on impact, hitting every enemy in a small circle.","base_flat":1649.8,"eff":77.36},
  {"id":"attack.double_strike","name":"Double Strike","type":"attack","group":"melee","element":"physical","cd":5,"mana":"12 flat","basis":"phys","targets":"1","area":{"origin":"target","radius_m":0},"cast":{"delivery":"melee","range_m":2.1},"effect":"A pair of quick blows.","effects":[{"stat":"hits","op":"add_flat","value":2,"subject":"self"},{"stat":"hit_pct","op":"add_pct","value":60,"subject":"self"}],"base_flat":1400,"eff":60}
]
```

### Fire

```json
[
  {"id":"attack.ignite","name":"Ignite","type":"attack","group":"magic","element":"fire","cd":8,"mana":"19 flat","basis":"magic","targets":"1","area":{"origin":"target","radius_m":0},"cast":{"delivery":"instant","range_m":4.6},"effect":"Applies 5 burn stacks.","effects":[{"stat":"burn_stacks","op":"add_flat","value":5,"subject":"target"}],"base_flat":381.5,"eff":82.43},
  {"id":"attack.cinder_nova","name":"Cinder Nova","type":"attack","group":"magic","element":"fire","cd":10,"mana":"24 flat (AoE ×1.5)","basis":"magic","targets":"3","area":{"origin":"caster","radius_m":2.5},"cast":{"delivery":"instant","range_m":4.6},"effect":"Burns every enemy around you.","rules":["guaranteed_status","every_target"],"base_flat":550,"eff":100}
]
```

### Lightning

```json
[
  {"id":"attack.thunder_storm","name":"Thunder Storm","type":"attack","group":"magic","element":"lightning","cd":10,"mana":"24 flat (AoE ×1.5)","basis":"magic","targets":"3","area":{"origin":"caster","radius_m":2.5},"cast":{"delivery":"instant","range_m":4.6},"effect":"Shocks every enemy around you.","rules":["guaranteed_status","every_target"],"base_flat":550,"eff":100},
  {"id":"attack.storm_field","name":"Storm Field","type":"attack","group":"magic","element":"lightning","cd":12,"mana":"20 flat (AoE ×1.5)","basis":"magic","targets":"3","area":{"origin":"target","radius_m":2.5},"cast":{"delivery":"ground","range_m":4.6},"effect":"Leaves a charged storm.","rules":["guaranteed_status","every_target"],"effects":[{"stat":"dot_dps","op":"add_flat","value":25,"subject":"target"},{"stat":"dot_sec","op":"add_flat","value":8,"subject":"target"}],"base_flat":800,"eff":90}
]
```

### Poison

```json
[
  {"id":"attack.poison_cloud","name":"Poison Cloud","type":"attack","group":"magic","element":"poison","cd":10,"mana":"24 flat (AoE ×1.5)","basis":"magic","targets":"3","area":{"origin":"target","radius_m":2.5},"cast":{"delivery":"ground","range_m":4.6},"effect":"2 poison stacks. Leaves a toxic cloud.","rules":["every_target"],"effects":[{"stat":"poison_stacks","op":"add_flat","value":2,"subject":"target"},{"stat":"dot_dps","op":"add_flat","value":15,"subject":"target"},{"stat":"dot_sec","op":"add_flat","value":8,"subject":"target"}],"base_flat":600,"eff":80},
  {"id":"attack.venom_bolt","name":"Venom Bolt","type":"attack","group":"magic","element":"poison","cd":8,"mana":"21 flat","basis":"magic","targets":"1","area":{"origin":"target","radius_m":0},"cast":{"delivery":"instant","range_m":4.6},"effect":"Applies 5 poison stacks.","effects":[{"stat":"poison_stacks","op":"add_flat","value":5,"subject":"target"}],"base_flat":445.1,"eff":96.16}
]
```

### Chaos

```json
[
  {"id":"attack.chaos_wave","name":"Chaos Wave","type":"attack","group":"magic","element":"chaos","cd":10,"mana":"24 flat (AoE ×1.5)","basis":"magic","targets":"3","area":{"origin":"caster","radius_m":2.5},"cast":{"delivery":"instant","range_m":4.6},"effect":"Marks every enemy around you.","rules":["guaranteed_status","every_target"],"base_flat":550,"eff":100},
  {"id":"attack.entropy","name":"Entropy","type":"attack","group":"magic","element":"chaos","cd":8,"mana":"20 flat","basis":"magic","targets":"1","area":{"origin":"target","radius_m":0},"cast":{"delivery":"instant","range_m":4.6},"effect":"+30% damage against marked targets.","effects":[{"stat":"bonus_vs_status","status":"mark","op":"add_pct","value":30,"subject":"target"}],"base_flat":699.2,"eff":82.4}
]
```

### Earth

```json
[
  {"id":"attack.stone_spike","name":"Stone Spike","type":"attack","group":"magic","element":"earth","cd":12,"mana":"20 flat","basis":"magic","targets":"1","area":{"origin":"target","radius_m":0},"cast":{"delivery":"ground","range_m":4.6},"effect":"+30% damage against crippled targets.","effects":[{"stat":"bonus_vs_status","status":"crippled","op":"add_pct","value":30,"subject":"target"}],"base_flat":900,"eff":105},
  {"id":"attack.fissure","name":"Fissure","type":"attack","group":"magic","element":"earth","cd":11,"mana":"22 flat (AoE ×1.5)","basis":"magic","targets":"3","area":{"origin":"caster","shape":"line","length_m":6,"width_m":1.2},"cast":{"delivery":"ground","range_m":6},"effect":"Rends a line, stopping enemies for 1 sec.","rules":["every_target"],"effects":[{"stat":"stop_sec","op":"add_flat","value":1,"subject":"target"}],"base_flat":850,"eff":100}
]
```

## 4. Balance evidence

Reference: glass build, skill level 20, 50% CDR and 30% ladder. Full press includes `hits` / `hit_pct` / `bonus_vs_status`; DoT and status damage are not included.

| Skill | L1 full press | L20 full press | Effective CD | L20 DPS | Nearest live row (DPS) |
|---|---:|---:|---:|---:|---:|
| Water Ball | 229 | 1,947 | 2.45 | 795 | Acid Arrow 521 · Ice Lance 980 |
| Frost Nova | 279 | 1,434 | 3.50 | 410 | Chain Lightning 474 |
| Glacial Spike | 373 | 1,920 | 4.20 | 457 | Thunder Strike 535 |
| Split Shot | 917 | 4,711 | 2.45 | 1,923 | Ground Slam 1,982 |
| Double Strike | 889 | 7,547 | 1.75 | 4,313 | Arrow Shower 4,466 |
| Ignite | 212 | 1,089 | 2.80 | 389 | Fireball 519 (2 stacks) |
| Cinder Nova | 279 | 1,434 | 3.50 | 410 | Chain Lightning 474 |
| Thunder Storm | 279 | 1,434 | 3.50 | 410 | Chain Lightning 474 |
| Storm Field | 327 | 1,682 | 4.20 | 401 | Sand Storm 475 + DoT |
| Poison Cloud | 263 | 1,352 | 3.50 | 386 | Venom Spray 474 + stacks |
| Venom Bolt | 247 | 1,271 | 2.80 | 454 | Acid Arrow 519 (3 stacks) |
| Chaos Wave | 279 | 1,434 | 3.50 | 410 | Void Blast 474 |
| Entropy | 379 | 2,075 | 2.80 | 741 | Ruin 487 (consume can exceed) |
| Stone Spike | 486 | 2,660 | 4.20 | 633 | Earth Splitter 535 |
| Fissure | 354 | 1,820 | 3.85 | 473 | Earth Splitter 535 + stop |

Note: `hits` and `hit_pct` both scale with `effect_pct`, so a multi-hit row's full press grows faster than the workshop's `dmg/press`. Existing Ice Lance, Blizzard and Arrow Shower already behave this way; the printed table is consistent with them, not a new rule.

Stone Spike is the one draft row whose payoff is not self-contained: it reads `crippled`, and the live writer is `attack.earth_shock`. The whole-roster S22 gate passes, but a character holding only this 15-row set would not be able to apply the status. If every simple row must stand alone, replace Stone Spike with a direct earth attack.

## 5. Supporting changes, if this draft is approved

### Fissure line-area extension (required before its row can ship)

The live contract is circle-only: `engine/types.ts` `SkillAreaDefinition` is `{ origin, radius_m }`, `engine/skill-actions.ts` `targetsInSkillArea` tests a centre against a radius, and `game/src/sim/combat-arena.ts` / `combat-actions.ts` aim and snapshot that circle. A Fissure line cannot be represented by a small circle without lying about the footprint.

Proposed minimal extension:

- `area`: `{ "origin": "caster", "shape": "line", "length_m": 6, "width_m": 1.2 }`; circle rows keep `radius_m` and either omit `shape` or set `"circle"`.
- `SkillAreaSnapshot`: keep `origin`, `center`, `targetId`; add `shape`, `start`, `end`, `widthM`. Circle snapshots keep `radiusM`.
- Membership: a body centre is hit when its distance to the segment `start → end` is at most `widthM / 2`; the primary target is included when it lies on the segment; no target-count cap (the live circle rule already has none).
- Aim: caster → committed aim point; clamp the segment to `length_m`; cast range remains `cast.range_m`. Release re-aim updates the segment the same way it updates a circle centre.
- Offline: `targets` remains the queue approximation; no spatial line offline.
- Presentation: a new `fissure` SVG path drawn along the segment; `SkillFxPreview` and arena FX need line rotation/length instead of a circle at `center`.
- Docs/tests: update `docs/game-rules.md` Active skills and `docs/DECISIONS.md` Combat order; extend `skill-area`, `combat-arena`, `combat-timing`, `combat-presentation` and `skill-fx` tests.

Not included: impassable wall, collision, obstacle navigation or pathing. `docs/game-rules.md` explicitly keeps those out of the spatial model. Fissure stops bodies with `stop_sec`; it does not create terrain. A true Earthshaker wall is a separate collision/system packet.

### Icons (existing shelf art; no new art generation)

| Skill id | Icon key |
|---|---|
| attack.water_ball | water-bolt |
| attack.frost_nova | attack-frost-nova |
| attack.glacial_spike | ice-bolt |
| attack.split_shot | striking-arrows |
| attack.double_strike | crossed-slashes |
| attack.ignite | small-fire |
| attack.cinder_nova | fire-wave |
| attack.thunder_storm | lightning-storm |
| attack.storm_field | focused-lightning |
| attack.poison_cloud | toxic-spray |
| attack.venom_bolt | poison-bottle-alt |
| attack.chaos_wave | void-lance |
| attack.entropy | mark-of-the-executioner |
| attack.stone_spike | earth-spit |
| attack.fissure | earth-crack |

Add these as explicit `ICON_REGISTRY.skill.byId` entries in `game/src/icon/registry.ts`. Do not add broad semantic rules that could redirect existing skills.

### FX (legacy SVG shapes until an authored pass)

| Skill id | Shape | Options |
|---|---|---|
| attack.water_ball | iceLance | projectile, pulses 5 |
| attack.frost_nova | frostbite | — |
| attack.glacial_spike | iceLance | projectile, pulses 1 |
| attack.split_shot | arrowShower | projectile, pulses 3 |
| attack.double_strike | backstab | pulses 2 |
| attack.ignite | fireball | — |
| attack.cinder_nova | firestorm | — |
| attack.thunder_storm | thunder | — |
| attack.storm_field | chainLightning | — |
| attack.poison_cloud | cloud | — |
| attack.venom_bolt | poisonBolt | — |
| attack.chaos_wave | voidBlast | — |
| attack.entropy | chaosBolt | — |
| attack.stone_spike | earthSplitter | — |
| attack.fissure | fissure (new) | line renderer required |

All 77 live skills currently have authored VFX and `art-reference/skills/vfx-production.md` says so. These new rows would start on legacy SVG shapes; if they stay in the game, the production roster and that document need a status line for the new rows. Do not claim authored coverage before it exists.

### Wiki

Run `npm run wiki` after the data lands. `docs/wiki/skills.html` is generated; never hand-edit it.

## 6. Gates and verification after implementation

- `npm run skills -- --checks` — S11 effect text, S13 basis/base/effectiveness, S15/S16 cost, S17 AoE suffix, S22 status writer. Expect no new failures.
- `npm run typecheck`.
- `npm --prefix game run check`.
- Focused tests: `game/tests/skills*`, `combat-arena`, `skill-area`, `skill-fx`; run `npm test` if shared behavior moves.
- `npm run wiki`.
- Browser check at `http://localhost:5173/__showcase#showcase-field`, 1920 × 1080: cast each row, verify projectile/impact, status on all targets, hover text and icon.
- New rows enter the random drop pool; note the acquisition-pacing change. This draft does not change `grantSkill` or save state.

## 7. Open decisions

1. **Strict element balance**: keep Cold at 3 (selected) or cut Glacial Spike for a 2/2/2/2/2/2/3 split with another element.
2. **Shape repetition**: Frost Nova, Thunder Storm, Chaos Wave and Cinder Nova are all caster-centered novas; Storm Field is the only remaining DoT rider; Entropy and Stone Spike are the only remaining `bonus_vs_status` payoffs. If the novas read as recolouring, replace one with a support row (Mist Veil, Wellspring, Hex of Ruin) and accept unequal element counts. Thunder Storm and Storm Field sharing the storm word is also open: rename Storm Field to Static Field or Lightning Field if the pair reads too similarly.
3. **Split Shot radius**: 1.5 m is a tight cluster; 2.0 m would read more like an arrow burst but raises multi-target value. The live circle has no target cap; the `targets: "3"` field is only the offline approximation.
4. **Stack volume**: Ignite and Venom Bolt apply 5 stacks. Fireball applies 2 and Acid Arrow applies 3, so 5 is intentionally the dedicated setup value. If it feels too strong, lower to 3–4 or move the rows to a longer cooldown before integration.
5. **FX ownership**: reuse the listed SVG shapes for now, or commission/authored atlases for the four selected skills first.
6. **Water naming**: the UI will show `Element: Cold`. If the player must see the word Water, that needs a real element or a display-only label, and a display-only label is not recommended because it separates copy from data.
7. **Fissure wall**: this draft ships line damage + stop only. A true Earthshaker wall needs collision/obstacle navigation and pathing, which the spatial model deliberately excludes. Decide whether that separate system is wanted; without it, Fissure is a line nuke with a short stop.
8. **Stone Spike dependency**: keep the crippled payoff and accept that Earth Shock is the live writer, or swap Stone Spike for a direct earth row so every new skill stands alone.

## 8. Explicit non-changes

- No new element, status, save key or migration. Fissure is the one exception: it needs the line-area engine extension above; no other row does.
- No change to `mob_HP`, damage formulas or drop tables beyond the new rows entering the existing pool.
- No edits to `tools/data/skills.json`, icons, FX or wiki in this draft.
