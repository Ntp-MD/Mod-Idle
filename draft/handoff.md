# Handoff — best-practice audit fixes + `App.svelte` split

Written at the end of the session that worked through the audit finding list ("sure let fix" → "ต่อ").
Not a design doc: this is the working state, what is verified, and what is not.

**Verified green at hand-off:** `npm run check` 0 errors / 0 warnings · `npm test` **281 passed / 23 files** ·
`npm run verify` **5/5 cages, 0 FAIL** · `npm run wiki` rebuilt (18 pages).

**One change is NOT browser-verified — see §2. Do that first.**

---

## 1 · What this session changed

### 1.1 Data → engine (numbers leave the code)

| Change | Where |
|---|---|
| `mob.attack_clock_per_sec {normal:1, elite:1, boss:0.8}` + `build.weapon_aspd_default: 1.2` | `tools/data/engine.json` |
| `mobClock` reads the data and is capped at `1 / caps.attack_interval_sec` | `game/src/sim/game.ts` |
| aspd fallback for a bare hand reads the data | `game/src/sim/player.ts` |
| Mastery column reads `weaponSkillBonusPct()` instead of `(lv - 4) * 0.5` | `game/src/App.svelte`, `game/src/sim/mastery.ts` |
| `archetype_bands` re-worded: **provenance only, no formula reads it** (was claiming a read that did not exist) | `tools/data/skills.json`, `engine/types.ts` |

### 1.2 Persistence / idle loop

- `game/src/state/save.ts`: every `put` writes the **localStorage mirror synchronously**; `get` reads the
  mirror first (so it can never be staler than IndexedDB); new `writeSaveSync()` is the synchronous twin.
  `beforeunload` / `visibilitychange` now use it — closing the tab loses nothing.
- `game/src/App.svelte`: a `paused` flag holds the tick interval across `doLoad`, so a live tick cannot sim
  the away window twice.
- `game/src/App.svelte`: Panel focus is restored to the control that opened it (`ui/Panel.svelte`), and the
  App's Escape handler stands down when a dialog is open (one Escape owner).

### 1.3 One engine instance

`road` and `farm` are instantiated once in `game/src/engine/client.ts`; `sim/road.ts` / `sim/farm.ts`
re-export them and `wiki/pages.ts` imports them — the wiki no longer builds a second Road/Farm.

### 1.4 Cages and typing

- `X42`, `OP7`, `OP8`, `MP1`, `S11` went back to **hard** gates (`add`). `X12` / `X13` / `X43` stay
  advisory (`soft`) — they are owner rulings, not invariants — and are now covered by tests instead.
- **`@ts-nocheck` is gone from `tools/`.** Both `tools/check.ts` and `tools/imprint.ts` type-check under
  `strict`. The 126 diagnostics were fixed at the seam (`engine/types.ts`), not with `as any`:
  `Caps.crit_chance/accuracy/block_divisor` added and `block`/`stun` made `number | null`; `StoneSource`
  split into `QualityStoneSource` / `RepairStoneSource` / `CorruptStoneSource`; `MobSpecies.damage: string`,
  `core` + index signature, `line` required; `MobCfg.skills_enabled/reach/attack_clock_per_sec` required;
  `EnergyShieldCfg.player_only` and `LootCfg.variant_lean` required.
- **Two real bugs the typing found:** the A5 table row printed `f0(FORCED_SPLIT)` without destructuring it
  (`undefined`), and X36 divided a formatted string by 10 (`f1(x * 10) / 10`). Both fixed.

### 1.5 Sizing (⑫)

Every **px** inside `clamp()` in `game/src/**/*.{svelte,css}` was rounded to an integer (13 files,
659 values in `App.svelte`). `vw` coefficients and the `+ Cpx` offset were **kept on purpose**: the offset
is what anchors both ends (min at ~1282px, max at ~2900px) — dropping it moves mid-range sizes by 10 %+.
Hex colours left the components for `--face-top/floor`, `--orb-top/floor`, `--hot-deep` in
`game/src/styles/variables.css`.

**`--ui-scale` was deliberately NOT added.** A knob nothing reads is dead code. The shape is now ready for
it: `calc(var(--ui-scale) * clamp(<int>px, <n>vw + <int>px, <int>px))` — the base and the offset scale
together, which is what a game UI scale wants. Needs an owner decision (whole-HUD scale vs per-component)
before it is wired.

### 1.6 New modules and tests

| File | Lines | Holds |
|---|---|---|
| `game/src/ui/hud.ts` | 57 | `snapCounters` · `buildAwayReport` · `fieldLabel` · `describeSnap` |
| `game/src/ui/field.ts` | 44 | `bar` · `curseWords` · `statusWords` |
| `game/src/ui/motion.ts` | 25 | `fxOut` (shared by the field and the floaters column) |
| `game/src/ui/FieldPlates.svelte` | 421 | the mob plates + the character's own card (see §2) |
| `game/tests/shapes.test.ts` | 112 | one test per softened shape: X13 · X12+X43 · X42 · MP1 · OP7+OP8 · S11 |
| `game/tests/progression.test.ts` | 156 | Mastery · the passive tree · the win gate · the level ramp (S18) |
| `game/tests/simModules.test.ts` | 257 | `slots` · `presets` · `farm` · `town` · `collector` · `drop` |
| `game/tests/viewModels.test.ts` | 215 | `bag` · `plate` · `map` · `hud` · `field` view models |

Test count went 227 → **281**. Five sim modules that had no direct test now do.

---

## 2 · IN FLIGHT — must be browser-verified

`game/src/ui/FieldPlates.svelte` was extracted from `App.svelte` (4078 → **3702** lines). The **markup and
all its CSS** moved. It type-checks and all 281 tests pass, but **the rendered result has not been looked
at since the CSS move**. The CSS surgery is the risky part: 39 rule positions were cut from `App.svelte`'s
`<style>` and re-planted in the child, one multi-selector rule (`.mobbar i, .mini-bar i, .target-hp i`) was
split, and **one `}` was lost and restored by hand**.

Verify:

1. `npm run dev` → open the printed port (5173 is often occupied by another server; use whatever it prints).
2. Hunt something: the map focus is on at start → click the **Eastgate** cell → the TravelCard's
   **hunt here** button.
3. Confirm, on the field:
   - the mob plate: portrait, name, body line, **HP bar with the `--w` ramp**, `PS / Hit / Dodge` chips,
     element label, the `curses` line (`—` when empty);
   - the character's own card: HP / ES / Mana bars;
   - a swing draws the **arc** and a press the **burst**; a hit flashes the rim; numbers pop and leave;
   - the `elite` / `boss` accents and the `front` crop marks;
   - with no group: `Next group in N sec.` or the hunting-off promise;
   - while walking: the boot-print stride.
4. Console must be clean (the only expected error is the pre-existing `favicon.ico` 404).
5. Turn map focus off (Escape / the Field tab) — the field must stay laid out correctly. `.stage.mapmode`,
  `.stage.veiled`, `.townmode` all style `.field` from `App.svelte`; the `div.field` container
  **stayed in App** precisely so those rules keep matching.

If something is unstyled, the rule did not move: re-run `npm run check` and read the
`Unused CSS selector` warnings — Svelte names exactly which rule is now homeless.

Also worth a glance: `App.svelte` around the `.mobbar b { … }` / `.mini-bar i, .target-hp i` pair
(the hand-restored brace), and the child's `@media (min-width: 1600px)` block at the end of its `<style>`.

---

## 3 · Remaining work

### 3.1 The rest of the `App.svelte` split (⑤/⑪)

Still in `App.svelte`, each a candidate for the same treatment:
`CastBar` (cast order orbs) · `Vitals` (portrait + XP ring + pools) · `SheetModal` (+ `AllocOverlay`) ·
`MenuRing` (hub) · `Floaters` (hit ring) · `PickCard` · `ReadColumn` (zone tag + purses + minimap +
objectives) · `LogBox` · `ExpBar` · the `<Panel>` blocks (`bag/forge/craft` ≈163 lines, `desk` ≈156,
`skills` ≈142, `save` ≈48).

**The recipe that worked here:**

1. Move the **contents** of the block into the child; **leave the outer container in App** if an App-side
   ancestor selector styles it (`.stage.mapmode .field`, `.veiled .field`, …) — Svelte scoping would
   otherwise break those rules silently.
2. Pass state, not derived reads: `s`, `c`, `ring`, `plates`, `zone`, `town`, `townLive`, `plateMotion`,
   `fxOutMs` (9 props). Anything derivable is re-derived inside from `ui/*` helpers.
3. `npm run check`, then **treat the `Unused CSS selector` warnings as the to-do list** — cut those rules
   from `App.svelte` and append them to the child's `<style>`.
4. Multi-selector rules: move only the wanted selector; keep the rest in App. Watch the leading `}` —
   the parser used here ate one; verify brace balance after any scripted move
   (`open == close` in the `<style>` block).
5. Browser-verify the block before moving on to the next one.

### 3.2 Do NOT split these two

`engine/index.ts` (984) and `game/src/sim/game.ts` (1288) are single cohesive closures whose locals are
genuinely interdependent. Cutting them would invent seams that do not exist. Leave them; the section
headers already make them navigable.

### 3.3 Dead code found, not yet acted on

`tools/check.ts` has a `BLOCKS` object (~110 lines, the group **A / B / C / F** table generators) that
**nothing reaches**: there is no `--tables` flag, and the only CLI paths are `--checks` and `--sync`.
`tools/lib/engine.ts` still comments "Read by tools/check.ts (groups A · B · C · F)".
Decide: delete it, or wire a `--tables` entry point back. The A5 bug (§1.4) hid in there for exactly this
reason — nothing ran it.

---

## 4 · Gotchas for the next agent

- **Run `npm run check`, not `tsc` alone.** The root `tsconfig.json` covers `engine/` + `tools/` only;
  `game/src` is checked by `svelte-check`. The two are disjoint — a game-side type error is invisible to
  the root `tsc`.
- **CRLF repo-wide.** Write files with the same endings. `io.open(path, 'w', encoding='utf-8')` in Python on
  Windows preserves them; a naive `open(..., 'w')` in text mode can re-write every line ending and make the
  whole file look changed.
- **Cages:** `add(id, ok, msg)` = FAIL on false; `soft(id, ok, msg)` = PENDING. Structural shapes belong in
  `add`; a published/derived *figure* is `soft`. Do not tighten a `soft` gate to force a design decision —
  that was the owner's standing complaint.
- **Wiki is a deliverable.** Any change that moves a number or a page read means `npm run wiki` **and** a
  grep of the hand-written prose in `game/src/wiki/pages.ts` in the same change.
- **Sizing:** px inside `clamp()` are integers; `vw` and the offset stay. Tokens only, from
  `game/src/styles/variables.css`.
- **Dev server:** the project's port is nominally 3000 but Vite serves 5173+; another server is often already
  listening. Reuse it or take whatever port Vite prints — and kill only the process you started
  (`netstat -ano | grep LISTENING | grep :517` then `Stop-Process -Id <pid>`); one server on 5173 predates
  this session and is the owner's.
- **Playing the game headlessly:** to start a fight from the console, click a `polygon.cell.town[data-node]`
  (synthetic clicks on the sheet itself do not pick a hex — the handler reads `ev.target.closest('polygon.cell')`),
  then click the TravelCard's **hunt here** for the settlement you stand in. Only the start settlement is
  `opened`, so other zones show `walk first`.

---

## 5 · Quick command reference

```
npm run check      # tsc (engine+tools) + svelte-check (game) — the only full typecheck that exists
npm test           # 281 tests, 23 files
npm run verify     # 5 cages: engine · skills · loot · bases · imprint
npm run wiki       # rebuild wiki/ (18 pages)
npm run dev        # client; prints the port it took
```
