# Agent Rules — ModWorld

The working contract: what is fixed, what the agent reads, how it verifies, and when it decides or asks. The design lives in `tools/data/*.json` and the code that reads it — not in prose.

## 0. Project — an open-world idle RPG

- **Load `DECISIONS.md` first — every session, on every provider.** Its **Standing intent** (the bans) and §How to think are not optional context; read them before proposing any system. They live in the repo so they travel with the tree, and every provider reads repo files — never copy them into tool-specific memory, because a ban stated twice is a ban that gets updated once.
- **Mindset: an open-world idle RPG.** What it is, where it lives and who plays it is `PRODUCT.md`; the visual rules the client already follows are `DESIGN.md`; the frame it uses and what it deliberately drops is `doc/start/concept.md`; the stack is `doc/start/Techstack.md`. Read those, not a summary here.
- **How long anything takes is not a design constraint** (owner ruling): never gate a change, a test or a number on "how long the game should take". The work is **fix · balance · polish · verify**.
- **The design is settled** (frozen at the first code commit): no new systems, data files or shelves, and no file or term renames, without an explicit owner ask — the default is the smallest change that fixes the problem. What may not be added at is anything `DECISIONS.md` forbids.
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

- Item level / Item quality / Tier (see `doc/start/glossary.md`)
- Mod / Flat / % / Core stat
- Frame Mod / Bound Mod / Unbound Mod (line 1 / lines 2-3 locked / rolled editable lines)
- Offensive / Defensive
- Element (fire / cold / lightning / poison / chaos)
- Counter element / Weak / Innate element
- Cap / Alignment / Physical power / Magic power
- K value (e.g. `K_STR`)
- Mastery / Base / DoT / Leech / Push
- Reroll / Refine / Ascend / Roll new Mod / Polish / Imprint stone
- Target — `line` (the player names it) · `random` (the stone draws one) · `whole piece`
- Frame Mod · Bound Mod · Unbound Mod (the reach rule: no target redraws the Frame Mod; value, Add and Remove stones stop above the Bound pair)
- Dungeon run / Escrow / Wild side / Hunt (a run is a **mode**, never a place; the field is the mob field)
- No death (use `push`, never `death` unless quoting history)
- HUD parts — vitals · pockets · tracker · mob field · cast order · chronicle · map sheet · destination card · rail · pop panel (the field is the whole screen, the mob field is the middle of it; a bare "sheet" is the map, the character sheet is spelled in full)

Forbidden substitutions are listed in `doc/start/glossary.md` — follow that table strictly.

- **One item answers 3 separate questions**: Item level = the value window, Item quality = the band, Tier = which third of the window. Never mix them.
- Do not use `Affix` or `Attribute` for item Mods — use `Mod`.

## 3. Numbers Are Source of Truth

- **One number, one home.** Every range, K value, Cap, cost and rate lives in `tools/data/*.json`. If a number is not in the data, say so — never estimate it, never type it anywhere else, and never invent one from feeling. Change the data, then read what the engine computes from it.
- **The engine reads the data and nothing else.** `engine/` is pure functions over `tools/data/*.json` — no file reads, no prose, no second copy of a formula. The client (`game/`) imports `engine/` and the same JSON, so a number the player sees is the number the cage gates. A second copy of a formula is the same defect as a second copy of a number.
- **Local is truth: the working tree, then `engine/` and `game/`, then the docs.** What the design says is read from the files on disk and from the code that runs them. `AGENTS.md` and `DECISIONS.md` follow the tree, never the other way round — and a doc that disagrees with the code is corrected, while the code stays put. History is an archive, not evidence: never `git log` / `git show` / `git diff` to decide what the design is, and never restore content, a D-number or a deleted doc from a past commit.
- **The cages assert data ↔ engine; the client asserts engine ↔ client.** `node tools/verify.ts` runs the cages — each reads `tools/data/*.json`, calls `engine/`, and fails when the two disagree. The same-numbered pair is the client's own suite: `npm run typecheck` and `npm --prefix game test`, whose `engine-agreement` test proves the client and the cages resolve to one module and one data file. A cage also reads the doc prose: L9 holds the number budget `engine.json doc_prose` owns and L10 holds every doc pointer honest.
- **A shape claim in code is a claim about the data.** When a gate says "every weapon type carries a weight", it is checking `bases.json` — fix a failure in the data or in the engine, never by weakening the gate.
- **A skill rename is a data edit.** Change the `name` in `skills.json` and add a `"renames"` entry; `node tools/tree.ts --checks` reports any cell still on an old name as PENDING until you do. Never retype a skill name anywhere else.
- **Every Cap must be reachable or declared a hard ceiling** — a Cap that cannot be reached is not a power limit, it is a number that misleads players into thinking they can still progress. The reachability figures come from `engine/`.

## 4. File Structure Rules

- **`tools/data/*.json` is the single home of every number** — one file per domain:
  - `engine.json` — stat model · K values · caps · loot · mod weights · craft · status · herbs · farm · potions · skill drop · mob species/zones/bosses · elements · timeline · inventory · reach · junk · dungeon · imprint
  - `mods.json` — Mod value ranges + quality bands + the drop weight of each line
  - `town.json` — prices · rosters · stock · Standing · Collector sets · the task board's sizing
  - `skills.json` — roster · reserve tiers · formula · renames
  - `tree.json` — the passive tree's spec (three branches, twenty-one nodes each, three ranks per node). Its power is deliberately **not** folded into `mob_HP` (owner ruling: the published rates are the empty-tree baseline, permanently)
  - `bases.json` — Base frames per slot · weight · Primary / Secondary pools · Gear Mod school · the per-type Line-1 and weapon pools. It is the **source**: nothing parses a doc into it
  - `map.json` — the field: cells, terrain and ground colours, regions. Presentation only — no file under `engine/` or `game/src/` reads it (the map cage's M7 holds that), except where a settlement's wild side is named
  - `aliases.json` — the record of what was renamed: `terms` (retired words, read by X59) and `docs` (retired doc names mapped to the file that owns their numbers now, read by L10)
- **`node tools/verify.ts` is the single cage entry point** — the cage list is named in `tools/lib/writers.ts` `CAGES` and runs in that order (engine · town · skills · tree · ladder · loot · bases · timeline · survival · inventory · map · dungeon · imprint). The client's half of the contract is `npm run typecheck` and `npm --prefix game test`. Shared readers: `tools/lib/engine.ts` (numbers) · `roster.ts` · `skillmodel.ts` · `json.ts`.
- **The prose that survives is `doc/start/` plus the root rules**: `glossary.md` (shared language) · `concept.md` (the frame the game uses and drops) · `Techstack.md` (the fixed stack) · `tasks.md` (the in-game board's spec — the *work* file is `todo.md`, and there is no second one) · `AGENTS.md` · `DECISIONS.md` · `PRODUCT.md` · `DESIGN.md` (the client's visual rules). `draft/` is parked scratch, not design. Keep prose short, and never put a number in it that the data owns.
- **Never put a number in prose.** Prose names the **key** (`K_STR`) and never the value. If a sentence needs a figure, it reads it from the data at run time. L9 counts the hand-typed lines against the budget in `engine.json doc_prose`; a line that must keep its figure opts out with `lint:allow`.
- **Preserve file names in lowercase with hyphens** (e.g. `mod-pool` concepts live in data now; file names follow the same rule).
- NEVER create `skill.md`, `skills.md`, `SKILL.md`, or `.opencode/skills/` patterns for game content — those names are reserved for agentic agent skills and will be auto-loaded as agent instructions.
- The owner folder (local only, git-ignored) is private idea parking. Do NOT read, list, glob, grep, quote, search for, or import anything under it — treat it as invisible and do not mention its contents. Two owner actions open it, and nothing else does: (a) the owner assigns an exact file path under `owner/` in chat, or (b) the owner says the word **approve** (case-insensitive, on its own or inside a sentence). Until one of those happens, ignore the folder entirely — including for "while you're in there" sweeps, rename sweeps, and project-wide search results that happen to match a path under it; narrow such a search instead.

## 5. What Not To Do

**The bans live in `DECISIONS.md`** — its Standing intent, each with the reason it holds and the question to put
to a proposal before it lands. This section carries no copy, because a ban stated twice is a ban that
gets updated once. The reasoning stance that decides a proposal before it becomes a system is in the
same file, under **How to think**.

## 6. Git — replace all only

**We work on the local disk, and the whole tree travels as one.** This project syncs by replacing, never by merging — both directions overwrite whole, so there is never a partial lift or a partial pull.

- **The working tree is the only truth while working.** Read the current `tools/data/*.json` and `engine/` files to learn what the design says. To judge *what the design says*, do NOT use `git diff`, `git status` or `git log` — uncommitted edits are the normal working state and carry no meaning, and a commit being absent says nothing about whether the content is finished. `todo.md` + file recency is the state report; git history is only an archive of decisions that were deleted. (`git status` earns its place only at the sync gate below, never as a design check.)
- **Never restore from history.** A committed-then-deleted doc, term, number or D-number is gone, not pending. Do not read it back out of a commit to "fix" the tree, and do not renumber rules to match an id a comment still cites — fix the citation to what the file says now. `git show` / `git log` / `git diff` are not sources of design content, and a `restore`/`checkout --` of old content is the one move that loses work in progress.
- **No worktrees, no task branches, no second checkout.** The work is the files on disk, in the one working tree, and it ships as one replace-all push. Do NOT `git worktree add`, do NOT clone or copy the repo to a scratch directory to work in, and do NOT park a task on its own branch — a second copy of the tree is a second place for the design to live, the two always disagree, and the losing copy is the one somebody later reads. **This covers the agent tooling as much as the shell:** never launch a subagent (or any helper) with an isolated-worktree / `isolation: worktree` option, and never set `isolation` to anything but the default — every subagent reads and writes this one working tree. Edit in place, run `node tools/verify.ts`, then push the whole thing with `--force-with-lease`.
- **Pull = replace local with remote.** `git fetch` then `git reset --hard <remote>/<branch>` (e.g. `origin/master`). Do NOT use `git pull` (it merges), do NOT rebase, do NOT hand-resolve conflicts. Local commits that are not on the remote are discarded by design.
- **Push = replace remote with local.** `git push --force-with-lease` (preferred) or `git push --force`. Never a normal merge-push, never a PR merge.
- **No merge commits, no partial merges.** If the two sides disagree, one side is dropped whole — there is no three-way merge in this repo.
- **Git is used at exactly two moments:** (a) before a replace-all sync, run `git status` (working tree must be clean) and `node tools/verify.ts`, because replacing throws away whatever it overwrites; (b) committing/pushing, and only when the user asks. Never commit or push on your own initiative.
- Never commit secrets, and never force-push a branch you have not just verified.

## 7. Working mode — the owner proposes, the agent adapts

This is the contract between the owner and any agent working here. The *design* reasoning stance — how to weigh a shape, whether it is original, whether it belongs here at all — is `DECISIONS.md` §How to think, not here.

- **The owner is the source of design intent.** Ideas arrive from the owner, often as a goal rather than a finished spec. The agent's job is to **adapt** the idea into the existing model — find the shape that fits the current data, engine and cages — then land it. Do not wait for a fully specified spec before starting.
- **The agent may, and should, argue.** If an idea breaks a frozen rule (`DECISIONS.md`'s Standing intent), breaks a cage, or has a shape that fits the design better, say so plainly, give the reason, and offer the alternative. Disagreement is expected input, not refusal. The owner can always override, and a veto is a normal follow-up.
- **Propose, then implement.** For a reversible in-repo choice, pick the approach that fits best, implement it, and leave it veto-able — a veto is a normal follow-up.
- **A question is offered, never imposed.** When a fork genuinely needs the owner, present at most four options and leave the question tool's own free-text entry (its `Other`) as the fifth slot, so the owner can always answer outside the list. Never present a fork as a closed list the owner must pick from.

## 8. Response Style

How an agent talks to the owner. This is the only copy — the How we work section points here.

- **Be extremely concise.** Prefer tool calls and execution over conversational explanation.
- Do not explain reasoning or narrate actions. Do not repeat the request back.
- Do not give progress updates unless blocked; if a status line is unavoidable, keep it to one short sentence.
- Verdict line first: `<task> — DONE | PARTIAL | BLOCKED (<n>/<total>)`. Then Changed / Decisions / Gaps (`(none)` when empty) / Verify with the exact command and its result. Every item carries a status tag so "did it change?" is never inferred. No tables. Audits are read-only and say so.
- Keep the final response under five bullet points.
- **Git is not a status line.** Never raise commit, push, branch, PR, worktrees or the sync gate in a reply unless the owner asks for one. Report the work, not the repository — the working tree being dirty is the normal state, never a finding.

### Output policy

This is the reply shape; where it and the two bullets above
(verdict-line report, five-bullet cap) disagree, **this section wins** — the report shape survives
only as the fields it names (Changed / Decisions / Gaps / Verify) when a reply is genuinely too
long for one line.

- No narration, no tool output echo, no recap, no pleasantries.
- Work silently. Final reply = one line, max 10 words, format: `<status> <files>`.
  - Done: `✓ auth.ts, login.vue`
  - Blocked: `✗ <reason>`
- Ask only when a decision is needed: `Q: A) x (default) B) y`

# How we work

How an agent works in this repo: what to read, how to verify, what it may change, and when to decide or ask.

## Read chain

- `AGENTS.md` — this file. Project truth and the working contract. Read first.
- `DECISIONS.md` — **mandatory, on every provider**: what is forbidden (the Standing intent) and how to think. Read before proposing any system.
- `PRODUCT.md` — what the game is, where it lives and who plays it.
- `doc/start/glossary.md` — shared language. Read when a term is load-bearing; patch it when one locks.
- `doc/start/concept.md` — the frame the game uses and what it deliberately drops. Read before proposing a system.
- `DESIGN.md` — the client's visual rules (tokens, the three-state focus rule). Read before touching the interface.
- `todo.md` — the single work file: what is open, and what is in flight right now. Read at task start.

The numbers are not in any of those: they are in `tools/data/*.json`, and `engine/` is the only code that turns them into gameplay.

## Verify routing

**`node tools/verify.ts` is the cage entry point** and it is pre-authorised. Run it after any edit, fix what your change broke, rerun without asking. Do not run it to "check whether it is worth running" — it always is.

It runs every cage in order: engine (`check`), town, skills, tree, ladder, loot, bases, timeline, survival, inventory, map, dungeon, imprint. Every cage is read-only under `--checks` and each one reads `tools/data/*.json` and calls `engine/` — that is the whole oracle for the data half. A single cage can be run on its own with `--checks` while you are fixing it.

The client half is two commands, and they are part of the same contract: `npm run typecheck` (the root `tsconfig.json` covers `engine/` and `tools/`) and `npm --prefix game test` (the suite that proves the client and the cages resolve to one module and one data file). A change that moves a number the player sees is not verified until both halves are green.

**Mid-task re-anchor:** after a handful of file edits, or after any context cutoff, re-read `todo.md`. If the open work no longer matches what you are doing, fix the file before editing again.

**The client is already running.** The owner keeps the dev server up on `http://localhost:5173/`, so read the screen there rather than starting a second server — and never kill a browser process or free a port to clean up afterwards. Those processes are the owner's, and closing them costs their work, not yours.

## The work file

`todo.md` is the **single work file** — there is no second slot and no per-topic scratch file. It holds two things and nothing else:

- **Open work** — what is not built yet, split by who can close it.
- **One line naming what is post-release** and deliberately not tracked.

The shape of the repo, where the numbers live, and the standing rules are this file's job, not the work file's — the work file names work and nothing else. `doc/start/tasks.md` is the board **inside the game** and its spec, sized by `town.json task_sizing`; it is never this file.

Write it silently after a meaningful step: a user order, a context shift, a root cause, a landed choice. Do not narrate the write.

## Clearing the slate

**When work is done, the line is deleted — not ticked, not struck through, not summarised as "recently closed".** A work file that accumulates finished items stops being a work file: it becomes a changelog nobody reads, and the next session has to wade through it to find the few things still open.

- **Never write a closing paragraph in place of deleting the line.** A tidy summary of completed work is the same clutter in nicer clothes.
- A parked task (moved to post-release, or waiting on an owner ruling) is a single line under the post-release note — never left to rot in the open list.
- If a line turns out to be already true when you re-read it, delete it on the spot.
- **Delete item by item, in the moment.** With several items open (a · b · c), delete a's line as soon as a's own verify is green, then start b — never batch the deletions to the end of the run. A line that outlives its work leaves the file describing a state that is no longer true, and the mid-task re-anchor then reads a stale file instead of reality.

## Tooling

Use the tool that answers the question instead of reading code to work it out.

- **See a value's effect without changing the data** — `node tools/skills.ts --calc` prints dmg/press · effective cooldown · presses/sec · mana%/s for every attack skill. Flags: `--build glass|caster --level N --cdr N --ladder N`.
- **Raw loot numbers per band** — `node tools/loot.ts --sim` prints drops, upgrades, keep rate and lines per item for each band; `--sync` hands a measured upgrades/hr back into `engine.json` when a change moves it.
- **Rename a skill or aura** — change the `name` in `skills.json`, add `"Old Name": "New Name"` to its `renames` map. `tools/tree.ts --checks` reports any node cell still on an old name as PENDING until you do. Never retype the name anywhere else.

## Decisions and asking

- **Decide, don't stall.** A reversible in-repo choice is made now and logged as veto-able — including unrequested scope growth, new tooling, and interface picks. A veto is a normal follow-up.
- **Ask only for:** a change to the game's rules that the owner must rule on, anything irreversible, and genuinely missing information. Asking is the last resort.
- **Look it up, never ask for a fact.** Every number in this repo is computed by a cage; if a fact is not in the data, say so rather than estimating.
- **Claim then impact:** when the user reports a problem, verify it against the data and `engine/` first and state what is actually true before changing anything.

## Scope

Fix what was asked. Unrequested cleanup is a separate ask, even when it is obviously right — this repo has spent a session collapsing duplicate data on purpose, and doing that uninvited is the same mistake in the other direction.

If the requested change turns out to be much larger than it looked, say so before starting rather than three files in.
