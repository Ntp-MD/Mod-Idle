<!-- BEGIN GENERATED:buff-heading -->
# 6 buff skills
<!-- END GENERATED:buff-heading -->

import glossary.md
import skill-pool.md

<!-- BEGIN GENERATED:buff-roster -->
| Skill | cd | mana | Duration | What it does |
|---|---|---|---|---|
| Warcry | 15 sec | 10% | 10 sec | Physical power x1.15 and Elemental alignment and Elemental resistance x1.20 while up |
| Berserker | 15 sec | 10% | 10 sec | Attack speed x1.20 and leech +15%, and damage taken x1.15 while up |
| Iron Will | 15 sec | 10% | 10 sec | Armour x1.20 and damage taken x0.90 while up |
| Holy veil | 20 sec | 12% | 7 sec | No Element debuff (burn, chill, shock, poison, mark) or bleed can be applied while up, and casting it clears the ones already on you |
| Ghost Dance | 15 sec | 10% | 10 sec | Grants perfect dodge charges: 3 at skill level 1, +1 every 5 levels up to 7 at level 20 · each charge deletes one incoming hit outright and is not opposed (stops DoT ticks and unconditional effects) |
| Magia Drive | 20 sec | 12% | 8 sec | Forces Energy Shield to start recharging immediately (ignores the 5 sec delay) and the recharge is not interrupted by hits while up |
<!-- END GENERATED:buff-roster -->

> The previous 14-name buff set was cleared for a redesign (`harness/decisions.md` D-009). These six replace it. Every one is a **timed self-buff**: none reserves mana — only auras reserve — and none persists between fights.
>
> **How the six divide the job.** Warcry and Berserker buy output and pay for it differently — Warcry is flat and safe, Berserker is the fastest thing in the list and makes every hit you take worse. Iron Will is the only buff that touches Armour, and the only defensive multiplier besides Berserker's downside. Holy veil is the only one that touches the Element layer, and it is the answer to a hole the Elements opened: per D-018 they take HP regen, Armour, attack speed and your own Alignment away, and Elemental resistance never answered any of it because res only ever covered the Element **half** of a hit. Ghost Dance is the perfect-dodge answer — charges that delete a hit outright, so it stops what dodge and res cannot (DoT ticks, unconditional effects). Magia Drive is the Energy Shield answer — it deletes the 5-sec recharge delay and keeps the shield filling through a fight, so the caster's second pool becomes a sustained layer for its window instead of a between-groups top-up.
>
> **`damage taken` is a real modifier, not a phrase.** It multiplies incoming damage after armour, res and dodge have all resolved (`combat.md` §2), so `Berserker` and `Iron Will` are exact opposites on the same line: ×1.15 and ×0.90 against the same hit.
>
> **Nothing here is folded into `mob_HP` yet.** Six timed buffs are new power on stats the player spends skill slots on, and the `Haste` aura adds a post-Cap cooldown multiplier plus ×1.15 final aspd on top. `checks.md` D34 owns that fold (H1).