# ADR-0015 — Lazy Session Materialization (no cron, no eager batch)

## Status

Accepted — 2026-06-03 (Phase 4 entry)

## Context

Phase 4 ships Attendance. Three schema concepts are needed:

- `TimetableSlot` — weekly recurrence template (DOW + time range) attached to a CourseOffering
- `Session` — a concrete class meeting where attendance is taken
- `AttendanceRecord` — one row per (Enrollment × Session × Status)

`TimetableSlot` is a **template**; `Session` is a **materialized event**. The architectural question is **when** and **how** Session rows come into existence relative to the TimetableSlot template.

Three strategies were considered:

- **A — Eager batch.** When a TimetableSlot is saved, generate all Session rows from "today" through `Term.endDate` immediately.
- **B — Lazy on-demand.** TimetableSlot is just a template. Sessions are materialized on the spot, when a teacher opens the attendance grid for a given date, via `findOrCreateSession({courseId, date})`. Manual ad-hoc Sessions follow the same `findOrCreate` path with `timetableSlotId = null`.
- **C — Cron daily.** A scheduled job runs at 00:00 every day and generates a Session for every CourseOffering whose TimetableSlot DOW matches today.

Three constraints shape the choice:

1. **Infrastructure.** The target deployment is Vercel + Neon (Singapore). There is no native cron — Vercel Cron exists but adds a separate function endpoint, an auth secret, idempotency handling, and a failure mode (Neon cold-start + Vercel function timeout) that must fall back to on-demand anyway.
2. **Mid-term edits.** Teachers will change timetables mid-term (room moves, period swaps). Pre-generated Session rows become inconsistent with the new TimetableSlot — requiring detection + diff + reconcile logic, or unrestricted "regenerate and lose attendance" semantics.
3. **Holidays and cancellations.** Thai school terms have national holidays, school-specific events, and ad-hoc cancellations. Pre-generated Sessions for these days become noise that must be cleaned up. The Phase 4 scope does not include a national holiday calendar.

The earlier Phase 3 decision to soft-delete Enrollment (ADR-0013) interacts here too: a Session row that was generated weeks ago, where some students have since been removed via soft-delete, must still render correctly — see ADR-0016 for the grid membership rule.

## Decision

**B — Lazy on-demand materialization.**

### 1. TimetableSlot is a template, optional, never auto-materializes

A CourseOffering can have 0 or more TimetableSlot rows. A teacher can run attendance for a CourseOffering with no TimetableSlot at all — every Session is then manually opened.

TimetableSlot stores no Session rows by itself. Editing or deleting a TimetableSlot does not retroactively change any existing Session row.

### 2. Session rows are created on the spot via `findOrCreate`

Server actions for opening a Session converge on a single `findOrCreateSession({courseOfferingId, scheduledStart, scheduledEnd, timetableSlotId?})` helper in `lib/attendance/`. The function is idempotent against the unique constraint `@@unique([courseOfferingId, scheduledStart])` — double-clicks, retries, and races resolve to the same row.

The teacher flow:

1. Open `/teacher/courses/[id]/attendance` — server renders the list of existing Session rows for this course.
2. Click "เปิดคาบวันนี้" or pick a date — server checks for a matching TimetableSlot by DOW; if found, uses its `startTime`/`endTime`; if not, opens an ad-hoc Session.
3. Grid renders. Mark attendance. Submit (form-based batch — see ADR-0016).

### 3. Holidays and cancellations are by omission, not by row

- A holiday = no Session is opened. No DB row exists for that day.
- A teacher who opens a Session and later cancels it (sick day, ad-hoc) uses the soft-cancel field `Session.cancelledAt` (with required reason + audit `SESSION_CANCELLED`).
- A teacher who never opens a Session for a scheduled day simply has no row. The student-facing "วันนี้มีเรียนไหม?" question is answered from TimetableSlot (template) + DOW match, without materializing.

### 4. Mid-term timetable edits do not propagate

- Past Sessions referencing a now-edited TimetableSlot keep their original `scheduledStart`/`scheduledEnd`. They are concrete events, not templates.
- `Session.timetableSlotId` is nullable with `onDelete: SetNull` — deleting a TimetableSlot unlinks past Sessions from provenance but does not orphan AttendanceRecord rows.
- Future "would-be" Sessions do not exist yet, so editing a TimetableSlot only affects what gets materialized next time a teacher opens attendance for that DOW.

## Consequences

### Positive

- No cron infrastructure. No Vercel Cron config, no shared secret, no daily-job idempotency code, no fallback path for missed runs.
- No row bloat. With ~3-5 slots/course × ~150 courses × 16 weeks/term, eager batch would create ~10K-30K Session rows per term, the majority empty. Lazy materializes only what is actually used.
- Mid-term edits are trivial: no orphan reconciliation, no "regenerate destroys attendance" footgun.
- Holiday handling is free — there are no rows to clean up.
- TimetableSlot CUD becomes a configuration-only mutation (no student-data impact) — justifies the no-audit decision in §11 of the Phase 4 grill (see also CLAUDE.md Hard Rule § 2 distinction).

### Negative

- Calendar/timeline UI showing "scheduled days that haven't been opened yet" must overlay the TimetableSlot template against existing Session rows at query time. This is one extra read per render; cheap and indexable.
- Stats requiring "attendance rate across the whole term" need to define their denominator carefully — the count of opened Sessions, not the count of TimetableSlot recurrences. Phase 4 Student Attendance tab uses opened Sessions as denominator; switching to "scheduled days" denominator later would require also materializing missing scheduled days, which contradicts this decision.
- A teacher who forgets to open attendance for a day leaves no record at all. There is no automated "you missed taking attendance" reminder. Acceptable for Phase 4; deferred to Phase 7 (Notifications) if demanded.

### Rejected Alternatives

- **A — Eager batch.** Causes row bloat, mid-term edit corruption risk, and holiday-row noise. Atomic batch insert at TimetableSlot save time would also hit transaction timeouts against Neon cold-start for courses with many slots.
- **C — Cron daily.** Requires Vercel Cron + secret + idempotency, still needs lazy fallback for missed runs (Neon cold-start during a 00:00 cron is plausible), pre-materializes holidays, delays slot edits by up to 24 h.
- **Hybrid eager-on-save + cleanup on edit.** Combines the worst of A (row bloat) with new "diff TimetableSlot vs existing Sessions on every edit" logic. No clear UX win over B.

## References

- CONTEXT.md § Session, § TimetableSlot (added 2026-06-03)
- CLAUDE.md § Hard Rules (audit only student-data mutations — justifies no-audit on slot CUD)
- ADR-0013 (soft-delete Enrollment — Session lazy creation cooperates with kept-around enrollment rows)
- HANDOFF.md § "Patterns established this phase" (Pattern 3 TX_OPTS — applies to `findOrCreateSession` $transaction)
- Sibling: ADR-0016 (sparse AttendanceRecord + Enrollment FK + grid membership rule)
