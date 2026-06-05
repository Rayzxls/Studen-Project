# HANDOFF — Studennnn

> เอกสารนี้ใช้สำหรับเริ่ม **session ใหม่** กับ AI assistant แล้วต่อยอดได้ทันที
> อ่านไฟล์นี้ + `CLAUDE.md` + `CONTEXT.md` ก่อนเริ่มงาน

อัพเดตล่าสุด: **2026-06-05** · 99+ commits · **Phase 0-6 ปิดครบ · Phase 7 ถึง P7-7 (Bell + Dashboard Feed + Teacher Post UI)**

---

## ⚠️ START HERE — Latest Session State (2026-06-04 · post-Phase-6)

### Phase 1-2-3-4-5-6 — ปิดครบ ✅

อ่าน 3 ไฟล์เรียงนี้ก่อนแตะอะไร:
1. **`HANDOFF.md`** (ไฟล์นี้ — START block + Patterns section)
2. **`CLAUDE.md`** — hard rules + coding conventions
3. **`CONTEXT.md`** — domain glossary (อย่าใช้คำนอก glossary นี้)

ADR ที่ต้องเข้าใจก่อนแตะ feature:
- `docs/adr/0012-workspace-model-no-subject-template.md` — CourseOffering = workspace, no Subject template
- `docs/adr/0013-enrollment-soft-delete-and-rejoin-restore.md` — soft-delete + auto-restore + kill switch
- `docs/adr/0014-theme-calm-ledger-supersedes-ink-gold.md` — Calm Ledger pivot (supersedes 0011)
- `docs/adr/0015-lazy-session-materialization.md` — Session created on demand, no cron, no eager batch
- `docs/adr/0016-sparse-attendance-and-enrollment-fk.md` — sparse rows + Enrollment FK + active∪ever-marked grid
- `docs/adr/0017-weight-invariant-basis-points-and-publish-gate.md` — ScoreItem.weight = integer basis points 0..10000; publish-gate Σ === 10000 strict; PURE calc.ts
- `docs/adr/0018-publish-is-a-contract-no-unpublish-and-field-class-edit-rules.md` — publishedAt one-way; field-class A/B/C edit dispatch; SCORE_EDIT_AFTER_PUBLISH + SCORE_DELETE_AFTER_PUBLISH escape hatches
- `docs/adr/0019-assignment-scoreitem-coupling-atomic-no-default-weight.md` — Assignment ↔ ScoreItem synchronous atomic coupling; ครูระบุ weight + fullScore ใน dialog (no default); 3-state toggle dispatch
- `docs/adr/0020-submission-lifecycle-workflow-signals-vs-score-of-record.md` — Submission lifecycle; RETURN = workflow signal ไม่แตะ ScoreEntry; isLate per-version; status เดินหน้าเสมอ
- `docs/adr/0021-file-upload-pipeline-presigned-staging-magic-byte-verify-exif-strip.md` — R2 pipeline: presigned PUT + staging → commit verify → permanent; magic-byte enforcement; SVG blocked; EXIF strip via sharp; signed URL strategy hybrid

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

### Phase 4 — DONE end-to-end (all 9 sub-tasks)

| Task | Status | SHA(s) |
|------|--------|--------|
| P4-1 schema (TimetableSlot + Session + AttendanceRecord + AttendanceStatus) + ADR-0015 + ADR-0016 + CONTEXT.md glossary + `SESSION_CANCELLED` audit + Security.md tier update | ✅ | `43e8a8e` |
| P4-2 lib/attendance lifecycle (constants · timetable CRUD + pure `detectOverlap` · `findOrCreateSession` race-safe via P2002 recovery · `cancelSession` audit · `bulkMarkAttendance` upsert with back-edit detection · `getAttendanceGridForTeacher` active∪ever-marked · `getAttendanceStatsForStudent` L1 projection) | ✅ | `02886be` |
| P4-3 `can.mutateSession` + `assert.canMutateSession` returning `{session, sessionRow}` + 5 unit tests (86 → 91) | ✅ | `bc3cbc0` |
| P4-4 teacher UI (Attendance tab + list page + grid page + Server Actions + create-session-form + grid component + cancel-session-dialog + Thai+Buddhist Intl helpers) | ✅ | `f352f24` |
| P4-5 student attendance tab (L1 view · `getStudentSessionAttendance` query · StudentAttendanceStatsView KPI + timeline) | ✅ | `b94490f` |
| P4-6 timetable editor in Settings (TimetableEditor card · `createSlotAction` + `deleteSlotAction` · overlap rejection mapped to field error) | ✅ | `0f670b8` |
| P4-7 integration tests (4 files, 49 cases · 22 → 71 total) + fixtures cleanup updated for AttendanceRecord onDelete:Restrict | ✅ | `ad7de4c` |
| P4-8 smoke checks (+13 against live dev · 57 → 72 total) | ✅ | `547bee6` |
| P4-9 docs (this commit) | ✅ | — |

### Phase 5 — DONE end-to-end (all sub-tasks + Q-grill ADRs + 1 lib bug caught by P5-7)

| Task | Status | SHA(s) |
|------|--------|--------|
| Grill ADR-0017 (weight basis points + publish gate) | ✅ | `5db9852` |
| Grill ADR-0018 (publish one-way + field-class edit rules) | ✅ | `33c562f` |
| CONTEXT.md Phase 5 glossary updates (Score Item · Publish · Grade · Term GPA · Term Status) | ✅ | `ac992ea` |
| Dashboard footer phase pointer hotfix (was stuck on Phase 2) | ✅ | `20f95d7` |
| P5-1 schema (ScoreItem + ScoreEntry + ScoreItemSource enum) | ✅ | `54dfcc7` |
| P5-2a `lib/scoring/*` PURE (constants · format · calc · term-gpa · term-status) + 4 test files (+59 unit cases) | ✅ | `fc5a768` |
| P5-2b `lib/scoring/*` DB-touching (score-item · score-entry · queries) + audit enum past-tense rename | ✅ | `76e944a` |
| P5-3 `can.mutateScoreItem` + `assert.canMutateScoreItem` + 6 unit tests (cross-predicate consistency with mutateSession) | ✅ | `e48942a` |
| P5-4a Teacher Scores tab + Score Item list + create dialog (live Σ pill, % → bp conversion) | ✅ | `425bc74` |
| P5-4b Per-ScoreItem grid + bulk save (dual-layout Pattern 13 · empty-cell skip semantic · post-publish reason gate triggered only on value changes) | ✅ | `c369a77` |
| P5-4c Publish + Delete dialogs + Settings `เกณฑ์เกรด` read-only card | ✅ | `890b8d5` |
| P5-5a Student Scores tab (L1 projection via Pattern 4, published items only, weighted preview) | ✅ | `35ce4ac` |
| P5-5b `/student/terms` + `/student/terms/[termId]` + TermPicker + Print button + dashboard link | ✅ | `61dc5a1` |
| P5-5c Print stylesheet polish + transcript footer (พิมพ์เมื่อ + reference code) | ✅ | `4b3367d` |
| P5-7 integration tests (3 files, 45 cases · 71 → 116 total) + caught + fixed L1 Forbidden guard bug | ✅ | `de9012e` |
| P5-8 smoke checks (+16 against live dev · 72 → 88 total) | ✅ | `710cc78` |
| P5-9 docs (this commit) | ✅ | — |

**P5-6 ScoreItemTemplate** — deferred per Q5 grill lock; reserved for a future phase once teachers report demand for template-copy across CourseOfferings.

### What "shipped" means today

- **Teacher course detail** — 5 tabs (ภาพรวม · สมาชิก · เช็คชื่อ · คะแนน · ตั้งค่า):
  - Overview: ClassCodeCard + member count link
  - Members: active-only list + "นำออก" dialog (reason 5–500, audit `COURSE_MEMBER_REMOVED`)
  - **Attendance**: Session list + "+ เปิดคาบ" dialog + per-Session grid (Pattern 13 dual-layout) + back-edit reason gate (>24h) + cancel-session dialog · `SESSION_CANCELLED` / `ATTENDANCE_BACK_EDIT` audits
  - **Scores (Phase 5)**: Score Item list + Σ น้ำหนัก pill (green @ 10000bp / amber otherwise) · `+ เพิ่มรายการคะแนน` dialog · per-row Publish + Delete dialogs · per-item grid (Pattern 13 dual-layout) with bulk `ทุกคนคะแนนเต็ม` + post-publish reason gate that triggers ONLY on value changes (not note-only) · empty-cell skip semantic at the action layer
  - Settings: regenerate code, activate-toggle, set/clear expiry — each with its own audit event · **TimetableEditor card** · **`เกณฑ์เกรด` read-only card** (Q5 lock: editor deferred, runtime `gradeFor()` already accepts `gradeRulesJson` overrides so future enablement is UI-only)
- **Student course detail** — 4 tabs (ภาพรวม · เพื่อนร่วมห้อง · เช็คชื่อ · คะแนน):
  - L1 visibility enforced at the Prisma SELECT layer — no classCode, no peer studentIds, no enrolledAt on the wire
  - **Attendance L1 view**: KPI "อัตราการมาเรียน %" + 4-status count tiles + per-Session timeline showing own status only
  - **Scores L1 view (Phase 5)**: weighted total preview over published portion · per-course grade (only when fully published) · published items + own values only · Lock card surfacing unpublished item count
  - Dashboard student cards now LINK to `/student/courses/[id]`
- **Student top-level — `ผลการเรียน` (Phase 5)** at `/student/terms` (default = active term) + `/student/terms/[termId]` (history):
  - Term GPA headline · 3-state badge `EMPTY | IN_PROGRESS | COMPLETED` (one-way per ADR-0018) · progress bar (publishedItems / totalItems)
  - Transcript table: วิชา · ครู · หน่วยกิต · % · เกรด · GPA footer row
  - TermPicker dropdown (when student has > 1 historical term)
  - **Print PDF** via `window.print()` — A4 stylesheet hides chrome/forms/btns, prints transcript-style with print-only footer "พิมพ์เมื่อ … · เอกสารอ้างอิง: <studentId/termSuffix>"
- **Auto-restore on rejoin** — removed student using the same class code triggers `restoreByRejoin` inside `enrollByClassCode`, audit `COURSE_MEMBER_RESTORED_BY_REJOIN`. Permanent block = deactivate code in Settings (ADR-0013 § 2 kill switch)
- **Session lifecycle (Phase 4)** — lazy materialization via `findOrCreateSession` (race-safe), soft-cancel via `cancelSession` (audit `SESSION_CANCELLED` Critical tier with reason ≥ 5), sparse `AttendanceRecord` with `editCount` + back-edit reason gate (`ATTENDANCE_BACK_EDIT` Important tier when >24h elapsed AND a row changes/creates)
- **ScoreItem lifecycle (Phase 5)** — strict basis-point weight invariant (ADR-0017 § Decision 1, `WEIGHT_SUM_BP = 10000`, no tolerance, no auto-distribute) · publish is a one-way door (ADR-0018, no `unpublishScoreItem` function exists) · post-publish field edits dispatch by class A (cosmetic, free) / B (`fullScore` / `weight`, `reason ≥ 5` + `SCORE_EDIT_AFTER_PUBLISH` audit + Σ revalidation in tx + fullScore-shrink-vs-entries gate) / C (`source`, immutable — `field_immutable_after_publish`) · post-publish delete requires reason + `SCORE_DELETE_AFTER_PUBLISH` Critical-tier audit + explicit ScoreEntry cascade in tx

### Audit event additions

Phase 3 (CLASS_CODE + COURSE_MEMBER families, past-tense — zero migration since no fire site existed for the old verb form):
- `COURSE_MEMBER_JOINED` (replaces `STUDENT_JOINED_COURSE`)
- `COURSE_MEMBER_REMOVED` (new — was reserved as `STUDENT_REMOVED_FROM_COURSE`, never fired)
- `COURSE_MEMBER_RESTORED_BY_REJOIN` (new)
- `CLASS_CODE_REGENERATED` (renamed from `CLASS_CODE_REGENERATE`)
- `CLASS_CODE_DEACTIVATED` / `CLASS_CODE_REACTIVATED` (new)
- `CLASS_CODE_EXPIRY_SET` (new — covers both set and clear via before/after)

Phase 4 (attendance family):
- `SESSION_CANCELLED` (new · Critical tier · with reason ≥ 5)
- `ATTENDANCE_BACK_EDIT` (existing in enum, first fire site this phase · Important tier · with reason ≥ 5 when scheduledStart > 24h ago AND a row changes/creates)

Phase 5 (scoring family, past-tense per Pattern 10 — enum cleaned to drop pre-publish events that we explicitly do NOT log):
- `SCORE_ITEM_PUBLISHED` (new · Important tier · after-payload includes name/weight/fullScore/publishedAt)
- `SCORE_EDIT_AFTER_PUBLISH` (existing in enum, first fire sites this phase · Important tier · with reason ≥ 5) — fires from class-B field edits in `updateScoreItem` AND from value-changing `bulkUpsertScoreEntries` calls on a published ScoreItem (single audit row per batch)
- `SCORE_DELETE_AFTER_PUBLISH` (existing in enum, first fire site this phase · Critical tier · with reason ≥ 5)
- **Removed from enum**: `SCORE_ITEM_CREATE`, `SCORE_ITEM_DELETE`, `SCORE_ITEM_PUBLISH` (verb-form). Renamed `SCORE_ITEM_PUBLISH → SCORE_ITEM_PUBLISHED`. Zero migration — no fire site existed.

**Verbose tier (NOT logged)** — TimetableSlot CRUD (Q11C), normal in-window attendance writes, **pre-publish ScoreItem CUD** (ADR-0018 § Negative consequences — teachers freely build the gradebook in draft state), normal in-window ScoreEntry writes on draft items.

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
COURSE_MEMBER_*, CLASS_CODE_*, and (Phase 4) attendance families established. Past-tense (`SESSION_CANCELLED`, `ATTENDANCE_BACK_EDIT`) not verb form. **Phase 5:** create SCORE_* family — `SCORE_ITEM_PUBLISHED` (replaces `SCORE_ITEM_PUBLISH`), `SCORE_EDIT_AFTER_PUBLISH` (with reason ≥ 5), `SCORE_DELETE_AFTER_PUBLISH`.

#### 11. Time zones — store UTC, render via Intl with Buddhist calendar (Phase 4)
All `DateTime` columns are UTC instants (Postgres `TIMESTAMPTZ`, Prisma `Date`). Conversion to/from "Asia/Bangkok wall-clock" is centralised in `lib/attendance/format.ts`:
- `formatThaiDate(d)` / `formatSessionHeader(start, end)` — `Intl.DateTimeFormat("th-TH-u-ca-buddhist", { timeZone: "Asia/Bangkok", … })` → "วันพุธที่ 3 มิ.ย. 2569 · 13:00–14:00 น."
- `bangkokDateTimeToUtc(dateStr, timeStr)` — converts a `YYYY-MM-DD` + `HH:mm` pair entered in a Bangkok-local form back to a UTC `Date`. Bangkok is fixed +07:00 (no DST), so the math is direct: subtract 7h after building the wall-clock as if UTC.
- `dayOfWeekForDateString` / `todayInBangkok` — server-safe, no manual TZ math.

**Phase 5 implication:** Term GPA + Score Item published timestamps follow the same posture. Don't pass `new Date(localString)` into the lib — always go through the format helper.

#### 12. `useState` lazy initializer to dodge React 19 purity lint (Phase 4)
React 19's `react-hooks/purity` rule flags `Date.now()` inside `useMemo`. For values that are stable for the lifetime of the component (e.g. "is this Session past the 24h back-edit threshold?"), capture once at mount:
```tsx
const [isBackEdit] = useState(
  () => Date.now() - new Date(scheduledStartIso).getTime() > THRESHOLD_MS
);
```
The initializer runs once. **Phase 5+** any client-side time-of-render derived flag (e.g. "is this Score Item published in the future?", "is this Submission past deadline?") uses the same pattern.

#### 13. Mobile/desktop dual-layout via CSS toggle (Phase 4)
Teacher attendance grid renders BOTH a vertical card list (`md:hidden`) and a table (`hidden md:block`) from the same component, swapping by Tailwind breakpoint at CSS layer. Avoids SSR hydration mismatch from JS breakpoint detection. Bundle hit is the duplicate markup, which is small for ≤50-row grids. **Phase 5 scoring grid:** apply same posture — desktop-first table, mobile vertical card per student.

#### 14. Sparse semantics + "active ∪ ever-marked" union (Phase 4 · ADR-0016)
The grid query for a Session is NOT "active members at this moment". It's:
```sql
SELECT enrollment FROM enrollment
  WHERE courseOfferingId = $1
    AND (removedAt IS NULL OR EXISTS(SELECT 1 FROM attendanceRecord WHERE ...))
```
Removed-then-marked rows persist with `opacity-60` + read-only badge. **Phase 5+** any "what rows do I show for this `<event>` of a course?" follows the same union when soft-deletion intersects with student-data writes (ScoreEntry, Submission). The bare `removedAt IS NULL` filter is wrong for historical event views.

### Test commands (post-P3-7 script split)

| Command | Scope | DB needed? | Time |
|---------|-------|------------|------|
| `pnpm test` | `tests/unit/**` (156 cases · 12 files) | no | ~5s |
| `pnpm test:integration` | `tests/integration/**` (116 cases · 11 files) | yes — uses DATABASE_URL via `.env.local` | ~290s |
| `pnpm test:all` | both | yes | ~295s |
| `pnpm exec dotenv -e .env.local -- tsx scripts/smoke-test.ts` | E2E HTTP smoke (88 checks · live dev server required) | yes | ~60s |

**Total verifications post-Phase 5:** 156 unit + 116 integration + 88 smoke = **360**.

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

### Phase 6 — DONE end-to-end (all sub-tasks + 3 grilled ADRs + atomic ScoreItem coupling)

| Task | Status | SHA(s) |
|------|--------|--------|
| Grill ADR-0019 (Assignment ↔ ScoreItem atomic + no default weight) | ✅ | `3bb3b84` |
| Grill ADR-0020 (Submission lifecycle workflow signals vs score-of-record) | ✅ | `2fe6e35` |
| Grill ADR-0021 (file upload pipeline · signed URL strategy hybrid) | ✅ | `49eb1e8` |
| CONTEXT.md Phase 6 glossary updates (§ Admin · § Comment Moderation · § Assignment · § Submission Status · § FileAttachment · § Signed URL) | ✅ | `e5ca04d` |
| P6-1 schema (Assignment + Submission + SubmissionVersion + FileAttachment + Comment models + 4 enums) | ✅ | `e427a08` |
| P6-2a `lib/assignment/*` PURE (constants · status · validation) + 62 unit tests | ✅ | `143fe23` |
| P6-2b `lib/assignment/assignment.ts` (atomic ScoreItem coupling + toggle 3-state dispatch) + audit enum rename + FK SetNull | ✅ | `ca523b8` |
| P6-2c `lib/assignment/submission.ts` (submitVersion + returnSubmission + gradeSubmission) | ✅ | `fb8f493` |
| P6-2d `lib/assignment/comment.ts` (createComment + editComment + selfDeleteComment + moderateDeleteComment Q5 matrix) | ✅ | `61c3d40` |
| P6-3a `lib/storage/*` PURE (keys + jwt) + 55 unit tests | ✅ | `41f90aa` |
| P6-3b R2 client + sign (presigned PUT/GET 300 s) + verify (file-type magic-byte) | ✅ | `0cd3485` |
| P6-3c image pipeline (sharp re-encode + EXIF strip + HEIC/HEIF transcode) | ✅ | `300634f` |
| P6-3d presign + commit orchestration (3-step staging → permanent flow) | ✅ | `fe200c9` |
| P6-4 `can.* + assert.*` (mutateAssignment + submitTo + viewSubmission + moderateComment + uploadToAssignment) + 26 unit tests | ✅ | `4fced10` |
| P6-5a teacher UI: list + create dialog + action | ✅ | `9e9ecf7` |
| P6-5b teacher UI: detail + grade dialog + return dialog + Pattern 14 active∪ever-submitted grid | ✅ | `c85f30d` |
| P6-6 student UI: list + detail + submit form + version history + RETURNED banner | ✅ | `88cf510` |
| P6-7 integration tests (+19 cases · assignment-coupling + submission-flow + L1 boundary) | ✅ | `49c1ef8` |
| P6-8 smoke checks (+10 against live dev · teacher tab + student tab + L1 boundary + auth boundary) | ✅ | `2530479` |
| P6-9 docs (this commit) | ✅ | — |

### What "shipped" means today (post-Phase-6)

- **Teacher course detail — 6 tabs** (ภาพรวม · สมาชิก · เช็คชื่อ · คะแนน · **การบ้าน** · ตั้งค่า):
  - **Assignments (Phase 6)**: list ordered DESC by createdAt · per-row scored-badge + published-ScoreItem badge + submission-closed badge + overdue tinted rose · "+ เพิ่มการบ้าน" Pattern-7 dialog with conditional weight (%) + fullScore inputs when `isScored=true` (per ADR-0019 § 2 no default). Detail page = Pattern-14 active ∪ ever-submitted union (removed students show opacity-60 + badge) + per-row grade dialog (with ADR-0018 reason-after-publish gate that mounts only when needed) + return dialog (comment body = audit reason per ADR-0020 § 4)
- **Student course detail — 5 tabs** (ภาพรวม · เพื่อนร่วมห้อง · เช็คชื่อ · คะแนน · **การบ้าน**):
  - **Assignments (Phase 6)** L1-projected: list joins OWN Submission row only (NOT_SUBMITTED sentinel when no row) · detail surfaces RETURNED banner when teacher returned + own ScoreEntry when linked ScoreItem published + PRIVATE comments thread + own version history (DESC by versionNumber, current version highlighted) + submit form for text + links (file upload deferred per P6-3d note)
- **R2 file pipeline ready**: presign + commit + magic-byte + EXIF-strip + sharp transcode are fully implemented and unit-tested (55 cases). Teacher upload to Assignment brief works through `assert.canUploadTo("ASSIGNMENT", id)`. Student upload to SubmissionVersion follows a small schema patch (SubmissionVersion.fileAttachmentIds + FileOwnerType.SUBMISSION) when the UI surfaces it — documented as a Phase 7 prerequisite in P6-3d commit message.

### Audit event additions (Phase 6 family · past-tense per Pattern 10)

- `SUBMISSION_RETURNED` (new · Important tier · reason = private comment body ≥ 5 chars per ADR-0020 § 4)
- `ASSIGNMENT_UPDATED` (new · Important only when `isScored: true → false` toggle with reason ≥ 5; verbose tier for normal field edits, not logged)
- `COMMENT_MODERATED` (new · Important when Teacher · **Critical when Admin × PRIVATE** per CONTEXT § Comment Moderation Q5 escalation)
- `FILE_UPLOADED` (new · Important · payload omits URL string per CLAUDE.md hard rule — only ids + mime + size)
- `FILE_REJECTED` (new · Important · categories: `magic_byte_mismatch` / `mime_not_whitelisted` / `size_exceeds` / `permission_denied`)
- `FILE_DELETED` (new · Important · owner removal or moderator delete)
- `FILE_INFECTED_BLOCKED` (Critical · enum reserved, no fire site in Phase 6 — AV deferred to Phase 9 hardening sweep)
- **Removed from enum** (replaced renamed or dropped — zero migration, no prior fire sites): `ASSIGNMENT_CREATE` / `ASSIGNMENT_EDIT` / `ASSIGNMENT_DELETE` / `ASSIGNMENT_GRADE` / `ASSIGNMENT_RETURN` / `FILE_UPLOAD`. The verbose-tier per-action events (CREATE / DELETE / GRADED pre-publish / VERSION_CREATED / COMMENT_EDITED / COMMENT_SELF_DELETED) are not in the enum because they are intentionally not logged — same posture Phase 5 used for pre-publish ScoreItem CUD.

### Test commands (post-P6-7 update)

| Command | Scope | DB needed? | Time |
|---------|-------|------------|------|
| `pnpm test` | `tests/unit/**` (299 cases · 16 files) | no | ~6 s |
| `pnpm test:integration` | `tests/integration/**` (135 cases · 13 files) | yes — uses DATABASE_URL via `.env.local` | ~330 s |
| `pnpm test:all` | both | yes | ~336 s |
| `pnpm exec dotenv -e .env.local -- tsx scripts/smoke-test.ts` | E2E HTTP smoke (~98 checks · live dev server required) | yes | ~70 s |

**Total verifications post-Phase 6:** 299 unit + 135 integration + ~98 smoke = **~532**.

### Phase 7 progress — paused at P7-7 (2026-06-05 · `0eb99a5`)

| Sub-task | Status | SHA |
|---|---|---|
| Grill Q1–Q13 + ADR-0022 + ADR-0023 + CONTEXT.md updates | ✅ | `43df25f` · `fa11175` · `7eb65e7` |
| P7-0a schema — SubmissionVersion.fileAttachmentIds + FileOwnerType rename | ✅ | `00de7ae` |
| P7-0b storage routes — /api/storage/{presign,commit} + SUBMISSION dispatch | ✅ | `f419f38` |
| P7-0c student submit-version-form file upload UI | ✅ | `099a116` |
| P7-0d integration + smoke + auth-first reorder | ✅ | `4fc81b4` |
| P7-1 schema — Notification + Material + Announcement + partial unique | ✅ | `9b4912c` |
| P7-2 lib/notification + wire fan-out into 7 existing mutation sites | ✅ | `acfccbd` |
| P7-3 lib/material + lib/announcement + CommentOwnerType plug-in | ✅ | `73a7684` |
| P7-4 notification read routes + lib/feed/aggregator + scope query | ✅ | `b64a786` |
| P7-5 Bell UI navbar + dropdown (lib helpers · bell components · shared TopNav · migrate 6 surfaces) | ✅ | `a2615ed` · `9d82121` · `996532c` |
| P7-6 Dashboard User Feed + Due Soon Widget (student-only) | ✅ | `4ab67af` · `ca23943` |
| P7-7 Teacher Material + Announcement UI (tabs · CRUD · Pattern-7 dialogs) | ✅ | `0eb99a5` |
| P7-8 Student Material + Announcement UI | ⏳ TODO | — |
| P7-9 Integration tests (broader fan-out coverage) | ⏳ TODO | — |
| P7-10 Smoke + HANDOFF close-out | ⏳ TODO | — |

**Verifications post-P7-7:** 384 unit + 148 integration + ~115 smoke (+7) = ~647 checks

**Lib layer essentially done.** All 9 NotificationKinds have wired event sources end-to-end:

| Kind | Source mutation | Fan-out helper |
|---|---|---|
| `SCORE_ITEM_PUBLISHED` | `publishScoreItem` | broadcast |
| `SCORE_ENTRY_EDITED` | `bulkUpsertScoreEntries` (post-publish, value change) | targetedMany |
| `ASSIGNMENT_POSTED` | `createAssignment` | broadcast |
| `MATERIAL_POSTED` | `createMaterial` | broadcast |
| `ANNOUNCEMENT_POSTED` | `createAnnouncement` | broadcast |
| `SUBMISSION_GRADED` | `gradeSubmission` (markGraded=true) | targeted |
| `SUBMISSION_RETURNED` | `returnSubmission` (merges with private comment) | targeted |
| `COMMENT_REPLIED` | `createComment` (PRIVATE → targeted, CLASS_WIDE → thread) | targeted/thread |
| `CLASS_CODE_JOINED` | `enrollByClassCode` | targeted |

Suppress hooks:
- `removeMember` → suppressNotificationsForRemovedMember (in-tx)
- `restoreByRejoin` → unsuppressNotificationsOnRestore (in-tx)
- `deleteScoreItem` / `softDeleteMaterial` / `softDeleteAnnouncement` → suppressNotificationsForDeletedEntity (in-tx)

Read surface:
- `lib/notification.listNotificationsForRecipient(cursor)` — bell dropdown query
- `lib/notification.countUnreadNotifications` — badge count
- `lib/notification.markNotificationRead` — click row
- `lib/notification.markAllNotificationsRead` — "ทำเครื่องหมายว่าอ่านทั้งหมด"
- `lib/feed.getUserFeed(session, cursor?)` — dashboard User Feed
- `lib/feed.getCourseScopeForUser(session)` — single L1 boundary, reused by widget

API routes (auth-first posture):
- `POST /api/notification/[id]/read`
- `POST /api/notification/read-all`
- `POST /api/storage/presign` (P7-0b)
- `POST /api/storage/commit` (P7-0b)

**P7-5 — what shipped (2026-06-04 · `996532c`)**

Bell + shared TopNav are live across every role-facing surface. 15-question
grill locked the design tree before code (Q1 surface = shared TopNav · Q2
admin = no bell · Q3 = server-render eager · Q4 = HTML popover (not Pattern
7 dialog) · Q5 = server-resolved href, fallback to course root for
MATERIAL/ANNOUNCEMENT/SUBMISSION_*/COMMENT_REPLIED · Q6 = Server Action +
redirect · Q7 = time DESC + opacity-60 read + black dot unread · Q8 =
hybrid 7d relative/absolute · Q9 = per-kind lucide icons + Thai preview ·
Q10 = illustrated empty + top-right mark-all conditional · Q11 = cap 20
no load-more · Q12 = replace headers · Q13 = file structure middle-ground
· Q14 = no audit · Q15 = stack TopNav above CourseShell's course bar).

**New files (`a2615ed`):** `lib/notification/{navigation,preview,time-format}.ts`
pure helpers; their 42 unit tests (330 → 372).

**New files (`9d82121`):** `components/notification/{bell,bell-icon,relative-time,actions}.tsx`.
Bell is a Server Component fetching count + 20-row list via P7-4 read
surface, builds per-row href + preview server-side, renders an HTML
`popover` panel (browser-native open/close — no JS state). Per-row form
posts to `markReadAndNavigate` server action that marks read + redirects.

**New files / migrations (`996532c`):** `components/layout/top-nav.tsx`
shared Server Component (logo + bell + sign-out, `showBell` prop for
admin = false, `showRoleBadge` prop for admin layout). Replaces inline
headers on `app/admin/layout.tsx`, `app/dashboard/page.tsx`,
`app/teacher/courses/page.tsx`, `app/teacher/courses/new/page.tsx`,
`components/scoring/student-terms-shell.tsx`, and stacks above
CourseShell's existing course-context bar (Q15). 13 CourseShell call
sites updated to pass `session` (uses `guard.session` where applicable).

**Drive-by:** P7-4 had a typecheck-only drift in
`tests/integration/permissions/feed-aggregator.test.ts` `mkSession`
helper (missing `mustResetPwd`); fixed forward in commit `a2615ed`.

**Known follow-ups for P7-6+:**
- Enrich `SubmissionGradedPayload` / `SubmissionReturnedPayload` /
  `CommentRepliedPayload` with `assignmentId` / `entityOwnerId` at fan-out
  time so the bell can deep-link to the assignment detail page (today
  these fall back to the course's assignments list).
- After P7-7 / P7-8 land Material + Announcement UI, the navigation
  resolver's `MATERIAL_POSTED` / `ANNOUNCEMENT_POSTED` cases can switch
  from course-root fallback to the entity detail URL.
- Phase 5/6 teacher login + Phase 7 storage student login in
  `scripts/smoke-test.ts` still cascade-fail on rate-limit lockout from
  earlier sections. The new bell section preempts this with a
  `db.rateLimitBucket.deleteMany({where:{id:{startsWith:"login:"}}})`
  at its top; the same pattern would unbreak the other sections.

**P7-6 — what shipped (2026-06-05 · `ca23943`)**

Student dashboard now surfaces two state-derived sections above the
existing "ห้องเรียนของฉัน" grid (3-question mini-grill before code:
Q1 = A cap 20 no load-more · Q2 = A vertical stack Due Soon top · Q3 =
B student-only feed).

- **Due Soon Widget** — amber-tinted card listing Assignments due
  within 24 h whose own Submission status is NOT_SUBMITTED or DRAFT,
  sorted dueAt ASC, max 5. Hides itself when empty (an empty "ใกล้ส่ง"
  card next to a populated feed is more confusing than no card).
- **User Feed** — illustrated empty state or up to 20 rows merged
  across Assignment / Material / Announcement / ScoreItem(published)
  via the P7-4 aggregator. Reuses the bell's `NotificationIcon` +
  `RelativeTime` so both surfaces share one icon map + one Pattern-12
  time helper. Per-row href + preview resolved server-side via
  `lib/feed/{navigation,preview}`.

Teacher dashboard intentionally has neither (creator role; bell
already covers CLASS_CODE_JOINED + COMMENT_REPLIED). Admin dashboard
unchanged (no NotificationKind targets ADMIN).

**New files (`4ab67af`):** `lib/feed/{navigation,preview}.ts` pure
helpers + `lib/assignment/due-soon.ts` DB query. 12 new unit tests
(372 → 384). Due-Soon DB query covered by smoke + P7-9 integration.

**New files / changes (`ca23943`):**
`components/feed/{due-soon-widget,user-feed}.tsx` Server Components
+ `app/dashboard/page.tsx` integration + 5 smoke checks.

**Known follow-ups for P7-7+:**
- `nextCursor` from `getUserFeed` is unused — future `/feed` full-page
  route can pick it up if 20 isn't enough.
- After P7-7 / P7-8 land Material + Announcement UI, the feed's
  navigation resolver's `MATERIAL` / `ANNOUNCEMENT` cases switch from
  course-root fallback to entity detail URL.
- The "อยู่ระหว่างพัฒนา" footer card on dashboard still says "Phase
  ปัจจุบัน: 5" — cosmetic; will update wholesale at P7-10 close-out.

**P7-7 — what shipped (2026-06-05 · `0eb99a5`)**

Teacher course detail gains 2 new tabs ("เอกสาร" + "ประกาศ") between
"การบ้าน" and "ตั้งค่า" — 8 tabs total. 3-question mini-grill locked
design before code:
- Q1 = A: separate tabs per content-type (canonical per CONTEXT)
- Q2 = A: list page + click-through to detail (matches Assignment shape)
- Q3 = B: comments thread DEFERRED to P7-8 so it ships alongside the
  student view + integration test in one cohesive landing

**Material UI** (`/teacher/courses/[id]/materials/...`)
- List page · Pattern-7 create dialog (title + body + linkUrls)
- Detail page · edit/delete affordances · markdown-ish body render
- `MATERIAL_DELETED` Important audit on soft-delete (lib cascade-
  suppresses `MATERIAL_POSTED` notifications)
- title REQUIRED, body OPTIONAL

**Announcement UI** (`/teacher/courses/[id]/announcements/...`)
- Mirrors Material shape with title flip: title OPTIONAL, body
  REQUIRED. List page falls back to body excerpt as headline when
  title is null; detail page renders "ประกาศไม่มีหัวข้อ" placeholder.
- `ANNOUNCEMENT_DELETED` Important audit on soft-delete

**Smoke (+7 checks):** materials list 200 + heading + create btn ·
announcements list 200 + create btn · 8-tab nav contains เอกสาร +
ประกาศ · L1 boundary (student → /teacher/.../materials → 302/307).

**Known follow-ups for P7-8:**
- Class-wide comments thread on Material/Announcement detail pages
  (teacher composer + student view + L1 thread fan-out via
  `COMMENT_REPLIED`)
- Student view of Material/Announcement at `/student/courses/[id]/
  materials` + `/student/courses/[id]/announcements` (after which the
  bell + feed `MATERIAL_POSTED` / `ANNOUNCEMENT_POSTED` navigation can
  switch from course-root fallback to entity detail URL)
- "อยู่ระหว่างพัฒนา" footer card on dashboard still says "Phase
  ปัจจุบัน: 5" — cosmetic; wholesale update at P7-10 close-out

**Next session resume point — P7-8:** Student Material + Announcement
views + class-wide comments thread on all four content types
(Assignment + Material + Announcement + Submission), with the
teacher composer landing in the same commit set.

Phase 6 carryover (now historical):



Schema to add:
- `Notification` (recipientId, kind enum, payloadJson, readAt?, createdAt)
- `Material` + `Announcement` (Phase 7a — teacher-posted content; reserved slots in FileOwnerType + CommentOwnerType enums are ready)

Phase 7 prerequisites carried over from Phase 6 (documented in P6-3d commit message and Task.md § Deferred):
- Add `SubmissionVersion.fileAttachmentIds Json @default("[]")` column
- Add `FileOwnerType.SUBMISSION` enum value (so files can attach to a Submission parent scope rather than a specific Version that doesn't yet exist at upload time)
- Remove the `files_not_yet_supported` guard from `lib/assignment.submitVersion`
- Wire `lib/storage.presignUpload` + `lib/storage.commitUpload` into a new `/api/storage/presign` + `/api/storage/commit` route pair
- Update student `submit-version-form.tsx` to accept files via a presign + PUT + commit handshake before submitVersion

Phase 7 recommended sub-task breakdown:
- P7-1 schema (Notification + Material + Announcement) + the Phase-6-deferred SubmissionVersion.fileAttachmentIds column + FileOwnerType.SUBMISSION
- P7-2 `lib/notification/*` PURE + DB-touching (event dispatch + delivery in-app)
- P7-3 `lib/material/*` + `lib/announcement/*` (mirror lib/assignment shape)
- P7-4 `/api/storage/presign` + `/api/storage/commit` route handlers + integration with lib/auth.canUploadTo for ASSIGNMENT + SUBMISSION dispatch
- P7-5 `lib/feed/aggregator.ts` (CONTEXT § Feed Activity Types — query union over Assignment / Material / Announcement / Score Published / Comments)
- P7-6 Notification bell UI (navbar component + badge count + recent list)
- P7-7 Material + Announcement UI (teacher post + student read)
- P7-8 Student file upload UI (drag-and-drop + progress + presign/commit handshake; replaces the "files_not_yet_supported" branch in submitVersion)
- P7-9 Integration tests (notification fan-out + feed aggregator L1 + file upload happy path)
- P7-10 Smoke checks + docs close-out

Patterns to inherit verbatim (Patterns 1-14 unchanged from Phase 5; Phase 6 reaffirmed each):
- Pattern 1: pure `can.*` + DB-touching `assert.*` returning `{session, row}` divergent shape
- Pattern 2: authz inside `$transaction` for every mutation
- Pattern 3: `TX_OPTS` on every transaction
- Pattern 4: DB-layer projection for L1 visibility (Phase 7 student feed query)
- Pattern 5: extend `_tabs.ts` per role (insert "ฟีด" if a per-course feed tab lands; otherwise notifications live in navbar)
- Pattern 6: hidden form fields, no `.bind()`
- Pattern 7: native `<dialog>` with explicit centering + deferred close (Phase 7 Material / Announcement create dialogs)
- Pattern 8: `"use server"` async exports only
- Pattern 9: avoid `setState`-in-effect
- Pattern 10: past-tense audit family — `NOTIFICATION_DELIVERED` (Verbose, not logged), `MATERIAL_CREATED` / `ANNOUNCEMENT_CREATED` (Verbose), `FEED_VIEWED` (Verbose if logged at all)
- Pattern 11: store UTC, render Buddhist + Asia/Bangkok via Intl
- Pattern 12: `useState` lazy initializer for "is this notification read?" / "is feed item older than 24h?" client-side flags
- Pattern 13: dual-layout (mobile cards + desktop table) for feed list — Phase 7 may relax to single-layout if feed is mobile-first
- Pattern 14: active ∪ ever-engaged enrollment union (e.g. ever-commented-on-this-feed-item) for any historical feed view

Critical files that Phase 7 will add:
- `lib/notification/*` — Verbose tier; CLAUDE.md gotcha — do not log signed URL or session token in payloadJson
- `lib/feed/aggregator.ts` — Phase 4 § Q11C posture: query union not denormalised; L1 boundary at the Prisma SELECT layer
- `lib/material/*` + `lib/announcement/*` — mirror lib/assignment shape but no scored coupling

**Phase 6 — Assignment + Submission + Comments + R2 file upload** (Task.md § Phase 6)

Schema to add:
- `Assignment` (per CourseOffering — title, description, dueAt?, allow_text/file/link, attachments, is_scored, score_item_id?, submission_closed)
- `Submission` (Enrollment × Assignment — unique)
- `SubmissionVersion` (version_number, text_content?, attachments[], links[], submitted_at, is_late, is_current)
- `SubmissionStatus` enum: NOT_SUBMITTED · DRAFT · SUBMITTED · LATE_SUBMITTED · RETURNED · GRADED
- `FileAttachment` (polymorphic — `owner_type` enum ASSIGNMENT/MATERIAL/ANNOUNCEMENT/SUBMISSION/COMMENT, `owner_id`, r2_key, mime, size)
- `Comment` (polymorphic scope — CLASS_WIDE on Assignment/Material/Announcement, PRIVATE on Submission)

ScoreItem ↔ Assignment coupling (CLAUDE.md hard rule):
- If `Assignment.is_scored = true` → atomically create a `ScoreItem` with `source = ASSIGNMENT_LINKED` and link FK
- `source = ASSIGNMENT_LINKED` is the class-C immutable case per ADR-0018 — to "delete the link", delete the ScoreItem (Critical audit) which cascades the unlink
- Deleting an Assignment that owns a published ScoreItem → block (Phase 6 entry must add `assert.canDeleteAssignmentNotPublishedScoreItem` or similar)

Library to add (mirror `lib/scoring/*` layout):
- `lib/assignment/*` — constants, validation, assignment.ts (create/update/delete + ScoreItem coupling), submission.ts (submit/return/grade), comment.ts
- `lib/storage/*` — R2 client, signed-URL gen post permission-check, presigned PUT for client→R2 direct upload, MIME magic-byte verify, EXIF strip

Permissions:
- `can.mutateAssignment(session, course)` + `assert.canMutateAssignment(assignmentId)` → `{session, assignment: {courseOfferingId, scoreItemId?, …}}`
- `can.submitTo(session, assignment, enrollment)` + `assert.canSubmitTo(submissionId)` for resubmit flows
- `can.viewSubmission(session, submission)` — student sees own; teacher sees all for owned course; admin moderation TBD

UI to add:
- Teacher: **การบ้าน** tab on course shell (between คะแนน + ตั้งค่า) — list + create dialog + per-assignment grid (submissions × status) + grade flow (writes to linked ScoreItem)
- Student: **การบ้าน** tab — list of assignments + submit form (text + file upload + link) + version history + status badges
- Comment composer (class-wide vs private) on Assignment/Submission detail pages

Patterns to inherit verbatim (Patterns 1-14 above):
- Pattern 1: `assert.canMutateAssignment(id)` returning `{session, assignment}` divergent shape
- Pattern 2: authz inside `$transaction` for every mutation; ScoreItem-coupling atomic with Assignment in the same tx
- Pattern 3: `TX_OPTS` on every transaction
- Pattern 4: DB-layer projection for L1 — students see ONLY their own Submission, never peer rows
- Pattern 5: extend teacher `_tabs.ts` (insert "การบ้าน" between "คะแนน" and "ตั้งค่า")
- Pattern 6: hidden form fields for context IDs; no `.bind()` on Server Actions
- Pattern 7: native `<dialog>` with explicit centering + deferred close (Pattern 7 from Phase 4 is the canonical form)
- Pattern 8: `"use server"` async exports only
- Pattern 9: avoid `setState`-in-effect (uncontrolled inputs or row remount via revalidate)
- Pattern 10: past-tense audit family — `ASSIGNMENT_CREATED`, `ASSIGNMENT_GRADED`, `SUBMISSION_RETURNED`, `COMMENT_MODERATED`, `FILE_UPLOAD`, `FILE_INFECTED_BLOCKED`
- Pattern 11: store UTC, render Buddhist + Asia/Bangkok via Intl (dueAt formatter)
- Pattern 12: `useState` lazy initializer for "is past deadline?" / "is current version?" flags
- Pattern 13: dual-layout grid (mobile cards + desktop table) for the submission grid
- Pattern 14: active ∪ ever-submitted enrollment union for the submission grid

**Recommended P6 sub-task breakdown** (mirrors P5 structure — 9 sub-tasks):
- P6-1 schema migration (Assignment · Submission · SubmissionVersion · SubmissionStatus enum · FileAttachment polymorphic · Comment polymorphic) + ADRs for the coupling decisions surfaced in grill
- P6-2 `lib/assignment/*` — constants, validation, assignment.ts (CRUD + ScoreItem coupling + Phase 5 invariants), submission.ts (submit/resubmit/return/grade), comment.ts
- P6-3 `lib/storage/*` — R2 client setup, signed URL helpers, presigned PUT, MIME magic-byte verification, EXIF strip
- P6-4 `can.mutateAssignment` + `assert.*` + permissions test cases (Pattern 1, mirror Phase 5 P5-3)
- P6-5 teacher Assignment tab + create dialog + submission grid + grade flow + comment composer
- P6-6 student Assignment tab + submit form (text + file via presigned PUT) + version history view + comment composer (private)
- P6-7 integration tests (Assignment-ScoreItem coupling · Submission grading flow · L1 projection · R2 mock or test-bucket)
- P6-8 smoke checks (~10 new): teacher Assignment tab · student submit flow · L1 boundary · file upload
- P6-9 docs close-out (HANDOFF + Task.md + ADR files)

**Grill before code** — Phase 6 has non-obvious branches that should be locked first via `/grill-with-docs`:

1. **Assignment ↔ ScoreItem atomicity** — `is_scored=true` creates a linked ScoreItem in the same tx; what if create succeeds and link fails? Use Pattern 2 transaction with cascade rollback. What weight does the auto-created ScoreItem get? Teacher must set it before publish — block publish until weight is set?
2. **Resubmission semantics** — `RETURNED` → student resubmits → new `SubmissionVersion` row with `is_current=true`; old row stays for audit. What if teacher already graded before returning? Score Entry stays at old value or resets to null?
3. **Late submission scoring** — `LATE_SUBMITTED` after deadline — does the linked Score Entry still accept the grade? Default behavior + opt-out toggle?
4. **File upload security** — `magic-byte verification on server vs client-side validation only`; SVG with embedded script — block entirely or sanitize? Max file size + chunk threshold?
5. **Comment moderation lifecycle** — teacher can `COMMENT_MODERATED` (delete + audit) any class-wide comment; can admin moderate teacher comments? Per Comment.scope (CLASS_WIDE vs PRIVATE)?
6. **R2 signed URL TTL** — 5 minutes per CLAUDE.md hard rules; verify against R2 ergonomics for large downloads. Re-issue on each page render or cache for 5min?

Recommend grilling Q1 + Q2 + Q4 first (highest blast radius). Q3 + Q5 + Q6 can be locked inline during P6-2 / P6-3 implementation.

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
| **4** | Attendance (TimetableSlot · Session lazy materialization · sparse AttendanceRecord · back-edit audit) | ✅ DONE (P4-1..9 all complete · 91 unit + 71 integration + 72 smoke pass) |
| **5** | Scoring + Term GPA + Print transcript (ADR-0017 + ADR-0018) | ✅ DONE (P5-1..9 all complete · 156 unit + 116 integration + 88 smoke pass · ScoreItemTemplate deferred) |
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
| 0013 | Enrollment Soft-Delete + Auto-Restore by Rejoin | `0013-enrollment-soft-delete-and-rejoin-restore.md` |
| 0014 | Theme pivot: Calm Ledger supersedes Ink + Gold | `0014-theme-calm-ledger-supersedes-ink-gold.md` |
| 0015 | Lazy Session Materialization (no cron, no eager batch) | `0015-lazy-session-materialization.md` |
| 0016 | Sparse AttendanceRecord + Enrollment FK + Grid Membership Rule | `0016-sparse-attendance-and-enrollment-fk.md` |

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
> ตอนนี้ Phase 0-5 เสร็จแล้ว (156 unit + 116 integration + 88 smoke = 360 verifications passing)
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
