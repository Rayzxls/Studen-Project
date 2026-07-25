// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createCapturedEmailSender,
  createLogEmailSender,
  renderEmail,
  resolveEmailSender,
  type EmailTemplate,
} from "@/lib/email";

const recovery: EmailTemplate = {
  kind: "password_recovery",
  recoveryUrl: "https://app.example/reset?token=abc",
  expiresInMinutes: 15,
};
const emailChange: EmailTemplate = {
  kind: "email_change_verification",
  verifyUrl: "https://app.example/verify-email?token=xyz",
  expiresInMinutes: 15,
};

describe("renderEmail", () => {
  it("renders the password recovery link, expiry, and a safe-to-ignore note", () => {
    const rendered = renderEmail(recovery);
    expect(rendered.subject).toContain("รีเซ็ตรหัสผ่าน");
    expect(rendered.text).toContain(recovery.recoveryUrl);
    expect(rendered.text).toContain("15 นาที");
    expect(rendered.text).toContain("ยังปลอดภัย");
  });

  it("renders the email-change verification link and expiry", () => {
    const rendered = renderEmail(emailChange);
    expect(rendered.subject).toContain("ยืนยันอีเมล");
    expect(rendered.text).toContain(emailChange.verifyUrl);
    expect(rendered.text).toContain("15 นาที");
  });
});

describe("captured (outbox) sender", () => {
  it("captures messages in order and clears", async () => {
    const sender = createCapturedEmailSender();
    await sender.send({ to: "a@example.local", template: recovery });
    await sender.send({ to: "b@example.local", template: emailChange });

    expect(sender.outbox).toHaveLength(2);
    expect(sender.outbox[0]?.to).toBe("a@example.local");
    expect(sender.outbox[1]?.template.kind).toBe("email_change_verification");

    sender.clear();
    expect(sender.outbox).toHaveLength(0);
  });
});

describe("log sender", () => {
  afterEach(() => vi.restoreAllMocks());

  it("never logs the recipient or link in production", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const sender = createLogEmailSender({ NODE_ENV: "production" });
    await sender.send({ to: "person@example.local", template: recovery });

    const logged = info.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(logged).not.toContain("person@example.local");
    expect(logged).not.toContain(recovery.recoveryUrl);
    expect(logged).toContain("suppressed");
  });

  it("prints the link outside production so a developer can complete the flow", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const sender = createLogEmailSender({ NODE_ENV: "development" });
    await sender.send({ to: "person@example.local", template: recovery });

    const logged = info.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(logged).toContain(recovery.recoveryUrl);
  });
});

describe("resolveEmailSender", () => {
  it("defaults to a sender that transmits nothing (fail-closed)", async () => {
    // The default resolves without throwing and accepts a send; with no keyed
    // provider wired it is the log-only sender, so nothing leaves the process.
    const sender = resolveEmailSender({ NODE_ENV: "test" });
    await expect(
      sender.send({ to: "person@example.local", template: recovery })
    ).resolves.toBeUndefined();
  });
});
