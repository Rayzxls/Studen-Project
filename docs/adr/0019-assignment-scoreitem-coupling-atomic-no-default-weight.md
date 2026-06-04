# ADR-0019 — Assignment ↔ ScoreItem Coupling: Synchronous Atomic + No Default Weight + Immutable Provenance

## Status

Accepted — 2026-06-04 (Phase 6 entry)

## Context

The Phase 5 schema introduced `ScoreItemSource.ASSIGNMENT_LINKED` as a reserved enum value (ADR-0018 § Class C — immutable provenance) but no fire site existed: Phase 5 only created `MANUAL` ScoreItems. Phase 6 introduces Assignment, and the moment a teacher creates an Assignment with `isScored = true` the coupling must materialize. Five sub-questions are entangled — answering any one in isolation produces an incoherent lifecycle.

### Question 1 — When is the ScoreItem linked?

- **A1 — Synchronous.** ScoreItem is created in the same `$transaction` as `Assignment.create` when `isScored=true`; created at flip-time when `isScored` toggles `false → true` later.
- **A2 — Late binding.** Schema carries `scoreItemId: String?` null until the teacher first opens the grading UI; created then.

### Question 2 — Default `weight` for an auto-created ScoreItem

ADR-0017 stores `weight` as `Int` basis points (0..10000) with no nullability. ADR-0017 § Rejected T3 explicitly refuses silent system-chosen weights ("auto-distribute mutates teacher data without consent").

- **W1 — `weight = 0` default.** Plus a Phase-6-specific publish gate "block publish when `source=ASSIGNMENT_LINKED AND weight=0`" to prevent silent zero-weight ScoreEntry.
- **W2 — `weight Int?` schema change.** `lib/scoring/calc.ts` handles null.
- **W3 — Prompt.** Assignment create dialog collects `weight` (bp) and `fullScore` alongside Assignment metadata when `isScored=true`. No default is ever chosen by the system.

### Question 3 — Default `fullScore`

`Assignment` in the CONTEXT glossary has no concept of "max points" — `allow_text/file/link` flags but no points field. `ScoreItem` requires `fullScore > 0`.

- **F1 — Hard-coded 100 default.**
- **F2 — Prompt alongside weight in the same dialog.**

### Question 4 — Naming

- **N1 — `ScoreItem.name = Assignment.title`** (class A field per ADR-0018 → freely renamable post-publish).
- **N2 — Suffix sentinel** "(คะแนน)" appended.
- **N3 — Computed/derived** from `Assignment.title` (no separate column).

### Question 5 — Toggle `isScored: true → false` reversal

Three sub-states for the linked ScoreItem at flip-time:

- **5a — Draft + 0 entries** → atomic delete + unlink.
- **5b — Draft + N entries** → block (teacher clears entries first).
- **5c — Published** → block always (ADR-0018 publish-is-one-way; escape is `deleteScoreItem` Critical-tier audit, not an Assignment toggle).

## Decision

### 1. Synchronous atomic + flip-time atomic (Q1 → A1)

When `createAssignment` runs with `isScored=true`, the ScoreItem row is inserted in the same `db.$transaction` call with `TX_OPTS` (Pattern 2 + 3). On `updateAssignment` that flips `isScored: false → true`, the same atomic insertion happens inside the update transaction. The schema never carries the state "Assignment.isScored=true AND scoreItemId IS NULL" — that combination is unrepresentable by the mutation API.

```ts
await db.$transaction(async (tx) => {
  const assignment = await tx.assignment.create({
    data: { ...payload, isScored, scoreItemId: null },
  });
  if (isScored) {
    const scoreItem = await tx.scoreItem.create({
      data: {
        courseOfferingId,
        name: payload.title,
        weight,       // from dialog, ≥ 1
        fullScore,    // from dialog, ≥ 1
        source: "ASSIGNMENT_LINKED",
      },
    });
    await tx.assignment.update({
      where: { id: assignment.id },
      data: { scoreItemId: scoreItem.id },
    });
  }
  return assignment;
}, TX_OPTS);
```

### 2. No default weight, no default fullScore (Q2 → W3 · Q3 → F2)

Both `weight` and `fullScore` are collected in the Assignment create dialog when `isScored=true`. The dialog shows a live `Σ` pill (green when `Σ === 10000` after this item, amber otherwise) and a 0..100% slider that converts to basis points at submit. There is no system-chosen default that the teacher could overlook.

When `isScored=false` at create, neither field appears. Toggling `false → true` later reuses the same dialog mounted on the existing Assignment row.

### 3. Name derived once at coupling (Q4 → N1)

`ScoreItem.name = Assignment.title` at coupling time. Subsequent renames of either field are independent — class A on the ScoreItem side per ADR-0018; free on the Assignment side because Assignment has no ScoreItem-side mirror gate. We accept that the two names can drift; the teacher is responsible for keeping them consistent if they want.

### 4. Class C provenance enforced (no override)

`ScoreItem.source = ASSIGNMENT_LINKED` is class C per ADR-0018 — immutable post-publish, and immutable on the toggle path (`isScored: true → false` removes the ScoreItem rather than mutating `source`). The Zod schema for `updateScoreItem` excludes `source` at the type level; the API never accepts a flip from `ASSIGNMENT_LINKED → MANUAL` or vice versa.

### 5. Toggle reversal split by state (Q5 → 5a atomic · 5b/5c block)

| ScoreItem state | Toggle `isScored: true → false` behavior |
|---|---|
| Draft + 0 entries | Atomic delete inside the update tx. Verbose tier (no audit) — same posture as pre-publish ScoreItem CUD established in Phase 5. |
| Draft + N entries | Throws `assignment_has_scored_entries`. UI message: "มีคะแนนของนักเรียน N คนในรายการนี้แล้ว — ลบคะแนนทั้งหมดก่อนแล้วค่อยปิด 'นับคะแนน'". |
| Published | Throws `linked_scoreitem_published`. The only escape is `deleteScoreItem` (Critical-tier audit `SCORE_DELETE_AFTER_PUBLISH` per ADR-0018), after which the teacher can toggle `isScored=false` in a second action. |

The dialog confirming the toggle on a draft-with-zero-entries item still warns the teacher that the ScoreItem will be removed; the action is reversible (toggle on again, set fresh weight) but the row identity is not — Phase 7 notification fan-out wired to ScoreItem-id will treat a re-created row as a new item.

## Consequences

### Positive

- **No silent zero-weight footgun.** A ScoreItem with `source=ASSIGNMENT_LINKED AND weight=0` cannot exist because the dialog enforces `weight >= 1`. ADR-0017's `Σ === 10000` publish gate is sufficient without a Phase-6-specific special case.
- **No nullable weight in the schema.** `lib/scoring/calc.ts` stays purely number-based per ADR-0017; the Phase 5 invariant universality is preserved.
- **The schema is never in an inconsistent state.** "Assignment.isScored=true AND scoreItemId IS NULL" is unrepresentable; every downstream query (`getAssignmentsForGrading`, Phase 7 Feed aggregator) can assume the FK is fully resolved.
- **Provenance is honest.** "Who linked when" is a single tx insert. Future forensic queries do not need to reconstruct "was this MANUAL once?" — class C immutability says no.
- **One mutation, one dispatch point.** `updateAssignment` carries the toggle logic; the three states above are exhaustive and tested.

### Negative

- **The Assignment create dialog is larger when `isScored=true`.** Two extra fields (weight slider with `bp ↔ %` conversion at the edge, fullScore number input). Mitigation: the same dialog handles the toggle path, so the cost is paid once per code path, not per surface.
- **Name drift is acceptable but visible.** A teacher who renames the Assignment but forgets the ScoreItem will see "Quiz 1" in the Assignments tab and "Quiz One" in the Scores tab. We accept this for Phase 6; if teachers report confusion, Phase 7 can add a `[ ] เปลี่ยนชื่อรายการคะแนนตามไปด้วย` checkbox in the rename dialog.
- **Toggle off → on cycles do not reuse the old ScoreItem row.** A teacher who flips off (atomic delete) then flips on again gets a new ScoreItem id. Any ScoreEntry-id-aware code (Phase 7 notification "your score was updated") would treat them as distinct items. Acceptable because flip-off-then-on with zero entries is a low-frequency teacher action.

### Rejected Alternatives

- **A2 — Late binding.** Leaves the schema in a state where `isScored=true AND scoreItemId IS NULL` is representable. Downstream queries need a defensive branch. The ADR-0018 § Class C immutability gate becomes harder to enforce because there is a transient window where the FK is null and `updateAssignment` could conceivably flip `isScored` without touching anything. Cleaner to make coupling synchronous.
- **W1 — `weight = 0` default + extra publish gate.** Adds a Phase-6-only special case to the publish gate. ADR-0017 spent effort making the publish gate a single `Σ === 10000` expression; layering "AND no ASSIGNMENT_LINKED with weight=0" rebraids the invariant. ADR-0017 § Rejected T3 also rules out system-chosen weight values.
- **W2 — `weight Int?` schema change.** Breaks ADR-0017's universality. Every site in `lib/scoring/*` would need null-handling. Migration is non-trivial. The benefit (one row that has no weight committed yet) does not exceed the cost.
- **F1 — fullScore=100 hard default.** Silent assumption that breaks for "10-question quiz worth 5 points each = fullScore 50" use case. A teacher who forgets to edit it ships transcripts with a wrong denominator.
- **N2 — Suffix "(คะแนน)".** UI clutter in the Scores tab where the suffix is redundant context. The Score Item list already lives under the "คะแนน" tab.
- **N3 — Derived/computed name.** Loses flexibility (teacher cannot rename ScoreItem independently). Makes `select` queries more complex (join with Assignment to render). Class A renamability is explicitly allowed by ADR-0018 — withdrawing it via derivation is a regression.

## References

- CONTEXT.md § Assignment (`isScored`, `scoreItemId`) · § Score Item (class A/B/C field rules)
- CLAUDE.md § Hard Rules ("Assignment ↔ Score Item — ถ้า is_scored=true → ตอนสร้าง assignment สร้าง Score Item ผูกอัตโนมัติ")
- ADR-0017 (basis-point weight + zero-tolerance publish gate)
- ADR-0018 (publish one-way + field-class A/B/C edit rules)
- HANDOFF.md § Patterns — Pattern 2 (authz inside `$transaction`), Pattern 3 (`TX_OPTS`), Pattern 7 (native `<dialog>` for Assignment create), Pattern 8 (`"use server"` async exports only)
