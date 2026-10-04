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
3. `harness/handoff.md` — the live slot: what is being worked on right now. Read at task start.
4. `glossary.md` — shared language. Read when a term is load-bearing; patch it when one locks.
5. `harness/decisions.md` — what was ruled and why. **Only when the user asks about a past decision.**
6. `harness/todo.md` — the open-work queue. Read when picking what to do next.

Never read `harness/decisions.md` to decide the current task; it is history, not instruction.

## Verify routing

**`node tools/verify.js` is the only verify entry point** and it is pre-authorised. Run it after
any edit, fix what your change broke, rerun without asking. Do not run it to "check whether it is
worth running" — it always is.

It runs ten cages in order: engine, town, skills, tree, ladder, timeline, survival, inventory, anchor, doc
lint. The last one is the referential-integrity pass over the markdown — it is what catches a file you
moved or a name you retyped.

Rebuild the views after a doc edit: `node tools/report.js` (dashboard) and `node tools/wiki.js build`.
The writer that owns a generated block is the `--write` flag of that block's cage.

**One command for the whole build:** `node tools/build.js` runs every writer, then `verify`, then both views
and stops at the first failure (`--check` skips the writers and only verifies + rebuilds). Use it unless you
are fixing one specific cage.

**Mid-task re-anchor:** after roughly eight file edits, or after any context cutoff, re-read
`harness/handoff.md`. If the Mission no longer matches what you are doing, fix the slot
before editing again.

## The live slot

`harness/handoff.md` is the **single live slot** for the task in flight. Never a second
one per topic. Four headers, never deleted:

| Header | Holds |
|---|---|
| Mission | what this task is, in one paragraph |
| Plan | the steps, each tickable |
| Blockers | what is stopping progress, or `- (none)` |
| Hand-off Note | the next agent starts here |

- Update it after every meaningful step: a user order, a context shift, a root cause, a landed choice.
- Slot writes are silent — do not narrate them.
- **Finish:** tick every Plan box, log the entry in `harness/decisions.md`, then clear the slot back to the
  empty shape. **A task is not done while the slot is stale.**
- A parked task (moved to post-release, or waiting on an owner ruling) is cleared from the slot and
  left in `harness/todo.md` — not left to rot in the slot.

## Tooling

Use the tool that answers the question instead of editing a doc to find out.

- **See a value's effect without editing docs** — `node tools/skills.js --calc --stat N --power N --level N --cdr N --ladder N` prints dmg/press · eff cd · presses/sec · mana%/s for every attack skill, and `node tools/report.js` carries the same as a live "Skill workshop" section. Both read `tools/lib/skillmodel.js`.
- **Edit data through the wiki editor** when a form is faster than the JSON — `node tools/wiki.js serve --open` (loopback only) renders every `tools/data/*.json` collection as a validated form, then runs the writers + every cage + lint and rolls back on failure. Direct JSON edits work too.
- **Rename a skill or aura** — change the `name` in `skills.json`, add `"Old Name": "New Name"` to its `renames` map, then run `node tools/tree.js --write`; the node `Enables` cells update themselves. `tools/tree.js --checks` reports any cell still on an old name as PENDING until you do. Never retype the name into a doc.

## The queue and the slot are different things

`harness/handoff.md` is one task in flight. `harness/todo.md` is every task not yet
built. Do not move backlog items into the slot until they are actually started — the slot is not a
todo list, it is a resume point.

## The queue works exactly like the slot

**Both files are emptied the same way: when the work is done, the line is deleted, not ticked.**
A queue that accumulates finished items stops being a queue — it becomes a changelog nobody reads,
and the next session has to wade through it to find the three things still open. That is the same
failure the slot has, and it gets the same answer.

- **Never leave a done item in the queue.** Not ticked, not struck through, not summarised as
  "recently closed". Gone.
- **The record of what was done lives in `harness/decisions.md`**, with the gate that holds it. That is the
  one place a finished thing is allowed to still exist.
- **Never write a closing paragraph in place of deleting the line.** A tidy summary of completed work
  is the same clutter in nicer clothes.
- The only things that stay are: open work, standing rules, and one line naming what is post-release
  and deliberately not tracked.
- If a line turns out to be already true when you re-read it, delete it on the spot (see C3).

## History

`harness/decisions.md` is the log. One entry per finished thing, newest first, shaped:

```
| D-0NN | applied | what was decided, and the numbers that moved | the files that carry it |
```

Rules:

- Log when done, never in advance. Not questions asked, not audits that changed nothing, not parked ideas.
- A direction decision is part of its entry, not a separate file. There is no second decision log.
- Routine fixes and refactors are not logged. If a change is not worth remembering, do not record it.
- A rule that closes a queue line must be logged with the gate that enforces it — a ruling with no
  guard is a comment, not a decision.

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
The same goes for a glossary, a decision log, and a work queue — one each, and this repo has already
deleted the duplicates that used to exist.