import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock("@/app/teacher/courses/[id]/announcements/actions", () => ({
  updateAnnouncementAction: vi.fn(),
  deleteAnnouncementAction: vi.fn(),
}));

vi.mock("@/app/teacher/courses/[id]/materials/actions", () => ({
  updateMaterialAction: vi.fn(),
  deleteMaterialAction: vi.fn(),
}));

vi.mock("@/app/teacher/courses/[id]/assignments/actions", () => ({
  updateAssignmentAction: vi.fn(),
  deleteAssignmentAction: vi.fn(),
}));

vi.mock("@/app/teacher/courses/[id]/schedule/actions", () => ({
  reschedulePublishingAction: vi.fn(),
  publishNowAction: vi.fn(),
}));

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
              editable: {
                title: null,
                body: "ทดสอบประกาศตั้งเวลา",
                linkUrls: [],
              },
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
    expect(screen.getByRole("button", { name: "แก้ไขประกาศ" })).toBeVisible();
    expect(screen.getByRole("button", { name: "ลบประกาศ" })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "แก้ไขประกาศ" }));
    expect(screen.getByRole("heading", { name: "แก้ไขประกาศ" })).toBeVisible();
  });

  it("lets the teacher move a post nobody has seen, prefilled with its Bangkok time", () => {
    render(
      <TeacherPublishingScheduleView
        courseId="eng"
        schedule={{
          activeStudentCount: 1,
          studentsWithPushCount: 0,
          recent: [],
          upcoming: [
            {
              kind: "ANNOUNCEMENT",
              id: "announcement-1",
              title: "ประกาศ",
              createdAt: new Date("2026-08-01T12:11:41.354Z"),
              publishAt: new Date("2026-08-03T01:30:00.000Z"),
              notifiedAt: null,
              status: "SCHEDULED",
              notificationTargetCount: 1,
              notificationCount: 0,
              notificationReadCount: 0,
              editable: { title: null, body: "เนื้อหา", linkUrls: [] },
            },
          ],
        }}
      />
    );

    const trigger = screen.getByRole("button", {
      name: "เลื่อนเวลาเผยแพร่ประกาศ",
    });
    expect(trigger).toBeVisible();

    fireEvent.click(trigger);
    expect(
      screen.getByRole("heading", { name: "เลื่อนเวลาเผยแพร่ประกาศ" })
    ).toBeVisible();
    // 08:30 Bangkok, not the 01:30 the stored instant reads as in UTC.
    expect(screen.getByDisplayValue("2026-08-03T08:30")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /เผยแพร่ทันที/ })).toBeVisible();
  });

  it("hides the reschedule control once the class can see the post", () => {
    const publishAt = new Date("2026-08-01T01:30:00.000Z");
    render(
      <TeacherPublishingScheduleView
        courseId="eng"
        schedule={{
          activeStudentCount: 1,
          studentsWithPushCount: 0,
          upcoming: [],
          recent: [
            {
              kind: "ANNOUNCEMENT",
              id: "announcement-1",
              title: "ประกาศ",
              createdAt: new Date("2026-07-31T12:00:00.000Z"),
              publishAt,
              notifiedAt: publishAt,
              status: "LIVE_NOTIFIED",
              notificationTargetCount: 1,
              notificationCount: 1,
              notificationReadCount: 1,
              editable: { title: null, body: "เนื้อหา", linkUrls: [] },
            },
          ],
        }}
      />
    );

    // There is no unpublish, so the control is absent rather than failing late.
    expect(
      screen.queryByRole("button", { name: "เลื่อนเวลาเผยแพร่ประกาศ" })
    ).not.toBeInTheDocument();
  });

  it("offers clear edit and delete controls for every scheduled post type", () => {
    const publishAt = new Date("2026-08-04T01:30:00.000Z");
    const common = {
      createdAt: new Date("2026-08-03T01:00:00.000Z"),
      publishAt,
      notifiedAt: null,
      status: "SCHEDULED" as const,
      notificationTargetCount: 1,
      notificationCount: 0,
      notificationReadCount: 0,
    };

    render(
      <TeacherPublishingScheduleView
        courseId="eng"
        schedule={{
          activeStudentCount: 1,
          studentsWithPushCount: 0,
          recent: [],
          upcoming: [
            {
              ...common,
              kind: "ANNOUNCEMENT",
              id: "announcement-1",
              title: "ประกาศ",
              editable: { title: "ประกาศ", body: "รายละเอียด", linkUrls: [] },
            },
            {
              ...common,
              kind: "MATERIAL",
              id: "material-1",
              title: "เอกสาร",
              editable: { title: "เอกสาร", body: "รายละเอียด", linkUrls: [] },
            },
            {
              ...common,
              kind: "ASSIGNMENT",
              id: "assignment-1",
              title: "การบ้าน",
              editable: {
                id: "assignment-1",
                title: "การบ้าน",
                description: "รายละเอียด",
                dueAt: null,
                allowText: true,
                allowFile: true,
                allowLink: true,
                submissionClosed: false,
                autoCloseAtDue: false,
                isScored: false,
                scoreItem: null,
              },
            },
          ],
        }}
      />
    );

    for (const label of [
      "แก้ไขประกาศ",
      "ลบประกาศ",
      "แก้ไขเอกสาร",
      "ลบเอกสาร",
      "แก้ไขการบ้าน",
      "ลบการบ้าน",
    ]) {
      expect(screen.getByRole("button", { name: label })).toBeVisible();
    }
  });
});
