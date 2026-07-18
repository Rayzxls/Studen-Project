"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { assert } from "@/lib/auth/guards";
import { HttpError } from "@/lib/errors";
import {
  saveQuizAttemptAnswer,
  startOrResumeQuizAttempt,
  submitQuizAttempt,
} from "@/lib/quiz";

export type QuizAttemptActionResult = {
  ok: boolean;
  message: string;
  revision?: number;
  status?: "SUBMITTED" | "AUTO_SUBMITTED";
  score?: number;
  scoreVisible?: boolean;
};

function value(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function integer(formData: FormData, key: string): number {
  return Number.parseInt(value(formData, key), 10);
}

function quizLeaseCookieName(attemptId: string): string {
  return `beagle-quiz-lease-${attemptId}`;
}

function actionError(error: unknown): QuizAttemptActionResult {
  if (error instanceof ZodError) {
    return {
      ok: false,
      message: error.issues[0]?.message ?? "ข้อมูลคำตอบไม่ถูกต้อง",
    };
  }
  if (error instanceof HttpError) {
    const messages: Record<string, string> = {
      quiz_not_open: "แบบทดสอบยังไม่เปิดให้ทำ",
      quiz_not_started: "ยังไม่ถึงเวลาเริ่มแบบทดสอบ",
      quiz_closed: "แบบทดสอบปิดแล้ว",
      quiz_attempt_limit_reached: "ใช้จำนวนครั้งที่ทำได้ครบแล้ว",
      stale_lease: "สิทธิ์แก้ไขอยู่บนอุปกรณ์อื่น กรุณารับสิทธิ์ทำต่อ",
      stale_revision: "คำตอบเปลี่ยนจากอีกหน้าหนึ่ง กรุณารีเฟรชก่อนทำต่อ",
      attempt_expired: "หมดเวลาทำแบบทดสอบ ระบบส่งคำตอบล่าสุดแล้ว",
      attempt_not_active: "ชุดคำตอบนี้ถูกส่งแล้ว",
    };
    return {
      ok: false,
      message: messages[error.code] ?? "ดำเนินการกับแบบทดสอบไม่สำเร็จ",
    };
  }
  return { ok: false, message: "เกิดข้อผิดพลาด กรุณาลองใหม่" };
}

export async function startQuizAttemptAction(
  formData: FormData
): Promise<void> {
  const courseId = value(formData, "courseId");
  const quizId = value(formData, "quizId");
  let target = `/student/courses/${courseId}/quizzes/${quizId}`;
  try {
    const guard = await assert.isActiveCourseMember(courseId);
    const result = await startOrResumeQuizAttempt(
      { courseOfferingId: courseId, quizId },
      { studentUserId: guard.session.user.id }
    );
    const store = await cookies();
    store.set(quizLeaseCookieName(result.attemptId), result.leaseToken, {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: `/student/courses/${courseId}/quizzes/${quizId}`,
      maxAge: 60 * 60 * 24,
    });
    target = `${target}/attempts/${result.attemptId}`;
  } catch (error) {
    target = `${target}?notice=${encodeURIComponent(actionError(error).message)}`;
  }
  redirect(target);
}

export async function saveQuizAnswerAction(
  formData: FormData
): Promise<QuizAttemptActionResult> {
  const courseId = value(formData, "courseId");
  const attemptId = value(formData, "attemptId");
  try {
    const guard = await assert.isActiveCourseMember(courseId);
    const store = await cookies();
    const result = await saveQuizAttemptAnswer(
      {
        courseOfferingId: courseId,
        attemptId,
        questionId: value(formData, "questionId"),
        selectedOptionIds: JSON.parse(
          value(formData, "selectedOptionIds") || "[]"
        ) as string[],
        expectedRevision: integer(formData, "expectedRevision"),
        leaseVersion: integer(formData, "leaseVersion"),
        idempotencyKey: value(formData, "idempotencyKey"),
        leaseToken: store.get(quizLeaseCookieName(attemptId))?.value ?? "",
      },
      { studentUserId: guard.session.user.id }
    );
    return { ok: true, message: "บันทึกคำตอบแล้ว", revision: result.revision };
  } catch (error) {
    return actionError(error);
  }
}

export async function submitQuizAttemptAction(
  formData: FormData
): Promise<QuizAttemptActionResult> {
  const courseId = value(formData, "courseId");
  const attemptId = value(formData, "attemptId");
  try {
    const guard = await assert.isActiveCourseMember(courseId);
    const store = await cookies();
    const result = await submitQuizAttempt(
      {
        courseOfferingId: courseId,
        attemptId,
        expectedRevision: integer(formData, "expectedRevision"),
        leaseVersion: integer(formData, "leaseVersion"),
        idempotencyKey: value(formData, "idempotencyKey"),
        leaseToken: store.get(quizLeaseCookieName(attemptId))?.value ?? "",
      },
      { studentUserId: guard.session.user.id }
    );
    store.set(quizLeaseCookieName(attemptId), "", {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: `/student/courses/${courseId}/quizzes/${value(formData, "quizId")}`,
      maxAge: 0,
    });
    revalidatePath(
      `/student/courses/${courseId}/quizzes/${value(formData, "quizId")}`
    );
    return {
      ok: true,
      message: "ส่งแบบทดสอบเรียบร้อยแล้ว",
      ...result,
    };
  } catch (error) {
    return actionError(error);
  }
}
