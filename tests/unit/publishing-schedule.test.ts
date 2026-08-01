// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
  derivePublishingStatus,
  summarizePublishingQueue,
} from "@/lib/publishing/schedule";

const NOW = new Date("2026-08-01T12:29:27.064Z");

describe("scheduled publishing center", () => {
  it("matches the real Production case while the class is still waiting", () => {
    expect(
      derivePublishingStatus({
        now: NOW,
        publishAt: new Date("2026-08-03T07:05:00.000Z"),
        notifiedAt: null,
        activeStudentCount: 1,
        notificationCount: 0,
      })
    ).toBe("SCHEDULED");
  });

  it("separates live visibility from notification delivery", () => {
    const publishAt = new Date("2026-08-01T12:00:00.000Z");

    expect(
      derivePublishingStatus({
        now: NOW,
        publishAt,
        notifiedAt: null,
        activeStudentCount: 1,
        notificationCount: 0,
      })
    ).toBe("LIVE_NOTIFYING");

    expect(
      derivePublishingStatus({
        now: NOW,
        publishAt,
        notifiedAt: NOW,
        activeStudentCount: 1,
        notificationCount: 1,
      })
    ).toBe("LIVE_NOTIFIED");
  });

  it("flags an incomplete fan-out instead of claiming everyone was notified", () => {
    expect(
      derivePublishingStatus({
        now: NOW,
        publishAt: new Date("2026-08-01T12:00:00.000Z"),
        notifiedAt: NOW,
        activeStudentCount: 3,
        notificationCount: 2,
      })
    ).toBe("LIVE_NOTIFICATION_INCOMPLETE");
  });

  it("handles a published class with no active students honestly", () => {
    expect(
      derivePublishingStatus({
        now: NOW,
        publishAt: new Date("2026-08-01T12:00:00.000Z"),
        notifiedAt: NOW,
        activeStudentCount: 0,
        notificationCount: 0,
      })
    ).toBe("LIVE_NO_STUDENTS");
  });

  it("does not mark fan-out incomplete when a student joined after publishing", () => {
    expect(
      derivePublishingStatus({
        now: NOW,
        publishAt: new Date("2026-08-01T12:00:00.000Z"),
        notifiedAt: new Date("2026-08-01T12:00:01.000Z"),
        activeStudentCount: 2,
        notificationTargetCount: 1,
        notificationCount: 1,
      })
    ).toBe("LIVE_NOTIFIED");
  });

  it("sorts the waiting queue by the nearest publish time", () => {
    const summary = summarizePublishingQueue(
      [
        {
          kind: "MATERIAL",
          title: "Later",
          publishAt: new Date("2026-08-04T07:00:00.000Z"),
        },
        {
          kind: "ANNOUNCEMENT",
          title: "Next",
          publishAt: new Date("2026-08-03T07:05:00.000Z"),
        },
      ],
      NOW
    );

    expect(summary.count).toBe(2);
    expect(summary.next?.title).toBe("Next");
  });
});
