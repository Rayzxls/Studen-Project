import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { LEFT_AFTER_MS, derivePresenceState } from "@/lib/meeting/presence";

/**
 * Getting into the room, and back out of it (ADR-0053).
 *
 * The rule the room was missing: "Join, which is not the same as attending. A
 * student can press it" — a press, not a side effect of opening a tab. A page
 * that connects a microphone to a live class because somebody navigated to it
 * has taken a decision that was theirs to take.
 */

interface StageProps {
  enabled: boolean;
  sessionId: string | null;
  selfPanel: Record<string, unknown>;
}
let lastStage: StageProps | null = null;

// Stands in for the stage, minus LiveKit. It still draws the self panel,
// because the real one owns it in every branch — connected, off and failed —
// and a stub that dropped it would hide the very buttons under test.
vi.mock("@/components/meeting/stage", async () => {
  const { SelfPanel } = await import("@/components/meeting/self-panel");
  return {
    Stage: (props: StageProps) => {
      lastStage = props;
      return (
        <SelfPanel
          {...(props.selfPanel as React.ComponentProps<typeof SelfPanel>)}
        />
      );
    },
  };
});

const { RoomWorkspace } = await import("@/components/meeting/room-workspace");

const SELF = { userId: "u1", name: "นักเรียนเอ", profileImageId: null };

const TEACHER = {
  userId: "t1",
  firstName: "ครู",
  lastName: null,
  profileImageId: null,
  isTeacher: true,
  state: "ACTIVE" as const,
};
const SELF_PRESENT = {
  userId: "u1",
  firstName: "นักเรียนเอ",
  lastName: null,
  profileImageId: null,
  isTeacher: false,
  state: "ACTIVE" as const,
};

/** The roster the poll will report; tests move people in and out of it. */
let roster: Array<typeof TEACHER | typeof SELF_PRESENT> = [];
let leaveCalls = 0;

beforeEach(() => {
  lastStage = null;
  roster = [TEACHER];
  leaveCalls = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: { method?: string }) => {
      if (String(url).includes("/leave")) {
        leaveCalls += 1;
        return { ok: true, json: async () => ({ ok: true }) };
      }
      if (init?.method === "POST") {
        return { ok: true, json: async () => ({ meetingUrl: null }) };
      }
      return {
        ok: true,
        json: async () => ({
          sessionId: "s1",
          isOpen: true,
          openedAt: new Date().toISOString(),
          meetingUrl: null,
          hasMeetingLink: true,
          participants: roster,
        }),
      };
    })
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderRoom() {
  return render(
    <RoomWorkspace courseId="c1" isTeacher={false} stageEnabled self={SELF} />
  );
}

describe("a student is not put into the class by opening the page", () => {
  it("offers a way in rather than taking one", async () => {
    renderRoom();

    await waitFor(() =>
      expect(screen.getByText("เข้าร่วมห้องเรียน")).toBeTruthy()
    );
    // Nothing is connected: no token minted, no microphone, no presence.
    expect(lastStage?.enabled).toBe(false);
    expect(screen.queryByText("ออกจากห้อง")).toBeNull();
  });

  it("connects once they ask, and offers the way back out", async () => {
    renderRoom();
    await waitFor(() =>
      expect(screen.getByText("เข้าร่วมห้องเรียน")).toBeTruthy()
    );

    roster = [TEACHER, SELF_PRESENT];
    fireEvent.click(screen.getByText("เข้าร่วมห้องเรียน"));

    await waitFor(() => expect(lastStage?.enabled).toBe(true));
    expect(screen.getByText("ออกจากห้อง")).toBeTruthy();
  });
});

describe("leaving the room", () => {
  it("disconnects on the click, not on the next poll", async () => {
    renderRoom();
    roster = [TEACHER, SELF_PRESENT];
    await waitFor(() => expect(lastStage?.enabled).toBe(true));

    fireEvent.click(screen.getByText("ออกจากห้อง"));

    // The poll is three seconds behind and still reports them present. What
    // this browser asked for has to outrank it, or a response already in
    // flight walks them straight back into a room they just left.
    expect(roster).toContain(SELF_PRESENT);
    await waitFor(() => expect(lastStage?.enabled).toBe(false));
    expect(screen.getByText("เข้าร่วมห้องเรียน")).toBeTruthy();
  });

  it("tells the server, so the rest of the class stops seeing them", async () => {
    renderRoom();
    roster = [TEACHER, SELF_PRESENT];
    await waitFor(() => expect(lastStage?.enabled).toBe(true));

    fireEvent.click(screen.getByText("ออกจากห้อง"));

    await waitFor(() => expect(leaveCalls).toBe(1));
  });
});

describe("what leaving writes", () => {
  it("backdates presence past the point the room calls it left", () => {
    // `leaveRoom` adds no column: it writes a heartbeat old enough that the
    // derivation already reads LEFT, so saying goodbye and a tab dying without
    // saying goodbye end in the same place.
    const now = new Date("2026-08-13T10:00:00Z");
    const gone = new Date(now.getTime() - LEFT_AFTER_MS - 1_000);

    expect(
      derivePresenceState({ lastSeenAt: gone, lastActiveAt: gone }, now)
    ).toBe("LEFT");
  });
});
