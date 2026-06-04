# ADR-0020 — Submission Lifecycle: Workflow Signals vs Score-of-Record · RETURN Never Mutates ScoreEntry

## Status

Accepted — 2026-06-04 (Phase 6 entry)

## Context

CONTEXT.md § Submission introduces a 6-state status (`NOT_SUBMITTED · DRAFT · SUBMITTED · LATE_SUBMITTED · RETURNED · GRADED`) and a `SubmissionVersion` table with `version_number`, `is_current`, `is_late`. Phase 6 must answer four entangled questions about how these states interact with the Phase 5 ScoreEntry lifecycle (ADR-0018: publish is one-way; post-publish edits require `reason ≥ 5` + Important audit; deletes require Critical audit).

### Question 1 — Does RETURN mutate the linked ScoreEntry?

When a teacher returns a submission, three options exist for any ScoreEntry already recorded on the linked ScoreItem (Phase 6 ScoreItems may be `ASSIGNMENT_LINKED` per ADR-0019):

- **R1 — Untouched.** RETURN is a workflow signal only; ScoreEntry follows ADR-0018 on its own.
- **R2 — Reset to null at RETURN-time.**
- **R3 — Snapshotted into the SubmissionVersion row** (versioned grade history).

R2 introduces a mutation-without-reason on a possibly-published row — exactly the case ADR-0018 prohibits. R3 multiplies the score-of-record across two tables (`ScoreEntry` + `SubmissionVersion.grade_snapshot`), breaking the single-source-of-truth posture established in Phase 5.

### Question 2 — How is `is_late` computed for resubmitted versions?

- **L1 — Per-version, against original `Assignment.dueAt`.** Each SubmissionVersion computes `isLate` at submit-time. `Submission.status` reflects the current version (status moves forward only).
- **L2 — Grace window after RETURNED** (e.g., +48 h shift in deadline).
- **L3 — Per-Assignment `resubmitGraceHours` config.**

### Question 3 — Voluntary resubmit without a RETURN cycle?

CONTEXT § Resubmission says "แต่ละครั้งที่ Student submit/resubmit → สร้าง version ใหม่" without specifying whether resubmit requires a teacher RETURN first.

- **V1 — Allowed** whenever `Assignment.submissionClosed=false`. Each submit creates a new version; the previous becomes `isCurrent=false`.
- **V2 — One submit only;** subsequent submits require RETURN first.
- **V3 — Pre-deadline only.**

### Question 4 — Audit posture

`SUBMISSION_RETURNED`, `SUBMISSION_VERSION_CREATED`, and Phase-5-inherited `SCORE_*` events all fire from this surface. Tier assignment (Critical / Important / Verbose) and reason-gating must be settled.

## Decision

### 1. RETURN is a workflow signal — ScoreEntry untouched (Q1 → R1)

The `returnSubmission(submissionId, comment)` Server Action does exactly two things inside a single `$transaction`:

1. Insert a `Comment` row with `scope=PRIVATE`, `body=comment` (min 5 chars), `ownerType=SUBMISSION`, `ownerId=submissionId`.
2. Update `Submission`: `status=RETURNED`. `currentVersionId` unchanged.

It does not touch `ScoreEntry`. If the teacher graded the previous version before returning, the ScoreEntry value persists. ScoreEntry continues to follow ADR-0018: pre-publish edits are free; post-publish edits require `reason ≥ 5` + `SCORE_EDIT_AFTER_PUBLISH`.

When the student resubmits, the teacher re-grades by writing to the same ScoreEntry row (keyed on `(scoreItemId, enrollmentId)`). If the ScoreItem is already published, the re-grade triggers the reason gate inherited from Phase 5 — there is no Phase-6-specific bypass.

The UI surfaces the workflow state cleanly: when `Submission.status=RETURNED`, the submission detail page shows a prominent badge "ครูส่งคืน — รอนักเรียนส่งใหม่" above any rendered grade. The grade itself is not hidden, because hiding it would either:

- Erase the audit-visible reality that a grade exists (misleading);
- Force a UI-only suppression rule that callers would re-derive and get wrong.

### 2. `isLate` per-version, status moves forward (Q2 → L1)

Each `SubmissionVersion` carries an immutable `isLate: Boolean` computed at `submittedAt` against the original `Assignment.dueAt`:

```ts
const isLate = submittedAt.getTime() > dueAt.getTime();
```

`Submission.status` reflects the current version:

| Current version `isLate` | Resulting `Submission.status` |
|---|---|
| `false` | `SUBMITTED` |
| `true` | `LATE_SUBMITTED` |

The status moves forward through resubmits — an on-time v1 followed by a late v2 transitions `SUBMITTED → LATE_SUBMITTED`. There is no transition back to `SUBMITTED` if the current version is late, because there is no reading-of-history that makes a late v2 "not late". The v1 row's own `isLate=false` is preserved in version history.

There is no grace period and no per-Assignment grace knob. Teachers who want to give grace can choose not to penalize late versions in grading — `isLate` is descriptive, not punitive (see Q3 inline lock).

### 3. Voluntary resubmit allowed (Q3 → V1)

A student may submit a new version any time:

- `Assignment.submissionClosed=false`, AND
- `Assignment.autoCloseAtDue=false` OR `now < dueAt`.

Each new version sets the previous `isCurrent=false` and increments `versionNumber`. The submit form on the student side shows a confirmation dialog ("แทนที่งานที่ส่งไปแล้ว v1 ด้วย v2?") when a current version already exists.

This combination with Q3.2-C (per-Assignment `autoCloseAtDue` opt-in) gives teachers two knobs:

- `submissionClosed=true` — manual hard stop, applies regardless of deadline;
- `autoCloseAtDue=true` — lazy soft stop, refuses new SubmissionVersion when `now >= dueAt` (no cron, checked at write time).

### 4. Audit tier dispatch (Q4)

| Event | Tier | Reason | Fire site |
|---|---|---|---|
| `SUBMISSION_RETURNED` | Important | The private comment body (min 5 chars) is reused as `reason` | `returnSubmission` |
| `SUBMISSION_VERSION_CREATED` | Verbose (not logged) | n/a | `submitSubmissionVersion` (initial + resubmit) |
| `SUBMISSION_GRADED` | Verbose pre-publish (not logged); inherits `SCORE_EDIT_AFTER_PUBLISH` Important post-publish | n/a / inherited reason | `gradeSubmission` → routes through `upsertScoreEntry` from ADR-0018 |
| `ASSIGNMENT_CREATED` | Verbose (not logged) | n/a | `createAssignment` (matches Phase 5 pre-publish CUD posture) |
| `ASSIGNMENT_UPDATED` | Verbose (not logged) generally; Important when `isScored: true → false` toggle with reason ≥ 5 from confirm dialog | inherited | `updateAssignment` |
| `ASSIGNMENT_GRADED` | Removed | — | Redundant with `SUBMISSION_GRADED` + `SCORE_EDIT_AFTER_PUBLISH`. The original Pattern 10 list named it; Phase 6 collapses it. |

The teacher's private comment under a RETURN is the audit reason. The structured field and the user-visible field are the same string — one place to read, one place to write.

## Consequences

### Positive

- **Phase 5 invariants survive intact.** ADR-0018's "post-publish edit = reason + audit" rule applies to every ScoreEntry mutation, including those triggered by resubmit-then-regrade. There is no Phase-6-specific bypass.
- **No grade flap.** A teacher who grades v1 (creating ScoreEntry value X) then returns and the student resubmits as v2: the displayed grade does not vanish and reappear. It stays at X until the teacher writes a new value, which is honest and audit-clean.
- **`isLate` semantics are dead-simple.** No grace period field, no opt-out, no cron drift. The deadline is the deadline; the flag describes what happened.
- **The status state machine is monotonic in lateness.** Once the current version is late, the status reflects that without backward jumps. Future forensic queries that ask "was this ever late?" can answer from the current status without joining version history.
- **One reason, one comment.** Bundling the RETURN reason as the private comment body removes the "structured reason vs free-text comment" double-write that would otherwise produce two near-identical strings in different places.

### Negative

- **Stale grade visible during RETURNED state when the ScoreItem is published.** A student sees their old grade alongside the "งานถูกส่งคืน" badge. We accept this as honest — the grade was real, the teacher's act of returning does not retract it. UI surfaces the workflow state prominently to disambiguate.
- **A student submitting late as a resubmission gets `LATE_SUBMITTED` status even if v1 was on time.** Some teachers may perceive this as unfair. The honest record is: v1 on-time, v2 late, current=v2 → status reflects current. Teachers retain full discretion in grading.
- **Voluntary resubmit can accidentally overwrite a good v1 with a worse v2.** Mitigation: client-side confirmation dialog. The v1 row is not destroyed (`isCurrent=false`); the teacher can still view version history if needed.

### Rejected Alternatives

- **R2 — Reset ScoreEntry on RETURN.** Mutates a possibly-published ScoreEntry without a reason. Either violates ADR-0018 or requires fabricating a reason like "system-reset on return", which the audit log would have to either fake-as-teacher or expose as "the system did it". ADR-0017 already rejected silent system mutations.
- **R3 — Snapshot grade into SubmissionVersion.** Multiplies the score-of-record. Phase 5's weighted-total + Term-GPA queries read from ScoreEntry exclusively; adding a parallel store creates "which one is canonical" tension and risks divergence under partial writes.
- **L2 — Grace window after RETURNED.** Introduces a hidden timer that drifts between the system clock and "what the teacher meant". Adds a `isLateAfterGrace?` derived field that downstream UI has to surface or hide. The simpler rule "deadline is the deadline" produces an audit-honest record.
- **L3 — Per-Assignment grace config.** Adds a `resubmitGraceHours` field that most Assignments will never set. Configurability for its own sake; the `isLate` flag is descriptive, so grace would only matter if `isLate` enforced something — which it does not (Q3 inline).
- **V2 — One submit only, resubmit requires RETURN.** Forces teachers to do "RETURN to allow correction" even when the teacher would happily let the student fix on their own. Makes voluntary self-correction impossible. The hard stops `submissionClosed` and `autoCloseAtDue` already cover the "no resubmit allowed" case.
- **V3 — Pre-deadline only.** Conflates "resubmit" with "late". A student who submits on time then notices an error after the deadline cannot fix it. The dual hard-stop levers (closed flag + auto-close-at-due opt-in) already give teachers per-Assignment control.

## References

- CONTEXT.md § Submission (lifecycle, `isLate`, `isCurrent`) · § Return · § Grade Submission · § Submission Status
- CLAUDE.md § Hard Rules ("ทุก mutation ที่กระทบข้อมูลนักเรียน = audit log")
- ADR-0017 (publish gate `Σ === 10000`)
- ADR-0018 (publish-is-one-way + reason-gated post-publish edits)
- ADR-0019 (Assignment ↔ ScoreItem coupling; defines the ScoreItem this lifecycle interacts with)
- HANDOFF.md § Patterns — Pattern 2 (authz inside `$transaction`), Pattern 10 (past-tense audit family — `SUBMISSION_RETURNED`, `SUBMISSION_VERSION_CREATED`)
