import { describe, expect, it } from "vitest";
import { formatCountUp } from "@/lib/hooks/use-count-up";

describe("useCountUp / formatCountUp", () => {
  it("rounds and formats with Thai locale grouping", () => {
    expect(formatCountUp(0)).toBe("0");
    expect(formatCountUp(42)).toBe("42");
    expect(formatCountUp(1234)).toBe("1,234");
    expect(formatCountUp(1234567)).toBe("1,234,567");
  });

  it("rounds fractional values to integer", () => {
    expect(formatCountUp(0.4)).toBe("0");
    expect(formatCountUp(0.6)).toBe("1");
    expect(formatCountUp(1234.49)).toBe("1,234");
    expect(formatCountUp(1234.5)).toBe("1,235");
  });

  // Note: useCountUp hook itself is rAF-driven — verified via integration
  // through dashboard pages in Phase 11D. Headless unit test would need a
  // rAF polyfill + fake timers, which is more setup than the hook earns
  // at this stage.
});
