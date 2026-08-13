// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  captureMessage: vi.fn(),
  captureException: vi.fn(),
  setVapidDetails: vi.fn(),
  sendNotification: vi.fn(),
  findMany: vi.fn(),
  deleteMany: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({
  captureMessage: mocks.captureMessage,
  captureException: mocks.captureException,
}));

vi.mock("web-push", () => ({
  default: {
    setVapidDetails: mocks.setVapidDetails,
    sendNotification: mocks.sendNotification,
  },
}));

vi.mock("@/lib/db/client", () => ({
  db: {
    webPushSubscription: {
      findMany: mocks.findMany,
      deleteMany: mocks.deleteMany,
    },
  },
}));

const MESSAGE = {
  title: "คณิตศาสตร์",
  body: "มีประกาศใหม่",
  url: "/student/courses/course-1/feed",
};

const SUBSCRIPTION = {
  id: "sub-1",
  endpoint: "https://push.example/abc",
  p256dh: "p256dh",
  auth: "auth",
};

const ORIGINAL = {
  publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  privateKey: process.env.VAPID_PRIVATE_KEY,
  subject: process.env.VAPID_SUBJECT,
};

function configure(): void {
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "public-key";
  process.env.VAPID_PRIVATE_KEY = "private-key";
  process.env.VAPID_SUBJECT = "mailto:admin@beagle.example";
}

function unconfigure(): void {
  delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  delete process.env.VAPID_PRIVATE_KEY;
  delete process.env.VAPID_SUBJECT;
}

/** The module caches its configured state, so each case needs a fresh copy. */
async function loadPush() {
  vi.resetModules();
  return import("@/lib/notification/push");
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findMany.mockResolvedValue([SUBSCRIPTION]);
  mocks.deleteMany.mockResolvedValue({ count: 1 });
  mocks.sendNotification.mockResolvedValue(undefined);
});

afterEach(() => {
  for (const [key, value] of [
    ["NEXT_PUBLIC_VAPID_PUBLIC_KEY", ORIGINAL.publicKey],
    ["VAPID_PRIVATE_KEY", ORIGINAL.privateKey],
    ["VAPID_SUBJECT", ORIGINAL.subject],
  ] as const) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("a deployment with no VAPID pair", () => {
  it("says so instead of looking like nobody was subscribed", async () => {
    unconfigure();
    const { sendPushToUsers } = await loadPush();

    const outcome = await sendPushToUsers(["student-1"], MESSAGE);

    expect(outcome).toEqual({
      sent: 0,
      removed: 0,
      failed: 0,
      configured: false,
    });
    expect(mocks.captureMessage).toHaveBeenCalledWith(
      "web_push_not_configured",
      expect.objectContaining({ level: "warning" })
    );
    // Nothing was attempted, so no subscription is blamed for it.
    expect(mocks.sendNotification).not.toHaveBeenCalled();
    expect(mocks.deleteMany).not.toHaveBeenCalled();
  });

  it("reports the fact once, not once per post", async () => {
    unconfigure();
    const { sendPushToUsers } = await loadPush();

    await sendPushToUsers(["student-1"], MESSAGE);
    await sendPushToUsers(["student-1"], MESSAGE);

    expect(mocks.captureMessage).toHaveBeenCalledTimes(1);
  });
});

describe("a send that the push service rejects", () => {
  it("reports a wrong key pair by status code, never by endpoint", async () => {
    configure();
    mocks.sendNotification.mockRejectedValue({ statusCode: 403 });
    const { sendPushToUsers } = await loadPush();

    const outcome = await sendPushToUsers(["student-1"], MESSAGE);

    expect(outcome).toEqual({
      sent: 0,
      removed: 0,
      failed: 1,
      configured: true,
    });
    const [[name, context]] = mocks.captureMessage.mock.calls;
    expect(name).toBe("web_push_send_failed");
    expect(JSON.stringify(context)).not.toContain(SUBSCRIPTION.endpoint);
    // A rejected key pair is not a dead device — the subscription stays.
    expect(mocks.deleteMany).not.toHaveBeenCalled();
  });

  it("drops a subscription the service says is gone, without reporting it", async () => {
    configure();
    mocks.sendNotification.mockRejectedValue({ statusCode: 410 });
    const { sendPushToUsers } = await loadPush();

    const outcome = await sendPushToUsers(["student-1"], MESSAGE);

    expect(outcome).toEqual({
      sent: 0,
      removed: 1,
      failed: 0,
      configured: true,
    });
    expect(mocks.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["sub-1"] } },
    });
    expect(mocks.captureMessage).not.toHaveBeenCalled();
  });

  it("stays quiet when every send lands", async () => {
    configure();
    const { sendPushToUsers } = await loadPush();

    const outcome = await sendPushToUsers(["student-1"], MESSAGE);

    expect(outcome).toEqual({
      sent: 1,
      removed: 0,
      failed: 0,
      configured: true,
    });
    expect(mocks.captureMessage).not.toHaveBeenCalled();
  });
});

describe("chat previews are a per-device choice", () => {
  it("sends content only to subscriptions that opted into previews", async () => {
    configure();
    mocks.findMany.mockResolvedValue([
      { ...SUBSCRIPTION, id: "preview-on", messagePreviewEnabled: true },
      {
        ...SUBSCRIPTION,
        id: "preview-off",
        endpoint: "https://push.example/private",
        messagePreviewEnabled: false,
      },
    ]);
    const { sendChatPushToUsers } = await loadPush();

    await sendChatPushToUsers(["student-1"], {
      senderName: "Bob Tester",
      messageBody: "ข้อความส่วนตัว",
      url: "/chat/dm-1",
    });

    const payloads = mocks.sendNotification.mock.calls.map((call) =>
      JSON.parse(String(call[1]))
    );
    expect(payloads).toContainEqual({
      title: "Bob Tester",
      body: "ข้อความส่วนตัว",
      url: "/chat/dm-1",
    });
    expect(payloads).toContainEqual({
      title: "ข้อความใหม่",
      body: "แตะเพื่อเปิด Beagle Classroom",
      url: "/chat/dm-1",
    });
  });
});

describe("a VAPID subject the library refuses", () => {
  it("switches push off rather than failing the publishing sweep", async () => {
    configure();
    process.env.VAPID_SUBJECT = "not-a-url";
    mocks.setVapidDetails.mockImplementation(() => {
      throw new Error("Vapid subject is not a url or mailto url");
    });
    const { sendPushToUsers } = await loadPush();

    await expect(
      sendPushToUsers(["student-1"], MESSAGE)
    ).resolves.toMatchObject({ configured: false });
    expect(mocks.captureException).toHaveBeenCalled();
  });
});
