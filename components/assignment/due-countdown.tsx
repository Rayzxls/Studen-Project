"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, RotateCcw, Zap } from "lucide-react";

/**
 * Live countdown hero for the student Assignments page — Phase 12 "งาน
 * cockpit". Ticks every second to the most urgent pending assignment's due
 * time. Client component (the clock lives here); the parent server component
 * picks the item and passes plain props across the RSC boundary.
 *
 * The current time lives in state and is refreshed by the interval — never
 * read from `Date.now()` during render (that would be an impure render). The
 * numeric cells show a placeholder until the first post-mount tick.
 */

type Remaining = { d: number; h: number; m: number; s: number };

function computeRemaining(targetMs: number, nowMs: number): Remaining | null {
  const diff = targetMs - nowMs;
  if (diff <= 0) return null;
  let s = Math.floor(diff / 1000);
  const d = Math.floor(s / 86400);
  s -= d * 86400;
  const h = Math.floor(s / 3600);
  s -= h * 3600;
  const m = Math.floor(s / 60);
  s -= m * 60;
  return { d, h, m, s };
}

const pad = (n: number) => String(n).padStart(2, "0");

export function DueCountdown({
  title,
  href,
  dueAtISO,
  note,
  isReturned,
}: {
  title: string;
  href: string;
  /** Due instant (ISO). null = "ส่งเมื่อพร้อม" (no clock). */
  dueAtISO: string | null;
  note: string;
  isReturned: boolean;
}) {
  const targetMs = dueAtISO ? new Date(dueAtISO).getTime() : null;
  const [nowMs, setNowMs] = useState<number | null>(null);

  useEffect(() => {
    // Kick the first read on the next frame (not synchronously in the effect),
    // then tick every second.
    const raf = requestAnimationFrame(() => setNowMs(Date.now()));
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(id);
    };
  }, []);

  const remaining =
    nowMs !== null && targetMs !== null
      ? computeRemaining(targetMs, nowMs)
      : null;
  const overdue = nowMs !== null && targetMs !== null && targetMs <= nowMs;
  const overdueDays =
    overdue && targetMs !== null && nowMs !== null
      ? Math.max(1, Math.floor((nowMs - targetMs) / 86_400_000))
      : 0;

  return (
    <section className="card-tinted card-tinted-blue overflow-hidden p-5 md:p-6">
      <p className="flex items-center gap-1.5 text-xs font-medium text-blue-700">
        {isReturned ? (
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
        ) : (
          <Zap className="h-3.5 w-3.5" aria-hidden="true" />
        )}
        {isReturned ? "ครูส่งคืนให้แก้ก่อน" : "งานด่วนที่สุด"}
      </p>

      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <Link
            href={href}
            className="text-lg font-semibold text-black hover:text-blue-700 hover:no-underline md:text-xl"
            style={{ letterSpacing: "-0.01em" }}
          >
            {title}
          </Link>
          <p className="mt-1 text-xs text-black/55">{note}</p>
        </div>
        <Link
          href={href}
          className="group inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full bg-blue-500 px-5 text-sm font-medium text-white transition-colors hover:bg-blue-600 hover:no-underline"
        >
          {isReturned ? "แก้แล้วส่งใหม่" : "ทำต่อ"}
          <ArrowRight
            className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </Link>
      </div>

      {targetMs === null ? (
        <p className="mt-4 text-sm text-black/50">
          ไม่มีกำหนดส่ง — ส่งเมื่อพร้อม
        </p>
      ) : overdue ? (
        <p className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700">
          เลยกำหนดมาแล้ว {overdueDays} วัน — รีบส่ง
        </p>
      ) : (
        <div
          className="mt-4 grid grid-cols-4 gap-2"
          aria-label="เวลาที่เหลือก่อนครบกำหนด"
        >
          <CountCell
            value={remaining ? String(remaining.d) : "–"}
            label="วัน"
          />
          <CountCell
            value={remaining ? pad(remaining.h) : "–"}
            label="ชั่วโมง"
          />
          <CountCell value={remaining ? pad(remaining.m) : "–"} label="นาที" />
          <CountCell
            value={remaining ? pad(remaining.s) : "–"}
            label="วินาที"
          />
        </div>
      )}
    </section>
  );
}

function CountCell({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl bg-white/70 px-2 py-2.5 text-center">
      <span
        suppressHydrationWarning
        className="block text-2xl font-semibold leading-none text-blue-700"
        style={{ fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}
      >
        {value}
      </span>
      <span className="mt-1 block text-[10px] text-blue-700/70">{label}</span>
    </div>
  );
}
