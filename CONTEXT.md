# CONTEXT.md — Domain Glossary

ไฟล์นี้คือ **glossary เท่านั้น** — ไม่ใช่ spec, ไม่ใช่ scratch pad, ไม่มี implementation detail
ทุกคำมีนิยามเดียวกันทั้งทีม — ถ้าใครใช้คำนอกนี้ ให้สะกิดถามว่าหมายถึงคำไหนใน glossary นี้

---

## Actors (ผู้ใช้ระบบ)

### Admin
ผู้ดูแลระบบของโรงเรียน (มีไม่กี่คน เช่น 1-3 คน)
**ทำได้:** ตรวจ audit log, ดูข้อมูล Teacher/Student ทั้งหมด, import Teacher ผ่าน CSV, reset password ของ Teacher, export log, moderate (ลบ) Comment ใน class-wide feed
**ทำไม่ได้:** ใส่คะแนน, เช็คชื่อ, สร้าง CourseOffering / Assignment / Announcement

### Teacher (ครู)
ครูประจำวิชา — เป็นเจ้าของ CourseOffering ของตัวเอง
**ทำได้:** สร้าง CourseOffering, เช็คชื่อ (Attendance), ใส่ Score Entry, publish Score Item, สร้าง Assignment/Announcement/Material, ตรวจ Submission (Grade/Return), Comment, generate Class Code, reset password ของ Student ใน CourseOffering ตัวเอง

### Homeroom Teacher (ครูประจำชั้น)
**ไม่ใช่ role แยก** — เป็น attribute ของ Teacher: `Teacher.is_homeroom_of: Class | null`
**สิทธิ์เพิ่ม:** เห็นภาพรวม Class ที่ตัวเองดูแล (ทุกวิชา, ไม่ใช่แค่วิชาตัวเองสอน)

### Student (นักเรียน)
ผู้เรียน — สมัคร account เองได้ (self-register) แต่ต้องมี Class Code เพื่อเข้าห้องเรียน
**ทำได้:** สมัคร, join CourseOffering ผ่าน Class Code, ดู Score Entry ที่ publish, ดูสถิติ Attendance, ดู Grade, ส่ง Submission, Comment (private + class-wide), ดูรายชื่อสมาชิกห้อง
**ทำไม่ได้:** เห็นข้อมูลของคนอื่น (คะแนน, attendance, submission, private comments)

---

## Visibility Level (L1)

ระบบใช้ **L1 Visibility** — นักเรียนเห็น:
- ✅ ข้อมูลของตัวเอง 100%
- ✅ Metadata ห้อง (ชื่อวิชา, ครูสอน, ตารางเรียน, Class Code? **ไม่**, Announcement, Material, Assignment)
- ✅ รายชื่อสมาชิก (ชื่อ, ไม่มีคะแนน/attendance)
- ✅ Class-wide Comments (ทั้งห้องเห็น)
- ❌ คะแนนคนอื่น
- ❌ Attendance คนอื่น
- ❌ Submission คนอื่น
- ❌ Private Comments ระหว่างครู↔เพื่อนคนอื่น

---

## Academic Structure

### Academic Year (ปีการศึกษา)
ปีการศึกษาตามปฏิทินไทย เช่น "2568" (พ.ศ.)

### Term (ภาคเรียน / เทอม)
หนึ่งภาคเรียน — เป็นของ Academic Year หนึ่ง
ตัวอย่าง: "เทอม 1/2568", "เทอม 2/2568"

### Subject (รายวิชา)
ตัวแม่แบบของวิชา — ไม่ผูกกับครูหรือห้อง
ตัวอย่าง: "คณิตศาสตร์ ม.4"
**Properties:** `name`, `gradeLevel`, **`creditHours`** (หน่วยกิต — เช่น 1.5)

### Credit Hours (หน่วยกิต)
น้ำหนักของวิชาในการคำนวณ Term GPA
เก็บใน Subject (ไม่ใช่ CourseOffering) — Subject "คณิตศาสตร์ ม.4" ที่ไหนก็เป็น 1.5 เหมือนกัน

### Class (ห้องเรียน)
กลุ่มนักเรียนที่อยู่ห้องเดียวกัน 1 ปีการศึกษา
ตัวอย่าง: "ม.4/2 ปี 2568"
มี Homeroom Teacher (optional) 1 คน

### CourseOffering (วิชาที่เปิดสอน) ⭐ KEY ENTITY
"คณิตศาสตร์ ม.4 ที่ครูสมชายสอน ห้อง ม.4/2 เทอม 1/2568"
= 1 instance ของ Subject + Teacher + Class + Term
**ทุกอย่างที่เกิดใน "ห้องเรียนหนึ่ง" (Attendance, Score, Assignment, Announcement, Material, Comment) อยู่ใต้ CourseOffering นี้**

### Enrollment (การลงทะเบียน)
ความสัมพันธ์ระหว่าง Student กับ CourseOffering
**สร้างได้โดย:** Student ใช้ Class Code

### Class Code
รหัสที่ครูสร้างให้นักเรียนใช้ enroll
ตัวอย่าง: "MATH4A-A8K2"
**คุณสมบัติ:** unique ต่อ CourseOffering, ปิด/เปิด/regen ได้, มี expiry ตั้งได้

### Join Methods (รูปแบบการเข้าร่วม)
ทั้ง 3 แบบใช้ Class Code เดียวกัน ต่างกันแค่ "ทางส่ง" ให้นักเรียน:
- **Code Entry** — นักเรียนพิมพ์ code ที่ `/join`
- **QR Code** — สแกน QR → เปิด `/join?code=XXX` อัตโนมัติ (qrcode.react ฝั่ง client)
- **Invite Link** — `https://app/join?code=XXX` — copy/share LINE/Messenger
*Email invite* = out of scope (Phase 2+)

### QR Code (สำหรับห้องเรียน)
รูป QR ที่ encode `/join?code=<ClassCode>` — render ฝั่ง client เท่านั้น (ไม่เก็บใน DB)
หน้า "QR ของห้องนี้" สำหรับครูแสดงในชั้น/print แปะ

---

## Attendance

### Session (คาบเรียน)
หนึ่งครั้งของการเรียน ของ CourseOffering หนึ่ง
**สร้างได้ 2 ทาง:**
- **Manual:** ครูกด "เปิดคาบใหม่"
- **Scheduled:** ระบบ generate จาก timetable

### Attendance Status — 4 ค่า:
- **Present** (มา), **Late** (สาย), **Excused** (ลา), **Absent** (ขาด)

### Attendance Record
1 row = 1 Student × 1 Session × 1 Status
ผูกกับ Enrollment

---

## Scoring

### Score Item (รายการคะแนน) ⭐
"ช่อง" คะแนน 1 ช่อง ใน CourseOffering
มีคุณสมบัติ: `name`, `full_score`, `weight` (%), `is_published`, `published_at`, `source` (manual หรือ assignment-linked)
**Invariant:** ผลรวม `weight` ของ Score Item ทั้งหมดใน CourseOffering = 100%

### Score Item Template
ชุด Score Item ที่ครูเคย setup ไว้ ใช้ copy ไปยัง CourseOffering อื่นได้

### Score Entry (รายการคะแนนของนักเรียน)
คะแนนที่ครูกรอกให้ Student คนหนึ่งใน Score Item หนึ่ง
**Visibility:** Student เห็นเฉพาะถ้า Score Item `is_published = true`

### Publish (เผยแพร่)
การที่ครูกดเปลี่ยน Score Item จาก draft → visible to students
**หลัง publish:** การแก้ Score Entry ต้องระบุ `reason` + audit log

### Weighted Total
`Σ (score / full_score × weight)` ของ Score Item ที่ publish แล้ว — หน่วย %

### Grade (เกรด)
ระดับผลการเรียน 0-4 — คำนวณอัตโนมัติจาก Weighted Total ของ **CourseOffering หนึ่ง**
เกณฑ์ default: `80+ → 4.0`, `75+ → 3.5`, `70+ → 3.0`, `65+ → 2.5`, `60+ → 2.0`, `55+ → 1.5`, `50+ → 1.0`, `<50 → 0`
ครู override ได้ใน CourseOffering setup

### Term GPA (เกรดเฉลี่ยภาคเรียน)
ค่าเฉลี่ยถ่วงน้ำหนัก credit ของทุก CourseOffering ที่ Student enrolled ใน Term หนึ่ง
**สูตร:** `Σ(grade × creditHours) / Σ(creditHours)`
**เงื่อนไข:** คำนวณเฉพาะเมื่อทุก Score Item ของทุก CourseOffering ใน Term นั้น **publish ครบทั้งหมด** (Decision 2.4)
ถ้ายังไม่ครบ → แสดงเป็น `—` พร้อม flag "ยังไม่จบเทอม"

### ❌ GPAX (เกรดเฉลี่ยสะสมข้ามเทอม) — Out of Scope
**ไม่ทำในระบบนี้** เพราะโรงเรียนมีระบบ GPAX แยกอยู่แล้ว — Admin จะ export Term GPA ออกไปใส่ระบบนั้น
การมี GPAX ทั้ง 2 ที่ = สร้างความสับสน → ตัดออกชัดเจน

---

## Assignment & Submission ⭐

### Assignment (การบ้าน)
งานที่ครูมอบหมายให้ส่ง — เป็น Post ใน Feed
**Properties:**
- `title`, `description` (rich text — markdown subset)
- `dueAt` (DateTime, optional — ไม่ตั้ง = "ส่งเมื่อพร้อม")
- `allow_text`, `allow_file`, `allow_link` (boolean — เลือกได้ว่ารับรูปแบบไหน)
- `attachments` (ครูแนบไฟล์/ลิงก์ประกอบโจทย์ได้)
- `is_scored` (boolean — toggle "นับคะแนน")
- `score_item_id` (FK nullable — ถ้า `is_scored = true` จะมี ScoreItem ผูกอัตโนมัติ)
- `submission_closed` (boolean — ครูกด "ปิดการส่ง" manual ได้)

### Submission (การส่งงาน)
งานที่ Student ส่งใน Assignment หนึ่ง
**1 Enrollment × 1 Assignment = 1 Submission** (มี version history ภายใน)

### SubmissionVersion (เวอร์ชันของการส่ง)
แต่ละครั้งที่ Student submit/resubmit → สร้าง version ใหม่
**Properties:**
- `version_number` (1, 2, 3, ...)
- `text_content` (string nullable)
- `attachments` (FileAttachment[])
- `links` (string[] URLs)
- `submitted_at` (DateTime)
- `is_late` (boolean — เทียบกับ `Assignment.dueAt` ณ ตอน submit)
- `is_current` (1 version เท่านั้น per submission)

### Submission Status — 6 ค่า:
- **NOT_SUBMITTED** — ยังไม่ส่ง
- **DRAFT** — เริ่มกรอกแต่ยังไม่ submit
- **SUBMITTED** — ส่งแล้ว, on time
- **LATE_SUBMITTED** — ส่งแล้ว, หลัง deadline
- **RETURNED** — ครูส่งคืนพร้อม comment ให้แก้ → resubmit ได้
- **GRADED** — ครูใส่คะแนน + publish แล้ว (สำหรับ scored assignment); หรือ "ตรวจเสร็จ" (สำหรับ ungraded)

### Return (ส่งคืน)
ครูเปิด submission → ยังไม่พอใจ → กด "Return" + private comment → status = `RETURNED` → นักเรียน resubmit ได้
**History:** version เก่ายังเก็บไว้ — Audit-able

### Grade Submission (ตรวจ + ให้คะแนน)
สำหรับ scored Assignment เท่านั้น:
- ครูใส่คะแนนใน submission → save เป็น Score Entry ของ Score Item ที่ผูก
- กด "Publish" → นักเรียนเห็นคะแนน + weighted total อัพเดต

---

## Term Summary (ผลการเรียนรายเทอม)

### Term Summary Page
หน้าแยกของ Student ที่แสดงสรุปผลการเรียนต่อเทอม **ไม่ปนกับ Course Feed**
URL: `/student/terms` (default = เทอมปัจจุบัน) + `/student/terms/[termId]` (ประวัติ)
Top-level navigation ของ Student — ชื่อใน UI: "ผลการเรียน"

**สิ่งที่แสดง:**
- Header: ปี/เทอม + ชื่อนักเรียน + Student ID
- Dropdown เลือกเทอมก่อนๆ (เก็บข้อมูลข้ามเทอม/ปี)
- ตาราง CourseOffering ทั้งหมดใน Term: วิชา · ครู · credit · % · grade
- **Term GPA** (หรือ "—" ถ้ายังไม่จบ)
- Flag "ยังไม่จบเทอม" + เปอร์เซ็นต์ progress
- ปุ่ม "Print เป็น PDF" (ใช้ Father print stylesheet)

**ไม่แสดง:**
- ❌ GPAX สะสม (out of scope)
- ❌ Attendance summary (ดูในหน้า Course ของแต่ละวิชา)
- ❌ Assignment summary (ดูในหน้า Course)

### Term Status (ของ Term หนึ่ง สำหรับ Student คนหนึ่ง)
ไม่ใช่ entity ใหม่ใน DB — เป็นค่าคำนวณ:
- **IN_PROGRESS** — มี Score Item ที่ยัง publish ไม่ครบใน CourseOffering ใดๆ
- **COMPLETED** — ทุก Score Item ของทุก CourseOffering ใน Term นั้น publish ครบแล้ว → GPA คำนวณได้

---

## Feed Content

### Feed
Timeline ของ activity ใน CourseOffering หรือ User
- **Course Feed:** activity เฉพาะ CourseOffering หนึ่ง — แสดงในหน้า Course tab "Feed"
- **User Feed:** activity รวมจากทุก CourseOffering ของ User — แสดงในหน้า Dashboard

### Announcement (ประกาศ)
Post ของครู — ข้อความล้วน + รูป/ไฟล์/ลิงก์แนบ (optional)
แสดงใน Feed, ไม่มี submission, ไม่มีคะแนน

### Material (เอกสารประกอบ)
Post ของครู — ไฟล์/ลิงก์ที่นักเรียนต้องอ่าน/ใช้ประกอบเรียน
ไม่มี submission, ไม่มี deadline

### Feed Activity Types
สิ่งที่ปรากฏใน Feed (เรียงตาม recent):
1. **Assignment** — Post ใหม่
2. **Announcement** — ประกาศ
3. **Material** — เอกสาร
4. **Score Published** — Score Item ที่เพิ่ง publish (รวมเป็น 1 entry ต่อ Score Item)
5. **Assignment Graded** (private) — แสดงให้นักเรียนคนนั้นว่าครูตรวจแล้ว
6. **Comment Added** — comment ใหม่ใน thread ที่ user เกี่ยวข้อง
7. **Deadline Reminder** (private, system-generated) — แจ้งล่วงหน้า 24 ชม

---

## Comments

### Comment
ข้อความที่ User โพสต์ผูกกับ entity หนึ่ง

### Comment Scope — 2 ค่า:
- **CLASS_WIDE:** ทั้ง CourseOffering เห็น — โพสต์ใต้ Announcement / Material / Assignment
- **PRIVATE:** เห็นแค่ครู + นักเรียนคนเดียว — โพสต์ใต้ Submission

### Comment Moderation
- ครู (ของ CourseOffering) ลบ class-wide comment ของใครก็ได้ → audit log
- Admin ลบ class-wide comment ได้ → audit log
- ครู/นักเรียนแก้ comment ของตัวเองได้ภายใน 5 นาทีหลังโพสต์ → หลังจากนั้น immutable

---

## Notifications

### Notification
Event ที่ระบบ generate ให้ user คนหนึ่ง — แสดงใน 🔔 bell icon

### Notification Trigger
- Score Item published → ทุกคนใน CourseOffering
- Score Entry edited after publish (affecting them) → นักเรียนคนนั้น
- Assignment created → ทุกคนใน CourseOffering
- Assignment graded/returned → นักเรียนคนนั้น (private)
- Comment added → ผู้เกี่ยวข้อง (private comment: ครู+student; class-wide: ทุกคนใน thread นั้น)
- Deadline 24h before → นักเรียนที่ยังไม่ส่ง
- Class Code joined → ครูเจ้าของ CourseOffering

### Notification Delivery
- Day 1: **In-app เท่านั้น** (🔔 navbar, badge count)
- Phase 2: email + LINE (out of scope ตอนนี้)

---

## File Storage

### FileAttachment
ไฟล์ที่ upload เข้าระบบ — เก็บใน Cloudflare R2
**Properties:**
- `id`, `r2_key` (path ใน R2 bucket)
- `original_filename`, `mime_type`, `size_bytes`
- `owner_type` (enum: ASSIGNMENT, MATERIAL, ANNOUNCEMENT, SUBMISSION_VERSION, COMMENT)
- `owner_id`, `uploaded_by`, `uploaded_at`

### Signed URL
URL ชั่วคราว (expire 5 นาที) สำหรับโหลดไฟล์
**สร้างหลัง permission check เท่านั้น** — ห้าม cache, ห้าม log

---

## Identity & Access

### Identifier
ค่าที่ user ใช้ login
- **Admin / Teacher:** email
- **Student:** Student ID (เลขประจำตัวนักเรียน)

### Sign-up (Student)
Student สมัคร account เองได้ผ่าน `/signup` — กรอก Student ID, ชื่อ, นามสกุล, password
**Account สมัครเสร็จ → ยังไม่มี CourseOffering** → ต้องเข้า `/join` ใส่ Class Code

### Temporary Password
Password ที่ระบบ generate (CSV import ครู, password reset)
User **ต้องเปลี่ยน** ตอน login ครั้งแรก (`mustResetPwd = true`)

---

## Audit

### Audit Log Event
รายการเหตุการณ์ที่ระบบบันทึก — แบ่ง Critical / Important — ดู [Security.md § Audit](./Security.md)

### Reason
ข้อความที่ครูพิมพ์ตอนแก้ Score Entry หลัง publish
**บังคับ:** min 5 ตัวอักษร

### Retention
**2 ปีการศึกษา** → archive (สำหรับ audit log + submission files)

---

## ที่ห้ามใช้คำเหล่านี้ (ambiguous)

| ❌ อย่าใช้ | ✅ ใช้คำนี้แทน |
|----------|--------------|
| "User" (ลอยๆ) | Admin / Teacher / Student |
| "Account" | User Account (auth) / Student (domain) |
| "Course" (ลอยๆ) | Subject (แม่แบบ) / CourseOffering (เปิดสอน) |
| "Class" (ลอยๆ — หมายถึงคาบ?) | Session (คาบ) / Class (ห้องนักเรียน) |
| "Grade" (ลอยๆ — เกรด หรือชั้น?) | Grade (เกรด 0-4) / Grade Level (ม.4, ม.5) |
| "Score" ลอยๆ | Score Entry / Score Item / Weighted Total |
| "Attendance" คำเดียว | Attendance Record (ของคน) / Session (คาบ) |
| "Homework" / "Task" | Assignment |
| "Submit" ลอยๆ | Submission (entity) / submit action (verb) |
| "Post" ลอยๆ | Announcement / Material / Assignment |
| "Room" / "Class" (Google sense) | CourseOffering |
| "Stream" | Feed |
