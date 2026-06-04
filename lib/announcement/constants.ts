/**
 * Announcement constants — Phase 7 · P7-3
 * Mirrors lib/material/constants. Title is OPTIONAL per Q4.1 = b.
 */

export const TX_OPTS = { maxWait: 10_000, timeout: 15_000 } as const;

/** Announcement.title — optional, 0..200 (Q4.1 = b · Q12.3). */
export const TITLE_MAX = 200;

/** Announcement.body cap — 0..5000 markdown subset (Q12.2 lock). */
export const BODY_MAX = 5_000;

/** Max link URLs per Announcement (Q12.4 lock). */
export const MAX_LINK_URLS = 5;
export const LINK_URL_MAX = 2_000;

/** Soft-delete reason — Important audit ANNOUNCEMENT_DELETED (Q4.2). */
export const REASON_MIN = 5;
export const REASON_MAX = 500;
