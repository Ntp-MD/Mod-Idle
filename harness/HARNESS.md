# Harness

Agent operating rules for this repo. Adapted from the Continental-Idle harness; the shape is
borrowed, the values are ours.

**Why this file exists:** coding agents fail in predictable ways — they lose the thread mid-task,
run the wrong checks, and declare victory early. The rules below are the counter.

**Division of ownership:** this file owns agent behaviour. `AGENT.md` owns this project's rules,
terminology bans, and the doc layout. Neither restates the other.

## Read chain

1. `AGENT.md` — project rules. Read first.
2. This file — how to work.
3. `glossary.md` — shared language. Read when a term is load-bearing; patch it when one locks.
4. `harness/todo.md` — the single work file: what is open, and what is in flight right now. Read at
   task start.

Design docs live under `doc/<layer>/` (see `AGENT.md` §4); they are addressed by bare name
(`glossary.md`), so the files above are found at `doc/start/glossary.md` etc.

## Verify routing

**`node tools/verify.ts` is the only verify entry point** and it is pre-authorised. Run it after
any edit, fix what your change broke, rerun without asking. Do not run it to "check whether it is
worth running" — it always is.

It runs twelve cages in order: engine (`check`), town, skills, tree, ladder, loot, bases, timeline,
survival, inventory, anchor, and doc lint. The last one is the referential-integrity pass over the
markdown — it is what catches a file you moved or a name you retyped.

Rebuild the views after a doc edit: `node tools/report.ts` (dashboard) and `node tools/wiki.ts build`.
The writer that owns a generated block is the `--write` flag of that block's cage.

**One command for the whole build:** `node tools/build.ts` runs every writer, then `verify`, then both views
and stops at the first failure (`--check` skips the writers and only verifies + rebuilds). Use it unless you
are fixing one specific cage.

**Mid-task re-anchor:** after roughly eight file edits, or after any context cutoff, re-read
`harness/todo.md`. If the open work no longer matches what you are doing, fix the file before editing
again.

## The work file

`harness/todo.md` is the **single work file** — there is no second slot and no per-topic scratch
file. It holds two things and nothing else:

- **Open work** — what is not built yet, split by who can close it.
- **One line naming what is post-release** and deliberately not tracked.

The shape of the repo, where the numbers live, and the standing rules are `AGENT.md`'s job
(§0 project phase · §4 structure), not the work file's — the work file names work and nothing else.

Write it silently after a meaningful step: a user order, a context shift, a root cause, a landed
choice. Do not narrate the write.

## Clearing the slate

**When work is done, the line is deleted — not ticked, not struck through, not summarised as
"recently closed".** A work file that accumulates finished items stops being a work file: it becomes
a changelog nobody reads, and the next session has to wade through it to find the three things still
open.

- **Never write a closing paragraph in place of deleting the line.** A tidy summary of completed work
  is the same clutter in nicer clothes.
- A parked task (moved to post-release, or waiting on an owner ruling) is a single line under the
  post-release note — never left to rot in the open list.
- If a line turns out to be already true when you re-read it, delete it on the spot.

## Tooling

Use the tool that answers the question instead of editing a doc to find out.

- **See a value's effect without editing docs** — `node tools/skills.ts --calc --stat N --power N --level N --cdr N --ladder N` prints dmg/press · eff cd · presses/sec · mana%/s for every attack skill, and `node tools/report.ts` carries the same as a live "Skill workshop" section. Both read `tools/lib/skillmodel.ts`.
- **Edit data through the wiki editor** when a form is faster than the JSON — `node tools/wiki.ts serve --open` (loopback only) renders every `tools/data/*.json` collection as a validated form, then runs the writers + every cage + lint and rolls back on failure. Direct JSON edits work too.
- **Rename a skill or aura** — change the `name` in `skills.json`, add `"Old Name": "New Name"` to its `renames` map, then run `node tools/tree.ts --write`; the node `Enables` cells update themselves. `tools/tree.ts --checks` reports any cell still on an old name as PENDING until you do. Never retype the name into a doc.

## Report format

Verdict line first: `<task> — DONE | PARTIAL | BLOCKED (<n>/<total>)`. Then Changed / Decisions /
Gaps (`(none)` when empty) / Verify with the exact command and its result. Every item carries a
status tag so "did it change?" is never inferred. No tables. Audits are read-only and say so.

## Decisions and asking

- **Decide, don't stall.** A reversible in-repo choice is made now and logged as veto-able —
  including unrequested scope growth, new tooling, and interface picks. A veto is a normal follow-up.
- **Ask only for:** a change to the game's rules that the owner must rule on, anything irreversible,
  and genuinely missing information. Asking is the last resort.
- **Look it up, never ask for a fact.** Every number in this repo is computed by a cage; if a fact is
  not in the data, say so rather than estimating.
- **Claim then impact:** when the user reports a problem, verify it against the docs first and state
  what is actually true before changing anything.

## Scope

Fix what was asked. Unrequested cleanup is a separate ask, even when it is obviously right — this
repo has spent a session collapsing duplicate data on purpose, and doing that uninvited is the same
mistake in the other direction.

If the requested change turns out to be much larger than it looked, say so before starting rather
than three files in.

## Zero duplication

**Never create a second home for a fact that already has one.** If a number lives in
`tools/data/`, the writer prints it; a second document restating it is a defect, not a convenience.
The same goes for a glossary and a work file — one each, and this repo has already
deleted the duplicates that used to exist.
