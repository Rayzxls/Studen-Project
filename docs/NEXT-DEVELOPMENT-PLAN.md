# Next Development Plan

**Updated:** 2026-07-24
**Sequence:** Core completion -> Lesson Workspace -> Quiz -> Identity/Integrations -> AI -> Optional product modules
**Current state:** A0 Documentation Alignment, A1 Report/Export v1, A2 Critical-path QA, and A3/A3.1 static correctness work are complete. Automated invite coverage plus a physical-phone Production QR scan passed, and authenticated Production private-R2 upload/preview/download passed after the explicit attachment-disposition fix. A4 Account Lifecycle and the operational Moderation Center have additive persistence, audited transactions, and feature-flagged Admin surfaces. Lesson Workspace B1-B6 are implemented and accepted on isolated Neon QA. Quiz C1-C5c are implemented; the additive Quiz migrations are current in Production and the exact ENG 4/3 CourseOffering pilot has read/mutations enabled. The first expansion review kept that exact allowlist because the Production pilot has no Quiz record yet for full role/lifecycle/private-file acceptance; other and future CourseOfferings remain fail-closed.

## Why this order

The current core already covers authentication, CourseOffering, attendance, scoring, assignments, submissions, review, Feed, notifications, profile/theme, dashboards, file handling, audit, and Admin Observer View at different levels of completeness. The next release should first prove which flows are complete, which are partial, and which are intentionally out of scope.

Lesson Workspace must precede Quiz because a future Quiz should belong to a Lesson Workspace and create or connect to Score Items through the same scoring contract as Assignments. Building Quiz first would force the content model and navigation to be changed twice. AI comes last because it should assist stable workflows rather than define them.

## Scope confidence matrix

This matrix prevents an implemented screen or database field from being mistaken for a complete product workflow.

| Area | Current evidence | Planning status |
| --- | --- | --- |
| Role dashboards | Operational dashboards exist for Admin, Teacher, and Student | Partial: advanced trends, usage statistics, and report export need a separate scope decision |
| Report and export | Student Learning Results has browser Print to PDF; Teacher score and attendance summaries have course-level CSV; Admin Audit has filtered CSV | V1 shipped: full report-card PDF generation is explicitly deferred pending a separate layout, identity, signature, and authorization decision |
| Admin user management | Legacy create/import Teacher, list users, reset password, reset avatar, and user drill-down exist | Target identity supersedes account/password creation: Add Teacher creates single-use email-bound Invites only; another User's password is never visible or reset by Admin |
| QR and invite link | Class Code, `qrcode.react`, `ClassCodeCard`, join route, automated lifecycle/mobile coverage, and physical-phone Production scan exist | Accepted: invite copy, expiry, deactivate, regenerate, mobile, rejoin, and Production camera-to-prefilled-code flow passed QA |
| Moderation | Existing Teacher comment moderation plus a case-based Admin queue for reports, evidence snapshots, temporary restrictions, decisions, restore, and one-time appeal | Code/schema deployed behind `MODERATION_CENTER_ENABLED`; flag cutover and manual all-theme/mobile/private-R2 acceptance remain open |
| Profile personal information | Avatar, legacy display-name behavior, real identity, password, and theme exist | Target profile is intentionally minimal: editable re-authenticated Real Name, user-uploaded Avatar, owner/Admin-only verified email, optional fallback password, and theme; no separate Display Name |
| Quiz / Testing | Approved contract, four ADRs, additive schema, Teacher Builder, Student Attempt/autosave/auto-grading, Teacher Results/lifecycle/publication, private attachments, Moderation evidence, Teacher CSV analytics, and an aggregate-only Admin observer | Production schema and exact ENG 4/3 pilot are enabled; authenticated Teacher list-route smoke passes, but the empty pilot has not exercised the full role/lifecycle/private-file workflow, so expansion is deferred and non-allowlisted CourseOfferings stay fail-closed |
| AI Assistant | No model-provider integration found | Not implemented; planned only after stable Lesson/Quiz contracts |
| Google Login | NextAuth currently uses Credentials only | Not implemented; identity-linking rules must be designed first |
| Chat Room, Reward, Meeting | No domain model or route found | Candidate backlog; not committed to the current release plan |
| External integrations | CSV import/export and private R2 storage are the current integrations | Partial; each new integration needs its own ownership, privacy, and failure policy |
| Subscription / global multi-tenant | Current product is single-tenant school | Separate product strategy, not an unfinished CRUD item in this project |

## Non-negotiable guardrails

- Development and production currently share one Neon database. No `db push`, backfill, or data repair without an explicit approval, backup, dry-run report, and rollback plan.
- Database rollout is additive first. Do not remove or rename existing columns during the initial Lesson Workspace release.
- Files remain private and are served through authenticated or signed URLs. Never introduce a public file URL.
- Admin is a read-only observer of teaching data and must not mutate Lessons, scores, attendance, assignments, or submissions.
- Existing Assignment, Material, Announcement, Submission, ScoreEntry, Comment, FileAttachment, notification, and audit identifiers must be preserved.
- Every large release uses a feature flag and keeps the previous route usable until parity QA passes.
- The prototype routes are design references only and must return 404 in production until the real feature is approved.

## Release A: Core completion and truth alignment

### A0. Documentation alignment

**Status:** Completed 2026-07-14 (documentation-only; no code, schema, or data mutation)

**Goal:** make documentation describe the system that actually exists before adding another domain layer.

- Reconcile scoring language with the current sum-based model: `sum(score) / sum(fullScore)` and no separate weight channel.
- Record Admin as read-only observer, including actions Admin must never perform.
- Align Profile, avatar, System/Light/Dark/Cream themes, Dashboard behavior, mobile FAB, Feed, notifications, and private file delivery with the current code.
- Reconcile Proposal statements about GPA, PDF, reporting, and exports with the current product language.
- Replace every remaining active weighted-score statement with the current `fullScore`-based sum model. Historical references may remain only when labeled superseded. `ScoreItem` has no separate weight channel.
- Treat course score and course grade as the primary Student result. **Superseded by D0 on 2026-07-24:** Term GPA and cross-course GPA are removed entirely rather than retained as secondary report values.
- Mark old HANDOFF and Task sections as historical when they conflict with the latest ledger.

**Exit gate:** CONTEXT, ADRs, Proposal, deployment notes, and HANDOFF do not contradict the current code or one another.

**Completion record:**

- `README.md` now describes the deployed core, sum-based scoring, Calm Ledger v2, current roles, private files, and the active roadmap.
- `CLAUDE.md` now reflects one-way score publication, `fullScore` scoring, current theme/motion rules, and private R2 delivery.
- `CONTEXT.md` active domain language now uses Score Total rather than Weighted Total; historical/superseded references remain explicitly labeled.
- `docs/PROPOSAL.md` now treats course score/grade as primary, Term GPA as a secondary report value, and distinguishes implemented foundations from completeness claims.
- `docs/DEPLOY.md` now records the shared Neon risk, four real R2 variables, private file delivery, and the local-storage/R2 mismatch.
- `Task.md` is explicitly a historical ledger; `HANDOFF.md` and this roadmap carry current status.

### A1. Report and export decision

**Status:** Completed 2026-07-14 (code, permission tests, and documentation; no schema or data mutation)

**Current truth discovered:** Student Learning Results already supports browser Print to PDF, and Admin Audit supports filtered CSV export. Teacher course-level score and attendance exports are not yet a complete report surface.

**Recommended v1 contract:**

- Keep browser Print to PDF for the Student Learning Results report and verify print layout in all themes.
- Add Teacher exports for score summary and attendance summary as CSV before building server-generated PDFs.
- Keep Audit CSV as the compliance export.
- Do not promise a full report-card PDF generator until its layout, signatures, school identity, and authorization rules are separately approved.
- Update the Proposal to say exactly which reports are printable and which are downloadable CSV files.

**Exit gate:** every report named in the Proposal has a working route and permission test, or is explicitly moved to a later release in the Proposal.

**Completion record:**

- Teacher score summary CSV is available from the course Scores page and includes every Score Item, publication state, published total, percentage, and course grade.
- Teacher attendance summary CSV is available from the course Attendance page and includes present, late, excused, absent, unmarked, marked sessions, total sessions, and attendance percentage per Student.
- Both export routes require ownership of the CourseOffering at the route and query boundary. Admin remains a read-only observer and cannot export as a Teacher.
- CSV output uses UTF-8 BOM, RFC 4180 quoting, formula-injection neutralization, private/no-store response headers, and a stable ASCII filename.
- Every Teacher report export writes the existing `CLASS_ANALYTICS_EXPORTED` Important-tier audit event with report type and row count.
- Student Learning Results remains browser Print/PDF; Admin Audit remains filtered CSV. A server-generated report-card PDF is deferred to a later release and is not promised by the current Proposal.
- Unit coverage verifies CSV construction, score/attendance semantics, route ownership rejection, successful downloads, and audit writes.

### A2. Critical-path QA gate

**Goal:** prove the existing core before changing its content hierarchy.

**Status (2026-07-22): Automated gate passed; two manual release checks remain open.**
The isolated Neon QA branch, fail-closed runners, dedicated Playwright server,
and disposable-child restore rehearsal are complete. Mutating tests are now
authorized only against `QA_DATABASE_URL`; the normal `DATABASE_URL` remains
production and is never an approved test target.

**Data-safety prerequisite: passed 2026-07-14.** Evidence for branch isolation,
fail-closed behavior, reset rehearsal, recovery read smoke, and drill cleanup is
recorded in `docs/DATA-SAFETY-RUNBOOK.md`. This authorizes QA mutation only; it
does not authorize a production schema change, backfill, repair, or purge.

Automate and manually verify these end-to-end paths:

1. Student signup -> join CourseOffering -> see course.
2. Teacher creates Announcement, Material, and Assignment with links/files.
3. Student opens content -> submits text/file/link -> edits or withdraws submission.
4. Teacher finds pending work -> previews every attachment -> grades or returns -> advances to the next Student.
5. Teacher publishes Score Item -> Student sees only their own score and course grade.
6. Teacher opens attendance session -> marks present/absent/leave -> edits history with required reason.
7. Profile/avatar and System/Light/Dark/Cream themes survive refresh on desktop and mobile.
8. Admin observes the same course data but cannot execute teaching mutations.
9. Local storage and production R2 behaviors are tested separately so local files are never mistaken for production objects.

**Exit gate:** no P0/P1 defects, permission matrix green, critical E2E green, mobile viewport green, and production upload smoke test green.

**Progress record:**

- Added a fail-closed database safety gate for every mutating integration/E2E
  package script. It rejects missing QA configuration, the same Neon branch
  expressed through pooled/direct URLs, and direct runner bypasses.
- Added unit regression coverage for the database gate, Profile display-name
  fallback, and System/Dark/Cream theme contracts including legacy Light data.
- Added `pnpm qa:safe`, an anonymous read-only HTTP smoke for public routes,
  protected redirects, and denied Teacher exports.
- Rewrote `Testing.md` to match the actual suite and removed the false assumption
  that Testcontainers/MinIO already isolate mutating tests.
- Playwright now starts a dedicated QA server on port 3100 and never reuses the
  normal port 3000 server, preventing a QA browser from driving a primary-DB
  process that was already running.
- Notification navigation acceptance now covers all 9 notification kinds. Bell
  rows show an explicit destination shortcut, and the server derives the route
  from a recipient-owned Notification rather than a client-provided URL.
  Student Material and Teacher class-join shortcuts pass isolated-Neon browser
  acceptance; route and destination-label logic passes 35 focused unit cases.
- Safe verification on 2026-07-15: typecheck passed, 486/486 unit tests passed,
  anonymous HTTP smoke passed 10/10, ESLint completed with zero errors (existing
  tool-bundle warnings remain), and the Next.js production build passed.
- Verified the isolated QA branch differs from production and that missing or
  matching QA configuration fails closed before starting a mutating runner.
- Completed the disposable-child reset rehearsal: the post-snapshot probe was
  removed, an application table remained readable, and the drill branch then
  expired/deleted as planned.
- Integration tests passed on QA; critical Playwright passed 2/2 on the isolated
  port-3100 app; the anonymous safe smoke passed 10/10.
- Responsive timetable acceptance passed on isolated Neon QA on 2026-07-19:
  Teacher Dark create/edit/delete, Student Cream read-only projection, persisted
  time/location, and iPhone `390x844` overflow are covered by Playwright `1/1`.
- Student course-workspace acceptance passed on isolated Neon QA on 2026-07-22:
  authenticated Overview, Assignments, Members, and Scores routes pass Desktop
  and iPhone checks across Light, Dark, Cream, and System themes without
  document-level horizontal overflow.
- The 2026-07-22 release gate is green: Unit `627/627`, full Integration, full
  Playwright E2E `10/10`, TypeScript, repository ESLint with zero errors,
  Production build, and safe read-only Production smoke `15/15`. The remote
  Neon runner now uses explicit 30-second test/hook timeouts, and screenshot
  capture no longer introduces a QA-only hydration race.
- Authenticated Production private-R2 upload plus image/PDF preview passed on
  2026-07-22. That smoke found a cross-origin download-disposition defect: a
  file could replace the current Beagle tab instead of downloading. The fix now
  gives download controls an explicit `?download=1` attachment contract across
  Feed, Assignment, Submission review, and Admin moderation evidence. Focused
  regression `8/8`, full Unit `635/635`, TypeScript, ESLint, and Production
  build pass. PR #24 deployed at `b9f29594`; the authenticated post-deploy PDF
  smoke produced a real download with the expected filename while preserving
  the current Beagle Feed URL.
- Physical-phone Production QR acceptance passed on 2026-07-22. The camera
  opened the Beagle join flow with the room code prefilled, and testing stopped
  before changing enrollment. A2 is closed; the Quiz pilot allowlist remains
  exact until the separate controlled expansion review is approved.

### A3. Functional completeness audit

**Goal:** close or explicitly defer every partial area in the scope confidence matrix before calling the Proposal complete.

**Static audit completed 2026-07-14:** classifications and code evidence are
recorded in [`FUNCTIONAL-COMPLETENESS-AUDIT.md`](./FUNCTIONAL-COMPLETENESS-AUDIT.md).
The audit closes the ambiguous inventory, but it does not claim that deferred
capabilities were implemented. A2 acceptance and the small A3.1 correctness
pass are closed; A4 account/content-retention decisions remain separately scoped.

The first A3.1 correctness item is closed: Admin Dashboard Teacher/Student
headcounts now exclude soft-deleted accounts and anonymized Students using the
same semantics as the Admin lists, with unit regression coverage.

The avatar consistency pass is also closed for identity-rich surfaces: Teacher
submission detail and Teacher member management now use the shared avatar.
Dense score/attendance tables remain text-first, and the Student peer list keeps
its intentionally narrow L1 projection.

#### Dashboard and analytics

- Inventory the metrics currently shown to each role and identify their data source and decision value.
- Do not add charts merely to look advanced. Add a trend only when its time window, owner, privacy level, and action are clear.
- Decide whether Admin needs school usage statistics in this single-tenant product and whether Teacher needs course trends beyond attendance and grading backlog.
- Export belongs to the report workflow in A1, not directly inside every Dashboard card.

#### Admin user lifecycle

Status: decision lock and pure policy foundation completed 2026-07-14. The
additive schema, lifecycle-history model, legacy backfill, guarded QA-only
migration, atomic Prisma repository, and feature-flagged Admin suspend/reactivate
surface were completed and verified on QA on 2026-07-15. Production migrated
successfully on 2026-07-15 and the mutation flag remains disabled. See ADR-0031.

- `lib/account/lifecycle-policy.ts` defines and unit-tests the transition contract without database writes.
- `lib/account/status.ts` defines deterministic legacy-to-canonical compatibility
  for the additive rollout. The latest QA verifier found 12 Active accounts,
  zero mismatches, and zero lifecycle events after disposable-test cleanup,
  without reading personal data.
- `AccountLifecycleEvent` is append-only lifecycle history. It is deliberately
  separate from the general Audit Log, which remains the evidentiary record.
- Admin Teacher/Student lists and account detail now render one theme-safe,
  read-only status badge from the compatibility mapping. Login and own-password
  change use the same availability predicate with unchanged legacy behavior.
- Guarded `db:migrate:qa:*` commands replace `DATABASE_URL` with an isolated,
  identity-checked `QA_DATABASE_URL`; they do not authorize production migration.
- A fail-closed suspend/reactivate application service requires separate internal
  and user-facing explanations and delegates one allowed transition to an atomic
  Prisma repository. The transaction re-checks actor role, current state, and
  last-active-Admin protection before grouping canonical status, legacy flag,
  session revocation, lifecycle history, and Audit writes.
- Admin account detail now exposes a confirmed suspend/reactivate form only when
  the server-side flag is enabled. The flag defaults off, so Production does not
  select the new schema or expose the mutation before the migration gate.
- Isolated QA integration coverage verifies suspend, session revocation,
  lifecycle/Audit evidence, reactivate, and disposable-fixture cleanup. Unit
  verification remains 486/486 with TypeScript and targeted ESLint passing.
- Production rollout and forward-only rollback gates are recorded in
  [`ACCOUNT-LIFECYCLE-ROLLOUT.md`](./ACCOUNT-LIFECYCLE-ROLLOUT.md).

**Superseded target-policy note (2026-07-24):** the earlier Terminated/Admin-approved request design above remains an implementation-history record, not the target identity contract. Release D replaces the target lifecycle with Active, Suspended, Deletion Pending, and Anonymized; account deletion is self-service with a 30-day recovery window and no Temporary Password. This Release D identity phase intentionally does not mutate CourseOffering lifecycle when a Teacher deletes an account.

#### QR and invite acceptance

**Status:** Automated browser acceptance completed 2026-07-17 on isolated Neon QA. Physical phone-camera scanning remains a manual OS/device release check.

- Teacher Course Settings exposes the QR, class code, absolute invite URL, course/class context, expiry, and ready/disabled/expired state.
- Playwright verifies mobile invite prefill, first join, removed Student rejoin through the same Enrollment, expired code, inactive code, stale regenerated code, and successful fresh-code join.
- Teacher Dark and Student Cream acceptance passes at desktop and iPhone 390x844 widths with no horizontal overflow. Student never sees Teacher-only Class Code management or regeneration controls.
- The QR payload is asserted against the same absolute invite URL used by the mobile browser handoff. A real camera scan is not simulated and remains on the release-device checklist.

#### Moderation coverage

Status: decision lock completed 2026-07-14. The first operational slice was implemented and integration-tested on isolated Neon QA on 2026-07-15 behind `MODERATION_CENTER_ENABLED`. Production code/schema shipped on 2026-07-15; the flag remains disabled pending cutover acceptance. See ADR-0032 and `MODERATION-CONTENT-MATRIX.md`.

- The first slice provides one case-based Moderation Center for content reports, file/profile safety, resolved history, and one-time appeals. Account Lifecycle requests remain a separate workflow.
- A Report does not hide content automatically. Admin or an authorized Teacher may temporarily hide content during review with reason and audit.
- Keep Moderation Center operational and Audit Log evidentiary; do not merge their responsibilities.
- Preserve comments, published posts, assignments, submission versions, scores, attendance, and case evidence through soft-delete/archive/quarantine semantics.
- Allow hard delete only for empty unpublished drafts or empty never-used CourseOfferings.
- Archiving or moderating Assignment content must never mutate linked Score Items or Score Entries.
- Keep automatic retention purge disabled until an isolated QA database and tested backup/restore path exist.

**QA implementation record:**

- Added additive `ModerationCase`, `ModerationReport`, and `ModerationCaseEvent` persistence with one active case per target, report deduplication/aggregation, immutable target snapshots, and a complete event timeline.
- Added Admin queue/detail actions for start review, temporary hide/quarantine, restore, resolve, and dismiss. Every mutation requires a reason where policy requires one and writes audit evidence atomically.
- Added authenticated reporting for Announcement, Material, Assignment, Comment, File Attachment, and Profile Image targets, plus one owner appeal within seven days.
- Enforced restrictions at Feed/detail queries, signed-file delivery, attachment projection, and profile-image delivery. Admin can still inspect evidence; normal users receive hidden content, denied files, or the default avatar as appropriate.
- Unit policy tests passed 5/5 and the isolated QA integration test passed the report aggregation, deduplication, snapshot, hide, decision, appeal, event, audit, and cleanup flow.
- Remaining before behavior rollout: Vercel feature-flag cutover, Admin/Teacher/Student manual acceptance in System/Dark/Cream and mobile/desktop, and private-R2 quarantine/restore smoke testing.

#### A4 implementation order

1. Finish decision documentation and permission/content matrices.
2. Provision an isolated Neon QA branch and rehearse backup/restore; do not use `db:push` on the shared production database.
3. Add Account Status and lifecycle history additively, backfill legacy state, then update authentication and read-only status surfaces.
4. Add lifecycle requests/actions and Moderation Center behind feature flags.
5. Replace unsafe hard-delete paths with archive, soft-delete, quarantine, restore, and placeholders.
6. Pass unit, integration, authorization, migration, mobile/desktop, theme, and production private-R2 verification before rollout.

#### Profile scope

- Keep a minimal learning identity: re-authenticated editable Real Name, privacy-safe Default Avatar or user-uploaded Avatar, owner/Admin-only verified email, optional Fallback Password, and theme. Do not maintain a separate Display Name.
- Grill separately before adding phone, address, birth date, bio, guardian, or social fields because they increase PII collection and PDPA obligations.
- Ensure avatars and real names are used consistently across Feed, comments, course cards, submissions, and review.

**Exit gate:** each row is marked Shipped, Intentionally Limited, Deferred with a target release, or Removed from Proposal. No row remains "probably complete".

## Release B: Lesson Workspace

### B0. Decision lock and prototype baseline

Status: design direction approved. B1-B6 are implemented and accepted on isolated Neon QA. Feed remains the default course landing; Production migration, compatibility backfill, pilot allowlist, feature-flag cutover, and default-route change remain unapproved.

- Teacher experience: Variant B split workspace.
- Student experience: Variant C learning path with a checkpoint for each topic.
- Lesson title is free-form and required; description is optional.
- Lesson detail is structured into overview, announcements, materials, assignments, progress, and grading backlog. It is not a nested mini-Feed.
- Existing Feed remains available as a chronological view.

### B1. Additive domain foundation

Status: implemented and verified on isolated Neon QA on 2026-07-15. Production migration requires a separate explicit approval.

- Add a Lesson Workspace entity under CourseOffering with title, optional description, position, and archive state.
- Add optional Lesson references to content first; do not make them required in the first schema rollout.
- Define permissions, query projections, audit events, and feature flag behavior before exposing mutations.
- General Announcement remains available for course-wide news.

**Exit gate:** additive schema and pure permission/domain tests pass without changing current UI or default routes.

**Verification record:** Before B2, QA migration status was current and the B1 invariant verifier reported zero Lessons, zero linked legacy content, and zero cross-course Assignment or Material links. Unit tests passed 507/507, TypeScript passed, and targeted B1 ESLint passed. The existing Feed remains the default experience.

### B2. Compatibility and backfill

Status: deterministic dry-run and guarded transaction implemented and applied on isolated Neon QA on 2026-07-15. Production remains untouched and requires a separate reviewed dry-run and explicit approval.

- Create an idempotent dry-run script that reports exactly what will change.
- Create "เนื้อหาเดิม" for existing Materials and Assignments where needed.
- Keep old course-wide Announcements under "ประกาศทั่วไป" unless intentionally moved later.
- Preserve all IDs and relationships, especially submissions, scores, comments, files, notifications, and audit rows.
- Enforce required Lesson membership only after the backfill report has zero orphaned Materials or Assignments.

**Exit gate:** before/after entity counts match, no orphaned content exists, and running the backfill twice produces no additional changes.

**QA verification record:** one fallback Lesson named "เนื้อหาเดิม" was created for one affected course and one existing Assignment was linked. Assignment, Material, Submission, Score Entry, Comment, File Attachment, and Notification counts stayed unchanged; one expected Lesson and one Important Audit row were added. The repeated dry-run reports zero changes and the cross-course/unassigned-content verifier reports zero violations.

### B3. Teacher workflow

Status: implemented on `phase-11` and accepted on isolated Neon QA on 2026-07-15. Production rollout remains a separate, unapproved operation.

- Create, rename, reorder, archive, and delete an empty Lesson Workspace.
- Prevent archive while an Assignment is open or grading is pending.
- Allow moving content between Lessons with confirmation and audit while preserving content IDs and history.
- Reuse one composer: from Feed, Teacher chooses or creates a Lesson; from inside a Lesson, that Lesson is preselected.
- Show submitted, missing, late, and pending-grading summaries with deep links to the existing review workspace.

**Exit gate:** Teacher can organize a real course without losing or duplicating Feed content.

**Completion record:** Teacher can create, rename, reorder, archive, and delete empty Lessons under fail-closed mutation flags. Archive blockers protect open Assignments and pending grading; content moves preserve IDs and write Important audit rows. Feed and Lesson-detail composers link Assignment/Material to active Lessons, including a create-Lesson shortcut for an empty course. Lesson detail reports submitted, missing, late, and pending-grading totals with links to the existing review workspace. Desktop and iPhone-size QA passed against isolated Neon QA; Production schema, data, flags, routes, and deployment were not changed.

### B4. Student learning path

Status: implemented on `phase-11` and accepted on isolated Neon QA on 2026-07-15. Feed remains the default course landing and Production rollout remains unapproved.

- Show all active Lessons without sequential locks in v1.
- Show only the current Student's checkpoints, submitted/total progress, next task, due date, and overdue state.
- Define progress as submitted Assignments divided by total Assignments. Opening a Material does not count as completion.
- Show archived Lessons collapsed under "บทเรียนที่จบแล้ว".

**Exit gate:** L1 privacy tests prove that no peer progress, score, attendance, or submission data is exposed.

**Completion record:** Student course navigation now includes a Lesson path and per-Lesson detail. The path exposes every active Lesson without locks, collapses archived Lessons, and presents checkpoints, current-student progress, next work, due dates, and overdue state. Progress counts only submitted Assignments; Materials remain readable resources and never increase completion. The Student query selects only the caller's active Enrollment id and filters nested Submission rows by that id. Unit privacy/projection tests pass inside the full `522/522` suite, TypeScript, targeted ESLint, and the production build pass, and Playwright acceptance passed on Desktop plus iPhone 390 px in Dark, Light, and Cream without horizontal overflow. The isolated QA fixture was cleaned after acceptance; no Production schema, data, flag, route, or deployment change was made.

### B5. Feed, notifications, and route transition

Status: implemented on `phase-11` and verified locally plus isolated Neon QA on 2026-07-15. Feed remains the default course landing and Production rollout remains unapproved.

- Feed continues to project canonical Announcement, Material, Assignment, and score events chronologically.
- Notifications deep-link to the content item inside its Lesson when applicable; creating an empty Lesson sends no notification.
- Existing Feed and detail URLs remain valid.
- Change the default course landing from Feed to Lessons only after parity QA passes; rollback means disabling the flag and returning to Feed-first navigation.

**Exit gate:** Feed item counts and links match the pre-release baseline, bookmarks still work, and the flag can restore the old default without a data rollback.

**Completion record:** Feed projection and default course redirects remain unchanged. New Lesson-linked Assignment, Material, submission grade/return, and relevant comment notifications snapshot the optional Lesson id and, only while the fail-closed Lesson read flag is enabled, deep-link to stable Assignment/Material anchors inside Student or Teacher Lesson detail. Legacy notifications, Announcements, and flag-off navigation retain their original direct detail URLs, so existing bookmarks remain valid and rollback needs no data mutation. Empty Lesson creation still has no notification producer. Full unit `528/528`, targeted isolated-Neon integration `19/19`, TypeScript, targeted ESLint, and production build passed. No Production schema, data, flags, default routes, or deployment changed.

### B6. Admin observer and rollout

**Status:** Admin observer and course-level pilot controls are implemented on `phase-11` and accepted on local isolated QA on 2026-07-15. Production rollout, pilot approval, and the default-route change remain open and unapproved.

- Admin sees Lesson structure, progress summaries, and content in read-only mode.
- Pilot with one CourseOffering before wider rollout.
- Run theme, accessibility, mobile, performance, permission, migration, and production smoke QA.

**Exit gate:** pilot approval, no P0/P1 defects, rollback rehearsal complete, and documentation updated from planning to shipped state.

**Implementation record:** Admin course navigation now includes feature-flagged Lesson list/detail routes for aggregate observation. Admin can see Lesson content and aggregate submitted, missing, late, pending-grading, and completion values but cannot see Student identities, scores, attendance, private comments, Submission versions, or submitted files. The query rejects non-Admin viewers before database access and the UI renders no teaching mutations. `LESSON_WORKSPACE_PILOT_COURSE_IDS` provides an exact CourseOffering allowlist across tabs, routes, mutations, Feed composer coupling, and notification deep links; an explicitly empty allowlist disables every course. TypeScript, targeted ESLint, production build, full unit `540/540`, and desktop/iPhone local visual QA passed without horizontal overflow. This completes the B6 implementation slice, not the Production exit gate.

**Production pilot sequence (still requires approval):**

1. Deploy the already-reviewed additive Lesson migration and run the guarded compatibility backfill/verification against Production only after backup and explicit approval.
2. Set `LESSON_WORKSPACE_ENABLED=1`, keep the default-route flag off, and set `LESSON_WORKSPACE_PILOT_COURSE_IDS` to exactly one approved CourseOffering id. Enable mutations only after the Teacher owner and existing content pass read-only smoke QA.
3. Verify Teacher, Student, and Admin permissions; Light/Dark/Cream; desktop/mobile; notification deep links; Feed parity; private file delivery; and performance on that course.
4. Rehearse rollback by disabling the Lesson flags and confirming Feed/direct detail URLs still work with no data rollback.
5. Widen the allowlist only after pilot sign-off. Do not remove the allowlist or switch the default course landing until a separate approval records the result.

## Release C: Quiz

**Grill status:** Complete 2026-07-17. The approved contract is recorded in
[`docs/QUIZ-MVP-DECISIONS.md`](./QUIZ-MVP-DECISIONS.md).

**Prototype status:** Complete for product review 2026-07-17. The development-only
route `/teacher/courses/[id]/quiz-prototype` covers Teacher Builder, Student
Attempt, and Teacher Results without persistence. Desktop 1440x900, mobile
390x844, and Light/Dark/Cream visual acceptance passed. This is not evidence of
Production readiness. The later C1 slice adds a domain model and prepares an
offline migration, but does not apply it to a database.

Implementation sequence:

1. Completed: validate Teacher Builder, Student Attempt, and Teacher Results in a throwaway responsive prototype.
2. Completed 2026-07-17: Quiz domain ADRs lock lifecycle/snapshot, Score Item coupling, Attempt concurrency, and archive/moderation evidence (ADR-0035 through ADR-0038).
3. Completed 2026-07-17: additive schema, offline unapplied migration, fail-closed flags, and pure validation/state-policy layer.
4. Isolated-QA accepted 2026-07-18: Teacher draft Builder, atomic create/replace,
   scored `QUIZ_LINKED` Score Item coupling, debounced auto-save, Lesson entry
   point, and read-only Student preview. The additive migration is applied to
   Neon QA only, and authenticated desktop/mobile Playwright acceptance passes.
   Student mutations remain absent and Production migration/flags remain off.
5. Isolated-QA accepted 2026-07-18: Student Quiz center and Lesson entry,
   start/resume with device lease takeover, revision/idempotency-safe auto-save,
   server-authoritative timer/deadline auto-submit, final confirmation, objective
   auto-grading, score-visibility rules, and responsive Desktop/iPhone UI. Student
   payloads are sanitized so answer keys and Teacher explanations stay Server-only.
6. Isolated-QA accepted 2026-07-18: Teacher Results, close/finalize, audited
   reopen, private per-Student deadline/attempt exceptions, response analysis,
   and one-way Scored Quiz publication. Publication requires explicit confirmation
   of missing active Students and records their zero Score Entries before the
   linked `QUIZ_LINKED` Score Item is published. Production migration/flags remain
   off.
7. C5a implemented locally 2026-07-18: private multi-file attachments for the Quiz brief, questions, and options; exact owner/uploader validation; authenticated previews; immutable Student-safe Attempt metadata; legacy snapshot compatibility; and Moderation filtering. Full unit `616/616`, targeted lint/TypeScript, and Production build pass. Authenticated isolated-QA upload/R2 smoke remains before acceptance.
8. C5b implemented locally and integration-verified on isolated Neon QA 2026-07-18: Students can report a Quiz or the exact immutable question snapshot they saw; cases preserve Teacher content, option text, and private attachment metadata without correctness, explanations, Student answers, grading, scores, exceptions, or submitted files. Active restrictions hide Student Quiz discovery and fail closed on start, save, submit, and direct Attempt reads without mutating academic records. Admin evidence is theme-safe and remains observer-only. Focused integration `2/2`, full unit `616/616`, targeted ESLint, TypeScript, and Production build pass.
9. C5c implemented locally 2026-07-18: Teacher Results CSV uses the Results source of truth and audits the export; Admin receives feature-gated aggregate list/detail views without Student identities, answers, per-Student scores, private files, or mutation controls. Focused tests `11/11`, full unit `621/621`, targeted ESLint, TypeScript, and Production build pass.
10. One-course Production pilot enabled 2026-07-18 for exact CourseOffering `cmr1fxlhd0005if04q7fi04qk` after additive migrations, main CI, Vercel deployment, environment-helper verification, and public/auth-boundary smoke passed. The 2026-07-22 gate reconfirmed full Quiz E2E, Integration, Unit, build, safe Production route/auth boundaries, authenticated private-R2 delivery, and the physical-phone QR flow. Keep this exact allowlist while reviewing a controlled multi-course expansion; never switch to a wildcard or global enablement as part of the review.
11. Expansion review completed 2026-07-22 without widening. The authenticated Production Teacher Quiz center loads cleanly, but the pilot CourseOffering has no Quiz record to validate create/open, Student attempt/submit, Teacher results, or Quiz-owned private attachments. Before adding a second CourseOffering id, run one disposable pilot Quiz through those role and lifecycle checks, remove the disposable data, and confirm the exact allowlist rollback. No wildcard is permitted.

Question bank, cross-course copy, spreadsheet import, essay/short-answer grading,
AI grading, invasive proctoring, and full offline exams remain outside MVP.

**Start condition:** Lesson Workspace is stable in production and Release A QA remains green.

## Release D: Identity and external integrations

These items do not block Lesson Workspace or Quiz and must not be bundled into their database rollout.

### D0. Remove Student Number from the product identity

**Decision locked 2026-07-24:** Student Number is no longer part of the target identity model. It must not be required for sign-up, used as a login identifier, used as an authorization input, or shown in normal Profile, CourseOffering, member, attendance, score, submission, report, search, import, or export surfaces. Academic relationships continue to use the immutable internal User id.

The project is still using disposable development data. Decision locked 2026-07-24: do not build a legacy Student Number account-migration flow. Replace the identity model, reset explicitly approved development/QA data, and recreate test users under the new model.

1. Inventory every use of the human-facing `Student.studentId` separately from internal foreign keys named `studentId` that actually reference `User.id`. Do not bulk-rename or drop the latter.
2. Implement the replacement Authentication identity and account-creation path before removing the old Credentials fields from code.
3. Remove Student Number from schema, validation, login, search, import, report, export, Profile, CourseOffering, member, attendance, score, and submission projections.
4. Rename internal foreign-key terminology where practical so a User relation is not confused with the retired human-facing Student Number. Preserve referential behavior even though disposable rows will be reset.
5. Generate and apply the destructive schema migration only after code, type, unit, integration, and build checks pass against an isolated database.
6. Reset only the explicitly named development/QA environments, reseed role accounts and representative course data, then run the critical-path QA checklist.
7. Production data is never reset as an implicit side effect. If the current Production dataset is also declared disposable, require a separate named approval, backup/restore drill, and post-reset acceptance before deletion.

**Environment cutover decision locked 2026-07-24:**

1. Create or refresh an isolated Neon QA branch.
2. Apply the new schema and representative seed to QA.
3. Run role, critical-flow, file, theme, responsive, migration, and rollback acceptance there.
4. Deploy only code that is compatible with the approved target schema.
5. Back up Production and verify restore before destructive cutover.
6. Require a separate approval naming Production immediately before reset.
7. Reset and seed Production, then run authenticated Production smoke tests.

**Selective preserve decision locked 2026-07-24:** retain the existing Razyxls Admin identity across the reset without retaining the retired username credential or unrelated test data.

- Preserve the internal User id, Admin Role, real-name Profile, avatar linkage when the private object still exists, Theme preference, required consent, and active account status.
- Replace the `Rayzxls` username with a separately supplied unique verified email and establish new Google/fallback authentication under the target model.
- Do not preserve the old password hash, sessions, test Audit rows, Academic Year, Term, Class, CourseOffering, Enrollment, score, attendance, submission, Lesson, Quiz, notification, or other disposable development records merely because they relate to the old database.
- Export and validate the preserve bundle before reset; import it idempotently after the target schema is applied. Fail closed if the verified email is missing, duplicated, or unverified.

**Acceptance gates:**

- A new Student can create and use an account without a Student Number.
- Newly seeded Students can authenticate and complete join, submission, score, attendance, notification, file, Lesson, and Quiz flows without a Student Number.
- Duplicate real names remain valid; identity and authorization never infer a User from a name.
- Teacher and Admin surfaces do not display or require Student Number.
- Database and route tests prove that no authorization decision reads the legacy value.
- Schema migration and seed scripts are reproducible on an isolated database before any shared environment reset.

### D0.1. Teacher-owned course labels and academic period

The desired product direction removes Admin-managed Class, Academic Year, and Term setup from the course-creation dependency. Teacher will describe the learner group and academic period while creating a CourseOffering. This change requires a separate migration plan because the current timetable, dashboard, reports, course colors, GPA remnants, and Admin Observer queries still traverse Class and Term relations.

Plan this as an additive compatibility migration:

1. Define the final teacher-entered labels and which are required.
2. Add teacher-owned CourseOffering metadata and backfill it from the current Class, Term, and Academic Year records.
3. Move all reads, filters, reports, timetable projections, and course cards to the new metadata.
4. Remove Admin create/edit surfaces for Class, Academic Year, and Term while retaining read-only legacy observation during rollout.
5. Make legacy relations non-blocking, verify old and new CourseOfferings together, then remove unused tables and code only after dependency scans and Production acceptance pass.

Decision locked 2026-07-24: `learnerGroupLabel` and `academicPeriodLabel` are independent free-text CourseOffering metadata and both are optional. A Teacher can create a CourseOffering with only its name; no hidden Class, Academic Year, or Term validation may make either label effectively required.
Decision locked 2026-07-24: empty optional labels are omitted from Course cards, Feed headers, dashboards, reports, timetable, and detail views. Layout must collapse the unused space; do not render `-`, `ไม่ระบุ`, or an empty year/term badge.
Decision locked 2026-07-24: CourseOffering lifecycle is `active` versus `archived`, using the existing archive concept rather than Academic Year or Term inference. Active courses are the default list; archived courses live in a separate archive surface and preserve academic history. Free-text labels never determine lifecycle.
Decision locked 2026-07-24: an archived CourseOffering is read-only for Teacher and Student across Feed, Lesson, Assignment, Material, Announcement, Comment, Submission, Attendance, Score, Quiz, and file mutations. Existing history remains readable under normal visibility rules. The owning Teacher may restore the course; Admin remains observer-only. Enforce this at authorization/service boundaries, not only by hiding controls.
Decision locked 2026-07-24: remove Term GPA, GPAX, Term Status, term-completion progress, and every aggregate result calculated across CourseOfferings. Student Learning Results lists active and archived CourseOfferings and shows Score Total, percentage, and Grade per CourseOffering only. `academicPeriodLabel` is display metadata and never participates in calculation or completeness.

Decision locked 2026-07-24: keep Credit Hours as display/report metadata for one CourseOffering. It never calculates GPA or aggregates results across CourseOfferings.
Decision locked 2026-07-24: Credit Hours is optional during course creation. Empty values are omitted and collapse their UI space; do not coerce missing data to zero or show a placeholder.
Decision locked 2026-07-24: retire Admin-managed Academic Year, Term, Class, and Homeroom Teacher concepts from the target model and remove their management surfaces. Admin Observer View remains read-only over Teacher-owned CourseOfferings and their permitted operational aggregates.
Decision locked 2026-07-24: equal free-text labels across CourseOfferings never imply shared identity or membership. Do not normalize, upsert, join, authorize, aggregate, or synchronize CourseOfferings from matching `learnerGroupLabel` or `academicPeriodLabel` values.
Decision locked 2026-07-24: retire the required `gradeLevel` field. Grade or education level may appear inside optional `learnerGroupLabel`; it must not be independently required, normalized, or used for authorization or aggregation.

Removal sequence:

1. Add optional teacher-owned metadata to CourseOffering and move course creation off Term/Class lookup and implicit Class upsert.
2. Replace Class-derived timetable labels and color keys with CourseOffering identity plus optional learner-group display.
3. Replace Term/Class traversal in dashboards, reports, Learning Results, course cards, queries, exports, and Admin Observer projections.
4. Remove Homeroom Teacher behavior and every permission/query path that depends on a shared Class.
5. Remove Admin setup actions, routes, navigation, validation, audit labels, and tests for Academic Year, Term, Class, and Homeroom Teacher.
6. Verify no runtime or report query reads the retired relations, then drop their foreign keys, models, and seed data in the destructive reset migration.

### D1. Google Login

Architecture decision: [`ADR-0041`](./adr/0041-google-first-identity-uses-gated-role-onboarding.md).

- Decision locked 2026-07-24: use Google-first onboarding. A new Student may authenticate with Google, provide real name once, and then return to the same linked User Account on later Google sign-ins without repeating onboarding or supplying a Student Number.
- Decision locked 2026-07-24: never treat the Google display name as the authoritative Real Name because it may be a nickname or arbitrary text. Every new User must explicitly enter separate real first-name and last-name fields in Beagle Classroom and confirm them before account creation; Google proves ownership of the verified email only.
- Decision locked 2026-07-24: do not import the Google profile image automatically. New Users receive the stable privacy-safe Default Avatar and may upload their own Avatar later.
- Decision locked 2026-07-24: Users may edit their own real first name and last name in Profile without Admin approval, but must re-authenticate and every change must write an Audit Log event.
- Decision locked 2026-07-24: a Student real-name change creates one deduplicated Notification per Teacher who owns an actively enrolled CourseOffering, showing Avatar, old and new names, timestamp, and all affected courses. It routes to that Student's member context. A “เพิ่งเปลี่ยนชื่อ” badge and prior name remain visible to those Teachers for 14 days only; peers never see the prior name, while Admin retains permanent Audit history.
- Decision locked 2026-07-24: apply the same continuity rule to Teacher real-name changes. Students actively enrolled in that Teacher's CourseOfferings receive a deduplicated old-to-new name Notification, and may see a “เพิ่งเปลี่ยนชื่อ” badge plus the prior Teacher name for 14 days.
- Decision locked 2026-07-24: CourseOffering members may report a misleading or inappropriate Real Name or Avatar. The Moderation case stores an immutable snapshot of both at report time. Reporting alone never auto-hides identity content or restricts/suspends the User; Admin must review and decide through the Moderation workflow.
- Simplicity decision locked 2026-07-24: Student onboarding does not require a pre-imported roster, per-Student invite, Student Number, or approval before account creation. Course data remains protected behind the separate Class Code enrollment flow.
- A new Teacher requires a valid Teacher Invite before Google-first onboarding can create the Teacher account. Admin cannot self-register; an existing provisioned Admin account must explicitly link Google.
- Decision locked 2026-07-24: do not expose Admin invite, self-signup, or Role elevation in the web UI. Provision a new Admin only through a secret-gated Bootstrap/Deployment command, audit the result, and never log the secret, token, or credentials.
- Decision locked 2026-07-24: first account creation requires separate acceptance of versioned Terms of Use and Privacy Notice, storing each version and acceptance timestamp. Re-consent only for material changes. Do not add marketing consent in this release. Any minor/guardian consent flow requires separate school-policy and legal review before implementation.
- Keep role assignment controlled by the approved onboarding path or existing account record. Google email alone never grants Teacher/Admin access, Google does not change an existing Role, and one Google Identity cannot link to multiple User Accounts.
- Decision locked 2026-07-24: retain one Role per User Account for this release. If a Teacher Invite targets a verified email already owned by another Role, fail closed and tell Admin; never auto-convert the Role or create a duplicate account. Multi-role identity is a separately designed future capability.
- Decision locked 2026-07-24: Google is the primary sign-in path but not the only path. Every fallback email/password login must resolve to the same User Account as the linked Google Identity, never create a duplicate account, never infer or change a Role, and never use Student Number.
- Decision locked 2026-07-24: fallback password setup is optional in Profile and does not block Google-first onboarding. The product may show a non-blocking reminder until it is configured.
- Decision locked 2026-07-24: every User requires one unique verified email as the Authentication identifier. Google and fallback credentials resolve to the same internal User id. Email is private from CourseOffering peers, does not key academic relations, and can change only through verification of the new address.
- Decision locked 2026-07-24: matching Google email never auto-links to an existing account. Link only after the existing fallback password is verified or from an already authenticated Profile. Teacher Invite email must match; Admin links only from an authenticated provisioned Admin account.
- Decision locked 2026-07-24: Admin-created Teacher Invites are email-bound, single-use, and expire after 7 days. Admin may revoke an unused invite or resend a replacement; replacement must invalidate the prior invite and must not create a duplicate User Account. The invite grants only Teacher onboarding and never creates academic structure on the Teacher's behalf.
- Decision locked 2026-07-24: consolidate single-Teacher entry and bulk CSV import into one Add Teacher workflow. Both paths create Teacher Invites only; they do not pre-create User Accounts or temporary passwords, and each invited Teacher completes Google sign-in personally.
- Decision locked 2026-07-24: fallback password recovery uses a single-use email link with a 15-minute expiry. Successful reset revokes other sessions. Teacher and Admin no longer view, generate, or reset another User's password.
- Decision locked 2026-07-24: voluntary Google disconnect requires an existing fallback password. External Google revocation never deletes the User or academic data; a User without fallback password recovers it through verified email.
- Decision locked 2026-07-24: allow verified Gmail and Google Workspace identities from any domain. Domain never grants Teacher or Admin Role; those roles retain their Invite/provisioning gates.
- Decision locked 2026-07-24: request only minimum Google OAuth/OIDC scopes for authentication and verified email. Do not request Drive, Contacts, Calendar, Classroom, or other integration permissions. Future integrations require a separate feature-specific consent and must not silently widen login scopes.
- Decision locked 2026-07-24: authentication sessions last at most 30 days on the same device and expire after 7 continuous days of inactivity. Real-name, verified-email, fallback-password, and account-deletion changes require re-authentication. Logout revokes the current session immediately.
- Decision locked 2026-07-24: email change requires re-authentication and verification of the new unique address. On success, update the canonical identifier, revoke other sessions, and audit the change. Existing Google linkage remains keyed by provider identity even when its email differs from the new canonical email.
- Decision locked 2026-07-24: Student email is hidden from CourseOffering peers and the owning Teacher. Teacher-facing member, score, attendance, review, and submission surfaces show only real name and Avatar. Only the account owner and account-managing Admin may see the verified email.
- Decision locked 2026-07-24: when a User has no uploaded Avatar, generate a stable privacy-safe Default Avatar variant from the internal User id. It may vary color or pattern so duplicate real names remain distinguishable, but must not display or expose the id and is replaced by the User's uploaded Avatar.
- Decision locked 2026-07-24: self-service account deletion immediately changes the account to Deletion Pending, blocks sign-in, and revokes sessions without waiting for Admin approval. The owner may recover it within 30 days. After the window, anonymize verified email, Real Name, Avatar, and displayable personal data while preserving required Score, Submission, Attendance, and Audit history under a non-public internal identity. Admin User management must not expose direct hard deletion of learning history.
- Scope boundary locked 2026-07-24: this identity work does not change CourseOffering lifecycle behavior when a Teacher account is deleted. Do not add automatic archive/restore or other CourseOffering mutations in this phase; retain the current behavior and treat any ownership-transfer policy as a separate future decision.
**Grill status:** complete 2026-07-24 for the current single-tenant school release. Verified-email linking, Teacher Invite, Google/fallback collision handling, one-Role policy, Admin provisioning, recovery, consent, minimal OAuth scope, session policy, profile identity, name-change continuity, moderation, deletion/anonymization, and Razyxls preservation are locked above. Multi-role and global multi-tenant identity remain separate future architecture.

**Staged implementation and cutover order:**

1. **Complete 2026-07-24:** Build an executable dependency inventory and release gate before schema edits. The committed baseline now separates retired Student Number blockers from ambiguous internal `studentId` User relations and inventories Class/Term/AcademicYear, identity, report, seed, and test dependencies. See `docs/release-gates/IDENTITY-COURSE-DEPENDENCY-GATE.md`; the initial baseline is 637 blockers and 240 review findings, with zero new dependencies permitted.
2. **Stage 2A complete 2026-07-24; Stage 2B in progress:** the additive Identity V2 schema/domain foundation is implemented behind fail-closed read/mutation flags. It adds verified-email fields, Google provider-link persistence, Teacher Invite persistence, separate versioned consent records, session-revocation metadata, Real Name history, deterministic Default Avatar policy, and Deletion Pending metadata while retaining legacy login. The migration was applied and verified on isolated Neon QA only; it created no identity rows and changed no existing User status. Stage 2B now supports fail-closed Admin issue/replace/revoke of Teacher Invites plus atomic Google-first Teacher Invite acceptance: User, Teacher, Google identity, exact-version consent, Invite state, and Audit events commit together. Both transaction slices passed isolated-Neon tests and clean up their disposable rows. Google/OIDC assertion verification, routes/UI/email delivery, Student onboarding, existing-account provider linking, session, verified-email change, recovery, and deletion services remain disabled and unfinished. See `docs/release-gates/IDENTITY-FOUNDATION-ROLLOUT.md`.
3. Add Google-first Student/Teacher onboarding and provisioned-Admin linking. Add optional Fallback Password and email-link recovery. Prove collision, Role, Invite expiry/revoke/resend, session revocation, and minimum-scope behavior before changing the default login.
4. Add optional teacher-owned `learnerGroupLabel`, `academicPeriodLabel`, and optional Credit Hours to CourseOffering. Move Teacher course creation and all reads to CourseOffering-owned metadata while legacy Class/Term relations remain compatibility-only.
5. Migrate Profile, members, attendance, scores, submissions, reports, exports, notifications, moderation, dashboards, timetable, Admin Observer, Lesson, Quiz, and file permission projections to the new identity and CourseOffering contracts. Remove Student Number and retired academic-setup controls from every visible surface.
6. Run static and runtime dependency gates proving no authorization, calculation, route, report, seed, or UI requires Student Number, Class, Term, AcademicYear, gradeLevel, Term GPA/GPAX, Display Name, Temporary Password, or Admin-created Teacher Account.
7. Apply the target destructive migration and representative seed to isolated Neon QA only. Exercise backup/restore, Razyxls preserve-bundle export/import, role flows, Google/fallback auth, invites, course creation, join, Feed, Lesson, Quiz, submission/review, score publication, attendance, notifications, moderation, account recovery/deletion, private files, all themes, and desktop/mobile.
8. Promote only after QA has no P0/P1 defects and rollback is rehearsed. Back up Production, verify restore, request a separate approval explicitly naming Production, run the reset/cutover, import the validated Razyxls Admin bundle, and complete authenticated Production smoke acceptance.

Do not combine additive rollout, default-login switch, destructive schema removal, and Production reset into one release. Each stage has its own flag, verification evidence, and rollback point.

### D2. Other program integrations

- Name the concrete system and use case before choosing an API.
- Prefer export/import or deep links for the first integration; add live synchronization only when ownership and conflict resolution are clear.
- Record secrets, rate limits, retries, data retention, outage behavior, and audit responsibility per integration.

**Start condition:** Release A user lifecycle and permission audit are closed.

## Release E: AI assistance

AI is optional and follows Quiz. Begin with low-risk assistance rather than autonomous decisions:

- Draft Lesson descriptions, Announcements, Materials, Assignment prompts, rubrics, and Quiz questions for Teacher review.
- Summarize a Teacher's own course activity and grading backlog without exposing other courses.
- Never publish content, grade a Student, change attendance, or alter a score without explicit Teacher confirmation.
- Record provider, cost, privacy, retention, prompt-injection, and fallback decisions before connecting a model.

**Start condition:** stable Lesson/Quiz data model, permission tests, audit policy, and an approved AI privacy ADR.

## Release F: Optional product modules

These are visible backlog candidates, not promises for the current school release.

| Candidate | Dependency and recommended direction |
| --- | --- |
| Chat Room | Run a separate Grill after moderation and notifications are complete. First prove that Feed comments and private Submission Conversation do not already solve the need. |
| Reward system | Start only after Lesson Progress and Quiz produce trustworthy events. Rewards must not expose peer performance or encourage point farming. |
| Meeting room | Prefer integration with an established meeting provider before considering custom WebRTC infrastructure. Define host, admission, recording, consent, and attendance semantics first. |
| Advanced analytics | Requires stable event definitions and enough historical data. Do not infer learning outcomes from raw click counts. |

### Separate strategy: Subscription and global multi-tenant

The current application is a single-tenant school system. Subscription, tenant isolation, self-service organization signup, billing, quotas, global identity, and cross-tenant operations form a separate SaaS architecture. They should be developed in a separate product track or fork after the school version is stable, not inserted into the current schema as a small follow-up feature.

## Explicit v1 non-goals

- Sequential Lesson locks.
- Lesson cover, color, start date, or end date configuration.
- Copying a Lesson across CourseOfferings.
- Counting document opens as learning completion.
- A central Lesson comment thread.
- Automatic AI grading or AI attendance decisions.

## Recommended first work item after approval

Do not start with Prisma schema changes. **A0 Documentation Alignment is complete.** Continue with **A1 Report/Export Decision**, turn **A2 Critical-path QA** into an executable release gate, and classify every row in **A3 Functional Completeness Audit**. Only after A0-A3 close should implementation begin at **B1 Additive Domain Foundation**.
