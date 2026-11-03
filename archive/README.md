# archive/ — retired assets

Parking for content that has been retired from the live game but is still worth keeping:
superseded VFX versions, replaced art, abandoned sheets.

- Nothing here is imported, resolved or shipped. `game/public/**` is copied verbatim into
  `game/dist`, so an asset left there "unused" still reaches players; move it here instead.
- Keep the provenance: `meta.json`, `qa.json` and every `source-license-*.txt` travel with
  the asset unchanged. If the folder had none, record where it came from in a sibling
  `RETIRED.md` (date, reason, replacement path).
- Layout mirrors the source: `archive/fx/skill-pool/attack-phy/attack-whirlwind/v1/`. Content
  retired before the element split keeps the folder it lived in (`archive/fx/skill-pool/attack/…`).
- Code does not come here. Delete it and let git history be the record; only assets that
  cannot be regenerated are worth the space.

Skill VFX follows the pool's own retirement steps — `game/public/fx/skill-pool/README.md`
owns the pointer and regeneration gates, so read it before moving a `vN` folder.
