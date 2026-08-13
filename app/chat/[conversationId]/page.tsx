import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { notFound, redirect } from "next/navigation";

import {
  CourseChannel,
  type CourseChannelMessage,
} from "@/components/chat/course-channel";
import { TopNav } from "@/components/layout/top-nav";
import { requireAuth } from "@/lib/auth/guards";
import {
  getDirectConversation,
  listDirectMessages,
} from "@/lib/chat/direct-message";
import { chatEnabled } from "@/lib/chat/feature-flags";
import { moderationCenterEnabled } from "@/lib/moderation/feature-flags";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ conversationId: string }>;
}

export default async function DirectConversationPage({ params }: PageProps) {
  if (!chatEnabled()) notFound();
  const session = await requireAuth();
  if (session.user.role === "ADMIN") redirect("/admin/dashboard");
  const { conversationId } = await params;
  const [conversation, messages] = await Promise.all([
    getDirectConversation({
      conversationId,
      ctx: { actorUserId: session.user.id },
    }),
    listDirectMessages({
      conversationId,
      ctx: { actorUserId: session.user.id },
    }),
  ]).catch(() => notFound());
  const name =
    [conversation.other.firstName, conversation.other.lastName]
      .filter((part): part is string => Boolean(part?.trim()))
      .join(" ")
      .trim() || "สมาชิก";

  return (
    <div className="min-h-screen bg-bg">
      <TopNav session={session} maxWidth="max-w-[1480px]" />
      <main className="mx-auto max-w-[980px] animate-fade-in px-4 py-5 sm:px-6 sm:py-8">
        <Link href="/chat" className="btn-ghost btn-sm mb-4">
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          กลับไปข้อความ
        </Link>
        <CourseChannel
          courseId={conversationId}
          endpoint={`/api/chat/conversations/${conversationId}/messages`}
          currentUserId={session.user.id}
          initialMessages={
            messages.map((message) => ({
              ...message,
              createdAt: message.createdAt.toISOString(),
            })) satisfies CourseChannelMessage[]
          }
          title={name}
          subtitle={`ข้อความส่วนตัว · ${conversation.other.role === "TEACHER" ? "ครู" : "นักเรียน"}`}
          reportingEnabled={moderationCenterEnabled()}
          initialBlocked={conversation.blocked}
          initialBlockedByMe={conversation.blockedByMe}
        />
      </main>
    </div>
  );
}
