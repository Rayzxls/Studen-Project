// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
  scrubEvent,
  scrubHeaders,
  scrubUrl,
} from "@/lib/observability/sentry-scrub";

describe("Sentry redaction", () => {
  it("strips the signature from a signed file URL", () => {
    // The signature is the access grant, so a report carrying one hands over
    // the private file it points at.
    const signed =
      "https://r2.example.com/private/submission.pdf" +
      "?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Signature=deadbeef&X-Amz-Credential=key%2F20260731";

    const scrubbed = scrubUrl(signed);

    expect(scrubbed).not.toContain("deadbeef");
    expect(scrubbed).toContain("submission.pdf");
    expect(scrubbed).toContain("X-Amz-Algorithm=AWS4-HMAC-SHA256");
  });

  it("strips single-use identity tokens from a link", () => {
    for (const key of ["token", "code", "access_token", "id_token", "state"]) {
      const scrubbed = scrubUrl(
        `https://app.example/verify?${key}=secret-value`
      );
      expect(scrubbed).not.toContain("secret-value");
    }
  });

  it("leaves a URL with nothing sensitive exactly as it was", () => {
    const plain = "https://app.example/teacher/courses/abc/scores?page=2";
    expect(scrubUrl(plain)).toBe(plain);
  });

  it("redacts a value it cannot parse rather than guessing", () => {
    // Parsing against a base would make any string "valid" and forward it
    // verbatim, including user input that merely landed in this field.
    expect(scrubUrl("::: not a url :::")).toBe("[redacted]");
    expect(scrubUrl("hunter2")).toBe("[redacted]");
  });

  it("handles a relative path without inventing a host", () => {
    expect(scrubUrl("/verify-email?token=abc&next=/dashboard")).toBe(
      "/verify-email?token=%5Bredacted%5D&next=%2Fdashboard"
    );
    expect(scrubUrl("/teacher/courses/abc/scores")).toBe(
      "/teacher/courses/abc/scores"
    );
  });

  it("redacts credential-bearing headers case-insensitively", () => {
    const scrubbed = scrubHeaders({
      Cookie: "beagle-session=abc",
      AUTHORIZATION: "Bearer xyz",
      "x-api-key": "k",
      "user-agent": "Mozilla/5.0",
    });

    expect(scrubbed).toEqual({
      Cookie: "[redacted]",
      AUTHORIZATION: "[redacted]",
      "x-api-key": "[redacted]",
      "user-agent": "Mozilla/5.0",
    });
  });

  it("drops the request body and cookies entirely", () => {
    // Form posts here carry passwords, submitted work and real names.
    const event = scrubEvent({
      request: {
        url: "https://app.example/login?token=abc",
        headers: { cookie: "session=1" },
        cookies: { session: "1" },
        data: { password: "hunter2", answer: "a student's work" },
      },
    });

    expect(event.request?.data).toBeUndefined();
    expect(event.request?.cookies).toBeUndefined();
    expect(event.request?.headers).toEqual({ cookie: "[redacted]" });
    expect(event.request?.url).not.toContain("abc");
  });

  it("reduces the reported user to an id", () => {
    const event = scrubEvent({
      user: {
        id: "user-1",
        email: "student@example.com",
        username: "somebody",
        ip_address: "203.0.113.4",
      },
    });

    expect(event.user).toEqual({ id: "user-1" });
  });

  it("keeps nothing when the user has no id", () => {
    const event = scrubEvent({ user: { email: "student@example.com" } });
    expect(event.user).toEqual({});
  });
});
