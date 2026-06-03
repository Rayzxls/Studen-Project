"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/guards";
import { findOrCreateSession } from "@/lib/attendance/session";
import { bangkokDateTimeToUtc } from "@/lib/attendance/format";
import { getRequestMeta } from "@/lib/utils/request";
import { HttpError, ValidationError } from "@/lib/errors";

/**
 * Server Action — open a new Session for a CourseOffering.
 *
 * Inputs from the CreateSessionForm dialog:
 *   - courseId         hidden field
 *   - date             "YYYY-MM-DD" (native date input, Bangkok)
 *   - startTime        "HH:mm"
 *   - endTime          "HH:mm"
 *   - timetableSlotId  selected slot id, or "" for manual ad-hoc
 *   - note             optional
 *
 * Pattern 6: `.bind()` is avoided — all context arrives via hidden form
 * fields. The lib (findOrCreateSession) is idempotent + race-safe via the
 * @@unique constraint, so accidental double-submit returns the same Session
 * (created=false) and the redirect still works.
 *
 * On success we `redirect()` straight into the grid page — there is no
 * useful "list page with a flash banner" state for this action, and
 * redirect() also revalidates the list page implicitly.
 */
export type CreateSessionState = {
  fieldErrors?: Record<string, string>;
  error?: string;
};

export async function createSessionAction(
  _prev: CreateSessionState,
  formData: FormData
): Promise<CreateSessionState> {
  const session = await requireRole(["TEACHER"]);

  const courseId = String(formData.get("courseId") ?? "");
  const dateStr = String(formData.get("date") ?? "");
  const startTime = String(formData.get("startTime") ?? "");
  const endTime = String(formData.get("endTime") ?? "");
  const slotIdRaw = String(formData.get("timetableSlotId") ?? "");
  const note = String(formData.get("note") ?? "").trim();

  if (!courseId) return { error: "missing_course_id" };

  const fieldErrors: Record<string, string> = {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    fieldErrors.date = "เลือกวันที่";
  }
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime)) {
    fieldErrors.startTime = "เวลาเริ่มไม่ถูกต้อง (HH:mm)";
  }
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(endTime)) {
    fieldErrors.endTime = "เวลาสิ้นสุดไม่ถูกต้อง (HH:mm)";
  }
  if (!fieldErrors.startTime && !fieldErrors.endTime && startTime >= endTime) {
    fieldErrors.endTime = "เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่ม";
  }
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  let scheduledStart: Date;
  let scheduledEnd: Date;
  try {
    scheduledStart = bangkokDateTimeToUtc(dateStr, startTime);
    scheduledEnd = bangkokDateTimeToUtc(dateStr, endTime);
  } catch {
    return { fieldErrors: { date: "วันเวลาไม่ถูกต้อง" } };
  }

  const meta = await getRequestMeta();
  void meta; // create has no audit (Q11C); kept symmetry for future

  let sessionId: string;
  try {
    const result = await findOrCreateSession({
      courseOfferingId: courseId,
      scheduledStart,
      scheduledEnd,
      timetableSlotId: slotIdRaw || null,
      note: note || null,
      actorUserId: session.user.id,
    });
    sessionId = result.id;
  } catch (err) {
    if (err instanceof ValidationError) return { fieldErrors: err.errors };
    if (err instanceof HttpError) return { error: err.message };
    throw err;
  }

  revalidatePath(`/teacher/courses/${courseId}/attendance`);
  redirect(`/teacher/courses/${courseId}/attendance/${sessionId}`);
}
