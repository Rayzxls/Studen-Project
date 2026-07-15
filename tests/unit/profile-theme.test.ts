import { describe, expect, it } from "vitest";
import { resolveDisplayName } from "@/lib/profile/display-name";
import { ACCEPTED_THEME_MODES, THEME_MODES } from "@/lib/theme/constants";
import { parseThemeMode } from "@/lib/theme/mode";
import {
  applyThemeMode,
  resolveTheme,
  THEME_STORAGE_KEY,
} from "@/components/theme/theme-utils";

describe("resolveDisplayName", () => {
  it("uses display name, then real name, then identifier", () => {
    expect(
      resolveDisplayName({
        displayName: " Ava ",
        realName: "Real Name",
        identifier: "student-1",
      })
    ).toBe("Ava");
    expect(
      resolveDisplayName({
        displayName: " ",
        realName: " Real Name ",
        identifier: "student-1",
      })
    ).toBe("Real Name");
    expect(
      resolveDisplayName({
        displayName: null,
        realName: null,
        identifier: "student-1",
      })
    ).toBe("student-1");
  });
});

describe("theme mode contract", () => {
  it("shows System, Dark, and Cream while still accepting legacy Light", () => {
    expect(THEME_MODES).toEqual(["SYSTEM", "DARK", "CREAM"]);
    expect(ACCEPTED_THEME_MODES).toEqual(["SYSTEM", "LIGHT", "DARK", "CREAM"]);
  });

  it.each(["SYSTEM", "LIGHT", "DARK", "CREAM"] as const)("parses %s", (mode) =>
    expect(parseThemeMode(mode)).toBe(mode)
  );

  it("rejects unknown modes", () => {
    expect(() => parseThemeMode("PURPLE")).toThrow();
    expect(() => parseThemeMode(null)).toThrow();
  });

  it("resolves the four stored modes to three visual themes", () => {
    expect(resolveTheme("SYSTEM")).toBe("light");
    expect(resolveTheme("LIGHT")).toBe("light");
    expect(resolveTheme("DARK")).toBe("dark");
    expect(resolveTheme("CREAM")).toBe("cream");
  });

  it("applies DOM attributes, color scheme, and local storage", () => {
    applyThemeMode("DARK");

    expect(document.documentElement.dataset.themeMode).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("DARK");
  });
});
