# แม่พิมพ์สร้าง sprite และ movement ของ Mob Variant

ใช้ทำ brief และ prompt **ทีละ named Variant** หลัง Species หลักมี identity ที่เลือกแล้ว แม่พิมพ์นี้ช่วยเตรียมภาพและหลักฐานสำหรับ Field locomotion; ไม่เปลี่ยนความเร็ว กติกา AI, combat หรือข้อมูล Variant ในเกม

## แหล่งข้อมูลและเงื่อนไขก่อนเริ่ม

- ชื่อ Variant และ Species ที่เป็นเจ้าของอ่านจาก `tools/data/engine.json` ที่ `mob.variants`; Race อ่านจาก `mob.species[].race` ใช้ชื่อจริงและ slug ตัวพิมพ์เล็กคั่นด้วยขีด เช่น `Tallow Goblin` → `tallow-goblin`.
- เอกลักษณ์ สัดส่วน anatomy สี และอาวุธตั้งต้นมาจาก reference ของ Species และ Variant ที่เลือกแล้ว บันทึกไฟล์และสถานะจริง ห้ามใช้ mob icon shelf เป็น character reference.
- ตรวจ kit ที่ resolve จริงจาก `tools/data/mob-skills.json` ตามลำดับ Unique > Boss > Variant > Species; เพิ่ม skill pose เฉพาะ kit entry ที่มี cast block ตาม [mold](./_shared/mob-animation-template.json).
- ทิศทาง Field, gait และ proof อยู่ใน [Field plan §8–9 และ §14](../../docs/plans/field-world-ai-work.md); การจัดไฟล์และ version อยู่ใน [monster art README](./README.md); ขนาด runtime cell อยู่ใน [production roster](./production-roster.json).
- Field ต้องการ motion ของ **ทิศนั้นจริงทั้ง 8 ทิศ** สำหรับ action ที่ชุด selected ต้องรองรับ จำนวนเฟรมและการจัด atlas ของชุด Field ให้ art owner กำหนดใน art proof ก่อนผลิต ห้ามตั้งจำนวนใหม่จากแม่พิมพ์นี้เอง.
- แผน Field อ้าง `docs/plans/vfx-image-generation-work.md` เป็นเจ้าของ art proof แต่ไฟล์นั้นไม่พบใน workspace ณ ตอนเขียน guide นี้: บันทึกข้อขาดและกู้หรือระบุ owner ที่ถูกต้องก่อนล็อก matrix และประกาศ Field art ว่า accepted.

**สัญญาปัจจุบันมีสองรูปแบบ:** runtime pilot ใน roster ใช้ atlas 8×5 / 40 ช่อง: idle 8 ทิศ และ walk/attack/hit/death อย่างละ 4 เฟรม east + west ส่วน Variant drafts บางชุดมี 8 ทิศแต่เพียง 1 เฟรมต่อ action/ทิศ ทั้งสองอย่างเป็นข้อมูลที่มีจริง ไม่ใช่หลักฐานว่า Field walk 8 ทิศเป็น animation ครบ ดู [runtime pilot](../../game/src/ui/combat/arena/arena-art-pixel-v2.ts) และ [Beetle variant reader](../../game/src/ui/combat/arena/arena-art-beetle.ts).

## 1. Brief สำหรับหนึ่ง Variant

คัดลอก block นี้และเติมจาก canonical data และ reference ที่ตรวจแล้ว อย่าอนุมานความสามารถหรือ gameplay speed จากชื่อ รูปลักษณ์ หรือ animation rate

```text
IDENTITY
Race / species id / species name: <...>
Variant canonical name / variant slug: <...>
Variant entry in engine.json: <path + key/name>
Current selected species art + version/status: <...>
Current variant art + version/status: <...>
Approved species identity reference: <path + status>
Variant identity reference/candidate: <path + status>
Player/camera/style reference: <path + status; style and camera only>
Silhouette and anatomy: <body plan, limb count, head, horns, wings, tail>
Preserve exactly: <species anatomy, proportions, face, materials, palette>
Variant cues: <small authored palette/armor/posture changes; no new species>
Baked weapon / natural weapon and fixed hand: <id + visible shape; none if none>
Forbidden changes: <extra limbs, gear, weapon switch, effects, etc.>

MOVEMENT BRIEF
Locomotion family: <biped / quadruped / multi-leg / squash-push / hover / other>
Species gait inherited: <...>
Variant's authored visual difference: <posture, weight, follow-through; or none>
Foot/paw/hoof contact or hover ground anchor: <...>
Walk phases and contact sequence: <...>
Start / stop / settle: <...>
Turn: <whole-body facing change; tail/wing follow-through>
Secondary motion: <tail / cape / wings / tendrils; no change to collision>
Candidate stride distance (m): <measurement + provenance, or TBD>
Attack kind: <close / far, derived from species line or recorded override>
Attack contact / projectile release socket: <measured plan or TBD>
Hit reaction and death: <...>
Resolved cast-block skills requiring extra poses: <ids or none>

MATRIX AND DELIVERY
Field art-owner contract / revision: <path + approval, or BLOCKED>
Required actions and frame count per direction: <approved matrix; do not guess>
Directions: south, south-east, east, north-east, north, north-west, west, south-west
Target cell / anchor: 384×384; <approved x,y; e.g. 192,288 only if appropriate>
New candidate version / owner: v<N> / <...>
Runtime consumer / frame map status: <supported or pending>
Review status and open issues: <...>
```

Stride คือข้อมูลภาพสำหรับแปลงระยะเดินจริงเป็นเฟสของ cycle ไม่ใช่ speed ของ Species. ถ้าค่า stride ยังไม่ได้วัดให้ใช้ `TBD` ใน brief; อย่าสร้าง key/runtime reader หรือปรับ `mob_speed` จากชื่อ Variant.

## 2. Matrix ก่อน generation

ทำรายการ **action × direction × phase/frame** ตาม art-owner contract ที่อนุมัติ โดยใส่สถานะ `missing`, `draft`, `accepted` หรือ `fallback` และ path ของทุกช่อง ตัวอย่างรูปแบบ (จำนวน `<N>` ต้องมาจาก owner):

| Action | Direction | Phase / frame | Path | Status | Contact / socket |
|---|---|---|---|---|---|
| idle | south-east | `<owner-defined>` | `<pose path>` | missing | ground anchor |
| walk | north-west | `<0 … N-1>` | `<pose paths>` | missing | `<foot/paw contacts>` |
| attack | east | `<windup / contact or aim / release / recovery>` | `<pose paths>` | missing | `<contact or release socket>` |
| hit / death / skill | `<required direction>` | `<owner-defined>` | `<pose paths>` | missing | `<relevant anchor>` |

- Walk ต้องมี pose เปลี่ยนจริงตลอด cycle **ทุกทิศที่ Field เลือกใช้**; still หนึ่งเฟรม, frame ซ้ำ, ภาพหมุน/กลับด้านจากทิศอื่น หรือ runtime fallback ไม่ผ่าน gait acceptance.
- เดินหนึ่ง cycle ให้เท้า/ขากลับสู่จังหวะเริ่ม; บันทึก contact phase เพื่อให้ runtime ใช้ระยะเดินจริงขับเฟส การเปลี่ยนเฟรม/กล้องต้องไม่ย้าย root หรือสร้างก้าวจากการถูกผลัก.
- Action-facing เป็นของ action ระหว่าง windup/release/contact/recovery ตาม combat clock; อย่าใช้ idle turn, tail หรือ sprite FPS เปลี่ยนทิศโจมตีหรือเวลา hit.
- Hover/bob/squash เป็นภาพรอบ ground anchor; ไม่ให้บินผ่านกำแพง เปลี่ยน hitbox หรือ teleport. Variant สืบทอด gameplay profile ของ Species เว้นแต่ data owner มี override ที่ authored จริง.
- ระบุ attack/contact และ far `01-release` socket ตาม mold; skill poses เพิ่มตาม kit ที่ resolve ไม่เดาจากชื่อ Variant.

## 3. Prompt — reference ของ Variant

ใช้ reference ที่เลือกแล้วและเก็บ output เป็น candidate ใน version ใหม่; ให้ตรวจ identity/base ก่อนสร้าง pose ต่อ

```text
Use case: stylized-concept.
Asset: one candidate identity reference for <variant canonical name>,
species <species id>; this is a baked monster sprite for a browser idle RPG.

Image 1: approved species/variant identity reference <path>. Preserve <anatomy,
silhouette, proportions, palette, face and the one fixed baked weapon>.
Image 2: selected player/style reference <path>. Match its fixed elevated
three-quarter camera, pixel scale, upper-left light and readable pixel clusters;
do not copy the player's identity or equipment.

Variant cue: <restrained authored visual difference>.
Pose: full body, neutral ready, whole body facing south-east under the fixed
camera, <ground contact or hover root>; show all limbs, tail, wings and weapon.
Keep the established chibi species silhouette and readable face at play size.

Output: ONE transparent RGBA PNG as the reference contract specifies. Hard
opaque pixel edges, no semi-transparent alpha, no art touching any source edge.
Leave room on all four sides for the entire silhouette and weapon. No grid,
extra poses, duplicate figure, loose equipment, backdrop, floor, shadow, VFX,
text, watermark or border. Keep the baked weapon and equipment fixed.
Return only the single reference image.
```

บันทึกขนาดจริง, alpha/bounds, จุดเท้าหรือ hover root และ reference ที่ใช้ใน `reference.meta.json`; อย่าบันทึกภาพ concept ที่ยังไม่ผ่านเป็น reference ที่ approved.

## 4. Prompt — pose ทีละภาพ

ทำ **หนึ่ง call ต่อหนึ่ง pose** โดยใช้ reference Variant ที่เลือกแล้วและ pose/phase ใน matrix ห้ามให้ image generator วาด grid สำหรับ animation ใหม่

```text
Use case: identity-preserve.
Asset: ONE source pose for <variant name> (<species id>), for a baked RPG
sprite animation. Image 1 is the selected Variant identity reference <path>;
preserve its exact anatomy, silhouette, face, palette, equipment and fixed
baked weapon. Image 2 is the selected camera/style reference <path> only.

SLOT: <action> / <direction> / <phase or frame index>.
MOTION: <exact body/limb pose; weight transfer and contact for this phase>.
GAIT: <species family and this Variant's authored difference>. Keep <foot/paw/
hoof contact or hover root> at <source ground line>; match the scale, camera
and ground anchor across the set. The WHOLE torso, hips and limbs face
<direction>, not only the head. Keep <tail/wings/cape> within the frame.
For attack preserve the baked weapon; <contact or release socket requirement>.

OUTPUT: exactly one connected full-body pose in a transparent RGBA PNG, same
source canvas and sprite scale as the selected set. Fully opaque or fully
transparent alpha only. Crisp pixel clusters; no antialiasing, blur, gradient,
detached body/weapon/effect, extra limb, grid, scenery, ground shadow, VFX,
text, border or watermark. Entire silhouette including weapon, ears, wings and
tail is clear of every source edge. Do not translate a copy, mirror another
direction, change the camera, or add another pose.

The final compositor must fit this pose in a 384×384 runtime cell with at
least 24 transparent pixels at EACH of top, bottom, left and right. Keep the
approved anchor and leave the full silhouette inside that safe area. Record
actual source dimensions and measured alpha bounds; do not invent bounds.
Return only this one transparent pose PNG.
```

สำหรับ hover ให้แทน “foot contact” ด้วยตำแหน่ง ground root ที่วัดได้; ส่วนที่ลอยและปลาย vapor ต้องอยู่ในขอบทุกเฟรม. สำหรับ death ที่นอนต่ำให้คง ground anchor และภาพเต็มใน cell แม้ไม่ต้องรักษาแนวเท้ายืน.

## 5. จัดเก็บและประกอบ

```text
art-reference/monsters/<race>/<species>/variants/<variant-slug>/v<N>/
  reference.png
  reference.meta.json
  prompt.txt
  meta.json
  poses/<action>/<direction>/<phase>.png
  poses/<action>/<direction>/<phase>.meta.json
  poses/<action>/<direction>/<phase>.prompt.txt
  atlas/animation-draft.png
```

ใช้รูปแบบไฟล์ idle/attack และ skill ตาม [mold](./_shared/mob-animation-template.json); ตัวอย่างข้างต้นเป็นโครงสร้าง ไม่ใช่ชื่อทุก slot. เปิด `v<N>` ใหม่ทุก candidate และไม่ overwrite version ที่ส่งแล้ว. เก็บ raw generator output และระบุการแก้ภาพ/alpha ที่เกิดขึ้นจริง; ห้ามทำเครื่องหมายว่า source pixels ไม่ถูกแก้หากมีการแก้.

ให้ single-frame intake ขั้น 2b ใน [animation prompt template](./animation-prompt-template.md) และ `tools/monster-animation-compose.py` จัด grid และคำนวณ `sourceFrames`; ห้ามเขียน bounds หรือเรียง grid ด้วยมือ. Source pose ต้องมี alpha แข็ง 0/255, เป็นหนึ่ง connected pose, ไม่แตะ source edge และใช้ canvas/ground line สอดคล้องกัน. Composer ปัจจุบัน downscale แบบ integer nearest-neighbor ได้สูงสุด 4× และไม่ upscale; ระยะที่ใช้ได้เหนือ anchor คือ `anchor.y - 24`, ส่วนความกว้างสูงสุดคือ `384 - 48` พิกเซล.

Composer default ยังทำ 8×5 / 40 ช่อง และ runtime pilot ยังอ่าน east/west action clips ตาม roster เดิม. **อย่านับ atlas default หรือ one-frame-per-direction draft ว่าผ่าน Field 8-direction gait.** สำหรับ matrix ใหม่ต้องมี frame map, layout/QA และ runtime reader ที่รองรับจำนวนเฟรมที่ art owner อนุมัติก่อนประกาศ accepted หรือ register; `--map` เพียงอย่างเดียวไม่พิสูจน์ว่า renderer รองรับ matrix นั้น.

## 6. Checklist รับงาน

- [ ] ชื่อ Species/Variant ตรง `engine.json`; reference, fixed weapon/natural weapon และ variant cue ตรง brief ทุกเฟรม.
- [ ] ภาพใหม่อยู่ใน version ใหม่; มี reference + metadata + prompt และ pose PNG/meta/prompt ครบตาม matrix รวม skill ที่จำเป็น.
- [ ] ทุกทิศเป็น whole-body facing จริง; walk ทุกทิศมีหลายเฟรมเปลี่ยนท่าจริงตาม approved matrix และวนกลับได้ ไม่มี duplicate/translated-copy.
- [ ] เท้า/กีบ/ground root, contact phase, สัดส่วนและ camera คงที่; weapon, หู, หาง, ปีกและท่านอนครบ ไม่ถูกตัด.
- [ ] ทุก final cell เป็น 384×384 และมี alpha ว่าง **อย่างน้อย 24px ทั้งบน ล่าง ซ้าย ขวา**; ไม่ข้าม cell, ไม่มีส่วนของเพื่อนบ้าน, alpha เป็น 0/255 ตาม intake contract.
- [ ] Composer/atlas QA ผ่านด้วย metadata และ bounds ที่คำนวณจริง; บันทึกชื่อ command และผล ไม่เรียก still หรือ fallback ว่า accepted gait.
- [ ] ดู animation ที่ขนาดเล่นจริง: 8 ทิศและรอยต่อ sector (F07), rest → start → walk → turn → stop และ chase → attack (F08); ไม่ไถล, ไม่กระพริบ, การถูกผลักไม่สะสมก้าว.
- [ ] Stride/contact และ runtime reader ใช้ accepted metadata; gameplay speed, combat timing, collision และ save ไม่ถูกเปลี่ยนโดย sprite.
- [ ] Art owner ตรวจ reference/pose/atlas และ integration ผ่าน gate ก่อน promote `animation-draft.png` เป็น `animation.png` หรือ register ในเกม; draft/legacy fallback ยังคงแสดงสถานะจริง.
