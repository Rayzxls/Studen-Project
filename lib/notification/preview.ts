/**
 * Bell-row preview builder — Phase 7 · P7-5
 *
 * Pure (no I/O, no React). Maps a notification kind + payload snapshot
 * to the text + icon-key the bell row renders.
 *
 * The returned `iconKey` is a string identifier (e.g. "BarChart3").
 * A separate component module (`components/notification/bell-icon.tsx`)
 * resolves the key to a lucide-react component. This split keeps the
 * preview logic plain TypeScript so it stays unit-testable without
 * pulling React into the test runner.
 *
 * Edge cases handled:
 *  - `Announcement.title === null` → fall back to bodyExcerpt
 *  - `Assignment.dueAt === null`   → omit the "ส่งภายใน …" tail
 *  - Truncate any free-text excerpt the lib didn't already clip
 *  - Missing / malformed payload → "การแจ้งเตือน" generic fallback
 *
 * `payload` is typed as `unknown` to mirror what `Prisma.JsonValue`
 * deserialises to; the helper validates per kind before reaching in.
 */

import type { NotificationKind } from "@prisma/client";
import { formatThaiDateShort } from "@/lib/attendance/format";

export interface NotificationPreview {
  /** lucide-react icon name, e.g. "BarChart3". */
  iconKey: string;
  /** Bold/primary line. */
  bold: string;
  /** Sub-line (course name, sometimes a tail like "ส่งภายใน …"). */
  meta: string;
}

const GENERIC_FALLBACK: NotificationPreview = {
  iconKey: "Bell",
  bold: "การแจ้งเตือน",
  meta: "",
};

/** Cap an excerpt that snuck through without clipping by the lib. */
const SOFT_TRUNCATE = 80;
function softTruncate(s: string): string {
  if (s.length <= SOFT_TRUNCATE) return s;
  return s.slice(0, SOFT_TRUNCATE - 1) + "…";
}

function readString(payload: unknown, key: string): string | null {
  if (payload && typeof payload === "object" && key in payload) {
    const v = (payload as Record<string, unknown>)[key];
    if (typeof v === "string") return v;
  }
  return null;
}

function buildMeta(courseName: string | null, tail?: string | null): string {
  const parts: string[] = [];
  if (courseName) parts.push(courseName);
  if (tail) parts.push(tail);
  return parts.join(" · ");
}

export function buildNotificationPreview(args: {
  kind: NotificationKind;
  payload: unknown;
}): NotificationPreview {
  const { kind, payload } = args;
  const courseName = readString(payload, "courseName");

  switch (kind) {
    case "SCORE_ITEM_PUBLISHED": {
      const itemName = readString(payload, "itemName");
      if (!itemName) return GENERIC_FALLBACK;
      return {
        iconKey: "BarChart3",
        bold: `คะแนน "${itemName}" เผยแพร่แล้ว`,
        meta: buildMeta(courseName),
      };
    }

    case "SCORE_ENTRY_EDITED": {
      const itemName = readString(payload, "itemName");
      if (!itemName) return GENERIC_FALLBACK;
      return {
        iconKey: "Pencil",
        bold: `คะแนน "${itemName}" ถูกแก้ไข`,
        meta: buildMeta(courseName),
      };
    }

    case "ASSIGNMENT_POSTED": {
      const title = readString(payload, "assignmentTitle");
      if (!title) return GENERIC_FALLBACK;
      const dueAt = readString(payload, "dueAt"); // ISO instant or null
      let tail: string | null = null;
      if (dueAt) {
        const d = new Date(dueAt);
        if (!Number.isNaN(d.getTime())) {
          tail = `ส่งภายใน ${formatThaiDateShort(d)}`;
        }
      }
      return {
        iconKey: "ClipboardList",
        bold: `การบ้านใหม่ "${title}"`,
        meta: buildMeta(courseName, tail),
      };
    }

    case "MATERIAL_POSTED": {
      const title = readString(payload, "title");
      const postedByName = readString(payload, "postedByName");
      if (!title || !postedByName) return GENERIC_FALLBACK;
      return {
        iconKey: "BookOpen",
        bold: `${postedByName} โพสต์เอกสาร "${title}"`,
        meta: buildMeta(courseName),
      };
    }

    case "ANNOUNCEMENT_POSTED": {
      const title = readString(payload, "title");
      const bodyExcerpt = readString(payload, "bodyExcerpt");
      const postedByName = readString(payload, "postedByName");
      if (!postedByName) return GENERIC_FALLBACK;
      const headline = title ?? softTruncate(bodyExcerpt ?? "ประกาศ");
      return {
        iconKey: "Megaphone",
        bold: `${postedByName}: ${headline}`,
        meta: buildMeta(courseName),
      };
    }

    case "SUBMISSION_GRADED": {
      const title = readString(payload, "assignmentTitle");
      const graderName = readString(payload, "graderName");
      if (!title || !graderName) return GENERIC_FALLBACK;
      return {
        iconKey: "CheckCircle2",
        bold: `${graderName} ตรวจการบ้าน "${title}" แล้ว`,
        meta: buildMeta(courseName),
      };
    }

    case "SUBMISSION_RETURNED": {
      const title = readString(payload, "assignmentTitle");
      const teacherName = readString(payload, "teacherName");
      const commentExcerpt = readString(payload, "commentExcerpt");
      if (!title || !teacherName) return GENERIC_FALLBACK;
      const bold = commentExcerpt
        ? `${teacherName} ส่งคืน "${title}" — ${softTruncate(commentExcerpt)}`
        : `${teacherName} ส่งคืน "${title}"`;
      return {
        iconKey: "Undo2",
        bold,
        meta: buildMeta(courseName),
      };
    }

    case "COMMENT_REPLIED": {
      const commenterName = readString(payload, "commenterName");
      const commentExcerpt = readString(payload, "commentExcerpt");
      const entityKind = readString(payload, "entityKind");
      if (!commenterName || !commentExcerpt) return GENERIC_FALLBACK;
      const entityLabel =
        entityKind === "ASSIGNMENT"
          ? "การบ้าน"
          : entityKind === "MATERIAL"
            ? "เอกสาร"
            : entityKind === "ANNOUNCEMENT"
              ? "ประกาศ"
              : entityKind === "SUBMISSION"
                ? "การส่งงาน"
                : "โพสต์";
      return {
        iconKey: "MessageSquare",
        bold: `${commenterName} ตอบใน${entityLabel}: ${softTruncate(commentExcerpt)}`,
        meta: buildMeta(courseName),
      };
    }

    case "CLASS_CODE_JOINED": {
      const studentName = readString(payload, "studentName");
      const classCode = readString(payload, "classCode");
      if (!studentName) return GENERIC_FALLBACK;
      const tail = classCode ? `รหัส ${classCode}` : null;
      return {
        iconKey: "UserPlus",
        bold: `${studentName} เข้าร่วมห้องเรียน`,
        meta: buildMeta(courseName, tail),
      };
    }
  }
}
