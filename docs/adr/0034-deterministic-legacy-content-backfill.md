# ADR-0034 - Deterministic legacy content backfill

## Status

Accepted for Release B2 on isolated Neon QA on 2026-07-15. Production execution
requires a separate reviewed dry-run and explicit approval.

## Decision

Existing Assignment and Material rows with no Lesson are linked to one fallback
Lesson named `เนื้อหาเดิม` in their current CourseOffering. Announcement remains
course-wide. The fallback Lesson id is a deterministic SHA-256-derived value
from the CourseOffering id, so retries reuse the same row without relying on a
mutable title.

The package command is dry-run only by default. Apply mode requires all three
guards:

1. an identity-checked `QA_DATABASE_URL` distinct from the primary database;
2. the explicit `--apply` argument; and
3. the exact `LESSON_BACKFILL_CONFIRM` token.

Apply runs in one Serializable transaction. It creates only missing fallback
Lessons, updates only rows whose `lessonId` is still null, compares updated-row
counts, writes one Important `LESSON_CONTENT_MOVED` audit event per content row,
and verifies preservation counts before commit.

## Preserved identity

The backfill does not replace or recreate Assignment, Material, Submission,
Score Entry, Comment, File Attachment, Notification, or Audit history. Existing
content ids and URLs therefore remain valid. The only content-row mutation is
the nullable `lessonId` link.

## Verification and rollback posture

The QA run created one fallback Lesson and linked one Assignment. Assignment,
Material, Submission, Score Entry, Comment, File Attachment, and Notification
counts stayed unchanged. The expected Lesson and Audit counts each increased by
one. A repeated dry-run reports zero changes, and the verifier rejects any
unassigned or cross-course content.

Rollback is forward-only: disable Lesson flags to keep the Feed-first product
behavior. Do not clear `lessonId` or delete fallback Lessons in Production
without a separately reviewed repair plan because B3 may later add user edits.
