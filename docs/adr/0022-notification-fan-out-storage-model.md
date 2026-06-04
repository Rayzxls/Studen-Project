# ADR-0022 — Notification Fan-out + Storage Model: Row-per-Recipient · In-tx Delivery · Partial-Unique Dedup · Snapshot Payload · Soft Suppress

## Status

Accepted — 2026-06-04 (Phase 7 entry)

## Context

Phase 7 introduces the first cross-cutting reactive surface in the project: a Bell dropdown in the navbar plus a User Feed section on the dashboard. CONTEXT.md § Notification Trigger lists seven event types from prior phases (Score Item published, Score Entry edited after publish, Assignment created, Assignment graded/returned, Comment added, Deadline 24h before, Class Code joined). Each of these triggers fans out to a recipient set ranging from a single student (private grade) to every active enrollment in a CourseOffering (broadcast publish).

Five sub-decisions need to interlock — picking the wrong combination opens a spam vector (catastrophic class-wide comment fan-out), a silent-drop window (publish succeeds but notification never lands), a duplicate-on-retry hazard (server action double-submit producing 80 rows instead of 40), a stale-data UX (entity edited after fan-out leaves bell with wrong title), or a privacy bug (removed student keeps seeing notifications from a course they were removed from).

### Question 1 — Storage shape

- **S1 — Fan-out rows.** One `Notification` row per (recipient × event). 40-student broadcast = 40 INSERTs.
- **S2 — Broadcast row + ReadReceipt table.** One row per event with a derived recipient set; per-user `readAt` lives in a join table.
- **S3 — Hybrid:** S1 for private events, S2 for broadcast.

S2 forces a hybrid the moment private events (graded, returned, private comment) arrive — they have a single recipient and no broadcast semantic. S3 codifies the hybrid but doubles the query path and the test surface.

### Question 2 — Fan-out atomicity vs the originating mutation

- **A1 — In-tx fan-out.** `publishScoreItem` opens `$transaction(...)` and the recipient list query + `notification.createMany` run before commit. Failure rolls back the publish.
- **A2 — Post-commit fire-and-forget.** Mutation tx commits first; fan-out runs via `queueMicrotask` after commit.
- **A3 — Transactional outbox.** Mutation tx writes an outbox row; a separate consumer materializes notifications.

A3 requires a cron or queue worker — out of scope per ADR-0015 (no cron). A2 introduces a silent-drop window on Vercel serverless instance death between commit and microtask flush.

### Question 3 — Dedup posture (idempotency)

- **D1 — Application-layer only.** Trust tx atomicity; rely on Server Action token (Next.js form has none built-in) to suppress double-submit retries.
- **D2 — Full unique constraint.** `UNIQUE(recipientId, kind, sourceEntityType, sourceEntityId)` — but this breaks repeatable events (`SCORE_ENTRY_EDITED` fires N times across N days for the same item).
- **D3 — Hybrid partial unique.** Constraint applies only to "post-once" kinds; repeatable kinds get no constraint.

### Question 4 — Payload shape (snapshot vs reference)

- **P1 — Reference only.** `payloadJson = {sourceEntityId}`; LEFT JOIN at render time to get title/postedByName.
- **P2 — Snapshot.** `payloadJson = {title, postedByName, courseName, ...}` captured at fan-out time. Entity edits do not propagate.

### Question 5 — Lifecycle on enrollment removal + entity soft-delete

When a student is removed from a course (ADR-0013 soft-delete `Enrollment.removedAt`), the bell could keep surfacing notifications from that course — bell badge ticks but every click leads to 403. When a Material is soft-deleted, the bell preview still shows a working snapshot but click yields a "not found" entity.

- **L1 — Persist.** Notification rows are independent of enrollment/entity lifecycle. UI handles dead-end clicks gracefully.
- **L2 — Hard delete cascade.** Remove notification rows when the source goes away.
- **L3 — Soft suppress.** Set `suppressedAt`; row preserved, bell filters by `suppressedAt IS NULL`.

## Decision

### 1. Fan-out rows — one row per recipient (Q1 → S1)

```prisma
model Notification {
  id                String   @id @default(cuid())
  recipientId       String
  kind              NotificationKind
  sourceEntityType  NotifEntityType
  sourceEntityId    String
  payloadJson       Json
  courseOfferingId  String?
  readAt            DateTime?
  suppressedAt      DateTime?
  createdAt         DateTime @default(now())

  recipient User @relation(...)

  @@index([recipientId, readAt, createdAt(sort: Desc)])
  @@index([recipientId, courseOfferingId, suppressedAt])
}

enum NotificationKind {
  SCORE_ITEM_PUBLISHED
  SCORE_ENTRY_EDITED
  ASSIGNMENT_POSTED
  MATERIAL_POSTED
  ANNOUNCEMENT_POSTED
  SUBMISSION_GRADED
  SUBMISSION_RETURNED
  COMMENT_REPLIED
  CLASS_CODE_JOINED
}

enum NotifEntityType {
  SCORE_ITEM
  ASSIGNMENT
  MATERIAL
  ANNOUNCEMENT
  SUBMISSION
  COMMENT
  ENROLLMENT
}
```

S1 collapses private and broadcast into one shape. The bell query for a user is a flat scan: `WHERE recipientId = me AND suppressedAt IS NULL ORDER BY createdAt DESC LIMIT 20`. Badge count is `count(*) WHERE recipientId = me AND readAt IS NULL AND suppressedAt IS NULL`. The compound index `(recipientId, readAt, createdAt DESC)` covers both queries.

S2 was rejected because it forces a hybrid the moment `SUBMISSION_GRADED` arrives — single-recipient events have no broadcast meaning, and a Materialized recipient set table is precisely the denormalization that ADR-0023 forbids for the feed. S3 codifies the hybrid but doubles the read path (one query for broadcast, one for private) and the test matrix.

Scale check: a school running 50 active courses × ~58 events/term × 40 recipients × 2 terms/year ≈ 232,000 rows/year. At ~1 KB/row that is 232 MB/year — Postgres handles this with a single B-tree index without strain through Phase 9.

### 2. In-tx fan-out — Pattern 2 extended to notifications (Q2 → A1)

Every fan-out happens inside the same `$transaction` as the originating mutation. The pattern, in code:

```ts
await db.$transaction(async (tx) => {
  // 1. authz (Pattern 1)
  const item = await tx.scoreItem.findUnique({...});
  if (item.publishedAt) throw new Conflict("already_published");

  // 2. mutation
  const updated = await tx.scoreItem.update({where: {id}, data: {publishedAt: new Date()}});

  // 3. audit (Pattern 2)
  await audit({event: "SCORE_ITEM_PUBLISHED", actorId, courseOfferingId, ...}, tx);

  // 4. fan-out (this ADR)
  const recipients = await tx.enrollment.findMany({
    where: {courseOfferingId, removedAt: null},
    select: {studentId: true},
  });
  await tx.notification.createMany({
    data: recipients.map(r => ({
      recipientId: r.studentId,
      kind: "SCORE_ITEM_PUBLISHED",
      sourceEntityType: "SCORE_ITEM",
      sourceEntityId: item.id,
      courseOfferingId,
      payloadJson: {
        courseName: course.name,
        itemName: item.name,
        publishedAt: updated.publishedAt,
      },
    })),
    skipDuplicates: true, // honors § 3 partial unique
  });
}, TX_OPTS);
```

A1 inherits the Pattern 2 posture established in Phase 2-6 (authz + audit inside tx). The reasoning chain: an unaudited mutation is unobservable to admins; an unfanned-out mutation is unobservable to recipients. Both are forms of silent state divergence, and the project has consistently chosen to rollback rather than risk silent divergence.

Tx duration at school scale: the worst real case is `createAssignment` with `is_scored=true` in a 50-student class — that opens a tx with (1) authz check, (2) Assignment insert, (3) ScoreItem insert (Phase 6 atomic coupling per ADR-0019), (4) `ASSIGNMENT_CREATED` audit, (5) 50 Notification rows. Postgres on Neon Singapore commits this in roughly 80 ms cold, 30 ms warm. Pattern 3 `TX_OPTS = {maxWait: 10_000, timeout: 15_000}` retains the existing margin.

A2 was rejected for two reasons. First, Vercel serverless instances can die between `await commit` and the queued microtask; the resulting silent drop is the exact failure mode the audit posture was built to prevent. Second, "post-commit hook" introduces a third code path alongside the in-tx Pattern 2 path and the lib-PURE Pattern, raising the maintenance cost of every mutation site for the rest of the project. A3 (outbox + consumer) is the textbook reliable choice but requires infrastructure (Vercel Cron or a queue worker) that ADR-0015 explicitly excludes; the school-scale traffic does not justify standing it up.

### 3. Hybrid partial unique — dedup the post-once kinds (Q3 → D3)

A raw SQL migration (Prisma's `@@unique` does not support `WHERE`) creates a partial unique index:

```sql
CREATE UNIQUE INDEX notification_post_once
  ON "Notification"("recipientId", "kind", "sourceEntityType", "sourceEntityId")
  WHERE "kind" IN (
    'SCORE_ITEM_PUBLISHED',
    'ASSIGNMENT_POSTED',
    'MATERIAL_POSTED',
    'ANNOUNCEMENT_POSTED',
    'SUBMISSION_GRADED',
    'SUBMISSION_RETURNED',
    'CLASS_CODE_JOINED'
  );
```

`createMany({skipDuplicates: true})` then becomes idempotent for the post-once kinds: a server action double-submit (student gestures, network glitch) inserts 40 rows the first time and 0 rows the second. The repeatable kinds (`SCORE_ENTRY_EDITED`, `COMMENT_REPLIED`) sit outside the partial index because legitimate repetition is part of their semantic — a teacher who bulk-edits the same ScoreItem twice in a term must notify affected students both times.

D2 (full unique on all kinds) was rejected because it silently swallows the second `SCORE_ENTRY_EDITED` and the second `COMMENT_REPLIED`, which are exactly the events whose repeatability is the point. D1 (application-only dedup) leaves the retry hazard intact at the storage layer; correctness depends on every mutation site implementing its own token, and the project does not have a Server Action idempotency token in Phase 7.

### 4. Snapshot payload — capture at fan-out, don't JOIN at render (Q4 → P2)

`payloadJson` carries everything the bell row needs to render without joining the source table:

```jsonc
// SCORE_ITEM_PUBLISHED
{ "courseName": "คณิตศาสตร์ ม.4", "itemName": "สอบกลางภาค", "publishedAt": "2026-06-04T03:00:00Z" }

// SUBMISSION_GRADED
{ "courseName": "คณิตศาสตร์ ม.4", "assignmentTitle": "การบ้านบทที่ 3", "graderName": "ครูสมชาย" }

// COMMENT_REPLIED
{ "courseName": "คณิตศาสตร์ ม.4", "entityKind": "ASSIGNMENT", "entityTitle": "การบ้านบทที่ 3", "commenterName": "นักเรียน A", "commentExcerpt": "ขออธิบายข้อ 4 อีกครั้ง..." }
```

The bell dropdown reads `Notification` and renders directly from `payloadJson` — no LEFT JOIN to Material/Announcement/ScoreItem at render. This matters at three points:

- **Latency**: bell dropdown is on the navbar and renders on every navigation; eliminating the JOIN is a measurable wins on cold Neon connections.
- **Dead entities**: if an Announcement is soft-deleted between fan-out and render, the snapshot still reads correctly. The user sees the title and clicks through to a "(ลบแล้ว)" placeholder — graceful, not a 500.
- **Edit churn**: ADR-0022 explicitly accepts that bell preview can drift from current entity state. The trade is that bell rows are immutable post-insert, which simplifies caching and removes a class of write amplification (every Material body edit would otherwise need to update N notification rows).

The drift is bounded by Q5.3 / § Comment edit window (5-min author edit, after which the comment is immutable anyway) and by the Q4.2 decision that Material/Announcement edits do not audit and are not user-facing notifications — only the original POSTED event is.

### 5. Soft suppress — preserve rows, hide from bell (Q5 → L3)

`suppressedAt` is set in three situations, all in-tx with the originating mutation:

1. **`removeMember`** (ADR-0013 soft-delete enrollment):
   ```sql
   UPDATE "Notification"
      SET "suppressedAt" = NOW()
    WHERE "recipientId" = $1
      AND "courseOfferingId" = $2
      AND "suppressedAt" IS NULL
   ```
   The compound index `(recipientId, courseOfferingId, suppressedAt)` makes this a targeted scan.

2. **`restoreByRejoin`** (ADR-0013 auto-restore): in the same tx that flips `Enrollment.removedAt = null`, re-clear `suppressedAt`:
   ```sql
   UPDATE "Notification"
      SET "suppressedAt" = NULL
    WHERE "recipientId" = $1 AND "courseOfferingId" = $2
   ```

3. **Entity soft-delete cascade** for Material / Announcement / ScoreItem:
   ```sql
   UPDATE "Notification"
      SET "suppressedAt" = NOW()
    WHERE "sourceEntityType" = $1
      AND "sourceEntityId" = $2
   ```

Comment soft-delete is the explicit exception (Q13.5). Notification snapshots carry the comment excerpt verbatim; suppressing on comment delete would punish the recipient for a moderator action they had nothing to do with. The bell row stays; clicking through shows the Phase 6 "(ข้อความถูกลบ)" placeholder, which already exists.

L1 (persist with dead-end clicks) was rejected as a UX bug factory — bell badge ticks, user clicks, 403/404. L2 (hard delete cascade) was rejected because it destroys audit trace of what was sent; rejoining a course (which the system supports) becomes a black hole for the prior course's history.

### 6. Read state (Q10 — companion decision)

- `readAt` set by explicit user action only: click on a notification row, or use the "Mark all read" button.
- Opening the bell dropdown does **not** mark anything read — the dropdown is a preview surface, not a consumption surface.
- Mark-all-read scope is global across all of the user's notifications (not per-course).
- Server action `markNotificationRead(id)` and `markAllNotificationsRead()` revalidate the bell on the next render via Next 16 RSC cache.
- No audit fires on read (Pattern 10 Verbose — both `NOTIFICATION_DELIVERED` and `NOTIFICATION_READ` are explicitly not logged).

### 7. Deadline reminders are not events (companion to ADR-0015)

CONTEXT § Notification Trigger originally listed "Deadline 24h before → นักเรียนที่ยังไม่ส่ง". This trigger is now removed from the Notification kind enum. The reasoning chain: a deadline-relative reminder requires either a cron job firing at T-24h (which ADR-0015 excludes) or a lazy-on-render materialization that fires on the next dashboard load (which loses the entire value of a reminder for any user who does not open the app between the trigger window and the deadline). A "Due Soon" widget on the Student dashboard (state-derived `WHERE dueAt BETWEEN now AND now+24h AND submissionStatus IN {NOT_SUBMITTED, DRAFT}`) replaces the notification semantic with a render-time list. The list is recomputed every dashboard render — no cron, no row materialization, no missed-trigger window.

This is documented in CONTEXT § Due Soon Widget. The notification surface stays event-driven; the deadline surface stays state-derived. The two surfaces serve different jobs.

### 8. Recipient snapshot (Q8.2 companion)

The recipient list is captured at fan-out time, not at delivery time. A student who joins a course five minutes after `publishScoreItem` does not retroactively receive a `SCORE_ITEM_PUBLISHED` notification; they will see the item on their Scores tab the moment they navigate there, which is the canonical surface for scores. This avoids re-fan-out logic at enrollment time, keeps the join site (enrollByClassCode) simpler, and matches the snapshot-payload posture from § 4.

## Consequences

### Positive

- **Single shape, single query path.** Bell renders a flat `Notification` table; no UNION of broadcast + private; no LEFT JOIN to source tables; no per-kind branching in the read path.
- **Pattern 2 generalizes cleanly.** Fan-out is a third in-tx step alongside mutation + audit. Every mutation that produces notifications has the same shape, which keeps the maintenance surface small.
- **Retry-safe by construction.** Partial unique + `skipDuplicates` neutralizes server action double-submit for the seven post-once kinds at the storage layer.
- **Lifecycle is governable from the source mutation.** `removeMember` clears its own notifications; entity deletes clear theirs. There is no orphan-collection job and no eventually-consistent gap.
- **Bell preview is immutable post-insert.** This eliminates a class of write amplification (entity edits do not propagate) and simplifies CDN/RSC caching at the bell layer.

### Negative

- **Storage scales linearly with recipients.** A 40-student broadcast writes 40 rows. At school scale (~232K rows/year) this is fine; at multi-school scale it would warrant revisiting either S2 or a partitioning strategy.
- **In-tx fan-out makes the publish tx longer.** Worst case ~80 ms cold on Neon; well inside Pattern 3 `TX_OPTS`, but means a 200-student "school assembly" Announcement (which we do not have in scope) would push the tx into the half-second range. If that use case ever lands, fan-out batching becomes the first revisit.
- **Snapshot drift is permanent.** A teacher who renames a Material after posting will see the old title in old bell rows. This is acceptable in exchange for the immutability win — but it is a visible artifact.
- **Partial unique requires raw SQL.** Prisma's migration model cannot express it directly; the migration ships with a hand-written `CREATE UNIQUE INDEX` block in the `_init` SQL. Future schema reviews must remember to keep that block in sync if kinds are added or moved between post-once and repeatable.
- **Restore-by-rejoin un-suppress is broad.** Re-clearing `suppressedAt` for the entire course restores notifications that may have been suppressed for other reasons too. In practice the only other suppression source is entity soft-delete, and a student rejoining wants to see those too (the bell links to deleted-placeholder UI which is the correct behavior). The risk is theoretical for Phase 7; flag for review if a third suppression trigger lands.

### Neutral / accepted

- **No notification audit events.** Both `NOTIFICATION_DELIVERED` and `NOTIFICATION_READ` are Verbose tier and are not logged. Audit Pattern 10 already treats high-volume reactive events as Verbose; notifications fit that posture exactly.
- **No retention cleanup in Phase 7.** Tables grow without bound. Phase 9 hardening reviews and decides whether to archive at the 2-year mark (matching CONTEXT § Retention for audit + submission files) or leave indefinite.

## Alternatives considered

| | Storage | Atomicity | Dedup | Payload | Lifecycle |
|---|---|---|---|---|---|
| **Chosen** | Fan-out rows (S1) | In-tx (A1) | Hybrid partial unique (D3) | Snapshot (P2) | Soft suppress (L3) |
| Rejected | Broadcast + receipt (S2) — hybrid path tax | Post-commit (A2) — silent drop on instance death | Full unique (D2) — breaks repeatable kinds | Reference (P1) — JOIN every bell render + dead-entity fallback complexity | Hard cascade (L2) — destroys audit trace |
| Rejected | Hybrid S1+S2 (S3) — doubles test surface | Outbox (A3) — requires cron, violates ADR-0015 | App-layer only (D1) — needs Server Action token absent in Phase 7 | — | Persist with dead-end (L1) — UX bug factory |

## Related

- **ADR-0013** — Enrollment soft-delete and rejoin-restore. § 5 of this ADR consumes the `removedAt` / restore flow to drive `suppressedAt` lifecycle.
- **ADR-0015** — Lazy session materialization. § 7 of this ADR reaffirms the no-cron posture by rejecting deadline-reminder cron and replacing it with the Due Soon widget.
- **ADR-0018** — Publish is a contract. Q11.3 sortAt = `publishedAt` for `SCORE_ITEM_PUBLISHED` notifications is anchored on the one-way nature of `publishedAt`.
- **ADR-0019** — Assignment ↔ ScoreItem coupling. `createAssignment` with `is_scored=true` produces both `ASSIGNMENT_POSTED` and (when publish happens) `SCORE_ITEM_PUBLISHED` events through the same tx.
- **ADR-0020** — Submission lifecycle. `SUBMISSION_RETURNED` notification is the user-facing surface of the RETURN workflow signal; this ADR specifies it merges with the private comment that drives the audit reason.
- **ADR-0023** — Feed aggregator. Notifications and Feed are siblings — the same events that fan out into the bell also surface in the feed; ADR-0023 specifies the read-path differences.
