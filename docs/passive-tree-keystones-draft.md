# Passive-tree implementation plan — locked design

สถานะ **READY สำหรับทำตาม execution packets ตามลำดับ** · ตัดสินใจวันที่ **2026-10-21** · **ยังไม่ได้ implement เกม**

เจ้าของมอบหมายให้ผู้ช่วยเลือกข้อค้างทั้งหมดในแผนนี้แล้ว การเลือกด้านล่างจึงเป็น specification สำหรับ implementation ไม่ใช่รายการคำถามให้ agent ออกแบบต่อ ใช้ไฟล์นี้เป็นแผนเดียว ไม่สร้างรายงาน/แผนสำเนาอีกไฟล์ ความพร้อมของแผนไม่ใช่หลักฐานว่าโค้ดใหม่ผ่านการทดสอบแล้ว

## 1. ขอบเขตที่ล็อก

- ทำต้นไม้ v3: **700 node ที่ซื้อได้ = Normal 560 + Notable 88 + Keystone 52** และ Start ฟรี 1 จุด ทุก node หนึ่ง rank
- Normal ให้ **+1 Core Attribute ที่ระบุเพียงตัวเดียว** ราคา 1 Tree Point; Notable ให้ Flat/% ตามตาราง ราคา 3 Tree Points; Keystone เปลี่ยน mechanic ราคา **1 attainment** ไม่จ่าย Tree Point ไม่มี global Keystone limit
- งบซื้อทุกNormal/Notableรวม824 Tree Points และทุกKeystoneรวม52 attainment (คู่ที่ห้ามซื้อร่วมกันยังใช้ตามตาราง) ระดับ190มี390+Q จึงไม่ต้องซื้อหมดต้นไม้เพื่อเล่นได้ และเควสขยายงบหลังเลเวลตัน
- ใช้ 7 ภูมิภาค STR / AGI / DEX / INT / WIS / VIT / LCK ทุกทางเปิดจาก Start ไม่ต้องผ่าน attribute requirement ไม่แก้ความสามารถของสกิลที่ระบุชื่อ
- ไม่มี Ward ใช้ HP / Mana / ES เท่านั้น Bark/Fortify เป็น charge/stack ที่แก้ Hit ไม่ใช่แถบทรัพยากรเพิ่ม
- Implement เฉพาะ Keystone 52 ตัวใน catalogue ส่วน 5 ไม่เพิ่ม node หรือ mechanic นอกชุดนี้
- เริ่มตัวละครใหม่เสมอ **ไม่ทำ old-character migration หรือ allocation mapping** ไม่ลบเซฟหรือบัญชีเดิมอัตโนมัติ รูปแบบใหม่ต้อง save/load/import/export/offline ถูกต้อง
- ทำ engine, sim, data, persistence, UI, wiki และ verification ครบตาม packet ไม่ทำ engine แบบรับชื่อ rule แล้วไม่มี handler
- ไม่เพิ่ม dependencies; ไม่เปลี่ยน loot/craft/map/เนื้อหาสกิล ไม่ทำ balance/pacing/จำนวน node เป็น gate ถาวร ตัวเลขในแผนเป็นค่าเริ่มต้นที่ต้องใส่จริง แต่อนาคตเปลี่ยน data ได้โดยไม่แก้ test quota
- แก้ gameplay numbers ใน canonical JSON และสูตรใน engine; UI อ่าน model เดียวกับที่ sim ใช้

## 2. แต้ม เลเวล และเควส

### 2.1 Level curve และบัญชีแต้ม

ใน tree.json ใช้ currencies.tree.base=3 และ level_ranges=[{from:2,to:100,per:3},{from:101,to:190,per:1}] แทน per_level สำหรับ v3 ช่วงเรียงและไม่ทับกัน; สูตร engine อ่านแถว ไม่ฝัง breakpoint ใน client เลเวลเกิน cap ถูก clamp ตาม cap เกมเดิม

levelTreePoints(L) = 3 + 3 × min(L−1,99) + max(0,L−100) สำหรับ L=1..190

| Level | แต้มฐาน+เลเวล |
|---|---:|
| 1 | 3 |
| 100 | 300 |
| 101 | 301 |
| 190 | 390 |

เพิ่ม player.questTreePointsEarned เป็นจำนวนเต็มไม่ติดลบที่เพิ่มเมื่อจ่ายรางวัลสำเร็จเท่านั้น:
treePoints = levelTreePoints(level) + questTreePointsEarned − pointsSpentByCurrency(ranks).tree

Attainment ใช้ wallet/แหล่งรายได้เดิม ห้ามรวมยอดซื้อ Keystone มาหัก Tree Points setLevel, level-up หลายเลเวล, save normalization และ UI ใช้สูตรร่วมนี้ ไม่ล้าง Q เมื่อเปลี่ยนเลเวล เลเวลลดจนงบไม่พอให้ helper ปฏิเสธแบบ atomic ไม่คืน/ตัด allocation เงียบ ๆ

Respec ทั้งต้นคืนแยก {tree, attainment} ตามราคาและสกุลของspec/versionที่allocationซื้อ (ไม่เพิ่มhistoricalpriceledger; เปลี่ยนราคา/identityภายหลังต้องขึ้นtreeversionและเริ่มcharacterใหม่ตามscopeนี้) ไม่แก้ Q และไม่คืนรางวัลเควสเพิ่ม ยังคงราคา/ข้อจำกัด respec เดิม ไม่มี single-node refund ใหม่ใน scope

### 2.2 Quest bonus ที่เจ้าของเลือก

ใน tools/data/town.json เพิ่ม shared quest_tree_bonus: {chance:0.10, amount:1} ทั้ง Town tasks และ Delivery อ่านชุดนี้:

1. ตอนสร้าง offer สุ่ม **อีกหนึ่ง draw ท้ายลำดับ RNG เดิม** แม้ผลเป็น 0 แล้วเก็บ treePoints:0|1 ใน reward ของ offer ไม่สุ่มจาก preview/load/claim
2. เป็นโบนัสเสริม ไม่แทน Stone/attainment/ของเดิม Town task จ่ายเมื่อ claim ผ่าน progress/location/capacity checks ครบ; Delivery จ่ายเฉพาะ transition เป็น completed
3. transaction เพิ่มทั้ง Q และ wallet ครั้งเดียวแล้ว mark claimed/completed ในการเปลี่ยน state เดียว Partial, preview, expired, cancel, skip หรือ claim ที่ล้มเหลวไม่จ่าย
4. รับซ้ำจาก **เควสใหม่** ได้ไม่จำกัดอายุบัญชี ส่งซ้ำ/โหลดซ้ำของ offer เดิมไม่จ่ายเพิ่ม แสดงโบนัสตามผลที่เก็บ ทั้ง offer, receipt, summary และ paidBonus
5. New-format validator ตรวจจำนวนและสถานะ reward ไม่เติมย้อนหลังจาก RNG หรือเดาโบนัสที่หาย

## 3. Shape, identity และเส้นทางซื้อ

### 3.1 Recipe ที่สร้าง data ได้ทันที

ลำดับภูมิภาคตามเข็มนาฬิกา str, agi, dex, int, wis, vit, lck; มุม θ(i)=−90°+i×360°/7 แต่ละภูมิภาคมี spine 20 Normal และ branch 12 ชุด ชุดละ 5 Normal + 1 Notable รวม 80 Normal + 12 Notable/ภูมิภาค

- ID spine: normal.<region>.s01..s20; branch: normal.<region>.c01.01..c12.05; Notable: notable.<region>.01..12
- Keystone ID = keystone.<ชื่ออังกฤษตัวเล็กคั่นด้วยขีด> เช่น keystone.mind-over-matter ไม่ใช้เลขไอเดียเป็น save key หมายเลข 01–66 คงไว้เป็น draft_ref ใน data เพื่อ trace เท่านั้น
- Start → spine01 → … → spine20. Branch j ต่อจาก spine(j+6) → branch j step1..5 → Notable j → Keystone j ถ้ามี Keystone ตามตารางถัดไป
- เชื่อมภูมิภาคข้างกันเป็นวงที่ spine06 และ spine20; วาดเส้นวงเป็น arc ระหว่างมุมข้างกัน ไม่ลาก chord ตัด Start
- เพิ่ม Notable สะพาน 4 จุด ID notable.junction.str-agi / dex-int / wis-vit / lck-str แต่ละจุดต่อ spine04 ของสองภูมิภาคนั้น
- ทุก Keystone เป็นใบ degree=1 ไม่เป็นทางผ่านไป node อื่น ทุก normal ในภูมิภาคให้ +1 attribute ชื่อภูมิภาคนั้น
- สี/ฟอนต์ใช้ tokens เดิม รูปร่าง Normal วงกลม, Notable สี่เหลี่ยมข้าวหลามตัด, Keystone หกเหลี่ยม แสดงรายละเอียดขณะเลือก ไม่ยัดชื่อทุก node บนแผนที่

| ภูมิภาค | Keystone ตาม cluster j=1 เป็นต้นไป |
|---|---|
| str | 01,04,08,09,10,42,43,53 |
| agi | 02,12,16,23,32,46,57 |
| dex | 13,22,30,60,65,66,59 |
| int | 05,06,21,27,28,31,64 |
| wis | 24,33,34,45,47,52,54,55,58 |
| vit | 03,07,11,17,35,36,37,40,51,56,61 |
| lck | 19,20,44 |

พิกัด derived โดย engine ใช้ u=(cosθ,sinθ), v=(−sinθ,cosθ):
- Start=(0,0), spine i =25(i+1)u
- Branch j step k =25(j+7)u + sign(j)12k·v; sign(j)=+1 เมื่อ j คี่ และ −1 เมื่อคู่
- Notable j ใช้ offset sign(j)72·v; Keystone ใช้ sign(j)90·v จาก base เดียวกัน
- Junction=(125cos(π/7))·u(midAngle) โดย str–lck ใช้มุมกึ่งกลางผ่าน −90° ไม่วนรอบยาว
- รัศมี Normal3.5, Notable7, Keystone9, Start8 เป็นค่า layout data; stroke รวมอยู่ภายในรัศมีนี้ ขยาย hit target ตาม zoom ได้แต่ไม่ขยายภาพจนทับกัน
- IDใหม่คงความหมายภายในv3ไม่renameภายหลังโดยไม่เปลี่ยนversion; layout.algorithm = seven-spoke-v3; node.placement เก็บ role และ index หรือ cluster/step (junction เก็บ a,b) ไม่เก็บพิกัดซ้ำทุก node

เพิ่ม build mode ใน **tools/tree.ts เดิม** รับ profile/layout/Keystone bundle params จาก tree.json แล้วสร้างรายการ Normal/Notable/topology ลง tree.json แบบ idempotent ไม่ parse Markdown และไม่สร้าง helper script ถาวร ข้อมูล Keystone ที่เขียนเองต้องไม่ถูก generator ล้าง nodes.grants ของ profile ถูก resolve โดย createTree ไม่คัดลอกตัวเลขทุกรอบ

ผลตรวจ recipe ด้วยคณิตศาสตร์ในงานวางแผนนี้: 701 จุดรวม Start, 718 edges, ทั้งหมดเชื่อมถึง Start, circle overlap=0, clearance ต่ำสุดประมาณ1.5หน่วย **ยังไม่ใช่ผล browser/performance test** จำนวนข้างต้นเป็นตรวจ deliverable รอบแรก ไม่ใช่ runtime gate บังคับ content quota

### 3.2 Schema และซื้อผ่าน graph

เพิ่ม top-level profiles: Record<string,TreeGrant[]> (7 core + 88 notable profiles), links:[{a,b,shape:'line'|'arc'}], incompatibilities:[{a,b}] และ layout placements ตามข้างบน needs ยังเป็น parent DAG สำหรับ authoring ไม่ใส่ reverse edge จน recursion geometry วน ใช้ union(needs edges,links) เป็น **undirected adjacency** จริงในการซื้อ/reachable/path/แสดงเส้น

แต่ละ node ให้ profile หรือ grants อย่างใดอย่างหนึ่ง; Keystone ใช้ grants=[] และ effects=[{kind:'keystone',key:<slug>,params:{…}}] ได้เมื่อมี bundle ที่รองรับจริง ไม่มี firstGrant assertion สำหรับ node ที่มี mechanic แต่ไม่มี stat อย่าใส่ +stat หลอกเพื่อผ่าน validation .line/.values/.max เดิมต้อง optional/อ่านผ่าน grant adapter ทุก UI/cage caller รองรับ grantless node

v3 node_kinds มี normal/notable/keystone เท่านั้น ranks/cost/currencyตามส่วน1 Normal/Notableต้องมีprofileที่resolveเป็นgrantsและไม่มีeffects; Keystoneมีbundleตรงหนึ่งตัว ไม่ให้rank_tiers/shallow_nodesเก่ากำหนดranksของv3 readerเลือกschemaตามversion: v2fixturesคงอ่านได้ แต่v3ไม่ต้องมีdraft-tierfieldsเหล่านี้ indexยังเป็นลำดับในwingตามengineเดิม; tierเป็นoptionalสำหรับv3ไม่ใช้กำหนดpower/ราคา รายการnodeเรียงregionตาม3.1, spineตามindex, branchตามj/stepแล้วNotable/Keystone, junctionท้ายรายการ เพื่อoutputidempotent

Geometry/worldboundsใช้รัศมีแต่ละชนิด ไม่ใช้layout.node_radiusเดียวเหมารวม; includeStartและเผื่อpadding16หน่วย layoutรับwinganchorsจากสูตรเดียว ไม่ให้UIคำนวณpositionซ้ำ cageตรวจpropertygeometry/connectivityทุกnodeชนิดที่มีอยู่ ไม่บังคับจำนวนregionหรือKเป็นquotaถาวร

Path ใช้ Dijkstra บน adjacency: seed Start/owned component เป็นหลายrootที่cost0, Normal1, Notable3, Keystone target จ่าย1 attainment แยกจาก Tree Point; ห้ามเดินผ่าน Keystone ที่ยังไม่ซื้อเป็นทางลัด Tie เลือก lexical sequence ของ ID ที่จะซื้อเท่านั้น (ไม่รวมownedและไม่วนผ่านnodeซ้ำ) ตรวจครบทั้ง connectivity, currency, pair conflict และ handler ก่อน allocate **ทั้ง path แบบ atomic** ไม่ซื้อครึ่งทาง ถ้า target owned คืน empty/no-op ราคาบอก {tree, attainment} ไม่บวกรวมสกุล

ไม่ใช้ one-of keystone_groups เดิมใน v3 ให้เป็น [] ใช้ pairwise เท่านั้น แต่ละแถวต่อไปคือทุกคู่ระหว่างเลขซ้ายกับรายการขวา (deduplicate unordered pair; ไม่มี transitive closure):

| ฝั่งหนึ่ง | ฝั่งที่ซื้อร่วมกันไม่ได้ |
|---|---|
| 55 CI | 03,04,35,37,47,51,54,56 |
| 51 Enduring Core | 23,24,34,45,47,55,57,58 |
| 13 No Crit | 19,20,31,60 |
| 23 No Block | 10,44 |
| 44 No Block event | 10 |
| 40 No Leech | 07,61 |
| 05 Full conversion | 09 |
| 01 No Evasion | 23 |

คู่ที่ไม่อยู่ในตารางซื้อร่วมกันได้ เช่น 55+34+45+57+58, 03+54, 05+65+66, 07+45+61 การไม่มี stat ที่ใช้ประโยชน์อยู่ตอนนี้ เช่น 65 เมื่อยังไม่มี Flat ไม่ใช่ handler หาย ไม่ต้องห้ามผู้เล่นวางแผนบิลด์ Validator ปฏิเสธ unknown/self/duplicate pair, unknown node/effect/param และ incompatible allocation ใน import โดยระบุสาเหตุ ไม่ถอด node หรือคืนเงินเอง

## 4. Grants และ Notable profiles

เพิ่ม TreeGrant.stat?:StatKey และ TreeGrant.element?:ElementKey; linesOf ส่ง metadata นี้ถึง sumLines โดยไม่ทำหาย ย้าย STAT_KEYS/StatKey จาก client.ts ไป **engine/core-attributes.ts (ไฟล์ใหม่ตอน implement)** แล้ว re-export จาก client โดยคงลำดับเดิม str,int,vit,agi,dex,wis,lck ไม่ refactor CORE_KEYS อื่นที่ไม่เกี่ยวข้อง

createTree รับ context ของธาตุ canonical จาก engine.json elements.status_of ผ่าน caller (client และ tools/tree) engine ห้าม import client/game data โดยตรง Target stat ใช้ได้เฉพาะ stat_mod_flat; element ใช้ได้เฉพาะ elemental_power_flat / elemental_power / elemental_resistance / elemental_resistance_cap_pct; invalid combination/unknown target ปฏิเสธด้วย node ID

Normal ใช้ profile core.<region> = [{id:'stat_mod_flat',stat:<region>,values:[1]}] ไม่มี all_stat_flat หรือ +derived stat แฝง Profile และ grants มีอย่างใดอย่างหนึ่งเท่านั้น ต้อง resolve ได้ก่อน validate ทุก granted line ต้องทำงานกับ sheet จริง

Notable name ใช้ “<REGION> Focus <NN>”; junction ใช้ “STR–AGI Link” ฯลฯ ทุก profile ต่อไปนี้มีหนึ่ง rank และค่าคือ flat หรือ percentage points ตาม line ของเดิม การนำลง JSON ใช้ชื่อเต็มตาม mapping ห้ามใส่ shorthand เป็น line ID

| รหัสย่อ | line ID |
|---|---|
| PF | physical_power_flat |
| PP | physical_power |
| MF | magic_power_flat |
| MP | magic_power |
| EF | elemental_power_flat |
| EP | elemental_power |
| AL | elemental_alignment |
| ER | elemental_resistance |
| AR | all_resistance_pct |
| AF | armour_flat |
| AP | armour_pct |
| EVF | evasion_flat |
| EVP | evasion_pct |
| AS | attack_speed |
| ACC | accuracy |
| CC | critical_chance |
| CD | critical_damage |
| PD | perfect_dodge_pct |
| HP | max_hp |
| HF | max_hp_flat |
| MN | max_mana |
| MFlat | max_mana_flat |
| ES | energy_shield_flat |
| ESP | max_energy_shield_pct |
| ESR | energy_shield_regen |
| HRF | life_regen_flat |
| HR | life_regen_pct |
| MRF | mana_regen_flat |
| MR | mana_regen_pct |
| CDR | cooldown_reduction |
| AD | attack_damage_pct |
| SD | spell_damage_pct |
| PEN | armour_pen |
| BL | bleed_chance |
| ST | stun_chance |
| BC | block_chance |
| SR | status_resistance_pct |

EF.<element> / ER.<element> ระบุ element เพิ่มใน grant; ค่าอื่นไม่ใส่ element

| Profile | Grants (หนึ่ง rank) |
|---|---|
| notable.str.01 | AF20 + AP8 |
| notable.str.02 | PP8 + AS4 |
| notable.str.03 | AD8 + PF20 |
| notable.str.04 | BL8 + PP6 |
| notable.str.05 | BC8 + AF16 |
| notable.str.06 | CD30 + PF16 |
| notable.str.07 | PEN6 + ACC8 |
| notable.str.08 | AP8 + HP4 |
| notable.str.09 | PF24 + AD6 |
| notable.str.10 | HF80 + AF16 |
| notable.str.11 | ST8 + AL2 |
| notable.str.12 | AF24 + HF60 |
| notable.agi.01 | SR10 + EVP6 |
| notable.agi.02 | AD6 + ACC10 |
| notable.agi.03 | EVF12 + EVP8 |
| notable.agi.04 | ES24 + EVF10 |
| notable.agi.05 | AS6 + MP6 |
| notable.agi.06 | ST8 + AL2 |
| notable.agi.07 | ESP6 + ESR10 |
| notable.agi.08 | AS8 |
| notable.agi.09 | EVP10 + HF60 |
| notable.agi.10 | PD1 + ACC8 |
| notable.agi.11 | AD8 + EVP6 |
| notable.agi.12 | EVF18 + AS4 |
| notable.dex.01 | ACC12 + PEN5 |
| notable.dex.02 | AD6 + AS4 |
| notable.dex.03 | AL3 + EF.fire8 + EF.cold8 |
| notable.dex.04 | CC3 + SR8 |
| notable.dex.05 | EF.fire10 + EF.cold10 |
| notable.dex.06 | AL3 + MR8 |
| notable.dex.07 | SR12 + HRF4 |
| notable.dex.08 | ACC10 + AS5 |
| notable.dex.09 | EF.lightning20 |
| notable.dex.10 | EF.poison20 |
| notable.dex.11 | EF.chaos20 |
| notable.dex.12 | EF.earth20 |
| notable.int.01 | PF16 + EF.fire16 |
| notable.int.02 | ER.fire16 + HR6 |
| notable.int.03 | MF24 + SD8 |
| notable.int.04 | EF.chaos16 + SD6 |
| notable.int.05 | CDR10 + MR10 |
| notable.int.06 | CC3 + AL2 |
| notable.int.07 | MN8 + MR10 |
| notable.int.08 | MP10 + MFlat40 |
| notable.int.09 | SD10 |
| notable.int.10 | EF.poison16 + AL2 |
| notable.int.11 | EF.earth16 + MF16 |
| notable.int.12 | EP10 + AL2 |
| notable.wis.01 | ESP8 + ESR12 |
| notable.wis.02 | MFlat60 + MRF6 |
| notable.wis.03 | MN8 + ES24 |
| notable.wis.04 | MR12 + ES24 |
| notable.wis.05 | AR8 + ESP6 |
| notable.wis.06 | MRF8 + CDR8 |
| notable.wis.07 | HP6 + MN6 |
| notable.wis.08 | ES36 + AR6 |
| notable.wis.09 | MFlat60 + ESR10 |
| notable.wis.10 | CDR12 |
| notable.wis.11 | MN10 + MR8 |
| notable.wis.12 | ESR14 + SR8 |
| notable.vit.01 | HF80 + AS4 |
| notable.vit.02 | HP8 + AD6 |
| notable.vit.03 | HF80 + AP6 |
| notable.vit.04 | HP8 + HRF4 |
| notable.vit.05 | HP8 + AR6 |
| notable.vit.06 | HF100 + SR8 |
| notable.vit.07 | HRF6 + HP6 |
| notable.vit.08 | HF80 + HR8 |
| notable.vit.09 | HP8 + AF16 |
| notable.vit.10 | HRF6 + HR8 |
| notable.vit.11 | HP6 + EP8 |
| notable.vit.12 | BC8 + HF60 |
| notable.lck.01 | CC3 + AD6 |
| notable.lck.02 | CD30 + EF.poison12 |
| notable.lck.03 | BC10 + AF16 |
| notable.lck.04 | CC3 + CD24 |
| notable.lck.05 | PD1 + ES24 |
| notable.lck.06 | CC3 + ACC8 |
| notable.lck.07 | CD36 + PF16 |
| notable.lck.08 | PD1 + HF60 |
| notable.lck.09 | AR8 + SR8 |
| notable.lck.10 | AS5 + CD24 |
| notable.lck.11 | MF24 + CC2 |
| notable.lck.12 | MR10 + CDR8 |
| notable.junction.str-agi | PP6 + AS4 |
| notable.junction.dex-int | AL2 + MP6 |
| notable.junction.wis-vit | HP4 + MN4 |
| notable.junction.lck-str | CC2 + AP6 |

ค่าเหล่านี้เป็น input ของต้นไม้รอบแรก ไม่ผูกสูตรกับ maximum ของ gear และไม่สร้าง test ว่าต้องมี 88 profile ตลอดไป การทดสอบอ่าน fixture/profile จริงแล้วตรวจผล stat ตามที่ประกาศ

## 5. Keystone catalogue — 52 ตัว

### 01–16

| เลข | Keystone | Effect ที่ใช้ implement |
|---|---|---|
| 01 | **Ironwall** | แปลง Evasion Rating ทั้งหมดเป็น Armour ในอัตรา 1:1 และไม่สามารถหลบด้วย Evasion ได้อีก |
| 02 | **Unstoppable** | Stun ไม่หยุดการกระทำ และ Slow ไม่ลดความเร็วโจมตี แต่ระหว่างที่ควรติดผลเหล่านั้น สร้างดาเมจน้อยลง 25% แทน |
| 03 | **Berserk** | ขณะ Low Life ได้ดาเมจ ×1.4 และความเร็วโจมตี ×1.25 แต่รับดาเมจเพิ่ม 15% ตลอดเวลา |
| 04 | **Redline** | ทุก Hit ที่โดนศัตรูให้ Rage 1 ชั้น สูงสุด 10 ให้ตัวคูณดาเมจรวม 1 + 0.03 × จำนวนชั้น และเสีย HP 0.5% ของ Max HP ต่อวินาที Rage หายเมื่อหยุดทำดาเมจ 3 วินาที |
| 05 | **Emberheart** | แปลง Physical Damage 100% เป็น Fire หลังคำนวณคริ แต่ก่อนต้านทาน ใช้ฐาน Physical เดิมและเปลี่ยนไปเผชิญ Fire Resistance |
| 06 | **One Flame** | โบนัส Fire Resistance 50% มีผลต่อ Cold/Lightning ด้วย แต่โบนัสเฉพาะ Cold/Lightning มีประสิทธิภาพครึ่งหนึ่ง ไม่คัดลอกเพดานต้านทาน |
| 07 | **Endless Hunger** | Leech ส่วนเกินสะสมเป็นคลัง สูงสุด 20% ของ Max Pool ปลายทาง เก็บได้ 10 วินาที และนำมาฟื้นเมื่อพร่อง หาก leech ถูกย้ายไปฟื้น ES คลังใช้ Max ES แทน Max HP แต่ไม่มี HP Regen |
| 08 | **Headsman** | Hit ที่ทำให้ศัตรูเหลือ HP ไม่เกิน 15% จะประหารทันที สำหรับ Boss/Unique ใช้เกณฑ์ 5% |
| 09 | **Crimson Pact** | Physical Hit สร้างดาเมจทันทีเพียง 50% และสร้าง Bleed รวมเท่ากับ 100% ของ Physical Hit เดิมใน 4 วินาที |
| 10 | **Painforged** | ดาเมจที่ Block ลดได้สะสมเป็นพลังสวนกลับ สูงสุด 20% Max HP แล้วเพิ่มเป็น Physical Damage ให้ Hit ถัดไป ใช้คลังทั้งหมดครั้งเดียว |
| 11 | **Fortress Under Siege** | ทุก Hit ศัตรูที่ทำให้เสีย HP หรือ ES ให้ Fortify 1 ชั้น สูงสุด 5 แต่ละชั้นลดดาเมจจาก Hit ถัด ๆ ไป 5% ทุกชั้นหายเมื่อไม่เสีย HP/ES นาน 4 วินาที |
| 12 | **Worthy Foe** | Hit เป้าหมายเดิมครบ 3 ครั้งจะเข้าสู่การท้าดวล: ทำดาเมจต่อตัวนั้นเพิ่ม 30% และรับดาเมจจากมันลดลง 20% การ Hit เป้าหมายอื่นยกเลิกผลและเริ่มนับใหม่ |
| 13 | **Unerring Eye** | Hit ข้ามการตรวจพลาดจาก Accuracy/Evasion แต่ไม่สามารถคริ ยังถูก Dodge หรือ Block ได้ตามกติกาเป้าหมาย |
| 16 | **Barkskin** | หากไม่เสีย HP/ES ทุก 2 วินาที จะสะสม Bark 1 ชั้น สูงสุด 5 Hit ที่ผ่านการหลบและทำดาเมจจะใช้หนึ่งชั้นเพื่อลดดาเมจ Hit นั้น 40% เป็น charge ลดดาเมจ ไม่มีแถบเกราะเพิ่ม |

### 17–36

| เลข | Keystone | Effect ที่ใช้ implement |
|---|---|---|
| 17 | **Master Surgeon** | HP Potion เปลี่ยนจากฟื้นทันทีเป็นทยอยฟื้นใน 4 วินาที ด้วยยอดฟื้นรวม ×1.5 ผลไม่หยุดเมื่อ HP เต็ม ระหว่างผลยังทำงาน ระบบอัตโนมัติไม่กินขวดใหม่เพื่อทับผลเดิม |
| 19 | **Ambush** | Hit ที่คริได้ตามกติกาเดิมจะคริแน่นอนเมื่อเป้าหมายมี HP เต็ม หลังจากนั้นโอกาสคริต่อเป้าหมายนั้นเหลือครึ่งหนึ่ง |
| 20 | **Toxic Execution** | คริไม่เพิ่มดาเมจทันที แต่เปลี่ยนดาเมจส่วนเพิ่มจากคริเป็น Poison ที่ทยอยสร้างใน 4 วินาที พิษนี้อิงยอดส่วนเพิ่มคริจริง ไม่ต้องมี Elemental Power เพื่อให้ทำงาน |
| 21 | **Delayed Demolition** | ดาเมจจาก Hit 40% ถูกเลื่อนไปเกิดหลัง 2 วินาที โดยส่วนที่เลื่อนมีดาเมจ ×1.5 หากเป้าหมายตายก่อน ดาเมจที่รออยู่สูญเสีย |
| 22 | **Demolition Sequence** | ทุก 5 Hit ตรงบนศัตรูตัวเดียว ทำให้เกิดระเบิดใส่มันและศัตรูอีกหนึ่งตัว ดาเมจเท่ากับ 20% ของHP ที่ศัตรูเสียจริงรวมห้า Hit นั้น DoT และระเบิดไม่นับเพิ่มรอบ |
| 23 | **Ghost Dance** | Evasion สำเร็จฟื้น ES เท่ากับ 3% Evasion Rating สูงสุด 10% Max ES ต่อครั้ง เกิดได้หนึ่งครั้งต่อวินาที แต่ไม่สามารถ Block |
| 24 | **Escape Artist** | ES Regen ตามธรรมชาติเปลี่ยนเป็นฟื้น ES 50% Max ES หลังไม่เสีย HP/ES ครบ 3 วินาที และเกิดซ้ำทุก 3 วินาทีตราบใดที่ไม่ถูกขัด ES Leech และการฟื้น ES โดยตรงยังทำงาน |
| 27 | **Profane Bloom** | ศัตรูที่ตายขณะมี Curse จากคุณระเบิดเป็น Chaos Damage เท่ากับ 15% Max HP ของมันใส่ศัตรูที่เหลือ ดาเมจระเบิดไม่ทำให้ Keystone นี้ระเบิดต่อ |
| 28 | **Malediction** | ศัตรูรับ Curse จากคุณได้หนึ่งชนิด แต่ผลเชิงตัวเลขของ Curse นั้น ×1.75 การลงชนิดใหม่แทนที่ชนิดเดิม |
| 30 | **Elemental Equilibrium** | หลัง Elemental Hit เป้าหมายต้านธาตุหลักของ Hit นั้นเพิ่ม 10 จุด และต้านธาตุอื่นลด 20 จุด นาน 4 วินาที ผลใหม่แทนที่ผลเก่า |
| 31 | **Inevitable Judgement** | เมื่อ Hit คริสำเร็จตามกติกาเดิม ส่วน Elemental ของ Hit นั้นข้าม Resistance แต่ Elemental Damage ของ Hit ที่ไม่คริลดลง 20% ไม่ทำให้ดาเมจธาตุคริเอง |
| 32 | **Instruments of Virtue** | เมื่อสลับการทำดาเมจระหว่าง Attack กับ Spell การกระทำถัดไปได้ดาเมจ ×1.35 การใช้ประเภทเดิมซ้ำไม่ได้โบนัส |
| 33 | **Mind over Matter** | 30% ของดาเมจที่จะเข้า HP จ่ายด้วย Mana แทนในอัตรา 1:1 ไม่ใช้ Mana ที่ถูกจอง หาก Mana ไม่พอ ส่วนที่เหลือเข้า HP |
| 34 | **Arcane Battery** | จอง Mana 40% แล้วเพิ่ม Max ES เท่ากับยอด Mana ที่จองจาก Keystone นี้ ×2 Mana ที่จองยังเป็นส่วนหนึ่งของ Max Mana แต่ใช้จ่ายไม่ได้ |
| 35 | **Radiant Faith** | จอง HP 25% ลดดาเมจแต่ละ Hit เป็นจำนวนคงที่เท่ากับ 10% ของ HP ที่จอง สูงสุด 30% ของ Hit นั้น |
| 36 | **Time of Need** | ทุก 5 วินาที ล้าง Burn, Poison และ Bleed พร้อมฟื้น HP 15% แต่ไม่มี HP Regen |

### 37–55

| เลข | Keystone | Effect ที่ใช้ implement |
|---|---|---|
| 37 | **Blood Price** | ค่าใช้จ่าย Mana ของสกิลเปลี่ยนเป็นจ่าย HP ในอัตรา 1:1 ใช้ไม่ได้หากจ่ายแล้ว HP จะต่ำกว่า 1 การจอง aura ไม่ถูกเปลี่ยนโดย Keystone นี้ |
| 40 | **Borrowed Time** | 40% ของ HP ที่เสียจาก Hit ศัตรูทยอยฟื้นคืนใน 6 วินาที แต่ไม่ได้รับ Life Leech ไม่นับการจ่าย HP หรือทำร้ายตัวเอง |
| 42 | **Crushing Rhythm** | จำกัดความถี่โจมตีปกติสูงสุดหนึ่งครั้งต่อวินาที แล้วแปลงความถี่ส่วนเกินที่ทำได้จริงเป็นตัวคูณดาเมจต่อ Hit อาวุธที่ช้ากว่านั้นไม่ถูกเร่งฟรี และ Slow ยังลดจังหวะโจมตีตามปกติ |
| 43 | **Armourbreaker** | Physical Hit แต่ละครั้งทำลาย Armour เป้าหมาย 5% ของค่าเริ่มต้น สะสมสูงสุด 60% หากไม่โดน Physical Hit นาน 4 วินาที เกราะกลับคืน |
| 44 | **Turtle Doctrine** | Block เปลี่ยนจากสุ่มสำเร็จเป็นลด Physical Damage ทุก Hit ตามประสิทธิภาพเฉลี่ยของ Block เดิม ไม่มีเหตุการณ์ Block สำเร็จให้กระตุ้น effect อื่น |
| 45 | **Dark Siphon** | Life Leech และ Mana Regen ทั้งหมดฟื้น ES แทน HP และ Mana ต้องพึ่งการฟื้นจากแหล่งอื่น |
| 46 | **Disrupting Blows** | Hit ที่ทำให้ศัตรูเสีย HP อย่างน้อย 5% Max HP ของมัน เลื่อนการโจมตีครั้งถัดไปออก 0.5 วินาที ผลอยู่ภายใต้งบควบคุมศัตรูร่วมกับ Stun |
| 47 | **Elemental Aegis** | ES รับ Elemental Hit ด้วยดาเมจลดลง 30% แต่ Physical Hit ข้าม ES ไป HP โดยตรง ขาเข้าใช้ Physical/Elemental สองส่วนเดิม ไม่มี Magic ชนิดที่สาม |
| 51 | **Enduring Core** | ดาเมจเฉพาะส่วนที่เข้า HP ช่วงต่ำกว่า 30% Max HP ลดลง 50% แต่ไม่มี ES หาก Hit ตีข้ามเกณฑ์ จะลดเฉพาะส่วนใต้เกณฑ์ |
| 52 | **Mana Debt** | จ่ายค่า Mana จนติดลบได้ถึง 50% ของ Max Mana ส่วนที่ไม่ถูกจอง ระหว่างติดลบ Mana Regen ×2 แต่ใช้สกิลที่มีค่า Mana เพิ่มไม่ได้จนกลับถึงศูนย์ |
| 53 | **Thornbound** | Hit ศัตรูที่ทำให้เสีย HP/ES กระตุ้น Physical Damage สวนกลับเท่ากับ 20% Armour เกิดได้ทุก 0.5 วินาที สวนกลับไม่คริและไม่สร้าง proc แต่ดาเมจ Hit ที่คุณเป็นฝ่ายโจมตีเองลดลง 50% |
| 54 | **Blood Covenant** | เลือกเป็นราย aura ว่าจอง HP หรือ Mana การจอง HP ลดเฉพาะส่วนที่ใช้ได้ ไม่ลด Max HP ช่วยรักษาสถานะ Low Life |
| 55 | **Chaos Inoculation** | Max HP เหลือ 1 และป้องกัน Chaos Damage โดยสมบูรณ์ ดาเมจที่ยังรับได้ รวม Poison/Bleed เข้า ES ก่อน ส่วนเกินเข้า HP ไม่สามารถจองหรือจ่าย HP และไม่ถือเป็น Low Life |

### 56–61

| เลข | Keystone | Effect ที่ใช้ implement |
|---|---|---|
| 56 | **Staggering Resolve** | 40% ของดาเมจจาก Hit ศัตรูที่จะเข้า HP เปลี่ยนเป็นทยอยเสียใน 5 วินาที ยอดที่เลื่อนไว้ล้างด้วยการล้างสถานะไม่ได้ |
| 57 | **Shield Gate** | เมื่อ ES แตก ดาเมจส่วนเกินจาก Hit นั้นไม่ทะลุเข้า HP แต่ Hit ถัดไปทำดาเมจตามปกติ ใช้ใหม่ได้หลัง ES กลับเต็มและผ่านไปอย่างน้อย 8 วินาที |
| 58 | **Capacitive Casting** | 20% ของ Mana ที่จ่ายจริงกับสกิลนำไปฟื้น ES แต่ ES Regen ตามธรรมชาติลดลงครึ่งหนึ่ง |
| 59 | **Auto Cleanse** | เมื่อได้รับสถานะผิดปกติ ล้างสถานะนั้นอัตโนมัติ คูลดาวน์ 6 วินาที ไม่มีบัฟเพิ่มเติม |
| 60 | **Plague Courier** | เมื่อคริ ย้าย Burn/Poison/Bleed บนตัวหนึ่งชนิดไปยังเป้าหมาย โดยย้ายยอดดาเมจและอายุที่เหลือ ไม่เริ่มเวลาใหม่ เกิดได้ทุก 4 วินาที หากเป้าหมายป้องกันสถานะนั้น ย้ายไม่ได้ |
| 61 | **Parasitic Affliction** | ให้ Life Leech พื้นฐาน 2% และย้าย Life Leech ทั้งหมดไปทำงานกับ DoT ที่จ่ายจริงแทน Hit ต่อกับ Dark Siphon เพื่อฟื้น ES ได้ |

### 64: Aura stacking

| เลข | Keystone | Effect ที่ใช้ implement |
|---|---|---|
| 64 | **Aura Resonance** | เมื่อเปิด aura N ตัว ลด reservation เดิมของ aura ทุกตัวลง `min(30%, 5% × N)` แบบสัดส่วน และเพิ่ม Aura Effect `min(30%, 5% × N)` เช่นเดียวกัน ใช้สูตรลด reservation เดิม ไม่ใช่ reservation efficiency |

- นับ aura ที่เป็นเจ้าของและเปิดใช้งานจริงแต่ละตัวหนึ่งครั้ง ไม่นับ buff ที่ไม่ใช่ aura หรือสถานะที่ได้จาก aura เป็น aura เพิ่ม
- โบนัส Aura Effect บวกตามจำนวนแล้วคูณผล aura หนึ่งครั้ง ไม่ทบเป็น `1.05^N`: 1 aura ได้ +5%, 3 aura ได้ +15%, ตั้งแต่ 6 aura ขึ้นไปได้ +30%
- เจ้าของเลือกส่วนลด reservation 5% ต่อ aura สูงสุดลด 30% ด้วย เพดานทั้งสองเป็นคนละผล ไม่ใช่จำนวน aura สูงสุด
- Aura Effect ไม่ขยายส่วนลด reservation หรือโบนัส Aura Effect ของ Keystone นี้ซ้ำ
- กำหนด `b = min(0.30, 0.05 × N)`: reservation ของ aura แต่ละตัว = ค่า reservation เดิม × `(1 - b)` และขนาด effect aura ได้ตัวคูณ `(1 + b)` หนึ่งครั้ง เช่น reservation เดิม 40% ที่ N=6 เหลือ 28% คำนวณโดยไม่ปัดเป็นจำนวนเต็มก่อนรวม

### 65–66: Physical as extra Elemental และ Status Alignment

| เลข | Keystone | Effect ที่ใช้ implement |
|---|---|---|
| 65 | **Elemental Infusion** | ได้ as extra รวม 30% ของ Physical ก่อนคริและก่อน conversion แบ่งตามสัดส่วน Flat Elemental Damage ของธาตุที่มี โดย Physical เดิมยังอยู่ครบ ธาตุที่ไม่มี Flat ไม่ได้รับส่วนแบ่ง |
| 66 | **Elemental Conduit** | ส่วน Elemental Damage ที่ได้จาก as extra และอยู่ใน Hit ที่โดนเป้าหมาย มีโอกาสลงสถานะประจำธาตุนั้นผ่านระบบ Alignment เพิ่มการทอยจากส่วน as extra แยกจาก Flat ธาตุเดิม สูงสุดหนึ่งครั้งต่อธาตุต่อ Hit ใช้โอกาส proc ภูมิคุ้มกัน กฎซ้อน และงบควบคุมสถานะเดิม ไม่ใช่การลงสถานะแน่นอน |

- 65 ใช้ชนิดของ Flat Elemental Damage ที่มีจริงก่อนสร้างโบนัส ไม่ล็อกกับ Element ของอาวุธ และไม่นับโบนัส as extra ที่ตัวเองสร้างกลับมาเปิดธาตุหรือสร้างโบนัสวนซ้ำ
- 65 เพิ่มดาเมจและไม่แปลงทิ้งส่วน Physical เดิม ส่วน as extra ไม่คริเองตามกติกาดาเมจธาตุ ใช้ Physical ก่อนคริและก่อน conversion เป็นฐาน การซื้อ 05 จึงไม่ทำให้ฐานของ 65 กลายเป็นศูนย์
- เจ้าของเลือก **โบนัสรวม 30% แบ่งตาม Flat** ให้ `P` เป็นฐาน Physical ก่อนคริ/conversion, `F[e]` เป็น Flat ที่จับคู่ธาตุได้ก่อนเพิ่ม as extra/คูณเปอร์เซ็นต์ และ `S = Σ max(0, F[e])`: เมื่อ S>0 ได้ `extra[e] = 0.30 × P × max(0, F[e]) / S` หาก S=0 ไม่มี extra ไม่นับ Core INT หรือดาเมจที่ Keystone สร้างย้อนเข้า F
- ตัวอย่างเฉพาะส่วน extra: P=100, Flat Fire=10, Flat Cold=20 จะได้ Extra Fire=10 และ Extra Cold=20 รวม 30 ไม่ใช่ 30 ต่อธาตุ การเปลี่ยน Crit ไม่ขยาย extra ก้อนนี้
- 65 ไม่ให้สิทธิ์ลงสถานะจากดาเมจส่วน as extra ด้วยตัวเอง ส่วน Flat ธาตุเดิมยังลงสถานะตามกติกาเดิม เมื่อมี 66 จึงเปิดการทอยของส่วน as extra เพิ่ม
- 66 ใช้ mapping สถานะจาก `engine.json` ได้แก่ Fire→Burn, Cold→Chill, Lightning→Shock, Poison→Poison, Chaos→Mark และ Earth→Crippled ไม่เปลี่ยนชนิดดาเมจ
- รวมส่วน as extra ที่เป็นธาตุเดียวกันของ Hit นั้นก่อนทอย ห้ามเพิ่มจำนวนการทอยตามจำนวน Mod/แหล่งย่อยของธาตุเดียวกัน
- 66 ใช้ดาเมจส่วน as extra เป็นฐานผลสถานะ/งบ DoT ด้วย ไม่คิดเฉพาะ Flat ต้นทางเล็กน้อย สูตรและลำดับรวมกับสถานะจากแหล่งเดิมล็อกไว้ในส่วน 7.6
- 66 ใช้กับ as extra จากแหล่งอื่นได้ด้วยหากมี ไม่ผูกกับสกิลชื่อใดหรือเฉพาะแหล่ง 65 ทั้งสอง Keystone ต้องสามารถเลือกใช้ร่วมกันได้เมื่อจัด exclusion groups

## 6. Bundle params — ตัวเลขลง data โดยตรง

ใช้ effect.key เป็นชื่อ Keystone แบบ slug เดียวกับท้าย node ID; บันทึก params ใน node ของ tree.json ตามตารางนี้ ค่าร้อยละใช้หน่วย % (30 ไม่ใช่0.30), Mult เป็นอัตราส่วน (0.7), sec เป็นวินาที ห้ามคัดลอกเลขเหล่านี้เป็นค่าคงที่ใน sim Params={} หมายถึงกติกา boolean ที่อธิบายใน contract ไม่ใช่ handler ว่าง

global mechanics ใน tree.json: low_life_pct=50, hp_cost_floor=1, combat_time_units_per_sec=1000000, periodic_payment_sec=1, control_bucket_capacity_sec=1 และ camp_min_hp_per_sec=1 กฎ status/cap/mitigation ที่มี data เดิมแล้วอ่าน engine.json ต่อ ไม่ทำสำเนา Schema ปฏิเสธ missing/unknown params และค่า nonfinite; % อยู่ใน0..100, Mult>=0, duration/interval>0, countเป็นจำนวนเต็มบวก โดยค่าที่ไม่มีความหมายเป็น0ต้องปฏิเสธตามfield (เช่นอัตรา conversion ของ05)

| Ref | key | params | Required hooks |
|---|---|---|---|
| 01 | ironwall | {"evasionToArmour":1} | sheet |
| 02 | unstoppable | {"penaltyDamageMult":0.75} | outgoing,timing |
| 03 | berserk | {"damageMult":1.4,"aspdMult":1.25,"takenMult":1.15} | outgoing,incoming,timing |
| 04 | redline | {"hitStacks":1,"maxStacks":10,"damagePctPerStack":3,"hpCostPctPerStackPerSec":0.5,"idleResetSec":3} | outgoing,timing |
| 05 | emberheart | {"element":"fire","conversionPct":100} | outgoing |
| 06 | one-flame | {"sharedFirePct":50,"ownColdLightningEffectPct":50} | sheet |
| 07 | endless-hunger | {"bankCapPct":20,"expirySec":10} | recovery,timing |
| 08 | headsman | {"normalThresholdPct":15,"bossUniqueThresholdPct":5} | outgoing,kill |
| 09 | crimson-pact | {"directPhysicalPct":50,"bleedTotalPct":100,"durationSec":4} | outgoing,status |
| 10 | painforged | {"bankCapHpPct":20,"nextHitBonusPct":100} | incoming,outgoing |
| 11 | fortress-under-siege | {"maxStacks":5,"reductionPctPerStack":5,"resetSec":4} | incoming,timing |
| 12 | worthy-foe | {"hits":3,"dealtMult":1.3,"takenMult":0.8} | outgoing,incoming,timing |
| 13 | unerring-eye | {} | outgoing |
| 16 | barkskin | {"regenEverySec":2,"maxCharges":5,"hitTakenMult":0.6} | incoming,timing |
| 17 | master-surgeon | {"healMult":1.5,"durationSec":4} | recovery,timing |
| 19 | ambush | {"otherCritMult":0.5} | outgoing |
| 20 | toxic-execution | {"durationSec":4} | outgoing,status |
| 21 | delayed-demolition | {"deferredPct":40,"deferredMult":1.5,"delaySec":2} | outgoing,timing |
| 22 | demolition-sequence | {"hits":5,"damagePct":20,"extraTargets":1,"element":"fire"} | outgoing |
| 23 | ghost-dance | {"recoveryEvasionPct":3,"maxEsPerProcPct":10,"icdSec":1} | incoming,recovery,timing |
| 24 | escape-artist | {"idleSec":3,"burstEverySec":3,"esBurstPct":50} | recovery,timing |
| 27 | profane-bloom | {"victimMaxHpPct":15,"element":"chaos"} | kill |
| 28 | malediction | {"curseLimit":1,"effectMult":1.75} | status |
| 30 | elemental-equilibrium | {"durationSec":4,"ownResPlus":10,"otherResMinus":20} | outgoing,status |
| 31 | inevitable-judgement | {"nonCritElemMult":0.8} | outgoing |
| 32 | instruments-of-virtue | {"alternateMult":1.35} | outgoing |
| 33 | mind-over-matter | {"manaSharePct":30} | incoming |
| 34 | arcane-battery | {"reserveManaPct":40,"esPerMana":2} | sheet,reservation |
| 35 | radiant-faith | {"reserveHpPct":25,"flatCutReservedPct":10,"maxHitCutPct":30} | reservation,incoming |
| 36 | time-of-need | {"periodSec":5,"healMaxHpPct":15} | recovery,status,timing |
| 37 | blood-price | {"hpPerMana":1} | cost |
| 40 | borrowed-time | {"recoupPct":40,"durationSec":6} | incoming,recovery,timing |
| 42 | crushing-rhythm | {"maxBasicHitsPerSec":1} | outgoing,timing |
| 43 | armourbreaker | {"armourBreakPct":5,"maxBreakPct":60,"resetSec":4} | outgoing,status |
| 44 | turtle-doctrine | {} | incoming |
| 45 | dark-siphon | {} | recovery |
| 46 | disrupting-blows | {"hitMaxHpThresholdPct":5,"stopSec":0.5} | outgoing,status |
| 47 | elemental-aegis | {"elementHitTakenMult":0.7} | incoming |
| 51 | enduring-core | {"hpThresholdPct":30,"belowTakenMult":0.5} | sheet,incoming |
| 52 | mana-debt | {"debtLimitUsableManaPct":50,"negativeRegenMult":2} | cost,recovery |
| 53 | thornbound | {"armourDamagePct":20,"icdSec":0.5,"ownDirectDamageMult":0.5} | incoming,outgoing,timing |
| 54 | blood-covenant | {} | reservation |
| 55 | chaos-inoculation | {"maxHp":1} | sheet,incoming,cost,reservation |
| 56 | staggering-resolve | {"deferredPct":40,"durationSec":5} | incoming,timing |
| 57 | shield-gate | {"rearmCdSec":8} | incoming,recovery,timing |
| 58 | capacitive-casting | {"spentManaEsPct":20,"naturalEsRegenMult":0.5} | cost,recovery |
| 59 | auto-cleanse | {"icdSec":6} | status,timing |
| 60 | plague-courier | {"icdSec":4} | outgoing,status,timing |
| 61 | parasitic-affliction | {"baseLeechPct":2} | recovery |
| 64 | aura-resonance | {"reservationPctPerAura":5,"reservationCapPct":30,"effectPctPerAura":5,"effectCapPct":30} | sheet,reservation |
| 65 | elemental-infusion | {"extraTotalPct":30} | outgoing |
| 66 | elemental-conduit | {} | outgoing,status |

เพิ่ม pure engine/keystones.ts (ไฟล์ใหม่ตอน implement) สำหรับ parameter schemas, pure calculations และ required hook setsตามตาราง; runtime adapter game/src/sim/keystone-runtime.ts จัดการ state/event dispatch ฟังก์ชันคำนวณไม่อ่าน RNG/DOM/global state นอก argument

Hook namesเป็นclosedunion: sheet/reservation/cost/outgoing/incoming/status/recovery/timing/kill; registryแต่ละkeyมีrequiredHooksจากengineและhooksที่เป็นfunctionจริงจากruntime คำว่าsheetของ64รวมaura-effect transformก่อนaggregate ตารางคือขั้นต่ำทุกhookที่ต้องมี ไม่ใส่emptyfunctionเพื่อให้ครบ

Runtimeadapter/handler table ต้องimportได้จากNodecageและclientโดยไม่มีsideeffects: importเฉพาะpureengineและtype-onlygametypes ไม่importclient.ts/player.ts/combat.ts/skills.ts/game.tsหรือDOMกลับเข้ามา Nativegamefunctionsเรียกadapterพร้อมexplicitEnv{data,rng,time,state,damage/status/recoverycallbacks}แทน การสร้างtreeในclientจึงรับcapabilitiesจากfunctiontableจริงได้โดยไม่มีclient↔simวงจรimport Toolsใช้tableเดียวกัน ไม่สร้างmock“supportedkeys”มาหลอกcage

ใช้ bounded bundle registry ของ key ข้างบน ไม่สร้าง arbitrary condition DSL หรือเปิด conditional/reserve ใน RULE_KINDS เฉย ๆ คง legacy verbs cap_unlock/convert/remove จนสลับ tree v3 แต่ v3 ใช้ bundle shape นี้ Registry ต้องผูกกับ handler functions จริง (sheet/reservation/cost/outgoing/incoming/status/recovery/timing/kill ตามความต้องการของ key) ขาด hook ใดให้ createTree capability validation, cage, purchase และ import ปฏิเสธพร้อมชื่อ key/hook ก่อนหักเงิน ไม่ใช้รายชื่อ “supported” อีกชุดที่แก้ให้ผ่านได้โดยไม่มี handler

เปิด bundle registration หลัง packet ของตัวนั้นมี handler และ effect test ครบเท่านั้น ทดสอบ registry ด้วย fixture ถอด required function หนึ่งตัวแล้วต้องถูกปฏิเสธ ไม่ใช้ mock ที่เพียงประกาศว่ารองรับ Node ที่มีเงื่อนไขแต่เงื่อนไขยังไม่เกิดซื้อได้ตามปกติ

## 7. Runtime contracts — authoritative order

ส่วนนี้ใช้ตัดสินผลเมื่อ catalogue อ่านได้หลายแบบ ค่าร้อยละ/ระยะเวลาอ่านจาก params ไม่ฝังตามตัวอย่าง Test ใช้ fixture ตัวเลขเพื่อพิสูจน์สูตร และต้องไม่กลายเป็น balance gate

### 7.1 Event clock และนิยาม Hit

คง world tick 1 วินาที, world progression, quest tick และ skill rotation หนึ่งครั้งต่อ world tick ไม่เปลี่ยนทั้งเกมเป็น 4 ticks/s เพิ่ม game/src/sim/combat-clock.ts **เมื่อ implement** เพื่อจัด combat events ภายใน tick ด้วย absolute integer microseconds จาก simulation clock ไม่ใช้ Date.now/setTimeout ใน combat

- ช่วง tick เป็น (t0,t1] หลัง processing input/start-of-tick casts ที่ t0; event ที่ t1 ทำใน tick นี้ครั้งเดียว ตัวนับ t0 มาจาก clock ก่อน increment
- เก็บ attackProgress ต่อ actor หน่วย “จำนวนการโจมตีที่สะสม” initial=0; เวลาโจมตีถัดไป ceil((1−progress)/rate×unitsPerSec) อัปเดต progress ด้วย rate เก่า×dt ก่อนเปลี่ยน rate; เมื่อโจมตีลบ1 ไม่เพิ่ม Hit ย้อนหลังเมื่อ buff/Low Life เปลี่ยน
- ถ้า actor หยุดด้วย Stun/Shock/46 ให้หยุด progress ช่วงนั้นและ resume หลังหมด stop; status slow เปลี่ยน rate ทันที 02 ยกเลิกผลหยุด/slow ตาม contract ของมัน ตัวที่ spawn กลาง tick เริ่มสะสมโจมตีที่ tick ถัดไป
- คำนวณ gear/Core/base sheet หนึ่งครั้งต่อ tick และเมื่อ loadout/buff เปลี่ยน ใช้ runtime overlay สำหรับ HP conditional/stacks ไม่ buildCharacter เต็มทุก Hit
- เมื่อเวลาตรงกัน priority คือ (0) expire buff/control/ICD; (10) pending damage: DoT/Stagger/deferred; (20) DoT expiry/decay หลังจ่ายงวดสุดท้าย; (30) player primary action; (40) mob primary action; (50) queued secondary/trigger casts; (60) scheduled recovery จากนั้น tie ด้วย actorId,targetId,sequence
- Reactive recovery, stack changes, Auto Cleanse ทำ inline หลังผล Hit และตรวจ HP หมดก่อนฟื้น ทุก event ที่สร้าง child เก็บ sequence ถัดไป Trigger aura ไม่เกินหนึ่งครั้งต่อชนิดต่อ world tick และต้องผ่าน cooldown ของมัน Triggered cast ไม่กระตุ้น trigger aura ซ้ำ วง skill cooldown/buff เดิมยังใช้ tickSkills/globalSpeed หนึ่งครั้งต่อ world tick
- Snapshot RNG ใน save เดิม ใช้ seeded stream เดียว ห้าม Math.random การเปลี่ยน scheduling/crit ต่อเป้าหมายอาจเปลี่ยนผลเทียบตัวละครเก่าได้ แต่ new-format online/reload/offline ต้อง deterministic
- คิวโจมตีชั่วคราว rebuild จาก attackProgress ที่ tick boundary; คิวหนี้/DoT/ฟื้นฟูเก็บ dueAtUs/amount/source/target ไว้ใน save ไม่ serialize function

Hit = damage packet ตรง **ต่อหนึ่งเป้าหมาย** ของ basic swing หรือ active/triggered skill ตาม aggregation เดิม ค่า hits/projectiles ที่รวมในสูตรสกิลเดิมไม่แตกเป็น Hit ใหม่เพื่อเพิ่ม proc ฟรี Attack/Spell ใช้ basis/ladder ปัจจุบัน; basic ถือ Attack ยกเว้นอาวุธ magic-basis ถือ Spell การกด buff/aura ไม่ใช่ damage action

Direct primary Hit ที่ผ่าน accuracy/evasion/dodge และมี direct damage ก่อน mitigation >0 นับ Redline/Worthy Foe; 22 ต้อง actual HP loss >0; 43 ต้องมี physical หลัง conversion >0; 46 ใช้ actual HP loss จาก direct เท่านั้น Hit ที่ ES รับทั้งหมดจึงไม่ผ่าน 46 แต่ไม่กระทบ counter ที่ไม่ต้องเสีย HP Secondary/DoT/deferred/execute ไม่เพิ่ม hit counter ใด ๆ

### 7.2 Outgoing pipeline และ damage provenance

เพิ่ม typed packet ที่แยก physicalCritEligible, physicalNonCrit, magic, nativeElement[e], convertedElement[e], extraElement[e]; เก็บ sourceActionId, actorId, targetId, timeUs, nominalRate และ flags direct/secondary/dot/deferred, canCrit/canStatus/canLeech/canTriggerKillEffect

1. สร้าง raw parts จากสูตร basic/perPress เดิม: term ที่ปัจจุบันเพิ่มหลังคริ เช่น perTarget HP-pool physical term คงเป็น physicalNonCrit ไม่ย้ายเข้า crit pool ทำ per-target crit roll เพื่อให้ 19 ตรวจ Full HP แต่ละตัวได้ การนำสูตรลง adapter ต้องพิสูจน์ no-Keystone damage เท่าเดิมใน fixture เดียวกัน
2. เพิ่มคลัง10เป็นflat physicalCritEligibleก่อน G/crit (การใช้คลังอธิบายข้อ3) แล้วคูณ outgoing action multiplier G ของ 02/03/04/12/32/42/53 หนึ่งครั้งกับ parts ที่เกี่ยวข้อง 04 ใช้ 1+0.03×stacks ไม่ใช่ 1.03^stacks; counter ที่เพิ่งได้จาก Hit นี้มีผล Hit ถัดไป 32 ใช้ประเภทธุรกรรม damage action ก่อนหน้า, ครั้งแรกไม่โบนัส, สลับแล้วได้โบนัสทั้ง action รวมทุกเป้าหมายและ DoT ที่ action สร้าง; secondary ไม่เปลี่ยน previousAction อัปเดตpreviousActionหนึ่งครั้งหลังprimarydamageactionที่ผ่านcost/cancelchecks แม้ทุกtargetจะmiss; กดแล้วcostไม่ผ่านไม่อัปเดต
3. คลัง10ที่ใส่ในข้อ2ล้างเมื่อมี primary landed physical-capable Hit; ถ้าพลาดไม่ล้าง ถ้า 05 แปลงกายภาพ คลังยังใช้ได้และถูกแปลงตามปกติ
4. Cache P=physicalCritEligible+physicalNonCrit **หลัง bonus flat/G แต่ก่อน crit และ conversion** สำหรับ65; raw Flat F[e] มาจาก gear/tree/buff ที่ให้ flat จับคู่ธาตุได้ก่อนเปอร์เซ็นต์ ไม่รวม INT/Herald ที่ไม่ได้เป็น flat line และไม่รวมโบนัสที่ Keystone สร้าง ถ้า sumF=0 ไม่มี extra
5. คริเฉพาะส่วน native-eligible เดิม 13 ตัดสิทธิ์คริ; 19 force crit เมื่อ target HP==MaxHP ก่อน Hit มิฉะนั้นคูณ chance ด้วย0.5 จากนั้น clamp chance ตาม engine 31 ดู physical crit flag นี้ ไม่ทำให้ธาตุคริเอง
6. 20 ดึง positive crit bonus C ออกจาก direct physical แล้วสร้าง Poison total=C/4s; ไม่ต้องมี elemental power/Alignment ไม่ทอย proc แต่ต้องผ่าน Hit และ status immunity
7. 09 แบ่ง remaining physical Q เป็น direct0.5Q และ Bleed total1.0Q/4s; ไม่มี alignment/proc roll เพิ่ม, immunity ยังใช้ คู่05+09ห้ามไว้แล้ว ไม่ได้ลดส่วน Magic/Elemental เดิม
8. Conversion จาก aura เดิมและ05ใช้ pool เดียวกัน:05กิน physical ที่เหลือทั้งหมดไป Fire; เมื่อมี05 aura conversion ไม่แปลงซ้ำ แต่ native elemental อยู่ครบ จากนั้นสร้าง65 extra[e]=0.30×P×max(F[e],0)/sumF โดยไม่เพิ่ม P/Flat ใหม่ โบนัส extra ไม่คูณ Elemental%/Alignment damage ซ้ำ ใช้แนวทาง source-conversion และไม่คริ
9. ใช้ size/native outgoing modifiers เดิมที่ยังไม่ลงใน adapter เพียงครั้งเดียว แล้ว target Armour/Resistance ครั้งเดียวตาม type;31 crit ข้าม Resistance เฉพาะ elemental parts ทั้งหมดของ Hit นั้น; noncrit elemental×0.8 ก่อน Resistance Armour/Magic เดิมไม่เปลี่ยน
10. 21 split **หลัง mitigation**: จาก D จ่ายทันที0.6D และ queue0.4D×1.5 ที่+2s ยอด delayed ไม่เข้า Armour/Resistance/crit/status ซ้ำ ไม่เพิ่ม counters ถ้า target ตาย/ออกจาก encounter ก่อนถึงเวลาลบทิ้ง Leech อิง damage ที่จ่ายจริงแต่ละงวด ถ้า parent Hit อนุญาต และยังมีผู้โจมตีอยู่ ไม่ได้จ่ายล่วงหน้า
11. Native flat elemental status attempt ใช้เส้นทางเดิมหนึ่งครั้ง/ธาตุ;65ไม่เพิ่ม attempt;66เพิ่ม extra attempt แยกหนึ่งครั้ง/ธาตุ/Hitเมื่อ extra[e]>0 ผ่าน Alignment→proc เดิมและ immunity/stack/control budget เดิม Conversion จาก05ไม่ใช่ extra lane ห้ามถือว่า66ทำให้ conversion proc เพิ่มด้วย
12. After direct payment: execute08 ตรวจ threshold รวมBoss/Unique=5%; residual execute เป็น kill-only ไม่ leech/proc/counter แล้ว commit kill/rewards ครั้งเดียว

12 Worthy Foe เปิด bonus damage ตั้งแต่ Hit **หลัง**ครบ3 แต่ defense เปิดทันทีหลัง Hit ที่3; เปลี่ยน primary target เริ่ม count1ใหม่ การตาย/ไม่มี target clear; multi-target action นับเฉพาะ main target และไม่สลับจาก collateral. 22 ก็ผูก main target เดียว: ครบ5 landed Hits ที่เสีย HP จริง sum ยอด direct HP loss หลัง21 split; fifth reset counter แล้วสร้าง Fire blast=20%sum ใส่ target ถ้ายังอยู่ +ศัตรูอื่นที่ยังอยู่หนึ่งตัว เลือก HP ปัจจุบันต่ำสุด tie ID เปลี่ยน target/reset/death ก่อนครบ5ล้าง sum

Secondary22/27/53 ไม่ crit ไม่ลง status ไม่ leech ไม่เพิ่ม counter ไม่กระตุ้น trigger aura หรือ kill-explosion ต่อ แต่เครดิต XP/loot/quest/kill ครั้งเดียวตามระบบเดิม:
- 22 input เป็นยอดเสียจริงที่คูณ G มาแล้ว จึงไม่คูณ G/size/attack/spell ซ้ำ; target ใหม่รับ Fire Resistance หนึ่งครั้ง
- 27 ใช้ victim MaxHP×15%×global outgoing damage G ปัจจุบันหนึ่งครั้งแล้ว Chaos Resistance เป้าหมาย; ไม่ใช้ Attack/Spell/size multipliers อีก ต้องมี curse ของผู้เล่นค้างขณะตาย; direct/DoT/deferred/execute kill กระตุ้นได้ แต่ secondary kill ไม่กระตุ้น
- 53 ใช้ Armour ปัจจุบัน×20%×G (ไม่รวม ownDirectDamageMult0.5) แล้ว target Armour หนึ่งครั้ง สวนผู้โจมตีเดิมถ้ายังอยู่ ICD ใช้เมื่อส่ง retaliation สำเร็จ ไม่ยิงใส่ target ใหม่แทน
- Death/Push cleanup ด้านล่างป้องกัน delayed/counter ระบุตัวผิด เป้าหมายใช้ unique encounter actor ID ไม่ reuse index ของ group

### 7.3 Incoming, ES และ HP route

ขาเข้ายังคง **Physical/Elemental สองส่วน** จาก damageSplit เดิม ไม่มี incoming Magic ใหม่ แยก provenance ของธาตุ mob ไว้ตรวจ Chaos immunity:

1. Hit: Perfect Dodge/Evasion ตามเดิม;13ไม่เกี่ยวขาเข้า Native Block ทอยเฉพาะ physical;23ปิดทั้ง roll และ forced Block charge;44แทน roll ด้วย expected cut ตามข้อถัดไป CI ตัด Chaos damage ก่อนคำนวณ mitigation; damage immunity ไม่ใช่ status immunity (CI ยังติด Mark ถ้าไม่ได้มีภูมิสถานะนั้น)
2. Armour และ Block flat cut ใช้ physical เท่านั้น Resistance ใช้ elemental แล้ว damage_taken/Mark/03×1.15/12×0.8/47 elemental-Hit×0.7/Fortify×(1−0.05stacks) ทุกตัวครั้งเดียว 11 ลด Hit เท่านั้น
3. 44 ใช้ p=clamp(blockChance/100,0,1), expected cut=p×min(Armour/block_divisor,physicalAfterArmour); forced block charge ตั้ง p=1 และใช้ charge เมื่อมี physical ไม่สร้าง Block event/status-deflect ไม่มี10สะสมจาก44 Native Block10bank ใช้ยอด flat cut ก่อน damage_taken; cap20%fullMaxHP ไม่เอายอดเกราะทั่วไปมานับ
4. 35 subtract min(0.10×reservedHP35,0.30×D), prorate physical/elemental parts;16ใช้ charge หนึ่งเพื่อตัวคูณ0.6เฉพาะ Hit positive หลัง35 ถ้าถูก dodge/immuneจน0ไม่เสีย charge
5. Energy Absorb เดิมแปลงและ negate share ของ Hit หนึ่งครั้ง หลัง mitigation; prorate parts และเติม ES ก่อน route ส่วนที่เหลือ ห้ามรับ ES จาก damage immune/zero
6. ES route: ปกติทุก direct Hit เข้า ESก่อน;47 **เฉพาะ elemental** เข้า ES physical bypass;51 ESสุดท้าย=0, ห้าม bank/ฟื้นES;55ทุก nonimmune damage รวม Poison/Bleed ต้องเข้า ESก่อน
7. 57 เมื่อ ES ลดจาก >0 เป็น0เพราะ Hit ให้ทิ้ง overflow ของ **ส่วนที่ eligible เข้า ES เท่านั้น** ไม่ทิ้ง physical bypass47หรือ DoT ต้องเคยกลับ ESเต็มและผ่าน8sจากgateครั้งก่อน; arm ค้างจนใช้ ไม่ arm จากการลดMaxESลงมาชน currentES Initial new character/หลังCampที่ ESเต็ม arm ได้
8. 33 ใช้ positive unreserved Mana จ่าย30%ของ HP-bound damage ที่เหลือ1:1 ใช้ได้กับ DoTด้วย ไม่กู้52 ไม่ใช้reserved ไม่ถือเป็น skillcost และไม่ให้58 proc
9. 51 ลดเฉพาะส่วน HP damage ใต้30%fullMaxHP: A=min(D,max(currentHP−0.30MaxHP,0)), B=max(D−A,0), applied=A+0.5B ใช้กับ Hit/DoT แต่ไม่ลด Stagger debt งวดซ้ำ
10. 56 ใช้เฉพาะ HP-bound enemy Hit หลัง33/51, จ่าย60%ทันที และอีก40%เป็น5งวดเท่ากันที่+1..5s หนี้เป็น committed HP loss ไม่ผ่าน33/51/56/ES/mitigationอีก ล้างสถานะไม่ได้ ไม่ใช่ DoT
11. หัก HP แล้วถ้า<=0ให้ latch **Push ตามระบบเดิม ไม่เพิ่ม death/permadeath** ก่อน leech/bank/heal ใด กรณี55มีHP1 ส่วนเกินESเป็นHPdamageปกติ ถ้าHPยัง>0อยู่แม้เป็นเศษก็ยังไม่ Push (ไม่ round ขึ้นเป็น1damage)
12. Actual HP/ES loss เท่านั้น reset idle/recharge และเพิ่ม11stack/53retaliate (Hit)40recoup (enemy Hit HPส่วนที่จ่ายจริง); DoT reset idleแต่ไม่ให้11/53/40 HPcost/reserveไม่กระตุ้น “ถูกศัตรูทำร้าย”
13. Hit ที่ landed ยังใช้ native status rules เดิมแม้ ES รับหมด Native Block status-deflect ยังคงเดิมแต่44ไม่มี deflect; statuses ถูกวางก่อน59ล้าง ไม่ทอยสถานะอีกเพราะแยกdamageparts

Incoming DoT ไม่ roll hit avoidance/Block ไม่ใช้35/16/47Hit reduction/56/57/EnergyAbsorb; charge ลบ unconditional-effect ของสกิลเดิมยังกัน DoT payment event ได้ โดยรวมทุก family ที่ due timestamp เดียวกันเป็น event เดียวก่อนใช้ charge ปกติ Burnเข้าES Poison/Bleedเข้าHPตามเดิม **55 override ให้ทุกnonimmuneDoTเข้าES**;47 Burnยังเข้าESแต่ไม่คูณ0.7 DoTไม่ผ่านArmour/Resistanceซ้ำ (ตามระบบเดิม) แล้ว33/51ตามลำดับที่ใช้ได้

ตัวอย่าง40+56: HP-bound Hit100ไม่มี mitigationอื่น -> เสีย60ทันที recoup24; หนี้5งวดงวดละ8ให้recoup3.2ต่อครั้ง รวมrecoup40ไม่ใช่64 Debtไม่มี source-victim แล้ว (encounterจบ) ยังจ่ายอยู่แต่หยุดเมื่อPush/Respec

### 7.4 Regen, leech, costs และ charges

แยก recovery tags: naturalHpRegen / naturalEsRegen / manaRegen / potion / skillHeal / leech / recoup / campRecovery ไม่ใช้ boolean “healing” ตัวเดียว

- 07และ36ปิดเฉพาะ naturalHpRegen ไม่ปิด potion/directheal/recoup;40ปิด Life Leech ทุก destination รวมESที่45redirect แต่45ยังได้ ManaRegen→ES จึงซื้อ40+45ได้
- 45 Life Leech เลือก destination=ES และ ManaRegen ไปES ไม่คูณ ESregen% ซ้ำ ManaPotion ยังไปMana HPPotionยังไปHP 52คูณ ManaRegen×2เมื่อ negative ก่อน45redirect ถ้าเลือกคู่45+52โดยไม่มีMana recoveryอื่นหนี้ไม่ลด เป็นtradeoffที่แสดงในtooltip ไม่กู้Manaให้เอง
- 07 excess Life Leech เก็บ bank ตามปลายทาง cap20%fullMaxPool, FIFO expiry10sจากรับแต่ละส่วน mergeเฉพาะexpiryเดียวกัน ใช้fillgapหลังdamage/recoveryได้เฉพาะยังไม่Push bankไม่ใช่damage shield และไม่ย้ายไปHPเมื่อ45ยังอยู่ ไม่เก็บoverhealจากแหล่งอื่น
- 61เพิ่ม intrinsic LifeLeech2% รวมกับLifeLeechเดิม ย้ายสิทธิ์ทั้งหมดจากHitไป actualDoTdamageเท่านั้น (รวม09/20/66/60ถ้าสถานะย้ายมาถือplayerเป็นowner); actual overkillส่วนเกินไม่leech 45redirectได้ 40+61ห้ามอยู่แล้ว
- 17 HP potion nominal heal×1.5 เป็น4งวดที่+1..4s, excessเมื่อHPเต็มสูญเสียแต่งวดที่เหลือยังอยู่ บล็อกการกิน **HP potion** ใหม่ทั้งmanual/autoถ้ายังมีstream ไม่consumebottle/cooldownเมื่อปฏิเสธ ManaPotionไม่เปลี่ยน Hybridที่มีHPcomponentต้องผ่านgateเดียวกันและส่วนManaจ่ายทันที
- 24แทน naturalESrechargeด้วยburst50%MaxES หลังไม่มีactualHP/ESloss3s และซ้ำทุก3s ไม่มีregenระหว่างburst คูณ naturalESregen modifiers จากค่าฐานก่อนเปลี่ยนเป็นburst ดังนั้น58ลดburstเป็น25%โดยไม่มีmodifierอื่น immediate-recharge skill ข้ามidle gateได้แต่ไม่ลดrepeat3s DirectES/leechยังทำงาน
- 58ฟื้น20% **funded skillManaSpend** เท่านั้น: spend record แยก debited/funded/borrowed; funded=min(cost,max(currentUnreservedMana,0)) ไม่รวมยอดหนี้52, HPcost37, reservation,33damageMana
- 52มี debt floor=−0.5×usableMaxMana ณ ตอนกู้ ในการจ่ายที่ทำให้Manaติดลบให้บันทึก manaDebtLimitAtBorrow เป็นยอดlimitบวกของครั้งนั้น การกด positiveManaCostต้องเริ่มจากMana>=0และจบไม่ต่ำกว่าfloor; freecastsยังได้เมื่อnegative Regen×2จนกลับ>=0แล้วใช้ค่าปกติ ขณะยังติดลบคงlimitที่บันทึกไว้จนคืนหนี้ถึง0; MaxMana/usableที่เปลี่ยนภายหลังไม่ลด/ยกหนี้ย้อนหลังและไม่เพิ่มวงเงินกู้ซ้ำเพราะpositivecostถูกบล็อกอยู่แล้ว เมื่อMana>=0ล้างsnapshotและการกู้ครั้งใหม่ใช้usableMaxใหม่ ห้ามclampล้างหนี้
- 37แปลง **Mana part ของ skillcost** หลังnativecostmodifiersเป็นHP1:1 รวมกับHPcostเดิมในatomicpayment ต้องเหลือHP>=1 ไม่ผ่านES/mitigation/recovery-on-damage ถ้า55อยู่castที่ต้องจ่ายHPปฏิเสธ (pair37ถูกห้ามแล้ว แต่อื่นที่nativeHPcostก็ต้องตรวจ) ฟรีcastยังได้
- 04drainทุก1sเริ่มหลังมีRageครั้งแรก อิงcurrentstacks×0.5%fullMaxHP ไม่ฆ่าตัวเอง ถ้าจ่ายครบไม่ได้โดยเหลือ>=1 จ่าย0และclearRage; idle3sไม่มีlandedprimaryHitclearทั้งหมดและยกเลิกdrain timer ได้stackใหม่เริ่มclockใหม่
- 16ไม่มีHP/ESlossสะสม1ทุก2sจากidle start max5 เจ็บแล้วrestartcharge timerที่now+2 แต่chargeเก่ายังอยู่จนใช้ HPcost/33Manaไม่reset;11ได้stackหลังHitและลดHitถัดไป resetทั้งstackหลัง4sไม่มีactualHP/ESloss
- 23 Evasion success (ไม่ใช่PerfectDodge)ฟื้นmin(3%Evasion,10%MaxES), ICD1sเริ่มเมื่อมีrecoveryopportunity แม้ESเต็มไม่สร้างbank
- 36ทุก5sจากacquisition/respec-repurchase clearBurnPoisonBleedพร้อมheal15%fullMaxHP clampusable ทำหลังdamagepriority ไม่รอดจากfatalHitด้วยhealย้อนเวลา

42 ใช้ basic-rate r หลังทุกspeed/slow/conditional modifierแต่ก่อนcap; actualrate=min(r,1), basicdamage multiplier=max(1,r/1) กับทุกdirectpartของbasicเท่านั้น ก่อนcache65/crit ไม่เพิ่มactive/trigger skilldamage และไม่เร่งอาวุธที่r<1

### 7.5 Aura/reservation และ static folds

ให้ FullMaxHP/FullMaxMana เป็นmaxสุดท้ายก่อนreserve, Usable=Full−sumReservations; HP/Mana healing clamp Usable, currentHP<=0.50FullMaxHPคือLowLife **55ไม่LowLifeเสมอ** ค่าcostfloorยังเป็น1HP ไม่ลดMaxHPเพื่อทำLowLife

1. 01ทำหลังArmour/Evasion% final: Armour+=EvasionRating×1, EvasionRating=0, chanceEvasion=0 PerfectDodgeไม่ถูกลบ
2. 06คำนวณ raw resistance base[e]=(common+specific[e])×existingnativeMult ก่อนcap Cold'=0.5baseCold+0.5baseFire และLightningเช่นกัน Fire/ธาตุอื่นไม่เปลี่ยน จากนั้นใช้capเดิมทีละธาตุ ไม่copycap ไม่บวกallResสองรอบ
3. 34 reserve40%FullManaคงที่ไม่รับส่วนลด64 เพิ่มfinalES **หลังbaseES%** เท่ากับ2×reservedMana34 ไม่ให้ES%คูณซ้ำ;35 reserve25%FullHPคงที่เช่นกันและใช้เฉพาะยอดจาก35คำนวณflatcut ไม่รวมauraHPreserve
4. 54เลือกpoolเป็นรายaura สัดส่วนต้นทางเท่าreservationManaเดิม ไม่มีcostmultHPเพิ่ม การเปลี่ยนpoolไม่castใหม่/ไม่resetCD; reservation54ไม่เปลี่ยนHPmax เมื่อไม่มี54 auraใช้Manaทั้งหมด
5. 64 N=จำนวนownedactiveauraจริง รวมtriggeraura แต่ไม่รวมbuff/status, bR=min(.30,.05N), bE=min(.30,.05N). Aura reserve original×(1−bR) ไม่ปัดก่อนรวม Fixed34/35ไม่ถูกลด
6. หลังnative effectsAt/skilllevel: aura op:addใช้Math.round(value×(1+bE)); op:multใช้1+(value−1)×(1+bE) ทั้งบวกและลบ; cap field เดิมไม่ถูกขยาย AuraEffectขยายstat/debuffและdamage_conversionได้ แต่ **ไม่ขยาย trigger_cd_sec/cast_mana_mult/cast_damage_mult**, boolean/rules, cost, duration, threshold, ICD, reservation หรือAuraResonanceเอง ตัวอย่างHaste1.15→1.195ที่bE=.30; triggerCD1/cost2/damage.7คงเดิม
7. Toggle/turnoff/changePool/gear change ที่เปลี่ยนpoolใช้ candidate **setทั้งหมด** ก่อนคำนวณN, maxpool, reservations, currentHP/Manaใหม่ แล้วvalidateพร้อมกัน Evaluateauraeffects→baseMaxPools→fixed34/35reservation→34finalESตามลำดับ ไม่วนเอาreservedamountไปเพิ่มN Turnoffบางตัวอาจเพิ่มreservationตัวอื่นจนเกินให้reject ไม่ปิดเพิ่มเงียบ ๆ ให้คำสั่งdisable-all/set-emptysetเป็นทางออกเสมอ
8. เปิดreserveหักceiling/clampcurrentลงได้ แต่ไม่ให้currentHP<1/usableHP<1 หรือusableMana<0 (reserveMana100%ได้=0แต่หนี้ต้อง0); คืนreserveไม่healเอง Rejectไม่เปลี่ยนstate Newformatloadinvalidsetต้องerrorไม่greedyปิดaura
9. Full respecclearactiveaura/poolchoicesและKeystonecombatstateทั้งหมด แต่คงlearnedskills/CDเดิม รวมทุกcost/refundกับcandidatevalidationในtransactionเดียว ถ้าnativebuffยังมีHPcostหรือลดMaxHPให้ตรวจตามกติกา55ด้วย

### 7.6 Status, curse, control และ DoT snapshots

Canonical element order ใช้ลำดับ engine.json elements.status_of: Fire→Burn, Cold→Chill, Lightning→Shock, Poison→Poison, Chaos→Mark, Earth→Crippled อ่านจากdataไม่คัดลอก procchance .20/stackcaps ลงtreeparams

- Control ต่อtargetใช้ token bucket capacity1s, initial1s, recharge engine.status.mob_control_budget_pct (=.15s/sปัจจุบัน) รับstopได้เมื่อtokenพอสำหรับ **ส่วนที่ขยาย stopUntil** ทับช่วงเดิมไม่จ่ายซ้ำ ไม่ได้เพิ่มงบแยกต่อsource Stun/Shock/46ปกติใช้bucketเดียวกัน Native skillที่มีbypasses_control_capอย่างชัดแจ้งคงข้อยกเว้นเดิมของskillนั้น ไม่ส่งต่อflagให้46/66หรือsecondary เด็ดขาด 46หยุดattackprogress.5s ไม่หักattacktimerลอย ๆ
- 02เก็บสถานะที่ควรมีไว้ตามexpiry แต่ไม่หยุดจากstunและไม่ลดASPDจากslow ขณะมีeffectเหล่านั้น damage×.75ครั้งเดียว แม้ซ้อนหลายชนิด Slowที่ลดAccuracyยังลดAccuracyตามเดิม Shockไม่ใช่stunจึงยังหยุดได้ 59ล้างแล้วpenaltyหาย
- 28หนึ่งcurseต่อvictim, ลงชนิดใหม่ลบ **ทุกlineจากcurseเก่า** แล้วreplaceatomic คูณadd×1.75/multdistancefrom1×1.75 ไม่ขยายduration/cap/controlbudget Nativecurseร่วมกับskilllevelตามเดิม 30/43เป็นkeystonedebuffไม่กินcurse slot
- 30ดูpreMitElementalpartsที่เป็นบวกและlandedprimaryHitเท่านั้น เลือกธาตุยอดรวมnative+converted+extraมากสุด tiecanonicalorder หลังHitลงown+10/other−20points4s ผลใหม่แทนเก่า ห้ามมีผลต่อHitที่สร้างตัวเอง Resistancefloor0/capตามengineเดิม ไม่เพิ่มnegativeResระบบใหม่
- 43แต่ละlandedphysicalHitลด5%initialArmourของactorinstance max60% แล้วคำนวณร่วมกับarmourcutsอื่นตามclampเดิม ที่now+4sจากphysicalHitล่าสุดreset; อย่าเอาArmourหลังถูกทำลายมาเป็นฐานทบ
- 59เมื่อstatusfamilyถูกเพิ่มสำเร็จและICDพร้อม ลบfamilyนั้นทั้งหมดทันที ICD6s ถ้าimmuneหรือapplicationถูกปฏิเสธไม่consumeICD ไม่ล้างHPcost/Stagger/negativeMana/curseที่ไม่ใช่negative-statusfamilyผ่านgeneric“cleanse everything”

DoT instances เก็บ {family,lane,dps,budgetDps,appliedAtUs,nextPayAtUs,expiresAtUs?,decayGroupId,sourceId}; laneเป็นnative/extra/critical/transfer ค่าดาเมจsnapshotตอนลงรวมattackerGแล้ว ไม่คูณattackerstats/Armour/Resistance/sizeอีกตอนจ่าย:
- งวดทุก1sจากappliedAtUs งวดสุดท้ายจ่ายส่วนที่เหลือให้ยอดรวมเท่าที่ประกาศ เก็บamountRemainingสำหรับ09/20และdebt ใช้residualงวดท้ายแก้float drift
- NativeBurnใช้ฐานalignedDPSเดิม×burn.k, stackcapเดิม5, duration5s; nativeapplication refreshnontransferBurnexpireตามเดิม transferredinstancesเก็บexpiryของมันไม่refresh
- NativePoisonใช้ฐานเดิม×poison.k, cap10; nativeมีdecaygroup8sที่ไม่resetเมื่อเพิ่มstack ลบoldestเมื่อdecay;20เป็นtimedPoison4sไม่ร่วมclockdecayธรรมชาติแต่แชร์familycap10
- Cappedfamiliesเก็บinstancesที่dpsสูงสุด เมื่อเต็มให้แทนweakestถ้าใหม่แรงกว่า tieแทนoldest ถ้าใหม่อ่อนกว่าไม่ใส่ แต่nativeBurnยังrefreshnontransferTTLได้ตามกติกา ห้ามเพิ่มbudgetจากinstanceที่ถูกreject
- Bleedไม่stack เก็บDPSที่แรงกว่าและrefreshremainingdurationเป็นdurationของcandidate(nativeเดิม5sหรือ09สี่วินาที);09ไม่คูณnativeBleedDPS capซ้ำ เพราะระบุtotalของมันแล้ว
- 66extraStatusBasis[e]=extraDamagePreMit[e]×nominalRate ไม่คูณAlignmentdamageอีก แต่Alignmentยังเป็นโอกาสทอย; basicใช้actualbasicrateก่อน42cap? **ใช้หลัง42cap พร้อมextraต่อHitที่ถูก42เพิ่มแล้ว** จึงไม่ยกDPSซ้ำ Active/triggercastใช้nominalRate=1/max(1,ceil(effectiveCD/globalSpeed)) ตามworldrotationไม่ใช้จำนวนtargetทำDPSเพิ่ม
- 20critical budgetDps=C×nominalRate โดยCคือcritbonusที่ดึงออก; C/4คือPoisonDPS ไม่มีElementalPowerก็ทำงาน
- ElementalDoTcap=engine.status.dot_cap×(maxActiveNativeBasis + maxActiveExtraBasis + maxActiveCriticalBasis + maxActiveTransferBasis) ใช้maxต่อlane ไม่sumทุกstackหรือเก็บhistoricalmaxเมื่อinstanceตายแล้ว แบ่งscaleBurn/Poison/Erosionร่วมกันตามสัดส่วน Bleedอยู่นอกcap เช่นเดิม
- Erosionที่เกิดผ่านสกิลเดิมยังอยู่lane native ไม่เพิ่มelementชนิดที่7 เก็บstatus-owner/sourceเพื่อไม่เสียkillcredit
- 60เมื่อprimarycritสำเร็จ เลือกfamilyบนผู้เล่นที่ย้ายได้/targetไม่immuneโดยappliedAtเก่าสุด tieBurn,Poison,Bleed ย้ายทั้งfamily (รวมหลายinstances) ไปvictimเป็นlane transfer **คงdps/budget/nextpayment/expiry/decaygroups** ถือplayerเป็นownerสำหรับkill/leech ไม่re-scaleจากstatsผู้เล่น
- Targetmergeตามfamilycapได้ตามปกติ เมื่อcompatibleapplicationรับได้จึงลบsourcefamilyและconsumeICD4s แม้entryอ่อนถูกcapfilter เป้าหมายimmuneให้ลองfamilyถัดไป ถ้าไม่มีcompatiblefamilyไม่ลบ/ไม่ใช้ICD ไม่ย้ายMark/Chill/curse
- ตัวอย่าง BurnDPS10เริ่มt0หมดt5 ย้ายt1.5: sourceจ่ายแล้ว10ที่t1, targetรับอีก40ที่t2/3/4/5 ไม่เริ่ม5sใหม่และไม่สร้างextraงวดทันที

ทุก native skill writer/reader ของstatus (setStacks/setErosion/placeStatus/poisonBurst/poisonHold/cleanse/status-display) ต้องผ่านinstance adapterเดียวกัน setStacksแทนจำนวนinstancesตามsemanticsเดิม ไม่เก็บaggregateสองชุดที่ต่างกัน; UI aggregate stacks/perSec/secLeft เป็นderived view PoisonHoldหยุดdecaygroupตามnativehold ruleโดยไม่เลื่อนtimedPoison20/expiryของtransfer; Mark/Chill/Crippled/curseที่ไม่ใช่DoTยังใช้ค่าปัจจุบันของมัน ไม่ถูกย้ายเป็นDoTโดยคาดเดา

### 7.7 State lifecycle, Push และ new-character persistence

เพิ่ม player.passiveTreeVersion=tree.spec.version และ expose tree.version; finalv3characterimportต้องใช้envelopeSCHEMA_VERSIONปัจจุบันและpassiveTreeVersionตรง3 **ก่อน** legacy migration/normalization ไม่มีunknownnodefilterที่กินallocationเงียบ ๆ คงglobalSCHEMA_VERSIONของaccount/save envelopeถ้าไม่จำเป็นอย่าbumpแล้วทำaccountเก่าหาย ความไม่รองรับcharacterเก่าให้แจ้ง“ตัวละครนี้ใช้ passive tree รุ่นเก่า กรุณาสร้างตัวละครใหม่”ไม่เขียนทับslot/account

เพิ่ม GameState.playerStatuses และ GameState.keystoneRuntime เป็นcanonical saved state จากnewGame; MobStatusStoreเก็บper-instance/actorstateของศัตรู Game/Appไม่เก็บplayer statusesแยกในlocalvariableอีก ย้าย tick/catchUp/catchUpAsync ไปอ่าน s.playerStatuses และปรับทุกcallsite/testภายในrepoที่ส่งstatusesargumentเดิม UIอ่านderivedreferenceและresetผ่านstatefieldเดียว Loadไม่ตั้งstatuses={}ทิ้งค่าที่เพิ่งโหลด

Currentformatreaderตรวจ Q/ranks/wallet/currency/pairs/allocationpath, auraassignment, allfinitepoolvalues, negativeManaตาม52และmanaDebtLimitAtBorrow, runtimestate/timers/targetrefs ข้อมูลจำเป็นหาย/invalidให้error ไม่resetเพื่อให้loadผ่าน ไม่มีRNGdrawระหว่างload statusinstancesและpendingqueuesทุกชนิดround-tripครบ

Offensivependingdamageต้องชี้actorinstanceเป้าหมายที่ยังอยู่; playerHPdebt/recoupเก็บsourceเพื่ออธิบายเหตุการณ์ได้แม้mobนั้นตายแล้ว ไม่rejectหรือยกหนี้เพราะsourceไม่อยู่ในgroup Q/wallet/amount/timestampsเป็นfinite safe numbers; countsและtimeUsเป็นsafe integers ไม่เติมfieldจำเป็นจากdefaultเพื่อกลบcorruptnewformat

- CombatstateมีlastHit/lastLoss/lastAction, stacks/counters/bank/charge/armedflags, controltokens/stopUntil, triggerICDs, potion/recoup/debt/deferredqueues และper-instanceDoTอยู่ในschemaที่savewriter/readerใช้ร่วมกัน เส้นทางที่resetencounterต้องเรียกcleanupเดียว
- ไม่มีdeathใหม่ HP<=0ระหว่างeventให้stopการโจมตีและlatchPushทันที จากนั้นเรียกnativePush/dungeonescrow/mapwalk/presetcleanupตามเดิมไม่ข้ามbranchเหล่านั้น ห้ามleech/healทีหลังในtickชุบกลับก่อนPush
- Pushล้างnegative statuses, targetcounters, offensivependingdamage, bank, Rage/Fortify/Bark, hpdebt/recoup/potionstreams, previousAction/controlstateและgatearm เป็นfightstate; คงnegativeMana/ICD59/53/60/23/57remainingและnativecooldownsไม่resetเพื่อเอาฟรีproc Auraactivationยังอยู่ถ้ายังlegal
- CampRecoveryเป็นแหล่งฟื้นแยก ใช้HPregenค่าปกติ **ก่อน**07/36disable, burn/shockcombatpenalties แต่หลังstatสูตรพื้นฐาน ถ้าค่า<=0ใช้1HP/sเป็นdatafallbackในtree.mechanics.camp_min_hp_per_sec=1; nativecamp×8และdurationเดิมอ่านผ่านhelperนี้เพื่อไม่Infinity
- CampexitเติมHPถึงusableHPและESเต็ม ไม่ล้างManaDebtด้วยการclamp ไม่chargebank/proc/recoupจากcamp;55จึงไม่วนPushทันทีจากESว่าง Arm57เมื่อfullแต่ยังต้องพ้นICDเดิม
- Normalencounterจบล้างtarget-specific state/pendingdamageของvictims; hpdebt/recoup/potion/bankของplayerดำเนินต่อได้จนexpire ไม่ล้างหนี้เพราะเดิน/เปลี่ยนgroup Runtimeattackprogressคงตามเกมเดิมเมื่อแค่เปลี่ยนtarget
- Fullrespecล้างKeystonefightstate/auraactivationแต่รักษาoutstanding ManaDebt ถ้าจะเอา52ออกขณะMana<0ให้ปฏิเสธrespecพร้อมเหตุผลจนคืนหนี้ ห้ามให้respecล้างหนี้หรือclampเป็น0 ICDของnative skillsคงอยู่
- เวลาcamp/offlineยังเดินICD/expiryตามsimulationclock แม้campไม่tickcombatdamage; catchUpใช้combatclockเดียวกัน ไม่ทำสูตรofflineอีกชุด ยังคงAFKloot/travel/limit behaviorที่repoกำหนด ไม่เรียกร้องonline/offlineเท่ากันในระบบที่ตั้งใจต่างกันอยู่แล้ว
- รอบ36ยังคงphaseทุก5sผ่านPush/Camp แต่ข้ามการheal/cleanseที่dueในCamp ไม่เก็บงวดย้อนหลัง; cooldown/phaseเหล่านี้เป็นpersistenttimersแยกจากfightstateที่ถูกclear ออกจากCampเริ่มidleสำหรับ16/24ใหม่ ไม่ได้Barkหรือbankฟรีระหว่างCamp

## 8. Acceptance fixtures — ทุก Keystone ต้องพิสูจน์ effect จริง

ทุกแถวต้องมี test ที่เรียก sheet/runtime path จริง ไม่ทดสอบด้วยการอ่าน params อย่างเดียว นอกจาก positive case ให้มี absent-keystone/control case และ boundary/immune/ICD case ตามแถวนั้น Fixtureระบุค่าเพื่อพิสูจน์สูตร ไม่บังคับข้อมูลเกมตลอดไป

| Ref | ผลที่ต้องสังเกตได้ใน fixture |
|---|---|
| 01 | Armour100/Evasion200 → Armour300/Evasion0; PerfectDodgeเดิม |
| 02 | Stunยังมีexpiryแต่ไม่หยุด; damage100→75; ล้างstatusแล้ว100 |
| 03 | HP500/Max1000ได้damage140/speed1.25; HP501ไม่โบนัส; taken100→115ทั้งสองกรณี |
| 04 | 10stacks damage100→130, drain50HP/sเมื่อMaxHP1000; HP50จ่ายไม่ได้clearRageไม่Push |
| 05 | P100 crit×2 →Fire200/Phys0; ไม่doubleconvertกับaura |
| 06 | rawFire60/Cold20/Lightning40→60/40/50 ก่อนcap; Firecapเพิ่มไม่copy |
| 07 | MaxES500+45, leechoverflow150เก็บ100; ใช้/expireถูกFIFO ไม่ช่วยfatalHit |
| 08 | NormalHPเหลือ15%execute; Boss15%ไม่executeแต่5%execute; ไม่มีleechจากresidual |
| 09 | Q100 →direct50+Bleed4×25; ไม่มีphysicalหลัง05เพราะpairปฏิเสธ |
| 10 | MaxHP1000bank≤200; Blockflatcut30bank30; nextphysical100→130ก่อนcritแล้วbank0 |
| 11 | 5stacks Hit100→75; Hitที่ได้stackแรกยัง100; idle4sล้าง |
| 12 | สามHitแรกdamage100; Hit4=130, incomingจากvictim×.8; targetอื่นreset |
| 13 | Accuracy0ยังlandเมื่อไม่มีDodge/Block; RNGcritไม่ทำดาเมจเพิ่ม |
| 16 | 2sได้1charge; Hit100→60ใช้1; dodgeไม่ใช้; เจ็บrestarttimerไม่ล้างchargeอื่น |
| 17 | Potion100→4งวด37.5; เต็มก่อนงวด2ก็ไม่ล้างงวด3/4; ขวดใหม่ปฏิเสธไม่consume |
| 19 | Fulltarget nativephysicalcritเสมอ; nonfullchance20%→10%; physicalcrit-ineligibleไม่ถูกforce |
| 20 | P100 critbonus100 →direct100+Poison25/s4sแม้Elem0; poisonimmuneได้direct100ไม่มีDoT |
| 21 | postMit100→60ทันที+60ที่2s; targetตายก่อน→ยกเลิก; ไม่doublemit/proc |
| 22 | 5directHPHitละ100 →Fire100ต่อtargetที่ยังอยู่และอีก1ตัว; DoT/deferredไม่บวกcounter |
| 23 | Evasion1000/MaxES200 →recover20ไม่ใช่30; twoevades.2sได้ครั้งเดียว; PDodgeไม่proc |
| 24 | MaxES100 idle3s→50อีก3s→50; มี58ได้25ต่อburst; damageใหม่reset |
| 27 | CursedvictimMaxHP1000→Chaos150ก่อนtargetRes; killจากblastไม่chain |
| 28 | Curseadd20→35; mult.8→.65; castnewcurseลบlineเก่าทั้งหมด |
| 30 | HitFire10/Cold20→Coldres+10อื่น−20หลังHit; tieเลือกcanonical; negativefloor0 |
| 31 | Physcrit+Elem100เจอ50res→Elem100; noncrit→40; ไม่มีElementalcritซ้ำ |
| 32 | Attack,Attack,Spell,Spell,Attack →G1,1,1.35,1,1.35; buffpressไม่reset |
| 33 | HPbound100/Mana20 →Manaเสีย20 HPเสีย80; Mana−10ใช้เพิ่มไม่ได้ |
| 34 | FullMana1000→reserve400, finalES+800;64ไม่ลด400/ไม่คูณES%ซ้ำ |
| 35 | FullHP1000 reserve250; Hit100→75, Hit20→14 (cutcap6) |
| 36 | ครบ5sclear3families+heal150ที่FullHP1000; naturalHPregen0แต่potionยังได้ |
| 37 | ManaCost30→HP30; HP30ปฏิเสธ, HP31จบ1; reserveauraยังใช้poolเดิม |
| 40 | HPHit100→recoupรวม40/6s; ES-onlyไม่recoup; Hit+56รวม40เมื่อหนี้ครบ |
| 42 | actualrate4/s→1/s damage×4; rate.6/sยัง.6/damage×1; รวมSlowก่อนคำนวณ |
| 43 | initialArmour1000ครบ12physicalHits→400; Hit13ไม่ต่ำกว่า400; idle4s→1000 |
| 44 | Armour100/block50%/physAfterArmour100/divisor10→95ทุกHit; ไม่มีBlockevent |
| 45 | LifeLeech10+ManaRegen20→ES30, HP/Manaไม่เพิ่ม; ManaPotionยังMana |
| 46 | HPHit50/targetMax1000ขอstop.5; HPHit49ไม่ขอ; tokenไม่พอไม่bypassbudget |
| 47 | Phys100+Elem100→Phys100ข้ามES, Elem70เข้าES; Burnไม่คูณ.7 |
| 51 | MaxHP1000/current400/HPdamage200 →loss100+50=150; current200→loss100; ES0 |
| 52 | usableMana100/current10/cost40→−30; costถัดไปปฏิเสธ; floor−50; regen10→20 |
| 53 | Armour1000สวน200ก่อนtargetArmour, ICD.5; ownHit100→50; DoTเข้าไม่สวน |
| 54 | Aurareserve40%กับHP1000→usable600; ย้ายกลับManaไม่healHP; MaxHPยัง1000 |
| 55 | HPmax1/ES100, Poison20→ES80/HP1; ChaosHit200→ไม่เสียpool; ไม่LowLife |
| 56 | HPbound100→60ทันที+5งวด8; cleanseไม่ล้าง; แต่ละงวดไม่ถูกrouteซ้ำ |
| 57 | ES50/eligibleHit100→ES0 HPไม่เสีย; Hitถัด100เข้าHP; fullก่อน8sยังไม่arm |
| 58 | Mana10/cost40+52→funded10/borrowed30, ES+2ไม่ใช่8;37ไม่ให้ES |
| 59 | Burnplaced→clearBurnทั้งfamily/ICD6; PoisonถัดมาในICDคงอยู่; immuneไม่consume |
| 60 | Burn10/sหมดt5ย้ายt1.5→จ่ายt2..5ที่targetรวม40; immuneไม่ลบsource/ไม่ใช้ICD |
| 61 | actualDoT100→HPleech2โดยไม่มีแหล่งอื่น; Hit100→0;45เปลี่ยนปลายทางES |
| 64 | N6 aurareserve40→28, effect+30%; Haste1.15→1.195; triggerCD1คง1 |
| 65 | P100/Ffire10/Fcold20→extra10/20รวม30; crit×2ยังextra30;05ไม่ทำฐานหาย |
| 66 | forcedAlignment+procสำเร็จ nativeFire1attempt+extraFire1attempt; extraColdเพิ่มอีก1, ไม่ต่อstackวน |

Integration ที่ต้องเพิ่ม (ชื่อไฟล์ test เลือกใน game/tests ตามพื้นที่เดิมได้ ไม่ต้องสร้างหนึ่งไฟล์ต่อหนึ่ง node):
- 03+54: HPreserved>=50%รักษาLowLifeโดยMaxHPไม่เปลี่ยน; togglesetที่reserveเกินrejectทั้งtransaction
- 05+65+66: PhysicalP100/crit×2/FlatFire10Cold20 → convertedFire200+extraFire10Cold20; extra30ไม่คริ, nativeFlatdamageคงแยกและstatusแต่ละlaneไม่doubleproc
- 55+34+45+57+58: compatible; Chaosimmuneไม่มีabsorbESฟรี; Poisonเข้าES; ManaCostfundedให้ESแต่borrowedไม่ให้; gateไม่กันDoT
- 33+52+56+40: Manaใช้positiveเท่านั้น, Staggerไม่routeซ้ำ, recoupรวม40%ของHPที่จ่ายจริง ไม่จ่ายจากMana/ES
- 20+61 และ 09+61: ไม่มีElementalPowerก็ทำDoT/leechได้; 07+45+61 bankใช้EScapและexpiryจริง
- 59+60: ล้างfamilyไปแล้วไม่มีย้าย; ถ้าICD59อยู่จึงย้ายfamilyที่ยังอยู่ได้; immuneไม่consume60ICD
- 24+58: burst50%→25%ด้วยmodเพียงครั้งเดียว; immediate-rechargeไม่รัวburstในทุกHit
- 42+03+02: capbasicrateและslow/lowLifeเปลี่ยนกลางtickโดยไม่replayattackprogress; ส่วนเกินแปลงdamageเพียงครั้งเดียว
- pairwise table: แต่ละคู่ปฏิเสธทั้งสองpurchaseorder/import; คู่ที่ซื้อได้ตัวอย่างต้องผ่าน ไม่มีtransitiveban
- no-handler/unknownparam/unknownstat/unknownelement tests ปฏิเสธก่อนจ่าย currency; remove-handlernegativefixtureต้องทำให้gateแดง
- 0/.5/1/1.5s event boundaries, expiryชนpayment, targetตายก่อนdelay, playerPushก่อนrecovery, skillmultitargetเป็นHitต่อtargetแต่ไม่แตกnativeaggregatedhits
- Save→load→save ทุกruntimefieldรวมManaติดลบ, poisondecaygroupsคนละphase, auraassignments, ledgerQ, completedreceipt, pendingHPdebt/recoup/bank/ICD ต้องมีค่าเท่าเดิมและไม่drawRNG
- 52 snapshotวงเงิน: ตอนกู้usableMana100ให้limit50และMana−30; buffหมดจนusable20ยังค้าง−30/limit50ได้ ไม่clampล้างหนี้ เมื่อคืนถึง0ล้างsnapshot การกู้ครั้งใหม่ต้องใช้limit10 ตรวจroundtripทั้งสองช่วง
- Saveกลางการนับ04/12/22และระหว่าง07/17/20/21/24/36/40/56/57/59/60 เทียบจำลองต่อแบบไม่reload; tickboundarysaveเพียงพอ ไม่เขียนsaveระหว่างcallback
- เทียบ runTicks/catchUp/catchUpAsync ที่เวลา/seedเดียวกันในstationaryfightที่ไม่มีAFK-onlydifference รวมfightที่จบด้วยPush ไม่แยกofflinecombatสูตรใหม่
- No-Keystone fixtures ของbasic/active/Magic/Elemental/crit/status/Block/DoT/Push ยังคงnativeสูตรเดิม ยอมให้ลำดับRNGเปลี่ยนตามeventclockที่ล็อก แต่ห้ามเปลี่ยนสูตรเพื่อให้testผ่าน
- Campเมื่อ07/36และregen0ต้องมีdurationfiniteและกลับfightได้, CIออกCampมีESและยังไม่LowLife; fullrespecเมื่อMana<0ปฏิเสธไม่ล้างหนี้

## 9. Readiness audit และหลักฐาน

### 9.1 Verdict

**Overall: READY สำหรับ execution แบบเรียง packet ไม่ใช่งานก้อนเดียว** คำถามผลิตภัณฑ์ที่ค้างถูกเลือกในส่วน1–7แล้ว ไม่มีคำถามให้ownerตอบก่อนเริ่ม implementation อนุญาตการเลือกproductในรอบนี้มาจากคำสั่ง “คุณเลือกให้หน่อย” ของowner ไม่ใช่การเดาตามaudit skill

**Audit complete; implementation UNVERIFIED.** ต้องตรวจ code จริงอีกครั้งก่อนแก้และเพิ่มหลักฐานใหม่เมื่อทำแต่ละpacket ไม่อ้างbaselineว่า52mechanicsทำงานแล้ว

ตรวจจาก active workspace: tree schema/readers/cage, targeted-core fold, caps/line routing, combat/basic/skill/status/aura, progression/wallet/respec, save/load, Town task/Delivery และUI/wiki entry points ไม่ตรวจGit/history/otherworktree

| ID | ช่องว่างที่พบ / ความเสี่ยง | Evidence ที่ตรวจแล้ว | วิธีปิดในแผน |
|---|---|---|---|
| F1 High | stat grant metadata หาย และ Core nodeอาจเพิ่มทุกattribute | engine/tree.ts TreeGrant/linesOf; game/src/sim/player.ts sumLines; game/src/sim/lines.ts STAT_MOD_LINE | PacketA targetedstat/elementตลอดทาง พร้อมnegativefixtures |
| F2 High | แต้มเควสหายเมื่อload/setLevel และrefundผิดสกุล | engine/tree.ts pointsSpent/pointsAt; game/src/sim/game.ts setLevel/levelup; sim/tree.ts respecTree; state/save.ts migrate treeRanks/poolnormalize | B/C สูตรQ+currency splitและtransactionรางวัล |
| F3 High | ขาเข้าไม่แยกMagic/Physical/Elementalสามส่วน และruleverbsยังจำกัด | combat.ts mobSwing damageSplit; player.ts applyTreeRules; engine/tree.ts RULE_KINDS | ใช้สองincomingpartsเดิม, boundedbundle+actualhookregistry ไม่เปิดverbหลอก |
| F4 High | tick1sทำICD.5/transfer/Debtแบบกำกวม | game.ts tickWorld/runTicks/catchUp; combat.ts StatusLine; mobStatus.ts placeStatus/tickMob; skills.ts cast/tickSkills | D1/D2 microclockภายในtick, instancesและsharedsavedstate |
| F5 High | player statusesอยู่AppนอกsavedGameState, negativemanaโดนclamp0 | App.svelte localstatuses/reset/load paths; save.ts saveSlot/exportJson/importJson/migrate; game.ts poolclamp | D1 stateownership, G negativeMana/poolvalidation, reloadgoldens |
| F6 High | genericone-ofgroupบังคับCIเป็นกลุ่มใหญ่ผิด และKeystoneUIอ่านfirstgrant | engine/tree.ts groupHolder/createTree/pathTo; PassiveTreeBoard.svelte | M pairwise+graph+grantlessview, atomicpath |
| F7 High | HPregen=0อาจทำCampInfinity และnewtimedhealช่วยก่อนPushผิดเจตนา | game.ts campbranchและHP<=0Pushbranch; farm.ts drink/maybeDrink | sharedCampRecoveryก่อนdisable, latchPushก่อนrecovery, L/Ointegration |
| F8 Medium | ของจริงมีnativebypass-control/poisonHold/statuswritersที่ต้องคง | skills.ts cast/hasRule(bypasses_control_cap), mobStatus.ts stopMob/setStacks | adapterทุกwriterในK, exceptionเฉพาะnativeflagไม่ส่งต่อKeystone |
| F9 Medium | ยังไม่ได้แสดง/ทดสอบ700nodeจริง | PassiveTreeBoard.svelte, App.svelte, tools/tree.ts layoutcage | recipeคำนวณแล้ว, N actualbrowser, O integrationไม่อ้างว่าbrowserผ่าน |

บรรทัด/ตำแหน่งเดิมที่ตรวจไว้เป็นจุดเริ่มค้นหา ไม่ใช่เลขหลังแก้: engine/tree.ts RULE_KINDS33 / linesOf305 / pointsSpent318 / groups389 / pointsAt449; player.ts sumLines25 / rules200 / build249; game.ts setLevel101 / level580 / tickWorld941 / playerSwing1218 / mobSwing1330 / Push1438 / clamp1486 / catchUp1556; save.ts SCHEMA_VERSION44 / migrate399 / tree689 / pool715 / import738; town.ts rollTask155 / claim265; delivery.ts offer74 / complete195; PassiveTreeBoard.svelte reachable94 / nodes133

### 9.2 Baseline ที่รันแล้วใน audit รอบนี้

- npm run typecheck — PASS exit0
- npm --prefix game run test -- tests/tree-rules.test.ts tests/tree-kinds.test.ts tests/tree-gate.test.ts tests/progression.test.ts tests/save-fidelity.test.ts — PASS 5files/83tests
- npm --prefix game run test -- tests/simModules.test.ts tests/delivery.test.ts tests/delivery-acquisition.test.ts — PASS 3files/56tests

รวม139focusedtests ก่อนimplementation ไม่ได้รันซ้ำหลังแก้เฉพาะแผน ยังไม่รันfull verify/full tests/Svelte check/wiki/browser/performanceสำหรับnewtree ข้อมูลใหม่ยังไม่มีในเกม ผลgeometryใน3.1เป็นการประเมินrecipeแยกจากruntime

### 9.3 Readiness matrix

PASS ในG2หมายถึงentrypoints/ขอบเขตอาศัยcodeที่ตรวจแล้ว ไม่ใช่proposedmoduleมีอยู่แล้ว และG6คือมีproofที่ต้องทำไม่ใช่ผลtestของfeatureที่ยังไม่implement

| Task | G1 scope | G2 grounding | G3 decisions | G4 contracts | G5 edges | G6 proof | G7 stop | G8 isolation | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| A targeted grants | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | READY |
| B currency/curve/newformat | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | READY after A |
| C quest bonuses | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | READY after B |
| D1 savedstate/provenance | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | READY after C |
| D2 combat clock | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | READY after D1 |
| E static seven | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | READY after D2 |
| F reservation/cost six | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | READY after E |
| G routing/recovery six | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | READY after F |
| H conditions/counters seven | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | READY after G |
| I hits/kills seven | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | READY after H |
| J reactive three | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | READY after I |
| K status eight | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | READY after J |
| L timed eight | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | READY after K |
| M final tree data/graph | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | READY after L |
| N UI/wiki | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | READY after M |
| O integration review | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | READY after N |

## 10. Execution packets — ทำทีละ packet

### กติกาที่ใช้ร่วมทุก packet

- ไม่มีการเปิดโค้ดใหม่จากแผนรอบนี้; ส่วนต่อไปนี้เป็นคำสั่งสำหรับimplementationครั้งถัดไป ทุกpacket READYเมื่อdependencyผ่าน acceptanceของมันแล้ว **ไม่delegateทั้งไฟล์เป็นหนึ่งtask** ไม่ต้องparallelagent
- ก่อนแก้ อ่านไฟล์/symbolที่ระบุและcallersที่ใช้contractนั้น รักษางานอื่นในworkspace ไม่ตรวจGit/branch/history ยึดlocalfilesปัจจุบัน ถ้าตำแหน่งบรรทัดเลื่อนให้ค้นsymbol ไม่ถือว่าขาดevidence
- ไม่ต้องถามownerเรื่องค่าที่ล็อกแล้ว เลือกชื่อlocalhelper/testและโครงสร้างฟังก์ชันย่อยได้ แต่ห้ามเปลี่ยนสูตร/productpolicy/เพิ่มระบบนอกscopeเอง
- Scopeไฟล์เป็นจุดเริ่ม ไม่บังคับสร้างทุกproposedfileถ้าexistingmoduleรับผิดชอบเดียวกันได้อยู่แล้ว แต่ต้องรักษาpureengine/runtimeboundaryและactualhandlervalidation ห้ามเพิ่มabstractionเพียงเพื่อครบรายชื่อ
- ทุกpacketอัปเดตเฉพาะdocumentedformula/term/behavior/integrationที่เปลี่ยนใน DECISIONS.md / game-rules.md / glossary.md และwiki sourceตามจริง ไม่คัดลอกแผนไปสร้างdocใหม่
- **Stop/escalate ทุกpacket:** พบcriticalcontract/consumerที่ไม่อยู่ในแผนและทำตามแผนแล้วเสียพฤติกรรมอื่น, baselineที่เกี่ยวข้องแดงและแยกสาเหตุไม่ได้, unrelatedin-flightchangesชนตำแหน่งที่จะreplace, ต้องเพิ่มdependency/ทำlossyoperationนอกnew-characterexception หรือไม่มีหลักฐานตรวจcriticalbranch ให้รายงานpath/symbol, ผลที่ขัด, minimalทางเลือก ไม่เดาข้าม/ลดscopeให้ผ่าน
- ไม่บังคับbaselineเก่าที่assert“12wings/12K/firstKremove” ถ้าแก้เนื้อหานั้นตามแผนให้เปลี่ยนเป็นsemantic/capabilitychecks ไม่แทนด้วยassert“ต้อง700/52” ถาวร
- **Handoffทุกpacket:** changedfiles, contractที่เสร็จ, exactcommands/results, unresolvedissueและdependencyสำหรับpacketถัดไป Reviewerตรวจactualdiff/filesและhigh-riskfixtureเอง ไม่อ้างเพียงtypecheckสีเขียว
- Focusedverification: npm run typecheck และ npm --prefix game run test -- <affected test files> ตามพื้นที่จริง ชื่อtestsใหม่ต้องมีอยู่ก่อนเรียก; tools/treecageเรียกผ่านnpm run verifyเมื่อdata/schemaเปลี่ยน; wikiตามAGENTSเมื่อbehaviorเปลี่ยน UIcheck/browserเมื่อUIเปลี่ยน ไม่รันกว้างซ้ำหากinputไม่เปลี่ยน

### Packet A — targeted Core/Element grants

**Status: READY.** Objective: Coreหนึ่งตัวและFlatธาตุหนึ่งตัวไปถึงsheetตรงเป้า  
Verified context: engine/tree.ts TreeGrant/linesOf/createTree, client.ts STAT_KEYS/createTree, player.ts sumLines/elementalPowerOf, lines.ts; tools/tree.ts GRANT_KEYS/TR11  
Dependencies: ไม่มี. Scope: metadata/types/validators/sheet/cage/tooltipcaller; ไม่generateต้นไม้700หรือเปลี่ยนcombat

1. ย้าย/exportCorekeysและขยายTreeGrantตาม4 ปรับcreateTreecontextธาตุและcallersclient/toolsให้ใช้canonicaldata ไม่importgameเข้ามาengine
2. Preserve stat/element ผ่านlinesOf→sumLines→Core/elementflat/percent/res buckets อัปเดตgrantwhitelists/labels ไม่ให้elementflatไหลไปweaponธาตุโดยไม่สนmetadata
3. Add positive +1STR-only / FireFlat-only และunknownstat/element/illegalmetadata negativecases

Acceptance/proof: coretreegrantเปลี่ยนเพียงSTRก่อนderivedformulas; FireFlatไม่เพิ่มCold; rule/statอื่นเดิมไม่เปลี่ยน -> tree-rules/tree-kindsและfocusednewfixture +typecheck+verify  
Stop: ตามกติการ่วม; ห้ามแก้ค่าall_stat_flatเพื่อเลี่ยงtargetmetadata

### Packet B — curve, wallets และ current-character guard

**Status: READY after A.** Objective: แต้มคงยอดQและคืนถูกสกุล  
Verified context: tree.ts pointsAt/pointsSpentByCurrency; game.ts newGame/setLevel/levelup; sim/tree.ts spendTree/respecTree; types.ts Player; save.ts new/load/import/migrate; App.svelte respec/points labels  
Scope: data curve, playerQ/passiveTreeVersion, allpointreaders/refundUI; ไม่ทำoldchar migration/compensation  
Contracts: ส่วน2และ7.7; ช่วงtransitionใช้tree.versionปัจจุบัน guardต้องมีfieldตั้งแต่newGame เมื่อMswitchv3ต้องสร้างตัวใหม่อีกครั้ง ไม่mapranks

1. เพิ่มlevel_rangesและhelperใช้deltaเมื่อlevelup; newGameQ=0/version=current; recomputebudgetแยกcurrencyในsetLevel/save
2. respecTreeคืนresultแยกtree/attainmentและcallerlabels ห้ามเพียงแก้engineแต่saveยังหักallspent
3. ตรวจnewcharversionก่อนlegacycharacter normalization/import path; คงaccountenvelopeversionถ้าไม่จำเป็น; เก่าปฏิเสธพร้อมข้อความไม่delete/overwrite
4. Testระดับ1/100/101/190, jumplevel99→102, Qหลายครั้ง, attainment-onlyspend, mixedrespec, repeatedrespec, invalidrank/overbudget, save-roundtrip/old-characterrejection โดยไม่ใช้งานเซฟจริงของผู้ใช้

Acceptance/proof: level1=3/100=300/101=301/190=390; Q=7ที่level100มี307ก่อนspend; Keystoneไม่ลดtree; refundแยกตรงspent; roundtripQ/accountpreserved -> progression/tree-rules/save-fidelity +typecheck+verify  
Stop: ตามกติการ่วม; ไม่bumpglobalaccountschemaเพื่อหลบreaderงานนี้

### Packet C — frozen quest bonuses ทั้งสองระบบ

**Status: READY after B.**  
Verified context: tools/data/town.json; sim/town.ts rollTask/claimTask/TaskSlot(types.ts); delivery.ts makeOffer/preview/commit/summary/validate, delivery-types.ts; App.svelte claimTask; DeliveryBoard.svelte reward  
Scope: configuration→offer→payout→receipt→save→UIครบ Town/Delivery; ไม่ปรับrewardเดิม  
Contracts: ส่วน2.2; sharedconfigหนึ่งชุด, drawท้ายลำดับเดิมเสมอ

1. เพิ่มtreePointsในrewardmodel/receipt/summary/validatorทั้งสอง; appendofferRNGdrawและfreezeก่อนแสดง; updateDECISIONSคำว่าattainmentlastdrawให้ตรงลำดับใหม่
2. Payoutเพิ่มQ+walletในtransactioncompletionเดิม ไม่จ่ายจากpreview/partial/failure
3. แสดงoffer/paidโบนัสจากstoredvalue และทดสอบdraw0/1ด้วยseededstubboundary .0999/.10ตามchance10%; ไม่ทดสอบempiricaldistributionquota

Acceptance/proof: claimสำเร็จได้ครั้งเดียว, repeated/load/previewไม่draw/ไม่doublepay, failureไม่เพิ่มQ, partialไม่จ่าย, rewardsเดิมเหมือนเดิม, saveoffer/completedroundtrip -> simModules/delivery/delivery-acquisition +typecheck+verify และUIcheck/wikiตามส่วนที่เปลี่ยน  
Stop: ตามกติการ่วม ไม่เปลี่ยนTownและDeliveryให้เป็นrewardengineใหม่เพื่อทำโบนัสหนึ่งช่อง

### Packet D1 — damage provenance, status ownership และ runtime schema

**Status: READY after C.**  
Verified context: combat.ts playerSwing/mobSwing/StatusLine; skills.ts cast/perPress/targetloop; mobStatus.ts stores/readers; game.ts tick/catchUp; App.svelte statuses variable/reset; save.ts snapshots/import/export; types.ts GameState  
Scope: sharedtypedpackets, savedplayerStatuses/keystoneRuntime, statevalidators/adapters, pureregistrymetadata; ไม่เปิดnew52effectsในlivecatalog

1. เพิ่มengine/keystonesและruntimeadapterตาม6: parsers/requiredhooks/pureformulas เริ่มไม่มีnewbundleใดsupportedจนhandlerพร้อม
2. แยกrawdamagepartsโดยพิสูจน์no-Kfixture รวมpostcrit HPterm; phaseของconversion/status/mitigationตรง7.2 ไม่splitaggregatedskillhits
3. ย้ายplayerstatusเข้าGameStateเปลี่ยนcallers/testsและAppderivedsource ครบload/reset/showcase/catchUp; savedqueues/typevalidationสำหรับparams/times/negativeMana
4. statusinstanceadapterรองรับallnativewriters/readersให้aggregateviewตรง ไม่เปลี่ยนstatusเป็นeffectที่ลงชื่อแล้วไม่ทำงาน

Acceptance/proof: no-Kdamage/native-statusfixtureเดิม, state-roundtripของmockpending/instancesครบ, unknownbundle/missinghookปฏิเสธ, saveไม่dropplayerStatuses -> focusedcombat/status/save-fidelity +typecheck  
Stop: ตามกติการ่วม โดยเฉพาะnativeeffectwriterที่ยังไม่รู้ว่าจะmapinstanceอย่างไร ห้ามสร้างaggregateกับinstancesเป็นคนละsourceoftruth

### Packet D2 — deterministic combat events ใน world tick เดิม

**Status: READY after D1.**  
Verified context: game.ts tickWorld player/mobloops/tickSkills/catchUp/runTicks; skills.ts triggeredcasts/CD; mobStatus.ts stopMob/stunMob  
Scope: combat-clock/progress/scheduling/ICD/expiry primitivesและPushlatch; ยังไม่ใส่newtreecatalog  
Contracts:7.1,7.7, nativeworld/skillsหนึ่งครั้งต่อworldtick

1. แยกcombatprogress/eventsจากworldprogress ใช้timeUsinteger+stableorder เก็บqueuependingที่ต้องsaveและrebuildattackqueueได้
2. ใช้ratechange/controlprogressตรงcontract, มีhalfsecondfixtureและboundarytie/noextraattack
3. เชื่อมPushlatchให้หยุดeventsก่อนrecoveryแล้วเข้าnativecleanup ครบdungeon/walk/preset; campclockเดินICD/expiry
4. No-Ktestsยืนยันสูตรbasic/skillเดิมและcatchUp/catchUpAsyncใช้kernelเดียวกัน ไม่ต้องรักษาoldcharacterRNGreplay

Acceptance/proof: .5sICDเกิดได้จริง, t1eventsไม่ซ้ำ, stop/resumeratechangesไม่replayprogress; 10secstationaryonline/offline/reloadเหมือนกัน, lethalก่อนhealต้องPush -> combatclock/progression/save-focused +typecheck +broadnpm testเมื่อclocksharedเปลี่ยน  
Stop: ตามกติการ่วม ไม่ลดworldtickintervalหรือเพิ่มจำนวนskillrotationเพื่อเลี่ยงscheduler

### Packet E — static flags/stats

**Status: READY after D2.** Keystone refs: **01, 05, 06, 13, 47, 51, 55**  
Verified context: player.ts buildCharacter/applyTreeRules; combat.ts typedparts/mitigation; engine/tree.ts capabilityvalidation  
Scope: sheet/core/cap/conversion flags; combat incoming routes; ไม่เปิดlivev3data/ไม่ทำKeystoneนอกpacketนี้  
Contracts: ส่วน6–8ของทุกrefข้างบน; registryเปิดเฉพาะkeyที่handlerครบ ไม่ใช้placeholder  
Steps:
1. Implement finalfold01/06/51/55, noCrit13, conversion05 และ47สองincomingparts; CIChaosimmunityแยกstatusimmunity ปฏิเสธHPcost/reserveจริง ไม่เพียงtooltip
2. ต่อhookกับprimary/basic/active/triggered/native-statusที่เกี่ยวข้อง ไม่เพียงunitpureformula; savefield/reader/cleanupและtooltipeffectdescriptorต้องตรงกัน
3. เขียนpositive/control/negative/roundtripfixturesก่อนเปิดcapability แล้วตรวจว่าถอดrequiredhookทำให้purchase/cageปฏิเสธ

Acceptance/proof: Golden01/05/06/13/47/51/55 พร้อม55PoisonES/CIไม่LowLifeและnoESfinalclamp; unsupportedhandlernegativefixture -> focusedtestsตามพื้นที่ + npm run typecheck; เปลี่ยนsharedcombat/statusให้รันaffectedregressions ไม่ต้องรันallอีกครั้งถ้าOจะรวมและไม่มีunresolvedsharedfailure; documentation/wikiตามbehaviorที่เปลี่ยน  
Stop: กติการ่วม; พบpacketก่อนหน้าผิดcontractให้แก้dependencyพร้อมtestก่อน ไม่ทำlocalexceptionเพื่อให้packetนี้ผ่าน  
Expected handoff: กติการ่วม + key/hook coverage และremainingunsupportedkeysจากregistry

### Packet F — reservation และ skill costs

**Status: READY after E.** Keystone refs: **34, 35, 37, 52, 54, 64**  
Verified context: skills.ts clamp/reserved/toggle/usable/spendable/effectsActive; engine/skills.ts effectsAt; save.ts mana; game.ts clamp; App aura controls  
Scope: skills reservation/toggle/cost, pool clamps/save validators; ไม่เปิดlivev3data/ไม่ทำKeystoneนอกpacketนี้  
Contracts: ส่วน6–8ของทุกrefข้างบน; registryเปิดเฉพาะkeyที่handlerครบ ไม่ใช้placeholder  
Steps:
1. Candidateaura-set/poolassignmentsทั้งชุดและeffectfilter64;34/35fixedreserve,37HPpaymentatomic,52funded/borrowed/debtfloor; save/poolclampทุกจุดต้องยอมlegalnegativeMana
2. ต่อhookกับprimary/basic/active/triggered/native-statusที่เกี่ยวข้อง ไม่เพียงunitpureformula; savefield/reader/cleanupและtooltipeffectdescriptorต้องตรงกัน
3. เขียนpositive/control/negative/roundtripfixturesก่อนเปิดcapability แล้วตรวจว่าถอดrequiredhookทำให้purchase/cageปฏิเสธ

Acceptance/proof: Golden34/35/37/52/54/64; 6auradiscount/effectcap independent, turnoffจนinvalidreject, disableallescape, HPreserveLowLife,55rejectnativeHPcost -> focusedtestsตามพื้นที่ + npm run typecheck; เปลี่ยนsharedcombat/statusให้รันaffectedregressions ไม่ต้องรันallอีกครั้งถ้าOจะรวมและไม่มีunresolvedsharedfailure; documentation/wikiตามbehaviorที่เปลี่ยน  
Stop: กติการ่วม; พบpacketก่อนหน้าผิดcontractให้แก้dependencyพร้อมtestก่อน ไม่ทำlocalexceptionเพื่อให้packetนี้ผ่าน  
Expected handoff: กติการ่วม + key/hook coverage และremainingunsupportedkeysจากregistry

### Packet G — routing, cadence และ resource recovery

**Status: READY after F.** Keystone refs: **33, 42, 44, 45, 58, 65**  
Verified context: combat.ts playerSwing/mobSwing; game.ts rate/recovery; player.ts leech/manaRegen; skills.ts spendcast  
Scope: incoming Mana route/basicratecap/Blockreplacement/leechdest/extra provenance; ไม่เปิดlivev3data/ไม่ทำKeystoneนอกpacketนี้  
Contracts: ส่วน6–8ของทุกrefข้างบน; registryเปิดเฉพาะkeyที่handlerครบ ไม่ใช้placeholder  
Steps:
1. 33หลังESและใช้positiveManaเท่านั้น;42ratecap+damageครั้งเดียว;44expectedBlockไม่มีevent;45recoveryredirect;58fundedspendเท่านั้น;65cachePprecrit/conversion+rawFlatweights
2. ต่อhookกับprimary/basic/active/triggered/native-statusที่เกี่ยวข้อง ไม่เพียงunitpureformula; savefield/reader/cleanupและtooltipeffectdescriptorต้องตรงกัน
3. เขียนpositive/control/negative/roundtripfixturesก่อนเปิดcapability แล้วตรวจว่าถอดrequiredhookทำให้purchase/cageปฏิเสธ

Acceptance/proof: Golden33/42/44/45/58/65; 05+65,52+58,33+52แยกspendtags; rawextraไม่เพิ่มnativeprocจนมี66 -> focusedtestsตามพื้นที่ + npm run typecheck; เปลี่ยนsharedcombat/statusให้รันaffectedregressions ไม่ต้องรันallอีกครั้งถ้าOจะรวมและไม่มีunresolvedsharedfailure; documentation/wikiตามbehaviorที่เปลี่ยน  
Stop: กติการ่วม; พบpacketก่อนหน้าผิดcontractให้แก้dependencyพร้อมtestก่อน ไม่ทำlocalexceptionเพื่อให้packetนี้ผ่าน  
Expected handoff: กติการ่วม + key/hook coverage และremainingunsupportedkeysจากregistry

### Packet H — conditions, stacks และ action history

**Status: READY after G.** Keystone refs: **02, 03, 04, 11, 12, 16, 32**  
Verified context: game.ts tick/attackprogress; combat.ts Hitresult; player.ts runtimeoverlay; mobStatus.ts controlsource  
Scope: runtime overlays/stacktimers/target and action counters; ไม่เปิดlivev3data/ไม่ทำKeystoneนอกpacketนี้  
Contracts: ส่วน6–8ของทุกrefข้างบน; registryเปิดเฉพาะkeyที่handlerครบ ไม่ใช้placeholder  
Steps:
1. Statefieldsตาม7 refreshconditionalที่eventtimeไม่foldgearทุกHit;04drainidle/insufficientpayment;11/16ใช้actualloss;12main-targetcounter;32snapshotpreviousactionก่อนmultitargetloop
2. ต่อhookกับprimary/basic/active/triggered/native-statusที่เกี่ยวข้อง ไม่เพียงunitpureformula; savefield/reader/cleanupและtooltipeffectdescriptorต้องตรงกัน
3. เขียนpositive/control/negative/roundtripfixturesก่อนเปิดcapability แล้วตรวจว่าถอดrequiredhookทำให้purchase/cageปฏิเสธ

Acceptance/proof: Golden02/03/04/11/12/16/32; LowLifecrossingกลางtick, .5sattacks, DoTresetidleแต่ไม่ให้Fortify, selfcostไม่proc -> focusedtestsตามพื้นที่ + npm run typecheck; เปลี่ยนsharedcombat/statusให้รันaffectedregressions ไม่ต้องรันallอีกครั้งถ้าOจะรวมและไม่มีunresolvedsharedfailure; documentation/wikiตามbehaviorที่เปลี่ยน  
Stop: กติการ่วม; พบpacketก่อนหน้าผิดcontractให้แก้dependencyพร้อมtestก่อน ไม่ทำlocalexceptionเพื่อให้packetนี้ผ่าน  
Expected handoff: กติการ่วม + key/hook coverage และremainingunsupportedkeysจากregistry

### Packet I — crit, direct-hit finishers และ secondary damage

**Status: READY after H.** Keystone refs: **08, 10, 19, 22, 27, 31, 53**  
Verified context: combat.ts typedhits/Blockresults; skills.ts pertargetcrit; game.ts onKill/loot/dungeon counters; curses/mobStatussource  
Scope: directcrit/counters/Blockbank/kill credit/explosion/retaliation; ไม่เปิดlivev3data/ไม่ทำKeystoneนอกpacketนี้  
Contracts: ส่วน6–8ของทุกrefข้างบน; registryเปิดเฉพาะkeyที่handlerครบ ไม่ใช้placeholder  
Steps:
1. Addprimary/secondaryflagsให้ครบ everycaller;08execute residualไม่มีleech;10storedcutก่อนtaken;19per-targetFullHP;22fifthhitactualHPsum;27cursekillnochain;31elemignoreRes;53ICDhalfsecond
2. ต่อhookกับprimary/basic/active/triggered/native-statusที่เกี่ยวข้อง ไม่เพียงunitpureformula; savefield/reader/cleanupและtooltipeffectdescriptorต้องตรงกัน
3. เขียนpositive/control/negative/roundtripfixturesก่อนเปิดcapability แล้วตรวจว่าถอดrequiredhookทำให้purchase/cageปฏิเสธ

Acceptance/proof: Golden08/10/19/22/27/31/53 และsecondarychainnegative, targetdeathatfifthhit, Multi-targetFullHPcrit, killcreditonce/dungeonescrowunchanged -> focusedtestsตามพื้นที่ + npm run typecheck; เปลี่ยนsharedcombat/statusให้รันaffectedregressions ไม่ต้องรันallอีกครั้งถ้าOจะรวมและไม่มีunresolvedsharedfailure; documentation/wikiตามbehaviorที่เปลี่ยน  
Stop: กติการ่วม; พบpacketก่อนหน้าผิดcontractให้แก้dependencyพร้อมtestก่อน ไม่ทำlocalexceptionเพื่อให้packetนี้ผ่าน  
Expected handoff: กติการ่วม + key/hook coverage และremainingunsupportedkeysจากregistry

### Packet J — reactive defenses

**Status: READY after I.** Keystone refs: **23, 57, 59**  
Verified context: combat.ts evasion/ESrouting/statusapplication; game.ts reactiondispatch/Push; save.ts runtimestate  
Scope: evasion recovery/Shield Gate/status-cleanse hooks; ไม่เปิดlivev3data/ไม่ทำKeystoneนอกpacketนี้  
Contracts: ส่วน6–8ของทุกrefข้างบน; registryเปิดเฉพาะkeyที่handlerครบ ไม่ใช้placeholder  
Steps:
1. ImplementEvasion-only23,57eligibleoverflow/fullrearmICD,59acceptedfamilycleanse; checktimers/saveandlowerMaxESdoesnotarmgate
2. ต่อhookกับprimary/basic/active/triggered/native-statusที่เกี่ยวข้อง ไม่เพียงunitpureformula; savefield/reader/cleanupและtooltipeffectdescriptorต้องตรงกัน
3. เขียนpositive/control/negative/roundtripfixturesก่อนเปิดcapability แล้วตรวจว่าถอดrequiredhookทำให้purchase/cageปฏิเสธ

Acceptance/proof: Golden23/57/59; actualEvasionเทียบPDodge,47physicalbypassไม่ถูกgate, immuneไม่กินcleanseICD, bothnativeandextraapplicationpaths -> focusedtestsตามพื้นที่ + npm run typecheck; เปลี่ยนsharedcombat/statusให้รันaffectedregressions ไม่ต้องรันallอีกครั้งถ้าOจะรวมและไม่มีunresolvedsharedfailure; documentation/wikiตามbehaviorที่เปลี่ยน  
Stop: กติการ่วม; พบpacketก่อนหน้าผิดcontractให้แก้dependencyพร้อมtestก่อน ไม่ทำlocalexceptionเพื่อให้packetนี้ผ่าน  
Expected handoff: กติการ่วม + key/hook coverage และremainingunsupportedkeysจากregistry

### Packet K — status mechanics และ transfer

**Status: READY after J.** Keystone refs: **09, 20, 28, 30, 43, 46, 60, 66**  
Verified context: mobStatus.ts allwriters/readers; combat.ts statusroll/poisonBurst/dotDamageParts; skills.ts setStacks/setErosion/stop/poisonHold/curse writers  
Scope: snapshotDoTs/curse replacement/control budget/extra-laneprocs; ไม่เปิดlivev3data/ไม่ทำKeystoneนอกpacketนี้  
Contracts: ส่วน6–8ของทุกrefข้างบน; registryเปิดเฉพาะkeyที่handlerครบ ไม่ใช้placeholder  
Steps:
1. Implement7.6ครบทั้งnativeadapterและnewlanes;09/20totaldamage,28atomiccurse-source,30dominant,43initialArmour,46sharedstopbucket;60movependingstream;66extraattempts; ไม่มีการแก้skillชื่อเฉพาะ
2. ต่อhookกับprimary/basic/active/triggered/native-statusที่เกี่ยวข้อง ไม่เพียงunitpureformula; savefield/reader/cleanupและtooltipeffectdescriptorต้องตรงกัน
3. เขียนpositive/control/negative/roundtripfixturesก่อนเปิดcapability แล้วตรวจว่าถอดrequiredhookทำให้purchase/cageปฏิเสธ

Acceptance/proof: Golden09/20/28/30/43/46/60/66; zeroElementpurephysicalDoT, capsoldeststrongest/PoisonHold/nativebypassflag, transfermidsecondconservationและimmune/ICD -> focusedtestsตามพื้นที่ + npm run typecheck; เปลี่ยนsharedcombat/statusให้รันaffectedregressions ไม่ต้องรันallอีกครั้งถ้าOจะรวมและไม่มีunresolvedsharedfailure; documentation/wikiตามbehaviorที่เปลี่ยน  
Stop: กติการ่วม; พบpacketก่อนหน้าผิดcontractให้แก้dependencyพร้อมtestก่อน ไม่ทำlocalexceptionเพื่อให้packetนี้ผ่าน  
Expected handoff: กติการ่วม + key/hook coverage และremainingunsupportedkeysจากregistry

### Packet L — timed recovery และ committed damage

**Status: READY after K.** Keystone refs: **07, 17, 21, 24, 36, 40, 56, 61**  
Verified context: game.ts recovery/DoT/Push/camp; combat.ts actualpaidresults; farm.ts drink/maybeDrink; skills.ts naturalrechargeeffects; save.ts queues  
Scope: bank/potion/deferredhit/rechargepulse/cleanseperiod/recoup/debt/leech; ไม่เปิดlivev3data/ไม่ทำKeystoneนอกpacketนี้  
Contracts: ส่วน6–8ของทุกrefข้างบน; registryเปิดเฉพาะkeyที่handlerครบ ไม่ใช้placeholder  
Steps:
1. Implementseparatetaggedqueues,conservetotalsandexpiry; fullcampcontract/zeroHPregen;40+56recouponactualpayments,61intrinsic2%และDoT-onlyleech; fullrespecnegativeManareject
2. ต่อhookกับprimary/basic/active/triggered/native-statusที่เกี่ยวข้อง ไม่เพียงunitpureformula; savefield/reader/cleanupและtooltipeffectdescriptorต้องตรงกัน
3. เขียนpositive/control/negative/roundtripfixturesก่อนเปิดcapability แล้วตรวจว่าถอดrequiredhookทำให้purchase/cageปฏิเสธ

Acceptance/proof: Golden07/17/21/24/36/40/56/61; L+G+Kcrosscases07+45+61,24+58,33+56+40; pendingallqueuesroundtrip/Pushcleanup; fatalHitcannothealbeforePush -> focusedtestsตามพื้นที่ + npm run typecheck; เปลี่ยนsharedcombat/statusให้รันaffectedregressions ไม่ต้องรันallอีกครั้งถ้าOจะรวมและไม่มีunresolvedsharedfailure; documentation/wikiตามbehaviorที่เปลี่ยน  
Stop: กติการ่วม; พบpacketก่อนหน้าผิดcontractให้แก้dependencyพร้อมtestก่อน ไม่ทำlocalexceptionเพื่อให้packetนี้ผ่าน  
Expected handoff: กติการ่วม + key/hook coverage และremainingunsupportedkeysจากregistry

### Packet M — final data, topology และ atomic allocation

**Status: READY after L.** Objective: สลับtree v3เมื่อbundleทั้งหมดมีhandlerแล้ว  
Verified context: tools/data/tree.json; engine/tree.ts readSpec/createTree/geometry/reachable/pathTo/pathCost/groupHolder; tools/tree.ts GRANT_KEYS/TR11/layout checks; sim/tree.ts allocateTreePath/respecTree; PassiveTreeBoard.svelte grants/rules/edges; client.ts factory  
Scope: schema/profiles/placement/generator/52bundleparams/pairs/graphpricingครบ ไม่แก้สูตรที่E–Lทำไว้แล้ว

1. เพิ่มprofiles/placements/links/pairwiseในreaderและruntimegraphตาม3–4 ให้v2ยังอ่านได้ระหว่างทำdependency แต่finalv3ใช้newrecipe ไม่ใช้keystone_groups one-of
2. ใส่7core/88notableprofiles/52handauthoredKeystonebundlesตามตาราง แล้วเพิ่มtools/tree.ts --build สร้างnormal/notable topology/needs/linksจากrecipe deterministic; จุดสะพานเลือกregion a เป็นwing fieldและplacementบอกa,b ไม่เพิ่มregionที่8
3. Dijkstra/atomicpathคืนpriceแยกcurrency ตรวจunsupported/pairinvalidก่อนspend Updateทุกcallerของfirstgrant/rules/group และcageให้ใช้realhandlercapabilities
4. รันgeneratorสองครั้งต้องเหมือนกัน byte-for-byteหลังครั้งแรก ตรวจIDunique/allreachable/nooverlap/Kleaf/costtypes/granttargets และทุกdeclaredprofileได้รับใช้จริง; error unknownprofile/danglingedge/parentcycle/selfedge
5. สลับversion3/newcharversion3 ไม่มีoldIDmapping ปฏิเสธoldcharโดยไม่deleteaccount/slots Replaceold12Kcount/remove-onlytestsด้วยgenericsemanticchecks

Acceptance/proof: outputตรงrecipeเริ่มต้น700purchasable, grant/effectทำงาน, buybothdirectionsผ่านcrosslink, shortestpathlexicaltieและmixedwalletatomic, pairbanสองorder/import, respecคืนทั้งสองcurrency, geometry/cage -> tree-rules/tree-kinds/tree-gate/progression/save-fidelity +typecheck+verify  
Stop: กติการ่วม; ไม่มีhandlerใดของ52พร้อมให้ไม่publishdataของkeyนั้น ไม่ลดรายชื่อเหลือเท่าที่ทำได้แล้วอ้างcomplete

### Packet N — actual UI และ wiki integration

**Status: READY after M.**  
Verified context: PassiveTreeBoard.svelte; App.svelte tree panel/respec/skills aura toggles/task receipt; DeliveryBoard.svelte; styles variables/base/skins; game/src/wiki/pages.ts และ tools/wiki.ts  
Scope: node rendering/grantlessdetails/prices/path/conflict messages, aura poolcontrols/effect/reserve values, new-formatreject feedback, questbonus/readback และwikiตามbehaviorจริง ไม่redesignHUDหรือเขียนmapart

1. Boardอ่านenginecoordinates/radii/arc links/adjoinreachable ใช้profilegrantsและbundledescriptor ไม่อ่านfirstGrantโดยบังคับมีค่า สีและtokensเดิม
2. Detailแสดงชื่อ/effect/เงื่อนไข/ราคาต่างสกุล/conflictingownedKeystone/สถานะซื้อไม่ได้; pathpreviewแสดงtree+attainmentและallocatedpathเดียวกับmodel; searchชื่อ/stat/element, focus/keyboardซื้อยังทำงาน
3. Aura54เพิ่มHP/Manachoiceต่อaura;64แสดงN/discount/effectที่คำนวณจริงรวมtriggeraura ให้invalidtransactionmessageและdisable-allทางออก HPbarแสดงreserved/usable/Maxชัด ไม่แสดงMaxลดเพื่อLowLife
4. หน้าquest/Deliveryแสดงstoredbonusและpaidreceipt; newcharlegacyrejectให้เริ่มใหม่ได้โดยไม่overwriteoldslotโดยอัตโนมัติ อย่าผูกปุ่มกับการลบข้อมูล
5. Updateเฉพาะformula/terms/behaviorsในcanonicaldocsและwiki source: 7regions/3kinds/targetattr/pointcurve/questbonus/pairs/52effects/LowLife/CI/ES/routing/clockที่ผู้เล่นต้องรู้ ไม่ใส่implementationdetailของqueuesลงproductflow
6. Checkport5173/reuseexistingserver; เปิดvisibleintegratedbrowserหนึ่งtab1920×1080ตามAGENTS และเลือกshowcase/gamefixtureที่อ่านfinaltreeจริง ไม่สร้างmirror/headless; ตรวจpan/zoom/search/focus/select/pathbuy/conflict/currency/respec/auraassignment/reload; ปิดtabหลังตรวจ

Acceptance/proof: actual700-nodeboardไม่มีoverlap/clipที่ขัดinteraction,เลือกKไม่มีstatยังเห็นeffect/price,ซื้อpathตรงmodel/atomic; Aura64/54และquestreceiptอ่านsame values; keyboard/focusทำได้ -> npm --prefix game run check + focusedUIbehavior tests + actualbrowser + npm run wiki; inspectgeneratedwikilinksไม่handeditHTML  
Stop: กติการ่วม; browserไม่มี/ใช้งานไม่ได้ให้รายงานUIverificationblocked ไม่launchstandalonebrowserหรืออ้างภาพจากคณิตศาสตร์เป็นUIproof

### Packet O — integration review และ required gates

**Status: READY after N.** Objective: พิสูจน์ทั้งระบบไม่ใช่เพียงschemaผ่าน  
Verified context: game/tests/*ที่เกี่ยวข้องและtools/tree.ts/verify.ts; runtime/reader/UI/docsที่packetsแก้จริง  
Scope: defectrepairตามacceptanceที่ตกค้าง ไม่ปรับbalance/pacing/nodenumberให้เป็นgate และไม่สร้างaudittranscriptfile

1. ตรวจcoverageกับref52ตัวใน8 และrequiredhooksจริง; ตรวจcross-combinations,save/load/offline,duplicatequestpayments,Push/camp,illegalpairและno-handlernegativefixtures
2. ทบทวนทุกreader/writer/schema/type/UIcallerของtargetstat/element/effects/pointcurrency/reserve/negativeMana/statusinstance/timing รวมAppreset/showcase ไม่ปล่อยruntimeสองsourceoftruth
3. รัน npm run typecheck, npm run verify, npm test, npm --prefix game run check, npm run wiki ตามsharedbehaviorของงานนี้ Reuseผลผ่านหลังinputสุดท้ายถ้าไม่มีการแก้inputที่เกี่ยวข้อง ไม่รันซ้ำเพียงเพื่อรายงาน
4. Reviewerตรวจactualfiles/fixturesของcriticalcombosและbrowserinteractionล่าสุด ถ้าระหว่างfixมีinputเปลี่ยน ให้รันเฉพาะchecksที่ถูกกระทบใหม่
5. ตรวจdocsไม่เหลือold12wings/remove-only/singlewallet/old-savecompatclaimในส่วนที่เปลี่ยน ไม่ลบเอกสารระบบอื่นที่ยังใช้12หรือWardในความหมายอื่นโดยpatternกว้าง

Completion: ทุก52effectมีobservablepositive/controlproof; event/payout/roundtripinvariantsและrequiredgatesผ่าน; actualUIตรวจแล้ว; no-blocker/no-no-op; รายงานchangedfiles/checks/limitationsสั้น ๆ ไม่สร้างPR/commit/pushถ้าไม่ได้รับคำสั่ง  
Stop/escalate: กติการ่วม และrequiredcheck/browserที่ยังไม่สำเร็จต้องรายงานตามจริง ห้ามเปลี่ยนREADYของแผนเป็น“implementationcomplete”เพื่อเลี่ยงremainingwork

## 11. Final handoff

เริ่ม Packet A แล้วเดินลำดับ A→B→C→D1→D2→E→F→G→H→I→J→K→L→M→N→O ไม่เปิดทั้ง52effectsในdataก่อนruntimeพร้อม ไม่มีproductdecisionค้างให้agentเลือกต่อ แต่agentยังต้องอ่านcodeปัจจุบัน ออกแบบฟังก์ชันย่อย และพิสูจน์ผลตามfixture ไม่ถือว่าแผนรับประกันว่าการเขียนโค้ดจะไม่มีปัญหาใหม่

ในงานนี้แก้เฉพาะแผนเดิม ไม่สร้างdocสำเนาและไม่แก้gamecode
