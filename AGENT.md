# Agent Rules — ModWorld

This file controls how all agents write and edit files in this project.

## 0. Project Phase — Design Before Coding

- We are in **DESIGN phase, coding has NOT started**. No game code exists yet — only these `.md` specs.
- **What we are building:** an idle loot game (Melvor Idle style, but combat-only, no resource skills). Core loop: pick settlement → pick zone → kill mobs → get XP + items + crafting currency → equip/craft → next zone. No death (Push instead). Two media kept strictly apart: 7 crafting stones (power) + gold minted only by the sell/dissolve choice (convenience/services/cosmetics in `towns.md` stalls). No player trading. 9 zones × 10 levels across 3 capitals + 6 towns, 12 item slots, 43 skills (roster mid-redesign), 5 elements.
- **Rule: change it NOW if it needs changing.** Terminology renames (Affix→Mod), file splits, number rebalancing, and rule changes are cheap now and expensive after coding starts. Propose and apply structural changes immediately instead of deferring them.
- **Freeze takes effect at first code commit.** After that: no file renames, no term renames, no new power systems without folding into `mob_HP` (see `checks.md` H1). Until then, prefer breaking the docs over preserving them.
- When the user says "change it" in Thai, apply the rename/refactor across ALL files immediately and verify with grep (zero old-term matches), then report the file count changed.

## 1. Language — English Only

- ALL file content MUST be written in English only.
- NEVER write Thai text in any `.md` file, code comment, tooltip, UI string, or document.
- NEVER mix Thai and English in the same file.
- When the user writes in Thai, still respond in conversation as normal, but all FILE OUTPUT must be English.
- If existing file content contains Thai, translate it to English when editing that file.
- Translate Thai prose to clear, concise technical English. Keep game terms untranslated (see section 2), keep all numbers, formulas, table values, and code identifiers unchanged, and keep tone factual and direct with no extra lore or flavor.

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

## 3. Numbers Are Source of Truth

- All numbers (ranges, K values, caps, costs, rates) MUST be traceable back to `mod-pool.md` tables or `formula.md`.
- NEVER invent numbers from feeling. If a number changes, propagate it to `checks.md`, `world.md`, `combat.md`, `loot.md`, `skill-tree.md`.
- Run `node tools/check.js --write` + `--checks` after changing the stat/K/Mod/loot/craft constants: it regenerates `checks.md` groups A · B · C · F from `tools/data/engine.json` and fails if a prose file (mod-pool.md · formula*.md · core-stats.md · crafting.md · loot.md) publishes a number that is not the output of that math. `node tools/survival.js` is still referenced for groups D6-D14 but **does not exist yet** — those tables are hand-carried. Do not hand-type percentages.
- **Town economy numbers are generated, not typed**: prices, stock, rosters, Standing kill thresholds and demand live in `tools/data/town.json`, and band numbers come from `tools/data/engine.json` through `tools/lib/engine.js`. Edit the data, then `node tools/town.js --write` (rebuilds the tables in `towns-stalls.md` + `checks.md` group T) and `node tools/town.js --checks` (fails on a broken invariant or a stale table). Never hand-edit between the `<!-- BEGIN GENERATED:* -->` markers.
- **Skill and tree data are generated, not typed**: the roster lives in `tools/data/skills.json` (skills · reserve tiers · deprecated names) and the tree shape + 18 keystones in `tools/data/tree.json`. `node tools/skills.js --write` rebuilds the roster tables in `skill-pool*.md`; `node tools/tree.js --write` rebuilds the summary in `skill-tree.md`. Never hand-type a skill count — the `# N <type> skills` headings are lint-checked against the data.
- **Prose must not restate a generated value.** A generated table is the source; the text around it explains *why* a value sits there and refers to the row, never retypes the number. `tools/lint.js` L7 fails when a line names a skill/aura and quotes a signed percentage its data does not contain. (`lint:allow` on a line is the escape hatch for a deliberate exception; `decisions.md` is excluded as a historical log.)
- **Renaming a skill is a data edit, not a doc edit.** Change the `name` in `skills.json`, add `"Old Name": "New Name"` to its `renames` map, then run `node tools/tree.js --write` — the node `Enables` cells update themselves. `tools/tree.js --checks` reports any cell still on an old name as PENDING until you do.
- **See a value's effect without editing docs.** `node tools/skills.js --calc --stat N --power N --level N --cdr N --ladder N` prints dmg/press · eff cd · presses/sec · mana%/s for every attack skill, and the dashboard has the same as a live "Skill workshop" section (`node tools/report.js`). Both read `tools/lib/skillmodel.js`; the attack table's `eff cd` / `presses/sec` columns come from `skills.json` `meta.formula.cast_reference`.
- **Edit data through the wiki editor.** `node tools/wiki.js serve --open` (loopback only) renders every `tools/data/*.json` collection (engine · town · skills · tree) as a validated form, then runs the writers + every cage + lint and rolls back on failure. Direct JSON edits work too; run `node tools/verify.js` after either.
- **Run `node tools/verify.js` after any edit.** It runs every cage (engine · town · skills · tree) plus `tools/lint.js` (cross-file references, counts, deprecated terms, value drift) and exits 1 on any FAIL. A pre-commit hook is available at `.githooks/pre-commit` (enable with `git config core.hooksPath .githooks`).
- Every cap must document whether it is reachable (see `formula.md` Cap table).

## 4. File Structure Rules

- Keep `import <file>.md` lines at the top of each file. Do not remove them.
- **Numeric sources live in `tools/data/`**: `engine.json` (stat model · K values · Mod maxima · loot model · craft prices · timeline), `town.json` (prices · rosters · stock · Standing shares · Collector sets), `skills.json` (roster · reserve tiers · deprecated names), `tree.json` (branches · keystones · waived refs) and `aliases.json` (deprecated terms). `tools/lib/engine.js` and `tools/lib/roster.js` are the shared readers; `tools/check.js`, `tools/town.js`, `tools/skills.js` and `tools/tree.js` are the only writers into the generated tables. Do not delete the `<!-- BEGIN GENERATED:* -->` / `<!-- END GENERATED:* -->` marker pairs, do not edit between them, and do not add another place where a number is typed by hand.
- Keep tables, formulas, and code blocks intact. Translate only prose around them.
- Preserve file names in lowercase with hyphens (e.g. `mod-pool.md`).
- NEVER create `skill.md`, `skills.md`, `SKILL.md`, or `.opencode/skills/` patterns for game content — those names are reserved for agentic agent skills and will be auto-loaded as agent instructions. Game skill data lives in `skill-pool-*.md` and `skill-tree-*.md` only.
- Index + detail pattern: `skill-pool.md`, `formula.md`, `skill-tree.md`, `equipment-slot.md` are indexes. Details live in:
  - `skill-pool-attack.md`, `skill-pool-buff.md`, `skill-pool-curse.md`, `skill-pool-aura-heal.md`, `skill-pool-system.md`
  - `formula-offense.md`, `formula-defense.md`, `formula-utility.md`
  - `skill-tree-impact.md`, `skill-tree-stream.md`, `skill-tree-control.md`, `skill-tree-keystone.md`
  - `equipment-slot-pools.md`, `equipment-slot-armor.md`, `equipment-slot-weapon.md`
  - `towns-stalls.md` (generated price/stock/Standing/Collector tables) and `towns-ui.md` (the settlement screens) — both details of the `towns.md` index
 Edit details in the split file, keep the index summary in sync.
- One item answers 3 separate questions: Rarity = Mod count, Quality = value range, Tier = sub-range. Never mix them. Do not use `Affix` or `Attribute` for item mods — use `Mod` (see `mod-pool.md`, `glossary.md`).

## 5. What Not To Do

- Do NOT add new systems that grant power without folding them into `mob_HP` (see `checks.md` H1).
- Do NOT give per-weapon DPS bonuses via mastery (see `equipment-weapon.md`).
- Do NOT create new caps that are unreachable.
- Do NOT use `quality` for `rarity` or `tier` for `quality`.
- Do NOT add armor/def stat, or status res/align as separate stats — they were removed by design.
- Do NOT add player-to-player selling or trading (no server · `save.md`).
- **Currency and shops now exist** (amended with the towns layer, `economy.md` + `towns.md`): gold has exactly two mints — the sell/dissolve choice on a filter-rejected piece, and bounded Road events — and NPC stalls buy space/time/information/appearance only. Do NOT let gold buy gear, Mods, potions, crafting stones, or any `mob_HP`-relevant service, and do NOT add a gold↔stone exchange or a third mint — these are the guards that keep the 40.2 hr timeline and checks.md G6-G9 true.

## 6. Git — replace all only

**This project syncs by replacing, never by merging.** Both directions overwrite whole.

- **Pull = replace local with remote.** `git fetch` then `git reset --hard <remote>/<branch>` (e.g. `origin/master`). Do NOT use `git pull` (it merges), do NOT rebase, do NOT hand-resolve conflicts. Local commits that are not on the remote are discarded by design.
- **Push = replace remote with local.** `git push --force-with-lease` (preferred) or `git push --force`. Never a normal merge-push, never a PR merge.
- **No merge commits, no partial merges.** If the two sides disagree, one side is dropped whole — there is no three-way merge in this repo.
- **Before either direction:** run `git status` (working tree must be clean) and `node tools/verify.js` (all cages + lint green). Replace-all throws away whatever it overwrites, so the check is the only guard.
- Never commit secrets, and never force-push a branch you have not just verified.