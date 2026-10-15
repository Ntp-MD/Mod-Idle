# Handoff — 3 งานที่เจ้าของต้องการให้เสร็จ (ยังไม่เริ่ม)

เขียน 2026-10-15 · อ้างอิง working tree วันนี้ ซึ่งเขียวครบ: `108 gates (58·16·5·13·9·7)` · `422 tests / 30 files` · `tsc` clean · `--sync` "nothing written"
_owner intent: คิดว่าทำไปแล้วทั้ง 3 ข้อ — ให้ถือว่ามีอำนาจสั่งทำได้ตามใบนี้ ไม่ต้องรออนุมัติซ้ำ ยกเว้นป้าย "(optional)"_

รันทุกคำสั่งจาก repo root; ใช้ `node --experimental-strip-types --disable-warning=ExperimentalWarning tools/<x>.ts …` หรือ `pnpm …` ตามที่มีใน `AGENTS.md`

---

## งาน 1 — ลบ `mob.form_catalog` (ข้อมูลตาย 246 แถว)

**หลักฐาน**
- `tools/data/engine.json` → `mob.form_catalog` = 246 แถว ซึ่งเหมือนกับ `mob.forms` แบบ byte-for-byte
- reader ของ `forms`: `engine/index.ts:151, 265` และ `tools/check.ts` (X76, `formName` at `check.ts` X19 block)
- reader ของ `form_catalog`: **ไม่มี** — gate เดียวที่เคยอ่าน (X77) และ clause ท้าย X78 ถูกลบไปแล้ว; `grep -n form_catalog tools/*.ts` → 0
- type ที่เหลือ: `engine/types.ts` (`form_catalog: Record<string, Record<string, MobForm>>`)

**ทำ**
1. ลบ key `form_catalog` ออกจาก `mob` ใน `tools/data/engine.json` (เฉพาะ key นี้ — **ห้ามแตะ `mob.forms`**)
2. ลบ field `form_catalog` ใน `engine/types.ts` (และ import/type ที่ค้างถ้าไม่มีใครใช้)
3. `grep -rn "form_catalog" engine/ game/src tools/ docs/` ต้องเหลือ 0 (ถ้าเจอ cite ใน `game/src/wiki/pages.ts` หรือ docs ให้แก้ข้อความเป็น `mob.forms`)

**ตรวจรับ**: `pnpm verify` (108 gates) · `pnpm test` · `pnpm typecheck` · `pnpm wiki` · ยืนยันว่าจำนวน field forms ในรายงาน X76 ยัง 246 เท่าเดิม

**ความเสี่ยง**: ต่ำ — ไม่มีเส้นทางถึง save และไม่มี reader เหลือ

---

## งาน 2 — lock 3 จุดที่ยังเหลือ (count / tuned window)

| gate | ที่อยู่ | เดิม | เปลี่ยนเป็น | เหตุผล |
|---|---|---|---|---|
| **LT14** | `tools/loot.ts:396` | `identity && conserved && leaning && leans.length === 3` | ตัด `leans.length === 3` (เหลือ 3 ข้อแรก) | `leans` มาจาก `categories.map(...)` → จำนวนเท่า list เสมอ และ list ถูก iterate อยู่แล้ว ถ้าเพิ่ม category ที่ 4 มันจะถูกตรวจเองอัตโนมัติ |
| **BS13** | `tools/bases.ts:198` | `shields.length !== 3` | `shields.length < 1` + คง loop ตรวจ profile ไม่ซ้ำ / `weight > 0` / known Frame Mod | "3 Shield frames" คือ shape ของวันนี้ ไม่ใช่กติกา; loop `seenShieldProfiles` ตรวจความซ้ำให้อยู่แล้ว |
| **X25** | `tools/check.ts:674` | `ES.delay_sec >= 3 && ES.delay_sec <= 8` | `ES.delay_sec > 0` | tuned window ใน gate ขัด `AGENTS.md` ("Do not encode … tuned windows … as gates"); กลไกจริงที่ห้ามพังคือ `es_recover_sec === 100 / regen_pct` และ player-only ซึ่งตรวจต่อ |

**ทำเพิ่มพร้อมกัน**: อัปเดตข้อความ pass-message ของทั้ง 3 gate ให้ตรงกับสิ่งที่ตรวจจริง (gate พิมพ์ความหมายของตัวเอง)

**ตรวจรับ (gate ต้องยังกัด)** — mutation probe ทีละตัว: แก้ค่าใน data หรือ engine expression ให้ผิด → gate ต้อง **แดง** → restore แล้วต้องเขียว
- LT14: set `loot.variant_lean.shift_pct` ให้ไม่ conserve (เช่นทำให้ sum ต่าง) → LT14 แดง
- BS13: เพิ่ม shield frame ที่ profile ซ้ำ → แดง; frame ใหม่ที่มี profile ต่างกัน → **ต้องผ่าน** (นี่คือจุดที่แก้)
- X25: `ES.delay_sec = 0` → แดง; `= 12` → **ต้องผ่าน** (จุดที่แก้)

---

## งาน 3 — 6 ชื่อ variant ที่ยังช้ำ + การตั้งชื่อ

กฎที่ปลดล็อกทางให้: X57 ไม่ได้บังคับต่อท้ายชื่อ Species อีกแล้ว (`DECISIONS.md` §Mob Core) → ชื่อสั้นอย่าง "Blackbark Dryad" ถูกต้องเท่าเดิม และ 1 variant : 1 แถว `mob.variant_drops` ยังบังคับโดย X78

| Species (bandleveL) | เดิม | เสนอ | เหตุผล | item ที่ต้องตาม |
|---|---|---|---|---|
| Dryad (26-38) | Corrupted Dryad | **Blackbark Dryad** | "corrupted" เป็นสถานะ ไม่ใช่ภาพ | `Corrupted Dryad Bark` → `Dryad Blackbark` |
| Mummy (39-50) | Royal Mummy | **Cartouche Mummy** | ยศมองไม่เห็น, cartouche เห็น | `Mummy Royal Cartouche` → `Mummy Cartouche` |
| Lizardman (61-80) | Scale Spear Lizardman | **Reed Spear Lizardman** | ชนคำนำกับ Scale Knight (26-40) | `Lizardman Scale Spearhead` → `Lizardman Reed Spearhead` |
| Elf (61-80) | Moon Archer Elf | **Silverarrow Elf** | ชนคำนำกับ Moon Elf (41-60) | `Elf Moon Arrow` → `Elf Silver Arrow` |
| Vampire (61-80) | Crimson Fencer Vampire | **Bloodveil Vampire** | ชน Crimson Knight (41-60) | — (`Vampire Crimson Thread` เป็น of the old rung; ตัดสินใจ: เปลี่ยนเป็น `Vampire Bloodveil Thread`) |
| Treant (41-60) | Sapling Treant | **Thicket Treant** | sapling อ่อนกว่า Young (1-20) = ลำดับอายุเพี้ยน | `Treant Sapling` → `Treant Thicket Shoot` |

**ขั้นตอน**
1. แก้ `mob.variants[species][i].name` และ key ที่ตรงกันใน `mob.variant_drops` (ค่า `item/rarity/lean` คงไว้ ยกเว้น `item` ที่อยู่ในคอลัมน์ขวา)
2. ระวังชื่อชน field form: `mob.forms[z][id].name` มี "Marsh Lizardman" อยู่แล้ว (บทเรียนรอบก่อน) → X57 (variant names) และ X76 (form names) แยก set กันแต่ชื่อซ้ำกันอ่านสับสน ให้ `grep -o "\"<ชื่อใหม่>\""` ทั้งไฟล์ก่อน
3. ตั้งชื่อ item ใหม่ต้องไม่ชน 210 แถว + 105 species alternatives (X39 นับ unique ทั้งสองชุด)
4. **ไม่มี save migration** — schema ยังไม่ public (`SCHEMA_VERSION 14`) และ stash เก่าถูกล้างโดยการเล่น (`DECISIONS.md` §Mob Core)
5. ราคาไม่เปลี่ยนเพราะผูกกับ rarity ไม่ใช่ชื่อ (`junk.rarities` · X39)

**ตรวจรับ**: `pnpm verify` · `pnpm test` · `pnpm wiki` แล้วเปิด `docs/wiki/mobs.html` ดูว่าชื่อใหม่ขึ้นจริงและไม่มีชื่อเก่าเหลือ

**(optional) watch การตั้งชื่อ** — ถ้าอยากได้ signal โดยไม่ lock จำนวน: เพิ่มบรรทัด `pending('X57-watch', …)` (ไม่ fail) ใน X57 ที่นับชื่อลงท้ายซ้ำเกิน ~4 ครั้งทั่ว roster แล้วพิมพ์เป็น watch line · ต้องไม่ทำให้ `pnpm verify` exit ≠ 0

---

## ปิดท้าย
- อัปเดต `draft/AUDIT.md` (Appendix C ข้อ 11, §3-R บรรทัดท้าย) เป็น settled พร้อมผลตรวจจริง แล้วลบหัวข้อเหล่านี้ออกจากร่างนี้
- ไม่แตะไฟล์อื่นที่อาจมีงานอื่นถืออยู่; `tools/check.ts`, `tools/data/engine.json`, `game/src/wiki/pages.ts` ถูกแก้บ่อย — re-read ก่อนเขียนทุกครั้ง
