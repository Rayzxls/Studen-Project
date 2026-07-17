"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { requireRole } from "@/lib/auth/guards";
import { HttpError } from "@/lib/errors";
import {
  archiveLesson,
  createLesson,
  deleteEmptyLesson,
  getLessonWorkspaceForViewer,
  moveLessonContent,
  reorderLessons,
  updateLesson,
} from "@/lib/lesson";
import { getRequestMeta } from "@/lib/utils/request";

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function noticePath(courseId: string, lessonId: string | null, notice: string) {
  const base = lessonId
    ? `/teacher/courses/${courseId}/lessons/${lessonId}`
    : `/teacher/courses/${courseId}/lessons`;
  return `${base}?notice=${encodeURIComponent(notice)}`;
}

function errorNotice(error: unknown): string {
  if (error instanceof ZodError)
    return error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง";
  if (error instanceof HttpError) {
    const messages: Record<string, string> = {
      lesson_has_pending_grading: "ยังมีงานที่รอตรวจ จึงเก็บบทเรียนไม่ได้",
      lesson_has_open_assignments: "ยังมีการบ้านที่เปิดรับส่งอยู่",
      lesson_not_empty: "ลบได้เฉพาะบทเรียนที่ไม่มีงานหรือเอกสาร",
      lesson_order_out_of_date: "ลำดับบทเรียนเปลี่ยนแล้ว กรุณาลองใหม่",
      lesson_archived: "บทเรียนนี้ถูกเก็บเข้าคลังแล้ว",
      lesson_content_target_invalid: "ย้ายเนื้อหาไปบทเรียนนี้ไม่ได้",
      lesson_content_already_in_target: "เนื้อหาอยู่ในบทเรียนนี้แล้ว",
    };
    return messages[error.code] ?? "ดำเนินการไม่สำเร็จ กรุณาลองใหม่";
  }
  return "เกิดข้อผิดพลาด กรุณาลองใหม่";
}

async function actor() {
  const session = await requireRole(["TEACHER"]);
  const meta = await getRequestMeta();
  return {
    session,
    ctx: {
      actorUserId: session.user.id,
      ipAddress: meta.ipAddress ?? undefined,
      userAgent: meta.userAgent ?? undefined,
    },
  };
}

export async function createLessonAction(formData: FormData): Promise<void> {
  const courseId = text(formData, "courseId");
  let notice = "สร้างบทเรียนแล้ว";
  let lessonId: string | null = null;
  try {
    const { ctx } = await actor();
    const lesson = await createLesson(
      {
        courseOfferingId: courseId,
        title: text(formData, "title"),
        description: text(formData, "description"),
      },
      ctx
    );
    lessonId = lesson.id;
    revalidatePath(`/teacher/courses/${courseId}`);
  } catch (error) {
    notice = errorNotice(error);
  }
  redirect(noticePath(courseId, lessonId, notice));
}

export async function updateLessonAction(formData: FormData): Promise<void> {
  const courseId = text(formData, "courseId");
  const lessonId = text(formData, "lessonId");
  let notice = "บันทึกรายละเอียดแล้ว";
  try {
    const { ctx } = await actor();
    await updateLesson(
      lessonId,
      {
        title: text(formData, "title"),
        description: text(formData, "description"),
      },
      ctx
    );
    revalidatePath(`/teacher/courses/${courseId}`);
  } catch (error) {
    notice = errorNotice(error);
  }
  redirect(noticePath(courseId, lessonId, notice));
}

export async function reorderLessonAction(formData: FormData): Promise<void> {
  const courseId = text(formData, "courseId");
  const lessonId = text(formData, "lessonId");
  const direction = text(formData, "direction");
  let notice = "จัดลำดับบทเรียนแล้ว";
  try {
    const { session, ctx } = await actor();
    const workspace = await getLessonWorkspaceForViewer({
      courseOfferingId: courseId,
      viewer: { id: session.user.id, role: session.user.role },
    });
    const ids = workspace.lessons
      .filter((lesson) => lesson.state === "ACTIVE")
      .map((lesson) => lesson.id);
    const index = ids.indexOf(lessonId);
    const target = direction === "up" ? index - 1 : index + 1;
    if (index >= 0 && target >= 0 && target < ids.length) {
      [ids[index], ids[target]] = [ids[target], ids[index]];
      await reorderLessons({ courseOfferingId: courseId, lessonIds: ids }, ctx);
      revalidatePath(`/teacher/courses/${courseId}/lessons`);
    }
  } catch (error) {
    notice = errorNotice(error);
  }
  redirect(noticePath(courseId, null, notice));
}

export async function archiveLessonAction(formData: FormData): Promise<void> {
  const courseId = text(formData, "courseId");
  const lessonId = text(formData, "lessonId");
  let notice = "เก็บบทเรียนเข้าคลังแล้ว";
  try {
    const { ctx } = await actor();
    await archiveLesson(lessonId, text(formData, "reason"), ctx);
    revalidatePath(`/teacher/courses/${courseId}`);
  } catch (error) {
    notice = errorNotice(error);
  }
  redirect(noticePath(courseId, lessonId, notice));
}

export async function deleteLessonAction(formData: FormData): Promise<void> {
  const courseId = text(formData, "courseId");
  const lessonId = text(formData, "lessonId");
  let notice = "ลบบทเรียนว่างแล้ว";
  let targetLesson: string | null = null;
  try {
    const { ctx } = await actor();
    await deleteEmptyLesson(lessonId, text(formData, "reason"), ctx);
    revalidatePath(`/teacher/courses/${courseId}`);
  } catch (error) {
    notice = errorNotice(error);
    targetLesson = lessonId;
  }
  redirect(noticePath(courseId, targetLesson, notice));
}

export async function moveLessonContentAction(
  formData: FormData
): Promise<void> {
  const courseId = text(formData, "courseId");
  const currentLessonId = text(formData, "currentLessonId");
  let notice = "ย้ายเนื้อหาแล้ว โดยเก็บประวัติเดิมไว้ครบ";
  try {
    const { ctx } = await actor();
    await moveLessonContent(
      {
        contentType: text(formData, "contentType") as "ASSIGNMENT" | "MATERIAL",
        contentId: text(formData, "contentId"),
        targetLessonId: text(formData, "targetLessonId"),
        reason: text(formData, "reason"),
      },
      ctx
    );
    revalidatePath(`/teacher/courses/${courseId}`);
  } catch (error) {
    notice = errorNotice(error);
  }
  redirect(noticePath(courseId, currentLessonId, notice));
}
