import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/profile/push-actions", () => ({
  savePushSubscriptionAction: vi.fn(),
  deletePushSubscriptionAction: vi.fn(),
}));

import { PushToggle } from "@/components/notification/push-toggle";

/**
 * The switch talks to the browser on mount, so the test stands in for a device
 * that supports push, has not been asked yet, and has no subscription.
 */
beforeEach(() => {
  vi.stubGlobal("Notification", { permission: "default" });
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: {
      getRegistration: vi.fn(async () => ({
        pushManager: { getSubscription: vi.fn(async () => null) },
      })),
    },
  });
  vi.stubGlobal("PushManager", class {});
});

describe("the phone-notification switch", () => {
  it("warns when the server cannot send, instead of promising a buzz", async () => {
    render(<PushToggle publicKey="public-key" serverReady={false} />);

    expect(
      await screen.findByText(/เซิร์ฟเวอร์ยังส่งแจ้งเตือนออกไม่ได้/)
    ).toBeVisible();
    // The switch still works — a subscription made now is used once the keys
    // are in place, so there is no reason to take it away.
    expect(
      screen.getByRole("button", { name: /เปิดการแจ้งเตือน/ })
    ).toBeVisible();
  });

  it("says nothing extra when the server is ready", async () => {
    render(<PushToggle publicKey="public-key" serverReady />);

    expect(
      await screen.findByRole("button", { name: /เปิดการแจ้งเตือน/ })
    ).toBeVisible();
    expect(
      screen.queryByText(/เซิร์ฟเวอร์ยังส่งแจ้งเตือนออกไม่ได้/)
    ).not.toBeInTheDocument();
  });

  it("keeps the existing message when the browser has no key at all", async () => {
    render(<PushToggle publicKey="" serverReady={false} />);

    expect(
      await screen.findByText(/ระบบยังไม่ได้ตั้งค่าการแจ้งเตือนบนอุปกรณ์/)
    ).toBeVisible();
  });
});
