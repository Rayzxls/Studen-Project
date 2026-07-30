import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TeacherSetupGuide } from "@/components/course/teacher-setup-guide";

// jsdom performs no layout, so every element measures 0×0 and the guide would
// treat all of its targets as missing. Give elements a size so the geometry
// paths run.
const originalRect = Element.prototype.getBoundingClientRect;

beforeEach(() => {
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
  Element.prototype.getBoundingClientRect = originalRect;
  cleanup();
  // cleanup() unmounts React trees only; these targets are appended by hand.
  document
    .querySelectorAll("[data-guide], [data-guide-tab]")
    .forEach((el) => el.remove());
});

function mountTargets(options: { withComposer: boolean }) {
  const tabs = document.createElement("nav");
  tabs.setAttribute("data-guide", "course-tabs");
  document.body.append(tabs);

  if (options.withComposer) {
    const composer = document.createElement("button");
    composer.setAttribute("data-guide", "course-composer");
    document.body.append(composer);
  }

  const settingsTab = document.createElement("a");
  settingsTab.setAttribute("data-guide-tab", "settings");
  document.body.append(settingsTab);
}

describe("TeacherSetupGuide", () => {
  it("walks every present step and reports completion once", async () => {
    mountTargets({ withComposer: true });
    const onFinish = vi.fn();
    render(<TeacherSetupGuide onFinish={onFinish} />);

    await waitFor(() =>
      expect(screen.getByText("ขั้นที่ 1 จาก 3")).toBeInTheDocument()
    );
    expect(screen.getByText("ทุกอย่างของวิชาอยู่ในแถบนี้")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "ถัดไป" }));
    expect(screen.getByText("ขั้นที่ 2 จาก 3")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "ถัดไป" }));
    expect(screen.getByText("ขั้นที่ 3 จาก 3")).toBeInTheDocument();

    // The last step commits rather than advancing into nothing.
    fireEvent.click(screen.getByRole("button", { name: "เริ่มใช้งาน" }));
    expect(onFinish).toHaveBeenCalledOnce();
  });

  it("skips a step whose control is not on the page", async () => {
    // The tab bar is built from feature flags, so a step can point at a control
    // that does not exist for this course. It must not show an empty spotlight.
    mountTargets({ withComposer: false });
    render(<TeacherSetupGuide onFinish={vi.fn()} />);

    await waitFor(() =>
      expect(screen.getByText("ขั้นที่ 1 จาก 2")).toBeInTheDocument()
    );
    fireEvent.click(screen.getByRole("button", { name: "ถัดไป" }));
    expect(
      screen.getByText("รหัสเข้าห้องและเวลาเรียนอยู่ในตั้งค่า")
    ).toBeInTheDocument();
  });

  it("lets the teacher leave early", async () => {
    mountTargets({ withComposer: true });
    const onFinish = vi.fn();
    render(<TeacherSetupGuide onFinish={onFinish} />);

    await waitFor(() =>
      expect(screen.getByText("ขั้นที่ 1 จาก 3")).toBeInTheDocument()
    );
    fireEvent.click(screen.getByRole("button", { name: "ข้ามคำแนะนำ" }));
    expect(onFinish).toHaveBeenCalledOnce();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
