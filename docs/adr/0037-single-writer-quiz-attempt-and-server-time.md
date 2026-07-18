# ADR-0037 - Quiz Attempt uses one writer and authoritative Server time

## Status

Accepted for Release C domain design on 2026-07-17. The exact lease duration is
an implementation constant and must be covered by concurrency tests before a
pilot.

## Decision

An Attempt is unique for one Enrollment, Quiz, and attempt number. At most one
device owns write access to an active Attempt. The Server issues an opaque
write lease and stores a monotonically increasing lease version; the raw lease
secret is not stored. Explicit device takeover increments the version and
makes every older client read-only.

Every answer mutation includes the expected Attempt revision, active lease,
and an idempotency key. The service rejects stale leases and conflicting
revisions. There is one current answer per Attempt question; retries with the
same idempotency key return the prior result rather than creating another
answer.

## Time and submission

The effective deadline is the earliest applicable value among:

- the Student-specific deadline;
- the Quiz close time; and
- `startedAt + timeLimit` when a limit exists.

Server time decides expiry. On or after the effective deadline, answer writes
fail closed and the Attempt is submitted using the latest server-confirmed
answers. Finalization occurs on read or mutation and may also be accelerated by
a scheduled worker; correctness must never depend only on cron execution.

The client may retain unsynced answers for recovery and retry them on reconnect.
It must show sync state clearly. Final submission succeeds only after Server
confirmation, so MVP is resilient to short disconnections but is not a full
offline examination system.

## Attempts, preview, and exceptions

Practice defaults to unlimited Attempts. Scored defaults to one and permits an
audited limit from one to ten. A Teacher may grant extra Attempts or extend one
Student's deadline before score publication. Student preview never acquires a
lease and never creates Attempt, answer, or Score Entry rows.

## Consequences

- Refresh resumes the same Attempt without creating a duplicate.
- Device takeover is explicit and deterministic; the old device can still
  display confirmed answers but cannot overwrite them.
- Auto-submit, due status, and grading use one Server timeline across devices.
- Concurrency, duplicate requests, expiry boundaries, and takeover require
  isolated-database integration tests before UI rollout.
