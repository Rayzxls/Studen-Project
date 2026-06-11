"use client";

import { useEffect, useState, useTransition } from "react";
import type { ThemeMode } from "@prisma/client";
import { updateThemeModeAction } from "@/app/profile/actions";
import { THEME_MODE_LABEL, THEME_MODES } from "@/lib/theme/constants";
import { applyThemeMode } from "@/components/theme/theme-utils";

type Density = "full" | "compact";

export function ThemeModeControl({
  initialMode,
  density = "full",
}: {
  initialMode: ThemeMode;
  density?: Density;
}) {
  const [mode, setMode] = useState<ThemeMode>(initialMode);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    applyThemeMode(initialMode);
  }, [initialMode]);

  const choose = (next: ThemeMode) => {
    const previous = mode;
    setMode(next);
    setError(null);
    applyThemeMode(next);

    startTransition(async () => {
      const result = await updateThemeModeAction(next);
      if (result.error || result.fieldErrors?.themeMode) {
        setError(result.error ?? result.fieldErrors?.themeMode ?? null);
        setMode(previous);
        applyThemeMode(previous);
      }
    });
  };

  const isCompact = density === "compact";

  return (
    <div>
      <div
        className={
          "inline-flex rounded-full p-1 dark-ui-soft " +
          (isCompact ? "w-full" : "")
        }
        role="group"
        aria-label="เลือกธีม"
      >
        {THEME_MODES.map((option) => {
          const active = mode === option;
          return (
            <button
              key={option}
              type="button"
              onClick={() => choose(option)}
              disabled={isPending && active}
              aria-pressed={active}
              className={
                "rounded-full font-medium transition-colors " +
                (isCompact
                  ? "min-h-8 flex-1 px-2 text-[11px]"
                  : "min-h-9 px-4 text-xs") +
                " " +
                (active ? "theme-segment-active" : "theme-segment-idle")
              }
            >
              {THEME_MODE_LABEL[option]}
            </button>
          );
        })}
      </div>
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}
