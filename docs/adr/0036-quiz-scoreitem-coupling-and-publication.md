# ADR-0036 - Quiz and Score Item coupling follows one-way publication

## Status

Accepted for Release C domain design on 2026-07-17. ADR-0024 remains the
authoritative sum-based course scoring model and ADR-0018 remains the
authoritative one-way publication contract.

## Decision

A Practice Quiz never creates a Score Item. A Scored Quiz owns exactly one
Score Item with `source = QUIZ_LINKED`. Creating a Scored Quiz, enabling scored
mode, and linking its Score Item are atomic operations. The Quiz question-point
sum and `ScoreItem.fullScore` must match before opening.

Before the first Attempt, changing question points updates the linked draft
Score Item in the same transaction. After an Attempt starts, points are locked
except for the audited void-question recalculation defined by ADR-0035.

Objective grading uses integer points. Single choice and true/false require an
exact answer; multiple select is all-or-nothing. The best submitted Attempt is
the source of the draft Score Entry for each Enrollment. Attempts remain the
grading evidence and are never replaced by the Score Entry.

## Publication

A Scored Quiz must be closed before its Score Item can be published. The
publication confirmation lists Students with no submitted Attempt and requires
the Teacher to explicitly accept that their missing Score Entry contributes
zero under the existing sum-based model.

Publishing remains one-way. Practice feedback may appear immediately, while a
Scored Quiz withholds score and correct-answer feedback until Score Item
publication. Explanations remain hidden until close and may be hidden
permanently by the Teacher.

Teacher adjustment after auto-grading requires a reason, preserves the
automatic score and Attempt evidence, and writes the existing score-edit audit
contract. A Student deadline or attempt-limit exception is allowed only before
publication and also requires a reason and audit event.

## Cancellation

Cancellation is separate from lifecycle status and is represented by explicit
metadata such as `cancelledAt` and `cancelledReason`. A cancelled Scored Quiz
keeps its linked draft Score Item and evidence but the service rejects score
publication. A published Quiz cannot be cancelled; it may be archived and its
score corrected only through the published-score rules.

## Consequences

- Course totals continue to use `sum(score) / sum(fullScore)` with no weight
  channel.
- Quiz introduces `QUIZ_LINKED` as a provenance value; that provenance is
  immutable.
- Quiz grading cannot create a second competing score ledger.
- Cancelling content never erases Attempts, Score Entries, or publication
  evidence.
