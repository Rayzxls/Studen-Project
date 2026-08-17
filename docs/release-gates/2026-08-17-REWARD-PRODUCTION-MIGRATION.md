# Reward Foundation Production Migration — 2026-08-17

## Scope and authorization

The owner explicitly authorized applying the Reward foundation migration to
Production. This authorization covered the additive database migration only;
it did not authorize enabling either Reward feature flag.

## Restore point

Immediately before deployment, Neon created
`production-reward-backup-2026-08-17` with data and schema from parent branch
`production`. The branch expires on 2026-08-24 at 09:17 Asia/Bangkok.

If verification had failed, the stop condition was to leave both Reward flags
off and recover through this branch only after separate restore approval. No
manual table drops or ad-hoc rollback SQL were authorized.

## Preflight

- `origin/main` contained PR #81's Reward foundation and PR #82's accepted QA
  migration evidence.
- The local Prisma schema, migration SQL, and guarded Production runner matched
  `origin/main` exactly.
- Production and QA normalized to different Neon branch identities.
- Production migration status found exactly one pending migration:
  `20260814010000_add_reward_ledger_foundation`.
- The same migration had already passed the disposable migration-history gate
  and focused `8/8` integration acceptance on isolated QA.

## Deployment

The confirmation-gated Production runner applied only
`20260814010000_add_reward_ledger_foundation`. Prisma reported the migration
successfully applied.

The migration is additive: it creates the `RewardLedgerEntry` table, Reward
enums, constraints, indexes, and foreign keys. It does not modify existing
application rows.

## Post-migration evidence

- `prisma migrate status` reports all six Production migrations applied and
  the schema up to date.
- `_prisma_migrations` reports the Reward migration as finished and not rolled
  back.
- `RewardLedgerEntry` exists and contains zero rows immediately after
  deployment.
- Production safe smoke passed `12/12`: public pages returned 200, protected
  pages redirected to login, and protected exports returned 401.
- The first smoke command omitted `QA_BASE_URL`, so the script correctly tried
  its inactive `http://localhost:3000` default and produced transport failures.
  Re-running against `https://beagleclassroom.com` passed; this was not a
  Production outage.

## Operational observation

After the restore branch was created, the Neon Free-plan dashboard displayed
the monthly compute allowance at `100.36 / 100 CU-hrs` and marked the limit as
reached. The Production endpoint still answered the complete `12/12` smoke.
This usage warning is separate from the successful migration and should be
reviewed before relying on additional long-running QA/backup computes.

## Subsequent flag cutover

At migration time, `REWARD_ENABLED=0` and `REWARD_MUTATIONS_ENABLED=0` remained
the binding Production state. PR #84 subsequently deployed the first guarded
Course Reward workspace and authenticated isolated-QA acceptance passed on
2026-08-17.

The owner later supplied the separate approval for both flags. The flag change,
redeployment, and authenticated read-only Production acceptance are recorded in
`2026-08-17-REWARD-PRODUCTION-FLAG-CUTOVER.md`.
