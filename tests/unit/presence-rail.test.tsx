import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { PresenceRail } from "@/components/meeting/presence-rail";
import type { RoomParticipant } from "@/lib/meeting/room";

function person(over: Partial<RoomParticipant> = {}): RoomParticipant {
  return {
    userId: "u1",
    firstName: "มานี",
    lastName: "ใจดี",
    profileImageId: null,
    isTeacher: false,
    state: "ACTIVE",
    ...over,
  };
}

describe("the rail of who is in the room", () => {
  it("says each person's state in words, not only in colour", () => {
    // Green and a hollow circle differ only by hue, which a screen reader and
    // a colour-blind reader cannot use.
    render(
      <PresenceRail
        participants={[
          person({ userId: "a", firstName: "มานี", state: "ACTIVE" }),
          person({ userId: "b", firstName: "ปิติ", state: "IDLE" }),
          person({ userId: "c", firstName: "วีระ", state: "AWAY" }),
        ]}
      />
    );

    expect(screen.getByText(/มานี ใจดี — เปิดแอปอยู่/)).toBeDefined();
    expect(screen.getByText(/ปิติ ใจดี — สลับไปแท็บอื่น/)).toBeDefined();
    expect(screen.getByText(/วีระ ใจดี — ไม่ได้ใช้งานนานแล้ว/)).toBeDefined();
  });

  it("counts the room and marks the teacher", () => {
    render(
      <PresenceRail
        participants={[
          person({ userId: "t", firstName: "สมชาย", isTeacher: true }),
          person({ userId: "s", firstName: "มานี" }),
        ]}
      />
    );

    expect(screen.getByText("ในห้อง 2 คน")).toBeDefined();
    expect(screen.getByText("ครู")).toBeDefined();
  });

  it("says the room is empty rather than showing a bare zero", () => {
    render(<PresenceRail participants={[]} />);
    expect(screen.getByText("ยังไม่มีใครเข้าห้อง")).toBeDefined();
  });

  it("falls back to a name rather than rendering a blank row", () => {
    render(
      <PresenceRail
        participants={[person({ firstName: null, lastName: null })]}
      />
    );
    // Twice by design: once visibly, once inside the screen-reader label.
    expect(screen.getAllByText(/ไม่ทราบชื่อ/).length).toBeGreaterThan(0);
  });

  it("never hard-codes a surface colour on the badge ring", () => {
    // A literal white ring puts a halo on every avatar in the dark theme —
    // the same bug class as the amber callouts.
    const { container } = render(
      <PresenceRail participants={[person({ state: "ACTIVE" })]} />
    );
    const html = container.innerHTML;
    expect(html).toContain("ring-surface");
    expect(html).not.toContain("ring-white");
  });
});

describe("who is talking right now", () => {
  it("rings the avatar of anyone producing sound", () => {
    const { container } = render(
      <PresenceRail
        participants={[person({ userId: "talker" })]}
        media={{ speaking: ["talker"], micOff: [], deafened: [] }}
      />
    );
    expect(container.innerHTML).toContain("ring-green-500");
  });

  it("leaves a silent person unringed", () => {
    const { container } = render(
      <PresenceRail
        participants={[person({ userId: "quiet" })]}
        media={{ speaking: ["someone-else"], micOff: [], deafened: [] }}
      />
    );
    expect(container.innerHTML).not.toContain("ring-green-500");
  });

  it("says it in words too, not only as a ring", () => {
    render(
      <PresenceRail
        participants={[person({ userId: "talker", firstName: "มานี" })]}
        media={{ speaking: ["talker"], micOff: [], deafened: [] }}
      />
    );
    expect(screen.getByText(/มานี ใจดี .* · กำลังพูด/)).toBeDefined();
  });

  it("shows no rings at all when there is no stage reporting", () => {
    // The prop is optional: without a media server nobody is known to speak.
    const { container } = render(
      <PresenceRail participants={[person({ userId: "a" })]} />
    );
    expect(container.innerHTML).not.toContain("ring-green-500");
  });
});

describe("who cannot speak and who cannot hear", () => {
  it("flags a muted microphone", () => {
    render(
      <PresenceRail
        participants={[person({ userId: "m", firstName: "มานี" })]}
        media={{ speaking: [], micOff: ["m"], deafened: [] }}
      />
    );
    expect(screen.getByText("มานี ใจดี ปิดไมค์")).toBeDefined();
  });

  it("flags someone who cannot hear the room", () => {
    // Deafening is local to one browser; the roster only knows because the
    // stage publishes it as an attribute.
    render(
      <PresenceRail
        participants={[person({ userId: "d", firstName: "ปิติ" })]}
        media={{ speaking: [], micOff: [], deafened: ["d"] }}
      />
    );
    expect(screen.getByText("ปิติ ใจดี ปิดเสียง ไม่ได้ยินห้อง")).toBeDefined();
  });

  it("shows nothing for someone whose audio is entirely normal", () => {
    // A row of icons that is nearly always lit is a row nobody reads.
    render(
      <PresenceRail
        participants={[person({ userId: "ok", firstName: "ชูใจ" })]}
        media={{ speaking: [], micOff: [], deafened: [] }}
      />
    );
    expect(screen.queryByText(/ปิดไมค์|ปิดเสียง/)).toBeNull();
  });

  it("shows both when someone has closed both channels", () => {
    render(
      <PresenceRail
        participants={[person({ userId: "x", firstName: "วีระ" })]}
        media={{ speaking: [], micOff: ["x"], deafened: ["x"] }}
      />
    );
    expect(screen.getByText("วีระ ใจดี ปิดไมค์")).toBeDefined();
    expect(screen.getByText("วีระ ใจดี ปิดเสียง ไม่ได้ยินห้อง")).toBeDefined();
  });
});
