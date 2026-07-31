"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

/**
 * Puts the walkthroughs back. Without this a tour is a one-shot, so anyone who
 * skipped past it — or who simply wants the reminder later — would have no way
 * back to it short of a new account.
 */
export function ReplayToursForm({ replay }: { replay: () => Promise<void> }) {
  const router = useRouter();
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await replay();
            setDone(true);
            router.refresh();
          })
        }
        className="btn-secondary btn-sm"
      >
        {pending ? "กำลังเปิดคำแนะนำ..." : "ดูคำแนะนำอีกครั้ง"}
      </button>
      {done && (
        <span className="text-sm text-green-700">
          เปิดแล้ว — กลับไปหน้าแรกหรือเปิดวิชาเพื่อดูคำแนะนำ
        </span>
      )}
    </div>
  );
}
