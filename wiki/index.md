# Wiki index — ModWorld

**text-based RPG idle, fantasy theme** (D13)

ต้นแบบโครงสร้างคือ wiki ของเกม · แต่เกมนี้ยังไม่ได้ทำ → **โฟลเดอร์ที่ว่างคือสิ่งที่ยังไม่ได้ออกแบบ** ไม่ใช่ของที่ลืม

สถานะ: `[x]` มีเนื้อหา · `[ ]` ว่าง เพราะยังไม่ได้ออกแบบ · `[~]` มีเนื้อหาแต่ยังไม่ผ่านการวัด

---

## เกมนี้คืออะไร

เกม idle แบบ Melvor ที่เพิ่มความลึกด้านอาวุธ/attribute ด้วยแนวคิดจาก PoE, PoE 2, Diablo — แต่ **ไม่มีภาพ** ทั้งหมดเป็นข้อความ

**หัวใจ:** สิ่งที่ดูเหมือนระบบเดียวจริง ๆ คือ **สองระบบที่ต้องทำพร้อมกัน** — ฝั่ง item กับฝั่ง monster/content · คนที่ล้มโปรเจคแบบนี้คือคนที่ทำฝั่งแรกเสร็จแล้วพบว่าฝั่งหลังไม่มี

→ [10-design/pillars-vision.md](10-design/pillars-vision.md)

---

## 00 — Getting started

| | หน้า | |
|---|---|---|
| [ ] | `overview.md` | เกมคืออะไร, genre, platform |
| [ ] | `beginner-guide.md` | |
| [~] | [`controls-ui.md`](00-getting-started/controls-ui.md) | ทุกหน้าจอในรูปแบบข้อความ · รอ O9/O10 |
| [ ] | `glossary.md` | ศัพท์เฉพาะ |

## 01 — World

| | หน้า | |
|---|---|---|
| [ ] | `lore/` | **ยังไม่มีเลย** · D13 ล็อก "fantasy theme" แต่ไม่มีตำนาน ไม่มี timeline |
| [~] | [`regions/zones-and-monsters.md`](01-world/regions/zones-and-monsters.md) | 10 โซน · 31 มอนสเตอร์ · **ยังไม่เคยวัด** |
| [ ] | `locations/` | |
| [ ] | `factions/` | |
| [ ] | `races-species/` | |

## 02 — Characters

| | หน้า | |
|---|---|---|
| [ ] | `playable/` | **ไม่มี class** มีแค่ passive tree ซึ่งยังไม่ได้ออกแบบ · รอ O1 |
| [ ] | `companions/` | |
| [ ] | `npcs/` | |
| [ ] | `bosses/` | มีชื่อแล้วใน zones แต่ไม่มีกลไกต่างจากมอนสเตอร์ประจำโซน |

## 03 — Gameplay

| | หน้า | |
|---|---|---|
| [~] | [`combat/damage-pipeline.md`](03-gameplay/combat/damage-pipeline.md) | ลำดับ 16 ขั้น · เหลือ 2 ขั้นที่ยังไม่มี (eva-pen, crit) |
| [ ] | `core-loop.md` | **รอ O10** — ผู้เล่นทำอะไรใน 60 วินาที |
| [ ] | `classes-jobs/` | |
| [ ] | `skills-abilities/` | |
| [~] | [`stats-attributes/core-stats.md`](03-gameplay/stats-attributes/core-stats.md) | 4 แกน · **รอ O1 ว่า 3 หรือ 4** |
| [~] | `leveling-progression/` | อยู่ใน zones (unlock ด้วย kills/h) · ยังไม่แยกไฟล์ |
| [ ] | `crafting-gathering/` | มีแค่ `CRAFT-GUARANTEED` ที่ยังไม่มีหลักฐาน |
| [~] | [`economy/economy.md`](03-gameplay/economy/economy.md) | **ไม่มีหลักฐานเลย** · ทุกข้อเป็น `prov` |
| [ ] | `party-multiplayer/` | เกม solo ไม่มีเงิน |
| [ ] | `mini-games/` | |

## 04 — Items

| | หน้า | |
|---|---|---|
| [~] | [`items-and-slots.md`](04-items/items-and-slots.md) | 5 ประเภท item · 10 slot |
| [ ] | `weapons/` | **มีข้อมูลอยู่ใน breadcrumbs (12 ชิ้น) ยังไม่ได้ย้ายเข้าไฟล์** |
| [ ] | `armor/` | ยังไม่ได้คิด · ตอนนี้ def/eva อยู่ใน affix ไม่ใช่ครบชุด |
| [~] | `accessories/` | 6 ช่อง · ยังไม่ผูกกับ layer ใด |
| [ ] | `consumables/` | มีแค่ชื่อ |
| [ ] | `materials/` | |
| [ ] | `key-items/` | |
| [ ] | `sets-equipment-bonus/` | |
| [ ] | `rarity-system.md` | **รอคำตอบ** · เดิม rarity = จำนวนบรรทัด · ใหม่เป็น common/rare/epic/unique |
| [ ] | `affixes.md` | **มีอยู่ใน breadcrumbs (10 ชนิด) ยังไม่ได้ย้ายเข้าไฟล์** |

## 05 — Bestiary

| | หน้า | |
|---|---|---|
| [~] | `monsters/` | อยู่ใน zones (31 ตัว) |
| [ ] | `bosses/` | ไม่มีกลไก |
| [ ] | `elites-world-events/` | |

## 06 — Quests & story

| | หน้า | |
|---|---|---|
| [ ] | `main-story/` | |
| [ ] | `side-quests/` | |
| [ ] | `daily-repeatable/` | |
| [ ] | `events/` | มีแค่ contract modifier 6 ตัว |
| [ ] | `achievements-trophies.md` | |
| [ ] | `endings-branches.md` | |

## 07 — Systems

| | หน้า | |
|---|---|---|
| [ ] | `dialogue-choices.md` | |
| [ ] | `reputation-relationship.md` | |
| [ ] | `housing-base-building.md` | |
| [ ] | `mounts-pets.md` | |
| [ ] | `gacha-monetization.md` | **ตัดไปแล้ว** · D9 ไม่มีรายได้ |
| [ ] | `pvp-ranking.md` | single player |
| [ ] | `guilds-social.md` | single player |

## 08 — Guides

| | หน้า | |
|---|---|---|
| [ ] | `builds/` | |
| [ ] | `farming-routes/` | |
| [ ] | `boss-strategies/` | |
| [ ] | `speedrun-challenge/` | |
| [ ] | `tips-tricks.md` | |

## 09 — Reference

| | หน้า | |
|---|---|---|
| [ ] | `damage-formulas.md` | มีใน damage-pipeline แล้ว |
| [ ] | `drop-tables.md` | **ยังไม่มี** · รอ O6 |
| [ ] | `exp-tables.md` | ไม่มี EXP · ใช้ kills/h |
| [ ] | `stat-scaling.md` | |
| [ ] | `map-coordinates.md` | text ไม่ต้องมีแผนที่ |

## 10 — Design (dev-facing)

| | หน้า | |
|---|---|---|
| [~] | [`pillars-vision.md`](10-design/pillars-vision.md) | ทำไมไอเดียนี้มีโอกาส |
| [~] | [`game-design-document.md`](10-design/game-design-document.md) | D1-15 · R1-4 |
| [~] | [`balance-notes.md`](10-design/balance-notes.md) | ออกแบบเป็นสูตร · **รอ 4 blocker** |
| [~] | [`narrative-bible.md`](10-design/narrative-bible.md) | combat log line · กฎ 4 ข้อ |
| [~] | [`systems-specs/design-rules.md`](10-design/systems-specs/design-rules.md) | 36 กฎ |
| [~] | [`systems-specs/content-dimensions.md`](10-design/systems-specs/content-dimensions.md) | 9 layer |
| [ ] | `systems-specs/open-questions.md` | **O1-O10 ยังฝังอยู่ใน game-design-document บรรทัด 100-270** |
| [ ] | `art-direction/` | **ไม่มี** · D13 ตัดภาพออก · แต่ยังไม่รู้ว่า font/สีทำที่ไหน |
| [ ] | `audio-direction.md` | |

## 11 — Technical (dev-facing)

| | หน้า | |
|---|---|---|
| [ ] | `architecture.md` | |
| [~] | `data-schema/` | มี entity shape ใน damage-pipeline แล้ว |
| [ ] | `save-system.md` | |
| [ ] | `modding-api.md` | มีแค่หมายเหตุว่า Melvor mod ใช้ได้ |
| [ ] | `build-release.md` | |

## 12 — Meta

| | หน้า | |
|---|---|---|
| [ ] | `changelog-patch-notes/` | **CHANGELOG.md ถูกลบไปแล้วโดยผู้ใช้** |
| [ ] | `known-issues.md` | บั๊ก 5 รอบอยู่ใน design-rules |
| [ ] | `roadmap.md` | |
| [ ] | `faq.md` | |
| [ ] | `credits.md` | |
| [ ] | `contributing-style-guide.md` | |

---

## สรุป: เราขาดอะไร

**12 หมวด · 49 โฟลเดอร์ · 60 หน้า · มีเนื้อหา 13 · ว่าง 47**

| หมวด | สถานะ |
|---|---|
| **10-design** | เกือบครบ — เป็นหมวดที่แข็งที่สุด |
| 03-gameplay · 04-items | มีโครง แต่ยังไม่มีตัวเลขที่วัดได้สักตัว |
| 01-world | มีโซนแต่ไม่มี lore |
| 02-characters | **ว่างทั้งหมด** — เพราะไม่มี class และ tree ยังไม่ออกแบบ |
| 06 · 07 · 08 | **ว่างทั้งหมด** — quest, social, guide ยังไม่แตะเลย |
| 09-reference | **ว่างทั้งหมด** — ไม่มี drop table เลย |
| 11 · 12 | ว่าง |

**สิ่งที่ขาดและควรรู้ก่อนคุยเรื่องอื่น:** มีเพียง **2 หน้าจริง** ที่ยังไม่ถูกย้ายเข้าโครงสร้างใหม่ — `weapons` (12 ชิ้น) กับ `affixes` (10 ชนิด) ที่คิดไว้ใน breadcrumbs · และ **O1-O10 ยังฝังอยู่ในไฟล์อื่น** ทั้งที่ควรเป็นหน้าแยก

---

## ข้อควรระวัง

โฟลเดอร์เปล่า 47 ฟอลเดอร์ **ไม่ใช่แผนงาน** — มันคือคำถามว่า "อะไรยังไม่ได้คิด" · ถ้าไม่อยากเห็นมันทั้งหมด ให้ดูแค่ส่วนที่มีเนื้อหา

ทุกครั้งที่แก้อะไร: เนื้อหาที่**ยังไม่ตัดสิน**ต้องอยู่ใน [breadcrumbs.md](../breadcrumbs.md) ไม่ใช่ใน wiki · ไม่งั้น wiki จะโกหกว่าของที่ยังคิดไม่ออกถูกตัดสินแล้ว