"use client";

import { useEffect, useState, useTransition } from "react";
import { BellRing } from "lucide-react";

import {
  deletePushSubscriptionAction,
  getMessagePreviewPreferenceAction,
  savePushSubscriptionAction,
  setMessagePreviewPreferenceAction,
} from "@/app/profile/push-actions";

/**
 * Turns phone notifications on or off for this browser (ADR-0047).
 *
 * Permission is asked for here, from a control the person deliberately pressed,
 * rather than on page load. A prompt that appears before anyone knows what the
 * app is gets denied, and a denial is expensive: the browser stops asking and
 * the person has to dig through settings to undo it.
 */

type State =
  | "checking"
  | "unsupported"
  | "unconfigured"
  | "blocked"
  | "off"
  | "on";

/**
 * The VAPID public key travels as base64url; `applicationServerKey` wants the
 * raw bytes. Returned as an ArrayBuffer because a Uint8Array's backing buffer
 * is not necessarily an ArrayBuffer to the type system.
 */
function urlBase64ToBytes(base64: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalised = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(normalised);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes.buffer;
}

export function PushToggle({
  publicKey,
  serverReady,
  chatReady = false,
}: {
  publicKey: string;
  /**
   * Whether the server holds the key pair it needs to actually send.
   *
   * Subscribing needs only the public half, so a deployment missing the
   * private half lets someone switch notifications on, tells them it worked,
   * and then never sends anything. Reported here because the person looking at
   * this switch is the one who would otherwise sit waiting for a phone that
   * cannot buzz.
   */
  serverReady: boolean;
  chatReady?: boolean;
}) {
  const [state, setState] = useState<State>("checking");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [previewEnabled, setPreviewEnabled] = useState(true);
  const [endpoint, setEndpoint] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const resolve = async () => {
      if (!publicKey) return "unconfigured" as const;
      if (
        typeof window === "undefined" ||
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window)
      ) {
        return "unsupported" as const;
      }
      if (Notification.permission === "denied") return "blocked" as const;

      const registration = await navigator.serviceWorker.getRegistration();
      const existing = await registration?.pushManager.getSubscription();
      if (existing) {
        setEndpoint(existing.endpoint);
        if (chatReady) {
          setPreviewEnabled(
            await getMessagePreviewPreferenceAction(existing.endpoint)
          );
        }
      }
      return existing ? ("on" as const) : ("off" as const);
    };

    void resolve().then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, [chatReady, publicKey]);

  const enable = async () => {
    setError(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "blocked" : "off");
        return;
      }

      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToBytes(publicKey),
      });

      const json = subscription.toJSON();
      if (!json.keys?.p256dh || !json.keys.auth) {
        setError("เบราว์เซอร์ไม่ได้ให้กุญแจสำหรับการแจ้งเตือน");
        return;
      }

      startTransition(async () => {
        await savePushSubscriptionAction({
          endpoint: subscription.endpoint,
          p256dh: json.keys!.p256dh!,
          auth: json.keys!.auth!,
          userAgent: navigator.userAgent,
        });
        setEndpoint(subscription.endpoint);
        setPreviewEnabled(true);
        setState("on");
      });
    } catch {
      setError("เปิดการแจ้งเตือนไม่สำเร็จ ลองใหม่อีกครั้ง");
    }
  };

  const disable = async () => {
    setError(null);
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      if (!subscription) {
        setState("off");
        return;
      }
      const { endpoint } = subscription;
      await subscription.unsubscribe();
      startTransition(async () => {
        await deletePushSubscriptionAction(endpoint);
        setEndpoint(null);
        setState("off");
      });
    } catch {
      setError("ปิดการแจ้งเตือนไม่สำเร็จ ลองใหม่อีกครั้ง");
    }
  };

  if (state === "checking") return null;

  if (state === "unconfigured") {
    return (
      <p className="mt-4 text-sm text-ink-mute">
        ระบบยังไม่ได้ตั้งค่าการแจ้งเตือนบนอุปกรณ์ — ติดต่อผู้ดูแลระบบ
      </p>
    );
  }

  if (state === "unsupported") {
    return (
      <p className="mt-4 text-sm text-ink-mute">
        เบราว์เซอร์นี้ไม่รองรับการแจ้งเตือนบนอุปกรณ์ — บน iPhone
        ต้องติดตั้งแอปลงหน้าจอโฮมก่อนถึงจะเปิดได้
      </p>
    );
  }

  if (state === "blocked") {
    return (
      <p className="mt-4 text-sm text-ink-mute">
        คุณเคยปิดการแจ้งเตือนของเว็บนี้ไว้ —
        ต้องไปเปิดใหม่ในการตั้งค่าของเบราว์เซอร์ เพราะระบบขออนุญาตซ้ำไม่ได้แล้ว
      </p>
    );
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-3">
      {!serverReady && (
        <p className="w-full rounded-lg bg-orange-50 px-3 py-2 text-sm text-orange-700">
          เปิดสวิตช์นี้ได้ แต่ตอนนี้เซิร์ฟเวอร์ยังส่งแจ้งเตือนออกไม่ได้ —
          ผู้ดูแลระบบต้องตั้งค่ากุญแจฝั่งเซิร์ฟเวอร์ให้ครบก่อน
        </p>
      )}
      <button
        type="button"
        disabled={pending}
        onClick={state === "on" ? disable : enable}
        className={
          state === "on" ? "btn-secondary btn-sm" : "btn-primary btn-sm"
        }
      >
        <BellRing className="h-4 w-4" aria-hidden="true" />
        {state === "on" ? "ปิดการแจ้งเตือนบนอุปกรณ์นี้" : "เปิดการแจ้งเตือน"}
      </button>
      {state === "on" && (
        <span className="text-sm text-green-700">
          เปิดอยู่บนอุปกรณ์นี้ — เปิดแยกได้ในแต่ละเครื่อง
        </span>
      )}
      {state === "on" && chatReady && endpoint && (
        <label className="flex w-full items-start gap-3 rounded-xl border border-black/[0.06] bg-bg px-3 py-3 text-sm text-ink">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 accent-blue-600"
            checked={previewEnabled}
            disabled={pending}
            onChange={(event) => {
              const next = event.target.checked;
              setPreviewEnabled(next);
              startTransition(async () => {
                await setMessagePreviewPreferenceAction(endpoint, next);
              });
            }}
          />
          <span>
            <strong className="block font-medium">
              แสดงชื่อผู้ส่งและข้อความแชต
            </strong>
            <span className="mt-0.5 block text-xs leading-5 text-ink-mute">
              ปิดได้สำหรับอุปกรณ์นี้ หากไม่ต้องการให้เนื้อหาปรากฏบนหน้าจอล็อก
            </span>
          </span>
        </label>
      )}
      {error && <span className="text-sm text-red-700">{error}</span>}
    </div>
  );
}
