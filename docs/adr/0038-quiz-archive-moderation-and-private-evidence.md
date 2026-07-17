# ADR-0038 - Quiz archive and moderation preserve private evidence

## Status

Accepted for Release C domain design on 2026-07-17. It extends ADR-0032 without
granting Admin teaching authority.

## Decision

Quiz archive is a navigation state, not deletion. Cancellation is an academic
decision available only before score publication. Both require explicit
metadata and preserve Quiz, Attempt, answer, snapshot, Score Item, Score Entry,
notification, file, and audit identity. Normal UI may hard-delete only an empty
Draft with no Attempt.

Private attachments reuse the existing staged, verified, private-R2 pipeline.
The additive owner types are `QUIZ`, `QUIZ_QUESTION`, and `QUIZ_OPTION`.
Question explanations use question ownership. Quiz and question surfaces allow
up to ten files, options up to five files, and each file up to 20 MB. Binary
content is served only through authenticated or short-lived signed delivery.

## Moderation evidence

Student may report a Quiz or an individual question. Moderation Center stores
the Teacher-authored content snapshot visible at report time, including option
text and attachment metadata. It excludes Student answers, Attempt grading,
score values, personal exceptions, and submitted private files.

A report does not automatically hide content. Existing authorized moderation
may temporarily restrict Student-facing access or quarantine an attachment, but
it cannot change correct answers, void a question, edit a score, submit an
Attempt, or publish a Score Item. Those remain Teacher academic actions.

Teacher is notified that content was reported without receiving the reporter's
identity. Admin sees an aggregate read-only observer view and the evidence
needed for a case, but not Student answers or private Attempt files. Existing
case authorization, appeal, audit, and retention rules from ADR-0032 apply.

## Flags and rollback

All Quiz behavior fails closed behind exact-string flags:

- `QUIZ_ENABLED` enables read projections;
- `QUIZ_MUTATIONS_ENABLED` additionally enables approved mutations; and
- `QUIZ_PILOT_COURSE_IDS` limits both surfaces to an explicit course allowlist.

Disabling the flags removes Quiz surfaces without deleting evidence or changing
existing Feed, Lesson, Assignment, Score, Notification, Moderation, or file
behavior.

## Consequences

- Admin remains a safety/compliance observer and never becomes a co-Teacher.
- A safety restriction cannot silently alter an academic result.
- Evidence remains reviewable even when the Quiz is archived or cancelled.
- Production rollout still requires private-R2, authorization, retention,
  rollback, and one-course pilot acceptance.
