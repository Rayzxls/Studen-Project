# Reward V2 Course Milestone QA migration — 2026-08-17

## Approval and scope

The owner explicitly approved: “deploy Course Reward Milestone migration on
QA”. This approval covered the isolated QA database only. It did not authorize
a Production migration or any feature-flag cutover.

## Identity and preflight

The guarded QA Prisma runner selected:

- database: `neondb`
- schema: `public`
- host: `ep-autumn-wave-aotw5g6k-pooler.c-2.ap-southeast-1.aws.neon.tech`

Preflight found seven migration directories and exactly one unapplied
migration: `20260817050000_add_course_reward_milestones`.

## Deployment result

`pnpm db:migrate:qa:deploy` applied the migration successfully. A separate
`pnpm db:migrate:qa:status` then reported: `Database schema is up to date!`
All seven migrations are current on QA.

The migration is additive. It creates `CourseRewardTier`,
`CourseRewardTierRevision`, and `CourseRewardClaim` plus their enum,
constraints, indexes, and foreign keys. It does not alter or delete the legacy
`RewardLedgerEntry` data.

## Focused QA verification

The isolated test guard ran
`tests/integration/permissions/reward-course-milestones.test.ts` against QA.
All four tests passed:

1. fail-closed mutation gate, exact owning-Teacher permission, duplicate
   threshold rejection, and one immutable initial revision;
2. canonical published Score Total eligibility, highest-tier claim, lower-tier
   supersession, and duplicate-claim idempotency;
3. fulfil tier 50, raise the published score, then claim tier 80, with unrelated
   Teacher denial; and
4. reason-required rejection and mutation freeze after enrolment removal.

The fixture cleanup completed after every test and removed its temporary users,
course, enrolment, scores, tiers, revisions, claims, and audit records.

## Remaining gates

- Production database was not touched.
- `REWARD_ENABLED` and `REWARD_MUTATIONS_ENABLED` remain off on Production.
- `COURSE_REWARD_MILESTONES_ENABLED` and
  `COURSE_REWARD_MILESTONES_MUTATIONS_ENABLED` remain off on Production.
- Teacher/Student UI, QA browser acceptance, Production migration, and any
  Production flag cutover remain separately gated work.
