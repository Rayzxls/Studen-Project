/**
 * Admin setup CRUD — AcademicYear / Term / Class management.
 *
 * Phase 10B · ADR-0026 § 4 boundaries: ADMIN can create / update / delete
 * these structural records but cannot mutate student data through them.
 *
 * Patterns followed:
 *   - Pattern 2: authorization re-asserted inside every $transaction
 *     (ADMIN role + Forbidden on miss).
 *   - Pattern 3: TX_OPTS on every transaction (Neon cold-start gate).
 *   - ADR-0027: every audit emission carries a `targetLabel` snapshot
 *     so the viewer renders without JOINs.
 *
 * Delete-block policy (Q8c):
 *   - AcademicYear with any Term  → block (`academic_year_has_terms`)
 *   - AcademicYear with any Class → block (`academic_year_has_classes`)
 *   - Term with any CourseOffering → block (`term_has_courses`)
 *   - Class with any CourseOffering → block (`class_has_courses`)
 *   - Class with any active enrollment → block (`class_has_enrollments`)
 */

import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db/client";
import { audit } from "@/lib/audit/log";
import { Conflict, Forbidden, NotFound, ValidationError } from "@/lib/errors";

const TX_OPTS = { maxWait: 10_000, timeout: 15_000 } as const;

interface AdminCtx {
  actorUserId: string;
  ipAddress?: string;
  userAgent?: string;
}

// ─────────────────────────────────────────────────────────────
// AcademicYear
// ─────────────────────────────────────────────────────────────

export interface CreateAcademicYearInput {
  name: string; // "2568" (พ.ศ.)
  isActive?: boolean;
}

export async function createAcademicYear(
  input: CreateAcademicYearInput,
  ctx: AdminCtx
): Promise<{ id: string; name: string }> {
  const name = input.name.trim();
  if (name.length === 0 || name.length > 8) {
    throw new ValidationError({
      name: "ปีการศึกษาต้องเป็นข้อความ 1..8 ตัวอักษร (เช่น 2568)",
    });
  }
  return db.$transaction(async (tx) => {
    await assertAdmin(tx, ctx.actorUserId);
    const dup = await tx.academicYear.findUnique({ where: { name } });
    if (dup) {
      throw new Conflict("academic_year_name_exists");
    }
    if (input.isActive) {
      // Only one active year at a time — clear the rest.
      await tx.academicYear.updateMany({
        where: { isActive: true },
        data: { isActive: false },
      });
    }
    const row = await tx.academicYear.create({
      data: { name, isActive: input.isActive ?? false },
      select: { id: true, name: true, isActive: true },
    });
    await audit(
      {
        actorId: ctx.actorUserId,
        actorRole: "ADMIN",
        action: "ACADEMIC_YEAR_CREATED",
        targetType: "AcademicYear",
        targetId: row.id,
        targetLabel: `ปีการศึกษา ${row.name}`,
        after: { name: row.name, isActive: row.isActive },
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      },
      tx
    );
    return { id: row.id, name: row.name };
  }, TX_OPTS);
}

export interface UpdateAcademicYearInput {
  id: string;
  name: string;
  isActive?: boolean;
}

export async function updateAcademicYear(
  input: UpdateAcademicYearInput,
  ctx: AdminCtx
): Promise<void> {
  const id = input.id.trim();
  const name = input.name.trim();
  if (!id) throw new ValidationError({ id: "missing_id" });
  if (name.length === 0 || name.length > 8) {
    throw new ValidationError({
      name: "ปีการศึกษาต้องเป็นข้อความ 1..8 ตัวอักษร (เช่น 2568)",
    });
  }

  await db.$transaction(async (tx) => {
    await assertAdmin(tx, ctx.actorUserId);
    const before = await tx.academicYear.findUnique({
      where: { id },
      select: { id: true, name: true, isActive: true },
    });
    if (!before) throw new NotFound("academic_year_not_found");

    const dup = await tx.academicYear.findUnique({
      where: { name },
      select: { id: true },
    });
    if (dup && dup.id !== id) throw new Conflict("academic_year_name_exists");

    const isActive = input.isActive ?? false;
    if (isActive) {
      await tx.academicYear.updateMany({
        where: { isActive: true, id: { not: id } },
        data: { isActive: false },
      });
    }

    const after = await tx.academicYear.update({
      where: { id },
      data: { name, isActive },
      select: { id: true, name: true, isActive: true },
    });
    await audit(
      {
        actorId: ctx.actorUserId,
        actorRole: "ADMIN",
        action: "ACADEMIC_YEAR_UPDATED",
        targetType: "AcademicYear",
        targetId: id,
        targetLabel: `ปีการศึกษา ${after.name}`,
        before,
        after,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      },
      tx
    );
  }, TX_OPTS);
}

export async function deleteAcademicYear(
  yearId: string,
  ctx: AdminCtx
): Promise<void> {
  await db.$transaction(async (tx) => {
    await assertAdmin(tx, ctx.actorUserId);
    const year = await tx.academicYear.findUnique({
      where: { id: yearId },
      select: {
        id: true,
        name: true,
        _count: { select: { terms: true, classes: true } },
      },
    });
    if (!year) throw new NotFound("academic_year_not_found");
    if (year._count.terms > 0) throw new Conflict("academic_year_has_terms");
    if (year._count.classes > 0) {
      throw new Conflict("academic_year_has_classes");
    }
    await tx.academicYear.delete({ where: { id: yearId } });
    await audit(
      {
        actorId: ctx.actorUserId,
        actorRole: "ADMIN",
        action: "ACADEMIC_YEAR_DELETED",
        targetType: "AcademicYear",
        targetId: yearId,
        targetLabel: `ปีการศึกษา ${year.name}`,
        before: { name: year.name },
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      },
      tx
    );
  }, TX_OPTS);
}

// ─────────────────────────────────────────────────────────────
// Term
// ─────────────────────────────────────────────────────────────

export interface CreateTermInput {
  academicYearId: string;
  number: number; // 1 or 2 (rare: 3 for summer)
  startDate: Date;
  endDate: Date;
  isActive?: boolean;
}

export async function createTerm(
  input: CreateTermInput,
  ctx: AdminCtx
): Promise<{ id: string; name: string }> {
  if (!Number.isInteger(input.number) || input.number < 1 || input.number > 3) {
    throw new ValidationError({
      number: "ภาคเรียนต้องเป็นตัวเลข 1, 2 หรือ 3 (สำหรับภาคฤดูร้อน)",
    });
  }
  if (input.endDate <= input.startDate) {
    throw new ValidationError({
      endDate: "วันสิ้นสุดต้องอยู่หลังวันเริ่มต้น",
    });
  }
  return db.$transaction(async (tx) => {
    await assertAdmin(tx, ctx.actorUserId);
    const year = await tx.academicYear.findUnique({
      where: { id: input.academicYearId },
      select: { id: true, name: true },
    });
    if (!year) throw new NotFound("academic_year_not_found");
    const dup = await tx.term.findUnique({
      where: {
        academicYearId_number: {
          academicYearId: input.academicYearId,
          number: input.number,
        },
      },
    });
    if (dup) {
      throw new Conflict("term_number_exists_in_year");
    }
    const termName = `เทอม ${input.number}/${year.name}`;
    if (input.isActive) {
      await tx.term.updateMany({
        where: { isActive: true },
        data: { isActive: false },
      });
    }
    const row = await tx.term.create({
      data: {
        academicYearId: input.academicYearId,
        name: termName,
        number: input.number,
        startDate: input.startDate,
        endDate: input.endDate,
        isActive: input.isActive ?? false,
      },
      select: { id: true, name: true, isActive: true },
    });
    await audit(
      {
        actorId: ctx.actorUserId,
        actorRole: "ADMIN",
        action: "TERM_CREATED",
        targetType: "Term",
        targetId: row.id,
        targetLabel: `${row.name} (ปี ${year.name})`,
        after: {
          academicYearId: input.academicYearId,
          number: input.number,
          name: row.name,
          isActive: row.isActive,
        },
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      },
      tx
    );
    return { id: row.id, name: row.name };
  }, TX_OPTS);
}

export interface UpdateTermInput {
  id: string;
  number: number;
  startDate: Date;
  endDate: Date;
  isActive?: boolean;
}

export async function updateTerm(
  input: UpdateTermInput,
  ctx: AdminCtx
): Promise<void> {
  const id = input.id.trim();
  if (!id) throw new ValidationError({ id: "missing_id" });
  if (!Number.isInteger(input.number) || input.number < 1 || input.number > 3) {
    throw new ValidationError({
      number: "ภาคเรียนต้องเป็นตัวเลข 1, 2 หรือ 3 (สำหรับภาคฤดูร้อน)",
    });
  }
  if (input.endDate <= input.startDate) {
    throw new ValidationError({
      endDate: "วันสิ้นสุดต้องอยู่หลังวันเริ่มต้น",
    });
  }

  await db.$transaction(async (tx) => {
    await assertAdmin(tx, ctx.actorUserId);
    const before = await tx.term.findUnique({
      where: { id },
      select: {
        id: true,
        academicYearId: true,
        name: true,
        number: true,
        startDate: true,
        endDate: true,
        isActive: true,
        academicYear: { select: { name: true } },
      },
    });
    if (!before) throw new NotFound("term_not_found");

    const dup = await tx.term.findUnique({
      where: {
        academicYearId_number: {
          academicYearId: before.academicYearId,
          number: input.number,
        },
      },
      select: { id: true },
    });
    if (dup && dup.id !== id) throw new Conflict("term_number_exists_in_year");

    const isActive = input.isActive ?? false;
    if (isActive) {
      await tx.term.updateMany({
        where: { isActive: true, id: { not: id } },
        data: { isActive: false },
      });
    }

    const termName = `เทอม ${input.number}/${before.academicYear.name}`;
    const after = await tx.term.update({
      where: { id },
      data: {
        name: termName,
        number: input.number,
        startDate: input.startDate,
        endDate: input.endDate,
        isActive,
      },
      select: {
        id: true,
        academicYearId: true,
        name: true,
        number: true,
        startDate: true,
        endDate: true,
        isActive: true,
      },
    });
    await audit(
      {
        actorId: ctx.actorUserId,
        actorRole: "ADMIN",
        action: "TERM_UPDATED",
        targetType: "Term",
        targetId: id,
        targetLabel: `${after.name} (ปี ${before.academicYear.name})`,
        before: {
          academicYearId: before.academicYearId,
          name: before.name,
          number: before.number,
          startDate: before.startDate,
          endDate: before.endDate,
          isActive: before.isActive,
        },
        after,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      },
      tx
    );
  }, TX_OPTS);
}

export async function deleteTerm(termId: string, ctx: AdminCtx): Promise<void> {
  await db.$transaction(async (tx) => {
    await assertAdmin(tx, ctx.actorUserId);
    const term = await tx.term.findUnique({
      where: { id: termId },
      select: {
        id: true,
        name: true,
        academicYear: { select: { name: true } },
        _count: { select: { courses: true } },
      },
    });
    if (!term) throw new NotFound("term_not_found");
    if (term._count.courses > 0) throw new Conflict("term_has_courses");
    await tx.term.delete({ where: { id: termId } });
    await audit(
      {
        actorId: ctx.actorUserId,
        actorRole: "ADMIN",
        action: "TERM_DELETED",
        targetType: "Term",
        targetId: termId,
        targetLabel: `${term.name} (ปี ${term.academicYear.name})`,
        before: { name: term.name },
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      },
      tx
    );
  }, TX_OPTS);
}

// ─────────────────────────────────────────────────────────────
// Class
// ─────────────────────────────────────────────────────────────

export interface CreateClassInput {
  academicYearId: string;
  name: string; // "ม.4/2"
  gradeLevel: string; // "ม.4"
  homeroomTeacherId?: string | null;
}

export async function createClass(
  input: CreateClassInput,
  ctx: AdminCtx
): Promise<{ id: string; name: string }> {
  const name = input.name.trim();
  const gradeLevel = input.gradeLevel.trim();
  if (name.length === 0) throw new ValidationError({ name: "ระบุชื่อห้อง" });
  if (gradeLevel.length === 0) {
    throw new ValidationError({ gradeLevel: "ระบุชั้นปี" });
  }
  return db.$transaction(async (tx) => {
    await assertAdmin(tx, ctx.actorUserId);
    const year = await tx.academicYear.findUnique({
      where: { id: input.academicYearId },
      select: { id: true, name: true },
    });
    if (!year) throw new NotFound("academic_year_not_found");
    const dup = await tx.class.findUnique({
      where: {
        academicYearId_name: { academicYearId: input.academicYearId, name },
      },
    });
    if (dup) throw new Conflict("class_name_exists_in_year");

    if (input.homeroomTeacherId) {
      const t = await tx.teacher.findUnique({
        where: { userId: input.homeroomTeacherId },
        select: { homeroomOfId: true },
      });
      if (!t) throw new NotFound("teacher_not_found");
      if (t.homeroomOfId !== null) {
        throw new Conflict("teacher_already_homeroom");
      }
    }

    const row = await tx.class.create({
      data: {
        academicYearId: input.academicYearId,
        name,
        gradeLevel,
      },
      select: { id: true, name: true },
    });
    if (input.homeroomTeacherId) {
      await tx.teacher.update({
        where: { userId: input.homeroomTeacherId },
        data: { homeroomOfId: row.id },
      });
      await audit(
        {
          actorId: ctx.actorUserId,
          actorRole: "ADMIN",
          action: "HOMEROOM_ASSIGNED",
          targetType: "Class",
          targetId: row.id,
          targetLabel: `${row.name} (ปี ${year.name})`,
          after: { teacherId: input.homeroomTeacherId },
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
        tx
      );
    }
    await audit(
      {
        actorId: ctx.actorUserId,
        actorRole: "ADMIN",
        action: "CLASS_CREATED",
        targetType: "Class",
        targetId: row.id,
        targetLabel: `${row.name} (ปี ${year.name})`,
        after: { name, gradeLevel, academicYearId: input.academicYearId },
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      },
      tx
    );
    return row;
  }, TX_OPTS);
}

export interface UpdateClassInput {
  id: string;
  name: string;
  gradeLevel: string;
  homeroomTeacherId?: string | null;
}

export async function updateClass(
  input: UpdateClassInput,
  ctx: AdminCtx
): Promise<void> {
  const id = input.id.trim();
  const name = input.name.trim();
  const gradeLevel = input.gradeLevel.trim();
  if (!id) throw new ValidationError({ id: "missing_id" });
  if (name.length === 0) throw new ValidationError({ name: "ระบุชื่อห้อง" });
  if (gradeLevel.length === 0) {
    throw new ValidationError({ gradeLevel: "ระบุชั้นปี" });
  }

  await db.$transaction(async (tx) => {
    await assertAdmin(tx, ctx.actorUserId);
    const before = await tx.class.findUnique({
      where: { id },
      select: {
        id: true,
        academicYearId: true,
        name: true,
        gradeLevel: true,
        academicYear: { select: { name: true } },
        homeroomTeacher: { select: { userId: true } },
      },
    });
    if (!before) throw new NotFound("class_not_found");

    const dup = await tx.class.findUnique({
      where: {
        academicYearId_name: { academicYearId: before.academicYearId, name },
      },
      select: { id: true },
    });
    if (dup && dup.id !== id) throw new Conflict("class_name_exists_in_year");

    const prevTeacherId = before.homeroomTeacher?.userId ?? null;
    const teacherId = input.homeroomTeacherId ?? null;

    if (prevTeacherId !== teacherId) {
      if (prevTeacherId !== null) {
        await tx.teacher.update({
          where: { userId: prevTeacherId },
          data: { homeroomOfId: null },
        });
      }
      if (teacherId !== null) {
        const teacher = await tx.teacher.findUnique({
          where: { userId: teacherId },
          select: { homeroomOfId: true },
        });
        if (!teacher) throw new NotFound("teacher_not_found");
        if (teacher.homeroomOfId !== null && teacher.homeroomOfId !== id) {
          throw new Conflict("teacher_already_homeroom");
        }
        await tx.teacher.update({
          where: { userId: teacherId },
          data: { homeroomOfId: id },
        });
      }
      await audit(
        {
          actorId: ctx.actorUserId,
          actorRole: "ADMIN",
          action: "HOMEROOM_ASSIGNED",
          targetType: "Class",
          targetId: id,
          targetLabel: `${name} (ปี ${before.academicYear.name})`,
          before: { teacherId: prevTeacherId },
          after: { teacherId },
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
        tx
      );
    }

    const after = await tx.class.update({
      where: { id },
      data: { name, gradeLevel },
      select: {
        id: true,
        academicYearId: true,
        name: true,
        gradeLevel: true,
      },
    });
    await audit(
      {
        actorId: ctx.actorUserId,
        actorRole: "ADMIN",
        action: "CLASS_UPDATED",
        targetType: "Class",
        targetId: id,
        targetLabel: `${after.name} (ปี ${before.academicYear.name})`,
        before: {
          academicYearId: before.academicYearId,
          name: before.name,
          gradeLevel: before.gradeLevel,
          homeroomTeacherId: prevTeacherId,
        },
        after: { ...after, homeroomTeacherId: teacherId },
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      },
      tx
    );
  }, TX_OPTS);
}

export async function deleteClass(
  classId: string,
  ctx: AdminCtx
): Promise<void> {
  await db.$transaction(async (tx) => {
    await assertAdmin(tx, ctx.actorUserId);
    const cls = await tx.class.findUnique({
      where: { id: classId },
      select: {
        id: true,
        name: true,
        academicYear: { select: { name: true } },
        _count: { select: { courses: true, students: true } },
      },
    });
    if (!cls) throw new NotFound("class_not_found");
    if (cls._count.courses > 0) throw new Conflict("class_has_courses");
    if (cls._count.students > 0) throw new Conflict("class_has_enrollments");
    await tx.class.delete({ where: { id: classId } });
    await audit(
      {
        actorId: ctx.actorUserId,
        actorRole: "ADMIN",
        action: "CLASS_DELETED",
        targetType: "Class",
        targetId: classId,
        targetLabel: `${cls.name} (ปี ${cls.academicYear.name})`,
        before: { name: cls.name },
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      },
      tx
    );
  }, TX_OPTS);
}

export async function assignHomeroom(
  classId: string,
  teacherId: string | null,
  ctx: AdminCtx
): Promise<void> {
  await db.$transaction(async (tx) => {
    await assertAdmin(tx, ctx.actorUserId);
    const cls = await tx.class.findUnique({
      where: { id: classId },
      select: {
        id: true,
        name: true,
        academicYear: { select: { name: true } },
        homeroomTeacher: { select: { userId: true } },
      },
    });
    if (!cls) throw new NotFound("class_not_found");
    const prevTeacherId = cls.homeroomTeacher?.userId ?? null;

    if (prevTeacherId === teacherId) return; // no-op

    if (prevTeacherId !== null) {
      await tx.teacher.update({
        where: { userId: prevTeacherId },
        data: { homeroomOfId: null },
      });
    }
    if (teacherId !== null) {
      const t = await tx.teacher.findUnique({
        where: { userId: teacherId },
        select: { homeroomOfId: true },
      });
      if (!t) throw new NotFound("teacher_not_found");
      if (t.homeroomOfId !== null && t.homeroomOfId !== classId) {
        throw new Conflict("teacher_already_homeroom");
      }
      await tx.teacher.update({
        where: { userId: teacherId },
        data: { homeroomOfId: classId },
      });
    }
    await audit(
      {
        actorId: ctx.actorUserId,
        actorRole: "ADMIN",
        action: "HOMEROOM_ASSIGNED",
        targetType: "Class",
        targetId: classId,
        targetLabel: `${cls.name} (ปี ${cls.academicYear.name})`,
        before: { teacherId: prevTeacherId },
        after: { teacherId },
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      },
      tx
    );
  }, TX_OPTS);
}

// ─────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────

async function assertAdmin(
  tx: Prisma.TransactionClient,
  actorUserId: string
): Promise<void> {
  const user = await tx.user.findUnique({
    where: { id: actorUserId },
    select: { role: true },
  });
  if (!user || user.role !== "ADMIN") {
    throw new Forbidden("not_admin");
  }
}
