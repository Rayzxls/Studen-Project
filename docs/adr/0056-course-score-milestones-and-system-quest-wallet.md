# Course score milestones and the System Quest wallet are separate reward systems

**Status:** Accepted on 2026-08-17. This ADR supersedes the Course Reward
economy and random System Quest payout in
[ADR-0051](./0051-rewards-are-a-ledger-with-two-economies.md). ADR-0051 remains
the historical record for the deployed V1 ledger and for lifecycle decisions
that this ADR does not replace.

Reward V1 proved that a guarded, auditable reward workspace can ship, but its
product model was wrong. It asked a Teacher to convert academic evidence into a
second course-points balance and manually award those points. The intended
product has two different jobs instead:

1. a Teacher promises course rewards at real Score Total milestones; and
2. Admin runs an independent System Quest wallet and catalogue.

They share visual language, but they do not share points, eligibility, owners,
or redemption rules.

## Course rewards derive from the existing Score Total

A Course Reward tier belongs to one `CourseOffering`. Only its owning Teacher
may create, edit, reorder, archive, or fulfil that tier. A tier has a title,
description, fulfilment instructions, and a unique threshold from 0 through
100.

The threshold reads the same canonical Score Total already shown to the
Student: `sum(ScoreEntry.value) / sum(ScoreItem.fullScore) * 100`, using only
published Score Items. It does not read draft scores, invent reward points, or
let a Teacher award eligibility manually. The UI must show the Student's
current Score Total and the published-score denominator so a changing total is
explainable while a course is still in progress.

Course tiers must be strictly increasing. They are promises to every eligible
Student, not limited-stock prizes. A Teacher must not configure a milestone
that only some equally eligible Students can receive.

## A Student claims the highest eligible unclaimed tier

The Student sees a milestone ladder but may submit only one claim at a time:
the highest tier whose threshold is at or below their current Score Total and
which has not already been claimed.

- If the Student claimed 50 earlier and later reaches 80, they may claim 80.
- If the Student first opens rewards at 80 and has never claimed 50, they claim
  80; every lower eligible unclaimed tier becomes `SUPERSEDED` and cannot be
  back-claimed.
- Claim submission re-computes Score Total server-side and is idempotent. The
  browser never decides eligibility.

A claim stores an immutable snapshot of the tier title, threshold and version,
the Student's Score Total, earned-point numerator, published full-score
denominator, and claim time. Later tier edits cannot rewrite old claims.

The fulfilment lifecycle is `PENDING -> FULFILLED` or `PENDING -> REJECTED`.
Only the owning Teacher may fulfil or reject, and rejection requires a reason.
A correction after fulfilment never claws a reward back. If a score correction
invalidates a pending claim, the Teacher may reject it with the correction as
the reason; the Student can become eligible again from future published scores.

Removed enrolments and archived courses retain readable history but freeze new
claims and fulfilment. Restoring the same relationship thaws it. Account
anonymization cancels pending claims and removes identifiable reward history,
following the privacy rationale in ADR-0051.

## System Quests earn a separate system wallet

Admin defines System Quest templates and the system catalogue. A quest can
count an auditable action such as submitting assignments or attending sessions,
but it never reads or aggregates academic scores. Admin still cannot enter
scores, mark attendance, create coursework, or alter any academic record.

Each quest advertises one fixed point payout. Completion is idempotent for the
quest occurrence, and the immutable `SYSTEM` ledger remains the source of truth
for the wallet. Random payouts, rerolls, paid chances, and loot-box mechanics
are not part of the product.

System catalogue rewards should help the Student inside Beagle Classroom:

- profile frames, badges, titles, and trophy-shelf certificates;
- Beagle mascot outfits and dashboard/theme packs;
- chat stickers and reaction packs; and
- planner, checklist, or study-template packs.

Academic and accessibility capabilities are never rewards. A catalogue item
must not change a score, attendance, due date, submission permission, course
access, core communication, or an accessibility setting. Digital items may be
fulfilled automatically; physical or manually fulfilled system items are a
later, explicitly scoped slice.

## Additive implementation shape

The first V2 migration should add, not repurpose, the following concepts:

- `CourseRewardTier` and immutable tier revisions;
- `CourseRewardClaim` with `PENDING`, `FULFILLED`, `REJECTED`, and
  `SUPERSEDED` outcomes;
- later, `SystemQuest`, idempotent quest completion, `SystemRewardItem`, and
  `SystemRewardRedemption`.

Existing `RewardLedgerEntry` rows remain untouched. Its `SYSTEM` economy may be
reused for the System Quest wallet after a data and invariant audit. The V1
`COURSE` ledger path is frozen and retired from UI; it is not silently converted
to milestones or deleted.

V2 must use distinct fail-closed feature gates so the old interface cannot be
accidentally re-enabled:

- `COURSE_REWARD_MILESTONES_ENABLED`
- `COURSE_REWARD_MILESTONES_MUTATIONS_ENABLED`
- later, `SYSTEM_QUEST_ENABLED` and `SYSTEM_QUEST_MUTATIONS_ENABLED`

Production migration, flag cutover, and any legacy-data adoption each require
their own evidence and approval.
