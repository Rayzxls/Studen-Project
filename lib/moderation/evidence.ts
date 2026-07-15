/**
 * Return the immutable file references captured when a moderation case was
 * opened. Both post snapshots (`fileAttachmentIds`) and direct file/profile
 * reports (`fileAttachmentId`) are supported. Order is stable and duplicate
 * ids are removed so the UI and authorization route share one policy.
 */
export function moderationEvidenceFileIds(snapshot: unknown): string[] {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    return [];
  }

  const record = snapshot as Record<string, unknown>;
  const ids = Array.isArray(record.fileAttachmentIds)
    ? record.fileAttachmentIds.filter(
        (value): value is string =>
          typeof value === "string" && value.length > 0
      )
    : [];
  const directId = record.fileAttachmentId;
  if (typeof directId === "string" && directId.length > 0) ids.push(directId);

  return [...new Set(ids)];
}

export function isModerationEvidenceFile(
  snapshot: unknown,
  fileId: string
): boolean {
  return moderationEvidenceFileIds(snapshot).includes(fileId);
}
