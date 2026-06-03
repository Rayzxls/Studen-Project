"use server";

import { revalidatePath } from "next/cache";
import type { AttendanceStatus } from "@prisma/client";
import { requireRole } from "@/lib/auth/guards";
import { bulkMarkAttendance, type MarkItem } from "@/lib/attendance/mark";
import { cancelSession } from "@/lib/attendance/session";
import { getRequestMeta } from "@/lib/utils/request";
import { HttpError, ValidationError } from "@/lib/errors";

/**
 * Server Actions for the per-Session grid page.
 *
 *   submitGridAction  → bulkMarkAttendance (single $transaction batch)
 *   cancelSessionAction → soft-cancel + audit SESSION_CANCELLED
 *
 * Pattern 6: all context (courseId, sessionId) arrives via hidden form
 * fields; per-row status arrives as `status_<enrollmentId>` keys parsed
 * out of FormData. Avoids `.bind()` for compatibility with Auth.js v5
 * beta on Next 16.
 */

const VALID_STATUSES: ReadonlySet<AttendanceStatus> = new Set([
  "PRESENT",
  "LATE",
  "EXCUSED",
  "ABSENT",
]);

export type SubmitGridState = {
  fieldErrors?: Record<string, string>;
  error?: string;
  ok?: boolean;
  marked?: number;
  audited?: boolean;
};

export type CancelSessionState = {
  fieldErrors?: Record<string, string>;
  error?: string;
  ok?: boolean;
};

export async function submitGridAction(
  _prev: SubmitGridState,
  formData: FormData
): Promise<SubmitGridState> {
  const session = await requireRole(["TEACHER"]);

  const courseId = String(formData.get("courseId") ?? "");
  const sessionId = String(formData.get("sessionId") ?? "");
  const reasonRaw = String(formData.get("reason") ?? "");

  if (!courseId) return { error: "missing_course_id" };
  if (!sessionId) return { error: "missing_session_id" };

  // Collect status_<enrollmentId> entries. Form input names follow this
  // convention; entries without a value (unset radio group) are skipped —
  // the lib then treats those students as "ยังไม่เช็ค" (sparse).
  const items: MarkItem[] = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("status_")) continue;
    const enrollmentId = key.slice("status_".length);
    if (!enrollmentId) continue;
    const status = String(value);
    if (!status) continue;
    if (!VALID_STATUSES.has(status as AttendanceStatus)) {
      return { fieldErrors: { status: "สถานะไม่ถูกต้อง" } };
    }
    const note = String(formData.get(`note_${enrollmentId}`) ?? "").trim();
    items.push({
      enrollmentId,
      status: status as AttendanceStatus,
      note: note || null,
    });
  }

  if (items.length === 0) {
    return { fieldErrors: { items: "ยังไม่ได้เลือกสถานะของนักเรียนคนใด" } };
  }

  const meta = await getRequestMeta();

  try {
    const result = await bulkMarkAttendance({
      sessionId,
      actorUserId: session.user.id,
      items,
      reason: reasonRaw || null,
      ipAddress: meta.ipAddress ?? undefined,
      userAgent: meta.userAgent ?? undefined,
    });
    revalidatePath(`/teacher/courses/${courseId}/attendance/${sessionId}`);
    revalidatePath(`/teacher/courses/${courseId}/attendance`);
    return { ok: true, marked: result.marked, audited: result.audited };
  } catch (err) {
    if (err instanceof ValidationError) return { fieldErrors: err.errors };
    if (err instanceof HttpError) return { error: err.message };
    throw err;
  }
}

export async function cancelSessionAction(
  _prev: CancelSessionState,
  formData: FormData
): Promise<CancelSessionState> {
  const session = await requireRole(["TEACHER"]);

  const courseId = String(formData.get("courseId") ?? "");
  const sessionId = String(formData.get("sessionId") ?? "");
  const reason = String(formData.get("reason") ?? "");

  if (!courseId) return { error: "missing_course_id" };
  if (!sessionId) return { error: "missing_session_id" };

  const meta = await getRequestMeta();

  try {
    await cancelSession({
      sessionId,
      actorUserId: session.user.id,
      reason,
      ipAddress: meta.ipAddress ?? undefined,
      userAgent: meta.userAgent ?? undefined,
    });
  } catch (err) {
    if (err instanceof ValidationError) return { fieldErrors: err.errors };
    if (err instanceof HttpError) return { error: err.message };
    throw err;
  }

  revalidatePath(`/teacher/courses/${courseId}/attendance/${sessionId}`);
  revalidatePath(`/teacher/courses/${courseId}/attendance`);
  return { ok: true };
}
