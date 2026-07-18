# Testing.md

> Source of truth for Beagle Classroom test safety and release QA.
> Updated: 2026-07-19.

## 1. Safety first

Development and production currently use the same Neon database. Therefore:

- `pnpm test` is safe: unit tests must not mutate the database.
- `pnpm qa:safe` is safe: it sends read-only/anonymous HTTP requests only.
- `pnpm test:integration`, `pnpm test:all`, and `pnpm test:e2e` are mutating suites.
- Mutating suites require `QA_DATABASE_URL` to be a separate PostgreSQL database
  or Neon branch. It must never identify the same branch as `DATABASE_URL`.
- The guarded runner replaces `DATABASE_URL` only in its child process and sets
  an internal gate. Integration fixtures and Playwright config assert that gate.
- If the QA database is absent, identical to primary, or the runner is bypassed,
  the suite must stop before creating or deleting data.
- Never use `prisma db push`, a backfill, a reset, or seed against the shared
  development/production database as part of QA.

Example local configuration (values omitted):

```dotenv
DATABASE_URL="postgresql://...production-or-current-shared-branch..."
QA_DATABASE_URL="postgresql://...separate-qa-branch..."
```

Provisioning, secret handling, backup/restore rehearsal, evidence, and the exit
gate are defined in `docs/DATA-SAFETY-RUNBOOK.md`. Mutating QA is not approved
merely because a URL has been added; the restore drill must pass first.

## 2. Test layers

| Layer | Command | Data policy | Current role |
| --- | --- | --- | --- |
| Static | `pnpm lint`, `pnpm typecheck` | No DB writes | CI gate |
| Unit | `pnpm test` | No DB writes | CI gate |
| Build | `pnpm build` | Build-time only | CI gate |
| Safe HTTP smoke | `pnpm qa:safe` | Anonymous GET/read only | Local release check |
| Integration | `pnpm test:integration` | Separate QA DB required | Permission/domain verification |
| All Vitest | `pnpm test:all` | Separate QA DB required | Unit + integration sweep |
| E2E | `pnpm test:e2e` | Separate QA DB required | Browser workflow verification |
| Legacy HTTP smoke | `pnpm test:smoke` | Separate QA DB + QA server required | Historical broad regression suite |

Current GitHub Actions runs lint, typecheck, unit tests, and build. Integration
and E2E are not CI gates until CI receives an isolated, disposable QA database.

## 3. Unit tests

Unit tests cover pure helpers and route/source contracts without live DB writes.
High-risk contracts include:

- Authentication, roles, ownership, and display identity.
- Theme parsing/application for System, Dark, Cream, and legacy Light data.
- Sum-based scoring using `ScoreItem.fullScore`; no weighted-score channel exists.
- Course score, course grade, and secondary Term GPA calculations.
- Attendance totals and status projections.
- CSV escaping, UTF-8 BOM, formula-injection protection, and export permissions.
- Private attachment validation and signed/authenticated file delivery contracts.
- Notification rendering/navigation and audit severity.
- Database safety gate behavior itself.

Run:

```bash
pnpm test
```

## 4. Integration tests

The existing suites live in `tests/integration/permissions/`. They create and
delete users, classes, courses, enrollment, assignments, submissions, score
items, attendance, notifications, and related records. They are not safe on the
shared database.

Run only after configuring a separate `QA_DATABASE_URL`:

```bash
pnpm test:integration
```

Important coverage currently present:

- Assignment/submission lifecycle and file-upload permissions.
- Score item lifecycle, score entry, course score, grade, and GPA projections.
- Attendance/session/timetable permissions and marking.
- Class code mutation, enrollment removal, and restoration.
- Members, Feed aggregation, notifications, comments, and suppression.
- Teacher/Student/Admin role boundaries.

The helper `tests/helpers/database-safety.ts` is part of the release gate. Do
not remove its assertion from integration fixtures to make tests easier to run.

## 5. Browser E2E

Current Playwright specs are:

- `tests/e2e/01-announcement-feed.spec.ts`
- `tests/e2e/02-material-bell.spec.ts`
- `tests/e2e/03-moderation-report.spec.ts`
- `tests/e2e/04-class-code-invite.spec.ts`
- `tests/e2e/05-quiz-builder.spec.ts`
- `tests/e2e/06-quiz-student-attempt.spec.ts`
- `tests/e2e/07-quiz-teacher-results.spec.ts`
- `tests/e2e/08-timetable.spec.ts`

They mutate course content and rate-limit state, so they require the isolated
QA database:

```bash
pnpm test:e2e
```

Playwright starts its own server on port `3100` with the guarded QA environment
and never reuses the normal port `3000` server. This prevents a browser suite
from accidentally driving a development server that still points at primary.

The historical `scripts/smoke-test.ts` is also mutating. It is now guarded and
hard-bound to port `3100`. Run `pnpm dev:qa` in one terminal, then
`pnpm test:smoke` in another. Both commands fail closed without a separate QA
database. Do not run that TypeScript file directly.

Timetable acceptance now covers Teacher create/edit/delete, Student read-only
projection, persisted time/location, Dark and Cream themes, and iPhone
`390x844` overflow. It runs only through the guarded isolated-Neon runner and
does not mutate Production.

This is not yet a complete critical-path browser suite. A2 must add or manually
verify the remaining paths before it can be called closed:

1. Sign in and role landing for Student, Teacher, and Admin.
2. Teacher creates a course; Student joins with code/QR/invite.
3. Teacher posts Announcement, Material, and Assignment.
4. Student opens private files/links and submits, edits, or cancels work.
5. Teacher finds grading backlog, previews every attachment, grades, returns,
   and advances to the next Student.
6. Teacher publishes scores; Student sees only their own result.
7. Teacher opens a session and marks attendance; Student sees only their own.
8. Notification open marks read and navigates to the correct entity.
9. Profile/avatar/theme behavior works in System, Dark, and Cream.
10. Admin observes teaching data read-only and cannot mutate it.

## 6. Safe HTTP smoke

With the app running locally:

```bash
pnpm qa:safe
```

Use `QA_BASE_URL` to target another deployment. The script checks public pages,
protected-route redirects, and unauthenticated export denial without logging in
or modifying state.

## 7. Manual release checklist

- Desktop and iPhone-size layouts: no overlap, clipped text, blank return state,
  or inaccessible primary action.
- Light/System, Dark, and Cream: readable text, borders, statuses, hover/focus.
- Keyboard focus, Escape, dialog focus trap, and reduced-motion behavior.
- Student isolation: cannot see another Student's submission, score, attendance,
  private comment, or private file.
- Teacher ownership: cannot mutate or export another Teacher's course.
- Admin observer: read-only teaching surfaces; unavailable actions are hidden.
- Private R2: no public object URL; authorization is rechecked on every preview.
- Production upload smoke: presign, upload, commit, preview, download, multiple
  image navigation, PDF-to-image navigation, and refresh persistence.
- CSV: Thai opens correctly, formulas are neutralized, and audit event exists.
- Audit: important mutations and exports include actor, target, and timestamp.

## 8. A2 completion rule

A2 Critical-path QA closes only when:

- static, unit, and build gates pass;
- safe HTTP smoke passes;
- mutating integration and E2E suites pass on an isolated QA database;
- the manual role/privacy/mobile/theme/private-R2 checklist is recorded;
- every failure has either a fix and regression test or a documented deferred
  issue with owner and risk.

Until a separate QA database is provisioned, report A2 as **in progress**, not
complete. The safety gate is a prerequisite, not a substitute for the suites.
