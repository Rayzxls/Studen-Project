import { db } from "@/lib/db/client";
import { NotFound } from "@/lib/errors";
import {
  chatMutationsEnabled,
  type ChatFeatureFlagEnv,
} from "@/lib/chat/feature-flags";

const RETENTION_BATCH_LIMIT = 500;

/** Clears transient content while preserving the structural placeholder row. */
export async function expireChatMessages(
  params: {
    now?: Date;
    limit?: number;
    env?: ChatFeatureFlagEnv;
  } = {}
): Promise<{ expired: number }> {
  if (!chatMutationsEnabled(params.env)) throw new NotFound("chat_not_found");
  const now = params.now ?? new Date();
  const ids = await db.chatMessage.findMany({
    where: { expiresAt: { lte: now }, deletedAt: null },
    orderBy: [{ expiresAt: "asc" }, { id: "asc" }],
    take: Math.min(Math.max(params.limit ?? RETENTION_BATCH_LIMIT, 1), 2_000),
    select: { id: true },
  });
  if (ids.length === 0) return { expired: 0 };
  const result = await db.chatMessage.updateMany({
    where: { id: { in: ids.map((row) => row.id) }, deletedAt: null },
    data: {
      authorId: null,
      body: null,
      deletedAt: now,
      deletionReason: "RETENTION",
    },
  });
  return { expired: result.count };
}
