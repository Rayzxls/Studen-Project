import type { ThemeMode } from "@prisma/client";

export const THEME_STORAGE_KEY = "beagle-theme-mode";

export type ResolvedTheme = "light" | "dark" | "cream";

export function resolveTheme(mode: ThemeMode): ResolvedTheme {
  if (mode === "DARK") return "dark";
  if (mode === "CREAM") return "cream";
  return "light";
}

export function applyThemeMode(mode: ThemeMode) {
  const resolved = resolveTheme(mode);
  document.documentElement.dataset.themeMode = mode.toLowerCase();
  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme =
    resolved === "dark" ? "dark" : "light";
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    // Some locked-down/private browser contexts block storage; theme still applies.
  }
}
