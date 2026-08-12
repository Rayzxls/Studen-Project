"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { MonitorUp } from "lucide-react";

import type { RoomMediaState } from "@/components/meeting/room-media";
import { SelfPanel } from "@/components/meeting/self-panel";
import type { ComponentProps } from "react";

type SelfPanelProps = ComponentProps<typeof SelfPanel>;

/**
 * The stage, or the hole where it will be (ADR-0053).
 *
 * The LiveKit client is large, so it is behind `dynamic(..., { ssr: false })`
 * and only reached when a room is open and a media server is configured. A
 * course page outside a lesson never downloads it, which is what keeps this
 * inside the bundle budget.
 *
 * Falling back is deliberate rather than an error path. With no media server
 * configured — or if the stage cannot connect — the room keeps working and
 * joining still leaves for the course's meeting link. Nothing about opening a
 * room, telling the class or the roster depends on any of this.
 */
const StageLive = dynamic(
  () => import("@/components/meeting/stage-live").then((m) => m.StageLive),
  {
    ssr: false,
    loading: () => (
      <div className="card grid min-h-72 place-items-center p-8 text-sm text-ink-mute">
        กำลังโหลดหน้าจอ…
      </div>
    ),
  }
);

export function Stage({
  sessionId,
  enabled,
  onMediaChange,
  onConnected,
  selfPanel,
  chatContainer,
}: {
  sessionId: string | null;
  enabled: boolean;
  onMediaChange?: (state: RoomMediaState) => void;
  onConnected?: () => void;
  /** Rendered inside the connection, so the device controls can reach it. */
  selfPanel: SelfPanelProps;
  chatContainer?: HTMLElement | null;
}) {
  const [unavailable, setUnavailable] = useState(false);

  if (enabled && sessionId && !unavailable) {
    return (
      <StageLive
        sessionId={sessionId}
        onUnavailable={() => setUnavailable(true)}
        onMediaChange={onMediaChange}
        onConnected={onConnected}
        selfPanel={selfPanel}
        chatContainer={chatContainer}
      />
    );
  }

  // The panel still belongs on screen when the stage is not carrying the
  // class; it simply has no microphone to offer.
  return (
    <>
      <StagePlaceholder reason={unavailable ? "failed" : "off"} />
      <SelfPanel {...selfPanel} />
    </>
  );
}

/**
 * Says what it is rather than pretending to be a video that failed to load. A
 * placeholder that looks broken teaches people the product is broken.
 */
function StagePlaceholder({ reason }: { reason: "off" | "failed" }) {
  return (
    <div className="card grid min-h-72 place-items-center border-dashed p-8 text-center">
      <div>
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-blue-50 text-blue-700">
          <MonitorUp className="h-5 w-5" aria-hidden="true" />
        </span>
        <p className="mt-4 text-base font-medium text-ink">
          {reason === "failed"
            ? "เชื่อมต่อหน้าจอไม่ได้"
            : "การแชร์หน้าจอจะขึ้นตรงนี้"}
        </p>
        <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-ink-mute">
          เสียงและภาพยังใช้ห้องประชุมเดิมได้ตามปกติ —
          กดปุ่มด้านล่างเพื่อเข้าห้อง
        </p>
      </div>
    </div>
  );
}
