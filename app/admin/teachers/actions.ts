"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/guards";
import { createSingleTeacher } from "@/lib/admin/teacher-create-single";
import {
  TEACHER_CREATED_FLASH_COOKIE,
  type CreateTeacherState,
  type TeacherCreatedFlash,
} from "@/lib/admin/teacher-created-flash";
import { getRequestMeta } from "@/lib/utils/request";
import { HttpError, ValidationError } from "@/lib/errors";

export async function createTeacherAction(
  _prev: CreateTeacherState,
  formData: FormData
): Promise<CreateTeacherState> {
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

    const normalizedEmail = email.trim().toLowerCase();
    const displayName = `${firstName.trim()} ${lastName.trim()}`.trim();
    const cookieStore = await cookies();
    cookieStore.set(
      TEACHER_CREATED_FLASH_COOKIE,
      JSON.stringify({
        userId: result.userId,
        displayName,
        email: normalizedEmail,
        tempPassword: result.tempPassword,
      } satisfies TeacherCreatedFlash),
      {
        httpOnly: true,
        sameSite: "lax",
        path: "/admin/teachers",
        maxAge: 10 * 60,
      }
    );

    revalidatePath("/admin/teachers");
    redirect(`/admin/teachers?created=${encodeURIComponent(result.userId)}`);
  } catch (err) {
    if (err instanceof ValidationError) return { fieldErrors: err.errors };
    if (err instanceof HttpError) return { error: err.code };
    throw err;
  }
}

export async function dismissTeacherCreatedFlashAction() {
  await requireRole(["ADMIN"]);
  const cookieStore = await cookies();
  cookieStore.set(TEACHER_CREATED_FLASH_COOKIE, "", {
    path: "/admin/teachers",
    maxAge: 0,
  });
  revalidatePath("/admin/teachers");
}
