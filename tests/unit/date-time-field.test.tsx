import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DateTimeField } from "@/components/ui/date-time-field";

describe("DateTimeField", () => {
  it("shows an existing value with a Thai, 24-hour summary", () => {
    const { container } = render(
      <DateTimeField name="dueAt" defaultValue="2026-08-01T16:58" />
    );

    expect(screen.getByLabelText("วัน")).toHaveValue("01");
    expect(screen.getByLabelText("เดือน")).toHaveValue("08");
    expect(screen.getByLabelText("ปี")).toHaveValue("2026");
    expect(screen.getByLabelText("ชั่วโมง")).toHaveValue("16");
    expect(screen.getByLabelText("นาที")).toHaveValue("58");
    expect(screen.getByText("1 สิงหาคม 2569 เวลา 16:58 น.")).toBeVisible();
    expect(container.querySelector('input[name="dueAt"]')).toHaveValue(
      "2026-08-01T16:58"
    );
    expect(container.querySelector('input[type="datetime-local"]')).toBeNull();
  });

  it("submits the original datetime-local contract after all parts are chosen", () => {
    const { container } = render(<DateTimeField name="publishAt" />);

    fireEvent.change(screen.getByLabelText("วัน"), {
      target: { value: "15" },
    });
    fireEvent.change(screen.getByLabelText("เดือน"), {
      target: { value: "12" },
    });
    fireEvent.change(screen.getByLabelText("ปี"), {
      target: { value: "2026" },
    });
    fireEvent.change(screen.getByLabelText("ชั่วโมง"), {
      target: { value: "09" },
    });
    fireEvent.change(screen.getByLabelText("นาที"), {
      target: { value: "05" },
    });

    expect(container.querySelector('input[name="publishAt"]')).toHaveValue(
      "2026-12-15T09:05"
    );
    expect(screen.getByText("15 ธันวาคม 2569 เวลา 09:05 น.")).toBeVisible();
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

    fireEvent.change(screen.getByLabelText("นาที"), {
      target: { value: "30" },
    });
    expect(onValueChange).toHaveBeenLastCalledWith("2026-08-01T16:30");

    fireEvent.click(screen.getByRole("button", { name: "ล้าง" }));
    expect(onValueChange).toHaveBeenLastCalledWith("");
    expect(container.querySelector('input[name="closesAt"]')).toHaveValue("");
    expect(screen.getByText("ยังไม่ได้ตั้งวันและเวลา")).toBeVisible();
  });

  it("marks a partially completed optional value as incomplete", () => {
    render(<DateTimeField name="from" />);

    fireEvent.change(screen.getByLabelText("วัน"), {
      target: { value: "01" },
    });

    expect(screen.getByText("กรุณาเลือกวันและเวลาให้ครบ")).toBeVisible();
    expect(screen.getByLabelText("เดือน")).toBeRequired();
  });
});
