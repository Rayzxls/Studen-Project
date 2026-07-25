// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

import {
  createResendEmailSender,
  resolveEmailSender,
  type EmailMessage,
} from "@/lib/email";

const message: EmailMessage = {
  to: "person@example.local",
  template: {
    kind: "password_recovery",
    recoveryUrl: "https://app.example/reset?token=abc",
    expiresInMinutes: 15,
  },
};

function okFetch() {
  return vi.fn(
    async () => new Response(JSON.stringify({ id: "1" }), { status: 200 })
  );
}

describe("resend sender", () => {
  it("POSTs the rendered message to Resend with the api key and from", async () => {
    const fetchImpl = okFetch();
    const sender = createResendEmailSender({
      apiKey: "re_test_key",
      from: "Beagle <noreply@example.com>",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await sender.send(message);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer re_test_key");
    const body = JSON.parse(init.body as string);
    expect(body.from).toBe("Beagle <noreply@example.com>");
    expect(body.to).toBe("person@example.local");
    expect(body.subject).toContain("รีเซ็ตรหัสผ่าน");
    expect(body.text).toContain("https://app.example/reset?token=abc");
  });

  it("throws a status-only error on a non-2xx response (no link leaked)", async () => {
    const fetchImpl = vi.fn(async () => new Response("nope", { status: 422 }));
    const sender = createResendEmailSender({
      apiKey: "re_test_key",
      from: "Beagle <noreply@example.com>",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await expect(sender.send(message)).rejects.toThrow(
      "resend_send_failed_422"
    );
  });
});

describe("resolveEmailSender selection", () => {
  it("uses Resend only when both key and from are configured", async () => {
    const spy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}", { status: 200 }));

    const configured = resolveEmailSender({
      RESEND_API_KEY: "re_x",
      RESEND_FROM: "Beagle <noreply@example.com>",
    });
    await configured.send(message);
    expect(spy).toHaveBeenCalledTimes(1); // Resend adapter hit the network

    spy.mockClear();

    // Missing RESEND_FROM → falls back to the log-only sender (no network).
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const fallback = resolveEmailSender({
      RESEND_API_KEY: "re_x",
      NODE_ENV: "production",
    });
    await fallback.send(message);
    expect(spy).not.toHaveBeenCalled();

    info.mockRestore();
    spy.mockRestore();
  });
});
