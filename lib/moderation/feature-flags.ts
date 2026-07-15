const ENABLED_VALUE = "1";

export function moderationCenterEnabled(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return env.MODERATION_CENTER_ENABLED === ENABLED_VALUE;
}
