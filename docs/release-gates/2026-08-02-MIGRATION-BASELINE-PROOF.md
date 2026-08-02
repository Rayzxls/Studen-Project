# Migration Baseline Proof — 2026-08-02

## Outcome

The active Prisma migration history still cannot create Beagle Classroom from
an empty PostgreSQL schema. A candidate squashed baseline now can, and it is
verified without changing either QA or Production's active `public` schema.

This is a recovery proof, not an adoption. The candidate deliberately lives at
`prisma/baseline/20260802010000_squashed_baseline/migration.sql`, outside
`prisma/migrations`, so `prisma migrate deploy` cannot discover or apply it.

## Reproduced gap

- `prisma/schema.prisma` declares 41 models.
- The active migration files contain `CREATE TABLE` statements for 26 of those
  models.
- The 15 models missing from migration creation history are:
  `CourseOffering`, `Enrollment`, `TimetableSlot`, `Session`,
  `AttendanceRecord`, `ScoreItem`, `ScoreEntry`, `Assignment`, `Submission`,
  `SubmissionVersion`, `FileAttachment`, `Comment`, `Notification`, `Material`,
  and `Announcement`.
- Running the active history against an empty disposable schema fails when a
  later migration reaches a relation that the historical `db push` workflow
  created but migrations never did.

Reproduce safely with:

```powershell
npm run qa:migration-history:prove-gap
```

The command requires the existing database isolation guard, creates only a
random `beagle_baseline_<16 hex>` schema in QA, and drops that exact schema in a
`finally` block. It refuses to run when QA and the primary database resolve to
the same database identity.

Both proof modes also share a transaction-scoped PostgreSQL advisory lock.
This serializes concurrent verifier processes because Neon pooled connections
can reuse session state across schemas. In `current-history` mode only, the
inner Prisma session lock is disabled after the verifier lock is acquired; that
exception applies only to the disposable proof and does not change any normal
QA or Production migration command.

## Candidate proof

The candidate was generated from an empty source to the current Prisma
datamodel with Prisma 6.19.3. The partial unique index
`notification_post_once`, which Prisma cannot express, is included explicitly.
Its reviewed SHA-256 is
`e6ae697be28775d536bf613652522b213056f2d7096a4c3add20b551a76f135e`;
any regenerated candidate must be re-verified and update this evidence.

Verify safely with:

```powershell
npm run qa:migration-baseline:verify
```

Acceptance requires all of the following:

1. the SQL applies to a random empty schema;
2. the schema contains exactly 41 application tables;
3. `prisma migrate diff` reports no datamodel difference;
4. `notification_post_once` exists as a partial unique index; and
5. the random schema is confirmed absent after cleanup.

CI runs the same proof inside its disposable PostgreSQL service with
`npm run qa:migration-baseline:verify:ci`.

## Synthetic bookkeeping rehearsal

The repository also has a fail-closed rehearsal for the migration-history
transition proposed by Prisma 6's
[baselining workflow](https://www.prisma.io/docs/orm/v6/prisma-migrate/workflows/baselining):

```powershell
npm run qa:migration-baseline:rehearse
```

The rehearsal never moves the candidate into the active migration directory.
Instead, it creates a temporary Prisma workspace and two random QA schemas. It
then:

1. builds a shape-equivalent empty clone from the candidate baseline;
2. asks Prisma to record the 14 legacy migrations as applied;
3. confirms the current migration history is clean;
4. backs up all eight `_prisma_migrations` columns into the second schema;
5. records the squashed baseline, verifies the exact 15-row transition set,
   and deletes exactly the 14 legacy rows;
6. proves baseline-only `migrate status` and `migrate deploy` are clean;
7. proves the schema, partial index, and representative Prisma queries work;
8. removes the baseline row and restores the original 14 rows;
9. compares the restored bookkeeping byte-for-byte with the backup; and
10. proves the legacy history is clean again before deleting both schemas and
    the temporary filesystem workspace.

Both local and CI rehearsals serialize through a transaction-scoped PostgreSQL
advisory lock. Prisma's session advisory lock is disabled only inside this
already-serialized disposable workflow because a pooled connection can retain
session lock state after the client exits. When `QA_DATABASE_URL` is a Neon
pooled URL, disposable-schema tools switch to the equivalent direct Neon
endpoint after the QA-vs-primary identity guard passes. Every temporary URL
also pins its random schema through PostgreSQL's connection-startup `options`
instead of relying on a reusable session's prior `search_path`. Non-Neon hosts,
including CI's local PostgreSQL service, are unchanged apart from that explicit
per-connection schema pin.

This proves the mechanics and rollback against an empty shape-equivalent
clone. It does **not** prove data preservation, copy the deployed database, or
authorize a bookkeeping change on QA or Production.

## Deployment-clone rehearsal

The remaining data-preservation proof completed on 2026-08-02 against the
dedicated Neon child branch `baseline-rehearsal-2026-08-02`, created from the
current `production` parent with data and schema. The reusable runner is:

```powershell
npm run db:migration-baseline:clone:preflight
npm run db:migration-baseline:clone:rehearse -- --confirm=REHEARSE_BASELINE_ON_DEPLOYMENT_CLONE
```

The runner requires `BASELINE_REHEARSAL_DATABASE_URL`, rejects a pooled Neon
connection, rejects any database identity matching `DATABASE_URL` or
`QA_DATABASE_URL`, requires `public`, verifies the reviewed baseline checksum,
and demands an exact confirmation token before mutation. The read-only
preflight found 14 complete legacy migrations, 41 application tables, and 92
application rows.

The rehearsal backed up all eight migration-bookkeeping columns inside a
random recovery schema, recorded the proposed baseline, deleted exactly 14
legacy rows, and proved baseline-only `migrate status` and `migrate deploy`.
It fingerprinted every application table and captured public sequence state
before and after the transition. It then restored all 14 original migration
rows, compared them byte-for-byte, re-ran the active-history and schema checks,
and confirmed the application fingerprints and sequences were unchanged. The
temporary database backup schema and filesystem workspace were both removed.

Full evidence and the remaining approval boundary are recorded in
`docs/release-gates/2026-08-02-MIGRATION-BASELINE-CLONE-REHEARSAL.md`.

## QA adoption

QA adopted the baseline on 2026-08-02 after an explicit owner approval and a
verified Neon backup. The fail-closed runner confirmed the backup matched QA at
14 migration records, 41 tables, 96 application rows, and all public sequence
values. It then transitioned QA to the single baseline record and repeated the
schema, index, Prisma-query, data-fingerprint, and status checks.

The exact original QA bookkeeping remains in
`beagle_baseline_qa_backup_20260802`; the full Neon branch
`qa-baseline-backup-2026-08-02` remains the restorable database backup. Details
and rollback commands are in
`docs/release-gates/2026-08-02-MIGRATION-BASELINE-QA-ADOPTION.md`.

## Production adoption boundary — not approved

Do not move the candidate into `prisma/migrations`, edit existing migration
files, or run `prisma migrate resolve` on Production. Production still contains
the 14 applied legacy migration records. Simply replacing the active migration
directory would make the filesystem and Production bookkeeping disagree.

The deployment-clone rehearsal and QA adoption are complete, but neither
authorizes Production. Before touching Production, take and verify a current
restorable Production backup, maintain the schema-change freeze, obtain a new
explicit owner approval that names Production, and retain a separate exact
rollback path. QA approval must never be treated as Production approval.

Until Production approval occurs, CI continues using `prisma db push` for its
disposable integration database. The candidate remains outside the active
migration directory; Production bookkeeping remains unchanged.
