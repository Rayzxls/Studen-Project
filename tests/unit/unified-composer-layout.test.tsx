import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/app/teacher/courses/[id]/feed/actions", () => ({
  composeAnnouncementAction: vi.fn(),
  composeAssignmentAction: vi.fn(),
  composeMaterialAction: vi.fn(),
}));

vi.mock("@/components/attachment/teacher-attachment-uploader", () => ({
  TeacherAttachmentUploader: () => <div data-testid="attachment-uploader" />,
}));

import { UnifiedComposer } from "@/components/feed/unified-composer";

describe("UnifiedComposer scheduling layout", () => {
  beforeAll(() => {
    HTMLDialogElement.prototype.showModal = vi.fn(function (
      this: HTMLDialogElement
    ) {
      this.setAttribute("open", "");
    });
    HTMLDialogElement.prototype.close = vi.fn(function (
      this: HTMLDialogElement
    ) {
      this.removeAttribute("open");
    });
  });

  it("gives the scheduling controls a wide dialog without horizontal scrolling", () => {
    render(<UnifiedComposer courseId="course-1" />);

    fireEvent.click(screen.getByRole("button", { name: "สร้างใหม่" }));

    expect(screen.getByRole("dialog")).toHaveClass("max-w-3xl");
    expect(screen.getByTestId("composer-scroll-body")).toHaveClass(
      "overflow-y-auto",
      "overflow-x-hidden"
    );
  });
});
