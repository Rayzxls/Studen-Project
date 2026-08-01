import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TeacherPublishingScheduleView } from "@/components/publishing/teacher-publishing-schedule";

describe("TeacherPublishingScheduleView", () => {
  it("explains the real Production waiting state without claiming it was seen", () => {
    render(
      <TeacherPublishingScheduleView
        courseId="eng"
        schedule={{
          activeStudentCount: 1,
          studentsWithPushCount: 1,
          recent: [],
          upcoming: [
            {
              kind: "ANNOUNCEMENT",
              id: "announcement-1",
              title: "ประกาศไม่มีหัวข้อ",
              createdAt: new Date("2026-08-01T12:11:41.354Z"),
              publishAt: new Date("2026-08-03T07:05:00.000Z"),
              notifiedAt: null,
              status: "SCHEDULED",
              notificationTargetCount: 1,
              notificationCount: 0,
              notificationReadCount: 0,
            },
          ],
        }}
      />
    );

    expect(screen.getByText("ประกาศไม่มีหัวข้อ")).toBeVisible();
    expect(screen.getByText("ตั้งเวลา")).toBeVisible();
    expect(
      screen.getByText(/นักเรียนยังไม่เห็น.*เปิดให้ 1 คนเข้าถึงได้/)
    ).toBeVisible();
    expect(screen.queryByText(/เห็นโพสต์แล้ว/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /ดูโพสต์/ })).toHaveAttribute(
      "href",
      "/teacher/courses/eng/announcements/announcement-1"
    );
  });
});
