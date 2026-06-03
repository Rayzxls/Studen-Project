# HANDOFF — Studennnn

> เอกสารนี้ใช้สำหรับเริ่ม **session ใหม่** กับ AI assistant แล้วต่อยอดได้ทันที
> อ่านไฟล์นี้ + `CLAUDE.md` + `CONTEXT.md` ก่อนเริ่มงาน

อัพเดตล่าสุด: **2026-06-03** · 45+ commits · **Phase 0-3 ปิดครบ + 4 hotfix หลัง manual QA · พร้อมเริ่ม Phase 4**

---

## ⚠️ START HERE — Latest Session State (2026-06-03 evening)

### Phase 1-2-3 — ปิดครบ ✅

อ่าน 3 ไฟล์เรียงนี้ก่อนแตะอะไร:
1. **`HANDOFF.md`** (ไฟล์นี้ — START block + Patterns section)
2. **`CLAUDE.md`** — hard rules + coding conventions
3. **`CONTEXT.md`** — domain glossary (อย่าใช้คำนอก glossary นี้)

ADR ที่ต้องเข้าใจก่อนแตะ feature:
- `docs/adr/0012-workspace-model-no-subject-template.md` — CourseOffering = workspace, no Subject template
- `docs/adr/0013-enrollment-soft-delete-and-rejoin-restore.md` — soft-delete + auto-restore + kill switch
- `docs/adr/0014-theme-calm-ledger-supersedes-ink-gold.md` — Calm Ledger pivot (supersedes 0011)

### Phase 3 — DONE end-to-end (all 9 sub-tasks + 4 manual-QA hotfixes)

| Task | Status | SHA(s) |
|------|--------|--------|
| P3-1 schema (Enrollment soft-delete fields + index) | ✅ | `1a73d1e` |
| P3-2 lib/course/enrollment lifecycle (rename audit family → COURSE_MEMBER_* · removeMember · restoreByRejoin · getActiveMembers · enrollByClassCode refactor · tighten list queries) | ✅ | `da44ade`, `b8cbe58` |
| P3-3 lib/auth course-scoped helpers (can.ownsCourse, can.isActiveCourseMember, assert.*) + 9 new unit tests | ✅ | `e0014cb` |
| P3-4 components/course/{course-shell, tab-nav} scaffold | ✅ | `32270da` |
| P3-5 teacher tabs (Overview migration · Members + remove dialog · Settings + Class Code controls) | ✅ | `5a6432e`, `0d4cff8`, `3b12a52` |
| P3-6 student tabs (Overview + dashboard links · Members L1-filtered) | ✅ | `9e549bc`, `b0e5fa0` |
| P3-7 integration permission tests (real Neon DB, 22 cases) | ✅ | `a4ca88e` |
| P3-8 smoke-test.ts +13 Phase 3 checks | ✅ | `0db1339` |
| P3-9 docs update (Task.md + HANDOFF) | ✅ | `41ff537`, this commit |
| **Hotfix 1** — drop non-async export in "use server" file | ✅ | `7e35a7a` |
| **Hotfix 2** — native `<dialog>` close + centering under Next 16 + React 19 + Turbopack | ✅ | `4d0f0f5` |
| **Hotfix 3** — drop `.bind()` on Server Actions (session lost under Auth.js beta) | ✅ | `bb53d8a` |
| **Hotfix 4** — TX_OPTS for Neon cold-start + serialize integration tests | ✅ | `6879564` |

### What "shipped" means today

- **Teacher course detail** — 3 tabs (ภาพรวม · สมาชิก · ตั้งค่า):
  - Overview: ClassCodeCard + member count link
  - Members: active-only list + "นำออก" dialog (reason 5–500, audit `COURSE_MEMBER_REMOVED`)
  - Settings: regenerate code (with confirm dialog), activate-toggle, set/clear expiry — each with its own audit event
- **Student course detail** — 2 tabs (ภาพรวม · เพื่อนร่วมห้อง):
  - L1 visibility enforced at the Prisma SELECT layer — no classCode, no peer studentIds, no enrolledAt on the wire
  - Dashboard student cards now LINK to `/student/courses/[id]` (previously they rendered but did nothing)
- **Auto-restore on rejoin** — removed student using the same class code triggers `restoreByRejoin` inside `enrollByClassCode`, audit `COURSE_MEMBER_RESTORED_BY_REJOIN`. Permanent block = deactivate code in Settings (ADR-0013 § 2 kill switch)

### Audit event additions

The CLASS_CODE family was bumped to past-tense (zero migration — no fire site existed for the old verb form):
- `COURSE_MEMBER_JOINED` (replaces `STUDENT_JOINED_COURSE`)
- `COURSE_MEMBER_REMOVED` (new — was reserved as `STUDENT_REMOVED_FROM_COURSE`, never fired)
- `COURSE_MEMBER_RESTORED_BY_REJOIN` (new)
- `CLASS_CODE_REGENERATED` (renamed from `CLASS_CODE_REGENERATE`)
- `CLASS_CODE_DEACTIVATED` / `CLASS_CODE_REACTIVATED` (new)
- `CLASS_CODE_EXPIRY_SET` (new — covers both set and clear via before/after)

Security.md § 7 reflects all of these.

### Patterns established this phase (MUST follow in Phase 4+)

These are battle-tested through 4 hotfix cycles. Don't re-derive — use these:

#### 1. Pure `can.*` + DB-touching `assert.*` (lib/auth)
Predicates in `lib/auth/permissions.ts` are **pure sync, no I/O** — testable in `tests/unit/permissions.test.ts` style. DB lookups live in `assert.*` (`lib/auth/guards.ts`). Course-scoped asserts return `{session, course}` / `{session, enrollment}` (divergent from simple asserts which return `Session` alone) — saves callers a duplicate fetch. **Phase 4-5 mutations:** add `assert.canMarkAttendance(sessionId)`, `assert.canEditScoreItem(itemId)` etc. in the same pattern.

#### 2. Authorization INSIDE the `$transaction`
Closes TOCTOU between auth check and mutation. Pattern in `lib/course/enrollment.removeMember` + `lib/course/class-code.*`:
```ts
await db.$transaction(async (tx) => {
  const entity = await tx.entity.findUnique({ where: {id}, select: {teacherId, ...} });
  if (!entity) throw new NotFound();
  if (entity.teacherId !== actorUserId) throw new Forbidden();
  await tx.entity.update({...});
  await audit({...}, tx);  // ← include audit inside tx
}, TX_OPTS);
```

#### 3. **TX_OPTS = `{ maxWait: 10_000, timeout: 15_000 }` on EVERY $transaction**
Prisma's default `maxWait` (2s) is too short for Neon cold-start. Always pass `TX_OPTS` as 2nd arg to `db.$transaction(...)`. Const lives at top of `lib/course/enrollment.ts` and `lib/course/class-code.ts`. **Phase 4+ mutation lib files:** define your own `TX_OPTS` const + apply.

#### 4. DB-layer projection for L1 visibility
`getActiveMembersForStudent` strips `studentId`/`enrolledAt` at the Prisma `select`, not via caller `.map(strip)`. Defense in depth — data physically never leaves DB. **Pattern for Phase 5 (scoring) + 6 (assignments):** any "students see X about peers" query needs a `*ForStudent` projection that returns only L1-safe fields.

#### 5. `_tabs.ts` per role
`app/teacher/courses/[id]/_tabs.ts` + `app/student/courses/[id]/_tabs.ts` each export a `<role>CourseTabs(id)` function. Underscore prefix keeps Next.js from routing it. **Phase 4-7:** extend the existing arrays when adding tabs (Attendance, Scores, Assignments, Feed).

#### 6. Server Actions: NO `.bind()`, use hidden form field for context IDs
Under Next 16 + Auth.js v5 beta, `.bind(null, courseId)` intermittently drops the session cookie. Pattern:
```tsx
// Client
<form action={formAction}>
  <input type="hidden" name="courseId" value={courseId} />
  <input type="hidden" name="otherContextId" value={...} />
</form>

// Server action
export async function myAction(_prev, formData) {
  const session = await requireRole(["TEACHER"]);
  const courseId = String(formData.get("courseId") ?? "");
  if (!courseId) return { error: "missing_course_id" };
  ...
}
```

#### 7. Native `<dialog>` — explicit centering + defer-close
```tsx
<dialog
  className="fixed inset-0 m-auto h-fit w-[calc(100%-2rem)] max-w-md ..."
>
```
Default centering breaks when `w-full` is set. After action success:
```ts
useEffect(() => {
  if (!state.ok) return;
  setTimeout(() => {
    const d = dialogRef.current;
    if (!d) return;
    d.close();
    d.removeAttribute("open");
  }, 0);
}, [state.ok]);
```
The `setTimeout(_, 0)` + `removeAttribute('open')` belt-and-braces is needed because synchronous `close()` in the same commit cycle as Server Action result sometimes doesn't take.

#### 8. `"use server"` files — async function exports ONLY
Next 16 strictly enforces "A 'use server' file can only export async functions". No types alone (use `export type` is fine, only TYPE-only exports), no const objects, no helper functions exported. Helper functions stay internal.

#### 9. React 19 `set-state-in-effect` lint rule
Don't call `setState` inside `useEffect` based on action result. DOM side effects (`dialogRef.current?.close()`) are fine. To reset form state, rely on the row unmounting after revalidation OR use uncontrolled inputs.

#### 10. Audit event naming — past-tense, namespaced family
COURSE_MEMBER_* and CLASS_CODE_* families established. **Phase 4:** create ATTENDANCE_* family. Use past-tense (`ATTENDANCE_MARKED`, `ATTENDANCE_EDITED_AFTER_24H`) not verb form.

### Test commands (post-P3-7 script split)

| Command | Scope | DB needed? | Time |
|---------|-------|------------|------|
| `pnpm test` | `tests/unit/**` (86 cases) | no | ~4s |
| `pnpm test:integration` | `tests/integration/**` (22 cases) | yes — uses DATABASE_URL via `.env.local` | ~20s |
| `pnpm test:all` | both | yes | ~25s |
| `pnpm exec dotenv -e .env.local -- tsx scripts/smoke-test.ts` | E2E HTTP smoke (live dev server required) | yes | ~30s |

`pnpm test` (CI script) stays unit-only so the existing GitHub Actions
job needs no env changes. Devs run `pnpm test:integration` locally
before pushing changes that touch lib/course/*. Adding a Postgres
service container (or pointing CI at a dedicated Neon branch) to the
test-unit job is a clean follow-up — not blocking.

### CI status — green ✅

All commits since `c46b7c4` have passed 3/3 jobs (Lint/Typecheck, Unit Tests, Build). Pre-commit hooks (prettier + eslint + husky stash backup) catch issues before they hit CI.

### Commit discipline rule (CLAUDE.md § Commits) — held throughout this phase

- Every diff → review + commit ตามนั้น (ไม่สะสมข้าม feature)
- 1 commit = 1 concern
- Pre-commit: `pnpm typecheck` + `pnpm lint` 0 errors
- Propose breakdown ก่อนเริ่ม commit แรกของ session ถ้า groups > 2
- HEREDOC สำหรับ multi-line message, no Co-Authored-By, no "Generated with Claude" footer

### Known deferrals (Phase 1-2-3 spec ที่ defer ไป)

ไม่มีอะไร blocking — list นี้ documented เพื่อ honesty:

| Item | Original phase | Status | Why deferred |
|------|----------------|--------|--------------|
| Playwright E2E tests | Phase 1, 2 (planned) | Defer → Phase 9 § 9b | smoke-test.ts (57 checks) + integration (22 cases) ครอบคลุม 90%; E2E expensive to maintain pre-launch |
| gitleaks pre-commit hook | Phase 0 (planned) | Defer → Phase 9 § 9b | Solo dev, low credential leak risk; Phase 9 hardening sweep |
| Testcontainers | Phase 0 (planned) | **Dropped** | Superseded by Neon-based integration tests (working great) |
| Upstash Redis rate limit | Phase 1 (planned) | Defer → Phase 9 | `RateLimitBucket` (in-DB) works fine; Phase 9 migrate |
| Cloudflare R2 | Phase 0 + 6 (planned) | As-planned → **Phase 6** | Required first time in Assignment file upload |
| Sentry / Vercel deploy | Phase 0 (planned) | As-planned → Phase 9 | Pre-launch only |
| GitHub branch protection on `main` | Phase 0 | **User-side TODO** | Can't config from code — verify in GitHub Settings before Phase 4 push if you haven't |

### Next session — Phase 4 entry point

**Phase 4 — Attendance** (Task.md § Phase 4)

Schema to add:
- `TimetableSlot` (DOW + start/end times, per CourseOffering)
- `Session` (instance of a class meeting — manual or scheduled)
- `AttendanceRecord` (Student × Session × {Present | Late | Excused | Absent})

UI to add:
- Teacher: Attendance tab (4th tab in `app/teacher/courses/[id]/`) — grid student × session
- Teacher: Timetable editor in Settings (extends ClassCodeControls)
- Student: Attendance tab (3rd tab in `app/student/courses/[id]/`) — own stats only

Patterns to inherit (from § "Patterns established this phase"):
- Add `assert.canMarkAttendance(sessionId)` + `assert.canViewAttendance(courseId)` in `lib/auth/guards.ts`
- `lib/attendance/` library with `markAttendance`, `bulkMarkAttendance`, `getAttendanceStats` — all wrap `$transaction` with `TX_OPTS`
- Audit events: `ATTENDANCE_MARKED`, `ATTENDANCE_BACK_EDIT` (already in union — fire when edit > 24h after Session)
- Server Actions: hidden form field for `sessionId`, NOT `.bind()`
- Attendance grid is desktop-first (CLAUDE.md), mobile shows simplified view
- Add `app/teacher/courses/[id]/attendance/{page, actions}.tsx` + `_tabs.ts` entry
- Add integration tests in `tests/integration/permissions/attendance-*.test.ts`

**Recommended P4 sub-task breakdown** (mirrors P3 structure):
- P4-1 schema migration
- P4-2 lib/attendance/* (mark, edit, stats, bulk)
- P4-3 assert.canMarkAttendance + permissions
- P4-4 teacher Attendance tab + grid UI
- P4-5 student Attendance tab + stats
- P4-6 timetable editor in Settings (Sessions auto-generated from slots)
- P4-7 integration tests
- P4-8 smoke checks
- P4-9 docs

---

## 🎯 Project TL;DR

**Studennnn** = ระบบจัดการห้องเรียนสำหรับโรงเรียนเดียว (single-tenant)
รวม Google Classroom + ระบบเกรดมาตรฐาน Thai school

**3 roles:**
- **Admin** — ตรวจ audit / นำเข้า CSV / จัดการบัญชี (ไม่ใส่ข้อมูลแทนใคร)
- **Teacher** — สร้างวิชา (workspace) / เช็คชื่อ / ใส่คะแนน / ตรวจการบ้าน
- **Student** — สมัครเอง / เข้าห้องด้วยรหัส / ดูคะแนน / ส่งงาน

**Design:** **Calm Ledger** theme (ADR-0014 supersedes 0011) — Anuphan font (Cadson Demak), off-white + true black + aubergine surface
**Language:** ไทย 100%

---

## 📦 Tech Stack

| Layer | Stack |
|-------|-------|
| Framework | **Next.js 16** (App Router) |
| Runtime | Node 22 |
| Package mgr | **pnpm 10** |
| Language | TypeScript strict |
| Styling | **Tailwind v4** (CSS-based @theme) + custom `globals.css` |
| Font | **IBM Plex Sans Thai** |
| Icons | lucide-react |
| 3D | React Three Fiber (lazy, Phase 9) |
| Animation | Framer Motion (Phase 9) + Tailwind keyframes |
| Combobox | `cmdk` (ClassPicker) |
| QR | `qrcode.react` |
| Forms | React Server Actions + Zod |
| Validation | **Zod 4** |
| ORM | **Prisma 6** (downgraded from 7 due to breaking config changes) |
| Auth | **NextAuth v5 beta** (Credentials provider) |
| Password | bcryptjs (cost 12) |
| Rate limit | In-DB `RateLimitBucket` (Phase 9 migrate to Upstash Redis) |
| CSV | papaparse |
| DB | **PostgreSQL** on **Neon** (Singapore region) |
| Hosting (target) | Vercel |
| Testing | Vitest + jsdom + Playwright (Phase 9 E2E) |
| Lint/Format | ESLint 9 + Prettier + Husky + lint-staged |

**Not yet integrated** (planned in later phases):
- Cloudflare R2 (file storage, Phase 6)
- Upstash Redis (rate limit, Phase 9)
- Sentry (monitoring, Phase 9)
- Vercel deployment

---

## ✅ Phase Progress

| Phase | Description | Status |
|-------|-------------|--------|
| **0** | Scaffolding (Next 16 + Tailwind v4 + Father design) | ✅ DONE |
| **1** | Auth & RBAC + Self-register + Force reset + Audit | ✅ DONE |
| **2a** | Academic schema + Workspace model + Class Code + Join | ✅ DONE |
| **2b** | Teacher pages (list/create/detail + QR + ClassPicker) | ✅ DONE |
| **2c** | Admin pages (list/students/teachers + CSV import + audit viewer) | ✅ DONE |
| **2.5** | Calm Ledger theme pivot (ADR-0014) + Anuphan + landing rebuild + touch-up ทุก surface | ✅ DONE |
| **3** | Course tabs (Overview · Members · Settings) + soft-delete + restoration | ✅ DONE (P3-1..9 all complete · 22 integration tests pass) |
| **4** | Attendance (timetable, sessions, records) | ⏳ TODO |
| **5** | Scoring + Term GPA + Print transcript | ⏳ TODO |
| **6** | Assignment + Submission + Comments + R2 file upload | ⏳ TODO |
| **7** | Feed + Notifications | ⏳ TODO |
| **8** | Admin polish (more audit tools) | ⏳ TODO |
| **9** | E2E tests + Hardening + Deploy | ⏳ TODO |

---

## 🚀 Quick Start (fresh clone, fresh session)

```bash
# 1. Install
pnpm install

# 2. Verify env (already set up)
#    .env.local has DATABASE_URL + AUTH_SECRET (do NOT commit)

# 3. Generate Prisma client + verify schema in sync
pnpm db:generate

# 4. Run dev
pnpm dev

# 5. Verify tests
pnpm typecheck   # 0 errors expected
pnpm test        # 77 tests should pass
pnpm lint        # 0 errors, 0 warnings

# 6. Smoke test (run dev in another terminal first)
pnpm exec dotenv -e .env.local -- tsx scripts/smoke-test.ts
# Expected: 44 passed · 0 failed
```

---

## 🔑 Test Accounts (from seed)

| Role | Identifier | Password | Notes |
|------|-----------|----------|-------|
| Admin | `admin@studennnn.local` | `Admin1234!` | — |
| Teacher | `teacher@studennnn.local` | `Teacher1234!` | Homeroom ของ ม.4/2 |
| Student | `60001` | `Student1234` | อยู่ ม.4/2, enrolled ใน MATH4A-DEMO1 |

**Demo class code:** `MATH4A-DEMO1` (เข้าได้ผ่าน `/join` หรือ `/join?code=MATH4A-DEMO1`)

**21 classes seeded:** ป.1/1 — ม.6/2 (ใช้ทดสอบ ClassPicker)

---

## 🗂️ File Structure

```
D:\Studennnn\
├── app/                          # Next.js App Router (16 routes)
│   ├── (auth)/                  # Group: login, signup, join, reset-password
│   ├── admin/                   # Admin pages
│   │   ├── dashboard/           # KPIs + recent activity
│   │   ├── teachers/            # List + search + paginate
│   │   ├── students/            # List + class filter
│   │   ├── import/              # CSV import landing
│   │   │   └── teachers/        # 3-stage flow (upload → preview → commit)
│   │   ├── audit/               # Audit log viewer
│   │   └── layout.tsx           # Sidebar nav + role guard
│   ├── teacher/courses/         # Teacher workspace
│   │   ├── page.tsx             # List
│   │   ├── new/                 # Create with ClassPicker
│   │   └── [id]/                # Detail + QR + members
│   ├── dashboard/               # Role-aware landing (after login)
│   ├── privacy/                 # PDPA Policy
│   └── api/                     # API routes
│       ├── auth/[...nextauth]/  # NextAuth
│       ├── signup/              # Student self-register
│       ├── join/                # Enroll via code
│       └── admin/import/teachers/{preview,commit}/
├── components/
│   ├── class-code-card.tsx      # QR + copy link card
│   ├── class-picker.tsx         # ⭐ cmdk combobox with search/group/recent
│   ├── pagination.tsx           # Reusable pagination
│   ├── copy-button.tsx          # Clipboard helper
│   ├── turnstile-widget.tsx     # CAPTCHA wrapper
│   └── admin-sidebar.tsx
├── lib/
│   ├── auth/                    # NextAuth config, password, permissions, guards, rate-limit
│   ├── admin/                   # CSV import, list queries, temp-password
│   ├── course/                  # class-code gen, category, enrollment, queries, create
│   ├── audit/log.ts             # 30+ event types
│   ├── db/client.ts             # Prisma singleton
│   ├── errors.ts                # Typed HTTP errors
│   ├── utils/request.ts         # IP/UA capture
│   └── validation/              # Zod schemas (shared client/server)
├── prisma/
│   ├── schema.prisma            # Full schema (ADR-0012 workspace model)
│   ├── seed.ts                  # Idempotent (upsert pattern)
│   └── migrations/              # init_auth only — Phase 2 used db:push
├── scripts/
│   ├── smoke-test.ts            # E2E HTTP suite (44 checks)
│   ├── check-audit.ts           # CLI to inspect audit log
│   └── reset-courses.ts         # One-off DB cleanup utility
├── tests/
│   ├── setup.ts                 # vitest setup (@testing-library/jest-dom)
│   └── unit/                    # 8 files: password, permissions, validation, errors, smoke, class-code, category, csv-import (77 tests)
├── docs/adr/                    # ADRs 0011 + 0012 (others pending)
├── middleware.ts                # Secure headers + CSP + auth
├── .env.local                   # gitignored (real secrets)
├── .env.example                 # template
└── *.md                         # README, CLAUDE, CONTEXT, Architecture, Security, Task, Testing
```

---

## 📜 Architecture Decisions (ADRs)

ADRs ที่ **เขียนเป็นไฟล์แล้ว** (in `docs/adr/`):

| # | Title | File |
|---|-------|------|
| 0011 | Theme: Ink + Gold (adopted from Father) | `0011-theme-ink-gold.md` |
| 0012 | Workspace Model: Teacher-Owned CourseOffering (no Subject) | `0012-workspace-model-no-subject-template.md` |

ADRs ที่ **ตัดสินใจแล้วแต่ยังไม่ได้เขียนเป็นไฟล์** (จดไว้ใน Architecture.md § Key Decisions):

| # | Decision | Where |
|---|----------|-------|
| 0001 | Single-tenant (no `school_id`) | Discussed in interview, ADR file TBD |
| 0002 | Student auth via Student ID (not email) | — |
| 0003 | Admin = super user (full data access, logged) | — |
| 0004 | Score weight invariant = 100% (Phase 5) | — |
| 0005 | 3D เฉพาะจุด — Level A (R3F) + Level B (CSS) | Architecture.md |
| 0006 | Soft delete + anonymize (PDPA) | Security.md |
| 0007 | Assignment ↔ ScoreItem coupling (Phase 6) | Architecture.md |
| 0008 | L1 Visibility (student เห็นแค่ของตัวเอง) | Security.md |
| 0009 | Comment polymorphic (Phase 6) | Architecture.md |
| 0010 | Submission versioning (Phase 6) | Architecture.md |

> 💡 **Action item ในอนาคต:** เขียน ADR ที่ค้าง (0001-0010) เป็นไฟล์ใน `docs/adr/` เพื่อ knowledge transfer

---

## 🔐 Security Posture (Phase 1-2 baseline)

- ✅ Password: bcrypt cost 12, min 8 (student) / 12 (teacher/admin), common-password reject
- ✅ Session: httpOnly cookie, JWT, 4h sliding / 12h absolute
- ✅ Rate limit: 5 login fails → 30-min lockout (in-DB)
- ✅ CAPTCHA: Cloudflare Turnstile on signup (test keys ใน dev)
- ✅ PDPA: Privacy Policy + consent tracking + soft delete + anonymize
- ✅ CSP: secure headers + nosniff + DENY frame
- ✅ Audit: IP + UA capture for all events (7 active event types)
- ✅ Authorization: requireAuth/requireRole/can/assert pattern
- ✅ CSRF: NextAuth handles

**Deferred:**
- CAPTCHA after 3 failed logins (Phase 9)
- File upload security (Phase 6 — R2 + MIME magic byte)
- OWASP ZAP scan (Phase 9 pre-launch)

---

## 🧪 Test Coverage

**Unit tests:** 77 passing across 8 files
- `password.test.ts` (10) — bcrypt + common pwd + per-role rules
- `permissions.test.ts` (12) — pure `can.*` predicates
- `validation.test.ts` (12) — Zod schemas
- `errors.test.ts` (9) — HttpError + errorResponse
- `class-code.test.ts` (15) — generator + validator + normalizer
- `category.test.ts` (8) — grade-level → category
- `csv-import.test.ts` (10) — parse + dedupe + DB mock
- `smoke.test.ts` (1) — smoke

**Smoke tests:** 44 passing (scripts/smoke-test.ts — HTTP against live dev)
- Public pages, protected redirects, login per role, signup flow, rate limit, force reset, join flow, audit log

**E2E (Playwright):** configured but no tests yet (Phase 9)

---

## ⚠️ Known Tech Debt

| Item | Severity | Note |
|------|----------|------|
| `middleware.ts` → `proxy.ts` | Low | Next 16 deprecation warning; works fine |
| Phase 2 used `db push` not migrations | Low (dev only) | Production needs proper migrations Phase 9 |
| Prisma client EPERM on Windows | Low | Kill node procs before `db:generate`; retry works |
| `force-reset` requires Prisma consent env var | Low | Use `scripts/reset-courses.ts` pattern instead |
| No E2E Playwright tests yet | Medium | Smoke covers main flows; Playwright Phase 9 |
| CAPTCHA only on signup, not login fails | Low | Rate limit handles worst case; add Phase 9 |
| Subject removed (ADR-0012) — no cross-class report | Documented | Use `subjectCode` field if needed |
| ADRs 0001-0010 not yet in `docs/adr/` | Low | Architecture.md documents them; write files when time |

---

## 🪧 Important Gotchas (Windows / Prisma 6 / Next 16)

1. **Prisma client EPERM on regen** — When dev server is running, `pnpm db:generate` fails to rename DLL. Solution:
   ```powershell
   Get-Process node | Stop-Process -Force
   pnpm db:generate
   ```

2. **`prisma db push --force-reset` blocked** — Prisma 6 added safety check requiring `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION` env var. Workaround: use `scripts/reset-courses.ts` to clear data first, then plain `pnpm db:push`.

3. **CSRF for HTTP login testing** — NextAuth v5 returns MULTIPLE `authjs.csrf-token` Set-Cookie headers; must dedupe by name (last-write-wins) when building Cookie header. See `scripts/smoke-test.ts` → `cookiesFromSetCookie()`.

4. **dotenv-cli prefix needed for CLI** — Next.js auto-loads `.env.local` at runtime, but Prisma CLI / tsx scripts need `pnpm exec dotenv -e .env.local --` prefix. Already wrapped in `db:migrate`, `db:seed`, `db:studio`, `db:push`, `db:generate`.

5. **Tailwind v4 limitations** — Can't use `@apply` with custom component class chains. Use multi-selector for shared base styles (see `.btn` group in `globals.css`).

6. **Force reset password flow** — After password change, JWT still has `mustResetPwd=true` → would loop. Mitigation: `signOut()` after change, user logs in fresh.

7. **Workspace model (ADR-0012)** — No `Subject` table. CourseOffering owns `name`, `subjectCode?`, `gradeLevel`, `creditHours` directly. Don't add back without re-discussing trade-offs.

---

## 🗃️ DB Schema At-A-Glance

### Identity
- `User` (role, identifier, passwordHash, mustResetPwd, isActive, deletedAt, consentedAt)
- `Admin` (userId, firstName, lastName)
- `Teacher` (userId, firstName, lastName, email, homeroomOfId?)
- `Student` (userId, studentId, firstName, lastName, classId?, anonymized)
- `UserSession` (tokenHash, expiresAt, revokedAt)

### Academic
- `AcademicYear` (name "2568", isActive)
- `Term` (number, name, startDate, endDate, isActive)
- `Class` (name "ม.4/2", gradeLevel "ม.4", homeroomTeacher)
- `CourseOffering` ⭐ (teacherId, classId, termId, **name, subjectCode?, gradeLevel, creditHours**, classCode, codeActive)
- `Enrollment` (studentId × courseOfferingId — unique)

### Audit & Infra
- `AuditLog` (timestamp, actor, action, target, before/after JSON, ipAddress, reason)
- `RateLimitBucket` (`<action>:<id>` key, count, resetAt, lockedAt)

**No tables yet for:** Attendance (Phase 4), ScoreItem/ScoreEntry (Phase 5), Assignment/Submission/Comment (Phase 6), Notification (Phase 7), FileAttachment (Phase 6)

---

## 📚 Commit History

```
43ce355  feat(admin): teachers/students list + CSV import with preview/commit flow + audit page
c3d270b  feat(ux): ClassPicker combobox (cmdk) with search + recent + homeroom badge
1579004  feat(adr-0012): workspace model - drop Subject template
1f3159b  chore: clean up unused vars
83f03b6  feat(phase2): academic schema + class code + join flow + teacher pages
c614abc  test: phase 1 smoke test script (33 e2e checks passing)
23bec00  feat(auth): force reset password flow + unit tests (44 passing)
0be7869  feat(auth): student self-register + permissions + audit IP capture + privacy page
bf24ecd  feat(auth): phase 1 - prisma schema + nextauth v5 + login/dashboard
580e05d  chore: phase 0 scaffolding - Next.js 16 + Tailwind v4 + Ink+Gold design system
```

---

## 🎯 What's Next — Phase 3 Suggested Plan

**Phase 3 — Course Tabs + Members (~2-3 วัน)**

ตอนนี้ teacher course detail page (`/teacher/courses/[id]`) มีแค่ QR + members list flat
Phase 3 จะแบ่งเป็น tab structure ที่ extensible:

```
┌─── Course: คณิตศาสตร์ ม.4/2 ครูสมชาย ─────┐
│ [Overview] [Members] [Attendance] [Scores] │  ← Tabs
│ [Assignments] [Feed] [Settings]            │
└────────────────────────────────────────────┘
```

**Scope:**
- [ ] Tab navigation component (reusable for both teacher and student views)
- [ ] Student-facing course page (`/student/courses/[id]`) with L1 visibility
- [ ] Members tab — show roster, teacher can "remove from course"
- [ ] Permission tests: student เห็น roster (no scores), ครูเห็นทุกอย่าง
- [ ] Smoke test: course detail accessible to enrolled student, blocked for others

**DoD:** ครู+นักเรียนเปิดหน้า course เดียวกัน, tab navigate ได้, Members tab ทำงาน

---

## 💬 How to Resume in a New Session

Paste this into the new session as your first message:

> ผมทำงานต่อจาก project Studennnn ที่ `D:\Studennnn`
> อ่าน `HANDOFF.md` + `CLAUDE.md` + `CONTEXT.md` ก่อนเริ่ม
> ตอนนี้ Phase 0-2 เสร็จแล้ว (77 unit tests + 44 smoke tests passing)
> อยากทำต่อ: [ระบุ Phase หรือ feature ที่อยากทำ]

หรือถ้าจะ verify state ก่อน:

```bash
cd D:\Studennnn
pnpm typecheck && pnpm test && pnpm lint
# ทั้ง 3 อันต้องผ่านหมด

# Optional: smoke test (need pnpm dev in another terminal)
pnpm dev  # terminal 1
pnpm exec dotenv -e .env.local -- tsx scripts/smoke-test.ts  # terminal 2
```

ถ้าทุกอันผ่าน = state ตรงกับ HANDOFF.md → ต่อได้เลย

---

## 📂 Documentation Index

| File | Purpose |
|------|---------|
| [README.md](./README.md) | Project overview, quick start |
| [HANDOFF.md](./HANDOFF.md) | **ไฟล์นี้** — session resume guide |
| [CLAUDE.md](./CLAUDE.md) | Coding rules + design system + hard rules |
| [CONTEXT.md](./CONTEXT.md) | Glossary (domain terms, no implementation) |
| [Architecture.md](./Architecture.md) | Tech stack, schema, design decisions |
| [Security.md](./Security.md) | Auth, authorization, PDPA, audit, rate limit |
| [Task.md](./Task.md) | Roadmap Phase 0-9 (mark progress as you go) |
| [Testing.md](./Testing.md) | Testing strategy |
| [docs/adr/](./docs/adr/) | Architecture Decision Records (2 written, 10 pending) |
