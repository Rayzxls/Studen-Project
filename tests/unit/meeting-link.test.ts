// @vitest-environment node

import { describe, expect, it } from "vitest";

import { resolveMeetingLink } from "@/lib/meeting/resolve";
import {
  MeetingUrlSchema,
  OptionalMeetingUrlSchema,
} from "@/lib/meeting/validation";

const COURSE = "https://meet.google.com/course-room";
const SLOT = "https://meet.google.com/lab-room";

describe("which online room a period meets in", () => {
  it("uses the course's standing link when the period has none", () => {
    expect(
      resolveMeetingLink({ slotMeetingUrl: null, courseMeetingUrl: COURSE })
    ).toEqual({ url: COURSE, origin: "COURSE" });
  });

  it("lets a period override the course, for a lab that meets elsewhere", () => {
    expect(
      resolveMeetingLink({ slotMeetingUrl: SLOT, courseMeetingUrl: COURSE })
    ).toEqual({ url: SLOT, origin: "SLOT" });
  });

  it("has no link when neither is set, which is a class in a real room", () => {
    expect(
      resolveMeetingLink({ slotMeetingUrl: null, courseMeetingUrl: null })
    ).toBeNull();
    expect(resolveMeetingLink({})).toBeNull();
  });

  it("treats blank as absent, since a form can store an empty string", () => {
    expect(
      resolveMeetingLink({ slotMeetingUrl: "   ", courseMeetingUrl: COURSE })
    ).toEqual({ url: COURSE, origin: "COURSE" });
    expect(
      resolveMeetingLink({ slotMeetingUrl: "", courseMeetingUrl: "  " })
    ).toBeNull();
  });
});

describe("what counts as a meeting link", () => {
  it("accepts an https link", () => {
    expect(MeetingUrlSchema.safeParse(COURSE).success).toBe(true);
  });

  it("refuses plain http, unlike the general link fields", () => {
    // Announcements accept http because a reader chooses to follow them. This
    // is where a class is told to go, and every real provider serves https.
    expect(
      MeetingUrlSchema.safeParse("http://meet.google.com/room").success
    ).toBe(false);
  });

  it("refuses text that is not a URL at all", () => {
    expect(MeetingUrlSchema.safeParse("meet.google.com/room").success).toBe(
      false
    );
    expect(MeetingUrlSchema.safeParse("ห้องเรียนของครู").success).toBe(false);
  });

  it("reads empty input as no link rather than as an error", () => {
    const parsed = OptionalMeetingUrlSchema.safeParse("");
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data).toBeNull();

    const blank = OptionalMeetingUrlSchema.safeParse("   ");
    expect(blank.success && blank.data).toBeNull();
  });

  it("still refuses a bad link when one is given", () => {
    expect(OptionalMeetingUrlSchema.safeParse("not-a-link").success).toBe(
      false
    );
  });
});
