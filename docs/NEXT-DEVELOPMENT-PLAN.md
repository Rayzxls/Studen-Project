# Next Development Plan

**Updated:** 2026-07-15
**Sequence:** Core completion -> Lesson Workspace -> Quiz -> Identity/Integrations -> AI -> Optional product modules  
**Current state:** A0 Documentation Alignment, A1 Report/Export v1, the A2 automated QA gate, and A3/A3.1 static correctness work are complete. A2 manual acceptance remains open. A4 Account Lifecycle and the first operational Moderation Center slice now have additive persistence, isolated Neon QA migrations/integration tests, audited transactions, and feature-flagged Admin surfaces. Production code and schema migrations shipped on 2026-07-15; behavior enablement remains pending Vercel flags and post-cutover smoke testing. The Lesson Workspace prototype is approved as a direction reference, but production development has not been approved yet.

## Why this order

The current core already covers authentication, CourseOffering, attendance, scoring, assignments, submissions, review, Feed, notifications, profile/theme, dashboards, file handling, audit, and Admin Observer View at different levels of completeness. The next release should first prove which flows are complete, which are partial, and which are intentionally out of scope.

Lesson Workspace must precede Quiz because a future Quiz should belong to a Lesson Workspace and create or connect to Score Items through the same scoring contract as Assignments. Building Quiz first would force the content model and navigation to be changed twice. AI comes last because it should assist stable workflows rather than define them.

## Scope confidence matrix

This matrix prevents an implemented screen or database field from being mistaken for a complete product workflow.

| Area | Current evidence | Planning status |
| --- | --- | --- |
| Role dashboards | Operational dashboards exist for Admin, Teacher, and Student | Partial: advanced trends, usage statistics, and report export need a separate scope decision |
| Report and export | Student Learning Results has browser Print to PDF; Teacher score and attendance summaries have course-level CSV; Admin Audit has filtered CSV | V1 shipped: full report-card PDF generation is explicitly deferred pending a separate layout, identity, signature, and authorization decision |
| Admin user management | Create/import Teacher, list users, reset password, reset avatar, and user drill-down exist | Partial: deactivate, restore, delete-request, and anonymize workflows are not complete even though `User.deletedAt` and `Student.anonymized` exist |
| QR and invite link | Class Code, `qrcode.react`, `ClassCodeCard`, and join route exist | Implemented foundation, not accepted until QR scan, invite copy, expiry, deactivate, regenerate, mobile, and rejoin flows pass QA |
| Moderation | Existing Teacher comment moderation plus a case-based Admin queue for reports, evidence snapshots, temporary restrictions, decisions, restore, and one-time appeal | Code/schema deployed behind `MODERATION_CENTER_ENABLED`; flag cutover and manual all-theme/mobile/private-R2 acceptance remain open |
| Profile personal information | Avatar, display name, read-only real identity, password, and theme exist | Intentionally minimal learning identity; a full personal profile requires a privacy/scope decision, not an automatic expansion |
| Quiz / Testing | No domain model or route found | Not implemented; planned after Lesson Workspace |
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
- Treat course score and course grade as the primary Student result. Term GPA may remain a calculated/report value, but must not return as a large Dashboard metric or confusing completion trend.
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

**Status (2026-07-15): Automated gate passed; manual acceptance remains open.**
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
- Remaining before full A2 closure: complete the Student/Teacher/Admin manual
  workflow checklist, mobile viewport and all-theme acceptance, QR handoff, and
  private production-R2 upload/preview smoke. These are manual release checks,
  not evidence gaps in the automated isolation gate.

### A3. Functional completeness audit

**Goal:** close or explicitly defer every partial area in the scope confidence matrix before calling the Proposal complete.

**Static audit completed 2026-07-14:** classifications and code evidence are
recorded in [`FUNCTIONAL-COMPLETENESS-AUDIT.md`](./FUNCTIONAL-COMPLETENESS-AUDIT.md).
The audit closes the ambiguous inventory, but it does not claim that deferred
capabilities were implemented. A2 acceptance remains open, followed by the
small A3.1 correctness pass and A4 account/content-retention decisions.

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

- Use one Account Status: Active, Suspended, Terminated, or Anonymized. Migrate legacy flags additively before removing them.
- Suspended affects authentication only. Terminated removes current participation but preserves history. Anonymized removes identity and is irreversible.
- Admin is the global lifecycle operator. Teacher and Student can submit a termination request; Teacher can remove a Student only from an owned CourseOffering.
- Require an internal reason, separate user-facing message, confirmation, session revocation, audit, self-protection, and last-Admin protection.
- Block Teacher termination while an owned CourseOffering is active. Emergency suspension remains available; ownership transfer is a separate future decision.
- Terminating a Student withdraws active enrollments while retaining submissions, scores, attendance, and Teacher review access. Restoration does not rejoin prior courses.
- Restoring a terminated account requires a temporary password and first-login reset. An anonymized account cannot be restored.
- Anonymization is explicit and never automatic. It is allowed only after termination and open-work/dispute checks, and preserves pseudonymous academic evidence.

#### QR and invite acceptance

- Test code entry, QR scan, invite link, expired code, inactive code, regenerated code, existing active enrollment, removed Student rejoin, and mobile camera/browser handoff.
- Confirm that Student never sees the Teacher-only Class Code management surface.

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

- Keep the current minimal learning identity by default: avatar, friendly display name, real identity read-only, password, and theme.
- Grill separately before adding phone, address, birth date, bio, guardian, or social fields because they increase PII collection and PDPA obligations.
- Ensure avatars and real names are used consistently across Feed, comments, course cards, submissions, and review.

**Exit gate:** each row is marked Shipped, Intentionally Limited, Deferred with a target release, or Removed from Proposal. No row remains "probably complete".

## Release B: Lesson Workspace

### B0. Decision lock and prototype baseline

Status: design direction approved, implementation not started.

- Teacher experience: Variant B split workspace.
- Student experience: Variant C learning path with a checkpoint for each topic.
- Lesson title is free-form and required; description is optional.
- Lesson detail is structured into overview, announcements, materials, assignments, progress, and grading backlog. It is not a nested mini-Feed.
- Existing Feed remains available as a chronological view.

### B1. Additive domain foundation

- Add a Lesson Workspace entity under CourseOffering with title, optional description, position, and archive state.
- Add optional Lesson references to content first; do not make them required in the first schema rollout.
- Define permissions, query projections, audit events, and feature flag behavior before exposing mutations.
- General Announcement remains available for course-wide news.

**Exit gate:** additive schema and pure permission/domain tests pass without changing current UI or default routes.

### B2. Compatibility and backfill

- Create an idempotent dry-run script that reports exactly what will change.
- Create "เนื้อหาเดิม" for existing Materials and Assignments where needed.
- Keep old course-wide Announcements under "ประกาศทั่วไป" unless intentionally moved later.
- Preserve all IDs and relationships, especially submissions, scores, comments, files, notifications, and audit rows.
- Enforce required Lesson membership only after the backfill report has zero orphaned Materials or Assignments.

**Exit gate:** before/after entity counts match, no orphaned content exists, and running the backfill twice produces no additional changes.

### B3. Teacher workflow

- Create, rename, reorder, archive, and delete an empty Lesson Workspace.
- Prevent archive while an Assignment is open or grading is pending.
- Allow moving content between Lessons with confirmation and audit while preserving content IDs and history.
- Reuse one composer: from Feed, Teacher chooses or creates a Lesson; from inside a Lesson, that Lesson is preselected.
- Show submitted, missing, late, and pending-grading summaries with deep links to the existing review workspace.

**Exit gate:** Teacher can organize a real course without losing or duplicating Feed content.

### B4. Student learning path

- Show all active Lessons without sequential locks in v1.
- Show only the current Student's checkpoints, submitted/total progress, next task, due date, and overdue state.
- Define progress as submitted Assignments divided by total Assignments. Opening a Material does not count as completion.
- Show archived Lessons collapsed under "บทเรียนที่จบแล้ว".

**Exit gate:** L1 privacy tests prove that no peer progress, score, attendance, or submission data is exposed.

### B5. Feed, notifications, and route transition

- Feed continues to project canonical Announcement, Material, Assignment, and score events chronologically.
- Notifications deep-link to the content item inside its Lesson when applicable; creating an empty Lesson sends no notification.
- Existing Feed and detail URLs remain valid.
- Change the default course landing from Feed to Lessons only after parity QA passes; rollback means disabling the flag and returning to Feed-first navigation.

**Exit gate:** Feed item counts and links match the pre-release baseline, bookmarks still work, and the flag can restore the old default without a data rollback.

### B6. Admin observer and rollout

- Admin sees Lesson structure, progress summaries, and content in read-only mode.
- Pilot with one CourseOffering before wider rollout.
- Run theme, accessibility, mobile, performance, permission, migration, and production smoke QA.

**Exit gate:** pilot approval, no P0/P1 defects, rollback rehearsal complete, and documentation updated from planning to shipped state.

## Release C: Quiz

Quiz requires a separate Grill session before implementation. Recommended MVP direction:

- Quiz belongs to one Lesson Workspace.
- Start with objective question types only; define supported types during Grill.
- Attempts, availability window, result visibility, retake policy, and auto-grading must be explicit domain decisions.
- Scored Quiz uses the existing Score Item and publish contract instead of creating a second grade system.
- Teacher sees attempt and grading backlog; Student sees only their own attempt and published result.
- Question bank, randomization, anti-cheat, essay AI grading, and cross-course copy are not assumed in v1.

**Start condition:** Lesson Workspace is stable in production and Release A QA remains green.

## Release D: Identity and external integrations

These items do not block Lesson Workspace or Quiz and must not be bundled into their database rollout.

### D1. Google Login

- Define how a Google identity links to an existing Credentials account for Student, Teacher, and Admin without creating duplicate users.
- Keep role assignment controlled by the existing account record; Google sign-in must not grant a role by email guesswork.
- Define account recovery, revoked Google access, email changes, school-domain restrictions, and fallback Credentials login.
- Implement only after identity-linking, audit, and test-account migration decisions are approved.

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
