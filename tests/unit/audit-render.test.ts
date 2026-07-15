/**
 * lib/audit/{label,render}.ts — Phase 10A · ADR-0027.
 *
 * Pure helpers; no DB. Coverage targets:
 *   - actionLabel translates known events to Thai noun phrases
 *   - actionLabel falls back to enum literal for unknown events
 *   - renderRow composes [subject] [verb] [target] [reason?] [timestamp]
 *   - renderRow falls back to "—" when targetLabel is null/empty
 *   - renderRow omits the reason clause when reason is null/empty
 *   - renderRow uses role fallback when actorName is null
 *   - Timestamp uses Buddhist calendar (year 2569 in 2026 input)
 */

import { describe, it, expect } from "vitest";
import { actionLabel } from "@/lib/audit/label";
import { renderRow } from "@/lib/audit/render";

describe("actionLabel", () => {
  it("translates SCORE_EDIT_AFTER_PUBLISH to Thai noun phrase", () => {
    expect(actionLabel("SCORE_EDIT_AFTER_PUBLISH")).toBe("แก้คะแนนหลังเผยแพร่");
  });

  it("translates COURSE_MEMBER_REMOVED to Thai noun phrase", () => {
    expect(actionLabel("COURSE_MEMBER_REMOVED")).toBe("นำนักเรียนออกจากห้อง");
  });

  it("translates Phase 10 ACADEMIC_YEAR_CREATED", () => {
    expect(actionLabel("ACADEMIC_YEAR_CREATED")).toBe("เพิ่มปีการศึกษา");
  });

  it("translates Phase 10 PASSWORD_RESET_BY_ADMIN", () => {
    expect(actionLabel("PASSWORD_RESET_BY_ADMIN")).toBe("Admin รีเซ็ตรหัสผ่าน");
  });

  it("translates Lesson Workspace events", () => {
    expect(actionLabel("LESSON_ARCHIVED")).toBe("เก็บบทเรียนเข้าคลัง");
    expect(actionLabel("LESSON_DELETED")).toBe("ลบบทเรียนว่าง");
    expect(actionLabel("LESSON_CONTENT_MOVED")).toBe(
      "ย้ายเนื้อหาระหว่างบทเรียน"
    );
  });

  it("falls back to raw enum literal for unknown action (defensive)", () => {
    // Cast through unknown to feign a label-table miss.
    const unknown = "BRAND_NEW_EVENT_NOT_LABELLED" as never;
    expect(actionLabel(unknown)).toBe("BRAND_NEW_EVENT_NOT_LABELLED");
  });
});

describe("renderRow", () => {
  const baseTimestamp = new Date("2026-06-03T07:22:00Z"); // → 14:22 Bangkok

  it("renders the full [subject] [verb] [target] [reason] [timestamp] shape", () => {
    const out = renderRow({
      timestamp: baseTimestamp,
      action: "SCORE_EDIT_AFTER_PUBLISH",
      actorName: "ครูสมชาย",
      actorRole: "TEACHER",
      targetLabel: "สอบกลางภาค (วิชาคณิตศาสตร์ ม.4)",
      reason: "คำนวณผิด",
    });
    expect(out).toContain("ครูสมชาย");
    expect(out).toContain("ได้แก้คะแนนหลังเผยแพร่");
    expect(out).toContain("'สอบกลางภาค (วิชาคณิตศาสตร์ ม.4)'");
    expect(out).toContain("เนื่องจาก 'คำนวณผิด'");
    expect(out).toContain("เวลา 14:22");
  });

  it("renders Buddhist calendar year (2569 from 2026 input)", () => {
    const out = renderRow({
      timestamp: baseTimestamp,
      action: "LOGIN_SUCCESS",
      actorName: "ครูสมชาย",
      actorRole: "TEACHER",
      targetLabel: "—",
      reason: null,
    });
    expect(out).toContain("2569");
  });

  it("falls back to role-based subject when actorName is null", () => {
    const out = renderRow({
      timestamp: baseTimestamp,
      action: "ANNOUNCEMENT_DELETED",
      actorName: null,
      actorRole: "ADMIN",
      targetLabel: "'งดสอบวันศุกร์'",
      reason: "ครูแจ้งยกเลิก",
    });
    expect(out.startsWith("Admin ")).toBe(true);
  });

  it("uses 'ระบบ' subject when both actorName and actorRole are null", () => {
    const out = renderRow({
      timestamp: baseTimestamp,
      action: "USER_LOCKED",
      actorName: null,
      actorRole: null,
      targetLabel: "ครูทดสอบ",
      reason: null,
    });
    expect(out.startsWith("ระบบ ")).toBe(true);
  });

  it("falls back to '—' target when targetLabel is null", () => {
    const out = renderRow({
      timestamp: baseTimestamp,
      action: "SCORE_ITEM_PUBLISHED",
      actorName: "ครูสมชาย",
      actorRole: "TEACHER",
      targetLabel: null,
      reason: null,
    });
    expect(out).toContain("'—'");
  });

  it("falls back to '—' target when targetLabel is empty string", () => {
    const out = renderRow({
      timestamp: baseTimestamp,
      action: "SCORE_ITEM_PUBLISHED",
      actorName: "ครูสมชาย",
      actorRole: "TEACHER",
      targetLabel: "   ",
      reason: null,
    });
    expect(out).toContain("'—'");
  });

  it("omits the reason clause entirely when reason is null", () => {
    const out = renderRow({
      timestamp: baseTimestamp,
      action: "SCORE_ITEM_PUBLISHED",
      actorName: "ครูสมชาย",
      actorRole: "TEACHER",
      targetLabel: "สอบปลายภาค",
      reason: null,
    });
    expect(out).not.toContain("เนื่องจาก");
  });

  it("omits the reason clause when reason is empty whitespace", () => {
    const out = renderRow({
      timestamp: baseTimestamp,
      action: "SCORE_ITEM_PUBLISHED",
      actorName: "ครูสมชาย",
      actorRole: "TEACHER",
      targetLabel: "สอบปลายภาค",
      reason: "   ",
    });
    expect(out).not.toContain("เนื่องจาก");
  });
});
