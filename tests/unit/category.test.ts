import { describe, it, expect } from "vitest";
import {
  CATEGORY_ORDER,
  classSortKey,
  gradeCategory,
} from "@/lib/course/category";

describe("gradeCategory", () => {
  it("classifies ป.1 – ป.6 as ประถม", () => {
    for (let i = 1; i <= 6; i++) {
      expect(gradeCategory(`ป.${i}`)).toBe("ประถม");
    }
  });

  it("classifies ม.1 – ม.3 as ม.ต้น", () => {
    expect(gradeCategory("ม.1")).toBe("ม.ต้น");
    expect(gradeCategory("ม.2")).toBe("ม.ต้น");
    expect(gradeCategory("ม.3")).toBe("ม.ต้น");
  });

  it("classifies ม.4 – ม.6 as ม.ปลาย", () => {
    expect(gradeCategory("ม.4")).toBe("ม.ปลาย");
    expect(gradeCategory("ม.5")).toBe("ม.ปลาย");
    expect(gradeCategory("ม.6")).toBe("ม.ปลาย");
  });

  it("handles whitespace and missing dot", () => {
    expect(gradeCategory("ป1")).toBe("ประถม");
    expect(gradeCategory(" ม.4 ")).toBe("ม.ปลาย");
    expect(gradeCategory("ม. 6")).toBe("ม.ปลาย");
  });

  it("returns อื่นๆ for unknowns", () => {
    expect(gradeCategory("Kindergarten")).toBe("อื่นๆ");
    expect(gradeCategory("ม.7")).toBe("อื่นๆ");
    expect(gradeCategory("ป.10")).toBe("อื่นๆ");
    expect(gradeCategory("")).toBe("อื่นๆ");
  });
});

describe("CATEGORY_ORDER", () => {
  it("has 4 categories in the expected display order", () => {
    expect(CATEGORY_ORDER).toEqual(["ประถม", "ม.ต้น", "ม.ปลาย", "อื่นๆ"]);
  });
});

describe("classSortKey", () => {
  it("sorts within same grade by section number", () => {
    const k1 = classSortKey("ม.4/2");
    const k2 = classSortKey("ม.4/10");
    expect(k1[0]).toBe(4);
    expect(k1[1]).toBe(2);
    expect(k2[0]).toBe(4);
    expect(k2[1]).toBe(10);
    // numeric sort, not lexicographic
    expect(k1[1] < k2[1]).toBe(true);
  });

  it("falls back gracefully for unusual names", () => {
    const k = classSortKey("Special Class");
    expect(k[0]).toBe(999);
    expect(k[1]).toBe(0);
  });
});
