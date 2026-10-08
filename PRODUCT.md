# Product

**What this is.** Mod-Idle is an open-world idle RPG. The player picks a zone, the character fights it
forever, and the game runs while the window is open and while it is shut. The owner designs it; other
people play it, free.

**Where it lives.** `engine/` holds the shared math and every published number. `game/` is the Vite ·
Svelte · TypeScript client, and it reads the engine's numbers rather than copying them. `tools/` is the
cage layer — `node tools/verify.ts` green is the state of everything already built. `doc/` and
`tools/data/*.json` are the design and its numeric source.

**The screen the player is on.** The client is one screen, not a site. The field lies on the map: one
generated hex sheet is the backdrop, the fight is read in the corners the way a phone game laid out on a
monitor reads, and a place is picked, plotted and walked on the ground itself. There is no page scroll and
no navigation — the client covers and uncovers.

**Who uses it, and what they are doing.**
- **On the field:** watching. HP bars, the cast order, the chronicle, and whether the bag has filled up.
  Reading must never need a panel opened.
- **In a settlement:** working. Buying, selling, enhancing a piece up the ladder, crafting mods, sorting a
  warehouse, taking a task, travelling. This is where the task screens live, and it is what this pass built
  out.
- **Away:** the game keeps earning; returning shows what the absence paid.

**Platform rule.** Desktop or above, only. There is no mobile layout and none is wanted — the reference is
a mobile game played on a desktop. The window floors and the scaling steps are owned by the client's
stylesheet and its media queries, not by this file. Pointer and keyboard; no touch targets, no
viewport-height tricks for a phone.

**Constraints that are not negotiable.**
- Time is not a design constraint. Never gate a change, a test or a number on how long the game should take.
- The engine owns every number. A client screen may print a derived value only by reading it; a hand-typed
  copy of a derived anchor is a cage failure waiting to happen.
- Presentation never enters `engine/`. Colours, tones and layout are the client's and `tools/data/*.json`'s.
- No file under `engine/` or `game/src/` may read a coordinate table from `map.json` (the presentation-only
  cage) — the map is picked by settlement id and cell key, nothing more.
- Nothing is deleted by a full bag, an overflow, or a filter: a piece that cannot be carried is left, and a
  rejected drop dissolves into stones. The client must say which happened.

**What this pass had to answer.** The owner asked, in their own words: what does the UI look like when the
character is in town; build the buy screen, the enhancement screen and the craft screen; make the endless
ground colour blend into the real map; fix focus, blur and highlight; keep it desktop-and-above; give
keyboard shortcuts a settings screen; be careful about text selection; and in town let the hunt-pile slot
become a stash that is shared by every settlement, as quality-of-life.

**Standing product truths the new screens keep.**
- The warehouse and the stone services are settlement services: a long run ends in a trip home.
- The Waypoint warps free and instantly, but only to a settlement already walked to on foot.
- Gold is minted only by selling junk; stones are spent at the bench; the Collector pays neither gold nor a
  Mod.
- There is no death. A Push rests at camp and costs time only, so a locked build would be a harsher
  punishment than a lost fight — Respec is free, in a settlement.
- Enhancement can fail: a step can drop a level, spend a protection charge, or Break the piece outright. A
  Broken piece contributes nothing until repaired, and a corrupted piece accepts no further stone. Every
  enhancement screen shows that risk before the press, not after — the ladder's own shape, chances and
  prices live in `crafting.md` and `engine.json`, and the Forge reads them from the shared craft module.
