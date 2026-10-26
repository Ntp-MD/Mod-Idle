# Part 2 — Skill VFX design, new asset generation and integration

วันที่: 2026-10-26

สถานะ: **แผนออกแบบและส่งมอบงาน VFX ใหม่ ยังไม่ได้เริ่ม generation, integration หรือ promote asset จากแผนนี้**

เอกสารคู่กัน: [Part 1 — Combat core engine, animation, range and mob AI](combat-core-engine-ai-plan.md)

## 1. ขอบเขตและเจ้าของงาน

ผู้ใช้ระบุว่า agent อื่นกำลังผลิต VFX ใหม่อยู่แล้ว เอกสารนี้เป็น detailed design, production handoff และ acceptance specification สำหรับรับ asset stream นั้น. ผู้รับงานต้องประสาน ownership ก่อนแก้ shared files; ฝั่ง core และ producer ต้อง freeze component/timing/geometry contract ร่วมกันก่อนเปลี่ยน registry หรือ manifest

- ครอบคลุม visual identity, component generation briefs, transparent atlases, measured metadata, area assembly, runtime integration และ integrated QC
- Gameplay ยึด [skills.json](../../tools/data/skills.json), canonical engine data, engine/runtime ปัจจุบัน และ action/outcome ของจริง. Combat implementation ชุดเดิมเสร็จแล้วและผู้ใช้ลบแผนเก่าโดยตั้งใจ; ไม่มี dependency ให้สร้างแผนนั้นกลับหรือ implement ซ้ำ
- Historical planning/mapping artifacts ใช้ได้เพียงบริบทเมื่อยังมีอยู่ ไม่เป็น runtime input หรือ authority เหนือ canonical data/implementation ปัจจุบัน; dependencies ในเอกสารนี้ชี้ current modules โดยตรง
- First-party production ยึด [vfx-production.md](../../art-reference/skills/vfx-production.md) และ [production roster](../../art-reference/skills/vfx-production-roster.json)
- Animation, socket sampling, meter projection, range/target preview และ mob AI เป็นงาน Part 1 โดยใช้ contract ใน section 4–9
- Skill matrix เป็น design/acceptance reference; ไม่ได้เปิด production queue ซ้ำหรือยึดไฟล์ของ agent ที่กำลังสร้างอยู่
- Asset ที่ยังไม่ถึงคิวหรือยังไม่ผ่านใช้ fallback ปัจจุบันจน replacement ผ่าน contract และ integrated acceptance

## 2. สิ่งที่ยืนยันจาก repository และข้อจำกัด

สำรวจ source แบบ read-only ระหว่างเตรียมแผน; ไม่ได้เปิด browser หรือรัน asset checker เพื่อรับรองภาพในงานเอกสารนี้

- Production doc ระบุ authored assets ครบ 77 live player skills แล้ว แต่ยังไม่ใช่หลักฐานว่า composition/scale/motion ผ่านครบ
- Current manifest มี 76 entries และ explicit Firestorm ใน authored registry; ต้อง resolve actual selected asset ต่อ canonical ID ใหม่ใน V0
- Authored runtime ที่สำรวจใช้ atlas stamp เดียวเป็นหลักที่ area center; distributed shower/storm assembly ยังต้องออกแบบและพิสูจน์
- `AuthoredVfx` รองรับ measured rects/anchors/virtual padding แต่ยังไม่มี inspected multi-component composition schema
- `arena-vfx-space.ts` และ `ArenaVfxShape.svelte` มี projected geometry ให้ reuse
- `tools/check-authored-vfx.py` default ยังเป็น 23 IDs และสมมติ 4×4/16 frames/batch-v1; ห้ามอ้าง whole-roster QA จาก default run
- `art-reference/vfx-previews/` ไม่พบใน workspace ที่สำรวจ; ใช้ first-party authored output และ handoff ปัจจุบันโดยไม่มี dependency กับ shelf เก่า
- เมื่อ brief ขัดกันให้ยึดคำสั่งล่าสุดของผู้ใช้และ canonical gameplay/runtime ปัจจุบัน → Part 1 spatial/timing contract → production art direction → recipe/asset brief ตามลำดับหน้าที่
- Source เปลี่ยนพร้อมกันได้; ต้องตรวจ actual symbols/paths ใน packet ที่เริ่มทำ และระบุสิ่งที่ยังไม่พิสูจน์ว่า UNVERIFIED

| Contract ที่ VFX ใช้ | Current source ที่ต้องอ่านเมื่อเริ่ม packet |
| --- | --- |
| Roster, delivery, shapes, effects และ tuning | [skills.json](../../tools/data/skills.json), [engine.json](../../tools/data/engine.json) |
| Action timing, area membership และ projectile collision | [engine types](../../engine/types.ts), [skill-area.ts](../../engine/skill-area.ts), [skill-actions.ts](../../engine/skill-actions.ts): `skillCastTiming`, `releasedSkillCastTiming`, `targetsInSkillArea`, `firstProjectileHit` |
| Intent, released flights, repeated actions และ field execution | [combat-actions.ts](../../game/src/sim/combat-actions.ts): `CombatIntent`, `CombatFlight`, `projectilePosition`; [game.ts](../../game/src/sim/game.ts); [CombatClock](../../game/src/sim/combat-clock.ts) |
| Resolved skill effects และ presentation receipts | [skills.ts](../../game/src/sim/skills.ts), [FxEvent](../../game/src/sim/types.ts), [CombatArena](../../game/src/sim/combat-arena.ts) |
| Pending-work restore และ field transition facts | [pending-work.ts](../../game/src/sim/pending-work.ts): `snapshotPendingWork`, `restorePendingWork`; [field-area.ts](../../game/src/sim/field-area.ts): `syncFieldState`, `restoreFieldPositions` โดยอ่าน current behavior จริง ไม่อนุมาน unlimited population/registry จากชื่อ module |
| Sampling/projection/scene integration | [combat-arena-view.ts](../../game/src/ui/combat/combat-arena-view.ts), [arena-vfx-space.ts](../../game/src/ui/combat/arena-vfx-space.ts), [CombatArenaScene.svelte](../../game/src/ui/combat/CombatArenaScene.svelte) |

ตารางนี้ชี้เจ้าของที่มีอยู่ ไม่เปิด engine workstream ใหม่. Part 1 CP0 ตรวจ current implementation กับโจทย์ polish; CP1 ส่ง contract ที่ VFX ใช้. ไม่มี missing-upstream-plan blocker

## 3. VFX art direction และองค์ประกอบภาพ

### 3.1 ภาษาภาพร่วม

รักษา chibi actors, silhouette คม, pixel clusters ที่อ่านออก, perspective ของสนาม และ luminous cores ที่มีรูปทรง. ความอลังการมาจาก **การเคลื่อนที่ที่มีทิศทาง + หลายระดับความลึก + จังหวะสะสม/กระทบ/สลาย + การครอบคลุมพื้นที่**

- Preparation เล็กและรวมพลังที่ต้นทาง
- Release มี silhouette ที่จำได้ เช่น lance, fan, arc, shower, vortex
- Impact มี peak ที่ชัดและตามด้วย decay
- Residue มีไว้บอก field/status ที่ยังอยู่จริง; initial strike ไม่ค้างเต็มความสว่างตลอด duration
- ภายใน effect มี negative space ให้เห็นเท้า เป้า และ enemy windup
- แยก ground decal, upright energy และ falling object เพื่อควบคุม perspective
- หลีกเลี่ยง opaque disk ขนาดใหญ่ที่ปิดสนาม และ white flash เต็มจอสำหรับ ordinary hit
- ห้ามมีตัวอักษร กรอบ atlas checkerboard UI หรือ sprite ตัวละครติดมาใน component

### 3.2 ธาตุเป็นวัสดุและการเคลื่อนที่

| Element | Material/motion ที่เสนอ | ภาพจำที่ควรรักษา |
| --- | --- | --- |
| Physical | weapon arc, dust, stone chips, pressure streak | ทิศทางแรงและ contact ใกล้อาวุธ |
| Fire | hot core, curling flame, ember, short dark smoke | การลุก/หมุน/ระเบิดตาม skill verb |
| Cold | sharp facets, frost creep, snow gust, brittle breakup | การเกาะแข็ง/แทง/แตกต่างจากการระเบิดไฟ |
| Lightning | branching segments, charge nodes, short sharp discharge | contact chain และจังหวะสั้นคม |
| Poison | droplets, viscous streak, vapor pockets | พ่น/หยด/ปนเปื้อนที่มีขอบเขตอ่านออก |
| Void/chaos ตาม canonical row | inward pull ทางภาพ, dark core, rim light, torn fragments | แยก implosion/rupture/curse โดยไม่มี gameplay pull ที่ไม่ได้ author |
| Buff/heal | restrained ribbons, clean motes, activation crest | อ่านผู้รับและผลสำเร็จ; ไม่กลบ offensive telegraph |

สีเฉพาะยึด actor/world palette ที่ใช้อยู่ ตารางนี้ไม่สร้างธาตุหรือ status ใหม่

### 3.3 ลำดับความเด่นในสนาม

1. Player silhouette, actual target, hostile heavy preparation และพื้นที่อันตรายที่กำลังจะกระทบ
2. Primary action release/contact และผลที่สำคัญ เช่น execute/crit ตาม resolved event
3. Persistent field edge/occupation และ mob role cues
4. Secondary sparks, smoke, dust, aura decoration และ afterglow

เมื่อเกิดเอฟเฟกต์พร้อมกัน ให้ลดความทึบ/จำนวนชิ้นตกแต่งตาม priority โดยยังคง geometry และ real-contact cues ของทุก action ที่จำเป็น

### 3.4 มาตราส่วนล่าสุด: ground footprint เป็น ruler

ยึด Part 1 section 4.2: **ตัวมาตรฐานมี ground footprint diameter 0.5m, radius 0.25m**. World positions เป็น continuous meters ไม่มี grid บังคับก้าวละ 0.5m. วง/ellipse ที่ project จาก footprint เป็น ruler ของพื้นที่ยืน; art silhouette เป็น style ที่วัดแยกต่างหาก

Player และ mob ทุกตัวเริ่มจาก footprint scale 1 เมื่อไม่มี explicit authored override. `readsAs`, body class, ความสูงหัว, ความยาวอาวุธ หรือ PNG bounds เก่าไม่สร้าง size override ใหม่อัตโนมัติ. Mob ที่ต้องใหญ่/เล็กใช้ explicit footprint override จาก canonical owner เท่านั้น และ VFX อ่าน resolved geometry เดียวกับ core

ห้ามบีบหัว/อาวุธ/ลำตัวให้ลงสี่เหลี่ยม 0.5m หรือ resize sprite เพื่ออ้างว่าแก้ collision scale แล้ว. ตัวอย่าง radius 4m คือ diameter 8m หรือ 16 standard footprint diameters; เทียบผ่าน ground projection ไม่เทียบความกว้าง silhouette ที่อาจรวม pose/อาวุธ

Production brief/handoff เก่าที่เขียน “body width 0.5m” ต้องใช้คำนิยาม footprint นี้เมื่อรับ revision ใหม่. Art direction ของ actor ยังรักษา chibi proportions และ weapon reach ที่ตั้งใจไว้; integration ไม่เปลี่ยน radius จาก alpha bounds ของภาพ

## 4. VFX composition contract

### 4.1 Component กับ composition เป็นคนละชั้น

Asset ผู้ผลิตอาจส่ง `charge`, `release`, `flight`, `trail`, `impact`, `field`, `residue`, `exit` ตามที่สกิลต้องใช้ ไม่บังคับทุกสกิลมีครบ. Composition ระบุว่า component ใดอยู่ที่ไหน ตอนไหน ขนาดเท่าไร และตามอะไร

| Attachment | ใช้กับ | กติกา |
| --- | --- | --- |
| Actor socket | hand/muzzle/weapon/body cast cue | sample socket จาก clip+direction ณเวลาที่เกี่ยวข้อง |
| Released world point | ground burst/field | fixed หลัง commit แม้ caster/target เดิน |
| Actual contact point | hit burst/debris | อ่าน resolved impact ไม่คำนวณ nearest ใหม่ |
| Moving projectile | bolt/lance/arrow | ตาม committed path และ contact time |
| Sampled caster feet | Whirlwind/self aura | ตามผู้ร่ายตาม delivery ของมัน ไม่ตาม target |
| Eligible status recipient | curse/buff/status mark | อายุ/ผู้รับมาจาก status owner |

### 4.2 Visual recipe ที่เสนอ

เก็บ recipe ทางภาพในเจ้าของ presentation ที่เหมาะสม เช่นขยาย `arena-active-vfx.ts`/registry ปัจจุบันก่อนเสนอไฟล์ใหม่. Recipe อ้าง component keys, attachment, layer, phase, size policy, motion policy, cosmetic distribution, reduced-motion alternative และ render priority

- Gameplay dimensions อ่าน action snapshot; ไม่คัด radius/cost/hit count เป็นค่าคงที่ใน recipe
- จำนวน texture frames เป็นรายละเอียด asset; จำนวน real impacts มาจาก resolved schedule
- Decorative particles ใช้ visual seed ที่ stable ต่อ action/component ไม่ใช้ combat RNG
- Seed/positions ไม่เปลี่ยนเมื่อเปิด panel, resize, เปลี่ยนกล้อง หรือ re-render
- Recipe รองรับ asset version/fallback ได้; runtime ห้าม import ไฟล์ plan นี้หรือ JSON mapping ใต้ docs
- ลด skill-id special cases โดยให้ recipe บอก return stream, parallel flight, ground alignment และ loop semantics อย่าง explicit

### 4.3 Layer และ occlusion

ลำดับเชิงความหมาย: ground footprint/decal → rear pieces → actors ตาม ground depth → front/air pieces → result UI. ใช้ layer machinery ที่มีอยู่และแยก rear/front เมื่อจำเป็นจริง

ไม่เอา meteor ที่อยู่ไกลบนพื้นมาทับ actor ด้านหน้าทั้งชิ้นเพราะทุก component อยู่ front layer; ใช้ landing depth/height policy. UI nameplates ไม่เป็นตัวกำหนดโลกสามมิติ และ impact glow ไม่ควรบัง enemy preparation ที่สำคัญ

### 4.4 Coverage และ distribution

- Ground effect กระจายตามพื้นที่ รวม empty ground; ไม่แจก stamp ตามรายชื่อ hit targets
- Circle ใช้ deterministic stratified coverage: center region + inner/outer sectors, พร้อม bounded jitter
- Uniform-area sampling ใช้ `r = R * sqrt(u)` เมื่อใช้ random disk sampling; สุ่ม radius ตรง ๆ ทำให้แน่นกลางเกินไป
- Cone/line sample ใน local geometry แล้ว project world points; อย่าสุ่มใน bounding rectangle แล้วปล่อยล้น shape
- กำหนดระยะห่างขั้นต่ำทางภาพและสลับตำแหน่งตาม pulse เพื่อไม่กองที่จุดเดิม
- Particle count/size/density เป็น render tuning ตาม area และ quality tier ไม่ใช่ damage/hit count
- การครอบคลุมพื้นที่มีทั้ง field structure และ moving pieces; ไม่ต้องทำให้ทุก pixel สว่างพร้อมกัน
- Coverage ต้องคงรูปใน reduced motion โดยใช้ sparse markers/field texture ที่บอก center และ outer extent

### 4.5 ห้ามสร้าง hit จากภาพ

แยก `resolved impact` ออกจาก `decorative arrival` ให้ชัด. Arrival ที่ไม่มี hit ไม่ขึ้น damage number, HP change, successful-hit flash, proc หรือ kill cue

สกิลที่มีหนึ่ง damage press แต่มี shower หลายลูก ใช้ gameplay impact เดียวตาม canonical data/current action execution และวางจังหวะภาพรอบ impact นั้นให้เห็น peak กลางร่วมกัน. หลัง impact ใช้ debris/embers/ice dissolve เป็นหลัก; หากต้องการให้แต่ละลูกสร้าง damage จริงต้องเปลี่ยน gameplay contract ที่ owner ก่อน

## 5. สเปกละเอียดของสกิลที่ต้องใช้พิสูจน์ระบบ

### 5.1 Meteor — shower ของหลายองค์ประกอบ

- Shape/center/radius ใช้ committed ground circle
- Charge เป็นพลังที่ caster; area tell เบา ๆ อยู่ที่จุดร่าย
- ใช้ falling meteor component แยกจาก impact crater, rock fragments และ embers
- วาง landing sites ครอบ center/middle/outer region รวมจุดที่ไม่มีศัตรู
- ลูกแต่ละขนาดสร้างความลึก แต่ขนาดต่างกันทางภาพไม่เปลี่ยน damage share
- Selected behavior ปัจจุบันคือหนึ่ง damage press; จัด main landing beat ให้ตรง impact และให้ arrivals รอบข้างเป็น cosmetic ที่ไม่สื่อ HP loss เพิ่ม
- แยก airborne arc จาก ground projection; trailing smoke ตามการเคลื่อนจริง
- Exit เหลือ embers/ground scorch สั้นตาม visual lifetime ไม่ค้างทั้ง status duration
- Reject: หนึ่ง comet ขยายใหญ่ที่ primary target, ลงแต่บนตัวศัตรู, effect ไม่ถึง outer region, มี fake hit หลายครั้ง หรือขยับพื้นที่ตามศัตรูหลัง commit

### 5.2 Blizzard — sustained distributed storm

- Fixed deployed field ใช้ lifetime/pulses จาก current action/field execution ใน `combat-actions.ts`/`game.ts` ที่ Part 1 CP1 ตรวจ contract แล้ว
- ประกอบ field haze เบา, snow/wind ribbons, falling ice และ ground chips แยกกัน
- ใช้หลาย landing sites ตลอดพื้นที่; เปลี่ยนชุดตำแหน่งอย่าง stable ระหว่าง pulse
- แยก continuous ambience ออกจาก actual damage pulse; pulse cue อยู่ใน footprint และอ่านเวลาได้
- Target เดินเข้า/ออก field แล้วภาพยังเป็นพื้นที่เดิม; status entitlement ไม่เพิ่มตามเกล็ดหิมะ
- Fade จากขอบ/ลมและสลาย shard เมื่อ expiry/replacement; source ถูกควบคุมหลัง deploy ไม่ลบ field เอง
- Reject: ลูกน้ำแข็งเฉียงเส้นเดียว, burst ติดตาม primary, พายุหายเพราะ hit targets ว่าง หรือปล่อย full-opacity fog ปิด actors

### 5.3 Firestorm — พายุไฟหลายแกนภายในพื้นที่

- Ground circle คงที่; ใช้ vortex components หลายตำแหน่ง/ขนาดร่วมกับ ground heat และ embers
- องค์ประกอบหมุนวนใน local footprint มีทิศทางหลักที่อ่านออก; outer wisps ช่วยบอกขอบเขต
- มี peak ร่วมที่ actual damage impact; selected behavior ยังเป็นหนึ่ง press
- Vortex decorative หลายลูกไม่เท่ากับหลาย proc/hits; ความยาวภาพแยกจาก burn duration
- Reject: วงไฟเรียบอย่างเดียว, stamp ก้อนเดียวที่เป้า, vortex หลุด footprint จนดูเป็น damage อีกวง หรือเล่น hit flash ซ้ำตามรอบ texture

### 5.4 Whirlwind — mobile caster-centered channel

- Center ตาม sampled caster feet; gameplay pulses ใช้ตำแหน่งที่ sim ตัดสินแต่ละ pulse
- Actor start pose → spinning attack loop → finish; ตั้งทิศ trail ให้ต่อเนื่องแม้ caster เปลี่ยนทาง
- แยก near/far weapon arcs กับ ground dust เพื่อเห็นตัวผู้เล่นอยู่ตรงกลาง
- ใช้ actual pulse emphasis ตาม schedule; รอบหมุนตกแต่งไม่เพิ่ม damage
- การเดินระหว่าง channel ใช้ speed policy ที่เลือกแล้ว; pose ไม่แสดงวิ่งเต็มสปีดสวนกับท่าหมุน
- Cancel จบ future pulse cues แต่ preserve impact ที่เกิดแล้ว; recovery ยังอ่านออก
- Reject: effect อยู่กับที่เมื่อ caster เดิน, spin ปิด silhouette, ภาพหมุนต่อหลัง cancel หรือ body เคลื่อนเพราะ visual offset

### 5.5 Projectile burst และ chain

- Ice Lance/Arrow Shower: สร้าง flight instance ตาม actual launch index; แต่ละลูกมี release/trajectory/contact ของตัวเองตาม selected fixed burst aim
- การเห็นหลายลูกพร้อมกันต้องเกิดจาก flight windows ที่ทับกันจริง ไม่คัดลอกลูกเดียวตาม `strikeCount` อย่างเดียว
- Piercing Shot: แกนเส้นและ full width คงที่; ผ่าน eligible bodies ตาม swept contact และแสดงหนึ่ง hit cue ต่อ cast-target
- Chain Lightning: วาด hop จาก actual prior contact ไป actual next contact; terminal ที่ไม่มีเป้าจบ ไม่หาร่างใหม่ใน renderer
- ไม่มี homing/retarget จากการ interpolate sprite; source death หลัง release ใช้ current flight/lifecycle policy ของ runtime ที่ Part 1 CP1 ส่งให้

### 5.6 Directional melee / cone

- Impale: thrust จาก weapon socket ตาม committed line; ลำตัว/เท้าผู้ใช้ไม่ teleport ไปสุดเส้น
- Cleave: swing arc บอก opening/forward reach ของ cone พร้อมช่องว่างด้านหลัง
- Venom Spray: droplets/fan ใช้ cone จริง มีความหนาแน่นลดตามระยะ และ impact cues เฉพาะ outcome จริง
- แกนภาพทั้งสามสอดคล้อง direction snapshot แม้ actor เปลี่ยนทิศหลังจบ action
- Reject: cone กลายเป็นวงเต็ม, line บวมตาม texture aspect, hit ดูอยู่หลังผู้ร่าย หรือ paint damage เกิน length/width

## 6. Design/acceptance matrix สำหรับ player skill ทุกตัว

นี่คือ **สเปกภาพสำหรับรับและประกอบงานจาก agent ผู้ผลิต** ไม่ใช่ production queue ที่สั่งสร้างทั้งหมดใหม่. ตรวจ roster ปัจจุบันก่อนเริ่มแต่ละ batch; ณ วันสำรวจมี 77 live rows: attack 41, buff 9, curse 6, heal 3, aura 18. จำนวนนี้เป็นผลการสำรวจ ไม่ใช่ content quota

คำย่อ: W = preparation, R = release/flight, I = actual impact, E = exit/residue. ทุกตัวใช้ shared rules ใน section 4–13 และต้องมี reduced-motion equivalent

### 6.1 Attacks — projectile, elemental และ field

| Canonical ID | Gameplay ที่ภาพต้องยึด | Composition และจังหวะที่เสนอ | Reject เฉพาะสกิล |
| --- | --- | --- | --- |
| `attack.fireball` | Single projectile; burn เมื่อ outcome อนุญาต | W ember รวมที่มือ; R hot round core และ short turbulent tail; I directional fire splash ที่ actual contact; E embers แยกจาก burn status | AoE explosion, homing, ระเบิดก่อนชน หรือ trail ยังผูกกับมือหลัง release |
| `attack.firestorm` | Fixed ground circle; selected one press | หลาย flame vortices วนคนละรัศมีภายใน footprint; peak ความร้อนร่วมตอน I; E คลายเป็น cinders; เห็นช่องว่างระหว่างแกนพายุ | Stamp เดียวบนเป้า, วนหนึ่งรอบเท่ากับหนึ่ง hit หรือภาพ damaging field ค้างโดยไม่มีกลไก |
| `attack.meteor` | Fixed ground circle; selected one press | แยก rock fall/trail/impact/debris; ลง center–middle–outer sites; main bombardment beat ตรง I; E ควันบางและหินดับ | ดาวตกก้อนเดียวแทนทั้งพื้นที่ หรือ satellite impact สร้าง fake hit |
| `attack.ice_lance` | Burst ตาม authored hit count/share และ fixed burst aim | W ice spear ยืดจากมือ; R แต่ละ lance ออกตาม launch index; I compact crystal fracture แต่ละ contact; E sharp chips dissolve | รวม launch จริงเป็นภาพลูกเดียว/ออกพร้อมกัน หรือ fragment เพิ่ม hit |
| `attack.blizzard` | Fixed sustained circle; pulses ตาม field ledger | Snow/wind bands ต่อเนื่อง, falling ice หลายจุด, frost accent ตาม real pulse; E หยุดตกก่อนลด wind และ ground frost | ลูกน้ำแข็งเฉียงเดียว, target-attached bursts อย่างเดียว หรือ opaque white fog |
| `attack.frostbite` | Single impact; chilled-target payoff และ timed target effect | W frost tension รวมใกล้เป้า; I ice seam บีบ/แตกเข้าด้านใน; E quiet brittle seam สำหรับ debuff ที่ยังอยู่ | Slash/shatter ยาวตาม debuff duration หรือแสดง freeze ที่ไม่มี outcome |
| `attack.chain_lightning` | Ordered contacts ตาม chain scheduler | W compressed fork; R/I zigzag เชื่อม actual consecutive contacts มี core แคบ; link เก่าดับตามหลัง hop ใหม่ | เลือก target list ใน renderer, chain ซ้ำ target หรือเส้นทางที่ไม่มี resolved hop |
| `attack.spark` | Single projectile; shock application | Tiny charge knot → thin fast electric dart → compact snap; tail สั้นรอบ trajectory จริง | เปลี่ยน collision path แบบสุ่ม หรือ chain ไปตัวข้าง ๆ |
| `attack.thunder_strike` | Ground delivery ไปหนึ่งเป้า; shock ตาม canonical row | Narrow target charge → vertical bright column ที่ resolved point → contact needles → branches ดับจากบนลงล่าง | AoE hazard, guaranteed stun, knockback หรือ interrupt ที่ไม่ได้ author |
| `attack.poison_bolt` | Single projectile; poison application | W condensed liquid; R soft pointed toxic globule + viscous tail; I wet local splash; E droplets evaporate | Ground poison pool หรือ secondary spray damage |
| `attack.venom_spray` | Caster cone ตาม angle/reach จริง | Pressure ที่ source → diverging droplets แสดง cone edges และ interior → settle; actual hit cues แยกจาก droplets | วงเต็ม, spray ด้านหลัง หรือวาดเฉพาะตัวที่โดน |
| `attack.acid_arrow` | Single projectile; poison application | R rigid glasslike shaft ขอบ lime + liquid wake; I directional corrosive splash; E dissolving fragments | หน้าตาซ้ำ globule ของ Poison Bolt หรือ pierce ต่อเพราะชื่อเป็น arrow |
| `attack.chaos_bolt` | Single projectile; mark application | Angular core/orbiting shards → actual flight → sigil snap ที่ contact → polygons fold inward; mark ตาม state | Black-hole pull, AoE suction หรือ fixed mark count ที่ไม่มีจริง |
| `attack.void_blast` | Ground circle; single burst; mark application | Broken arcs บอกพื้นที่ → compression กลาง → angular rupture ทั้ง footprint → fragments พับกลับ | ดูดตำแหน่ง mob, lingering damage vortex หรือ burst แค่ primary |
| `attack.sand_storm` | Fixed field: initial press + periodic damage/presence effect ตาม owner | Low wind bed เชื่อมหลาย sand funnels; grit accent ตาม pulse; E ลดความสูงก่อน dust settle | Cloud ติด target หลังออก field, funnel count เพิ่ม damage หรือค้าง accuracy cue หลัง exit |
| `attack.earth_splitter` | Single-target ground contact; existing payoff | Pressure ใต้เท้าเป้า → compact fracture + heavy slabs → slabs settle/dissolve | สร้าง damaging fissure ผ่านหลายตัว หรือแยก payoff เป็น hit ใหม่ |

### 6.2 Attacks — melee, weapon และ payoff

| Canonical ID | Gameplay ที่ภาพต้องยึด | Composition และจังหวะที่เสนอ | Reject เฉพาะสกิล |
| --- | --- | --- | --- |
| `attack.backstab` | Single melee; crit-chance modifier | Shoulder preparation + small blade glint → oblique close cut → short retracting trail | Teleport ไปด้านหลัง, stealth/dash หรือ guaranteed crit |
| `attack.sidestep` | Single melee; hit-chance modifier | Lateral torso feint ที่ feet เดิม → narrow counter-thrust → bounded afterimage | ย้าย gameplay body, dodge/invulnerability หรือ dash ที่ไม่มี action |
| `attack.impale` | Caster line; length/full width จาก action | Weapon tension → continuous narrow thrust corridor → contact sparks เฉพาะ bodies ที่โดน → tip/trail retract | Radial blast, กว้างเกิน line หรือผู้ใช้ teleport ไปสุดเส้น |
| `attack.skull_crack` | Single melee; stun chance | Blunt weapon raise → compact dense jagged star ที่ body contact → falling dust; stun motif เฉพาะเมื่อเกิดจริง | Guaranteed stun stars ทุก hit หรือ displacement |
| `attack.ground_slam` | Caster circle; one impact; stop ตาม outcome | Planted load → grounded radial fracture/wave และ low debris ถึง extent จริง → center clears/ground cracks fade | วางทั้ง effect ที่ enemy หรือขยายวงแล้วลง damage ซ้ำตาม wave |
| `attack.bone_breaker` | Single melee; execute threshold rule | Weighty windup → dense ivory/steel fracture → chips; stronger terminal accent เฉพาะ execute/death จริง | Skull/death burst เมื่อเป้ายังมีชีวิต |
| `attack.carnage` | Single melee; leech จากจริง | Red-black close crescent → local cut → restrained return filament เมื่อมี actual leech → chest settle | Return stream จาก miss หรือ effective leech เป็นศูนย์ |
| `attack.cleave_down` | Single melee; existing payoff | Overhead preparation → tall narrow descending blade curtain → compact ground chips | Horizontal cone หรือ AoE จาก artwork ที่กว้าง |
| `attack.cleave` | Caster cone; committed direction | Hip/weapon windup → broad crescent ไล่ edge-to-edge ของ cone → short metal streaks | Full ring, cone ตามเป้าหลัง commit หรือ contacts ด้านหลัง |
| `attack.elemental_break` | Single melee; timed elemental damage-taken debuff | Prismatic weapon tension → spectral shell fractures ที่ contact → subdued seam ติด target ตาม state | Immunity destruction, extra elemental hit หรือ explosion ยาวตลอด debuff |
| `attack.whirlwind` | Moving caster circle channel; real pulse schedule | Start turn → separated steel crescents + low dust ตามเท้า → sweep accents ตาม pulse → finish/recovery | Fixed-ground ring, decorative spins เพิ่ม hit หรือหมุนต่อหลัง cancel |
| `attack.shield_bash` | Single melee; stop ตาม row/outcome | Close shield brace → flat shield-shaped pressure flash ที่ front contact → short recoil | Charge displacement, push หรือ wide cone ที่ไม่มีใน data |
| `attack.puncture` | Single melee; bleed application/refresh | Tip glint → hairline stab + compact puncture cue → restrained status seam | Wide slash, bleed stacks เพิ่มจากภาพ หรือ repeated wound explosion |
| `attack.reap` | Single melee; leech และ physical-power buff คนละ lifetime | Hooked preparation/crescent → small return stream เมื่อ leech จริง → quiet weapon sheen ตาม buff | Strike/return beam ค้างเต็ม buff duration |
| `attack.piercing_shot` | Traveling line; once per cast-target; ignore-dodge rule | Straight draw → thin advancing arrow/axial trail → brief actual contact sparks → range-limit exit | หยุดที่ตัวแรก, homing หรือแสดง beam เต็มเส้นก่อน travel |
| `attack.arrow_shower` | Separate single-target launches ตาม current data/scheduler | Rapid draw ที่อ่านแต่ละ release → actual arrow instances → contact accents ตาม arrival → clean trails | Ground AoE rain หรือ proc flashes ที่อนุมานจากจำนวนลูก |
| `attack.headshot` | Single projectile; crit chance ไม่ใช่ guaranteed crit | Focused draw → taut minimal-trail shot → precise upper-body visual contact → fine sparks | Head collision zone ใหม่, auto execute หรือ crit flourish บน noncrit |
| `attack.pierce_the_veil` | Single projectile; ignore dodge + timed resistance debuff | Spectral release plane → narrow silver shot → veil shell peels ที่ contact → faint debuff seam | Multi-target piercing line เพราะชื่อ หรือ flight ยาวตาม debuff |
| `attack.earth_shock` | Ground circle; one burst; cripple application | Low pressure at center → squat broken-earth front ทั่ว footprint → dust/crack fade; restraint cue ตาม status | Root/stun/knockback เพิ่มจาก appearance |
| `attack.detonate` | Single-target burn consume ตาม cap จริง | Actual burn motifs gather → one contained hot flare → dark cinders; อัปเดต burn ที่เหลือ | AoE explosion, consume ทั้งหมดทั้งที่จ่ายบางส่วน หรือ fake stack symbols |
| `attack.shatter` | Ground circle; chill payoff และ stop ตาม row | Sparse facets ตึงทั่วพื้นที่ → one distributed crystal fracture → shards fall/dissolve | New freeze, repeated shard damage หรือเพิ่ม cast prerequisite จากภาพ |
| `attack.overload` | Two fixed-circle real pulses ตาม schedule | Distributed charge nodes → pulse แรก → pause ที่อ่านออก → pulse สอง → filaments collapse | Continuous strobe หรือ branches เพิ่ม hits |
| `attack.catalyst` | Primary damage; actual poison spread ก่อน consume | Primary compress/flash → transfer tendrils ไป actual recipients → primary status updates → tendrils detach | Tendrils สร้าง secondary direct damage หรือ renderer เลือก spread targets เอง |
| `attack.ruin` | Single-target mark consume | Actual mark motifs converge → angular dark implosion → fragments collapse; residual marks ตาม state | Crowd pull, AoE หรือแสดง consumed symbols มากกว่าจริง |
| `attack.aftershock` | Caster circle; one burst + separate armour buff | Feet plant → low stone wave ทั่ววง → stone guard accents ใกล้ torso ตาม buff lifetime | Delayed second damage จากชื่อ aftershock หรือ earthquake ยาวตาม armour buff |

### 6.3 Buffs

Activation เป็น event สั้น; sustain เป็น layer เบากว่าและอิง actual state. Charge ornaments ลดตาม transaction จริง และ coalesce ทางภาพได้เมื่อจำนวนสูงโดยมี UI แสดงจำนวนที่ถูกต้อง

| Canonical ID | Gameplay ที่ภาพต้องยึด | ภาพที่เสนอ | Reject เฉพาะสกิล |
| --- | --- | --- | --- |
| `buff.warcry` | Timed self offensive/resistance effects ตาม row | Copper-gold chest pressure wave → small chest/weapon accents → edge dims inward | Enemy hit/fear หรือ ally buff radius ที่ไม่มีจริง |
| `buff.berserker` | Self attack-speed/leech benefit และ damage-taken penalty | Red forearm coils, broken aggressive contours; sustain เบา → coils fragment | Invulnerability shell หรือให้ภาพเพิ่ม attack speed เอง |
| `buff.iron_will` | Armour/damage reduction | Steel plates lock ใกล้ torso → sparse plate edges → unlock/fade | Collision wall หรือภาพลบ incoming hit ทั้งหมด |
| `buff.holy_veil` | Clear/prevent statuses เฉพาะที่ row ระบุ | Ivory sweep head-to-feet; removed motifs ตาม actual cleanse → thin veil → flecks | Full damage immunity หรือ cleanse สถานะที่ยังคงอยู่ |
| `buff.ghost_dance` | Perfect-dodge charges ที่มี state | Spectral slivers ใกล้ตัว; accepted avoided hit ใช้ charge accent หนึ่งครั้ง | Fake sidestep, ornament ลดจากภาพ weapon ผ่าน หรือ charge cue ไม่ตรง state |
| `buff.earth_wall` | Physical block charges; mitigation ตาม owner | Stone guard plates + real remaining-charge motifs; actual block ทำ plate fracture | Navigation wall, perfect dodge หรือแสดง zero damage โดยไม่มีผลจริง |
| `buff.magia_drive` | ES recharge behavior ตาม row | Cyan-violet broken chest ring; inward streams เมื่อ recharge จริง; quiet sustain | Instant full ES refill หรือ absorption เพิ่มเอง |
| `buff.energy_absorb` | Incoming damage conversion to ES ตาม transaction | Intake facets; qualifying impact light ส่วนหนึ่งพับเข้าสู่ chest | Conversion จาก miss/dodge/nonqualifying hit หรือทำให้ดูว่ารับ damage เป็นศูนย์ |
| `buff.flame_guard` | Temporary ES pool | Close ember shell; depletion/expiry burn-out; brightness ใช้ pool state ถ้ามี exposure ที่ถูกต้อง | Enemy burn aura หรือ precise pool meter ที่ไม่มีข้อมูลรองรับ |

### 6.4 Curses

ใช้ application accent หนึ่งครั้ง แล้ว target-attached mark ขนาดเล็กตาม actual duration. Animation ของ curse ไม่เป็น AI/control engine อีกตัว

| Canonical ID | Gameplay ที่ภาพต้องยึด | ภาพที่เสนอ | Reject เฉพาะสกิล |
| --- | --- | --- | --- |
| `curse.weaken` | Reduced damage dealt | Dull red-grey chest seal บีบเข้าด้านใน → slow low-intensity pulse → dust | Stun/slow/armour loss เพิ่ม หรือ overlay บังทั้งตัว |
| `curse.blinding_mark` | Accuracy reduction | Broken eye motif ใกล้ upper body → asymmetric dim flicker → pieces peel | Total blindness/guaranteed misses หรือปิด silhouette |
| `curse.expose` | Increased damage taken | Gold fault line บน torso → subdued glint on actual hits → seam closes | Armour destruction, self-damage หรือ crack damage ticks |
| `curse.cripple` | Attack-speed reduction | Thin weighted bands รอบ attacking arm → quiet sustain → crumble | Movement root/slow หรือคูณ slowdown ของ animation ซ้ำกับ sim |
| `curse.jinx` | Increased eligible crit chance | Broken black-gold star → alternating points → actual crit accent → fall apart | Guaranteed crit flash บนทุก incoming hit |
| `curse.venom_bind` | Stops existing poison-stack decay ตาม state | Green brackets ล็อก poison motif เดิม → quiet loop → brackets open on expiry | Poison stacks/ticks ใหม่ หรือ immobilization |

### 6.5 Heals

| Canonical ID | Gameplay ที่ภาพต้องยึด | ภาพที่เสนอ | Reject เฉพาะสกิล |
| --- | --- | --- | --- |
| `heal.heal` | Self HoT โดย periodic heal owner | Green-gold motes gather → small inward accents ตาม real heals + quiet connecting layer → final settle | Extra heal ticks หรือ beam ใหญ่ต่อเนื่องเมื่อไม่มี restoration |
| `heal.greater_heal` | One self restoration | Lift จาก feet/chest → one strong ivory-green inward bloom → ascending filaments fade | HoT loop หรือ party-heal radius |
| `heal.cleanse` | Applicable cleanse + one authored heal | Clean body sweep; cleared status motifs detachจริง + one restoration pulse → fragments dissolve | ลบ indicators ของสถานะที่ยังอยู่ หรือ ongoing immunity |

### 6.6 Auras

Aura มี activation สั้น, loop ขณะ enabled และ exit เมื่อ disabled. ใช้ shared restrained ground bed ร่วมกับ ornaments ที่เลือกอย่างมีลำดับ ไม่ซ้อน opaque disk เต็มวงสำหรับทุก aura. HUD/state ยังคงแสดงทุก aura ที่เปิด แม้ render decoration ถูกลด

**Decorative aura ellipse ไม่ใช่ gameplay radius.** Membership ของ enemy-affect aura ต้องมาจาก gameplay; player aura scope ไม่เปลี่ยนตาม mob-aura behavior อัตโนมัติ ให้ใช้ current aura owner ของแต่ละชนิด

| Canonical ID | Meaning ที่ภาพต้องยึด | Continuous identity ที่เสนอ | Reject เฉพาะสกิล |
| --- | --- | --- | --- |
| `aura.wraith_of_fury` | Self attack speed | Paired copper-red crescents รอบ foot bed + wrist accents จังหวะกระชับ | Ghost attacks, damage pulses หรือเร่ง clip นอก sim |
| `aura.clarity` | Mana regeneration | Cool-blue beads spiral ลงสู่ chest; open quiet foot ring | Direct gain flashes ที่ไม่ได้ resolved หรือสับสนกับ HP heal |
| `aura.haste` | Speed behavior ตาม canonical rules | Amber ankle streamlines + two sparse helices | เพิ่ม local move multiplier เอง หรือปรับ action timestamps ใน UI |
| `aura.vitality` | HP regeneration | Moss-green petal strokes หายใจเบา ๆ ใกล้ feet/chest | Extra heal ticks หรือ party-healing area |
| `aura.herald_of_ash` | Added Fire power/alignment | Ember knots ใกล้มือ + broken charcoal-orange ground segments | Burning ground/on-kill explosion ที่ไม่ได้ author |
| `aura.herald_of_frost` | Added Cold power/alignment | Sharp facets ใกล้ shoulders/hands + fine angular cold accents | Auto chill/freeze หรือ frost field |
| `aura.herald_of_lightning` | Added Lightning power/alignment | Short threads เชื่อม wrist/shoulder nodes + broken electric ring | Chain damage/shock หรือ full-body strobe |
| `aura.ember_conversion` | Physical-to-Fire conversion | Metallic strokes อุ่นเป็น orange เมื่อไหลเข้าหา weapon | Added hit หรือภาพซ้ำ Herald จนไม่เห็น conversion identity |
| `aura.rime_conversion` | Physical-to-Cold conversion | Metallic strokes crystallize ไป weapon tip | Auto freeze หรือ trail หนาจนบัง ordinary attacks |
| `aura.storm_conversion` | Physical-to-Lightning conversion | Metallic strokes แยกเป็น filaments เข้าสู่ striking hand | Extra projectile หรือแบ่งภาพเป็น percentage ที่ไม่ได้ expose |
| `aura.cast_on_crit` | Accepted trigger ตาม cost/selection/ICD จริง | Quiet gold-violet relay sigil; accepted trigger เชื่อมไป release ของสกิลที่ออกจริง | Flare ทุก crit ทั้งที่ trigger rejected หรือเล่น triggered VFX สองชุด |
| `aura.cast_on_damage_taken` | Accepted incoming-loss trigger | Inward silver-violet chest relay; qualifying trigger ส่องสะพาน impact-to-cast | Trigger จากแค่ visual contact/zero eligible loss |
| `aura.rimbo_form` | Enemy attack-speed effect ตาม current player-aura scope | Pale grey-blue broken loops; recipient marks เฉพาะ actual affected bodies | Movement slow หรือ radius ที่อนุมานจาก decorative ring |
| `aura.elemental_fury` | Enemy elemental-resistance effect ตาม owner | Prismatic fault arcs ใกล้ caster + actual recipient edge symbols | Periodic damage/status ใหม่ หรือ scope เปลี่ยนเพราะ texture |
| `aura.trinity_form` | Self Fire/Cold/Lightning resistance | Three sparse distinguishable protective arcs แลกตำแหน่ง | Element immunity หรือ bonus ตามจำนวนวงตกแต่ง |
| `aura.grace` | Self evasion | Silver open wind loops ที่ ankles/shoulders | Guaranteed dodge cue หรือ automatic evasive movement |
| `aura.iron_guard` | Self armour | Slow dark-steel close facets และ restrained edge glints | Shield pool, perfect block หรือ hit deletion |
| `aura.energy_guard` | Self ES increase | Thin cyan torso segments เชื่อม soft foot arc | Recharge/absorb behavior ที่ไม่มี หรือ bubble ทึบปิด hit reaction |

### 6.7 Conflicts ที่ต้องปิดก่อนรับงานแถวนั้น

- Arrow Shower มี prose เก่าเรื่องแต่ละลูก trigger effects: Part 1 CP0 ตรวจเทียบ current `skills.json`, cast execution และ trigger scope ที่ implementation ใช้อยู่; VFX อ่าน accepted trigger receipts เท่านั้น ไม่ตั้ง entitlement จากจำนวนลูกที่วาด
- Thunder Strike ใน brief เก่าอ้าง interrupt ที่ canonical row ไม่ได้ให้; ใช้ actual shock/control outcome
- Backstab/Sidestep ไม่มีสิทธิ์ teleport/dash/dodge จากชื่อ; Earth Wall ไม่มี obstacle geometry; Void/Ruin ไม่มี movement pull
- Firestorm/Meteor ใช้ selected one-press model; หาก producer วาดหลาย impact ต่อเนื่อง ต้องจัด imagery ให้ตรง model หรือเสนอ gameplay change ที่ owner แยกต่างหาก
- Data ของ Flame Guard remaining pool/charges/cleanse recipients ต้อง expose ให้ถูกก่อนทำ precise ornaments; เมื่อข้อมูลไม่พร้อมใช้ qualitative cue ที่ไม่กล่าวอ้างจำนวนเท็จ
- Brief เก่ามีข้อมูลเสีย/ยอดรวมคลาดเคลื่อน; แก้เฉพาะแถวที่เกี่ยวข้องเมื่อรับงานจริง ไม่ใช้ตัวเลขรวมใน brief เป็น roster gate

## 7. Producer–integration handoff และการทำงานพร้อมกัน

### 7.1 แบ่ง ownership ก่อนเริ่ม

| Owner | รับผิดชอบ | Boundary ที่ต้องรักษา |
| --- | --- | --- |
| Producer ที่กำลังทำ VFX | Prompt, raw output, component art, measured asset metadata และข้อจำกัดของภาพ | ยืนยัน canonical IDs/versions ที่ตนถืออยู่; ไม่แก้ shared registry ระหว่าง integration owner กำลังแก้ |
| Part 1 core owner | Action/impact identity, clock, sampled sockets, geometry, lifecycle และ gameplay AI | ส่ง presentation inputs ที่พิสูจน์แล้ว; ไม่แปลง texture frames ให้เป็น gameplay hits |
| VFX integration owner | Reader/recipe, component assembly, layering, fallback, promotion และ runtime QC | เป็นผู้เขียน shared activation point ในรอบที่ตกลง; ไม่เขียนทับ producer output |
| Reviewer | เปรียบเทียบ source measurements, complete playback และสนามจริงกับ brief | แยก metadata pass, visual pass และ integration pass; ไม่รับงานจากภาพนิ่งอย่างเดียว |

หนึ่งไฟล์ที่มี writer ร่วม เช่น `batch-manifest.json`, `arena-authored-vfx.ts` หรือ production roster ต้องมีผู้ถือสิทธิ์แก้ในรอบนั้นชัดเจน. Agent อื่นส่ง patch/handoff ให้เจ้าของรวม; จำนวน agent ไม่ใช่เหตุผลให้แก้ manifest พร้อมกัน

### 7.2 ข้อมูลส่งมอบต่อ canonical skill/component version

- Producer name/task, canonical skill ID, component keys, source version และ source files ที่ต้อง preserve
- Prompt/raw path, reference images ที่ใช้, generation method และ original image dimensions
- Atlas layout/frame order, frame durations หรือ frame markers, source rectangles และ empty/exit frames ที่ตั้งใจมี
- Anchor/pivot, authored forward axis, coordinate space, feet/ground contact และ allowed orientation/mirroring
- Intended visual size เป็นเมตรหรือสัดส่วน committed footprint พร้อม projected ground ruler: standard footprint diameter 0.5m/radius 0.25m; resolved override อ้าง canonical data ไม่วัดจาก silhouette/อาวุธ
- Component ที่ต้องแยก flight/impact/field, ข้อจำกัดการ loop และ seams/occlusion ที่ producer ทราบ
- QA ที่ตรวจแล้วพร้อมผลจริง; รายการที่ยัง UNVERIFIED; ห้ามเปลี่ยนคำว่า generated ให้กลายเป็น integrated โดยปริยาย
- Producer ชี้ version ที่พร้อมรับงาน จากนั้น integration อ้าง version นั้นคงที่; เมื่อ producer ส่ง revision ใหม่ให้รับเป็น handoff ใหม่

ห้ามเริ่มสร้างสกิลที่ agent อื่นถืออยู่เพียงเพราะยังไม่เห็นไฟล์สุดท้าย. ตรวจ owner/handoff ก่อน; ระหว่างรอทำ inventory, brief, recipe design หรือ integration กับ asset ปัจจุบันได้

## 8. Per-skill brief และ first-party generation prompt

### 8.1 Brief ที่ต้องมีครบก่อนขอ component ใหม่

อ่าน canonical row, execution profile ที่ current runtime ใช้จริง และ section 6 ของแถวเดียวกัน. ระบุ cast reach, geometry dimensions, origin, commitment point, real launch/contact schedule, status/field lifetime และ interruption policy โดยอ้าง owner ไม่คัด tuned numbers มาสร้าง truth อีกชุด

วาดลำดับ W/R/I/E แบบข้อความหรือ storyboard: สิ่งที่อยู่ที่มือ, ทางเดิน, จุดตก, พื้นที่, actual contact และสิ่งที่เหลือหลัง damage. ระบุว่าแต่ละชิ้น bind กับ action, projectile, impact, field หรือ status ใด และชิ้นใด cosmetic ล้วน

กำหนด silhouette/motion ที่แยกจากสกิลธาตุเดียวกัน, projected footprint, component sizes, ground/upright spaces, negative space, quality reduction และ reject examples. เปรียบเทียบกับ asset ปัจจุบันก่อนตัดสินว่าต้อง regenerate หรือแก้ assembly ก็พอ

### 8.2 Prompt template สำหรับ built-in image generator

Template ต่อไปนี้เป็นสเปกให้ producer ที่ถือ skill/component นั้นเติม; ไม่ใช่คำสั่งเริ่ม generation จากการอ่านแผน. ใช้ built-in image generator เท่านั้น และ attach current actor/style references ที่ได้ตรวจภาพแล้ว

```text
PROJECT: ModWorld first-party combat VFX.
CANONICAL SKILL ID: <id>. COMPONENT KEY / VERSION: <key/version>.
ROLE: <charge / release / flight / trail / fall / impact / field / exit>.
VISUAL VERB AND IDENTITY: <one clear action, silhouette and material>.
ACTOR REFERENCES: <current player/mob images supplied with this request>.
STYLE: chibi dark-fantasy actors, crisp readable pixel clusters, strong silhouette,
controlled luminous core, matching current game pixel density and palette.
SCALE RULER: standard ground footprint diameter 0.5m, radius 0.25m, scale 1.
Use its projected ground ellipse as the ruler; world coordinates are continuous meters.
Player and mobs use scale 1 unless canonical data explicitly authors an override.
Actor silhouette, head and weapon proportions stay independent of this footprint.
GAMEPLAY FOOTPRINT: <canonical shape and actual meter dimensions for context>.
COMPONENT VISUAL SIZE: <intended meter size or footprint proportion>.
SPACE / CAMERA: <projected ground patch OR upright/falling/flight component>.
PIVOT: <invariant point and normalized position>. FORWARD AXIS: <direction>.
SEQUENCE: <explicit frame count/order, opening/active/exit, or loop semantics>.
MOTION: <phase progression, silhouette evolution, continuity, invariant anchor>.
ASSEMBLY: generate ONLY this separable component; runtime supplies <other roles>.
CANVAS: true transparent background; explicit empty gutters between cells;
keep core, glow, trail, debris and faint visible wisps inside each source cell.
PADDING: reserve clear space on all sides throughout every frame, including peak.
NO: text, labels, UI, grid lines, checkerboard, scenery, actor body or baked shadow
unless that shadow is the explicitly requested separable ground component.
READABILITY: visible negative space; no full opaque disk or uncontrolled white fog.
LOOP/EXIT: <seamless phase relation or final transparent fade; no abrupt reset>.
REJECT: <skill-specific wrong shape, direction, clipped edge, identity conflicts>.
```

Frame count/layout เป็น producer decision ตาม motion brief และ reader ที่ตกลง ไม่บังคับภาพใหม่ทุกชิ้นเป็น 16 frames. ระหว่าง reader ยังรองรับเฉพาะ layout เดิมต้องส่งใน layout ที่รองรับ หรือรอ reader adaptation ก่อน promotion

### 8.3 ตัวอย่าง brief แยกองค์ประกอบ Meteor

- `meteor-fall`: หินถ่านเรืองร้อนหนึ่งก้อนที่ไม่มี crater/สนาม/actor; upright falling object, pivot ที่ leading contact tip, trajectory เป็นหน้าที่ runtime. ให้ texture มี motion ภายในและ hot-core variation โดยไม่วาดตำแหน่ง landing หลายจุดติดกันในเฟรมเดียว
- `meteor-trail`: เปลว/ควันตามหลังที่แยกจากหิน สามารถลดความยาว/opacity ตาม distance และ quality ได้; ไม่ bake world path หรือ footprint ทั้งวงไว้ใน atlas
- `meteor-impact`: local hot burst ที่ ground pivot เดิม ตามด้วย radial rock fragments/embers; ground crack แยกจาก upright blast เมื่อต้อง project คนละแบบ
- Assembly ใช้ sites ครอบ area ตาม section 4.4 และ main beat ตรง actual impact. Multiple decorative rocks ไม่สร้าง multiple damage events; producer ต้องรู้ one-press contract ก่อนวาดจังหวะให้เหมือน bombardment ที่ทำ damage ต่อเนื่อง

### 8.4 ตัวอย่าง brief แยกองค์ประกอบ Blizzard

- `blizzard-snow`: sparse snow streak/mote loop ไม่มีพื้นขาวทึบ; runtime วางทิศลมและ depth หลายชั้น
- `blizzard-ice-fall`: shard เดี่ยวหรือชุดเล็กที่แยกตำแหน่งได้ พร้อม clear forward/down axis; ไม่มี successful-hit flash baked ไว้ทุกเฟรมของการตก
- `blizzard-ground-contact`: local ice chips/frost accent ที่ pivot บนพื้น; actual pulse cues เลือกจาก resolved schedule ส่วน cosmetic landings ใช้ accent ที่เบากว่า
- `blizzard-field`: low contrast frost/wind texture ที่อ่าน extent และปล่อยให้เห็นเท้า/target; projected field ทำหน้าที่เชื่อมพื้นที่ระหว่าง falling sites
- Assembly ผูก field lifecycle กับ deployed instance; sparse particles ยังบอก center/outer sectors ได้ใน reduced motion. Target ว่างหรือเดินออกไม่ทำให้ทั้ง field หาย

## 9. Asset framing, metadata และ QA contract

### 9.1 Geometry ของ source กับ geometry ของเกม

วัด image dimensions และ source rectangles จากไฟล์จริง. Source crop, shared virtual canvas, anchor และ gameplay footprint เป็นคนละข้อมูล. ใช้ virtual offsets เพื่อให้ pivot นิ่งข้ามเฟรม; ไม่ recenter แต่ละ frame ตาม alpha centroid จน projectile/impact สั่น

Transparent gutter ต้องแยก source cells จริง. Virtual padding ให้ drawing room รอบ source ที่สมบูรณ์อยู่แล้ว; ไม่สามารถกู้ปลายหิน อาวุธ trail หรือ glow ที่ตัดหาย/รวมกับเฟรมข้างเคียงได้. กรณีหลังต้อง regenerate component หรือแยกจาก source ที่ยังมีครบ

ห้ามขยาย crop ข้าม cell เพื่อซ่อน defect. ตรวจทุกเฟรมที่ peak expansion, rotation และ exit; frame สุดท้ายที่ตั้งใจว่างต้องประกาศใน metadata แทนการตัดทิ้งโดยเดา

### 9.2 Logical metadata ที่เสนอ — ยังไม่ใช่ runtime schema ที่ implement แล้ว

| ชั้นข้อมูล | Required meaning | กติกา |
| --- | --- | --- |
| Asset identity | canonical skill/component, immutable version, source path | New revision ไม่ overwrite เวอร์ชันที่ integration กำลังรับ |
| Source geometry | real image width/height, explicit frame rects/layout | Rects อยู่ในภาพและไม่รวม art ของเฟรมอื่น |
| Playback | frame order, nominal durations, named phase markers, loop/exit | Named phases ไม่สร้าง combat timestamps ใหม่ |
| Attachment | invariant pivot, forward axis, ground/billboard space | แยก flight pivot กับ impact ground contact เมื่อจำเป็น |
| Render geometry | virtual canvas/offsets, visible bounds, alpha policy | Bounds ใช้จัด drawing ไม่ใช่คำนวณ damage radius |
| Composition | component references, event binding, scale/coverage/layer policy | อ่าน geometry และ impact schedule จาก core contract |
| QA/provenance | raw/prompt references, measured QA, reviewer, known limits | Generated/geometry-pass/integrated-pass เป็นคนละสถานะ |

รูป field จริง, file location และ reader adaptation ต้องตกลงใน V1 กับ owner ปัจจุบัน. ไม่ให้ agent copy ตารางนี้ไปสร้าง parallel manifest โดยไม่ตรวจ reader/writer/validator ที่มีอยู่

### 9.3 Alpha และ padding acceptance

- รักษา original PNG และรายงาน raw alpha แยกจาก rendered alpha ที่ discard ≤8/255 ตาม renderer ปัจจุบัน
- Current checker ใช้ 64 px virtual padding และตรวจ rendered margin อย่างน้อย 8% ของด้านที่สั้นกว่า; นี่เป็นพฤติกรรม checker ปัจจุบัน ไม่ใช่คำสั่งให้ raw art ที่ถูกตัดผ่านได้
- ตรวจ source separators/perimeter ที่ threshold เดียวกับ renderer พร้อมรายงาน faint raw residue; ห้ามเขียนว่า raw clean ถ้าผ่านเฉพาะหลัง threshold
- ถ้า texture ใหม่พึ่ง low-alpha รายละเอียดที่ renderer จะทิ้ง ต้องปรับ texture หรือประกาศ alpha policy ที่ reader รองรับและตรวจแล้ว; ห้ามลด threshold เพื่อหลบ visible seam โดยไม่มี evidence
- ตรวจบนพื้นสว่าง/มืดและ checkerboard เฉพาะใน QA: ไม่มีขอบสี่เหลี่ยม opaque, black fringe, alpha halo, neighboring-frame bleed หรือ clipped filter bounds
- Checker ต้อง reject dimensions/rects/anchors ที่ไม่ตรงการวัด, invalid frame refs, empty required phase, source perimeter overflow และ unsupported layout; แยก deliberate transparent exit จาก atlas ที่ว่างผิดพลาด

### 9.4 Motion acceptance ของ component

ดู complete loop/one-shot ที่ normal speed และ pause peak/contact/exit. Reject pivot drift, scale pumping ที่ไม่อยู่ใน brief, shape สลับชนิด, trail ย้อนทาง, first-to-last jump, frame duplication ที่ทำให้ contact สะดุด และ glow โตจนกลบ negative space

มีภาพ moving particle จำนวนมากไม่ได้แปลว่า animation smooth. Translation/rotation/phase sampling ต้องต่อเนื่องตามเวลา; texture frame changes ยังรักษา silhouette และ material เดิม. เพิ่ม frames เมื่อมี motion gap ที่พิสูจน์แล้ว ไม่เพิ่มจำนวนตาม quota

## 10. Promotion, fallback และ compatibility

1. Producer ส่ง frozen candidate version พร้อม brief/raw/measurements; integration ตรวจ input completeness และอ่านไฟล์โดยไม่เปลี่ยน selected registry
2. Normalization ทำเฉพาะ metadata ที่ตกลง ownership แล้ว; เก็บ original source pixels. ถ้าต้องแก้ art กลับไป producer พร้อม frame/component ที่ fail
3. Stage candidate ใน versioned runtime path ที่ตกลงกับ current production contract; คง working version ไว้จน candidate ผ่าน integrated acceptance
4. Integration ต่อ recipe/reader ที่รองรับ candidate และตรวจ same-host playback กับ actual actors/geometry/events. Lab ใช้ช่วย inspect; lab pass ไม่เท่ากับ arena pass
5. Promote ผ่าน activation point เดิมโดย owner คนเดียว; ตรวจทุก reference ของ component version และไม่มี authored+legacy double contact
6. ส่ง selected version, exact checks/results และ known limits กลับ producer; จึงอัปเดต production progress ตาม ownership ที่ตกลง

Fallback เป็น working authored version ปัจจุบัน หรือ legacy effect เฉพาะที่ยังจำเป็น. Missing/invalid candidate ไม่ควร suppress fallback เพราะมี recipe key เปล่า. สกิลที่ยังไม่ถึงคิวยังคงเล่นได้ และลบ fallback ต่อเมื่อพิสูจน์ว่าไม่มี consumer ต้องใช้แล้ว

ไม่เปลี่ยน save identity ของ skill เพื่อเปลี่ยน art version; cosmetic seed ไม่ใช้ gameplay RNG. Asset URL/version changes ต้องโหลดได้ทั้ง dev และ production bundle โดยไม่มี runtime import จาก `art-reference/` หรือ `docs/plans/`

## 11. Execution packets และ dependencies

ตารางนี้เป็นแผนแบ่งงานล่วงหน้า. **V0 เท่านั้นที่ READY ตอนเขียน**; V1–V5 เป็น DEPENDENT จน predecessor และหลักฐานที่ระบุครบ. Production ที่กำลังทำอยู่เดินต่อภายใต้ owner เดิมได้; ไม่ต้องรออนุมัติซ้ำรายสกิลจากแผนนี้

| Packet | งานและขอบเขต | Dependency ก่อนเริ่ม implementation | หลักฐานจบ packet |
| --- | --- | --- | --- |
| V0 — Current asset/owner evidence | Read-only inventory live skill → selected asset/version → producer owner → missing brief/QA/consumer; ตรวจ current paths/checker capability | แผนนี้และ local files; เริ่มได้ทันที | Inventory ที่ reconcile กับ current canonical rows, ownership map, conflicts/unknowns ระบุชัด |
| V1 — Freeze handoff contract | ตกลง component/pivot/phase metadata, presentation binding, alpha/layout support และ writer ของ shared files; ไม่เขียน gameplay timing ใหม่ | V0 + Part 1 CP1 contract ที่ตรวจ current action/timing/receipt owners ใน section 2 แล้ว | Producer/integration รับ contract version เดียวกัน, migration/fallback strategy ชัด และไม่มี reader คู่ขนาน |
| V2 — Component QC and reader support | ผู้ผลิตส่งหรือแก้ candidate ตาม owner เดิม; integration ทำ compatible reader/checker adaptation สำหรับ layout ที่รับจริง | V1 + frozen candidate ของ component ที่ทำ; งาน raw concept ที่ไม่กระทบ shared files ทำขนานได้ | Measured metadata, deterministic frame/pivot playback, negative cases ของ geometry/alpha/layout และ original pixels preserved |
| V3 — Representative assemblies | ประกอบ melee, projectile/burst, distributed storm และ moving channel ใน renderer/host เดิม | V2 candidates + Part 1 CP2 sockets/animation และ CP4 range/projection; current real impacts/fields จาก runtime ผ่าน CP1 contract check สำหรับประเภทนั้น | Impale/Cleave, Fireball/Ice Lance, Meteor/Blizzard และ Whirlwind ผ่าน relevant integrated cases; ใช้ fallback ระหว่างรอชนิดอื่น |
| V4 — Whole live roster integration | รับแต่ละ candidate ตาม section 6; เติม support/curse/heal/aura; ตรวจ actual outcomes/recipient/charge cues | V3 patterns accepted + แต่ละ candidate ผ่าน V2; Part 1 CP6-Joint owner ประสาน shared scene/registry | Current live roster ไม่มี missing/repeated activation, brief/outcome/fallback ตรงกัน และไม่มี requirement ให้ regenerate แถวที่ผ่านอยู่แล้ว |
| V5 — Integrated acceptance and promotion | Complete animation review, overlap/reduced motion/performance/production-path checks และ promote version ที่ผ่าน | V4 + Part 1 CP5 actors/AI cases และ CP6-Core host/fixtures พร้อม; ตรวจ candidate ร่วม CP6-Joint | Acceptance matrix ผ่าน, commands/results จริง, selected versions และ unresolved limits ส่งมอบครบ |

V2 แบ่งคนตาม component/skill IDs ที่ไม่ทับกันได้. V3 แบ่งตาม composition family ได้เมื่อ shared renderer writer ชัด. V4 ฝั่ง art ทำหลายตัวขนานได้ แต่ activation/manifest รวมผ่าน owner เดียว

**Shared acceptance boundary:** CP6-Core จบได้ด้วย approved art/fallback ปัจจุบันโดยไม่รอ generation stream ใหม่. V3/V4 ส่ง candidate และ assembly ที่พร้อมเป็นราย skill/family ให้ CP6-Joint; V5 กับ CP6-Joint ตรวจ new-art acceptance ร่วมกัน. การมี host/contracts/fixtures สำหรับตรวจไม่แปลว่า new-art acceptance ต้อง complete ก่อน V5; ไม่มี circular completion gate และไม่มี dependency กับ milestone labels ของแผน combat ที่ทำเสร็จและลบแล้ว

หาก packet พบ current contract เปลี่ยน, source version ถูกเขียนระหว่างรับ, gameplay profile ขัด prose, source missing, unsupported layout หรือ consumer ต้องใช้ save change ที่ยังไม่ตกลง ให้หยุดเฉพาะ dependent mutation แล้วส่ง path/symbol/conflict พร้อมทางเลือกกลับ owner. งานอ่าน/วัด/brief ที่ไม่พึ่งข้อขัดแย้งทำต่อได้

## 12. Future verification — commands ที่มีจริงกับงานที่ยังต้องสร้าง

### 12.1 คำสั่งที่ยืนยันจาก repository

```powershell
# อ่าน/validate metadata สำหรับ ID และ batch-v1 layout ที่ checker ปัจจุบันรองรับ
python tools/check-authored-vfx.py attack.fireball attack.frostbite
# Normalize metadata เฉพาะเมื่อ integration owner ได้ ownership ของไฟล์เหล่านี้แล้ว
python tools/check-authored-vfx.py --write attack.fireball attack.frostbite
# ตรวจผล normalized อีกครั้งแบบไม่เขียน
python tools/check-authored-vfx.py attack.fireball attack.frostbite
# สำหรับ reader/renderer implementation ในอนาคต ตาม affected layers
npm run typecheck
npm --prefix game run check
npm --prefix game run build
```

คำสั่งข้างต้นเป็นตัวอย่างการตรวจใน packet implementation ยังไม่ได้รันในงานเขียนแผนนี้. Default checker ตรวจ 23 IDs เท่านั้น และยังผูก `batch-v1/atlas.png`; การส่ง ID นอก default ไม่ทำให้รองรับ arbitrary component path/layout เอง

**งานที่เสนอ:** ขยาย checker ให้อ่าน selected manifest/candidate metadata, explicit layouts และ component refs พร้อม whole-roster coverage report. ยังไม่มี CLI flags สำหรับสิ่งนี้ที่ยืนยันแล้ว; ห้ามใส่ `--all`, `--manifest` หรือคำสั่งสมมติลง run record ก่อน implementation owner เพิ่มและตรวจ parser จริง

Focused automated verification สำหรับ phase selection, source bounds, projection, deterministic distribution, event dedupe และ fallback ให้ใช้ test/gate ที่มีอยู่หลังตรวจ actual entry point; หากต้องเพิ่มเป็นงาน implementation ให้ระบุใน packet นั้นตามคำสั่งผู้ใช้และ workflow. งานเอกสารนี้ไม่เพิ่มหรือรัน tests

### 12.2 Host ที่ใช้ตรวจภาพ

- Integrated arena: `http://localhost:5173/__showcase?sample=arpg-arena` โดยใช้ selector/controls ปัจจุบันหลังตรวจ wiring
- Skill FX Lab: `http://localhost:5173/__showcase?sample=skill-fx`; source คือ [SkillFxLab.svelte](../../game/src/ui/dev/SkillFxLab.svelte) และ [SkillFxPreview.svelte](../../game/src/ui/combat/SkillFxPreview.svelte)
- ใช้ existing server port 5173 และหนึ่ง visible browser tab ที่ 1920×1080 ตาม AGENTS; ปิด task tab หลังตรวจ. ถ้า browser ใช้ไม่ได้ให้รายงาน visual verification ที่ยังไม่ผ่าน ห้ามใช้ screenshot/Lab แทน integrated acceptance โดยไม่บอก
- ตรวจ standard/resolved ground footprint ruler, feet/socket และอ่าน geometry overlay จาก Part 1. Preview ที่ clamp radius หรือใช้ simplified composition ต้องไม่ถูกใช้ตัดสิน meter scale ของ arena

## 13. Integrated acceptance matrix, reduced motion และ performance

| Scenario | สิ่งที่ต้องเห็นและตรวจ | วิธีพิสูจน์ |
| --- | --- | --- |
| Single projectile ใกล้/ไกล | ออกจาก socket จริง, speed/time ตรง action, impact ที่ contact, ไม่ตามเป้าใหม่เอง | Pause release/contact; เปรียบเทียบ path/action identity กับ event |
| Early interception/miss/pierce | เปลี่ยน terminal point ตาม resolved contact; miss ไม่ฉาย successful-hit cue; piercing ไม่เล่น flight ซ้ำ | Playback พร้อม contact overlay และ event count |
| Burst/chain | แต่ละ actual launch/hop มี instance/time ของตัวเอง; generic on-hit cue ไม่คูณตาม cosmetic count | Step launch/contact และจับคู่ identities/receipts |
| Ground cast บน empty ground | คง committed circle/line/cone แม้ successful targets เป็นศูนย์ | เล็งพื้นว่างและตรวจ full animation; gameplay receipts ไม่เพิ่ม |
| Radius/line/cone หลายทิศ | Full extent/perspective ตรง geometry; radius ไม่กลายเป็น diameter; line width ไม่บวมตาม sprite | World geometry overlay + projected footprint ruler + rotation cases |
| Meteor/Firestorm | เห็น composition ครอบ center/middle/outer sectors และ peak ตรง one press | Normal-speed playback และ pause ก่อน/ขณะ/หลัง impact; ไม่มี extra damage feedback |
| Blizzard/field entry/exit | Field fixed, falling sites ครอบพื้นที่, real pulses ตรงเวลา; empty field ยังแสดงจน expiry/replacement | เคลื่อน actor เข้า/ออก; เทียบ field ID/expiry/pulse events |
| Whirlwind move/cancel | ตาม sampled feet, near/far arcs อ่านตัวได้, pulse/cancel ตรง engine | เดินเปลี่ยนทิศและ interrupt ระหว่าง channel |
| Buff/curse/heal/trigger | ผู้รับ/charge/status/accepted trigger ตรง state; strike lifetime แยกจาก status | ตรวจ success/zero-effect/expiry/refresh ตาม outcome จริง |
| Dense overlapping combat | Player/targets/enemy preparation ยังอ่านออก; ไม่ double authored+legacy | Real mixed mob group + several fields/auras ที่ host รองรับ |
| Pause/seek/speed/background | Resume เป็น state ณเวลาปัจจุบัน ไม่ burst replay decorative history | Pause/seek ผ่าน host controls และ background/return |
| Save/return/arena transition | ไม่มี replay hit/kill cue เก่า; deployed work ที่ core เก็บไว้กลับมาอายุถูก | ใช้ current persistence/transition contract และ cases ที่ Part 1 CP0/CP1 ตรวจไว้ |
| Asset missing/candidate invalid | Working effect ยังอยู่และ error ระบุ version/path; ไม่มี invisible cast | Focused negative check โดย owner และคืน fixture หลังจบ |
| Reduced motion | เห็น range/committed footprint/contact/expiry โดยลด spin, travel decoration และ flash | System preference เปิด/ปิด พร้อมเทียบ same action geometry |

Reduced motion ไม่ปิด area field ทั้งหมด. ใช้ representative frame, quiet projected bed, sparse landing/contact markers และ restrained opacity; ไม่สื่อ real hit เพิ่มจากการคง frozen impact frame เต็ม lifetime

เริ่ม render budget จากการวัด host ที่ 1920×1080 ระบุ browser/device/scenario. เก็บ frame-time distribution/long frames, active component counts, asset decode stalls และ retained resources หลังจบ field/เปลี่ยนพื้นที่; ไม่ประกาศ FPS ผ่านโดยไม่มีเครื่องและสถานการณ์อ้างอิง

เมื่อมีภาระมากให้ลด secondary sparks → smoke/debris → duplicate trails → decorative aura ornaments ก่อน essential danger boundaries, actor silhouette และ real contact. Quality tier/offscreen culling ไม่เปลี่ยน clocks, targets, gameplay RNG หรือ hit receipts; กลับเข้าจอคำนวณ phase จาก absolute time โดยไม่ปล่อย backlog particles

Reuse decoded textures และ static definitions เมื่อเหมาะสม; หลีกเลี่ยง heavy filter/gradient ต่อ decorative particle โดยไม่มีเหตุผล. เริ่มจาก renderer ปัจจุบันก่อน; renderer migration ต้องมี profiling evidence และแยก scope/dependency ชัด ไม่ทำเป็นเงื่อนไขเพื่อให้สกิลแรกใช้งานได้

## 14. Readiness และ definition of done

**Overall: MIXED / DEPENDENT. V0 read-only inventory READY.** ข้อมูล source ที่สำรวจพอให้เริ่มตรวจ ownership/coverage ได้ แต่ยังไม่ยืนยัน handoff เวอร์ชันปัจจุบัน, multi-component reader, socket contract หรือ integrated playback ของ candidate ใหม่. V1–V5 ไม่ถูกประกาศ READY เพียงเพราะมีรายละเอียดในแผน

เงื่อนไขเปลี่ยน packet เป็น READY: ตรวจ current source แล้วไม่ขัด owner, predecessor acceptance มีหลักฐาน, shared files มี writer ชัด, candidate frozen และ acceptance cases ของ packet รันได้. Design choices ในเอกสารนี้ไม่สร้าง per-skill approval gate เพิ่มจากคำสั่งผู้ใช้

งาน Part 2 จบเมื่อ current live skill inventory มี selected working composition ที่ผ่านสเปกของแถวนั้น, replacement ทุกตัวใน scope ที่ผู้ใช้สั่งผ่าน asset+motion+arena acceptance, integrated commands ผ่านจริง และ production handoff ระบุ version/ผลตรวจครบ. เก็บ composition เดิมที่ผ่านสเปกได้โดยไม่ regenerate; fallback สำหรับ replacement ที่ยังรอ producer เป็นสถานะ pending ไม่ใช่ completed. สกิลนอก replacement scope ใช้ documented retained fallback ได้; ห้ามสรุปว่าผ่านทุกสกิลจากจำนวน manifest entries

ส่งมอบให้ Part 1 CP6-Joint ด้วยรายการ changed files/selected versions, exact commands/results, browser scenario/viewport, checks ที่ยังไม่ได้ทำ และ known limits. CP6-Core ของ Part 1 ใช้ผล core ของตนแยกจาก pending candidate ได้. แผนนี้ไม่อนุญาตให้ commit/push หรือเปลี่ยน gameplay behavior เพื่อทำให้ artwork ดูเหมือนถูกต้อง

