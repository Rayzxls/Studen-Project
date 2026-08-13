export const CHAT_MESSAGE_MAX_LENGTH = 4_000;

/**
 * A DM pair has one stable conversation regardless of who starts it.
 * User ids are opaque, so ordering them leaks no product identity.
 */
export function directConversationKey(
  firstUserId: string,
  secondUserId: string
) {
  const first = firstUserId.trim();
  const second = secondUserId.trim();
  if (!first || !second) throw new Error("chat_participant_required");
  if (first === second) throw new Error("chat_cannot_message_self");
  return [first, second].sort().join(":");
}

/** Empty/whitespace-only messages are not conversation. */
export function normalizeChatMessage(body: string): string {
  const normalized = body.trim();
  if (!normalized) throw new Error("chat_message_required");
  if (normalized.length > CHAT_MESSAGE_MAX_LENGTH) {
    throw new Error("chat_message_too_long");
  }
  return normalized;
}

/** ADR-0050: message content remains for twelve calendar months. */
export function chatMessageExpiresAt(createdAt: Date): Date {
  const expiresAt = new Date(createdAt);
  expiresAt.setUTCFullYear(expiresAt.getUTCFullYear() + 1);
  return expiresAt;
}

/** Either direction blocks contact in both directions. */
export function directMessageBlocked(params: {
  firstUserId: string;
  secondUserId: string;
  blocks: ReadonlyArray<{ blockerId: string; blockedId: string }>;
}): boolean {
  return params.blocks.some(
    (block) =>
      (block.blockerId === params.firstUserId &&
        block.blockedId === params.secondUserId) ||
      (block.blockerId === params.secondUserId &&
        block.blockedId === params.firstUserId)
  );
}
