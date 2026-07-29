export type ProfileUploadStage = "presign" | "upload" | "commit" | "save";

export function formatProfileUploadError(
  error: unknown,
  stage: ProfileUploadStage
): string {
  if (
    error instanceof TypeError &&
    error.message.toLowerCase().includes("failed to fetch")
  ) {
    return stage === "upload"
      ? "เชื่อมต่อพื้นที่จัดเก็บรูปไม่ได้ กรุณาลองใหม่หรือติดต่อผู้ดูแลระบบ"
      : "เชื่อมต่อระบบไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่";
  }

  const code = error instanceof Error ? error.message : "upload_failed";
  return `อัปโหลดไม่สำเร็จ (${code}) — ลองใหม่อีกครั้ง`;
}
