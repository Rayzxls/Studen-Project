# ADR-0035 - Immutable Quiz content and Attempt snapshots

## Status

Accepted for Release C domain design on 2026-07-17. This ADR authorizes an
additive schema design only; it does not authorize a Production migration or
feature rollout.

## Decision

Every `Quiz` belongs to one `CourseOffering` and one active `Lesson`. A Quiz is
either `PRACTICE` or `SCORED` and follows `DRAFT -> OPEN -> CLOSED`. Optional
open and close times may advance that lifecycle, but the Server remains the
authoritative source of status.

Teacher-authored questions, options, correct answers, points, and shuffle
settings become immutable when the first Student starts an `Attempt`. Each
Attempt records an immutable content snapshot containing:

- the Quiz revision and assigned question/option order;
- the complete title, prompt, option text, points, and grading key used;
- attachment ids plus immutable display metadata; and
- the explanation and feedback-release policy in effect at start time.

The snapshot never contains an R2 object key, public file URL, or reusable
signed URL. File delivery continues through authenticated preview routes.

## Corrections after an Attempt exists

A bad question may be voided with a required reason and an Important audit
event. Voiding is irreversible, removes that question from the denominator,
and recalculates every affected Attempt from its original snapshot. Editing the
question in place or restoring a voided question is not allowed.

A closed Quiz may reopen only before its linked Score Item is published. The
Teacher must provide a reason and a new close time, and affected Students are
notified. Reopening does not rewrite existing Attempt snapshots.

## Deletion and archive

An empty Draft with no Attempt may be hard-deleted. Once any Attempt exists,
the Quiz and its snapshots are academic evidence: the Teacher may cancel it
before score publication or archive it from normal navigation, but normal UI
cannot hard-delete it.

## Consequences

- A Student's rendered Quiz and grading key stay reproducible after later
  Teacher actions.
- Content corrections are explicit and cannot silently change history.
- Duplicate Quiz creates a new same-course Draft without dates, Attempts,
  snapshots, results, or linked Score Item.
- Preview is a sandbox projection and never creates an Attempt or Score Entry.
