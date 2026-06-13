import type { ThemeMode } from "@prisma/client";

export const THEME_MODES: ThemeMode[] = ["SYSTEM", "DARK", "CREAM"];

export const ACCEPTED_THEME_MODES: ThemeMode[] = [
  "SYSTEM",
  "LIGHT",
  "DARK",
  "CREAM",
];

export const THEME_MODE_LABEL: Record<ThemeMode, string> = {
  SYSTEM: "ตามระบบ",
  LIGHT: "สว่าง",
  DARK: "มืด",
  CREAM: "ครีม",
};
