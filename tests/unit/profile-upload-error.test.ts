import { describe, expect, it } from "vitest";
import {
  formatProfileUploadError,
  type ProfileUploadStage,
} from "@/lib/profile/upload-error";

describe("formatProfileUploadError", () => {
  it("explains a direct-storage network failure without exposing CORS jargon", () => {
    expect(
      formatProfileUploadError(new TypeError("Failed to fetch"), "upload")
    ).toBe(
      "เชื่อมต่อพื้นที่จัดเก็บรูปไม่ได้ กรุณาลองใหม่หรือติดต่อผู้ดูแลระบบ"
    );
  });

  it.each<ProfileUploadStage>(["presign", "commit", "save"])(
    "explains a same-origin failure during %s",
    (stage) => {
      expect(
        formatProfileUploadError(new TypeError("Failed to fetch"), stage)
      ).toBe("เชื่อมต่อระบบไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่");
    }
  );

  it("keeps stable pipeline error codes useful to support", () => {
    expect(formatProfileUploadError(new Error("commit_failed"), "commit")).toBe(
      "อัปโหลดไม่สำเร็จ (commit_failed) — ลองใหม่อีกครั้ง"
    );
  });
});
