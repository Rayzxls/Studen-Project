# Task.md — Implementation Roadmap

แบ่งเป็น 9 phase เรียงตาม dependency — แต่ละ phase = shippable

> Time estimate: solo dev ทำงาน focus ~4 ชม/วัน
>
> **สถานะปัจจุบัน:** Phase 0-2 ✅ DONE · Phase 3 = next · ดู `HANDOFF.md` สำหรับสรุป

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

**Deferred to a dedicated next session:**
- [ ] P3-7 — integration test infra (`tests/integration/permissions/`)
      for `assert.*` + lib/course/* — needs test-DB setup decision
      before code (real Postgres vs Prisma mock)

**DoD:** ✅ course tabs ทำงาน, soft-delete + restore flow ทำงาน, smoke ครบ

---

## Phase 4 — Attendance (3-4 วัน)

- [ ] Prisma: `TimetableSlot`, `Session`, `AttendanceRecord`
- [ ] CourseOffering settings: timetable editor
- [ ] Session generator (hybrid: schedule + manual create)
- [ ] Attendance UI — grid student × status (desktop-optimized, mobile fallback)
- [ ] Bulk action: all-present / clear
- [ ] Back-dated edit warning + audit log if >24h
- [ ] Student view: attendance % per CourseOffering
- [ ] Homeroom teacher view (if applicable)
- [ ] Tests: session gen, bulk save, E2E

**DoD:** ครูเช็คชื่อได้, นักเรียนเห็นสถิติ

---

## Phase 5 — Scoring (5-6 วัน)

- [ ] Prisma: `ScoreItem`, `ScoreEntry`
- [ ] `lib/scoring/` pure functions (weightedTotal, gradeFor, validateWeights)
- [ ] Teacher: CRUD Score Item, weight validation (block save if ≠ 100)
- [ ] Score Entry grid — inline edit, debounced autosave
- [ ] **Publish flow** + confirm modal
- [ ] Score Item Template (save + reuse)
- [ ] **Edit after publish** → reason modal → audit
- [ ] Grade rules editor (default + override)
- [ ] Student view: published scores, weighted total, grade
- [ ] Notification: Score Item published
- [ ] **Term Summary page (`/student/terms`)** — top-level nav
  - [ ] `lib/scoring/term-gpa.ts` (PURE — weighted by creditHours)
  - [ ] `lib/scoring/term-status.ts` (IN_PROGRESS | COMPLETED)
  - [ ] Default page = current term + dropdown เลือกเทอมประวัติ
  - [ ] Table: subject · teacher · credit · % · grade
  - [ ] Show Term GPA (or `—` + "ยังไม่จบเทอม" badge if IN_PROGRESS)
  - [ ] Print button (Father @media print stylesheet)
- [ ] Tests:
  - [ ] scoring math (boundary cases)
  - [ ] Term GPA (with various credit weights, edge: all 0 credits)
  - [ ] Term Status transition (last Score Item publish → COMPLETED)
  - [ ] publish flow, permission

**DoD:** ครูใส่คะแนน + publish ครบ flow, นักเรียนเห็นเฉพาะที่ publish, grade ถูก, Term Summary หน้าทำงานทั้ง active + ประวัติ + print PDF ได้

---

## Phase 6 — Assignment + Submission + Comments (7-10 วัน) ⭐ Big

ใหญ่สุดของ project — มี file upload + versioning + comments

### 6a. File Storage (1-2 วัน)
- [ ] R2 client setup
- [ ] Presigned PUT endpoint (`/api/files/presign`)
- [ ] Confirm endpoint with MIME magic byte verify
- [ ] FileAttachment table (polymorphic)
- [ ] Signed GET URL (5 min expire)
- [ ] EXIF strip for images
- [ ] Storage quota check per CourseOffering
- [ ] Tests: upload happy path, oversize reject, bad MIME reject

### 6b. Material + Announcement (1-2 วัน)
- [ ] Prisma: `Material`, `Announcement`, `*Link` tables
- [ ] Teacher: create/edit/delete material + announcement
- [ ] Student: view (read only)
- [ ] Notification on create

### 6c. Assignment + Submission (3-4 วัน)
- [ ] Prisma: `Assignment`, `Submission`, `SubmissionVersion`, `*Link`
- [ ] Teacher: create Assignment
  - [ ] Toggle `isScored` → auto-create Score Item
  - [ ] Configure: dueAt, allow text/file/link
  - [ ] Attach files + links
- [ ] Student: submission form
  - [ ] Draft autosave
  - [ ] Submit → create Version 1
  - [ ] Resubmit → create new version, mark current
  - [ ] Late flag if `submittedAt > dueAt`
- [ ] Teacher: submission inbox per Assignment
  - [ ] List submissions with status filter
  - [ ] Open submission → see current version + history
  - [ ] **Return** with comment → status = RETURNED
  - [ ] **Grade** → enter score → save Score Entry (draft)
  - [ ] **Publish** → notify student + propagate to weighted total
- [ ] Student: see graded result + history
- [ ] Audit: `ASSIGNMENT_GRADE`, `ASSIGNMENT_RETURN`
- [ ] Tests: full E2E flow + permission

### 6d. Comments (1-2 วัน)
- [ ] Prisma: `Comment` polymorphic
- [ ] Class-wide comment thread on Assignment/Announcement/Material
- [ ] Private comment thread on Submission
- [ ] Edit within 5 min
- [ ] Teacher/Admin: hide comment (audit log)
- [ ] Notification on comment

**DoD:** ครูสร้างการบ้าน, นักเรียนส่ง, ครูตรวจ+return+grade, comments ทำงาน

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
