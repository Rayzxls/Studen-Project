/**
 * Pure unit tests — lib/notification/time-format
 *
 * Locks the Q8 hybrid policy (< 7d relative, ≥ 7d absolute Buddhist).
 * Boundary at each unit transition + clock-skew + 7d switchover.
 */

import { describe, expect, it } from "vitest";
import { formatNotificationTime } from "@/lib/notification/time-format";

const NOW = new Date("2026-06-04T12:00:00Z");

function minus(ms: number): Date {
  return new Date(NOW.getTime() - ms);
}

const SEC = 1_000;
const MIN = 60 * SEC;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe("formatNotificationTime — relative buckets", () => {
  it("returns ‘ไม่กี่วินาทีที่ผ่านมา’ within the first minute", () => {
    expect(formatNotificationTime(minus(5 * SEC), NOW)).toBe(
      "ไม่กี่วินาทีที่ผ่านมา"
    );
  });

  it("returns ‘X นาทีที่ผ่านมา’ for minutes", () => {
    expect(formatNotificationTime(minus(3 * MIN), NOW)).toBe("3 นาทีที่ผ่านมา");
  });

  it("rounds the minute count down (floor)", () => {
    expect(formatNotificationTime(minus(2 * MIN + 59 * SEC), NOW)).toBe(
      "2 นาทีที่ผ่านมา"
    );
  });

  it("returns ‘X ชม. ที่ผ่านมา’ for hours", () => {
    expect(formatNotificationTime(minus(5 * HOUR), NOW)).toBe(
      "5 ชม. ที่ผ่านมา"
    );
  });

  it("returns ‘X วันที่ผ่านมา’ for days under a week", () => {
    expect(formatNotificationTime(minus(3 * DAY), NOW)).toBe("3 วันที่ผ่านมา");
  });
});

describe("formatNotificationTime — boundary transitions", () => {
  it("exactly 60 s → minutes bucket", () => {
    expect(formatNotificationTime(minus(MIN), NOW)).toBe("1 นาทีที่ผ่านมา");
  });

  it("exactly 60 m → hours bucket", () => {
    expect(formatNotificationTime(minus(HOUR), NOW)).toBe("1 ชม. ที่ผ่านมา");
  });

  it("exactly 24 h → days bucket", () => {
    expect(formatNotificationTime(minus(DAY), NOW)).toBe("1 วันที่ผ่านมา");
  });

  it("just under 7 d stays relative", () => {
    expect(formatNotificationTime(minus(6 * DAY + 23 * HOUR), NOW)).toBe(
      "6 วันที่ผ่านมา"
    );
  });

  it("exactly 7 d switches to absolute Buddhist date", () => {
    const out = formatNotificationTime(minus(7 * DAY), NOW);
    expect(out).not.toContain("ที่ผ่านมา");
    expect(out).toMatch(/\d/);
  });

  it("≥ 7 d emits a Buddhist year ≥ 2569 for our reference date", () => {
    const out = formatNotificationTime(minus(30 * DAY), NOW);
    expect(out).toContain("2569");
  });
});

describe("formatNotificationTime — clock skew", () => {
  it("future timestamps collapse to ‘ตอนนี้’", () => {
    expect(formatNotificationTime(new Date(NOW.getTime() + 5_000), NOW)).toBe(
      "ตอนนี้"
    );
  });
});
