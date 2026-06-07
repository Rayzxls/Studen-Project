# ADR-0024 — Sum-Based Scoring Supersedes Weight Invariant

## Status

Accepted — 2026-06-05 (Phase 10 entry) — **Supersedes [ADR-0017](./0017-weight-invariant-basis-points-and-publish-gate.md)** in full and **partially supersedes [ADR-0018](./0018-publish-is-a-contract-no-unpublish-and-field-class-edit-rules.md)** § field-class B (`weight` portion only — `fullScore` portion of class B still applies).

## Context

Phase 5 shipped a scoring model where each `ScoreItem` carries a `weight` in integer basis points (0..10000), and the publish gate enforces `Σ weight === 10000` per CourseOffering ([ADR-0017](./0017-weight-invariant-basis-points-and-publish-gate.md) § 1, § 2). The model was rigorous and well-tested. It was also the wrong model for the actual user.

The Phase 10 grill surfaced two things from the product owner:

1. **Real Thai teachers do not think in percent weights.** They build a gradebook by adding score items (quizzes, homework, midterm, final) with a `fullScore` each, and the term ends when the points add up. Asking them to also enter a percent that must sum to exactly 100 % is a foreign mental model.
2. **The product owner's stated semantic is sum-based.** Verbatim:
   > "ใส่ 10 คะแนน ก็ได้ 10 คะแนน โดยเฉลี่ย ไม่ค่อยมีหรอก คุณครูที่จะเก็บคะแนนทั้งเทอม 150 คะแนน ต่อให้เก็บคะแนนถึงขนาดนั้น GPA รวมก็จะอยู่ที่ 4.00 อยู่ดี"

In other words: a `ScoreItem` worth `fullScore = 10` contributes "10 points worth of influence" to the course outcome. A `ScoreItem` worth `fullScore = 50` contributes five times as much. There is no separate `weight` channel — `fullScore` already encodes proportional influence.

This is **not a bug fix** to ADR-0017. ADR-0017's model is internally consistent and correctly implemented. The decision being revisited is **whether weight should exist at all**, and the answer at Phase 10 is no.

### Three formulas were on the table

- **(a) Equal-weight average** — every `ScoreItem` counts the same regardless of `fullScore`. Quiz (full 5) = Midterm (full 50) in influence. Rejected: matches no Thai teacher's intuition.
- **(b) Sum-based proportional** — `Σ score / Σ fullScore × 100`. Quiz (full 5) influences 5/170 of the term; Midterm (full 50) influences 50/170. Influence = `fullScore / Σ fullScore`, automatically.
- **(c) Drop grades entirely** — show raw points only, no Term GPA. Rejected: Term GPA is a downstream contract for the school's GPAX system (see CONTEXT.md § Term GPA, § GPAX out-of-scope) — removing it breaks the export path.

The product owner picked (b). This ADR records the formula change plus all the downstream consequences.

## Decision

### 1. Score Total formula

The per-CourseOffering grade input changes from `Weighted Total` (ADR-0017) to **Score Total**:

```ts
// lib/scoring/calc.ts (rewritten)
export function scoreTotal(
  publishedItems: { id: string; fullScore: number }[],
  entries: { scoreItemId: string; score: number }[]
): number | null {
  if (publishedItems.length === 0) return null;
  const itemMap = new Map(publishedItems.map((it) => [it.id, it]));
  let totalScore = 0;
  let totalFull = 0;
  for (const item of publishedItems) {
    totalFull += item.fullScore;
    const entry = entries.find((e) => e.scoreItemId === item.id);
    totalScore += entry?.score ?? 0;
  }
  if (totalFull === 0) return null;
  return (totalScore / totalFull) * 100;
}
```

The output is a percent in `[0, 100]`, identical in **type** to the value previously returned by `weightedTotal`. Downstream consumers (`gradeFor`, Term GPA calc, transcript print) require no change at the call site — only the internal computation of the percent changes.

The `gradeFor` step that maps percent → letter / 0–4 grade remains as defined in CONTEXT.md § Grade. Default thresholds (`80+ → 4.0`, `75+ → 3.5`, …) are unchanged. `CourseOffering.gradeRulesJson` override capability is preserved.

### 2. Schema: drop `ScoreItem.weight`

```prisma
model ScoreItem {
  // weight Int                  // REMOVED
  fullScore Float                // kept (class B, post-publish edit gated by ADR-0018 reason)
  // … other fields unchanged
}
```

Migration **M1** drops the column. Per Q11b, this is a pre-launch drop — no production data exists. No snapshot script is required.

### 3. Publish gate: trivially satisfied

ADR-0017 § 2 defined the publish gate as `Σ weight === 10000`. With weight removed, the only remaining publish precondition is the one already enforced elsewhere — `publishedAt IS NULL` (one-way per ADR-0018). There is no Σ check anywhere in the codebase after this ADR lands.

UI consequences:
- The Σ pill component (green when `Σ === 10000`, amber otherwise) is removed from the Score Item list page.
- The Score Item create dialog no longer asks for `weight (%)`. The `fullScore` input remains and is the only required numeric.
- The Assignment create dialog (per [ADR-0019](./0019-assignment-scoreitem-coupling-atomic-no-default-weight.md)) loses its `weight` input when `isScored=true`. Only `fullScore` is asked for.

### 4. Field-class table simplification

ADR-0018 § field-class B included `{weight, fullScore}` as "score-impacting fields that require `reason ≥ 5` + `SCORE_EDIT_AFTER_PUBLISH` audit when edited after publish." With `weight` gone, class B contains only `{fullScore}`. The reason-gate behavior for `fullScore` post-publish is unchanged. Class A (cosmetic), class C (provenance), and the audit event itself are unchanged.

### 5. Pure calc tests

`tests/unit/scoring/calc.test.ts` is rewritten. Cases that previously tested weight arithmetic (`3 × 33.33 %`, asymmetric weighting, drift-from-100) are replaced with `fullScore`-based cases:

- `[{full: 10, score: 8}, {full: 50, score: 40}] → 80.0%`
- `[{full: 10, score: 10}, {full: 0, score: 0}] → 100.0%` (zero-fullScore item is benign)
- Empty published list → `null` (state `EMPTY` — preserved)
- All entries `score = 0` → `0.0%`

Pure stays pure. No `Prisma.Decimal`, no `validateWeights` import.

## Consequences

### Positive

- **Teacher mental model matches the system.** Adding a 10-point quiz contributes 10 points of influence. No second number to balance. No "Σ = 9999, please find the missing 1 bp" puzzles.
- **Mid-build state is always valid.** Under ADR-0017, a half-built CourseOffering had `Σ < 10000` and could not be published. Under sum-based, every state is internally consistent — the teacher publishes when they decide they are done, not when an invariant lets them.
- **ADR-0019 dialog gets simpler.** Atomic Assignment ↔ ScoreItem coupling no longer needs to surface a `weight` field. Single-screen create stays single-screen, one fewer required input.
- **Σ pill removed = less UI noise.** The Score Item list page becomes a flat list of items with `fullScore` and publish state. No live aggregate, no green/amber traffic light, no "why is this amber" support question.
- **Code deletion >> code addition.** `validateWeights`, `WEIGHT_SUM_BP`, `WeightSumNotHundredError`, the `weight` field on every Zod schema, and the publish-gate branch in `publishScoreItem` are all removed. Net delta is negative LoC.

### Negative

- **A teacher who wants "Quiz worth 30 %, Midterm 70 %" cannot enter those numbers directly.** They must encode the ratio in `fullScore` — e.g. Quiz `fullScore = 30`, Midterm `fullScore = 70` — and grade students out of those scales. For teachers who already think in percent (a minority per the grill), this is mild friction. Mitigation: documentation + a Settings tip on the Score Item list page.
- **Published grades from a pre-ADR-0024 Phase 5 test database become uninterpretable.** Their `weight` is gone; the new formula treats every item as `fullScore`-weighted. This is the data-loss trade-off accepted in Q11b. Acceptable because no production launch has occurred.
- **ADR-0017 is now historical.** A future contributor reading the docs/adr/ chronologically will see ADR-0017 fully specified and then ADR-0024 deleting most of it. We accept the noise; the alternative (rewriting 0017 in place) would erase the design history the grill referenced.

### Rejected Alternatives

- **(a) Equal-weight average.** A quiz (full 5) and a final (full 100) would each contribute 50 % of the term outcome. No teacher would accept this. Encodes no proportional intent.
- **(c) Drop grades and Term GPA.** Term GPA is the export contract to the school's external GPAX system (CONTEXT.md § GPAX). Removing it shifts the cost of computing per-course grades onto the Admin (manual spreadsheet work for every student × every term). Worse outcome than redefining the formula.
- **Keep `weight` but make it optional, default to `fullScore` / Σ fullScore.** Two formulas in flight at once. The first edge case (one item has `weight = null`, one has `weight = 50`) has no sensible answer. Coexistence is worse than a clean cutover.
- **Snapshot `weight` to a side table before drop.** Per Q11b, no production data exists. The script would protect against a counterfactual that does not apply.

## Migration plan

Per HANDOFF.md commit discipline (1 commit = 1 concern):

1. **This commit** — `docs(adr): ADR-0024 sum-based scoring supersedes weight invariant`
2. **`docs(adr): note supersedes on ADR-0017 + ADR-0018`** — small front-matter edits to 0017/0018 marking them superseded and pointing here.
3. **`docs(context): rewrite Scoring §, redefine Weighted Total → Score Total, remove weight glossary, remove ambiguous term row`**
4. **`chore(prisma): migration drop ScoreItem.weight (M1)`** — generated migration only; no app code yet.
5. **`refactor(scoring): rewrite calc.ts sum-based + update pure unit tests`** — fix all compile errors that cascade from the schema drop. App still runs.
6. **`feat(scoring): remove validateWeights, Σ pill, publish gate weight check`** — UI surface cleanup; Score Item list + create dialog updates; publishScoreItem branch removal.
7. **`feat(assignment): drop weight input from Assignment create dialog (ADR-0019 follow-up)`** — Atomic coupling still works; one fewer field in the dialog.

Steps 2 and 3 are documentation only and land first so any reader of the repo between commits 4–7 sees the canonical glossary, not the in-flight code.

## References

- [ADR-0017](./0017-weight-invariant-basis-points-and-publish-gate.md) — superseded in full
- [ADR-0018](./0018-publish-is-a-contract-no-unpublish-and-field-class-edit-rules.md) § field-class B — partially superseded (weight portion only)
- [ADR-0019](./0019-assignment-scoreitem-coupling-atomic-no-default-weight.md) — Assignment ↔ ScoreItem coupling; loses the `weight` input but keeps atomicity
- CONTEXT.md § Scoring (rewritten in commit 3 of the migration plan)
- HANDOFF.md § "Phase 10 grill" (this session) — Q2 = sum-based locked
