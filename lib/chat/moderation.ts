import { db } from "@/lib/db/client";

export async function restrictedChatMessageIds(
  messageIds: readonly string[]
): Promise<Set<string>> {
  if (messageIds.length === 0) return new Set();
  const rows = await db.moderationCase.findMany({
    where: {
      targetType: "CHAT_MESSAGE",
      targetId: { in: [...messageIds] },
      restrictionKind: "HIDDEN",
    },
    select: { targetId: true },
  });
  return new Set(rows.map((row) => row.targetId));
}
