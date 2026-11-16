# Pawn study

Runtime source set for the player and monster pawns. The atlases are the game's default; regenerate the game copies from this folder.

## Folders

- `atlases/` — packed four-view 2×2 or eight-view 4×2 PNGs imported by the game.
- `sheets/` — original generated four-view sheets.
- `frames/` — extracted south, north, west and east images for review.
- `sources/` — identity references and variant comparison boards.
- `generation/` — generated source sheets, including the 2×2 diagonal-only sheets in `eight-direction/`.
- `previews/` — contact sheets, review images and the standalone preview template; not imported by the game.

`manifest.json` records runtime approval and asset provenance. `roster.json` and `variant-roster.json` define the source lists; `build-study.py` regenerates atlases and installs them.

Each monster species and variant has one runtime atlas in `master-version/`; integration updates it in place. The player pawn keeps its existing version pointer. Some generation sidecars retain old `vN` paths as historical references to the art used at generation time; those paths can be recovered from Git and are not runtime inputs.

When a diagonal sheet is present, `build-study.py` copies the four cardinal cells from the active game atlas unchanged. It removes the diagonal sheet's white background, uses one scale factor for all four diagonals based on the cardinal body's visible height, then packs the eight directions in `south, south-east, east, north-east, north, north-west, west, south-west` order.

For incremental review, install only completed identities with `integrate --only <pawn-id> ...`; an eight-view atlas is rejected until its diagonal sidecar records passed pose, anchor, shared-scale and cell-bound reviews. Keep roster checks blank until the same review is complete.

The runtime pool contains 36 species and 109 distinct art variants. New diagonal sources and reviewed 4×2 sheets are kept under `generation/eight-direction/` or `sheets/eight-direction/` and require review before integration.

From the repository root:

```powershell
python docs/character/pawn-study/build-study.py build
python docs/character/pawn-study/build-study.py integrate
node tools/mob-sprite-pool.mjs
```
