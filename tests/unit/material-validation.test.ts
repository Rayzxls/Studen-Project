/**
 * Pure unit tests — lib/material/validation + lib/announcement/validation
 *
 * Locks Q12.1–Q12.4 schema constraints (title length, body length,
 * link URL validation, link count cap).
 */

import { describe, expect, it } from "vitest";
import {
  CreateMaterialSchema,
  UpdateMaterialSchema,
} from "@/lib/material/validation";
import {
  CreateAnnouncementSchema,
  UpdateAnnouncementSchema,
} from "@/lib/announcement/validation";

const validBase = {
  courseOfferingId: "co-1",
  title: "Worksheet 3",
  body: "Read pages 45-50.",
  fileAttachmentIds: [],
  linkUrls: [],
};

describe("CreateMaterialSchema", () => {
  it("accepts a minimal valid payload", () => {
    const r = CreateMaterialSchema.safeParse(validBase);
    expect(r.success).toBe(true);
  });

  it("requires title (Q12.3 — Material title required)", () => {
    const r = CreateMaterialSchema.safeParse({ ...validBase, title: "" });
    expect(r.success).toBe(false);
  });

  it("rejects title over 200 chars", () => {
    const r = CreateMaterialSchema.safeParse({
      ...validBase,
      title: "a".repeat(201),
    });
    expect(r.success).toBe(false);
  });

  it("accepts empty body (Q12.5 — attachment/link optional, body required at presence not min length)", () => {
    const r = CreateMaterialSchema.safeParse({ ...validBase, body: "" });
    expect(r.success).toBe(true);
  });

  it("rejects body over 5000 chars", () => {
    const r = CreateMaterialSchema.safeParse({
      ...validBase,
      body: "x".repeat(5001),
    });
    expect(r.success).toBe(false);
  });

  it("accepts up to 5 link URLs (Q12.4 cap)", () => {
    const r = CreateMaterialSchema.safeParse({
      ...validBase,
      linkUrls: [
        "https://example.com/1",
        "https://example.com/2",
        "https://example.com/3",
        "https://example.com/4",
        "https://example.com/5",
      ],
    });
    expect(r.success).toBe(true);
  });

  it("rejects more than 5 link URLs", () => {
    const r = CreateMaterialSchema.safeParse({
      ...validBase,
      linkUrls: Array.from({ length: 6 }, (_, i) => `https://example.com/${i}`),
    });
    expect(r.success).toBe(false);
  });

  it("rejects non-http(s) link URL", () => {
    const r = CreateMaterialSchema.safeParse({
      ...validBase,
      linkUrls: ["javascript:alert(1)"],
    });
    expect(r.success).toBe(false);
  });

  it("rejects malformed URL", () => {
    const r = CreateMaterialSchema.safeParse({
      ...validBase,
      linkUrls: ["not a url"],
    });
    expect(r.success).toBe(false);
  });
});

describe("UpdateMaterialSchema", () => {
  it("accepts a partial patch with title only", () => {
    const r = UpdateMaterialSchema.safeParse({ title: "renamed" });
    expect(r.success).toBe(true);
  });

  it("accepts empty patch", () => {
    const r = UpdateMaterialSchema.safeParse({});
    expect(r.success).toBe(true);
  });
});

describe("CreateAnnouncementSchema (Q4.1 = b — title optional)", () => {
  const base = {
    courseOfferingId: "co-1",
    body: "Class is cancelled tomorrow.",
    fileAttachmentIds: [],
    linkUrls: [],
  };

  it("accepts payload without title", () => {
    const r = CreateAnnouncementSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.title).toBeNull();
  });

  it("accepts payload with title", () => {
    const r = CreateAnnouncementSchema.safeParse({
      ...base,
      title: "Heads-up",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.title).toBe("Heads-up");
  });

  it("normalises blank-after-trim title to null", () => {
    const r = CreateAnnouncementSchema.safeParse({ ...base, title: "   " });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.title).toBeNull();
  });

  it("requires non-empty body (Announcement carries information even without title)", () => {
    const r = CreateAnnouncementSchema.safeParse({ ...base, body: "" });
    expect(r.success).toBe(false);
  });

  it("rejects body over 5000 chars", () => {
    const r = CreateAnnouncementSchema.safeParse({
      ...base,
      body: "x".repeat(5001),
    });
    expect(r.success).toBe(false);
  });
});

describe("UpdateAnnouncementSchema", () => {
  it("accepts setting title to null (clear it)", () => {
    const r = UpdateAnnouncementSchema.safeParse({ title: null });
    expect(r.success).toBe(true);
  });

  it("accepts updating body", () => {
    const r = UpdateAnnouncementSchema.safeParse({ body: "new content" });
    expect(r.success).toBe(true);
  });

  it("rejects body=empty in update (Announcement must carry content)", () => {
    const r = UpdateAnnouncementSchema.safeParse({ body: "" });
    expect(r.success).toBe(false);
  });
});
