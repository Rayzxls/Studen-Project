import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

import { useStageFullscreen } from "@/components/meeting/use-stage-fullscreen";

/**
 * The stage's fullscreen (ADR-0053).
 *
 * The behaviour worth pinning is the *choice*: ask the browser for the screen
 * where that is possible, and only cover the viewport where it is not. The old
 * code always covered the viewport, which on this app meant covering the page
 * column — `<main>` keeps a transform from `animate-fade-in`'s `both` fill
 * mode, and that makes it the containing block for anything fixed inside it.
 */

function mountedElement(): HTMLDivElement {
  const el = document.createElement("div");
  document.body.appendChild(el);
  return el;
}

/** jsdom has no Fullscreen API, so each test says which one the browser has. */
function withFullscreenElement(el: Element | null) {
  Object.defineProperty(document, "fullscreenElement", {
    value: el,
    configurable: true,
  });
}

afterEach(() => {
  withFullscreenElement(null);
  document.body.innerHTML = "";
  document.body.style.overflow = "";
  vi.restoreAllMocks();
});

describe("the stage asks the browser for the screen", () => {
  it("uses the real Fullscreen API when the browser has one", async () => {
    const el = mountedElement();
    const request = vi.fn(async () => {
      // What a browser does: element into the top layer, then the event.
      withFullscreenElement(el);
      document.dispatchEvent(new Event("fullscreenchange"));
    });
    Object.defineProperty(el, "requestFullscreen", {
      value: request,
      configurable: true,
    });

    const { result } = renderHook(() => useStageFullscreen({ current: el }));
    expect(result.current.active).toBe(false);

    await act(async () => {
      result.current.toggle();
    });

    expect(request).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(result.current.native).toBe(true));
    expect(result.current.active).toBe(true);
    // Nothing to cover: the top layer is already the size of the screen, and a
    // second `fixed inset-0` on top of it would be the trapped one.
    expect(document.body.style.overflow).toBe("");
  });

  it("covers the viewport instead on a browser with no element fullscreen", async () => {
    // iPhone Safari: only a <video> can go fullscreen, never a div.
    const el = mountedElement();
    Object.defineProperty(el, "requestFullscreen", {
      value: undefined,
      configurable: true,
    });

    const { result } = renderHook(() => useStageFullscreen({ current: el }));

    await act(async () => {
      result.current.toggle();
    });

    expect(result.current.active).toBe(true);
    expect(result.current.native).toBe(false);
    // The page must not scroll underneath a cover.
    expect(document.body.style.overflow).toBe("hidden");
  });

  it("falls back when the browser refuses the request", async () => {
    const el = mountedElement();
    Object.defineProperty(el, "requestFullscreen", {
      value: vi.fn(() => Promise.reject(new Error("gesture not counted"))),
      configurable: true,
    });

    const { result } = renderHook(() => useStageFullscreen({ current: el }));

    await act(async () => {
      result.current.toggle();
    });

    // A refusal still has to leave the button having done something.
    await waitFor(() => expect(result.current.active).toBe(true));
    expect(result.current.native).toBe(false);
  });

  it("lets Escape out of the fallback, which has no browser to do it", async () => {
    const el = mountedElement();
    Object.defineProperty(el, "requestFullscreen", {
      value: undefined,
      configurable: true,
    });

    const { result } = renderHook(() => useStageFullscreen({ current: el }));
    await act(async () => {
      result.current.toggle();
    });
    expect(result.current.active).toBe(true);

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });

    expect(result.current.active).toBe(false);
    expect(document.body.style.overflow).toBe("");
  });

  it("follows the browser out of fullscreen rather than the button", async () => {
    // Escape and F11 end native fullscreen without passing through the toggle.
    const el = mountedElement();
    Object.defineProperty(el, "requestFullscreen", {
      value: vi.fn(async () => {
        withFullscreenElement(el);
        document.dispatchEvent(new Event("fullscreenchange"));
      }),
      configurable: true,
    });

    const { result } = renderHook(() => useStageFullscreen({ current: el }));
    await act(async () => {
      result.current.toggle();
    });
    await waitFor(() => expect(result.current.native).toBe(true));

    await act(async () => {
      withFullscreenElement(null);
      document.dispatchEvent(new Event("fullscreenchange"));
    });

    expect(result.current.active).toBe(false);
  });
});
