# Stall / Camp event design — decision-choice storyteller

> Refined from the two-line seed. The seed idea is preserved: camp events as
> decision-choice gameplay driven by a storyteller, with a background scene that
> reflects the current state. This document expands that into an implementable
> design that fits the existing architecture (data → engine → sim → ui) and the
> game's stated values. It is a design note, not a committed feature: nothing here
> is wired into code yet, and no row in `tools/data/` is changed.

## Design goal

Turn the passive Field Camp into a **short, authored encounter layer**: when the
player rests or returns to camp, a storyteller presents a situation and a small
set of choices. The background and the narration reflect the situation. The
player's choice resolves the situation, then the camp resumes. Everything must
respect the game's core rule — **time is the only cost, and there is no death**
(see `docs/glossary.md`): a choice may cost time, items or progress, but it never
kills the player or locks them out.

## Glossary alignment

Reuse the existing terms so the design does not invent vocabulary:

| Term (from `docs/glossary.md`) | Use here                                                                                   |
| ------------------------------ | ------------------------------------------------------------------------------------------ |
| **Camp** / **Field Camp**      | The location these events belong to; a map landmark.                                       |
| **Field of Enemies**           | A `combat` event is a field encounter, not a new combat mode.                              |
| **Push** / **No death**        | A losing choice pushes the player out of the encounter, never kills.                       |
| **Time is the only cost**      | Every consequence is denominated in time, items or progress — never an unrecoverable loss. |
| **Read only**                  | A state the player can observe but not act on (e.g. inspecting a discovered object).       |

## Event states

The seed lists eleven states. They are **states a camp situation can be in**, not
eleven separate systems. Group them so a storyteller scene can transition between
them and so each has one clear resolution rule.

| State          | Kind        | What the player sees                        | Resolution                                                    |
| -------------- | ----------- | ------------------------------------------- | ------------------------------------------------------------- |
| **sounds**     | ambient     | Distant noise; nothing visible yet.         | Investigate (→ discovered / prowler) or ignore (→ timeout).   |
| **prowler**    | threat      | A creature circling the camp edge.          | Scare it off (time), stand ground (combat), or feed it (aid). |
| **traveler**   | social      | A stranger approaches the fire.             | Share supplies (aid), trade, or send away.                    |
| **nest**       | discovery   | A small nest with eggs or young.            | Take (full bag risk), leave (read only), or wait (timeout).   |
| **herd**       | opportunity | A passing herd; a chance to gather or hunt. | Hunt (combat), harvest (aid), or let pass (timeout).          |
| **aid**        | support     | Someone needs help / offers help.           | Give (cost), accept (gain), or decline (timeout).             |
| **discovered** | reveal      | An object or sign the player notices.       | Read only unless a choice exists.                             |
| **combat**     | encounter   | A field fight begins.                       | Resolve via the existing combat sim; push on loss.            |
| **timeout**    | end         | The moment passed; nothing happened.        | Close; return to camp.                                        |
| **full bag**   | limit       | Carrying capacity is reached.               | Drop (cost), keep (slows), or discard loot.                   |
| **read only**  | inspect     | Pure observation; no action.                | Close; no cost.                                               |

## Decision-choice structure

Each event is one **scene** with a `storyteller` line and **2–3 choices**. A
choice has a label, an optional cost, and a resolution that moves to a new state
or closes the scene.

```ts
// Presentation shape, not yet wired. The sim/engine layers own the actual rules.
type CampEventChoice = {
  label: string; // player-facing
  cost?: { timeSec?: number; item?: string; qty?: number };
  result: "to-state" | "combat" | "close" | "read-only";
  next?: CampEventState; // when result = 'to-state'
  flavor?: string; // storyteller line for the outcome
};
```

Rules for every choice:

1. **At most one cost type per choice.** Mixing time and items makes the cost
   unreadable; pick the one the state is about.
2. **`combat` reuses the existing field combat** — it never spawns a separate
   combat mode. Loss is a push out, not death (glossary: Push / No death).
3. **`full bag`** appears only as a consequence of a `take` choice, never as a
   first-choice state, so the player is not blocked at the top of a scene.
4. **`read only`** always closes with no cost and no state change — it is the
   "just looking" escape hatch that never punishes.
5. **`timeout`** is the no-choice-outcome: the player deliberately let it pass or
   picked "wait". It costs the time they spent, nothing else.

## Storyteller and dialog events

The storyteller is the **single voice** that frames a scene and its choices. It is
presentation, not a rules engine — it never rolls, never picks a target, never
publishes damage.

### Storyteller scene

```text
[background: state image]   <- one bg per state (the seed's "ฉาก bg เป็นสถานะ")
[storyteller portrait]      <- optional; a character that narrates camp events
"Narration line describing the situation and the stakes."
--- choices ---
  [choice label]   [choice label]   [choice label]
```

- **One background per state.** `sounds`, `prowler`, `traveler`, `nest`, `herd`,
  `aid`, `discovered`, `combat`, `timeout`, `full bag`, `read only` each have one
  bg asset. The same bg is reused if the scene loops back to a state.
- **Narration is short and diegetic** — it names the thing, the stakes, and the
  player's options. It does not lecture or explain mechanics.

### Dialog event contract

```ts
// One authored beat; the storyteller speaks it, then the scene waits for a choice.
type StorytellerBeat = {
  id: string; // stable key, lowercase-hyphen
  state: CampEventState;
  portrait?: string; // shelf art key, e.g. 'storyteller-ambassador'
  line: string; // the spoken narration
  choices: CampEventChoice[];
};
```

- **Idempotent beats.** A beat's outcome depends only on its id and the player's
  choice, never on wall-clock time, so a reload or replay of a scene is stable.
- **Never reads combat facts.** Damage, cooldowns and rewards stay in `engine/`
  and `game/src/sim/`; the storyteller only narrates what the scene resolved to.

## Where each part lives (architecture fit)

Follow the existing ownership so this does not leak mechanics into presentation:

| Layer      | Owns                                                             | Suggested location            |
| ---------- | ---------------------------------------------------------------- | ----------------------------- |
| **Data**   | The authored scene graph: states, choices, narration, costs.     | `tools/data/camp-events.json` |
| **Engine** | Pure resolution: cost checks, state transitions, no UI.          | `engine/camp-events.ts`       |
| **Sim**    | Runtime composition: which scene is active, what it resolved to. | `game/src/sim/camp/`          |
| **UI**     | The scene view: bg, portrait, narration, choice buttons, dialog. | `game/src/ui/camp/`           |

- The scene **view** is presentational and derives everything from the active
  sim state; it never rolls or applies costs itself.
- **Background assets** follow the shelf-art rule: keep them under
  `art-reference/` until approved, then `game/public/`. One bg per state.

## Acceptance criteria

1. Every state has one background and one resolution rule (the table above).
2. Every choice has at most one cost type and a `result` that is reachable.
3. `combat` reuses the existing field combat and never kills on loss (push).
4. `read only` and `timeout` never cost more than time spent; neither punishes.
5. The storyteller never publishes damage, cooldown or reward values.
6. A reload of a scene is stable (idempotent beats; no wall-clock dependency).
7. No `tools/data/` row is changed and no code is wired until this is approved.

## Open questions to resolve before implementation

- Should camp events be **mandatory on rest** or **opt-in** (a prompt to listen)?
  Opt-in keeps the idle loop unobstructed; mandatory makes camp feel alive.
- How often should a scene trigger — every rest, or a roll? The game charges time,
  so a roll that costs nothing to decline keeps the idle loop fair.
- Does the **storyteller have a persistent identity** (a recurring character with
  a portrait) or is it a per-event narrator? A recurring voice builds continuity.
- Should `full bag` be a **hard stop** (must resolve before leaving) or a **soft
  reminder**? The glossary's "time is the only cost" leans soft.
