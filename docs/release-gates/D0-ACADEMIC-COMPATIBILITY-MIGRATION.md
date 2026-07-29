# D0 Academic Compatibility Migration

**Status:** isolated Neon QA migration drill complete; Production unauthorized
**Updated:** 2026-07-29
**Scope:** isolated Neon QA first; Production is explicitly out of scope

## Purpose

Teacher-owned `CourseOffering` metadata now replaces Admin-managed academic
structure throughout the product runtime. The remaining academic structure is
compatibility storage:

- `AcademicYear`, `Term`, and `Class` tables
- `Teacher.homeroomOfId`
- `Student.classId`
- `CourseOffering.classId`
- `CourseOffering.termId`
- `CourseOffering.gradeLevel`
- foreign keys, unique constraints, and indexes owned by those fields

This migration must not remove `CourseOffering.learnerGroupLabel`,
`CourseOffering.academicPeriodLabel`, `CourseOffering.creditHours`, course
archive state, historical Audit snapshots, or internal User relations such as
`Enrollment.studentId`.

## Isolated QA drill

Configure an isolated Neon child through private local environment values:

```dotenv
DATABASE_URL="postgresql://...primary..."
QA_DATABASE_URL="postgresql://...isolated-qa..."
```

Run:

```powershell
npm run db:academic-compatibility:qa:preflight
npm run qa:release:dependencies
npm run qa:release:dependencies:academic:strict
```

The preflight replaces the active datasource with `QA_DATABASE_URL`, compares
its normalized database identity with `DATABASE_URL`, and fails closed when
they match. It prints aggregate counts only and does not mutate data.

### Read-only evidence: 2026-07-29

The preflight ran successfully against the isolated Neon QA branch after the
D1 drill:

| Check | QA aggregate |
| --- | ---: |
| Academic Year rows | 0 |
| Term rows | 0 |
| Class rows | 0 |
| Teacher Homeroom links | 0 |
| Student Class links | 0 |
| Course Class links | 0 |
| Course Term links | 0 |
| Course structured Grade values | 0 |
| Missing/mismatched learner-group labels | 0 |
| Missing/mismatched academic-period labels | 0 |

The preflight reported `destructiveQaMigrationReady: true`. The owner then
explicitly approved dropping the compatibility structure on Neon QA only.
Production remained out of scope.

### Migration evidence: 2026-07-29

- Applied `20260729020000_drop_academic_compatibility_structure` through the
  fail-closed isolated Prisma runner.
- Prisma reports all ten migrations up to date on Neon QA.
- The post-migration verifier confirms that `AcademicYear`, `Term`, and
  `Class`; all five retired relation/metadata columns; and their foreign keys,
  indexes, and unique constraints are absent.
- `CourseOffering.learnerGroupLabel`, `academicPeriodLabel`, and `creditHours`
  remain present.
- Dependency inventory is `0 blocker / 137 review / 137 total`; both academic
  and identity strict scopes report zero findings.
- Full isolated integration passes against the migrated schema at
  `128 files / 985 tests`, including the standalone-course regression. The
  separately run unit suite is `94 files / 781 tests`; TypeScript, ESLint, and
  Production build pass.
- The project-level Neon branch reset/application recovery procedure was
  rehearsed successfully on disposable QA branches on 2026-07-14. A new
  D0-specific restore child was not created because Neon branch lifecycle
  operations remain owner-only and local branch-management tooling is not
  configured. Do not claim a D0-specific restore rehearsal.
- Production was not connected, migrated, reset, or otherwise modified.

## Applied QA drop boundary

The D0 QA migration drops only:

1. Foreign keys and indexes for Teacher Homeroom, Student Class, and
   CourseOffering Class/Term compatibility.
2. `Teacher.homeroomOfId`.
3. `Student.classId`.
4. `CourseOffering.classId`, `CourseOffering.termId`, and
   `CourseOffering.gradeLevel`.
5. `Class`, then `Term`, then `AcademicYear`, after all references are gone.

Do not combine this migration with identity, Lesson, Quiz, score, attendance,
file, notification, moderation, or retention changes.

## Acceptance result

Against the same isolated QA branch and source tree:

- Prisma migration status and schema verification pass.
- Academic strict dependency gate reports zero blockers.
- Unit, integration, TypeScript, ESLint, and Production build pass.
- Teacher creates a CourseOffering using optional free-text labels.
- Teacher and Student dashboards, course cards, Feed, Lesson, timetable,
  reports, results, archive, and Admin observer views remain correct.
- Existing legacy-linked courses retain their visible learner-group and
  academic-period labels.
- Safe route smoke and authenticated role acceptance remain required before
  any separately approved Production cutover; they are not inferred from this
  schema drill.

## Rollback

Use Neon branch reset or branch switching only on a disposable QA child. Do
not reconstruct dropped academic records by guessing from free-text labels.
Production reset, schema migration, or data repair remains blocked and
requires a separate named approval, current restore evidence, and cutover
checklist.
