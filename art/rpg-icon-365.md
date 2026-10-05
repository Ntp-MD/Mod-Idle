# rpg-icon drop - 365 generated SVGs

Flat filled off-white silhouettes, 100x100, one `<path>` each, produced by the `rpg-icon` project.
Nothing here is wired into the game and nothing was overwritten - this landed in `art/inbox/`.

| folder | count | what it is |
|---|---|---|
| `new-skill-support/` | 59 | skill-UI vocabulary the game has no icon for: type badges, reserve tiers, cooldown states, ladder, skill level, preset, auto-press queue, AoE shapes, attributes, combat layers, weapon groups |
| `duplicate-of-existing-skill/` | 51 | **already drawn in this game** - one for every existing `art/icons/skills/*` icon. Kept only as a style alternative |
| `general/` | 255 | not skill icons: 141 cut from `icon-set.png` + 114 generated RPG content icons |

## Style mismatch worth knowing before you use any of this

The existing skill icons are line art - `viewBox="0 0 32 32"`, `fill="none"`,
`stroke="currentColor"`, `stroke-width="2.1"`, plus a `<title>` for a11y. These files are
flat filled shapes at 100x100 with a hard-coded off-white fill, so they will not sit next to
the current skill icons without restyling.

They do match the game-icons.net imports already in `art/icons/gear`, `items`, `mobs` and
`town`, which are `fill="#fff"` too - so the general pile is the closer fit.

## The one real gap found

`buff-energy-absorb` is the only skill of the 52 in the roster with no icon in
`art/icons/skills/buff/`. A version is included here as
`new-skill-support/skill-energy-absorb.svg`, but in the wrong style for that folder.
