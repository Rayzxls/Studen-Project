import { describe, expect, it } from "vitest";
import {
  isModerationEvidenceFile,
  moderationEvidenceFileIds,
} from "@/lib/moderation/evidence";

describe("moderationEvidenceFileIds", () => {
  it("keeps the captured attachment order and removes duplicates", () => {
    expect(
      moderationEvidenceFileIds({
        fileAttachmentIds: ["file-b", "file-a", "file-b"],
        fileAttachmentId: "file-c",
      })
    ).toEqual(["file-b", "file-a", "file-c"]);
  });

  it("supports a direct file report snapshot", () => {
    expect(
      moderationEvidenceFileIds({ fileAttachmentId: "profile-image-1" })
    ).toEqual(["profile-image-1"]);
  });

  it("rejects malformed snapshot values", () => {
    expect(
      moderationEvidenceFileIds({
        fileAttachmentIds: [null, 123, "", "valid-file"],
        fileAttachmentId: false,
      })
    ).toEqual(["valid-file"]);
    expect(moderationEvidenceFileIds(null)).toEqual([]);
    expect(moderationEvidenceFileIds([])).toEqual([]);
  });

  it("authorizes only files captured by that case snapshot", () => {
    const snapshot = { fileAttachmentIds: ["evidence-file"] };

    expect(isModerationEvidenceFile(snapshot, "evidence-file")).toBe(true);
    expect(isModerationEvidenceFile(snapshot, "file-from-another-case")).toBe(
      false
    );
  });
});
