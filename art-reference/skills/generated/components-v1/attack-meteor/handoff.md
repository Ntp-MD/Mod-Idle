# Meteor component source and selected recipe

Producer/integrator: this Codex chat, 2026-10-26. First-party images use the built-in image generator. Original PNG pixels are preserved byte-for-byte in the runtime copy. Selection uses the existing authored registry and arena, with no additional gameplay hits from decoration.

Canonical ID: `attack.meteor`. Authoring snapshot: target-origin circle radius 3m, diameter 6m. Latest plan ruler: standard ground footprint diameter 0.5m, independent of actor silhouette. Repeated decorative stones do not create extra hits.

| Component | Image | Intent | Authored visual size |
| --- | --- | --- | --- |
| meteor-fall | meteor-fall.png | One rock; internal heat cycle, runtime supplies translation | 0.35m width |
| meteor-trail | meteor-trail.png | Separate upward flame/smoke tail; runtime attaches to rock | 0.8m length |
| meteor-impact | meteor-impact.png | Local contact burst, debris and decay | 0.65m peak width |

Each image has its exact generation prompt in `<component>-prompt.txt` and measured source facts in `<component>-qa.json`. Style references: current human rogue base and existing Meteor palette; neither is included as an actor in the output.

All three originals are 1254 x 1254 RGBA, despite requesting 1024 square. Raw perimeter alpha reaches 1/255; it is below the existing 8/255 discard threshold, not perfectly zero raw alpha. Preserve originals.

Selected recipe: `components-v2`, active through `authoredCompositionFor` and the scene depth assembly. `game/src/ui/combat/fx-manifests/components-v2-manifest.json` reuses unchanged v1 PNGs and frame registration, and authors the diagonal motion. The v1 manifest is retained as source history. The raw QA files remain the original generation inspection, not the runtime slicing contract. Each runtime frame uses an explicit measured source rectangle and a luminous-tip/contact-base pivot registered on a shared virtual canvas. No uniform 4x4 slicing is assumed. Fall/trail each have 16 visible frames; impact has 15 visible frames and an explicitly sampled empty terminal slot after the 8/255 discard.

The assembly uses one centre, four inner and eight outer sites inside the committed footprint, including empty ground. Sites and texture phase depend on an action seed, never combat RNG or target count. Rocks and tails travel diagonally from upper-left toward their landing points, using the explicit view-space direction [0.5, 1]. Source-forward alignment rotates both rock and trail by approximately -26.565 degrees. Each landing site has its own actor-relative depth; the ground ellipse is projected independently below actors. Decorative rocks share the real impact beat. Impact playback starts at source frame 4 (the peak) at that beat and decays through frame 15; frames 0-3 are retained source pixels and are not displayed as successful contacts before damage. The impact sequence lasts 0.72 seconds at 60ms/frame. Reduced motion preserves the footprint and subdued contact markers while omitting moving falls.

Historical v1 representative arena checks used the real `/__showcase?sample=arpg-arena&skill=attack.meteor` host at a verified browser inner viewport of 1920x1080. The inspector exposes actual start/release/impact timestamps, paused seeking, replay of retained captured time and system/full/reduced motion. Fall, impact, decay and cleanup were inspected against actual actors. The captured PNGs exclude browser-edge pixels and are 1910x1074; their filenames name the tested viewport. A temporary missing-fall URL produced the retained spatial-v2 atlas instead of an invisible cast; the fixture was restored and the selected-source checker passed afterward.

Historical v1 proof images: [fall](meteor-fall-integrated-1920.png), [impact](meteor-impact-integrated-1920.png). These show the earlier vertical assembly. Current v2 proof: [diagonal fall and actor depth](meteor-diagonal-depth-1920.png), inspected in the real arena at 1920x1080. At sampled times 0.75 and 0.85 seconds both X and Y advance; rotation is approximately -26.565 degrees. Landing layers straddle actor depth in the same stacking context. The 0.95-second actual impact selects peak frame 4; reduced motion selects subdued frame 9. A missing-fall fixture removes depth pieces and restores the spatial-v2 fallback with a diagnostic path; the fixture was restored. These are representative checks; whole-roster art and render coverage is gated by `arena-authored-vfx.test.ts` and `arena-authored-vfx-render.test.ts`.

The previous spatial-v2 field remains the runtime fallback and all earlier PNGs are intact. This handoff records source provenance and current selection; performance remains unmeasured.
