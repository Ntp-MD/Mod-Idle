# Decisions

The standing decisions of this project, written as constraints that are **in force now**.

**This is not a log.** Nothing here records when a ruling was made, who made it, or what was tried
first. A decision that holds is a rule the work is measured against; a decision that stops holding
is deleted, not archived. If a line is only true because it happened once, it does not belong here.

**What lives where.** `AGENT.md` owns the project shape — phase, terminology, number discipline,
doc layout, git — and, in its How we work section, how an agent works: verify routing, report format,
when to decide and when to ask. `todo.md` owns the open work. This file owns the two things they do
not: **what is forbidden**, and **how to think about a change before it lands.**

**How to read an entry.** Every decision is three parts:

- **Forbidden** — the thing that does not go in, stated so a proposal can be checked against it.
- **Holds because** — the reason it survives pressure. A decision with no reason is a preference, and
  a preference is the first thing to get argued away.
- **Ask** — the question to put to a proposal before implementing it. A change that cannot answer is
  not ready.

---

## How to think

The reasoning stance this project is built on. It is here because it decides proposals before they
become systems.

**Start from the model, not from the feature.** A request names a thing to build; the shape that
fits is found by reading the rules, data and cages already on disk and asking what they already make
room for. Where the requested shape and the fitting shape differ, the fitting one lands.

**Name the number before moving it.** Any change that moves a published number goes data → writer →
cage. If you cannot say which key in `tools/data/` owns a figure, the change is not understood yet.
The rules for where numbers live are `AGENT.md` §3; this is the habit that follows from them.

**The smallest change that fixes the problem.** The design is frozen. The default is the fix, not
the redesign that would have been nicer to design. Adding a shelf, a cage, a data file or a system
is an owner decision, never a side effect of a fix.

**Do not cargo-cult.** This project is deliberately not a template and does not follow another game's
conventions by default. When a stock pattern does not fit — a passive tree, a prestige reset, a
second resource skill — say why it does not fit and fit the design instead. The stock answer is the
one that needs no argument, which is exactly why it needs one here.

**Originality is the point.** The owner's framing is that this game is built to satisfy their own
requirements and that the design has no precedent. Treat that as a standing reason to look for the
shape no existing idle game uses, rather than the shape that is safe and familiar.

**A gate is a promise; a prose rule is a hope.** If a rule has to hold, it belongs in a cage with a
number attached, because a rule that lives only in prose drifts the moment the data moves. Write the
gate before the change, not after it — a decision that cannot be expressed as a gate probably is not a
decision yet.

**State the consequence before the implementation.** Before landing, say what the change makes
possible that was not possible before. If the answer is "nothing new", it is a refactor and should be
named as one. If the answer is "more power", the fold below applies.

---

## D1 · No power system lands outside `mob_HP`

**Forbidden:** a new system that makes the player stronger without folding into the `mob_HP` model
(`checks.md` H1). Power that bypasses the curve is power the design never priced.

**Holds because:** `mob_HP(L)` is the spine every balance number is measured against — the loot
bands, the zone edges, the survival tables and the fold itself. A second source of player power
cannot be folded into a curve that only knows one.

**Ask:** name the term of `mob_HP(L)` this change moves. If there is none, there is no home for it.

## D2 · Mastery carries no per-weapon damage

**Forbidden:** a per-weapon DPS bonus delivered through mastery.

**Holds because:** weapon identity is carried by the weapon's own stats and Mod lines, not by a
second multiplier layered on top of them (`equipment-weapon.md`). Mastery that scales damage would
make the strongest weapon stronger still, and the ladder stops being about the choice.

**Ask:** what does this change make a *different* weapon worth choosing for? If the answer is only a
percentage, the pool is already carrying it.

## D3 · A Cap that cannot be reached is a lie

**Forbidden:** creating a new Cap that nothing in the game can actually hit.

**Holds because:** a Cap is a promise to the player that progress still ends somewhere. One that
cannot be reached is a number that teaches the player their growth is unbounded while the design
means it is not. Every Cap must state whether it is reachable (`formula.md`'s Cap table).

**Ask:** which build, at what level, reaches this Cap? Show the row, not the reasoning.

## D4 · Rarity, Item quality and Tier are three different things with three fixed names

**Forbidden:** the bare word `quality` for Rarity, and `tier` where the term is Item quality. The
fixed words in `AGENT.md` §2 are the only names these three things have.

**Holds because:** one item answers three separate questions — Rarity = Mod count, Item quality =
value range, Tier = sub-range. Using one word for two of them is how a loot table ends up
generating a rule nobody wrote.

**Ask:** which of the three questions is this sentence answering?

## D5 · One Alignment stat, one Armour rating — and nothing beside them

**Forbidden:** a second armour or damage-reduction stat beside the Armour rating, and a separate
status-alignment stat. **Status Alignment resistance % is a Mod line and nothing else** — a % cut on
the 20% status proc in `combat.md` §5, read at the `rollStatus` call (owner ruling 2026-10-04). It
has no Core stat behind it and must never become one.

**Holds because:** every mitigation layer that lands has to be priced against the same pool, and the
survival tables are only readable while the mitigation stack stays small enough to see.

**Ask:** which existing layer is this adding to, and what does the survival table read afterwards?

## D6 · Near and far are the reach queue, not coordinates

**Forbidden:** tiles, movement speed, aggro radius, or any coordinate model. The **reach queue** in
`combat.md` §2b (**X33**) is the whole positional system.

**Holds because:** the game is an idle RPG with no player steering. A position model would be
simulation the player never sees and never controls, and it would make every balance number depend
on traversal the design does not have.

**Ask:** does this need to know *where* something is, or only *how far away* it is?

## D7 · No player-to-player trade

**Forbidden:** player-to-player selling, trading, or any market between players.

**Holds because:** there is no server (`save.md`). The save file is the whole world state, so anything
one player hands another has to travel through a client the design does not trust.

**Ask:** what carries this between two clients? If the answer is a save file, it does not go in.

## D8 · Gold buys convenience, never power

**Forbidden:** a third mint for gold, a gold↔stone exchange, or gold buying gear, Mods, potions,
crafting stones, or any `mob_HP`-relevant service. Gold has exactly two mints — mob junk sold at the
Counterhand, and bounded Road events. NPC stalls buy space, time, information and appearance only
(`economy.md` · `towns.md`).

**Holds because:** stones are the power currency and gold is the convenience currency; the moment
they trade, the seven stones stop being a separate decision. The guards that keep the mint bounds
true live in `checks.md` G6–G9.

**Ask:** what does this let gold buy that a stone cannot already do for?

## D9 · No food or cooked-meal buff layer

**Forbidden:** a food or cooked-meal buff layer. Provisioning is herbs → potions only (`farm.md`),
and the timed-buff roster (`skill-pool-buff.md`) is the whole buff layer.

**Holds because:** a second provisioning track that feeds combat is a second economy the numbers
would have to price, and the design already answers "what do I do between fights" with skills.

**Ask:** is this a new source of timed combat power, or does it only feed the existing potion path?

## D10 · Farming is the only life skill and grants no power

**Forbidden:** a second resource skill, and any Farming level that buys combat power (owner ruling
2026-10-03).

**Holds because:** Farming is a leveled provisioning track — plant → grow → harvest for Farming XP and
herbs (`engine.json` `farm`). Because it yields only potion ingredients and never gear · Mods · DPS ·
stats, it is exempt from the `mob_HP` fold in D1. That exemption is the whole reason it stays honest,
so a Farming level that buys power would remove the exemption's basis.

**Ask:** does this make a Farming level stronger in a fight? If yes, it is not provisioning.

## D11 · The player's stat allocation is theirs; the AI only balances the numbers

**Forbidden:** telling the player which Core stat to put a point into, "correcting" a build they
chose, presenting one allocation as the right one, or tuning a number in a way that makes one
allocation strictly better than the rest. The AI's job is to make every choice a real choice by
pricing each line correctly — never to make the choice.

**Holds because:** a Core stat is **spent, not granted** (`core-stats.md`); the point of handing the
player points instead of stats is that the build becomes theirs to express. An agent that picks for
them takes back the one decision the system exists to give them, and a number tuned toward a single
correct build quietly deletes every other one.

**Ask:** does this change tell the player what to pick, or only make each pick worth making? A
number is finished when no allocation is strictly dominated — not when one of them wins.

**The Mod layer obeys the same rule.** A Base frame carries a **primary** pool and a **secondary**
pool (`bases.json`) — `Max HP flat` against `Elemental resistance %`, and so on — so which line a
piece offers, and whether it is flat or %, is the second place a build is expressed. Forbidden here
too: naming the Mod a player should take, or the frame they should wear, and tuning a Mod's range so
one line always beats the others. Flat and % exist to be a real trade that changes with level, quality
and Rarity; if one side wins everywhere, the ranges are wrong — not the player's taste. The AI's job
is to keep every quality band and every craft verb (`Reroll` · `Refine` · `Ascend`) a genuine choice
by pricing them honestly.

**Ask, for a Mod change:** does this make flat or % the obviously better pick? If yes, the ranges are
the defect.

**What this does not forbid.** The game's own even-split **auto-allocate toggle** stays: it is a
convenience the player turns on, and a player who wants it off keeps it off. The **reference build**
(even split over the seven stats) stays too, but it is a *measurement baseline* — the thing
`mob_HP` and every published number are priced against — and never a recommendation. The themed
builds in `game/tests/gearedB1.test.ts` and the four `tools/survival.ts` themes (thirteen items
each carrying their own defensive line at the maximum) are the same kind of instrument. Measuring
against a build is not choosing it for the player.

## D12 · Kills and loot come from the build, never from a rate

**Forbidden:** a published per-hour or per-minute figure as the source of what a player kills or earns —
`kills/hr`, `drops/hr`, `upgrades/hr`, `gold/min`, and a price unit quoted in minutes. A rate that
decides income is a second power system, and the player never bought it.

**Holds because:** how much a player kills, and what that pays, is the *build's* answer — the gear and
Mods they wear, the skill list they press, the tree they spent, the zone and hunting ground they chose.
The design has no time limit and no play-length target (`AGENT.md`), so nothing is priced by the clock:
a rate says what an hour holds, while the build says what the hour is worth. Publishing the rate as a
source lets time stand in for power, and every price then moves when the cycle does instead of when the
build does.

**Ask:** does this number tell the player what *their* build earns, or what an hour holds? A rate may be
*derived* from mechanics — the clear cycle, the group a zone fields, the gap between groups — for a
tool's own arithmetic, and that is the only place it lives: it is never the published source, and never
a unit a price is quoted in.
