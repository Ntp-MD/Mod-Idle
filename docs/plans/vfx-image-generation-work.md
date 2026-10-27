# ModWorld — 2.5D 3/4 pixel art และ VFX production plan

วันที่: 2026-10-27  
สถานะ: ทิศทางภาพ 2.5D pixel ล็อกแล้ว; งานทั้งหมดเป็น sprite/atlas 2D ที่ใช้ arena projection เดิม

**แผนนี้เป็นงาน 2.5D pixel art**: ตัวละคร อุปกรณ์ mob และ VFX เป็นภาพ pixel ที่วาด/เจนเป็น sprite และ atlas 2D แล้วประกอบบน ground plane ด้วย projection เดิมของ arena. ไม่มี geometry, rig, mesh หรือ renderer ใหม่ใน runtime; ภาพ concept และ sprite sheet เป็น deliverable ของงานนี้. ห้ามเริ่มผลิตทั้ง roster ก่อน proof ผ่าน.

**เมื่อ replacement ผ่าน QA และใช้งานร่วมกับ runtime ได้ ให้ integrator เปิดใช้เป็น default ของส่วนนั้นทันที ไม่ต้องรอทั้ง roster หรือขออนุมัติรายชิ้นซ้ำ**. ระบบเดิมที่ยังไม่ถูกแทนยังทำงานต่อ; ห้ามลบหรือทำให้ fallback เสีย.

## 1. Visual direction และ proof

### ภาพและสไตล์ที่ผู้ใช้เลือก

[ภาพนักธนูที่อนุมัติเป็น style reference](../../art-reference/players/pixel-archer-direction-concept-2026-10-27.png) ล็อกงาน pixel art รายละเอียดระดับภาพนี้: เส้นผม ผ้า หนัง อุปกรณ์ และ shading ที่มีมิติ; สัดส่วน chibi เล็กน้อย ใบหน้าแสดงอารมณ์และ silhouette ชัด ไม่บังคับลดรายละเอียดให้ pixel หยาบขึ้น ตรวจความอ่านออกที่ขนาดเล่นจริง

[Minotaur ที่มีอยู่](../../art-reference/monsters/humanoid/minotaur/animation/source/base.png) เป็น reference ของ mob รูปร่างกะทัดรัด แข็งแรง ใบหน้าและอาวุธอ่านชัด รักษาสัดส่วน บุคลิก และความน่าเกรงขามเฉพาะของ mob แต่ละชนิด ให้ player และ mob อยู่ในโลกภาพเดียวกัน ไม่ทำทุกตัวเป็นของเล่นหน้าตาเหมือนกัน หลีกเลี่ยงตัวละครกล่อง voxel, ภาพมันวาว และภาพเบลอแทน pixel

ภาพนักธนูเป็น first-party concept สำหรับสไตล์; ชุดและสีเป็นตัวอย่าง ไม่ใช่เครื่องแบบของทุกตัวละคร

### โลก กล้อง และ gameplay

โลกเป็น 2.5D: ground plane หน่วยเมตร + sprite ที่มีความสูงเป็นภาพ; กล้อง 3/4 คงที่ตาม player ไม่ตาม target. ใช้ projection ของแต่ละ domain ตามของเดิม — arena ใช้ matrix จาก `ARENA_*` ใน `game/src/presentation/arena-camera.ts` และ map ใช้ `createMapProjection` (elevation 38°, yaw −16°) ใน `game/src/ui/map/map-projection.ts`; ห้ามสร้างกล้องใหม่หรือเปลี่ยน projection เพื่อให้ภาพง่ายขึ้น

Actor ใช้ 8 world directions ตาม `ARENA_DIRECTIONS`; baked sprite มี anchor/effect-socket/visible bounds ชัด (socket สำหรับ effect release/contact เท่านั้น ไม่ใช่จุดแปะอาวุธ); body footprint 0.5 m diameter; field 50 m. Gameplay timing, committed geometry และ actual receipts ยังเป็น authority; ภาพไม่เพิ่ม hit, timer, proc, reward หรือ RNG.

### ลำดับงานภาพที่ล็อก

1. **Character:** ผลิต sprite/animation ของตัวละครผู้เล่นทั้งหมดแบบ weapon-baked (body + weapon/offhand อยู่ใน pixels เดียวกันทุกเฟรม ไม่มี separate weapon atlas/layer animate) เริ่มจาก archer เป็นตัวแทน pipeline; ทุก class ใช้ pose matrix เดียวกันที่ proof ล็อก; version ที่ผ่าน QA เปิด default ทันที
2. **Mob:** ผลิต sprite/animation ของ mob ทั้ง roster แบบ weapon-baked เช่นกัน (อาวุธผูกติดกับ mob มาตั้งแต่ source pixels) เริ่มจาก minotaur เป็นตัวแทน; ทุก species/variant ใช้ pose matrix เดียวกับ player ต่างกันแค่ silhouette/บุคลิก/ขนาด; รักษาความน่าเกรงขามเฉพาะของแต่ละ species
3. **Skill VFX:** ผลิต/ปรับ authored pixel VFX ครบตาม live roster และ basic/mob paths โดยอิง `game/public/fx/skill-pool/vfx-production.md`; ใช้ canonical action/area/timing
4. **Map / terrain / environment:** ทำเป็นลำดับสุดท้าย คงของปัจจุบันไว้ระหว่างทาง; ใช้ terrain slice จริง 1–2 hex ใน proof เพื่อ calibrate scale

Phase 1 ปล่อยเป็น slice: proof → 1 actor + 1 mob → ต่อ class/family; ห้ามเริ่ม batch ถัดไปก่อน slice ก่อนหน้าผ่าน checklist/capture/budget.

### Proof ก่อนยกเครื่องทั้งเกม

1. ทำ archer พร้อม bow แบบ baked (bow อยู่ในมือทุกเฟรมตั้งแต่ draw → release), mob ตัวแทนแบบ weapon-baked, และ terrain slice จริง 1–2 hex พร้อมความสูง 0–2 ระดับ ในสไตล์ที่เลือก ให้เห็น idle → draw → release → flight → contact
2. ใช้ `attack.piercing_shot`: ลูกศรหนึ่งดอกตามแนวที่ commit ความยาว 5.2 m และ full width 0.75 m ตาม `tools/data/skills.json`; contact เฉพาะ recipient จริง ไม่ใช้ beam เต็มเส้นหรือลูกศรหลายดอกแทน hit เพิ่ม
3. Proof set ต้องมี: Piercing Shot, Cleave (sector 120°), persistent field 1 ตัว, aura 1 ตัว, channel/mobile effect 1 ตัว และ overlap scene ที่มี 2–3 effect พร้อม mob หลายตัว; ทดสอบที่ 8 world directions และมุมกลางระหว่าง bin
4. ตรวจใน browser ที่ 1920 × 1080 ด้วย arena camera matrix: alignment, height/depth, footprint, readability, reduced motion และ pixel stability (ไม่มี shimmer/crawl เกิน 1 native pixel)
5. วัดและบันทึก frame time p50/p95, heap, และ native resolution/upscale; production gate คือ 60 Hz floor (p95 16.8 ms, owner-accepted 2026-10-27) และห้ามใช้ dev showcase ที่มี debug overhead เป็นหลักฐาน
6. **ล็อก native resolution และ upscale factor** ใน decision record หลัง proof; เปลี่ยนค่าหลังล็อก = re-run proof
7. ถ้า proof ไม่ผ่าน budget ใช้ degraded tiers: ลด decorative density/quality → ลด directions ของ ambient/decor → ลด component ที่ไม่ใช่ cue หลัก → คง fallback เดิมของส่วนนั้น; ห้ามลดพื้นที่ cue หลักหรือเปลี่ยน gameplay shape

## 2. ขอบเขตและ ownership

- Canonical gameplay, skill identity และ save identity คงเดิม; presentation ไม่สร้าง damage, hits, timers หรือ RNG. งาน engine/runtime ใช้ [engine implementation plan](engine-implementation-work.md) เป็น contract
- **Image/2D asset generation เป็นของ art owner:** agent ไม่เจนภาพหรือแก้ asset; agent ตรวจ validator/tests/integration และหยุด/report ถ้า asset ขาด
- Art owner ส่ง source/candidate, provenance, native scale, anchor/effect-socket, animation metadata, budgets และวิธี reproduce; integrator ผูก runtime และเลือก candidate ที่ผ่าน
- ใช้ first-party art; ไม่เพิ่ม third-party asset packs หรือ external generation services. งานภาพทุกชิ้นต้องมี provenance และ version
- Runtime renderer, camera และ projection เดิมเป็น authority; งานนี้ไม่เพิ่ม renderer/dependency ใหม่

### Versioned asset pool

- จัดงานแยกตาม subject/component และเก็บ candidate ใน `v1/`, `v2/`; player baked sets, mob baked sets, skill และ map มี identity/version ของตัวเอง
- Source/candidate อยู่ใต้ `art-reference/` ตาม subject; runtime อยู่ใต้ `game/src/ui/combat/arena/` สำหรับ actor art และ `game/public/fx/skill-pool/<skill-slug>/vN/` สำหรับ skill VFX; ห้ามใช้ path เดิมทับ version ที่ส่งแล้ว
- ใช้ lowercase hyphens; skill ใช้ slug เดิม เช่น `attack-piercing-shot`; 2D atlas metadata/QA ใช้ `game/public/fx/skill-pool/vfx-production.md` และ `tools/check-authored-vfx.py`
- Candidate ใหม่สร้าง version ใหม่; ระบุสถานะ `draft | candidate | accepted | selected | retired`; แยก review จาก default selection
- Integrator เปิด selected version เป็น default ราย slice; เก็บ version เดิมเป็น fallback; art version ไม่เปลี่ยน skill/save identity

## 3. Asset brief ก่อนผลิตแต่ละ component

ระบุ canonical skill/component, gameplay shape/origin/delivery/timestamps, actor/baked-set reference (body + weapon/offhand หนึ่งชุดต่อ loadout หรือ species-variant), camera/native resolution, footprint, pose matrix (actions × directions × frames ตามที่ proof ล็อก), frame grid, anchor/effect-socket, animation states, depth order (single sprite layer), reduced-motion variant, budget (texture size, frames, file size), provenance และ rejection criteria. Particle distribution ตามพื้นที่ ไม่ใช่จำนวน target; แยก component ตาม phase/motion/path. ห้าม brief แบบ body เปล่า + weapon ลอยมาประกบทีหลัง

## 4. 2.5D production contract

- Sprite/atlas ต้องอ่าน silhouette, pixel clusters, materials และ luminous core ได้ที่ขนาดเล่นจริง; การลด resolution อย่างเดียวไม่รับประกันคุณภาพ
- Cone/line/projectile/field แสดง full footprint/trajectory ตาม committed area; empty ground ต้องเห็น; hit เกิดตาม receipt จริง
- Pose matrix เทียบเท่าทุก character: proof ล็อก actions × directions × frames หนึ่งชุด (เช่น idle/walk/attack windup-contact-follow-through-recovery/hit/death/skill) แล้ว player ทุก class และ mob ทุก species/variant ใช้ matrix เดียวกัน ห้ามมีตัวที่ใช้ east/west-only แล้วให้ตัวอื่นใช้เต็ม หรือแชร์ body ข้าม weapon family; วาด native ต่อ 8 world directions สำหรับ 2.5D 3/4 ไม่หมุน side view แทนทิศอื่น
- ทุกเฟรมเป็น baked pixel sprite 2.5D 3/4 (body + weapon/offhand ใน pixels เดียวกัน วาด foreshorten/raised/side ตามทิศนั้น ๆ); anchor/visible bounds อ้างกับ baked cell เดียว; socket มีเฉพาะ effect release/contact ไม่ใช่จุดแปะอาวุธ; ห้าม separate weapon PNG, grip/pivot estimate, หรือ rotate/scale อาวุธแยกชั้นตอน runtime; depth order ตาม ground plane; ห้ามฝัง actor ใน effect ที่ต้องแยก
- One-shot/pulse/loop/exit/interruption ตรง lifecycle จริง; decoration ไม่เพิ่ม hit หรือบดบังพื้นที่สำคัญ; fallback ทำงานเมื่อ candidate ผิด/ไม่ผ่าน
- Reduced motion ยังคงพื้นที่และ cue สำคัญ; ไม่มี shimmer/crawl เกิน 1 native pixel
- Reject: body เปล่า + weapon ลอย, grip/pivot estimate แทน baked pixels, แชร์ body ข้าม weapon family, action มีไม่ครบทุกทิศตาม pose matrix ที่ proof ล็อก
- `equipment-v1` แบบแยกชั้น (body + weapon PNG หมุนแปะตอน runtime) อยู่ต่อเฉพาะเป็น fallback; งานใหม่ทุก slice เป็น baked set และเปิด default แทนเมื่อผ่าน QA

## 5. Skill VFX contracts

รายละเอียดราย skill และ QA อยู่ที่ [authored VFX production](../../game/public/fx/skill-pool/vfx-production.md) และ atlas ต่อ skill; ตารางนี้เป็น contract ระดับ family:

| Family | ภาพ/จังหวะที่ต้องส่ง | Reject |
|---|---|---|
| Melee/cone/line (Cleave, Impale, Venom Spray, Shield Bash, Ground Slam, Whirlwind, Piercing Shot) | weapon sweep/thrust ที่ bake มากับ body ตาม committed sector/line; contact ต่อ actual recipient | วงเต็ม, ทิศตาม target หลัง lock, contact ด้านหลัง, weapon ลอยหมุนแยกชั้น |
| Burst/projectile (Water Ball, Double Strike, Split Shot, Ice Lance, Arrow Shower, Chain Lightning, Overload) | จำนวนลูก/จังหวะตาม canonical row; one aim/one cast; contact แยกตาม receipt | one projectile + fake flashes, clone slash พร้อมกัน, ลูกศรตั้งแต่ release |
| Fields/nova/status/aura (Storm Field, Poison Cloud, Blizzard, Sand Storm, Firestorm, Meteor, novae, buff/curse/heal/aura) | bed/field ตาม footprint และ duration จริง; pulse/aura loop; status accent ตาม first-success | field ที่ดู damage ตลอด, cloud ตาม target, aura ring กลายเป็น enemy radius |
| Basic/mob paths | ใช้ contract เดียวกัน; mob skill ต้องอ่านทิศ/พื้นที่จริง | coverage จาก manifest entry โดยไม่มี runtime หลักฐาน |

- Burst budget ใช้ count × authored share จริง; cosmetic fragments ไม่เพิ่ม hit
- Field: 1 active instance ต่อ caster+skill+arena; pulse ตาม absolute schedule; recast replace future work โดยไม่ refund
- Contact/impact/status อ่าน receipt จริง; visual cue ไม่สร้าง gameplay

## 6. Density และ timing

### 6.1 Visual timing envelope

| Family | Primary cue | Tail/ambient |
|---|---|---|
| Single melee cut/thrust | 100–160 ms active, contact 60–90 ms | trail dissolve 80–140 ms |
| Shield/blunt | contact 60–100 ms | recoil/particles 120–180 ms |
| Venom Spray | fan burst 160–240 ms | droplets 120–180 ms |
| Ground burst/nova/slam | footprint peak 180–260 ms | dust/cracks 250–450 ms |
| Single projectile | release 30–50 ms | impact 60–100 ms, exit 100–160 ms |
| Chain | one link ต่อ hop | decay 60–100 ms |
| Persistent field | activation 180–250 ms | bed/wind loop 0.8–1.6 s |
| Mobile channel | rotation ตลอด channel | finish 120–180 ms |
| Buff/curse | activation 180–250 ms | exit 120–180 ms |
| Aura | enable cue | orbit 1.8 s, breathing 2.4 s |

ค่าเหล่านี้เป็น presentation tuning ไม่ใช่ gameplay timing; runtime อ่าน resolved timestamps จริง

### 6.2 Density

```text
referenceArea = PI * 3m * 3m
densityScale = min(actualWorldArea / referenceArea, 2)
ambientBirthRate = familyBaseRate * densityScale * qualityMultiplier
activeCosmeticCap = ceil(familyBaseCap * densityScale * qualityMultiplier)
```

- `actualWorldArea`: circle πR², cone αR²/2 (radians), line L×W
- Quality: standard 1 / low 0.5; ลดเฉพาะ decoration ไม่ลด field bed/real pulse cue
- Cap เฉพาะ weather/decorative particles ไม่ใช่ hit recipients
- Budget รวมทั้ง arena: active cosmetic particles ≤ 2,000 และ effect instances ≤ 120 ที่ standard; stress scene = mob cap + 3 field + weather 1 ระบบ
- Birth schedule จาก absolute sim time + index + stable cosmetic seed; seek/resume ไม่ปล่อย backlog

## 7. QA และ acceptance

- ตรวจ source/atlas: alpha, cell grid, baked anchors/effect-sockets, pose-matrix equivalence (actions × directions × frames ครบตาม proof), animation frames, metadata และ provenance; `python tools/check-authored-vfx.py --selected` สำหรับ selected VFX
- ตรวจใน arena/browser จริงที่ 1920 × 1080 ด้วย arena matrix: actor-to-area ratio, 8 world directions + mid-angle, motion/baked-weapon alignment, center-to-edge coverage, empty ground, contact timing เทียบ receipt, overlap/occlusion, readability, interruption และ reduced motion
- ตรวจ pixel art ที่ native res และเทียบ reference; ภาพนิ่ง/lab preview เพียงอย่างเดียวไม่ผ่าน
- Performance: production live p50/p95, heap, device/browser; gate 60 Hz floor (p95 ≤16.8 ms, owner-accepted); dev showcase debug ไม่ใช่หลักฐาน
- Automated capture: screenshot ต่อ skill × 8 direction + mid-angle ที่ seed/เวลาเดิม เก็บ artifact คู่ version
- Mixed 2.5D slices ต้องผ่าน visual coherence check; rollback version ก่อนได้ทันที

## 8. Definition of done

- Proof มี character/mob/terrain slice, skill set, runtime integration และ provenance ที่ทำซ้ำได้ พร้อม browser evidence
- Pixel appearance และ chibi detail สอดคล้อง reference; camera และ 8 ทิศ + มุมกลางอ่าน action ได้; ทุก character ใช้ pose matrix เดียวกัน
- Baked single-sprite anchor/depth/full area/timing/contact/cancellation/reduced motion ผ่าน; ไม่มี separate weapon layer; ไม่เพิ่ม gameplay effects
- Performance และ selected versions/paths/checks/limits ถูกบันทึก; 2.5D ที่ยัง pending แยกจากของเดิมชัดเจน
- ลำดับ Character → Mob → Skill VFX → Map ครบ; ไม่มี geometry/runtime renderer ใน pipeline
