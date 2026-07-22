export type FileDisposition = "inline" | "attachment";

export function resolveFileDisposition(
  mimeType: string,
  forceDownload: boolean
): FileDisposition {
  if (forceDownload) return "attachment";
  return isInlinePreviewMime(mimeType) ? "inline" : "attachment";
}

export function fileDeliveryUrl(
  fileId: string,
  fileBasePath = "/api/storage/files",
  mode: "preview" | "download" = "preview"
): string {
  const href = `${fileBasePath}/${encodeURIComponent(fileId)}`;
  return mode === "download" ? `${href}?download=1` : href;
}

function isInlinePreviewMime(mimeType: string): boolean {
  return mimeType === "application/pdf" || mimeType.startsWith("image/");
}
