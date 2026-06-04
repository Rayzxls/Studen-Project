# ADR-0023 — Feed Aggregator: Multi-Query Union at Application Layer · No Denormalized FeedItem Table · Course Feed Tab Deferred to Phase 8

## Status

Accepted — 2026-06-04 (Phase 7 entry)

## Context

CONTEXT.md originally defined two Feed surfaces: a **Course Feed** tab inside each CourseOffering and a **User Feed** section on the dashboard aggregating activity from every CourseOffering the user touches. Phase 7 must decide three things that ADR-0022 (Notification) cannot answer:

1. Where in the UI the feed surfaces actually land.
2. How `lib/feed/aggregator.ts` retrieves the unioned timeline — given that CLAUDE.md § Critical Files marks this file as a privacy boundary ("query ผิด = นักเรียนเห็นข้อมูลคนอื่น").
3. How sort order behaves when source entities can be edited after creation.

### Question 1 — Feed surface scope

- **F1 — Full:** Course Feed tab + User Feed dashboard section + Bell. Adds a 7th tab to teacher course shell and a 6th to student course shell.
- **F2 — Bell only:** No tabs, no dashboard section; the bell dropdown is the feed.
- **F3 — Hybrid:** User Feed on dashboard + Bell in navbar; no per-course Feed tab.

The Phase 6 surface already has Assignment / Material / Announcement as separate per-course tabs (content-type oriented). A per-course Feed tab would aggregate exactly those three tabs into a fourth view, creating an "which tab do I click?" ambiguity for every course interaction.

### Question 2 — Aggregator implementation

The User Feed unions Assignment + Material + Announcement + Score-Published across N courses. Phase 7 must pick a read strategy.

- **R1 — Postgres `UNION ALL`** via `Prisma.sql` parameterized raw query. Pagination is `LIMIT/OFFSET` at the DB layer.
- **R2 — Multi-query merge.** Four `findMany` calls in `Promise.all`, then sort + slice in application code.
- **R3 — Materialized FeedItem table.** Every mutation that produces a feed entry writes a denormalized FeedItem row in the same tx; the read is a single `SELECT * FROM FeedItem`.

Phase 4 § Q11C established the read posture for this kind of aggregation: "query union not denormalised; L1 boundary at the Prisma SELECT layer". HANDOFF.md restates the same rule under Pattern 4. This ADR locks the rule formally for the feed.

### Question 3 — Sort stability when entities are edited

ScoreItem after publish can be edited (ADR-0018 field-class A/B). Material and Announcement permit free post-creation edits (Q4.2). If `sortAt` follows `updatedAt`, every typo fix bumps an entry to the top of every recipient's feed.

## Decision

### 1. Hybrid surface: User Feed on dashboard + Bell in navbar (Q1 → F3)

Phase 7 ships:

- **User Feed dashboard section.** Below the existing role-scoped dashboard KPIs, a "ฟีดล่าสุด" section renders the top 20 feed items aggregated from every active-term CourseOffering the user touches. Infinite scroll adds 20 more on demand.
- **Bell in navbar.** Per ADR-0022. The bell surfaces the notification stream — a superset of feed kinds plus the bell-only kinds (`SUBMISSION_GRADED`, `SUBMISSION_RETURNED`, `COMMENT_REPLIED`, `CLASS_CODE_JOINED`, `SCORE_ENTRY_EDITED`).
- **No per-course Feed tab.** Existing Phase 6 tabs (Assignment / Material / Announcement) remain the per-course content-type surfaces.

F1 was rejected on user-flow grounds. The per-course Feed tab would aggregate the exact three tabs sitting next to it. Teachers grading "the assignments that need attention" want the Assignment tab with its grid; students looking for "the material the teacher uploaded" want the Material tab with its list. A unified feed tab is convenient for *recent* activity, which is exactly what the dashboard User Feed already covers across courses — so the per-course version provides no incremental information not already on the dashboard.

F2 was rejected because the bell is a pull-mode surface for time-sensitive events (got a grade, got a comment reply, deadline-adjacent reminder). The User Feed is a passive scroll surface for "what is happening in my courses lately". Collapsing the two into one loses both jobs — either the bell becomes too noisy with broadcast Material posts, or the feed becomes too focused on personal events.

The Course Feed concept survives in CONTEXT § Feed but is marked **deferred to Phase 8**. The deferral is a real scope cut, not a placeholder: Phase 8 will reopen the question of whether the per-course aggregation is worth a tab once Phase 7 data is in production and we can see how teachers and students actually navigate.

### 2. Multi-query merge — no raw SQL, no materialized table (Q2 → R2)

`lib/feed/aggregator.ts` exposes a single function:

```ts
export async function getUserFeed(
  session: Session,
  cursor?: { sortAt: Date; tieBreakerId: string }
): Promise<FeedPage> {
  const { courseIds } = await getCourseScopeForUser(session);
  if (courseIds.length === 0) return { items: [], nextCursor: null };

  const since = cursor?.sortAt ?? new Date('9999-12-31');
  const limit = 20;

  const [assignments, materials, announcements, scoreItems] = await Promise.all([
    db.assignment.findMany({
      where: { courseOfferingId: { in: courseIds }, createdAt: { lt: since } },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { id: true, courseOfferingId: true, title: true, dueAt: true, createdAt: true, /* L1-safe fields only */ },
    }),
    db.material.findMany({
      where: { courseOfferingId: { in: courseIds }, postedAt: { lt: since }, deletedAt: null },
      orderBy: { postedAt: 'desc' },
      take: limit,
      select: { id: true, courseOfferingId: true, title: true, postedAt: true, /* … */ },
    }),
    db.announcement.findMany({ /* same shape */ }),
    db.scoreItem.findMany({
      where: { courseOfferingId: { in: courseIds }, publishedAt: { not: null, lt: since } },
      orderBy: { publishedAt: 'desc' },
      take: limit,
      select: { id: true, courseOfferingId: true, name: true, publishedAt: true /* not weights, not entries */ },
    }),
  ]);

  const merged = [
    ...assignments.map(a => ({ kind: 'ASSIGNMENT' as const, sortAt: a.createdAt, ...a })),
    ...materials.map(m => ({ kind: 'MATERIAL' as const, sortAt: m.postedAt, ...m })),
    ...announcements.map(a => ({ kind: 'ANNOUNCEMENT' as const, sortAt: a.postedAt, ...a })),
    ...scoreItems.map(s => ({ kind: 'SCORE_PUBLISHED' as const, sortAt: s.publishedAt!, ...s })),
  ].sort((a, b) => b.sortAt.getTime() - a.sortAt.getTime());

  const page = merged.slice(0, limit);
  const next = page.length === limit
    ? { sortAt: page[page.length - 1].sortAt, tieBreakerId: page[page.length - 1].id }
    : null;
  return { items: page, nextCursor: next };
}
```

Three properties matter:

- **Privacy at the Prisma SELECT layer (Pattern 4).** Every `select` is hand-built and lists only L1-safe fields. The ScoreItem branch never returns `entries` or `weight` — the feed entry surfaces "Item X is now visible" without leaking aggregate score data; that lands in the Scores tab where the L1 projection from Phase 5 already handles it.
- **Course scope is computed once.** `getCourseScopeForUser(session)` returns the active-term CourseOffering ids the user has access to (student → active enrollment; teacher → owned courses; admin → no User Feed surface). All four queries filter on the same `courseIds`. Privacy violations would have to bypass this one function.
- **Over-fetch is bounded.** Each branch fetches up to 20; the merge sorts and slices to 20. Worst-case bytes pulled is 4× the displayed payload — at school scale, four parallel Neon queries returning ~20 rows each is ~10 ms wall time. This is well inside the dashboard's render budget.

R1 (raw SQL `UNION ALL`) was rejected on two grounds. First, raw SQL forces manual column hygiene at every SELECT — `select` field lists are no longer type-checked, and the privacy boundary loses its Prisma-enforced guard. Second, the privacy boundary is the entire reason CLAUDE.md singles this file out. Trading type-safety for ~5 ms of latency on a non-critical-path dashboard query is the wrong direction.

R3 (materialized FeedItem table) was rejected as it violates the Phase 4 § Q11C posture and is the kind of denormalization that creates two sources of truth. Every mutation site (createAssignment, createMaterial, createAnnouncement, publishScoreItem) would also write a FeedItem; every edit site (Material body fix) would also have to mirror; every soft-delete (Material delete) would have to cascade. The bookkeeping cost is high, the read-side gain is small (a school's User Feed renders in well under 50 ms with R2), and the consistency hazard is large. The notification table is denormalized precisely because notifications need snapshot semantics (ADR-0022 § 4); the feed has no such need — it reads live entity titles and benefits when teachers fix typos.

### 3. Stable sortAt — feed does not bump on edit (Q3)

`sortAt` is fixed at creation/publish time for all four kinds:

| Kind | sortAt | Stability rationale |
|---|---|---|
| `ASSIGNMENT` | `createdAt` | Stable. Phase 6 Assignment fields are largely fixed post-creation; the few that change (e.g. `submissionClosed` toggle) are flags, not titles. |
| `MATERIAL` | `postedAt` | Stable despite free post-creation edits (Q4.2). A teacher fixing a typo should not bump the post to the top of every student's feed. |
| `ANNOUNCEMENT` | `postedAt` | Same. |
| `SCORE_PUBLISHED` | `publishedAt` | Stable by ADR-0018 (publish is one-way). Class A cosmetic edits and class B `weight`/`fullScore` edits already trigger `SCORE_EDIT_AFTER_PUBLISH` audit + per-student notifications; the feed does not double-surface. |

Pagination uses `(sortAt DESC, id DESC)` as a composite cursor — `id` is the tie-breaker for the rare case of identical `sortAt` (two announcements posted in the same millisecond).

The opposite choice (sortAt = `max(createdAt, updatedAt)`) was considered and rejected for two reasons. First, it makes edits user-visible to recipients in a way that double-surfaces with the per-recipient notification system from ADR-0022 — students would get a `SCORE_ENTRY_EDITED` notification AND see the parent ScoreItem bump on the feed. Second, it lets teachers (intentionally or not) game feed prominence by re-editing old posts; stable sortAt keeps the feed honest.

### 4. Scope query — extracted, reused, L1 gate (Q11.1)

`getCourseScopeForUser` lives in `lib/feed/scope.ts` and is reused by every Phase 7 surface that asks "which courses count for this user":

```ts
export async function getCourseScopeForUser(session: Session): Promise<{
  courseIds: string[];
  role: 'STUDENT' | 'TEACHER';
}> {
  if (session.role === 'STUDENT') {
    const enrollments = await db.enrollment.findMany({
      where: { studentId: session.userId, removedAt: null, courseOffering: { term: { isActive: true } } },
      select: { courseOfferingId: true },
    });
    return { courseIds: enrollments.map(e => e.courseOfferingId), role: 'STUDENT' };
  }
  if (session.role === 'TEACHER') {
    const courses = await db.courseOffering.findMany({
      where: { teacherId: session.userId, term: { isActive: true } },
      select: { id: true },
    });
    return { courseIds: courses.map(c => c.id), role: 'TEACHER' };
  }
  throw new Forbidden('admin_no_feed_surface');
}
```

Both `getUserFeed` and the Due Soon Widget query (CONTEXT § Due Soon Widget) source their `courseIds` here. The function is the single L1 gate — if a teacher loses access to a course (e.g. termination, reassignment), the feed and widget both drop the course's items in the same request cycle. Caching across the request boundary uses RSC dedup (Next 16) — multiple callers in the same render share the result without manual memoization.

### 5. Cross-term scope — active term only (Q11.2)

The feed shows entries only from courses in the **active term**. A student who finished ม.4/2 ปี 2568 and is now in ม.5/2 ปี 2569 does not see Assignment posts from the closed term in their User Feed. The closed term remains accessible through the existing Phase 5 transcript route (`/student/terms/[termId]`), which is the canonical surface for historical scope.

Filtering on `Term.isActive = true` in the scope query is a single JOIN that Prisma resolves through the existing `term` relation. The trade-off is that "active" is a school-administered flag — if a school keeps two terms active simultaneously (unusual but allowed by schema), both contribute. This is acceptable for Phase 7; the school operationally manages term activation.

## Consequences

### Positive

- **Single privacy boundary file.** `getCourseScopeForUser` is the gate; reviewers checking the L1 boundary read one function. Phase 7 integration tests target this file with adversarial cases (removed student, cross-term, cross-teacher).
- **Type safety preserved.** Prisma `select` lists are checked at compile time. Adding a new private field to Material does not silently leak through the feed.
- **Edit-stable feed.** Teachers fix typos without churning every student's timeline. Notifications surface the changes that matter (ADR-0022 § Bulk semantics).
- **Course Feed deferral is honest.** The decision is not "we will build it later"; it is "we will rebuild the question in Phase 8 with production data". Recovering the tab if usage data justifies it is a 1-day task: extend `getUserFeed` with a `courseId?` filter and add a tab pointing at the existing aggregator.
- **R2 scales linearly with course count.** A user in 7 active courses runs 4 queries × `IN (...7 ids...)` — well-indexed at the `courseOfferingId` foreign keys that every Phase 2-6 table already carries.

### Negative

- **Pagination cursor composition is hand-rolled.** `(sortAt, id)` cursor with descending sort across four heterogeneous sources is not a Prisma-native concept. The infinite-scroll boundary handling lives in `getUserFeed` and is the most subtle code in `lib/feed/aggregator.ts`; integration tests for "page 2 stitching" are mandatory in P7-9.
- **Four parallel queries per render.** The User Feed dashboard section is server-rendered on every navigation to `/dashboard`. RSC caching helps repeat visits in the same session; cold visits hit Neon four times. Acceptable at school scale; a problem at multi-school scale.
- **No global "all activity" surface.** Admins cannot see the feed (the scope query throws `Forbidden`). Admin tooling for cross-course visibility is the audit log surface from Phase 1+ and the upcoming Phase 8 admin work.
- **Stable sortAt can hide important updates.** A Material whose body changes from "อ่านบทที่ 1" to "ยกเลิก — ใช้บทที่ 2 แทน" remains at its original feed position. The notification side does not fire for Material body edits either (Q4.2 = Verbose). If this edge case becomes a complaint in production, the answer is to convert "important Material updates" into a new Announcement rather than to start bumping the feed.

### Neutral / accepted

- **No `FEED_VIEWED` audit.** Pattern 10 Verbose. Read access is not user-data-modifying; the audit log stays focused on mutations.
- **Mobile dashboard does the same aggregation.** Performance-equal across device classes; the Tailwind dual-layout pattern (Phase 4 Pattern 13) applies to the feed cards.

## Alternatives considered

| | Surface | Aggregator | sortAt |
|---|---|---|---|
| **Chosen** | Dashboard + Bell (F3) | Multi-query merge (R2) | Stable `createdAt`/`postedAt`/`publishedAt` |
| Rejected | Full F1 — per-course tab redundant with content-type tabs | Raw SQL UNION (R1) — loses Prisma type safety and the L1 SELECT-layer guard | sortAt = `updatedAt` — bumps on edit, double-surfaces with notifications |
| Rejected | Bell only F2 — collapses two different jobs into one | Materialized FeedItem (R3) — violates Phase 4 § Q11C, doubles write paths | |

## Related

- **ADR-0015** — Lazy materialization (no cron). The Due Soon widget that replaces deadline-reminder notifications is rendered through the same scope query.
- **ADR-0018** — Publish is a contract. `sortAt = publishedAt` for SCORE_PUBLISHED relies on publish being one-way.
- **ADR-0022** — Notification fan-out + storage model. Notifications and feed are sibling surfaces over the same event stream — the feed reads from source tables directly, the notification surface reads from the denormalized table with snapshot payloads.
- **CLAUDE.md § Critical Files** — `lib/feed/aggregator.ts` is named explicitly as a privacy boundary. This ADR concentrates the boundary in `getCourseScopeForUser`.
- **HANDOFF.md § Pattern 4** — DB-layer projection for L1 visibility. This ADR is Pattern 4 applied to the feed.
