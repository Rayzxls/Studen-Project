/**
 * User Feed row preview — Phase 7 · P7-6
 *
 * Pure (no React). Maps a `FeedItem` to row content: per-kind iconKey
 * + bold/headline text + meta line. Edge cases:
 *  - Announcement.title is nullable → fall back to "ประกาศ".
 *  - Assignment with dueAt → render "ส่งภายใน {Buddhist short}" tail.
 *  - SCORE_PUBLISHED title (= ScoreItem.name) framed as "คะแนน 'X'
 *    เผยแพร่แล้ว".
 *
 * `iconKey` is a string; component layer resolves to a lucide icon.
 * Mirrors the `lib/notification/preview` posture so UI consumers can
 * reuse the same `NotificationIcon` lookup map.
 */

import { formatThaiDateShort } from "@/lib/attendance/format";
import type { FeedItem } from "./aggregator";

export interface FeedRowPreview {
  iconKey: string;
  bold: string;
  /** Course context line (e.g. "คณิตศาสตร์ ม.4/2 · ส่งภายใน 8 มิ.ย. 2569"). */
  meta: string;
}

export function buildFeedRowPreview(args: {
  item: FeedItem;
  courseName: string;
}): FeedRowPreview {
  const { item, courseName } = args;
  const metaParts: string[] = [courseName];

  switch (item.kind) {
    case "ASSIGNMENT": {
      // `detail` carries the ISO dueAt when present.
      if (item.detail) {
        const due = new Date(item.detail);
        if (!Number.isNaN(due.getTime())) {
          metaParts.push(`ส่งภายใน ${formatThaiDateShort(due)}`);
        }
      }
      return {
        iconKey: "ClipboardList",
        bold: `การบ้านใหม่: ${item.title ?? "—"}`,
        meta: metaParts.join(" · "),
      };
    }

    case "MATERIAL":
      return {
        iconKey: "BookOpen",
        bold: `เอกสารใหม่: ${item.title ?? "—"}`,
        meta: metaParts.join(" · "),
      };

    case "ANNOUNCEMENT":
      return {
        iconKey: "Megaphone",
        bold: `ประกาศ: ${item.title ?? "ประกาศ"}`,
        meta: metaParts.join(" · "),
      };

    case "SCORE_PUBLISHED":
      return {
        iconKey: "BarChart3",
        bold: `คะแนน "${item.title ?? "—"}" เผยแพร่แล้ว`,
        meta: metaParts.join(" · "),
      };
  }
}
