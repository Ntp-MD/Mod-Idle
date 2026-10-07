# Item Level

import glossary.md
import mod-pool.md
import item-base.md
import crafting.md
import loot.md
import save.md

An item has **one axis of strength: its level** (`ilvl`), stamped at drop by the source that paid it.
Rarity — the old "how many Mods" axis — is **gone**, and Item quality as a separate axis is gone with it:
the two names described one story (the drop source's level), so the level answers it directly.

- **The line count is fixed.** Every drop arrives with the same lines: the Base Mod, the Legacy pair and
  the two Random lines the Add craft owns (`item_level.line_count`). A drop is never "a lucky seven".
- **The level answers the value range.** Each Mod line has a **window** that climbs with the level, and
  the roll inside it decides what the line is worth.
- **The band label rides along** (`low` · `mid` · `high`), read off the zone the drop came from. It still
  drives the things that were always banded — item weight, the flat-group weight step, task and town bands
  — so nothing measured against a band moves. Only the *values* became continuous.
- **Tier** (`T1` · `T2` · `T3`) is which third of the window the roll landed in, not a third axis.

# The window

For one Mod at one level, inside one band:

| | Rule |
|---|---|
| Ceiling | the band's own top — the last slice of that band's ladder in `mods.json` |
| Floor | climbs from **the band below** (the first band's floor is its own) |
| Inside | a uniform roll in one third of the window |

- The band ladders in `mods.json` are the **anchors** of the window — the same tables the old value axis
  read, reinterpreted as a curve over the level. No table was re-written to make the axis continuous.
- A level past its band's span **clamps** to the band's own window. That is what keeps the later loops
  honest: a low-band zone at a high level still drops a low-band piece, exactly as its zone label says.
- The **floor climbs with the level** (owner ruling): a mid-band piece starts able to roll the low band's
  floor and ends above it. Long play still cannot be handed repeated junk, because the floor it can roll
  never falls — but a high-level piece *can* still come out at the bottom of its own window.

# The roll inside the window

| Where the roll lands | Share | Name |
|---|---|---|
| Top third | 17% | **T1** |
| Middle third | 33% | **T2** |
| Bottom third | 50% | **T3** |

- **Best is never free**: the top third is the rarest outcome at every level, so a high-level drop is a
  chance and not a formality. This is the property the published weights always meant to carry
  (`mod-pool.md` owns the skew bound).
- The thirds are uniform for every Mod, so the skew is one rule rather than a per-Mod ladder — and
  `Refine` moves a line up exactly one third (`crafting.md`).

# The level vs the drop source

| Drop source | Level the piece is stamped with | Band |
|---|---|---|
| a mob | the mob's own level | the zone's own label |
| an away window (offline) | the band's first level | the zone's own label |

- **Offline is the floor of the band**, which is the old "quality limited to the zone floor" rule said in
  the new terms (`save.md` · `loot.md` section 7): the away window rolls nothing above the first level of
  the band the character was fighting in.
- **The band comes from the zone label, never from the level.** `mob.zones` already declares it
  (`low` · `mid (floor = low)` · `high (floor = mid)`), and the later loops depend on it: the level rises
  past the first loop while the band restarts, which a pure level rule would silently "fix" into a
  stronger band.
- The floor/ceiling annotations the zone labels still carry are **vestigial**: the window's floor is now
  the band ladder's own rule, so `mid (floor = low)` and `mid` produce the same window.

# Ascend, Refine, Add

- **Ascend** raises the piece one band **and** its level one span, so the window moves up a band without
  re-rolling what the player already has. Cleared by the boss Core, exactly as before — an item's band can
  exceed the zone it came from.
- **Refine** moves one line up one third of its window — the same step the old Tier ladder made.
- **Add** fills one of the two Random lines every drop leaves open, so its price and its cap
  (`mods_added_cap`) are unchanged by the axis: the gap it fills is now every piece's gap rather than one
  Rarity's.

# What the axis buys

- **A reason to keep hunting inside a band.** Values climb with the level, the roll inside the window is
  skewed low, and the band follows the zone — so a drop can always be a real decision, which `loot.md`
  section 3 names as the thing a zone otherwise loses.
- **One axis to price.** Weight, task bands, town bands and the flat-group weight step read the band; the
  values read the level. There is no second axis to reconcile, and no "high-quality Common vs low-quality
  Rare" paradox to explain.

# Waiting Items

- **The mod ladders stay as they are.** They are the anchors the window interpolates between, and the
  per-band tables `mods.json` publishes are the numbers every other file already reads; collapsing them to
  one min/max pair per Mod is not planned.
- **Crafting and res** — Decided that **Element cannot be locked**. See crafting.md.
- The A10 consequence is closed: every weapon type carries its frames in `item-base.md`'s frames table,
  gated by `bases.ts`.
