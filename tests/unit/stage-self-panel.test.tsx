import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { Stage } from "@/components/meeting/stage";

const SELF = {
  self: { userId: "u1", name: "ครูสมชาย", profileImageId: null },
  inRoom: true,
  speaking: false,
  busy: false,
  onEnter: () => {},
  showEnter: true,
};

describe("who draws the self panel", () => {
  it("draws exactly one when no media server is configured", () => {
    // Production had two: the stage drew it for the off case and the workspace
    // drew its own copy as well. One owner, in every branch.
    render(<Stage sessionId={null} enabled={false} selfPanel={SELF} />);
    expect(screen.getAllByText("ครูสมชาย")).toHaveLength(1);
  });

  it("still says what the stage is waiting for", () => {
    render(<Stage sessionId={null} enabled={false} selfPanel={SELF} />);
    expect(screen.getByText("การแชร์หน้าจอจะขึ้นตรงนี้")).toBeDefined();
  });

  it("draws one when a session exists but the stage is switched off", () => {
    render(<Stage sessionId="s1" enabled={false} selfPanel={SELF} />);
    expect(screen.getAllByText("ครูสมชาย")).toHaveLength(1);
  });
});
