# Part 2 — Skill VFX improvement, composition and production

วันที่: 2026-10-27

สถานะ: **แผนปรับปรุง VFX รอบใหม่ — ยังไม่ได้แก้ renderer เจนภาพ หรือ promote asset ในงานเอกสารนี้**

เอกสารคู่กัน: [Part 1 — Skill direction, animation and impact coherence](combat-skill-coherence-plan.md)

## 1. งาน VFX ที่ต้องทำจริง

ปรับเอฟเฟกต์ให้บอก **ผู้ใช้ → ด้านที่ใช้ → พื้นที่/เส้นทาง → จังหวะ commit → จุดกระทบ → ผลที่ยังอยู่ → การจบอายุ** ได้ตรงกับ action. ครอบคลุมการแก้โค้ดประกอบภาพ การแก้/เพิ่ม metadata การปรับ motion/material และผลิต source components เมื่อของเดิมรองรับสิ่งที่ต้องแสดงไม่ได้

| งาน | สิ่งที่จะเปลี่ยน | วิธีรับงาน |
| --- | --- | --- |
| Anchors | จาก generic center/lift ไป grip/tip/muzzle/ground/contact/recipient ที่ประกาศ | Effect ติดส่วนที่ถูกตลอด pose/direction |
| Direction | Local forward axis/pivot + committed world direction + common camera transform | Cone/line/weapon/projectile ชี้ด้านเดียวกับ action |
| Scale/projection | World footprint แยก upright sprite/elevation และ decorative extent | Radius/full width/full opening อ่านตรง geometry |
| Choreography | Windup/release/contact/recovery/field/status lifetimes แยกกัน | ไม่มีผลกระทบเร็ว/ช้าหรือ strike ค้างตาม debuff |
| Cast/landing telegraph | ขอบพื้นที่ก่อนลงสกิล + progress/remaining ที่อ่าน actual cast/landing timeline | วงเต็มตรง first landing และหาย/เปลี่ยน state ตาม impact/cancel จริง |
| Melee composition | Weapon trail หนึ่งแนว + actual contacts ราย recipient + result accents | ฟันจากตัวผู้ใช้แล้วเกิดผลตรงตัวที่โดน |
| Storm/area assembly | หลาย component/landing sites ครอบ committed area รวม empty ground | ไม่กองภาพไว้ที่ primary target |
| Materials/identity | ภาพจำจาก silhouette/motion/texture ตาม skill verb | สกิลธาตุเดียวกันยังแยกออก |
| Asset production | First-party component/pose views ที่ขาด พร้อม measured geometry และ source preservation | ผ่าน source/motion/in-arena QC ก่อนเลือกใช้ |
| Readability | Layer/depth/reaction/flash/density/reduced-motion | ยังเห็น actor/target/hostile preparation เมื่อซ้อนหลายสกิล |

Current snapshot คือ **92 live player skills**. Review ทั้ง current roster พร้อม basic/mob skill paths ที่ใช้จริง; retain composition ที่ผ่านได้. การมี manifest entry หรือชื่อไฟล์ไม่เท่ากับผ่าน spatial/motion acceptance

## 2. Current references และ evidence limits

| บริเวณ | Source / หน้าที่ |
| --- | --- |
| Canonical gameplay | [skills.json](../../tools/data/skills.json), [engine/types.ts](../../engine/types.ts), [skill-area.ts](../../engine/skill-area.ts), [skill-actions.ts](../../engine/skill-actions.ts) |
| Action/impact execution | [combat-actions.ts](../../game/src/sim/combat/combat-actions.ts), [game.ts](../../game/src/sim/core/game.ts), [pending-work.ts](../../game/src/sim/core/pending-work.ts) |
| Handoff classification/geometry | [arena-vfx-space.ts](../../game/src/ui/combat/arena-vfx-space.ts): `skillHandoffFor`, `projectVfxFootprint`, `groundShapePath` |
| Camera/action/attachments | [arena-camera.ts](../../game/src/presentation/arena-camera.ts), [combat-arena-view.ts](../../game/src/ui/combat/combat-arena-view.ts) |
| Current actor/equipment support | [arena-art.ts](../../game/src/ui/combat/arena/arena-art.ts), [arena-equipped-player.ts](../../game/src/ui/combat/arena/arena-equipped-player.ts) |
| Host/dispatch | [CombatArenaScene.svelte](../../game/src/ui/combat/CombatArenaScene.svelte), [ArenaSkillVfx.svelte](../../game/src/ui/combat/ArenaSkillVfx.svelte), [ArenaSkillVfxBody.svelte](../../game/src/ui/combat/ArenaSkillVfxBody.svelte) |
| Authored/spatial/component binding | [arena-authored-vfx.ts](../../game/src/ui/combat/arena-authored-vfx.ts), [ArenaAuthoredSkillVfx.svelte](../../game/src/ui/combat/ArenaAuthoredSkillVfx.svelte), [ArenaComponentVfx.svelte](../../game/src/ui/combat/ArenaComponentVfx.svelte) |
| Selected manifest sources | [batch-manifest.json](../../game/src/ui/combat/fx-manifests/batch-manifest.json), [spatial-v2-manifest.json](../../game/src/ui/combat/fx-manifests/spatial-v2-manifest.json), [components-v2-manifest.json](../../game/src/ui/combat/fx-manifests/components-v2-manifest.json) |
| Diagnostic/charging geometry | [ArenaVfxShape.svelte](../../game/src/ui/combat/ArenaVfxShape.svelte), [ArenaVfxField.svelte](../../game/src/ui/combat/ArenaVfxField.svelte) |
| Asset tools | [check-authored-vfx.py](../../tools/check-authored-vfx.py), [vfx-qc.py](../../tools/vfx-qc.py) |
| Preview | [SkillFxLab.svelte](../../game/src/ui/dev/SkillFxLab.svelte), [SkillFxPreview.svelte](../../game/src/ui/combat/SkillFxPreview.svelte) |

ตรวจ source read-only เท่านั้น; ไม่มีการรัน tools/tests/browser ในงานเขียนแผน. แผนเก่าและ production-reference files ที่ถูกลบไม่เป็น dependency. Runtime art อยู่ selected public paths เช่น `/fx/skill-pool/`; staging/raw อยู่ `art-reference/` ตาม owner และไม่ import เข้าเกม

Reuse current authored/spatial/component readers และ legacy fallback. Cone clipping/projection และ multi-component storm support ที่มีอยู่ต้องตรวจ behavior ก่อนเพิ่ม abstraction ซ้ำ. Current composition validator ที่เจาะ fall/trail/impact ไม่ใช่หลักฐานว่ารองรับทุก melee/beam/channel family โดยอัตโนมัติ

## 3. Visual contract ที่ทุก recipe ต้องใช้

### 3.1 Spaces, units และ scale

- Gameplay ใช้ continuous world meters. Standard footprint diameter 0.5m/radius 0.25m เป็น design ruler ตาม Part 1; explicit authored override เป็นเจ้าของขนาดที่ต่าง
- วัด footprint ใต้เท้า ไม่บีบหัว/ตัว chibi/อาวุธทั้งหมดให้กว้าง 0.5m. Body display height และ inspect art extent เป็นข้อมูลแยก
- Ground circle/cone/line ใช้ full projected geometry. Vertical object/weapon/column ใช้ upright/elevation policy
- Texture alpha bounds ใช้ crop/allocation; ไม่ได้เป็น gameplay hit area. Bloom/trail นอก core footprint ต้องไม่ใช้ภาษาภาพที่หลอกว่าเป็นพื้นที่ damage เพิ่ม
- Radius 4m = diameter 8m ≈16 standard footprints เรียงกัน; เป็นตัวอย่าง ruler ไม่ใช่ target cap
- ค่าขนาดใน recipe อ่าน reference จาก action footprint/socket/art profile. ไม่ hardcode gameplay radius/cost/hits ซ้ำ

### 3.2 Role/anchor ของ component

| Role | Binding | Timing/ลักษณะ |
| --- | --- | --- |
| Charge | Cast hand/weapon grip | Preparation ที่ action อนุญาต; cancel จบได้ |
| Landing telegraph | Pending/committed ground shape ตาม Part 1 SC2-L | เริ่มเมื่อร่ายจริงและเต็มที่ first landing; แยกจาก actor cast progress |
| Release accent | Tip/muzzle/shield front | Release marker; ไม่ใช่ successful-hit cue |
| Weapon trail | Per-frame weapon track | Active swing/thrust ของ actor profile |
| Skill envelope | Committed ground shape/direction | บอก extent และ peak ที่สัมพันธ์ real impact |
| Flight/beam | Committed payload path หรือ declared beam geometry | อ่าน delivery และ terminal จริง |
| Contact burst | Resolved contact snapshot ต่อ target | Fixed ณตำแหน่งตอนโดนแล้ว decay |
| Field bed/weather | Fixed committed area หรือ caster-following channel | Lifetime/pulses จาก actual state |
| Status/charge mark | Actual recipient/current state | Quiet sustain; counts/cleanses/expiry ตาม state |
| Residue | Fixed world contact/area หรือ declared body attachment | Cosmetic exit ไม่อ้าง continued damage |

### 3.3 Orientation metadata

แต่ละ source component ระบุ authored forward vector, pivot/anchor, coordinate space, size axis, mirror safety, phase role และ layer/depth policy. ของเก่าที่ไม่มี metadata ต้องมี explicit legacy fallback ไม่เดาทิศจาก Element หรือชื่อ skill

- World attack θ มาจาก action/shape snapshot; visual angle derive ผ่าน common camera vector transform
- Cone opening/full line width จาก gameplay ใช้กับ extent; weapon sweep phase ใช้กับการเคลื่อนภายใน extent
- Forward axis ของภาพที่วาดขึ้นบนต่างจากภาพที่วาดขวา; apply local-to-world/view transform ให้ครบ
- Ground art deform ตาม projected basis ได้; upright blade/jet/meteor ไม่ถูกบีบทั้งชิ้นให้เป็น ground ellipse
- Mirroring ไม่สลับ main/offhand หรือกลับ lighting/crest ที่ asymmetric โดยเงียบ ๆ

### 3.4 Selected angle policy — องศาที่เลือกใช้และลำดับการแก้

ข้อกำหนดส่วนนี้เป็นการตัดสินใจสำหรับ implementation รอบนี้ ไม่ให้แต่ละสกิลเดาวิธีหมุนภาพเอง

| เรื่อง | วิธีที่เลือก |
| --- | --- |
| Attack axis | ใช้ continuous world `directionRad` ของ committed shape/action; ไม่ปัดตามแปดทิศของ sprite |
| Cone opening | ใช้ **full opening** จาก canonical area. Cleave ปัจจุบัน 120° = ข้างละ 60°; Venom Spray90° = ข้างละ 45°. ไม่ใช้ครึ่งมุมเป็น full opening หรือเปลี่ยนให้เท่ากันเพื่อให้ reuse ภาพง่าย |
| Line | ใช้ committed direction, length และ **full width**; projection ไม่เพิ่ม width ตามมุมที่เอียง |
| Lock time | Fixed cone/line ล็อกทิศที่ release ตาม current action contract. ก่อน release ติดตาม target เดิมได้เท่าที่ owner อนุญาต; หลัง release ไม่หันหา target ใหม่ |
| Source axis | Art ต้องมี measured/authored forward vector และ pivot. ถ้าไม่มีให้เป็น metadata gap ที่แก้ก่อน promote; ไม่ใช้ default หมุน 90°เหมือนกันทุก asset |
| Ground components | สร้าง world-local geometry แล้วใช้ full camera transform/basis รวม orientation เพียงครั้งเดียว |
| Upright components | ตั้งที่ projected world anchor + declared height; หมุนด้วย projected path/attack tangent แล้วชดเชย source axis |
| Weapon trails | ใช้ tangent/angle ของ weapon track ใน active phase; cone axis ยังคงเป็นแกนของพื้นที่ ไม่ถูกแทนด้วยมุมใบดาบทุกเฟรม |
| Radial effects | Circle/nova ไม่ต้องเล็งหา primary เพื่อหมุนภาพ. Decorative rotation เป็น recipe ของสกิลและไม่หมุน hit geometry |
| Degenerate aim | Aim ซ้อน caster ใช้ last valid/current action-facing fallback ที่ owner ระบุ; ไม่ reset เป็นทิศขวาเพราะ `atan2(0,0)` |

สำหรับ upright sprite ที่ใช้ local forward `f` เป็น screen-art vector:

```text
v = (cos(committedDirection), sin(committedDirection))
screenAxis = atan2(projectVector(v).y, projectVector(v).x)
assetAxis = atan2(f.y, f.x)
spriteRotation = screenAxis − assetAxis
```

สูตรนี้ใช้กับ component ที่หมุนบนจอได้ตาม material ของมัน. Ground sector ใช้ affine/projected geometry โดยตรง; ห้าม apply world rotation ซ้ำอีกครั้งหลังได้ projected basis แล้ว

VF1 ต้องแยก **gameplay delivery** ออกจาก **asset render space/role** ให้ชัด. Preset ที่เลือก ground transform ไม่ได้ทำให้ melee skill กลายเป็น ground-delivery skill. Caster-centered cone/line ที่มี `point=center` ใช้ `directionRad` ของ shape;ห้ามหาองศาจาก generic `point-source` ที่อาจเป็นเวกเตอร์ศูนย์. Projectile ใช้ committedpath/tangent;radialeffect ใช้ radialpolicy แทนการหา primary เพื่อหมุน

### 3.5 Angle calibration และเกณฑ์ผ่าน

1. ตรวจ fixed world directions 16 ค่า ห่างกัน 22.5° รวมการข้าม −π/π และทิศใกล้ sprite sector boundary. นี่เป็น engineering fixture ไม่ใช่จำนวนท่า art ที่บังคับผลิต
2. แสดง committed axis, cone edges, actual recipients, visual pivot และ art forward arrow ใน debug overlay บน host จริง
3. Logical axis/vertices ต้องตรง shared geometry ภายใน numerical tolerance ของ engine; การหมุนภาพต้องไม่มี constant offset90°/180° หรือ mirror sign ผิด
4. Initial manual calibration target ของ **directional VFX core** คือ centerline residual ไม่เกิน 2° จาก projected reference และ projected edge/pivot residual ประมาณไม่เกิน 2 view pixels เมื่อ source resolution รองรับ. เป็น quality calibration ของ asset/transform ไม่ใช่การขยาย gameplay tolerance
5. วัด cone opening ใน world space ก่อน projection. ภาพบนกล้องเฉียงไม่จำเป็นต้องเป็นมุมเดียวกับไม้โปรแทรกเตอร์บนจอ; ใช้ projected edges เป็น reference
6. Body sprite ใช้ทิศที่มีจริงได้ แต่ต้องรายงาน unsupported pose หากแขน/อาวุธชี้สวน action. เกณฑ์ 2°ข้างต้นไม่ได้อ้างว่า sparse two-direction body art ทำทุกมุมได้แล้ว
7. Fix order: verify canonical shape/lock → camera transform → art forward/pivot → local deformation/clip → actor pose coverage. การ clip ภาพให้เหลือ cone อย่างเดียวไม่ถือว่าแก้ forward axis ที่ยังผิดแล้ว

Handoff ต่อ asset ต้องเก็บ source-axis provenance, calibration direction(s), mirror rule และ residual ที่ตรวจจริง. Numeric targets นี้เป็น initial visual quality choices; ปรับได้เมื่อมี source/normal-speed evidence พร้อมเหตุผล ไม่ใช้ผ่านเพื่อเปลี่ยน hit shape

### 3.6 Landing telegraph และ cast progress — งาน implement ใหม่

ต้องมีวง/รูปทรงก่อนสกิลลงที่อ่านเวลาได้จริง ไม่รับเพียงภาพ charging ที่ opacity คงที่. First pass สร้างด้วย projected SVG geometry/progress ใน renderer; rune/texture ที่แต่งเพิ่มใช้เป็นชั้นรองเมื่อพร้อม

Selected visual design:

- **Outer boundary คงที่** บอกพื้นที่รับผลจริงตั้งแต่เริ่ม telegraph. Circle ใช้วงบนพื้น, cone ใช้พัด และ line ใช้แถบตาม shape; ไม่ขยาย hit radius ตาม progress
- **Inner progress stroke** เดินรอบ path จนครบเมื่อ landing. Circle ใช้ timer arc; cone/line ใช้ progress บน projected boundary/inner contour ที่ consistent กับทิศ. Progress เป็นสัดส่วนเวลาที่เหลือ ไม่ใช่ damage-area growth
- ก่อน release แสดง preparation state; หลัง release ขอบแสดง committed state และ progress ต่อเนื่อง ไม่ reset กลับศูนย์
- Actor cast indicator อ่าน `startedAt → releaseAt`; landing marker อ่าน `telegraphStart → firstLandingAt`. ข้อความสถานะแยก “กำลังร่าย” กับ “กำลังลง/กำลังตก” ตาม phase และ remaining time ที่มีจริง
- Friendly/player shape มีความเข้มพออ่านพื้นที่โดยยังเห็น actors; hostile ground/heavy shape มี boundary/pattern เด่นกว่าและแยกด้วยลายร่วมกับสี
- ช่วงใกล้เต็มเน้นขอบแบบ single onset ไม่วน flash/strobe. ถึง impact จบ progress แล้วเชื่อมกับ actualimpactcue; ordinary ring exit เริ่มต้นประมาณ 80–120ms
- Cancel/end ที่ไม่มี impact ใช้ fade ประมาณ 100ms และ clear once ไม่มี successflash หรือ contact sound. Arena/identity เปลี่ยนไม่ดึงวงเก่าติด actor ใหม่
- Reduced motion ยังแสดง staticboundary,progress และ remaining;ลด decoration แทนการซ่อนเวลา

State/visibility policy:

| Action state | วง/ตัวนับที่ต้องเห็น |
| --- | --- |
| กำลังเล็งหรือเดินเข้าระยะ | Placement preview ได้; ยังไม่มี countdown ว่าได้เริ่มร่ายแล้ว |
| Windup ที่มี landing schedule | Shape ตาม permitted tracking + progress/remaining จริง |
| Released ground spell | Shape คงที่ตาม committed point + countdown ถึง landing แม้ caster คืนท่า/เดินแล้ว |
| First impact | Progress ครบ ณ event; impact feedback ใช้ receipt เดียวกัน |
| Field active | เปลี่ยนเป็น quiet active footprint และ pulseaccents ไม่เริ่ม cast countdown ใหม่ทุก pulse |
| Replaced/canceled/area exit | จบวงตาม effective reason/time; no stale timer |

Default scope:

- Player ground AoE ทุก cast ที่ valid: auto/manual/empty ground ต้องเห็น landing marker
- Enemy ground AoE และ explicit heavy telegraph ใช้ actual public geometry/deadline. Ordinary arrows/single melee ไม่เพิ่มวง AoE ที่ไม่มีใน gameplay
- Caster-origin circle/cone/line ใช้ shape จริงระหว่าง preparation เท่าที่ rolepolicy กำหนด;ไม่วาดวงกลมทับทุกประเภทจนผู้เล่นเข้าใจพื้นที่ผิด
- Self-following channel แสดง preparation/active footprint ตาม caster และระบุว่าเป็น channel. ไม่แสดง fixed landing promise ในจุดที่ caster อาจเดินออกไป
- Meteor หนึ่ง press ใช้วงหลักหนึ่งพื้นที่ แม้มีหลาย meteors ตกแต่ง;ไม่แจกวง damage ย่อยให้ทุก cosmetic component

Implementation boundary:

1. Part 1 SC2-L ส่ง normalized timing/shape/identity/relation/end reason พร้อม effective revisions และ predicted/committed deadline kind. ระหว่าง windup ใช้ core prediction จาก shared resolver;หลัง release ใช้ committed payload schedule ห้าม UI คัดสูตรเวลาลงเอง
2. Scene สร้าง telegraph instances จาก action/payload state ที่ sample ณ playhead ไม่พึ่งเพียง cast VFX event ที่อาจถูก cull ตามอายุ atlas
3. Reuse `groundShapePath`/projected footprint helpers. Component ใหม่ชื่อเช่น `ArenaLandingTelegraph.svelte` เป็น **proposed path** ไม่ใช่ไฟล์ที่มีแล้ว
4. บริหาร instance เดียวต่อ arena+action+landing group; authored/spatial/legacy renderer ใช้วงเดียวกัน ไม่สร้างซ้อนคนละ layer
5. Generic charging ring เดิมปรับให้เป็น background หรือ delegate ให้ telegraph component เพื่อไม่ให้มีขอบพื้นที่/clock สองชุดขัดกัน
6. Freeze/pause/speed/seek/reload อ่าน combatclock และ as-ofdata;ไม่มี CSSanimationend/timeout ลง damage หรือเปลี่ยน target
7. Error/missingtexture ยังคง proceduralboundary/progress ได้;actual geometry/timing ที่ขาดให้ diagnostic ไม่สุ่มเวลา/พื้นที่มาแสดง

### 3.7 Reference-backed line/cone presentation ที่เลือกใช้

หลักฐานจากเกม/engine และ selectedgeometry/query policies อยู่ **Part 1 sections4.6–4.10** โดยมีตัวอย่างทางการจาก Riot และ FFXIV รวมถึง swept-volumeAPI ของ Unity. Geometry/timingalgorithms ของ ModWorld เป็น adaptation ที่ระบุชัด ไม่กล่าวอ้างว่าเป็น internalcode ของเกมเหล่านั้น

| Executable archetype | Visual/indicator ที่ต้องใช้ | สิ่งที่ต้องป้องกัน |
| --- | --- | --- |
| Sector impact — Cleave/Venom Spray | พัดเต็มตาม committedaxis/opening/reach ก่อน impact; weapon arc หรือ shortsprayburst ร่วม peak เดียว แล้ว contact ราย target | ไม่สร้าง physicalarrowlanes ที่มีช่องว่างแต่ลง damage ทั้งพัด;ไม่ให้ everydroplet เป็น hit |
| Line impact — Impale/Fissure | Finite flat-ended strip กับ cast/impactbeat เดียว. Impale เป็น thrust/energyextension;Fissure เป็น delayedlineburst/cracks ตามข้อมูล | ไม่แสดง head วิ่งช้าไปท้ายเส้นขณะท้ายเส้นรับ damage พร้อมกันไปแล้ว |
| Travelling piercing projectile — Piercing Shot | Lane/width/endcaps จาก actual volume,advancingtip/trail และ localcontact ตามเวลาแต่ละ recipient | ไม่เล่น full-linehitburst ตอนชนตัวแรก;ไม่เกิด hiddenendpointgrab หรือ thinart/widecollider |
| Physical projectile fan | เมื่อมี explicitprofile ให้แต่ละ projectile มี path/contact ของมันและแสดง gaps จริง | ไม่วาด solidfilledcone ที่สื่อว่าพื้นที่ระหว่างลูกทั้งหมดโดนเหมือนกัน |
| Channeled sector/wave | เมื่อมี explicitprofile ให้ quietsectorboundary คงอยู่และ actualwaves/particles ไปตาม realwave times | ไม่ใช้ genericatlasloop กำหนดจำนวน wave หรือปล่อย peak ตามจำนวน renderframes |

Skillshot preview ของ direction-target ใช้ full authoredreach แม้ cursor อยู่ใกล้หรือไกลกว่าปลาย;ground-pointspell ยังแสดงจุดที่ขอจริงและ cast-rangepolicy ของมัน. Confirmedaxis ไม่ถูกหมุนตาม walkheading/primary ที่เปลี่ยนภายหลัง

Line-impact ใช้ flatend ตาม query ของมัน;projectilecorridor แสดง volume/endcaps ตาม SC2-G. Targetfootprint/previewhighlight ต้องใช้ membership แบบเดียวกับชนิดนั้น: center-basedarea กับ body-volumeprojectile ไม่ถูกอธิบายเป็นกฎเดียวโดยไม่มี profile

Warning/countdown ต้องบอก counterplay ที่มีจริงตามแนวทาง clarity ของ Riot: delayedline มี deadline,one-impactcone มี actualpreparation,missile มี direction/lane/visiblehead. Travellingline ไม่แสดง progress ที่สัญญาว่าทั้งเส้นลง damage พร้อมกันที่ปลายเวลา และ marker ขนาดใหญ่ไม่ใช่หลักฐานว่าผู้เล่นมีเวลาหลบมากขึ้น

VF2 ต้องแนบ side-by-side actual shape overlay+normal-speed capture อย่างน้อย sector impact,line impact และ travelling line ใน earlyproof. ตรวจ near/mid/farcontacts,apex,front/back,sideedges,endcaps,turnaftercommit และ save กลาง flight. VF3/VF5 ขยาย family ที่เหลือตาม currentroster/profile จริง

Width/radius/endcap normalization ของ Piercing Shot ใน SC2-G/SC4-P ต้องเข้ามาพร้อม revised physical-core/lane art และ recipient highlight. Shaft อาจแคบได้แต่ energyhead/indicator ต้องสื่อ actual volume ที่ใช้;ไม่แสดงลูกธนูเล็กแล้วซ่อน collider กว้างไว้. มี gameplay-geometry compatibility evidence แยกจาก visual calibration ก่อน promote

Landing/countdown ของ travelling line ใช้ cast/release+moving-headpresentation ไม่สัญญาว่าทั้ง lane รับ damage พร้อมกันที่ firstcontact หรือ endpoint. Whole-striplandingprogress ใช้เฉพาะ line-impact ที่ scheduled แบบนั้นจริง

### 3.8 Closed height/vertical-motion contract

Part 1 sections3.5–3.6เลือกgrounded2.5D modelและcameraheightaxisเดียว. งานVF-Zต้องทำheight/elevationในrendererให้เป็นระบบแทนgenericpixel-liftหลายจุด;logicalXY/groundhitshapeยังเป็นgameplayowner

```text
screen(t) = projectGround(x(t), y(t)) + cameraHeightVector * h(t)
screenTangent = cameraGroundMatrix * velocityXY + cameraHeightVector * velocityH
uprightRotation = atan2(screenTangent.y, screenTangent.x) - authoredForwardAngle
```

- Groundshape,shadowและlandingprogressอยู่h=0. ขนาดสูงของPNGไม่เปลี่ยนradius/centerline/landingdeadline
- Vertical-onlymotionที่XYไม่เปลี่ยนใช้heighttangent ไม่fallbackทิศขวาจากzero-ground-vector
- Projectileflight/contact sourceheightมาจากgrip/muzzle/declaredbodyprofile;groundareaoriginแยกจากhandheightเสมอ
- Worldcontactsnapshotเก็บworldpoint+height/attachmentที่resolvedแล้ว;reprojectเมื่อcameraเปลี่ยน. Statusmarkยังตามactor ต่างจากimpactresidueที่ค้างworldpoint
- Legacycellsocketsแปลงด้วยcrop/offset/anchor/mirror/bodyScaleที่วัดจริง. เมื่อไม่มีdeclaredworldheightใช้explicitcell-attachmentadapter/provenanceก่อน ไม่unprojectscreenhandเป็นgroundsourceแบบh=0
- Newdirectionalviewartต้องมีfront/raised/foreshortenedหรือviewcoverageที่motionต้องใช้. Billboardparticlesrotateตามtangentได้;litweapons/bodyไม่ถูกrotateทั้งภาพเพื่ออ้างว่าเป็นมุม3Dใหม่

Selected initial visual-height tuning อ้างstandarduprightreferencebodyheight1.0m. Calibratedcameraheightscaleอยู่camera/presentationownerเดียวและprecomputeจากneutralbodyreference;ไม่เปลี่ยนจากattackcell,weaponlengthหรือimageloadcallback

| Effect/profile | Height/path ที่เลือก | Ground/contact guarantee |
| --- | --- | --- |
| Magic bolt/direct arrow | Releasehจากsocket,targethจากbodycontactprofile;defaultdirectpath ไม่มีgeneric12pxsinusoidทุกสกิล | ActualXYpath/recipient/timeตรงpayload;contactresidualอยู่declaredattachmentenvelope |
| Bow/crossbow gentle arc | OptionalinitialarcHeight0.15mเมื่อactualmotionprofileใช้ballisticpresentation | Endpointตามresolvedcontact;ไม่เปลี่ยนtravel timeจากanimation |
| Enemy ground boulder | InitialarcHeight0.75mเหนือlinearheightblend | Landingcircleh=0และimpactตามgrounddeadline;ไม่interceptmidairเพียงเพราะartเป็นหิน |
| Meteor | InitialdropHeight3.0m,side-drift0.5–1.0mต่อcomponent;fallcurveเร่งลงและจบh=0ที่sharedlandingbeat | Dropstartsเหลื่อมได้ตามselectedrhythm;noearlierbodyhitflashเมื่อmeteorซ้อนactorก่อนถึงพื้น |
| Blizzard | Smallicefallsinitialheight1.5m,snowประมาณ0.5–1.0mและwinddrift | Decorativefallsจบเบา;realpulsecontactsอ่านscheduler |
| Thunder Strike | Verticalcolumnจากinitialheight3.0mลงactualcontactที่impact | Currentsingle-targetruleคงชัด;glowไม่สร้างsplash/controlใหม่ |
| Earth Splitter / Stone Spike | Baseh=0,initialriseextentสูงสุด0.8m;revealจากฐานเข้าหาpeakที่impact | ฐานไม่ลอย;targetไม่ถูกยก/knockbackจากภาพเอง |
| Ground Slam / Fissure | Mainenergy/cracksที่h=0,debrisarcประมาณ0.15–0.6m | Field/lineextentและonepressbeatไม่เลื่อนไปตามdebris |
| Cleave / Impale | Physicaltrackตามอาวุธจริง;outerenergyextentใช้worldshapeกับdeclaredlow/weapon-heightprofile | ไม่ยืดแขน/ด้ามเพื่อให้ถึงfullareaและไม่ย้ายapexไปtargetcenter |
| Whirlwind | Innerweapontrackตามpose,outerwindinitialheightประมาณ0.05–0.45m | Castercenter/pulsesจริง;actorยังอ่านออกในวงใหญ่ |
| Auras/buffs | Quietfootbedh=0,closebodyornamentsตามbody/socketheight | Decorativeheight/ringไม่กลายเป็นenemy-effectradiusหรือimmunity |

ค่าheightข้างต้นเป็นvisualauthoringdefaultsไม่ใช่newdamageheightbands. VF-Zต้องดูactualscale/motionทุกdirectionและแก้grosspath/bodymismatchก่อนpromote;ไม่claimheight-awarecollisionจากการเพิ่มhในrenderer

### 3.9 Complete action composition และphase ownership

ทุกinstanceต้องแยกpreparation,release,payload/field,impact/residueและstatusstateได้โดยไม่เล่นopeningซ้ำ. Renderremount/seekเข้ากลางactionต้องsamplecurrentphase ไม่เริ่มcastใหม่

Defaultcompositionขั้นต่ำ:

1. Cast/aim/readiness: sourceattachmentกับgroundgeometryตามpolicy
2. Release: actualsource+motionmarker;nonblockingtriggerไม่ขโมยprimarybodypose
3. Payload/active: actualpath/height/shape+per-phasepriority
4. Contact: actualrecipient/point/resultและdedupeowner
5. Sustain/residue: binding/lifetimeถูก;fixedworldreprojectsตามcamera,recipientmarkตามactor
6. End: expiry/replacement/cancel/death/areaexitล้างinstances/cachesตามidentity ไม่มีphantomloop

Player/mobartfootprintscaleไม่ขึ้นกับweaponextent. Height/depthตั้งจากgroundanchor+role:fall/airpieceอาจมีrear/frontsegments,groundlightอยู่ใต้body,essentialdangerboundaryอ่านได้เหนือquietweather;ไม่sortทุกอย่างด้วยelevatedscreenYอย่างเดียว

### 3.10 Drawing bounds, sprite motion coverage และpicking

- Bodylogicalcell,sourcecrop,equipmentextent,VFXextentและgameplayfootprintเป็นคนละข้อมูล. Framecropต้องไม่อ่านcellข้างเคียง;compositionboundsต้องให้longweapon/trailครบโดยไม่shrinkbodyหรือเพิ่มradius
- Fixedbodyreference/pixelScaleอยู่กับneutralbodycalibration. Outerallocationใช้unionของclips/equipmentmotionที่ชุดนั้นใช้และpreservefootanchor;ไม่เปลี่ยนviewBoxscaleทุกframeจนตัวเต้น
- Handedness/depth/mirrorrulesอ่านactualframe/directiontrack. Main/offhandlayersกับbakedframeมีoneowner;changeclipกลางactionไม่ทับอาวุธเพิ่มอีกชุด
- Fullreleaseต้องมีdeclaredmotioncoverageสำหรับsupportednominaldirections. Missingtwo-directionfallbackเป็นinterimstate ไม่อ้างว่าเป็นeight-directionattackที่เสร็จแล้ว
- Eightposeภาพเดี่ยวคนละทิศไม่เท่ากับwalk/attackanimationsequence. Productionต้องระบุclip+direction+frame/timing/marker mapจริง;ไม่เอาatlas40posesแบบหนึ่งposeต่อstate-directionไปอ่านเป็นE/W4-frameclipsโดยเดา
- Sourceparser/packingtoolsที่ยังassumefixedlayout/framecountต้องadaptและตรวจexplicitmapก่อนรับnewbatch. จำนวนframesเป็นผลจากmotion/marker/readability ไม่เป็นquotaสำหรับบอกว่าสมูทแล้ว
- Groundcommand/selection/inspectpickingใช้semanticbody/footprint/visibleactor/labelตามinputmode. Oversizedweapon/VFXdrawingboundsไม่เป็นinvisiblebuttonที่กินพื้นคลิกทั้งสนาม
- Nameplateheight/inspectionartboundsคงที่ตามauthoredextentที่ตกลง แต่การขยายdrawallocationไม่สร้างgameplayhitboxหรือtargetacquisitionrangeใหม่

### 3.11 Numeric/audio feedback และpresentation truth

Defaultoutgoingdamagefloaterเลือกfinalmitigatedhitmagnitudeที่outcomeownerให้ก่อนoverkillclampเพื่ออ่านพลังของhit;HP/ESbarsใช้actualpoolloss. Leech/healcredit/summaryactualdamageใช้eligiblepaid/restoredamount. Inspectorแยกmitigatedhit,poolloss,absorb,overkillและpaidleech ไม่ให้UIroll/recalculateformulaเอง

Miss/dodge/block/immune/guardabsorption/crit/executeใช้resultcategoriesจริง. Healfloatคือactualrestoration;fullHPไม่ขึ้นfakehealตามpotentialamount. Skillstatusapplicationไม่เป็นdirecthitใหม่. Damage/field/status-textaggregationเป็นboundedpresentationที่ยังinspectactualreceiptsได้

Audio/contact/shakebindด้วยaction+impact+recipient/categoryเดียวกับภาพและsettings. Primaryheavycueมีhierarchy,ambientwindไม่เล่นhitsoundทุกparticle,channeltickไม่restartcamerashakeทุกtextureframe. Localpresentationemphasisไม่freezeCombatClock/input/savewriter

## 4. Directional/melee improvement pass

### 4.1 Initial representative skills

| Skill | Current gameplay snapshot | VFX ที่จะปรับ | Reject |
| --- | --- | --- | --- |
| `attack.cleave` | Caster cone, full opening 120°, reach 2.1m, melee | One weapon sweep จากผู้ใช้ครอบ committed sector + contacts ราย actual target; ไกลกว่าปลายดาบใช้ authored energy extension ที่อ่านออก | วงเต็ม, cone หันตามเป้าหลัง lock, contact ข้างหลัง |
| `attack.venom_spray` | Caster cone 90°, reach 2.5m; canonical delivery ระบุ melee | Hand/emitter release → diverging droplets แสดงทั้ง edges/interior → localized actual contacts; ground origin ยังเดิม | ตีความ tag melee แล้วใช้ท่าฟันดาบ, rear cloud หรือวาดเฉพาะ hit actors |
| `attack.impale` | Caster line length 2.1m/full width 0.75m, melee | Thrust จาก weapon tip ตาม committed line; front/back weapon layering และ contacts ตรงผู้รับ | Broad cone, teleport caster ไปปลายเส้น หรือ line บวมตาม texture |
| `attack.shield_bash` | Target single, melee range 2.1m | Shield-front release/contact, bounded recoil, result cues ตาม actual stop/block/hit | ดาบซ้ำบนโล่, unsupported charge/knockback หรือ miss มี success flash |
| `attack.ground_slam` | Caster circle radius 2.5m, one current press | Weapon-ground contact ใกล้ caster → grounded wave/fracture ทั่วพื้นที่ → target contacts ตาม impact จริง | Stamp กลาง enemy, wavefront แจก hit เพิ่ม หรือ quake ยาวตาม status |
| `attack.whirlwind` | Caster-following circle radius 3m, channel 1.2s/3 hits ตาม data | Near/far weapon arcs ตาม sampled feet, actor อ่านออก, accents ตาม real pulses, cancel/end ชัด | Ring ค้างพื้น, texture หมุนเพิ่ม hit หรือ effect ค้างหลัง cancel |

ตัวเลขเป็น snapshot จาก canonical rows ตอนเขียน; implementation อ่านค่าปัจจุบัน ไม่คัดตารางนี้เป็น config

### 4.2 One-press cone กับ active sweep

Initial pass รักษา current hit model. จัด dominant sweep/contact peak ให้ตรง impact ของ cone ทั้งชุด; minor trails ก่อน/หลังไม่ขึ้น damage numbers, reactions หรือ procs เพิ่ม

หากต้องการให้ใบดาบตรวจโดนทีละช่วงจริง ให้ Part 1 author temporal sweep profile ก่อน: active interval, angle/track, hit-once rules, total damage shares และ proc/cancel/save semantics. VFX loop ไม่เปิดใช้ model นี้เอง

### 4.3 Weapon trail implementation

- Sample main/offhand/tip tracks ณ playhead ที่ actor pose ใช้; tip/grip pixels และ source-frame transforms เป็น convention เดียวกัน
- Trail coverage สร้างจาก track หรือ declared motion key poses ไม่เริ่มภาพ slash บน target เพียงอย่างเดียว
- Front/rear portions ใช้ depth/occlusion ที่กำหนด มือทับด้ามและ shield อยู่ถูกด้าน
- Light reaction ไม่ตัด trail ตรง release โดยไม่มี actual cancel; actual cancel จบ future segments ตาม owner
- Clip/direction/weapon ที่ไม่มี track ส่ง asset gap พร้อม fallback provenance. Sparse art ไม่ถูกหมุน upright sprite เพื่ออ้างว่าครบทุกทิศ

## 5. Projectile, field และ temporal families

| Family | งานปรับปรุง | Acceptance |
| --- | --- | --- |
| Single projectile | Socket release, stable path/tangent, actual contact/miss และ separate caster recovery | Source/target movement/death/interception ไม่ทำภาพตามเป้าใหม่ |
| Projectile burst | Actual launch instances/aim/arrival และ weapon draw/release timing | ลูกที่ยังไม่ launch ถูก cancel ได้; decorative count ไม่เพิ่ม hit |
| Piercing line | Advancing visible tip/trail, actual once-per-target contacts, terminal at range | ไม่เป็น instant beam หรือหยุดตัวแรกเพราะ reuse preset ผิด |
| Beam/instant line | แสดงแนวพร้อมกันเฉพาะ execution ที่เป็น beam/instant จริง | อย่าอนุมานจากชื่อ Bolt/Lance หรือ asset ทรงยาว |
| Chain | Link actual prior → next contacts ตาม hop time | ไม่เชื่อม arbitrary targets หรือสร้าง contact ซ้ำ |
| Ground burst/nova | Full footprint peak, local/depth-correct contact and residue | One press ไม่กลายเป็น wavefront damage จาก animation |
| Deployed field | Fixed center, continuous ambience + real pulse accents + clear expiry/replacement | Actor เข้า/ออกและ empty ground ยังถูกตาม field state |
| Mobile channel | Sampled caster center + active loop + pulse receipts + cancel/recovery | Visual movement ตรง speed/locks จริง |
| Buff/curse/heal/aura | Short activation + quiet recipient/state layer; actual charges/heals/triggers | ไม่มี fake heal/charge loss/trigger หรือ attack ยาวตาม status |

ปิดsemanticchoiceแล้วในPart1section6.4: `attack.storm_field` และ `attack.poison_cloud` ต้องเป็นtruefixedfieldsผ่านexplicitcore/data migration;current`dot_sec`/ชื่อสกิลยังไม่ใช่หลักฐานว่าexecutionทำแล้ว. VFXfixedweather/expiry/entry-exitเปิดตามnewresolvedfieldstateเมื่อSC-Xพร้อม และdisablelegacyattached-erosionของpathนั้น ไม่แสดงfieldยาวทับtargetDoTแล้วนับว่าถูก

### 5.1 Storm distribution ที่มีความหมาย

Meteor/Firestorm ใช้ current one-press model จนมี authoring เปลี่ยน. Multiple falling/vortex components แสดงการโจมตีเต็มพื้นที่ได้ แต่ผลสำเร็จที่หนักต้องผูก real impact. Later particles เป็น residue หรือ ambience ที่ไม่สร้าง hit feedback ใหม่

Blizzard ใช้ actual field/pulse schedule. กระจาย snow/ice/wind/frost taps ข้าม center/middle/outer sectors ด้วย stable cosmetic seed อิสระจาก target list และ gameplay RNG. รวม empty ground; quality reduction ลดจำนวนชิ้นแต่คง extent/real pulse cue

Circle sampling ใช้ equal-area strata หรือ `r=R×sqrt(u)`; cone/line sample ภายใน local shape แล้ว project. ตำแหน่งไม่เปลี่ยนจาก panel/resize/re-render และไม่ spill เป็นพื้นที่ damage อีกวง

### 5.2 Selected rhythm policy — แยกสี่ความถี่ให้ชัด

| Clock/ความถี่ | เจ้าของ | กติกาที่เลือก |
| --- | --- | --- |
| Gameplay impact/launch/pulse | Executable action และ resolved receipts | VFX อ่าน timestamp จริง; ไม่มี universal repeat interval ของ renderer |
| Dominant visual cue | Per-impact/recipient binding | หนึ่ง accepted impact มี response owner เดียว; dedupe ด้วย identity ไม่ใช่ระยะเวลาใกล้กันอย่างเดียว |
| Continuous material/particles | Visual recipe + stable cosmetic seed | หิมะ ลม ฝุ่น และ ember เคลื่อนได้ระหว่าง hits แต่ไม่สร้าง successful-hit cue/number/proc |
| Texture frame playback | Measured source frames + phase mapping | Resample one-shot ตาม cue window หรือ loop เฉพาะ seamless ambience; loop ไม่เท่ากับ hit |

ความสมจริงรอบนี้เลือกให้ **one-shot attacks มี peak หนึ่งครั้ง**, burst/pulse มี peak ตาม event จริง และ field มี ambience ต่อเนื่องระหว่าง pulses. ไม่ใช้ texture เดิมระเบิดซ้ำตลอด skill duration

อัตราทั้งหมดในแผนวัดต่อ **combat second** และ sample จาก playhead เดียวกัน. Speed4×จึงเร่งการเคลื่อน/อายุ/การเกิดพร้อมกันตามเวลาจำลอง ไม่คูณ speed ซ้ำใน particle หรือ atlascomponent. Pause หยุดทุก presentationclock ที่ผูก combat;qualityreduction แก้เฉพาะ decoration

จาก source ที่สำรวจยังมี count-based visual branches เช่น `repeats`, `hit*.14`, atlas loop ที่คูณ `strikeCount` และ lifetime ที่ขยายตามจำนวน hits ใน consumer บางทาง. VF0 ต้อง trace ว่าเป็น legacy projection หรือซ้ำกับ actual per-payload events แล้ว; ในเส้นทางที่มี real events ให้เอา synthetic hit repeats ออกและคงเฉพาะ material loop ที่ไม่ได้สื่อ damage. ไม่ลบ fallback ทุกเส้นทางโดยไม่มี coverage

### 5.3 Initial per-family visual timing ที่ตัดสินให้

ค่าตารางนี้เป็น **presentation tuning เริ่มต้น** อยู่ recipe/art owner. มันไม่เปลี่ยน cast speed, attack interval, damage schedule, stun/DoT duration หรือเวลา actor พร้อมโจมตีใหม่. หาก action เร็วกว่า visual window ให้ compress/clamp phase และลด tail โดยอ่าน actual ownership; ห้ามเพิ่ม gameplay recovery เพื่อให้ภาพเล่นครบ

| Family | Primary visual cue ที่เลือก | Tail/continuous behavior ที่เลือก |
| --- | --- | --- |
| Single melee cut/thrust | หนึ่ง sweep/thrust peak ตรง actual impact; nominal active shape100–160ms; compact contact60–90ms | Trail dissolve80–140ms ไม่มี full-strength slash loop; rooted feet ยังนิ่ง |
| Shield/blunt contact | One compact pressure/contact peak60–100ms | Recoil/particles120–180ms; stop status คงเป็น quiet recipient mark แยก |
| Venom Spray one-press | One complete fan burst160–240ms; full sector อ่านออกที่ dominant impact beat | Droplets settle120–180ms; ไม่มี stream ยิงต่อหลายวินาทีขณะไม่มี hits |
| Ground burst/nova/slam | One footprint peak/wave envelope180–260ms ตรง one-press model | Dust/cracks/residue250–450ms ลดความสว่างต่อเนื่อง ไม่มี expansion pulse ใหม่ |
| Single projectile | หนึ่ง release accent30–50ms ต่อ launch; travel ตาม payload | Trail ยาวตามระยะทางที่กำหนด; local impact60–100ms และ exit100–160ms; ไม่เพิ่มลูกเพราะ travel นาน |
| Burst projectile | หนึ่ง release/flight/contact ต่อ actuallaunch | ไม่ใช้ delay คงที่จาก hit count;แต่ละลูกจบตาม terminal ของมัน |
| Chain | One narrow link ต่อ realhop; peak ตรง contact | Previous link decay ประมาณ 60–100ms เพื่อเห็นลำดับ;ไม่ค้างทุกเส้นเป็น beam หนา |
| Persistent field | One activation transition180–250ms; damage accents ตาม real pulses | Field bed/wind ต่อเนื่อง; material loop ช่วงประมาณ 0.8–1.6s และไม่เล่น opening/impact ใหม่ทุก loop |
| Mobile spin channel | Rotation ต่อเนื่องตลอด actualchannel; weapon accent ตาม real pulses | Finish120–180ms แบบ cosmetic ตาม cancel/end;ไม่เพิ่ม full strength รอบสุดท้าย |
| Buff/curse activation | One local activation180–250ms | Quiet sustain ตาม state;exit120–180ms;refresh จริงได้ activation สั้นครั้งเดียว |
| Heal/DoT/status | Actual restoration/damage cue ตาม receipt | Small material loop/mark;ไม่มี blast ใหม่จาก texturecycle หรือ durationcounter |
| Aura | One enable cue แล้ว seamlessquietloop | Initial orbit cycle1.8s, brightness breathing2.4s แกว่งไม่เกินประมาณ 10%;ไม่มี periodicattackflash |

เลข milliseconds เป็น nominal visual envelope ไม่ใช่ timing ที่นำไปใช้แทน engine. Render hitch อาจพลาด texture frame ได้; current phase/recent contact cue ต้องถูก โดยไม่ replay action ทั้งชุด

Active weapon/spray window จัดภายใน preparation/release/contact/follow-through ที่รองรับได้ แต่ **successful contact cue เริ่มที่ resolved impact เท่านั้น** และใช้ fast onset/decay. การยืด trail หรือ fade ไม่ได้เลื่อน HP loss,recovery หรือ field expiry

### 5.4 Selected per-skill cadence และ density

ตารางนี้ปิดการตัดสินใจของสกิลที่มีความเสี่ยงเรื่องความถี่สูง. Gameplay intervals ที่ยกมาเป็น snapshot จาก canonical data/current scheduler; renderer ต้องอ่าน actual launch/pulse timestamps เมื่อ implement

| Skill | Authoritative rhythm ปัจจุบัน | ภาพที่เลือกใช้รอบนี้ |
| --- | --- | --- |
| `attack.cleave` / `attack.impale` / `attack.shield_bash` | หนึ่ง press | หนึ่งท่าโจมตีหลักกับ contact accents ของผู้รับจริง; ไม่แบ่ง damage เพิ่มตามจำนวนเฟรมหรือ layers |
| `attack.venom_spray` | หนึ่ง press | พัดสเปรย์สั้นตาม section 5.3; ทุกเส้นร่วม peak เดียว หยดหลัง peak เป็น residue |
| `attack.whirlwind` | 3 pulses ใน 1.2s; ปัจจุบันห่างประมาณ 0.4s | หมุนต่อเนื่องหนึ่งรอบต่อช่วงระหว่าง pulses รวมประมาณ 3 รอบในฐานนี้; เน้น blade cue ตาม real pulse และมีฝุ่นต่อเนื่อง; ไม่วน impact atlas เพื่อเพิ่มรอบ damage |
| `attack.blizzard` | 20pulses/8sห่าง0.4s;newcastsอ้างfield-v2activationในSC-X | Landingringเต็มเมื่อfieldเริ่ม;firstpulseตามอีก0.4s. Pulseaccentเบาตามrealevents. ที่radius3mใช้snow24/sและsmallicefalls6/s,livecaps32/8;decorativefallsไม่ทำbodyhitflashนอกpulse |
| `attack.sand_storm` | Initial press แล้ว damage pulse ทุก 1s ผ่าน 10s | Activation ครั้งเดียว; พายุย่อย 3 แกนกับลมต่ำต่อเนื่อง รอบหมุนเริ่มต้น 1.4s. ที่ radius 3m ใช้ dust 18 ชิ้น/s และ live cap 24; damage accent เป็นแรงฝุ่นต่ำตาม real pulse |
| `attack.overload` | 2 pulses; ปัจจุบันห่าง 0.3s | สอง electrical peaks ชัดเจน: core 60–90ms ต่อ pulse และ afterbranches ≤140ms. มีเส้น charge เบาระหว่างสองครั้ง ไม่มี strobe ต่อเนื่อง |
| `attack.ice_lance` | 2 launches จริง ห่าง 0.15s | ปล่อยหอกแต่ละลูกแยกกัน; release accent ≤40ms และ contact 60–90ms. เวลาถึงต่างกันได้ตาม contact จริง |
| `attack.arrow_shower` | 3 launches จริง ห่าง 0.15s | สามจังหวะ draw/release พร้อม flight instances จริง; ไม่กลายเป็นฝน AoE หรือเล่น contacts ซ้ำอีกสามครั้งต่อ hit event |
| `attack.chain_lightning` | Hop interval ปัจจุบัน 0.08s | เส้นแคบเชื่อมตามลำดับ; แต่ละ node เน้นครั้งเดียว เส้นเก่า decay ≤100ms. จำนวนกิ่งตกแต่งไม่เพิ่ม hops |
| `attack.firestorm` | หนึ่ง ground press | พายุไฟ 3 แกนใน area มี thermal peak ร่วมที่ impact; การหมุนคลายตัวในประมาณ 0.45s และ embers จบภายในประมาณ 0.7s. ไม่มีภาพ field ที่ดูยังทำ damage ค้างหลายวินาที |
| `attack.meteor` | หนึ่ง ground press | เริ่มด้วย 6 meteors ที่ radius 3m ครอบ center/middle/outer. เริ่มตกเหลื่อม 40–70ms ด้วย height/travel ต่างกัน แต่ dominant ground landings รวมใกล้ actual impact ภายในประมาณ 40ms; debris ต่อได้ ≤350ms โดยไม่มี late hit flash |

Meteor เลือก stagger ที่ **เริ่มตก** มากกว่าปล่อย strong impacts ทยอยยาวหลัง HP ลดไปแล้ว. Firestorm เลือก one-press choreography จนมี explicit gameplay extension. หากต้องการ sustained bombardment/damage ทุกลูกจริง ให้ author hit/area/total-budget/proc schedule ใน Part 1 ก่อน; นี่เป็นคนละ mechanic กับเพิ่มจำนวนภาพ

Density scaling ของ continuous field:

Falling ice/sand ที่เป็น ambience จบด้วย snow puff/grit ที่เบา ไม่มี high-contrast impact star, target flinch หรือ successful-hit sound นอก real pulse. Source atlas ที่ bake impact หนักทุก loop ต้องแยก segment/role หรือรับ component ใหม่ ไม่ลด opacity อย่างเดียวแล้วนับว่าแก้ rhythm แล้ว

```text
referenceArea = PI * 3m * 3m
densityScale = min(actualWorldArea / referenceArea, 2)
ambientBirthRate = familyBaseRate * densityScale * qualityMultiplier
activeCosmeticCap = ceil(familyBaseCap * densityScale * qualityMultiplier)
```

`actualWorldArea` ใช้ circle πR², cone αR²/2 เมื่อαเป็น radians, line L×W ตาม shape จริง. Selected quality multipliers คือ standard1/low0.5;geometry/fieldbed/real pulsecue ไม่ลดตาม multiplier. Cap เฉพาะ weather/decorativeparticles ไม่ใช่ hit recipients หรือ gameplayevents. Small fields มี quietbed/extent แม้ birthrate ต่ำ;ไม่ยัด minimumparticles จนแน่นเกินพื้นที่

### 5.5 Deterministic emission และการคุม feedback frequency

- Birth schedule คำนวณจาก action/field absolute time + index + stable cosmetic seed ไม่ใช้ `setInterval` หรือจำนวน RAF
- Seek/resume คำนวณเฉพาะ births ที่ยังมีชีวิตใน window ปัจจุบัน;ไม่ปล่อย backlogparticles ย้อนหลัง
- Canonical event หนึ่งรายการมี dominantcontact owner เดียว;cast layer,hit layer และ authored/legacyfallback ต้อง dedupe ร่วมกัน
- Small contact cues แสดง realhits ได้ แต่ whole-bodyreaction/tint ที่ถี่กว่า 120ms รวมความเข้ม/เลือกลำดับแทน restartfullbody ทุกครั้ง. Damage/status/proc/receipts ยังคงครบ
- Ordinary hit ไม่ใช้ full-screenwhiteflash. Heavycameraemphasis เปิดตาม settings ได้ โดย initial cap ไม่เกินหนึ่งครั้งต่อ cast และ global cooldown0.3s;camera ไม่สะเทือนทุก flake หรือ every target ใน AoE
- Aura/DoT materialloop ไม่ยิงเสียง contact หรือ bodyrecoil ซ้ำ;acceptedtrigger cue อ่าน triggerreceipt จริง
- Texture frame rate แยกจาก birth/hit rate: continuousmaterials เริ่มที่ 12–16source frames/s หรือ measuredseamlessrate ของ asset ส่วน translation/rotation sample ตาม playhead ทุก render. One-shotframes ถูก map เข้า cuewindow ไม่เพิ่ม impact จากการ loop

### 5.6 Rhythm recipe fields และ ownership

ขยาย existing visual recipe อย่าง compatible ให้มี logical fields ต่อ family/skill: `motionBinding`, `impactCueBinding=resolved-only`, `primaryCueMs`, `tailMs`, `materialLoopSec`, `ambientBirthRate`, `referenceAreaM2`, `activeCosmeticCap`, `qualityMultiplier`, `seedScope` และ reaction/camera coalescing policy

ชื่อเหล่านี้เป็น proposedmetadata ไม่ใช่ schema ที่ประกาศว่าใช้ได้แล้ว. Gameplayhitcount/interval/duration ไม่คัดเข้า recipe;renderer อ้าง action/payload/state จริง. ชุด nominalvisualtiming และ density ข้างต้นให้ implementer ใช้เริ่มต้น ไม่เปิดช่องให้เดา universalrepeatdelay ราย component อีก

จังหวะผ่านได้เมื่อดู normal-speed แล้วเห็น one press/burst/channel/field ต่างกันชัด,peak ตรงเหตุการณ์,ambient ไม่กลายเป็น hitspam และทดสอบ pause/seek/speed แล้วอัตราไม่คูณซ้ำ. ค่า visualtuning ปรับต่อได้จาก evidence โดยไม่มีการเปลี่ยน gameplay งบ damage เพื่อให้ภาพดูตรง

### 5.7 Selected landing/cast timing examples

ค่าในตารางเป็น **baseline 1× action speed จาก current profiles/schedules** เพื่อให้ implementer ตรวจว่าผูก clock ถูก. Runtime อ่าน resolvedtimestamps จริงรวม speedmodifiers/overrides ไม่คัดเลขเหล่านี้เป็น timer ใน component

| Skill/family | Cast preparation | Landing deadline ของวง | หลัง landing |
| --- | --- | --- | --- |
| Meteor / Firestorm ที่ใช้ current ground profile | windup 0.4s | release+0.45s ≈0.85s นับจาก start | Onepresscue แล้ว residue ตาม recipe |
| Overload ที่ใช้ current ground profile | windup 0.4s | Firstpulse≈0.85s;secondpulse ตาม schedule อีก 0.3s | วง initial จบที่ first pulse;ขอบคงได้กับ subduednext-pulse indicator ไม่เปิด cast bar ใหม่ |
| BlizzardหลังSC-Xfield-v2 | windup0.4sตามprofile | Activation/landing≈0.85sที่1×;firstdamage≈1.25sและlast≈8.85sตามactualschedule | วงlandingเต็มตอนfieldเริ่ม;next-pulsecueเบาแยกจากcastbar. Legacyreleasedworkยังใช้savedtimesเดิม |
| Ground Slam/caster burst | melee preparation ที่ resolve จริง | actual single impact;ไม่เพิ่ม delay เพื่อยืดวงให้ดูสวย | วงเชื่อมกับ groundstrike/onepress |
| Enemy Boulder Toss ที่ใช้ current mob profile | windup 0.6s | release+0.8s ≈1.4s จาก start | Circleimpact ตรง pending ground attack |
| True instant impact | phase อาจเป็นศูนย์ตาม action จริง | immediateboundary;ไม่มี artificialcountdown | Impactcue โดยตรง |

LegacyBlizzardschedulerที่ตรวจรอบนี้วางpulsesจากreleaseโดยตรง(first≈0.8sที่1×). SelectedSC-Xmigrationให้newfieldsactivateที่resolvedgroundlandingแล้วtickตามfield-v2;oldreleasedworkยังอ่านsaveddeadlines. Handoffต้องแยกactivation/firstdamage/expiryและscheduleversion;วงUIไม่เป็นผู้retimefieldเอง

Geometry/deadline เปลี่ยนก่อน commit ให้แสดง tracking ตาม policy. หลัง commitlandingpoint คงเดิม;legitimateretimeupdateprogress/remaining ด้วย effective revision. ภาพครบ 100%ต้องตรง event จริง ไม่ปล่อยวงเต็มค้างรอ scheduledimpact ที่คำนวณคนละ clock

### 5.8 Selected additions สำหรับburst/splash/fields

| Skill | Rhythm/space ที่ต้องแสดงหลังcore migration | Reject |
| --- | --- | --- |
| Water Ball | 5actualwater-sphere launchesตามeffects/SC-X initial0.12s;contactและchillreceiptจริง,waterymaterialไม่เป็นfireballrecolor | Oneprojectileกับ5fakehitflashesหรือให้dropletsเป็นadditionaldamage |
| Double Strike | Twophysicalcontactbeatsinitial0.12sที่basespeedตามdeclaredattacktiming;poseA→poseB→recovery,committedtargetและrangeจริง | Cloneหนึ่งslashสองชั้นพร้อมกันหรือdamageทั้งคู่ก่อนภาพblowสอง |
| Split Shot | Oneflightตามpath/height→actualcontact→splashcircleที่contactpoint;fragmentfanเป็นcosmeticหลังimpact | Threephysicalarrowsตั้งแต่releaseหรือexplosionอยู่oldaimpoint |
| Storm Field | Cast/landingringถึงactivation→fixedchargedbed8sตามfieldstate→real1spulsesและquietairbranches | Fullstrengthlightningexplosionทุกtextureloopหรือcloudตามtargetที่ออกวง |
| Poison Cloud | Cast/landing→fixedlowcloud8s,real1spulses,poisonapplicationaccentตามfirst-successscope | Newpoisonstacksทุกdroplet/pulseโดยไม่มีreceiptหรือfogปิดtargetทั้งหมด |
| Thunder Storm / Chaos Wave / elemental novas | Onecaster-centerednovaตามcanonicalinstantaction,briefresidueและrecipientstatusmark | Sustainedweather/travellingfrontที่ไม่มีgameplaymodel |
| Ignite / Venom Bolt / Entropy / payoff rows | Actualinstant/body-application/payoffcueตามcanonicalrow | สร้างprojectile/delayเพียงเพราะชื่อหรือภาพเดิมเป็นbolt |

Currentcaster/weapon/speed/fieldrecordsต้องresolvearchetypeให้ครบก่อนเลือกrecipe. ScopeของArrowShoweron-hitexception/CoC/status/leechอ่านactualacceptedreceiptsตามPart1SC-E;VFXไม่ตีความว่าทุกarrowเพิ่มcastertriggerใหม่เอง

### 5.9 Build speed, density และfeedbackที่ไม่เปลี่ยนmechanics

- Attack/cast-speedfactorและplaybackspeedเป็นคนละdomainตามPart1SC-T. Animationmarkers/trails/castprogressอ่านresolvedphaseจริง;ไม่คูณstatfactorซ้ำในmaterialloops
- Highattackrateอาจเกิดหลายactiveinstancesจริงได้;coalescebodyflash/text/secondaryparticlesแต่เก็บrealcontact/field/threatข้อมูลครบ
- Triggeredskillsใช้ของตัวเองพร้อมroot/parentidentity;oneprimaryposeกับmanyeffectsไม่เท่ากับmanyprimarycasts
- Prewarm/decodeของloadout/currentcandidateที่กำลังจะใช้;missingtextureไม่ทำให้engineรอหรือเปลี่ยนimpactเวลา. Essentialgeometry/contactมีworkingfallbackที่ตรวจไว้
- Heightcurves/particleposesเป็นanalyticalsampling;birthsเฉพาะvisiblelifetimewindow ไม่ย้อนspawnbacklogเมื่อเปิดtab
- Cachegeometry/texture/filterdefinitionsตามasset/geometryversionและboundretainedresources. Rendererqualitytierไม่consumecombatRNGและไม่dropgameplaywork

## 6. Current roster review inventory

VF0 สร้าง inventory จาก current non-retired canonical rows; snapshot ตอนเขียนคือ attack56/buff9/curse6/heal3/aura18. ตรวจทุก actual row ไม่ยึดรายชื่อ batch77 เดิม

ต่อ row ต้องระบุ:

```text
canonical id / current cast-area-action-effects owner
shape + aim/lock + delivery + hit/lifetime model
motion profile + available actor/direction capability
component roles + anchors + forward axes + projection/layers
actual contacts/results/state bindings
selected asset/version + required metadata/asset gaps
orientation mode / source forward and pivot / lock rule / calibration evidence
landing telegraph scope / first landing schedule / tracking and commit / field transition
rhythm family / resolved impact binding / selected cue and tail windows
ambient rate and reference area / active cosmetic cap / quality tier / material loop
review status: retained-pass | code-fix | metadata-fix | asset-needed | semantic-conflict
observable proof / owner / pending reason
```

Inventory เป็น work record ตาม existing manifest/candidate workflow ไม่ใช่ runtime config สำเนาใต้ docs. ถ้าเพิ่ม/retire สกิลระหว่างทำให้ reconcileIDs ก่อน promote

### 6.1 Deterministic coverage resolver สำหรับcurrent92rows

VF0/SC1ต้องresolveทุกrowด้วยprecedenceของPart1section3.7 และเก็บchosenprofile/overrideอย่างชัดเจน. Defaultfamilyassignmentsที่เลือก:

| Canonical meaning | Required visual family / height / rhythm |
| --- | --- |
| Aura | Quietenabled-statecomposition,footbed+bodyornaments;stateclockไม่เป็นdamagepulse |
| Buff | One selfactivation + actualstate/charges + expiry;body/groundattachmentsตามeffect |
| Curse | Targetapplication + quietrecipientmarkตามactualduration;no fakecontrol/periodicdamage |
| Heal | Actualinstant/HoT/cleanseprofile;realrestoration/removalcueแยกจากambientmaterial |
| Chain action | Orderedlinksระหว่างactualcontacts;secondaryhopreachไม่เป็นAoEfield |
| Burst action | Actualper-launch/per-impactinstancesจากnew/currentactionkind;heightตามdelivery |
| Persistent field | Initiallanding/activation + fixedgroundweather/pulses + exit;fieldlifetimeจริง |
| Mobile channel | Caster-followingactivecomposition+actualpulseaccents+cancel/finish |
| Projectile-impact-area | Oneflight + actualcontactcircle + localrecipientcues;noguaranteedremoteareaก่อนcollision |
| Projectile line | TravellingpierceตามSC4-P;physicalwidth/endcaps/pathและper-targetcontactsตรงกัน |
| Other projectile | Direct/body/ballisticprofileตามdeclaredheight;oneactualflightไม่repeatจากeffectname |
| Melee single | Contact-boundweapon-compatiblemotion+compactcontact;SC-Rreachจริง |
| Cone/line one impact | Committedsector/stripenvelope+weapon/spray/groundmaterialตามverb;onepress |
| Circle one impact | Caster/fixedworldnova/burstตามorigin;fullfootprintpeak+boundedresidue |
| Ground single | Declaredsky/vertical/rising/target-groundcontactprofile;no implicitAoE |
| Instant single/payoff | Directbody/status/consumecomposition;no inventedtravelorfield |

Explicitoverridesในsections3.8/4/5.8และPart1SC-Xเป็นส่วนของresolvedspec. ไม่มีrowที่อนุมานว่าBoltต้องเดินทาง,Stormต้องtickหรือEarthSplitterต้องเป็นlineจากชื่อ. Copiedgroundrecipeที่ยังไม่ตรงmotion/height/rhythmเป็นpendingfix แม้มีPNGแล้ว

### 6.2 All-skill completion record ที่ต้องมี

ต่อcanonicalIDต้องมีresolvedarchetype,speed/clockpolicy,rangebasis,geometry,aim/lock,origin/attachment,heightpath,componentorientation,impact/resultscope,field/state/expiry,selectedassetversionและacceptanceevidence. Recordreconcileกับcurrentliveinventoryอัตโนมัติตอนpromote;unknownnewrowsหยุดเฉพาะpromotionของrowนั้น ไม่ยกgenericfallbackว่าreviewผ่านแล้ว

ชื่อprofile/recordfieldsต้องnormalizeที่ownerเดียวและใช้ร่วมAI,Scene,Lab,copy/wiki. Workflowไม่ต้องสร้างmanualmatrixสำเนาgameplaynumbersอีกชุดเพื่อให้agentเก็บค่าเอง

## 7. New asset production และ handoff

### 7.1 ใครรับผิดชอบอะไร

- Core/Scene owner ให้ timing/shape/socket/contact contract ตาม Part1
- VFX integration owner ดู readers/recipes/layers/manifests และ compatiblefallback
- Producer agents ดูเฉพาะ assigned skill/component directories และส่ง frozen candidate versions
- Actor/equipment producer ดู grip/motion/direction ที่ขาด; VFXproducer รับ socket/trackreference ไม่ paint อาวุธซ้ำใน body โดยไม่ประกาศ
- Shared Scene/registry มี writer คนเดียวต่อช่วง; root/integrator รวม independentcontributions

Current asset work ดำเนินต่อได้. ก่อนรับของตรวจ selectedversion/source paths จริง และ ownership; ไม่ overwrite ไฟล์ producer ที่กำลังเขียน

### 7.2 Brief ที่ producer ต้องได้รับ

```text
Canonical skill / component role / candidate version:
Gameplay truth: shape, origin, delivery and temporal model:
Current actor/equipment identity and camera references:
World extent / component dimensions / footprint ruler:
Anchor and coordinate space / authored forward axis:
Motion silhouette and phase markers:
One shot / active loop / exit and interruption behavior:
Ground-projected / upright / elevated / actor-attached:
Composition note: other components that complete this skill:
Transparent background, clear borders/gutters, complete silhouette:
Reduced-motion representative state:
Specific rejection examples:
```

ใช้ built-in imagegen และ first-party art ตาม AGENTS. เก็บ raw/prompt/sourceprovenance/measurements ใน holdingarea ที่ producer ตกลง; runtime ใช้เฉพาะ promotedassets. ไม่มีการใช้ externalgenerationservices หรือ third-partypacks ใหม่

Generate separate components เมื่อ motion/timing/path ต่างกัน เช่น charge, trail, impact, field/residue. Newactoranimation ใช้ single-pose intake ตาม currentplayerproductioncontract. VFXatlaslayout ใช้ explicitactualmetadata; ไม่บังคับทุก asset เป็น 4×4/16frames หาก reader ยังไม่รองรับรูปแบบนั้นต้องเพิ่มแบบ compatible ก่อน promote

### 7.3 ต้องเจนใหม่เมื่อใด

- Source มีส่วนถูกตัด/ซ้อน cell หรือ flattenedpieces ที่แยกใช้งานไม่ได้
- ขาด orientation/foreshortening/direction ที่ทำให้ cone/weapon ไม่สัมพันธ์กับท่า
- Art มี fixedcamera/perspective ที่ deform เป็น worldfootprint แล้วเสีย material/silhouette
- ต้องมี separablefall/impact/trail แต่ atlas รวมทั้งหมดจนใช้คนละ path ไม่ได้
- Identity/material/motion ของสกิลอ่านไม่ออกแม้ anchor/geometry ถูกแล้ว

Pivot/forward/scale/timing ที่แก้ได้ด้วย metadata/recipe ให้แก้ตรง owner ก่อน. ภาพที่ผ่านอยู่ retain ได้. หาก generation ถูก block ให้บันทึก exactcomponent/blockedreason และทำ independentcode/metadata ต่อ; asset pending ไม่ถูกนับว่าผ่านแล้ว

## 8. Source/motion QA และ promotion

- เก็บ actualcanvas/rects/offsets/anchors/frameorder/forwardaxes และ unit/provenance/tolerance
- แยก rawalpha จาก renderedalpha-policy. Currentassets หลายชุดใช้ discard≤8; ห้ามอ้าง rawclean จาก thresholdedpass
- Padding/virtualcanvas ไม่กู้ pixels ที่หายไป. Visiblecontent ต้องไม่ bleed ข้าม frame หรือถูก filter/sourcebounds ตัด
- ตรวจ loopseam, pivotdrift, scalepumping, direction/material/lightingchanges และ frame ที่ขาด
- Source pixel preservation และ versioning ชัด; normalization ทำโดย assetowner ในขั้นตอนที่กำหนด
- Schema/reader ใหม่รองรับ workinglegacyentries; malformedcandidate ไม่ suppressfallback
- Promotion เป็น atomicselection ผ่าน owner เดียวเมื่อ asset+motion+livearena ผ่าน; ไม่เปลี่ยน skillid/saveidentity เพื่อเปลี่ยน artversion

## 9. VFX execution packets

การ implement ต้องใช้ selected angle/rhythm decisions ของ sections3.4–3.5/5.2–5.6 เป็น initial policy. VF0 เก็บ source-axis/phase/repeat branches ปัจจุบัน; VF1 freeze recipe fields; VF2 ตรวจ angle calibration และ one-shot melee; VF3 ตรวจ per-event cadence กับ continuous emission; VF4 รับ asset ที่ loop/มุมผิดจน metadata แก้ไม่ได้; VF5 resolve ทุก row เข้ากับ rhythmfamily; VF6 รับ normal-speed evidence พร้อมตัววัดด้านล่าง

ห้ามส่งมอบแค่หัวข้อว่า "tune angle/frequency later". ต่อ skill/family ต้องมีค่าที่ resolve จาก policy,current gameplay schedule และ override ที่มีเหตุผล;การปรับค่าหลังดูของจริงบันทึกเหตุผลและภาพ/trace ที่รองรับ ไม่เปลี่ยน damage budgets หรือ hitinterval เพื่อชดเชย VFX

| Packet | Deliverable | Dependency | Acceptance |
| --- | --- | --- | --- |
| VF0 — Inventory/current truth | Review rows/selected assets/current helpers/owner map และ semantic conflicts | Current files; read-only READY | ไม่ขาด live IDs และไม่ถือ manifest coverage เป็น visualpass |
| VF1 — Recipe/metadata binding | Role/anchor/forward/space/phase/layer/lifetime และ fallback adapters | VF0 + Part1 SC1 | Direction/units/ownership ชัด ไม่ duplicategameplayrules |
| VF-Z — Height/space rendering | Sections3.8–3.9: commonheightprojection,trajectory/tangent/ground-depthและattachmentadapters | VF1 + SC-Zcontracts | Direct/arc/fall/vertical/rising/camera-motioncasesสูงต่ำถูกและnoimplicitheightcollision |
| VF-A — Actor/motion coverage | Section3.10: actualdirectionalclipsequences,grips/tips/equipment/viewportbounds | FrozenSC3/SC-Zartcontracts + producerownership | Singlepose/directionfallbackไม่ถูกนับเป็นcompleteanimation;hands/foot/root/longweaponครบ |
| VF-P — Packaging/performance | Active-loadoutprewarm,measuredframe/atlaspackaging,sharedfilters/caches/budgetsและresourcecleanup | Selectedcandidateformats + currentrendererprofiling | Noimageload-inducedgameplaydelay,duplicateallocationsหรือleakedinstances;normal-speedframepacingมีevidence |
| VF2 — Directional/melee pass | แก้ representative6skills และ PiercingShot ตาม sections3.7/4 แยก sector/line-impact/travelling line | VF1 + SC2-G/SC3/SC4 subsets;SC4-P สำหรับ piercing | Indicator/motion/contacts ตรง archetype ที่ normal speed;no full-lane premature hits |
| VF2-L — Landing telegraph | Projected boundary + cast/landing progress + remaining/status, relation styling, lifecycle/dedupe | VF1 + Part 1 SC2-L; actual geometry/time | เห็นวงก่อนลงจริง เต็มตรง first impact, auto/manual/empty ground/field/cancel/reload ถูก |
| VF3 — Delivery/lifecycle pass | Sections5/5.8: existingfamiliesและSC-Xbursts/splash/truefieldmigrations | VF1/SC-X/SC-Econtracts + VF-Zเมื่อมีheight | Path/pulse/follow/cancel/expiry/spatialstatusตรง ไม่มีfakeevents/legacydoublepay |
| VF4 — Art repair/production | รับหรือเจน missingcomponents/poses ที่ VF2/3 พิสูจน์แล้วว่าขาด | Frozen brief/producer ownership; ทำขนานได้ | Source/motionQA และ measuredmetadata ครบ |
| VF5 — Whole-roster improvement | Everyresolvedrowตามsections6.1–6.2 + actualmobpaths รวมheight/speed/landing/rhythm | MandatoryVFpatternsและSCcontractversions + candidatesพร้อม | CurrentliveIDsไม่มีunknownfamily/untestednewprofile;pendingแยกจากretainedpassจริง |
| VF6 — Joint acceptance/promotion | Complete animation,overlap,reduced motion,loading,perf และ selected versions | SC7 core patterns ready + per-family candidate | SC8/VF6 ตรวจร่วม; evidence จริงและ pending แยกชัด |

SC core work ไม่ต้องรอ VF4 ทุกภาพ. VF2/3 ใช้ approved art/diagnostics พิสูจน์ binding ได้; final new-art approval ต้องดู candidate จริง. ไม่มี circular gate ว่า SC8 กับ VF6 ต้อง complete ก่อนอีกฝ่ายเริ่มตรวจ

Selectedorder: VF0/SC0→sharedSC1/VF1 freeze→VF-Z+minimumactorcapability→earlycone/line/bodyprojectile/skylandingproof→SC-Xfamilies/VF3→remainingart/roster→VF-Pnormalgameprofiling→jointSC8/VF6. Productionขนานตามcomponent/skillได้หลังmetadata/height/frame-mapcontractชัด;activationผ่านintegratorเดียว

## 10. Integrated acceptance และ future commands

| Scenario | สิ่งที่ต้องพิสูจน์ |
| --- | --- |
| Cone rotated ทุก quadrant | Same world axis/extent,asset forward ถูก,local weapon/spray ตามด้านที่ใช้ |
| Cone edges/front/back | Ground footprint กับ actual membership ตรง; no hit cue นอกรูปทรง |
| Directional archetype parity | Sectorimpact/flat-endedline impact/travellingcorridor ใช้ shape-time-membership ตรง profile;ไม่ใช้ภาพหนึ่งแบบทับทุกกลไก |
| Piercing near/mid/far | Contact/localburst ตาม front ที่ถึงแต่ละ target,flight ยังอยู่หลัง firsthit,one cast-target receipt และ save continuation ถูก |
| Direction input semantics | Cursor นอก reach ยังเป็น direction-only สำหรับ cone/casterline;ไม่เดินไล่ cursor แบบ ground point และไม่แอบ rotate หลัง confirm |
| Angle calibration sweep | ตรวจ 16world directions,±πและ zero-lengthaim fallback; source axis/pivot/edgeoverlay และ residual ตรง section3.5 |
| One-shot cue count | หนึ่ง resolvedpress มี primarycueowner เดียว;impact/recipient ไม่ถูกคูณด้วย layer/atlascycle/strikeCount |
| Actual burst/pulse cadence | จับคู่ launch/hop/pulseids กับ peak instances และ timestamps;interval อ่าน scheduler จริงไม่ใช้ generic0.14s |
| Weather emission | Births ต่อ combatsecond,live counts,area scaling และ seed ตรง selectedrecipe;material motion ต่อเนื่องระหว่าง damagepulses |
| Render frequency independence | Samecombatspan ที่ 30/60/144renderFPS ให้ birth schedule/event cues เดียวกัน;speed/pause ไม่คูณ rate ซ้ำ |
| Resumption | Seek/backgroundreturn คำนวณเฉพาะ particles ที่ยังมีชีวิต;ไม่มี burst ของ births หรือ old hit flashes ที่พลาดไป |
| Lock/tracking | Preview/live aim/committed direction ใช้ phase ที่ถูก; post-lock effect ไม่หมุนหาเป้าใหม่ |
| Landing countdown | ขอบ actualarea คงที่,progress เต็มที่ firstlanding,castfinish แยกจาก impact;ไม่ลง damage จากวง |
| Landing availability | Player auto/manual/empty ground และ enemy ground threat เห็นวงก่อน impact;authored/legacypaths ไม่ทำวงหายหรือซ้อน |
| Multi-pulse landing | Blizzardอ่านactivationกับfirstpulseแยกตามscheduleversion,Overloadไม่recastระหว่างpulse,Meteorไม่สร้างวงย่อยให้cosmeticmeteors |
| Landing lifecycle | Cancel/replacement/retime/sourcecontrol/areaexit/seek ใช้ state เดียวกับ executablework;no 100%-stuck timer |
| Melee multi-target | One primary sweep + per-real-target contacts; no authored/legacy double hit |
| Equipment/direction switch | Grips/handedness/depth/sockets ถูก; committed weapon snapshot ไม่เด้ง |
| Projectile early hit/miss/pierce | Visible path/terminal/recipient/feedback ตรงกับ receipts |
| Storms onempty ground | Center-to-edge coverage และ peak ตาม damage model; no fake procs |
| Fields/channels | Fixed/follow center,actual pulses,replacement/cancel/expiry ถูก |
| Buff/heal/curse/aura | Actual recipient/result/count/lifetime; quiet sustain และ distinct activation |
| Overlap/reduced motion | Silhouette/target/heavy telegraph ยังอ่านได้; geometry คงเดิม |
| Pause/seek/hitch/background | Current phase ถูก ไม่มี particle/hit backlog หรือ combat random เปลี่ยน |
| Loading/production/fallback | Selected paths โหลดได้จริง; invalid candidate แสดง working version พร้อม diagnostic |

Commands ที่มีใน repository สำหรับ implement/verify ภายหลัง:

```powershell
python tools/check-authored-vfx.py --selected
npm run typecheck
npm --prefix game run check
npm --prefix game run build
```

`--selected` เป็น read-only selected asset geometry check ที่มีจริง. Legacy default checker ยังมี 23-id batch และ layout assumptions; มันไม่พิสูจน์ cone orientation,contact timing,source-to-target coherence หรือ current roster ทุก row. ใช้ focused renderer/space/timing tests ตาม affected owner และเพิ่ม negative cases ที่มีความหมายตามงาน implement

Live arena: `http://localhost:5173/__showcase?sample=arpg-arena`; Lab: `http://localhost:5173/__showcase?sample=skill-fx`. ใช้ existing server port 5173 หนึ่ง visible task tab ที่**1920×1080**และปิดหลังตรวจ. Lab/contact sheet ช่วย inspect ไม่แทน normal-speed actual combat acceptance

Performance เก็บ frame pacing,active components,decode/texture/filter cost และ retained resources พร้อม scenario/browser/device. ลด secondary sparks/smoke/debris/trails ก่อน essential contacts/geometry. ไม่ตั้ง hardware timing เป็น ordinary correctness test และไม่ลด simulation events เพื่อให้ภาพลื่น

## 11. Definition of done

แผนนี้ต้องส่งมอบ **VFX ที่ดีขึ้นจริงใน runtime** พร้อม code/metadata/assets ที่เกี่ยวข้องเมื่อ implement: ทิศ/anchor/scale/phase/contact/lifecycle ตรงกับ action และสกิลแต่ละ family อ่านออก. Current roster ทุก row มี review result ตาม identity จริง; pending asset/semantic conflict ยังแสดงเป็น pending

**Landing telegraph เป็น acceptance ที่ต้องส่งมอบ:** eligible cast เห็นพื้นที่ล่วงหน้าพร้อม progress ที่ถึง deadline ถูก, cast preparation แยกจาก landing wait, hostile/friendly อ่านต่างกัน และ actual damage เกิดจาก engine. ภาพ charging นิ่งหรือวงที่เกิดเฉพาะหลัง impact ไม่ถือว่าผ่านงานนี้

Completion รวม **องศาที่ calibrate แล้วและจังหวะที่ตัดสินแล้ว**: ไม่มี row ที่รอ implementer เดาทิศ/loop rate,one-shot ไม่กลายเป็น multihit จากภาพ,real pulses ไม่ถูกยุบหรือเพิ่ม และ continuousweather ไม่กระพริบเป็น hitspam. Timing/density ใน sections5.3–5.4 เป็น initialvisualtuning ที่ต้องดูในสนามจริง ไม่ใช่คำอ้างว่าผ่านแล้วจากการเขียนตัวเลข

รายงาน changed files,selected versions,actual checks/browser observations,compatibility/art limits และ scope ที่ยังค้าง. งานเอกสารรอบนี้เสร็จได้จากการตรวจ sources/links/dependencies; ไม่ใช่หลักฐานว่า implementation หรือ asset promotion ผ่านแล้ว
