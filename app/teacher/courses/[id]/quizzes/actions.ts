"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { requireRole } from "@/lib/auth/guards";
import { HttpError } from "@/lib/errors";
import {
  createQuizDraft,
  saveQuizDraft,
  type CreateQuizDraftInput,
} from "@/lib/quiz";

function value(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
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
}
