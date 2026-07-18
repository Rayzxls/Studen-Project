/**
 * Pure unit tests — lib/notification/preview
 *
 * Locks per-kind preview shape (iconKey + bold + meta), edge cases for
 * null titles / null dueAt / missing fields, and the generic fallback
 * path when the snapshot is malformed.
 */

import { describe, expect, it } from "vitest";
import { buildNotificationPreview } from "@/lib/notification/preview";

describe("Quiz notification previews", () => {
  it("shows the reopened quiz and new deadline", () => {
    const preview = buildNotificationPreview({
      kind: "QUIZ_REOPENED",
      payload: {
        courseId: "c1",
        courseName: "English",
        quizId: "quiz-1",
        quizTitle: "Checkpoint",
        newClosesAt: "2026-07-20T09:00:00Z",
      },
    });
    expect(preview.iconKey).toBe("RotateCcw");
    expect(preview.bold).toContain("Checkpoint");
    expect(preview.meta).toContain("English");
  });

  it("describes a private extra-attempt grant", () => {
    const preview = buildNotificationPreview({
      kind: "QUIZ_EXCEPTION_GRANTED",
      payload: {
        courseId: "c1",
        courseName: "English",
        quizId: "quiz-1",
        quizTitle: "Checkpoint",
        extendedDeadline: null,
        extraAttempts: 1,
      },
    });
    expect(preview.iconKey).toBe("Clock3");
    expect(preview.bold).toContain("Checkpoint");
    expect(preview.meta).toContain("1");
  });
});

describe("buildNotificationPreview — happy paths", () => {
  it("SCORE_ITEM_PUBLISHED", () => {
    const p = buildNotificationPreview({
      kind: "SCORE_ITEM_PUBLISHED",
      payload: {
        courseId: "c1",
        courseName: "คณิตศาสตร์ ม.4",
        itemName: "Quiz 1",
        publishedAt: "2026-06-04T10:00:00Z",
      },
    });
    expect(p.iconKey).toBe("BarChart3");
    expect(p.bold).toContain("Quiz 1");
    expect(p.bold).toContain("เผยแพร่แล้ว");
    expect(p.meta).toBe("คณิตศาสตร์ ม.4");
  });

  it("SCORE_ENTRY_EDITED", () => {
    const p = buildNotificationPreview({
      kind: "SCORE_ENTRY_EDITED",
      payload: { courseName: "คณิตศาสตร์ ม.4", itemName: "Midterm" },
    });
    expect(p.iconKey).toBe("Pencil");
    expect(p.bold).toContain("Midterm");
    expect(p.bold).toContain("ถูกแก้ไข");
  });

  it("ASSIGNMENT_POSTED with dueAt renders the deadline tail", () => {
    const p = buildNotificationPreview({
      kind: "ASSIGNMENT_POSTED",
      payload: {
        courseName: "ฟิสิกส์",
        assignmentTitle: "HW 5",
        dueAt: "2026-06-10T17:00:00Z",
      },
    });
    expect(p.iconKey).toBe("ClipboardList");
    expect(p.bold).toContain("HW 5");
    expect(p.meta).toContain("ฟิสิกส์");
    expect(p.meta).toContain("ส่งภายใน");
  });

  it("ASSIGNMENT_POSTED with null dueAt omits the tail", () => {
    const p = buildNotificationPreview({
      kind: "ASSIGNMENT_POSTED",
      payload: {
        courseName: "ฟิสิกส์",
        assignmentTitle: "HW 5",
        dueAt: null,
      },
    });
    expect(p.meta).toBe("ฟิสิกส์");
    expect(p.meta).not.toContain("ส่งภายใน");
  });

  it("MATERIAL_POSTED includes the poster name", () => {
    const p = buildNotificationPreview({
      kind: "MATERIAL_POSTED",
      payload: {
        courseName: "เคมี",
        title: "บทที่ 3 สรุป",
        postedByName: "ครูสมชาย",
      },
    });
    expect(p.iconKey).toBe("BookOpen");
    expect(p.bold).toContain("ครูสมชาย");
    expect(p.bold).toContain("บทที่ 3 สรุป");
  });

  it("ANNOUNCEMENT_POSTED prefers title over bodyExcerpt", () => {
    const p = buildNotificationPreview({
      kind: "ANNOUNCEMENT_POSTED",
      payload: {
        courseName: "เคมี",
        title: "ปิดเรียนวันศุกร์",
        bodyExcerpt: "เนื่องจาก…",
        postedByName: "ครูสมชาย",
      },
    });
    expect(p.iconKey).toBe("Megaphone");
    expect(p.bold).toContain("ปิดเรียนวันศุกร์");
  });

  it("ANNOUNCEMENT_POSTED falls back to bodyExcerpt when title is null", () => {
    const p = buildNotificationPreview({
      kind: "ANNOUNCEMENT_POSTED",
      payload: {
        courseName: "เคมี",
        title: null,
        bodyExcerpt: "สวัสดีนักเรียน",
        postedByName: "ครูสมชาย",
      },
    });
    expect(p.bold).toContain("สวัสดีนักเรียน");
  });

  it("SUBMISSION_GRADED", () => {
    const p = buildNotificationPreview({
      kind: "SUBMISSION_GRADED",
      payload: {
        courseName: "ฟิสิกส์",
        assignmentTitle: "HW 5",
        graderName: "ครูเอ",
      },
    });
    expect(p.iconKey).toBe("CheckCircle2");
    expect(p.bold).toContain("ครูเอ");
    expect(p.bold).toContain("HW 5");
  });

  it("SUBMISSION_RETURNED includes the comment excerpt when present", () => {
    const p = buildNotificationPreview({
      kind: "SUBMISSION_RETURNED",
      payload: {
        courseName: "ฟิสิกส์",
        assignmentTitle: "HW 5",
        teacherName: "ครูเอ",
        commentExcerpt: "ทำใหม่ข้อ 3",
      },
    });
    expect(p.iconKey).toBe("Undo2");
    expect(p.bold).toContain("ทำใหม่ข้อ 3");
  });

  it("COMMENT_REPLIED labels by entityKind", () => {
    const p = buildNotificationPreview({
      kind: "COMMENT_REPLIED",
      payload: {
        courseName: "ฟิสิกส์",
        entityKind: "ASSIGNMENT",
        entityTitle: "HW 5",
        commenterName: "สมหญิง",
        commentExcerpt: "ขอบคุณค่ะ",
      },
    });
    expect(p.iconKey).toBe("MessageSquare");
    expect(p.bold).toContain("สมหญิง");
    expect(p.bold).toContain("การบ้าน");
    expect(p.bold).toContain("ขอบคุณค่ะ");
  });

  it("CLASS_CODE_JOINED includes the class code in meta", () => {
    const p = buildNotificationPreview({
      kind: "CLASS_CODE_JOINED",
      payload: {
        courseName: "คณิตศาสตร์ ม.4",
        studentName: "สมหญิง",
        classCode: "MATH4A-DEMO1",
      },
    });
    expect(p.iconKey).toBe("UserPlus");
    expect(p.bold).toContain("สมหญิง");
    expect(p.meta).toContain("MATH4A-DEMO1");
  });
});

describe("buildNotificationPreview — truncation", () => {
  it("truncates long commentExcerpt with ellipsis", () => {
    const long = "ก".repeat(200);
    const p = buildNotificationPreview({
      kind: "COMMENT_REPLIED",
      payload: {
        courseName: "ฟิสิกส์",
        entityKind: "ASSIGNMENT",
        entityTitle: "HW 5",
        commenterName: "สมหญิง",
        commentExcerpt: long,
      },
    });
    expect(p.bold.endsWith("…")).toBe(true);
    // bold is "สมหญิง ตอบในการบ้าน: <truncated>"; the truncated suffix
    // must be at most 80 chars (SOFT_TRUNCATE).
    const suffix = p.bold.split(": ").slice(1).join(": ");
    expect(suffix.length).toBeLessThanOrEqual(80);
  });

  it("does not truncate short excerpts", () => {
    const p = buildNotificationPreview({
      kind: "SUBMISSION_RETURNED",
      payload: {
        courseName: "ฟิสิกส์",
        assignmentTitle: "HW 5",
        teacherName: "ครูเอ",
        commentExcerpt: "ดีมาก",
      },
    });
    expect(p.bold.endsWith("…")).toBe(false);
  });
});

describe("buildNotificationPreview — malformed payload fallback", () => {
  it("returns generic when itemName is missing", () => {
    const p = buildNotificationPreview({
      kind: "SCORE_ITEM_PUBLISHED",
      payload: { courseName: "X" },
    });
    expect(p.iconKey).toBe("Bell");
    expect(p.bold).toBe("การแจ้งเตือน");
  });

  it("returns generic when MATERIAL_POSTED lacks postedByName", () => {
    const p = buildNotificationPreview({
      kind: "MATERIAL_POSTED",
      payload: { courseName: "X", title: "T" },
    });
    expect(p.iconKey).toBe("Bell");
  });

  it("returns generic when payload is null", () => {
    const p = buildNotificationPreview({
      kind: "SUBMISSION_GRADED",
      payload: null,
    });
    expect(p.iconKey).toBe("Bell");
  });

  it("returns generic when payload is undefined", () => {
    const p = buildNotificationPreview({
      kind: "ASSIGNMENT_POSTED",
      payload: undefined,
    });
    expect(p.iconKey).toBe("Bell");
  });
});
