"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/guards";
import { CreateCourseSchema } from "@/lib/validation/course";
import { createCourseOffering } from "@/lib/course/create-course";
import { getRequestMeta } from "@/lib/utils/request";
import { HttpError, ValidationError } from "@/lib/errors";

export type CreateCourseState = {
  fieldErrors?: Record<string, string>;
  error?: string;
};

export async function createCourseAction(
  _prev: CreateCourseState,
  formData: FormData
): Promise<CreateCourseState> {
  const session = await requireRole(["TEACHER"]);

  const raw = {
    subjectId: String(formData.get("subjectId") ?? ""),
    classId: String(formData.get("classId") ?? ""),
    termId: String(formData.get("termId") ?? ""),
  };

  const parsed = CreateCourseSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path.join(".");
      if (!fieldErrors[field]) fieldErrors[field] = issue.message;
    }
    return { fieldErrors };
  }

  const meta = await getRequestMeta();

  let courseId: string;
  try {
    const created = await createCourseOffering({
      teacherUserId: session.user.id,
      ...parsed.data,
      ipAddress: meta.ipAddress ?? undefined,
      userAgent: meta.userAgent ?? undefined,
    });
    courseId = created.id;
  } catch (err) {
    if (err instanceof ValidationError) return { fieldErrors: err.errors };
    if (err instanceof HttpError) {
      if (err.code === "course_offering_already_exists") {
        return { error: "วิชานี้คุณมีอยู่แล้วในห้อง+เทอมนี้" };
      }
      return { error: err.message };
    }
    throw err;
  }

  redirect(`/teacher/courses/${courseId}`);
}
