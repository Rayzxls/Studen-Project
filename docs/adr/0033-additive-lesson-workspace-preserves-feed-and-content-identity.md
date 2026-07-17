# ADR-0033 — Additive Lesson Workspace preserves Feed and content identity

## Status

Accepted for Release B1 foundation on 2026-07-15. UI mutations, compatibility
backfill, and default-route cutover are not part of this slice.

## Decision

Add `Lesson` beneath `CourseOffering` with a free-form required title, optional
description, stable position, archive metadata, creator, and timestamps.
`Assignment.lessonId` and `Material.lessonId` are nullable foreign keys with
`ON DELETE SET NULL`. `Announcement` remains course-wide.

The relation is deliberately optional until B2 completes an idempotent,
count-verified compatibility backfill. Existing content ids, URLs, submissions,
scores, comments, files, notifications, and audit rows remain unchanged.

## Authorization

- The owning Teacher may mutate Lesson structure only in an active
  CourseOffering.
- An actively enrolled Student may read the structure but never peer progress.
- Admin may observe active or archived structure and cannot mutate it.
- Linking content requires an active Lesson in the same CourseOffering.

## Flags and rollback

All flags fail closed and must equal the exact string `1`:

- `LESSON_WORKSPACE_ENABLED` enables read projections.
- `LESSON_WORKSPACE_MUTATIONS_ENABLED` requires the read flag and will gate B3
  mutations.
- `LESSON_WORKSPACE_DEFAULT_ROUTE_ENABLED` requires the read flag and is
  reserved for the B5 Feed-to-Lessons default-route cutover.

Disabling the flags returns the existing Feed-first experience without a data
rollback. B1 does not wire any UI or mutation route.

## Audit contract

Create, rename, and reorder are Verbose and use current row state. Archive,
permanent deletion of an empty Lesson, and moving content between Lessons are
Important events: `LESSON_ARCHIVED`, `LESSON_DELETED`, and
`LESSON_CONTENT_MOVED`. Fire sites arrive with B3 mutations.

## Consequences

- Feed remains the chronological projection of canonical content; no FeedItem
  table or duplicate post is introduced.
- Deleting a Lesson cannot delete Assignment or Material rows through the FK.
- Same-course linking remains a service invariant because a nullable single-FK
  rollout is safer and simpler than changing existing content identity.
- Production migration requires a separate explicit approval after isolated QA
  migration, verifier, and rollback checks pass.
