/**
 * PURE — display-name fallback chain (Phase 13).
 *
 * displayName → real name → identifier. Used ONLY for friendly personal
 * UI (dashboard greeting, profile heading, account menu). Every shared
 * surface (comments, review, grades, attendance, admin, audit) renders
 * the real name and must NOT call this.
 */
export function resolveDisplayName(args: {
  displayName: string | null | undefined;
  realName: string | null | undefined;
  identifier: string;
}): string {
  const dn = args.displayName?.trim();
  if (dn) return dn;
  const rn = args.realName?.trim();
  if (rn) return rn;
  return args.identifier;
}
