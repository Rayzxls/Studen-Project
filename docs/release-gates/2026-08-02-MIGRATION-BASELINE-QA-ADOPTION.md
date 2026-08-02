# Migration Baseline QA Adoption — 2026-08-02

## Outcome

QA adopted the reviewed squashed migration baseline after an explicit owner
approval limited to QA. Production was not modified.

The QA branch is `beagle-qa-20260714`. Its full Neon backup branch is
`qa-baseline-backup-2026-08-02`, created from the current QA head with data and
schema and retained for seven days. No connection string, password, row value,
or fingerprint is recorded here.

## Restorable-backup preflight

The backup used a third normalized database identity, distinct from Production
and QA, and a direct Neon endpoint. The guarded read-only preflight verified
that QA and its backup matched exactly across:

- all eight columns of 14 complete legacy `_prisma_migrations` records;
- 41 application tables;
- 96 total application rows;
- per-table row counts and content fingerprints;
- all public sequence names and values;
- the Prisma datamodel diff;
- the `notification_post_once` partial unique index; and
- representative Prisma reads.

Command:

```powershell
npm run db:migration-baseline:qa:preflight
```

## Adoption

The owner approved: “create a backup and perform baseline adoption on QA only;
do not touch Production.” The mutation required the separate exact token:

```powershell
npm run db:migration-baseline:qa:adopt -- --confirm=ADOPT_BASELINE_ON_QA_20260802
```

The runner:

1. rejected a Production target by normalized identity;
2. re-ran the complete QA-to-backup preflight;
3. copied all eight migration-bookkeeping columns to
   `beagle_baseline_qa_backup_20260802` inside QA;
4. verified that copy with `EXCEPT ALL` in both directions;
5. recorded the reviewed baseline and observed the exact 15-row transition;
6. deleted exactly 14 legacy rows, leaving one baseline row;
7. proved baseline-only `migrate status` and `migrate deploy` were clean; and
8. repeated schema, partial-index, Prisma-query, table-fingerprint, and sequence
   checks with no application-data change.

Two fresh status processes passed after adoption:

```powershell
npm run db:migration-baseline:qa:status
npm run db:migrate:qa:status
```

The legacy `db:migrate:qa:status` and `db:migrate:qa:deploy` aliases now route
through the baseline-aware QA runner. Deploy remains fail-closed and requires
`--confirm=DEPLOY_BASELINE_QA_MIGRATIONS`.

## Rollback

The 14-row bookkeeping copy remains inside QA, and the full Neon branch remains
the database-level recovery point. The exact guarded bookkeeping rollback is:

```powershell
npm run db:migration-baseline:qa:rollback -- --confirm=ROLLBACK_BASELINE_ON_QA_20260802
```

Rollback truncates only QA's `_prisma_migrations`, restores all eight columns,
compares the result byte-for-byte, proves the legacy history and schema, checks
that application data did not change, and then removes the in-database backup
schema. It has not been invoked because the adopted QA state passed every
verification.

If database-level recovery is required instead, restore or reset QA from
`qa-baseline-backup-2026-08-02` before its seven-day expiration.

## Freeze and Production boundary

The candidate intentionally remains outside `prisma/migrations` while
Production retains the 14-row history. Do not add or deploy new schema
migrations during this interval.

Production requires a new current restorable backup and a separate explicit
approval that names Production. Neither the clone rehearsal nor this QA
approval authorizes Production adoption.
