// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sentry = vi.hoisted(() => ({
  captureException: vi.fn(() => "event-123"),
  flush: vi.fn(async () => true),
}));

vi.mock("@sentry/nextjs", () => sentry);

import { POST } from "@/app/api/cron/sentry-probe/route";

const originalProbeSecret = process.env.SENTRY_PROBE_SECRET;
const originalSentryDsn = process.env.SENTRY_DSN;

function request(authorization?: string): Request {
  return new Request("https://beagle.example/api/cron/sentry-probe", {
    method: "POST",
    headers: authorization ? { authorization } : undefined,
  });
}

describe("Sentry production probe", () => {
  beforeEach(() => {
    process.env.SENTRY_PROBE_SECRET = "probe-secret";
    process.env.SENTRY_DSN = "https://public@example.ingest.sentry.io/1";
    sentry.captureException.mockClear();
    sentry.flush.mockReset();
    sentry.flush.mockResolvedValue(true);
  });

  afterEach(() => {
    if (originalProbeSecret === undefined)
      delete process.env.SENTRY_PROBE_SECRET;
    else process.env.SENTRY_PROBE_SECRET = originalProbeSecret;

    if (originalSentryDsn === undefined) delete process.env.SENTRY_DSN;
    else process.env.SENTRY_DSN = originalSentryDsn;
  });

  it("fails closed when the scheduler secret is missing", async () => {
    delete process.env.SENTRY_PROBE_SECRET;

    const response = await POST(request());

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "sentry_probe_not_configured",
    });
    expect(sentry.captureException).not.toHaveBeenCalled();
  });

  it("rejects a request without the exact bearer secret", async () => {
    const response = await POST(request("Bearer wrong"));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "unauthorized" });
    expect(sentry.captureException).not.toHaveBeenCalled();
  });

  it("fails clearly when Sentry is not configured", async () => {
    delete process.env.SENTRY_DSN;

    const response = await POST(request("Bearer probe-secret"));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "sentry_not_configured" });
    expect(sentry.captureException).not.toHaveBeenCalled();
  });

  it("captures and flushes the controlled event", async () => {
    const response = await POST(request("Bearer probe-secret"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, eventId: "event-123" });
    expect(sentry.captureException).toHaveBeenCalledWith(
      expect.objectContaining({ message: "beagle_controlled_sentry_probe" }),
      {
        tags: {
          probe: "controlled",
          source: "production_acceptance",
        },
      }
    );
    expect(sentry.flush).toHaveBeenCalledWith(2_000);
  });

  it("does not claim delivery when Sentry does not flush", async () => {
    sentry.flush.mockResolvedValue(false);

    const response = await POST(request("Bearer probe-secret"));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "sentry_delivery_unconfirmed",
      eventId: "event-123",
    });
  });
});
