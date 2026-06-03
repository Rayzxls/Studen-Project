"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/guards";
import {
  regenerateClassCode,
  setClassCodeActive,
  setClassCodeExpiry,
} from "@/lib/course/class-code";
import {
  createTimetableSlot,
  deleteTimetableSlot,
} from "@/lib/attendance/timetable";
import { getRequestMeta } from "@/lib/utils/request";
import { HttpError, ValidationError } from "@/lib/errors";

export type ClassCodeActionState = {
  fieldErrors?: Record<string, string>;
  error?: string;
  ok?: boolean;
};

export type TimetableSlotActionState = {
  fieldErrors?: Record<string, string>;
  error?: string;
  ok?: boolean;
};

function revalidateAll(courseId: string) {
  revalidatePath(`/teacher/courses/${courseId}`);
  revalidatePath(`/teacher/courses/${courseId}/members`);
  revalidatePath(`/teacher/courses/${courseId}/settings`);
  // Slot edits affect what the attendance list dialog auto-selects.
  revalidatePath(`/teacher/courses/${courseId}/attendance`);
}

// `courseId` lives in a hidden form field (not `.bind`) because the
// Next 16 + Auth.js v5 beta combo drops the session cookie in certain
// bound-Server-Action invocations after a prior revalidatePath cycle —
// reading from FormData side-steps the binding code path entirely.

function readCourseId(formData: FormData): string | null {
  const v = String(formData.get("courseId") ?? "").trim();
  return v.length > 0 ? v : null;
}

export async function regenerateClassCodeAction(
  _prev: ClassCodeActionState,
  formData: FormData
): Promise<ClassCodeActionState> {
  const session = await requireRole(["TEACHER"]);
  const meta = await getRequestMeta();

  const courseId = readCourseId(formData);
  if (!courseId) return { error: "missing_course_id" };

  try {
    await regenerateClassCode({
      courseOfferingId: courseId,
      actorUserId: session.user.id,
      ipAddress: meta.ipAddress ?? undefined,
      userAgent: meta.userAgent ?? undefined,
    });
  } catch (err) {
    if (err instanceof ValidationError) return { fieldErrors: err.errors };
    if (err instanceof HttpError) return { error: err.message };
    throw err;
  }

  revalidateAll(courseId);
  return { ok: true };
}

export async function toggleClassCodeActiveAction(
  _prev: ClassCodeActionState,
  formData: FormData
): Promise<ClassCodeActionState> {
  const session = await requireRole(["TEACHER"]);
  const meta = await getRequestMeta();

  const courseId = readCourseId(formData);
  if (!courseId) return { error: "missing_course_id" };

  const active = String(formData.get("active") ?? "") === "true";

  try {
    await setClassCodeActive({
      courseOfferingId: courseId,
      actorUserId: session.user.id,
      active,
      ipAddress: meta.ipAddress ?? undefined,
      userAgent: meta.userAgent ?? undefined,
    });
  } catch (err) {
    if (err instanceof HttpError) return { error: err.message };
    throw err;
  }

  revalidateAll(courseId);
  return { ok: true };
}

export async function setClassCodeExpiryAction(
  _prev: ClassCodeActionState,
  formData: FormData
): Promise<ClassCodeActionState> {
  const session = await requireRole(["TEACHER"]);
  const meta = await getRequestMeta();

  const courseId = readCourseId(formData);
  if (!courseId) return { error: "missing_course_id" };

  // "" or absent → null (clear expiry).
  // Otherwise expect a `datetime-local` string ("YYYY-MM-DDTHH:mm") which
  // Date() parses as local time.
  const raw = String(formData.get("expiresAt") ?? "").trim();
  let expiresAt: Date | null = null;
  if (raw) {
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
      return { fieldErrors: { expiresAt: "รูปแบบวันที่ไม่ถูกต้อง" } };
    }
    if (parsed.getTime() <= Date.now()) {
      return { fieldErrors: { expiresAt: "วันหมดอายุต้องเป็นอนาคต" } };
    }
    expiresAt = parsed;
  }

  try {
    await setClassCodeExpiry({
      courseOfferingId: courseId,
      actorUserId: session.user.id,
      expiresAt,
      ipAddress: meta.ipAddress ?? undefined,
      userAgent: meta.userAgent ?? undefined,
    });
  } catch (err) {
    if (err instanceof HttpError) return { error: err.message };
    throw err;
  }

  revalidateAll(courseId);
  return { ok: true };
}

/**
 * Server Action — create a TimetableSlot (ADR-0015 § 1, ADR-0016 unrelated).
 *
 * Slot CRUD is not audited (Q11C decision): configuration only, no impact
 * on existing AttendanceRecord rows. Intra-course time-range overlap is
 * rejected by the lib (Conflict) — the schema unique constraint catches
 * the rest as defence in depth.
 *
 * Pattern 6: courseId arrives via hidden field, not `.bind()`. Pattern 9:
 * `meta` is unused right now (no audit) but kept symmetric for the day we
 * add SLOT_* events.
 */
export async function createSlotAction(
  _prev: TimetableSlotActionState,
  formData: FormData
): Promise<TimetableSlotActionState> {
  const session = await requireRole(["TEACHER"]);

  const courseId = readCourseId(formData);
  if (!courseId) return { error: "missing_course_id" };

  const dowRaw = String(formData.get("dayOfWeek") ?? "");
  const startTime = String(formData.get("startTime") ?? "");
  const endTime = String(formData.get("endTime") ?? "");
  const location = String(formData.get("location") ?? "").trim();

  const dayOfWeek = Number.parseInt(dowRaw, 10);
  if (!Number.isInteger(dayOfWeek)) {
    return { fieldErrors: { dayOfWeek: "เลือกวัน" } };
  }

  try {
    await createTimetableSlot({
      courseOfferingId: courseId,
      dayOfWeek,
      startTime,
      endTime,
      location: location || null,
      actorUserId: session.user.id,
    });
  } catch (err) {
    if (err instanceof ValidationError) return { fieldErrors: err.errors };
    if (err instanceof HttpError) {
      if (err.code === "slot_overlap") {
        return {
          fieldErrors: { endTime: "ทับซ้อนกับคาบอื่นในวันเดียวกัน" },
        };
      }
      return { error: err.message };
    }
    throw err;
  }

  revalidateAll(courseId);
  return { ok: true };
}

export async function deleteSlotAction(
  _prev: TimetableSlotActionState,
  formData: FormData
): Promise<TimetableSlotActionState> {
  const session = await requireRole(["TEACHER"]);

  const courseId = readCourseId(formData);
  const slotId = String(formData.get("slotId") ?? "").trim();

  if (!courseId) return { error: "missing_course_id" };
  if (!slotId) return { fieldErrors: { slotId: "missing" } };

  try {
    await deleteTimetableSlot({
      slotId,
      actorUserId: session.user.id,
    });
  } catch (err) {
    if (err instanceof HttpError) return { error: err.message };
    throw err;
  }

  revalidateAll(courseId);
  return { ok: true };
}
