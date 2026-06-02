# ADR-0013 — Enrollment Soft-Delete + Auto-Restore by Rejoin

## Status

Accepted — 2026-05-31 (Phase 3)

## Context

Phase 3 ships the Members tab inside the CourseOffering shell. Teachers need a "Remove from course" action — e.g. a student transferred to another section, dropped the subject, or was disciplinary-removed.

The naïve approach is `prisma.enrollment.delete(...)`. But this collides with two project rules:

1. **CLAUDE.md Hard Rule § 8:** "❌ Cascade delete student ทิ้งคะแนน/submission เทอมก่อน (ใช้ soft delete + anonymize)"
2. **CLAUDE.md Hard Rule § 2:** "ทุก mutation ที่กระทบข้อมูลนักเรียน = audit log" — a deleted row leaves nothing to point an audit log at except IDs.

Furthermore, the upcoming phases couple Enrollment tightly:

- **Phase 5 (Scoring)** — `ScoreEntry.enrollmentId` will reference Enrollment
- **Phase 6 (Submission)** — `Submission.enrollmentId` will reference Enrollment

If Enrollment rows can disappear, the only safe FK strategy is `onDelete: SetNull` everywhere downstream — which loses the very trace we need for transcript reconstruction and PDPA audit response.

A secondary question surfaced: what happens when a removed student re-enters the same Class Code? Three behaviours were considered:

- **P — Block:** "คุณเคยอยู่ในห้องนี้แล้ว" — but Phase 3 ships no Restore UI, creating a teacher-side deadlock
- **Q — Auto-restore:** `removedAt = null`, audit `COURSE_MEMBER_RESTORED_BY_REJOIN`
- **R — Hard block:** "คุณถูกนำออกจากห้องนี้แล้ว" — requires Restore UI built same phase

## Decision

### 1. Soft-delete Enrollment

Add to `Enrollment`:

```prisma
removedAt      DateTime?
removedById    String?    // Teacher who performed the action
removedReason  String?    // Min 5 characters, enforced at API boundary
```

Active membership predicate everywhere: `where removedAt: null`.

The unique constraint `[studentId, courseOfferingId]` **stays** — a student can have only one Enrollment row per CourseOffering across its entire lifetime. "Rejoin" is `UPDATE`, not `INSERT`.

### 2. Auto-Restore by Rejoin (Option Q)

When a Student with a removed Enrollment uses the same Class Code via `/join`:

1. The existing row's `removedAt`, `removedById`, `removedReason` are cleared
2. An audit event `COURSE_MEMBER_RESTORED_BY_REJOIN` is written
3. The Student is redirected to the course as a normal member

If a teacher wants to permanently block a student, they must **deactivate the Class Code** (Settings tab) — which prevents all new and rejoin enrollments. Per-student blocking is deferred to Phase 8/9.

### 3. Mandatory `reason` on Remove

The Server Action `removeMember(enrollmentId, reason)` rejects `reason.trim().length < 5` with a 400. The reason is stored both on the Enrollment row (for visibility in restore-history UI) and in the audit log `reason` field.

### 4. Audit Events

| Event | When | `before`/`after` |
|-------|------|------------------|
| `COURSE_MEMBER_REMOVED` | Teacher removes a student | `before: {removedAt: null}`, `after: {removedAt, removedById, removedReason}` |
| `COURSE_MEMBER_RESTORED_BY_REJOIN` | Removed student rejoins via Class Code | `before: {removedAt, removedById}`, `after: {removedAt: null}` |

Both wrapped in a Prisma `$transaction` with the underlying mutation. Failure of either rolls back both.

## Consequences

### Positive

- ScoreEntry, Submission, AttendanceRecord can keep `onDelete: Restrict` against Enrollment → orphan prevention by construction
- Transcript reconstruction post-removal works without forensic DB recovery
- Teacher kick-by-mistake is self-healing (student rejoins immediately) — reduces "ครูช่วยลบ/เพิ่มหน่อย" support load
- Audit timeline is complete: REMOVED → RESTORED traceable per Enrollment row
- Schema is forward-compatible with Phase 8/9 per-student block (add `blockedAt`, `blockedReason` fields without backfilling)

### Negative

- "Active member" queries everywhere must filter `removedAt: null` — easy to forget. Mitigation: a single `lib/course/enrollment.ts` helper exposes `getActiveMembers(courseId)` and all read paths route through it. Direct `prisma.enrollment.findMany` is discouraged via code review.
- A removed student rejoining is silent to the teacher in Phase 3 (no notification). They'll only see it on next visit to the Members tab. Phase 7 notifications will surface it as "X กลับเข้าห้องอีกครั้ง".
- A determined kicked student can rejoin as long as the code is active. Teachers must understand "deactivate code" is the lock — documented in Settings tab UI.

### Rejected Alternatives

- **Hard delete (Option 5.1-B)** — direct violation of CLAUDE.md Hard Rule § 8
- **Status enum `ACTIVE | REMOVED | TRANSFERRED | BLOCKED`** — over-engineered for Phase 3; defer taxonomy until Phase 8 if multiple states actually emerge
- **Grace-period rejoin block (Option 5.4-R variant)** — requires a Restore UI in Phase 3, expanding scope
- **Audit via Prisma middleware** — opaque, can't capture per-action `reason`, makes test assertion harder

## References

- CLAUDE.md § Hard Rules (no cascade delete, audit all student-data mutations)
- CONTEXT.md § Enrollment, § Remove from Course, § Restore by Rejoin (added 2026-05-31)
- HANDOFF.md Phase 3 scope
- Future: ADR-XX (per-student block) when Phase 8 needs it
