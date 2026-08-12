"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { RoomState } from "@/lib/meeting/room";

/** Matches the cadence the room was designed around (ADR-0053). */
export const POLL_MS = 3_000;

interface WireRoomState extends Omit<RoomState, "openedAt"> {
  openedAt: string | null;
}

export interface LiveRoom {
  room: RoomState | null;
  busy: boolean;
  error: string | null;
  /** Set only when the popup was blocked, so a link becomes the way in. */
  blockedUrl: string | null;
  /** Teacher: open the period's room and walk in. */
  open: () => void;
  /** Anyone in the course: walk into a room that is already open. */
  join: () => void;
  /**
   * Record presence without going anywhere. For the stage, where connecting is
   * itself the act of entering and there is no tab to open — using `join` here
   * would flash a blank window open and shut.
   */
  markPresent: () => void;
}

/**
 * The live room, as a client sees it (ADR-0053).
 *
 * Shared by the compact card on a course overview and the full room page, so
 * the polling cadence, the heartbeat rules and the popup handling exist once
 * rather than drifting apart in two components.
 *
 * Polls rather than holding a socket, because Vercel functions cannot hold one
 * and three seconds is indistinguishable from immediate to someone waiting for
 * a class to start.
 */
export function useLiveRoom(courseId: string): LiveRoom {
  const [room, setRoom] = useState<RoomState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blockedUrl, setBlockedUrl] = useState<string | null>(null);
  const hasJoined = useRef(false);

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/meeting/course/${courseId}/state`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const wire = (await res.json()) as WireRoomState;
      setRoom({
        ...wire,
        openedAt: wire.openedAt ? new Date(wire.openedAt) : null,
      });
    } catch {
      // A dropped poll is not worth telling anyone about; the next one is
      // three seconds away and the view keeps its last known state.
    }
  }, [courseId]);

  useEffect(() => {
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      void poll();
    };
    // Deferred rather than called in the effect body: the first read still
    // lands within a frame, and the effect itself no longer sets state.
    const first = window.setTimeout(tick, 0);
    const id = window.setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, [poll]);

  const sessionId = room?.sessionId ?? null;

  // Heartbeat. `document.hasFocus()` rather than `visibilityState` because the
  // hollow badge means "looking at something else", which includes another
  // window on top of this one, not only another tab.
  useEffect(() => {
    if (!sessionId) return;

    const beat = () => {
      if (!hasJoined.current) return;
      void fetch(`/api/meeting/session/${sessionId}/heartbeat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ focused: document.hasFocus() }),
        keepalive: true,
      }).catch(() => {
        // Same as the poll: silence is the right response to one lost beat.
      });
    };

    beat();
    const id = window.setInterval(beat, POLL_MS);
    // A hidden tab has its timer throttled to roughly once a minute, so send
    // one immediately on the switch, or the badge lags by up to a minute at
    // exactly the moment it should change.
    document.addEventListener("visibilitychange", beat);
    window.addEventListener("focus", beat);
    window.addEventListener("blur", beat);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", beat);
      window.removeEventListener("focus", beat);
      window.removeEventListener("blur", beat);
    };
  }, [sessionId]);

  const enterRoom = useCallback(
    async (endpoint: string, failure: string) => {
      if (busy) return;
      setBusy(true);
      setError(null);

      // Opened synchronously on the click, because a tab opened after the
      // await is a popup as far as the browser is concerned and gets blocked.
      //
      // No "noopener": that feature makes window.open return null by design,
      // which loses the handle this depends on. The opener link is severed on
      // the child instead, which is the property noopener was wanted for.
      const tab = window.open("", "_blank");
      if (tab) tab.opener = null;

      try {
        const res = await fetch(endpoint, { method: "POST" });
        if (!res.ok) {
          tab?.close();
          setError(failure);
          return;
        }
        const { meetingUrl } = (await res.json()) as {
          meetingUrl: string | null;
        };
        hasJoined.current = true;

        // Null means the stage carries the class: there is nowhere to send
        // anyone, so the speculative tab is closed and they stay in the room
        // they are already looking at.
        if (meetingUrl === null) {
          tab?.close();
          void poll();
          return;
        }

        if (tab) {
          tab.location.href = meetingUrl;
        } else {
          // Popup blocked. Offer the link rather than navigating this tab
          // away: the room is open either way, and pulling someone out of the
          // classroom is worse than asking for one more click.
          setBlockedUrl(meetingUrl);
        }
        void poll();
      } catch {
        tab?.close();
        setError("ทำรายการไม่สำเร็จ กรุณาลองใหม่");
      } finally {
        setBusy(false);
      }
    },
    [busy, poll]
  );

  const markPresent = useCallback(() => {
    if (!sessionId || hasJoined.current) return;
    hasJoined.current = true;
    void fetch(`/api/meeting/session/${sessionId}/join`, { method: "POST" })
      .then(() => poll())
      .catch(() => {
        // Let the next attempt try again rather than stranding the flag.
        hasJoined.current = false;
      });
  }, [sessionId, poll]);

  const open = useCallback(() => {
    void enterRoom(
      `/api/meeting/course/${courseId}/open`,
      "เปิดห้องไม่สำเร็จ กรุณาลองใหม่"
    );
  }, [courseId, enterRoom]);

  const join = useCallback(() => {
    if (!sessionId) return;
    void enterRoom(
      `/api/meeting/session/${sessionId}/join`,
      "เข้าห้องไม่ได้ ห้องอาจถูกปิดไปแล้ว"
    );
  }, [sessionId, enterRoom]);

  return { room, busy, error, blockedUrl, open, join, markPresent };
}
