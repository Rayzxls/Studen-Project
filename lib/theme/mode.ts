import type { ThemeMode } from "@prisma/client";
import { db } from "@/lib/db/client";
import { ValidationError } from "@/lib/errors";
import { ACCEPTED_THEME_MODES } from "@/lib/theme/constants";

export function parseThemeMode(value: unknown): ThemeMode {
  if (
    typeof value !== "string" ||
    !ACCEPTED_THEME_MODES.includes(value as ThemeMode)
  ) {
    throw new ValidationError({ themeMode: "โหมดธีมไม่ถูกต้อง" });
  }
  return value as ThemeMode;
}

export async function updateOwnThemeMode({
  userId,
  themeMode,
}: {
  userId: string;
  themeMode: ThemeMode;
}): Promise<void> {
  await db.user.update({
    where: { id: userId },
    data: { themeMode },
  });
}
