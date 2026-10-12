# Formula

One Core model for both sides: Core is whole points, and every derived line is a `Base` plus a `K_core` term through the one `K` table. The keys are in `engine.json`, the math is `engine/index.ts`, and nothing restates it.

- Stat value ← `base` + points × `point_value`.
- Stat points a level grants ← `points_per_level`, and `paragon_points_per_level` past `paragon_from`.
- Reference line ← the level's points split evenly over the seven stats (`statAt`). Every published number, and `mob_HP`, is priced against that line, never against the player's own allocation.
- Mob Core ← one integer block per species (`mob.species[].core`), scaled from `mob.stat.base_zone` and rounded. No mob runs a formula of its own.
- Max HP ← `hp_base` + Vit × `K_VIT_HP` + the `hp_per_level` term, lifted by `hp_pct`, plus `hp_flat`.
- HP regen ← Vit × `K_VIT_REGEN`, lifted by `hp_regen`, plus `hp_regen_flat`.
- Max Mana ← `mana_base` + Int × `K_INT_MP` + the `mp_per_level` term, lifted by `mana_pct`, plus `mana_flat`.
- Mana regen ← Int × `K_INT_MREGEN`, lifted by `mana_regen`, plus `mana_regen_flat`.
- Energy Shield ← Wis × `K_WIS_ES` plus `energy_shield_flat`, lifted by `max_energy_shield_pct`. Player-only, and chaos bypasses it.
- Energy Shield regen ← the max pool × `energy_shield.regen_pct`, once `energy_shield.delay_sec` pass unhit, amplified by `es_regen`.
- Physical power ← (Str × `K_STR` + `phys_flat`) lifted by `phys_pct`, times the weapon's `weapon_mult`.
- Magic power ← (Int × `K_INT` + `magic_flat`) lifted by `magic_pct`, times the weapon's `weapon_mult`.
- Elemental power ← Int × `K_ELEM` plus `elem_flat` for the weapon's own Element, lifted by `elem_pct`. Every added Element line keeps its own pool.
- Accuracy ← Dex × `K_DEX_ACC`, lifted by `accuracy_pct`.
- Evasion ← Agi × `K_EVASION` plus `evasion_flat`, lifted by `evasion_pct`. One opposed roll against the attacker's accuracy, capped at `caps.evasion`.
- Armour ← Str × `K_ARMOUR`, plus `armour_flat`, lifted by `armour_pct`. It mitigates by `armour / (armour + armour_divisor × raw)`.
- Attack speed ← `weapon_aspd` × the `base`-relative Agi term × `K_AGI_ASPD` plus `aspd_pct`, lifted by an aspd buff, cut by encumbrance, then capped by `caps.attack_interval_sec` (the cap is a minimum interval).
- Crit ← Lck × `K_LCK_CRIT` plus `crit_pct`, held as one pool: the chance is the pool under `K_CRIT_CAP`, and the overflow past it buys crit damage.
- Perfect dodge ← Lck × `K_LCK_PDOGE` lifted by `pdodge_pct`, read against `K_PDOGE`. No Cap.
- Block ← the shield's `block_pct` line plus the passive tree's `block_chance` node (`tree.json`), and a blocked hit is cut by a flat share of armour. No Cap.
- Stun chance ← Alignment × `K_STUN_PER_ALIGN` plus `stun_chance_pct`. No Cap.
- Elemental resistance ← the gear Mod rows only, because no Core stat feeds it. Hard ceiling `caps.elem_res`, raised only by a passive-tree node (`elem_res_max`).
- Elemental alignment ← Dex × `K_DEX_ALIGN` plus the `elemental_alignment` Mod rows, times an alignment buff. No Cap.
- Stun Recovery ← Vit × `K_VIT_STUNREC`, bounded at both ends; it cuts a shock's `stop_sec`.
- Cooldown reduction ← Wis × `K_WIS_CDR` lifted by `cdr_pct`, capped at `caps.cdr`.
- Weight capacity ← `weight_base` + Str × `K_STR_WEIGHT`. Going over taxes attack speed up to `caps.weight_overload`, and locks no slot.
- Drop rate ← the band's own rate (`loot.base_drop_chance`), lifted only by the Mastery bonus (`mastery.dropMultiplier`). No Core stat feeds it.
- Every Cap binds last, after the Mod lines, the buffs and the weight tax.

# Skill Rules (Active , Buff , Aura)

- active skill cost only flat unit
- aura skill cost reserved max mana

# Gameplay

- The loop ← pick a zone, fight it, gain XP and items and crafting currency, decide equip or craft, move on.
- Two states, and AFK says nothing about which. **Adventure** is a zone: combat, loot, the adventure bag fills, no crafting and no deposit. **Settlement** is a settlement: deposit, stash, craft, restock, no combat.
- Travel is walking. Any cell may be stood on, a settlement owns its own cell, and a walk is a count of blocks — `road.block_sec` a block, `road.encounter_chance_pct` an ambush a block (`road.cost_rule`).
- An encounter is an ordinary group from the lower of the two zones, and it pays the ordinary drop roll and nothing else: no gold, no Standing, no stones (`road.encounter_rule`).
- A Waypoint is a settlement opened by arriving there on foot. After that a warp is instant and costs gold at the destination's own band (`road.waypoint_rule`).
- Hunt is leaving safe ground to fight from the cell the feet stand on (`road.standing_rule`): a side carrying a sub-zone fields that side's cast, and ground carrying none rolls the zone whole. Only ground inside an opened settlement's zone may be hunted.
- A zone is a level band owning its mobs, its quality band and its `mob_HP`, with one Element and a race pair a sub-zone (`mob.zones`).
- A spawn is a group sized by the zone's own `group` range and rolled inside one sub-zone. Small and Medium form groups; Large, Elite and Boss appear alone (`mob.sizes`).
- A mob's Core is an integer block per species (`mob.species[].core`), and its level inside a zone is static (`mob.species[].zone_levels`): a spawn never follows the attacker's level.
- Elite is a flag forced onto a Large body, never a size of its own and never a fifth body class (`loot.elite_spawn_chance`).
- A boss is one per zone (`mob.bosses`) and fightable at every level. It is the only place high-quality gear drops without crafting, and a skill piece drops from any kill at its own rate (`skill_drop`).
- A dungeon run is a mode, not a place: one per zone, on its settlement's first wild side, fielding `dungeon.mob_cap` normals in encounters of `dungeon.group_cap`, and cooling down for `dungeon.cooldown_sec` after a clear.
- A run pays the ordinary per-kill roll into escrow instead of pocketing it. Escrow pays out on the last mob, and a Push forfeits it.
- A Push is not death. HP reaching zero pushes the fighter out of combat; it rests at camp and walks back in alone. Time is the only thing the game charges (`road.push_rule`).
- Camp is the settlement that owns the current zone, and nothing else.
- A Push returns the preset to the main one, and cooldowns already counting keep counting (`presets`).
- XP comes from kills alone (`xp.per_kill_mob_level` against the mob's own level), with `xp.elite_mult` and `xp.boss_mult` on the two ranked variants.
- A level grants points, not stats: `stat.points_per_level` and `stat.tree_points_per_level`, with `stat.paragon_points_per_level` past `stat.paragon_from`. Respec is free, and a settlement service.
- Every gear drop is one decision: keep it, dissolve it for a Value stone, or sell it for gold. One piece pays one medium, never both.
- Four drop streams, each its own roll: gear (`loot.base_drop_chance`), junk (`junk`), herbs (`herbs`) and a skill piece (`skill_drop`). Stones come off the crafting ladder, never a stream of their own.
- The bag filter is off by default and armed a slot at a time. An armed slot keeps a drop only when it beats the worn piece in that slot by more than `loot.filter.upgrade_margin_pct`; a rejected piece dissolves for one Value stone, never for gold.
- The adventure bag holds kept gear (`inventory.adventure_slots`): one piece a slot, weight counted. Full pauses pickups, auto-converts nothing and deletes nothing.
- The character bag holds carried consumables (`inventory.character_slots`), with stones stacking weightlessly and herbs and potions weighing `inventory.unit_weight`.
- Nothing that cannot be carried is thrown away: a piece over the bag line is left on the ground, and the client says which happened.
- The stash is a settlement warehouse bought with gold, organisation only, and deposit and withdraw only happen standing in a settlement.
- Herbs and potions are consumed, never equipped and never sold, and the filter always keeps them.
- Junk is per variant (`mob.variant_drops`), and each grade's `drop_chance_per_kill` is set to the same expected gold a kill (`junk`): the dearer the junk the less often it drops, so a grade buys frequency and never income.
- The status mirror: our DoT and damage-shaping debuffs land on mobs in full, control is bounded (`caps.stun` and the per-status aspd cuts, never a lockout), and a mob's innate Element still lands its status on us at `status.proc_chance`.
- The task board is the daily direction layer, offered as an Elite hunt and a Boss hunt only (`town.json` `task_sizing`), paid in stones and sized inside `task_sizing.income_bound_pct` of the day's loot flows.
- Minute one is one read of `opening` and nothing else: the settlement, the level, one frame at the floor of its own window per slot, no skill and nothing bought.
- The win condition is the last zone's boss, killed inside one single spawn without a Push (`game/src/sim/goal.ts`, read by the survival cage `tools/survival.ts`).
- Nothing after the win: the levels past it are the item-quality push in the final band, and the remaining goals are counted, never timed.
