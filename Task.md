# Task.md — Implementation Roadmap

> **Historical ledger:** ไฟล์นี้เก็บแผนและภาษาของแต่ละ phase ณ เวลาที่พัฒนา จึงมีคำเก่า เช่น weighted score, Ink + Gold และสถานะ Phase 7 ที่ถูก supersede แล้ว ห้ามใช้เป็น roadmap หรือกติกา product ปัจจุบัน
>
> ใช้ `docs/NEXT-DEVELOPMENT-PLAN.md` สำหรับลำดับงานปัจจุบัน, `CONTEXT.md` สำหรับคำศัพท์ปัจจุบัน, ADR ที่ accepted สำหรับ decision และ `HANDOFF.md` ส่วนบนสุดสำหรับสถานะล่าสุด

แบ่งเป็น 9 phase เรียงตาม dependency — แต่ละ phase = shippable

> Time estimate: solo dev ทำงาน focus ~4 ชม/วัน
>
> **สถานะในช่วงที่สร้าง ledger นี้:** Phase 0-6 ✅ DONE · Phase 7 = next (ข้อมูลประวัติ ไม่ใช่สถานะปัจจุบัน)

---

## ✅ Phase 0 — Scaffolding (2-3 วัน) — DONE

- [ ] `pnpm create next-app` (App Router + TS + Tailwind)
- [ ] shadcn/ui CLI init
- [ ] **Adopt Father design system:**
  - [ ] Copy `tailwind.config.ts` (ink/accent tokens, keyframes, animations, perspective)
  - [ ] Copy `app/globals.css` (`@layer components` — card, btn, badge, table, stat; utilities — tilt-card, mesh-bg, glass, sheen, blob, text-gradient; print stylesheet)
  - [ ] Setup IBM Plex Sans Thai via `next/font/google`
  - [ ] Install `lucide-react` for icons
  - [ ] Test signature elements: `.btn-primary` shimmer, `.text-gradient-gold`, `.mesh-bg`
- [ ] Prisma + connect Neon dev branch
- [ ] ESLint + Prettier + Husky + lint-staged + gitleaks pre-commit
- [ ] Vitest + Playwright + Testcontainers config
- [ ] GitHub Actions workflow (lint + typecheck + test)
- [ ] Branch protection: `main` requires PR + green CI
- [ ] Vercel project + env vars
- [ ] Upstash Redis (rate limit)
- [ ] Cloudflare R2 bucket (dev + prod)
- [ ] `.env.example` ครบทุก key
- [ ] `middleware.ts` — secure headers + CSP baseline
- [ ] Sentry connect
- [ ] **Smoke test design system:** `/` แสดง mesh-bg + btn-primary + stat card

**DoD:** หน้า `/` แสดงตัวอย่าง design tokens + CI ผ่าน + deploy preview ใช้ได้

---

## ✅ Phase 1 — Auth & RBAC (4-6 วัน) — DONE

ระบบ login + signup + role guards

- [ ] Prisma: `User`, `Admin`, `Teacher`, `Student`, `UserSession`
- [ ] Migration + seed (1 admin, 1 teacher, ไม่มี student ตอนนี้)
- [ ] NextAuth v5 — Credentials provider
- [ ] Login page (`/login`) — switch identifier (email vs student id)
- [ ] **Signup page (`/signup`) — student self-register**
  - [ ] CAPTCHA (Turnstile)
  - [ ] PDPA consent checkbox
  - [ ] Auto-login on success
- [ ] Force reset password flow (first login + `mustResetPwd`)
- [ ] `lib/auth/permissions.ts` — central matrix (stubbed)
- [ ] Role-based layout + middleware guard
- [ ] Rate limit (Upstash) — login, signup, reset
- [ ] Account lockout
- [ ] Logout + session revoke
- [ ] Audit log table + LOGIN_* + SIGNUP events
- [ ] Tests:
  - [ ] Unit: password hash/verify, common password list
  - [ ] Integration: login, signup, lockout
  - [ ] E2E: signup flow + login per role

**DoD:** 3 role login + student self-register; redirect ถูก, lockout ทำงาน, audit log

---

## ✅ Phase 2 — Academic Data & CSV Import (3-4 วัน) — DONE
> Note: Workspace model adopted (ADR-0012) — no Subject template. CourseOffering owns name/credit/grade directly.

- [ ] Prisma: `AcademicYear`, `Term`, `Subject` (+ `creditHours`), `Class`, `CourseOffering`, `Enrollment`
- [ ] Admin list pages: teachers, students (table + filter + search)
- [ ] **CSV import (Teachers)** — upload + validate + preview + confirm
- [ ] CSV Zod row schema
- [ ] Audit: `USER_CREATED_BY_ADMIN`, `CSV_IMPORT`
- [ ] **Class Code generator** (8 chars uppercase + hyphen)
- [ ] **Join Course page (`/join`)** — enter class code → enroll → redirect
- [ ] **Join via URL query** — `/join?code=XXX` auto-fill (รองรับ link share + QR)
- [ ] **QR Code display** (teacher) — หน้า "QR ของห้องนี้" ใช้ `qrcode.react` (client-only)
- [ ] **Copy invite link** button (clipboard API)
- [ ] Class Code: regenerate, deactivate, expiry
- [ ] Teacher page: list of own CourseOfferings
- [ ] Teacher page: create CourseOffering (subject, class, term picker)
- [ ] Tests: integration + E2E (admin import → teacher create → student signup+join)

**DoD:** Admin import ครูได้, ครูสร้าง offering, นักเรียน sign up + join ห้องด้วย class code

---

## ✅ Phase 3 — Members + Course Skeleton — DONE (feature work)

Final scope narrowed from the original 6-tab plan: shipped Overview ·
Members · Settings for teacher; Overview · เพื่อนร่วมห้อง for student.
Feed/Attendance/Scores/Assignments tabs deferred to Phases 4-7 (which
own those domains).

- [x] Course page shell + tab nav (`<CourseShell>` + `<TabNav>`)
- [x] Teacher Overview · Members · Settings tabs
- [x] Student Overview · Members tabs (L1 visibility — DB-layer projection)
- [x] Teacher view: remove student with required reason + audit
      (`COURSE_MEMBER_REMOVED`)
- [x] Auto-restore on rejoin via class code (ADR-0013, audit
      `COURSE_MEMBER_RESTORED_BY_REJOIN`)
- [x] Class Code admin controls — regenerate · activate-toggle · expiry,
      each with own audit event
- [x] Soft-delete schema for Enrollment (`removedAt/removedById/removedReason`)
- [x] `assert.ownsCourse` + `assert.isActiveCourseMember` (+ pure `can.*`)
- [x] Smoke checks for all tab routes + L1 visibility body assertions

- [x] P3-7 — integration permission tests (real Neon DB, 22 cases across
      4 files: enrollment-removal, enrollment-restore, members-listing,
      class-code-mutations) + `pnpm test:integration` script

**DoD:** ✅ course tabs ทำงาน, soft-delete + restore flow ทำงาน,
        smoke ครบ, integration tests ครบ (108 tests pass total)

---

## ✅ Phase 4 — Attendance (3-4 วัน) — DONE

- [x] Prisma: `TimetableSlot`, `Session`, `AttendanceRecord` (+ `AttendanceStatus` enum) — ADR-0015, ADR-0016
- [x] CourseOffering settings: timetable editor (TimetableEditor component, intra-course overlap rejection per Q4a)
- [x] Session generator (hybrid: schedule + manual create) — `findOrCreateSession` lazy materialization, no cron (ADR-0015)
- [x] Attendance UI — grid student × status (desktop table + mobile cards CSS toggle, Pattern 13)
- [x] Bulk action: all-present / clear
- [x] Back-dated edit warning + audit log if >24h — `ATTENDANCE_BACK_EDIT` audit (anchor on `scheduledStart`, reason ≥ 5 required)
- [x] Student view: attendance % per CourseOffering — KPI + 4-status count tiles + per-Session timeline (L1 projection)
- [x] **+** Cancel Session flow — `SESSION_CANCELLED` audit (Critical tier, reason ≥ 5)
- [ ] Homeroom teacher view — **defer to Phase 8** (cross-class roll-up; out of scope for Phase 4 v1)
- [x] Tests: 49 integration cases + 13 smoke checks + 5 new unit cases for `can.mutateSession`

**DoD:** ครูเช็คชื่อได้, นักเรียนเห็นสถิติ — ✅ shipped + verified end-to-end

---

## ✅ Phase 5 — Scoring (DONE — 16 commits · ADR-0017 + ADR-0018)

- [x] Prisma: `ScoreItem`, `ScoreEntry`, `ScoreItemSource` enum (P5-1 · `54dfcc7`)
- [x] `lib/scoring/` PURE: `weightedTotal`, `gradeFor`, `gradeForCourseOffering`, `validateWeights`, `termGpa`, `deriveTermStatus`, `formatBasisPoints`, `formatGpa`, `formatPercent` (P5-2a · `fc5a768`)
- [x] `lib/scoring/` DB-touching: `createScoreItem` / `updateScoreItem` / `publishScoreItem` / `deleteScoreItem` (field-class A/B/C dispatch) / `bulkUpsertScoreEntries` / `getScoreboardForTeacher` / `getScoreItemGridForTeacher` / `getOwnScoresForStudent` / `getStudentTermSnapshot` / `listTermsForStudent` (P5-2b · `76e944a`)
- [x] Teacher: CRUD Score Item + live Σ น้ำหนัก pill (green @ 10000bp / amber otherwise · server `validateWeights` for display, hard gate at publish) (P5-4a · `425bc74`)
- [x] Score Entry grid — Pattern 13 dual-layout · empty-cell skip semantic · bulk `ทุกคนคะแนนเต็ม` / `ล้าง` (P5-4b · `c369a77`)  ※ debounced autosave **not shipped** — bulk-submit only per the original Q10 spirit
- [x] **Publish flow** + confirm modal (intentionally heavier per ADR-0018 §Negative consequences — preview + Σ gate + one-way warning) (P5-4c · `890b8d5`)
- [ ] ~~Score Item Template (save + reuse)~~ — **DEFERRED** per Q5 grill lock (HANDOFF L240 P5-6 "optional · low priority"); schema column + lib reads + UI all not present
- [x] **Edit after publish** → reason modal → audit (`SCORE_EDIT_AFTER_PUBLISH` Important tier, value-change-only detection so note-only edits don't trip) (P5-4b grid + P5-4c dialogs)
- [x] Grade rules — **default-only display** in Settings (Q5 lock); runtime `gradeFor(percent, thresholds = DEFAULT)` already accepts `CourseOffering.gradeRulesJson` overrides, so the editor enablement is UI-only in a future phase (P5-4c · `890b8d5`)
- [x] Student view: published scores, weighted total preview, course grade (only when fully published per Q4) (P5-5a · `35ce4ac`)
- [ ] ~~Notification: Score Item published~~ — **DEFERRED** to Phase 7 (notifications system lives there per the original phasing)
- [x] **Term Summary page (`/student/terms`)** — top-level nav (P5-5b · `61dc5a1`)
  - [x] `lib/scoring/term-gpa.ts` (PURE · weighted by creditHours · `creditHours === 0` excluded from GPA + completion per Q4)
  - [x] `lib/scoring/term-status.ts` (EMPTY | IN_PROGRESS | COMPLETED · one-way transitions per ADR-0018)
  - [x] Default page = current term + TermPicker dropdown for history; `/student/terms/[termId]` for canonical history URLs
  - [x] Table: วิชา · ครู · หน่วยกิต · % · เกรด · GPA footer row
  - [x] Show Term GPA (or `—` + 3-state badge `EMPTY` / `ยังไม่จบเทอม` / `จบเทอมแล้ว`) + progress bar publishedItems/totalItems
  - [x] Print button → `window.print()` with A4 transcript stylesheet + print-only footer "พิมพ์เมื่อ … · เอกสารอ้างอิง: <studentId/termSuffix>" (P5-5c · `4b3367d`)
- [x] Tests:
  - [x] PURE math: 59 unit cases (weightedTotal · gradeFor · gradeForCourseOffering · termGpa · deriveTermStatus · format — boundary cases incl. 9999/10001 Σ rejection, threshold-tier inclusivity, 33.33%×3 rounding, 0 enrollments → EMPTY, creditHours=0 escape) (P5-2a)
  - [x] Permissions: 6 unit cases on `can.mutateScoreItem` (owner/peer-teacher/admin/student/published-state-independence/cross-predicate consistency with `mutateSession`) (P5-3 · `e48942a`)
  - [x] Integration vs Neon: 45 cases (publishScoreItem Σ-gate, one-way Conflict, class A/B/C dispatch, fullScore shrink rejection, bulkUpsertScoreEntries reason gate w/ note-only carve-out, Pattern-14 active-vs-removed-with-history, deleteScoreItem cascade + audit, L1 own-only projection, termGpa pipeline end-to-end) — caught + fixed L1 Forbidden guard bug in `getOwnScoresForStudent` (P5-7 · `de9012e`)
  - [x] Smoke: 16 new HTTP checks (teacher Scores list/grid · Settings thresholds card · Student Scores tab · `/student/terms` · L1 cross-role redirects) (P5-8 · `710cc78`)

**DoD met:** ครูใส่คะแนน + publish ครบ flow ✅ · นักเรียนเห็นเฉพาะที่ publish ✅ · grade ถูก ✅ · Term Summary หน้าทำงานทั้ง active + ประวัติ + print PDF ได้ ✅

---

## ✅ Phase 6 — Assignment + Submission + Comments (DONE — 22 commits · ADR-0019 + ADR-0020 + ADR-0021)

ใหญ่สุดของ project ตามที่ประมาณ — file upload + versioning + comments
+ R2 pipeline ครบ. แตกออกเป็น 9 sub-tasks ที่ ship ได้ตามลำดับ.

### P6-1 — Schema migration
- [x] Prisma: Assignment, Submission, SubmissionVersion, FileAttachment (polymorphic), Comment (polymorphic) + 4 enums (SubmissionStatus, FileOwnerType, CommentScope, CommentOwnerType)
- [x] Back-relations on existing models (User.commentsAuthored, CourseOffering.assignments, Enrollment.submissions, ScoreItem.assignment)
- [x] db push to Neon dev branch

### P6-2 — lib/assignment/* (PURE + DB-touching)
- [x] PURE: constants + status helpers (isLate, computeSubmissionStatus, checkSubmissionWindow, isWithinCommentEditWindow) + Zod schemas + 62 unit tests
- [x] assignment.ts: createAssignment + updateAssignment (ADR-0019 § 5 toggle dispatch) + deleteAssignment with linked ScoreItem state branching
- [x] submission.ts: submitVersion (race-safe lazy create via P2002 recovery) + returnSubmission (workflow signal · NEVER touches ScoreEntry) + gradeSubmission (routes through ADR-0018 reason gate)
- [x] comment.ts: createComment + editComment (5-min window) + selfDeleteComment + moderateDeleteComment (Q5 matrix dispatch)
- [x] Audit enum cleanup in lib/audit/log.ts (rename ASSIGNMENT_EDIT → ASSIGNMENT_UPDATED, ASSIGNMENT_RETURN → SUBMISSION_RETURNED, FILE_UPLOAD → FILE_UPLOADED; add FILE_REJECTED + FILE_DELETED; remove Verbose-tier verb-forms)
- [x] Schema FK refinement: Assignment.scoreItem.onDelete Restrict → SetNull (lets deleteScoreItem Critical path complete cleanly per ADR-0019 § 5 escape)

### P6-3 — lib/storage/* (R2 pipeline · ADR-0021)
- [x] PURE: keys.ts (stagingKey · permanentKey · parseR2Key · sanitiseDisplayFilename · buildContentDisposition RFC 5987 + 6266) + jwt.ts (HMAC-SHA256 commit token via node:crypto, algorithm-confusion defended, constant-time signature compare) + 55 unit tests
- [x] R2 client (lazy-cached S3Client) + sign.ts (presigned PUT/GET, 300 s TTL CLAUDE.md hard rule) + verify.ts (file-type magic-byte, discriminated reject reasons)
- [x] image.ts (sharp re-encode + EXIF strip + HEIC/HEIF → JPEG transcode)
- [x] presign.ts + commit.ts orchestration (3-step pipeline: presign → direct PUT → commit with staging-to-permanent move + FileAttachment row + audit FILE_UPLOADED)
- [x] Deferred: SubmissionVersion.fileAttachmentIds Json column + FileOwnerType.SUBMISSION enum + remove files_not_yet_supported guard from submitVersion (Phase 7 prerequisite when student file upload UI lands)

### P6-4 — lib/auth permissions
- [x] can.* predicates (mutateAssignment · submitTo · viewSubmission · moderateComment · uploadToAssignment) + assert.* DB-touching guards with divergent {session, row} return shape
- [x] +26 unit tests covering each predicate's role × state matrix

### P6-5 — Teacher UI
- [x] _tabs.ts: insert "การบ้าน" between "คะแนน" and "ตั้งค่า"
- [x] List page + create dialog (Pattern 7 native <dialog>) with isScored toggle + weight (%) + fullScore conditional fields per ADR-0019 § 2
- [x] Detail page + Pattern 14 active ∪ ever-submitted enrollment union + per-row grade dialog (with ADR-0018 reason-after-publish gate) + return dialog (comment body = audit reason per ADR-0020 § 4)
- [x] Server Actions: createAssignmentAction + gradeSubmissionAction + returnSubmissionAction (Pattern 6 + 8)

### P6-6 — Student UI (L1 projection)
- [x] _tabs.ts: insert "การบ้าน" after "คะแนน"
- [x] List page L1-projected (joins OWN Submission row only) with NOT_SUBMITTED sentinel
- [x] Detail page + submit form (text + links · files deferred) + version history view + own ScoreEntry display when ScoreItem published + PRIVATE comments thread
- [x] RETURNED banner above submit form when teacher returned the work
- [x] Server Action: submitVersionAction (Pattern 6 + 8)

### P6-7 — Integration tests
- [x] +19 cases against Neon dev branch · assignment-coupling.test.ts (ADR-0019 atomicity + 3-state toggle) + submission-flow.test.ts (window check + late status + RETURN-does-not-touch-ScoreEntry + L1 peer-reject)
- [x] Fixture cleanup updated for polymorphic Comment + FileAttachment + Submission cascade

### P6-8 — Smoke checks
- [x] +10 HTTP checks against live dev (teacher Assignments tab + student Assignments tab + L1 cross-role boundary + auth boundary)

### P6-9 — Docs close-out
- [x] HANDOFF.md Phase 6 section + Patterns 1-14 reaffirmed
- [x] Task.md update (this section)
- [x] ADR-0019 + ADR-0020 + ADR-0021 written (docs/adr/)
- [x] CONTEXT.md § Admin · § Comment Moderation · § Assignment · § Submission Status · § FileAttachment · § Signed URL inline updates

**DoD met:** ครูสร้างการบ้าน + ตั้งค่า scored coupling ✅ · นักเรียนส่ง + resubmit ✅ · ครูตรวจ + return + grade ✅ · L1 boundary enforced ✅ · file upload pipeline (R2) ready (presign + commit) — student UI integration follows in a future commit ✅

**Deferred (documented as Phase 7 prerequisites):**
- Student-side file upload UI (needs SubmissionVersion.fileAttachmentIds + FileOwnerType.SUBMISSION schema + remove guard)
- Teacher attachment to Assignment brief (presign/commit pipeline ready; UI hook-up follows)
- Comment composer UI (lib/assignment/comment.ts ready; UI follows)

---

## Phase 7 — Feed + Notifications (3-4 วัน)

### 7a. Feed
- [ ] `lib/feed/aggregator.ts` — query Assignments + Announcements + Materials + Score events + Private events
- [ ] Course Feed tab (per CourseOffering)
- [ ] User Feed (Dashboard timeline)
- [ ] Filter chips (All / Assignment / Announcement / Material / Score)
- [ ] Infinite scroll, 20 items/page
- [ ] **Feed card design** — beautiful + scannable (Framer Motion hover, icon-led, spacing rhythm)
- [ ] Empty state with 3D illustration

### 7b. Notifications
- [ ] `Notification` table + service
- [ ] Trigger on: Score publish, Assignment create, Assignment graded/returned, Comment, Deadline 24h, Class join
- [ ] Bell icon + badge count
- [ ] Dropdown list (recent 10, mark read, "see all")
- [ ] Deadline reminder cron (Vercel Cron)

**DoD:** Feed ใช้งานได้สวย + notifications ครบทุก trigger

---

## Phase 8 — Admin Audit + Tools (3-4 วัน)

- [ ] Admin Dashboard — KPI (active users, failed logins, score edits, recent signups)
- [ ] Audit Log viewer
  - [ ] Filter: actor, action, date range
  - [ ] Detail: before/after diff
  - [ ] Export CSV
- [ ] Teachers + Students detail page (read-only)
- [ ] **Admin view student data** → log `ADMIN_VIEW_STUDENT_DATA`
- [ ] Moderation page — list hidden comments + reasons
- [ ] CSV export (audit log)
- [ ] Tests: filter, export

**DoD:** Admin ทำงาน "ตรวจสอบ" ได้จริง

---

## Phase 9 — UI/UX Polish + 3D + Pre-launch (5-8 วัน)

### 9a. UI Polish + 3D
- [ ] Landing — Hero 3D scene (R3F)
- [ ] Login + Signup — 3D background subtle
- [ ] Page transitions (Framer Motion)
- [ ] Loading states — 3D loader / skeleton
- [ ] Empty states — 3D illustrations
- [ ] 404 / 500 — 3D
- [ ] Dashboard cards — parallax/tilt
- [ ] Feed card hover/tap animations
- [ ] Dark mode
- [ ] Accessibility audit (axe-core, WCAG AA)
- [ ] Performance audit (Lighthouse ≥ 80)
- [ ] PWA manifest stub (not yet activated)

### 9b. Hardening
- [ ] CSP เข้ม (remove unsafe-eval in prod)
- [ ] Rate limit ทุก endpoint
- [ ] Dependency audit
- [ ] OWASP ZAP baseline scan
- [ ] Permission matrix test ครบ 100%
- [ ] E2E ครบ 10+ scenarios
- [ ] Backup + restore drill
- [ ] Incident response runbook
- [ ] Privacy Policy + Consent flow
- [ ] PDPA data export endpoint
- [ ] Soft delete + anonymize flow
- [ ] Production env vars + verified
- [ ] Domain + SSL
- [ ] Seed minimal prod data (1 admin)
- [ ] Smoke test on production
- [ ] Admin onboarding doc (ภาษาไทย)

**DoD:** Ready to onboard โรงเรียนเป้าหมาย

---

## Out of Scope (Post-launch)

| Feature | When |
|---------|------|
| PWA install activate | Month 1 |
| Email + LINE notification | Month 2 |
| PDF report card | Month 3 |
| Realtime WebSocket | Month 3+ |
| Parent portal | Month 6+ |
| Multi-school SaaS | New project |
| English i18n | On demand |
| Plagiarism check | Out of scope |
| Online quiz/exam | New module |

---

## Estimated Timeline (Solo Dev)

| Phase | Duration | Cumulative |
|-------|----------|------------|
| 0 Scaffolding | 1-2 | 2 |
| 1 Auth + Signup | 4-6 | 8 |
| 2 Data + CSV | 3-4 | 12 |
| 3 Course skeleton | 2-3 | 15 |
| 4 Attendance | 3-4 | 19 |
| 5 Scoring + Term Summary | 6-8 | 27 |
| 6 Assignment + Comments | 7-10 | 37 |
| 7 Feed + Notifications | 3-4 | 41 |
| 8 Admin audit | 3-4 | 45 |
| 9 Polish + Hardening | 5-8 | **53 วัน** |

≈ **11-14 สัปดาห์ทำเต็มเวลา** (≈ 2.5-3 เดือน) หรือ **5-6 เดือน part-time**

> Buffer 20% สำหรับ unknowns: actual = **~63 วัน focus / 3-3.5 เดือน เต็มเวลา**
