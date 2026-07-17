import { describe, expect, it } from "vitest";
import {
  buildAdminLessonProjection,
  type AdminLessonSource,
} from "@/lib/lesson";

const createdAt = new Date("2026-07-15T00:00:00Z");

describe("Admin Lesson observer projection", () => {
  it("returns aggregate progress for active enrollments only", () => {
    const source: AdminLessonSource[] = [
      {
        id: "lesson-1",
        title: "แรงและการเคลื่อนที่",
        description: "บทเรียนตัวอย่าง",
        position: 0,
        archivedAt: null,
        createdAt,
        materialCount: 2,
        assignments: [
          {
            submissions: [
              { status: "SUBMITTED", enrollment: { removedAt: null } },
              { status: "GRADED", enrollment: { removedAt: null } },
              {
                status: "LATE_SUBMITTED",
                enrollment: { removedAt: createdAt },
              },
            ],
          },
          {
            submissions: [
              { status: "LATE_SUBMITTED", enrollment: { removedAt: null } },
            ],
          },
        ],
      },
    ];

    const [lesson] = buildAdminLessonProjection(source, 2);

    expect(lesson).toMatchObject({
      assignmentCount: 2,
      materialCount: 2,
      submittedCount: 3,
      missingCount: 1,
      pendingGradingCount: 2,
      completionPercent: 75,
    });
  });

  it("keeps an empty Lesson at zero progress", () => {
    const [lesson] = buildAdminLessonProjection(
      [
        {
          id: "lesson-empty",
          title: "บทเรียนใหม่",
          description: null,
          position: 0,
          archivedAt: null,
          createdAt,
          materialCount: 0,
          assignments: [],
        },
      ],
      30
    );

    expect(lesson.completionPercent).toBe(0);
    expect(lesson.missingCount).toBe(0);
  });

  it("does not carry student identity or private submission fields into the result", () => {
    const [lesson] = buildAdminLessonProjection(
      [
        {
          id: "lesson-private",
          title: "ความเป็นส่วนตัว",
          description: null,
          position: 0,
          archivedAt: null,
          createdAt,
          materialCount: 0,
          assignments: [
            {
              submissions: [
                { status: "SUBMITTED", enrollment: { removedAt: null } },
              ],
            },
          ],
        },
      ],
      1
    );

    const serialized = JSON.stringify(lesson);
    expect(serialized).not.toContain("studentId");
    expect(serialized).not.toContain("enrollmentId");
    expect(serialized).not.toContain("file");
    expect(serialized).not.toContain("score");
    expect(serialized).not.toContain("comment");
  });
});
