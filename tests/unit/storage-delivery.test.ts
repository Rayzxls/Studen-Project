import { describe, expect, it } from "vitest";
import {
  fileDeliveryUrl,
  resolveFileDisposition,
} from "@/lib/storage/delivery";

describe("resolveFileDisposition", () => {
  it.each(["image/png", "image/jpeg", "application/pdf"])(
    "previews %s inline",
    (mimeType) => {
      expect(resolveFileDisposition(mimeType, false)).toBe("inline");
    }
  );

  it("downloads previewable files as attachments when requested", () => {
    expect(resolveFileDisposition("image/png", true)).toBe("attachment");
    expect(resolveFileDisposition("application/pdf", true)).toBe("attachment");
  });

  it("delivers non-previewable files as attachments", () => {
    expect(
      resolveFileDisposition(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        false
      )
    ).toBe("attachment");
  });
});

describe("fileDeliveryUrl", () => {
  it("keeps preview URLs free of download flags", () => {
    expect(fileDeliveryUrl("file-1")).toBe("/api/storage/files/file-1");
  });

  it("adds an explicit download flag", () => {
    expect(fileDeliveryUrl("file-1", undefined, "download")).toBe(
      "/api/storage/files/file-1?download=1"
    );
  });

  it("supports scoped moderation evidence routes", () => {
    expect(
      fileDeliveryUrl(
        "file-1",
        "/api/admin/moderation/cases/case-1/files",
        "download"
      )
    ).toBe("/api/admin/moderation/cases/case-1/files/file-1?download=1");
  });
});
