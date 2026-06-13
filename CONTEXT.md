# CONTEXT.md — Domain Glossary

ไฟล์นี้คือ **glossary เท่านั้น** — ไม่ใช่ spec, ไม่ใช่ scratch pad, ไม่มี implementation detail
ทุกคำมีนิยามเดียวกันทั้งทีม — ถ้าใครใช้คำนอกนี้ ให้สะกิดถามว่าหมายถึงคำไหนใน glossary นี้

---

## Actors (ผู้ใช้ระบบ)

### Admin
ผู้ดูแลระบบของโรงเรียน (มีไม่กี่คน เช่น 1-3 คน)
**ทำได้:** ตรวจ audit log, ดูข้อมูล Teacher/Student ทั้งหมด, ดู CourseOffering ที่ Teacher สร้างผ่าน Admin Observer View, import Teacher ผ่าน CSV, reset password ของ Teacher/Student, export log, moderate (ลบ) Comment ทั้ง CLASS_WIDE และ PRIVATE scope (PRIVATE = Critical-tier audit · Phase 6 / ADR-0021 sibling decision)
**ทำไม่ได้:** ใส่คะแนน, เช็คชื่อ, ตรวจ Submission, สร้าง CourseOffering / Assignment / Announcement แทนครู

### Admin Observer View
มุมมอง read-only ของ Admin เหนือ CourseOffering ที่ Teacher สร้างเอง
Admin เห็นโครงสร้างห้องวิชา สมาชิก คะแนนรวม Attendance Submission Feed และข้อมูลประกอบที่จำเป็นต่อการกำกับดูแลได้ แต่ไม่กลายเป็นเจ้าของ CourseOffering และไม่ทำ action แทน Teacher

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
- ✅ รายชื่อสมาชิกของ CourseOffering — **เฉพาะ "ชื่อ-นามสกุล" ของเพื่อน** (ไม่เห็น `studentId`, ไม่เห็น `enrolledAt`, ไม่เห็นคะแนน/attendance)
- ✅ Class-wide Comments (ทั้งห้องเห็น)
- ❌ studentId ของเพื่อน (เป็น login identifier — นับเป็น PII)
- ❌ คะแนนคนอื่น
- ❌ Attendance คนอื่น
- ❌ Submission คนอื่น
- ❌ Private Comments ระหว่างครู↔เพื่อนคนอื่น

> Members list ฝั่งครูแสดง studentId + ชื่อ-นามสกุล + enrolledAt + ปุ่ม remove — ฝั่งนักเรียนแสดงเฉพาะชื่อ-นามสกุล (sorted by Thai name)

---

## Academic Structure

### Academic Year (ปีการศึกษา)
ปีการศึกษาตามปฏิทินไทย เช่น "2568" (พ.ศ.)

### Term (ภาคเรียน / เทอม)
หนึ่งภาคเรียน — เป็นของ Academic Year หนึ่ง
ตัวอย่าง: "เทอม 1/2568", "เทอม 2/2568"

### Class (ห้องเรียน)
กลุ่มนักเรียนที่อยู่ห้องเดียวกัน 1 ปีการศึกษา (homeroom)
ตัวอย่าง: "ม.4/2 ปี 2568"
มี Homeroom Teacher (optional) 1 คน

**สร้างได้ 2 ทาง (อัปเดต 2026-06-13 — เดิมเขียนว่า "โรงเรียนกำหนดเท่านั้น"):**
1. **Admin** สร้าง/แก้ Class โดยตรงที่ `/admin/setup` (โครงสร้างหลัก)
2. **Teacher (lazy / implicit)** — ตอนสร้าง CourseOffering ครูกรอก `gradeLevel` + `roomName` → ระบบ `formatClassName` เป็น "ม.4/2" แล้ว **upsert `Class`** ด้วย key `(academicYearId, name)`: ถ้ายังไม่มีในปีนั้น = สร้างให้, ถ้ามีแล้ว = ใช้ห้องเดิมร่วมกัน (ครูไม่ต้องรอ admin ตั้งห้องก่อน · `lib/course/create-course.ts`)

> ผล: ครู 2 คนที่พิมพ์ "ม.4/2" ในปีเดียวกัน → ผูกกับ `Class` row เดียวกันเสมอ (ไม่เกิดห้องซ้ำ). Homeroom teacher ยังกำหนดแยกได้ที่ฝั่ง admin
> ⚠️ Migration note: ขึ้นกับ unique constraint `Class.@@unique([academicYearId, name])`

### CourseOffering (Workspace ของครู) ⭐ KEY ENTITY
ตัวอย่าง: "คณิตศาสตร์ ม.4 ครูสมชาย ห้อง ม.4/2 เทอม 1/2568"
= วิชาที่ครูสร้างเองสำหรับสอนห้องหนึ่งในเทอมหนึ่ง

**Properties:**
- `name` (ครูตั้งเอง — เช่น "คณิตศาสตร์ ม.4 ครูสมชาย" หรือ "Math 4/2 Period 3")
- `subjectCode` (optional — สำหรับ transcript เช่น "MATH-M4", "ค31101")
- `gradeLevel` (เช่น "ม.4")
- `creditHours` (หน่วยกิต — ใช้คำนวณ Term GPA)
- `classCode` (รหัสเข้าห้อง)
- `teacher`, `class`, `term` (FK)

**ทุกอย่างที่เกิดใน "ห้องเรียนหนึ่ง" (Attendance, Score, Assignment, Announcement, Material, Comment) อยู่ใต้ CourseOffering นี้**

> **ADR-0012 / Workspace model:** ไม่มี Subject template — ครูสร้าง CourseOffering พร้อมตั้งชื่อ + ระบุ creditHours เอง  ครู 2 คนอาจสร้าง "คณิตศาสตร์ ม.4" คนละ object → ระบบไม่ enforce uniqueness; รายงาน cross-class จับคู่ด้วย `subjectCode` (ถ้ามี) หรือ name fuzzy

### Credit Hours (หน่วยกิต)
น้ำหนักของวิชาในการคำนวณ Term GPA — เก็บใน CourseOffering ตรงๆ (ADR-0012)
ครูระบุค่าเองตอนสร้างวิชา (ตามมาตรฐานโรงเรียน)

### Enrollment (การลงทะเบียน)
ความสัมพันธ์ระหว่าง Student กับ CourseOffering
**สร้างได้โดย:** Student ใช้ Class Code
**Soft-deletable:** มี `removedAt`, `removedById`, `removedReason` — ครูกด "Remove" ไม่ทำลาย row (เพื่อกัน orphan ScoreEntry/Submission ใน Phase 5/6) — Active members = `removedAt IS NULL`

### Remove from Course (นำออกจากห้อง)
Action ของครู — soft-delete Enrollment row ของ Student คนหนึ่ง
**บังคับ:** ใส่ `reason` (min 5 ตัวอักษร) + audit event `COURSE_MEMBER_REMOVED`
นักเรียนที่ถูก remove แล้ว → ScoreEntry/Submission/Attendance ยังคงอยู่ใน DB เพื่อ trace ได้

### Restore by Rejoin (กลับเข้าด้วย Class Code)
ถ้านักเรียนที่ถูก remove ใช้ Class Code เดิม join อีก → ระบบ `removedAt = null` อัตโนมัติ + audit event `COURSE_MEMBER_RESTORED_BY_REJOIN`
ถ้าครูต้องการ block ถาวร → deactivate Class Code (Settings tab) — Phase 3 ยังไม่มี per-student block

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

### TimetableSlot (ตารางสอนซ้ำรายสัปดาห์)
ตารางเวลาเรียน recur ทุกสัปดาห์ของ CourseOffering หนึ่ง
1 slot = 1 (วัน × ช่วงเวลา) เช่น "ทุกจันทร์ 13:30-15:00 ห้อง 305"
**Properties:** `dayOfWeek` (0=อาทิตย์..6=เสาร์), `startTime`/`endTime` ("HH:mm" 24h, local Bangkok time), `location?`
**Optional:** CourseOffering ไม่จำเป็นต้องมี slot — ครูยังเปิด Session แบบ manual ได้ทันที
1 CourseOffering มี 0..N slots; ห้ามทับซ้อนภายใน course เดียวกัน (block); ทับซ้อนข้าม course ของครูคนเดียวกัน = silently allow (ADR-0015 § Decision 1)

### Session (คาบเรียน)
**คาบเรียน 1 ครั้งที่ materialize แล้ว** ของ CourseOffering หนึ่ง — ต่างจาก TimetableSlot (template) ตรงที่ Session คือ concrete event ที่เกิดขึ้นจริง
**สร้างได้ 2 ทาง (lazy materialization — ADR-0015):**
- **Scheduled:** ครูเปิดหน้าเช็คชื่อของวันที่ DOW ตรง TimetableSlot → auto find-or-create
- **Manual ad-hoc:** ครูกด "เปิดคาบนี้" ระบุเวลาเอง (`timetableSlotId = null`)
**Properties:** `scheduledStart`/`scheduledEnd` (UTC concrete instant), `timetableSlotId?` (provenance, SetNull ถ้า slot ถูกลบ), `note?`, `createdById`
ไม่มี cron, ไม่ pre-generate — วันหยุด = ไม่มี Session row

### Session Cancellation (ยกเลิกคาบ)
Action ของครู — soft-cancel Session ที่ materialize แล้ว → `cancelledAt`, `cancelledById`, `cancelledReason` (min 5 ตัวอักษร)
**ไม่ลบ row** เพราะอาจมี AttendanceRecord ถูกเช็คไปแล้ว — trace ได้ผ่าน `cancelledAt IS NOT NULL`
Audit event: `SESSION_CANCELLED` (Critical tier)
Session ที่ cancelled = ไม่นับใน stats (denominator ของ % attendance)

### Attendance Status — 4 ค่า:
- **Present** (มา), **Late** (สาย), **Excused** (ลา), **Absent** (ขาด)

### Attendance Record
1 row = 1 Enrollment × 1 Session × 1 Status — **sparse semantic** (ADR-0016): ไม่มี row = "ยังไม่เช็ค" ≠ "ขาด"
FK ไป `Enrollment.id` (ไม่ใช่ `Student.userId`) — preserve trace ผ่าน soft-delete (ADR-0013)
`onDelete: Restrict` กัน hard-delete Enrollment ที่มี records
**Properties:** `status`, `note?`, `markedAt`, `markedById`, `updatedAt`, `editCount`
Unique constraint: `(sessionId, enrollmentId)` — 1 row ต่อนักเรียนต่อคาบ

### Back-edit (แก้ย้อนหลัง)
การแก้ AttendanceRecord ที่ `Session.scheduledStart` นานเกิน 24 ชั่วโมง
**บังคับ:** `reason` ≥ 5 ตัวอักษร + audit event `ATTENDANCE_BACK_EDIT` (Important tier)
Reference point = `scheduledStart` ของ Session ไม่ใช่ `markedAt` ของ record (CONTEXT decision Q8a)

### Grid Membership (ใครโผล่ใน attendance grid?)
**Active ∪ Ever-marked-in-this-Session** (ADR-0016 § Decision 3):
- Future / current Sessions → active members (`removedAt IS NULL`) เท่านั้น
- Historical Sessions → active + นักเรียนที่เคย marked ใน Session นี้ (แม้ถูกนำออกแล้ว — แสดงแบบ read-only + badge "ถูกนำออกแล้ว")
History-preserving: ห้องนี้ในอดีต = แสดงตามที่เกิดจริง

---

## Scoring

### Score Item (รายการคะแนน) ⭐
"ช่อง" คะแนน 1 ช่อง ใน CourseOffering
มีคุณสมบัติ: `name`, `full_score`, `is_published`, `published_at`, `source` (manual หรือ assignment-linked)
**Influence model (ADR-0024):** ไม่มี `weight` channel แล้ว — `fullScore` เป็นตัวกำหนดอิทธิพลของ Score Item ในเกรดวิชาโดยตรง (Quiz fullScore=10 มีน้ำหนัก 10/Σ ของวิชา, Midterm fullScore=50 มีน้ำหนัก 50/Σ อัตโนมัติ)
**Invariant:** ❌ ไม่มี Σ invariant — ตัด publish-gate `Σweight=10000` ทิ้งทั้งระบบ (เคยอยู่ใน ADR-0017, superseded)
**Field-class rules ตอนแก้หลัง publish (ADR-0018 § B partially superseded by ADR-0024):**
- **A — cosmetic** (`name`, `position`) → แก้เสรี ไม่ต้อง reason
- **B — score-impacting** (`fullScore`) → ต้อง `reason ≥ 5` + audit `SCORE_EDIT_AFTER_PUBLISH` (เดิมมี `weight` ใน class นี้ด้วย — ลบไปพร้อม column drop)
- **C — provenance** (`source`, `scoreItemTemplateId`) → immutable; ถ้าจะเปลี่ยนต้อง delete + create ใหม่

### Score Item Template
ชุด Score Item ที่ครูเคย setup ไว้ ใช้ copy ไปยัง CourseOffering อื่นได้

### Score Entry (รายการคะแนนของนักเรียน)
คะแนนที่ครูกรอกให้ Student คนหนึ่งใน Score Item หนึ่ง
**Visibility:** Student เห็นเฉพาะถ้า Score Item `is_published = true`

### Publish (เผยแพร่)
การที่ครูกดเปลี่ยน Score Item จาก draft → visible to students
**One-way door (ADR-0018):** `publishedAt` set ครั้งเดียวแล้ว revert ไม่ได้ — ไม่มี unpublish
**หลัง publish:**
- การแก้ Score Entry ต้องระบุ `reason ≥ 5` + audit `SCORE_EDIT_AFTER_PUBLISH`
- การแก้ ScoreItem field class B (`fullScore`) → reason + audit เดียวกัน
- การลบ ScoreItem ที่มี entry → reason ≥ 5 + audit `SCORE_DELETE_AFTER_PUBLISH` (Critical)

### Score Total (เกรด% ของวิชา)
`Σ score / Σ fullScore × 100` ของ Score Item ที่ publish แล้ว — หน่วย %
สูตรนี้แทน "Weighted Total" เดิม (ADR-0017 superseded by ADR-0024). `fullScore` มากกว่า = อิทธิพลในเกรดวิชามากกว่า โดยอัตโนมัติ
Edge cases: 0 published items → `null` (state `EMPTY`); `ΣfullScore === 0` → `null`

### Grade (เกรด)
ระดับผลการเรียน 0-4 — คำนวณอัตโนมัติจาก Weighted Total ของ **CourseOffering หนึ่ง**
เกณฑ์ default: `80+ → 4.0`, `75+ → 3.5`, `70+ → 3.0`, `65+ → 2.5`, `60+ → 2.0`, `55+ → 1.5`, `50+ → 1.0`, `<50 → 0`
ครู override ได้ใน CourseOffering setup (การ override editor จะเปิดในเวอร์ชันถัดไป — ปัจจุบันทุก CourseOffering ใช้เกณฑ์มาตรฐาน · `CourseOffering.gradeRulesJson` schema field พร้อมรองรับแล้ว)

### Term GPA (เกรดเฉลี่ยภาคเรียน)
ค่าเฉลี่ยถ่วงน้ำหนัก credit ของทุก CourseOffering ที่ Student enrolled ใน Term หนึ่ง
**สูตร:** `Σ(grade × creditHours) / Σ(creditHours)` — render ทศนิยม 2 ตำแหน่ง
**เงื่อนไข:** คำนวณเฉพาะเมื่อทุก Score Item ของทุก CourseOffering ใน Term นั้น **publish ครบทั้งหมด** (Decision 2.4)
ถ้ายังไม่ครบ → แสดงเป็น `—` พร้อม flag "ยังไม่จบเทอม" + progress bar `publishedItems / totalItems`
**Scope rules:**
- นับเฉพาะ **active enrollment** ของ student ใน term (`removedAt IS NULL`) — ถูก remove แล้ว = ไม่นับ
- **CourseOffering ที่ `creditHours === 0`** (เช่น วิชาที่ไม่ตัดเกรด — ลูกเสือ) → ไม่นับใน GPA และไม่นับใน completion check
- Edge cases: 0 enrollment → `null` (state `EMPTY`); CourseOffering ที่มี 0 ScoreItem → `null` (state `IN_PROGRESS`)

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
- `score_item_id` (FK nullable เฉพาะตอน `is_scored=false` · ถ้า `is_scored=true` จะมี ScoreItem ผูกอัตโนมัติใน $transaction เดียวกันที่สร้าง Assignment / flip toggle — schema ไม่เก็บ state `is_scored=true AND scoreItemId IS NULL` · ดู ADR-0019)
- `submission_closed` (boolean — ครูกด "ปิดการส่ง" manual ได้ · hard stop)
- `auto_close_at_due` (boolean — opt-in per Assignment · default `false` · ถ้า `true` + `now >= dueAt` → ระบบ refuse SubmissionVersion ใหม่ที่ submit-time · soft stop, lazy check, ไม่มี cron · Q3.2-C inline lock)

**Coupling rules (ADR-0019):**
- Auto-created ScoreItem ตอน `is_scored=true`: `weight` + `fullScore` ครูระบุใน create dialog (ไม่มี default) · `name = Assignment.title` · `source = ASSIGNMENT_LINKED` (class C, immutable)
- Toggle `is_scored: true → false` reversal — Draft + 0 entries: atomic delete · Draft + N entries: block · Published: block (escape = `deleteScoreItem` Critical audit)

### Submission (การส่งงาน)
งานที่ Student ส่งใน Assignment หนึ่ง
**1 Enrollment × 1 Assignment = 1 Submission** (มี version history ภายใน)

### SubmissionVersion (เวอร์ชันของการส่ง)
แต่ละครั้งที่ Student submit/resubmit → สร้าง version ใหม่

### Submission Conversation
บทสนทนา PRIVATE ระหว่าง Student เจ้าของ Submission กับ Teacher เจ้าของ CourseOffering ใต้ Submission หนึ่ง
ใช้สำหรับ feedback ตอนครู Return งาน และคำถามเฉพาะงานของนักเรียนคนนั้น แยกจาก Feed Comment ใต้ Assignment Post ซึ่งเป็น CLASS_WIDE thread ของทั้งห้อง

### Submission Answer
เนื้อหาที่ Student ส่งเป็นคำตอบงาน เช่น text/file/link ใน SubmissionVersion
ไม่ใช่ Comment และไม่ใช่ Conversation UI เพื่อไม่ให้สับสนกับ Submission Conversation

### Student Assignment Workspace
หน้ารายละเอียด Assignment สำหรับ Student
จัด layout เป็น 2 โซน: พื้นที่หลักแสดง Assignment Post ของ Teacher พร้อม Feed Comment แบบ CLASS_WIDE ใต้โพสต์ และ panel ด้านขวาเป็น Submission Panel สำหรับงานส่วนตัวของ Student
หลังส่งงานแล้ว panel แสดง action แยกกันชัดเจน:
- **แก้ไขงาน** — เปิด flow ส่ง SubmissionVersion ใหม่แทน version ปัจจุบัน โดยยังเก็บ version เก่าไว้
- **ยกเลิกการส่ง** — withdraw current submission ออกจากสถานะที่ครูต้องตรวจ แต่ไม่ลบ Submission/SubmissionVersion เดิม เพื่อให้ audit และประวัติยังตรวจสอบได้

### Assignment Review Workspace
หน้าตรวจงานของ Teacher สำหรับ Assignment หนึ่ง
เป็น workflow แบบ master-detail ในหน้าเดียว: รายชื่อนักเรียนอยู่ด้านหนึ่ง รายละเอียด Submission ที่เลือกอยู่ด้านหนึ่ง Teacher ใส่คะแนนใน panel เดียวกัน กด “ยืนยัน” แล้วระบบเลื่อนไป Submission ถัดไปทันที เพื่อลดการเข้าออกหน้าซ้ำ ๆ

Resolved workflow decisions:
- Review queue = submitted work first. The primary queue contains only `SUBMITTED` and `LATE_SUBMITTED` submissions.
- Queue order = current submission version `submitted_at ASC` so the earliest submitted work is reviewed first.
- Confirm = save score and mark the submission `GRADED` in one action. Do not require a separate "mark graded" checkbox.
- Ungraded assignments use the same flow, but the primary action label is "ตรวจเสร็จ" and no score input is shown.
- Return is a secondary action in the same review panel. It expands an inline feedback textarea, requires at least 5 characters, creates the private feedback comment, writes the return audit/notification, and advances to the next queued submission.
- Submission Conversation is secondary context in this workspace. It appears below the submitted answer as a collapsible section, not as the main grading panel.
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

**Lifecycle rules (ADR-0020):**
- `is_late` (per SubmissionVersion) = descriptive flag เท่านั้น — ระบบไม่ block grading, ไม่ compute penalty (Q3.1-A) · ครูที่อยากหักคะแนนสายใส่ในค่า ScoreEntry เอง
- `Submission.status` reflects current version — เดินหน้าเสมอ (on-time v1 → late v2 → status `LATE_SUBMITTED`; ไม่ย้อนกลับ)
- RETURN เป็น workflow signal — ScoreEntry ไม่ถูกแตะ (ตาม ADR-0018 lifecycle ของตัวเอง · grade ที่ครูเคยใส่อยู่ค้าง · re-grade ผ่าน `upsertScoreEntry` ตามกฎ post-publish reason gate เดิม)
- Voluntary resubmit (ไม่ผ่าน RETURN cycle) — allowed ตราบ `submission_closed=false` AND `(auto_close_at_due=false OR now < dueAt)` · UI confirm "แทนที่งานเดิม?"

### Return (ส่งคืน)
ครูเปิด submission → ยังไม่พอใจ → กด "Return" + private comment → status = `RETURNED` → นักเรียน resubmit ได้
**History:** version เก่ายังเก็บไว้ — Audit-able

### Grade Submission (ตรวจ + ให้คะแนน)
สำหรับ scored Assignment เท่านั้น:
- ครูใส่คะแนนใน submission → save เป็น Score Entry ของ Score Item ที่ผูก
- กด "Publish" → นักเรียนเห็นคะแนน + weighted total อัพเดต

---

## Learning Results (ผลการเรียน)

### Learning Results Page
หน้าแยกของ Student ที่แสดงผลการเรียนรายวิชา **ไม่ปนกับ Course Feed**
URL: `/student/terms` (default = เทอมปัจจุบัน) + `/student/terms/[termId]` (ประวัติ)
Top-level navigation ของ Student — ชื่อใน UI: "ผลการเรียน"

Resolved language:
- In normal product UI, "เกรด" means the grade of one CourseOffering, not a Term GPA.
- Term is a lightweight filter for selecting the set of CourseOfferings to display. It is not the main mental model.
- GPA is not a primary surface in this workflow. Do not show a large GPA card, green GPA highlight, term-completion progress, or "ยังไม่จบเทอม" progress on this page.
- If a transcript/report surface is needed later, it should be a separate workflow.

**สิ่งที่แสดง:**
- Header: ปี/เทอม + ชื่อนักเรียน + Student ID
- Dropdown เลือกเทอมก่อนๆ แบบเบาๆ (เก็บข้อมูลข้ามเทอม/ปี)
- ตาราง CourseOffering ทั้งหมดใน Term: วิชา · ครู · คะแนนรวม · % · เกรดรายวิชา · สถานะ
- สถานะรายวิชา: `ยังไม่มีคะแนน`, `กำลังอัปเดต`, `ประกาศแล้ว`
- ปุ่ม "Print เป็น PDF" (ใช้ Father print stylesheet)

**ไม่แสดง:**
- ❌ Term GPA as the hero metric
- ❌ GPAX สะสม (out of scope)
- ❌ completion/progress phrased as "ยังไม่จบเทอม"
- ❌ Attendance summary (ดูในหน้า Course ของแต่ละวิชา)
- ❌ Assignment summary (ดูในหน้า Course)

### Term Status (ของ Term หนึ่ง สำหรับ Student คนหนึ่ง)
ไม่ใช่ entity ใหม่ใน DB — เป็นค่าคำนวณ 3 ค่า:
- **EMPTY** — student ไม่มี active enrollment ใน Term นี้ หรือทุก CourseOffering มี 0 ScoreItem
- **IN_PROGRESS** — มี enrollment + มี Score Item แต่ publish ยังไม่ครบ → GPA = `null`
- **COMPLETED** — ทุก Score Item ของทุก CourseOffering ใน Term นั้น publish ครบแล้ว → GPA คำนวณได้
**One-way transitions (ADR-0018):** `EMPTY → IN_PROGRESS → COMPLETED` เท่านั้น — ไม่มี backward เพราะ unpublish ไม่ allowed

---

## Feed Content

### Feed
Timeline ของ activity ใน CourseOffering หรือพื้นที่ review ของ Admin
- **Course Feed:** activity ใน CourseOffering หนึ่ง แยกจาก Dashboard ของ Student/Admin
- **User Feed:** ไม่ใช่ surface บน Dashboard อีกต่อไป; Student/Admin Dashboard ไม่แสดง section "กิจกรรมล่าสุด"
- **Admin Activity Review:** พื้นที่ในหมวด Admin สำหรับดู activity รวมที่ไม่ใช่ Audit Log เช่น activity จาก CourseOffering หลายห้อง ใช้เพื่อค้นหา/ติดตามภาพรวม ไม่ใช่หลักฐาน security/compliance

### Announcement (ประกาศ)
Post ของครู — title (optional, 0..200) + body (markdown subset, 0..5000) + attachments (optional) + linkUrls (optional, max 5)
แสดงใน Feed, ไม่มี submission, ไม่มีคะแนน · comments เฉพาะ CLASS_WIDE
Edit เสรีตลอดอายุวิชา (Verbose, ไม่ log) · soft-delete = audit `ANNOUNCEMENT_DELETED` Important + cascade suppress notification rows ที่ ref entity นี้

### Material (เอกสารประกอบ)
Post ของครู — title (required, 1..200) + body (markdown subset, 0..5000) + attachments (optional) + linkUrls (optional, max 5)
ไฟล์/ลิงก์ที่นักเรียนต้องอ่าน/ใช้ประกอบเรียน · ไม่มี submission, ไม่มี deadline · comments เฉพาะ CLASS_WIDE
Edit เสรี (Verbose, ไม่ log) · soft-delete = audit `MATERIAL_DELETED` Important + cascade suppress

### Feed Activity Types
สิ่งที่ปรากฏใน Feed (เรียงตาม sortAt DESC · sortAt = creation/publish time, stable — ไม่ bump เมื่อ edit):
1. **Assignment** — Post ใหม่ · sortAt = `createdAt`
2. **Announcement** — ประกาศ · sortAt = `postedAt`
3. **Material** — เอกสาร · sortAt = `postedAt`
4. **Score Published** — Score Item ที่ publish (1 entry ต่อ Score Item) · sortAt = `publishedAt` (one-way, ADR-0018)

> Bell-only kinds (`SUBMISSION_GRADED`, `SUBMISSION_RETURNED`, `COMMENT_REPLIED`, `CLASS_CODE_JOINED`, `SCORE_ENTRY_EDITED`) **ไม่อยู่ใน Feed** — เป็น private/personal event ที่ surface ผ่าน Bell เท่านั้น

### Due Soon Widget (Phase 7)
**ไม่ใช่ Feed entry · ไม่ใช่ Notification** — เป็น **state-derived list** ที่ render บน Student Dashboard เท่านั้น
- Query: `Assignment WHERE dueAt BETWEEN now AND now+24h AND own Submission.status ∈ {NOT_SUBMITTED, DRAFT}`
- Re-compute ทุกครั้งที่ user เปิด dashboard · ไม่มี cron, ไม่มี materialized row (สอดคล้อง ADR-0015)
- Sort by `dueAt ASC` · max 5 items
- เหตุที่ไม่เป็น Notification kind: deadline เป็น property ของ Assignment ที่อ่านตอนไหนก็ derive ได้ · ไม่ใช่ event-driven trigger (ADR-0022 § Deadline reminders are not events)

---

## Comments

### Comment
ข้อความที่ User โพสต์ผูกกับ entity หนึ่ง

### Comment Scope — 2 ค่า:
- **CLASS_WIDE:** ทั้ง CourseOffering เห็น — โพสต์ใต้ Announcement / Material / Assignment
- **PRIVATE:** เห็นแค่ครู + นักเรียนคนเดียว — โพสต์ใต้ Submission

### Comment Notification Fan-out (Phase 7)
ใครได้ `COMMENT_REPLIED` notification เมื่อมี comment ใหม่:
- **PRIVATE (ใต้ Submission):** "อีกฝ่าย" 1 คน — student ↔ teacher · เลย entity author/thread participants logic เพราะมีแค่ 2 actor
- **CLASS_WIDE (ใต้ Assignment/Material/Announcement):** `DISTINCT(prior comment authors) ∪ {entity author} − {self}` — "thread participants" rule
  - กฎเหมือนกันทุก actor — ครู comment ใต้ entity ตัวเองที่ยังไม่มี thread = 0 recipient (uniform rule · ไม่ broadcast)
  - Edit comment ภายใน 5 นาที = ไม่ update notification snapshot (Q5.3 / ADR-0022 § Snapshot fixed)
- **`SUBMISSION_RETURNED` กับ private comment ที่ใช้เป็น audit reason:** merge เป็น 1 row ของ kind `SUBMISSION_RETURNED` · ไม่ fire `COMMENT_REPLIED` ซ้ำ

### Comment Moderation
**Soft-delete** (`deletedAt` / `deletedById` / `deletedReason` ≥ 5 chars) — row preserved, UI render placeholder "ข้อความนี้ถูกลบ"; thread structure ของ replies คงอยู่
**Moderation matrix** (Q5-A · Phase 6):

| ผู้ลบ | CLASS_WIDE | PRIVATE |
|------|-----------|---------|
| Author (เอง) | edit ภายใน 5 นาที · self-delete anytime (Verbose, ไม่ log) | edit ภายใน 5 นาที · self-delete anytime (Verbose, ไม่ log) |
| Teacher (ของ CourseOffering) | ✅ + reason ≥ 5 + `COMMENT_MODERATED` Important | ✅ + reason ≥ 5 + `COMMENT_MODERATED` Important |
| Admin (ใดๆ) | ✅ + reason ≥ 5 + `COMMENT_MODERATED` Important | ✅ + reason ≥ 5 + `COMMENT_MODERATED` **Critical** |

- หลัง 5 นาที author แก้ไม่ได้แต่ self-delete ได้ตลอด — content ของตัวเอง
- `COMMENT_EDITED` = Verbose (ไม่ log — เป็น in-window self-action)

---

## Notifications

### Notification
**Entity** ใน DB — `Notification` row 1 อันต่อ (ผู้รับ × event) ผ่าน fan-out semantic (ADR-0022)
**Bell** = UI surface ใน navbar ที่ render Notification rows · "Notification" หมายถึง entity row · "Bell" หมายถึง dropdown component

### Notification Kind — 9 ค่า (Phase 7):

**Broadcast kinds** (1 row ต่อ active enrollment ใน CourseOffering):
- `SCORE_ITEM_PUBLISHED` — Score Item เพิ่ง publish (one-way per ADR-0018)
- `ASSIGNMENT_POSTED` — Assignment ใหม่
- `MATERIAL_POSTED` — Material ใหม่
- `ANNOUNCEMENT_POSTED` — Announcement ใหม่

**Targeted kinds** (1 row ต่อ student เดียว):
- `SCORE_ENTRY_EDITED` — ครูแก้ ScoreEntry หลัง publish (1 ต่อ student ต่อ batch · ค่าเปลี่ยนเท่านั้น · ดู Q6 / ADR-0022 § Bulk semantics)
- `SUBMISSION_GRADED` — ครูใส่คะแนน + publish ScoreEntry สำหรับ Submission นั้น
- `SUBMISSION_RETURNED` — ครู return งาน (merge กับ private comment notification — ไม่ fire COMMENT_REPLIED ซ้ำ)

**Thread kinds:**
- `COMMENT_REPLIED` — comment ใหม่ใน thread ที่ user เคย participate (ดู § Comment Notification Fan-out)

**Teacher kinds:**
- `CLASS_CODE_JOINED` — นักเรียนเข้าห้องด้วย Class Code ของครู

### Notification Storage Model (ADR-0022)
- Schema: `{id, recipientId, kind, sourceEntityType, sourceEntityId, payloadJson, courseOfferingId?, readAt?, suppressedAt?, createdAt}`
- `sourceEntityType` enum: `SCORE_ITEM | ASSIGNMENT | MATERIAL | ANNOUNCEMENT | SUBMISSION | COMMENT | ENROLLMENT`
- `payloadJson` = **snapshot** ของ entity (title, postedByName, etc.) ตอน fan-out — ไม่ JOIN ที่ render time · entity ถูกแก้/ลบทีหลัง = bell preview เป็น snapshot เดิม
- Fan-out = **synchronous in-tx** กับ mutation ต้นทาง (Pattern 2 ขยาย · ADR-0022 § In-tx delivery)
- Dedup = **partial unique index** บน `(recipientId, kind, sourceEntityId)` เฉพาะ kind ที่ post-once (`SCORE_ITEM_PUBLISHED`, `ASSIGNMENT_POSTED`, `MATERIAL_POSTED`, `ANNOUNCEMENT_POSTED`, `SUBMISSION_GRADED`, `SUBMISSION_RETURNED`, `CLASS_CODE_JOINED`) — kind ที่ repeatable (`SCORE_ENTRY_EDITED`, `COMMENT_REPLIED`) ไม่อยู่ใน unique scope

### Notification Suppression
- **`suppressedAt`** = soft hide จาก bell · ไม่ลบ row · trace ผ่าน DB ได้
- Trigger ที่ตั้ง suppressedAt:
  1. **`removeMember` (ADR-0013):** batch UPDATE `suppressedAt = now()` บน notification ทั้งหมดของ student นั้นใน course นั้น — in-tx
  2. **Restore by rejoin (ADR-0013):** un-suppress (`suppressedAt = null`) ใน enrollByClassCode tx
  3. **Entity soft-delete:** ลบ Material/Announcement/ScoreItem → cascade suppress notification rows ที่ ref entity นั้น (in-tx กับ delete mutation)
- **Comment soft-delete** = **ไม่** cascade suppress · snapshot text ค้างใน notification · click → entity แสดง "(ข้อความถูกลบ)" placeholder ของ Phase 6 (Q13.5 / ADR-0022 § Snapshot semantics)

### Notification Read State
- `readAt` = nullable · default null
- Trigger ที่ set readAt:
  1. **Open bell panel** → mark the visible notification page read (the rows currently rendered in the bell, normally the latest 20 non-suppressed rows)
  2. **Click bell row** → still navigates to the entity; if the row is unread, it may also call `markNotificationRead(id)` as a safe fallback
  3. **Mark all read button** → secondary escape hatch that bulk-updates every row for the user where `readAt IS NULL AND suppressedAt IS NULL`
- Opening the panel does **not** mark older notifications that are not loaded/visible in that panel page.
- **ไม่** audit (Pattern 10 Verbose — ทั้ง `NOTIFICATION_DELIVERED` และ `NOTIFICATION_READ` ไม่ log)
- Badge count = `WHERE recipientId = me AND readAt IS NULL AND suppressedAt IS NULL`

### Notification Trigger Map
| Source mutation | Kind | Recipient set |
|---|---|---|
| `publishScoreItem` | `SCORE_ITEM_PUBLISHED` | active enrollment ใน course ทั้งหมด (broadcast · snapshot at publish-time) |
| `bulkUpsertScoreEntries` (post-publish, value change) | `SCORE_ENTRY_EDITED` | 1 ต่อ student ที่ entry เปลี่ยนค่าใน batch นั้น (note-only edit ไม่ fire) |
| `createAssignment` | `ASSIGNMENT_POSTED` | active enrollment broadcast |
| `createMaterial` | `MATERIAL_POSTED` | active enrollment broadcast |
| `createAnnouncement` | `ANNOUNCEMENT_POSTED` | active enrollment broadcast |
| `gradeSubmission` (publish entry) | `SUBMISSION_GRADED` | student เจ้าของ Submission |
| `returnSubmission` | `SUBMISSION_RETURNED` | student เจ้าของ (merge กับ private comment) |
| `createComment` | `COMMENT_REPLIED` | thread participants (ดู § Comment Notification Fan-out) |
| `enrollByClassCode` | `CLASS_CODE_JOINED` | teacher เจ้าของ course |

### Notification Delivery
- Day 1: **In-app เท่านั้น** (🔔 navbar, badge count)
- Phase 2: email + LINE (out of scope ตอนนี้)

### Notification Retention
- Phase 7: **no cleanup** — สะสม row ตามอายุการใช้งาน · school scale (~230K row/year) Postgres ครอบสบาย
- Phase 9 hardening: ทบทวน archive policy ถ้า size > 10 GB

---

## File Storage

### FileAttachment
ไฟล์ที่ upload เข้าระบบ — เก็บใน Cloudflare R2
**Properties:**
- `id`, `r2_key` (path ใน R2 bucket = `permanent/<owner_type>/<owner_id>/<uuid>.<verified-ext>` · key ไม่เคยรวม user filename · ดู ADR-0021)
- `original_filename` (display only · ไม่ใช้ใน path), `mime_type` (verified ผ่าน magic-byte), `size_bytes` (≤ 20 MB)
- `owner_type` (enum: ASSIGNMENT, MATERIAL, ANNOUNCEMENT, SUBMISSION, COMMENT) — SUBMISSION attaches to parent Submission row; SubmissionVersion.fileAttachmentIds is the per-version pointer array (P7-0a / ADR-0022 sibling decision · ADR-0021 chicken-and-egg resolved)
- `owner_id`, `uploaded_by`, `uploaded_at`

**MIME allow-list (ADR-0021):** PDF · JPEG/PNG/WEBP/HEIC/HEIF · DOCX/XLSX/PPTX
**Blocked:** SVG (XSS vector), GIF, TXT/MD, ZIP/RAR, video/audio, ทุก executable
**Pipeline:** presigned PUT → R2 `staging/` prefix → `/api/storage/commit` (server fetch + magic-byte verify + EXIF strip via `sharp` re-encode สำหรับ image) → move ไป `permanent/` + insert FileAttachment row + audit `FILE_UPLOADED`

### Signed URL
URL ชั่วคราว (TTL = 300 s / 5 นาที — CLAUDE.md hard rule) สำหรับโหลดไฟล์จาก R2
**สร้างหลัง permission check เท่านั้น** — ห้าม cache, ห้าม log URL string
**Read strategy (ADR-0021 § 6):**
- Render-time signing สำหรับ image/PDF inline preview (`<img src>` / `<a href>` ฝัง URL ใน HTML)
- Click-time signing สำหรับ office doc download — page render `<a href="/api/storage/download/<fileId>">` → API route check permission → 302 redirect ไป signed R2 URL
- `Content-Disposition: inline` สำหรับ `image/*` + PDF · `attachment` สำหรับ DOCX/XLSX/PPTX
- ไม่มี `FILE_ACCESSED` audit event ใน Phase 6 — permission gate ตอน sign + 5min TTL ครอบคลุม

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
| "Course" (ลอยๆ) | CourseOffering (วิชาที่ครูสร้าง) |
| "Subject" | ไม่มีในระบบ (ADR-0012 — ใช้ CourseOffering แทน) |
| "Class" (ลอยๆ — หมายถึงคาบ?) | Session (คาบ) / Class (ห้องนักเรียน) |
| "Grade" (ลอยๆ — เกรด หรือชั้น?) | Grade (เกรด 0-4) / Grade Level (ม.4, ม.5) |
| "Score" ลอยๆ | Score Entry / Score Item / Score Total |
| "Weighted Total" | Score Total (ADR-0024 superseded weight-based formula) |
| "weight" / "น้ำหนัก" ใน Score Item | ❌ ไม่มีแล้ว — `fullScore` กำหนดอิทธิพลโดยตรง (ADR-0024) |
| "Attendance" คำเดียว | Attendance Record (ของคน) / Session (คาบ) |
| "Homework" / "Task" | Assignment |
| "Submit" ลอยๆ | Submission (entity) / submit action (verb) |
| "Post" ลอยๆ | Announcement / Material / Assignment |
| "Room" / "Class" (Google sense) | CourseOffering |
| "Stream" | Feed |
| "Notification" (ลอยๆ — entity หรือ UI?) | Notification (DB row) / Bell (navbar dropdown UI) |
| "Deadline reminder" (Phase 7+) | Due Soon Widget (state-derived list บน dashboard · ไม่ใช่ Notification kind) |
