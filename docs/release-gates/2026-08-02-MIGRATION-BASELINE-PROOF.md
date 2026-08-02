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

## Adoption boundary — not approved

Do not move the candidate into `prisma/migrations`, edit existing migration
files, or run `prisma migrate resolve` on QA or Production yet. Those databases
already contain 14 applied migration records. Simply adding or replacing a
baseline would make the filesystem and `_prisma_migrations` histories disagree
and could attempt to create tables that already contain live data.

Before adoption, a separate operational rehearsal must still:

1. freeze schema changes for the duration of the rehearsal;
2. take and verify a restorable database backup;
3. clone the deployed schema, data, and `_prisma_migrations` rows into a
   disposable database;
4. run the now-automated bookkeeping reconciliation and rollback on that clone;
5. prove `migrate status` and `migrate deploy` are clean after reconciliation;
6. prove application queries and the partial index still work; and
7. document rollback commands and decision owners before touching QA, followed
   by a second explicit approval before Production.

Until that rehearsal succeeds, CI continues using `prisma db push` for its
disposable integration database. Production and QA migration bookkeeping stays
unchanged.
