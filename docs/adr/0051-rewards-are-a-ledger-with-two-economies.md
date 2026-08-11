# Rewards are a ledger, with two economies

Release F listed a reward system as a backlog candidate with no requirement
written anywhere. This records what was decided when it was grilled, on
2026-08-06, alongside [ADR-0050](./0050-chat-lives-inside-the-classroom.md).

**Nothing here is implemented.** The domain language is in
[CONTEXT.md § Reward](../../CONTEXT.md); this is the reasoning behind it.

## A stored balance, not a derived one

The recommendation was to mirror
[ADR-0048](./0048-early-warning-is-derived-and-explainable.md): early warning
computes a live projection from current rows, keeps no `atRisk` column, and
corrects itself the moment the underlying facts change. A reward is the same
mechanism with the sign flipped, and deriving it would have made farming
structurally impossible — the only way to hold a status would be to currently
satisfy it.

The owner chose a real ledger that accumulates and can be spent, because points
you cannot save and spend are not the feature they wanted. That is a product
judgement, and it is the one being built.

Everything below exists to make a stored balance survive contact with a system
that was deliberately built to let teachers change the past.

## Two economies, because there are two owners

**A course economy.** Points belong to an `Enrollment` — this student, in this
course — exactly like scores, attendance and submissions. The owning teacher
sets the rules and hands out the rewards.

**A system quest economy.** Admin defines cross-course quests and supplies
their rewards. This does not breach the rule that Admin never enters teaching
data: a quest definition and a prize are not anybody's academic record. Admin
still cannot enter a score, mark attendance, or create an assignment.

A single school-wide points wallet fed by every teacher was rejected. Teachers
will not set the same rates, so one wallet makes the most generous course a
farm and pushes students toward whichever subject has the best exchange rate
rather than the one that matters. It also has no legitimate operator: a
school-wide shop needs someone to price and fulfil it, and the only role above a
teacher is a read-only observer.

## System quests count actions, never scores

A quest may require submitting three assignments this week, or attending every
session for a fortnight. It may not require scoring above a threshold in three
subjects.

Two reasons, and the second is the stronger one.

`CONTEXT.md § Aggregate GPA` says results are computed and shown per
CourseOffering only; D0 removed Term GPA and cross-course GPA outright rather
than demoting them. A quest that reads scores across courses rebuilds that
shape as a game mechanic.

More practically, a score-based quest is unfair by construction. Teachers
calibrate differently, so the same threshold is a different achievement in
different courses while paying the same reward. A student can also fail such a
quest through no act of their own, by having a teacher who has not published
yet. Action-based quests have neither problem: submitting is submitting, in
every course, and the student controls it.

Score-based rewards remain available to a teacher inside their own course,
where the calibration is theirs and the comparison is local.

## The ledger is transactions, and corrections are entries

Points are stored as a list of movements, not as a balance column. The balance
is their sum.

This system lets a teacher back-edit attendance with a reason and an audit
entry, and edit a score after publication with the same. Yesterday's truth is
revisable by design. A balance computed once and stored would drift away from
the facts it was supposed to represent, silently.

So when a fact changes, the ledger gains a reversing entry rather than losing
the original. A student asking why their points fell gets an answer — earned
here, reversed when the attendance for the third was corrected — instead of a
number that quietly shrank. This is the same reasoning that gives this codebase
`AuditLog` and `SubmissionVersion` instead of overwrites.

**A redemption that has already been fulfilled is never clawed back.** If the
balance goes negative it stays negative and is worked off, or is floored at
zero. A child who was handed a sticker last week does not have it taken away
because an adult corrected a record this week.

## Points attach to achievements, not to actions

An assignment being submitted pays once, no matter how many
`SubmissionVersion` rows the student creates. This codebase keeps every version
on purpose; paying per submission would make the farm a single button.

Stating it this way also makes reversal well-defined, because the award and its
reversal hang off the same fact rather than off an event that already happened.

**Known and accepted risk:** teachers set their own rates with no ceiling. A
teacher who pays far above the others turns their course into the farm this
design otherwise avoids. A weekly per-course cap was proposed and declined for
now. It is recorded here so that if the economy inflates, the cause is already
written down.

## Randomness stops at the payout

Which quests appear, and how many points each pays, are both random. The
recommendation was to randomise only the quest board — identical for every
student, so effort and reward stay comparable — and the owner chose to
randomise the payout as well.

That makes one boundary load-bearing, and it is absolute:

**Points flow one way.** They are earned by doing school work and spent only in
the reward catalogue. A student can never spend points to reroll a quest, buy a
chance, or open anything. The possible range is shown before the work starts —
"this quest pays 10–30" — so the variance is bounded and visible.

Uncertain reward size is ordinary; a bonus nobody could predict is not a
problem. What makes a loot box a loot box is paying for the roll. Without a
purchase in the loop the mechanic is a gift of unknown size, which is a thing a
school can explain to a parent. With one it would not be, and the users here are
children.

## Points thaw rather than burn

A student removed from a course keeps their points, frozen: visible, not
spendable, and usable again if they return through the existing rejoin flow.
Removal is sometimes a correction, and destroying a term's savings on the spot
would turn an administrative action into a punishment nobody chose to impose.

**Two questions remain open** and should be settled before implementation: what
happens to a balance when a course is archived — the proposal is to warn
students, let them spend, then expire the points with the course, since points
belong to that course — and what happens on account anonymization, where the
proposal is to delete both the ledger and the redemption history, because
unlike a score a point is not academic evidence anyone needs later.
