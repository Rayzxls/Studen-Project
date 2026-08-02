# Migration Baseline Production Preflight — 2026-08-03

## Outcome

Production baseline adoption is prepared but has not been executed. Production
still contains the exact 14 complete legacy `_prisma_migrations` rows.

The owner created a new Neon child from `production` and supplied its connection
only through ignored local environment state. The repository does not contain a
connection string, password, endpoint identifier, row value, or fingerprint.
The backup uses a direct Neon endpoint and is a third normalized database
identity, distinct from Production, QA, and the retained QA backup.

## Read-only evidence

The guarded Production preflight compared Production with the new backup and
passed across:

- all eight columns of all 14 complete legacy migration records;
- 41 application tables and 92 total application rows;
- per-table row counts and content fingerprints;
- all public sequence names and values;
- the Prisma datamodel diff;
- the `notification_post_once` partial unique index; and
- representative Prisma reads.

Command:

```powershell
npm run db:migration-baseline:production:preflight
```

The preflight acquires a target-specific transaction advisory lock but performs
no database mutation. Production and the backup retained their original
migration bookkeeping.

## Prepared guarded commands

The runner keeps QA as its default target. Production requires the explicit
`--target=production` path embedded in these package commands, a distinct direct
backup, and separate exact tokens:

```powershell
npm run db:migration-baseline:production:adopt -- --confirm=ADOPT_BASELINE_ON_PRODUCTION_20260803
npm run db:migration-baseline:production:status
npm run db:migration-baseline:production:deploy -- --confirm=DEPLOY_BASELINE_PRODUCTION_MIGRATIONS
npm run db:migration-baseline:production:rollback -- --confirm=ROLLBACK_BASELINE_ON_PRODUCTION_20260803
```

Unconfirmed adoption and deploy were tested and fail before database access.
Production adoption will create the in-database recovery schema
`beagle_baseline_production_backup_20260803`, copy all eight migration columns,
verify the copy in both directions, record the reviewed baseline, and remove
only the 14 legacy bookkeeping rows. It then proves baseline status and deploy,
schema equality, application-table fingerprints, sequences, the partial index,
and representative reads. Any adoption failure after the recovery schema is
created restores the legacy bookkeeping automatically.

## Approval boundary

This preparation and read-only preflight do not authorize Production mutation.
Do not run adoption until the owner explicitly approves baseline adoption on
Production after reviewing this evidence. Keep schema migrations frozen and
retain the new Production backup throughout the decision and verification
window.
