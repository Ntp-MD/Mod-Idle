# Agent Rules — ModWorld

This file owns what is true about the project: the phase, the fixed terminology, the number discipline, the doc layout, the git model, and the working contract between the owner and the agent.

**How to work — verify routing, report format, when to decide and when to ask — lives in the How we work section at the end of this file.** It was folded in from a separate agent-ops file so one file holds every rule the agent reads.

## 0. Project — an open-world idle RPG

- **Mindset: an open-world idle RPG.** The playable client lives in `game/` (Vite · Svelte · TypeScript) and the shared math lives in `engine/`. The world is persistent and open-ended — the player idles, explores and progresses with **no time limit and no play-length target** (owner ruling): how long anything takes is **not a design constraint**, so never gate a change, a test or a number on "how long the game should take". The work is **fix · balance · polish · verify**; the `.md` specs remain the design and `tools/data/*.json` remains the numeric source.
- **The design is settled** (frozen at the first code commit): no new doc shelves, cages, data files or systems, and no file or term renames, without an explicit owner ask — the default is the smallest change that fixes the problem. A change that would move a published number still goes through the data + its writer, then the cages. What may not be added at all is `DECISIONS.md` D1–D10.
- **What we are building:** an open-world idle RPG — a combat core loop plus **one Farming life skill** for provisioning (`farm.md`, no other resource skills). Core loop: pick settlement → pick zone → kill mobs → get XP + items + crafting currency → equip/craft → next zone. No death (Push instead). Two media kept strictly apart: 7 crafting stones (power) + gold minted by selling mob junk at the town Counterhand (convenience/services/cosmetics in `towns.md` stalls). No player trading. Stats are **spent, not granted**: a level grants points the player allocates by hand or auto (`core-stats.md`), and that allocation is theirs alone to make — `DECISIONS.md` D11. 18 zones × 10 levels across capitals + towns, 13 item slots, the skill roster (mid-redesign), 5 Elements, and a **finished mob side**: 22 species across 4 body classes (Small · Medium · Large · Boss; only Small and Medium form groups) placed over the zones, plus Elite and named bosses — every entry generated in `mob-roster.md`.
- When the user says "change it" in Thai, apply the rename/refactor across ALL files immediately and verify with grep (zero old-term matches), then report the file count changed.

## 1. Language — English Only

- ALL file content MUST be written in English only.
- NEVER write Thai text in any `.md` file, code comment, tooltip, UI string, or document.
- NEVER mix Thai and English in the same file.
- When the user writes in Thai, still respond in conversation as normal, but all FILE OUTPUT must be English.
- If existing file content contains Thai, translate it to English when editing that file.
- Translate Thai prose to clear, concise technical English. Keep game terms untranslated (see section 2), keep all numbers, formulas, table values, and code identifiers unchanged, and keep tone factual and direct with no extra lore or flavor.
- Keep tables, formulas, and code blocks intact when you translate. Translate only the prose around them.

## 2. Terminology — Use Fixed Words

Use these exact terms everywhere. Do not use synonyms:

- Rarity / Item quality / Tier (see `glossary.md`)
- Mod / Flat / % / Core stat
- Offensive / Defensive
- Element (fire / cold / lightning / poison / chaos)
- Counter element / Weak / Innate element
- Cap / Alignment / Physical power / Magic power
- K value (e.g. `K_STR`)
- Mastery / Base / DoT / Leech / Push
- Reroll / Refine / Ascend
- No death (use `push`, never `death` unless quoting history)

Forbidden substitutions are listed in `glossary.md` — follow that table strictly.

- **One item answers 3 separate questions**: Rarity = Mod count, Item quality = value range, Tier = sub-range. Never mix them.
- Do not use `Affix` or `Attribute` for item Mods — use `Mod` (see `mod-pool.md`, `glossary.md`).

## 3. Numbers Are Source of Truth

- **One number, one home.** Every range, K value, Cap, cost and rate lives in `tools/data/` and is printed into the docs by a writer. If a number is not in the data, say so — never estimate it and never type it into a second document. **The direction is one way: the data owns the number and the doc is its projection.** A gate must never take the value *from* a doc as the authority — that makes the doc the source and lets the two disagree; `X15` used to parse `mod-pool.md`'s Total column, which is what that cost, so it now reads `mods.json`. Reading a doc *back* only to prove it still equals the engine is allowed and wanted: that is the `RB` drift detector (`tools/lib/engine.ts` `GENERIC_RULES`), and it is how a hand-written line that must quote a value stays honest.
- **Prose may not carry a number.** A number outside a `BEGIN GENERATED` marker has no writer, so it cannot move when the data moves and nothing detects it going stale. Prose names the **key** (`K_STR`) and never the value. Gate **L9** counts the lines that break this and fails when the count rises above `engine.json` `doc_prose_lines_max`. The cap is a debt to lower, not a target: **lower it in the same pass that fixes lines**, because a rule whose own text moves the count is not a rule.
- **Engine first, docs on a cycle.** Land a number in `tools/data/`, run its writer, then regenerate the views (`tools/report.ts`, `tools/wiki.ts build`) — never hand-edit prose to chase a value the data already moved. When a hand-written line genuinely must quote a value to stay readable, pin it with an `RB` rule in `tools/lib/engine.ts` `GENERIC_RULES` and **lower `doc_prose_lines_max` in the same pass**; adding a gate for one drift is the ratchet that catches the next, and a cap that never falls is not a ratchet. Fix drift at the engine and let the doc follow — do not patch the doc line by line.
- **NEVER invent a number from feeling.** Change the data, run that file's writer, then read the row it printed.
- **Every generated block has exactly one writer.** For a table inside a `.md` file that writer is the `--write` flag of a cage in `tools/verify.ts`; the generated views have their own builders (`tools/report.ts` for `dashboard.html`, `tools/wiki.ts build` for `wiki/`). Never hand-edit between the `<!-- BEGIN GENERATED:* -->` markers, never delete a marker pair, never add a place where a number is typed by hand.
- **Prose explains, it does not repeat.** The text around a generated table says *why* a value sits where it does and points at the row. `tools/lint.ts` L7 fails when a line names a skill or aura and quotes a signed percentage its data does not contain (`lint:allow` is the escape hatch).
- **A derived number quoted in prose is a copy, and copies must not multiply** (`tools/anchors.ts`). Each derived anchor carries a cap equal to today's copy count, so **A2** fails the moment one is added — lowering a cap is how you record deleting one. `node tools/anchors.ts --report` prints the total and every location; never type either. Write the rule once in the file that owns it and have the others cite it.
- **A skill rename is a data edit, never a doc edit** — the `name` in `skills.json` plus a `"renames"` entry, and the writer updates every doc that names it. Never retype a skill name into a doc; the Tooling part of the How we work section has the procedure.
- **Never hand-type a skill count.** The `# N <type> skills` headings and the count table are **generated** by `node tools/skills.ts --write` from `skills.json`; a stale block fails the cage and lint L5 still reads the heading. Add or remove a skill in the data and run the writer — do not touch a count in prose.
- **Every Cap must document whether it is reachable** (see the Cap table in `formula.md`). A Cap that cannot be reached is not a power limit, it is a number that misleads players into thinking they can still progress.

## 4. File Structure Rules

- Keep `import <file>.md` lines at the top of each file. Do not remove them.
- **Design docs live under `doc/<layer>/`**, one shelf per layer: `doc/start`, `doc/character`, `doc/items`, `doc/skills`, `doc/combat`, `doc/world`, `doc/economy`, `doc/verification`. The folder is a shelf, **not part of a doc's name**: `import`, prose `` `<file>.md` `` citations and every cage read stay **bare** (`item-base.md`, never `doc/items/item-base.md`), and `tools/lib/generated.ts` `resolveDoc` maps the bare name to its path. `AGENT.md` and `todo.md` stay at the root.
- **Numeric sources live in `tools/data/`** — one file per domain, each the single home of its numbers:
  - `engine.json` — stat model · K values · caps · loot · mod weights · craft · status · herbs · farm · potions · skill drop · mob species/zones/bosses · elements · timeline
  - `mods.json` — mod value ranges + quality bands
  - `town.json` — prices · rosters · stock · Standing
  - `skills.json` — roster · reserve tiers · formula · renames
  - `tree.json` — the passive tree's spec (three branches, twenty-one nodes each, three ranks per node); `tools/tree.ts` derives the nodes, prints their tables and gates the shape. Its power is **not** folded into `mob_HP` yet (owner ruling: open)
  - `bases.json` — Base frames per slot · weight · Primary / Secondary pools · Gear Mod school (`node tools/bases.ts --write` imports, `--checks` gates)
  - `aliases.json` — deprecated terms
- **`node tools/verify.ts` is the single verify entry point** — the cage list, the shared readers and the order they run in are named in the Verify routing part of the How we work section, so a new cage is added there and not here. Shared readers, for reference: `tools/lib/engine.ts` (numbers) · `roster.ts` · `skillmodel.ts` · `generated.ts` · `registry.ts` · `state.ts`.
- **Every derived table sits between `<!-- BEGIN GENERATED:key -->` markers.** Never hand-edit between them — edit the data, run that block's writer (the `--write` flag of its cage), then run `verify`.
- **A committed generated file must match what its writer produces.** `node tools/check-generated.ts` copies the repo to a temp dir, runs every writer listed in `tools/lib/writers.ts`, and diffs the result against the committed files — naming each file that was hand-edited or left stale, and never writing the real tree. `node tools/build.ts --check` runs it in place of the writers. Fix a mismatch in the source (the data or the doc), then run `node tools/build.ts` — never by editing the generated file to make the diff go away.
- **A ruled question has one home.** Reasoning that explains why a number or a rule looks the way it does belongs with the data that carries it and the design doc that prints it, guarded by the cage named in `checks.md`; open work belongs in `todo.md`; the mechanics of that file belong to the work-file part of the How we work section. Do not restate a ruling in a second place.
- **Index + detail pattern**: `skill-pool.md`, `formula.md`, `skill-tree.md`, `equipment-slot.md`, `towns.md` are indexes. Details live in:
  - `skill-pool-attack.md`, `skill-pool-buff.md`, `skill-pool-curse.md`, `skill-pool-aura-heal.md`, `skill-pool-system.md`
  - `formula-offense.md`, `formula-defense.md`, `formula-utility.md`
  - `skill-tree.md` and its four detail shells are empty on purpose - do not fill them in
  - `equipment-slot-pools.md`, `equipment-slot-armor.md`, `equipment-slot-weapon.md`
  - `towns-stalls.md` (generated price/stock/Standing/Collector tables) and `towns-ui.md` (the settlement screens) — both details of the `towns.md` index
  - `mob-roster.md` — the generated spawn list behind the `world.md` Monsters section (zone cast · every species × body entry with resolved numbers)

  Edit details in the split file, keep the index summary in sync.
- Preserve file names in lowercase with hyphens (e.g. `mod-pool.md`).
- NEVER create `skill.md`, `skills.md`, `SKILL.md`, or `.opencode/skills/` patterns for game content — those names are reserved for agentic agent skills and will be auto-loaded as agent instructions. Game skill data lives in `skill-pool-*.md` and `skill-tree-*.md` only.
- The owner folder (local only, git-ignored) is private idea parking. Do NOT read, list, glob, grep, quote, search for, or import anything under it — treat it as invisible and do not mention its contents. Two owner actions open it, and nothing else does: (a) the owner assigns an exact file path under `owner/` in chat, or (b) the owner says the word **approve** (case-insensitive, on its own or inside a sentence). Until one of those happens, ignore the folder entirely — including for "while you're in there" sweeps, rename sweeps, and project-wide search results that happen to match a path under it; narrow such a search instead. It is outside the cages by design: the linter only scans the design docs (root and `doc/`), so nothing there ever becomes system truth on its own.

## 5. What Not To Do

**The bans live in `DECISIONS.md`** — D1–D10, each with the reason it holds and the question to put
to a proposal before it lands. This section carries no copy, because a ban stated twice is a ban that
gets updated once. The reasoning stance that decides a proposal before it becomes a system is in the
same file, under **How to think**.

## 6. Git — replace all only

**We work on the local disk, and the whole tree travels as one.** This project syncs by replacing, never by merging — both directions overwrite whole, so there is never a partial lift or a partial pull.

- **The working tree is the only truth while working.** Read the current `.md` / `tools/data/*.json` files to learn what the design says. To judge *what the design says*, do NOT use `git diff`, `git status` or `git log` — uncommitted edits are the normal working state and carry no meaning, and a commit being absent says nothing about whether the content is finished. `todo.md` + file recency is the state report; git history is only an archive of decisions that were deleted from the docs. (`git status` earns its place only at the sync gate below, never as a design check.)
- **No worktrees, no task branches, no second checkout.** The work is the files on disk, in the one working tree, and it ships as one replace-all push. Do NOT `git worktree add`, do NOT clone or copy the repo to a scratch directory to work in, and do NOT park a task on its own branch — a second copy of the tree is a second place for the design to live, the two always disagree, and the losing copy is the one somebody later reads. **This covers the agent tooling as much as the shell:** never launch a subagent (or any helper) with an isolated-worktree / `isolation: worktree` option, and never set `isolation` to anything but the default — every subagent reads and writes this one working tree. Edit in place, run `node tools/verify.ts`, then push the whole thing with `--force-with-lease`.
- **Pull = replace local with remote.** `git fetch` then `git reset --hard <remote>/<branch>` (e.g. `origin/master`). Do NOT use `git pull` (it merges), do NOT rebase, do NOT hand-resolve conflicts. Local commits that are not on the remote are discarded by design.
- **Push = replace remote with local.** `git push --force-with-lease` (preferred) or `git push --force`. Never a normal merge-push, never a PR merge.
- **No merge commits, no partial merges.** If the two sides disagree, one side is dropped whole — there is no three-way merge in this repo.
- **Git is used at exactly two moments:** (a) before a replace-all sync, run `git status` (working tree must be clean) and `node tools/verify.ts`, because replacing throws away whatever it overwrites; (b) committing/pushing, and only when the user asks. Never commit or push on your own initiative.
- Never commit secrets, and never force-push a branch you have not just verified.

## 7. Working mode — the owner proposes, the agent adapts

Recorded at the owner's request (2026-10-03). This is the contract between the owner and any agent working here. The *design* reasoning stance — how to weigh a shape, whether it is original, whether it belongs here at all — is `DECISIONS.md` §How to think, not here.

- **The owner is the source of design intent.** Ideas arrive from the owner, often as a goal rather than a finished spec. The agent's job is to **adapt** the idea into the existing model — find the shape that fits the current rules, data and cages — then land it. Do not wait for a fully specified spec before starting.
- **The agent may, and should, argue.** If an idea breaks a frozen rule (`DECISIONS.md` D1–D10), breaks a cage, double-counts an anchor, or has a shape that fits the design better, say so plainly, give the reason, and offer the alternative. Disagreement is expected input, not refusal. The owner can always override, and a veto is a normal follow-up.
- **Propose, then implement.** For a reversible in-repo choice, pick the approach that fits best, implement it, and leave it veto-able — a veto is a normal follow-up. What to decide alone and what to put to the owner is the Decisions and asking part of the How we work section, and the question has no closed-list shape here either.
- **A question is offered, never imposed.** When a fork genuinely needs the owner, present at most four options and leave the question tool's own free-text entry (its `Other`) as the fifth slot, so the owner can always answer outside the list. Never present a fork as a closed list the owner must pick from.

## 8. Response Style

How an agent talks to the owner. This is the only copy — the How we work section points here.

- **Be extremely concise.** Prefer tool calls and execution over conversational explanation.
- Do not explain reasoning or narrate actions. Do not repeat the request back.
- Do not give progress updates unless blocked; if a status line is unavoidable, keep it to one short sentence.
- Verdict line first: `<task> — DONE | PARTIAL | BLOCKED (<n>/<total>)`. Then Changed / Decisions / Gaps (`(none)` when empty) / Verify with the exact command and its result. Every item carries a status tag so "did it change?" is never inferred. No tables. Audits are read-only and say so.
- Keep the final response under five bullet points.
- **Git is not a status line.** Never raise commit, push, branch, PR, worktrees or the sync gate in a reply unless the owner asks for one. Report the work, not the repository — the working tree being dirty is the normal state, never a finding.

# How we work

How an agent works in this repo: what to read, how to verify, where work is written, and when to decide or ask. It was folded in here so one file holds every rule the agent reads. Coding agents fail in predictable ways — they lose the thread mid-task, run the wrong checks, and declare victory early. The rules below are the counter.

## Read chain

- `AGENT.md` — this file. Project truth and the working contract. Read first.
- `DECISIONS.md` — what is forbidden (the D-bans) and how to think. Read before proposing a system.
- `glossary.md` — shared language. Read when a term is load-bearing; patch it when one locks.
- `todo.md` — the single work file: what is open, and what is in flight right now. Read at task start.

Design docs live under `doc/<layer>/` (see the file-structure section); they are addressed by bare name (`glossary.md`), so `glossary.md` is found at `doc/start/glossary.md`.

## Verify routing

**`node tools/verify.ts` is the only verify entry point** and it is pre-authorised. Run it after any edit, fix what your change broke, rerun without asking. Do not run it to "check whether it is worth running" — it always is.

It runs every cage in order: engine (`check`), town, skills, tree, ladder, loot, bases, timeline, survival, inventory, anchor, and doc lint. The last one is the referential-integrity pass over the markdown — it is what catches a file you moved or a name you retyped.

Rebuild the views after a doc edit: `node tools/report.ts` (dashboard) and `node tools/wiki.ts build`. The writer that owns a generated block is the `--write` flag of that block's cage.

**One command for the whole build:** `node tools/build.ts` runs every writer, then `verify`, then both views, and stops at the first failure (`--check` skips the writers and only verifies then rebuilds). Use it unless you are fixing one specific cage.

**Mid-task re-anchor:** after a handful of file edits, or after any context cutoff, re-read `todo.md`. If the open work no longer matches what you are doing, fix the file before editing again.

## The work file

`todo.md` is the **single work file** — there is no second slot and no per-topic scratch file. It holds two things and nothing else:

- **Open work** — what is not built yet, split by who can close it.
- **One line naming what is post-release** and deliberately not tracked.

The shape of the repo, where the numbers live, and the standing rules are this file's job (the project and file-structure sections), not the work file's — the work file names work and nothing else.

Write it silently after a meaningful step: a user order, a context shift, a root cause, a landed choice. Do not narrate the write.

## Clearing the slate

**When work is done, the line is deleted — not ticked, not struck through, not summarised as "recently closed".** A work file that accumulates finished items stops being a work file: it becomes a changelog nobody reads, and the next session has to wade through it to find the few things still open.

- **Never write a closing paragraph in place of deleting the line.** A tidy summary of completed work is the same clutter in nicer clothes.
- A parked task (moved to post-release, or waiting on an owner ruling) is a single line under the post-release note — never left to rot in the open list.
- If a line turns out to be already true when you re-read it, delete it on the spot.

## Tooling

Use the tool that answers the question instead of editing a doc to find out.

- **See a value's effect without editing docs** — `node tools/skills.ts --calc` prints dmg/press · effective cooldown · presses/sec · mana%/s for every attack skill, and `node tools/report.ts` carries the same as a live "Skill workshop" section. Both read `tools/lib/skillmodel.ts`.
- **Edit data through the wiki editor** when a form is faster than the JSON — `node tools/wiki.ts serve --open` (loopback only) renders every `tools/data/*.json` collection as a validated form, then runs the writers plus every cage and lint and rolls back on failure. Direct JSON edits work too.
- **Rename a skill or aura** — change the `name` in `skills.json`, add `"Old Name": "New Name"` to its `renames` map, then run `node tools/tree.ts --write`; the node `Enables` cells update themselves. `tools/tree.ts --checks` reports any cell still on an old name as PENDING until you do. Never retype the name into a doc.

## Decisions and asking

- **Decide, don't stall.** A reversible in-repo choice is made now and logged as veto-able — including unrequested scope growth, new tooling, and interface picks. A veto is a normal follow-up.
- **Ask only for:** a change to the game's rules that the owner must rule on, anything irreversible, and genuinely missing information. Asking is the last resort.
- **Look it up, never ask for a fact.** Every number in this repo is computed by a cage; if a fact is not in the data, say so rather than estimating.
- **Claim then impact:** when the user reports a problem, verify it against the docs first and state what is actually true before changing anything.

## Scope

Fix what was asked. Unrequested cleanup is a separate ask, even when it is obviously right — this repo has spent a session collapsing duplicate data on purpose, and doing that uninvited is the same mistake in the other direction.

If the requested change turns out to be much larger than it looked, say so before starting rather than three files in.