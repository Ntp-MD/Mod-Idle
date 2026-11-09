# Pawn study

Runtime source set for the four-view player and monster pawns. The atlases are already the game's default; regenerate the game copies from this folder.

## Folders

- `atlases/` — packed four-view 2×2 or eight-view 4×2 PNGs imported by the game.
- `sheets/` — original generated four-view sheets.
- `frames/` — extracted south, north, west and east images for review.
- `sources/` — identity references and variant comparison boards.
- `generation/` — generated source sheets, including the 2×2 diagonal-only sheets in `eight-direction/`.
- `previews/` — contact sheets, review images and the standalone preview template; not imported by the game.

`manifest.json` records runtime approval and asset provenance. `roster.json` and `variant-roster.json` define the source lists; `build-study.py` regenerates atlases and installs them.

When a diagonal sheet is present, `build-study.py` copies the four cardinal cells from the active game atlas unchanged. It removes the diagonal sheet's white background, uses one scale factor for all four diagonals based on the cardinal body's visible height, then packs the eight directions in `south, south-east, east, north-east, north, north-west, west, south-west` order.

For incremental review, install only completed identities with `integrate --only <pawn-id> ...`; an eight-view atlas is rejected until its diagonal sidecar records passed pose, anchor, shared-scale and cell-bound reviews. Keep roster checks blank until the same review is complete.

`eight-direction-roster.md` tracks all 36 base species and 109 distinct art variants by owner and facing. Agent B's 14 species groups and the Player pawn are generated and checked; Agent A's rows remain the outstanding batch. New diagonal sources and reviewed 4×2 sheets are kept under `generation/eight-direction/` or `sheets/eight-direction/`. The game still reads the approved four-view runtime atlases until a separate integration step installs and validates the 8-view atlases.

From the repository root:

```powershell
python art-reference/pawn-study/build-study.py build
python art-reference/pawn-study/build-study.py integrate
node tools/mob-sprite-pool.mjs
```
