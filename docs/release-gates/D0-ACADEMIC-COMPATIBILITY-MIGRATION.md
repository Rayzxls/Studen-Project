# D0 Academic Compatibility Migration

**Status:** read-only planning; no migration SQL or database mutation authorized
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

## Read-only preflight

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

The preflight reports `destructiveQaMigrationReady: true`. The academic strict
dependency gate correctly remains closed at `18 blocker / 0 review` because
the compatibility models, fields, relations, and indexes still exist in the
current Prisma schema. No migration SQL was written and no QA or Production
schema/data mutation occurred in this planning slice.

## Required decisions before migration SQL

1. Confirm the target product still has no shared Class membership, Homeroom
   Teacher, Admin-managed Academic Year, or Admin-managed Term behavior.
2. Confirm every legacy-linked CourseOffering has its learner-group and
   academic-period display values preserved in the teacher-owned labels.
3. Confirm `Student.classId` and `Teacher.homeroomOfId` are retired
   associations, not data that must be converted into another product concept.
4. Confirm historical Audit rows remain readable through their stored
   snapshots without joins to the retired tables.
5. Reach zero blockers in the academic strict dependency gate.
6. Create a disposable Neon restore child and record a current restore point.
7. Obtain a separately named approval for an isolated-QA migration drill.

## Planned drop boundary

The future D0 migration may drop only:

1. Foreign keys and indexes for Teacher Homeroom, Student Class, and
   CourseOffering Class/Term compatibility.
2. `Teacher.homeroomOfId`.
3. `Student.classId`.
4. `CourseOffering.classId`, `CourseOffering.termId`, and
   `CourseOffering.gradeLevel`.
5. `Class`, then `Term`, then `AcademicYear`, after all references are gone.

Do not combine this migration with identity, Lesson, Quiz, score, attendance,
file, notification, moderation, or retention changes.

## Acceptance

Against the same isolated QA branch and commit:

- Prisma migration status and schema verification pass.
- Academic strict dependency gate reports zero blockers.
- Unit, integration, TypeScript, ESLint, and Production build pass.
- Teacher creates a CourseOffering using optional free-text labels.
- Teacher and Student dashboards, course cards, Feed, Lesson, timetable,
  reports, results, archive, and Admin observer views remain correct.
- Existing legacy-linked courses retain their visible learner-group and
  academic-period labels.
- Safe route smoke and authenticated Teacher, Student, and Admin acceptance
  pass.

## Rollback

Use Neon branch reset or branch switching only on a disposable QA child. Do
not reconstruct dropped academic records by guessing from free-text labels.
Production reset, schema migration, or data repair requires a separate
approval, current restore evidence, and cutover checklist.
