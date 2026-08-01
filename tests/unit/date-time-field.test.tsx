import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DateTimeField } from "@/components/ui/date-time-field";

describe("DateTimeField", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows an existing value in separate compact date and time controls", () => {
    const { container } = render(
      <DateTimeField name="dueAt" defaultValue="2026-08-01T16:58" />
    );

    expect(screen.getByRole("button", { name: "วันที่" })).toHaveTextContent(
      "1 ส.ค. 2569"
    );
    expect(screen.getByRole("button", { name: "เวลา" })).toHaveTextContent(
      "16:58"
    );
    expect(screen.getByText("1 สิงหาคม 2569 เวลา 16:58 น.")).toBeVisible();
    expect(container.querySelector('input[name="dueAt"]')).toHaveValue(
      "2026-08-01T16:58"
    );
    expect(container.querySelectorAll("select")).toHaveLength(0);
    expect(container.querySelector('input[type="date"]')).toBeNull();
    expect(container.querySelector('input[type="datetime-local"]')).toBeNull();
  });

  it("submits the original datetime-local contract after date and time are chosen", () => {
    const { container } = render(<DateTimeField name="publishAt" futureOnly />);

    fireEvent.click(screen.getByRole("button", { name: "วันที่" }));
    fireEvent.click(screen.getByRole("button", { name: "พรุ่งนี้" }));
    fireEvent.click(screen.getByRole("button", { name: "เวลา" }));
    fireEvent.click(screen.getByTestId("time-picker-hour-09"));
    fireEvent.click(screen.getByTestId("time-picker-minute-05"));

    expect(
      (container.querySelector('input[name="publishAt"]') as HTMLInputElement)
        .value
    ).toMatch(/^\d{4}-\d{2}-\d{2}T09:05$/);
  });

  it("uses a compact five-minute grid instead of a 60-row minute list", () => {
    const { container } = render(<DateTimeField name="publishAt" />);

    fireEvent.click(screen.getByRole("button", { name: "เวลา" }));

    expect(
      container.querySelectorAll('[data-testid^="time-picker-minute-"]')
    ).toHaveLength(12);
    expect(screen.getByTestId("time-picker-minute-00")).toBeVisible();
    expect(screen.getByTestId("time-picker-minute-55")).toBeVisible();
  });

  it("keeps both picker panels inside a narrow form without horizontal overflow", () => {
    const { container, unmount } = render(
      <div className="w-72">
        <DateTimeField name="publishAt" futureOnly />
      </div>
    );

    expect(
      container.querySelector('[data-testid="date-time-controls"]')
    ).toHaveClass("grid-cols-1");
    fireEvent.click(screen.getByRole("button", { name: "วันที่" }));
    expect(
      screen.getByRole("dialog", { name: "ปฏิทินเลือกวันที่" })
    ).toHaveClass("w-full", "max-w-xl");

    unmount();
    render(
      <div className="w-72">
        <DateTimeField name="publishAt" futureOnly />
      </div>
    );
    fireEvent.click(screen.getByRole("button", { name: "เวลา" }));
    expect(screen.getByRole("dialog", { name: "เลือกเวลา" })).toHaveClass(
      "w-full",
      "max-w-xl"
    );
  });

  it("reports controlled changes and clears every part", () => {
    const onValueChange = vi.fn();
    const { container } = render(
      <DateTimeField
        name="closesAt"
        value="2026-08-01T16:58"
        onValueChange={onValueChange}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "เวลา" }));
    fireEvent.click(screen.getByTestId("time-picker-minute-30"));
    expect(onValueChange).toHaveBeenLastCalledWith("2026-08-01T16:30");

    fireEvent.click(screen.getByRole("button", { name: "ล้าง" }));
    expect(onValueChange).toHaveBeenLastCalledWith("");
    expect(container.querySelector('input[name="closesAt"]')).toHaveValue("");
    expect(screen.getByText("ยังไม่ได้ตั้งวันและเวลา")).toBeVisible();
  });

  it("marks a partially completed optional value as incomplete", () => {
    render(<DateTimeField name="from" futureOnly />);

    fireEvent.click(screen.getByRole("button", { name: "วันที่" }));
    fireEvent.click(screen.getByRole("button", { name: "พรุ่งนี้" }));

    expect(screen.getByText("กรุณาเลือกวันและเวลาให้ครบ")).toBeVisible();
  });

  it("uses a custom calendar and hides past dates for scheduling fields", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-15T05:00:00.000Z"));
    render(<DateTimeField name="publishAt" futureOnly />);

    expect(screen.getByText("ตั้งแต่ปัจจุบัน")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "วันที่" }));

    expect(
      screen.getByRole("dialog", { name: "ปฏิทินเลือกวันที่" })
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "เดือนก่อนหน้า" })
    ).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: "เลือก 14 สิงหาคม 2569" })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "เลือก 15 สิงหาคม 2569" })
    ).toHaveAttribute("aria-current", "date");
    expect(screen.getByRole("button", { name: "วันนี้" })).toBeVisible();
    expect(screen.getByRole("button", { name: "พรุ่งนี้" })).toBeVisible();
  });

  it("keeps historical filters unrestricted", () => {
    render(<DateTimeField name="from" defaultValue="2020-01-15T08:00" />);

    expect(screen.queryByText("ตั้งแต่ปัจจุบัน")).not.toBeInTheDocument();
    expect(screen.getByText("15 มกราคม 2563 เวลา 08:00 น.")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "วันที่" }));
    expect(screen.getByRole("button", { name: "เดือนก่อนหน้า" })).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "เลือก 1 มกราคม 2563" })
    ).toBeVisible();
  });
});
