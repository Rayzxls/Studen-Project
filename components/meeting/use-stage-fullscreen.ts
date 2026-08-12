"use client";

import { useCallback, useEffect, useState, type RefObject } from "react";

/**
 * Real fullscreen for the stage (ADR-0053).
 *
 * `position: fixed; inset: 0` is not fullscreen twice over. It stops at the
 * browser's own chrome, so a shared 1920x1080 screen lands in whatever is left
 * after the tab strip and the address bar — and on this app it did not even
 * manage that: every page's `<main>` carries `animate-fade-in`, whose
 * `both` fill mode leaves `transform: translateY(0)` applied for good, and any
 * transform other than `none` makes that element the containing block for its
 * fixed descendants. "Fullscreen" was therefore the width of the 1480px page
 * column. Every other overlay in this codebase escapes that by portalling to
 * `document.body`; the stage was the one that did not.
 *
 * So: ask the browser for the screen. The Fullscreen API puts the element in
 * the top layer, which is outside the page's layout entirely — no containing
 * block can reach it and no chrome is left to subtract.
 *
 * The fallback matters because iPhone Safari has no element fullscreen at all
 * (only a `<video>` can go fullscreen there, through its own prefixed call).
 * There the caller covers the viewport the old way, portalled to `body` so the
 * containing block above cannot shrink it again.
 */

/** Safari still ships the prefixed names, and iPhone ships neither. */
interface PrefixedElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void> | void;
}

interface PrefixedDocument extends Document {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
}

/** Present on Android Chrome, absent on iOS, and refused on desktop. */
interface OrientationLock {
  lock?: (orientation: "landscape") => Promise<void>;
  unlock?: () => void;
}

function orientationApi(): OrientationLock | null {
  const orientation: unknown = window.screen.orientation;
  if (orientation === null || typeof orientation !== "object") return null;
  return orientation as OrientationLock;
}

export interface StageFullscreen {
  /** Presenting fullscreen by either route — drives the layout. */
  active: boolean;
  /**
   * The browser is holding the element on screen itself, so the caller must
   * *not* also cover the viewport: sizing is the top layer's job now.
   */
  native: boolean;
  toggle: () => void;
}

export function useStageFullscreen(
  ref: RefObject<HTMLElement | null>
): StageFullscreen {
  const [native, setNative] = useState(false);
  const [fallback, setFallback] = useState(false);

  // The browser owns native fullscreen: Escape, F11 and the system chrome all
  // end it without passing through our button, so the flag follows the event
  // rather than the click, or the layout would stay expanded over a page that
  // is no longer fullscreen.
  useEffect(() => {
    const doc = document as PrefixedDocument;
    const sync = () => {
      const current = doc.fullscreenElement ?? doc.webkitFullscreenElement;
      setNative(current !== null && current === ref.current);
    };
    sync();
    doc.addEventListener("fullscreenchange", sync);
    // Safari's own name for the same event; not in the DOM event map.
    doc.addEventListener("webkitfullscreenchange" as "fullscreenchange", sync);
    return () => {
      doc.removeEventListener("fullscreenchange", sync);
      doc.removeEventListener(
        "webkitfullscreenchange" as "fullscreenchange",
        sync
      );
    };
  }, [ref]);

  /**
   * A phone held upright gives a 16:9 share about a fifth of the screen, which
   * is the difference between reading the slide and not. Landscape is the whole
   * point of going fullscreen there.
   *
   * Best effort in the strict sense: desktop rejects the request, iOS has no
   * lock to call, and neither is a reason to refuse fullscreen.
   */
  useEffect(() => {
    if (!native) return;
    const orientation = orientationApi();
    void orientation?.lock?.("landscape").catch(() => {});
    return () => {
      orientation?.unlock?.();
    };
  }, [native]);

  // Native fullscreen answers Escape by itself; the fallback has to.
  useEffect(() => {
    if (!fallback) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFallback(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fallback]);

  // Only the fallback needs this: the top layer already takes the page out of
  // reach, but a viewport cover leaves the page scrolling underneath it.
  useEffect(() => {
    if (!fallback) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [fallback]);

  const toggle = useCallback(() => {
    const element = ref.current as PrefixedElement | null;
    const doc = document as PrefixedDocument;
    const current = doc.fullscreenElement ?? doc.webkitFullscreenElement;

    if (current) {
      const exit =
        doc.exitFullscreen?.bind(doc) ?? doc.webkitExitFullscreen?.bind(doc);
      void Promise.resolve(exit?.()).catch(() => {});
      return;
    }
    if (fallback) {
      setFallback(false);
      return;
    }
    if (!element) return;

    const request =
      element.requestFullscreen?.bind(element) ??
      element.webkitRequestFullscreen?.bind(element);
    // iPhone Safari: nothing to call, so cover the viewport instead.
    if (!request) {
      setFallback(true);
      return;
    }
    // A refusal is the browser declining — a gesture it did not count, or a
    // permissions policy — not a fault. The button still has to do something.
    void Promise.resolve(request()).catch(() => setFallback(true));
  }, [ref, fallback]);

  return { active: native || fallback, native, toggle };
}
