/**
 * PURE — reusable-feedback snippet list rules (Phase: teacher QoL).
 *
 * The review panel lets a teacher save phrases they type repeatedly when
 * returning work ("ลายมืออ่านยาก...", "ขาดขั้นตอนวิธีทำ") and insert them
 * with one tap. v1 persists per-browser via localStorage — no schema, no
 * cross-device sync (documented tradeoff; a per-teacher table can replace
 * the storage layer later without touching these rules).
 *
 * This module owns only the list semantics so they are unit-testable:
 * trim, length bounds, dedupe, newest-first, capacity cap.
 */

export const SNIPPET_MIN_CHARS = 5;
export const SNIPPET_MAX_CHARS = 200;
export const SNIPPET_MAX_COUNT = 12;

export const SNIPPETS_STORAGE_KEY = "beagle.feedback-snippets.v1";

/** Parse a stored JSON payload defensively — junk in, empty list out. */
export function parseSnippets(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data
      .filter((s): s is string => typeof s === "string")
      .map((s) => s.trim())
      .filter(
        (s) => s.length >= SNIPPET_MIN_CHARS && s.length <= SNIPPET_MAX_CHARS
      )
      .slice(0, SNIPPET_MAX_COUNT);
  } catch {
    return [];
  }
}

/**
 * Add a snippet: trimmed, bounded, deduped (case-sensitive exact match
 * moves to front instead of duplicating), newest first, capped.
 * Returns the original list unchanged when the text is not saveable.
 */
export function addSnippet(list: string[], text: string): string[] {
  const trimmed = text.trim();
  if (
    trimmed.length < SNIPPET_MIN_CHARS ||
    trimmed.length > SNIPPET_MAX_CHARS
  ) {
    return list;
  }
  const without = list.filter((s) => s !== trimmed);
  return [trimmed, ...without].slice(0, SNIPPET_MAX_COUNT);
}

export function removeSnippet(list: string[], text: string): string[] {
  return list.filter((s) => s !== text);
}

/** Append a snippet to the current draft with a sensible separator. */
export function appendToDraft(draft: string, snippet: string): string {
  const base = draft.trimEnd();
  if (!base) return snippet;
  return `${base}\n${snippet}`;
}
