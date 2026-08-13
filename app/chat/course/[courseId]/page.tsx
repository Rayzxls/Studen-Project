import { notFound, redirect } from "next/navigation";

import { requireAuth } from "@/lib/auth/guards";
import { chatEnabled } from "@/lib/chat/feature-flags";

interface PageProps {
  params: Promise<{ courseId: string }>;
}

export default async function CourseChatRedirectPage({ params }: PageProps) {
  if (!chatEnabled()) notFound();
  const session = await requireAuth();
  const { courseId } = await params;
  if (session.user.role === "TEACHER") {
    redirect(`/teacher/courses/${courseId}/chat`);
  }
  if (session.user.role === "STUDENT") {
    redirect(`/student/courses/${courseId}/chat`);
  }
  redirect("/admin/dashboard");
}
