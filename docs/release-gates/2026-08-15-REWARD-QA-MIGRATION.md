# Reward Foundation QA Migration — 2026-08-15

## Scope and authorization

The owner approved continuing with the Reward migration on QA only after PR
#81 merged. This authorization did not include Production migration or any
Reward feature-flag change.

## Preflight

- `origin/main` contained merge commit `074f58a` from PR #81.
- PR and post-merge CI passed lint, TypeScript, unit, dependency, integration,
  migration-history, and Production build gates.
- The guarded QA Prisma runner proved `QA_DATABASE_URL` was distinct from the
  primary database before connecting.
- QA migration status found exactly one pending migration:
  `20260814010000_add_reward_ledger_foundation`.
- The target was the configured isolated Neon QA branch; Production was not
  connected or mutated.

## Deployment

The guarded command applied only
`20260814010000_add_reward_ledger_foundation`. It creates the additive
`RewardLedgerEntry` table and its Reward enums, indexes, constraints, and
foreign keys. Prisma reported the migration successfully applied.

No backup branch was created for this additive QA-only migration. If
verification had failed, both Reward flags would have remained off and any QA
reset or restore would have required a separate destructive-QA approval.

## Post-migration evidence

- `prisma migrate status` reports all six QA migrations applied and the schema
  up to date.
- Focused Reward ledger permission/lifecycle integration passed `6/6`.
- Account-anonymization integration passed `2/2`, including Reward history
  deletion while retaining the anonymized academic placeholder.
- The combined focused QA run passed `8/8` and cleaned up its fixtures.
- Award idempotency, owner-only mutation, own-ledger read permission,
  outsider denial, archived-course freeze, removed-enrollment freeze,
  append-only reversal, and Reward audit creation were exercised against the
  migrated QA table.

## Flags and next gate

`REWARD_ENABLED` and `REWARD_MUTATIONS_ENABLED` remain disabled outside the
isolated test runner. No user-facing Reward route or UI is exposed by this
foundation.

Production remains unchanged. Applying this migration to Production requires
a separate explicit owner approval. Feature-flag rollout remains a later gate
after the Production schema is ready and the first Reward UI/API slice has
passed QA.
