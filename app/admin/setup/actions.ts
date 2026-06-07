"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/guards";
import { getRequestMeta } from "@/lib/utils/request";
import {
  createAcademicYear,
  createTerm,
  createClass,
  deleteAcademicYear,
  deleteTerm,
  deleteClass,
} from "@/lib/admin/setup";
import { createSingleTeacher } from "@/lib/admin/teacher-create-single";
import { HttpError, ValidationError } from "@/lib/errors";

/**
 * /admin/setup × 4 tabs Server Actions — Phase 10B Q8.
 *
 * Pattern 6 (hidden form fields, no `.bind()`) + Pattern 8 (only async
 * exports from a "use server" file).
 *
 * Each action returns a state shape with `fieldErrors` (per-input
 * messages) + `error` (top-level message) + `ok` (success flag) + a few
 * payload extras (e.g. the single-teacher-add reveals the temp password
 * exactly once here, then it's gone).
 */

interface BaseState {
  fieldErrors?: Record<string, string>;
  error?: string;
  ok?: boolean;
}

// ─────────────────────────────────────────────────────────────
// AcademicYear
// ─────────────────────────────────────────────────────────────

export type CreateAcademicYearState = BaseState;

export async function createAcademicYearAction(
  _prev: CreateAcademicYearState,
  formData: FormData
): Promise<CreateAcademicYearState> {
  const session = await requireRole(["ADMIN"]);
  const meta = await getRequestMeta();
  const name = String(formData.get("name") ?? "");
  const isActive = formData.get("isActive") === "on";
  try {
    await createAcademicYear(
      { name, isActive },
      {
        actorUserId: session.user.id,
        ipAddress: meta.ipAddress ?? undefined,
        userAgent: meta.userAgent ?? undefined,
      }
    );
  } catch (err) {
    if (err instanceof ValidationError) return { fieldErrors: err.errors };
    if (err instanceof HttpError) return { error: err.message };
    throw err;
  }
  revalidatePath("/admin/setup");
  return { ok: true };
}

export type DeleteAcademicYearState = BaseState;

export async function deleteAcademicYearAction(
  _prev: DeleteAcademicYearState,
  formData: FormData
): Promise<DeleteAcademicYearState> {
  const session = await requireRole(["ADMIN"]);
  const meta = await getRequestMeta();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "missing_id" };
  try {
    await deleteAcademicYear(id, {
      actorUserId: session.user.id,
      ipAddress: meta.ipAddress ?? undefined,
      userAgent: meta.userAgent ?? undefined,
    });
  } catch (err) {
    if (err instanceof HttpError) return { error: err.message };
    throw err;
  }
  revalidatePath("/admin/setup");
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// Term
// ─────────────────────────────────────────────────────────────

export type CreateTermState = BaseState;

export async function createTermAction(
  _prev: CreateTermState,
  formData: FormData
): Promise<CreateTermState> {
  const session = await requireRole(["ADMIN"]);
  const meta = await getRequestMeta();
  const academicYearId = String(formData.get("academicYearId") ?? "");
  const number = Number.parseInt(String(formData.get("number") ?? "0"), 10);
  const startStr = String(formData.get("startDate") ?? "");
  const endStr = String(formData.get("endDate") ?? "");
  const isActive = formData.get("isActive") === "on";
  if (!academicYearId) return { fieldErrors: { academicYearId: "เลือกปี" } };
  if (!startStr || !endStr) {
    return {
      fieldErrors: { startDate: "ระบุวันที่เริ่มต้น/สิ้นสุด" },
    };
  }
  try {
    await createTerm(
      {
        academicYearId,
        number,
        startDate: new Date(startStr),
        endDate: new Date(endStr),
        isActive,
      },
      {
        actorUserId: session.user.id,
        ipAddress: meta.ipAddress ?? undefined,
        userAgent: meta.userAgent ?? undefined,
      }
    );
  } catch (err) {
    if (err instanceof ValidationError) return { fieldErrors: err.errors };
    if (err instanceof HttpError) return { error: err.message };
    throw err;
  }
  revalidatePath("/admin/setup");
  return { ok: true };
}

export type DeleteTermState = BaseState;

export async function deleteTermAction(
  _prev: DeleteTermState,
  formData: FormData
): Promise<DeleteTermState> {
  const session = await requireRole(["ADMIN"]);
  const meta = await getRequestMeta();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "missing_id" };
  try {
    await deleteTerm(id, {
      actorUserId: session.user.id,
      ipAddress: meta.ipAddress ?? undefined,
      userAgent: meta.userAgent ?? undefined,
    });
  } catch (err) {
    if (err instanceof HttpError) return { error: err.message };
    throw err;
  }
  revalidatePath("/admin/setup");
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// Class
// ─────────────────────────────────────────────────────────────

export type CreateClassState = BaseState;

export async function createClassAction(
  _prev: CreateClassState,
  formData: FormData
): Promise<CreateClassState> {
  const session = await requireRole(["ADMIN"]);
  const meta = await getRequestMeta();
  const academicYearId = String(formData.get("academicYearId") ?? "");
  const name = String(formData.get("name") ?? "");
  const gradeLevel = String(formData.get("gradeLevel") ?? "");
  const homeroomTeacherIdRaw = String(formData.get("homeroomTeacherId") ?? "");
  const homeroomTeacherId =
    homeroomTeacherIdRaw === "" ? null : homeroomTeacherIdRaw;
  if (!academicYearId) return { fieldErrors: { academicYearId: "เลือกปี" } };
  try {
    await createClass(
      { academicYearId, name, gradeLevel, homeroomTeacherId },
      {
        actorUserId: session.user.id,
        ipAddress: meta.ipAddress ?? undefined,
        userAgent: meta.userAgent ?? undefined,
      }
    );
  } catch (err) {
    if (err instanceof ValidationError) return { fieldErrors: err.errors };
    if (err instanceof HttpError) return { error: err.message };
    throw err;
  }
  revalidatePath("/admin/setup");
  return { ok: true };
}

export type DeleteClassState = BaseState;

export async function deleteClassAction(
  _prev: DeleteClassState,
  formData: FormData
): Promise<DeleteClassState> {
  const session = await requireRole(["ADMIN"]);
  const meta = await getRequestMeta();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "missing_id" };
  try {
    await deleteClass(id, {
      actorUserId: session.user.id,
      ipAddress: meta.ipAddress ?? undefined,
      userAgent: meta.userAgent ?? undefined,
    });
  } catch (err) {
    if (err instanceof HttpError) return { error: err.message };
    throw err;
  }
  revalidatePath("/admin/setup");
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// Teacher single add — reveals temp password once
// ─────────────────────────────────────────────────────────────

export interface CreateSingleTeacherState extends BaseState {
  /** Plaintext temp password — present in the result ONCE, cleared on
   *  next form interaction. Never logged, never persisted (CLAUDE.md
   *  hard rule). */
  tempPassword?: string;
  displayName?: string;
}

export async function createSingleTeacherAction(
  _prev: CreateSingleTeacherState,
  formData: FormData
): Promise<CreateSingleTeacherState> {
  const session = await requireRole(["ADMIN"]);
  const meta = await getRequestMeta();
  const email = String(formData.get("email") ?? "");
  const firstName = String(formData.get("firstName") ?? "");
  const lastName = String(formData.get("lastName") ?? "");
  try {
    const result = await createSingleTeacher(
      { email, firstName, lastName },
      {
        actorUserId: session.user.id,
        ipAddress: meta.ipAddress ?? undefined,
        userAgent: meta.userAgent ?? undefined,
      }
    );
    revalidatePath("/admin/setup");
    revalidatePath("/admin/teachers");
    return {
      ok: true,
      tempPassword: result.tempPassword,
      displayName: `${firstName} ${lastName} (${email})`,
    };
  } catch (err) {
    if (err instanceof ValidationError) return { fieldErrors: err.errors };
    if (err instanceof HttpError) return { error: err.message };
    throw err;
  }
}
