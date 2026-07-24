# CONTEXT.md — Domain Glossary

ไฟล์นี้คือ **glossary เท่านั้น** — ไม่ใช่ spec, ไม่ใช่ scratch pad, ไม่มี implementation detail
ทุกคำมีนิยามเดียวกันทั้งทีม — ถ้าใครใช้คำนอกนี้ ให้สะกิดถามว่าหมายถึงคำไหนใน glossary นี้

---

## Actors (ผู้ใช้ระบบ)

### Admin
ผู้ดูแลระบบของโรงเรียน (มีไม่กี่คน เช่น 1-3 คน)
**ทำได้:** ตรวจ audit log, ดูข้อมูล Teacher/Student ทั้งหมด, ดู CourseOffering ที่ Teacher สร้างผ่าน Admin Observer View, สร้าง Teacher Invite รายคนหรือหลายคนผ่าน CSV, export log, moderate (ลบ) Comment ทั้ง CLASS_WIDE และ PRIVATE scope (PRIVATE = Critical-tier audit · Phase 6 / ADR-0021 sibling decision)
**ทำไม่ได้:** ใส่คะแนน, เช็คชื่อ, ตรวจ Submission, สร้าง CourseOffering / Assignment / Announcement แทนครู

### Admin Observer View
มุมมอง read-only ของ Admin เหนือ CourseOffering ที่ Teacher สร้างเอง
Admin เห็นโครงสร้างห้องวิชา สมาชิก คะแนนรวม Attendance Submission Feed และข้อมูลประกอบที่จำเป็นต่อการกำกับดูแลได้ แต่ไม่กลายเป็นเจ้าของ CourseOffering และไม่ทำ action แทน Teacher

### Teacher (ครู)
ครูประจำวิชา — เป็นเจ้าของ CourseOffering ของตัวเอง
**ทำได้:** สร้าง CourseOffering, เช็คชื่อ (Attendance), ใส่ Score Entry, publish Score Item, สร้าง Assignment/Announcement/Material, ตรวจ Submission (Grade/Return), Comment, generate Class Code

### Student (นักเรียน)
ผู้เรียน — สมัคร account เองได้ (self-register) แต่ต้องมี Class Code เพื่อเข้าห้องเรียน
**ทำได้:** สมัคร, join CourseOffering ผ่าน Class Code, ดู Score Entry ที่ publish, ดูสถิติ Attendance, ดู Grade, ส่ง Submission, Comment (private + class-wide), ดูรายชื่อสมาชิกห้อง
**ทำไม่ได้:** เห็นข้อมูลของคนอื่น (คะแนน, attendance, submission, private comments)

---

## Visibility Level (L1)

ระบบใช้ **L1 Visibility** — นักเรียนเห็น:
- ✅ ข้อมูลของตัวเอง 100%
- ✅ Metadata ห้อง (ชื่อวิชา, ครูสอน, ตารางเรียน, Class Code? **ไม่**, Announcement, Material, Assignment)
- ✅ รายชื่อสมาชิกของ CourseOffering — **เฉพาะ "ชื่อ-นามสกุล" ของเพื่อน** (ไม่เห็น Identifier ภายใน, ไม่เห็น `enrolledAt`, ไม่เห็นคะแนน/attendance)
- ✅ Class-wide Comments (ทั้งห้องเห็น)
- ❌ Identifier หรือข้อมูล Authentication ของเพื่อน
- ❌ คะแนนคนอื่น
- ❌ Attendance คนอื่น
- ❌ Submission คนอื่น
- ❌ Private Comments ระหว่างครู↔เพื่อนคนอื่น

> Members list ฝั่งครูแสดงชื่อ-นามสกุล + enrolledAt + ปุ่ม remove — ฝั่งนักเรียนแสดงเฉพาะชื่อ-นามสกุล (sorted by Thai name)

---

## Course Structure

Academic Year, Term, Class และ Homeroom Teacher ไม่ใช่โครงสร้างกลางของระบบ
Teacher สร้าง CourseOffering ได้โดยไม่รอ Admin และใส่ Learner Group Label, Academic Period Label และ Credit Hours แบบ optional ตามบริบทของวิชา
Admin ไม่สร้างหรือจัดการโครงสร้างการสอน แต่ยังสังเกต CourseOffering ที่ Teacher สร้างผ่าน Admin Observer View
Grade Level ไม่ใช่ข้อมูลบังคับแยกต่างหาก; Teacher ที่ต้องการระบุระดับชั้นเขียนไว้ใน Learner Group Label

### CourseOffering (Workspace ของครู) ⭐ KEY ENTITY
ตัวอย่าง: "คณิตศาสตร์ ม.4 ครูสมชาย"
= พื้นที่วิชาที่ครูสร้างและเป็นเจ้าของ โดยไม่ต้องสังกัด Class, Academic Year หรือ Term กลาง

**Properties:**
- `name` (ครูตั้งเอง — เช่น "คณิตศาสตร์ ม.4 ครูสมชาย" หรือ "Math 4/2 Period 3")
- `learnerGroupLabel` (optional — กลุ่มผู้เรียนที่ครูเขียนเอง เช่น "ม.4/3", "ปี 1 กลุ่ม A" หรือเว้นว่าง)
- `academicPeriodLabel` (optional — ช่วงการศึกษาที่ครูเขียนเอง เช่น "ภาคเรียนที่ 1/2569", "Summer 2026" หรือเว้นว่าง)
- `subjectCode` (optional — สำหรับ transcript เช่น "MATH-M4", "ค31101")
- `creditHours` (optional — ข้อมูลหน่วยกิตของวิชา ไม่ใช้คำนวณ GPA รวม และไม่แสดงเมื่อเว้นว่าง)
- `classCode` (รหัสเข้าห้อง)
- `teacher` (เจ้าของ CourseOffering)

**ทุกอย่างที่เกิดใน "ห้องเรียนหนึ่ง" (Attendance, Score, Assignment, Announcement, Material, Comment) อยู่ใต้ CourseOffering นี้**

### Learner Group Label
ข้อความ optional ที่ Teacher ใช้อธิบายกลุ่มผู้เรียนของ CourseOffering โดยไม่สร้าง Class กลางและไม่บังคับรูปแบบ
เมื่อไม่มีค่า UI ต้องซ่อนองค์ประกอบนั้นและยุบพื้นที่ ไม่แสดง placeholder เช่น "-" หรือ "ไม่ระบุ"
ข้อความเดียวกันใน CourseOffering คนละรายการไม่สร้างความสัมพันธ์หรือห้องกลางร่วมกัน แต่ละ CourseOffering ยังคงมีสมาชิก Class Code เนื้อหา คะแนน และ lifecycle เป็นของตัวเอง

### Academic Period Label
ข้อความ optional ที่ Teacher ใช้อธิบายช่วงเวลาทางการศึกษาของ CourseOffering โดยไม่บังคับให้เลือก Academic Year หรือ Term กลาง
เมื่อไม่มีค่า UI ต้องซ่อนองค์ประกอบนั้นและยุบพื้นที่ ไม่แสดง badge ปี/เทอม placeholder

### Archived CourseOffering
CourseOffering ที่ Teacher นำออกจากรายการวิชาที่กำลังใช้งานเมื่อจบการสอนหรือไม่ต้องการใช้งานต่อ
สถานะคลังเป็นตัวกำหนด lifecycle ของวิชาโดยตรง ระบบไม่ตีความสถานะจาก Learner Group Label หรือ Academic Period Label
วิชาที่เข้าคลังแสดงในพื้นที่แยกจากวิชาที่กำลังใช้งานและไม่ทำลายประวัติการเรียน
Teacher และ Student ยังอ่าน Feed, Lesson, Score, Submission และ Attendance เดิมได้ แต่สร้างหรือแก้เนื้อหา ส่งงาน Comment เช็กชื่อ ทำ Quiz และแก้คะแนนไม่ได้
Teacher เจ้าของ CourseOffering นำวิชากลับมาใช้งานได้; Admin ยังคงเป็น read-only observer

> **ADR-0012 / Workspace model:** ไม่มี Subject template — ครูสร้าง CourseOffering พร้อมตั้งชื่อ + ระบุ creditHours เอง  ครู 2 คนอาจสร้าง "คณิตศาสตร์ ม.4" คนละ object → ระบบไม่ enforce uniqueness; รายงาน cross-class จับคู่ด้วย `subjectCode` (ถ้ามี) หรือ name fuzzy

### Lesson Workspace (บทเรียน)
พื้นที่เนื้อหาที่ Teacher ตั้งชื่อเองภายใน CourseOffering หนึ่ง ใช้รวม Material และ Assignment ที่เกี่ยวข้องให้เป็นเรื่องเดียวกัน โดยไม่บังคับรูปแบบชื่อ เช่น "บทที่ 1"
Lesson Workspace เป็นโครงสร้างสำหรับเรียนและติดตามงาน ส่วน Feed เป็นลำดับเหตุการณ์ตามเวลาและไม่ใช่คำพ้องของ Lesson Workspace

- ชื่อจำเป็นและคำอธิบายเป็น optional; มีลำดับ (`position`) และสถานะ Active/Archived
- Assignment และ Material เชื่อม Lesson แบบ optional ระหว่างช่วง compatibility
- General Announcement ยังอยู่ระดับ CourseOffering และไม่ถูกบังคับเข้า Lesson
- Teacher เจ้าของ CourseOffering จัดการโครงสร้างได้; Student ที่ยังลงทะเบียนอ่านได้;
  Admin เป็น read-only observer
- Feed ไม่หายและไม่สร้าง FeedItem source of truth ใหม่
- Student progress เป็นข้อมูลของ Student คนนั้นเท่านั้น ห้ามแสดง peer progress
- ลบถาวรได้เฉพาะ Lesson ว่าง; Lesson ที่มีเนื้อหาใช้ archive หรือย้ายเนื้อหาก่อน

### General Announcement (ประกาศทั่วไป)
Announcement ระดับ CourseOffering ที่ไม่สังกัด Lesson Workspace ใด ใช้กับข่าวสารที่เกี่ยวข้องกับทั้งวิชาแทนการสร้างบทเรียนเทียมขึ้นมาเพื่อเก็บประกาศ

### Lesson Progress (ความคืบหน้าบทเรียน)
สถานะเฉพาะ Student ภายใน Lesson Workspace หนึ่ง สะท้อนความครบถ้วนของ Assignment ของ Student คนนั้น และไม่รวมการเปิดอ่าน Material หรือข้อมูลของเพื่อน

### Archived Lesson (บทเรียนที่จบแล้ว)
Lesson Workspace ที่ Teacher นำออกจากเส้นทางการเรียนปัจจุบันแต่ยังเก็บเนื้อหา Submission Score และ Comment เดิมไว้สำหรับตรวจสอบย้อนหลัง

### Lesson Link
ความสัมพันธ์ optional จาก Assignment/Material ไป Lesson เดียวกัน การเชื่อมต้องตรวจ
`courseOfferingId` ตรงกันและ Lesson ต้องยัง Active ที่ service layer การลบ Lesson ว่าง
ใช้ `SET NULL` เพื่อรักษา Assignment/Material และ URL เดิม

### Credit Hours (หน่วยกิต)
ข้อมูลหน่วยกิต optional ของ CourseOffering ที่ Teacher ระบุเพื่อแสดงประกอบวิชา ไม่ใช้คำนวณ GPA หรือรวมผลข้าม CourseOffering
เมื่อไม่มีค่า UI ต้องซ่อนองค์ประกอบนั้นและยุบพื้นที่ ไม่แสดง `0`, `-` หรือ "ไม่ระบุ"

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
**Influence model (ADR-0024):** ไม่มี `weight` channel แล้ว — `fullScore` เป็นตัวกำหนดสัดส่วนของ Score Item ในเกรดวิชาโดยตรง (Quiz fullScore=10 คิดเป็น 10/Σ ของวิชา, Midterm fullScore=50 คิดเป็น 50/Σ อัตโนมัติ)
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
ระดับผลการเรียน 0-4 — คำนวณอัตโนมัติจาก Score Total ของ **CourseOffering หนึ่ง**
เกณฑ์ default: `80+ → 4.0`, `75+ → 3.5`, `70+ → 3.0`, `65+ → 2.5`, `60+ → 2.0`, `55+ → 1.5`, `50+ → 1.0`, `<50 → 0`
ครู override ได้ใน CourseOffering setup (การ override editor จะเปิดในเวอร์ชันถัดไป — ปัจจุบันทุก CourseOffering ใช้เกณฑ์มาตรฐาน · `CourseOffering.gradeRulesJson` schema field พร้อมรองรับแล้ว)

### Aggregate GPA
การรวมเกรดจากหลาย CourseOffering เป็น Term GPA หรือ GPAX
**ไม่มีในระบบนี้** ผลการเรียนคำนวณและแสดงแยกต่อ CourseOffering เท่านั้น Academic Period Label เป็นข้อความประกอบและไม่ใช้รวม คำนวณ หรือกำหนดความครบถ้วนของผลการเรียน

---

## Quiz / Attempt (Release C design contract)

### Quiz (แบบทดสอบ)
Teacher-authored objective assessment that belongs to exactly one Lesson and
CourseOffering. Quiz is the canonical code/domain term; the product UI uses
"แบบทดสอบ". A Quiz is `PRACTICE` or `SCORED` and follows
`DRAFT -> OPEN -> CLOSED`.

- Practice Quiz has no Score Item and may reveal feedback immediately.
- Scored Quiz owns one planned `QUIZ_LINKED` Score Item and follows the existing
  sum-based, one-way publication contract.
- Teacher-authored content becomes immutable when the first Attempt starts.
- Archive hides normal navigation but preserves academic evidence.
- Cancellation is separate metadata and is allowed only before score
  publication.

The Release C contract and additive Prisma model are implemented in code, with
an offline migration prepared but not applied to Neon QA or Production.
Persistence services, Teacher/Student production UI, and rollout remain
unimplemented. See ADR-0035 through ADR-0038.

### Attempt
One Student's numbered run through one Quiz. Attempt is the canonical term for
both Practice and Scored Quiz execution. It owns the immutable question/order
snapshot, current answers, auto-grade evidence, Server-authoritative timing,
and one active device-write lease.

- Best submitted Attempt supplies the draft Score Entry for a Scored Quiz.
- Device takeover invalidates the previous writer; the old device becomes
  read-only.
- Preview is not an Attempt and never creates answer or Score Entry rows.
- Student sees only their own Attempts; Admin never sees answers or private
  Attempt files.

### Quiz Attempt Snapshot
Immutable evidence of the exact question text, options, order, points, grading
key, attachment references, and feedback policy shown when an Attempt started.
It stores attachment identity/metadata, never a public URL, R2 object key, or
reusable signed URL.

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
- Auto-created ScoreItem ตอน `is_scored=true`: ครูระบุ `fullScore` ใน create dialog (ไม่มี default) · `name = Assignment.title` · `source = ASSIGNMENT_LINKED` (class C, immutable)
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
- กด "Publish" → นักเรียนเห็นคะแนน + Score Total อัปเดต

---

## Learning Results (ผลการเรียน)

### Learning Results Page
หน้าแยกของ Student ที่แสดงผลการเรียนรายวิชา **ไม่ปนกับ Course Feed**
Top-level navigation ของ Student — ชื่อใน UI: "ผลการเรียน"

Resolved language:
- "เกรด" หมายถึง Grade ของ CourseOffering หนึ่งเท่านั้น
- ไม่มี Term GPA, GPAX, term-completion state หรือการรวมคะแนนข้าม CourseOffering
- รายการผลการเรียนแยก CourseOffering ที่ใช้งานอยู่กับ CourseOffering ในคลัง
- If a transcript/report surface is needed later, it should be a separate workflow.

**สิ่งที่แสดง:**
- Header: ชื่อนักเรียน
- ตัวเลือกวิชาที่ใช้งานอยู่ / วิชาในคลัง
- ตาราง CourseOffering: วิชา · ครู · คะแนนรวม · % · เกรดรายวิชา · สถานะ
- Academic Period Label เฉพาะวิชาที่มีค่า
- สถานะรายวิชา: `ยังไม่มีคะแนน`, `กำลังอัปเดต`, `ประกาศแล้ว`
- ปุ่ม "Print เป็น PDF" (ใช้ Father print stylesheet)

**ไม่แสดง:**
- ❌ Term GPA หรือ GPAX
- ❌ ตัวเลือก Term กลาง
- ❌ completion/progress ข้ามหลายวิชา
- ❌ Attendance summary (ดูในหน้า Course ของแต่ละวิชา)
- ❌ Assignment summary (ดูในหน้า Course)

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
email ที่ยืนยันแล้วและไม่ซ้ำกันของ User Account ทุก Role เป็น Identifier สำหรับ Authentication
- Identifier ไม่ใช่ Role และไม่ใช่ข้อมูลการเรียน
- เลขประจำตัวนักเรียนไม่ใช่ Identifier และไม่ใช้เชื่อมคะแนน งานส่ง การเข้าเรียน หรือ Enrollment
- ความสัมพันธ์ภายในระบบอ้างอิง User Account โดยไม่พึ่งเลขประจำตัวที่มนุษย์กรอก
- Google และ Fallback Credentials ต้องเข้าถึง User Account เดียวกันผ่าน Identifier นี้
- Identifier ไม่แสดงต่อสมาชิก CourseOffering คนอื่น และการเปลี่ยนต้องยืนยัน email ใหม่
- Teacher ไม่เห็น Identifier ของ Student ในสมาชิก คะแนน Attendance Submission หรือ Course surfaces; แสดงเฉพาะชื่อจริงและ Avatar
- เจ้าของบัญชีและ Admin ที่จัดการบัญชีเท่านั้นที่เห็น Identifier
- ถ้า User ยังไม่มี Avatar ระบบสร้าง Default Avatar ที่คงที่ต่อ User จาก User ID ภายใน เช่น สีหรือลายที่แตกต่างกัน เพื่อช่วยแยกผู้ใช้ชื่อซ้ำ โดยห้ามแสดงหรือทำให้อนุมาน User ID ได้ และต้องถูกแทนที่เมื่อเจ้าของอัปโหลด Avatar
- การเปลี่ยน Identifier ต้อง re-authenticate, ยืนยัน email ใหม่, ปฏิเสธค่าที่ User อื่นใช้, revoke session อื่น และบันทึก Audit
- Google Identity เดิมยังเชื่อมด้วย provider identity แม้ email หลักใหม่ไม่ตรงกับ Google email

### Retired Student Number
ข้อมูลเลขประจำตัวนักเรียนที่ระบบไม่รับ ไม่จัดเก็บ ไม่ใช้ Login ไม่ใช้กำหนดสิทธิ์ และไม่แสดงในหน้าวิชา คะแนน การเข้าเรียน รายงาน หรือ Profile
ข้อมูลทดสอบเดิมไม่ต้องรักษาความต่อเนื่องของเลขประจำตัวและสร้างใหม่ได้ตาม Identity model ปัจจุบัน

### Account Status
สถานะเดียวที่อธิบายสิทธิ์การเข้าถึงของ User Account
- **Active (ใช้งานอยู่):** เข้าใช้งานระบบได้ตาม Role
- **Suspended (พักบัญชี):** ปิดการเข้าใช้งานชั่วคราวโดยไม่เปลี่ยนสมาชิกภาพหรือประวัติการเรียน และเปิดกลับได้
- **Deletion Pending (รอลบบัญชี):** เจ้าของบัญชีเริ่มคำขอลบแล้ว ระบบปิดการเข้าสู่ระบบและ revoke sessions ทันที แต่เจ้าของยังกู้คืนได้ภายใน 30 วัน
- **Anonymized (ทำข้อมูลนิรนาม):** ลบข้อมูลที่ระบุตัวบุคคลโดยคงหลักฐานการเรียนแบบไม่ระบุตัวตน และย้อนกลับไม่ได้

### Account Deletion Request
คำขอแบบ self-service จากเจ้าของ User Account ซึ่งเปลี่ยน Account Status เป็น Deletion Pending ทันทีโดยไม่รอ Admin อนุมัติ
- เจ้าของยกเลิกคำขอและกู้คืน Account ได้ภายใน 30 วัน
- เมื่อครบ 30 วัน ระบบ Anonymize verified email, Real Name, Avatar และข้อมูลส่วนตัวที่แสดงได้
- คะแนน Submission Attendance และ Audit ที่จำเป็นคงอยู่ภายใต้ internal User identity ที่ไม่เปิดเผย เพื่อรักษาความครบถ้วนของ CourseOffering
- Admin User management ไม่มี Hard Delete สำหรับประวัติการเรียน

### Moderation Case
หน่วยงานหนึ่งเรื่องใน Moderation Center ที่รวม Report ต่อ Entity เดียวกัน มีสถานะ Open, In Review, Resolved, Dismissed หรือ Appealed และแยกจาก Audit Log ซึ่งเป็นหลักฐานของ Action ที่เกิดขึ้นแล้ว

### Quarantined File
ไฟล์ที่ถูกระงับการเปิดดูระหว่างหรือหลังการตรวจด้านความปลอดภัย โดย File record และความสัมพันธ์กับเนื้อหาต้นทางยังคงอยู่

### Sign-up (Student)
Student สร้าง User Account ได้โดยไม่ต้องมีเลขประจำตัวนักเรียน โดยให้ข้อมูลระบุตัวตนที่จำเป็นต่อวิธี Authentication ที่ระบบรองรับ
**Account สมัครเสร็จ → ยังไม่มี CourseOffering** → ต้องเข้า `/join` ใส่ Class Code

### Google-first Onboarding
การสร้าง User Account ครั้งแรกหลัง Google ยืนยันตัวตนสำเร็จ โดยผู้ใช้กรอกข้อมูลประจำตัวที่ Beagle Classroom ต้องใช้เพียงครั้งเดียว หลังจากผูกสำเร็จ การเข้าสู่ระบบด้วย Google ครั้งถัดไปต้องกลับเข้า User Account เดิมและไม่ถามข้อมูล onboarding ซ้ำ
- Google display name ไม่ใช่ Real Name ของ Beagle Classroom และห้ามนำมาใช้เป็นตัวตนทางการโดยอัตโนมัติ ผู้ใช้ใหม่ทุก Role ต้องกรอกชื่อจริงและนามสกุลแยกกันใน Beagle Classroom และยืนยันก่อนสร้าง User Account
- Google profile image ไม่ถูกนำมาเป็น Avatar โดยอัตโนมัติ User เริ่มด้วย Default Avatar ที่ระบบสร้างแบบ privacy-safe และเลือกอัปโหลด Avatar ของตนเองภายหลังได้
- User แก้ชื่อจริงและนามสกุลของตนเองใน Profile ได้โดยไม่ต้องรอ Admin อนุมัติ แต่ต้อง re-authenticate และทุกการเปลี่ยนต้องบันทึก Audit Log
- เมื่อ Student เปลี่ยน Real Name ให้สร้าง Notification หนึ่งรายการต่อ Teacher ที่เกี่ยวข้องกับ Enrollment ที่ Active โดยแสดง Avatar, ชื่อเดิม, ชื่อใหม่, เวลา และรายชื่อ CourseOffering ที่เกี่ยวข้อง; ถ้ามีหลายวิชากับ Teacher คนเดียวกันต้องรวมเป็นรายการเดียว
- Notification การเปลี่ยนชื่อของ Student ต้องกดไปยังหน้าสมาชิกของ Student ในบริบทของ CourseOffering ได้
- Teacher ที่เกี่ยวข้องเห็นป้าย “เพิ่งเปลี่ยนชื่อ” เป็นเวลา 14 วันและเปิดดูชื่อเดิมได้ในช่วงนั้น; Course peers อื่นห้ามเห็นชื่อเดิม ส่วน Admin ตรวจประวัติถาวรได้ผ่าน Audit Log
- เมื่อ Teacher เปลี่ยน Real Name ให้แจ้ง Student ที่มี Enrollment Active ใน CourseOffering ของ Teacher โดยแสดงชื่อเดิม ชื่อใหม่ Avatar เวลา และวิชาที่เกี่ยวข้อง นักเรียนเห็นป้าย “เพิ่งเปลี่ยนชื่อ” และชื่อเดิมได้ 14 วัน เพื่อไม่ให้เข้าใจว่าเปลี่ยนครูผู้สอน
- สมาชิก CourseOffering รายงาน Real Name หรือ Avatar ที่ปลอม หลอกลวง หรือไม่เหมาะสมได้ รายงานต้องเข้า Moderation Center พร้อม immutable snapshot ของชื่อและ Avatar ณ เวลารายงาน
- Profile report ไม่ซ่อนข้อมูล ไม่จำกัดสิทธิ์ และไม่ระงับ User อัตโนมัติ Admin ต้องตรวจหลักฐานและตัดสินผ่าน Moderation workflow เพื่อป้องกันการใช้ report กลั่นแกล้ง
- **Student:** สมัครเองได้ผ่าน Google-first Onboarding โดยกรอกชื่อจริงและนามสกุล ไม่ต้องมีเลขประจำตัวนักเรียน ไม่บังคับ pre-import roster, Student Invite หรือการอนุมัติก่อนสร้างบัญชี เพื่อให้ onboarding สั้นที่สุด; การเข้าถึงข้อมูลวิชายังต้องใช้ Class Code แยกต่างหาก
- **Teacher:** ใช้ Google-first Onboarding ได้เมื่อมี Teacher Invite แบบใช้ครั้งเดียวที่ยังไม่หมดอายุและผูกกับ email เดียวกับ Google Identity เท่านั้น
- **Admin:** สมัครสิทธิ์ Admin เองไม่ได้ ต้องมี User Account ที่ระบบจัดเตรียมไว้ก่อนจึงเชื่อม Google ได้
- ระบบไม่มี Invite Admin หรือการยกระดับเป็น Admin ผ่าน UI การสร้าง Admin ใหม่ทำผ่าน Bootstrap/Deployment command ที่ต้องใช้ secret เท่านั้น ต้องบันทึก Audit ของผลลัพธ์โดยห้าม log secret, token หรือ credentials
- รุ่นปัจจุบันให้ User Account หนึ่งบัญชีมี Role เดียวเท่านั้น ถ้า verified email มี User Account Role อื่นอยู่แล้ว Teacher Invite ต้องหยุดแบบ fail-closed และแจ้ง Admin; ห้ามเปลี่ยน Role หรือสร้าง User Account ซ้ำอัตโนมัติ
- Google Identity ไม่เปลี่ยน Role ของ User Account ที่เชื่อมอยู่ และ Google Identity เดียวต้องไม่เชื่อมกับหลาย User Account
- ก่อนสร้าง User Account ครั้งแรก ผู้ใช้ต้องยอมรับ Terms of Use และ Privacy Notice แยกกัน ระบบเก็บ version และ acceptedAt ของแต่ละรายการ และขอ consent ใหม่เฉพาะเมื่อมี material change
- รุ่นนี้ไม่มี marketing consent และไม่เก็บ consent การตลาดแฝงใน Terms หรือ Privacy Notice
- Flow consent สำหรับผู้เยาว์หรือผู้ปกครองต้องผ่านการทบทวนนโยบายโรงเรียนและกฎหมายแยกต่างหากก่อนพัฒนา ห้ามอนุมานเกณฑ์จาก Google Account หรืออายุที่ผู้ใช้ไม่ได้ให้

### Teacher Invite
คำเชิญที่ Admin สร้างให้ email ของครูรายหนึ่งเพื่ออนุญาต Google-first Onboarding เข้าสู่ Role Teacher
- ใช้ได้ครั้งเดียวและหมดอายุ 7 วันหลังสร้าง
- email ในคำเชิญต้องตรงกับ verified email จาก Google
- Admin ยกเลิกคำเชิญที่ยังไม่ถูกใช้และส่งคำเชิญใหม่ได้
- การส่งใหม่ต้องไม่สร้าง User Account ซ้ำ และคำเชิญเดิมที่ถูกแทนที่ต้องใช้ต่อไม่ได้
- Teacher Invite ให้สิทธิ์สร้าง Teacher Account เท่านั้น ไม่สร้าง CourseOffering หรือโครงสร้างการศึกษาแทนครู
- Admin ใช้หน้าจอเพิ่มครูเดียวกันสำหรับการกรอก email รายคนหรือ import CSV หลายคน ทั้งสองวิธีสร้าง Teacher Invite เท่านั้น ไม่สร้างบัญชีล่วงหน้า ไม่สร้าง Password ชั่วคราว และครูต้องรับคำเชิญพร้อมเข้าสู่ระบบด้วย Google ด้วยตนเอง

### Google Identity
ตัวตนที่ Google ยืนยันและเชื่อมกับ User Account หนึ่งบัญชี ใช้เป็นวิธี Authentication เพิ่มเติม ไม่ใช่ Role และไม่ใช่ Student/Teacher domain record
การพบ Google email ตรงกับ Identifier ที่มีอยู่ไม่ทำให้เชื่อมอัตโนมัติ ผู้ใช้ต้องยืนยัน Password เดิมหรือเชื่อมจาก authenticated Profile
Teacher Invite ต้องตรงกับ email ที่ยืนยันแล้ว; Admin เชื่อม Google ได้จาก authenticated Admin Account เท่านั้น
ผู้ใช้ยกเลิกการเชื่อมได้เมื่อมี Fallback Password แล้วเท่านั้น การ revoke หรือ disconnect Google ไม่ลบ User Account หรือข้อมูลการเรียน
ถ้า Google ถูก revoke จากภายนอกก่อนตั้ง Password เจ้าของบัญชีกู้ช่องทางสำรองผ่าน Password Recovery
รองรับทั้ง Gmail ส่วนตัวและ Google Workspace โดยไม่จำกัด domain; email หรือ domain ไม่มอบ Teacher/Admin Role
- Google Login ขอ OAuth/OIDC scope ขั้นต่ำเฉพาะการยืนยันตัวตนและ verified email ไม่ขอ Drive, Contacts, Calendar, Google Classroom หรือ integration scope อื่น
- Permission ของ integration ในอนาคตต้องขอแยกตาม Feature และห้ามขยาย scope ของ Google Login โดยอัตโนมัติ

### Authentication Session
ช่วงเวลาที่อุปกรณ์หนึ่งเข้าใช้ User Account ได้หลัง Authentication สำเร็จ
- Session มีอายุสูงสุด 30 วันและหมดอายุเมื่อไม่มี activity ต่อเนื่อง 7 วัน
- การเปลี่ยน verified email, Real Name, Fallback Password หรือการขอลบบัญชีต้อง re-authenticate แม้ Session ยังไม่หมดอายุ
- การ Logout ต้อง revoke Session ปัจจุบันทันที การ reset Password หรือเปลี่ยน Identifier ต้อง revoke Session อื่นตาม policy ที่กำหนด

### Fallback Credentials
email และ password ของ Beagle Classroom ที่ใช้เข้าสู่ User Account เดียวกับ Google Identity เมื่อ Google ใช้งานไม่ได้หรือผู้ใช้เข้าถึงบัญชี Google ชั่วคราวไม่ได้
Fallback Credentials ไม่สร้าง User Account ซ้ำ ไม่เปลี่ยน Role และไม่ใช้เลขประจำตัวนักเรียน
การตั้ง Fallback Password เป็นตัวเลือกใน Profile ไม่เป็นขั้นตอนบังคับของ Google-first Onboarding ผู้ใช้ที่ยังไม่ตั้งอาจเห็นคำแนะนำให้เพิ่มช่องทางสำรองโดยไม่ถูกขวางการใช้งาน

### Password Recovery
การตั้ง Fallback Password ใหม่ผ่านลิงก์ใช้ครั้งเดียวที่ส่งไปยัง email ที่ยืนยันแล้ว ลิงก์หมดอายุภายใน 15 นาที
เมื่อสำเร็จระบบ revoke session อื่นทั้งหมด ผู้ใช้อื่นรวมถึง Teacher และ Admin ไม่เห็นหรือกำหนด Password แทนเจ้าของบัญชี

### Retired Temporary Password
กลไกเดิมที่ระบบ generate Password ตอน CSV import ครูหรือ Admin reset Password กลไกนี้ไม่อยู่ใน target identity model
- Add Teacher ทั้งรายคนและ CSV สร้าง Teacher Invite เท่านั้น
- Password Recovery ให้เจ้าของบัญชีตั้ง Fallback Password เองผ่านลิงก์ใช้ครั้งเดียว
- Teacher และ Admin ไม่เห็น ไม่ generate และไม่ reset Password ให้ User อื่น

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
| "ปิดบัญชี" / "ลบบัญชี" | Suspended (พักบัญชี) / Deletion Pending (รอลบบัญชี) / Anonymized (ทำข้อมูลนิรนาม) |
| "Course" (ลอยๆ) | CourseOffering (วิชาที่ครูสร้าง) |
| "Subject" | ไม่มีในระบบ (ADR-0012 — ใช้ CourseOffering แทน) |
| "Class" (ลอยๆ — หมายถึงคาบหรือกลุ่มผู้เรียน?) | Session (คาบ) / learnerGroupLabel (ชื่อกลุ่มผู้เรียนที่ครูเขียน) |
| "Grade" (ลอยๆ — เกรดหรือระดับผู้เรียน?) | Grade (เกรด 0-4) / learnerGroupLabel (ถ้าครูต้องการระบุระดับ) |
| "Score" ลอยๆ | Score Entry / Score Item / Score Total |
| "Weighted Total" | Score Total (ADR-0024 superseded weight-based formula) |
| "weight" / "น้ำหนัก" ใน Score Item | ❌ ไม่มีแล้ว — `fullScore` กำหนดอิทธิพลโดยตรง (ADR-0024) |
| "Attendance" คำเดียว | Attendance Record (ของคน) / Session (คาบ) |
| "Homework" / "Task" | Assignment |
| "Test" / "Exam" / "แบบทดสอบ" ลอยๆ | Quiz (definition) / Attempt (Student run) / Quiz Attempt Snapshot (evidence) |
| "Submit" ลอยๆ | Submission (entity) / submit action (verb) |
| "Post" ลอยๆ | Announcement / Material / Assignment |
| "บท" / "หมวด" ลอยๆ | Lesson Workspace (บทเรียน) |
| "Room" / "Class" (Google sense) | CourseOffering |
| "Stream" | Feed |
| "Notification" (ลอยๆ — entity หรือ UI?) | Notification (DB row) / Bell (navbar dropdown UI) |
| "Deadline reminder" (Phase 7+) | Due Soon Widget (state-derived list บน dashboard · ไม่ใช่ Notification kind) |
