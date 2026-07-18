"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { requireRole } from "@/lib/auth/guards";
import { HttpError } from "@/lib/errors";
import {
  closeQuiz,
  createQuizDraft,
  openQuiz,
  publishQuizResults,
  reopenQuiz,
  saveQuizDraft,
  setQuizStudentException,
  type CreateQuizDraftInput,
} from "@/lib/quiz";

function value(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

export async function saveAndOpenQuizAction(formData: FormData): Promise<void> {
  const courseId = value(formData, "courseId");
  const lessonId = value(formData, "lessonId");
  const quizId = value(formData, "quizId");
  let notice = "เปิดแบบทดสอบให้นักเรียนแล้ว";

  try {
    const actorId = await actorUserId();
    await saveQuizDraft(
      quizId,
      parsePayload(formData) as CreateQuizDraftInput,
      { actorUserId: actorId }
    );
    await openQuiz(
      { courseOfferingId: courseId, quizId },
      { actorUserId: actorId }
    );
    revalidateQuizPaths(courseId, lessonId, quizId);
  } catch (error) {
    notice = errorNotice(error);
  }

  redirect(
    `/teacher/courses/${courseId}/quizzes/${quizId}/results?notice=${encodeURIComponent(notice)}`
  );
}

export async function closeQuizAction(formData: FormData): Promise<void> {
  const courseId = value(formData, "courseId");
  const lessonId = value(formData, "lessonId");
  const quizId = value(formData, "quizId");
  let notice = "ปิดแบบทดสอบและสรุปคำตอบที่ค้างแล้ว";
  try {
    await closeQuiz(
      { courseOfferingId: courseId, quizId },
      { actorUserId: await actorUserId() }
    );
    revalidateQuizPaths(courseId, lessonId, quizId);
  } catch (error) {
    notice = errorNotice(error);
  }
  redirect(resultsHref(courseId, quizId, notice));
}

export async function reopenQuizAction(formData: FormData): Promise<void> {
  const courseId = value(formData, "courseId");
  const lessonId = value(formData, "lessonId");
  const quizId = value(formData, "quizId");
  let notice = "เปิดแบบทดสอบอีกครั้งและแจ้งนักเรียนแล้ว";
  try {
    await reopenQuiz(
      {
        courseOfferingId: courseId,
        quizId,
        newClosesAt: value(formData, "newClosesAt"),
        reason: value(formData, "reason"),
      },
      { actorUserId: await actorUserId() }
    );
    revalidateQuizPaths(courseId, lessonId, quizId);
  } catch (error) {
    notice = errorNotice(error);
  }
  redirect(resultsHref(courseId, quizId, notice));
}

export async function setQuizStudentExceptionAction(
  formData: FormData
): Promise<void> {
  const courseId = value(formData, "courseId");
  const lessonId = value(formData, "lessonId");
  const quizId = value(formData, "quizId");
  const deadline = value(formData, "extendedDeadline");
  let notice = "บันทึกสิทธิ์พิเศษและแจ้งนักเรียนแล้ว";
  try {
    await setQuizStudentException(
      {
        courseOfferingId: courseId,
        quizId,
        enrollmentId: value(formData, "enrollmentId"),
        extendedDeadline: deadline || null,
        extraAttempts: Number(value(formData, "extraAttempts") || "0"),
        reason: value(formData, "reason"),
      },
      { actorUserId: await actorUserId() }
    );
    revalidateQuizPaths(courseId, lessonId, quizId);
  } catch (error) {
    notice = errorNotice(error);
  }
  redirect(resultsHref(courseId, quizId, notice));
}

export async function publishQuizResultsAction(
  formData: FormData
): Promise<void> {
  const courseId = value(formData, "courseId");
  const lessonId = value(formData, "lessonId");
  const quizId = value(formData, "quizId");
  let notice = "เผยแพร่ผลคะแนนให้นักเรียนแล้ว";
  try {
    await publishQuizResults(
      {
        courseOfferingId: courseId,
        quizId,
        missingStudentsConfirmed:
          formData.get("missingStudentsConfirmed") === "on",
      },
      { actorUserId: await actorUserId() }
    );
    revalidateQuizPaths(courseId, lessonId, quizId);
  } catch (error) {
    notice = errorNotice(error);
  }
  redirect(resultsHref(courseId, quizId, notice));
}

function parsePayload(formData: FormData): unknown {
  try {
    return JSON.parse(value(formData, "payload"));
  } catch {
    return null;
  }
}

function errorNotice(error: unknown): string {
  if (error instanceof ZodError) {
    return error.issues[0]?.message ?? "ข้อมูลแบบทดสอบไม่ถูกต้อง";
  }
  if (error instanceof HttpError) {
    const messages: Record<string, string> = {
      quiz_mutations_disabled: "ยังไม่เปิดการสร้างแบบทดสอบสำหรับห้องนี้",
      quiz_attachments_not_enabled:
        "ไฟล์แนบแบบทดสอบจะเปิดในขั้นถัดไป กรุณาบันทึกข้อความก่อน",
      not_course_owner: "เฉพาะครูเจ้าของวิชาเท่านั้นที่แก้แบบทดสอบได้",
      lesson_archived: "บทเรียนนี้ถูกเก็บเข้าคลังแล้ว",
      quiz_not_editable: "แบบทดสอบนี้ไม่ได้อยู่ในสถานะฉบับร่าง",
      quiz_content_locked_after_attempt:
        "แก้เนื้อหาไม่ได้หลังมีนักเรียนเริ่มทำแบบทดสอบแล้ว",
      quiz_scoreitem_published: "คะแนนของแบบทดสอบนี้เผยแพร่แล้ว",
      quiz_not_closeable: "แบบทดสอบนี้ไม่ได้อยู่ในสถานะที่ปิดได้",
      quiz_not_reopenable:
        "เปิดใหม่ไม่ได้ โปรดตรวจว่าเวลาปิดใหม่อยู่ในอนาคตและยังไม่เผยแพร่คะแนน",
      quiz_exception_not_allowed:
        "เพิ่มสิทธิ์พิเศษได้หลังเปิดแบบทดสอบและก่อนเผยแพร่คะแนนเท่านั้น",
      quiz_exception_deadline_not_extended:
        "เวลาพิเศษต้องช้ากว่าเวลาปิดเดิมและอยู่ในอนาคต",
      quiz_attempt_limit_exceeded: "จำนวนครั้งรวมต้องไม่เกิน 10 ครั้ง",
      practice_quiz_attempts_unlimited:
        "แบบฝึกทำไม่จำกัดครั้ง จึงเพิ่มได้เฉพาะเวลา",
      quiz_results_not_publishable: "ต้องปิดแบบทดสอบเก็บคะแนนก่อนเผยแพร่ผล",
      quiz_missing_students_not_confirmed:
        "โปรดยืนยันนักเรียนที่ยังไม่ส่งก่อนเผยแพร่ผล",
      already_published: "ผลคะแนนนี้เผยแพร่แล้ว",
    };
    return messages[error.code] ?? "บันทึกแบบทดสอบไม่สำเร็จ";
  }
  return "เกิดข้อผิดพลาด กรุณาลองใหม่";
}

async function actorUserId(): Promise<string> {
  const session = await requireRole(["TEACHER"]);
  return session.user.id;
}

export async function createQuizDraftAction(formData: FormData): Promise<void> {
  const courseId = value(formData, "courseId");
  const lessonId = value(formData, "lessonId");
  let target = `/teacher/courses/${courseId}/lessons/${lessonId}/quizzes/new`;
  let notice = "สร้างแบบทดสอบฉบับร่างแล้ว";

  try {
    const result = await createQuizDraft(
      parsePayload(formData) as CreateQuizDraftInput,
      { actorUserId: await actorUserId() }
    );
    target = `/teacher/courses/${courseId}/quizzes/${result.id}`;
    revalidateQuizPaths(courseId, lessonId, result.id);
  } catch (error) {
    notice = errorNotice(error);
  }

  redirect(`${target}?notice=${encodeURIComponent(notice)}`);
}

export async function saveQuizDraftAction(formData: FormData): Promise<void> {
  const courseId = value(formData, "courseId");
  const lessonId = value(formData, "lessonId");
  const quizId = value(formData, "quizId");
  let notice = "บันทึกแบบทดสอบฉบับร่างแล้ว";

  try {
    await saveQuizDraft(
      quizId,
      parsePayload(formData) as CreateQuizDraftInput,
      { actorUserId: await actorUserId() }
    );
    revalidateQuizPaths(courseId, lessonId, quizId);
  } catch (error) {
    notice = errorNotice(error);
  }

  redirect(
    `/teacher/courses/${courseId}/quizzes/${quizId}?notice=${encodeURIComponent(notice)}`
  );
}

export type QuizAutosaveResult = {
  ok: boolean;
  message: string;
  savedAt?: string;
};

export async function autosaveQuizDraftAction(
  formData: FormData
): Promise<QuizAutosaveResult> {
  const courseId = value(formData, "courseId");
  const lessonId = value(formData, "lessonId");
  const quizId = value(formData, "quizId");
  try {
    await saveQuizDraft(
      quizId,
      parsePayload(formData) as CreateQuizDraftInput,
      { actorUserId: await actorUserId() }
    );
    revalidateQuizPaths(courseId, lessonId, quizId);
    return {
      ok: true,
      message: "บันทึกอัตโนมัติแล้ว",
      savedAt: new Date().toISOString(),
    };
  } catch (error) {
    return { ok: false, message: errorNotice(error) };
  }
}

function revalidateQuizPaths(
  courseId: string,
  lessonId: string,
  quizId: string
) {
  revalidatePath(`/teacher/courses/${courseId}/lessons/${lessonId}`);
  revalidatePath(`/teacher/courses/${courseId}/quizzes/${quizId}`);
  revalidatePath(`/teacher/courses/${courseId}/quizzes/${quizId}/preview`);
  revalidatePath(`/teacher/courses/${courseId}/quizzes/${quizId}/results`);
  revalidatePath(`/teacher/courses/${courseId}/quizzes`);
  revalidatePath(`/student/courses/${courseId}/quizzes/${quizId}`);
  revalidatePath(`/student/courses/${courseId}/quizzes`);
}

function resultsHref(courseId: string, quizId: string, notice: string) {
  return `/teacher/courses/${courseId}/quizzes/${quizId}/results?notice=${encodeURIComponent(notice)}`;
}
