# Original player direction review

This is a draft idle turntable for the actual player identity in the parent set.
**Chosen production facing target: 32 views (11.25 degrees apart).** The 16-view pane
remains the lower-density comparison baseline.
It replaces the unrelated model fixture in `/__showcase?sample=sprite-directions`.

The 32-entry pool comprises eight existing `../poses/idle/` source views and 24
individually generated intermediate candidates under `poses/idle/`. The 16-view
pane uses entries 0, 2, 4, ... 30 from that same pool. Source PNG pixels are
unchanged; the preview crops visible bounds, scales uniformly to one body height
and aligns feet when drawing. It does not rotate, mirror or blend an existing
view to fake a missing facing.

`manifest.json` owns the frame order, requested bearings, paths, SHA-256 hashes,
read-only alpha bounds and estimated foot anchors. Each new pose has its full
built-in ImageGen prompt and provenance sidecar. The original files in the
parent set are retained unchanged.

**Status: candidate review, not approved production animation.** Requested
angles are generation instructions, not verified geometric azimuths. Generated
hood/cape volume, anatomy and turning continuity still require art review.
Soft alpha remains in the unchanged sources. No walking frames were generated
for the new directions. The old 8-direction mold is not marked complete by
this turntable and production assets are not replaced.
