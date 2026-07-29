# D1 Identity Compatibility Migration

**Status:** runtime compatibility retired; schema migration not authorized
**Updated:** 2026-07-29  
**Scope:** isolated Neon QA first; no Production schema or data mutation is
authorized by this document.

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
IDENTITY_PRESERVE_LEGACY_IDENTIFIER="Razyxls"
IDENTITY_PRESERVE_QA_PASSWORD="a-new-QA-only-password"
```

`IDENTITY_PRESERVE_EMAIL` is optional. It checks the selected Admin without
printing the address or any personal data.

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

The preserve Admin email was not configured for this run. QA is **not ready**
for a destructive identity migration: refresh or deliberately reseed the
isolated branch, configure the preserve target privately, and repeat preflight.
This result is evidence about QA only and does not inspect or authorize
Production.

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
4. Stop creating synthetic `Student.studentId` values. Do not rename or delete
   internal Enrollment/Submission/Attendance relations named `studentId`.
5. Remove the three fields from the current Prisma schema and generate one
   narrowly scoped migration that drops only their columns/index.
6. Generate Prisma Client, run the complete verification set, then deploy the
   migration only through `db:migrate:qa:deploy`.
7. Repeat the read-only preflight. The schema booleans should be false and all
   normal role flows must remain functional.

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

## Razyxls preserve bundle

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

Every command replaces the active datasource with `QA_DATABASE_URL` and
compares its normalized identity with `DATABASE_URL`. A missing QA URL, a QA
URL equal to the primary URL, or a changed active datasource fails closed.
The reset command also requires the literal confirmation token embedded in the
package script. The private preserve bundle and checksum are written under
`.local-storage/identity-d1/`, which is excluded from Git.
