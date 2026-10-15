# Race junk and terrain spawn pools

## Goal

Give each mob race two or three additional junk items, allow a race to spawn in more than one terrain/subzone, and keep each mob's race icon.

## Current behavior

- A subzone's `races` list is the spawn pool used for its hexes. A pool can already contain multiple races.
- Spawn selection already filters the pool by `subzones[].races`; the X53 gate checks that every zone race appears at least once and validates variants, but does not reject a race repeated across subzones.
- `mobIcon()` already maps the species names to race-specific icons and `FieldPlates.svelte` uses it for mob plates.
- Junk is currently specified by variant in `mob.variant_drops`; each row owns an item, rarity, and drop lean.

## Intended behavior

1. Add three additional junk items for every race, one each at common, uncommon, and rare, alongside the existing items.
2. Keep each variant's current rarity and drop lean. When that variant drops junk, choose between its existing item and its race's extra item for the same rarity. This keeps its rarity and sell price unchanged.
3. Allow a race to be listed in multiple subzone spawn pools, including subzones with different environments/terrains. One hex continues to use its subzone's pool and can encounter any race in that pool.
4. Continue showing each mob with its species/race icon.

## Mob Core design rule

- `mob.species[].zones` continues to own which zones a race can appear in.
- A zone's subzone race lists are independent spawn pools, not a partition. A race may appear in multiple subzones, including subzones with different environments; the union of those pools must still cover every race assigned to the zone.
- Each race gains one additional junk item per rarity. Existing variant junk remains available; the variant continues to own rarity and drop lean, while the race supplies one matching-rarity alternative.
- Mob forms inherit their race's junk choices, just as they inherit the race drop profile. Mob icons continue to resolve from the race/species mapping.

## Boundaries

- Keep `map.json` presentation-only; terrain spawn pools stay in the engine data.
- Preserve existing variant rarity/lean semantics and the expected junk gold per kill.
- Do not change save data format.
- Update `doc/DECISIONS.md` §Mob Core and the relevant data gate so overlap is an intentional supported rule, not described as a partition.
- Add focused coverage for junk choice/economy and overlapping subzone pools; run the repository's required data gates and checks.

## Open implementation detail

Store the per-race junk alternatives by rarity so the inventory's existing item-to-rarity lookup can price them without changing the save format. Reuse the existing sale-price mechanics; do not add dependencies or change item pricing rules.
