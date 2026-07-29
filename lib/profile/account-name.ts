/**
 * Resolves the private account label used in personal UI.
 *
 * Real name is authoritative. The identifier is only a compatibility fallback
 * for incomplete legacy rows and is never used to infer identity or Role.
 */
export function resolveAccountName(args: {
  realName: string | null | undefined;
  identifier: string;
}): string {
  const realName = args.realName?.trim();
  return realName || args.identifier;
}
