# Spec: Text UI

> Back to: [README.md](../index.md) · rules: [rules.md](../10-design/systems-specs/design-rules.md) · **Status: `draft`**
> Direction: **text-based RPG idle, fantasy theme** (D13)

This supersedes the earlier "PoE-style equipment slot" idea, which came up in the same session. Reasons in §4.

---

## 1. Screens

| # | Screen | Question it answers | Why it exists |
|---|---|---|---|
| 1 | **Report** | what happened overnight | the first 60 seconds of the day · you have to decide from this |
| 2 | **Inventory** | what you are holding, what is usable | a list of text lines, not a grid |
| 3 | **Equipment** | what is equipped, what a swap would give | 4 slots per `SLOT-GATE` |
| 4 | **Zone select** | where to go next | where `CONTENT-TWOTIER` decides you are safe |
| 5 | **Tree** | which nodes are taken and banked | no classes · `TREE-DIM` |
| 6 | **Contract** | this cycle's modifiers | the only place a full cliff is allowed |

### Inventory layout

No drag-drop, no tiles. Everything is a line of text.

```
-- INVENTORY ---------------------------- 142 / 200 --
[rare]   Ashen Maul of Fracture          +18% pen  [ARMOUR HIGH]
         kills/h 118-131   up +12% vs equipped
[rare]   Warden's Grips                   +1 armour shred, +9% tempo
         kills/h 121-134   up +7% vs equipped
[magic]  Ember Sash                       +14% fire
         kills/h  96-112   down -24% vs equipped      (FIRE-RESIST ZONE)
-- 3 more --
```

**Principles for one line:**

1. **Name + affixes** (identity)
2. **kills/h as a band**, never a single number (D14)
3. **Compared against what is equipped**, as a percentage — not two raw numbers side by side
4. **The condition that makes it matter, in words** — this is what text does that a graphical UI struggles with

---

## 2. Band, not mean

`evidence/01` measured per-encounter variance:

| build | mean | p5..p95 |
|---|---|---|
| 1 proc 30% | ×1.3 | ±9% |
| heavy proc 5% +2000% | ×2.0 | **±57%** |

**Text exposes variance head-on.** Print `124.7 kills/h` and the player sees a jittering number, concludes the build is broken, and stops trusting the game.

→ print `118-131` instead · **the width of the band is the feedback**

And it lines up with D3 + `CONTENT-TWOTIER`:

| Content tier | The band should be |
|---|---|
| idle-safe | narrow · every preset sits within ~20% of optimum |
| contract | allowed to be wide · because the player *chose* it and is *awake* |

**The free advantage text has that PoE does not:** if you show the band, the player knows from day one how stable their build is, instead of seeing numbers jump and assuming the game is buggy.

---

## 3. Colour does semantic work — O9 has to be answered

| Colour | Carries |
|---|---|
| rarity | common / rare / epic / unique — **unresolved, see [rarity](../04-items/rarity-system.md)** |
| **zone-conditional tag** | a number that only matters in that zone must be **emphasised**, or `TAGGED-VERBATIM` cannot work |
| band | a wide band is a warning that the build is not stable |

**The open question (O9):**

| Level | Upside | Downside |
|---|---|---|
| plain text | runs anywhere, trivial to write, screen-reader friendly | colour does nothing, so rarity has to be spelled out |
| ANSI 8-16 colours | enough for rarity + highlight | tied to terminal themes; some phones have no colour |
| styled markup | full control | needs a renderer, which is UI work again — exactly the risk D13 just removed |

→ Decide before anything else, because choosing level 3 puts us back at PoE-tooltip difficulty.

---

## 4. Why not PoE-style

This session started at "PoE-style equipment slots (paperdoll + tooltip + drag-drop)" and changed, because:

| PoE-style | Conflicts with |
|---|---|
| 11-slot paperdoll + 4 stash tabs | `SLOT-GATE` — `evidence/08` measured that Melvor has 11 slots accepting `+%damage`, and doing it that way makes **every item invisible** → MVP = 4 slots |
| item level as a value proxy | D4 — no global item score, it has to be contextual per zone |
| drag-drop to move items | D2 — mobile-first, and bulk is already handled by auto-salvage |

**The replacement that is needed and does not exist yet** → this is the project's risk number one, see [thesis.md §0.1](../10-design/pillars-vision.md)

---

## 5. The main risk: removing the visuals removes the feeling

D13 genuinely solves a UI problem (no art pipeline, no animator), but a good share of loot satisfaction in Diablo/PoE is visual — the drop animation, the rainbow item card, the big number that grows as you upgrade.

Text removes all of it, and what is left is `evidence/08`: swapping 4 slots = **+5.3% = invisible**.

→ the compensation is `TAGGED-VERBATIM` in §6 · if it is not enough, **this is the reason gate 5 can fail** while every technical gate passes.

---

## 6. `TAGGED-VERBATIM` — data with no numeric value still carries meaning

`SLOT-BUDGET` says that on the 4th slot of a shared pool a swap gives +5.3%, which is invisible.

But in text we can write:

```
[rare]   Ashen Maul of Fracture    +18% pen   [ARMOUR HIGH]
```

The +5% is still invisible, but **`[ARMOUR HIGH]` tells you the item only has a life while you are standing in a high-armour zone** — so you know to keep it, and you know it is worth nothing right now.

This is something a graphical UI finds very hard (it needs a designed symbol system), and it is the main advantage of the text direction.

**The rule:** every zone-conditional affix states its condition in words, never left to guess. The number says *how much*; the text says *when*.

---

## 7. Open

- [ ] **O9** render level (plain / ANSI / styled markup) — blocks this whole file
- [ ] **O10** the verb in 60 seconds — blocks the Report and Inventory screens
- [ ] **a second readout for drop rate** - the whole game is currently measured by one number, kills/h, and `BAND-DISPLAY` covers that one. If drop rate scales with clear rate, the UI needs a second band beside it -> see [proposals B13](../10-design/proposals.md)
- [ ] band format: `118-131` or `118~131 (+-5%)` — which reads faster
- [ ] inventory sort order: by kills/h delta? by zone tag? by when it dropped?