# ADR-0018 — Publish is a Contract: No Unpublish + Field-Class Edit Rules

## Status

Accepted — 2026-06-04 (Phase 5 entry). **Partially superseded by [ADR-0024](./0024-sum-based-scoring-supersedes-weight-invariant.md)** — 2026-06-05 (Phase 10 entry): the `weight` member of field-class B is removed (column dropped); class B now contains only `{fullScore}`. The publish-as-one-way-door rule, the audit events (`SCORE_EDIT_AFTER_PUBLISH`, `SCORE_DELETE_AFTER_PUBLISH`), class A (cosmetic, free edits), and class C (provenance, immutable) are **unchanged** and remain authoritative.

## Context

Once a ScoreItem is published, students see weighted totals, grades, and (eventually) Term GPA progress derived from it. Two tightly coupled questions shape the lifecycle from that moment forward; they are written as one ADR because the answer to either alone is incoherent without the other.

### Question 1 — Field changes after publish

A ScoreItem has fields that differ wildly in how much an edit changes a student's transcript:

| Class | Fields | Effect of edit |
|---|---|---|
| **A — Cosmetic** | `name`, `position` | Zero numeric effect — pure rename or reorder. |
| **B — Score-impacting** | `weight`, `fullScore` | Recomputes every enrolled student's percent. Visible immediately in their grade. |
| **C — Provenance** | `source` (manual ↔ assignment-linked), `scoreItemTemplateId` | No numeric effect, but redefines what the item *is* and who owns updates downstream (Phase 6 Assignment will read `source`). |

Possible policies:

- **E1 — Block all post-publish field changes.** Teacher must `unpublish → edit → re-publish`.
- **E2 — Allow all post-publish field changes with a required reason.** Single broad rule.
- **E3 — Split policy by field class.** A cosmetic, B reason-gated, C immutable.

### Question 2 — Unpublish

Once `publishedAt IS NOT NULL`, can a teacher reverse the publish state?

- **U1 — Forbidden.** Publish is a one-way door. The only ways out are `updateScoreItem` (edit-in-place) or `deleteScoreItem` (remove the item entirely).
- **U2 — Allowed with reason ≥ 5 chars.** New audit event `SCORE_ITEM_UNPUBLISHED`. ScoreEntry rows survive.
- **U3 — Allowed within a short grace window.** Allowed only if `now - publishedAt < 15min` AND no edits occurred since publish.

Three system properties depend on this choice and on Q1's choice:

- **Term GPA stability.** Decision 2.4 / ADR-Q4 sets `Term GPA = null` until every ScoreItem of every CourseOffering in the Term is published. An unpublish at any time would flip a `COMPLETED` Term back to `IN_PROGRESS` for every enrolled student.
- **Notification fan-out.** Publish generates a "Score Published" feed entry + bell-icon badge for every active member. Unpublish would either generate "Score Unpublished" (surprising), suppress notification (ghost noti), or attempt to retract sent notifications (impossible in any real channel).
- **Audit narrative readability.** Phase 5 introduces `SCORE_ITEM_PUBLISHED`, `SCORE_EDIT_AFTER_PUBLISH`, `SCORE_DELETE_AFTER_PUBLISH`. Whether `SCORE_ITEM_UNPUBLISHED` joins that family changes the shape of every "what happened to this item" audit query.

## Decision

### 1. Unpublish is forbidden (Question 2 → U1)

`publishedAt` is set exactly once and is never null again within the row's lifetime. There is no `unpublishScoreItem` function in `lib/scoring/score-item.ts`. The Server Action surface does not expose an unpublish path.

Teachers who need to step back from a published item have exactly two escape hatches:

| Need | Path | Audit |
|---|---|---|
| Fix wrong `fullScore` / `weight` value | `updateScoreItem` with reason ≥ 5 | `SCORE_EDIT_AFTER_PUBLISH` (Important) |
| Remove the item entirely | `deleteScoreItem` with reason ≥ 5 | `SCORE_DELETE_AFTER_PUBLISH` (Critical) |

The publish confirmation dialog (Pattern 7 native `<dialog>`) is intentionally heavier than other confirms in the app — it displays the item name, weight, fullScore, and a count of "ScoreEntry filled / total active members" before asking the teacher to commit. The warning text states that the action cannot be undone and that downstream edits will require a reason and be audited.

### 2. Field-class split on edit (Question 1 → E3)

A single mutation `updateScoreItem(id, patch, { reason? })` reads the diff between the current row and `patch` and routes by which class of fields changed:

| Class | Field examples | Allowed post-publish? | Reason required? | Audit |
|---|---|---|---|---|
| **A** | `name`, `position` | Yes, freely | No | Verbose tier — not logged (same posture as TimetableSlot CRUD per Phase 4 § Q11C) |
| **B** | `weight`, `fullScore` | Yes | Required, min 5 chars | `SCORE_EDIT_AFTER_PUBLISH` (Important) — logs `before` / `after` + `reason` |
| **C** | `source`, `scoreItemTemplateId` | No — throws `field_immutable_after_publish` regardless of reason | n/a | n/a |

Additional cross-cutting rules when `publishedAt IS NOT NULL` and class B fields change:

- **`validateWeights` re-runs inside the same `$transaction`** (Pattern 2). A weight edit that drives `Σ ≠ 10000` is rejected with `weight_sum_not_100` *before* the audit event fires.
- **`fullScore` shrink with existing entries above the new cap is rejected.** If any `ScoreEntry.value > patch.fullScore`, throws `entries_exceed_new_full_score`. The teacher must reduce affected entries first, then shrink the cap.
- **`publishedAt` is not part of the patch DTO.** It is excluded at the Zod type level. Only `publishScoreItem` can set it; nothing can reset it.

When `publishedAt IS NULL` (draft), all of class A, B, and C are freely editable with no reason and no audit. The class split only activates after publish.

## Consequences

### Positive

- **Term GPA stability is a structural property, not a runtime invariant to defend.** Because `publishedAt` only moves in one direction, `COMPLETED` Terms cannot regress to `IN_PROGRESS` from an unpublish race. The Term Status state machine has two transitions (`EMPTY → IN_PROGRESS`, `IN_PROGRESS → COMPLETED`), not four.
- **Notification fan-out has no mirror event.** Every publish corresponds to exactly one "Score Published" feed entry. There is no `SCORE_ITEM_UNPUBLISHED` feed entry to design copy for, no retraction logic, no race between "user reads notification" and "system retracts it".
- **Audit narrative is linear.** A ScoreItem's audit timeline reads: `SCORE_ITEM_PUBLISHED → (0..N) SCORE_EDIT_AFTER_PUBLISH → (optional) SCORE_DELETE_AFTER_PUBLISH`. Forensics readers can answer "what happened to this item" without branching on an unpublish-republish history.
- **The field-class split surfaces intent at the API boundary.** A teacher renaming an item is a different action from a teacher reshaping the weighted total. The audit log reflects that — a flurry of `SCORE_ITEM_RENAMED` (if we ever log them) is qualitatively different from one `SCORE_EDIT_AFTER_PUBLISH` with `before: weight=2000` / `after: weight=3000`.
- **Class C immutability prevents conceptual drift.** `source` flipping `MANUAL → ASSIGNMENT_LINKED` post-publish would require backfilling an Assignment relationship that may not exist. Forbidding the edit forces the teacher to use the explicit `deleteScoreItem` + create-new path, which the audit log captures honestly.
- **One mutation, one place to read the rules.** `updateScoreItem` is the single dispatch point for every edit. There is no `editScoreItemAfterPublish` parallel function to keep in sync.

### Negative

- **Fat-finger publishes are unrecoverable without an audit Critical event.** A teacher who clicks "Publish" by accident must use `deleteScoreItem` (Critical tier) and recreate the item. Mitigation: the publish confirm dialog is intentionally heavy (preview of name + weight + fullScore + filled-entries count + warning copy). The dialog cost is paid once per publish across the system's lifetime; we accept it.
- **`field_immutable_after_publish` error case must be visible in the UI.** Class C edits attempted from the form will need a clear in-UI message ("ฟิลด์นี้แก้ไม่ได้หลัง publish") rather than a generic server error. The same applies to `entries_exceed_new_full_score`.
- **Glossary semantics shift slightly.** CONTEXT.md § Publish previously read "after publish, edits to Score Entry require a reason" — the same posture now extends explicitly to ScoreItem field edits as well. Glossary entry is being updated in the same Phase 5 entry commit.

### Rejected Alternatives

- **E1 — Block all post-publish edits + force unpublish-edit-republish.** Loses fidelity: every fix triggers two notifications and two audit cycles, students see grades disappear and reappear, and Term GPA can flap. Edge cases multiply (what if a student opened the page between unpublish and republish?). The reason-gate model gives the same forensic trail with one event per edit.
- **E2 — One broad "reason required for any post-publish edit" rule.** Forces a reason for renaming an item — a trivial change that does not move any student's number. Discourages teachers from fixing typos because the reason gate feels disproportionate to the action. The class split lets cosmetic edits flow while still gating numeric edits.
- **U2 — Allow unpublish with reason.** Adds a fourth audit event (`SCORE_ITEM_UNPUBLISHED`), forces Term Status to be a real state machine with backward transitions, demands notification copy for the retraction (no good answer), and opens "publish-unpublish-edit-publish" loops that are indistinguishable from `updateScoreItem`-with-reason in the audit log but more confusing for students.
- **U3 — 15-minute grace window.** Equivalent to U2 with a timer. Still requires unpublish notification handling. Still allows the Term GPA flap. Saves the teacher one audit event in exchange for a state machine that diverges from the "publish is one-way" mental model. The publish confirm dialog is a better safety net than a stopwatch.

## References

- CONTEXT.md § Score Item · § Publish · § Term Status · § Term GPA
- CLAUDE.md § Hard Rules ("ทุก mutation ที่กระทบข้อมูลนักเรียน = audit log") · § Critical Files (`lib/scoring/*`)
- HANDOFF.md § "Patterns established this phase" — Pattern 2 (authz inside `$transaction`), Pattern 7 (native `<dialog>` Publish dialog), Pattern 10 (past-tense audit family `SCORE_ITEM_PUBLISHED`, `SCORE_EDIT_AFTER_PUBLISH`, `SCORE_DELETE_AFTER_PUBLISH`)
- ADR-0017 (`validateWeights` re-runs on edit-after-publish weight changes — sibling decision)
- Security.md § 7 (Phase 5 audit family addition — same commit)
