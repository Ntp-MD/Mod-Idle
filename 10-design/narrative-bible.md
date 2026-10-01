# Combat log lines

> Back to: [wiki/index.md](../index.md) · zones: [zones.md](../01-world/regions/zones.md)

**The fantasy layer that makes a text game feel like a text RPG.** This is the substitute for the visual loot satisfaction that D13 removed — see [thesis §0.1](../../design/thesis.md).

**Numbers sit inside the sentence, never beside it.**

```
[04:12:03]  Your Maul bites deep into the Gateward for 3,910.
            Its gate knits closed — smaller blows will glance.

[04:12:03]  BREACH.  The gate splits.  Your Maul lands for 11,480.

[04:12:07]  The Gloomwarden slips the blow.  It is already fading into the ferns.

[04:12:11]  EXPOSED.  The Gloomwarden is marked — your next 3 strikes pierce evasion.

[04:12:44]  The Rustfang pack closes in — 8 bodies, one killing stroke.

[04:12:44]  CHAIN.  The spark leaps.  8 kills.  Your Momentum surges wide.

[04:19:02]  WARD BREAK.  The Steward's ward fails for one breath.

[04:19:02]  14,006 damage.  The Steward crumbles.
```

## Four principles

1. **The number is always inside a sentence.** No floating numeric line.
2. **Every window has a keyword** — `BREACH` / `EXPOSED` / `CHAIN` / `WARD BREAK` / `SURGE` / `ERUPTION` / `FRACTURE` / `SUNDER`. The player can learn the pattern without reading numbers.
3. **The big numbers always come from a window**, never from an ordinary hit. This teaches the player that you have to wait for the moment — which is the entire skill of the game.
4. **A penalty is told in prose, not subtracted.** *"Its gate knits closed — smaller blows will glance"* does the work of a negative number, and it does not add to the noise floor.

## Why this is load-bearing and not decoration

D13 (text-based) genuinely solves a real problem — no art pipeline, no animator, no UI designer — but a good share of loot satisfaction in Diablo/PoE is *visual*. The drop animation, the rainbow item card, the big number that grows as you upgrade. Text removes all of it.

What remains from the measurements is that swapping a 4-slot additive pool gives **+5.3%, which is invisible**. So if nothing replaces the visuals, the game passes every technical gate and fails gate 5, which is measured from real human hesitation.

These log lines are one half of the replacement. The other half is `TAGGED-VERBATIM` — the item line carries the *condition*, so a +5% affix still tells you something.

## Still needs designing

- Variation: 31 monsters means the templates cannot all read the same. Where does per-monster voice come from?
- Volume: at 8h offline and 288k ticks, how many lines does the player actually read? Scrollback or summary?
- Localization of fantasy terms (`Sunder`, `Eruption`) if the audience is not English-native.