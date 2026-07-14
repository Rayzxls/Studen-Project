# Product

## Register

product

## Users

โรงเรียนไทยขนาดกลาง (1 โรงเรียน ต่อ instance — single-tenant, ADR-0001) มี 3 roles ใช้งานต่างบริบท:

**Admin** (1-3 คน) — ครูฝ่ายวิชาการ/ปกครอง — ใช้สัปดาห์ละ 2-3 ครั้ง — desktop ที่ห้องธุรการ — งานคือ observer dashboard, audit/activity review, import ผู้ใช้ตาม flow ที่มี, reset password และ moderation — ไม่ใส่หรือแก้ข้อมูลการสอนแทนครู

**Teacher** (30-80 คน) — ครูประจำวิชา — ใช้ทุกวันที่สอน — desktop ใน staff room + tablet ในห้องเรียน — งานคือกรอกคะแนน เช็คชื่อ สร้าง assignment ตรวจงาน — เป็นเจ้าของ "workspace ครู" ของตัวเอง (ADR-0012)

**Student** (500-2000 คน) — นักเรียน ม.1-6 — ใช้ทุกวัน — มือถือ 95%+ — งานคือดูคะแนน ส่งงาน ดู feed — L1 visibility (เห็นเฉพาะของตัวเอง + roster ห้อง)

## Product Purpose

รวม Google Classroom (feed/assignment) + ระบบเกรดโรงเรียนแยก เป็นระบบเดียวต่อโรงเรียน เพื่อให้:

- ครูทำงานน้อยลง (กรอกคะแนนที่เดียว เห็น Score Total + เกรดรายวิชาทันที, ไม่ต้องคำนวณซ้ำใน Excel)
- นักเรียนหาข้อมูลของตัวเองได้ทันที (คะแนน, attendance %, deadline) เลิกพิมพ์ถามครูใน LINE
- โรงเรียนตรวจสอบได้ตลอด (audit log ทุก mutation, ครูแก้คะแนนหลัง publish ต้องมี reason)

## Brand Personality

**Friendly · Focused · Modern** (Calm Ledger v2 — ADR-0014 + ADR-0028 + ADR-0029)

โทนของระบบ = เครื่องมือการเรียนที่เป็นมิตร สีมีหน้าที่ชัด และให้ความรู้สึกตอบสนองแบบแอปสมัยใหม่ โดยยังคงความนิ่งในหน้าที่ครูต้องกรอกหรือตรวจข้อมูลต่อเนื่อง

- Calm Ledger v2: semantic surfaces รองรับ System/Light/Dark/Cream, System Blue เป็น primary action, green/orange/red ใช้ตามสถานะ และ course identity ใช้ palette 8 slots
- Single typeface (Anuphan — Cadson Demak, Thai+Latin) ทุกระดับ — display, body, label
- รูปทรง: `rounded-full` pills + `rounded-2xl` cards — ไม่มี `rounded-lg` แบบ Ink+Gold เดิม
- Motion เป็น task-modulated: landing/dashboard/feed มี interactive effect แบบจำกัด ส่วนคะแนน เช็กชื่อ ตรวจงาน audit และ form ใช้เฉพาะ state feedback
- Hero surfaces ใช้ภาพจริง/ภาพสร้างเฉพาะโดเมนหรือ interactive composition ที่ช่วยอธิบายงาน ไม่ใช้ effect เพื่อเติมพื้นที่ว่าง
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

4. **Friendly system, ไม่ใช่ shouty SaaS** ระบบรับใช้โรงเรียน สีทุกสีต้องบอก action/status/course identity หรือช่วยให้สแกนข้อมูลได้เร็ว ไม่ใช้ gradient, sheen หรือ motion แบบไม่สัมพันธ์กับงาน

5. **Privacy as visible design** L1 visibility ของนักเรียนต้องเห็นจาก UI ไม่ใช่แค่ server guard เด็กควรเห็น affordance ที่บอก "เพื่อนมองไม่เห็นคะแนนเรา" (lock icon ที่ Score card, "ส่วนตัว" badge ที่ submission) Design ที่ trust

## Accessibility & Inclusion

WCAG 2.1 AA + กลุ่มผู้ใช้พิเศษของไทย:

- Body text contrast ≥ 4.5:1 (large text ≥ 3:1) ทุกหน้า, verify ด้วย axe-core CI gate
- Keyboard nav ครบทุก mutation (ครูใช้ keyboard กรอกคะแนน grid ได้ Tab+Enter)
- ARIA labels ทุก icon button + state announce (toast "บันทึกคะแนนแล้ว")
- **ครูสูงอายุ:** font scale browser ≥ 125% ต้องไม่ทำให้ layout แตก หน้า data-heavy (กรอกคะแนน, ตรวจงาน) ใช้ contrast สูงกว่า 4.5:1 (target 7:1)
- **นักเรียน mobile-first จริงจัง:** ทุก `/student/*` view design ที่ 360px ก่อน, desktop = enhancement Touch targets ≥ 44px Bottom nav สำหรับ thumb reach
- **Reduced motion:** `prefers-reduced-motion` ปิด ambient/tilt/parallax และลด transition เหลือ static หรือ crossfade สั้น โดยไม่ซ่อนข้อมูล
- **Thai script:** Anuphan size base ≥ 16px, line-height ≥ 1.6 (วรรณยุกต์ไม่ชน), ไม่ใช้ uppercase กับไทย
- PDPA strict ตามที่ Phase 1 + Phase 9 รับผิดชอบ (consent, data export, soft delete + anonymize)
