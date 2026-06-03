# ADR-0016 — Sparse AttendanceRecord + Enrollment FK + Grid Membership Rule

## Status

Accepted — 2026-06-03 (Phase 4 entry)

## Context

Three coupled questions surfaced while designing the AttendanceRecord model. They are linked tightly enough that documenting them separately would obscure the trade-off; they share rejected alternatives and one positive consequence (history-preservation through soft-delete).

### Question 1 — "Absent" representation

For a Session a teacher has opened, how is "Absent" stored?

- **A — Dense, default-present.** For every active Enrollment, materialize a row on Session create (or first grid render) with default status PRESENT.
- **B — Dense, default-absent.** Same, but default to ABSENT.
- **C — Sparse.** No row exists until the teacher explicitly marks. A missing row means "ยังไม่เช็ค" (not yet checked), not "Absent". The four enum values (PRESENT, LATE, EXCUSED, ABSENT) all require an explicit row.

### Question 2 — Foreign key target

AttendanceRecord ties a Session to a Student. The FK target options:

- **F1 — `studentId` (Student.userId).** Simple, reads like the natural-language sentence "Student S was absent at Session X".
- **F2 — `enrollmentId` (Enrollment.id).** Routes through the enrollment record. Survives Student soft-deletes and survives the Enrollment soft-delete from ADR-0013.

### Question 3 — Grid membership when students are removed

A teacher takes attendance on Monday. A student is removed (soft-delete, ADR-0013) on Tuesday. The teacher opens the Wednesday grid, then later opens the Monday grid to review. Whom should the grid show?

- **G1 — Active members only at query time.** The Wednesday grid shows current active members; the historical Monday grid also shows only current active members — the removed student vanishes from the Monday history.
- **G2 — Active ∪ ever-marked-in-this-Session.** The Wednesday grid shows current active members; the Monday grid shows current active members plus any student who was marked in this specific Session (including those later removed), with a "ถูกนำออกแล้ว" badge.
- **G3 — Snapshot at `Session.scheduledStart`.** Compute membership from `enrollment.enrolledAt <= scheduledStart AND (removedAt IS NULL OR removedAt > scheduledStart)`.

## Decision

### 1. Sparse AttendanceRecord (Question 1 → C)

A row in `AttendanceRecord` exists only after a teacher explicitly marks a student. The four statuses (PRESENT, LATE, EXCUSED, ABSENT) all require an explicit row. The absence of a row means "ยังไม่เช็ค" — a state distinct from "ขาด".

Stats are computed from explicit rows. The denominator for "% present" is **opened Sessions where this student was marked**, not "opened Sessions × scheduled days × Enrollment count".

### 2. FK to Enrollment, `onDelete: Restrict` (Question 2 → F2)

```prisma
model AttendanceRecord {
  enrollmentId String
  enrollment   Enrollment @relation(fields: [enrollmentId], references: [id], onDelete: Restrict)
  ...
  @@unique([sessionId, enrollmentId])
}
```

The FK routes through `Enrollment.id`, not `Student.userId`. `onDelete: Restrict` blocks any hard-delete of an Enrollment that has any AttendanceRecord — matching the same posture for ScoreEntry (Phase 5) and Submission (Phase 6) that ADR-0013 anticipated.

Soft-deleted Enrollment rows (`removedAt IS NOT NULL`) retain all their AttendanceRecord children. Transcript reconstruction and audit forensics traverse `Enrollment → AttendanceRecord` regardless of removal status.

### 3. Grid membership = active ∪ ever-marked (Question 3 → G2)

```sql
-- Conceptual query for grid render of one Session
SELECT enrollment.*, attendance_record.status
FROM enrollment
LEFT JOIN attendance_record
  ON attendance_record.enrollment_id = enrollment.id
 AND attendance_record.session_id = $sessionId
WHERE enrollment.course_offering_id = $courseOfferingId
  AND (
    enrollment.removed_at IS NULL          -- active now
    OR attendance_record.id IS NOT NULL    -- OR previously marked in this Session
  )
ORDER BY <Thai locale sort by student.firstName>
```

UI implication: a row representing a removed-then-marked student renders with muted styling and a "ถูกนำออกแล้ว" badge. The teacher cannot edit this row in a future Session because the student is no longer in the active set (the Wednesday grid does not include them); but the historical Monday grid still shows them as the source of truth for what happened on Monday.

## Consequences

### Positive

- **PDPA-aligned default.** A teacher who opens a Session and walks away without submitting does not silently record every student as ABSENT. The sparse representation makes "missing data" visually obvious as dashes in the grid, not as a row of absences that would damage students' attendance percentages.
- **History preserved through soft-delete.** A removed student's past attendance survives unchanged; future grids correctly omit them. No reconciliation logic needed when an Enrollment is removed.
- **One mental model across student-data tables.** Phases 5 (ScoreEntry) and 6 (Submission) will follow the same Enrollment-FK + onDelete:Restrict pattern, so the entire transcript chain stays consistent.
- **Idempotent upserts.** The `@@unique([sessionId, enrollmentId])` constraint lets every mark operation be a single upsert — refresh, retry, and concurrent submits resolve cleanly.
- **Audit cost is bounded.** Edits within 24 h of `Session.scheduledStart` are not audited (the verbose tier in Security.md). Only the late edits — `ATTENDANCE_BACK_EDIT` with a required reason ≥ 5 chars — fire an event.

### Negative

- **Stats require LEFT JOIN.** Student-facing "ห้องนี้คุณมา X จาก Y คาบ" must compute Y from `SELECT COUNT(*) FROM session WHERE courseOfferingId=$id AND cancelledAt IS NULL`, then X from the existing AttendanceRecord rows. The DB-layer projection for student visibility (`getAttendanceStatsForStudent`) must strip peer rows at the Prisma `select` per Pattern 4 from Phase 3.
- **Grid query is two-clause.** The OR between "active now" and "ever marked in this Session" cannot use a simple `WHERE removedAt IS NULL` shortcut. A composite index on `(enrollmentId, sessionId)` covers the LEFT JOIN. Course offerings with hundreds of historical Enrollment rows are not expected — typical course has ~40 students.
- **Removed-student UI requires a code path.** Two render states for grid rows (active = editable, removed-but-marked = read-only + badge) must be handled in the Phase 4 component. Tests cover both.

### Rejected Alternatives

- **A — Dense default-present.** Hides "teacher forgot to take attendance" as silent agreement. False positives for present students who weren't actually there. Inflates row count to (active Enrollments × opened Sessions) on Session create.
- **B — Dense default-absent.** Worse: silently records absences that would damage attendance rates. Direct PDPA + reputation hazard. The 4 grilling questions explicitly flagged this as a "footgun".
- **F1 — FK to Student.** Loses Enrollment lifecycle context. Cannot distinguish "Student attended via Enrollment A (later removed)" from "Student attended via Enrollment B (current)" if they ever re-enrolled — which is exactly what ADR-0013's auto-restore enables.
- **G1 — Active members only.** Makes historical attendance grids dishonest. A teacher reviewing what happened in week 3 would see a row for "ไอ้แดง" disappear once he's removed in week 8 — visually identical to "ไอ้แดงไม่เคยอยู่ในห้องนี้".
- **G3 — Snapshot at `scheduledStart`.** Required datetime arithmetic on every grid render, and breaks under ADR-0013 auto-restore: a student removed then restored via class code keeps the original `enrolledAt` but reloads `removedAt = null`, making "what membership looked like at Session time" non-trivial to reconstruct.

## References

- CONTEXT.md § Attendance Record, § Back-edit, § Session Cancellation (added 2026-06-03)
- CLAUDE.md § Hard Rules (no auto-mutation of student data; audit required on impactful edits)
- ADR-0013 (soft-delete Enrollment — this ADR extends it to attendance)
- ADR-0015 (lazy Session materialization — sibling decision, same commit)
- Security.md § 7 (`ATTENDANCE_BACK_EDIT` Important tier, `SESSION_CANCELLED` Critical tier)
- HANDOFF.md § "Patterns established this phase" (Pattern 4 DB-layer projection — applies to `getAttendanceStatsForStudent`)
