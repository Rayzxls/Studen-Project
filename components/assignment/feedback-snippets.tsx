"use client";

import { useSyncExternalStore } from "react";
import { BookmarkPlus, X } from "lucide-react";
import {
  addSnippet,
  parseSnippets,
  removeSnippet,
  SNIPPET_MIN_CHARS,
  SNIPPETS_STORAGE_KEY,
} from "@/lib/feedback/snippets";

/**
 * FeedbackSnippets — one-tap reusable feedback phrases for the review
 * panel's return textarea. v1 persists per-browser in localStorage (see
 * lib/feedback/snippets for the rules + the documented sync tradeoff).
 *
 * localStorage is read through useSyncExternalStore: SSR renders the
 * empty snapshot, the client subscribes to both in-app writes and the
 * cross-tab `storage` event, and the snapshot is cached per raw string
 * so referential identity stays stable between reads.
 */

const EMPTY: string[] = [];
let cache: { raw: string | null; list: string[] } = { raw: null, list: EMPTY };
const listeners = new Set<() => void>();

function readSnapshot(): string[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(SNIPPETS_STORAGE_KEY);
  } catch {
    return EMPTY; // Storage blocked (private mode etc.) — degrade quietly.
  }
  if (raw !== cache.raw) {
    cache = { raw, list: parseSnippets(raw) };
  }
  return cache.list;
}

function serverSnapshot(): string[] {
  return EMPTY;
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function writeSnippets(next: string[]): void {
  try {
    localStorage.setItem(SNIPPETS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Best-effort only.
  }
  listeners.forEach((l) => l());
}

export function FeedbackSnippets({
  readDraft,
  writeDraft,
}: {
  /** Current textarea content. */
  readDraft: () => string;
  /** Replace textarea content (parent appends via lib helper). */
  writeDraft: (next: string) => void;
}) {
  const snippets = useSyncExternalStore(
    subscribe,
    readSnapshot,
    serverSnapshot
  );

  return (
    <div className="space-y-1.5">
      {snippets.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {snippets.map((s) => (
            <span
              key={s}
              className="inline-flex max-w-full items-center gap-1 rounded-full bg-black/[0.04] pl-2.5 text-xs text-black/70 ring-1 ring-black/[0.06]"
            >
              <button
                type="button"
                className="max-w-52 truncate py-1 hover:text-black"
                title={s}
                onClick={() => writeDraft(s)}
              >
                {s}
              </button>
              <button
                type="button"
                className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-black/35 hover:bg-black/5 hover:text-red-700"
                aria-label={`ลบข้อความ "${s}"`}
                onClick={() => writeSnippets(removeSnippet(snippets, s))}
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
      )}
      <button
        type="button"
        className="inline-flex items-center gap-1 text-xs text-black/50 hover:text-black"
        onClick={() => writeSnippets(addSnippet(snippets, readDraft()))}
        title={`เก็บข้อความในช่องไว้ใช้ซ้ำ (อย่างน้อย ${SNIPPET_MIN_CHARS} ตัวอักษร)`}
      >
        <BookmarkPlus className="h-3.5 w-3.5" aria-hidden="true" />
        เก็บข้อความนี้ไว้ใช้ซ้ำ
      </button>
    </div>
  );
}
