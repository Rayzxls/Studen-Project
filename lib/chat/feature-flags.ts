const ENABLED_VALUE = "1";

export type ChatFeatureFlagEnv = Readonly<Record<string, string | undefined>>;

/**
 * Persistent Chat is independent from the ephemeral LiveKit room chat.
 * Reads and writes fail closed so an additive migration may reach an
 * environment before any surface queries the new tables.
 */
export function chatEnabled(env: ChatFeatureFlagEnv = process.env): boolean {
  return env.CHAT_ENABLED === ENABLED_VALUE;
}

export function chatMutationsEnabled(
  env: ChatFeatureFlagEnv = process.env
): boolean {
  return chatEnabled(env) && env.CHAT_MUTATIONS_ENABLED === ENABLED_VALUE;
}
