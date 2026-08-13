import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/moderation/actions", () => ({
  reportContentAction: vi.fn(),
}));

import {
  CourseChannel,
  type CourseChannelMessage,
} from "@/components/chat/course-channel";

const TEACHER_MESSAGE: CourseChannelMessage = {
  id: "m1",
  author: {
    userId: "teacher-1",
    firstName: "ครูเรย์",
    lastName: null,
    profileImageId: null,
  },
  body: "อ่านบทที่ 3 ก่อนเข้าเรียน",
  createdAt: "2026-08-14T03:00:00.000Z",
  deleted: false,
};

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: "visible",
  });
  Object.defineProperty(document, "hasFocus", {
    configurable: true,
    value: () => true,
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("CourseChannel", () => {
  it("sends one trimmed message and prevents an empty submission", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        ...TEACHER_MESSAGE,
        id: "m2",
        author: { ...TEACHER_MESSAGE.author, userId: "student-1" },
        body: "เข้าใจแล้วครับ",
      }),
    } as Response);

    render(
      <CourseChannel
        courseId="course-1"
        currentUserId="student-1"
        initialMessages={[]}
      />
    );

    expect(screen.getByRole("button", { name: "ส่งข้อความ" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("พิมพ์ข้อความ"), {
      target: { value: "  เข้าใจแล้วครับ  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "ส่งข้อความ" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/chat/course/course-1/messages",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ body: "เข้าใจแล้วครับ" }),
      })
    );
    expect(await screen.findByText("เข้าใจแล้วครับ")).toBeVisible();
    expect(screen.getByLabelText("พิมพ์ข้อความ")).toHaveValue("");
  });

  it("polls only while the tab is visible and focused", async () => {
    vi.useFakeTimers();
    let focused = false;
    Object.defineProperty(document, "hasFocus", {
      configurable: true,
      value: () => focused,
    });
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ conversationId: "chat-1", messages: [] }),
    } as Response);

    render(
      <CourseChannel
        courseId="course-1"
        currentUserId="student-1"
        initialMessages={[TEACHER_MESSAGE]}
      />
    );

    await vi.advanceTimersByTimeAsync(5_000);
    expect(fetchMock).not.toHaveBeenCalled();

    focused = true;
    await vi.advanceTimersByTimeAsync(5_000);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/chat/course/course-1/messages?after=m1",
      { cache: "no-store" }
    );

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    await vi.advanceTimersByTimeAsync(5_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("shows an archived channel as read-only", () => {
    render(
      <CourseChannel
        courseId="course-1"
        currentUserId="teacher-1"
        initialMessages={[TEACHER_MESSAGE]}
        readOnly
      />
    );

    expect(
      screen.getByText("อ่านประวัติได้แต่ส่งข้อความใหม่ไม่ได้", {
        exact: false,
      })
    ).toBeVisible();
    expect(screen.queryByLabelText("พิมพ์ข้อความ")).not.toBeInTheDocument();
  });
});
