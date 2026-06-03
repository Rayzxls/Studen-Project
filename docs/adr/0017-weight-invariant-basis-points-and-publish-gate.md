# ADR-0017 — Score Item Weight: Integer Basis Points + Publish-Gate Invariant

## Status

Accepted — 2026-06-04 (Phase 5 entry)

## Context

CONTEXT.md commits to the invariant `Σ weight = 100%` across every ScoreItem of a CourseOffering. Two implementation questions follow from that one-line glossary entry, and the wrong combination corrupts every Phase 5 calc test before it is written:

### Question 1 — Storage unit

A weight column has three plausible shapes:

- **U1 — `Float` / `Double`.** Reads like the percent number. Familiar.
- **U2 — `Decimal(5,2)` (Prisma `Decimal`, Postgres `numeric(5,2)`).** Stores `33.33` exactly. Strict equality on `numeric` is reliable.
- **U3 — `Int` basis points, range 0..10000 (= 0.00 %..100.00 %).** Stores `33.33%` as `3333`.

The downstream consumer is `lib/scoring/calc.ts`. CLAUDE.md § Critical Files marks it as the most-tested code in the codebase and requires it to be **PURE** — pure number math, no I/O, no ORM types.

### Question 2 — Enforcement points

The invariant can be enforced at three lifecycle moments, in any combination:

- **Save / Create / Update (draft).** Reject any save where `Σ ≠ 100`.
- **Publish.** Reject `publishScoreItem` when `Σ ≠ 100`.
- **Edit after publish.** Reject `updateScoreItem` that would drive `Σ ≠ 100`.

A teacher building a fresh CourseOffering will pass through `Σ = 0`, `Σ = 30`, `Σ = 70`, `Σ = 100` as they add items. Forcing `Σ = 100` on every save is the worst UX in this list — the teacher cannot save progress mid-build without already having balanced all weights.

### Question 3 — Rounding tolerance

If `Σ ≠ 100` is the publish gate, what counts as `= 100`?

- **T1 — Strict.** Exactly equal to the canonical encoding of 100 %.
- **T2 — Tolerance ε.** Some `|Σ - 100| < ε` (typically `0.01` or `0.005`).
- **T3 — Auto-distribute.** Server silently adjusts the largest item to make `Σ = 100`.

The "3 items × 33.33 % = 99.99 %" case is the canonical motivating example. Under T1 the teacher must pick one item to be `33.34 %`. Under T2 the system accepts `99.99` silently. Under T3 the system mutates the teacher's data without their consent.

## Decision

### 1. Storage: Integer basis points (Question 1 → U3)

`ScoreItem.weight` is `Int` with valid range `0..10000`. The unit is basis points (1/100 of a percent). A weight of `33.33 %` is stored as `3333`; `100 %` is stored as `10000`.

```prisma
model ScoreItem {
  // ...
  weight Int  // basis points (0..10000), validated by Zod, enforced by validateWeights()
}
```

Zod schema:

```ts
export const ScoreItemWeightSchema = z.number().int().min(0).max(10000);
```

Rendering at the UI edge formats `3333` → `"33.33%"` via a single helper (`formatBasisPoints` in `lib/scoring/format.ts`).

### 2. Enforcement: Save unblocked, publish hard-gated (Question 2)

| Lifecycle moment | `Σ ≠ 10000` behavior |
|---|---|
| Save / Create / Update (draft, `publishedAt IS NULL`) | Allowed. UI surfaces `Σ` as a live status pill — green when `Σ === 10000`, amber otherwise. No server reject. |
| Publish (`publishScoreItem`) | Hard block. Throws `WeightSumNotHundredError` and returns `{ ok: false, error: "weight_sum_not_100", currentSum }`. |
| Edit after publish (`updateScoreItem` with `weight` in patch) | Same hard block — `validateWeights` re-runs inside the `$transaction` (Pattern 2, Phase 4). |

The check itself is a pure helper:

```ts
// lib/scoring/score-item.ts
export function validateWeights(items: { weight: number }[]):
  { sum: number; isValid: boolean }
{
  const sum = items.reduce((acc, it) => acc + it.weight, 0);
  return { sum, isValid: sum === 10000 };
}
```

`validateWeights` is used by both the server (publish gate, edit-after-publish gate) and the client (live status pill on the Score Item list). One source of truth.

### 3. Tolerance: Zero (Question 3 → T1)

`Σ === 10000` is the only acceptance condition. There is no tolerance constant, no `WEIGHT_TOLERANCE_BP`, no auto-distribution. The "3 × 33.33 = 99.99" case forces the teacher to deliberately pick which item carries the `33.34 %`. The rounding decision becomes a visible, transcript-honest choice rather than a buried floating-point loss.

## Consequences

### Positive

- **`lib/scoring/calc.ts` stays purely number-based.** No `Prisma.Decimal` import, no decimal-string wrapping in unit tests. `weightedTotal(entries, items)` is a 5-line reducer over integers + a division at the end.
- **Exact equality is decidable.** The publish gate is `sum === 10000`, not `Math.abs(sum - 100) < ε`. There is no magic constant to argue about in a future PR.
- **One enforcement helper, two call sites.** Server (`publishScoreItem`, `updateScoreItem` when class B fields changed) and client (live UI pill) both call `validateWeights`. The invariant cannot drift between layers because the function has no UI-specific or DB-specific branches.
- **Mid-build UX is preserved.** A teacher who has added 2 of 5 ScoreItems sees `Σ = 6000 (60 %)` on the pill — informative, not blocking. They keep working.
- **Auto-distribute is rejected, so there is no audit puzzle.** If the system silently moved 1 bp from item A to item B during publish, the question "who decided this" would have to be answered in `SCORE_EDIT_AFTER_PUBLISH`. The answer would be "the system" — which is exactly the kind of opaque mutation CLAUDE.md § Hard Rules prohibits.

### Negative

- **The schema column does not read as "percent" at a glance.** A new contributor who sees `weight: Int` may assume it is percent and pass `33` for `33 %`. Mitigation: the field is named `weight` (not `weightPercent`), and a Prisma model comment + `lib/scoring/format.ts` documentation establish the basis-points convention. Zod schema rejects values > 10000.
- **The "3 × 33.33 %" friction is real.** A teacher who genuinely wants three equal items cannot publish until they pick one to carry the `33.34 %`. We accept this as the cost of refusing to ship `99.99 %` to transcripts.
- **A future migration to `Decimal(5,2)` is non-trivial.** Schema type change + Prisma client regeneration + every call site in `lib/scoring/*` would need to switch from `number` to `Prisma.Decimal`. The decision is locked at Phase 5 entry to avoid a Phase 8 churn.

### Rejected Alternatives

- **U1 — Float / Double.** Float drift is exactly what motivates the question. `0.1 + 0.2 ≠ 0.3` in IEEE 754. A weight sum that "should" be 100.00 may surface as 99.99999998. Forces tolerance ε downstream, which is a slippery slope.
- **U2 — Decimal(5,2).** Works correctly but drags `Prisma.Decimal` into `lib/scoring/calc.ts`. Every unit test boundary case (3 ScoreItems, 4 ScoreItems, edge `0`, edge `10000`) would need `new Decimal(33.33)` boilerplate. Given the criticality of these tests, the friction outweighs the schema-honesty benefit.
- **T2 — Tolerance ε.** Introduces a magic constant. The ε that is "tight enough" today is "too tight" the moment a teacher tries five 20.00 items. Real-world drift goes away once we commit to integer storage, so the tolerance has no remaining purpose.
- **T3 — Auto-distribute.** Mutates teacher data without their consent. Audit log either lies ("teacher edited") or admits the system did it (which prompts "why did the system change my numbers?" complaints). Both outcomes are worse than asking the teacher to type `33.34`.
- **Enforce `Σ = 10000` on save.** Worst draft UX. A teacher cannot save mid-build without already having balanced all weights, which is impossible during initial setup.

## References

- CONTEXT.md § Score Item (weight invariant line) · § Weighted Total
- CLAUDE.md § Critical Files (`lib/scoring/*` requires PURE + heavy unit coverage)
- HANDOFF.md § "Patterns established this phase" — Pattern 2 (authz inside `$transaction`) applies to the publish-gate re-check
- ADR-0018 (publish-is-a-contract — companion ADR; `validateWeights` is also called during edit-after-publish gating)
