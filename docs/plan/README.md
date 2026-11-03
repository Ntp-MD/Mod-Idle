# docs/plan — ที่รวมแผนงาน

กติกา: แผนไหนทำเสร็จครบแล้วให้**ลบไฟล์ทิ้ง** (git history เก็บ record ไว้แล้ว ไม่ต้องเก็บไฟล์ค้าง)

| ไฟล์ | สถานะ | ลบได้หรือยัง |
|---|---|---|
| `docs/active-skill-mechanics-plan.md` | เสร็จครบ stages 0–6 + gates ผ่าน (ลบไปแล้ว) | ลบแล้ว ✓ |
| `docs/active-skill-redesign-draft.md` | rollout ดำเนินอยู่: tuning ตรงตัว 8 แถว ✓ / retire 5 แถว ✓ / แถวใหม่ 9 แถว ✓ / rework 11 แถว ✓ (ตัวเลขยึดตาม draft; blizzard/meteor/thunder/arrow ใช้ค่าตั้งต้น + verify ด้วย `--calc` แล้ว) | **ยังห้ามลบ** — เป็นต้นทาง proposal เดียว |
| `docs/active-skill-redesign-draft.md` | ค้าง: sim-measured final tuning (draft สั่งห้าม lock ตัวเลข), full VFX art ของ 9 แถวใหม่ (ตอนนี้มีแค่วงแหวน), full suite 9 failures อยู่ระหว่างไล่แก้ | รอให้ครบก่อนแล้วค่อยลบ |

ลบไฟล์แผน = `git rm` + `npm run sync` ตามปกติ
