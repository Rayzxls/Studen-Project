# ADR-0011 — Theme: Ink + Gold (adopted from Father)

## Status
Accepted — 2026-05-30

## Context

Brief เดิมระบุ "Modern + ทางการ" + "3D + animation ในทุกๆ โครงสร้าง"

ในการคุย design มี trade-off ที่ต้องตัดสินใจ:
1. **Palette สีจัด (indigo/violet/pink)** — modern, สนุก, ดึงดูดเด็ก
2. **Palette ทางการ (ink/dark + gold)** — formal, prestigious, ขรึม

mockup รอบแรกที่ผมเสนอใช้ indigo+violet — ผู้ใช้ไม่ปฏิเสธโดยตรงแต่ชี้ให้ดูโปรเจกต์ Father (`C:\Users\Rayz\Father`) ซึ่งเป็น grade portal ที่ใช้ **Ink + Gold theme** + **IBM Plex Sans Thai** — และระบุว่า "สวยดี อาจจะนำเอาแนวคิดแบบนั้นมาใช้"

Father มี design system พร้อม production:
- `tailwind.config.ts` — tokens, keyframes, animations, perspective utilities
- `globals.css` — component layer (card, btn, badge, table, stat) + utility layer (tilt-card, mesh-bg, glass, sheen, blob, gradient text) + print stylesheet สำหรับ transcript

## Decision

**Adopt Father design system ทั้งชุด** เป็น baseline ของ Studennnn:

1. **Palette:** Ink (`#0F172A`) + Gold (`#B8860B`) เป็น primary/accent — ห้ามใช้ indigo/violet/pink เป็น primary
2. **Font:** IBM Plex Sans Thai (subsets: thai + latin, weights 300-700)
3. **Component classes:** `.card`, `.btn-{primary/secondary/ghost/accent/danger}`, `.input`, `.badge-{admin/teacher/student/gold}`, `.table`, `.stat`
4. **Signature elements:**
   - `.btn-primary` — black gradient + gold shimmer sweep on hover
   - `.text-gradient-gold` — animated gold gradient (สำหรับ GPA / KPI)
   - `.mesh-bg` — hero radial gold gradients
   - `.tilt-card` — CSS perspective 3D (no WebGL)
   - `.sheen` — hover sweep
5. **Print stylesheet** — copy ทั้งชุด, A4 + transcript-ready ตั้งแต่ baseline
6. **Color usage:** rose/blue/emerald/amber เป็นสีรองสำหรับ semantic badges เท่านั้น (error/info/success/warn)
7. **3D strategy ปรับใหม่:**
   - Level A (WebGL/R3F) — เฉพาะ landing, login, 404, loading
   - Level B (CSS-based — tilt, mesh, blob, sheen, perspective) — ใช้ทั่วไปใน production-safe pages

## Consequences

### ดี
- **เร็วขึ้นมาก** — Phase 0 ไม่ต้อง design system from scratch; copy + tweak ไม่กี่วันใช้ได้
- **Battle-tested** — Father เป็น grade portal เหมือนกัน, design ใช้กับ data-heavy pages ได้พิสูจน์แล้ว
- **"3D feel" ฟรี** — tilt-card + mesh-bg ทำให้รู้สึก 3D โดยไม่กิน GPU เหมือน R3F
- **Print-ready** — transcript PDF export ทำได้ทันทีเมื่อต้องการ (post-launch feature เลื่อนได้แต่ไม่ต้องเขียน CSS ใหม่)
- **Brand identity ชัดเจน** — ผู้ใช้รู้ว่า "นี่คือ academic system" ตั้งแต่หน้าแรก
- **Consistent กับ vision** — "ทางการ" ตรงตัว, ไม่ใช่ tech-startup look

### เสีย
- **น่าเบื่อกว่า** สำหรับเด็กที่ชอบสีสด — แต่ vision ระบุ "ทางการ" ชัดเจน
- **License/credit** — ต้องระบุว่า adapted from Father (internal project ของผู้ใช้เอง → no external license issue)
- **Lock-in กับ pattern** — แก้ theme ในอนาคต = touch ทุกหน้าที่ใช้ class เหล่านี้ (mitigated โดย token-based design — เปลี่ยน `#B8860B` ที่เดียวกระทบทั้งระบบ)
- **R3F ใช้น้อยลง** — เพราะ tilt-card/mesh-bg เพียงพอแล้ว → R3F เหลือแค่ 4-5 จุด (landing/login/404/loading) แทนที่จะใช้กว้างขวาง

### Neutral
- **Brand divergence จาก mockup รอบแรก** — Architecture/CLAUDE ต้อง update palette references (already done in this commit)
- **Color contrast ดี** — Ink #0F172A บน white = WCAG AAA; Gold accent บน white = AA สำหรับ large text — ต้องระวังเมื่อใช้กับ text เล็ก

## Alternatives Considered

### B. นำแนวคิดมา ปรับ palette
ใช้ Ink+Gold base แต่เพิ่ม secondary accent (เช่น teal สำหรับ feed icons) เพื่อแยก visual hierarchy ของกิจกรรมประเภทต่างๆ
**ตัดสินใจไม่เลือก:** ขัด minimal aesthetic ของ Father; ใช้ icon + shape variation พอแล้ว

### C. เอาเฉพาะ palette + font, component class เขียนใหม่
รับ Ink+Gold + Plex Thai แต่ออกแบบ component layer จาก shadcn ตรงๆ
**ตัดสินใจไม่เลือก:** ทำให้ Phase 0 ยาวขึ้น 3-5 วัน, signature elements (shimmer button, sheen, tilt) ต้องเขียนใหม่หมด, ไม่ได้ benefit จาก battle-test ของ Father

### D. ออกแบบ design system ใหม่ทั้งหมด
**ตัดสินใจไม่เลือก:** ต้อง dedicate 1-2 สัปดาห์ทำ design phase, scope creep

## Related

- [CLAUDE.md § Design System](../../CLAUDE.md) — implementation rules
- [Architecture.md § Design System](../../Architecture.md) — tech integration
- Father source: `C:\Users\Rayz\Father\apps\web\` (reference only, not a dependency)
