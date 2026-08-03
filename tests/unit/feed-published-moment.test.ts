// @vitest-environment node

import { describe, expect, it } from "vitest";

import { feedMomentOf } from "@/lib/feed/moment";

const NOW = new Date("2026-08-03T08:00:00.000Z");
const WRITTEN = new Date("2026-08-03T07:50:00.000Z");

describe("which moment a feed card shows", () => {
  it("dates a published post from when the class could see it", () => {
    // Typed at 14:50 Bangkok, scheduled for 15:00, read at 15:00: the card
    // used to say ten minutes old the instant it landed.
    const published = new Date("2026-08-03T08:00:00.000Z");

    expect(
      feedMomentOf({ sortAt: WRITTEN, publishAt: published }, NOW)
    ).toEqual(published);
  });

  it("keeps the written time while the post is still waiting", () => {
    const later = new Date("2026-08-03T09:00:00.000Z");

    expect(feedMomentOf({ sortAt: WRITTEN, publishAt: later }, NOW)).toEqual(
      WRITTEN
    );
  });

  it("switches over exactly at the publish moment, not a tick after", () => {
    expect(feedMomentOf({ sortAt: WRITTEN, publishAt: NOW }, NOW)).toEqual(NOW);
  });

  it("dates an ordinary post from when it was written", () => {
    expect(feedMomentOf({ sortAt: WRITTEN, publishAt: null }, NOW)).toEqual(
      WRITTEN
    );
    expect(feedMomentOf({ sortAt: WRITTEN }, NOW)).toEqual(WRITTEN);
  });
});
