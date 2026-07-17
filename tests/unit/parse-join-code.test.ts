import { describe, expect, it } from "vitest";
import { parseJoinCode } from "@/lib/course/parse-join-code";

describe("parseJoinCode", () => {
  it("accepts the production invite URL and extracts the code", () => {
    expect(
      parseJoinCode("https://studen-project.vercel.app/join?code=ENG43-9VX8F2")
    ).toBe("ENG43-9VX8F2");
  });

  it("accepts a localhost invite URL (dev QR printouts)", () => {
    expect(parseJoinCode("http://localhost:3000/join?code=MATH4A-A8K2")).toBe(
      "MATH4A-A8K2"
    );
  });

  it("uppercases and trims a bare code", () => {
    expect(parseJoinCode("  eng43-9vx8f2  ")).toBe("ENG43-9VX8F2");
  });

  it("rejects a URL that is not a /join link", () => {
    expect(
      parseJoinCode("https://evil.example.com/phish?code=ENG43-9VX8F2")
    ).toBeNull();
    expect(
      parseJoinCode("https://studen-project.vercel.app/login?code=X1234")
    ).toBeNull();
  });

  it("rejects a join URL without a valid code param", () => {
    expect(parseJoinCode("https://studen-project.vercel.app/join")).toBeNull();
    expect(
      parseJoinCode("https://studen-project.vercel.app/join?code=!!bad!!")
    ).toBeNull();
  });

  it("rejects random text, empty input, and malformed URLs", () => {
    expect(parseJoinCode("")).toBeNull();
    expect(parseJoinCode("hello world this is not a code")).toBeNull();
    expect(parseJoinCode("https://")).toBeNull();
  });
});
