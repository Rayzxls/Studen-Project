/**
 * Pure unit tests — lib/feed/preview
 *
 * Locks per-kind preview shape, dueAt rendering on ASSIGNMENT,
 * Announcement title null fallback, and the course-name meta line.
 */

import { describe, expect, it } from "vitest";
import { buildFeedRowPreview } from "@/lib/feed/preview";
import type { FeedItem } from "@/lib/feed/aggregator";

const COURSE = "ฟิสิกส์ ม.4";

function item(overrides: Partial<FeedItem>): FeedItem {
  return {
    kind: "ASSIGNMENT",
    id: "x",
    courseOfferingId: "c1",
    sortAt: new Date("2026-06-04T10:00:00Z"),
    title: null,
    detail: null,
    ...overrides,
  };
}

describe("buildFeedRowPreview — happy paths", () => {
  it("ASSIGNMENT with dueAt renders the deadline tail", () => {
    const p = buildFeedRowPreview({
      item: item({
        kind: "ASSIGNMENT",
        title: "HW 5",
        detail: "2026-06-10T17:00:00Z",
      }),
      courseName: COURSE,
    });
    expect(p.iconKey).toBe("ClipboardList");
    expect(p.bold).toContain("HW 5");
    expect(p.meta).toContain(COURSE);
    expect(p.meta).toContain("ส่งภายใน");
  });

  it("ASSIGNMENT with null dueAt omits the deadline tail", () => {
    const p = buildFeedRowPreview({
      item: item({ kind: "ASSIGNMENT", title: "HW 5", detail: null }),
      courseName: COURSE,
    });
    expect(p.meta).toBe(COURSE);
  });

  it("MATERIAL", () => {
    const p = buildFeedRowPreview({
      item: item({ kind: "MATERIAL", title: "บทที่ 3" }),
      courseName: COURSE,
    });
    expect(p.iconKey).toBe("BookOpen");
    expect(p.bold).toContain("บทที่ 3");
  });

  it("ANNOUNCEMENT with title", () => {
    const p = buildFeedRowPreview({
      item: item({ kind: "ANNOUNCEMENT", title: "ปิดเรียนวันศุกร์" }),
      courseName: COURSE,
    });
    expect(p.iconKey).toBe("Megaphone");
    expect(p.bold).toContain("ปิดเรียนวันศุกร์");
  });

  it("ANNOUNCEMENT with null title falls back to 'ประกาศ'", () => {
    const p = buildFeedRowPreview({
      item: item({ kind: "ANNOUNCEMENT", title: null }),
      courseName: COURSE,
    });
    expect(p.bold).toContain("ประกาศ");
  });

  it("SCORE_PUBLISHED", () => {
    const p = buildFeedRowPreview({
      item: item({ kind: "SCORE_PUBLISHED", title: "Quiz 1" }),
      courseName: COURSE,
    });
    expect(p.iconKey).toBe("BarChart3");
    expect(p.bold).toContain("Quiz 1");
    expect(p.bold).toContain("เผยแพร่แล้ว");
  });
});

describe("buildFeedRowPreview — edge cases", () => {
  it("ASSIGNMENT with malformed dueAt skips the tail safely", () => {
    const p = buildFeedRowPreview({
      item: item({ kind: "ASSIGNMENT", title: "HW", detail: "not-a-date" }),
      courseName: COURSE,
    });
    expect(p.meta).toBe(COURSE);
  });

  it("ASSIGNMENT with null title shows an em-dash placeholder", () => {
    const p = buildFeedRowPreview({
      item: item({ kind: "ASSIGNMENT", title: null }),
      courseName: COURSE,
    });
    expect(p.bold).toContain("—");
  });
});
