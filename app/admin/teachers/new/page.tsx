import { redirect } from "next/navigation";

import { requireRole } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

export default async function NewTeacherPage() {
  try {
    await requireRole(["ADMIN"]);
  } catch {
    redirect("/dashboard");
  }

  redirect("/admin/teachers/invites");
}
