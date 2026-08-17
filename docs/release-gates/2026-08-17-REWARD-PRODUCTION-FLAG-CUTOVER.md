# Reward Production Flag Cutover — 2026-08-17

## Scope and authorization

The owner explicitly authorized enabling both Reward flags on Production:

- `REWARD_ENABLED=1`
- `REWARD_MUTATIONS_ENABLED=1`

This cutover changed only the two Vercel Production environment values and
redeployed the already-merged application artifact. It did not run a migration,
change schema, or authorize a test award or reversal against Production data.

## Deployment

The Vercel project `studen-project` accepted both Production environment values.
The existing Production deployment was redeployed as deployment
`dpl_3gbKENy1VaKyaAFXfEhpgtRtBQhn`
(`studen-project-rmtaimung-rayzxls-projects.vercel.app`). It reached Ready and
restored the `https://beagleclassroom.com` alias.

Public smoke returned 200 for `/` and `/login` after the cutover.

## Authenticated Student acceptance

The Production Student account opened the Reward tab for CourseOffering
`cms667u73000fid04q342ojwc` and saw only its own balance and history. Both were
zero at the time of inspection. Attempting to open the Teacher Reward URL did
not expose the Teacher workspace and returned the user to the Student dashboard.
The browser reported no console errors.

## Authenticated Teacher acceptance

The owning Teacher opened the same CourseOffering's Reward tab and saw:

- one enrolled Student;
- a zero course balance and zero ledger entries; and
- two real eligible achievements: a submitted Assignment and a published
  `5/9` Score Entry.

The Teacher opened the award form, confirmed that both achievements were
selectable and protected by the one-award-per-achievement rule, then cancelled.
No award or reversal was submitted, no Production Reward ledger row was created,
and the browser reported no console errors or warnings.

## Result

**Accepted on Production.** Reward V1 is live for the owning Teacher and active
Students with both flags enabled. The guarded migration, isolated-QA mutation
cycle, role boundaries, and authenticated read-only Production surfaces have
all passed their release gates.

Catalogue/redemption and System Quest remain independent future slices and are
not authorized by this cutover.
