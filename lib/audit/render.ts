/**
 * PURE — verbose Thai sentence renderer for an AuditLog row.
 *
 * Shape: [Actor] [verb] [target] [reason clause]? [timestamp]
 *
 * Reads only what is already on the row — no JOINs, no I/O. The label
 * snapshot lives in `AuditLog.targetLabel` (captured by the emitter at
 * fire time per ADR-0027). The renderer does NOT compose the label from
 * `targetType` + `targetId`; that would re-introduce the JOIN-at-render
 * problem ADR-0027 is solving.
 *
 * Phase 10A · ADR-0027 · Q9c locked verbose tone.
 */

import type { AuditLog } from "@prisma/client";
import { actionLabel } from "./label";
import type { AuditEvent } from "./log";

/**
 * Minimal projection consumed by the renderer. Mirrors `AuditLog` plus
 * an optional `actorName` the caller may inject from a separate
 * `User.findMany` (the audit list page already does this for the existing
 * Actor column; we reuse it instead of forcing another DB read here).
 */
export interface AuditRowForRender {
  timestamp: Date;
  action: string;
  actorName?: string | null;
  actorRole?: string | null;
  targetLabel?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  reason?: string | null;
}

/**
 * Compose the verbose Thai sentence for one audit row.
 *
 * Examples:
 *   "ครูสมชาย ได้แก้ไขคะแนนหลังเผยแพร่ ของ 'สอบกลางภาค (วิชาคณิตศาสตร์ ม.4)'
 *    เนื่องจาก 'คำนวณผิด' เมื่อ 3 มิ.ย. 2569 เวลา 14:22"
 *
 *   "Admin ได้ลบประกาศ ของ 'งดสอบวันศุกร์ (วิชาคณิตศาสตร์)' เนื่องจาก
 *    'ครูแจ้งยกเลิก' เมื่อ 3 มิ.ย. 2569 เวลา 14:25"
 *
 * Fallbacks:
 *   - actorName null → use actorRole literal ("ครู" / "Admin" / "ระบบ")
 *   - targetLabel null → use "—" (renderer never invents)
 *   - reason null/empty → omit the "เนื่องจาก '…'" clause entirely
 *   - unknown action → raw enum literal via actionLabel's defensive
 *     fallback
 */
export function renderRow(row: AuditRowForRender): string {
  const subject = row.actorName?.trim() || actorFromRole(row.actorRole);
  const verbPhrase = sentenceVerb(row.action as AuditEvent);
  const target = row.targetLabel?.trim() || "—";
  const reasonClause =
    row.reason && row.reason.trim().length > 0
      ? ` เนื่องจาก '${row.reason.trim()}'`
      : "";
  const timestamp = formatThaiDateTime(row.timestamp);
  return `${subject} ${verbPhrase} '${target}'${reasonClause} เมื่อ ${timestamp}`;
}

/**
 * Verb-phrase form of an action — same vocabulary as `actionLabel` but
 * prefixed with "ได้" + sometimes a target-class noun ("ของ") so the
 * sentence reads naturally. Centralised here so the chip column and the
 * sentence column can diverge tone without copying each other's strings.
 */
function sentenceVerb(action: AuditEvent): string {
  const noun = actionLabel(action);
  // For events whose label already reads as a complete verb-noun phrase
  // ("เผยแพร่รายการคะแนน"), we just prepend "ได้" and the target follows
  // with " ของ '…'". This generalises across all 50+ actions without per-
  // action customisation — verbose explanatory tone (Q9c).
  return `ได้${noun} ของ`;
}

function actorFromRole(role: string | null | undefined): string {
  if (!role) return "ระบบ";
  switch (role) {
    case "ADMIN":
      return "Admin";
    case "TEACHER":
      return "ครู";
    case "STUDENT":
      return "นักเรียน";
    default:
      return role;
  }
}

/**
 * "3 มิ.ย. 2569 เวลา 14:22" — Buddhist calendar, Bangkok time. Mirrors
 * `lib/attendance/format.formatSessionHeader` posture (Pattern 11) but
 * inline here to keep the audit lib free of cross-module imports.
 */
function formatThaiDateTime(d: Date): string {
  const datePart = new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
    timeZone: "Asia/Bangkok",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
  const timePart = new Intl.DateTimeFormat("th-TH", {
    timeZone: "Asia/Bangkok",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(d);
  return `${datePart} เวลา ${timePart}`;
}

/**
 * Convenience wrapper that takes a raw `AuditLog` row plus an optional
 * pre-fetched actor name. Used by the viewer page which already JOINs
 * Users for the Actor column.
 */
export function renderAuditLog(
  row: Pick<
    AuditLog,
    | "timestamp"
    | "action"
    | "actorRole"
    | "targetLabel"
    | "targetType"
    | "targetId"
    | "reason"
  >,
  actorName?: string | null
): string {
  return renderRow({
    timestamp: row.timestamp,
    action: row.action,
    actorName,
    actorRole: row.actorRole,
    targetLabel: row.targetLabel,
    targetType: row.targetType,
    targetId: row.targetId,
    reason: row.reason,
  });
}
