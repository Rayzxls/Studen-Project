/**
 * PURE R2 key generators + parsers + filename sanitisation —
 * `lib/storage/keys.ts` coverage.
 *
 * Every branch of the staging / permanent shape + RFC 5987 Content-
 * Disposition + sanitisation edge cases is exercised here. These tests
 * are the trust foundation under CLAUDE.md § Critical Files
 * (`lib/storage/signed-url.ts` — "leak = นักเรียนเห็นไฟล์คนอื่นได้").
 */

import { describe, expect, it } from "vitest";
import {
  ALLOWED_VERIFIED_EXTS,
  buildContentDisposition,
  isFileOwnerType,
  isVerifiedExt,
  parseR2Key,
  permanentKey,
  sanitiseDisplayFilename,
  stagingKey,
} from "@/lib/storage/keys";

// ─────────────────────────────────────────────────────────────
// stagingKey
// ─────────────────────────────────────────────────────────────

describe("stagingKey", () => {
  it("builds staging/<uploaderId>/<uuid> with an explicit UUID", () => {
    expect(
      stagingKey({
        uploaderId: "user-abc",
        uuid: "11111111-2222-3333-4444-555555555555",
      })
    ).toBe("staging/user-abc/11111111-2222-3333-4444-555555555555");
  });

  it("auto-generates a UUID when not provided", () => {
    const k = stagingKey({ uploaderId: "user-abc" });
    expect(k.startsWith("staging/user-abc/")).toBe(true);
    expect(k.split("/")).toHaveLength(3);
  });

  it("rejects path-traversal-style uploader IDs", () => {
    expect(() => stagingKey({ uploaderId: "../etc/passwd" })).toThrow();
  });

  it("rejects an empty uploader id", () => {
    expect(() => stagingKey({ uploaderId: "" })).toThrow();
  });

  it("rejects a uuid with slashes", () => {
    expect(() => stagingKey({ uploaderId: "user", uuid: "a/b" })).toThrow();
  });
});

// ─────────────────────────────────────────────────────────────
// permanentKey
// ─────────────────────────────────────────────────────────────

describe("permanentKey", () => {
  it("builds permanent/<ownerType>/<ownerId>/<uuid>.<ext>", () => {
    expect(
      permanentKey({
        ownerType: "SUBMISSION",
        ownerId: "ver-1",
        uuid: "abc-123",
        verifiedExt: "pdf",
      })
    ).toBe("permanent/SUBMISSION/ver-1/abc-123.pdf");
  });

  it("rejects an unknown owner type", () => {
    expect(() =>
      permanentKey({
        ownerType: "INVOICE",
        ownerId: "i-1",
        uuid: "u",
        verifiedExt: "pdf",
      })
    ).toThrow();
  });

  it("rejects an extension outside the verified allow-list", () => {
    expect(() =>
      permanentKey({
        ownerType: "SUBMISSION",
        ownerId: "ver-1",
        uuid: "u",
        verifiedExt: "svg", // blocked per ADR-0021 § 3
      })
    ).toThrow();
    expect(() =>
      permanentKey({
        ownerType: "SUBMISSION",
        ownerId: "ver-1",
        uuid: "u",
        verifiedExt: "exe",
      })
    ).toThrow();
  });

  it("rejects a path-traversal-style ownerId", () => {
    expect(() =>
      permanentKey({
        ownerType: "SUBMISSION",
        ownerId: "../other-student",
        uuid: "u",
        verifiedExt: "pdf",
      })
    ).toThrow();
  });
});

// ─────────────────────────────────────────────────────────────
// isVerifiedExt / isFileOwnerType
// ─────────────────────────────────────────────────────────────

describe("isVerifiedExt", () => {
  it.each(ALLOWED_VERIFIED_EXTS)("accepts %s", (ext) => {
    expect(isVerifiedExt(ext)).toBe(true);
  });

  it("rejects SVG (XSS vector blocked per ADR-0021 § 3)", () => {
    expect(isVerifiedExt("svg")).toBe(false);
  });

  it("rejects ZIP / RAR / 7Z (archive smuggling per ADR-0021 § 4 Rejected)", () => {
    expect(isVerifiedExt("zip")).toBe(false);
    expect(isVerifiedExt("rar")).toBe(false);
    expect(isVerifiedExt("7z")).toBe(false);
  });

  it("rejects executables", () => {
    expect(isVerifiedExt("exe")).toBe(false);
    expect(isVerifiedExt("bat")).toBe(false);
    expect(isVerifiedExt("sh")).toBe(false);
  });

  it("rejects legacy office formats (.doc/.xls/.ppt)", () => {
    expect(isVerifiedExt("doc")).toBe(false);
    expect(isVerifiedExt("xls")).toBe(false);
    expect(isVerifiedExt("ppt")).toBe(false);
  });
});

describe("isFileOwnerType", () => {
  it("accepts every Prisma enum literal", () => {
    expect(isFileOwnerType("ASSIGNMENT")).toBe(true);
    expect(isFileOwnerType("MATERIAL")).toBe(true);
    expect(isFileOwnerType("ANNOUNCEMENT")).toBe(true);
    expect(isFileOwnerType("SUBMISSION")).toBe(true);
    expect(isFileOwnerType("COMMENT")).toBe(true);
    expect(isFileOwnerType("PROFILE_IMAGE")).toBe(true);
    expect(isFileOwnerType("QUIZ")).toBe(true);
    expect(isFileOwnerType("QUIZ_QUESTION")).toBe(true);
    expect(isFileOwnerType("QUIZ_OPTION")).toBe(true);
  });

  it("rejects random strings", () => {
    expect(isFileOwnerType("submission")).toBe(false);
    expect(isFileOwnerType("ROW")).toBe(false);
    expect(isFileOwnerType("")).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// parseR2Key
// ─────────────────────────────────────────────────────────────

describe("parseR2Key", () => {
  it("parses a staging key", () => {
    expect(parseR2Key("staging/user-1/abc-123")).toEqual({
      kind: "staging",
      uploaderId: "user-1",
      uuid: "abc-123",
    });
  });

  it("parses a permanent key", () => {
    expect(parseR2Key("permanent/SUBMISSION/ver-1/file-uuid.pdf")).toEqual({
      kind: "permanent",
      ownerType: "SUBMISSION",
      ownerId: "ver-1",
      uuid: "file-uuid",
      verifiedExt: "pdf",
    });
  });

  it("returns null for an unknown prefix", () => {
    expect(parseR2Key("backup/foo")).toBeNull();
    expect(parseR2Key("file.pdf")).toBeNull();
  });

  it("returns null when path arity is wrong", () => {
    expect(parseR2Key("staging/just-one")).toBeNull();
    expect(parseR2Key("permanent/A/B")).toBeNull();
    expect(parseR2Key("permanent/A/B/C/D.pdf")).toBeNull();
  });

  it("returns null for a permanent key with no extension", () => {
    expect(parseR2Key("permanent/SUBMISSION/v-1/uuid")).toBeNull();
  });

  it("returns null for a permanent key with a blocked extension", () => {
    expect(parseR2Key("permanent/SUBMISSION/v-1/uuid.svg")).toBeNull();
    expect(parseR2Key("permanent/SUBMISSION/v-1/uuid.exe")).toBeNull();
  });

  it("returns null when ownerType is not a Prisma enum literal", () => {
    expect(parseR2Key("permanent/INVOICE/inv-1/uuid.pdf")).toBeNull();
  });

  it("round-trips staging keys", () => {
    const k = stagingKey({ uploaderId: "user-x", uuid: "uid-1" });
    const parsed = parseR2Key(k);
    expect(parsed).toEqual({
      kind: "staging",
      uploaderId: "user-x",
      uuid: "uid-1",
    });
  });

  it("round-trips permanent keys", () => {
    const k = permanentKey({
      ownerType: "ASSIGNMENT",
      ownerId: "asg-1",
      uuid: "uid-2",
      verifiedExt: "jpg",
    });
    const parsed = parseR2Key(k);
    expect(parsed).toEqual({
      kind: "permanent",
      ownerType: "ASSIGNMENT",
      ownerId: "asg-1",
      uuid: "uid-2",
      verifiedExt: "jpg",
    });
  });
});

// ─────────────────────────────────────────────────────────────
// sanitiseDisplayFilename
// ─────────────────────────────────────────────────────────────

describe("sanitiseDisplayFilename", () => {
  it("preserves a plain Thai filename", () => {
    expect(sanitiseDisplayFilename("การบ้านคณิต.pdf")).toBe("การบ้านคณิต.pdf");
  });

  it("strips path separators", () => {
    expect(sanitiseDisplayFilename("../../../etc/passwd")).toBe("etcpasswd");
    expect(sanitiseDisplayFilename("a\\b\\c.docx")).toBe("abc.docx");
  });

  it("strips control characters", () => {
    expect(sanitiseDisplayFilename("hello\x00world\x07.pdf")).toBe(
      "helloworld.pdf"
    );
    expect(sanitiseDisplayFilename("line1\r\nline2.pdf")).toBe(
      "line1line2.pdf"
    );
  });

  it("collapses whitespace runs", () => {
    expect(sanitiseDisplayFilename("a    b\tc.pdf")).toBe("a b c.pdf");
  });

  it("replaces empty / pathological names", () => {
    expect(sanitiseDisplayFilename("")).toBe("untitled");
    expect(sanitiseDisplayFilename(".")).toBe("untitled");
    expect(sanitiseDisplayFilename("..")).toBe("untitled");
  });

  it("caps at 255 chars", () => {
    const long = "x".repeat(300);
    const result = sanitiseDisplayFilename(long);
    expect(result.length).toBe(255);
  });
});

// ─────────────────────────────────────────────────────────────
// buildContentDisposition
// ─────────────────────────────────────────────────────────────

describe("buildContentDisposition", () => {
  it("emits inline + UTF-8 filename* for Thai names", () => {
    const v = buildContentDisposition({
      filename: "การบ้าน.pdf",
      disposition: "inline",
    });
    expect(v).toContain("inline;");
    expect(v).toContain("filename*=UTF-8''");
    expect(v).toContain(encodeURIComponent("การบ้าน.pdf"));
  });

  it("emits attachment for office docs", () => {
    const v = buildContentDisposition({
      filename: "report.docx",
      disposition: "attachment",
    });
    expect(v.startsWith("attachment;")).toBe(true);
    expect(v).toContain('filename="report.docx"');
  });

  it("falls back to underscores in the ASCII filename for non-ASCII chars", () => {
    const v = buildContentDisposition({
      filename: "งาน.pdf",
      disposition: "inline",
    });
    // The ASCII fallback replaces non-printable / non-ASCII with _.
    expect(v).toMatch(/filename="_+\.pdf"/);
  });

  it("sanitises path separators before emitting", () => {
    const v = buildContentDisposition({
      filename: "../leak.pdf",
      disposition: "attachment",
    });
    expect(v).not.toContain("..");
    expect(v).not.toContain("/");
  });
});
