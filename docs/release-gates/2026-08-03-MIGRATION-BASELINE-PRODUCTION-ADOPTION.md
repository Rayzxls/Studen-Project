# Migration Baseline Production Adoption — 2026-08-03

## Outcome

The owner explicitly approved baseline adoption on Production. The guarded
runner repeated the current backup preflight and changed Production migration
bookkeeping from 14 complete legacy rows to the single reviewed migration:

```text
00000000000000_squashed_baseline
```

No application table, row, sequence, index, or Prisma-visible schema changed.

## Adoption evidence

Immediately before mutation, Production and its direct Neon backup matched
exactly across all eight migration columns, 41 application tables, 92 total
application rows, table fingerprints, public sequences, schema diff, the
`notification_post_once` partial unique index, and representative Prisma reads.

The adoption then:

1. acquired the Production-specific advisory lock;
2. created `beagle_baseline_production_backup_20260803` inside Production;
3. copied and compared all eight columns of the 14 legacy migration rows;
4. recorded the reviewed baseline migration;
5. removed exactly the 14 legacy bookkeeping rows;
6. proved baseline status and deploy were clean; and
7. repeated schema, data-fingerprint, sequence, index, and Prisma-read checks.

Two fresh processes subsequently passed Production migration status. The
unconfirmed Production deploy command remained fail-closed. Public Production
smoke returned `200` for the landing and login surfaces, the protected Dashboard
redirected to Login, and the cron endpoint without its secret returned `401`.

## Active repository cutover

The adopted migration is now the only active directory under
`prisma/migrations`. The 14 legacy migration files, the temporary candidate
copy, and the one-time rehearsal/adoption runners were removed from the active
tree; they remain recoverable from Git history and PRs #46–#48.

CI verifies the active baseline in a random isolated schema and then uses
`prisma migrate deploy` to build the integration database from empty. The
baseline includes the partial unique notification index that previously
required a separate raw-SQL CI step.

## Recovery

Keep both recovery layers during the acceptance window:

- the full owner-created Neon child of Production; and
- `beagle_baseline_production_backup_20260803` inside Production.

The legacy source and guarded rollback implementation remain available at Git
commit `c65a1ca`. Prefer restoring the full Neon child if database-level recovery
is required after active-path cutover. Do not delete either recovery layer until
Production real-device acceptance and observability checks are complete.
