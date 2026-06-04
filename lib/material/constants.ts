/**
 * Material constants — Phase 7 · P7-3
 * Mirrors lib/assignment/constants posture (Pattern 3 TX_OPTS).
 */

export const TX_OPTS = { maxWait: 10_000, timeout: 15_000 } as const;

/** Material.title cap — 1..200 (CONTEXT § Material · Q12.3 lock). */
export const TITLE_MAX = 200;
export const TITLE_MIN = 1;

/** Material.body cap — 0..5000 markdown subset (Q12.2 lock). */
export const BODY_MAX = 5_000;

/** Max link URLs per Material (Q12.4 lock). */
export const MAX_LINK_URLS = 5;
export const LINK_URL_MAX = 2_000;

/** Soft-delete reason — Important audit MATERIAL_DELETED on soft-delete (Q4.2). */
export const REASON_MIN = 5;
export const REASON_MAX = 500;
