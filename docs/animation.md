# Animation and rig ownership

Runtime rendering is the 32-view 2.5D sprite set. A model or rig is an optional offline production
source, not a runtime requirement. The renderer never owns a combat fact. The simulation
(`engine/`, `game/src/sim/`) owns start, release, impact and recovery in integer microseconds.
An animation clip is presentation: it may align a pose to those beats, but it cannot publish
damage, a cooldown or a reward.

## Owners

| Source | Owns |
|---|---|
| `game/src/ui/combat/animation/manifest.ts` | Runtime identity → rig/sprite resolution, the clip schema, the validator and the phase floor. |
| `game/src/ui/combat/arena/`, `game/src/icon/mob/`, `game/src/icon/gear/` | Shelf art the fallback names. |
| `docs/animation.md` | This contract. |

A production rig is imported only after `validateAnimationManifest` accepts it and every runtime
identity resolves by name. An identity without a rig must name the sprite it actually draws; the
arena exposes that name as `data-animation-source`, so a missing rig is reported rather than
silently replaced.

## Units and pivot

- Ground units are metres, the same as `combat_arena`.
- The root pivot is at the feet: `feetPivot.y = 0`. A model's origin may sit anywhere above it;
  the renderer subtracts the pivot before placing the feet on the projected ground.
- Facing is radians on the ground plane. Clip direction is a presentation sector; the sim facing
  remains the authority for aim, range and hit tests.
- Sockets name bones (`weapon.main`, `weapon.off`, `hand.right`, `hand.left`, `head`, `chest`).
  A socket is a pose anchor, never a hitbox. Contact is resolved from the swept body/collider.

## Clips

Each clip declares a phase (`idle`, `walk`, `turn`, `windup`, `release`, `recovery`, `channel`,
`hit`, `death`, `despawn`) and a duration. `release` and `impact` markers are fractions in `[0, 1]`
for pose alignment only. The validator requires locomotion, action and outcome clips, finite
durations, in-range markers, a skeleton and a non-empty sprite fallback.

**Phase floor (F44).** `phaseFloorSec` is the shortest windup or recovery an animation can play.
A clip below the floor is rejected. The floor is a presentation budget; the phase itself still
reads the sim's timing. If a future balance change makes a phase shorter than the floor, the
animation stays readable but the sim's hit time does not move.

## Acceptance

1. Every active species and each player weapon group resolves through the manifest; a rig's
   model stem is lowercase-hyphen and its feet pivot is at `y = 0`.
2. Walk speed, release and impact line up with the sim beat; no snap at a transition.
3. A missing rig reports the sprite name it draws.
4. Damage and rewards never read a clip's end or a frame callback.
