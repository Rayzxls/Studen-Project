# Account Lifecycle Rollout

**Status:** QA persistence, transaction wiring, and feature-flagged Admin UI are
verified. Production migration completed on 2026-07-15; behavior cutover remains
disabled until the Vercel Production flag is explicitly enabled and redeployed.

## Safety boundary

- `DATABASE_URL` is Production. Never use it for migration rehearsal, tests, or repair.
- `QA_DATABASE_URL` must resolve to a different database identity before any guarded command starts.
- The first release is additive. Keep `User.isActive`, `User.deletedAt`, and
  `Student.anonymized` until the canonical status has run in Production through
  an observation period and rollback is no longer required.
- Admin remains a read-only observer of teaching data. Account lifecycle actions
  do not grant permission to mutate scores, attendance, assignments, or submissions.

## Rollout gates

### Gate 1: QA persistence

1. Apply `20260715010000_add_account_lifecycle_foundation` with
   `npm run db:migrate:qa:deploy`.
2. Run `npm run db:migrate:qa:verify-account-status`.
3. Require `legacyMismatchCount = 0` and an empty lifecycle history before the
   first transition test.

**Latest result 2026-07-15:** passed on the isolated QA branch. Twelve accounts
map to Active, with zero legacy mismatches and zero lifecycle events after the
disposable transition test cleaned up its fixtures.

### Gate 2: compatibility release

1. Deploy read-only status presentation derived from legacy flags.
2. Route login and password-change availability through the shared compatibility
   function without changing behavior.
3. Verify Student, Teacher, and Admin login; forced password reset; logout; and
   denied login for legacy inactive/deleted accounts.

**Automated result 2026-07-15:** shared compatibility behavior, read-only Admin
status presentation, 486 unit tests, TypeScript, and targeted ESLint pass. Manual
role login, forced-reset, logout, and theme/viewports remain release acceptance.

**Mutation result 2026-07-15:** the Prisma repository and Admin suspend/reactivate
action passed an isolated QA integration test. The test verifies canonical and
legacy status synchronization, active-session revocation, append-only lifecycle
history, Audit Log evidence, reactivation, and cleanup of disposable fixtures.
The action UI is server-flagged and remains absent while
`ACCOUNT_LIFECYCLE_MUTATIONS_ENABLED` is not exactly `1`.

### Gate 3: Production schema

Requires a separate explicit approval immediately before execution.

1. Confirm a current Neon restore point and record the application commit.
2. Confirm the migration contains only additive enum/table/column/index/FK work
   plus the reviewed legacy backfill.
3. Apply migration before deploying code that selects `accountStatus` or writes
   `AccountLifecycleEvent`.
4. Run the aggregate verifier against Production only through a dedicated,
   separately reviewed read-only command. Do not print URLs or personal data.
5. Stop rollout on any mismatch. Do not compensate with ad-hoc row edits.

**Production result 2026-07-15:** completed at application merge commit
`7c18813`. Both additive migrations applied through `prisma migrate deploy`.
Aggregate verification found four Active accounts, zero canonical/legacy
mismatches, zero lifecycle events, and an up-to-date migration history.

### Gate 4: canonical read and dual write

1. Read canonical status behind a server-side feature flag.
2. During the compatibility window, every lifecycle transition writes the
   canonical status, legacy flags, lifecycle history, session revocation, and
   Audit Log in one database transaction.
3. Monitor canonical/legacy mismatches and authentication denials.
4. Expose lifecycle mutations only after authorization and transition tests pass.

## Rollback

- Behavior rollback: disable canonical reads and lifecycle mutations; legacy
  authentication remains available because the old columns were retained.
- Application rollback: deploy the previous compatible application commit.
- Database rollback: do not drop the enum, column, history table, or indexes in
  an incident. Leave additive structures in place and apply a reviewed forward fix.
- Neon restore is the last resort for database corruption, not a normal feature rollback.
- Anonymization has no behavioral rollback and therefore remains disabled until
  its evidence-preservation and open-dispute checks pass separately.

## Next implementation slice

1. Complete manual compatibility QA for login and the Admin account-detail action
   in Light, Dark, Cream, desktop, and mobile views on the isolated QA server.
2. Production schema is complete. Keep the mutation flag disabled until the
   Vercel environment cutover and post-redeploy role/theme smoke test are complete.
3. Before enabling Production behavior, rerun self-action, stale-state,
   last-active-Admin, rollback, and session-revocation acceptance against QA and
   record the deployed application commit.
4. After the compatibility window, design termination/restoration and irreversible
   anonymization as separate slices. They are not exposed by the current UI.
5. The Moderation Center now exists as a separate case workflow and remains
   isolated from account-lifecycle transactions. Accept and enable each feature
   independently; never combine their state changes in one transaction.
