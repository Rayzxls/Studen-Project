import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GuideTour } from "@/components/guide/guide-tour";
import { GuideTourMount } from "@/components/guide/guide-tour-mount";
import type { TourStep } from "@/lib/guide/tours";

// A fixture rather than a real tour: these cover the engine, and coupling them
// to shipped copy would break every test on a wording change. Real tour content
// is checked separately in guide-tours.test.ts.
const STEPS: readonly TourStep[] = [
  { selector: '[data-guide="alpha"]', title: "หนึ่ง", body: "ขั้นแรก" },
  { selector: '[data-guide="beta"]', title: "สอง", body: "ขั้นที่สอง" },
  { selector: '[data-guide-tab="gamma"]', title: "สาม", body: "ขั้นสุดท้าย" },
];

// jsdom performs no layout, so every element measures 0×0 and the guide would
// treat all of its targets as missing. Give elements a size so the geometry
// paths run.
const originalRect = Element.prototype.getBoundingClientRect;

// React reports "setState during render" as a console error rather than by
// throwing, so a behavioural assertion alone passes straight through it. That
// happened here: finishing from inside a setIndex updater set state on the
// parent mid-render and every test still went green.
let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  Element.prototype.getBoundingClientRect = function (this: Element) {
    return {
      top: 100,
      left: 40,
      width: 200,
      height: 40,
      right: 240,
      bottom: 140,
      x: 40,
      y: 100,
      toJSON: () => ({}),
    } as DOMRect;
  };
  Element.prototype.scrollIntoView = vi.fn();
  // jsdom ships no matchMedia; the guide asks it whether to animate scrolling.
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
});

afterEach(() => {
  // Tear down before asserting, so one failure cannot leave stale targets
  // behind and cascade into the next test.
  const reactComplaints = consoleError.mock.calls.map((args) =>
    args.map(String).join(" ")
  );
  consoleError.mockRestore();

  Element.prototype.getBoundingClientRect = originalRect;
  cleanup();
  // cleanup() unmounts React trees only; these targets are appended by hand.
  document
    .querySelectorAll("[data-guide], [data-guide-tab]")
    .forEach((el) => el.remove());

  expect(reactComplaints).toEqual([]);
});

function mountTargets(options: { withBeta: boolean }) {
  const alpha = document.createElement("nav");
  alpha.setAttribute("data-guide", "alpha");
  document.body.append(alpha);

  if (options.withBeta) {
    const beta = document.createElement("button");
    beta.setAttribute("data-guide", "beta");
    document.body.append(beta);
  }

  const gamma = document.createElement("a");
  gamma.setAttribute("data-guide-tab", "gamma");
  document.body.append(gamma);
}

describe("GuideTour", () => {
  it("walks every present step and reports completion once", async () => {
    mountTargets({ withBeta: true });
    const onFinish = vi.fn();
    render(<GuideTour steps={STEPS} onFinish={onFinish} />);

    await waitFor(() =>
      expect(screen.getByText("ขั้นที่ 1 จาก 3")).toBeInTheDocument()
    );
    expect(screen.getByText("หนึ่ง")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "ถัดไป" }));
    expect(screen.getByText("ขั้นที่ 2 จาก 3")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "ถัดไป" }));
    expect(screen.getByText("ขั้นที่ 3 จาก 3")).toBeInTheDocument();

    // The last step commits rather than advancing into nothing.
    fireEvent.click(screen.getByRole("button", { name: "เริ่มใช้งาน" }));
    expect(onFinish).toHaveBeenCalledOnce();
  });

  it("finishes through its mount wrapper without setting state during render", async () => {
    // Rendering the guide alone cannot surface this: the warning only fires
    // when a render sets state on a *different* component, so the parent that
    // owns the "done" flag has to be in the tree.
    mountTargets({ withBeta: true });
    const markSeen = vi.fn(() => Promise.resolve());
    render(
      <GuideTourMount
        tourId="teacher-course"
        steps={STEPS}
        markSeen={markSeen}
      />
    );

    await waitFor(() =>
      expect(screen.getByText("ขั้นที่ 1 จาก 3")).toBeInTheDocument()
    );
    fireEvent.click(screen.getByRole("button", { name: "ถัดไป" }));
    fireEvent.click(screen.getByRole("button", { name: "ถัดไป" }));
    fireEvent.click(screen.getByRole("button", { name: "เริ่มใช้งาน" }));

    await waitFor(() => expect(markSeen).toHaveBeenCalledOnce());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("advances one step when Enter activates the focused button", async () => {
    // The advance button is autofocused, so the browser activates it on Enter.
    // A document-level Enter handler ran alongside that and skipped a step.
    mountTargets({ withBeta: true });
    render(<GuideTour steps={STEPS} onFinish={vi.fn()} />);

    await waitFor(() =>
      expect(screen.getByText("ขั้นที่ 1 จาก 3")).toBeInTheDocument()
    );

    const advance = screen.getByRole("button", { name: "ถัดไป" });
    fireEvent.keyDown(advance, { key: "Enter", bubbles: true });
    fireEvent.click(advance);

    expect(screen.getByText("ขั้นที่ 2 จาก 3")).toBeInTheDocument();
  });

  it("skips a step whose control is not on the page", async () => {
    // The tab bar is built from feature flags, so a step can point at a control
    // that does not exist for this course. It must not show an empty spotlight.
    mountTargets({ withBeta: false });
    render(<GuideTour steps={STEPS} onFinish={vi.fn()} />);

    await waitFor(() =>
      expect(screen.getByText("ขั้นที่ 1 จาก 2")).toBeInTheDocument()
    );
    fireEvent.click(screen.getByRole("button", { name: "ถัดไป" }));
    expect(screen.getByText("สาม")).toBeInTheDocument();
  });

  it("lets the teacher leave early", async () => {
    mountTargets({ withBeta: true });
    const onFinish = vi.fn();
    render(<GuideTour steps={STEPS} onFinish={onFinish} />);

    await waitFor(() =>
      expect(screen.getByText("ขั้นที่ 1 จาก 3")).toBeInTheDocument()
    );
    fireEvent.click(screen.getByRole("button", { name: "ข้ามคำแนะนำ" }));
    expect(onFinish).toHaveBeenCalledOnce();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
