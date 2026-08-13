import { notFound, redirect } from "next/navigation";

import {
  DirectMessageInbox,
  type DirectConversationCard,
} from "@/components/chat/direct-message-inbox";
import { TopNav } from "@/components/layout/top-nav";
import { requireAuth } from "@/lib/auth/guards";
import { listDirectConversations } from "@/lib/chat/direct-message";
import { chatEnabled } from "@/lib/chat/feature-flags";

export const dynamic = "force-dynamic";

export default async function ChatInboxPage() {
  if (!chatEnabled()) notFound();
  const session = await requireAuth();
  if (session.user.role === "ADMIN") redirect("/admin/dashboard");
  const conversations = await listDirectConversations({
    ctx: { actorUserId: session.user.id },
  });

  return (
    <div className="min-h-screen bg-bg">
      <TopNav session={session} maxWidth="max-w-[1480px]" />
      <main className="mx-auto max-w-[1180px] animate-fade-in px-4 py-6 sm:px-6 sm:py-8">
        <DirectMessageInbox conversations={serialize(conversations)} />
      </main>
    </div>
  );
}

function serialize(
  conversations: Awaited<ReturnType<typeof listDirectConversations>>
): DirectConversationCard[] {
  return conversations.map((conversation) => ({
    ...conversation,
    lastMessage: conversation.lastMessage
      ? {
          ...conversation.lastMessage,
          createdAt: conversation.lastMessage.createdAt.toISOString(),
        }
      : null,
  }));
}
