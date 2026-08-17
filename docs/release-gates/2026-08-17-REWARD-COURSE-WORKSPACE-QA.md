# Reward Course Workspace — isolated QA acceptance

**Date:** 2026-08-17

**Scope:** PR #84 (`eb5e5d9`)

**Environment:** local isolated-QA server on port 3100, backed by the configured
Neon QA branch

## Safety boundary

`pnpm dev:qa` passed the existing database-identity guard before replacing the
active datasource with `QA_DATABASE_URL`. The isolated-server policy enabled
`REWARD_ENABLED=1` and `REWARD_MUTATIONS_ENABLED=1` only after that guard.
Production environment values and Production data were not changed during this
acceptance run.

The Reward migration was already current on QA and Production. This acceptance
added no schema or migration.

## Automated evidence

PR #84 passed all seven required checks before merge: Dependency Gate, Unit
Tests, Integration Tests, Lint and Typecheck, Build, Vercel Preview, and Vercel
Preview Comments. Post-merge main CI also passed Dependency Gate, Unit Tests,
Integration Tests, Lint and Typecheck, and Build. The Vercel Production code
deployment completed successfully while Production Reward flags remained off.

Focused Reward integration coverage proves:

- exact owning-Teacher and active-Student authorization;
- real-evidence candidates from submitted assignments, present attendance, and
  published scores;
- one award per achievement and immutable reversal entries;
- archived-course and removed-enrollment mutation freezes;
- Student self-only projection and reward-history erasure during account
  anonymization.

## Authenticated browser acceptance

The seeded Teacher and Student accounts exercised one active QA course through
the real UI:

1. The Teacher opened the Reward tab and saw five eligible achievements from
   real course evidence.
2. The Teacher awarded 7 points for a present-attendance achievement with a
   visible reason.
3. The Teacher dashboard changed from 0 to 7 points, from 0/1 to 1/1 Students
   with points, and from 0 to 1 ledger entry. The paid achievement disappeared
   from the eligible list, preventing duplicate payment.
4. The Student opened **My points** and saw only their own 7-point balance and
   the matching `+7` entry/reason.
5. The Teacher reversed the award with a second visible reason. The system
   appended `-7` instead of deleting or editing the original entry.
6. The Student then saw a zero balance and both entries, with the reversal
   identified as a correction.

The Teacher and Student Reward pages produced no browser console errors during
the mutation cycle. Earlier desktop and 375 px checks passed without horizontal
overflow. A general development-only LCP warning for the existing cloud banner
was observed and is unrelated to Reward behavior.

## Result and next gate

**Accepted on isolated QA.** The first Course Reward workspace is ready for a
separate Production flag decision. That decision must explicitly cover both
`REWARD_ENABLED` and `REWARD_MUTATIONS_ENABLED`; schema readiness, code deploy,
and QA acceptance do not enable either flag automatically.

Reward catalogue/redemption and System Quest remain future slices.
