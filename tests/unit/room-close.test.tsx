import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

/**
 * Closing the room (ADR-0053).
 *
 * Closing and leaving are two different acts and the room had neither until
 * now. Leaving is one person stepping out of a room that carries on; closing
 * ends the lesson for everyone still in it, which is why only the teacher gets
 * the control and why it asks before it does anything.
 */

interface StageProps {
  enabled: boolean;
  selfPanel: Record<string, unknown>;
}

vi.mock("@/components/meeting/stage", async () => {
  const { SelfPanel } = await import("@/components/meeting/self-panel");
  return {
    Stage: (props: StageProps) => (
      <SelfPanel
        {...(props.selfPanel as React.ComponentProps<typeof SelfPanel>)}
      />
    ),
  };
});

const { RoomWorkspace } = await import("@/components/meeting/room-workspace");

const SELF = { userId: "t1", name: "ครูเรย์", profileImageId: null };
const TEACHER_PRESENT = {
  userId: "t1",
  firstName: "ครูเรย์",
  lastName: null,
  profileImageId: null,
  isTeacher: true,
  state: "ACTIVE" as const,
};

let closeCalls = 0;
let closeResponseOk = true;

beforeEach(() => {
  closeCalls = 0;
  closeResponseOk = true;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (String(url).includes("/close")) {
        closeCalls += 1;
        return {
          ok: closeResponseOk,
          json: async () => ({ closedAt: new Date() }),
        };
      }
      return {
        ok: true,
        json: async () => ({
          sessionId: "s1",
          isOpen: true,
          openedAt: new Date().toISOString(),
          meetingUrl: null,
          hasMeetingLink: true,
          participants: [TEACHER_PRESENT],
        }),
      };
    })
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderAs(isTeacher: boolean) {
  return render(
    <RoomWorkspace
      courseId="c1"
      isTeacher={isTeacher}
      stageEnabled
      self={SELF}
    />
  );
}

describe("ending the lesson", () => {
  it("is offered to the teacher", async () => {
    renderAs(true);
    await waitFor(() => expect(screen.getByText("ปิดห้องเรียน")).toBeTruthy());
  });

  it("is not offered to a student", async () => {
    renderAs(false);
    // Wait for the room to be drawn at all before concluding it is absent.
    await waitFor(() => expect(screen.getByText("ออกจากห้อง")).toBeTruthy());
    expect(screen.queryByText("ปิดห้องเรียน")).toBeNull();
  });

  it("asks before it ends anyone's lesson", async () => {
    renderAs(true);
    await waitFor(() => expect(screen.getByText("ปิดห้องเรียน")).toBeTruthy());

    fireEvent.click(screen.getByText("ปิดห้องเรียน"));

    // The press opens a question, not the door.
    expect(closeCalls).toBe(0);
    expect(
      screen.getByText("ปิดแล้วทุกคนจะออกจากห้อง เปิดใหม่ได้ภายหลัง")
    ).toBeTruthy();
  });

  it("backs out without closing", async () => {
    renderAs(true);
    await waitFor(() => expect(screen.getByText("ปิดห้องเรียน")).toBeTruthy());

    fireEvent.click(screen.getByText("ปิดห้องเรียน"));
    fireEvent.click(screen.getByText("ยกเลิก"));

    expect(closeCalls).toBe(0);
    expect(screen.getByText("ปิดห้องเรียน")).toBeTruthy();
  });

  it("closes once confirmed", async () => {
    renderAs(true);
    await waitFor(() => expect(screen.getByText("ปิดห้องเรียน")).toBeTruthy());

    fireEvent.click(screen.getByText("ปิดห้องเรียน"));
    fireEvent.click(screen.getByText("ยืนยันปิดห้อง"));

    await waitFor(() => expect(closeCalls).toBe(1));
  });

  it("reports a rejected close and keeps the teacher in the open room", async () => {
    closeResponseOk = false;
    renderAs(true);
    await waitFor(() => expect(screen.getByText("ปิดห้องเรียน")).toBeTruthy());

    fireEvent.click(screen.getByText("ปิดห้องเรียน"));
    fireEvent.click(screen.getByText("ยืนยันปิดห้อง"));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "ปิดห้องไม่สำเร็จ"
    );
    expect(screen.getByText("ออกจากห้อง")).toBeTruthy();
  });
});
