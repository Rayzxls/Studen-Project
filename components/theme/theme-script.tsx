import type { ThemeMode } from "@prisma/client";
import { THEME_STORAGE_KEY } from "@/components/theme/theme-utils";

function scriptSource(mode: ThemeMode) {
  return `
(() => {
  const mode = ${JSON.stringify(mode)};
  const storageKey = ${JSON.stringify(THEME_STORAGE_KEY)};
  const allowed = new Set(["SYSTEM", "LIGHT", "DARK", "CREAM"]);
  const nextMode = allowed.has(mode) ? mode : "SYSTEM";
  const resolved = nextMode === "DARK"
    ? "dark"
    : nextMode === "CREAM"
      ? "cream"
      : "light";
  document.documentElement.dataset.themeMode = nextMode.toLowerCase();
  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved === "dark" ? "dark" : "light";
  try {
    window.localStorage.setItem(storageKey, nextMode);
  } catch {}
})();`;
}

export function ThemeScript({ mode }: { mode: ThemeMode }) {
  return (
    <script
      id="beagle-theme-script"
      dangerouslySetInnerHTML={{ __html: scriptSource(mode) }}
    />
  );
}
