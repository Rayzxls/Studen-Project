/**
 * Zod schema coverage for `lib/assignment/validation.ts`.
 *
 * Each `refine` and field cap is exercised. The cross-field refine for
 * `isScored=true → weight+fullScore required` is the most consequential
 * gate (ADR-0019 § 2 — no system-chosen default).
 */

import { describe, expect, it } from "vitest";
import {
  CreateAssignmentSchema,
  CreateCommentSchema,
  EditCommentSchema,
  ModerateCommentSchema,
  PresignUploadSchema,
  ReturnSubmissionSchema,
  SubmitVersionSchema,
  UpdateAssignmentSchema,
} from "@/lib/assignment/validation";
import {
  DESCRIPTION_MAX,
  FILE_MAX_BYTES,
  LINK_URL_MAX,
  MAX_LINKS_PER_VERSION,
  REASON_MIN,
  TITLE_MAX,
} from "@/lib/assignment/constants";

const baseAssignment = {
  courseOfferingId: "course-1",
  title: "Quiz 1",
  description: "",
  allowText: true,
  allowFile: false,
  allowLink: false,
  isScored: false,
};

// ─────────────────────────────────────────────────────────────
// CreateAssignmentSchema
// ─────────────────────────────────────────────────────────────

describe("CreateAssignmentSchema", () => {
  it("accepts a minimal ungraded Assignment", () => {
    expect(CreateAssignmentSchema.parse(baseAssignment).title).toBe("Quiz 1");
  });

  it("requires at least one allow* channel", () => {
    const r = CreateAssignmentSchema.safeParse({
      ...baseAssignment,
      allowText: false,
      allowFile: false,
      allowLink: false,
    });
    expect(r.success).toBe(false);
  });

  it("rejects empty title", () => {
    const r = CreateAssignmentSchema.safeParse({
      ...baseAssignment,
      title: "   ",
    });
    expect(r.success).toBe(false);
  });

  it("rejects title over cap", () => {
    const r = CreateAssignmentSchema.safeParse({
      ...baseAssignment,
      title: "x".repeat(TITLE_MAX + 1),
    });
    expect(r.success).toBe(false);
  });

  it("rejects description over cap", () => {
    const r = CreateAssignmentSchema.safeParse({
      ...baseAssignment,
      description: "x".repeat(DESCRIPTION_MAX + 1),
    });
    expect(r.success).toBe(false);
  });

  it("requires weight when isScored=true (ADR-0019 § 2)", () => {
    const r = CreateAssignmentSchema.safeParse({
      ...baseAssignment,
      isScored: true,
      fullScore: 10,
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path.includes("weight"))).toBe(true);
    }
  });

  it("requires fullScore when isScored=true (ADR-0019 § 2)", () => {
    const r = CreateAssignmentSchema.safeParse({
      ...baseAssignment,
      isScored: true,
      weight: 3000,
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path.includes("fullScore"))).toBe(
        true
      );
    }
  });

  it("accepts isScored=true with both weight and fullScore", () => {
    const r = CreateAssignmentSchema.safeParse({
      ...baseAssignment,
      isScored: true,
      weight: 3000,
      fullScore: 10,
    });
    expect(r.success).toBe(true);
  });

  it("rejects weight = 0 (ADR-0019 § 2 — no zero-default footgun)", () => {
    const r = CreateAssignmentSchema.safeParse({
      ...baseAssignment,
      isScored: true,
      weight: 0,
      fullScore: 10,
    });
    expect(r.success).toBe(false);
  });

  it("rejects weight > 10000 (basis-point cap)", () => {
    const r = CreateAssignmentSchema.safeParse({
      ...baseAssignment,
      isScored: true,
      weight: 10_001,
      fullScore: 10,
    });
    expect(r.success).toBe(false);
  });

  it("rejects non-integer weight", () => {
    const r = CreateAssignmentSchema.safeParse({
      ...baseAssignment,
      isScored: true,
      weight: 33.5,
      fullScore: 10,
    });
    expect(r.success).toBe(false);
  });

  it("does not require weight/fullScore when isScored=false (ungraded Assignment)", () => {
    const r = CreateAssignmentSchema.safeParse({
      ...baseAssignment,
      isScored: false,
    });
    expect(r.success).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────
// UpdateAssignmentSchema
// ─────────────────────────────────────────────────────────────

describe("UpdateAssignmentSchema", () => {
  it("accepts empty patch (no-op)", () => {
    expect(UpdateAssignmentSchema.parse({})).toEqual({});
  });

  it("accepts a single-field patch (title only)", () => {
    expect(UpdateAssignmentSchema.parse({ title: "ใหม่" }).title).toBe("ใหม่");
  });

  it("rejects oversize title in patch", () => {
    const r = UpdateAssignmentSchema.safeParse({
      title: "x".repeat(TITLE_MAX + 1),
    });
    expect(r.success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// SubmitVersionSchema
// ─────────────────────────────────────────────────────────────

describe("SubmitVersionSchema", () => {
  const base = {
    submissionId: "sub-1",
    fileAttachmentIds: [],
    links: [],
  };

  it("rejects an empty submit (no text, files, or links)", () => {
    const r = SubmitVersionSchema.safeParse(base);
    expect(r.success).toBe(false);
  });

  it("rejects whitespace-only textContent without files/links", () => {
    const r = SubmitVersionSchema.safeParse({
      ...base,
      textContent: "    ",
    });
    expect(r.success).toBe(false);
  });

  it("accepts text-only submit", () => {
    const r = SubmitVersionSchema.safeParse({
      ...base,
      textContent: "ส่งงานครับ",
    });
    expect(r.success).toBe(true);
  });

  it("accepts file-only submit", () => {
    const r = SubmitVersionSchema.safeParse({
      ...base,
      fileAttachmentIds: ["file-1"],
    });
    expect(r.success).toBe(true);
  });

  it("accepts link-only submit", () => {
    const r = SubmitVersionSchema.safeParse({
      ...base,
      links: ["https://docs.google.com/document/d/abc/edit"],
    });
    expect(r.success).toBe(true);
  });

  it("rejects non-http(s) links", () => {
    const r = SubmitVersionSchema.safeParse({
      ...base,
      links: ["javascript:alert(1)"],
    });
    expect(r.success).toBe(false);
  });

  it("rejects too many links", () => {
    const r = SubmitVersionSchema.safeParse({
      ...base,
      links: Array.from(
        { length: MAX_LINKS_PER_VERSION + 1 },
        (_, i) => `https://example.com/${i}`
      ),
    });
    expect(r.success).toBe(false);
  });

  it("rejects an oversize link URL", () => {
    const r = SubmitVersionSchema.safeParse({
      ...base,
      links: ["https://example.com/" + "x".repeat(LINK_URL_MAX)],
    });
    expect(r.success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// Comment schemas
// ─────────────────────────────────────────────────────────────

describe("CreateCommentSchema", () => {
  it("accepts a class-wide comment on Assignment", () => {
    const r = CreateCommentSchema.safeParse({
      ownerType: "ASSIGNMENT",
      ownerId: "asg-1",
      scope: "CLASS_WIDE",
      body: "ลองโจทย์ข้อ 3 ดูครับ",
    });
    expect(r.success).toBe(true);
  });

  it("rejects empty body", () => {
    const r = CreateCommentSchema.safeParse({
      ownerType: "SUBMISSION",
      ownerId: "sub-1",
      scope: "PRIVATE",
      body: "   ",
    });
    expect(r.success).toBe(false);
  });

  it("rejects invalid scope", () => {
    const r = CreateCommentSchema.safeParse({
      ownerType: "ASSIGNMENT",
      ownerId: "asg-1",
      scope: "PUBLIC",
      body: "x",
    });
    expect(r.success).toBe(false);
  });
});

describe("EditCommentSchema", () => {
  it("accepts a non-empty edit body", () => {
    expect(
      EditCommentSchema.safeParse({ commentId: "c-1", body: "แก้แล้ว" }).success
    ).toBe(true);
  });
});

describe("ModerateCommentSchema", () => {
  it(`requires reason ≥ ${REASON_MIN} chars`, () => {
    const r = ModerateCommentSchema.safeParse({
      commentId: "c-1",
      reason: "ค",
    });
    expect(r.success).toBe(false);
  });

  it("accepts reason at exactly REASON_MIN chars", () => {
    const r = ModerateCommentSchema.safeParse({
      commentId: "c-1",
      reason: "x".repeat(REASON_MIN),
    });
    expect(r.success).toBe(true);
  });
});

describe("ReturnSubmissionSchema", () => {
  it(`requires comment ≥ ${REASON_MIN} chars (doubles as audit reason per ADR-0020 § 4)`, () => {
    const r = ReturnSubmissionSchema.safeParse({
      submissionId: "sub-1",
      comment: "ดี",
    });
    expect(r.success).toBe(false);
  });

  it("accepts a sufficient RETURN comment", () => {
    const r = ReturnSubmissionSchema.safeParse({
      submissionId: "sub-1",
      comment: "เพิ่มเหตุผลในข้อ 2 หน่อยครับ",
    });
    expect(r.success).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────
// PresignUploadSchema
// ─────────────────────────────────────────────────────────────

describe("PresignUploadSchema", () => {
  const base = {
    ownerType: "SUBMISSION" as const,
    ownerId: "ver-1",
    declaredMime: "application/pdf",
    declaredSize: 1024,
    originalFilename: "homework.pdf",
  };

  it("accepts a PDF under cap", () => {
    expect(PresignUploadSchema.safeParse(base).success).toBe(true);
  });

  it("rejects SVG (ADR-0021 § 3 — blocked)", () => {
    const r = PresignUploadSchema.safeParse({
      ...base,
      declaredMime: "image/svg+xml",
      originalFilename: "drawing.svg",
    });
    expect(r.success).toBe(false);
  });

  it("rejects ZIP (ADR-0021 § 4 — archive smuggling vector)", () => {
    const r = PresignUploadSchema.safeParse({
      ...base,
      declaredMime: "application/zip",
      originalFilename: "submission.zip",
    });
    expect(r.success).toBe(false);
  });

  it("rejects size exceeding 20 MB cap", () => {
    const r = PresignUploadSchema.safeParse({
      ...base,
      declaredSize: FILE_MAX_BYTES + 1,
    });
    expect(r.success).toBe(false);
  });

  it("rejects empty original filename", () => {
    const r = PresignUploadSchema.safeParse({
      ...base,
      originalFilename: "   ",
    });
    expect(r.success).toBe(false);
  });

  it("accepts HEIC (iOS native) — will be transcoded server-side per ADR-0021 § 5", () => {
    const r = PresignUploadSchema.safeParse({
      ...base,
      declaredMime: "image/heic",
      originalFilename: "IMG_0001.HEIC",
    });
    expect(r.success).toBe(true);
  });
});
