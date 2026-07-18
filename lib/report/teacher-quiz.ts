import type { TeacherQuizResultsView } from "@/lib/quiz";
import { buildCsv } from "@/lib/report/csv";

export function buildTeacherQuizCsv(result: TeacherQuizResultsView): string {
  const studentHeaders = [
    "รหัสนักเรียน",
    "ชื่อ-นามสกุล",
    "สถานะ",
    "จำนวนครั้ง",
    "คะแนนดีที่สุด",
    "คะแนนเต็ม",
    "เปอร์เซ็นต์",
    "ผ่านเกณฑ์",
    "ส่งล่าสุด",
    "ขยายเวลาถึง",
    "จำนวนครั้งพิเศษ",
  ];
  const studentRows = result.students.map((student) => {
    const percent =
      student.bestScore === null || result.totalPoints <= 0
        ? null
        : (student.bestScore / result.totalPoints) * 100;
    const passed =
      percent === null || result.passThresholdPercent === null
        ? null
        : percent >= result.passThresholdPercent
          ? "ผ่าน"
          : "ไม่ผ่าน";

    return [
      student.studentCode,
      student.name,
      studentStatusLabel(student.status),
      student.attemptCount,
      student.bestScore,
      result.totalPoints,
      percent === null ? null : percent.toFixed(2),
      passed,
      iso(student.latestSubmittedAt),
      iso(student.exception?.extendedDeadline ?? null),
      student.exception?.extraAttempts ?? 0,
    ];
  });

  const questionHeaders = [
    "ลำดับข้อ",
    "คำถาม",
    "คะแนนเต็ม",
    "จำนวนผู้ตอบ",
    "จำนวนตอบถูก",
    "อัตราตอบถูกเปอร์เซ็นต์",
  ];
  const questionRows = result.questions.map((question) => [
    question.position + 1,
    question.prompt,
    question.points,
    question.answeredCount,
    question.correctCount,
    question.correctRate,
  ]);

  const summary = buildCsv(
    ["รายการ", "ค่า"],
    [
      ["ชื่อแบบทดสอบ", result.title],
      ["บทเรียน", result.lessonTitle],
      ["ประเภท", result.mode === "SCORED" ? "แบบเก็บคะแนน" : "แบบฝึกทำ"],
      ["สถานะ", result.status === "OPEN" ? "กำลังเปิดรับ" : "ปิดรับแล้ว"],
      ["นักเรียนทั้งหมด", result.counts.total],
      ["ส่งแล้ว", result.counts.submitted],
      ["กำลังทำ", result.counts.inProgress],
      ["ยังไม่เริ่ม", result.counts.notStarted],
      ["คะแนนเฉลี่ย", result.metrics.average],
      ["คะแนนสูงสุด", result.metrics.highest],
      ["คะแนนต่ำสุด", result.metrics.lowest],
      ["อัตราผ่านเปอร์เซ็นต์", result.metrics.passRate],
      ["เวลาเฉลี่ยวินาที", result.metrics.averageDurationSeconds],
      ["เผยแพร่ผลเมื่อ", iso(result.publishedAt)],
    ]
  );
  const students = buildCsv(studentHeaders, studentRows).slice(1);
  const questions = buildCsv(questionHeaders, questionRows).slice(1);

  return `${summary}\r\n\r\nผลรายคน\r\n${students}\r\n\r\nวิเคราะห์รายข้อ\r\n${questions}`;
}

function studentStatusLabel(
  status: TeacherQuizResultsView["students"][number]["status"]
): string {
  if (status === "SUBMITTED") return "ส่งแล้ว";
  if (status === "IN_PROGRESS") return "กำลังทำ";
  return "ยังไม่เริ่ม";
}

function iso(value: Date | null): string | null {
  return value?.toISOString() ?? null;
}
