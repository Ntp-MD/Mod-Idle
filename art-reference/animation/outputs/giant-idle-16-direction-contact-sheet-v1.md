# Giant idle 16-direction contact sheet — draft

Image: giant-idle-16-direction-contact-sheet-v1.png

This is a visual concept sheet for the first species in the selected excerpt, **giant**. It contains one idle pose for each of the 16 directions in row-major order:

1. south, south-south-east, south-east, east-south-east
2. east, east-north-east, north-east, north-north-east
3. north, north-north-west, north-west, west-north-west
4. west, west-south-west, south-west, south-south-west

The required source set is 272 separate frames per species: idle 1 × 16 directions, plus walk, attack, hit and death at 4 × 16 directions each. This sheet covers idle only and is not a runtime atlas. It has not been split into pose files and does not change the inventory count.

**Review notes:** built-in image generation produced a 1254 × 1254 image, so the 4 × 4 cells do not form exact integer-sized source frames. Colored edge fringing remains on several silhouettes. Keep this under outputs/; do not promote or count it as source coverage. No structural atlas QA was run because this is neither the 272-frame source set nor the separate 8 × 5 runtime atlas. Visual review only.

**Generation prompt:** Create a transparent 4 × 4 row-major contact sheet of the same stocky, bald, muscular, auburn-bearded giant in one neutral ready pose per facing. Keep the brown leather kilt, stone-headed club, pixel-cluster RPG style, consistent body scale and feet baseline. Direction order is south, south-south-east, south-east, east-south-east, east, east-north-east, north-east, north-north-east, north, north-north-west, north-west, west-north-west, west, west-south-west, south-west, south-south-west. Give every direction a distinct silhouette; do not mirror or rotate a view. No labels, borders, floor, shadow, scenery, effects or extra subjects. This is an idle-only visual draft, not a complete animation set.

**Edit prompt:** Preserve the exact 4 × 4 canvas, facing order, poses, identity, proportions, club and baseline. Remove the bright red and yellow-green silhouette fringe and color spill, use a clean dark-brown outline and crisp pixel clusters, and retain true transparency. Add nothing else.

**Tool:** built-in image_gen.