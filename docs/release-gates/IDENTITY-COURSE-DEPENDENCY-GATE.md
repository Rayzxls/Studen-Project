# Identity and Course Dependency Gate

This gate supports the staged identity and CourseOffering redesign defined by
ADR-0039, ADR-0040, and ADR-0041. It inventories dependencies on concepts that
the target product no longer uses and prevents new dependencies from being
introduced while the migration remains additive.

## Commands

```powershell
npm run qa:release:dependencies
npm run qa:release:dependencies:strict
npm run qa:release:dependencies:baseline
```

- `qa:release:dependencies` compares the current tree with the committed
  baseline. It fails when a new dependency is introduced, but permits existing
  debt to be removed incrementally.
- `qa:release:dependencies:strict` also fails while any blocker remains. This
  command is expected to fail at the start of the migration and must pass
  before the destructive QA migration/reset.
- `qa:release:dependencies:baseline` rewrites the baseline. Use it only after
  reviewing intentional rule changes or an approved migration step.
- A compatibility bridge may suppress one exact rule on one line with
  `dependency-gate-allow(<rule-id>): <reviewed reason>`. The reason is required,
  the marker does not suppress other rules on that line, and it must not be
  used to hide a new product dependency or to rewrite the baseline.

## Finding Classes

- `blocker`: a known dependency on Student Number, Admin-managed academic
  structure, legacy identity onboarding, or term-level aggregation. Every
  blocker must be removed before the release gate can be closed.
- `review`: an ambiguous symbol requiring classification. In particular,
  `studentId` often means the immutable internal `User.id` relation and must
  not be deleted blindly.

Historical Prisma migrations are excluded because they are an immutable record
of prior schema states. The current Prisma schema, application code, tests,
seed, and bootstrap scripts remain in scope.

This gate is not a replacement for typecheck, unit/integration tests, migration
verification, isolated Neon QA, backup/restore drills, or explicit Production
approval.

## Initial Baseline

Baseline `2026-07-24.3` records the pre-migration source tree:

| Class | Findings |
| --- | ---: |
| Blocker | 637 |
| Review | 240 |
| Total | 877 |

The largest blocker groups are structured `Class`/`classId` dependencies (105),
`gradeLevel` (103), temporary-password onboarding (85), term-level grade
aggregation (87), and Admin-managed `AcademicYear` (69). The 240 review
findings are intentionally separate because many `studentId` symbols represent
an internal relation to `User.id`, not the retired human Student Number.
