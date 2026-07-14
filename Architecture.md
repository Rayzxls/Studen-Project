# Architecture.md

System design ของระบบ Beagle Classroom

> สำหรับ glossary ของคำในเอกสารนี้ → [CONTEXT.md](./CONTEXT.md)
> สำหรับ security detail → [Security.md](./Security.md)

---

## 1. High-Level Diagram

```
┌──────────────────────────────────────────────────────────┐
│                      Browser (Client)                     │
│  Next.js App Router + React + Framer Motion              │
│                                                           │
│  - Public:  /, /login, /signup, /join                     │
│  - Admin:   /admin/*                                      │
│  - Teacher: /teacher/*                                    │
│  - Student: /student/*                                    │
└────────────────────┬─────────────────────────────────────┘
                     │ HTTPS (Vercel Edge)
                     ▼
┌──────────────────────────────────────────────────────────┐
│              Next.js Server (Vercel)                      │
│                                                           │
│  ┌────────────────┐  ┌──────────────────┐                │
│  │  API Routes    │  │  Server Comps    │                │
│  │  /api/*        │  │  RSC data fetch  │                │
│  └────────┬───────┘  └─────────┬────────┘                │
│           │                     │                         │
│           ▼                     ▼                         │
│  ┌─────────────────────────────────────────┐             │
│  │   Service Layer (lib/)                  │             │
│  │   - auth, scoring, audit, feed,         │             │
│  │     assignment, storage, notification   │             │
│  └────────────────┬────────────────────────┘             │
│                   │                                       │
│                   ▼                                       │
│  ┌─────────────────────────────────────────┐             │
│  │   Prisma ORM                            │             │
│  └────────────────┬────────────────────────┘             │
└───────────────────┼─────────────────────────────────────┘
                    │
        ┌───────────┼──────────────┬─────────────┐
        ▼           ▼              ▼             ▼
  ┌──────────┐ ┌─────────┐  ┌──────────┐  ┌──────────┐
  │ Postgres │ │ Upstash │  │ Cloudflare│  │ Sentry   │
  │ (Neon)   │ │ Redis   │  │ R2        │  │ (errors) │
  │ - data   │ │ - rate  │  │ - files   │  │          │
  │ - audit  │ │   limit │  │ - signed  │  │          │
  └──────────┘ └─────────┘  │   URL only│  └──────────┘
                            └───────────┘
```

---

## 2. Tech Stack (Confirmed)

### Frontend

| Layer | Choice | เหตุผล |
|-------|--------|-------|
| Framework | **Next.js 16** (App Router) | SSR + RSC + Server Actions/API routes ในที่เดียว |
| Language | **TypeScript** (strict) | data model ซับซ้อน, ต้อง type-safe |
| Styling | **Tailwind CSS v4** + semantic CSS tokens | รองรับ System/Light/Dark/Cream โดยไม่ hardcode สีต่อหน้า |
| Font | **Anuphan** (`next/font/google`) | Thai + Latin family เดียวตาม Calm Ledger |
| Design system | **Calm Ledger v2** | ADR-0014 + ADR-0028 + ADR-0029 |
| Component primitives | **shadcn/ui** (where compatible) | accessibility baseline |
| Icons | **lucide-react** | unified icon set |
| Animation | **Framer Motion** + CSS transitions/keyframes | task-modulated motion และ reduced-motion fallback |
| Server data | **React Server Components + Prisma** | query และ permission อยู่ฝั่ง server |
| Forms/validation | **Server Actions/API + Zod** | validate ที่ boundary และไม่เชื่อ client identity |
| File upload | direct private R2 presigned PUT | progress, max 20 MB, permission-gated delivery |

### Backend

| Layer | Choice |
|-------|--------|
| Runtime | Next.js Server (Node 20+) |
| API | API Routes (REST-like) |
| ORM | **Prisma 5** |
| Validation | **Zod** (shared schema client/server) |
| Auth | **NextAuth (Auth.js v5)** — Credentials provider |
| Password hash | **bcrypt** cost 12 |
| Rate limit | Upstash Redis |
| Background jobs (Phase 2) | Vercel Cron + queue table |

### Infrastructure

| Layer | Choice |
|-------|--------|
| Hosting | **Vercel** |
| Database | **Neon** (Postgres managed) |
| File storage | **Cloudflare R2** (S3-compatible, ฟรี 10GB) |
| Email (phase 2) | Resend |
| Monitoring | Vercel Analytics + Sentry |

---

## 3. Data Model

ดู [CONTEXT.md](./CONTEXT.md) สำหรับคำนิยาม — ตรงนี้คือ schema

### Core entities

```prisma
// ───── Identity ─────
model User {
  id              String   @id @default(cuid())
  role            Role     // ADMIN | TEACHER | STUDENT
  identifier      String   @unique  // email | studentId
  passwordHash    String
  mustResetPwd    Boolean  @default(false)
  isActive        Boolean  @default(true)
  consentedAt     DateTime?
  consentVersion  String?
  createdAt       DateTime @default(now())
  deletedAt       DateTime?
  admin           Admin?
  teacher         Teacher?
  student         Student?
  auditLogsAsActor AuditLog[] @relation("ActorLogs")
  notifications   Notification[]
  sessions        UserSession[]
}

model Admin {
  userId    String  @id
  user      User    @relation(fields: [userId], references: [id])
  firstName String
  lastName  String
}

model Teacher {
  userId         String   @id
  user           User     @relation(fields: [userId], references: [id])
  firstName      String
  lastName       String
  email          String   @unique
  homeroomOfId   String?  @unique
  homeroom       Class?   @relation("Homeroom", fields: [homeroomOfId], references: [id])
  courses        CourseOffering[]
}

model Student {
  userId       String   @id
  user         User     @relation(fields: [userId], references: [id])
  studentId    String   @unique
  firstName    String
  lastName     String
  classId      String?
  class        Class?   @relation(fields: [classId], references: [id])
  enrollments  Enrollment[]
  anonymized   Boolean  @default(false)
}

// ───── Academic ─────
model AcademicYear {
  id    String @id @default(cuid())
  name  String @unique
  terms Term[]
  classes Class[]
}

model Term {
  id              String   @id @default(cuid())
  academicYearId  String
  name            String
  startDate       DateTime
  endDate         DateTime
  academicYear    AcademicYear @relation(fields: [academicYearId], references: [id])
  courses         CourseOffering[]
}

// Subject model removed in ADR-0012 — workspace fields moved to CourseOffering

model Class {
  id              String  @id @default(cuid())
  name            String  // "ม.4/2"
  academicYearId  String
  academicYear    AcademicYear @relation(fields: [academicYearId], references: [id])
  students        Student[]
  homeroomTeacher Teacher? @relation("Homeroom")
  courses         CourseOffering[]
}

model CourseOffering {
  id              String  @id @default(cuid())
  teacherId       String
  classId         String
  termId          String

  // Workspace fields (ADR-0012 — teacher-defined, no Subject FK)
  name            String   // "คณิตศาสตร์ ม.4 ครูสมชาย"
  subjectCode     String?  // optional teacher-set, for transcript matching
  gradeLevel      String   // "ม.4"
  creditHours     Float    // 1.5
  classCode       String  @unique
  codeActive      Boolean @default(true)
  codeExpiresAt   DateTime?
  gradeRulesJson  Json?
  teacher         Teacher @relation(fields: [teacherId], references: [userId])
  class           Class   @relation(fields: [classId], references: [id])
  term            Term    @relation(fields: [termId], references: [id])

  enrollments     Enrollment[]
  sessions        Session[]
  scoreItems      ScoreItem[]
  assignments     Assignment[]
  announcements   Announcement[]
  materials       Material[]
  timetable       TimetableSlot[]
  createdAt       DateTime @default(now())
}

model Enrollment {
  id               String   @id @default(cuid())
  studentId        String
  courseOfferingId String
  enrolledAt       DateTime @default(now())
  student          Student        @relation(fields: [studentId], references: [userId])
  course           CourseOffering @relation(fields: [courseOfferingId], references: [id])
  attendances      AttendanceRecord[]
  scoreEntries     ScoreEntry[]
  submissions      Submission[]
  @@unique([studentId, courseOfferingId])
}

// ───── Timetable + Attendance ─────
model TimetableSlot {
  id               String   @id @default(cuid())
  courseOfferingId String
  dayOfWeek        Int      // 0-6
  startTime        String   // "10:00"
  durationMinutes  Int
  course           CourseOffering @relation(fields: [courseOfferingId], references: [id])
}

model Session {
  id               String   @id @default(cuid())
  courseOfferingId String
  scheduledAt      DateTime
  durationMinutes  Int
  isManual         Boolean
  course           CourseOffering @relation(fields: [courseOfferingId], references: [id])
  attendances      AttendanceRecord[]
}

model AttendanceRecord {
  id           String   @id @default(cuid())
  sessionId    String
  enrollmentId String
  status       AttendanceStatus
  recordedAt   DateTime @default(now())
  recordedBy   String
  note         String?
  session      Session    @relation(fields: [sessionId], references: [id])
  enrollment   Enrollment @relation(fields: [enrollmentId], references: [id])
  @@unique([sessionId, enrollmentId])
}

enum AttendanceStatus { PRESENT LATE EXCUSED ABSENT }

// ───── Scoring ─────
model ScoreItem {
  id               String   @id @default(cuid())
  courseOfferingId String
  name             String
  fullScore        Float
  weight           Float
  isPublished      Boolean  @default(false)
  publishedAt      DateTime?
  source           ScoreItemSource @default(MANUAL)
  course           CourseOffering @relation(fields: [courseOfferingId], references: [id])
  assignment       Assignment?
  scoreEntries     ScoreEntry[]
  createdAt        DateTime @default(now())
}

enum ScoreItemSource { MANUAL ASSIGNMENT }

model ScoreEntry {
  id           String   @id @default(cuid())
  scoreItemId  String
  enrollmentId String
  score        Float
  updatedAt    DateTime @updatedAt
  updatedBy    String
  scoreItem    ScoreItem  @relation(fields: [scoreItemId], references: [id])
  enrollment   Enrollment @relation(fields: [enrollmentId], references: [id])
  @@unique([scoreItemId, enrollmentId])
}

// ───── Assignment & Submission ─────
model Assignment {
  id               String   @id @default(cuid())
  courseOfferingId String
  authorId         String   // teacher userId
  title            String
  description      String   // markdown
  dueAt            DateTime?
  allowText        Boolean  @default(true)
  allowFile        Boolean  @default(true)
  allowLink        Boolean  @default(true)
  isScored         Boolean  @default(false)
  scoreItemId      String?  @unique
  submissionClosed Boolean  @default(false)
  createdAt        DateTime @default(now())

  course      CourseOffering @relation(fields: [courseOfferingId], references: [id])
  scoreItem   ScoreItem?     @relation(fields: [scoreItemId], references: [id])
  submissions Submission[]
  attachments FileAttachment[]
  links       AssignmentLink[]
  comments    Comment[]
}

model AssignmentLink {
  id           String     @id @default(cuid())
  assignmentId String
  url          String
  label        String?
  assignment   Assignment @relation(fields: [assignmentId], references: [id])
}

model Submission {
  id              String   @id @default(cuid())
  assignmentId    String
  enrollmentId    String
  status          SubmissionStatus @default(NOT_SUBMITTED)
  currentVersionId String? @unique
  gradedAt        DateTime?
  gradedBy        String?
  assignment      Assignment       @relation(fields: [assignmentId], references: [id])
  enrollment      Enrollment       @relation(fields: [enrollmentId], references: [id])
  versions        SubmissionVersion[]
  currentVersion  SubmissionVersion? @relation("CurrentVersion", fields: [currentVersionId], references: [id])
  comments        Comment[]
  @@unique([assignmentId, enrollmentId])
}

enum SubmissionStatus {
  NOT_SUBMITTED
  DRAFT
  SUBMITTED
  LATE_SUBMITTED
  RETURNED
  GRADED
}

model SubmissionVersion {
  id              String   @id @default(cuid())
  submissionId    String
  versionNumber   Int
  textContent     String?
  submittedAt     DateTime @default(now())
  isLate          Boolean
  submission      Submission   @relation(fields: [submissionId], references: [id])
  currentOf       Submission?  @relation("CurrentVersion")
  attachments     FileAttachment[]
  links           SubmissionLink[]
}

model SubmissionLink {
  id        String   @id @default(cuid())
  versionId String
  url       String
  version   SubmissionVersion @relation(fields: [versionId], references: [id])
}

// ───── Feed Content (Announcement, Material) ─────
model Announcement {
  id               String   @id @default(cuid())
  courseOfferingId String
  authorId         String
  content          String   // markdown
  pinnedUntil      DateTime?
  createdAt        DateTime @default(now())
  course           CourseOffering @relation(fields: [courseOfferingId], references: [id])
  attachments      FileAttachment[]
  links            AnnouncementLink[]
  comments         Comment[]
}

model AnnouncementLink {
  id              String       @id @default(cuid())
  announcementId  String
  url             String
  announcement    Announcement @relation(fields: [announcementId], references: [id])
}

model Material {
  id               String   @id @default(cuid())
  courseOfferingId String
  authorId         String
  title            String
  description      String?
  createdAt        DateTime @default(now())
  course           CourseOffering @relation(fields: [courseOfferingId], references: [id])
  attachments      FileAttachment[]
  links            MaterialLink[]
  comments         Comment[]
}

model MaterialLink {
  id          String    @id @default(cuid())
  materialId  String
  url         String
  material    Material  @relation(fields: [materialId], references: [id])
}

// ───── Comment (polymorphic) ─────
model Comment {
  id             String       @id @default(cuid())
  scope          CommentScope
  parentType     CommentParent
  parentId       String        // FK ไม่ผูก type-level (validated in service)
  authorId       String
  content        String
  hidden         Boolean       @default(false)
  hiddenBy       String?
  hiddenAt       DateTime?
  createdAt      DateTime      @default(now())
  editableUntil  DateTime      // createdAt + 5 minutes

  // Indices for fast feed queries
  announcement   Announcement? @relation(fields: [parentId], references: [id], map: "comment_announcement_fk")
  // (use one-to-many via service layer; concrete relations optional)
}

enum CommentScope { CLASS_WIDE PRIVATE }
enum CommentParent { ASSIGNMENT ANNOUNCEMENT MATERIAL SUBMISSION }

// ───── File Attachments (polymorphic) ─────
model FileAttachment {
  id                  String   @id @default(cuid())
  r2Key               String   @unique
  originalFilename    String
  mimeType            String
  sizeBytes           Int
  ownerType           AttachmentOwner
  ownerId             String
  uploadedBy          String
  uploadedAt          DateTime @default(now())
  virusScanStatus     ScanStatus @default(PENDING)

  // Optional polymorphic back-refs (one per owner type)
  assignmentId        String?
  assignment          Assignment?       @relation(fields: [assignmentId], references: [id])
  announcementId      String?
  announcement        Announcement?     @relation(fields: [announcementId], references: [id])
  materialId          String?
  material            Material?         @relation(fields: [materialId], references: [id])
  submissionVersionId String?
  submissionVersion   SubmissionVersion? @relation(fields: [submissionVersionId], references: [id])
}

enum AttachmentOwner { ASSIGNMENT ANNOUNCEMENT MATERIAL SUBMISSION COMMENT }
enum ScanStatus      { PENDING CLEAN INFECTED ERROR }

// ───── Notification ─────
model Notification {
  id          String   @id @default(cuid())
  userId      String
  type        String
  payload     Json
  readAt      DateTime?
  createdAt   DateTime @default(now())
  user        User     @relation(fields: [userId], references: [id])
  @@index([userId, readAt, createdAt])
}

// ───── Sessions / Auth ─────
model UserSession {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  tokenHash   String
  ipAddress   String?
  userAgent   String?
  createdAt   DateTime @default(now())
  lastSeenAt  DateTime @default(now())
  revokedAt   DateTime?
  @@index([userId])
}

// ───── Audit ─────
model AuditLog {
  id         String   @id @default(cuid())
  timestamp  DateTime @default(now())
  actorId    String?
  actor      User?    @relation("ActorLogs", fields: [actorId], references: [id])
  actorRole  Role?
  action     String
  targetType String?
  targetId   String?
  before     Json?
  after      Json?
  reason     String?
  ipAddress  String?
  userAgent  String?
  @@index([actorId, timestamp])
  @@index([action, timestamp])
}

enum Role { ADMIN TEACHER STUDENT }
```

> ⚠️ Comment relation จะใช้ service-level validation (parentType + parentId combo)
> เพราะ polymorphic FK ใน Prisma ไม่สวย — เลือก clean service code มากกว่า DB constraint

---

## 4. Folder Structure (Source)

```
app/
├── (auth)/
│   ├── login/
│   ├── signup/                # Student self-register
│   ├── join/                  # enter class code → join course
│   └── reset-password/
├── (admin)/
│   ├── dashboard/
│   ├── audit-log/
│   ├── teachers/
│   ├── students/
│   ├── moderation/            # hidden comments
│   └── import/
├── (teacher)/
│   ├── dashboard/
│   ├── courses/[id]/
│   │   ├── feed/
│   │   ├── attendance/
│   │   ├── scores/
│   │   ├── assignments/
│   │   │   ├── new/
│   │   │   └── [aid]/
│   │   │       ├── submissions/
│   │   │       └── [enrollmentId]/    # grade view
│   │   ├── members/
│   │   └── settings/
│   └── homeroom/
├── (student)/
│   ├── dashboard/
│   ├── terms/                # ⭐ Term Summary (top-level)
│   │   ├── page.tsx          # default = current term
│   │   └── [termId]/
│   │       ├── page.tsx      # term summary view
│   │       └── print/        # print-friendly transcript
│   ├── courses/[id]/
│   │   ├── feed/
│   │   ├── assignments/[aid]/
│   │   ├── scores/
│   │   ├── attendance/
│   │   └── members/
│   └── profile/
└── api/
    ├── auth/[...nextauth]/
    ├── signup/                # student
    ├── join/                  # course code
    ├── courses/[id]/
    │   ├── feed/
    │   ├── members/
    │   ├── attendance/
    │   ├── scores/
    │   ├── assignments/
    │   │   └── [aid]/
    │   │       └── submissions/
    │   ├── announcements/
    │   ├── materials/
    │   └── comments/
    ├── files/                 # presigned URL gen
    ├── notifications/
    └── admin/

components/
├── ui/                  # shared primitives
├── motion/              # bounded interactive motion primitives
├── feed/                # FeedCard, FeedComposer, FeedFilter
├── assignment/          # AssignmentCard, SubmissionForm, GradeView
├── comment/             # CommentThread, CommentItem
├── attendance/
├── scoring/
└── layouts/

lib/
├── auth/
│   ├── nextauth.ts
│   ├── permissions.ts          # central matrix
│   └── session.ts
├── db/
│   ├── client.ts
│   └── transactions.ts
├── scoring/                    # PURE
│   ├── weighted-total.ts
│   ├── grade.ts
│   ├── term-gpa.ts             # weighted by creditHours
│   ├── term-status.ts          # IN_PROGRESS | COMPLETED
│   └── validate-weights.ts
├── feed/
│   ├── aggregator.ts           # query + sort + paginate
│   └── filter.ts
├── assignment/
│   ├── create.ts               # creates ScoreItem if isScored
│   ├── submit.ts               # versioning
│   ├── return.ts
│   └── grade.ts
├── storage/
│   ├── r2-client.ts
│   ├── signed-url.ts           # presigned GET/PUT
│   ├── mime-check.ts           # magic byte verify
│   └── quota.ts
├── notification/
│   ├── create.ts
│   └── deliver.ts              # in-app only Day 1
├── audit/
│   └── log.ts
├── validation/
│   └── schemas.ts              # Zod shared
└── utils/

prisma/
├── schema.prisma
├── migrations/
└── seed.ts
```

---

## 5. Frontend Design System

ระบบปัจจุบันใช้ **Calm Ledger v2** ตาม ADR-0014, ADR-0028 และ ADR-0029 ส่วน Ink + Gold เป็นประวัติที่ถูก supersede แล้ว

### Source of truth

- `app/globals.css` — semantic theme tokens, shared component classes, motion tokens และ print styles
- `app/layout.tsx` — Anuphan ผ่าน `--font-anuphan`
- `DESIGN.md` — component/material/motion guidance
- `lib/theme/course-color.ts` — course identity palette 8 slots

### Theme และ colour channels

- Theme modes: `SYSTEM`, `LIGHT`, `DARK`, `CREAM`
- System colours: blue action, green success, orange warning/due, red destructive
- Course colours: 8 deterministic slots ใช้ระบุตัวตนของวิชา ไม่ใช้แทน status
- Text/surface/border ใช้ semantic variables เพื่อรักษา contrast ทุก theme
- R2/file surfaces และ data-entry controls ห้ามอาศัยสีเพียงอย่างเดียวในการสื่อสถานะ

### Typography และ geometry

- Anuphan family เดียว; น้ำหนักหลักไม่เกิน 600
- Pill controls, `rounded-2xl` cards และลำดับระยะ 8/12/16/24/32 ตาม density ของงาน
- Glass จำกัดไว้ที่ navigation/sheet/hero overlay ที่กำหนด ไม่ใช้กับตารางหรือข้อความยาว

### Motion strategy

| Tier | Surface | Budget |
|------|---------|--------|
| T1 | Landing/showcase | interactive composition ที่มี static fallback |
| T2 | Dashboard/course/feed | ambient + bounded hover/entry motion |
| T3 | Content detail | entry/micro feedback เท่านั้น |
| T4 | Score, attendance, review, audit, setup/forms | state feedback เท่านั้น; data entry is sacred |

ทุก tier ต้องรองรับ `prefers-reduced-motion` และห้าม animation ทำให้ layout ขยับระหว่างทำงาน

### Mobile / Responsive

| Audience | Approach |
|----------|----------|
| Student views | **Mobile-first** (Tailwind default → `md:` adjust) |
| Teacher gradebook | Desktop-optimized (responsive แต่ density สูง) |
| Admin audit | Desktop-only (table หนัก) |

PWA-ready จาก day 1 (manifest stub) → activate ภายหลัง

### Print

Print stylesheet สำหรับ transcript export — A4, 12mm margin, hides forms/nav/buttons
Tables full-width border-collapse 11px
ทำงาน out-of-the-box จาก Father baseline

---

## 6. Feed Architecture

### Course Feed query

```typescript
// lib/feed/aggregator.ts
async function getCourseFeed(courseOfferingId, viewerId, viewerRole, cursor) {
  // Permission: viewer ต้องเป็น teacher ของ course หรือ enrolled student
  await permissions.assertCanViewCourse(viewerId, courseOfferingId);

  // ดึง 3 entity ใน window + union
  const [assignments, announcements, materials, scoreEvents] = await Promise.all([
    db.assignment.findMany({ where: { courseOfferingId }, take: 20, ... }),
    db.announcement.findMany({ ... }),
    db.material.findMany({ ... }),
    db.scoreItem.findMany({ where: { isPublished: true, ... } }),
  ]);

  // Merge by sort key (createdAt or publishedAt)
  const items = [...].sort((a, b) => b.sortAt - a.sortAt);

  // Add private items for this viewer (assignment graded, etc.)
  if (viewerRole === 'STUDENT') {
    const privateEvents = await getPrivateFeedEvents(viewerId, courseOfferingId);
    items.push(...privateEvents);
  }

  return paginate(items, cursor, 20);
}
```

### User Feed (Dashboard timeline)

Query feed across all CourseOfferings ของ viewer:

```typescript
async function getUserFeed(viewerId) {
  const courses = await getEnrolledOrTaughtCourses(viewerId);
  const allItems = await Promise.all(
    courses.map(c => getCourseFeed(c.id, viewerId, ..., null))
  );
  return mergeAndSort(allItems).slice(0, 20);
}
```

### Visual Design (สำคัญ — UX โจทย์)

**Feed card structure:**
- Icon ซ้ายบน (📝 Assignment, 📢 Announcement, 📚 Material, 🎯 Score, 💬 Comment)
- Title + author (ชื่อครู + เวลา relative)
- Preview content (truncate 2 บรรทัด)
- Action chip (👁️ Open, ✏️ Submit, 💬 X comments)
- Hover: shadow lift + slight scale (Framer Motion `whileHover`)
- Spacing: card padding 24px, gap between cards 16px
- Border: ใช้ `border-slate-200` light, `border-slate-700` dark
- Filter chips: horizontal scroll on mobile

**Skeleton loading:** match card structure exactly (no layout shift)
**Empty state:** 3D illustration (lazy) + คำชวน "ยังไม่มีกิจกรรมในห้องนี้"

---

## 7. File Upload Flow

```
Client                          Server (Next API)               R2
───────                         ───────────────────             ────
1. Compute file metadata        
2. POST /api/files/presign  →   Validate (size, MIME)
                                Permission check
                                Generate presigned PUT URL  →   (Receive)
                            ←   Return URL + r2Key
3. PUT file → R2 directly                                   →   Stored
4. POST /api/files/confirm  →   Verify file exists in R2
                                Verify MIME magic bytes
                                Create FileAttachment row
                            ←   Return attachment id
5. Attach id to submission/
   assignment/etc.
```

**Security notes:**
- Presigned PUT URL **expire 5 นาที**, single-use
- After confirm, server fetches first 64 KB of file from R2 → verify magic bytes match claimed MIME
- หาก magic byte mismatch → delete from R2 + reject
- Virus scan async (queue) → mark `virusScanStatus` → block download if INFECTED

---

## 8. Authorization (sketch)

ดู Security.md § Authorization Matrix สำหรับ matrix เต็ม

```typescript
// lib/auth/permissions.ts
export const permissions = {
  async assertCanViewCourse(userId, courseOfferingId) {
    const user = await getUser(userId);
    if (user.role === 'ADMIN') return;
    if (user.role === 'TEACHER') {
      const course = await db.courseOffering.findUnique({...});
      if (course?.teacherId !== userId) throw new ForbiddenError();
      return;
    }
    if (user.role === 'STUDENT') {
      const enrolled = await db.enrollment.findUnique({
        where: { studentId_courseOfferingId: { studentId: userId, courseOfferingId } }
      });
      if (!enrolled) throw new ForbiddenError();
      return;
    }
  },

  async assertCanViewSubmission(userId, submissionId) {
    const sub = await db.submission.findUnique({ ... include: { assignment: ... } });
    const user = await getUser(userId);
    if (user.role === 'ADMIN') return;
    if (user.role === 'TEACHER' && sub.assignment.course.teacherId === userId) return;
    if (user.role === 'STUDENT' && sub.enrollment.studentId === userId) return;
    throw new ForbiddenError();
  },

  // ... (full matrix in Security.md)
};
```

---

## 9. Deployment

Same as before — Vercel + Neon + Upstash + R2. ดู Task.md Phase 0 สำหรับ setup steps

```
GitHub repo
   │ push to main
   ▼
GitHub Actions ─── lint + typecheck + unit + integration + e2e
   │ all green
   ▼
Vercel ──── auto deploy
        │
        ├── Preview (PR)  → Neon ephemeral branch
        └── Production    → Neon main + R2 prod bucket
```

---

## 10. Key Decisions (ADR candidates)

| # | Decision | Reversible? | ควรเขียน ADR? |
|---|----------|-------------|---------|
| 0001 | Single-tenant (no `school_id`) | ❌ Hard | ✅ |
| 0002 | Student auth via Student ID (not email) | 🟡 | ✅ |
| 0003 | Admin มีสิทธิ์เต็มดูข้อมูล (super user) | ❌ trust+privacy | Superseded: Admin = read-only observer |
| 0004 | Score weight invariant = 100% | 🟡 | Superseded by ADR-0024 sum-based scoring |
| 0005 | 3D เฉพาะจุด | ✅ Soft | Deferred; ไม่มี WebGL dependency ใน runtime ปัจจุบัน |
| 0006 | Soft delete + anonymize | 🟡 PDPA | ✅ |
| 0007 | Assignment ↔ ScoreItem coupling (toggle "นับคะแนน") | 🟡 schema | ✅ |
| 0008 | L1 Visibility (student เห็นแค่ของตัวเอง) | ❌ privacy+trust | ✅ |
| 0009 | Comment polymorphic (no FK constraint, service-validated) | 🟡 | 🔸 maybe |
| 0010 | Submission versioning (vs overwrite) | 🟡 | ✅ |
| 0011 | Theme = Ink + Gold (adopted from Father) | 🟡 brand change | Superseded by ADR-0014/0028/0029 |

---

## 11. Term Summary Aggregation

หน้า `/student/terms/[termId]` — แสดงผลการเรียนรายเทอม **แยกจาก Course views**

### Query

```typescript
// lib/scoring/term-gpa.ts (PURE)
function termGpa(courseResults: { grade: number; creditHours: number }[]): number {
  const totalWeight = courseResults.reduce((s, c) => s + c.creditHours, 0);
  if (totalWeight === 0) return 0;
  return courseResults.reduce((s, c) => s + c.grade * c.creditHours, 0) / totalWeight;
}

// lib/scoring/term-status.ts
function termStatus(courseOfferings: CourseOffering[]): 'IN_PROGRESS' | 'COMPLETED' {
  const allPublished = courseOfferings.every(co =>
    co.scoreItems.every(si => si.isPublished)
  );
  return allPublished ? 'COMPLETED' : 'IN_PROGRESS';
}
```

### Page composition

1. Permission: student ดูแค่ของตัวเอง; admin ดูได้ทั้งหมด
2. Query: ทุก Enrollment ของ student ใน termId → JOIN CourseOffering (credit from CourseOffering directly, ADR-0012) + ScoreItems + ScoreEntries
3. ต่อ CourseOffering: คำนวณ Score Total (`Σscore / ΣfullScore`) → grade (ใช้ rules ของ course หรือ default)
4. รวม: Term GPA + Term Status
5. ถ้า `IN_PROGRESS` → GPA = `—`, badge "ยังไม่จบเทอม"
6. Print button → CSS `@media print` (Father stylesheet) — ซ่อน nav, แสดง A4 transcript

### Performance

- Cache term GPA per `(studentId, termId)` ใน Redis (invalidate เมื่อ Score Item publish/edit)
- Pagination ไม่ต้อง — 1 student มี ~6-10 courses ต่อเทอม

---

## 12. Out of Scope (Day 1)

- ❌ Multi-tenant
- ❌ PWA install (manifest แต่ไม่ activate)
- ❌ Email + LINE notification
- ❌ PDF report card
- ❌ ภาษาอังกฤษ (i18n)
- ❌ Parent portal
- ❌ Mobile native app
- ❌ Realtime WebSocket (ใช้ polling 30s)
- ❌ Plagiarism check
- ❌ Quiz / online exam
- ❌ Video lesson
- ❌ Calendar export (.ics)
