# Simple skill set — implementation format

Status: READY TO APPLY. This document holds the complete add format; it does not apply it.

## 1. `tools/data/skills.json`

Append these objects to the `skills` array.

```json
[
  {"id":"attack.water_ball","name":"Water Ball","type":"attack","group":"magic","element":"cold","cd":7,"mana":"20 flat","basis":"magic","targets":"1","area":{"origin":"target","radius_m":0},"cast":{"delivery":"projectile","range_m":4.6},"effect":"A volley of water spheres. Chills the target.","rules":["guaranteed_status"],"effects":[{"stat":"hits","op":"add_flat","value":5,"subject":"self"},{"stat":"hit_pct","op":"add_pct","value":20,"subject":"self"}],"base_flat":420,"eff":88},
  {"id":"attack.frost_nova","name":"Frost Nova","type":"attack","group":"magic","element":"cold","cd":10,"mana":"24 flat (AoE x1.5)","basis":"magic","targets":"3","area":{"origin":"caster","radius_m":2.5},"cast":{"delivery":"instant","range_m":4.6},"effect":"Chills every enemy around you.","rules":["guaranteed_status","every_target"],"base_flat":550,"eff":100},
  {"id":"attack.glacial_spike","name":"Glacial Spike","type":"attack","group":"magic","element":"cold","cd":12,"mana":"20 flat","basis":"magic","targets":"1","area":{"origin":"target","radius_m":0},"cast":{"delivery":"projectile","range_m":4.6},"effect":"Stops the target for 1.5 sec.","effects":[{"stat":"stop_sec","op":"add_flat","value":1.5,"subject":"target"}],"base_flat":900,"eff":105},
  {"id":"attack.split_shot","name":"Split Shot","type":"attack","group":"ranged","element":"physical","cd":7,"mana":"15 flat (AoE x1.5)","basis":"phys","targets":"3","area":{"origin":"target","radius_m":1.5},"cast":{"delivery":"projectile","range_m":5.2},"effect":"Splits on impact, hitting every enemy in a small circle.","base_flat":1649.8,"eff":77.36},
  {"id":"attack.double_strike","name":"Double Strike","type":"attack","group":"melee","element":"physical","cd":5,"mana":"12 flat","basis":"phys","targets":"1","area":{"origin":"target","radius_m":0},"cast":{"delivery":"melee","range_m":2.1},"effect":"A pair of quick blows.","effects":[{"stat":"hits","op":"add_flat","value":2,"subject":"self"},{"stat":"hit_pct","op":"add_pct","value":60,"subject":"self"}],"base_flat":1400,"eff":60},
  {"id":"attack.ignite","name":"Ignite","type":"attack","group":"magic","element":"fire","cd":8,"mana":"19 flat","basis":"magic","targets":"1","area":{"origin":"target","radius_m":0},"cast":{"delivery":"instant","range_m":4.6},"effect":"Applies 5 burn stacks.","effects":[{"stat":"burn_stacks","op":"add_flat","value":5,"subject":"target"}],"base_flat":381.5,"eff":82.43},
  {"id":"attack.cinder_nova","name":"Cinder Nova","type":"attack","group":"magic","element":"fire","cd":10,"mana":"24 flat (AoE x1.5)","basis":"magic","targets":"3","area":{"origin":"caster","radius_m":2.5},"cast":{"delivery":"instant","range_m":4.6},"effect":"Burns every enemy around you.","rules":["guaranteed_status","every_target"],"base_flat":550,"eff":100},
  {"id":"attack.thunder_storm","name":"Thunder Storm","type":"attack","group":"magic","element":"lightning","cd":10,"mana":"24 flat (AoE x1.5)","basis":"magic","targets":"3","area":{"origin":"caster","radius_m":2.5},"cast":{"delivery":"instant","range_m":4.6},"effect":"Shocks every enemy around you.","rules":["guaranteed_status","every_target"],"base_flat":550,"eff":100},
  {"id":"attack.storm_field","name":"Storm Field","type":"attack","group":"magic","element":"lightning","cd":12,"mana":"20 flat (AoE x1.5)","basis":"magic","targets":"3","area":{"origin":"target","radius_m":2.5},"cast":{"delivery":"ground","range_m":4.6},"effect":"Leaves a charged storm.","rules":["guaranteed_status","every_target"],"effects":[{"stat":"dot_dps","op":"add_flat","value":25,"subject":"target"},{"stat":"dot_sec","op":"add_flat","value":8,"subject":"target"}],"base_flat":800,"eff":90},
  {"id":"attack.poison_cloud","name":"Poison Cloud","type":"attack","group":"magic","element":"poison","cd":10,"mana":"24 flat (AoE x1.5)","basis":"magic","targets":"3","area":{"origin":"target","radius_m":2.5},"cast":{"delivery":"ground","range_m":4.6},"effect":"2 poison stacks. Leaves a toxic cloud.","rules":["every_target"],"effects":[{"stat":"poison_stacks","op":"add_flat","value":2,"subject":"target"},{"stat":"dot_dps","op":"add_flat","value":15,"subject":"target"},{"stat":"dot_sec","op":"add_flat","value":8,"subject":"target"}],"base_flat":600,"eff":80},
  {"id":"attack.venom_bolt","name":"Venom Bolt","type":"attack","group":"magic","element":"poison","cd":8,"mana":"21 flat","basis":"magic","targets":"1","area":{"origin":"target","radius_m":0},"cast":{"delivery":"instant","range_m":4.6},"effect":"Applies 5 poison stacks.","effects":[{"stat":"poison_stacks","op":"add_flat","value":5,"subject":"target"}],"base_flat":445.1,"eff":96.16},
  {"id":"attack.chaos_wave","name":"Chaos Wave","type":"attack","group":"magic","element":"chaos","cd":10,"mana":"24 flat (AoE x1.5)","basis":"magic","targets":"3","area":{"origin":"caster","radius_m":2.5},"cast":{"delivery":"instant","range_m":4.6},"effect":"Marks every enemy around you.","rules":["guaranteed_status","every_target"],"base_flat":550,"eff":100},
  {"id":"attack.entropy","name":"Entropy","type":"attack","group":"magic","element":"chaos","cd":8,"mana":"20 flat","basis":"magic","targets":"1","area":{"origin":"target","radius_m":0},"cast":{"delivery":"instant","range_m":4.6},"effect":"+30% damage against marked targets.","effects":[{"stat":"bonus_vs_status","status":"mark","op":"add_pct","value":30,"subject":"target"}],"base_flat":699.2,"eff":82.4},
  {"id":"attack.stone_spike","name":"Stone Spike","type":"attack","group":"magic","element":"earth","cd":12,"mana":"20 flat","basis":"magic","targets":"1","area":{"origin":"target","radius_m":0},"cast":{"delivery":"ground","range_m":4.6},"effect":"+30% damage against crippled targets.","effects":[{"stat":"bonus_vs_status","status":"crippled","op":"add_pct","value":30,"subject":"target"}],"base_flat":900,"eff":105},
  {"id":"attack.fissure","name":"Fissure","type":"attack","group":"magic","element":"earth","cd":11,"mana":"22 flat (AoE x1.5)","basis":"magic","targets":"3","area":{"origin":"caster","radius_m":0,"shape":"line","length_m":6,"width_m":1.2},"cast":{"delivery":"ground","range_m":6},"effect":"Rends a line, stopping enemies for 1 sec.","rules":["every_target"],"effects":[{"stat":"stop_sec","op":"add_flat","value":1,"subject":"target"}],"base_flat":850,"eff":100}
]
```

`radius_m` stays required on every area; Fissure is a line with `radius_m: 0`. Line membership, aim and footprint projection are already live in `engine/types.ts`, `engine/skill-area.ts`, `engine/skill-actions.ts`, `game/src/sim/combat-actions.ts` and `game/src/ui/combat/arena-vfx-space.ts`; `attack.impale` and `attack.piercing_shot` already use the same shape. No engine change is required.

## 2. `game/src/icon/registry.ts`

Replace `ICON_REGISTRY.skill.byId` with:

```ts
    byId: {
      'attack.fireball': 'fireball',
      'attack.water_ball': 'water-bolt',
      'attack.frost_nova': 'attack-frost-nova',
      'attack.glacial_spike': 'ice-bolt',
      'attack.split_shot': 'striking-arrows',
      'attack.double_strike': 'crossed-slashes',
      'attack.ignite': 'small-fire',
      'attack.cinder_nova': 'fire-wave',
      'attack.thunder_storm': 'lightning-storm',
      'attack.storm_field': 'focused-lightning',
      'attack.poison_cloud': 'toxic-spray',
      'attack.venom_bolt': 'poison-bottle-alt',
      'attack.chaos_wave': 'void-lance',
      'attack.entropy': 'mark-of-the-executioner',
      'attack.stone_spike': 'earth-spit',
      'attack.fissure': 'earth-crack',
    } as Record<string, string>,
```

## 3. `game/src/ui/combat/arena-skill-effects.ts`

Add the `fissure` path at the end of `paths`:

```ts
  fissure: 'M-60 6-41-2-26 7-9-4 8 5 25-5 41 4 60-3M-45-10-33-18-18-12M12-14 22-22 34-17M-20 14-8 22 6 17',
```

Append to `skillFxDefinitions`:

```ts
  ...assign('iceLance', 'attack.water_ball', { projectile: true, pulses: 5 }),
  ...assign('frostbite', 'attack.frost_nova'),
  ...assign('iceLance', 'attack.glacial_spike', { projectile: true }),
  ...assign('arrowShower', 'attack.split_shot', { projectile: true, pulses: 3 }),
  ...assign('backstab', 'attack.double_strike', { pulses: 2 }),
  ...assign('fireball', 'attack.ignite'),
  ...assign('firestorm', 'attack.cinder_nova'),
  ...assign('thunder', 'attack.thunder_storm'),
  ...assign('chainLightning', 'attack.storm_field'),
  ...assign('cloud', 'attack.poison_cloud'),
  ...assign('poisonBolt', 'attack.venom_bolt'),
  ...assign('voidBlast', 'attack.chaos_wave'),
  ...assign('chaosBolt', 'attack.entropy'),
  ...assign('earthSplitter', 'attack.stone_spike'),
  ...assign('fissure', 'attack.fissure'),
```

## 4. `game/src/ui/combat/arena-active-vfx.ts`

Add the two shapes that have no arena recipe yet:

```ts
  cloud: fx('storm', 'smoke-1428', 'smoke-1075', 175, 1.4, 'ring-1712'),
  fissure: fx('thrust', 'spark-1247', 'burst-926', 190, .6),
```

Every other shape above already has an `ACTIVE_VFX` entry.

## 5. Wiring notes

- `grantSkill` draws from `sm.all()`, so all 15 rows enter the drop pool with the data change; no grant list or save key changes.
- `attack.stone_spike` reads `crippled`; the writer in the live roster is `attack.earth_shock`, which is outside this set.
- Icons and FX use existing shelf art; no new PNG or atlas is required.

## 6. Verification

```powershell
npm run skills -- --checks
npm run typecheck
npm --prefix game run check
npm --prefix game run test -- skill-area combat-arena combat-timing combat-presentation skill-fx
npm run wiki
npm --prefix game run build
```

Browser check: `http://localhost:5173/__showcase#showcase-field`, 1920 × 1080; cast each row and check projectile/impact, status on every target, hover text, icon and Fissure's line aim.
