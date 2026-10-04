# Agent Rules — ModWorld

This file controls how all agents write and edit files in this project.

## 0. Project Phase — Building

- We are in **BUILD phase, coding has started**. The playable client lives in `game/` (Vite · Svelte · TypeScript) and the shared math lives in `engine/`. The `.md` specs remain the design; `tools/data/*.json` remains the numeric source.
- **The freeze is in effect** (it took effect at the first code commit): no file renames, no term renames, no new power systems without folding into `mob_HP` (see `checks.md` H1). Structural changes that would move a published number go through the data + its writer, then the cages.
- **What we are building:** an idle loot game (Melvor Idle style: a combat core loop plus **one Farming life skill** for provisioning, `farm.md` — no other resource skills). Core loop: pick settlement → pick zone → kill mobs → get XP + items + crafting currency → equip/craft → next zone. No death (Push instead). Two media kept strictly apart: 7 crafting stones (power) + gold minted by selling mob junk at the town Counterhand (convenience/services/cosmetics in `towns.md` stalls). No player trading. 9 zones × 10 levels across 3 capitals + 6 towns, 12 item slots, the skill roster (mid-redesign), 5 Elements, and a **finished mob side**: 15 species across 4 body classes (Small · Medium · Large · Boss; only Small and Medium form groups) placed over the 9 zones, plus Elite and 9 named bosses — every entry generated in `mob-roster.md`.
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

- **One number, one home.** Every range, K value, Cap, cost and rate lives in `tools/data/` and is printed into the docs by a writer. If a number is not in the data, say so — never estimate it and never type it into a second document. **The direction is one way (D-113): the data owns the number and the doc is its projection.** A gate may not read a value back out of a doc to compare it against the engine — that makes the doc a second source and lets the two disagree. `X15` used to parse `mod-pool.md`'s Total column and is the example of what that costs; it now reads `mods.json`.
- **Prose may not carry a number (D-113).** A number outside a `BEGIN GENERATED` marker has no writer, so it cannot move when the data moves and nothing detects it going stale. Prose names the **key** (`Int x K_INT_ES`) and never the value. Gate **L9** counts the lines that break this and fails when the count rises above `engine.json` `doc_prose_lines_max`. The cap is a debt to lower, not a target: **lower it in the same pass that fixes lines**, because a rule whose own text moves the count is not a rule.
- **NEVER invent a number from feeling.** Change the data, run that file's writer, then read the row it printed.
- **Every generated block has exactly one writer.** For a table inside a `.md` file that writer is the `--write` flag of a cage in `tools/verify.js`; the generated views have their own builders (`tools/report.js` for `dashboard.html`, `tools/wiki.js build` for `wiki/`). Never hand-edit between the `<!-- BEGIN GENERATED:* -->` markers, never delete a marker pair, never add a place where a number is typed by hand.
- **Prose explains, it does not repeat.** The text around a generated table says *why* a value sits where it does and points at the row. `tools/lint.js` L7 fails when a line names a skill or aura and quotes a signed percentage its data does not contain (`lint:allow` is the escape hatch; `harness/decisions.md` is exempt as a historical log).
- **A derived number quoted in prose is a copy, and copies must not multiply** (`tools/anchors.js`). Each derived anchor carries a cap equal to today's copy count, so **A2** fails the moment one is added — lowering a cap is how you record deleting one. `node tools/anchors.js --report` prints the total and every location; never type either. Write the rule once in the file that owns it and have the others cite it.
- **A skill rename is a data edit, never a doc edit** — the `name` in `skills.json` plus a `"renames"` entry, and the writer updates every doc that names it. Never retype a skill name into a doc; `harness/HARNESS.md` has the procedure.
- **Never hand-type a skill count.** The `# N <type> skills` headings and the count table are **generated** by `node tools/skills.js --write` from `skills.json`; a stale block fails the cage and lint L5 still reads the heading. Add or remove a skill in the data and run the writer — do not touch a count in prose.
- **Every Cap must document whether it is reachable** (see the Cap table in `formula.md`). A Cap that cannot be reached is not a power limit, it is a number that misleads players into thinking they can still progress.

## 4. File Structure Rules

- Keep `import <file>.md` lines at the top of each file. Do not remove them.
- **Numeric sources live in `tools/data/`**: `engine.json` (stat model - K values - Mod maxima)
- **A ruled question has one home, and it is `harness/decisions.md`.** Reasoning that explains why a number or a rule looks the way it does belongs there with its guard; open work belongs in `harness/todo.md`; the mechanics of both files belong to `harness/HARNESS.md`. Do not restate a ruling inside a design doc.
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
- The owner folder (local only, git-ignored) is private idea parking. Never read, list, glob, grep, quote, or import anything under it unless the owner assigns the exact file path in chat. It is outside the cages by design: the linter only scans root and harness docs, so nothing there ever becomes system truth on its own.
- `harness/draft-patch.md` is the owner's empty draft slot (D-043). Its content was moved to owner-private parking by owner approval, so the slot ships empty and stays empty. Never park numbers in it and never read numbers out of it; the anchors cage and lint L4/L7 skip it by name, so nothing placed there can become system truth on its own.

## 5. What Not To Do

- Do NOT add new systems that grant power without folding them into `mob_HP` (see `checks.md` H1).
- Do NOT give per-weapon DPS bonuses via mastery (see `equipment-weapon.md`).
- Do NOT create new caps that are unreachable.
- Do NOT use the bare word `quality` for Rarity, or `tier` where the term is Item quality — the fixed words in section 2 are the only names these three things have.
- Do NOT add a second armour/def reduction stat beside the Armour rating, and do NOT add a separate **status align** stat — one Alignment stat and one Armour rating are the whole model. **Status resistance is no longer banned (owner ruling 2026-10-04 · D-111):** `Status Alignment resistance %` is a Mod line, a % cut on the 20% status proc in `combat.md` §5, read at the `rollStatus` call. It is a Mod line and nothing else — there is no Core stat behind it and it must not become one.
- Do NOT add tiles, movement speed, aggro radius or any coordinate model — near and far are the **reach queue** in `combat.md` section 2b (**X33**), and that is the whole positional system.
- Do NOT add player-to-player selling or trading (no server · `save.md`).
- **Currency and shops now exist** (amended with the towns layer, `economy.md` + `towns.md`): gold has exactly two mints — mob junk sold at the Counterhand (Ragnarok-style, `loot.md` section 4), and bounded Road events — and NPC stalls buy space/time/information/appearance only. Do NOT let gold buy gear, Mods, potions, crafting stones, or any `mob_HP`-relevant service, and do NOT add a gold↔stone exchange or a third mint — these are the guards that keep the published timeline (`checks.md` E5) and G6-G9 true.
- Do NOT add a **food / cooked-meal buff layer**. Provisioning is herbs → potions only (`farm.md`); the timed-buff roster (`skill-pool-buff.md`) is the whole buff layer, and a second one would be complexity the game does not need.
- **Farming is the only life skill and grants no power** (owner ruling 2026-10-03 · D-068). It is a leveled provisioning track (`farm.md` · `engine.json` `farm`) — plant → grow → harvest for Farming XP and herbs. Because it only yields potion ingredients and never gear · Mods · DPS · stats, it is exempt from the mob_HP fold in the first bullet of this section, and no future pass should let a Farming level buy combat power or a second resource skill.

## 6. Git — replace all only

**This project syncs by replacing, never by merging.** Both directions overwrite whole.

- **The working tree is the only truth while working.** Read the current `.md` / `tools/data/*.json` files to learn what the design says. To judge *what the design says*, do NOT use `git diff`, `git status` or `git log` — uncommitted edits are the normal working state and carry no meaning, and a commit being absent says nothing about whether the content is finished. `harness/todo.md` + file recency is the state report; git history is only an archive of decisions that were deleted from the docs. (`git status` earns its place only at the sync gate below, never as a design check.)
- **No worktrees, no task branches, no second checkout.** The work is the files on disk, in the one working tree, and it ships as one replace-all push. Do NOT `git worktree add`, do NOT clone or copy the repo to a scratch directory to work in, and do NOT park a task on its own branch — a second copy of the tree is a second place for the design to live, the two always disagree, and the losing copy is the one somebody later reads. Edit in place, run `node tools/verify.js`, then push the whole thing with `--force-with-lease`.
- **Pull = replace local with remote.** `git fetch` then `git reset --hard <remote>/<branch>` (e.g. `origin/master`). Do NOT use `git pull` (it merges), do NOT rebase, do NOT hand-resolve conflicts. Local commits that are not on the remote are discarded by design.
- **Push = replace remote with local.** `git push --force-with-lease` (preferred) or `git push --force`. Never a normal merge-push, never a PR merge.
- **No merge commits, no partial merges.** If the two sides disagree, one side is dropped whole — there is no three-way merge in this repo.
- **Git is used at exactly two moments:** (a) before a replace-all sync, run `git status` (working tree must be clean) and `node tools/verify.js`, because replacing throws away whatever it overwrites; (b) committing/pushing, and only when the user asks. Never commit or push on your own initiative.
- Never commit secrets, and never force-push a branch you have not just verified.

## 7. Working mode — the owner proposes, the agent adapts

Recorded at the owner's request (2026-10-03). This is the contract between the owner and any agent working here.

- **The owner is the source of design intent.** Ideas arrive from the owner, often as a goal rather than a finished spec. The agent's job is to **adapt** the idea into the existing model — find the shape that fits the current rules, data and cages — then land it. Do not wait for a fully specified spec before starting.
- **The agent may, and should, argue.** If an idea conflicts with a frozen rule (`section 5`), breaks a cage, double-counts an anchor, or has a shape that fits the design better, say so plainly, give the reason, and offer the alternative. Disagreement is expected input, not refusal. The owner can always override, and a veto is a normal follow-up.
- **Propose, then implement.** For a reversible in-repo choice, pick the approach that fits best, implement it, and record it as veto-able in `harness/decisions.md`. Reserve questions for a genuine fork that changes what the game *is*, for something irreversible, or for a number that cannot be derived. Never invent a number from feeling (`section 3`).
- **Do not cargo-cult.** This project is deliberately not a template and does not follow another game's conventions by default. When a stock pattern does not fit, say why and fit the design instead.
- **Originality is the point.** The owner's framing: this game is built to satisfy the owner's own requirements and the owner believes the design has no precedent. Treat that as a standing reason to look for the shape no existing idle game uses, not for the safe one.

## 8. Response Style

How an agent talks to the owner. Applies to every reply, not just big tasks.

- **Be extremely concise.** Prefer tool calls and execution over conversational explanation.
- Do not explain reasoning or narrate actions. Do not repeat the request back.
- Do not give progress updates unless blocked; if a status line is unavoidable, keep it to one short sentence.
- After completing a task report only: **what changed · tests/checks run · any remaining issue**.
- Keep the final response under 5 bullet points.