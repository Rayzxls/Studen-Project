import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

import { RoomWorkspace } from "@/components/meeting/room-workspace";

const SELF = { userId: "u1", name: "ครูสมชาย", profileImageId: null };

/** An open room with this person already in it, as the poll would answer. */
function stubOpenRoom() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => ({
        sessionId: "s1",
        isOpen: true,
        openedAt: new Date().toISOString(),
        meetingUrl: null,
        hasMeetingLink: true,
        participants: [
          {
            userId: "u1",
            firstName: "ครูสมชาย",
            lastName: null,
            profileImageId: null,
            isTeacher: true,
            state: "ACTIVE",
          },
        ],
      }),
    }))
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the room draws one self panel, not two", () => {
  it("draws exactly one with no media server configured", async () => {
    // Production had two. The stage drew the panel for the off case and the
    // workspace drew its own copy beside it, so every deployment without
    // LiveKit showed the teacher twice. Stage owns it in every branch now.
    stubOpenRoom();
    render(
      <RoomWorkspace courseId="c1" isTeacher stageEnabled={false} self={SELF} />
    );

    await waitFor(() => {
      expect(screen.getAllByText("ครูสมชาย").length).toBeGreaterThan(0);
    });
    // Once on the panel, once in the roster — never twice on the panel.
    expect(screen.getAllByText("ครูสมชาย")).toHaveLength(2);
    expect(screen.getAllByText("อยู่ในห้องแล้ว")).toHaveLength(1);
  });
});
