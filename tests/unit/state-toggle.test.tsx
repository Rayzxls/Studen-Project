import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Mic } from "lucide-react";

import { StateToggle } from "@/components/meeting/state-toggle";

function renderToggle(on: boolean) {
  return render(
    <StateToggle
      on={on}
      onClick={() => {}}
      onLabel="ไมค์เปิด"
      offLabel="ไมค์ปิด"
      actionLabel={on ? "ปิดไมค์" : "เปิดไมค์"}
      icon={<Mic className="h-4 w-4" aria-hidden="true" />}
    />
  );
}

describe("a device toggle in the room", () => {
  it("is green when on and red when off", () => {
    const { container: onNow } = renderToggle(true);
    expect(onNow.innerHTML).toContain("bg-green-50");
    expect(onNow.innerHTML).not.toContain("bg-red-50");

    const { container: offNow } = renderToggle(false);
    expect(offNow.innerHTML).toContain("bg-red-50");
    expect(offNow.innerHTML).not.toContain("bg-green-50");
  });

  it("takes both colours from themed tokens, never a literal", () => {
    // A hard-coded green stays bright green on the dark surface — the same bug
    // class as the amber callouts. Only the -50/-700 steps carry dark values.
    const { container } = renderToggle(true);
    const html = container.innerHTML;
    expect(html).toContain("text-green-700");
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,6}/);
    expect(html).not.toContain("emerald");
  });

  it("shows the state and keeps the verb for a screen reader", () => {
    // Read at a glance the colour and the word should agree; what pressing
    // does belongs in the accessible name, not on the face of the button.
    renderToggle(true);
    expect(screen.getByText("ไมค์เปิด")).toBeDefined();
    expect(screen.getByRole("button", { name: "ปิดไมค์" })).toBeDefined();
  });

  it("reports its state to assistive technology", () => {
    renderToggle(false);
    expect(screen.getByRole("button", { pressed: false })).toBeDefined();
  });
});
