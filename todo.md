# Todo

The **single work file**: only what is _not built yet_, split by who can close it — **A** waiting on the
owner · **B** mine to build · **C** housekeeping that must not rot. **When work is done the line is
deleted, not ticked.** `node tools/verify.ts` green is the state of everything already built, so never
copy a cage result in here.

## A — waiting on the owner

- The task board's sizing is marked provisional in `town.json task_sizing` — the owner's call on the
  elite count, the reward minutes and the offer weight. `town.json pending` carries the two open rebalances.
- The **Reforge stone** is minted by bosses, priced and gated (`craft.reforge_stones_per_use`, X62) and
  implemented in `engine/craft.ts`, but the bench has no press for it — the craft order named Polish only.
  A press is one button away; whether the piece's Tier should be redrawn for a stone at all is the owner's.

## B — mine

- A Boss hunt pays only its Remove stone. The winner's-choice alternative the board prices
  (`task_sizing.boss_reward.reroll_tier`) is in the data but wired nowhere in the client.

## C — housekeeping

- `engine.json` `meta.sources` and `meta.targets` name the retired doc shelf and feed nothing — fold them
  into the `aliases.json` `docs` record, or delete them, on the owner's ask.
