"use client";

import { useEffect, useRef, useState } from "react";
import { Command } from "cmdk";
import { Check, ChevronsUpDown, Home, Star } from "lucide-react";
import {
  CATEGORY_ORDER,
  classSortKey,
  gradeCategory,
  type GradeCategory,
} from "@/lib/course/category";

export interface ClassOption {
  id: string;
  name: string;
  gradeLevel: string;
}

interface ClassPickerProps {
  classes: ClassOption[];
  recentClassIds: string[];
  homeroomClassId: string | null;
  value: string;
  onChange: (id: string) => void;
  /** Hidden input name for plain form submission. */
  inputName?: string;
  placeholder?: string;
  disabled?: boolean;
}

export function ClassPicker({
  classes,
  recentClassIds,
  homeroomClassId,
  value,
  onChange,
  inputName,
  placeholder = "เลือกห้องเรียน",
  disabled,
}: ClassPickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click + Escape
  useEffect(() => {
    if (!open) return;
    function clickHandler(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function keyHandler(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", clickHandler);
    document.addEventListener("keydown", keyHandler);
    return () => {
      document.removeEventListener("mousedown", clickHandler);
      document.removeEventListener("keydown", keyHandler);
    };
  }, [open]);

  const selected = classes.find((c) => c.id === value);

  // Build groupings
  const recents = recentClassIds
    .map((id) => classes.find((c) => c.id === id))
    .filter((c): c is ClassOption => Boolean(c));

  const byCategory = new Map<GradeCategory, ClassOption[]>();
  for (const c of classes) {
    const cat = gradeCategory(c.gradeLevel);
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(c);
  }
  // Sort each category naturally
  for (const arr of byCategory.values()) {
    arr.sort((a, b) => {
      const ka = classSortKey(a.name);
      const kb = classSortKey(b.name);
      if (ka[0] !== kb[0]) return ka[0] - kb[0];
      return ka[1] - kb[1];
    });
  }

  function handleSelect(id: string) {
    onChange(id);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      {inputName && (
        <input type="hidden" name={inputName} value={value ?? ""} />
      )}

      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="input flex w-full items-center justify-between text-left"
      >
        <span className={selected ? "text-ink" : "text-slate-400"}>
          {selected ? (
            <span className="inline-flex items-center gap-2">
              {selected.name}
              {selected.id === homeroomClassId && (
                <Home
                  className="h-3.5 w-3.5 text-accent"
                  aria-label="homeroom"
                />
              )}
            </span>
          ) : (
            placeholder
          )}
        </span>
        <ChevronsUpDown className="h-4 w-4 flex-shrink-0 text-slate-400" />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1.5 origin-top animate-fade-in overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lift">
          <Command label="ค้นหาห้องเรียน">
            <div className="border-b border-slate-100 p-2">
              <Command.Input
                placeholder='ค้นหา · พิมพ์ "42" หรือ "ม.4"'
                className="input"
                autoFocus
              />
            </div>
            <Command.List className="max-h-72 overflow-y-auto p-1">
              <Command.Empty className="px-3 py-6 text-center text-sm text-ink-soft">
                ไม่พบห้องเรียน
              </Command.Empty>

              {recents.length > 0 && (
                <Command.Group heading="⭐ ใช้บ่อย">
                  {recents.map((c) => (
                    <Command.Item
                      key={`recent-${c.id}`}
                      value={`recent ${c.name} ${c.gradeLevel}`}
                      onSelect={() => handleSelect(c.id)}
                    >
                      <span className="inline-flex items-center gap-2">
                        <Star className="h-3.5 w-3.5 text-amber-500" />
                        {c.name}
                      </span>
                      {value === c.id && (
                        <Check className="h-4 w-4 text-accent" />
                      )}
                    </Command.Item>
                  ))}
                </Command.Group>
              )}

              {CATEGORY_ORDER.map((cat) => {
                const items = byCategory.get(cat);
                if (!items || items.length === 0) return null;
                return (
                  <Command.Group key={cat} heading={cat}>
                    {items.map((c) => (
                      <Command.Item
                        key={c.id}
                        value={`${c.name} ${c.gradeLevel} ${cat}`}
                        onSelect={() => handleSelect(c.id)}
                      >
                        <span className="inline-flex items-center gap-2">
                          {c.name}
                          {c.id === homeroomClassId && (
                            <span className="inline-flex items-center gap-0.5 rounded bg-accent-soft px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                              <Home className="h-2.5 w-2.5" />
                              ประจำชั้น
                            </span>
                          )}
                        </span>
                        {value === c.id && (
                          <Check className="h-4 w-4 text-accent" />
                        )}
                      </Command.Item>
                    ))}
                  </Command.Group>
                );
              })}
            </Command.List>
          </Command>
        </div>
      )}
    </div>
  );
}
