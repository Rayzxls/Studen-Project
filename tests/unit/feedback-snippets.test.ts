import { describe, expect, it } from "vitest";
import {
  addSnippet,
  appendToDraft,
  parseSnippets,
  removeSnippet,
  SNIPPET_MAX_COUNT,
} from "@/lib/feedback/snippets";

describe("parseSnippets", () => {
  it("returns empty for null, junk JSON, and non-arrays", () => {
    expect(parseSnippets(null)).toEqual([]);
    expect(parseSnippets("not json")).toEqual([]);
    expect(parseSnippets('{"a":1}')).toEqual([]);
  });

  it("keeps only valid strings within length bounds", () => {
    const raw = JSON.stringify([
      "ok เขียนดีมาก",
      "sh",
      42,
      "   ",
      "x".repeat(300),
    ]);
    expect(parseSnippets(raw)).toEqual(["ok เขียนดีมาก"]);
  });
});

describe("addSnippet", () => {
  it("prepends trimmed text", () => {
    expect(addSnippet(["เก่า"], "  เพิ่มเหตุผลข้อ 2  ")).toEqual([
      "เพิ่มเหตุผลข้อ 2",
      "เก่า",
    ]);
  });

  it("rejects too-short and too-long text unchanged", () => {
    const list = ["คงเดิม"];
    expect(addSnippet(list, "สั้น")).toBe(list);
    expect(addSnippet(list, "x".repeat(201))).toBe(list);
  });

  it("moves an exact duplicate to the front instead of duplicating", () => {
    expect(addSnippet(["หนึ่งสองสาม", "อีกอัน"], "อีกอัน")).toEqual([
      "อีกอัน",
      "หนึ่งสองสาม",
    ]);
  });

  it("caps the list size", () => {
    const full = Array.from(
      { length: SNIPPET_MAX_COUNT },
      (_, i) => `ข้อความที่ ${i}`
    );
    const next = addSnippet(full, "ข้อความใหม่ล่าสุด");
    expect(next).toHaveLength(SNIPPET_MAX_COUNT);
    expect(next[0]).toBe("ข้อความใหม่ล่าสุด");
  });
});

describe("removeSnippet / appendToDraft", () => {
  it("removes exact matches only", () => {
    expect(removeSnippet(["หนึ่งสองสาม", "สี่ห้าหก"], "หนึ่งสองสาม")).toEqual([
      "สี่ห้าหก",
    ]);
  });

  it("appends with newline separator, or replaces empty draft", () => {
    expect(appendToDraft("", "ลายมืออ่านยาก")).toBe("ลายมืออ่านยาก");
    expect(appendToDraft("แก้ข้อ 1  ", "ลายมืออ่านยาก")).toBe(
      "แก้ข้อ 1\nลายมืออ่านยาก"
    );
  });
});
