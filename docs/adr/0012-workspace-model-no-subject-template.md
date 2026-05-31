# ADR-0012 — Workspace Model: Teacher-Owned CourseOffering (no school-wide Subject)

## Status
Accepted — 2026-05-31 (supersedes implicit decision in ADR-0001 era)

## Context

Phase 2 of Studennnn shipped with a `Subject` table acting as a school-wide template:
- Each Subject had `name`, `code` (e.g. `MATH-M4`), `gradeLevel`, `creditHours`
- Teachers picked a Subject from a dropdown when creating a `CourseOffering`
- Trade-off: data integrity (Term GPA + transcript) at cost of teacher flexibility

The user pushed back during Phase 2 manual review:
> "ทำไมเราไม่สามารถสร้าง หรือตั้งชื่อเองได้ ให้เป็น Workspace ของคุณครู"

This conflicts with two of the project's foundational visions:
1. **"Workspace ครู"** — Teachers should feel ownership over their classroom
2. **"Admin ไม่เป็นภาระ"** — Admins should not have to pre-populate Subjects before teachers can start

Three options were considered:
- **A** Pure workspace: teacher writes everything, no Subject entity
- **B** Hybrid: Subject template + teacher-created Subjects + display-name override
- **C** Free-form with admin-merge tool

## Decision

Option **A — Pure Workspace**. Drop the `Subject` table. Move workspace fields directly onto `CourseOffering`:

| Field | Type | Owner |
|-------|------|-------|
| `name` | String (required) | Teacher writes freely |
| `subjectCode` | String? (optional) | Teacher sets for transcript matching |
| `gradeLevel` | String | Defaults to `class.gradeLevel` |
| `creditHours` | Float | Teacher specifies (school-policy enforced by convention) |

The uniqueness constraint `[teacherId, subjectId, classId, termId]` is removed — a teacher can now create multiple workspaces for the same class+term if they wish (e.g. "Math Period 3" vs "Math Period 5").

## Consequences

### ดี
- ✅ **Teacher feels ownership** — workspace model matches Google Classroom mental model
- ✅ **Admin truly hands-off** — no Subject pre-population required
- ✅ **Faster onboarding** — teacher creates course in one form, no waiting on Admin
- ✅ **Simpler schema** — one less table, one less FK, one less write-validation path

### เสีย
- ❌ **Cross-class reporting weakens** — "all คณิตศาสตร์ ม.4 across school" requires fuzzy matching on `name` or grouping by `subjectCode` (only if teachers fill it in)
- ❌ **No transcript code standard** — students transferring schools may have ad-hoc course names
- ❌ **CreditHours uniformity by convention only** — if Teacher A writes 1.5 and Teacher B writes 1.0 for same logical subject, Term GPA differs across sections
- ❌ **Loss of Phase 2 seed data** — DB force-reset required to drop Subject; dev users (testpass1234, 60099) lost (seed accounts recreated)

### Neutral
- 🟡 **Subject code as soft hint** — teachers who care about transcript fidelity can fill in `subjectCode` (`MATH-M4`); reports group by this when present, by name otherwise
- 🟡 **Validation now form-side** — credit hours must be in `[0, 10]`, name `[1, 200]`, gradeLevel `[1, 20]` — enforced by Zod schemas

## Alternatives Considered

### B. Hybrid (Subject template + teacher-create-new + display-name override)
**Why rejected:** Adds form complexity (dropdown + "Add new" modal + display name). User explicitly said "ตั้งชื่อเอง" — they wanted the simple path.

### C. Free-form + Admin merge tool
**Why rejected:** Conflicts with "Admin ไม่เป็นภาระ" — admin would have to actively maintain Subject hygiene.

### D. Keep Subject as auto-created behind the scenes
**Considered then rejected** because it hides the data model from the teacher (forms are simpler but DB has invisible Subject rows). Not worth the indirection.

## Related Changes

- **Schema:** Removed `Subject` model + `subjectId` FK on `CourseOffering`. Added `name`, `subjectCode`, `gradeLevel`, `creditHours` directly on `CourseOffering`.
- **Migration strategy:** Dev DB force-reset (acceptable in pre-launch). Production migration plan (when applicable): backfill CourseOffering from Subject, then drop FK + table.
- **Term GPA query** (Phase 5): reads `creditHours` from CourseOffering directly (was previously joining Subject).
- **Transcript print** (Phase 5+): uses `name` as primary label, `subjectCode` as secondary if set.
- **Audit:** Added `COURSE_OFFERING_CREATED` event (previously logged with the now-removed `SUBJECT_*` semantics).

## Future Considerations

- **Phase 8 — Admin tools:** Add "Subject report" that groups CourseOfferings by `subjectCode` (if teachers fill it in) for school-wide insights
- **Phase 9 — Hardening:** Soft-enforce `creditHours` consistency: when teacher types name matching an existing course's name, suggest the existing credit value
- **Long term:** If multi-school SaaS becomes a real need (ADR-0001 currently No), Subject template per school may need to come back

## Related

- [ADR-0001](./0001-single-tenant.md) — Single-tenant (relevant — multi-school would re-introduce need for Subject)
- [CONTEXT.md](../../CONTEXT.md) — Glossary now defines CourseOffering as the workspace
- [Architecture.md § Data Model](../../Architecture.md) — Schema updated
