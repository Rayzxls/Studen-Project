# Product

## Register

product

## Users

โรงเรียนไทยขนาดกลาง (1 โรงเรียน ต่อ instance — single-tenant, ADR-0001) มี 3 roles ใช้งานต่างบริบท:

**Admin** (1-3 คน) — ครูฝ่ายวิชาการ/ปกครอง — ใช้สัปดาห์ละ 2-3 ครั้ง — desktop ที่ห้องธุรการ — งานคือ audit log, CSV import ครู, reset password — ไม่ใส่ข้อมูลแทนใคร

**Teacher** (30-80 คน) — ครูประจำวิชา — ใช้ทุกวันที่สอน — desktop ใน staff room + tablet ในห้องเรียน — งานคือกรอกคะแนน เช็คชื่อ สร้าง assignment ตรวจงาน — เป็นเจ้าของ "workspace ครู" ของตัวเอง (ADR-0012)

**Student** (500-2000 คน) — นักเรียน ม.1-6 — ใช้ทุกวัน — มือถือ 95%+ — งานคือดูคะแนน ส่งงาน ดู feed — L1 visibility (เห็นเฉพาะของตัวเอง + roster ห้อง)

## Product Purpose

รวม Google Classroom (feed/assignment) + ระบบเกรดโรงเรียนแยก เป็นระบบเดียวต่อโรงเรียน เพื่อให้:

- ครูทำงานน้อยลง (กรอกคะแนนที่เดียว เห็น weighted total + grade ทันที, ไม่ต้องส่งออก Excel)
- นักเรียนหาข้อมูลของตัวเองได้ทันที (คะแนน, attendance %, deadline) เลิกพิมพ์ถามครูใน LINE
- โรงเรียนตรวจสอบได้ตลอด (audit log ทุก mutation, ครูแก้คะแนนหลัง publish ต้องมี reason)

## Brand Personality

**Quiet · Premium · Modern** (Calm Ledger theme — ADR-0014, supersedes Ink+Gold)

โทนของระบบ = **fintech-premium calm** เหมือนแอปธนาคารระดับ private banking ที่ไม่ตะโกน — รวมกับ Studennnn's domain ของการจัดการห้องเรียน

- Calm Ledger theme (ADR-0014): off-white surface (`#F5F5F5`), black-pill primary actions, aubergine (`#2B2644`) card สำหรับ moment ของ contrast — ไม่มี gold, ไม่มี gradient text
- Single typeface (Anuphan — Cadson Demak, Thai+Latin) ทุกระดับ — display, body, label
- รูปทรง: `rounded-full` pills + `rounded-2xl` cards — ไม่มี `rounded-lg` แบบ Ink+Gold เดิม
- Motion เป็น state ไม่ใช่ decoration (button hover color shift, card lift, fade-in entries) — ไม่มี shimmer, ไม่มี float, ไม่มี gradient pan, ไม่มี tilt
- Hero surfaces ใช้ full-bleed media (image หรือ future video) ใน `rounded-2xl` card — ไม่มี mesh-bg, ไม่มี blob
- Voice: ไทย 100%, สุภาพแต่ไม่ราชการ ("เข้าสู่ระบบ" ไม่ใช่ "เข้าใช้บริการ"), ไม่จิ๊ก, ไม่ emoji ใน UI structure (emoji ใช้ได้เฉพาะ feed card type indicator)

## Anti-references

ระบบ **ไม่** ควรดูเหมือน:

- **ERP โรงเรียนไทยเก่า / เว็บราชการ** — Bootstrap 3, ตาราง dense ไม่มี hierarchy, สีเทาทึบ, desktop-only, ฟอนต์ Tahoma
- **EdTech ไทยเดิม** — สีส้ม+ฟ้า+สมจี loud, mascot น่ารัก, Cordia/Tahoma, illustration ผีเสื้อบินรอบเด็ก, ปุ่ม "เย้! สนุก!"
- **Google Classroom** — Material default generic ที่ทุกโรงเรียนเหมือนกัน ไม่มี personality
- **Generic AI-SaaS landing slop** — gradient hero shouty, hero-metric template ("50,000+ teachers"), eyebrow uppercase ทุก section, isometric vector illustration, 01/02/03 numbered scaffold

> **Note:** "Premium fintech landing" (Halo / Linear / Stripe Sessions / well-crafted Sequoia portfolio site) **เป็น aesthetic ที่เราเข้าหา** ไม่ใช่ anti-reference (revised in ADR-0014). Slop คือ generic gradient hero ที่ไม่มี POV ไม่ใช่ premium-fintech ทั้งแฟมิลี่

## Design Principles

1. **เครื่องมือที่หายไปในงาน** ครูกำลังกรอกคะแนน 40 คนต่อเนื่อง, ระบบต้องไม่ขวางด้วย animation ฟุ่มเฟือยหรือ surprise affordance ครูควรไม่รู้สึกว่ากำลังใช้แอป

2. **Motion เพื่อ state, ไม่ใช่ตกแต่ง** animation = feedback (save success), state change (publishing), navigation continuity (tab switch), ไม่ใช่เคลื่อนเพราะดูเท่ `prefers-reduced-motion` ทุกที่

3. **3 roles, 3 mental models** Admin = audit lens (compact, dense, IDs+timestamps); Teacher = workspace ownership (control, configurable, edit-first); Student = consumption + low-friction submit (mobile, glanceable, large touch targets) UI ของ 3 ฝั่งไม่ต้องเหมือนกัน

4. **Quiet premium, ไม่ใช่ shouty SaaS** ระบบรับใช้โรงเรียน, ใช้รูปทรงและจังหวะ (rounded-full pills, rounded-2xl cards, ทึบหรือไม่ทึบเฉย ๆ — ไม่มี gradient/sheen/shimmer ตกแต่ง) ให้ความรู้สึก "ของจริง" Aubergine (`#2B2644`) ใช้กับ moment ที่ต้อง contrast (1-2 cards ต่อหน้า) ถ้า aubergine อยู่ทุกหน้า = ทอนค่าตัวเอง

5. **Privacy as visible design** L1 visibility ของนักเรียนต้องเห็นจาก UI ไม่ใช่แค่ server guard เด็กควรเห็น affordance ที่บอก "เพื่อนมองไม่เห็นคะแนนเรา" (lock icon ที่ Score card, "ส่วนตัว" badge ที่ submission) Design ที่ trust

## Accessibility & Inclusion

WCAG 2.1 AA + กลุ่มผู้ใช้พิเศษของไทย:

- Body text contrast ≥ 4.5:1 (large text ≥ 3:1) ทุกหน้า, verify ด้วย axe-core CI gate
- Keyboard nav ครบทุก mutation (ครูใช้ keyboard กรอกคะแนน grid ได้ Tab+Enter)
- ARIA labels ทุก icon button + state announce (toast "บันทึกคะแนนแล้ว")
- **ครูสูงอายุ:** font scale browser ≥ 125% ต้องไม่ทำให้ layout แตก หน้า data-heavy (กรอกคะแนน, ตรวจงาน) ใช้ contrast สูงกว่า 4.5:1 (target 7:1)
- **นักเรียน mobile-first จริงจัง:** ทุก `/student/*` view design ที่ 360px ก่อน, desktop = enhancement Touch targets ≥ 44px Bottom nav สำหรับ thumb reach
- **Reduced motion:** `prefers-reduced-motion` ปิด tilt-card, blob float, page transitions, ใช้ instant หรือ 100ms crossfade
- **Thai script:** IBM Plex Sans Thai size base ≥ 16px, line-height ≥ 1.6 (วรรณยุกต์ไม่ชน), ไม่ใช้ uppercase กับไทย
- PDPA strict ตามที่ Phase 1 + Phase 9 รับผิดชอบ (consent, data export, soft delete + anonymize)
