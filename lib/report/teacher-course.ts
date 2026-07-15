import type { TeacherAttendanceSummary } from "@/lib/attendance/queries";
import { gradeForCourseOffering, scoreTotal } from "@/lib/scoring/calc";
import type { TeacherScoreboard } from "@/lib/scoring/queries";
import { buildCsv } from "@/lib/report/csv";

export function buildTeacherScoreCsv(scoreboard: TeacherScoreboard): string {
  const publishedItems = scoreboard.items.filter(
    (item) => item.publishedAt !== null
  );
  const publishedFullScore = publishedItems.reduce(
    (sum, item) => sum + Math.max(0, item.fullScore),
    0
  );

  const headers = [
    "รหัสนักเรียน",
    "ชื่อ",
    "นามสกุล",
    "สถานะสมาชิก",
    ...scoreboard.items.map(
      (item) =>
        `${item.name} (${item.publishedAt ? "เผยแพร่แล้ว" : "ร่าง"} / ${item.fullScore})`
    ),
    "คะแนนรวมที่เผยแพร่",
    "คะแนนเต็มที่เผยแพร่",
    "เปอร์เซ็นต์",
    "เกรดรายวิชา",
  ];

  const rows = scoreboard.rows.map((row) => {
    const entries = row.entries.map((entry) => ({
      scoreItemId: entry.scoreItemId,
      value: entry.value,
    }));
    const entryByItem = new Map(
      entries.map((entry) => [entry.scoreItemId, entry.value])
    );
    const scoreSum = publishedItems.reduce(
      (sum, item) => sum + (entryByItem.get(item.id) ?? 0),
      0
    );
    const percent = scoreTotal(scoreboard.items, entries);
    const grade = gradeForCourseOffering(scoreboard.items, entries);

    return [
      row.studentId,
      row.firstName,
      row.lastName,
      row.removedAt ? "ออกจากรายวิชาแล้ว" : "กำลังเรียน",
      ...scoreboard.items.map((item) => entryByItem.get(item.id) ?? null),
      publishedItems.length > 0 ? scoreSum : null,
      publishedItems.length > 0 ? publishedFullScore : null,
      percent === null ? null : percent.toFixed(2),
      grade.grade === null ? null : grade.grade.toFixed(1),
    ];
  });

  return buildCsv(headers, rows);
}

export function buildTeacherAttendanceCsv(
  summary: TeacherAttendanceSummary
): string {
  const headers = [
    "รหัสนักเรียน",
    "ชื่อ",
    "นามสกุล",
    "มาเรียน",
    "สาย",
    "ลา",
    "ขาด",
    "ยังไม่เช็ค",
    "รวมเช็คแล้ว",
    "คาบที่เปิดทั้งหมด",
    "เข้าเรียนเปอร์เซ็นต์",
  ];

  const rows = summary.rows.map((row) => {
    const marked =
      row.counts.PRESENT +
      row.counts.LATE +
      row.counts.EXCUSED +
      row.counts.ABSENT;
    const notMarked = Math.max(summary.totalSessions - marked, 0);
    const attendanceRate =
      marked > 0
        ? ((row.counts.PRESENT + row.counts.LATE) / marked) * 100
        : null;

    return [
      row.student.studentId,
      row.student.firstName,
      row.student.lastName,
      row.counts.PRESENT,
      row.counts.LATE,
      row.counts.EXCUSED,
      row.counts.ABSENT,
      notMarked,
      marked,
      summary.totalSessions,
      attendanceRate === null ? null : attendanceRate.toFixed(2),
    ];
  });

  return buildCsv(headers, rows);
}
