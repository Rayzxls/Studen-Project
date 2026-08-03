// @vitest-environment node

import { describe, expect, it } from "vitest";

import { canReschedule } from "@/lib/publishing/visibility";
import {
  formatPublishAtInput,
  readPublishAt,
} from "@/lib/publishing/validation";

const NOW = new Date("2026-08-01T08:00:00.000Z");
const LATER = new Date(NOW.getTime() + 3_600_000);
const EARLIER = new Date(NOW.getTime() - 3_600_000);

describe("who may still move a publish time", () => {
  it("lets the author move a post the class has not seen", () => {
    expect(canReschedule({ publishAt: LATER, notifiedAt: null }, NOW)).toBe(
      true
    );
  });

  it("refuses a post that is already live, because there is no unpublish", () => {
    expect(canReschedule({ publishAt: EARLIER, notifiedAt: null }, NOW)).toBe(
      false
    );
  });

  it("refuses at the exact publish moment, not a tick after", () => {
    expect(
      canReschedule({ publishAt: new Date(NOW), notifiedAt: null }, NOW)
    ).toBe(false);
  });

  it("refuses a post the sweep already claimed, even if its time is future", () => {
    // A stamped row would never be announced again, so moving it would hand
    // the class a silent post.
    expect(canReschedule({ publishAt: LATER, notifiedAt: NOW }, NOW)).toBe(
      false
    );
  });

  it("refuses a post that was never scheduled at all", () => {
    expect(canReschedule({ publishAt: null, notifiedAt: null }, NOW)).toBe(
      false
    );
  });
});

describe("prefilling the reschedule form", () => {
  it("shows the stored instant as the Bangkok wall clock the teacher chose", () => {
    expect(formatPublishAtInput(new Date("2026-08-03T01:30:00.000Z"))).toBe(
      "2026-08-03T08:30"
    );
  });

  it("keeps a date that crosses midnight in Bangkok on the Bangkok day", () => {
    expect(formatPublishAtInput(new Date("2026-08-02T18:00:00.000Z"))).toBe(
      "2026-08-03T01:00"
    );
  });

  it("round-trips through the reader without moving the post", () => {
    const stored = new Date("2026-08-03T01:30:00.000Z");
    expect(readPublishAt(formatPublishAtInput(stored))?.toISOString()).toBe(
      stored.toISOString()
    );
  });

  it("renders an unusable date as empty instead of NaN text", () => {
    expect(formatPublishAtInput(new Date("nonsense"))).toBe("");
  });
});
