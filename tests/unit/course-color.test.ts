import { describe, expect, it } from "vitest";
import {
  COURSE_SLOT_COUNT,
  colorsForSlot,
  getCourseGradientForClass,
  getCourseSlot,
  getCourseSlotColors,
  getCourseSlotGradient,
} from "@/lib/theme/course-color";

describe("course-color — slot resolution", () => {
  it("returns a valid slot in [0, 7] for arbitrary class ids", () => {
    for (const id of ["c1", "abc-xyz", "クラス", "ห้องเรียน-1", "00000000"]) {
      const slot = getCourseSlot(id);
      expect(slot).toBeGreaterThanOrEqual(0);
      expect(slot).toBeLessThan(COURSE_SLOT_COUNT);
      expect(Number.isInteger(slot)).toBe(true);
    }
  });

  it("is deterministic — same input maps to the same slot every call", () => {
    const a = getCourseSlot("class-42");
    const b = getCourseSlot("class-42");
    const c = getCourseSlot("class-42");
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it("distributes across most slots for a 100-class sample", () => {
    const counts = new Map<number, number>();
    for (let i = 0; i < 100; i++) {
      const slot = getCourseSlot(`class-${i}`);
      counts.set(slot, (counts.get(slot) ?? 0) + 1);
    }
    // Hash distribution doesn't have to be perfect, but it should hit at
    // least 6 of 8 slots for a sample of 100 — anything less means the
    // hash is broken.
    expect(counts.size).toBeGreaterThanOrEqual(6);
  });
});

describe("course-color — colour surfaces", () => {
  it("returns all three surfaces (bg / bgTinted / text) for every slot", () => {
    for (let slot = 0 as const; slot < COURSE_SLOT_COUNT; slot++) {
      const c = colorsForSlot(slot as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7);
      expect(c.bg).toMatch(/^#[0-9a-f]{6}$/i);
      expect(c.bgTinted).toMatch(/^#[0-9a-f]{6}$/i);
      expect(c.text).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it("getCourseSlotColors(classId) matches colorsForSlot(getCourseSlot(classId))", () => {
    const id = "math-4A-A8K2";
    expect(getCourseSlotColors(id)).toEqual(colorsForSlot(getCourseSlot(id)));
  });

  it("named slots are stable — slot 0 is rose, slot 4 is teal", () => {
    expect(colorsForSlot(0).name).toBe("rose");
    expect(colorsForSlot(4).name).toBe("teal");
    expect(colorsForSlot(7).name).toBe("violet");
  });
});

describe("course-color — gradient mesh", () => {
  it("returns a CSS background string composed of multiple radial gradients", () => {
    const css = getCourseSlotGradient(0);
    expect(css).toContain("radial-gradient");
    // Three radial layers + a base wash = at least 3 occurrences of the
    // gradient keyword.
    expect(css.split("radial-gradient").length - 1).toBeGreaterThanOrEqual(3);
  });

  it("getCourseGradientForClass uses the same slot resolution", () => {
    const id = "abc";
    expect(getCourseGradientForClass(id)).toBe(
      getCourseSlotGradient(getCourseSlot(id))
    );
  });
});
