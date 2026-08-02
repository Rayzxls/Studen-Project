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

## Adoption boundary — not approved

Do not move the candidate into `prisma/migrations`, edit existing migration
files, or run `prisma migrate resolve` on QA or Production yet. Those databases
already contain 14 applied migration records. Simply adding or replacing a
baseline would make the filesystem and `_prisma_migrations` histories disagree
and could attempt to create tables that already contain live data.

Before adoption, a separate change must:

1. freeze schema changes for the duration of the rehearsal;
2. take and verify a restorable database backup;
3. clone the deployed schema and `_prisma_migrations` rows into a disposable
   database;
4. rehearse the exact bookkeeping reconciliation on that clone;
5. prove `migrate status` and `migrate deploy` are clean after reconciliation;
6. prove application queries and the partial index still work; and
7. document rollback commands and decision owners before touching QA, followed
   by a second explicit approval before Production.

Until that rehearsal succeeds, CI continues using `prisma db push` for its
disposable integration database. Production and QA migration bookkeeping stays
unchanged.
