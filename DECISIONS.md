# Decisions (draft — owner editing)

Standing intent, in force now. Not a log: a rule that stops holding is deleted, not archived.

This file owns what the design means, so a proposal is judged on intent first and on letter
second. When intent and letter differ, ask the owner — never block on a reading the owner has
not confirmed. The owner can always override; an override is a normal follow-up, not a violation.

## How to think

**Start from the intent, then the model.** Read what the game means first, the rules and data
second, and land the shape both make room for. A ban that fires against the game's own meaning
is the ban misfiring, not the proposal.

## Standing intent (edit me)

- **One static HP table.** `mob_HP` is published per zone edge, never priced from player DPS;
  power is measured against it, never into it.
- **A dungeon run is a mode, not a place.** One dungeon per zone on its settlement's first wild
  side. A run fields `mob_cap` normals in encounters of `group_cap` and pays the ordinary
  per-kill roll into escrow; the escrow pays out on the last mob, a Push forfeits it, and a
  cleared run cools down for `cooldown_sec`. All four numbers live in `engine.json` `dungeon`.
- **One imprint stone per Mod.** An imprint stone rewrites one Unbound line as its own Mod with
  a fresh roll, one stone a use. A piece remembers its drop-time Unbound count, so the +2 Add
  cap is net: Remove refunds room, and every stone charges one piece a press.
