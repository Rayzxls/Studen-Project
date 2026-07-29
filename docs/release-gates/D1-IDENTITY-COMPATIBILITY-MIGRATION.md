# D1 Identity Compatibility Migration

**Status:** QA drill and authorized Production migration complete
**Updated:** 2026-07-29  
**Scope:** historical QA-first evidence plus the separately authorized
Production cutover completed on 2026-07-29.

## Purpose

The product runtime has retired human Student Number, optional Display Name,
Admin-created temporary passwords, and Admin password resets. Three database
fields remain as compatibility storage:

- `User.mustResetPwd`
- `User.displayName`
- `Student.studentId` (the retired human Student Number, not internal
  `studentId` foreign-key symbols that point to `User.id`)

Academic compatibility fields (`AcademicYear`, `Term`, `Class`, `gradeLevel`,
and their nullable relations) are D0 schema debt. They must not be dropped in
the D1 migration or counted as D1 identity approval.

## Read-only preflight

Configure a separate Neon child branch in local secret storage:

```dotenv
DATABASE_URL="postgresql://...production..."
QA_DATABASE_URL="postgresql://...isolated-qa..."
IDENTITY_PRESERVE_EMAIL="verified-owner-email@example.com"
IDENTITY_PRESERVE_EMAIL_VERIFIED="1"
IDENTITY_PRESERVE_LEGACY_IDENTIFIER="Rayzxls"
IDENTITY_PRESERVE_QA_PASSWORD="a-new-QA-only-password"
```

`IDENTITY_PRESERVE_EMAIL` is required. It becomes the canonical Admin email
without printing the address or any personal data.

The destructive drill additionally requires the verification attestation and
a new QA-only fallback password. The password is hashed during import and is
never included in the preserve bundle or command output.

Run:

```powershell
npm run db:identity-compatibility:qa:preflight
npm run qa:release:dependencies
npm run qa:release:dependencies:identity:strict
```

The preflight is read-only and fails closed when QA is missing or resolves to
the primary database. Record only aggregate JSON output. Never paste database
URLs, tokens, password hashes, names, or email addresses into the evidence.

The source dependency gate is separate from the data preflight:

- Preflight proves the isolated QA data is understood.
- The normal gate proves no new retired dependency was added.
- The D1 identity strict gate must reach zero blockers before any destructive
  identity migration. The all-scope strict gate remains the D0 exit gate and is
  expected to report retained academic compatibility debt during D1.

### Preflight evidence: 2026-07-29

The guarded command ran successfully against the configured isolated Neon QA
branch at commit `8ff6e8c` plus this preparation slice:

| Check | QA aggregate |
| --- | ---: |
| Users | 43 |
| Users missing canonical email | 40 |
| Users with unverified email | 2 |
| Users missing complete real name | 41 |
| Users with `mustResetPwd=true` | 0 |
| Users with non-empty legacy Display Name | 0 |
| Students | 19 |
| Synthetic Student Number values | 1 |
| Human-like Student Number values | 18 |

The preserve Admin email was not configured for this historical preflight, so
QA was **not ready** at that point. This result was superseded by the successful
guarded QA drill recorded below. It remains evidence about QA only and does not
inspect or authorize Production.

## Exit conditions before writing migration SQL

1. `mustResetPasswordUsers` is `0`. Any account still marked for forced reset
   must use owner-controlled verified-email recovery before the runtime bridge
   is removed.
2. `usersWithLegacyDisplayName` is `0`, or every value is explicitly accepted
   as disposable QA data.
3. `humanLikeStudentNumbers` is `0`, or every value is explicitly accepted as
   disposable QA data. Synthetic placeholders may be dropped with the column.
4. Every retained User has canonical email and real first/last name.
5. The preserve Admin check finds exactly one active `ADMIN` with verified
   email and real name.
6. `qa:release:dependencies:identity:strict` passes. A reviewed compatibility
   marker is not an exit from this requirement. The all-scope strict gate is
   intentionally deferred to D0.
7. Unit, integration, type, lint, build, and authenticated role acceptance pass
   against the same commit and isolated QA branch.

## Implementation order

Use small commits and keep the application compatible with the old schema
until the final QA migration commit.

1. **Complete 2026-07-29:** bootstrap, seed, onboarding, recovery, auth
   session, and smoke runtime no longer write or read `mustResetPwd`.
2. **Complete 2026-07-29:** removed the obsolete forced-reset route,
   middleware interception, and JWT/session property after the read-only QA
   preflight found zero accounts with `mustResetPwd=true`.
3. **Complete 2026-07-29:** removed the remaining anonymization write and
   assertion for legacy `displayName`.
4. **Complete 2026-07-29:** stopped creating synthetic
   `Student.studentId` values without renaming internal
   Enrollment/Submission/Attendance relations named `studentId`.
5. **Complete 2026-07-29:** removed the three compatibility fields from the
   current Prisma schema and generated one narrowly scoped migration that drops
   only their columns/index.
6. **Complete 2026-07-29:** generated Prisma Client, ran the verification set,
   and deployed the migration only through `db:migrate:qa:deploy`.
7. **Complete 2026-07-29:** repeated guarded verification and preflight. All
   three legacy schema booleans are false and automated normal-role integration
   flows pass.

Do not combine D1 identity drops with D0 Academic Year/Term/Class drops.

### Runtime retirement evidence: 2026-07-29

- TypeScript, repository ESLint, Prettier, full unit `779/779`, and Production
  build pass.
- The reviewed dependency gate reports
  `21 blocker / 142 review / 163 total`, with zero new retired dependencies
  and 29 blockers resolved from the previous baseline.
- The strict gate still fails by design on 3 D1 identity schema fields plus
  18 D0 academic compatibility fields. This is not approval to rewrite the
  baseline or apply destructive SQL.
- No QA or Production schema/data mutation occurred in this runtime slice.

## Rayzxls preserve bundle

Before any disposable QA reset rehearsal, export only the approved Admin
identity bundle:

- immutable internal User id
- Admin Role and active account status
- canonical verified email
- real first and last name
- avatar attachment id only when the private object exists
- Theme preference
- required consent versions/timestamps

Do not export the old identifier/username, password hash, sessions, unrelated
Audit rows, courses, enrollment, scores, attendance, submissions, Lessons,
Quizzes, notifications, or other disposable development data.

The import must be idempotent and fail closed when the email is absent,
duplicated, unverified, or already belongs to another Role. The bundle must
never be committed to Git.

## QA acceptance

On the isolated branch, verify:

- Google Student registration and returning sign-in
- email/password Student registration and email verification
- fallback-password setup and sign-in
- password recovery and verified-email change
- Teacher Invite issue, replacement, revoke, acceptance, and returning sign-in
- Admin sign-in and observer-only permissions
- Profile real-name change, Avatar upload, Theme, and account lifecycle
- course creation with teacher-owned labels, join, Feed, Lesson, Quiz,
  submission/review, score publication, attendance, notifications, moderation,
  private files, desktop/mobile, and all Themes
- the preserved Admin can sign in and no disposable academic data was imported

## Rollback

Column drops are not rolled back by reconstructing guessed personal data.

## Production cutover record: 2026-07-29

The owner separately authorized Production after the isolated QA drill. The
guarded Production runner confirmed that `DATABASE_URL` and `QA_DATABASE_URL`
resolved to different Neon branch identities, then applied
`20260729010000_drop_identity_compatibility_fields`. Production migration
status reports all ten migrations up to date.

The owner also authorized a complete application-data reset on both QA and
Production. Each database was verified to contain one active username-only
Admin, no email, no linked auth identity, and no other application rows.
Aggregate inventories written before truncation are not backups.

1. Create a disposable restore-drill child from the pre-migration QA branch.
2. Record branch names, commit SHA, migration name, and restore point.
3. Apply the migration to the isolated QA branch only.
4. If acceptance fails, stop the QA app and point it back to the untouched
   pre-migration QA branch or reset the disposable child to the recorded point.
5. Verify application tables, the preserved Admin, and read-only smoke.
6. Fix forward in code/migration and repeat the drill.

Never reset Production as a rollback experiment. Production requires a new,
separately named approval after backup/restore evidence, zero P0/P1 QA defects,
and an explicit cutover checklist.

## Guarded QA drill commands

After configuring the private preserve variables, run these commands in order:

```powershell
npm run db:identity-d1:qa:export
npm run db:identity-d1:qa:reset
npm run db:migrate:qa:deploy
npm run db:identity-d1:qa:verify
```

If the verified preserve email is already attached to a disposable QA user,
the export remains blocked by default. Reassign it only after the owner has
explicitly confirmed that the disposable identity may be removed:

```powershell
npm run db:identity-d1:qa:export -- --confirm-email-reassignment=D1_QA_EMAIL_REASSIGN
```

Every command replaces the active datasource with `QA_DATABASE_URL` and
compares its normalized identity with `DATABASE_URL`. A missing QA URL, a QA
URL equal to the primary URL, or a changed active datasource fails closed.
The reset command also requires the literal confirmation token embedded in the
package script. The private preserve bundle and checksum are written under
`.local-storage/identity-d1/`, which is excluded from Git.

## Successful isolated QA drill: 2026-07-29

The guarded D1 drill completed against the configured isolated Neon QA branch.
The scripts compared the normalized QA database identity with `DATABASE_URL`
before every destructive step. Production was not connected to or modified.

The owner explicitly approved moving the configured verified preserve email
from a disposable QA Teacher to the preserved Admin. The export required the
additional `D1_QA_EMAIL_REASSIGN` confirmation token; it remains blocked by
default without that token. The disposable Teacher and its Google identity
were intentionally not preserved.

| Check | Result |
| --- | --- |
| Preserve export | Bundle and SHA-256 checksum created outside Git |
| QA reset | 42 application tables cleared |
| Preserve import | Exactly 1 active Admin restored |
| D1 migration | `20260729010000_drop_identity_compatibility_fields` applied |
| Prisma migration status | 9 migrations; schema up to date |
| Legacy identity columns | 0 present |
| Post-drill preflight | `destructiveQaMigrationReady: true` |
| Identity strict dependency gate | 0 blocker, 0 review |
| Unit tests | 94 files; 780 tests passed |
| Integration tests | Complete isolated integration command exited successfully |
| Lint / TypeScript / Production build | Passed |
| Preserved Admin sign-in | Auth.js credential session returned Role `ADMIN` and a User id |
| Preserved Admin authorization | `/admin/dashboard` returned `200` with the authenticated session |
| Safe route smoke | 12/12 public and protected-route checks passed |

Automated integration acceptance covered Teacher, Student, permissions, Feed,
submission/review, score, attendance, notification, moderation, and identity
service paths against the migrated QA schema. The preserved Admin acceptance
used the canonical email as the credential identifier; the legacy identifier
is an export selector only and is not a supported sign-in identifier after D1.
Interactive Google OAuth and Resend delivery remain separate manual acceptance
checks and are not implied by the automated result.

The project-level Neon branch reset and application recovery procedure was
successfully rehearsed on disposable QA branches on 2026-07-14, as recorded in
`docs/DATA-SAFETY-RUNBOOK.md`. A new D1-specific restore-child was not created
in this run because Neon branch-management credentials and local
`pg_dump`/`pg_restore` tooling were not configured, and branch lifecycle
operations remain owner-only. This does not change the isolated D1 QA result.
At the time of this isolated QA record, Production remained unauthorized. That
historical restriction was later superseded by the separately approved
Production cutover recorded above.
